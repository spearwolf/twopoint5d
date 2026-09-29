import type {OrthographicCamera, PerspectiveCamera} from 'three/webgpu';
import {Box3, Frustum, Line3, Matrix4, Plane, Vector2, Vector3, WebGPUCoordinateSystem} from 'three/webgpu';
import {Dependencies, type DependencyValues} from '../utils/Dependencies.js';
import {describeValue} from '../utils/describeValue.js';
import {truncateArray} from '../utils/truncateArray.js';
import {AABB2} from './AABB2.js';
import {convexTileHull, forEachTileWithinConvexHull, type TilePoint} from './convexTileHull.js';
import {createTilesWithinCoords} from './createTilesWithinCoords.js';
import {Map2DTileCoords} from './Map2DTileCoords.js';
import {Map2DTileCoordsUtil, type TilesWithinCoords} from './Map2DTileCoordsUtil.js';
import {writePackedTileCoords} from './packedTileKey.js';
import {TileSlotTable, type TileSlotTableEntry} from './TileSlotTable.js';
import type {IMap2DTileCoords, IMap2DVisibilitor, IMap2DVisibleTiles} from './types.js';

export interface TileBox {
  /**
   * The packed key of the tile coordinate, as `packTileCoords(x, y)` returns it. Whoever needs
   * a readable designation of the tile takes `x` and `y`.
   */
  id: number;
  x: number;
  y: number;
  /**
   * The tile on the grid: its tile coordinate, one column and one row, and its edges relative to
   * the origin of the grid, without the offset of the grid.
   */
  coords?: TilesWithinCoords;
  /** The box of the tile in the local space of the map node, where the tile renderers draw it. */
  box?: Box3;
  /** The box the view frustum is tested against, in world space, scaled by `frustumBoxScale`. */
  frustumBox?: Box3;
  /** The center of the tile in world space. */
  centerWorld?: Vector3;
  distanceToCamera?: number;
  map2dTile?: IMap2DTileCoords;
  /**
   * `true` for a tile the search started from in the last recomputation: the tile a probe ray of
   * the view frustum met the map plane in — see {@link CameraBasedVisibility.pointsOnPlane} —, and
   * each tile a rectangle of one tile size around that point reaches into, up to four per ray. The
   * tiles within the hull those points span come in without a frustum test, and every other visible
   * tile was reached from one of these, neighbour by neighbour.
   */
  primary?: boolean;
}

/**
 * The slot {@link CameraBasedVisibility} keeps for a tile — the public shape plus what the search
 * needs on the way. Every slot carries all of its fields from the start, see `createTileSlot()`.
 */
interface PooledTileBox extends TileBox, TileSlotTableEntry<PooledTileBox> {
  coords: TilesWithinCoords;
  box: Box3;
  frustumBox: Box3;
  centerWorld: Vector3;
  distanceToCamera: number;
  /**
   * Whether the tile came into the frontier from within the hull of the probe rays, and so is
   * visible without a frustum test. Written each time the tile enters the frontier.
   */
  insideProbeHull: boolean;
  /** The `serial` of the recomputation that last put the tile into the frontier. */
  visitedStamp: number;
  /** The `serial` of the recomputation in which a probe ray last met the tile. */
  probeStamp: number;
  /**
   * The `serial` of the recomputation that found the tile in its `previousTiles` and has not
   * sorted it into `reuseTiles` or `removeTiles` yet; 0 once it has.
   */
  previousStamp: number;
  /** The next slot in the bucket of the slot table; the table alone writes it. */
  nextInBucket: PooledTileBox | undefined;
}

// Doubles on the path a frame loop runs. A double handed to a call the compiler does not inline,
// or answered by one, is boxed — an allocation per call —, and which calls get inlined shifts with
// the code around them. So on this path a double does not cross a call: it travels in the field of
// an object — the query rectangle, the vectors of a slot —, and a small helper that would take or
// answer one is written out where it is needed. `hot-path-allocations.spec.ts` holds the class to
// it.

/**
 * A slot with every field in place and in the same order, so that all slots share one hidden
 * class. A new slot carries the stamp 0, which no recomputation has.
 */
const createTileSlot = (): PooledTileBox => ({
  id: 0,
  x: 0,
  y: 0,
  coords: createTilesWithinCoords(),
  box: new Box3(),
  frustumBox: new Box3(),
  centerWorld: new Vector3(),
  distanceToCamera: 0,
  map2dTile: undefined,
  primary: false,
  insideProbeHull: false,
  visitedStamp: 0,
  probeStamp: 0,
  previousStamp: 0,
  nextInBucket: undefined,
});

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

