import {Camera, Scene, WebGLRenderer} from 'three';

import {IProjection} from './IProjection';

export class Stage2D {
  projection: IProjection;
  camera: Camera;
  scene: Scene;

  parentWidth = 0;
  parentHeight = 0;

  width = 0;
  height = 0;

  constructor(projection: IProjection, scene?: Scene) {
    this.projection = projection;
    this.scene = scene ?? new Scene();
  }

  resize(width: number, height: number): void {
    if (width !== this.parentWidth || height !== this.parentHeight) {
      this.parentWidth = width;
      this.parentHeight = height;

      this.projection.updateViewRect(width, height);
      const [w, h] = this.projection.getViewRect();
      this.width = w;
      this.height = h;

      if (this.camera != null) {
        this.projection.updateCamera(this.camera);
      } else {
        this.camera = this.projection.createCamera();
      }
    }
  }

  #noCameraErrorCount = 0;

  renderFrame(renderer: WebGLRenderer): void {
    const {scene, camera} = this;
    if (scene && camera) {
      renderer.render(scene, camera);
    } else if (!camera && ++this.#noCameraErrorCount > 100) {
      // eslint-disable-next-line no-console
      console.warn(
        'Stage2D has no camera and therefore cannot be rendered! normally this only happens if you forget to call the resize() method ..',
      );
    }
  }
}
