/* eslint-disable no-console */

import {
  Box3,
  Box3Helper,
  Color,
  Event,
  Frustum,
  Line3,
  Matrix4,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  Vector2,
  Vector3,
} from 'three';
import {AABB2} from './AABB2';
import {HelpersManager} from './HelpersManager';
import {IMap2DVisibilitor, Map2DVisibleTiles} from './IMap2DVisibilitor';
import {Map2DTile} from './Map2DTile';
import {Map2DTileCoordsUtil, TilesWithinCoords} from './Map2DTileCoordsUtil';

interface TilePlaneBox {
  id: string;
  x: number;
  y: number;
  coords?: TilesWithinCoords;
  box?: Box3;
  worldBox?: Box3;
  map2dTile?: Map2DTile;
}

const MAX_DEBUG_HELPERS = 9;

const asTilePlaneBoxId = (x: number, y: number) => `${x},${y}`;

const makeTilePlaneBox = (id: string, x: number, y: number): TilePlaneBox => ({
  id,
  x,
  y,
});

const toPlaneCoords = (pointOnPlane: Vector3): Vector2 => new Vector2(pointOnPlane.x, pointOnPlane.z);

const makePlaneOffsetTransform = (map2dTileCoords: Map2DTileCoordsUtil): Matrix4 =>
  new Matrix4().makeTranslation(map2dTileCoords.xOffset, 0, map2dTileCoords.yOffset);

const makeCameraFrustum = (camera: PerspectiveCamera | OrthographicCamera): Frustum =>
  new Frustum().setFromProjectionMatrix(camera.projectionMatrix.clone().multiply(camera.matrixWorld.clone().invert()));

// const frustumApplyMatrix4 = (frustum: Frustum, matrix: Matrix4): Frustum => {
//   frustum.planes.forEach((plane) => {
//     plane.applyMatrix4(matrix);
//   });
//   return frustum;
// };

const makeAABB2 = ({top, left, width, height}: TilesWithinCoords): AABB2 => new AABB2(left, top, width, height);

const findTileIndex = (tiles: Map2DTile[], id: string): number => tiles.findIndex((tile) => tile.id === id);

