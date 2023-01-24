/* eslint-disable no-console */

import {
  Box3,
  Box3Helper,
  BoxGeometry,
  Color,
  Event,
  Frustum,
  Line3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  PlaneHelper,
  Vector2,
  Vector3,
} from 'three';
import {AABB2} from './AABB2';
import {HelpersManager} from './HelpersManager';
import {IMap2DVisibilitor, Map2DVisibleTiles} from './IMap2DVisibilitor';
import {Map2DTile} from './Map2DTile';
import {Map2DTileCoordsUtil, TilesWithinCoords} from './Map2DTileCoordsUtil';

interface TileBox {
  id: string;
  x: number;
  y: number;
  coords?: TilesWithinCoords;
  box?: Box3;
  frustumBox?: Box3;
  centerWorld?: Vector3;
  map2dTile?: Map2DTile;
  primary?: boolean;
}

const MAX_DEBUG_HELPERS = 10;

const _v = new Vector3();
const _m = new Matrix4();

const _boxTransform = new Matrix4();
const _boxTransformWorld = new Matrix4();

const toBoxId = (x: number, y: number) => `${x},${y}`;

const toAABB2 = ({top, left, width, height}: TilesWithinCoords, xOffset: number, yOffset: number): AABB2 =>
  new AABB2(left + xOffset, top + yOffset, width, height);

const makeCameraFrustum = (camera: PerspectiveCamera | OrthographicCamera, target = new Frustum()): Frustum =>
  target.setFromProjectionMatrix(_m.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse));

const findTileIndex = (tiles: Map2DTile[], id: string): number => tiles.findIndex((tile) => tile.id === id);

/**
 * This visibilitor assumes that the map2D layer is rendered in the 3d space on the xz plane.
 * So, the camera should point to the xz plane, if there should be visible tiles.
 *
 * The view frustum of the camera is used to calculate the visible tiles.
 *
 * The _far_ value of the camera may be used to limit the visibility of the tiles.
 * The _near_ value is not used.
 */
export class CameraBasedVisibility implements IMap2DVisibilitor {
  static readonly Plane = new Plane(new Vector3(0, 1, 0), 0);

  frustumBoxScale = 1.1;

  #lookAtCenter = false;

  #depth = 100;

  #camera?: PerspectiveCamera | OrthographicCamera;
  #cameraWorldPosition = new Vector3();

  #planeWorld = CameraBasedVisibility.Plane.clone();
  #planeOrigin = new Vector3();

  #pointOnPlane?: Vector3;

  #planeCoords2D = new Vector2();
  #centerPoint2D = new Vector2();

  #matrixWorld = new Matrix4();
  #matrixWorldInverse = new Matrix4();

  #cameraFrustum = new Frustum();

  #map2dTileCoords = new Map2DTileCoordsUtil();

  #showHelpers = false;

  #needsUpdate = true;

  debugNextVisibleTiles = false;

