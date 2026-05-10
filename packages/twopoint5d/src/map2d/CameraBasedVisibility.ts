import type {OrthographicCamera, PerspectiveCamera} from 'three/webgpu';
import {Box3, Frustum, Line3, Matrix4, Plane, Vector2, Vector3} from 'three/webgpu';
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

const NEIGHBOR_DX_DY: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

const toBoxId = (x: number, y: number) => `${x},${y}`;

const setAABB2 = (target: AABB2, {top, left, width, height}: TilesWithinCoords): AABB2 =>
  target.set(left, top, width, height);

const makeCameraFrustum = (camera: PerspectiveCamera | OrthographicCamera, target = new Frustum()): Frustum =>
  target.setFromProjectionMatrix(_m.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse));

const sortByDistance = (a: TileBox, b: TileBox): number => a.distanceToCamera! - b.distanceToCamera!;

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

  // Per-frame scratch buffers — reused across calls to keep GC pressure low.
  readonly #visitedIds = new Set<string>();
  readonly #nextStack: TileBox[] = [];
  readonly #previousTilesById = new Map<string, IMap2DTileCoords>();

  // Pool of TileBox slots keyed by `${x},${y}`. Each slot owns its Box3/Vector3/Map2DTileCoords
  // shells so subsequent frames can mutate them in place instead of allocating new ones.
  readonly #tileBoxPool = new Map<string, TileBox>();

  // Snapshot of the tile-grid parameters that drive `tile.coords`. When any of these change
  // we invalidate the per-slot `coords` caches so the next frame recomputes them.
  #cachedTileCoords: Map2DTileCoordsUtil | undefined;

  // Hot-path scratch instances — kept on the class to share across frames.
  readonly #scratchTranslate = new Vector3();
  readonly #scratchOffset = new Vector2();
  readonly #scratchCamDir = new Vector3();
  readonly #scratchLineEnd = new Vector3();
  readonly #scratchLineOfSight = new Line3();
  readonly #scratchPlaneIntersection = new Vector3();

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

  private invalidateTileCoordsCacheIfChanged(): void {
    const current = this.map2dTileCoords;
    if (this.#cachedTileCoords && this.#cachedTileCoords.equals(current)) return;

    if (this.#cachedTileCoords) {
      this.#cachedTileCoords.copy(current);
    } else {
      this.#cachedTileCoords = current.clone();
    }

    // Tile geometry parameters changed → cached `coords` on each pool slot is stale.
    for (const tile of this.#tileBoxPool.values()) {
      tile.coords = undefined;
    }
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

    this.invalidateTileCoordsCacheIfChanged();

    this.matrixWorld.copy(matrixWorld);
    this.#matrixWorldInverse.copy(matrixWorld).invert();

    const pointOnPlane3D = this.findPointOnPlaneThatIsInViewFrustum();

    if (pointOnPlane3D != null) {
      if (this.pointOnPlane == null) {
        this.pointOnPlane = new Vector3();
      }
      this.pointOnPlane.copy(pointOnPlane3D);
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
    const camWorldDir = this.camera.getWorldDirection(this.#scratchCamDir).setLength(this.camera.far);
    this.#cameraWorldPosition.setFromMatrixPosition(this.camera.matrixWorld);

    this.#scratchLineEnd.copy(camWorldDir).add(this.#cameraWorldPosition);
    this.#scratchLineOfSight.set(this.#cameraWorldPosition, this.#scratchLineEnd);

    // TODO check all frame corners of the view frustum instead of the view frustum center?

    this.planeWorld
      .copy(CameraBasedVisibility.Plane)
      .applyMatrix4(_m.makeTranslation(this.map2dTileCoords.xOffset, 0, this.map2dTileCoords.yOffset))
      .applyMatrix4(this.matrixWorld);

    return this.planeWorld.intersectLine(this.#scratchLineOfSight, this.#scratchPlaneIntersection);
  }

  private acquireTileBox(x: number, y: number, primary: boolean): TileBox {
    const id = toBoxId(x, y);
    let tile = this.#tileBoxPool.get(id);
    if (tile === undefined) {
      tile = {id, x, y, primary};
      this.#tileBoxPool.set(id, tile);
    } else {
      tile.primary = primary;
    }
    return tile;
  }

  private findVisibleTiles(previousTiles: IMap2DTileCoords[]): IMap2DVisibleTiles | undefined {
    // Reset reusable working buffers.
    this.#visitedIds.clear();
    this.#nextStack.length = 0;
    this.visibles.length = 0;

    // Index previousTiles by id for O(1) reuse lookups (replaces the original O(n²) splice loop).
    this.#previousTilesById.clear();
    for (let i = 0; i < previousTiles.length; ++i) {
      this.#previousTilesById.set(previousTiles[i].id, previousTiles[i]);
    }

    makeCameraFrustum(this.camera, this.#cameraFrustum);

    const primaryTiles = this.map2dTileCoords.computeTilesWithinCoords(
      this.planeCoords2D.x - this.map2dTileCoords.tileWidth / 2,
      this.planeCoords2D.y - this.map2dTileCoords.tileHeight / 2,
      this.map2dTileCoords.tileWidth,
      this.map2dTileCoords.tileHeight,
    );

    const translate = this.#scratchTranslate.setFromMatrixPosition(this.matrixWorld);

    this.#tileBoxMatrix.makeTranslation(
      this.map2dTileCoords.xOffset - this.#centerPoint2D.x + translate.x,
      translate.y,
      this.map2dTileCoords.yOffset - this.#centerPoint2D.y + translate.z,
    );

    for (let ty = 0; ty < primaryTiles.rows; ty++) {
      for (let tx = 0; tx < primaryTiles.columns; tx++) {
        this.#nextStack.push(this.acquireTileBox(primaryTiles.tileLeft + tx, primaryTiles.tileTop + ty, true));
      }
    }

    const reuseTiles: IMap2DTileCoords[] = [];
    const createTiles: IMap2DTileCoords[] = [];

    while (this.#nextStack.length > 0) {
      const tile = this.#nextStack.pop()!;
      if (this.#visitedIds.has(tile.id)) continue;
      this.#visitedIds.add(tile.id);

      tile.coords ??= this.map2dTileCoords.computeTilesWithinCoords(
        tile.x * primaryTiles.tileWidth,
        tile.y * primaryTiles.tileHeight,
        1,
        1,
      );

      if (tile.frustumBox === undefined) tile.frustumBox = new Box3();
      this.setBox(tile.frustumBox, tile.coords, this.frustumBoxScale)
        .applyMatrix4(this.#tileBoxMatrix)
        .applyMatrix4(this.matrixWorld);

      if (this.#cameraFrustum.intersectsBox(tile.frustumBox)) {
        if (tile.centerWorld === undefined) tile.centerWorld = new Vector3();
        tile.centerWorld
          .set(tile.coords.left + tile.coords.width / 2, 0, tile.coords.top + tile.coords.height / 2)
          .applyMatrix4(this.#tileBoxMatrix)
          .applyMatrix4(this.matrixWorld);

        tile.distanceToCamera = tile.centerWorld.distanceTo(this.#cameraWorldPosition);

        this.visibles.push(tile);

        if (tile.box === undefined) tile.box = new Box3();
        this.setBox(tile.box, tile.coords).applyMatrix4(this.#tileBoxMatrix);

        if (tile.map2dTile === undefined) {
          tile.map2dTile = new Map2DTileCoords(tile.x, tile.y, new AABB2());
        }
        setAABB2(tile.map2dTile.view, tile.coords);

        const previous = this.#previousTilesById.get(tile.map2dTile.id);
        if (previous !== undefined) {
          this.#previousTilesById.delete(tile.map2dTile.id);
          reuseTiles.push(tile.map2dTile);
        } else {
          createTiles.push(tile.map2dTile);
        }

        for (let i = 0; i < NEIGHBOR_DX_DY.length; ++i) {
          const dx = NEIGHBOR_DX_DY[i][0];
          const dy = NEIGHBOR_DX_DY[i][1];
          const tx = tile.coords.tileLeft + dx;
          const ty = tile.coords.tileTop + dy;
          if (!this.#visitedIds.has(toBoxId(tx, ty))) {
            this.#nextStack.push(this.acquireTileBox(tx, ty, false));
          }
        }
      }
    }

    this.visibles.sort(sortByDistance);

    const tiles: IMap2DTileCoords[] = new Array(this.visibles.length);
    for (let i = 0; i < this.visibles.length; ++i) tiles[i] = this.visibles[i].map2dTile!;

    const removeTiles: IMap2DTileCoords[] = [];
    for (const t of this.#previousTilesById.values()) removeTiles.push(t);

    this.#scratchOffset.set(
      this.map2dTileCoords.xOffset - this.#centerPoint2D.x,
      this.map2dTileCoords.yOffset - this.#centerPoint2D.y,
    );

    return {
      tiles,
      createTiles,
      reuseTiles,
      removeTiles,
      offset: this.#scratchOffset,
      translate,
    };
  }

  private convertToPlaneCoords2D(pointOnPlane3D: Vector3, target: Vector2) {
    _v.copy(pointOnPlane3D);
    _v.sub(this.planeOrigin).applyMatrix4(this.#matrixWorldInverse);

    target.set(_v.x, _v.z);
  }

  private setBox(target: Box3, {top, left, width, height}: TilesWithinCoords, scale = 1): Box3 {
    const sw = width * scale - width;
    const sh = height * scale - height;
    const ground = this.depth * -0.5 * scale;
    const ceiling = this.depth * 0.5 * scale;
    target.min.set(left - sw, ground, top - sh);
    target.max.set(left + width + sw, ceiling, top + height + sh);
    return target;
  }
}
