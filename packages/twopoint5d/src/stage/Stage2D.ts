import eventize, {Eventize} from '@spearwolf/eventize';
import {Camera, Scene, WebGLRenderer} from 'three';

import {IProjection} from './IProjection';

export interface Stage2D extends Eventize {}

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
  scene: Scene;

  autoClear = true;

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
      if (projection) {
        this.#updateProjection(this.#containerWidth, this.#containerHeight);
      }
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
      this.emit('afterCameraChanged', this, prevCamera);
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

  #updateProjection = (width: number, height: number): void => {
    this.projection.updateViewRect(width, height);
    const [w, h] = this.projection.getViewRect();

    const prevWidth = this.#width;
    const prevHeight = this.#height;
    this.#width = w;
    this.#height = h;

    if (this.camera != null) {
      this.projection.updateCamera(this.camera);
    } else {
      this.#updateCamera(() => void (this.#cameraFromProjection = this.projection.createCamera()));
    }

    if (prevWidth !== w || prevHeight !== h) {
      this.emit('resize', this);
    }
  };

  #noCameraErrorCount = 0;

  renderFrame(renderer: WebGLRenderer): void {
    const {scene, camera} = this;
    if (scene && camera) {
      const wasPreviouslyAutoClear = renderer.autoClear;
      renderer.autoClear = this.autoClear;
      renderer.render(scene, camera);
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
