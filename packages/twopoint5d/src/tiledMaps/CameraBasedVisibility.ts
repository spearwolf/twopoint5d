import {
  Box3,
  Box3Helper,
  Color,
  Event,
  Frustum,
  Line3,
  MathUtils,
  Matrix4,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  Vector2,
  Vector3,
} from 'three';
import {AABB2} from './AABB2';
import {IMap2DVisibilitor, Map2DVisibleTiles} from './IMap2DVisibilitor';
import {Map2DTile} from './Map2DTile';
import {Map2DTileCoordsUtil, TilesWithinCoords} from './Map2DTileCoordsUtil';

interface TilePlaneBox {
  id: string;
  x: number;
  y: number;
  coords?: TilesWithinCoords;
  box?: Box3;
  map2dTile?: Map2DTile;
}

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

const makeAABB2 = ({top, left, width, height}: TilesWithinCoords): AABB2 => new AABB2(left, top, width, height);

const findTileIndex = (tiles: Map2DTile[], id: string): number => tiles.findIndex((tile) => tile.id === id);

function findPointOnPlaneThatIsInViewFrustum(
  camera: PerspectiveCamera | OrthographicCamera,
  plane: Plane,
  map2dTileCoords: Map2DTileCoordsUtil,
): Vector3 | undefined {
  const camWorldDir = camera.getWorldDirection(new Vector3()).setLength(camera.far);
  const camWorldPos = new Vector3().setFromMatrixPosition(camera.matrixWorld);

  const lineOfSightEnd = camWorldDir.clone().add(camWorldPos);
  const lineOfSight = new Line3(camWorldPos, lineOfSightEnd);

  // TODO check all frame corners of the view frustum instead of the view frustum center?

  const planeOffset = makePlaneOffsetTransform(map2dTileCoords);
  const projectPlane = plane.clone().applyMatrix4(planeOffset);

  return projectPlane.intersectLine(lineOfSight, new Vector3());
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

  readonly uuid = MathUtils.generateUUID();

  depth = 100;

  #camera?: PerspectiveCamera | OrthographicCamera;

  #showHelpers = false;

  #scene?: Object3D;

  constructor(camera?: PerspectiveCamera | OrthographicCamera) {
    this.camera = camera;
  }

  get ground(): number {
    return Math.abs(this.depth) / -2;
  }

  get ceiling(): number {
    return Math.abs(this.depth) / 2;
  }

  get needsUpdate(): boolean {
    // TODO at this point we should correctly check if something has changed on the input camera (orientation, rotation, etc),
    // but since this is rather an expensive thing to do, the intermediate result (planeCoords) might have to be cached as well
    return true;
  }

  set needsUpdate(_update: boolean) {
    // TODO fix the needsUpdate getter ;)
  }

  get camera(): PerspectiveCamera | OrthographicCamera {
    return this.#camera;
  }

  set camera(camera: PerspectiveCamera | OrthographicCamera) {
    if (this.#camera !== camera) {
      this.#camera = camera;
      this.needsUpdate = true;

      // TODO remove
      // eslint-disable-next-line no-console
      console.log('camera switched to', camera);
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
      this.removeHelpers();
    }
    this.#showHelpers = showHelpers;
  }

  computeVisibleTiles(
    previousTiles: Map2DTile[],
    [centerX, centerY]: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
  ): Map2DVisibleTiles | undefined {
    if (!this.hasCamera) {
      return undefined;
    }

    if (this.showHelpers) {
      this.removeHelpers();
    }

    // first of all, we want to know what coordinates the camera is looking at, which will then be the origin

    const pointOnPlane0 = findPointOnPlaneThatIsInViewFrustum(this.#camera, CameraBasedVisibility.Plane, map2dTileCoords);

    if (pointOnPlane0 == null) {
      return previousTiles.length > 0 ? {tiles: [], removeTiles: previousTiles} : undefined;
    }

    // based on the origin and the desired centerPoint we can now calculate the displacement of the map2d

    const pointOnPlaneOffset = toPlaneCoords(pointOnPlane0);
    const centerPointDelta = new Vector2(centerX, centerY).sub(pointOnPlaneOffset);

    // we virtually just move the camera by this offset

    const camera = this.#camera.clone();
    // camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
    // camera.position.x += centerPointDelta.x;
    // camera.position.z += centerPointDelta.y;
    // camera.updateMatrix();
    camera.applyMatrix4(new Matrix4().makeTranslation(centerPointDelta.x, 0, centerPointDelta.y));
    // camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
    camera.updateMatrixWorld(true);

    const plane = CameraBasedVisibility.Plane.clone();
    const pointOnPlane = findPointOnPlaneThatIsInViewFrustum(camera, plane, map2dTileCoords);
    const planeCoords = toPlaneCoords(pointOnPlane);

    const tileCoords = map2dTileCoords.computeTilesWithinCoords(planeCoords.x, planeCoords.y, 1, 1);
    // const tileCoords = map2dTileCoords.computeTilesWithinCoords(centerX, centerY, 1, 1);

    // and later we take this offset back again for the target coordinates

    const centerPointTransform = new Matrix4().makeTranslation(-centerPointDelta.x, 0, -centerPointDelta.y);

    camera.updateMatrix();
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    const cameraFrustum = makeCameraFrustum(camera);

    // const frustumTransform = new Matrix4().makeTranslation(centerPointDelta.x, 0, centerPointDelta.y);
    // cameraFrustum.planes.forEach((plane) => {
    //   plane.applyMatrix4(camera.matrixWorld.clone().invert()).applyMatrix4(frustumTransform);
    // });

    return this.findAllVisibleTiles(cameraFrustum, tileCoords, map2dTileCoords, centerPointTransform, previousTiles.slice(0));
  }

  private findAllVisibleTiles(
    cameraFrustum: Frustum,
    // camera: PerspectiveCamera | OrthographicCamera,
    planeTileCoords: TilesWithinCoords,
    map2dTileCoords: Map2DTileCoordsUtil,
    centerPointTransform: Matrix4,
    previousTiles: Map2DTile[],
  ): Map2DVisibleTiles | undefined {
    // const cameraFrustum = makeCameraFrustum(camera);
    const map2dOffset = makePlaneOffsetTransform(map2dTileCoords);

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

        const box = this.makeTileBox(tile.coords).applyMatrix4(map2dOffset);

        if (cameraFrustum.intersectsBox(box)) {
          visibles.push(tile);

          tile.box ??= box.applyMatrix4(centerPointTransform);

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
      this.createHelpers(visibles);
    }

    return {tiles: visibles.map((visible) => visible.map2dTile), createTiles, reuseTiles, removeTiles: previousTiles};
  }

  private createHelpers(visibles: TilePlaneBox[]) {
    if (this.#scene) {
      for (const [i, {box: visibleBox}] of visibles.entries()) {
        if (visibleBox != null) {
          const box = visibleBox.clone();
          const boxSize = box.getSize(new Vector3());
          box.expandByVector(boxSize.multiplyScalar(-0.01));

          const helper = new Box3Helper(box, new Color(i === 0 ? 0xff0066 : 0xf0f0f0));
          helper.userData.createdBy = this.uuid;
          this.#scene.add(helper);
        }
      }
    }
  }

  private makeTileBox({top, left, width, height}: TilesWithinCoords): Box3 {
    return new Box3(new Vector3(left, this.ground, top), new Vector3(left + width, this.ceiling, top + height));
  }

  addToScene(scene: Object3D<Event>): void {
    this.#scene = scene;
  }

  removeFromScene(scene: Object3D<Event>): void {
    const removeChilds: Object3D[] = [];
    for (const childNode of scene.children) {
      if (childNode.userData.createdBy === this.uuid) {
        removeChilds.push(childNode);
      }
    }
    for (const childNode of removeChilds) {
      childNode.removeFromParent();
      (childNode as any).dispose?.();
    }
  }

  removeHelpers() {
    if (this.#scene) {
      this.removeFromScene(this.#scene);
    }
  }
}
