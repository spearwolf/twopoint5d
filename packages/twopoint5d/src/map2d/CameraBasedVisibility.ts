import type {OrthographicCamera, PerspectiveCamera} from 'three/webgpu';
import {Box3, Frustum, Line3, Matrix4, Plane, Vector2, Vector3} from 'three/webgpu';
import {Dependencies} from '../utils/Dependencies.js';
import {AABB2} from './AABB2.js';
import {convexTileHull, forEachTileWithinConvexHull, type TilePoint} from './convexTileHull.js';
import {Map2DTileCoords} from './Map2DTileCoords.js';
import {Map2DTileCoordsUtil, type TilesWithinCoords} from './Map2DTileCoordsUtil.js';
import {packTileCoords} from './tileKeys.js';
import type {IMap2DTileCoords, IMap2DVisibilitor, IMap2DVisibleTiles} from './types.js';

export interface TileBox {
  /**
   * The packed key of the tile coordinate, as `packTileCoords(x, y)` returns it. Whoever needs
   * a readable designation of the tile takes `x` and `y`.
   */
  id: number;
  x: number;
  y: number;
  coords?: TilesWithinCoords;
  box?: Box3;
  frustumBox?: Box3;
  centerWorld?: Vector3;
  distanceToCamera?: number;
  map2dTile?: IMap2DTileCoords;
  /**
   * `true` for a tile one of the probe rays of the view frustum met directly — see
   * {@link CameraBasedVisibility.pointsOnPlane}. Every other visible tile was found from
   * such a tile outwards.
   */
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

/**
 * The points of the near plane of the view frustum a ray is cast through, in _normalized
 * device coordinates_ and in the order they are tested: the center, then the middle of the
 * bottom, left, right and top edge, then the four corners, bottom left first and counter
 * clockwise from there.
 *
 * The first of them that meets the map plane is the anchor the plane coordinates are taken
 * from, which is why the center comes first: as long as the camera looks at the plane, the
 * result is the one the center ray alone produced.
 */
const FRUSTUM_PROBES_NDC: ReadonlyArray<readonly [x: number, y: number]> = [
  [0, 0],
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/**
 * Three probe rays are the fewest that can span an area on the plane — below that there is
 * nothing to fill in.
 */
const MIN_PROBES_FOR_HULL = 3;

const setAABB2 = (target: AABB2, {top, left, width, height}: TilesWithinCoords): AABB2 => target.set(left, top, width, height);

const makeCameraFrustum = (camera: PerspectiveCamera | OrthographicCamera, target = new Frustum()): Frustum =>
  target.setFromProjectionMatrix(_m.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse));

const sortByDistance = (a: TileBox, b: TileBox): number => a.distanceToCamera! - b.distanceToCamera!;

/** The entry at `index`, built on first use and kept for the frames after it. */
const poolAt = <T>(pool: T[], index: number, create: () => T): T => {
  let item = pool[index];
  if (item === undefined) {
    item = create();
    pool[index] = item;
  }
  return item;
};

/**
 * This visibilitor assumes that the map2D layer is rendered in the 3D space on the XZ ground plane.
 * So, the camera should point somehow to the XZ plane, if there should be visible tiles.
 *
 * The view frustum of the camera is used to calculate the visible tiles.
 *
 * The plane is looked for along nine rays through the view frustum — its center, the middle of
 * each of its four edges and its four corners — so a plane that only cuts a corner of the view
 * is found as well as one the camera looks straight at. Only when none of the nine rays meets
 * the plane is nothing visible.
 *
 * The _far_ value of the camera limits how far along a ray the plane is looked for. The _near_
 * value is where each ray starts.
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

  // `null` marks a plane that was deliberately cleared because the camera looks past it, as
  // opposed to a `pointOnPlane` that was never set.
  pointOnPlane?: Vector3 | null;

  /**
   * The points where the probe rays of the last recomputation met the plane, in the order of
   * {@link FRUSTUM_PROBES_NDC} — the rays that missed it leave no gap. The list is empty for a
   * recomputation in which the camera looked past the plane entirely, and its first entry is
   * the point {@link pointOnPlane} carries.
   *
   * The `Vector3`s belong to this class and are written again on the next recomputation;
   * whoever wants to keep one takes a copy.
   */
  readonly pointsOnPlane: Vector3[] = [];

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

