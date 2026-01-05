import {emit, eventize, retain} from '@spearwolf/eventize';
import {type Camera, Color, Scene} from 'three/webgpu';
import {
  OnStageAfterCameraChanged,
  OnStageFirstFrame,
  OnStageResize,
  OnStageUpdateFrame,
  type StageAfterCameraChangedArgs,
  type StageResizeProps,
  type StageUpdateFrameProps,
} from '../events.js';
import type {IProjection} from './IProjection.js';
import type {IStage} from './IStage.js';

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
export class Stage2D implements IStage {
  isStage2D = true;

  scene: Scene;

  autoClear = true;

  clearColor = new Color(0x000000);
  clearAlpha = 0;

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

  get width(): number {
    return this.#width;
  }

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
      this.#cameraFromProjection = undefined;
      this.updateProjection(true);
    }
  }

  #cameraFromProjection?: Camera;
  #cameraUserOverride?: Camera;

  /**
   * A camera is automatically created based on the projection and is available after the first call of the `resize()` method.
   *
   * Alternatively, you can simply set your own camera.
   *
   * This will then take precedence over the automatically created camera.
   *
   * If the camera is manually set back to `null | undefined`, the next call of `resize()`
   * will create (or reuse) the camera (created by the projection) as described above.
   */
  get camera(): Camera | undefined {
    return this.#cameraUserOverride ?? this.#cameraFromProjection;
  }

  set camera(camera: Camera | undefined) {
    this.#updateCamera(() => void (this.#cameraUserOverride = camera));
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
    this.needsUpdate = false;

    this.projection!.updateViewRect(width, height);
    const [w, h] = this.projection!.getViewRect();

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

  #noCameraErrorCount = 0;

  updateFrame(now: number, deltaTime: number, frameNo: number): void {
    const {scene, camera} = this;

    if (scene == null || camera == null) {
      if (!camera && ++this.#noCameraErrorCount === 100) {
        this.#noCameraErrorCount = -1000;
        // eslint-disable-next-line no-console
        console.warn(
          'Stage2D has no camera and therefore cannot be rendered! normally this only happens if you forget to call the resize() method ..',
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
}
