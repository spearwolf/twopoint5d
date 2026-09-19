import {emit, type EventizedObject, eventize, retain} from '@spearwolf/eventize';
import {pass} from 'three/tsl';
import {type Camera, type Node, Scene, type WebGPURenderer} from 'three/webgpu';
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
   * `projection` until the new projection gives one. A `resize()` to a width or a height of 0
   * keeps the size, as it keeps the camera. `OnStageResize` announces every new view, and none
   * of the drops to 0.
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
   * whose width and height are both above 0 and for which its specs give a view with an area;
   * until then, and on a stage without a projection, it is `undefined`: `renderTo()` draws
   * nothing and `asPassNode()` throws.
   *
   * A camera assigned here takes precedence over the projection's. Assigning `undefined` hands
   * back to the projection's camera, created on the spot if the container already has an area.
   *
   * Every change of the camera emits `OnStageAfterCameraChanged` with the camera it replaced.
   */
  get camera(): Camera | undefined {
    return this.#cameraUserOverride ?? this.#cameraFromProjection;
  }

  set camera(camera: Camera | undefined) {
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
    if (containerWidth !== this.#containerWidth || containerHeight !== this.#containerHeight) {
      this.#containerWidth = containerWidth;
      this.#containerHeight = containerHeight;

      if (this.projection) {
        this.#updateProjection(containerWidth, containerHeight);
      }
    }
  }

  updateProjection(forceUpdate = false): void {
    if ((forceUpdate || this.needsUpdate) && this.projection) {
      this.#updateProjection(this.#containerWidth, this.#containerHeight);
    }
  }

  #updateProjection = (width: number, height: number): void => {
    // a container without area has no aspect ratio to fit a view into: the stage keeps the
    // camera and the size it has, and creates neither before the first resize() with an area
    if (width === 0 || height === 0) return;

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
    const {scene, camera} = this;

    if (scene == null || camera == null) {
      if (!camera && !this.#warnedNoCamera && ++this.#framesWithoutCamera >= FRAMES_WITHOUT_CAMERA_BEFORE_WARNING) {
        this.#warnedNoCamera = true;
        // eslint-disable-next-line no-console
        console.warn(
          `Stage2D has had no camera for ${FRAMES_WITHOUT_CAMERA_BEFORE_WARNING} frames and renders nothing: the projection creates one on the first resize() with a width and a height above 0 for which its specs give a view with an area, or assign your own to stage.camera`,
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
   * (i.e. until the first `resize()` with an area has created the camera from the projection).
   */
  renderTo(renderer: WebGPURenderer): void {
    if (this.scene && this.camera) {
      renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Return a TSL `pass(scene, camera)` node for use inside a parent
   * `RenderPipeline`. Requires `camera` — a `resize()` with an area, or an assigned camera.
   */
  asPassNode(_renderer: WebGPURenderer): Node {
    if (!this.scene || !this.camera) {
      throw new Error('Stage2D.asPassNode(): no scene or camera yet — call resize() first');
    }
    return pass(this.scene, this.camera);
  }
}