  /**
   * The tiles of the last recomputation that met the plane, sorted by their distance to the
   * camera. A recomputation in which the camera looks past the plane reports an empty tile set
   * and leaves this list standing as it is.
   */
  readonly visibles: TileBox[] = [];
  #visibleTiles?: IMap2DVisibleTiles;
  #serial = 0;

  /**
   * Counts how often this visibility has recomputed its state from the camera. It moves with
   * every recomputation and stands still while the cached tile set is handed back; whoever
   * carries derived state along compares the value it last saw instead of the state itself.
   *
   * A step says that the camera was evaluated again, not that every field carries a new value:
   * `planeWorld`, `planeOrigin`, `pointOnPlane` and `pointsOnPlane` follow every step,
   * `visibles` and `planeCoords2D` only a step in which the camera met the plane.
   */
  get serial(): number {
    return this.#serial;
  }

  // Per-frame scratch buffers — reused across calls to keep GC pressure low.
  readonly #visitedIds = new Set<number>();
  readonly #nextStack: TileBox[] = [];
  readonly #previousTilesById = new Map<number, IMap2DTileCoords>();
  readonly #withinHull: TileBox[] = [];

  // The tiles the probe rays of the current recomputation met, keyed by `packTileCoords()` —
  // what `TileBox#primary` is read from.
  readonly #probeTileIds = new Set<number>();

  // Pool of TileBox slots keyed by `packTileCoords()`. Each slot owns its Box3/Vector3/
  // Map2DTileCoords shells so subsequent frames can mutate them in place instead of allocating
  // new ones.
  // It holds the tiles of the last recomputation that found the map plane, and no others: a frame
  // in which the camera looks past the plane computes no tiles and leaves the pool as it stands.
  readonly #tileBoxPool = new Map<number, TileBox>();

  // Snapshot of the tile-grid parameters that drive `tile.coords`. When any of these change
  // we invalidate the per-slot `coords` caches so the next frame recomputes them.
  #cachedTileCoords: Map2DTileCoordsUtil | undefined;

  // Hot-path scratch instances — kept on the class to share across frames.
  readonly #scratchTranslate = new Vector3();
  readonly #scratchOffset = new Vector2();
  readonly #scratchLineOfSight = new Line3();
  readonly #scratchPlaneIntersection = new Vector3();

  // One slot per probe ray, filled up to the number of rays that met the plane: the point in
  // 3D world space (handed out through `pointsOnPlane`), the same point in 2D plane coordinates
  // and the tile it falls into.
  readonly #pointOnPlanePool: Vector3[] = [];
  readonly #probePlaneCoords: Vector2[] = [];
  readonly #probeTiles: [number, number][] = [];

  constructor(camera?: PerspectiveCamera | OrthographicCamera) {
    this.camera = camera;
  }

