import {emit, emitStrict, type EventizedObject, eventize, off, retain} from '@spearwolf/eventize';
import {pass} from 'three/tsl';
import {type Camera, type Node, type PassNode, Scene, type WebGPURenderer} from 'three/webgpu';
import {
  OnStageAfterCameraChanged,
  OnStageAfterSceneChanged,
  OnStageDispose,
  OnStageFirstFrame,
  OnStageResize,
  OnStageUpdateFrame,
  type StageAfterCameraChangedArgs,
  type StageAfterSceneChangedArgs,
  type StageResizeProps,
  type StageUpdateFrameProps,
} from '../events.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import {throwCollected} from '../utils/throwCollected.js';
import type {IPassProvider} from './IPassProvider.js';
import type {IProjection} from './IProjection.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';

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
   * replaced, and a renderer that composes pass nodes builds its output node anew on it. Every
   * listener hears the event, also behind one that throws; the stage has taken the new scene by
   * then, and the error reaches the caller afterwards — one unchanged, several as an
   * `AggregateError`.
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
   * projection has been asked; a projection that cannot place the camera leaves it set.
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

  get containerWidth(): number {
    return this.#containerWidth;
  }

  get containerHeight(): number {
    return this.#containerHeight;
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
          this.#updateProjection(this.#containerWidth, this.#containerHeight, errors);
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
   * Every change of the camera emits `OnStageAfterCameraChanged` with the camera it replaced.
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
        this.#updateProjection(this.#containerWidth, this.#containerHeight, errors);
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

  resize(containerWidth: number, containerHeight: number): void {
    if (this.#disposed) return;

    if (containerWidth !== this.#containerWidth || containerHeight !== this.#containerHeight) {
      const prevContainerWidth = this.#containerWidth;
      const prevContainerHeight = this.#containerHeight;

      this.#containerWidth = containerWidth;
      this.#containerHeight = containerHeight;

      if (this.projection) {
        const errors: unknown[] = [];
        try {
          this.#updateProjection(containerWidth, containerHeight, errors);
        } catch (error) {
          // the container of a resize the projection refuses is not the container this stage
          // shows: it keeps the one it had, and the very same size is worth another attempt as
          // soon as the camera fits — written through, it would fall out of the guard above
          this.#containerWidth = prevContainerWidth;
          this.#containerHeight = prevContainerHeight;
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
      this.#updateProjection(this.#containerWidth, this.#containerHeight, errors);
      throwCollected(
        errors,
        'Stage2D#updateProjection(): more than one listener of OnStageAfterCameraChanged and OnStageResize threw',
      );
    }
  }

  // what the projection throws leaves this call with the state it found; what a listener throws
  // goes into `errors`, after the state stands
  #updateProjection = (width: number, height: number, errors: unknown[]): void => {
    // a container whose width or height is not a finite number above 0 has no aspect ratio to fit
    // a view into: the stage keeps the camera and the size it has, and creates neither before the
    // first resize() with an area
    if (!isPositiveFinite(width) || !isPositiveFinite(height)) return;

    const prevNeedsUpdate = this.needsUpdate;
    this.needsUpdate = false;

    this.projection!.updateViewRect(width, height);
    const {width: w, height: h} = this.projection!.getViewRect();

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

  /**
   * Render this stage's scene with its camera. No-op until the stage has a camera (until the first
   * `resize()` with an area has created it from the projection, or one is assigned), and on a
   * disposed stage.
   */
  renderTo(renderer: WebGPURenderer): void {
    if (this.#disposed) return;

    if (this.camera) {
      renderer.render(this.scene, this.camera);
    }
  }

  #passNode?: PassNode;
  #passNodeScene?: Scene;
  #passNodeCamera?: Camera;

  /**
   * Return a TSL `pass(scene, camera)` node for use inside a parent
   * `RenderPipeline`. Requires `camera` — a `resize()` with an area, or an assigned camera.
   *
   * The same node comes back for as long as {@link scene} and {@link camera} stay what they
   * were. The comparison sits in this call and not in the assignment: a change of either
   * releases the node built for the pair before it, and its render target with it, on the next
   * call of this method, or in {@link dispose} if none comes. A `StageRenderer` that composes this
   * stage listens for both changes — `OnStageAfterCameraChanged` and `OnStageAfterSceneChanged` —
   * and calls this method again on its next render. A stage added to two
   * `StageRenderer`s hands both the very same node — one node that renders its scene once per
   * frame, and two readers of that one result.
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

    // the node renders one scene through one camera; either of them moving makes a node
    // built for the pair before it useless, and it takes its render target with it
    if (this.#passNode != null && this.#passNodeScene === scene && this.#passNodeCamera === camera) {
      return this.#passNode;
    }

    this.#disposePassNode();

    this.#passNode = pass(scene, camera);
    this.#passNodeScene = scene;
    this.#passNodeCamera = camera;

    return this.#passNode;
  }

  /**
   * Releases the GPU memory of the render target of the pass node {@link asPassNode} built — color
   * and depth. The node stays, and with it every `texture()` node on it and the pipeline built on
   * it; three.js allocates the memory again on the next draw of the node, so this is safe for a
   * stage two renderers share. Does nothing without a pass node, and after {@link dispose}. A
   * `StageRenderer` calls it as soon as it no longer composes this stage.
   */
  releasePassNodeMemory(): void {
    // a renderer that removes this stage on its OnStageDispose calls this while dispose() runs, and
    // dispose() releases the node and its render target right after
    if (this.#disposed) return;
    this.#passNode?.renderTarget.dispose();
  }

  #disposePassNode(): void {
    this.#passNode?.dispose();
    this.#passNode = undefined;
    this.#passNodeScene = undefined;
    this.#passNodeCamera = undefined;
  }

  #disposed = false;

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Release the pass node this stage built for itself, and with it the render target behind it.
   * Call when this stage is no longer needed.
   *
   * The {@link scene}, the {@link camera} and the {@link projection} belong to the caller and are
   * left as they are — a `THREE.Scene` has nothing to release, whatever hangs in it was put there
   * by whoever built it, and a camera has no `dispose()` either, the one the projection created as
   * little as one assigned here.
   *
   * Every `StageRenderer` that holds this stage takes it out itself on `OnStageDispose` below,
   * and its next frame composes without it.
   *
   * Afterwards `isDisposed` is `true` and {@link asPassNode} throws an error naming the
   * class and the state. `renderTo()`, `updateFrame()`, `resize()`, `updateProjection()`
   * and a write to `projection` or `camera` do nothing, and so does a further
   * `dispose()`. The plain state no longer drives anything, and `dispose()` resets none
   * of it: `scene`, `camera`, `projection`, `containerWidth`, `containerHeight`,
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
   * error from releasing the pass node reaches the caller as well, by the same rule.
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

    try {
      this.#disposePassNode();
    } catch (error) {
      errors.push(error);
    }

    // the errors stand in the order of the teardown above, which is no promise to the caller
    throwCollected(errors, 'Stage2D#dispose(): a listener of the dispose event threw, and so did the release of the pass node');
  }
}