function findPointOnPlaneThatIsInViewFrustum(
  camera: PerspectiveCamera | OrthographicCamera,
  plane: Plane,
  map2dTileCoords: Map2DTileCoordsUtil,
  matrixWorld: Matrix4,
  matrixWorldInverse: Matrix4,
): Vector3 | undefined {
  const camWorldDir = camera.getWorldDirection(new Vector3()).setLength(camera.far);
  const camWorldPos = new Vector3().setFromMatrixPosition(camera.matrixWorld);

  const lineOfSightEnd = camWorldDir.clone().add(camWorldPos);
  const lineOfSight = new Line3(camWorldPos, lineOfSightEnd);

  // TODO check all frame corners of the view frustum instead of the view frustum center?
  //   however, we would then need another way to define the centerPoint of the frustum
  //   -> the camera line-of-sight-target point that lies on the plane

  const planeOffset = makePlaneOffsetTransform(map2dTileCoords);
  const projectPlane = plane.clone().applyMatrix4(planeOffset).applyMatrix4(matrixWorld);

  const poi = projectPlane.intersectLine(lineOfSight, new Vector3());
  poi?.applyMatrix4(matrixWorldInverse);

  return poi;
}

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

  #lookAtCenter = false;

  #depth = 100;

  #camera?: PerspectiveCamera | OrthographicCamera;

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

  get ground(): number {
    return Math.abs(this.depth) / -2;
  }

  get ceiling(): number {
    return Math.abs(this.depth) / 2;
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

  private saveUpdateState(camera: PerspectiveCamera | OrthographicCamera) {
    this.#lastUpdateState.cameraMatrixWorld.copy(camera.matrixWorld);
    this.#lastUpdateState.cameraProjectionMatrix.copy(camera.projectionMatrix);
  }

  computeVisibleTiles(
    previousTiles: Map2DTile[],
    [centerX, centerY]: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
    node: Object3D,
  ): Map2DVisibleTiles | undefined {
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

    const camera = this.#camera;
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    this.saveUpdateState(camera); // TODO save parentNode->matrixWorld ?
    this.needsUpdate = false;

    const {matrixWorld} = node;
    const matrixWorldInverse = matrixWorld.clone().invert();

    const pointOnPlane = findPointOnPlaneThatIsInViewFrustum(
      camera,
      CameraBasedVisibility.Plane,
      map2dTileCoords,
      matrixWorld,
      matrixWorldInverse,
    );

    if (pointOnPlane == null) {
      if (isDebug) {
        console.log('no point on plane found!');
        console.groupEnd();
      }
      return previousTiles.length > 0 ? {tiles: [], removeTiles: previousTiles} : undefined;
    }

    const planeCoords = toPlaneCoords(pointOnPlane);
    const centerPoint = new Vector2(centerX, centerY);

    if (this.lookAtCenter) {
      centerPoint.sub(planeCoords);
    }

    planeCoords.add(centerPoint);

    const tileCoords = map2dTileCoords.computeTilesWithinCoords(planeCoords.x, planeCoords.y, 1, 1);

    const offset = new Vector2(map2dTileCoords.xOffset - centerPoint.x, map2dTileCoords.yOffset - centerPoint.y);

    const translate = new Vector3().setFromMatrixPosition(matrixWorld);

    const frustum = makeCameraFrustum(camera);

    if (isDebug) {
      console.log({
        planeCoords,
        centerPoint,
        tileCoords,
      });
    }

    const boxTransform = makePlaneOffsetTransform(map2dTileCoords).multiply(
      new Matrix4().makeTranslation(-centerPoint.x + translate.x, translate.y, -centerPoint.y + translate.z),
    );

    const boxWorldTransform = matrixWorld.clone().multiply(new Matrix4().makeTranslation(translate.x, translate.y, translate.z));
    // .multiply(new Matrix4().makeTranslation(offset.x + translate.x, translate.y, offset.y + translate.z));

    const visibleTiles = this.findAllVisibleTiles(
      frustum,
      tileCoords,
      map2dTileCoords,
      boxTransform,
      boxWorldTransform,
      previousTiles.slice(0),
    );

    visibleTiles.offset.copy(offset);
    visibleTiles.translate.copy(translate);

    if (isDebug) {
      console.log('visibleTiles:', visibleTiles.tiles.length);
      console.dir(visibleTiles);
      console.groupEnd();
    }

    return visibleTiles;
  }

  private findAllVisibleTiles(
    cameraFrustum: Frustum,
    planeTileCoords: TilesWithinCoords,
    map2dTileCoords: Map2DTileCoordsUtil,
    boxTransform: Matrix4,
    boxWorldTransform: Matrix4,
    previousTiles: Map2DTile[],
  ): Map2DVisibleTiles | undefined {
    const visibles: TilePlaneBox[] = [];
    const visitedIds = new Set<string>();

    const next: TilePlaneBox[] = [
      makeTilePlaneBox(
        asTilePlaneBoxId(planeTileCoords.tileLeft, planeTileCoords.tileTop),
        planeTileCoords.tileLeft,
        planeTileCoords.tileTop,
      ),
    ];

    const reuseTiles: Map2DTile[] = [];
    const createTiles: Map2DTile[] = [];

    while (next.length > 0) {
      const tile = next.pop();
      if (!visitedIds.has(tile.id)) {
        visitedIds.add(tile.id);

        tile.coords ??= map2dTileCoords.computeTilesWithinCoords(
          tile.x * planeTileCoords.tileWidth,
          tile.y * planeTileCoords.tileHeight,
          1,
          1,
        );

        tile.box ??= this.makeTileBox(tile.coords).applyMatrix4(boxTransform);

        tile.worldBox = tile.box.clone().applyMatrix4(boxWorldTransform);

        if (cameraFrustum.intersectsBox(tile.worldBox)) {
          visibles.push(tile);

          const previousTilesIndex = findTileIndex(previousTiles, Map2DTile.createID(tile.x, tile.y));

          if (previousTilesIndex >= 0) {
            tile.map2dTile = previousTiles.splice(previousTilesIndex, 1)[0];
            reuseTiles.push(tile.map2dTile);
          } else {
            tile.map2dTile = new Map2DTile(tile.x, tile.y, makeAABB2(tile.coords));
            createTiles.push(tile.map2dTile);
          }

          [
            [-1, 1],
            [-1, 0],
            [-1, -1],

            [0, 1],
            [0, -1],

            [1, 1],
            [1, 0],
            [1, -1],
          ].forEach(([dx, dy]) => {
            const [tx, ty] = [tile.coords.tileLeft + dx, tile.coords.tileTop + dy];
            const tileId = asTilePlaneBoxId(tx, ty);
            if (!visitedIds.has(tileId)) {
              // TODO should we look at the distance of the tile from the camera here?
              next.push(makeTilePlaneBox(tileId, tx, ty));
            }
          });
        }
      }
    }

    if (this.showHelpers) {
      this.createTileHelpers(visibles);
    }

    return {
      tiles: visibles.map((visible) => visible.map2dTile),
      createTiles,
      reuseTiles,

      removeTiles: previousTiles,
      offset: new Vector2(),
      translate: new Vector3(),
    };
  }

  private createTileHelpers(visibles: TilePlaneBox[]) {
    for (const [i, {box, worldBox}] of visibles.entries()) {
      if (i > MAX_DEBUG_HELPERS) {
        break;
      }
      const isFirst = i === 0;
      if (box != null) {
        this.createHelper(box, -0.01, new Color(isFirst ? 0xff0066 : 0x772222), false);
      }
      if (worldBox != null) {
        this.createHelper(worldBox, -0.015, new Color(isFirst ? 0xffff00 : 0x777722), true);
      }
    }
  }

  private createHelper(box: Box3, expand: number, color: Color, addToRoot: boolean) {
    box = box.clone();
    const boxSize = box.getSize(new Vector3());
    box.expandByVector(boxSize.multiplyScalar(expand));

    const helper = new Box3Helper(box, color);
    this.#helpers.add(helper, addToRoot);
  }

  private makeTileBox({top, left, width, height}: TilesWithinCoords): Box3 {
    return new Box3(new Vector3(left, this.ground, top), new Vector3(left + width, this.ceiling, top + height));
  }

  addToScene(scene: Object3D<Event>): void {
    this.#helpers.scene = scene;
  }

  removeFromScene(scene: Object3D<Event>): void {
    this.#helpers.removeFromScene(scene);
  }
}