  private dependenciesChanged(matrixWorld: Matrix4): boolean {
    // Reached only from behind the `if (!this.camera)` guard in `computeVisibleTiles()`.
    const camera = this.camera!;

    return this.#deps.changed({
      depth: this.depth,
      lookAtCenter: this.lookAtCenter,
      centerPoint2D: this.#centerPoint2D,
      map2dTileCoords: this.map2dTileCoords,
      matrixWorld,
      cameraMatrixWorld: camera.matrixWorld,
      cameraProjectionMatrix: camera.projectionMatrix,
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
        this.#visibleTiles.changed = false;
      }
      return this.#visibleTiles;
    }

    this.#serial += 1;

    this.invalidateTileCoordsCacheIfChanged();

    this.matrixWorld.copy(matrixWorld);
    this.#matrixWorldInverse.copy(matrixWorld).invert();

    const hitCount = this.findPointsOnPlaneThatAreInViewFrustum();

    if (hitCount > 0) {
      if (this.pointOnPlane == null) {
        this.pointOnPlane = new Vector3();
      }
      // The list holds `hitCount` entries.
      this.pointOnPlane.copy(this.pointsOnPlane[0]!);
    } else {
      this.pointOnPlane = null;
    }

    this.planeWorld.coplanarPoint(this.planeOrigin);

    if (hitCount === 0) {
      this.#visibleTiles = previousTiles.length > 0 ? {tiles: [], removeTiles: previousTiles, changed: true} : undefined;
      return this.#visibleTiles;
    }

    for (let i = 0; i < hitCount; ++i) {
      // The loop bound is the number of points the probe rays found.
      this.convertToPlaneCoords2D(
        this.pointsOnPlane[i]!,
        poolAt(this.#probePlaneCoords, i, () => new Vector2()),
      );
    }

    if (this.lookAtCenter) {
      this.#centerPoint2D.sub(this.#probePlaneCoords[0]!);
    }

    for (let i = 0; i < hitCount; ++i) {
      // The loop bound is the number of points the probe rays found.
      this.#probePlaneCoords[i]!.add(this.#centerPoint2D);
    }

    this.planeCoords2D.copy(this.#probePlaneCoords[0]!);

    this.#visibleTiles = this.findVisibleTiles(previousTiles, hitCount);

    return this.#visibleTiles;
  }

  /**
   * Casts a ray through the view frustum for each of the {@link FRUSTUM_PROBES_NDC} and collects
   * the points where they meet the map plane in {@link pointsOnPlane}, in probe order. Returns
   * how many of them there are.
   *
   * A ray runs from the near plane to the far plane, so it covers exactly the depth range the
   * camera renders.
   */
  private findPointsOnPlaneThatAreInViewFrustum(): number {
    // Reached only from behind the `if (!this.camera)` guard in `computeVisibleTiles()`.
    const camera = this.camera!;

    this.#cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);

    this.planeWorld
      .copy(CameraBasedVisibility.Plane)
      .applyMatrix4(_m.makeTranslation(this.map2dTileCoords.xOffset, 0, this.map2dTileCoords.yOffset))
      .applyMatrix4(this.matrixWorld);

    this.pointsOnPlane.length = 0;

    for (let i = 0; i < FRUSTUM_PROBES_NDC.length; ++i) {
      // The loop bound is `FRUSTUM_PROBES_NDC.length`.
      const [ndcX, ndcY] = FRUSTUM_PROBES_NDC[i]!;

      this.#scratchLineOfSight.start.set(ndcX, ndcY, -1).unproject(camera);
      this.#scratchLineOfSight.end.set(ndcX, ndcY, 1).unproject(camera);

      const hit = this.planeWorld.intersectLine(this.#scratchLineOfSight, this.#scratchPlaneIntersection);
      if (hit == null) continue;

      const point = poolAt(this.#pointOnPlanePool, this.pointsOnPlane.length, () => new Vector3());
      point.copy(hit);
      this.pointsOnPlane.push(point);
    }

    return this.pointsOnPlane.length;
  }

  private acquireTileBox(x: number, y: number): TileBox {
    const id = packTileCoords(x, y);
    let tile = this.#tileBoxPool.get(id);
    if (tile === undefined) {
      tile = {id, x, y};
      this.#tileBoxPool.set(id, tile);
    }
    return tile;
  }

  private findVisibleTiles(previousTiles: IMap2DTileCoords[], hitCount: number): IMap2DVisibleTiles | undefined {
    // Reset reusable working buffers.
    this.#visitedIds.clear();
    this.#nextStack.length = 0;
    this.#withinHull.length = 0;
    this.#probeTileIds.clear();
    this.visibles.length = 0;

    // Index previousTiles by id for O(1) reuse lookups (replaces the original O(n²) splice loop).
    this.#previousTilesById.clear();
    for (let i = 0; i < previousTiles.length; ++i) {
      // The loop bound is `previousTiles.length`.
      const previousTile = previousTiles[i]!;
      this.#previousTilesById.set(packTileCoords(previousTile.x, previousTile.y), previousTile);
    }

    // Reached only from behind the `if (!this.camera)` guard in `computeVisibleTiles()`.
    makeCameraFrustum(this.camera!, this.#cameraFrustum);

    const {tileWidth, tileHeight} = this.map2dTileCoords;

    const translate = this.#scratchTranslate.setFromMatrixPosition(this.matrixWorld);

    this.#tileBoxMatrix.makeTranslation(
      this.map2dTileCoords.xOffset - this.#centerPoint2D.x + translate.x,
      translate.y,
      this.map2dTileCoords.yOffset - this.#centerPoint2D.y + translate.z,
    );

    // The tiles the probe rays met are where the search starts. Per ray that is the tile its
    // point falls into, together with the tiles a rectangle of one tile size around that point
    // reaches into — up to four in all.
    for (let i = 0; i < hitCount; ++i) {
      // The loop bound is the number of points the probe rays found.
      const coords2D = this.#probePlaneCoords[i]!;
      const around = this.map2dTileCoords.computeTilesWithinCoords(
        coords2D.x - tileWidth / 2,
        coords2D.y - tileHeight / 2,
        tileWidth,
        tileHeight,
      );
      for (let ty = 0; ty < around.rows; ty++) {
        for (let tx = 0; tx < around.columns; tx++) {
          const tile = this.acquireTileBox(around.tileLeft + tx, around.tileTop + ty);
          this.#probeTileIds.add(tile.id);
          this.#nextStack.push(tile);
        }
      }
    }

    const reuseTiles: IMap2DTileCoords[] = [];
    const createTiles: IMap2DTileCoords[] = [];

    this.collectTilesWithinProbeHull(hitCount);

    for (let i = 0; i < this.#withinHull.length; ++i) {
      // The loop bound is `this.#withinHull.length`.
      const tile = this.#withinHull[i]!;
      this.prepareTile(tile);
      this.acceptTile(tile, reuseTiles, createTiles);
      this.pushNeighbors(tile);
    }

    while (this.#nextStack.length > 0) {
      const tile = this.#nextStack.pop()!;
      if (this.#visitedIds.has(tile.id)) continue;
      this.#visitedIds.add(tile.id);

      this.prepareTile(tile);

      if (this.#cameraFrustum.intersectsBox(tile.frustumBox!)) {
        this.acceptTile(tile, reuseTiles, createTiles);
        this.pushNeighbors(tile);
      }
    }

    // The pool exists to let the next frame mutate the same shells instead of allocating
    // new ones — that pays off only for a slot the next frame comes back to. A slot that
    // was not visited this time keeps a Box3, a Vector3 and a Map2DTileCoords alive for a
    // tile the camera has left behind, so it goes. Both sets are keyed by `packTileCoords()`.
    for (const id of this.#tileBoxPool.keys()) {
      if (!this.#visitedIds.has(id)) {
        this.#tileBoxPool.delete(id);
      }
    }

    // `primary` is a statement about this recomputation and the pool outlives it, so it is
    // written here rather than kept up to date while the search runs: a tile that is not in the
    // visible set is not handed out, and one that comes back into it gets its answer here.
    for (let i = 0; i < this.visibles.length; ++i) {
      // The loop bound is `this.visibles.length`.
      const tile = this.visibles[i]!;
      tile.primary = this.#probeTileIds.has(tile.id);
    }

    this.visibles.sort(sortByDistance);

    const tiles: IMap2DTileCoords[] = new Array(this.visibles.length);
    // The loop bound is `this.visibles.length`.
    for (let i = 0; i < this.visibles.length; ++i) tiles[i] = this.visibles[i]!.map2dTile!;

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
      changed: true,
    };
  }

  /**
   * Puts every tile within the convex hull of the tiles the probe rays met into
   * {@link #withinHull} and marks it visited, so that the search that follows starts on the
   * border of the hull instead of working its way through its inside.
   *
   * These tiles are visible without being tested. The frustum is convex and so is the plane, so
   * the area where the two meet is convex as well: it contains every point between the points
   * the rays found, and therefore each of the tiles those points span. A tile on the hull that
   * the rounding to whole tiles leaves out is no loss — it borders one that is in, so the
   * search reaches it and tests it as it tests every other tile.
   *
   * Fewer than three rays span no area, and there is nothing to fill in.
   */
  private collectTilesWithinProbeHull(hitCount: number): void {
    if (hitCount < MIN_PROBES_FOR_HULL) return;

    const points: TilePoint[] = [];
    for (let i = 0; i < hitCount; ++i) {
      // The loop bound is the number of points the probe rays found.
      const coords2D = this.#probePlaneCoords[i]!;
      const [tileLeft, tileTop] = this.map2dTileCoords.getTileCoords(coords2D.x, coords2D.y, 0, 0);
      const point = poolAt(this.#probeTiles, i, (): [number, number] => [0, 0]);
      point[0] = tileLeft;
      point[1] = tileTop;
      points.push(point);
    }

    forEachTileWithinConvexHull(convexTileHull(points), (x, y) => {
      const id = packTileCoords(x, y);
      if (this.#visitedIds.has(id)) return;
      this.#visitedIds.add(id);
      this.#withinHull.push(this.acquireTileBox(x, y));
    });
  }

  /** The tile coordinates and the box the frustum test reads, both in the shape of this frame. */
  private prepareTile(tile: TileBox): void {
    const {tileWidth, tileHeight, xOffset, yOffset} = this.map2dTileCoords;

    // the query reads world coordinates, so the tile coordinate is taken back into that space
    tile.coords ??= this.map2dTileCoords.computeTilesWithinCoords(
      tile.x * tileWidth + xOffset,
      tile.y * tileHeight + yOffset,
      1,
      1,
    );

    if (tile.frustumBox === undefined) tile.frustumBox = new Box3();
    this.setBox(tile.frustumBox, tile.coords, this.frustumBoxScale)
      .applyMatrix4(this.#tileBoxMatrix)
      .applyMatrix4(this.matrixWorld);
  }

  /** Takes a tile into the visible set. Expects {@link prepareTile} to have run on it. */
  private acceptTile(tile: TileBox, reuseTiles: IMap2DTileCoords[], createTiles: IMap2DTileCoords[]): void {
    const coords = tile.coords!;

    if (tile.centerWorld === undefined) tile.centerWorld = new Vector3();
    tile.centerWorld
      .set(coords.left + coords.width / 2, 0, coords.top + coords.height / 2)
      .applyMatrix4(this.#tileBoxMatrix)
      .applyMatrix4(this.matrixWorld);

    tile.distanceToCamera = tile.centerWorld.distanceTo(this.#cameraWorldPosition);

    this.visibles.push(tile);

    if (tile.box === undefined) tile.box = new Box3();
    this.setBox(tile.box, coords).applyMatrix4(this.#tileBoxMatrix);

    if (tile.map2dTile === undefined) {
      tile.map2dTile = new Map2DTileCoords(tile.x, tile.y, new AABB2());
    }
    setAABB2(tile.map2dTile.view, coords);

    const previous = this.#previousTilesById.get(tile.id);
    if (previous !== undefined) {
      this.#previousTilesById.delete(tile.id);
      reuseTiles.push(tile.map2dTile);
    } else {
      createTiles.push(tile.map2dTile);
    }
  }

  private pushNeighbors(tile: TileBox): void {
    for (let i = 0; i < NEIGHBOR_DX_DY.length; ++i) {
      // The loop bound is `NEIGHBOR_DX_DY.length`.
      const [dx, dy] = NEIGHBOR_DX_DY[i]!;
      const tx = tile.x + dx;
      const ty = tile.y + dy;
      if (!this.#visitedIds.has(packTileCoords(tx, ty))) {
        this.#nextStack.push(this.acquireTileBox(tx, ty));
      }
    }
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
