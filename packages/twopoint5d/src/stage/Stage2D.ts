import {emit, emitStrict, type EventizedObject, eventize, off, retain} from '@spearwolf/eventize';
import {pass} from 'three/tsl';
import {type Camera, type Node, type PassNode, Scene, type WebGPURenderer} from 'three/webgpu';
import {
  OnStageAfterCameraChanged,
  OnStageAfterPostProcessChanged,
  OnStageAfterSceneChanged,
  OnStageDispose,
  OnStageFirstFrame,
  OnStageResize,
  OnStageUpdateFrame,
  type StageAfterCameraChangedArgs,
  type StageAfterPostProcessChangedArgs,
  type StageAfterSceneChangedArgs,
  type StageResizeProps,
  type StageUpdateFrameProps,
} from '../events.js';
import {describeValue} from '../utils/describeValue.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import {throwCollected} from '../utils/throwCollected.js';
import type {IPassProvider} from './IPassProvider.js';
import type {IProjection} from './IProjection.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import {type StagePostProcess, StagePostProcessRun} from './StagePostProcess.js';

const FRAMES_WITHOUT_CAMERA_BEFORE_WARNING = 100;

// one message for every member that refuses to answer once the stage is gone, so the class
// and the state are always in the text a caller reads out of a foreign stack
function disposedError(member: string): Error {
  return new Error(`Stage2D#${member} is not available: this stage has been disposed`);
}

export interface Stage2D extends EventizedObject {}

/**
 * A 2D stage has a scene with 3D objects and a 2D projection.
 * The camera is automatically generated based on the projection.
 * A stage can be rendered by a StageRenderer.
 *
 * The width and height of a stage are calculated based on the properties of the projection and
 * the container dimension. The container size is usually the same as the canvas element
 * dimension, but this is not always the case. The StageRenderer passes the container size to the
 * stage by calling the resize() method.
 */
export class Stage2D implements IStage, IRenderable, IPassProvider {
  isStage2D = true;

  #scene: Scene;

  /**
   * The `THREE.Scene` this stage renders. A new scene applies from the next frame on, in every
   * mode of a `StageRenderer`: every change emits `OnStageAfterSceneChanged` with the scene it
   * replaced; the pass node of {@link asPassNode} renders the new scene from its next draw, and a
   * renderer that composes this stage keeps its output node. Every listener hears the event, also
   * behind one that throws; the stage has taken the new scene by then, and the error reaches the
   * caller afterwards — one unchanged, several as an `AggregateError`.
   *
   * The scene belongs to the caller: a new one leaves the previous one as it is. After
   * {@link dispose} a write goes through and announces nothing.
   */
  get scene(): Scene {
    return this.#scene;
  }