// where `CameraBasedVisibility` keeps what the search compares against at the limit, see
// `searchCanStop()`
const SEARCH_STOP_HEIGHT_SQ = 0;
const SEARCH_STOP_FOOTPRINT_DIAGONAL = 1;
const SEARCH_STOP_DISTANCE_SQ = 2;

/** The objects the dependency gate of {@link CameraBasedVisibility} compares. */
interface CameraDependencies {
  centerPoint2D: Vector2;
  map2dTileCoords: Map2DTileCoordsUtil;
  matrixWorld: Matrix4;
  cameraMatrixWorld: Matrix4;
  cameraProjectionMatrix: Matrix4;
}

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
  static readonly Plane = new Plane(new Vector3(0, 1, 0), 0);

  #frustumBoxScale = 1.1;

  /**
   * How much larger than the tile the box is that the view frustum is tested against: the box is
   * `frustumBoxScale` times the tile in width, height and depth, around the tile — each side moves
   * out by `(frustumBoxScale - 1) / 2` of the tile size. `1` tests the tile itself; the default
   * `1.1` gives a tile that only just leaves the view a margin before it is dropped.
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
    if (!(Number.isFinite(value) && value >= 1)) {
      throw new RangeError(
        `[CameraBasedVisibility] frustumBoxScale must be a finite number of at least 1, got ${describeValue(value)}`,
      );
    }
    this.#frustumBoxScale = value;
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
    if (!(Number.isInteger(value) && value >= 1) && value !== Infinity) {
      throw new RangeError(
        `[CameraBasedVisibility] maxVisibleTiles must be a whole number above 0 or Infinity, got ${describeValue(value)}`,
      );
    }
    this.#maxVisibleTiles = value;
  }

  /**
   * Whether the view center of the map is where the camera looks. With `true`, the point where the
   * first probe ray meets the map plane — the ray through the middle of the view, as long as it
   * meets the plane — is taken as `(centerX, centerY)`: the tiles are laid out around the view
   * center wherever the camera points. With `false` (the default), the view center shifts the map
   * under the camera instead: the camera sees the map point that lies `(centerX, centerY)` away
   * from where it looks on the plane.
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
   * Takes a finite number of at least 0 and throws a `RangeError` for anything else, keeping the
   * value it had: a negative depth turns the box inside out, which three.js takes for an empty box
   * and leaves where it is when it transforms it, and a depth that is not finite lets every tile
   * through the frustum test. A new value recomputes on the next call.
   */
  get depth(): number {
    return this.#depth;
  }

  set depth(value: number) {
    if (!(Number.isFinite(value) && value >= 0)) {
      throw new RangeError(`[CameraBasedVisibility] depth must be a finite number of at least 0, got ${describeValue(value)}`);
    }
    this.#depth = value;
  }

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
  // `matrixWorld` after `#tileBoxMatrix`, formed once per recomputation: one transform takes a
  // tile from where its box is built into world space
  #tileWorldMatrix = new Matrix4();
  // the translation of `#tileBoxMatrix`, which is all it does, for the box that stays in the
  // local space of the map node
  #tileBoxOffset = new Vector3();
  // the offset of the grid, handed to `makeTranslation()` as a vector — see the note on doubles at
  // the top of the module
  readonly #planeOffset = new Vector3();

  readonly #map2dTileCoords = new Map2DTileCoordsUtil();

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
  readonly visibles: TileBox[] = [];
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

  // Per-frame working lists — kept across calls and emptied with `truncateArray()`, so that every
  // recomputation fills the backing stores of the one before.
  // A binary min-heap over `distanceToCamera`: the tiles found and not yet taken, nearest on
  // top, so the search runs from the camera outwards and a cut at the limit leaves out the
  // furthest.
  readonly #frontier: PooledTileBox[] = [];
  // The visible tiles the search keeps, in the order it found them until there are
  // `maxVisibleTiles` of them, from then on a binary max-heap over `distanceToCamera`: the
  // furthest on top, where a nearer tile takes its place.
  readonly #kept: PooledTileBox[] = [];
  // What `searchCanStop()` compares against, at the `SEARCH_STOP_…` indices: the height of the
  // camera above the plane squared and the diagonal of the footprint of a frustum box — the same
  // for every tile of one recomputation, written once the search holds `maxVisibleTiles` tiles —
  // and the stop distance squared, written again each time another tile becomes the furthest kept
  // one. A typed array for the reason `#seenScalars` is one.
  readonly #searchStop = new Float64Array(3);
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

  // The slot of every tile the last recomputation put into the frontier — the visible tiles and
  // the ring of tested ones around them —, found by its tile coordinate. A slot owns the
  // TilesWithinCoords, Box3s and Vector3 it hands out, so that a recomputation writes them in
  // place. What a slot took part in is a stamp, the `#serial` of the recomputation, written on the
  // slot itself — see `PooledTileBox` —: there is no set to clear and no map to fill again.
  // The table holds the tiles of the last recomputation that found the map plane, and no others:
  // a frame in which the camera looks past the plane computes no tiles and leaves it as it stands.
  readonly #slotTable = new TileSlotTable<PooledTileBox>();
  // every slot of the table, so that the eviction walks them without an iterator
  readonly #slots: PooledTileBox[] = [];
  // The slots a recomputation evicted, for the tiles that enter the view in the next one. At most
  // as many as the table holds after the eviction: those tested around the visible tiles count
  // too, and that is how many slots the next recomputation of a similar view takes. When the view
  // shrinks, the rest goes to the GC.
  readonly #freeSlots: PooledTileBox[] = [];

  // Snapshot of the tile-grid parameters that drive `tile.coords`. It answers whether the grid
  // of the current run differs from the one before — the question `placeTile()` hangs on — and
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
  readonly #enqueueHullTile = (x: number, y: number): void => this.enqueue(this.acquireTileBox(x, y), true);

  constructor(camera?: PerspectiveCamera | OrthographicCamera) {
    this.camera = camera;
  }

  private dependenciesChanged(matrixWorld: Matrix4): boolean {
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
  private takeOverTileCoords(): boolean {
    const current = this.#map2dTileCoords;

    if (this.#cachedTileCoords == null) {
      this.#cachedTileCoords = current.clone();
      return false;
    }

    if (this.#cachedTileCoords.equals(current)) return false;

    this.#cachedTileCoords.copy(current);

    // Tile geometry parameters changed → `coords` of each slot is stale, and so is its
    // `map2dTile`: the caller still holds that shell as a tile of the old grid and gets it back
    // in `removeTiles`, so this run writes the new grid into a fresh one instead of under the
    // caller's feet.
    for (let i = 0; i < this.#slots.length; ++i) {
      // The loop bound is `this.#slots.length`.
      const slot = this.#slots[i]!;
      this.writeTileCoords(slot);
      slot.map2dTile = undefined;
    }

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
   * `tiles` of the result lists the tiles in the order of {@link visibles}, nearest to the
   * camera first.
   */
  computeVisibleTiles(
    previousTiles: IMap2DTileCoords[],
    centerPoint: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
    matrixWorld: Matrix4,
  ): IMap2DVisibleTiles | undefined {
    if (!this.camera) {
      return undefined;
    }

    this.#map2dTileCoords.copy(map2dTileCoords);
    // read by index: a tuple of doubles destructured in the signature costs an allocation per call
    this.#centerPoint2D.set(centerPoint[0], centerPoint[1]);

    // the parents of the camera — a rig, a player object — are moved in the same frame, so they
    // are brought up to date along with it, the way `Map2DTileStreamer` brings the map node up to
    // date: camera and map are compared from the same frame. Its children are left alone; this
    // class reads none of them.
    this.camera.updateWorldMatrix(true, false);

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

    // a first recomputation has no grid before it to hold the view of the tiles in
    // `previousTiles` against — a caller may hand a fresh instance tiles of its own — so it counts
    // as a change of the grid
    const firstRecomputation = this.#cachedTileCoords === undefined;
    this.#tileGridChanged = this.takeOverTileCoords();
    const changed = firstRecomputation || this.#tileGridChanged;

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
      // `findVisibleTiles()`, which is where the list is otherwise emptied, is not reached on
      // this way out — and `visibles` is public: the visibility helpers read it and would go on
      // drawing tile boxes for a view that no longer exists
      truncateArray(this.visibles);

      if (previousTiles.length === 0) {
        this.#visibleTiles = undefined;
        return undefined;
      }

      // Every tile of `previousTiles` goes out, by the rule `findVisibleTiles()` follows. The table
      // stays as it stands, so only a slot it holds already takes the stamp. `previousTiles` can be
      // the `tiles` list of the last result — the tile streamer hands it back —, so every entry is
      // out of it before that list is emptied.
      const stamp = this.#serial;
      for (let i = 0; i < previousTiles.length; ++i) {
        // The loop bound is `previousTiles.length`.
        const previousTile = previousTiles[i]!;
        const slot = this.#slotTable.get(previousTile.x, previousTile.y);
        if (slot !== undefined) slot.previousStamp = stamp;
      }
      this.removePreviousTiles(previousTiles, stamp);
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
      this.convertToPlaneCoords2D(this.pointsOnPlane[i]!, poolAt(this.#probePlaneCoords, i, newVector2));
    }

    if (this.lookAtCenter) {
      this.#centerPoint2D.sub(this.#probePlaneCoords[0]!);
    }

    for (let i = 0; i < hitCount; ++i) {
      // The loop bound is the number of points the probe rays found.
      this.#probePlaneCoords[i]!.add(this.#centerPoint2D);
    }

    this.planeCoords2D.copy(this.#probePlaneCoords[0]!);

    this.#visibleTiles = this.findVisibleTiles(previousTiles, hitCount, changed);

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
      .applyMatrix4(_m.makeTranslation(this.#planeOffset.set(this.#map2dTileCoords.xOffset, 0, this.#map2dTileCoords.yOffset)))
      .applyMatrix4(this.matrixWorld);

    // the depth the projection of the camera maps its near and far plane to — see the table in the
    // docs of this class
    const nearZ = camera.reversedDepth ? 1 : camera.coordinateSystem === WebGPUCoordinateSystem ? 0 : -1;
    const farZ = camera.reversedDepth ? 0 : 1;

    truncateArray(this.pointsOnPlane);

    for (let i = 0; i < FRUSTUM_PROBES_NDC.length; ++i) {
      // The loop bound is `FRUSTUM_PROBES_NDC.length`.
      const [ndcX, ndcY] = FRUSTUM_PROBES_NDC[i]!;

      this.#scratchLineOfSight.start.set(ndcX, ndcY, nearZ).unproject(camera);
      this.#scratchLineOfSight.end.set(ndcX, ndcY, farZ).unproject(camera);

      const hit = this.planeWorld.intersectLine(this.#scratchLineOfSight, this.#scratchPlaneIntersection);
      if (hit == null) continue;

      const point = poolAt(this.#pointOnPlanePool, this.pointsOnPlane.length, newVector3);
      point.copy(hit);
      this.pointsOnPlane.push(point);
    }

    return this.pointsOnPlane.length;
  }

  /**
   * The slot of the tile `(x, y)`: the one the table holds, or else a free slot — a new one only
   * when there is none — written for the tile. Its stamps stay as they are; they are held against
   * the `serial` of the running recomputation, and a slot out of the free list carries an older
   * one.
   */
  private acquireTileBox(x: number, y: number): PooledTileBox {
    const found = this.#slotTable.get(x, y);
    if (found !== undefined) return found;

    const slot = this.#freeSlots.pop() ?? createTileSlot();
    writePackedTileCoords(slot, x, y);
    slot.x = x;
    slot.y = y;
    this.writeTileCoords(slot);
    slot.map2dTile = undefined;
    this.#slotTable.add(slot);
    this.#slots.push(slot);
    return slot;
  }

  /**
   * Writes `coords` of a slot for its tile on the current grid: the tile itself, one column and one
   * row, taken from the tile coordinate. A query rectangle would meet a neighbouring tile wherever
   * the grid is finer than the rectangle or an edge comes out a rounding step off in floating
   * point.
   */
  private writeTileCoords(slot: PooledTileBox): void {
    const grid = this.#map2dTileCoords;
    const tileWidth = grid.tileWidth;
    const tileHeight = grid.tileHeight;
    const coords = slot.coords;
    coords.tileTop = slot.y;
    coords.tileLeft = slot.x;
    coords.top = slot.y * tileHeight;
    coords.left = slot.x * tileWidth;
    coords.height = tileHeight;
    coords.width = tileWidth;
    coords.tileHeight = tileHeight;
    coords.tileWidth = tileWidth;
    coords.rows = 1;
    coords.columns = 1;
  }

  private findVisibleTiles(previousTiles: IMap2DTileCoords[], hitCount: number, changed: boolean): IMap2DVisibleTiles {
    // what a slot took part in during this recomputation carries this stamp
    const stamp = this.#serial;

    // Reset reusable working buffers. What is left in the frontier is what a cut at the limit did
    // not take.
    truncateArray(this.#frontier);
    truncateArray(this.visibles);

    // Every tile of `previousTiles` gets its slot and the stamp that says so. In a frame loop
    // these are the slots of the recomputation before, found in the table as they stand.
    for (let i = 0; i < previousTiles.length; ++i) {
      // The loop bound is `previousTiles.length`.
      const previousTile = previousTiles[i]!;
      this.acquireTileBox(previousTile.x, previousTile.y).previousStamp = stamp;
    }

    // `previousTiles` can be the `tiles` list of the last result — the tile streamer hands it
    // back — and it is read once more below, for `removeTiles`; the lists emptied here are the
    // other two
    truncateArray(this.#reuseTiles);
    truncateArray(this.#createTiles);

    // Reached only from behind the `if (!this.camera)` guard in `computeVisibleTiles()`.
    makeCameraFrustum(this.camera!, this.#cameraFrustum);

    const translate = this.#scratchTranslate.setFromMatrixPosition(this.matrixWorld);

    // the tile boxes are built in the local space of the map node, where the renderers draw the
    // tiles; `matrixWorld` takes them into world space once, where the frustum is tested
    this.#tileBoxOffset.set(
      this.#map2dTileCoords.xOffset - this.#centerPoint2D.x,
      0,
      this.#map2dTileCoords.yOffset - this.#centerPoint2D.y,
    );
    this.#tileBoxMatrix.makeTranslation(this.#tileBoxOffset);
    this.#tileWorldMatrix.multiplyMatrices(this.matrixWorld, this.#tileBoxMatrix);

    this.collectTilesWithinProbeHull(hitCount);

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
          const tile = this.acquireTileBox(around.tileLeft + tx, around.tileTop + ty);
          tile.probeStamp = stamp;
          this.enqueue(tile, false);
        }
      }
    }

    // Nearest first. Once `maxVisibleTiles` tiles are kept, a visible tile nearer than the
    // furthest of them takes its place, and the search goes on as long as the frontier can still
    // lead to such a tile — see `searchCanStop()`.
    const limit = this.#maxVisibleTiles;
    const kept = this.#kept;
    let capped = false;
    while (this.#frontier.length > 0) {
      if (kept.length >= limit && this.searchCanStop(this.#frontier[0]!)) break;

      const tile = this.popFrontier();
      this.updateFrustumBox(tile);
      if (!tile.insideProbeHull && !this.#cameraFrustum.intersectsBox(tile.frustumBox)) continue;

      if (kept.length < limit) {
        kept.push(tile);
        if (kept.length === limit) {
          this.heapifyKept();
          this.beginSearchStop();
        }
      } else {
        // a visible tile goes: this one, or the furthest kept one it takes the place of
        capped = true;
        if (tile.distanceToCamera < kept[0]!.distanceToCamera) {
          this.siftDownKept(0, tile);
          this.updateSearchStop();
        }
      }
      // expanded either way: a tile left out can still be the way to a nearer one
      this.pushNeighbors(tile);
    }

    // A search that stopped at the distance leaves tiles in the frontier. The limit cut the view
    // only if one of them is visible — a rest that would fail the test does not count.
    if (!capped && kept.length >= limit) {
      while (this.#frontier.length > 0) {
        const tile = this.popFrontier();
        this.updateFrustumBox(tile);
        if (tile.insideProbeHull || this.#cameraFrustum.intersectsBox(tile.frustumBox)) {
          capped = true;
          break;
        }
      }
    }
    if (capped) this.warnCapped();

    this.sortKept();

    // `primary` is a statement about this recomputation and a slot outlives it, so it is
    // written here rather than kept up to date while the search runs: a tile that is not in the
    // visible set is not handed out, and one that comes back into it gets its answer here.
    //
    // Only the tiles the search kept to the end are placed and sorted into reuse and create: a
    // tile that was kept for a while and then gave way keeps its `previousStamp`, and goes out
    // in `removeTiles` if it was a tile of the last result.
    for (let i = 0; i < kept.length; ++i) {
      // The loop bound is `kept.length`.
      const tile = kept[i]!;
      tile.primary = tile.probeStamp === stamp;
      this.placeTile(tile, this.#reuseTiles, this.#createTiles);
      this.visibles.push(tile);
    }
    truncateArray(kept);

    // Before `#tiles` is written: `previousTiles` can be that list. Every tile of it got its slot
    // at the start, and no slot leaves the table before the eviction below.
    this.removePreviousTiles(previousTiles, stamp);

    truncateArray(this.#tiles);
    // The loop bound is `this.visibles.length`, and `placeTile()` gave each of them its shell.
    for (let i = 0; i < this.visibles.length; ++i) this.#tiles.push(this.visibles[i]!.map2dTile!);

    this.evictSlots(stamp);

    this.#scratchOffset.set(
      this.#map2dTileCoords.xOffset - this.#centerPoint2D.x,
      this.#map2dTileCoords.yOffset - this.#centerPoint2D.y,
    );

    const result = this.#result;
    result.tiles = this.#tiles;
    result.createTiles = this.#createTiles;
    result.reuseTiles = this.#reuseTiles;
    result.removeTiles = this.#removeTiles;
    result.offset = this.#scratchOffset;
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
  private removePreviousTiles(previousTiles: IMap2DTileCoords[], stamp: number): void {
    const removeTiles = this.#removeTiles;
    truncateArray(removeTiles);
    for (let i = 0; i < previousTiles.length; ++i) {
      // The loop bound is `previousTiles.length`.
      const previousTile = previousTiles[i]!;
      const slot = this.#slotTable.get(previousTile.x, previousTile.y);
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
   * Puts the kept tiles in order of their distance to the camera, nearest first, without a
   * comparator: `Array#sort()` calls one per comparison, boxes each answer, and builds a working
   * array.
   */
  private sortKept(): void {
    const kept = this.#kept;

    if (kept.length < this.#maxVisibleTiles) {
      // Never made a heap: the list holds the tiles in the order the search took them, which is
      // by distance, but for a tile a neighbour reached late — at most a tile diagonal nearer than
      // the tile it was found from. Nearly sorted, so an insertion sort runs in close to linear
      // time; it moves a tile only past one further out, and keeps equal distances in the order
      // they came.
      for (let i = 1; i < kept.length; ++i) {
        // The loop bound is `kept.length`, and `j - 1` stays at 0 or above.
        const tile = kept[i]!;
        const distance = tile.distanceToCamera;
        let j = i;
        while (j > 0 && kept[j - 1]!.distanceToCamera > distance) {
          kept[j] = kept[j - 1]!;
          --j;
        }
        kept[j] = tile;
      }
      return;
    }

    // A max-heap since `heapifyKept()`: heapsort in place, the furthest of the heap to the back
    // of it, one after the other.
    for (let end = kept.length - 1; end > 0; --end) {
      // The index runs down from the last entry.
      const last = kept[end]!;
      kept[end] = kept[0]!;
      this.siftDownKept(0, last, end);
    }
  }

  /**
   * Hands every slot this recomputation did not put into the frontier to the free list. Such a
   * slot keeps a Box3, a Vector3 and a TilesWithinCoords for a tile the camera has left behind;
   * the next tile that enters the view writes them again instead of building its own.
   *
   * The slots are walked from the back, so that `pop()` hands the evicted ones out in the order
   * their tiles were taken: the tiles that enter the view first — the seeds and the nearest — get
   * the slots of the tiles that were nearest, and the tiles tested around the view get the slots
   * of the ring before.
   */
  private evictSlots(stamp: number): void {
    const slots = this.#slots;
    let firstStaying = slots.length;
    for (let i = slots.length - 1; i >= 0; --i) {
      // The index runs down from the last entry, and `firstStaying` never drops below `i`.
      const slot = slots[i]!;
      if (slot.visitedStamp === stamp) {
        slots[--firstStaying] = slot;
        continue;
      }
      this.#slotTable.remove(slot);
      // the shell belongs to the caller now, and nothing writes it again
      slot.map2dTile = undefined;
      this.#freeSlots.push(slot);
    }
    // the slots that stay sit at the back, in their order; they move to the front
    const staying = slots.length - firstStaying;
    for (let i = 0; i < staying; ++i) slots[i] = slots[firstStaying + i]!;
    truncateArray(slots, staying);
    truncateArray(this.#freeSlots, staying);
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
  private collectTilesWithinProbeHull(hitCount: number): void {
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
      // The loop bound is `hull.length`.
      const [x, y] = hull[i]!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if ((maxX - minX + 1) * (maxY - minY + 1) > this.#maxVisibleTiles) return;

    forEachTileWithinConvexHull(hull, this.#enqueueHullTile);
  }

  /**
   * Puts a tile into the frontier, unless it has been there in this recomputation already. The
   * mark is set here, on the way in, so that a tile enters the frontier exactly once.
   */
  private enqueue(tile: PooledTileBox, insideProbeHull: boolean): void {
    const stamp = this.#serial;
    if (tile.visitedStamp === stamp) return;
    tile.visitedStamp = stamp;

    tile.insideProbeHull = insideProbeHull;
    this.prepareTile(tile);
    this.pushFrontier(tile);
  }

  /** Sift-up: the parent of the entry at `i` sits at `(i - 1) >> 1`. */
  private pushFrontier(tile: PooledTileBox): void {
    const heap = this.#frontier;
    const distance = tile.distanceToCamera;
    let i = heap.length;
    heap.push(tile);
    while (i > 0) {
      const parentIndex = (i - 1) >> 1;
      // A heap of this length has an entry at every index below it.
      const parent = heap[parentIndex]!;
      if (parent.distanceToCamera <= distance) break;
      heap[i] = parent;
      i = parentIndex;
    }
    heap[i] = tile;
  }

  /** Takes the nearest tile off the frontier, which the caller checked to be non-empty. */
  private popFrontier(): PooledTileBox {
    const heap = this.#frontier;
    const nearest = heap[0]!;
    const last = heap.pop()!;
    const length = heap.length;
    if (length === 0) return nearest;

    // sift-down: the last entry drops from the top until neither child lies nearer
    const distance = last.distanceToCamera;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      if (left >= length) break;
      const right = left + 1;
      // Both indices are checked against the length of the heap.
      let child = heap[left]!;
      let childIndex = left;
      if (right < length && heap[right]!.distanceToCamera < child.distanceToCamera) {
        child = heap[right]!;
        childIndex = right;
      }
      if (child.distanceToCamera >= distance) break;
      heap[i] = child;
      i = childIndex;
    }
    heap[i] = last;
    return nearest;
  }

  /**
   * The center of the tile in world space and its distance to the camera — what the frontier
   * orders by —, in the shape of this frame.
   */
  private prepareTile(tile: PooledTileBox): void {
    const coords = tile.coords;
    // field by field, and `distanceTo()` written out — see the note on doubles at the top of the
    // module
    const center = tile.centerWorld;
    center.x = coords.left + coords.width / 2;
    center.y = 0;
    center.z = coords.top + coords.height / 2;
    center.applyMatrix4(this.#tileWorldMatrix);

    const camera = this.#cameraWorldPosition;
    const dx = center.x - camera.x;
    const dy = center.y - camera.y;
    const dz = center.z - camera.z;
    tile.distanceToCamera = Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * The box the frustum test reads, for every tile taken off the frontier — those of the hull
   * too, whose box the visibility helpers draw. Expects {@link prepareTile} to have run on it.
   */
  private updateFrustumBox(tile: PooledTileBox): void {
    // the same box two transforms in a row give: `#tileBoxMatrix` only translates, and a box
    // that is moved stays exact
    this.setBox(tile.frustumBox, tile.coords, true).applyMatrix4(this.#tileWorldMatrix);
  }

  /**
   * Writes what stays the same for the rest of the recomputation once the search holds
   * `maxVisibleTiles` tiles — the height of the camera above the plane and the diagonal of the
   * footprint of a frustum box — and then the stop distance for the furthest kept tile. Expects the
   * kept tiles to be a heap.
   */
  private beginSearchStop(): void {
    const stop = this.#searchStop;
    // `planeWorld.distanceToPoint()` written out — see the note on doubles at the top of the module
    const {normal, constant} = this.planeWorld;
    const camera = this.#cameraWorldPosition;
    const height = normal.x * camera.x + normal.y * camera.y + normal.z * camera.z + constant;
    stop[SEARCH_STOP_HEIGHT_SQ] = height * height;
    // the frustum boxes of all tiles have the same size. The search calls this once it holds
    // maxVisibleTiles tiles, at least one
    const {min, max} = this.#kept[0]!.frustumBox;
    const dx = max.x - min.x;
    const dz = max.z - min.z;
    stop[SEARCH_STOP_FOOTPRINT_DIAGONAL] = Math.sqrt(dx * dx + dz * dz);
    this.updateSearchStop();
  }

  /** Writes the stop distance squared for the furthest kept tile, the top of the heap. */
  private updateSearchStop(): void {
    const stop = this.#searchStop;
    // fixed indices of an array of three, and a heap of at least one tile
    const heightSq = stop[SEARCH_STOP_HEIGHT_SQ]!;
    const furthestKept = this.#kept[0]!.distanceToCamera;
    const rho = Math.sqrt(Math.max(furthestKept * furthestKept - heightSq, 0)) + stop[SEARCH_STOP_FOOTPRINT_DIAGONAL]!;
    stop[SEARCH_STOP_DISTANCE_SQ] = heightSq + rho * rho;
  }

  /**
   * Whether the search stops before `next`, the nearest tile in the frontier, once
   * `maxVisibleTiles` tiles are kept: past the distance worked out for the furthest kept tile, the
   * top of the heap, in `beginSearchStop()` and `updateSearchStop()`, no tile in the frontier leads
   * to a visible tile nearer than that one.
   *
   * The center of a tile lies on the map plane, so its distance to the camera is
   * `√(h² + ρ²)` — `h` the height of the camera above the plane, `ρ` how far the center lies from
   * the point of the plane below the camera. Take a kept tile and a visible tile nearer than the
   * furthest kept one, and a point of each frustum box inside the frustum. The straight line
   * between the two points stays inside the frustum, which is convex, and inside the slab the
   * frustum boxes fill; each tile it passes over has the point above it inside its box, so it is
   * visible, and one after the other these tiles are neighbours. Along the line, `ρ` of the point
   * below it is at most the larger of its two ends, and a point of a frustum box lies at most half
   * the diagonal of its footprint away from the center of its tile. So `ρ` of every tile on the
   * way is at most `ρ` of the furthest kept tile plus the diagonal of a footprint, and the search,
   * which takes the tiles in the order of their distance, reaches each of them before it stops.
   *
   * The argument holds for every tile whose frustum box meets the frustum.
   * `Frustum#intersectsBox()` tests a box against the six planes one by one and also takes a box
   * that passes by an edge or a corner of the frustum without meeting it; such a tile, taken as
   * visible and nearer than the furthest kept one, can in rare cases be left out for a tile
   * further away.
   *
   * The height of the frustum boxes does not enter the margin, though it is why a margin is
   * needed at all: a tile whose box reaches into the frustum from below the lower edge of the
   * view can lie behind tiles a little further out than the furthest kept one. The argument needs
   * a map on the XZ plane — the plane this class works on — and a `frustumBoxScale` of at least 1
   * — its setter refuses less —, so that the boxes of neighbouring tiles leave no gap.
   *
   * A tile in and a boolean out: the distance it is held against lies in `#searchStop`, see the
   * note on doubles at the top of the module.
   */
  private searchCanStop(next: PooledTileBox): boolean {
    const distance = next.distanceToCamera;
    // both sides squared: both are at least 0, so the order stays, and no square root is taken.
    // A fixed index of an array of three
    return distance * distance > this.#searchStop[SEARCH_STOP_DISTANCE_SQ]!;
  }

  /** Builds the max-heap over the kept tiles, bottom-up. */
  private heapifyKept(): void {
    const heap = this.#kept;
    for (let i = (heap.length >> 1) - 1; i >= 0; --i) {
      // The index runs down from the last entry that has a child.
      this.siftDownKept(i, heap[i]!);
    }
  }

  /**
   * Puts `tile` at `start` of the max-heap of the kept tiles and lets it drop until neither child
   * lies further out. At `start` 0 it takes the place of the furthest kept tile. The heap is the
   * first `length` entries of the list — all of them, but for the heapsort in `sortKept()`.
   */
  private siftDownKept(start: number, tile: PooledTileBox, length = this.#kept.length): void {
    const heap = this.#kept;
    const distance = tile.distanceToCamera;
    let i = start;
    for (;;) {
      const left = 2 * i + 1;
      if (left >= length) break;
      const right = left + 1;
      // Both indices are checked against the length of the heap.
      let child = heap[left]!;
      let childIndex = left;
      if (right < length && heap[right]!.distanceToCamera > child.distanceToCamera) {
        child = heap[right]!;
        childIndex = right;
      }
      if (child.distanceToCamera <= distance) break;
      heap[i] = child;
      i = childIndex;
    }
    heap[i] = tile;
  }

  /**
   * Places a tile the search kept, and sorts it into `reuseTiles` or `createTiles`. Expects
   * {@link prepareTile} to have run on it.
   */
  private placeTile(tile: PooledTileBox, reuseTiles: IMap2DTileCoords[], createTiles: IMap2DTileCoords[]): void {
    const coords = tile.coords;

    this.setBox(tile.box, coords, false).translate(this.#tileBoxOffset);

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

  /**
   * Puts the eight neighbours of a tile into the frontier. The table answers one that was visited
   * already with its slot, and `enqueue()` passes it by.
   */
  private pushNeighbors(tile: TileBox): void {
    for (let i = 0; i < NEIGHBOR_DX_DY.length; ++i) {
      // The loop bound is `NEIGHBOR_DX_DY.length`.
      const [dx, dy] = NEIGHBOR_DX_DY[i]!;
      this.enqueue(this.acquireTileBox(tile.x + dx, tile.y + dy), false);
    }
  }

  private warnCapped(): void {
    if (this.#warnedCapped) return;
    this.#warnedCapped = true;
    const limit = this.#maxVisibleTiles;
    // eslint-disable-next-line no-console
    console.warn(
      `CameraBasedVisibility: the view reaches more than ${limit} tiles, so only the ${limit} nearest to the camera are kept. Raise maxVisibleTiles, or lower camera.far, if the tiles further out should be drawn. This warning is shown once per visibility.`,
    );
  }

  private convertToPlaneCoords2D(pointOnPlane3D: Vector3, target: Vector2) {
    _v.copy(pointOnPlane3D);
    _v.sub(this.planeOrigin).applyMatrix4(this.#matrixWorldInverse);

    target.set(_v.x, _v.z);
  }

  /**
   * The box of a tile, `depth` high, in the space its coordinates are in — with the margin of
   * `frustumBoxScale` for the box the frustum is tested against. A flag and not the scale itself,
   * and the corners field by field — see the note on doubles at the top of the module.
   */
  private setBox(target: Box3, {top, left, width, height}: TilesWithinCoords, forFrustum: boolean): Box3 {
    const scale = forFrustum ? this.#frustumBoxScale : 1;
    const sw = (width * scale - width) / 2;
    const sh = (height * scale - height) / 2;
    const ground = this.#depth * -0.5 * scale;
    const ceiling = this.#depth * 0.5 * scale;
    const {min, max} = target;
    min.x = left - sw;
    min.y = ground;
    min.z = top - sh;
    max.x = left + width + sw;
    max.y = ceiling;
    max.z = top + height + sh;
    return target;
  }
}
