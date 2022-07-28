import eventize, {Eventize} from '@spearwolf/eventize';
import {Camera, Scene, WebGLRenderer} from 'three';

import {IProjection} from './IProjection';

export interface Stage2D extends Eventize {}

export class Stage2D {
  scene: Scene;

  autoClear = true;

  /**
   * Get the *scene* name
   */
  get name(): string {
    return this.scene.name;
  }

  /**
   * Set the *scene* name
   */
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

  /**
   * A _stage_ consists of a _scene_ and a _camera_, which is created from a _projection_.
   * A _stage_ also has a _dimension_ (`width` and `height`), which is calculated from the _projection_
   * and the dimension of the surrounding container (which is usually the _canvas_).
   *
   * The _projection_ can be set later by a setter (and yes, it works without if you set your own _camera_).
   *
   * A _camera_ is automatically created by the _projection_, but you can also explicitly set your own _camera_,
   * which will be used instead. Note that a _projection_ will try to adjust the _camera_ settings after a `resize()` call,
   * no matter if it is a custom _camera_ or a _camera_ created by the _projection_.
   *
   * A _stage_ can be rendered using the `renderFrame(renderer)` method.
   *
   */
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
