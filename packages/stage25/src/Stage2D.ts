import {Camera, Scene, WebGLRenderer} from 'three';

import {IProjection} from './IProjection';

export class Stage2D {
  scene: Scene;

  containerWidth = 0;
  containerHeight = 0;

  width = 0;
  height = 0;

  #projection?: IProjection;

  get projection(): IProjection | undefined {
    return this.#projection;
  }

  set projection(projection: IProjection | undefined) {
    if (this.#projection !== projection) {
      this.#projection = projection;
      this.#cameraFromProjection = undefined;
      if (projection) {
        this.#updateProjection(this.containerWidth, this.containerHeight);
      }
    }
  }

  #cameraFromProjection?: Camera;
  #cameraUserOverride?: Camera;

  get camera(): Camera | undefined {
    return this.#cameraUserOverride ?? this.#cameraFromProjection;
  }

  set camera(camera: Camera | undefined) {
    this.#cameraUserOverride = camera;
  }

  /**
   * Without `projection` or `scene` it won`t work, but you can also set them after the constructor
   */
  constructor(projection?: IProjection, scene?: Scene) {
    this.projection = projection;
    this.scene = scene ?? new Scene();
  }

  resize(width: number, height: number): void {
    if (width !== this.containerWidth || height !== this.containerHeight) {
      this.containerWidth = width;
      this.containerHeight = height;

      if (this.projection) {
        this.#updateProjection(width, height);
      }
    }
  }

  #updateProjection = (width: number, height: number): void => {
    this.projection.updateViewRect(width, height);
    const [w, h] = this.projection.getViewRect();

    this.width = w;
    this.height = h;

    if (this.#cameraFromProjection != null) {
      this.projection.updateCamera(this.#cameraFromProjection);
    } else {
      this.#cameraFromProjection = this.projection.createCamera();
    }
  };

  #noCameraErrorCount = 0;

  renderFrame(renderer: WebGLRenderer): void {
    const {scene, camera} = this;
    if (scene && camera) {
      renderer.render(scene, camera);
    } else if (!camera && ++this.#noCameraErrorCount === 100) {
      this.#noCameraErrorCount = -1000;
      // eslint-disable-next-line no-console
      console.warn(
        'Stage2D has no camera and therefore cannot be rendered! normally this only happens if you forget to call the resize() method ..',
      );
    }
  }
}
