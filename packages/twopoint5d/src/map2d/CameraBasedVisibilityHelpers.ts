import type {ColorRepresentation, LineBasicMaterial, Object3D} from 'three/webgpu';
import {Box3, Box3Helper, BoxGeometry, Color, Mesh, MeshBasicMaterial, PlaneHelper, Vector2, Vector3} from 'three/webgpu';
import {expectDefined} from '../utils/expectDefined.js';
import type {CameraBasedVisibility, TileBox} from './CameraBasedVisibility.js';
import {HelpersManager} from './HelpersManager.js';
import type {IMap2DVisibilitorHelpers} from './types.js';

const _size = new Vector3();

/**
 * A solid box marking a point in the scene, in the shape the three.js helpers have: it owns
 * the geometry and the material it is built from and releases both in {@link dispose}. That
 * is what {@link HelpersManager.add} asks of a node handed to it.
 *
 * It is built as a unit cube and takes its size from `scale`, so the same node can mark a
 * point of any size.
 */
class PointHelper extends Mesh<BoxGeometry, MeshBasicMaterial> {
  constructor() {
    super(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  }

  dispose(): void {
    // a mesh whose geometry slot is empty cannot be rendered, so it leaves the scene graph
    // before it gives geometry and material up, rather than asking the caller for that order
    this.removeFromParent();

    this.geometry.dispose();
    this.material.dispose();
  }
}

export class CameraBasedVisibilityHelpers implements IMap2DVisibilitorHelpers {
  #show = false;

  maxDebugHelpers = 9;

  tileBoxHelperExpand = -0.01;
  frustumBoxHelperExpand = 0;

  frustumBoxHelperColor = new Color(0x777777);
  frustumBoxPrimaryHelperColor = new Color(0xffffff);

  tileBoxHelperColor = new Color(0x772222);
  tileBoxPrimaryHelperColor = new Color(0xff0066);

  readonly #helpers = new HelpersManager();

  // The helper nodes this class keeps alive across updates. A node is built once and then
  // written to; `HelpersManager` disposes it when the whole set goes down, and only then.
  #planeHelper?: PlaneHelper;
  readonly #pointHelpers: PointHelper[] = [];
  readonly #frustumBoxHelpers: Box3Helper[] = [];
  readonly #tileBoxHelpers: Box3Helper[] = [];

  // How many of each pool the current set uses. Whatever sits above that is kept, hidden.
  #pointCount = 0;
  #frustumBoxCount = 0;
  #tileBoxCount = 0;

  // The `serial` of the visibility the current set was built from. -1 means: nothing built.
  #builtSerial = -1;

  constructor(public readonly cameraBasedVisibility: CameraBasedVisibility) {}

  get show() {
    return this.#show;
  }

