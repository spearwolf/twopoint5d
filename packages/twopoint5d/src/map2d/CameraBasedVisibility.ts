import {Box3, Frustum, Line3, Matrix4, OrthographicCamera, PerspectiveCamera, Plane, Vector2, Vector3} from 'three/webgpu';
import {Dependencies} from '../utils/Dependencies.js';
import {AABB2} from './AABB2.js';
import {Map2DTileCoords} from './Map2DTileCoords.js';
import {Map2DTileCoordsUtil, type TilesWithinCoords} from './Map2DTileCoordsUtil.js';
import type {IMap2DTileCoords, IMap2DVisibilitor, IMap2DVisibleTiles} from './types.js';

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

const _v = new Vector3();
const _m = new Matrix4();

const toBoxId = (x: number, y: number) => `${x},${y}`;

const toAABB2 = ({top, left, width, height}: TilesWithinCoords, xOffset: number, yOffset: number): AABB2 =>
  new AABB2(left + xOffset, top + yOffset, width, height);

const makeCameraFrustum = (camera: PerspectiveCamera | OrthographicCamera, target = new Frustum()): Frustum =>
  target.setFromProjectionMatrix(_m.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse));

const findTileIndex = (tiles: IMap2DTileCoords[], id: string): number => tiles.findIndex((tile) => tile.id === id);

const insertAndSortByDistance = (arr: TileBox[], tile: TileBox): void => {
  const index = arr.findIndex((t) => tile.distanceToCamera < t.distanceToCamera);
  if (index === -1) {
    arr.push(tile);
  } else {
    arr.splice(index, 0, tile);
  }
};

/**
 * This visibilitor assumes that the map2D layer is rendered in the 3D space on the XZ ground plane.
 * So, the camera should point somehow to the XZ plane, if there should be visible tiles.
 *
 * The view frustum of the camera is used to calculate the visible tiles.
 *
 * The _far_ value of the camera may be used to limit the visibility of the tiles.
 * The _near_ value is not used.
 */
export class CameraBasedVisibility implements IMap2DVisibilitor {
  static readonly Plane = new Plane(new Vector3(0, 1, 0), 0);

  frustumBoxScale = 1.1;

  /**
   * If `lookAtCenter` is set to *true* (default), then the center of the camera frustum
   * always points exactly to the center of the map2d.
   * Otherwise the center of the frustum and the center of the map2d are cumulated.
   */
  lookAtCenter = false;

  depth = 100;

  camera?: PerspectiveCamera | OrthographicCamera;

  #cameraWorldPosition = new Vector3();

  planeWorld = CameraBasedVisibility.Plane.clone();
  planeOrigin = new Vector3();

  pointOnPlane?: Vector3;

  planeCoords2D = new Vector2();
  #centerPoint2D = new Vector2();

  matrixWorld = new Matrix4();
  #matrixWorldInverse = new Matrix4();

  #cameraFrustum = new Frustum();

  #tileBoxMatrix = new Matrix4();

  map2dTileCoords = new Map2DTileCoordsUtil();

