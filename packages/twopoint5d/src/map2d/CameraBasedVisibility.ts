import type {Box3, OrthographicCamera, PerspectiveCamera} from 'three/webgpu';
import {Frustum, Line3, Matrix4, Plane, Vector2, Vector3, WebGPUCoordinateSystem} from 'three/webgpu';
import {assertFiniteAtLeast} from '../utils/assertFiniteAtLeast.js';
import {assertWholeNumberOrInfinity} from '../utils/assertWholeNumberOrInfinity.js';
import {Dependencies, type DependencyValues} from '../utils/Dependencies.js';
import {describeValue} from '../utils/describeValue.js';
import {truncateArray} from '../utils/truncateArray.js';
import {AABB2} from './AABB2.js';
import {convexTileHull, forEachTileWithinConvexHull, type TilePoint} from './convexTileHull.js';
import {createTilesWithinCoords} from './createTilesWithinCoords.js';
import {Map2DTileCoords} from './Map2DTileCoords.js';
import {Map2DTileCoordsUtil, type TilesWithinCoords} from './Map2DTileCoordsUtil.js';
import {
  NearestFirstTileSearch,
  VIEW_DEPTH,
  VIEW_FRUSTUM_BOX_SCALE,
  VIEW_FRUSTUM_HEIGHT_MAX,
  VIEW_FRUSTUM_HEIGHT_MIN,
  VIEW_MAX_VISIBLE_TILES,
  VIEW_SCALARS,
  writeTileBox,
} from './NearestFirstTileSearch.js';
import {type PooledTileBox, TileSlotPool} from './TileSlotPool.js';
import type {IMap2DTileCoords, IMap2DVisibilitor, IMap2DVisibleTiles} from './types.js';

export interface TileBox {
  /**
   * The packed key of the tile coordinate, as `packTileCoords(x, y)` returns it, for a table on the
   * path a frame loop runs. It is not the `id` of a `Map2DTileCoords`, whose key is the string
   * `tileKey(x, y)`; whoever needs a readable designation of the tile takes `x` and `y`.
   */
  readonly packedKey: number;
  readonly x: number;
  readonly y: number;
  /**
   * The tile on the grid: its tile coordinate, one column and one row, and its edges relative to
   * the origin of the grid, without the offset of the grid.
   */
  readonly coords: TilesWithinCoords;
  /** The box of the tile in the local space of the map node, where the tile renderers draw it. */
  readonly box: Box3;
  /**
   * The box the view frustum is tested against, in world space: scaled by `frustumBoxScale`, and
   * reaching no further above and below the map plane than the view frustum does.
   */
  readonly frustumBox: Box3;
  /** The center of the tile in world space. */
  readonly centerWorld: Vector3;
  /**
   * The distance of the center of the tile to the camera, in world units — what
   * {@link CameraBasedVisibility.visibles} is ordered by.
   */
  readonly distanceToCamera: number;
  /**
   * The shell the result hands out in `tiles` for this tile. Every `TileBox` in
   * {@link CameraBasedVisibility.visibles} carries one. `undefined` is the state of a slot whose
   * tile has left the view: the same object serves as a slot of the pool.
   */
  readonly map2dTile: IMap2DTileCoords | undefined;
  /**
   * `true` for a tile the search started from in the last recomputation: the tile a probe ray of
   * the view frustum met the map plane in — see {@link CameraBasedVisibility.pointsOnPlane} —, and
   * each tile a rectangle of one tile size around that point reaches into, up to four per ray. The
   * tiles within the hull those points span come in without a frustum test, and every other visible
   * tile was reached from one of these, neighbour by neighbour.
   */
  readonly primary: boolean;
}

// Doubles on the path a frame loop runs. A double handed to a call the compiler does not inline,
// or answered by one, is boxed — an allocation per call —, and which calls get inlined shifts with
// the code around them. So on this path a double does not cross a call: it travels in the field of
// an object — the query rectangle, the vectors of a slot —, and a small helper that would take or
// answer one is written out where it is needed. `hot-path-allocations.spec.ts` holds the class and
// its search, `NearestFirstTileSearch.ts`, to it.

const _v = new Vector3();
const _m = new Matrix4();

// the plane of the map in the local space of the map node; never handed out, so nothing outside
// this module can move it
const MAP_PLANE = new Plane(new Vector3(0, 1, 0), 0);

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

// field by field rather than through `AABB2#set()` — see the note on doubles above
const setAABB2 = (target: AABB2, coords: TilesWithinCoords): void => {
  target.left = coords.left;
  target.top = coords.top;
  target.width = coords.width;
  target.height = coords.height;
};

const makeCameraFrustum = (camera: PerspectiveCamera | OrthographicCamera, target = new Frustum()): Frustum =>
  target.setFromProjectionMatrix(
    _m.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse),
    camera.coordinateSystem,
    camera.reversedDepth,
  );

/** The entry at `index`, built on first use and kept for the frames after it. */
const poolAt = <T>(pool: T[], index: number, create: () => T): T => {
  let item = pool[index];
  if (item === undefined) {
    item = create();
    pool[index] = item;
  }
  return item;
};

// the factories of `poolAt()`, built once instead of on every call
const newVector2 = (): Vector2 => new Vector2();
const newVector3 = (): Vector3 => new Vector3();
const newTilePoint = (): [number, number] => [0, 0];

// where `CameraBasedVisibility` keeps the scalars of the last recomputation
const SEEN_DEPTH = 0;
const SEEN_FRUSTUM_BOX_SCALE = 1;
const SEEN_MAX_VISIBLE_TILES = 2;

/** The objects the dependency gate of {@link CameraBasedVisibility} compares. */
interface CameraDependencies {
  centerPoint2D: Vector2;
  map2dTileCoords: Map2DTileCoordsUtil;
  matrixWorld: Matrix4;
  cameraMatrixWorld: Matrix4;
  cameraProjectionMatrix: Matrix4;
}

