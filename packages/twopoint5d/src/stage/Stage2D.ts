import {emit, type EventizedObject, eventize, off, retain} from '@spearwolf/eventize';
import {pass} from 'three/tsl';
import {type Camera, type Node, type PassNode, Scene, type WebGPURenderer} from 'three/webgpu';
import {
  OnStageAfterCameraChanged,
  OnStageFirstFrame,
  OnStageResize,
  OnStageUpdateFrame,
  type StageAfterCameraChangedArgs,
  type StageResizeProps,
  type StageUpdateFrameProps,
} from '../events.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
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

/**
 * A 2D stage has a scene with 3D objects and a 2D projection.
 * The camera is automatically generated based on the projection.
 * A stage can be rendered by a StageRenderer.
 *
 * The width and height of a stage are calculated based on the properties
 * of the projection and the container dimension.
 * The container size is usually the same as the canvas element dimension,
 * but this is not always the case.
 * The StageRenderer passes the container size to the stage by calling the resize() method.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Stage2D extends EventizedObject {}

export class Stage2D implements IStage, IRenderable, IPassProvider {
  isStage2D = true;

  scene: Scene;

  /**
   * with this flag you can tell the updateProjection() method that the projection calculation needs an update
   * (e.g. the settings in the projection have changed)
   */
  needsUpdate = false;

  get name(): string {
    return this.scene.name;
  }

  set name(name: string) {
    this.scene.name = name;
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
   * every new view, and none of the drops to 0.
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
      // updateProjection() then gives the view and the camera of the new one, if the container has
      // an area for it and its specs give a view
      this.#width = 0;
      this.#height = 0;
      this.#updateCamera(() => {
        this.#cameraFromProjection = undefined;
      });
      this.updateProjection(true);
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
   * A projection places a camera assigned here as it places its own: every `updateProjection()`
   * — and every `resize()` that brings a new container size — gives it the frustum or the field
   * of view of the specs, their `near` and `far`, the direction of the projection plane and the
   * position at its `distanceToProjectionPlane`, as long as container and specs give a view with
   * an area. A stage whose camera you place yourself gets no projection.
   *
   * Every change of the camera emits `OnStageAfterCameraChanged` with the camera it replaced.
   */
  get camera(): Camera | undefined {
    return this.#cameraUserOverride ?? this.#cameraFromProjection;
  }

  set camera(camera: Camera | undefined) {
    if (this.#disposed) return;

    this.#updateCamera(() => void (this.#cameraUserOverride = camera));
    // without an override the projection's camera takes over, created now if there is none yet
    if (this.camera == null) this.updateProjection(true);
  }

  #updateCamera = (updateCallback: () => void) => {
    const prevCamera = this.camera;
    updateCallback();
    if (prevCamera !== this.camera) {
      const args: StageAfterCameraChangedArgs = [this, prevCamera];
      emit(this, OnStageAfterCameraChanged, ...args);
    }
  };

  constructor(projection?: IProjection, scene?: Scene) {
    eventize(this);
    retain(this, OnStageFirstFrame);

    this.projection = projection;

    if (scene) {
      this.scene = scene;
    } else {
      this.scene = new Scene();
      this.scene.name = 'Stage2D';
    }
  }

  resize(containerWidth: number, containerHeight: number): void {
    if (this.#disposed) return;

    if (containerWidth !== this.#containerWidth || containerHeight !== this.#containerHeight) {
      this.#containerWidth = containerWidth;
      this.#containerHeight = containerHeight;

      if (this.projection) {
        this.#updateProjection(containerWidth, containerHeight);
      }
    }
  }

  updateProjection(forceUpdate = false): void {
    if (this.#disposed) return;

    if ((forceUpdate || this.needsUpdate) && this.projection) {
      this.#updateProjection(this.#containerWidth, this.#containerHeight);
    }
  }

  #updateProjection = (width: number, height: number): void => {
    // a container whose width or height is not a finite number above 0 has no aspect ratio to fit
    // a view into: the stage keeps the camera and the size it has, and creates neither before the
    // first resize() with an area
    if (!isPositiveFinite(width) || !isPositiveFinite(height)) return;

    this.needsUpdate = false;

    this.projection!.updateViewRect(width, height);
    const [w, h] = this.projection!.getViewRect();

    // specs that give no view with an area leave the projection without one: there is nothing to
    // build a camera from, so the stage keeps the camera and the size it has
    if (!isPositiveFinite(w) || !isPositiveFinite(h)) return;

    const prevWidth = this.#width;
    const prevHeight = this.#height;

    this.#width = w;
    this.#height = h;

    if (this.camera != null) {
      this.projection!.updateCamera(this.camera);
    } else {
      this.#updateCamera(() => {
        this.#cameraFromProjection = this.projection!.createCamera();
      });
    }

    if (prevWidth !== w || prevHeight !== h) {
      const props: StageResizeProps = {
        stage: this,
        width: w,
        height: h,
      };
      emit(this, OnStageResize, props);
    }
  };

  isFirstFrame = true;

  #framesWithoutCamera = 0;
  #warnedNoCamera = false;

  updateFrame(now: number, deltaTime: number, frameNo: number): void {
    if (this.#disposed) return;

    const {scene, camera} = this;

    if (scene == null || camera == null) {
      if (!camera && !this.#warnedNoCamera && ++this.#framesWithoutCamera >= FRAMES_WITHOUT_CAMERA_BEFORE_WARNING) {
        this.#warnedNoCamera = true;
        // eslint-disable-next-line no-console
        console.warn(
          `Stage2D has had no camera for ${FRAMES_WITHOUT_CAMERA_BEFORE_WARNING} frames and renders nothing: the projection creates one on the first resize() whose width and height are finite numbers above 0 and for which its specs give a view with an area, or assign your own to stage.camera`,
        );
      }
      return;
    }

    const updateFrameProps: StageUpdateFrameProps = {
      stage: this,
      now,
      deltaTime,
      frameNo,
    };

    if (this.isFirstFrame) {
      emit(this, OnStageFirstFrame, updateFrameProps);
      this.isFirstFrame = false;
    }

    emit(this, OnStageUpdateFrame, updateFrameProps);
  }

  /**
   * Render this stage's scene with its camera. No-op until both are present
   * (i.e. until the first `resize()` with an area has created the camera from the projection),
   * and on a disposed stage.
   */
  renderTo(renderer: WebGPURenderer): void {
    if (this.#disposed) return;

    if (this.scene && this.camera) {
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
   * call of this method, or in {@link dispose} if none comes. A stage added to two
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

    if (!scene || !camera) {
      throw new Error('Stage2D.asPassNode(): no scene or camera yet — call resize() first');
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
   * Take this stage out of every `StageRenderer` that holds it before calling this — `remove()`
   * on each of them. A renderer that still lists a disposed stage keeps the released node in its
   * composed output node, and the backend silently allocates a render target for it again on the
   * next frame; the next rebuild of that node — every `add()`, every `remove()`, every write to
   * `renderOrder`, every `invalidateOutputNode()` — asks this stage for a node again and gets the
   * throw, in the middle of the frame loop.
   *
   * Afterwards `isDisposed` is `true` and {@link asPassNode} throws an error naming the class and
   * the state. `renderTo()`, `updateFrame()`, `resize()`, `updateProjection()` and a write to
   * `projection` or `camera` do nothing, and so does a further `dispose()`. The plain state stays
   * readable and writable, it just no longer drives anything: `scene`, `camera`, `projection`,
   * `containerWidth`, `containerHeight`, `width`, `height` and `name` keep the values the stage
   * was left with, and `name`, `needsUpdate`, `isFirstFrame` and `scene` still take new ones — a
   * write to `scene` goes through and has no effect, since the stage no longer builds a node from
   * it. `name` writes through to `scene.name` as it always does, and so reaches the scene the
   * caller may have handed in. A `dispose` event goes out to every subscriber before this stage stops listening;
   * no event follows it.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    // the listeners are still attached here: this event is what tells them to let go
    emit(this, 'dispose', this);
    off(this);

    this.#disposePassNode();
  }
}