  set scene(scene: Scene) {
    if (this.#scene === scene) return;

    const prevScene = this.#scene;
    this.#scene = scene;
    // after dispose() there is no node left to write into
    if (this.#passNode != null) this.#passNode.scene = scene;
    this.#postProcessRun?.setScene(scene);

    if (this.#disposed) return;

    const args: StageAfterSceneChangedArgs = [this, prevScene];
    emitStrict(this, OnStageAfterSceneChanged, ...args);
  }

  /**
   * Set to `true` after a change the stage does not see itself — a new value in the view specs of
   * its projection, such as `pixelZoom`. The next `updateFrame()` computes view and camera anew,
   * or an own `updateProjection()` before it.
   *
   * The flag stays `true` as long as the container has no area, and turns `false` as soon as the
   * projection has answered; a projection that throws, or cannot place the camera, leaves it set.
   */
  needsUpdate = false;

  get name(): string {
    return this.#scene.name;
  }

  set name(name: string) {
    this.#scene.name = name;
  }

  #containerWidth = 0;
  #containerHeight = 0;
  #containerPixelRatio = 1;

  get containerWidth(): number {
    return this.#containerWidth;
  }

  get containerHeight(): number {
    return this.#containerHeight;
  }

  /**
   * The pixels of the drawing buffer per unit of the container, as the last `resize()` handed it
   * in — `Display#pixelRatio` through a `StageRenderer` —, `1` until then. The projection reads it
   * for `pixelSnap`.
   */
  get containerPixelRatio(): number {
    return this.#containerPixelRatio;
  }

  #width = 0;
  #height = 0;

  /**
   * The width of the view the projection gives for the container. `0` while the stage has no
   * projection, or while its projection has given no view with an area: before the first
   * `resize()` with an area, for specs that give no view, and after an assignment to
   * `projection` until the new projection gives one. A `resize()` to a width or a height that is
   * not a finite number above 0 keeps the size, as it keeps the camera. `OnStageResize` announces
   * every new view, and none of the drops to 0. Every listener hears it, also behind one that
   * throws; the stage has taken the new size and the container by then, and the error reaches the
   * caller afterwards — one unchanged, several as an `AggregateError`.
   */
  get width(): number {
    return this.#width;
  }

  /** The height of the view the projection gives for the container; `0` whenever {@link width} is. */
  get height(): number {
    return this.#height;
  }

  #projection?: IProjection;

  get projection(): IProjection | undefined {
    return this.#projection;
  }

  set projection(projection: IProjection | undefined) {
    if (this.#disposed) return;

    if (this.#projection !== projection) {
      this.#projection = projection;
      // the size and the camera of the previous projection go first, the camera announced as the
      // camera it was: a listener to that change reads no size the stage has no view for.
      // #updateProjection() then gives the view and the camera of the new one, if the container
      // has an area for it and its specs give a view
      this.#width = 0;
      this.#height = 0;
      const errors: unknown[] = [];
      this.#updateCamera(() => {
        this.#cameraFromProjection = undefined;
      }, errors);
      // a listener of the drop that throws does not keep the stage from the camera of the new
      // projection; one that disposes the stage, or takes the projection away, does
      if (this.projection != null && !this.#disposed) {
        try {
          this.#updateProjection(this.#containerWidth, this.#containerHeight, this.#containerPixelRatio, errors);
        } catch (error) {
          errors.push(error);
        }
      }
      throwCollected(
        errors,
        'Stage2D#projection: more than one of the listeners of OnStageAfterCameraChanged and OnStageResize and the new projection threw',
      );
    }
  }

  #cameraFromProjection?: Camera;
  #cameraUserOverride?: Camera;

  /**
   * The camera this stage renders with. The projection creates one on the first `resize()`
   * whose width and height are both finite numbers above 0 and for which its specs give a view
   * with an area; until then, and on a stage without a projection, it is `undefined`:
   * `renderTo()` draws nothing and `asPassNode()` throws.
   *
   * A camera assigned here takes precedence over the projection's. Assigning `undefined` hands
   * back to the projection's camera, created on the spot if the container already has an area.
   *
   * A projection places a camera assigned here as it places its own, in every call that computes
   * the view anew: a `resize()` that brings a new container size, `updateProjection(true)`, an
   * assignment to `projection`, and `updateProjection()` or `updateFrame()` while
   * {@link needsUpdate} is set. Each gives the camera the frustum or the field of view of the
   * specs, their `near` and `far`, the direction of the projection plane and the position at its
   * `distanceToProjectionPlane`, as long as container and specs give a view with an area. The
   * assignment itself leaves the camera where it is; the next of these calls places it. A stage
   * whose camera you place yourself gets no projection.
   *
   * The pass node of {@link asPassNode} renders through a new camera from its next draw, and a
   * renderer that composes this stage keeps its output node. Every change of the camera emits
   * `OnStageAfterCameraChanged` with the camera it replaced.
   * Every listener hears it, also behind one that throws; the stage has taken the new camera by
   * then, and the error reaches the caller afterwards — one unchanged, several as an
   * `AggregateError`.
   */
  get camera(): Camera | undefined {
    return this.#cameraUserOverride ?? this.#cameraFromProjection;
  }

  set camera(camera: Camera | undefined) {
    if (this.#disposed) return;

    const errors: unknown[] = [];
    this.#updateCamera(() => void (this.#cameraUserOverride = camera), errors);
    // without an override the projection's camera takes over, created now if there is none yet
    if (this.camera == null && this.projection != null && !this.#disposed) {
      try {
        this.#updateProjection(this.#containerWidth, this.#containerHeight, this.#containerPixelRatio, errors);
      } catch (error) {
        errors.push(error);
      }
    }
    throwCollected(
      errors,
      'Stage2D#camera: more than one of the listeners of OnStageAfterCameraChanged and OnStageResize and the projection threw',
    );
  }

  // the change is made before anyone hears of it, and every listener hears it: what they throw
  // goes into `errors` for the public call to throw once its state stands
  #updateCamera = (updateCallback: () => void, errors: unknown[]) => {
    const prevCamera = this.camera;
    updateCallback();
    if (prevCamera !== this.camera) {
      // a PassNode reads its camera as a plain field when it draws, and nothing of its graph
      // depends on the camera: the node takes the new one as it is, and is drawn through it from
      // its next frame on. A camera that goes away leaves it the one it had — without a camera
      // the node is not drawn — and the next one goes into it
      const camera = this.camera;
      if (camera != null) {
        if (this.#passNode != null) this.#passNode.camera = camera;
        this.#postProcessRun?.setCamera(camera);
      }
      const args: StageAfterCameraChangedArgs = [this, prevCamera];
      try {
        emitStrict(this, OnStageAfterCameraChanged, ...args);
      } catch (error) {
        errors.push(error);
      }
    }
  };

  constructor(projection?: IProjection, scene?: Scene) {
    eventize(this);
    retain(this, OnStageFirstFrame);

    this.projection = projection;

    if (scene) {
      this.#scene = scene;
    } else {
      this.#scene = new Scene();
      this.#scene.name = 'Stage2D';
    }
  }

  /**
   * Takes the size of the container and the pixels of the drawing buffer per unit of it, and
   * computes view and camera anew where either changed. A `pixelRatio` that is left out, or that
   * is not a finite number above 0, counts as `1`; the projection reads it for `pixelSnap`.
   */
  resize(containerWidth: number, containerHeight: number, pixelRatio = 1): void {
    if (this.#disposed) return;

    const containerPixelRatio = isPositiveFinite(pixelRatio) ? pixelRatio : 1;

    if (
      containerWidth !== this.#containerWidth ||
      containerHeight !== this.#containerHeight ||
      containerPixelRatio !== this.#containerPixelRatio
    ) {
      const prevContainerWidth = this.#containerWidth;
      const prevContainerHeight = this.#containerHeight;
      const prevContainerPixelRatio = this.#containerPixelRatio;

      this.#containerWidth = containerWidth;
      this.#containerHeight = containerHeight;
      this.#containerPixelRatio = containerPixelRatio;

      if (this.projection) {
        const errors: unknown[] = [];
        try {
          this.#updateProjection(containerWidth, containerHeight, containerPixelRatio, errors);
        } catch (error) {
          // the container of a resize the projection refuses is not the container this stage
          // shows: it keeps the one it had, and the very same size is worth another attempt as
          // soon as the camera fits — written through, it would fall out of the guard above
          this.#containerWidth = prevContainerWidth;
          this.#containerHeight = prevContainerHeight;
          this.#containerPixelRatio = prevContainerPixelRatio;
          throw error;
        }
        // a listener that throws finds the container, the view and the camera taken
        throwCollected(errors, 'Stage2D#resize(): more than one listener of OnStageAfterCameraChanged and OnStageResize threw');
      }
    }
  }

  updateProjection(forceUpdate = false): void {
    if (this.#disposed) return;

    if ((forceUpdate || this.needsUpdate) && this.projection) {
      // inside the branch: updateFrame() calls this method in every frame
      const errors: unknown[] = [];
      this.#updateProjection(this.#containerWidth, this.#containerHeight, this.#containerPixelRatio, errors);
      throwCollected(
        errors,
        'Stage2D#updateProjection(): more than one listener of OnStageAfterCameraChanged and OnStageResize threw',
      );
    }
  }

  // what the projection throws leaves this call with the state it found; what a listener throws
  // goes into `errors`, after the state stands
  #updateProjection = (width: number, height: number, pixelRatio: number, errors: unknown[]): void => {
    // a container whose width or height is not a finite number above 0 has no aspect ratio to fit
    // a view into: the stage keeps the camera and the size it has, and creates neither before the
    // first resize() with an area
    if (!isPositiveFinite(width) || !isPositiveFinite(height)) return;

    const prevNeedsUpdate = this.needsUpdate;
    this.needsUpdate = false;

    let w: number;
    let h: number;
    try {
      this.projection!.updateViewRect(width, height, pixelRatio);
      ({width: w, height: h} = this.projection!.getViewRect());
    } catch (error) {
      this.needsUpdate = prevNeedsUpdate;
      throw error;
    }

    // specs that give no view with an area leave the projection without one: there is nothing to
    // build a camera from, so the stage keeps the camera and the size it has
    if (!isPositiveFinite(w) || !isPositiveFinite(h)) return;

    const prevWidth = this.#width;
    const prevHeight = this.#height;

    this.#width = w;
    this.#height = h;

    let created: Camera | undefined;

    try {
      if (this.camera != null) {
        this.projection!.updateCamera(this.camera);
      } else {
        created = this.projection!.createCamera();
      }
    } catch (error) {
      // a view no camera was built for or placed with is a view this stage never reached and
      // never announced: it keeps the size it had, and the update it owes stays owed
      this.#width = prevWidth;
      this.#height = prevHeight;
      this.needsUpdate = prevNeedsUpdate;
      throw error;
    }

    // the announcements come after the state stands, outside the rollback above: a listener that
    // throws undoes nothing the stage has taken. The camera goes first, then the size
    if (created != null) {
      this.#updateCamera(() => {
        this.#cameraFromProjection = created;
      }, errors);
    }

    if (prevWidth !== w || prevHeight !== h) {
      const props: StageResizeProps = {
        stage: this,
        width: w,
        height: h,
      };
      try {
        emitStrict(this, OnStageResize, props);
      } catch (error) {
        errors.push(error);
      }
    }
  };

  isFirstFrame = true;

  // one object per stage for OnStageUpdateFrame, rewritten in every frame; OnStageFirstFrame gets
  // one of its own, since the stage keeps that one for subscribers that come later
  readonly #updateFrameProps: StageUpdateFrameProps = {stage: this, now: 0, deltaTime: 0, frameNo: 0};

  #framesWithoutCamera = 0;
  #warnedNoCamera = false;

  /**
   * Applies a pending {@link needsUpdate} first — what the projection throws on it comes out of
   * this call, and the flag then stays set —, then emits `OnStageFirstFrame` in the first frame
   * with a camera and `OnStageUpdateFrame` in every frame with a camera. Does nothing on a
   * disposed stage.
   *
   * A listener of `OnStageAfterCameraChanged` or `OnStageResize` that throws while that pending
   * update runs ends the frame: the camera and the size stand, the error reaches the caller —
   * one unchanged, several as an `AggregateError` — and neither `OnStageFirstFrame` nor
   * `OnStageUpdateFrame` goes out in it; the first frame comes with the next call.
   *
   * Every listener of `OnStageFirstFrame` hears it, also behind one that throws; the first frame
   * is over by then — `isFirstFrame` is `false`, a later subscriber gets the retained props, and
   * the listeners of `OnStageUpdateFrame` get the frame all the same — and the error reaches the
   * caller afterwards, one unchanged, several as an `AggregateError`. `OnStageUpdateFrame` goes
   * out through `emit()`: a listener that throws ends the frame for the listeners behind it.
   */
  updateFrame(now: number, deltaTime: number, frameNo: number): void {
    if (this.#disposed) return;

    // ahead of the check for a camera: a stage whose specs give a view only after a needsUpdate
    // gets its camera in this very frame
    this.updateProjection();

    const {camera} = this;

    if (camera == null) {
      if (!this.#warnedNoCamera && ++this.#framesWithoutCamera >= FRAMES_WITHOUT_CAMERA_BEFORE_WARNING) {
        this.#warnedNoCamera = true;
        // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
        console.warn(
          `Stage2D has had no camera for ${FRAMES_WITHOUT_CAMERA_BEFORE_WARNING} frames and renders nothing: the projection creates one on the first resize() whose width and height are finite numbers above 0 and for which its specs give a view with an area, or assign your own to stage.camera`,
        );
      }
      return;
    }

    const props = this.#updateFrameProps;
    props.now = now;
    props.deltaTime = deltaTime;
    props.frameNo = frameNo;

    if (this.isFirstFrame) {
      const errors: unknown[] = [];
      try {
        emitStrict(this, OnStageFirstFrame, {stage: this, now, deltaTime, frameNo} satisfies StageUpdateFrameProps);
      } catch (error) {
        errors.push(error);
      }
      // the first frame is over whatever its listeners threw; emitStrict() has written the retained props
      this.isFirstFrame = false;
      if (errors.length > 0) {
        // the frame goes on: the listeners of OnStageUpdateFrame get frame 1 all the same
        try {
          emit(this, OnStageUpdateFrame, props);
        } catch (error) {
          errors.push(error);
        }
        throwCollected(
          errors,
          'Stage2D#updateFrame(): a listener of OnStageFirstFrame threw, and so did one of OnStageUpdateFrame',
        );
        return;
      }
    }

    emit(this, OnStageUpdateFrame, props);
  }

  #postProcess?: StagePostProcess;
  #postProcessRun?: StagePostProcessRun;

  /**
   * A post-process of this stage: the stage draws the output node its `build()` answers over the
   * scene pass, wherever it is drawn — by {@link renderTo} through a pipeline of the stage, by
   * {@link asPassNode} as the node a composing renderer takes. `undefined`, the default, draws the
   * scene as it is. See "An effect on one stage" in `docs/stages.md`.
   *
   * The object belongs to the caller and may serve several stages: the stage calls its `build()`
   * once, before the first draw that needs the node, and never disposes it. An assignment of
   * another value lets go of what the previous one built — the functions the build registered
   * through `onDispose()` run, its pass and the pipeline of the stage are disposed — and emits
   * `OnStageAfterPostProcessChanged` with the post-process it replaced. Every listener hears the
   * event, also behind one that throws; the stage has taken the new value by then, and the error
   * reaches the caller afterwards, together with what the releases threw — one unchanged, several
   * as an `AggregateError`. An assignment of the object the stage has already changes nothing; to
   * build again, assign another object. A `build()` that assigns `postProcess` or disposes the
   * stage is refused: the draw that asked for the node throws, and nothing of that build stays.
   *
   * A value that is neither `undefined` nor an object with a `build()` method is refused with a
   * `TypeError`, and the stage keeps what it has. After {@link dispose} a write does nothing.
   */
  get postProcess(): StagePostProcess | undefined {
    return this.#postProcess;
  }

  set postProcess(postProcess: StagePostProcess | undefined) {
    if (this.#disposed) return;

    if (postProcess !== undefined && typeof (postProcess as Partial<StagePostProcess> | null)?.build !== 'function') {
      throw new TypeError(
        `Stage2D#postProcess must be a StagePostProcess with a build() method or undefined, got ${describeValue(postProcess)}`,
      );
    }

    const prevPostProcess = this.#postProcess;
    if (prevPostProcess === postProcess) return;

    // the new value stands before anything foreign runs: a release of the previous build that
    // assigns again, or disposes the stage, finds the stage as this call leaves it
    const prevRun = this.#postProcessRun;
    this.#postProcess = postProcess;
    this.#postProcessRun = postProcess !== undefined ? new StagePostProcessRun(postProcess) : undefined;

    const errors: unknown[] = [];
    prevRun?.dispose(errors);

    // the pass node of the stage is not drawn while a post-process stays: three.js allocates its
    // memory again on the first draw after it
    if (postProcess !== undefined) {
      try {
        this.#passNode?.renderTarget.dispose();
      } catch (error) {
        errors.push(error);
      }
    }

    const args: StageAfterPostProcessChangedArgs = [this, prevPostProcess];
    try {
      emitStrict(this, OnStageAfterPostProcessChanged, ...args);
    } catch (error) {
      errors.push(error);
    }
    throwCollected(
      errors,
      'Stage2D#postProcess: more than one of the releases of the previous post-process and the listeners of OnStageAfterPostProcessChanged threw',
    );
  }

  /**
   * Render this stage's scene with its camera — through its {@link postProcess}, if it has one:
   * the stage then runs a pipeline of its own over the output node, which covers every pixel of
   * the current target. Into a render target the pipeline writes linear, as a plain draw does; on
   * the canvas it applies the tone mapping and the output color space of the renderer. No-op until
   * the stage has a camera (until the first `resize()` with an area has created it from the
   * projection, or one is assigned), and on a disposed stage.
   */
  renderTo(renderer: WebGPURenderer): void {
    if (this.#disposed) return;

    const {camera} = this;
    if (!camera) return;

    if (this.#postProcessRun !== undefined) {
      this.#postProcessRun.render(renderer, this, this.scene, camera);
    } else {
      renderer.render(this.scene, camera);
    }
  }

  #passNode?: PassNode;

  /**
   * Return the node of this stage for use inside a parent `RenderPipeline`: a TSL
   * `pass(scene, camera)` node, or the output node of its {@link postProcess}, built over a pass of
   * its own on the first call. Requires `camera` — a `resize()` with an area, or an assigned camera.
   *
   * The same node comes back for as long as `postProcess` stays — for the life of a stage without
   * one: a new scene or camera goes into the pass as it is assigned and applies from its next draw,
   * so a renderer that composes this stage keeps its graph and builds no shader for it. A camera
   * that goes away leaves the node with the camera it had. A stage added to two `StageRenderer`s
   * hands both the very same node — one node that renders its scene once per frame, and two
   * readers of that one result.
   *
   * The node belongs to the stage and is released by {@link dispose}. Throws on a disposed
   * stage, which builds no further node.
   */
  asPassNode(_renderer: WebGPURenderer): Node {
    if (this.#disposed) {
      throw disposedError('asPassNode()');
    }

    const {scene, camera} = this;

    if (!camera) {
      throw new Error(
        'Stage2D#asPassNode() has no camera to build a pass node with: the projection creates one on the first resize() whose width and height are finite numbers above 0 and for which its specs give a view with an area, and a stage without a projection needs one assigned to stage.camera',
      );
    }

    if (this.#postProcessRun !== undefined) return this.#postProcessRun.outputNode(this, scene, camera);

    // one node for the life of the stage: the setters of scene and camera write into it
    this.#passNode ??= pass(scene, camera);
    return this.#passNode;
  }

  /**
   * Releases the GPU memory of the render target of the pass node {@link asPassNode} built — color
   * and depth —, and of the pass of a {@link postProcess}. The node stays, and with it every `texture()` node on it and the pipeline built on
   * it; three.js allocates the memory again on the next draw of the node, so this is safe for a
   * stage two renderers share. Does nothing without a pass node, and after {@link dispose}. A
   * `StageRenderer` calls it as soon as it no longer composes this stage.
   */
  releasePassNodeMemory(): void {
    // a renderer that removes this stage on its OnStageDispose calls this while dispose() runs, and
    // dispose() releases the node and its render target right after
    if (this.#disposed) return;
    this.#passNode?.renderTarget.dispose();
    this.#postProcessRun?.releaseMemory();
  }

  #disposePassNode(): void {
    this.#passNode?.dispose();
    this.#passNode = undefined;
  }

  #disposed = false;

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Release the pass node this stage built for itself, and with it the render target behind it,
   * and what its {@link postProcess} built: the functions the build registered run, its pass and
   * the pipeline of the stage are disposed. Call when this stage is no longer needed.
   *
   * The {@link scene}, the {@link camera}, the {@link projection} and the `postProcess` object
   * belong to the caller and are left as they are — a `THREE.Scene` has nothing to release, whatever hangs in it was put there
   * by whoever built it, and a camera has no `dispose()` either, the one the projection created as
   * little as one assigned here.
   *
   * Every `StageRenderer` that holds this stage takes it out itself on `OnStageDispose` below,
   * and its next frame composes without it.
   *
   * Afterwards `isDisposed` is `true` and {@link asPassNode} throws an error naming the
   * class and the state. `renderTo()`, `updateFrame()`, `resize()`, `updateProjection()`
   * and a write to `projection`, `camera` or `postProcess` do nothing, and so does a further
   * `dispose()`. The plain state no longer drives anything, and `dispose()` resets none
   * of it: `scene`, `camera`, `projection`, `postProcess`, `containerWidth`, `containerHeight`,
   * `width`, `height`, `name`, `needsUpdate` and `isFirstFrame` answer with the values
   * the stage was left with. Of these, `scene`, `name`, `needsUpdate` and `isFirstFrame`
   * still take new ones. A write to `scene` goes through and has no effect, since the
   * stage no longer builds a node from it, and announces nothing — no
   * `OnStageAfterSceneChanged`. `name` writes through to `scene.name` as it always does,
   * and so reaches the scene the caller may have handed in. An `OnStageDispose` goes out
   * to every subscriber before this stage stops listening; no event follows it. A
   * listener of `OnStageDispose` that throws does not hold up the teardown: every
   * subscriber hears the event, the instance is torn down completely, and the error
   * reaches the caller afterwards — one unchanged, several as an `AggregateError`. An
   * error from a release of the post-process or from releasing the pass node reaches the caller
   * as well, by the same rule.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    const errors: unknown[] = [];

    // the listeners are still attached here: this event is what tells them to let go. Every one
    // of them hears it, also behind one that throws — so every StageRenderer that holds this stage
    // lets go of it; the error goes to the caller after the teardown
    try {
      emitStrict(this, OnStageDispose, this);
    } catch (error) {
      errors.push(error);
    }
    off(this);

    // the property keeps the value it was left with; what it built goes
    this.#postProcessRun?.dispose(errors);
    this.#postProcessRun = undefined;

    try {
      this.#disposePassNode();
    } catch (error) {
      errors.push(error);
    }

    // the errors stand in the order of the teardown above, which is no promise to the caller
    throwCollected(
      errors,
      'Stage2D#dispose(): more than one of the listeners of the dispose event, the releases of the post-process and the release of the pass node threw',
    );
  }
}