/**
 * This visibilitor lays the map on the XZ plane of the local space of its map node — the plane
 * {@link CameraBasedVisibility.Plane} describes. The `matrixWorld` handed to
 * `computeVisibleTiles()` may turn that plane any way it likes: tilted, upright, upside down. The
 * camera has to look at the plane for a tile to be visible.
 *
 * The view frustum of the camera is used to calculate the visible tiles.
 *
 * The plane is looked for along nine rays through the view frustum — its center, the middle of
 * each of its four edges and its four corners — so a plane that only cuts a corner of the view
 * is found as well as one the camera looks straight at. Only when none of the nine rays meets
 * the plane is nothing visible.
 *
 * The _far_ value of the camera limits how far along a ray the plane is looked for. The _near_
 * value is where each ray starts. Both are read in the coordinate system and the depth direction
 * of the camera — `camera.coordinateSystem` and `camera.reversedDepth`, which the renderer sets on
 * a camera the first time it renders with it, together with a new projection. The projection maps
 * the near and far plane to these depths:
 *
 * - WebGL coordinate system: `-1` to `1`
 * - WebGPU coordinate system: `0` to `1`
 * - reversed depth, in either: `1` to `0`
 *
 * `far` bounds how far out the plane is searched, and the ground a camera tilted towards the
 * horizon covers grows with about `far²`. {@link maxVisibleTiles} bounds the tiles of one
 * recomputation: the search runs from the camera outwards, and at the limit it goes on only as
 * far as a tile nearer than the furthest kept one can still turn up, so the tiles left out are
 * the ones furthest away. The first recomputation the limit cuts warns once.
 *
 * The camera is read as the caller keeps it. `computeVisibleTiles()` brings the world matrix of
 * the camera up to date from its own transform and those of its parents — the way
 * `Map2DTileStreamer` brings the map node up to date —, but not its projection: whoever changes
 * `fov`, `aspect`, `near`, `far` or `zoom` of a perspective camera, or the frustum of an
 * orthographic one, calls `camera.updateProjectionMatrix()` before the next call. A projection
 * matrix set by hand — jitter, an off-axis projection — is used as it stands, together with its
 * `projectionMatrixInverse`.
 */
export class CameraBasedVisibility implements IMap2DVisibilitor {
  /**
   * The plane of the map in the local space of the map node: the XZ plane through its origin,
   * with the normal +Y. Every access hands out a new copy, and a change to it reaches no instance.
   */
  static get Plane(): Plane {
    return MAP_PLANE.clone();
  }

  #frustumBoxScale = 1.1;

  /**
   * How much larger than the tile the box is that the view frustum is tested against: the box is
   * `frustumBoxScale` times the tile in width, height and depth, around the tile — each side moves
   * out by `(frustumBoxScale - 1) / 2` of the tile size. Along the normal of the map plane the box
   * reaches no further than the view frustum — see {@link depth}. `1` tests the tile itself; the
   * default `1.1` gives a tile that only just leaves the view a margin before it is dropped.
   *
   * Takes a finite number of at least 1 and throws a `RangeError` for anything else, keeping the
   * value it had: below 1 the boxes of neighbouring tiles leave gaps between them, and the search,
   * which goes from a visible tile to its neighbours, would miss the visible tiles behind such a
   * gap. A new value recomputes on the next call.
   */
  get frustumBoxScale(): number {
    return this.#frustumBoxScale;
  }

  set frustumBoxScale(value: number) {
    this.#frustumBoxScale = assertFiniteAtLeast(value, 'CameraBasedVisibility', 'frustumBoxScale', 1);
  }

  #maxVisibleTiles = 10_000;

  /**
   * The most tiles one recomputation takes into the visible set: the ones nearest to the camera,
   * measured at the center of each tile, and those it leaves out are the ones furthest away. The
   * search runs from the camera outwards, nearest tile first. Once it holds this many tiles it
   * goes on as far as a visible tile nearer than the furthest kept one can still turn up — the
   * diagonal of a frustum box on the plane beyond it — and such a tile takes the place of the
   * furthest; a recomputation the limit cuts therefore tests a margin of tiles beyond the ones it
   * keeps.
   *
   * `far` of the camera bounds how far the plane is searched; tilted towards the horizon, the
   * ground in view grows with about `far²`, and this limit is what holds it. The first
   * recomputation the limit cuts warns once. `Infinity` turns the limit off.
   *
   * The default of 10 000 is more than a `TileSpritesGeometry` usually holds: a view that fits
   * into its geometry never meets it, and a camera tipped towards the horizon is caught.
   *
   * Takes a whole number above 0 or `Infinity` and throws a `RangeError` for anything else,
   * keeping the value it had. A new value recomputes on the next call.
   */
  get maxVisibleTiles(): number {
    return this.#maxVisibleTiles;
  }

  set maxVisibleTiles(value: number) {
    this.#maxVisibleTiles = assertWholeNumberOrInfinity(value, 'CameraBasedVisibility', 'maxVisibleTiles', 1);
  }

  /**
   * Whether the view center of the map is where the camera looks. With `true`, the point where the
   * first probe ray meets the map plane — the ray through the middle of the view, as long as it
   * meets the plane — is taken as `(centerX, centerY)`: the tiles are laid out around the view
   * center wherever the camera points. With `false` (the default), the view center shifts the map
   * under the camera instead: the camera sees the map point that lies `(centerX, centerY)` away
   * from where it looks on the plane.
   *
   * With `lookAtCenter = false`, the camera's own position already drives visibility, so for a map
   * fixed in the world under a moving camera the view center stays at `(0, 0)` — feeding the camera
   * position into `centerX`/`centerY` scrolls the map with the camera, on top of the camera's own
   * motion.
   * Set the view center on `Map2D` or `Map2DTileStreamer`, which carry the full per-visibilitor
   * semantics on their `centerX`.
   */
  lookAtCenter = false;