  set show(show: boolean) {
    if (this.#show === show) return;
    this.#show = show;
    if (show) {
      this.update();
    } else {
      this.#helpers.remove();
      this.releasePools();
    }
  }

  private createHelpers(): void {
    this.#pointCount = 0;
    this.#frustumBoxCount = 0;
    this.#tileBoxCount = 0;

    this.updatePlaneHelpers();
    this.updateTileHelpers(this.cameraBasedVisibility.visibles);

    this.hideSurplus();

    // TODO remove this!
    const el = document.querySelector('.map2dCoords');
    if (el) {
      el.textContent = this.cameraBasedVisibility.planeCoords2D.toArray().map(Math.round).join(', ');
    }
    // ---
  }

  private updatePlaneHelpers(): void {
    if (this.#planeHelper === undefined) {
      // the helper holds the plane as a reference and follows it on its own
      this.#planeHelper = new PlaneHelper(this.cameraBasedVisibility.planeWorld, 100, 0x20f040);
      this.#helpers.add(this.#planeHelper, true);
    }

    if (this.cameraBasedVisibility.pointOnPlane) {
      this.placePointHelper(this.cameraBasedVisibility.pointOnPlane, 10, 0xc0c0c0);
    }

    this.placePointHelper(this.cameraBasedVisibility.planeOrigin, 5, 0x406090);

    const uOrigin = this.makePointOnPlane(new Vector2());
    const u0 = this.cameraBasedVisibility.planeOrigin.clone().sub(uOrigin);
    const ux = this.makePointOnPlane(new Vector2(50, 0)).add(u0);
    const uy = this.makePointOnPlane(new Vector2(0, 50)).add(u0);

    this.placePointHelper(ux, 5, 0xff0000);
    this.placePointHelper(uy, 5, 0x00ff00);
  }

  private updateTileHelpers(visibles: TileBox[]): void {
    const primaries = visibles.filter((v) => v.primary);

    primaries.forEach((tile) => {
      this.placeFrustumBoxHelper(
        expectDefined(tile.frustumBox, `the frustum box of tile ${tile.x},${tile.y}`),
        this.frustumBoxHelperExpand,
        this.frustumBoxPrimaryHelperColor,
      );
    });

    for (let i = 0; i < visibles.length; ++i) {
      // The loop bound is `visibles.length`.
      const tile = visibles[i]!;

      if (!tile.primary && i < this.maxDebugHelpers) {
        this.placeFrustumBoxHelper(
          expectDefined(tile.frustumBox, `the frustum box of tile ${tile.x},${tile.y}`),
          this.frustumBoxHelperExpand,
          this.frustumBoxHelperColor,
        );
      }

      this.placeTileBoxHelper(
        expectDefined(tile.box, `the box of tile ${tile.x},${tile.y}`),
        this.tileBoxHelperExpand,
        tile.primary ? this.tileBoxPrimaryHelperColor : this.tileBoxHelperColor,
      );
    }
  }

  private placePointHelper(point: Vector3, size: number, color: ColorRepresentation): void {
    let helper = this.#pointHelpers[this.#pointCount];
    if (helper === undefined) {
      helper = new PointHelper();
      this.#pointHelpers.push(helper);
      this.#helpers.add(helper, true);
    }
    helper.visible = true;
    helper.position.copy(point);
    helper.scale.setScalar(size);
    helper.material.color.set(color);
    this.#pointCount += 1;
  }

  private placeFrustumBoxHelper(box: Box3, expand: number, color: Color): void {
    this.placeBoxHelper(this.#frustumBoxHelpers, this.#frustumBoxCount, true, box, expand, color);
    this.#frustumBoxCount += 1;
  }

  private placeTileBoxHelper(box: Box3, expand: number, color: Color): void {
    this.placeBoxHelper(this.#tileBoxHelpers, this.#tileBoxCount, false, box, expand, color);
    this.#tileBoxCount += 1;
  }

  private placeBoxHelper(pool: Box3Helper[], index: number, addToRoot: boolean, box: Box3, expand: number, color: Color): void {
    let helper = pool[index];
    if (helper === undefined) {
      // its own Box3: the helper follows whatever sits in `box`, and the boxes of a TileBox
      // belong to the visibility and are rewritten there
      helper = new Box3Helper(new Box3(), color);
      pool.push(helper);
      this.#helpers.add(helper, addToRoot);
    }
    helper.visible = true;
    helper.box.copy(box);
    helper.box.expandByVector(helper.box.getSize(_size).multiplyScalar(expand));
    // `Box3Helper` types its material as `Material | Material[]`; three builds it with a single
    // `LineBasicMaterial`, and the color of that one is what the caller picked
    (helper.material as LineBasicMaterial).color.copy(color);
  }

  /** A node the current set does not need stays in the pool and out of sight. */
  private hideSurplus(): void {
    for (let i = this.#pointCount; i < this.#pointHelpers.length; ++i) this.#pointHelpers[i]!.visible = false;
    for (let i = this.#frustumBoxCount; i < this.#frustumBoxHelpers.length; ++i) this.#frustumBoxHelpers[i]!.visible = false;
    for (let i = this.#tileBoxCount; i < this.#tileBoxHelpers.length; ++i) this.#tileBoxHelpers[i]!.visible = false;
  }

  /**
   * Forgets the pooled nodes. Whoever calls this has just handed the whole set to the manager
   * to take down, and the manager disposes what it takes down — a pool that kept its entries
   * would hand out released geometry on the next update.
   */
  private releasePools(): void {
    this.#planeHelper = undefined;
    this.#pointHelpers.length = 0;
    this.#frustumBoxHelpers.length = 0;
    this.#tileBoxHelpers.length = 0;
    this.#pointCount = 0;
    this.#frustumBoxCount = 0;
    this.#tileBoxCount = 0;
    this.#builtSerial = -1;
  }

  private makePointOnPlane(point?: Vector2): Vector3 {
    return new Vector3(
      this.cameraBasedVisibility.map2dTileCoords.xOffset + (point?.x ?? 0),
      0,
      this.cameraBasedVisibility.map2dTileCoords.yOffset + (point?.y ?? 0),
    ).applyMatrix4(this.cameraBasedVisibility.matrixWorld);
  }

  add(scene: Object3D): void {
    if (this.#helpers.scene === scene) return;
    this.#helpers.scene = scene;
    this.releasePools();
  }

  remove(scene: Object3D): void {
    this.#helpers.removeFromScene(scene);
    this.releasePools();
  }

  update(): void {
    if (!this.#show) return;
    // the manager refuses a node it cannot place, so nothing is built until there is a scene
    if (this.#helpers.scene == null) return;
    if (this.#builtSerial === this.cameraBasedVisibility.serial) return;

    this.#builtSerial = this.cameraBasedVisibility.serial;
    this.createHelpers();
  }
}