  readonly #lastUpdateState = {
    cameraMatrixWorld: new Matrix4(),
    cameraProjectionMatrix: new Matrix4(),
  };

  readonly #helpers = new HelpersManager();

  constructor(camera?: PerspectiveCamera | OrthographicCamera) {
    this.camera = camera;
  }

  /**
   * If `lookAtCenter` is set to *true* (default), then the center of the camera frustum
   * always points exactly to the center of the map2d.
   * Otherwise the center of the frustum and the center of the map2d are cumulated.
   */
  get lookAtCenter(): boolean {
    return this.#lookAtCenter;
  }

  set lookAtCenter(lookAtCenter: boolean) {
    if (this.#lookAtCenter === lookAtCenter) return;
    this.#lookAtCenter = lookAtCenter;
    this.needsUpdate = true;
  }

  set depth(depth: number) {
    if (this.#depth === depth) return;
    this.#depth = depth;
    this.needsUpdate = true;
  }

  get depth(): number {
    return this.#depth;
  }

  get needsUpdate(): boolean {
    if (this.#needsUpdate) return true;

    const camera = this.#camera;
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    return !(
      this.#lastUpdateState.cameraMatrixWorld.equals(camera.matrixWorld) &&
      this.#lastUpdateState.cameraProjectionMatrix.equals(camera.projectionMatrix)
    );
  }

  set needsUpdate(update: boolean) {
    this.#needsUpdate = update;
  }

  get camera(): PerspectiveCamera | OrthographicCamera {
    return this.#camera;
  }

  set camera(camera: PerspectiveCamera | OrthographicCamera) {
    if (this.#camera !== camera) {
      this.#camera = camera;
      this.needsUpdate = true;
    }
  }

  get hasCamera(): boolean {
    return this.#camera != null;
  }

  get showHelpers() {
    return this.#showHelpers;
  }

  set showHelpers(showHelpers: boolean) {
    if (this.#showHelpers && !showHelpers) {
      this.#helpers.remove();
    }
    if (!this.#showHelpers && showHelpers) {
      this.needsUpdate = true;
    }
    this.#showHelpers = showHelpers;
  }

  computeVisibleTiles(
    previousTiles: Map2DTile[],
    [centerX, centerY]: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
    node: Object3D,
  ): Map2DVisibleTiles | undefined {
    this.#centerPoint2D.set(centerX, centerY);
    this.#map2dTileCoords = map2dTileCoords;

    if (!this.hasCamera) {
      return undefined;
    }

    if (this.showHelpers) {
      this.#helpers.remove();
    }

    const isDebug = this.debugNextVisibleTiles;

    if (isDebug) {
      this.debugNextVisibleTiles = false;
      console.group('[CameraBasedVisibility] computeVisibleTiles:', node?.name);
    }

    this.#camera.updateMatrixWorld();
    this.#camera.updateProjectionMatrix();

    this.#matrixWorld.copy(node.matrixWorld);
    this.#matrixWorldInverse.copy(node.matrixWorld).invert();

    this.saveUpdateState(); // TODO save parentNode->matrixWorld ?
    this.needsUpdate = false;

    const pointOnPlane3D = this.findPointOnPlaneThatIsInViewFrustum();

    if (pointOnPlane3D != null) {
      if (this.#pointOnPlane == null) {
        this.#pointOnPlane = pointOnPlane3D;
      } else {
        this.#pointOnPlane.copy(pointOnPlane3D);
      }
    } else {
      this.#pointOnPlane = null;
    }

    this.#planeWorld.coplanarPoint(this.#planeOrigin);

    if (this.showHelpers) {
      this.createPlaneHelpers();
    }

    if (pointOnPlane3D == null) {
      if (isDebug) {
        console.log('no point on plane found!');
        console.groupEnd();
      }
      return previousTiles.length > 0 ? {tiles: [], removeTiles: previousTiles} : undefined;
    }

    this.convertToPlaneCoords2D(pointOnPlane3D, this.#planeCoords2D);

    if (this.lookAtCenter) {
      this.#centerPoint2D.sub(this.#planeCoords2D);
    }

    this.#planeCoords2D.add(this.#centerPoint2D);

    // TODO remove me!
    if (this.showHelpers) {
      const el = document.querySelector('.map2dCoords');
      if (el) {
        el.textContent = this.#planeCoords2D.toArray().map(Math.round).join(', ');
      }
    }

    const visibleTiles = this.findVisibleTiles(previousTiles.slice(0));

    if (isDebug) {
      console.log('visibleTiles:', visibleTiles.tiles.length);
      console.dir(visibleTiles);
      console.groupEnd();
    }

    return visibleTiles;
  }

  private findPointOnPlaneThatIsInViewFrustum(): Vector3 | null | undefined {
    const camWorldDir = this.#camera.getWorldDirection(_v).setLength(this.#camera.far);
    this.#cameraWorldPosition.setFromMatrixPosition(this.#camera.matrixWorld);

    const lineOfSightEnd = camWorldDir.clone().add(this.#cameraWorldPosition);
    const lineOfSight = new Line3(this.#cameraWorldPosition, lineOfSightEnd);

    // TODO check all frame corners of the view frustum instead of the view frustum center?
    //   however, we would then need another way to define the centerPoint of the frustum
    //   -> the camera line-of-sight-target point that lies on the plane

    this.#planeWorld
      .copy(CameraBasedVisibility.Plane)
      .applyMatrix4(_m.makeTranslation(this.#map2dTileCoords.xOffset, 0, this.#map2dTileCoords.yOffset))
      .applyMatrix4(this.#matrixWorld);

    return this.#planeWorld.intersectLine(lineOfSight, new Vector3());
  }

  private findVisibleTiles(previousTiles: Map2DTile[]): Map2DVisibleTiles | undefined {
    makeCameraFrustum(this.#camera, this.#cameraFrustum);

    const primaryTiles = this.#map2dTileCoords.computeTilesWithinCoords(this.#planeCoords2D.x, this.#planeCoords2D.y, 1, 1);

    const translate = new Vector3().setFromMatrixPosition(this.#matrixWorld);

    const isDebug = this.debugNextVisibleTiles;

    if (isDebug) {
      console.log({
        planeCoords: this.#planeCoords2D,
        centerPoint: this.#centerPoint2D,
        primaryTiles,
      });
    }

    _boxTransform.makeTranslation(
      this.#map2dTileCoords.xOffset - this.#centerPoint2D.x + translate.x,
      translate.y,
      this.#map2dTileCoords.yOffset - this.#centerPoint2D.y + translate.z,
    );

    _boxTransformWorld.copy(_boxTransform).multiply(this.#matrixWorld);

    const visibles: TileBox[] = [];
    const visitedIds = new Set<string>();

    const next: TileBox[] = [
      // TODO create _all_ primary tiles ?!
      {
        id: toBoxId(primaryTiles.tileLeft, primaryTiles.tileTop),
        x: primaryTiles.tileLeft,
        y: primaryTiles.tileTop,
        primary: true,
      },
    ];

    const reuseTiles: Map2DTile[] = [];
    const createTiles: Map2DTile[] = [];

    while (next.length > 0) {
      const tile = next.pop();
      if (!visitedIds.has(tile.id)) {
        visitedIds.add(tile.id);

        tile.coords ??= this.#map2dTileCoords.computeTilesWithinCoords(
          tile.x * primaryTiles.tileWidth,
          tile.y * primaryTiles.tileHeight,
          1,
          1,
        );

        tile.centerWorld = new Vector3(
          tile.coords.left + tile.coords.width / 2,
          0,
          tile.coords.top + tile.coords.height / 2,
        ).applyMatrix4(_boxTransformWorld);

        tile.frustumBox ??= this.makeBox(tile.coords, this.frustumBoxScale).applyMatrix4(_boxTransformWorld);

        if (this.#cameraFrustum.intersectsBox(tile.frustumBox)) {
          visibles.push(tile);

          if (isDebug) {
            tile.box ??= this.makeBox(tile.coords).applyMatrix4(_boxTransform);
          }

          tile.map2dTile = new Map2DTile(tile.x, tile.y, toAABB2(tile.coords, 0, 0));

          const previousTilesIndex = findTileIndex(previousTiles, Map2DTile.createID(tile.x, tile.y));

          if (previousTilesIndex >= 0) {
            previousTiles.splice(previousTilesIndex, 1);
            reuseTiles.push(tile.map2dTile);
          } else {
            createTiles.push(tile.map2dTile);
          }

          if (isDebug) {
            console.log('tile', previousTilesIndex >= 0 ? '(reuse)' : '(new)', tile);
          }

          [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].forEach(([dx, dy]) => {
            const [tx, ty] = [tile.coords.tileLeft + dx, tile.coords.tileTop + dy];
            const tileId = toBoxId(tx, ty);

            if (!visitedIds.has(tileId)) {
              // TODO should we look at the distance of the tile from the camera here?
              next.push({
                id: tileId,
                x: tx,
                y: ty,
              });
            }
          });
        }
      }
    }

    const offset = new Vector2(
      this.#map2dTileCoords.xOffset - this.#centerPoint2D.x,
      this.#map2dTileCoords.yOffset - this.#centerPoint2D.y,
    );

    if (this.showHelpers) {
      this.createTileHelpers(visibles);
    }

    return {
      tiles: visibles.map((visible) => visible.map2dTile),

      createTiles,
      reuseTiles,

      removeTiles: previousTiles,
      offset,
      translate,
    };
  }

  private makePointOnPlane(point?: Vector2): Vector3 {
    return new Vector3(
      this.#map2dTileCoords.xOffset + (point?.x ?? 0),
      0,
      this.#map2dTileCoords.yOffset + (point?.y ?? 0),
    ).applyMatrix4(this.#matrixWorld);
  }

  private convertToPlaneCoords2D(pointOnPlane3D: Vector3, target: Vector2) {
    _v.copy(pointOnPlane3D);
    _v.sub(this.#planeOrigin).applyMatrix4(this.#matrixWorldInverse);

    target.set(_v.x, _v.z);
  }

  private saveUpdateState() {
    this.#lastUpdateState.cameraMatrixWorld.copy(this.#camera.matrixWorld);
    this.#lastUpdateState.cameraProjectionMatrix.copy(this.#camera.projectionMatrix);
  }

  private createPlaneHelpers() {
    this.#helpers.add(new PlaneHelper(this.#planeWorld, 100, 0x20f040), true);

    if (this.#pointOnPlane) {
      this.createPointHelper(this.#pointOnPlane, true, 10, 0xc0c0c0);
    }

    this.createPointHelper(this.#planeOrigin, true, 5, 0x406090);

    const uOrigin = this.makePointOnPlane(new Vector2());
    const u0 = this.#planeOrigin.clone().sub(uOrigin);
    const ux = this.makePointOnPlane(new Vector2(50, 0)).add(u0);
    const uy = this.makePointOnPlane(new Vector2(0, 50)).add(u0);

    this.createPointHelper(ux, true, 5, 0xff0000);
    this.createPointHelper(uy, true, 5, 0x00ff00);
  }

  private createTileHelpers(visibles: TileBox[]) {
    for (const [i, {box, frustumBox, primary}] of visibles.entries()) {
      if (i > MAX_DEBUG_HELPERS) {
        break;
      }
      if (box != null) {
        this.createHelper(box, -0.01, new Color(primary ? 0xff0066 : 0x772222), false);
      }
      if (frustumBox != null) {
        this.createHelper(frustumBox, -0.015, new Color(primary ? 0xffffff : 0x777777), true);
      }
    }
  }

  private createPointHelper(point: Vector3, addToRoot = true, size = 10, color = 0x20f040) {
    const poiBox = new Mesh(new BoxGeometry(size, size, size), new MeshBasicMaterial({color}));
    poiBox.position.copy(point);
    this.#helpers.add(poiBox, addToRoot);
  }

  private createHelper(box: Box3, expand: number, color: Color, addToRoot: boolean) {
    box = box.clone();
    const boxSize = box.getSize(new Vector3());
    box.expandByVector(boxSize.multiplyScalar(expand));

    const helper = new Box3Helper(box, color);
    this.#helpers.add(helper, addToRoot);
  }

  private makeBox({top, left, width, height}: TilesWithinCoords, scale = 1): Box3 {
    const sw = width * scale - width;
    const sh = height * scale - height;
    const ground = this.#depth * -0.5 * scale;
    const ceiling = this.#depth * 0.5 * scale;
    return new Box3(new Vector3(left - sw, ground, top - sh), new Vector3(left + width + sw, ceiling, top + height + sh));
  }

  addToScene(scene: Object3D<Event>): void {
    this.#helpers.scene = scene;
  }

  removeFromScene(scene: Object3D<Event>): void {
    this.#helpers.removeFromScene(scene);
  }
}