  readonly #deps = new Dependencies([
    'depth',
    'lookAtCenter',
    Dependencies.cloneable<Vector2>('centerPoint2D'),
    Dependencies.cloneable<Map2DTileCoordsUtil>('map2dTileCoords'),
    Dependencies.cloneable<Matrix4>('matrixWorld'),
    Dependencies.cloneable<Matrix4>('cameraMatrixWorld'),
    Dependencies.cloneable<Matrix4>('cameraProjectionMatrix'),
  ]);

  readonly visibles: TileBox[] = [];
  #visibleTiles?: IMap2DVisibleTiles;

  constructor(camera?: PerspectiveCamera | OrthographicCamera) {
    this.camera = camera;
  }

  private dependenciesChanged(matrixWorld: Matrix4): boolean {
    return this.#deps.changed({
      depth: this.depth,
      lookAtCenter: this.lookAtCenter,
      centerPoint2D: this.#centerPoint2D,
      map2dTileCoords: this.map2dTileCoords,
      matrixWorld,
      cameraMatrixWorld: this.camera.matrixWorld,
      cameraProjectionMatrix: this.camera.projectionMatrix,
    });
  }

  computeVisibleTiles(
    previousTiles: IMap2DTileCoords[],
    [centerX, centerY]: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
    matrixWorld: Matrix4,
  ): IMap2DVisibleTiles | undefined {
    if (!this.camera) {
      return undefined;
    }

    this.map2dTileCoords = map2dTileCoords;
    this.#centerPoint2D.set(centerX, centerY);

    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();

    if (!this.dependenciesChanged(matrixWorld)) {
      if (this.#visibleTiles) {
        this.#visibleTiles.createTiles = undefined;
        this.#visibleTiles.reuseTiles = this.#visibleTiles.tiles;
        this.#visibleTiles.removeTiles = undefined;
      }
      return this.#visibleTiles;
    }

    this.matrixWorld.copy(matrixWorld);
    this.#matrixWorldInverse.copy(matrixWorld).invert();

    const pointOnPlane3D = this.findPointOnPlaneThatIsInViewFrustum();

    if (pointOnPlane3D != null) {
      if (this.pointOnPlane == null) {
        this.pointOnPlane = pointOnPlane3D;
      } else {
        this.pointOnPlane.copy(pointOnPlane3D);
      }
    } else {
      this.pointOnPlane = null;
    }

    this.planeWorld.coplanarPoint(this.planeOrigin);

    if (pointOnPlane3D == null) {
      this.#visibleTiles = previousTiles.length > 0 ? {tiles: [], removeTiles: previousTiles} : undefined;
      return this.#visibleTiles;
    }

    this.convertToPlaneCoords2D(pointOnPlane3D, this.planeCoords2D);

    if (this.lookAtCenter) {
      this.#centerPoint2D.sub(this.planeCoords2D);
    }

    this.planeCoords2D.add(this.#centerPoint2D);

    this.#visibleTiles = this.findVisibleTiles(previousTiles);

    return this.#visibleTiles;
  }

  private findPointOnPlaneThatIsInViewFrustum(): Vector3 | null | undefined {
    const camWorldDir = this.camera.getWorldDirection(_v).setLength(this.camera.far);
    this.#cameraWorldPosition.setFromMatrixPosition(this.camera.matrixWorld);

    const lineOfSightEnd = camWorldDir.clone().add(this.#cameraWorldPosition);
    const lineOfSight = new Line3(this.#cameraWorldPosition, lineOfSightEnd);

    // TODO check all frame corners of the view frustum instead of the view frustum center?
    //   however, we would then need another way to define the centerPoint of the frustum
    //   -> the camera line-of-sight-target point that lies on the plane

    this.planeWorld
      .copy(CameraBasedVisibility.Plane)
      .applyMatrix4(_m.makeTranslation(this.map2dTileCoords.xOffset, 0, this.map2dTileCoords.yOffset))
      .applyMatrix4(this.matrixWorld);

    return this.planeWorld.intersectLine(lineOfSight, new Vector3());
  }

  private findVisibleTiles(previousTiles: IMap2DTileCoords[]): IMap2DVisibleTiles | undefined {
    previousTiles = previousTiles.slice(0);

    makeCameraFrustum(this.camera, this.#cameraFrustum);

    const primaryTiles = this.map2dTileCoords.computeTilesWithinCoords(
      this.planeCoords2D.x - this.map2dTileCoords.tileWidth / 2,
      this.planeCoords2D.y - this.map2dTileCoords.tileHeight / 2,
      this.map2dTileCoords.tileWidth,
      this.map2dTileCoords.tileHeight,
    );

    const translate = new Vector3().setFromMatrixPosition(this.matrixWorld);

    this.#tileBoxMatrix.makeTranslation(
      this.map2dTileCoords.xOffset - this.#centerPoint2D.x + translate.x,
      translate.y,
      this.map2dTileCoords.yOffset - this.#centerPoint2D.y + translate.z,
    );

    const next: TileBox[] = [];

    for (let ty = 0; ty < primaryTiles.rows; ty++) {
      for (let tx = 0; tx < primaryTiles.columns; tx++) {
        const x = primaryTiles.tileLeft + tx;
        const y = primaryTiles.tileTop + ty;
        next.push({
          id: toBoxId(x, y),
          x,
          y,
          primary: true,
        });
      }
    }

    const reuseTiles: IMap2DTileCoords[] = [];
    const createTiles: IMap2DTileCoords[] = [];

    const visitedIds = new Set<string>();

    this.visibles.length = 0;

    while (next.length > 0) {
      const tile = next.pop();
      if (!visitedIds.has(tile.id)) {
        visitedIds.add(tile.id);

        tile.coords ??= this.map2dTileCoords.computeTilesWithinCoords(
          tile.x * primaryTiles.tileWidth,
          tile.y * primaryTiles.tileHeight,
          1,
          1,
        );

        tile.frustumBox ??= this.makeBox(tile.coords, this.frustumBoxScale)
          .applyMatrix4(this.#tileBoxMatrix)
          .applyMatrix4(this.matrixWorld);

        if (this.#cameraFrustum.intersectsBox(tile.frustumBox)) {
          tile.centerWorld = new Vector3(tile.coords.left + tile.coords.width / 2, 0, tile.coords.top + tile.coords.height / 2)
            .applyMatrix4(this.#tileBoxMatrix)
            .applyMatrix4(this.matrixWorld);

          tile.distanceToCamera = tile.centerWorld.distanceTo(this.#cameraWorldPosition);

          insertAndSortByDistance(this.visibles, tile);

          tile.box ??= this.makeBox(tile.coords).applyMatrix4(this.#tileBoxMatrix);

          tile.map2dTile = new Map2DTileCoords(tile.x, tile.y, toAABB2(tile.coords, 0, 0));

          const previousTilesIndex = findTileIndex(previousTiles, Map2DTileCoords.createID(tile.x, tile.y));

          if (previousTilesIndex >= 0) {
            previousTiles.splice(previousTilesIndex, 1);
            reuseTiles.push(tile.map2dTile);
          } else {
            createTiles.push(tile.map2dTile);
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
      this.map2dTileCoords.xOffset - this.#centerPoint2D.x,
      this.map2dTileCoords.yOffset - this.#centerPoint2D.y,
    );

    return {
      tiles: this.visibles.map((visible) => visible.map2dTile),

      createTiles,
      reuseTiles,
      removeTiles: previousTiles,

      offset,
      translate,
    };
  }

  private convertToPlaneCoords2D(pointOnPlane3D: Vector3, target: Vector2) {
    _v.copy(pointOnPlane3D);
    _v.sub(this.planeOrigin).applyMatrix4(this.#matrixWorldInverse);

    target.set(_v.x, _v.z);
  }

  private makeBox({top, left, width, height}: TilesWithinCoords, scale = 1): Box3 {
    const sw = width * scale - width;
    const sh = height * scale - height;
    const ground = this.depth * -0.5 * scale;
    const ceiling = this.depth * 0.5 * scale;
    return new Box3(new Vector3(left - sw, ground, top - sh), new Vector3(left + width + sw, ceiling, top + height + sh));
  }
}
