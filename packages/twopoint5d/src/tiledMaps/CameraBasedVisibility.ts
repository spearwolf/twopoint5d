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

interface TilePlaneBox {
  id: string;
  x: number;
  y: number;
  coords?: TilesWithinCoords;
  box?: Box3;
  worldBox?: Box3;
  map2dTile?: Map2DTile;
  primary?: boolean;
}

const MAX_DEBUG_HELPERS = 9;

const asTilePlaneBoxId = (x: number, y: number) => `${x},${y}`;

const makeTilePlaneBox = (id: string, x: number, y: number): TilePlaneBox => ({
  id,
  x,
  y,
});

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

function applyToPlane(plane: Plane, map2dTileCoords: Map2DTileCoordsUtil, matrixWorld: Matrix4, map2dPoint?: Vector2): Plane {
  const planeOffset = new Matrix4().makeTranslation(
    map2dTileCoords.xOffset + (map2dPoint?.x ?? 0),
    0,
    map2dTileCoords.yOffset + (map2dPoint?.y ?? 0),
  );
  return plane.clone().applyMatrix4(planeOffset).applyMatrix4(matrixWorld);
}

const makePointOnPlane = (map2dTileCoords: Map2DTileCoordsUtil, matrixWorld: Matrix4, map2dPoint: Vector2): Vector3 => {
  return new Vector3(
    map2dTileCoords.xOffset + (map2dPoint?.x ?? 0),
    0,
    map2dTileCoords.yOffset + (map2dPoint?.y ?? 0),
  ).applyMatrix4(matrixWorld);
};

