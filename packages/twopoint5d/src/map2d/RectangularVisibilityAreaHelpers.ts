import {Box3, Box3Helper, Color, Object3D, Vector3} from 'three/webgpu';
import {HelpersManager} from './HelpersManager.js';
import type {RectangularVisibilityArea} from './RectangularVisibilityArea.js';
import type {IMap2DVisibilitorHelpers} from './types.js';

export class RectangularVisibilityAreaHelpers implements IMap2DVisibilitorHelpers {
  visibilityArea: RectangularVisibilityArea;

  viewRectHelperHeight = 20;
  viewRectHelperColor = new Color(0xffffff);

  #viewRect?: Box3 = undefined;

  #show = false;
  readonly #helpers = new HelpersManager();

  constructor(visibilityArea: RectangularVisibilityArea) {
    this.visibilityArea = visibilityArea;
  }

  get show() {
    return this.#show;
  }

  set show(show: boolean) {
    if (this.#show && !show) {
      this.#helpers.remove();
    } else if (!this.#show && show) {
      this.update();
    }
    this.#show = show;
  }

  add(scene: Object3D): void {
    this.#helpers.scene = scene;
  }

  remove(scene: Object3D): void {
    this.#helpers.removeFromScene(scene);
  }

  update() {
    const halfWidth = this.visibilityArea.width / 2;
    const halfHeight = this.visibilityArea.height / 2;
    const viewRectHelperHalfHeight = this.viewRectHelperHeight / 2;

    this.#viewRect = new Box3(
      new Vector3(-halfWidth, -viewRectHelperHalfHeight, -halfHeight),
      new Vector3(halfWidth, viewRectHelperHalfHeight, halfHeight),
    );

    this.#helpers.remove();

    if (this.#viewRect) {
      const helper = new Box3Helper(this.#viewRect, this.viewRectHelperColor);
      this.#helpers.add(helper);
    }
  }
}
