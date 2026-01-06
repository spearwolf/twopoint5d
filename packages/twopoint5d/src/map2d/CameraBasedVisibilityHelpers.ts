import type {
  Box3,
  Object3D} from 'three/webgpu';
import {
  Box3Helper,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneHelper,
  Vector2,
  Vector3,
} from 'three/webgpu';
import type {CameraBasedVisibility} from './CameraBasedVisibility.js';
import {HelpersManager} from './HelpersManager.js';
import {type TilesWithinCoords} from './Map2DTileCoordsUtil.js';
import type {IMap2DTileCoords, IMap2DVisibilitorHelpers} from './types.js';

interface TileBox {
  id: string;
  x: number;
  y: number;
  coords?: TilesWithinCoords;
  box?: Box3;
  frustumBox?: Box3;
  centerWorld?: Vector3;
  distanceToCamera?: number;
  map2dTile?: IMap2DTileCoords;
  primary?: boolean;
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

  constructor(public readonly cammeraBasedVisibility: CameraBasedVisibility) {}

  get show() {
    return this.#show;
  }

  set show(showHelpers: boolean) {
    if (this.#show && !showHelpers) {
      this.#helpers.remove();
    }
    if (!this.#show && showHelpers) {
      this.createHelpers();
    }
    this.#show = showHelpers;
  }

  private createHelpers() {
    this.createPlaneHelpers();
    this.createTileHelpers(this.cammeraBasedVisibility.visibles);

    // TODO remove this!
    const el = document.querySelector('.map2dCoords');
    if (el) {
      el.textContent = this.cammeraBasedVisibility.planeCoords2D.toArray().map(Math.round).join(', ');
    }
    // ---
  }

  private createPlaneHelpers() {
    this.#helpers.add(new PlaneHelper(this.cammeraBasedVisibility.planeWorld, 100, 0x20f040), true);

    if (this.cammeraBasedVisibility.pointOnPlane) {
      this.addPointHelper(this.cammeraBasedVisibility.pointOnPlane, true, 10, 0xc0c0c0);
    }

    this.addPointHelper(this.cammeraBasedVisibility.planeOrigin, true, 5, 0x406090);

    const uOrigin = this.makePointOnPlane(new Vector2());
    const u0 = this.cammeraBasedVisibility.planeOrigin.clone().sub(uOrigin);
    const ux = this.makePointOnPlane(new Vector2(50, 0)).add(u0);
    const uy = this.makePointOnPlane(new Vector2(0, 50)).add(u0);

    this.addPointHelper(ux, true, 5, 0xff0000);
    this.addPointHelper(uy, true, 5, 0x00ff00);
  }

  private createTileHelpers(visibles: TileBox[]) {
    const primaries = visibles.filter((v) => v.primary);

    primaries.forEach((tile) => {
      this.addBoxHelper(tile.frustumBox, this.frustumBoxHelperExpand, this.frustumBoxPrimaryHelperColor, true);
    });

    for (let i = 0; i < visibles.length; ++i) {
      const tile = visibles[i];

      if (!tile.primary && i < this.maxDebugHelpers) {
        this.addBoxHelper(tile.frustumBox, this.frustumBoxHelperExpand, this.frustumBoxHelperColor, true);
      }

      this.addBoxHelper(
        tile.box,
        this.tileBoxHelperExpand,
        tile.primary ? this.tileBoxPrimaryHelperColor : this.tileBoxHelperColor,
        false,
      );
    }
  }

  private addPointHelper(point: Vector3, addToRoot = true, size = 10, color = 0x20f040) {
    const poiBox = new Mesh(new BoxGeometry(size, size, size), new MeshBasicMaterial({color}));
    poiBox.position.copy(point);
    this.#helpers.add(poiBox, addToRoot);
  }

  private addBoxHelper(box: Box3, expand: number, color: Color, addToRoot: boolean) {
    box = box.clone();
    const boxSize = box.getSize(new Vector3());
    box.expandByVector(boxSize.multiplyScalar(expand));

    const helper = new Box3Helper(box, color);
    this.#helpers.add(helper, addToRoot);
  }

  private makePointOnPlane(point?: Vector2): Vector3 {
    return new Vector3(
      this.cammeraBasedVisibility.map2dTileCoords.xOffset + (point?.x ?? 0),
      0,
      this.cammeraBasedVisibility.map2dTileCoords.yOffset + (point?.y ?? 0),
    ).applyMatrix4(this.cammeraBasedVisibility.matrixWorld);
  }

  add(scene: Object3D): void {
    this.#helpers.scene = scene;
  }

  remove(scene: Object3D): void {
    this.#helpers.removeFromScene(scene);
  }

  update() {
    this.#helpers.remove();
    if (this.show) {
      this.createHelpers();
    }
  }
}
