import {eventize, Eventize} from '@spearwolf/eventize';
import {Camera, Scene, WebGLRenderer} from 'three';

import type {IProjection} from './IProjection.js';

export interface Stage2D extends Eventize {}

export interface Stage2DRenderFrameProps {
  stage: Stage2D;
  renderer: WebGLRenderer;

  /**
   * you do not need to call this callback yourself. it is normally done after the event.
   * however, you can use this callback to control when the THREE.WebGLRenderer is called.
   */
  renderFrame: () => void;
}

/**
 * The `Stage2D` is a facade for a `THREE.Scene` with a `THREE.Camera`.
 * The camera is managed by means of a *projection* description.
 *
 * A stage is always embedded in a logical 2d container that has a width and height.
 * Such a container can be e.g. the canvas element or another stage.
 * The stage doesn't need to know this in detail, but it gets the size of the container using the `resize(width, height)` method.
 *
 * Based on the container dimension and the *projection* description
 * the effective width and size is calculated and finally a camera is created.
 *
 * After the camera is created the scene can be rendered with the method `renderFrame(renderer: THREE.WebGLRenderer)`
 */
export class Stage2D {
  static readonly Resize = 'resize';
  static readonly AfterCameraChanged = 'afterCameraChanged';
  static readonly RenderFrame = 'renderFrame';

  scene: Scene;

  autoClear = true;

  /**
   * with this flag you can tell the .update() method that the projection calculation needs an update
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
      this.update(true);
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
   * will create (or resuse) the camera (created by the projection) as described above.
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
      this.emit(Stage2D.AfterCameraChanged, this, prevCamera);
    }
  };

  constructor(projection?: IProjection, scene?: Scene) {
    eventize(this);

    this.projection = projection;
    this.scene = scene ?? new Scene();

    // TODO set up vector of the scene??
  }

  resize(width: number, height: number): void {
    if (width !== this.#containerWidth || height !== this.#containerHeight) {
      this.#containerWidth = width;
      this.#containerHeight = height;

      if (this.projection) {
        this.#updateProjection(width, height);
      }
    }
  }

  update(forceUpdate = false): void {
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
      this.emit(Stage2D.Resize, this);
    }
  };

  #noCameraErrorCount = 0;

  renderFrame(renderer: WebGLRenderer): void {
    const {scene, camera} = this;
    if (scene && camera) {
      const wasPreviouslyAutoClear = renderer.autoClear;
      renderer.autoClear = this.autoClear;

      let isRendered = false;
      const renderFrame = () => {
        if (!isRendered) {
          isRendered = true;
          renderer.render(scene, camera);
        }
      };

      this.emit(Stage2D.RenderFrame, {stage: this, renderer, renderFrame} as Stage2DRenderFrameProps);
      renderFrame();

      renderer.autoClear = wasPreviouslyAutoClear;
    } else if (!camera && ++this.#noCameraErrorCount === 100) {
      this.#noCameraErrorCount = -1000;
      // eslint-disable-next-line no-console
      console.warn(
        'Stage2D has no camera and therefore cannot be rendered! normally this only happens if you forget to call the resize() method ..',
      );
    }
  }
}