function findPointOnPlaneThatIsInViewFrustum(
  camera: PerspectiveCamera | OrthographicCamera,
  plane: Plane,
  map2dTileCoords: Map2DTileCoordsUtil,
  matrixWorld: Matrix4,
): [Vector3, Plane] {
  const camWorldDir = camera.getWorldDirection(new Vector3()).setLength(camera.far);
  const camWorldPos = new Vector3().setFromMatrixPosition(camera.matrixWorld);

  const lineOfSightEnd = camWorldDir.clone().add(camWorldPos);
  const lineOfSight = new Line3(camWorldPos, lineOfSightEnd);

  // TODO check all frame corners of the view frustum instead of the view frustum center?
  //   however, we would then need another way to define the centerPoint of the frustum
  //   -> the camera line-of-sight-target point that lies on the plane

  // const planeOffset = makePlaneOffsetTransform(map2dTileCoords);
  // const projectPlane = plane.clone().applyMatrix4(planeOffset).applyMatrix4(matrixWorld);
  const projectPlane = applyToPlane(plane, map2dTileCoords, matrixWorld);

  const poi = projectPlane.intersectLine(lineOfSight, new Vector3());

  return [poi, projectPlane];
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

  // private makeCoplanarPoint(pointOnPlane: Vector3, plane: Plane): Vector3 {
  //   const planeOrigin = plane.coplanarPoint(new Vector3());

  //   return pointOnPlane
  //     .clone()
  //     .sub(planeOrigin)
  //     .applyMatrix4(new Matrix4().makeRotationAxis(plane.normal, Math.PI / 2))
  //     .add(planeOrigin);
  // }

  // private toMap2DCoords(pointOnPlane: Vector3, plane: Plane): Vector2 {
  //   const origin = plane.coplanarPoint(new Vector3());

  //   const U = pointOnPlane.clone().sub(origin).normalize();
  //   const uN = plane.normal.clone().normalize();
  //   const V = U.clone().cross(uN);

  //   const u = origin.clone().add(U);
  //   const v = origin.clone().add(V);
  //   const n = origin.clone().add(uN);

  //   // this.createPointHelper(origin.clone().add(U.clone().multiplyScalar(100)), true, 5, 0xff0000);
  //   // this.createPointHelper(origin.clone().add(V.clone().multiplyScalar(100)), true, 5, 0x00ff00);
  //   // this.createPointHelper(origin.clone().add(uN.clone().multiplyScalar(100)), true, 5, 0x0000ff);

  //   const M = new Matrix4().set(origin.x, u.x, v.x, n.x, origin.y, u.y, v.y, n.y, origin.z, u.z, v.z, n.z, 1, 1, 1, 1).invert();

  //   const target = pointOnPlane.clone().applyMatrix4(M);

  //   return new Vector2(target.x, target.z);
  // }

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

    const [pointOnPlane3D, map2dPlane] = findPointOnPlaneThatIsInViewFrustum(
      camera,
      CameraBasedVisibility.Plane,
      map2dTileCoords,
      matrixWorld,
    );

    if (this.showHelpers) {
      this.#helpers.add(new PlaneHelper(map2dPlane, 100, 0x20f040), true);

      if (pointOnPlane3D) {
        this.createPointHelper(pointOnPlane3D, true, 10, 0xc0c0c0);

        // const origin = this.makeCoplanarPoint(pointOnPlane3D, map2dPlane);
        // this.createPointHelper(anotherPoint, true, 10, 0xff0033);

        const uOrigin = makePointOnPlane(map2dTileCoords, matrixWorld, new Vector2());
        // this.createPointHelper(uOrigin, true, 10, 0xcccccc);

        const origin = map2dPlane.coplanarPoint(new Vector3());
        this.createPointHelper(origin, true, 5, 0x406090);

        const u0 = origin.clone().sub(uOrigin);
        const ux = makePointOnPlane(map2dTileCoords, matrixWorld, new Vector2(50, 0)).add(u0);
        const uy = makePointOnPlane(map2dTileCoords, matrixWorld, new Vector2(0, 50)).add(u0);

        this.createPointHelper(ux, true, 5, 0xff0000);
        this.createPointHelper(uy, true, 5, 0x00ff00);
      }
    }

    if (pointOnPlane3D == null) {
      if (isDebug) {
        console.log('no point on plane found!');
        console.groupEnd();
      }
      return previousTiles.length > 0 ? {tiles: [], removeTiles: previousTiles} : undefined;
    }

    const planeCoords2D = this.toPlaneCoords2D(map2dPlane, pointOnPlane3D, matrixWorldInverse);

    // TODO remove me!
    if (this.showHelpers) {
      const el = document.querySelector('.map2dCoords');
      if (el) {
        el.textContent = planeCoords2D.toArray().map(Math.round).join(', ');
      }
    }

    const centerPoint2D = new Vector2(centerX, centerY);

    if (this.lookAtCenter) {
      centerPoint2D.sub(planeCoords2D);
    }

    planeCoords2D.add(centerPoint2D);

    const tileCoords = map2dTileCoords.computeTilesWithinCoords(planeCoords2D.x, planeCoords2D.y, 1, 1);

    const offset = new Vector2(map2dTileCoords.xOffset - centerPoint2D.x, map2dTileCoords.yOffset - centerPoint2D.y);

    const translate = new Vector3().setFromMatrixPosition(matrixWorld);

    const frustum = makeCameraFrustum(camera);

    if (isDebug) {
      console.log({
        planeCoords: planeCoords2D,
        centerPoint: centerPoint2D,
        tileCoords,
      });
    }

    const boxTransform = makePlaneOffsetTransform(map2dTileCoords).multiply(
      new Matrix4().makeTranslation(-centerPoint2D.x + translate.x, translate.y, -centerPoint2D.y + translate.z),
    );

    const boxWorldTransform = matrixWorld; // .clone();
    // const boxWorldTransform = matrixWorld.clone().multiply(new Matrix4().makeTranslation(translate.x, translate.y, translate.z));
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

  private toPlaneCoords2D(map2dPlane: Plane, pointOnPlane3D: Vector3, matrixWorldInverse: Matrix4) {
    const origin = map2dPlane.coplanarPoint(new Vector3());

    const v = pointOnPlane3D.clone().sub(origin).applyMatrix4(matrixWorldInverse);

    return new Vector2(v.x, v.z);
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

    next[0].primary = true;

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
    for (const [i, {box, worldBox, primary}] of visibles.entries()) {
      if (i > MAX_DEBUG_HELPERS) {
        break;
      }
      if (box != null) {
        this.createHelper(box, -0.01, new Color(primary ? 0xff0066 : 0x772222), false);
      }
      if (worldBox != null) {
        this.createHelper(worldBox, -0.015, new Color(primary ? 0xffffff : 0x777777), true);
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