  #depth = 100;

  /**
   * How high the box of a tile is along the y axis of the map node's local space — the normal of the
   * map plane: the box reaches `depth / 2` above and below the plane, and the box the view frustum is
   * tested against `frustumBoxScale` times as far. Sprites that stand up from the map need a depth
   * that holds them, or the tiles they stand on leave the view while the sprites are still in it. `0`
   * tests the flat tile.
   *
   * The box the view frustum is tested against reaches no further above and below the plane than
   * the frustum itself, measured in the local space of the map node: no point of the frustum lies
   * beyond that. Within it, a box much higher than the tile is wide still passes the side planes of
   * a tilted view beyond the edge of the view — `Frustum#intersectsBox()` tests the planes one by
   * one —, and its tile is taken as visible without being in view. On tiles much smaller than the
   * depth such tiles can make up about half of the visible set; a depth no higher than what stands
   * on the map keeps them few.
   *
   * Takes a finite number of at least 0 and throws a `RangeError` for anything else, keeping the
   * value it had: a negative depth turns the box inside out, which three.js takes for an empty box
   * and leaves where it is when it transforms it, and a depth that is not finite lets every tile
   * through the frustum test. A new value recomputes on the next call.
   */
  get depth(): number {
    return this.#depth;
  }

  set depth(value: number) {
    this.#depth = assertFiniteAtLeast(value, 'CameraBasedVisibility', 'depth', 0);
  }

  camera?: PerspectiveCamera | OrthographicCamera;

  readonly #cameraWorldPosition = new Vector3();

  /**
   * The map plane in world space, an output of the last recomputation that the next one writes
   * over in place; whoever wants to keep the value takes a copy. `CameraBasedVisibilityHelpers`
   * holds this very object.
   */
  readonly planeWorld = MAP_PLANE.clone();

  /**
   * A point of {@link planeWorld}, an output of the last recomputation that the next one writes
   * over in place; whoever wants to keep the value takes a copy.
   */
  readonly planeOrigin = new Vector3();

  #pointOnPlane: Vector3 | null | undefined = undefined;

  /**
   * The point where the first probe ray of the last recomputation met the plane — the first entry
   * of {@link pointsOnPlane}. `null` marks a plane that was deliberately cleared because the camera
   * looks past it, as opposed to `undefined`, a point that was never set.
   *
   * The `Vector3` belongs to this class and is written again on the next recomputation; whoever
   * wants to keep it takes a copy.
   */
  get pointOnPlane(): Vector3 | null | undefined {
    return this.#pointOnPlane;
  }

  readonly #pointsOnPlane: Vector3[] = [];

  /**
   * The points where the probe rays of the last recomputation met the plane, in the order of
   * {@link FRUSTUM_PROBES_NDC} — the rays that missed it leave no gap. The list is empty for a
   * recomputation in which the camera looked past the plane entirely, and its first entry is
   * the point {@link pointOnPlane} carries.
   *
   * The `Vector3`s belong to this class and are written again on the next recomputation;
   * whoever wants to keep one takes a copy.
   */
  get pointsOnPlane(): readonly Vector3[] {
    return this.#pointsOnPlane;
  }

  /**
   * Where the first probe ray met the plane, in map coordinates around the view center — an output
   * of the last recomputation that met the plane, which the next one writes over in place; whoever
   * wants to keep the value takes a copy.
   */
  readonly planeCoords2D = new Vector2();
  readonly #centerPoint2D = new Vector2();

  /**
   * The world matrix of the map node the last recomputation was given, an output that the next
   * one writes over in place; whoever wants to keep the value takes a copy.
   */
  readonly matrixWorld = new Matrix4();
  readonly #matrixWorldInverse = new Matrix4();

  readonly #cameraFrustum = new Frustum();

  readonly #tileBoxMatrix = new Matrix4();
  // `matrixWorld` after `#tileBoxMatrix`, formed once per recomputation: one transform takes a
  // tile from where its box is built into world space
  readonly #tileWorldMatrix = new Matrix4();
  // the translation of `#tileBoxMatrix`, which is all it does, for the box that stays in the
  // local space of the map node
  readonly #tileBoxOffset = new Vector3();
  // the offset of the grid, handed to `makeTranslation()` as a vector — see the note on doubles at
  // the top of the module
  readonly #planeOffset = new Vector3();
  // the offset of the grid of the running recomputation, as an object — see the note on doubles at
  // the top of the module
  readonly #gridOffset = new Vector2();

  readonly #map2dTileCoords = new Map2DTileCoordsUtil();
  // the slot of every tile the search visits, written for the grid above — declared after it, so
  // that the initializer reads the grid and not `undefined`
  readonly #pool = new TileSlotPool(this.#map2dTileCoords);

  /**
   * The tile grid of the last `computeVisibleTiles()`, as a copy this visibility keeps for itself
   * — the visibility helpers read it. A value written on it reaches neither the tile streamer nor
   * the tiles, and the next call writes over it; the grid is set on `Map2D` or
   * `Map2DTileStreamer`.
   */
  get map2dTileCoords(): Map2DTileCoordsUtil {
    return this.#map2dTileCoords;
  }

