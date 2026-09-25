import type {LineBasicMaterial, Object3D} from 'three/webgpu';
import {Box3, Box3Helper, Color} from 'three/webgpu';
import {HelpersManager} from './HelpersManager.js';
import type {RectangularVisibilityArea} from './RectangularVisibilityArea.js';
import type {IMap2DVisibilitorHelpers} from './types.js';

export class RectangularVisibilityAreaHelpers implements IMap2DVisibilitorHelpers {
  visibilityArea: RectangularVisibilityArea;

  viewRectHelperHeight = 20;
  viewRectHelperColor = new Color(0xffffff);

  #viewRect?: Box3 = undefined;

  // The node this helper keeps alive across updates. It is built once and then follows
  // `#viewRect`, which `Box3Helper` holds by reference and reads on every frame;
  // `HelpersManager` disposes it when it takes it down, and only then.
  #viewRectHelper?: Box3Helper = undefined;

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
   * releases it. Switching it on builds the node right away when {@link add} has named a scene;
   * without one, the first {@link update} after `add()` builds it.
   *
   * On a disposed helper this answers `false` and a write to it does nothing.
   */
  get show() {
    return this.#show;
  }

  set show(show: boolean) {
    if (this.#disposed) return;
    if (this.#show === show) return;
    this.#show = show;
    if (show) {
      this.update();
    } else {
      this.#helpers.remove();
      this.releaseNode();
    }
  }

  /**
   * Forgets the node this helper holds. Whoever calls this has just handed it to the
   * manager to take down, and the manager disposes what it takes down — a helper that
   * kept the reference would write into a released geometry on the next update.
   */
  private releaseNode(): void {
    this.#viewRectHelper = undefined;
  }

  /**
   * Names the scene the helper node goes into. The next {@link update} builds it there, as
   * long as {@link show} is on.
   *
   * On a disposed helper this does nothing: no scene is taken, and none is built for.
   */
  add(scene: Object3D): void {
    if (this.#disposed) return;
    if (this.#helpers.scene === scene) return;
    this.#helpers.scene = scene;
    this.releaseNode();
  }

  /**
   * Takes the helper node down and gives it up. Its node sits in the scene {@link add} was
   * given, so that scene is the one to hand over here, and a call naming another is turned
   * away: the node of a scene this helper was never handed is none of its business.
   *
   * The scene stays named and {@link show} stays on, so this takes the current node down and
   * not the helper as such: the next {@link update} builds a fresh one. Whoever wants it to
   * stay down turns {@link show} off.
   *
   * On a disposed helper this does nothing — its node is already down and released.
   */
  remove(scene: Object3D): void {
    if (this.#disposed) return;
    if (this.#helpers.scene !== scene) return;
    this.#helpers.remove();
    this.releaseNode();
  }

  /**
   * Writes the shape of the visibility area into the helper node, and builds that node on the
   * first pass that finds {@link show} on and a scene named by {@link add}. The node that
   * stands is the one every later pass writes into, so it follows the area over its whole
   * life.
   *
   * On a disposed helper this does nothing: no node is built.
   */
  update() {
    if (this.#disposed) return;
    if (!this.#show) return;
    // the manager refuses a node it cannot place, so nothing is built until there is a scene
    if (this.#helpers.scene == null) return;

    const halfWidth = this.visibilityArea.width / 2;
    const halfHeight = this.visibilityArea.height / 2;
    const viewRectHelperHalfHeight = this.viewRectHelperHeight / 2;

    // written in place: the node built from this box reads it again on every frame
    const viewRect = (this.#viewRect ??= new Box3());
    viewRect.min.set(-halfWidth, -viewRectHelperHalfHeight, -halfHeight);
    viewRect.max.set(halfWidth, viewRectHelperHalfHeight, halfHeight);

    if (this.#viewRectHelper === undefined) {
      this.#viewRectHelper = new Box3Helper(viewRect, this.viewRectHelperColor);
      this.#helpers.add(this.#viewRectHelper);
    }

    // the color is a public field and may have been written after the node was built.
    // `Box3Helper` types its material as `Material | Material[]`; three builds it with a
    // single `LineBasicMaterial`, and the color of that one is what the caller picked
    (this.#viewRectHelper.material as LineBasicMaterial).color.copy(this.viewRectHelperColor);
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
    this.releaseNode();
    this.#viewRect = undefined;
  }
}
