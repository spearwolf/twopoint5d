import type {Object3D} from 'three/webgpu';
import {Box3, Box3Helper, Color, Vector3} from 'three/webgpu';
import {HelpersManager} from './HelpersManager.js';
import type {RectangularVisibilityArea} from './RectangularVisibilityArea.js';
import type {IMap2DVisibilitorHelpers} from './types.js';

export class RectangularVisibilityAreaHelpers implements IMap2DVisibilitorHelpers {
  visibilityArea: RectangularVisibilityArea;

  viewRectHelperHeight = 20;
  viewRectHelperColor = new Color(0xffffff);

  #viewRect?: Box3 = undefined;

  #show = false;
  #disposed = false;
  readonly #helpers = new HelpersManager();

  constructor(visibilityArea: RectangularVisibilityArea) {
    this.visibilityArea = visibilityArea;
  }

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Whether the helper node is built at all. Switching it off takes the current node down and
   * releases it; switching it on builds it again.
   *
   * On a disposed helper this answers `false` and a write to it does nothing.
   */
  get show() {
    return this.#show;
  }

  set show(show: boolean) {
    if (this.#disposed) return;
    if (this.#show && !show) {
      this.#helpers.remove();
    } else if (!this.#show && show) {
      this.update();
    }
    this.#show = show;
  }

  /**
   * Names the scene the helper node goes into.
   *
   * On a disposed helper this does nothing: no scene is taken, and none is built for.
   */
  add(scene: Object3D): void {
    if (this.#disposed) return;
    this.#helpers.scene = scene;
  }

  /**
   * Takes the helper node out of `scene` and releases it.
   *
   * On a disposed helper this does nothing — its node is already down and released.
   */
  remove(scene: Object3D): void {
    if (this.#disposed) return;
    this.#helpers.removeFromScene(scene);
  }

  /**
   * Builds the helper node the visibility area currently describes, in place of the one that
   * stands.
   *
   * On a disposed helper this does nothing: no node is built.
   */
  update() {
    if (this.#disposed) return;

    const halfWidth = this.visibilityArea.width / 2;
    const halfHeight = this.visibilityArea.height / 2;
    const viewRectHelperHalfHeight = this.viewRectHelperHeight / 2;

    this.#viewRect = new Box3(
      new Vector3(-halfWidth, -viewRectHelperHalfHeight, -halfHeight),
      new Vector3(halfWidth, viewRectHelperHalfHeight, halfHeight),
    );

    this.#helpers.remove();

    // the manager refuses a node it cannot place: no scene, no helper
    if (this.#viewRect && this.#helpers.scene != null) {
      const helper = new Box3Helper(this.#viewRect, this.viewRectHelperColor);
      this.#helpers.add(helper);
    }
  }

  /**
   * Takes the helper down for good and gives up the scene it was handed. The manager disposes
   * the node it takes down, so geometry and material go with this call; the visibility area
   * this instance reads was handed in and is left as it is.
   *
   * Afterwards {@link isDisposed} is `true` and {@link show} answers `false`, while a write to
   * `show`, {@link add}, {@link remove}, {@link update} and a second {@link dispose} do
   * nothing.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    // written directly and not through the setter: the setter would start the same work a
    // second time, and behind the guard above it would do nothing at all
    this.#show = false;
    // the manager takes the node out of the scene and disposes it
    this.#helpers.scene = undefined;
    this.#viewRect = undefined;
  }
}