  // The objects the gate compares. The scalars — `depth`, `frustumBoxScale`, `maxVisibleTiles`,
  // `lookAtCenter` — are held against the `#seen…` fields below instead: a double read through
  // the generic lookup of `Dependencies` is boxed on every call.
  readonly #deps = new Dependencies<CameraDependencies>([
    Dependencies.cloneable<Vector2>('centerPoint2D'),
    Dependencies.cloneable<Map2DTileCoordsUtil>('map2dTileCoords'),
    Dependencies.cloneable<Matrix4>('matrixWorld'),
    Dependencies.cloneable<Matrix4>('cameraMatrixWorld'),
    Dependencies.cloneable<Matrix4>('cameraProjectionMatrix'),
  ]);

  // what `#deps` is asked about, written again on every call rather than built as a new literal
  readonly #dependencyValues: DependencyValues<CameraDependencies> = {
    centerPoint2D: this.#centerPoint2D,
    map2dTileCoords: this.#map2dTileCoords,
    matrixWorld: null,
    cameraMatrixWorld: null,
    cameraProjectionMatrix: null,
  };

  // The scalars of the last recomputation: `depth`, `frustumBoxScale` and `maxVisibleTiles` at the
  // `SEEN_…` indices, in a typed array, which holds a double as it is. A `#` field would box every
  // double written to it: the emitted class declares the field before the constructor assigns it,
  // and that leaves V8 a tagged field. `NaN` and `undefined` equal nothing, so the first call
  // counts as a change.
  readonly #seenScalars = new Float64Array([NaN, NaN, NaN]);
  #seenLookAtCenter: boolean | undefined = undefined;

  readonly #visibles: PooledTileBox[] = [];

  /**
   * The tiles of the last recomputation that met the plane, nearest to the camera first — an
   * order this class promises, not one it happens to produce — and at most
   * {@link maxVisibleTiles} of them. A recomputation in which the camera looks past the plane
   * reports an empty tile set and empties this list along with it.
   *
   * The `TileBox` objects belong to this visibility. The next recomputation writes them again,
   * and one whose tile has left the view later stands for a tile that enters it; whoever needs
   * one beyond the next call copies what they need of it. A `Map2DTileCoords` handed out in
   * `map2dTile` keeps its tile; a tile that enters the view gets a new one.
   */
  get visibles(): readonly TileBox[] {
    return this.#visibles;
  }
  #visibleTiles?: IMap2DVisibleTiles;
  #serial = 0;

  /**
   * Counts how often this visibility has recomputed its state from the camera. It moves with
   * every recomputation and stands still while the cached tile set is handed back; whoever
   * carries derived state along compares the value it last saw instead of the state itself.
   *
   * A step says that the camera was evaluated again, not that every field carries a new value:
   * `planeWorld`, `planeOrigin`, `pointOnPlane`, `pointsOnPlane` and `visibles` follow every
   * step, `planeCoords2D` only a step in which the camera met the plane.
   *
   * It is also the {@link IMap2DVisibleTiles.serial} of the result `computeVisibleTiles()` hands out.
   */
  get serial(): number {
    return this.#serial;
  }

  // `depth`, `frustumBoxScale` and `maxVisibleTiles` as the running recomputation reads them,
  // and the height range of the view frustum along the normal of the map plane, in the local
  // space of the map node — what the frustum boxes are cut to —, at the `VIEW_…` indices of
  // `NearestFirstTileSearch.ts`. `#findVisibleTiles()` writes the first three before the search,
  // `#findPointsOnPlaneThatAreInViewFrustum()` the height range. A typed array for the reason
  // `#seenScalars` is one.
  readonly #viewScalars = new Float64Array(VIEW_SCALARS);

  // The nearest-first search, over objects this class writes in place for every recomputation —
  // declared after them, so that the initializer reads them and not `undefined`.
  readonly #search = new NearestFirstTileSearch({
    pool: this.#pool,
    tileWorldMatrix: this.#tileWorldMatrix,
    cameraWorldPosition: this.#cameraWorldPosition,
    planeWorld: this.planeWorld,
    cameraFrustum: this.#cameraFrustum,
    scalars: this.#viewScalars,
  });
  readonly #hullPoints: TilePoint[] = [];
  readonly #hull: TilePoint[] = [];

  // The lists and the object a recomputation hands out, written again by the next one, as
  // `IMap2DVisibleTiles` allows. A recomputation writes the lists here and never through
  // `#result`: the cache path puts `tiles` into `#result.reuseTiles`.
  readonly #tiles: IMap2DTileCoords[] = [];
  readonly #reuseTiles: IMap2DTileCoords[] = [];
  readonly #createTiles: IMap2DTileCoords[] = [];
  readonly #removeTiles: IMap2DTileCoords[] = [];
  readonly #result: IMap2DVisibleTiles = {tiles: this.#tiles};

  // Snapshot of the tile-grid parameters that drive `tile.coords`. It answers whether the grid
  // of the current run differs from the one before — the question `#placeTile()` hangs on — and
  // when it does, `coords` of every slot is written again for the new grid and its `map2dTile`
  // shell let go, so the run builds a new one.
  #cachedTileCoords: Map2DTileCoordsUtil | undefined;

  // Whether the current recomputation runs on a different tile grid than the one before it.
  // `map2dTileCoords` arrives as a parameter and this visibility is public: whoever drives it
  // without a tile streamer can hand it a new grid at any time, and the answer decides whether
  // the tiles of the run before may be handed back for reuse.
  #tileGridChanged = false;

  #warnedCapped = false;

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
  // what the grid is asked about, as an object — see the note on doubles at the top of the
  // module —, and what it answers
  readonly #queryArea = new AABB2();
  readonly #queryTiles: TilesWithinCoords = createTilesWithinCoords();

  // the visitor of `forEachTileWithinConvexHull()`, bound once
  readonly #enqueueHullTile = (x: number, y: number): void => this.#search.enqueue(this.#pool.acquire(x, y), true);

  constructor(camera?: PerspectiveCamera | OrthographicCamera) {
    this.camera = camera;
  }

  #dependenciesChanged(matrixWorld: Matrix4): boolean {
    // Reached only from behind the `if (!this.camera)` guard in `computeVisibleTiles()`.
    const camera = this.camera!;

    const values = this.#dependencyValues;
    values.matrixWorld = matrixWorld;
    values.cameraMatrixWorld = camera.matrixWorld;
    values.cameraProjectionMatrix = camera.projectionMatrix;

    // both halves are asked on every call, so that each snapshot stays current
    const objectsChanged = this.#deps.changed(values);
    const seen = this.#seenScalars;
    const scalarsChanged =
      this.#depth !== seen[SEEN_DEPTH] ||
      this.#frustumBoxScale !== seen[SEEN_FRUSTUM_BOX_SCALE] ||
      this.#maxVisibleTiles !== seen[SEEN_MAX_VISIBLE_TILES] ||
      this.lookAtCenter !== this.#seenLookAtCenter;
    seen[SEEN_DEPTH] = this.#depth;
    seen[SEEN_FRUSTUM_BOX_SCALE] = this.#frustumBoxScale;
    seen[SEEN_MAX_VISIBLE_TILES] = this.#maxVisibleTiles;
    this.#seenLookAtCenter = this.lookAtCenter;

    return objectsChanged || scalarsChanged;
  }

  /**
   * Takes over the current tile grid and answers whether it differs from the one the last
   * recomputation ran on. A first run has nothing to compare against and answers `false`.
   */
  #takeOverTileCoords(): boolean {
    const current = this.#map2dTileCoords;

    if (this.#cachedTileCoords == null) {
      this.#cachedTileCoords = current.clone();
      return false;
    }

    if (this.#cachedTileCoords.equals(current)) return false;

    this.#cachedTileCoords.copy(current);

    // a new grid: `coords` of each slot is stale, and so is its `map2dTile`
    this.#pool.rewriteForGrid();

    return true;
  }

  /**
   * Returns the tiles that the camera frustum covers on the `map2dTileCoords` grid around
   * `centerPoint`, split into the tiles to create and to reuse, with the tiles of
   * `previousTiles` that fall out as `removeTiles`. Without a camera, and whenever the frustum
   * meets the plane on no tile while `previousTiles` is empty, the result is `undefined` and
   * the caller keeps what it holds.
   *
   * Hands a tile of `previousTiles` back for reuse only while the tile grid stands: on a grid
   * other than the one of the previous call those tiles go into `removeTiles`, because their
   * indices belong to a grid this one cannot place. A first call has no earlier grid to hold
   * against and takes `previousTiles` as belonging to the grid it is given.
   *
   * While nothing the result depends on has changed and `previousTiles` is the `tiles` list of the
   * last result — the list `Map2DTileStreamer` hands back —, the call hands that result back as it
   * stands, `serial` included: every tile reused, none to create or to remove. Any other list is
   * held against a computation of its own. After an `undefined` answer only an empty
   * `previousTiles` gets `undefined` again.
   *
   * `tiles` of the result lists the tiles in the order of {@link visibles}, nearest to the
   * camera first.
   *
   * A `centerPoint` that is not two finite numbers throws a `RangeError` before anything changes.
   */
  computeVisibleTiles(
    previousTiles: IMap2DTileCoords[],
    centerPoint: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
    matrixWorld: Matrix4,
  ): IMap2DVisibleTiles | undefined {
    // read by index: a tuple of doubles destructured in the signature costs an allocation per call
    const centerX = centerPoint[0];
    const centerY = centerPoint[1];
    // checked inline and not through `assertFinite()`: a double handed to a call the compiler does
    // not inline is boxed
    if (!(Number.isFinite(centerX) && Number.isFinite(centerY))) {
      throw new RangeError(
        `CameraBasedVisibility: the center point of computeVisibleTiles() must be two finite numbers, got ${describeValue(centerPoint)}`,
      );
    }

    if (!this.camera) {
      return undefined;
    }

    this.#map2dTileCoords.copy(map2dTileCoords);
    this.#map2dTileCoords.readOffset(this.#gridOffset);
    this.#centerPoint2D.set(centerX, centerY);

    // the parents of the camera — a rig, a player object — are moved in the same frame, so they
    // are brought up to date along with it, the way `Map2DTileStreamer` brings the map node up to
    // date: camera and map are compared from the same frame. Its children are left alone; this
    // class reads none of them.
    this.camera.updateWorldMatrix(true, false);

    // the result stands only for the list it gave out as `tiles` — and `undefined` only for an empty
    // list: any other list can hold tiles that fall out, and those have to go out in `removeTiles`
    if (
      !this.#dependenciesChanged(matrixWorld) &&
      (this.#visibleTiles === undefined ? previousTiles.length === 0 : previousTiles === this.#visibleTiles.tiles)
    ) {
      if (this.#visibleTiles) {
        this.#visibleTiles.createTiles = undefined;
        this.#visibleTiles.reuseTiles = this.#visibleTiles.tiles;
        this.#visibleTiles.removeTiles = undefined;
        this.#visibleTiles.changed = false;
      }
      return this.#visibleTiles;
    }

    this.#serial += 1;

    // a first recomputation has no grid before it to hold the view of the tiles in
    // `previousTiles` against — a caller may hand a fresh instance tiles of its own — so it counts
    // as a change of the grid
    const firstRecomputation = this.#cachedTileCoords === undefined;
    this.#tileGridChanged = this.#takeOverTileCoords();
    const changed = firstRecomputation || this.#tileGridChanged;

    this.matrixWorld.copy(matrixWorld);
    this.#matrixWorldInverse.copy(matrixWorld).invert();

    const hitCount = this.#findPointsOnPlaneThatAreInViewFrustum();

    if (hitCount > 0) {
      if (this.#pointOnPlane == null) {
        this.#pointOnPlane = new Vector3();
      }
      // The list holds `hitCount` entries.
      this.#pointOnPlane.copy(this.#pointsOnPlane[0]!);
    } else {
      this.#pointOnPlane = null;
    }

    this.planeWorld.coplanarPoint(this.planeOrigin);

    if (hitCount === 0) {
      // `#findVisibleTiles()`, which is where the list is otherwise emptied, is not reached on
      // this way out — and `visibles` is public: the visibility helpers read it and would go on
      // drawing tile boxes for a view that no longer exists
      truncateArray(this.#visibles);

      if (previousTiles.length === 0) {
        this.#visibleTiles = undefined;
        return undefined;
      }

      // Every tile of `previousTiles` goes out, by the rule `#findVisibleTiles()` follows. The table
      // stays as it stands, so only a slot it holds already takes the stamp. `previousTiles` can be
      // the `tiles` list of the last result — the tile streamer hands it back —, so every entry is
      // out of it before that list is emptied.
      const stamp = this.#serial;
      for (let i = 0; i < previousTiles.length; ++i) {
        // The loop bound is `previousTiles.length`.
        const previousTile = previousTiles[i]!;
        const slot = this.#pool.get(previousTile.x, previousTile.y);
        if (slot !== undefined) slot.previousStamp = stamp;
      }
      this.#removePreviousTiles(previousTiles, stamp);
      truncateArray(this.#tiles);

      const result = this.#result;
      result.tiles = this.#tiles;
      result.removeTiles = this.#removeTiles;
      // nothing of the result before may stand: this way out has no tiles to place
      result.createTiles = undefined;
      result.reuseTiles = undefined;
      result.offset = undefined;
      result.translate = undefined;
      result.changed = changed;
      result.serial = this.#serial;

      this.#visibleTiles = result;
      return result;
    }

    for (let i = 0; i < hitCount; ++i) {
      // The loop bound is the number of points the probe rays found.
      this.#convertToPlaneCoords2D(this.#pointsOnPlane[i]!, poolAt(this.#probePlaneCoords, i, newVector2));
    }

    if (this.lookAtCenter) {
      this.#centerPoint2D.sub(this.#probePlaneCoords[0]!);
    }

    for (let i = 0; i < hitCount; ++i) {
      // The loop bound is the number of points the probe rays found.
      this.#probePlaneCoords[i]!.add(this.#centerPoint2D);
    }

    this.planeCoords2D.copy(this.#probePlaneCoords[0]!);

    this.#visibleTiles = this.#findVisibleTiles(previousTiles, hitCount, changed);

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
  #findPointsOnPlaneThatAreInViewFrustum(): number {
    // Reached only from behind the `if (!this.camera)` guard in `computeVisibleTiles()`.
    const camera = this.camera!;

    this.#cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);

    const gridOffset = this.#gridOffset;
    const planeOffset = this.#planeOffset;
    planeOffset.x = gridOffset.x;
    planeOffset.y = 0;
    planeOffset.z = gridOffset.y;
    this.planeWorld.copy(MAP_PLANE).applyMatrix4(_m.makeTranslation(planeOffset)).applyMatrix4(this.matrixWorld);

    // the depth the projection of the camera maps its near and far plane to — see the table in the
    // docs of this class
    const nearZ = camera.reversedDepth ? 1 : camera.coordinateSystem === WebGPUCoordinateSystem ? 0 : -1;
    const farZ = camera.reversedDepth ? 0 : 1;

    truncateArray(this.#pointsOnPlane);

    const scalars = this.#viewScalars;
    scalars[VIEW_FRUSTUM_HEIGHT_MIN] = Infinity;
    scalars[VIEW_FRUSTUM_HEIGHT_MAX] = -Infinity;

    for (let i = 0; i < FRUSTUM_PROBES_NDC.length; ++i) {
      // The loop bound is `FRUSTUM_PROBES_NDC.length`. Read by index: a tuple destructured costs an
      // allocation wherever the compiler leaves the iteration in place
      const probe = FRUSTUM_PROBES_NDC[i]!;
      const ndcX = probe[0];
      const ndcY = probe[1];

      this.#scratchLineOfSight.start.set(ndcX, ndcY, nearZ).unproject(camera);
      this.#scratchLineOfSight.end.set(ndcX, ndcY, farZ).unproject(camera);

      // every probe counts here, one that misses the plane as well: the probes through the corners
      // run through the eight corners of the frustum, on the near and on the far plane, so these
      // points span the height range of the frustum
      this.#widenFrustumHeight(this.#scratchLineOfSight.start);
      this.#widenFrustumHeight(this.#scratchLineOfSight.end);

      const hit = this.planeWorld.intersectLine(this.#scratchLineOfSight, this.#scratchPlaneIntersection);
      if (hit == null) continue;

      const point = poolAt(this.#pointOnPlanePool, this.#pointsOnPlane.length, newVector3);
      point.copy(hit);
      this.#pointsOnPlane.push(point);
    }

    return this.#pointsOnPlane.length;
  }

  /**
   * Widens the height range of the view frustum by a point of it, given in world space. The range
   * is kept in the local space of the map node, along its y axis — the normal of the map plane.
   * The translation of `#tileBoxMatrix` moves along x and z alone, so the range holds in the space
   * `writeTileBox()` builds the boxes in as well. A point in and nothing out — see the note on
   * doubles at the top of the module.
   */
  #widenFrustumHeight(point: Vector3): void {
    // the y of `point.applyMatrix4(#matrixWorldInverse)`, written out: through `applyMatrix4()`,
    // twice per probe, a recomputation under a tilted camera allocates 32 B — the probe loop grows
    // past what the compiler inlines, see the note on doubles at the top of the module.
    // `#matrixWorldInverse` is the one of this recomputation by now
    const e = this.#matrixWorldInverse.elements;
    const {x, y, z} = point;
    const height = (e[1]! * x + e[5]! * y + e[9]! * z + e[13]!) / (e[3]! * x + e[7]! * y + e[11]! * z + e[15]!);
    const scalars = this.#viewScalars;
    if (height < scalars[VIEW_FRUSTUM_HEIGHT_MIN]!) scalars[VIEW_FRUSTUM_HEIGHT_MIN] = height;
    if (height > scalars[VIEW_FRUSTUM_HEIGHT_MAX]!) scalars[VIEW_FRUSTUM_HEIGHT_MAX] = height;
  }

  #findVisibleTiles(previousTiles: IMap2DTileCoords[], hitCount: number, changed: boolean): IMap2DVisibleTiles {
    // what a slot took part in during this recomputation carries this stamp
    const stamp = this.#serial;
    const search = this.#search;

    // Reset reusable working buffers. What is left in the frontier is what a cut at the limit did
    // not take.
    search.begin(stamp);
    truncateArray(this.#visibles);

    // Every tile of `previousTiles` gets its slot and the stamp that says so. In a frame loop
    // these are the slots of the recomputation before, found in the table as they stand.
    for (let i = 0; i < previousTiles.length; ++i) {
      // The loop bound is `previousTiles.length`.
      const previousTile = previousTiles[i]!;
      this.#pool.acquire(previousTile.x, previousTile.y).previousStamp = stamp;
    }

    // `previousTiles` can be the `tiles` list of the last result — the tile streamer hands it
    // back — and it is read once more below, for `removeTiles`; the lists emptied here are the
    // other two
    truncateArray(this.#reuseTiles);
    truncateArray(this.#createTiles);

    // Reached only from behind the `if (!this.camera)` guard in `computeVisibleTiles()`.
    makeCameraFrustum(this.camera!, this.#cameraFrustum);

    // the scalars the search and `writeTileBox()` read, as they stand for this recomputation
    const scalars = this.#viewScalars;
    scalars[VIEW_DEPTH] = this.#depth;
    scalars[VIEW_FRUSTUM_BOX_SCALE] = this.#frustumBoxScale;
    scalars[VIEW_MAX_VISIBLE_TILES] = this.#maxVisibleTiles;

    const translate = this.#scratchTranslate.setFromMatrixPosition(this.matrixWorld);

    // the tile boxes are built in the local space of the map node, where the renderers draw the
    // tiles; `matrixWorld` takes them into world space once, where the frustum is tested
    const gridOffset = this.#gridOffset;
    const centerPoint2D = this.#centerPoint2D;
    const tileBoxOffset = this.#tileBoxOffset;
    tileBoxOffset.x = gridOffset.x - centerPoint2D.x;
    tileBoxOffset.y = 0;
    tileBoxOffset.z = gridOffset.y - centerPoint2D.y;
    this.#tileBoxMatrix.makeTranslation(this.#tileBoxOffset);
    this.#tileWorldMatrix.multiplyMatrices(this.matrixWorld, this.#tileBoxMatrix);

    this.#collectTilesWithinProbeHull(hitCount);

    // The tiles the probe rays met are where the search starts. Per ray that is the tile its
    // point falls into, together with the tiles a rectangle of one tile size around that point
    // reaches into — up to four in all. A seed the hull has taken in already stays as it is.
    const grid = this.#map2dTileCoords;
    const area = this.#queryArea;
    for (let i = 0; i < hitCount; ++i) {
      // The loop bound is the number of points the probe rays found.
      const coords2D = this.#probePlaneCoords[i]!;
      area.left = coords2D.x - grid.tileWidth / 2;
      area.top = coords2D.y - grid.tileHeight / 2;
      area.width = grid.tileWidth;
      area.height = grid.tileHeight;
      const around = grid.computeTilesWithinArea(area, this.#queryTiles);
      for (let ty = 0; ty < around.rows; ty++) {
        for (let tx = 0; tx < around.columns; tx++) {
          const tile = this.#pool.acquire(around.tileLeft + tx, around.tileTop + ty);
          tile.probeStamp = stamp;
          search.enqueue(tile, false);
        }
      }
    }

    // Nearest first, and at most `maxVisibleTiles` tiles kept — see `NearestFirstTileSearch`.
    if (search.run()) this.#warnCapped();

    const kept = search.kept;
    kept.sortNearestFirst();

    // `primary` is a statement about this recomputation and a slot outlives it, so it is
    // written here rather than kept up to date while the search runs: a tile that is not in the
    // visible set is not handed out, and one that comes back into it gets its answer here.
    //
    // Only the tiles the search kept to the end are placed and sorted into reuse and create: a
    // tile that was kept for a while and then gave way keeps its `previousStamp`, and goes out
    // in `removeTiles` if it was a tile of the last result.
    for (let i = 0; i < kept.length; ++i) {
      // The loop bound is `kept.length`.
      const tile = kept.at(i);
      tile.primary = tile.probeStamp === stamp;
      this.#placeTile(tile, this.#reuseTiles, this.#createTiles);
      this.#visibles.push(tile);
    }
    kept.clear();

    // Before `#tiles` is written: `previousTiles` can be that list. Every tile of it got its slot
    // at the start, and no slot leaves the table before the eviction below.
    this.#removePreviousTiles(previousTiles, stamp);

    truncateArray(this.#tiles);
    // The loop bound is `this.#visibles.length`, and `#placeTile()` gave each of them its shell.
    for (let i = 0; i < this.#visibles.length; ++i) this.#tiles.push(this.#visibles[i]!.map2dTile!);

    this.#pool.evict(stamp);

    const offset = this.#scratchOffset;
    offset.x = gridOffset.x - centerPoint2D.x;
    offset.y = gridOffset.y - centerPoint2D.y;

    const result = this.#result;
    result.tiles = this.#tiles;
    result.createTiles = this.#createTiles;
    result.reuseTiles = this.#reuseTiles;
    result.removeTiles = this.#removeTiles;
    result.offset = offset;
    result.translate = translate;
    result.changed = changed;
    result.serial = this.#serial;

    return result;
  }

  /**
   * Writes `removeTiles`: the tiles of `previousTiles` whose slot still carries `stamp` — the
   * tiles not handed back for reuse —, a coordinate that stands in it twice once, at its first
   * place. A tile this visibility holds no slot for goes out as it is.
   *
   * The shell of a tile that goes out belongs to the caller now: a slot that stays — a tile
   * tested around the view, or one the camera turned away from — builds a new one when its tile
   * comes back. On a new grid the slot carries a shell of its own already, and keeps it.
   */
  #removePreviousTiles(previousTiles: IMap2DTileCoords[], stamp: number): void {
    const removeTiles = this.#removeTiles;
    truncateArray(removeTiles);
    for (let i = 0; i < previousTiles.length; ++i) {
      // The loop bound is `previousTiles.length`.
      const previousTile = previousTiles[i]!;
      const slot = this.#pool.get(previousTile.x, previousTile.y);
      if (slot === undefined) {
        removeTiles.push(previousTile);
        continue;
      }
      if (slot.previousStamp !== stamp) continue;
      slot.previousStamp = 0;
      removeTiles.push(previousTile);
      if (slot.map2dTile === previousTile) slot.map2dTile = undefined;
    }
  }

  /**
   * Puts every tile within the convex hull of the tiles the probe rays met into the frontier,
   * marked as lying inside it.
   *
   * These tiles are visible without being tested. The frustum is convex and so is the plane, so
   * the area where the two meet is convex as well: it contains every point between the points
   * the rays found, and therefore each of the tiles those points span. A tile on the hull that
   * the rounding to whole tiles leaves out is no loss — it borders one that is in, so the
   * search reaches it and tests it as it tests every other tile.
   *
   * The tiles of the hull save the frustum test, not their place in the order: they come out of
   * the frontier by their distance to the camera like every other tile, and only so are the
   * tiles kept under {@link maxVisibleTiles} the nearest ones and not those of the hull.
   *
   * A hull whose bounding box holds more tiles than {@link maxVisibleTiles} is not filled in:
   * the box bounds the tiles of the hull from above, and without them the search tests every
   * tile against the frustum — which costs tests, never the result.
   *
   * Fewer than three rays span no area, and there is nothing to fill in.
   */
  #collectTilesWithinProbeHull(hitCount: number): void {
    if (hitCount < MIN_PROBES_FOR_HULL) return;

    const points = this.#hullPoints;
    truncateArray(points);
    const area = this.#queryArea;
    area.width = 0;
    area.height = 0;
    for (let i = 0; i < hitCount; ++i) {
      // The loop bound is the number of points the probe rays found.
      const coords2D = this.#probePlaneCoords[i]!;
      area.left = coords2D.x;
      area.top = coords2D.y;
      const tile = this.#map2dTileCoords.computeTilesWithinArea(area, this.#queryTiles);
      const point = poolAt(this.#probeTiles, i, newTilePoint);
      point[0] = tile.tileLeft;
      point[1] = tile.tileTop;
      points.push(point);
    }

    const hull = convexTileHull(points, this.#hull);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < hull.length; ++i) {
      // The loop bound is `hull.length`. Read by index: a tuple destructured costs an allocation
      // wherever the compiler leaves the iteration in place
      const point = hull[i]!;
      const x = point[0];
      const y = point[1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if ((maxX - minX + 1) * (maxY - minY + 1) > this.#maxVisibleTiles) return;

    forEachTileWithinConvexHull(hull, this.#enqueueHullTile);
  }

  /**
   * Places a tile the search kept, and sorts it into `reuseTiles` or `createTiles`. Expects the
   * search to have kept it.
   */
  #placeTile(tile: PooledTileBox, reuseTiles: IMap2DTileCoords[], createTiles: IMap2DTileCoords[]): void {
    const coords = tile.coords;

    writeTileBox(tile.box, coords, this.#viewScalars, false).translate(this.#tileBoxOffset);

    // the one allocation of a tile that enters the view: the shell the caller keeps
    if (tile.map2dTile === undefined) {
      tile.map2dTile = new Map2DTileCoords(tile.x, tile.y, new AABB2());
    }
    setAABB2(tile.map2dTile.view, coords);

    // A tile of another grid carries the same `(x, y)` id for a different piece of the map, and
    // reuse is what keeps its quadSize and texCoords: the renderer's `updateTile()` writes the
    // position and nothing else. Leaving its `previousStamp` standing sends it out as `remove`,
    // and the map is rebuilt in the grid it is now drawn in.
    if (!this.#tileGridChanged && tile.previousStamp === this.#serial) {
      tile.previousStamp = 0;
      reuseTiles.push(tile.map2dTile);
    } else {
      createTiles.push(tile.map2dTile);
    }
  }

  #warnCapped(): void {
    if (this.#warnedCapped) return;
    this.#warnedCapped = true;
    const limit = this.#maxVisibleTiles;
    // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
    console.warn(
      `CameraBasedVisibility: the view reaches more than ${limit} tiles, so only the ${limit} nearest to the camera are kept. Raise maxVisibleTiles, or lower camera.far, if the tiles further out should be drawn. This warning is shown once per visibility.`,
    );
  }

  #convertToPlaneCoords2D(pointOnPlane3D: Vector3, target: Vector2) {
    _v.copy(pointOnPlane3D);
    _v.sub(this.planeOrigin).applyMatrix4(this.#matrixWorldInverse);

    target.set(_v.x, _v.z);
  }
}
