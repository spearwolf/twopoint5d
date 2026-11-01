import type {Box3, Frustum, Matrix4, Plane, Vector3} from 'three/webgpu';
import type {TilesWithinCoords} from './Map2DTileCoordsUtil.js';
import {KeptTiles, NearestFirstHeap} from './tileDistanceHeaps.js';
import type {PooledTileBox, TileSlotPool} from './TileSlotPool.js';

// The nearest-first search of `CameraBasedVisibility`, on the path a frame loop runs. No double
// crosses a call here: what the search reads of a recomputation lies in the fields of objects the
// visibility writes in place, and its scalars in a typed array — see the note on doubles at the
// top of `CameraBasedVisibility.ts`.

// where the view of a search keeps its scalars, see `TileSearchView.scalars`
export const VIEW_DEPTH = 0;
export const VIEW_FRUSTUM_BOX_SCALE = 1;
export const VIEW_MAX_VISIBLE_TILES = 2;
export const VIEW_FRUSTUM_HEIGHT_MIN = 3;
export const VIEW_FRUSTUM_HEIGHT_MAX = 4;
/** The length of {@link TileSearchView.scalars}. */
export const VIEW_SCALARS = 5;

// where the search keeps what it compares against at the limit, see `#searchCanStop()`
const SEARCH_STOP_HEIGHT_SQ = 0;
const SEARCH_STOP_FOOTPRINT_DIAGONAL = 1;
const SEARCH_STOP_DISTANCE_SQ = 2;

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
 * What a search reads of the recomputation it runs in: objects `CameraBasedVisibility` builds
 * once, hands over once and writes in place before each search.
 */
export interface TileSearchView {
  /** The slots of the tiles; the search asks it for the neighbours of a tile. */
  readonly pool: TileSlotPool;
  /**
   * `matrixWorld` of the map node after the translation of the grid: takes a tile from where its
   * box is built into world space.
   */
  readonly tileWorldMatrix: Matrix4;
  /** The position of the camera in world space. */
  readonly cameraWorldPosition: Vector3;
  /** The map plane in world space. */
  readonly planeWorld: Plane;
  /** The view frustum of the camera in world space. */
  readonly cameraFrustum: Frustum;
  /**
   * `depth`, `frustumBoxScale` and `maxVisibleTiles` of the visibility, and the lowest and the
   * highest point of the view frustum along the normal of the map plane, in the local space of
   * the map node — what the frustum boxes are cut to —, at the `VIEW_…` indices. A typed array
   * holds a double as it is; a field would box every double written to it.
   */
  readonly scalars: Float64Array;
}

/**
 * The box of a tile, `depth` high, in the space its coordinates are in — with the margin of
 * `frustumBoxScale` for the box the frustum is tested against, that box cut to the height range
 * of the view frustum. A flag and not the scale itself, and the corners field by field — see the
 * note on doubles at the top of `CameraBasedVisibility.ts`.
 */
export const writeTileBox = (
  target: Box3,
  {top, left, width, height}: TilesWithinCoords,
  scalars: Float64Array,
  forFrustum: boolean,
): Box3 => {
  const scale = forFrustum ? scalars[VIEW_FRUSTUM_BOX_SCALE]! : 1;
  const sw = (width * scale - width) / 2;
  const sh = (height * scale - height) / 2;
  let ground = scalars[VIEW_DEPTH]! * -0.5 * scale;
  let ceiling = scalars[VIEW_DEPTH]! * 0.5 * scale;
  if (forFrustum) {
    // no point of the frustum lies beyond this height, so the part of the box beyond it meets
    // none — and a box higher than that passes the side planes of a tilted view far outside it.
    // The range never turns inside out: a box for the frustum is built only in a recomputation
    // in which a probe met the plane, and that point lies on a probe's line, so the lowest point
    // lies at 0 or below and the highest at 0 or above. Compared and not through
    // `Math.max()`/`Math.min()` — see the note on doubles at the top of `CameraBasedVisibility.ts`
    const lowest = scalars[VIEW_FRUSTUM_HEIGHT_MIN]!;
    const highest = scalars[VIEW_FRUSTUM_HEIGHT_MAX]!;
    if (ground < lowest) ground = lowest;
    if (ceiling > highest) ceiling = highest;
  }
  const {min, max} = target;
  min.x = left - sw;
  min.y = ground;
  min.z = top - sh;
  max.x = left + width + sw;
  max.y = ceiling;
  max.z = top + height + sh;
  return target;
};

/**
 * The nearest-first search of `CameraBasedVisibility`. From the tiles it is handed it takes the
 * nearest one of its frontier, tests the frustum box of that tile against the view frustum
 * unless the tile lies within the hull of the probe rays, keeps it when it is visible and puts
 * its eight neighbours into the frontier — until the frontier is empty or, once it keeps
 * `maxVisibleTiles` tiles, until no tile in the frontier can lead to a visible tile nearer than
 * the furthest kept one, see `#searchCanStop()`. One instance serves every recomputation of its
 * visibility and keeps the backing stores of its lists.
 */
export class NearestFirstTileSearch {
  readonly #pool: TileSlotPool;
  readonly #tileWorldMatrix: Matrix4;
  readonly #cameraWorldPosition: Vector3;
  readonly #planeWorld: Plane;
  readonly #cameraFrustum: Frustum;
  readonly #scalars: Float64Array;

  // The tiles found and not yet taken, nearest first, so the search runs from the camera outwards
  // and a cut at the limit leaves out the furthest — see `NearestFirstHeap`.
  readonly #frontier = new NearestFirstHeap<PooledTileBox>();

  /**
   * The visible tiles the search keeps, a heap with the furthest on top from `maxVisibleTiles` of
   * them on — see `KeptTiles`. After {@link run} the visibility sorts them, places them and
   * empties the list.
   */
  readonly kept = new KeptTiles<PooledTileBox>();

  // What `#searchCanStop()` compares against, at the `SEARCH_STOP_…` indices: the height of the
  // camera above the plane squared and the diagonal of the footprint of a frustum box — the same
  // for every tile of one recomputation, written once the search holds `maxVisibleTiles` tiles —
  // and the stop distance squared, written again each time another tile becomes the furthest kept
  // one. A typed array, for the reason `TileSearchView.scalars` is one.
  readonly #searchStop = new Float64Array(3);

  // the `serial` of the running recomputation, which marks a tile that entered the frontier in
  // it; a whole number, as `serial` is
  #stamp = 0;

  constructor(view: TileSearchView) {
    this.#pool = view.pool;
    this.#tileWorldMatrix = view.tileWorldMatrix;
    this.#cameraWorldPosition = view.cameraWorldPosition;
    this.#planeWorld = view.planeWorld;
    this.#cameraFrustum = view.cameraFrustum;
    this.#scalars = view.scalars;
  }

  /**
   * Starts the search of a recomputation whose `serial` is `stamp`, and empties the frontier —
   * what is left in it is what a cut at the limit did not take.
   */
  begin(stamp: number): void {
    this.#stamp = stamp;
    this.#frontier.clear();
  }

  /**
   * Puts a tile into the frontier, unless it has been there in this recomputation already. The
   * mark is set here, on the way in, so that a tile enters the frontier exactly once.
   */
  enqueue(tile: PooledTileBox, insideProbeHull: boolean): void {
    const stamp = this.#stamp;
    if (tile.visitedStamp === stamp) return;
    tile.visitedStamp = stamp;

    tile.insideProbeHull = insideProbeHull;
    this.#prepareTile(tile);
    this.#frontier.push(tile);
  }

  /**
   * Runs the search over what {@link enqueue} put into the frontier and leaves the visible tiles
   * in {@link kept}. Answers whether the limit cut a visible tile: one that went for a nearer one,
   * or one left in the frontier where the search stopped at the distance.
   */
  run(): boolean {
    // Nearest first. Once `maxVisibleTiles` tiles are kept, a visible tile nearer than the
    // furthest of them takes its place, and the search goes on as long as the frontier can still
    // lead to such a tile — see `#searchCanStop()`.
    const limit = this.#scalars[VIEW_MAX_VISIBLE_TILES]!;
    const kept = this.kept;
    let capped = false;
    while (this.#frontier.length > 0) {
      if (kept.length >= limit && this.#searchCanStop(this.#frontier.peek())) break;

      const tile = this.#frontier.pop();
      this.#updateFrustumBox(tile);
      if (!tile.insideProbeHull && !this.#cameraFrustum.intersectsBox(tile.frustumBox)) continue;

      if (kept.length < limit) {
        kept.add(tile);
        if (kept.length === limit) {
          kept.heapify();
          this.#beginSearchStop();
        }
      } else {
        // a visible tile goes: this one, or the furthest kept one it takes the place of
        capped = true;
        if (tile.distanceToCamera < kept.furthest.distanceToCamera) {
          kept.replaceFurthest(tile);
          this.#updateSearchStop();
        }
      }
      // expanded either way: a tile left out can still be the way to a nearer one
      this.#pushNeighbors(tile);
    }

    // A search that stopped at the distance leaves tiles in the frontier. The limit cut the view
    // only if one of them is visible — a rest that would fail the test does not count.
    if (!capped && kept.length >= limit) {
      while (this.#frontier.length > 0) {
        const tile = this.#frontier.pop();
        this.#updateFrustumBox(tile);
        if (tile.insideProbeHull || this.#cameraFrustum.intersectsBox(tile.frustumBox)) {
          capped = true;
          break;
        }
      }
    }
    return capped;
  }

  /**
   * The center of the tile in world space and its distance to the camera — what the frontier
   * orders by —, in the shape of this frame.
   */
  #prepareTile(tile: PooledTileBox): void {
    const coords = tile.coords;
    // field by field, and `distanceTo()` written out — see the note on doubles at the top of
    // `CameraBasedVisibility.ts`
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
   * too, whose box the visibility helpers draw. Expects `#prepareTile()` to have run on it.
   */
  #updateFrustumBox(tile: PooledTileBox): void {
    // the same box two transforms in a row give: the grid only translates the tile before
    // `matrixWorld` does, and a box that is moved stays exact
    writeTileBox(tile.frustumBox, tile.coords, this.#scalars, true).applyMatrix4(this.#tileWorldMatrix);
  }

  /**
   * Writes what stays the same for the rest of the recomputation once the search holds
   * `maxVisibleTiles` tiles — the height of the camera above the plane and the diagonal of the
   * footprint of a frustum box — and then the stop distance for the furthest kept tile. Expects the
   * kept tiles to be a heap.
   */
  #beginSearchStop(): void {
    const stop = this.#searchStop;
    // `planeWorld.distanceToPoint()` written out — see the note on doubles at the top of
    // `CameraBasedVisibility.ts`
    const {normal, constant} = this.#planeWorld;
    const camera = this.#cameraWorldPosition;
    const height = normal.x * camera.x + normal.y * camera.y + normal.z * camera.z + constant;
    stop[SEARCH_STOP_HEIGHT_SQ] = height * height;
    // The footprint of a frustum box on the map plane, in world space: the x and the z edge of the
    // box taken through the linear part of `#tileWorldMatrix`, which is that of `matrixWorld`.
    // Every tile of one recomputation has the same size; the search calls this once it holds
    // maxVisibleTiles tiles, at least one
    const e = this.#tileWorldMatrix.elements;
    const coords = this.kept.furthest.coords;
    const scale = this.#scalars[VIEW_FRUSTUM_BOX_SCALE]!;
    const edgeX = coords.width * scale;
    const edgeZ = coords.height * scale;
    const ax = e[0]! * edgeX;
    const ay = e[1]! * edgeX;
    const az = e[2]! * edgeX;
    const bx = e[8]! * edgeZ;
    const by = e[9]! * edgeZ;
    const bz = e[10]! * edgeZ;
    // the footprint is a parallelogram; its longer diagonal is the one to hold against. Compared
    // and not through `Math.max()` — see the note on doubles at the top of `CameraBasedVisibility.ts`
    const sx = ax + bx;
    const sy = ay + by;
    const sz = az + bz;
    const dx = ax - bx;
    const dy = ay - by;
    const dz = az - bz;
    const sumSq = sx * sx + sy * sy + sz * sz;
    const differenceSq = dx * dx + dy * dy + dz * dz;
    stop[SEARCH_STOP_FOOTPRINT_DIAGONAL] = Math.sqrt(Math.max(sumSq, differenceSq));
    this.#updateSearchStop();
  }

  /** Writes the stop distance squared for the furthest kept tile, the top of the heap. */
  #updateSearchStop(): void {
    const stop = this.#searchStop;
    // fixed indices of an array of three, and a heap of at least one tile
    const heightSq = stop[SEARCH_STOP_HEIGHT_SQ]!;
    const furthestKept = this.kept.furthest.distanceToCamera;
    const rho = Math.sqrt(Math.max(furthestKept * furthestKept - heightSq, 0)) + stop[SEARCH_STOP_FOOTPRINT_DIAGONAL]!;
    stop[SEARCH_STOP_DISTANCE_SQ] = heightSq + rho * rho;
  }

  /**
   * Whether the search stops before `next`, the nearest tile in the frontier, once
   * `maxVisibleTiles` tiles are kept: past the distance worked out for the furthest kept tile, the
   * top of the heap, in `#beginSearchStop()` and `#updateSearchStop()`, no tile in the frontier leads
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
   * visible and nearer than the furthest kept one, can be left out for a tile further away. How
   * many boxes pass that way grows with their height against the tile size — see `depth` of
   * `CameraBasedVisibility` —; the boxes reach no higher and no lower than the frustum.
   *
   * The height of the frustum boxes does not enter the margin, though it is why a margin is
   * needed at all: a tile whose box reaches into the frustum from below the lower edge of the
   * view can lie behind tiles a little further out than the furthest kept one. The footprint is
   * the parallelogram the x and the z edge of a frustum box span through the world matrix, and
   * its longer diagonal is the margin, however the map node is turned. The argument needs a
   * `frustumBoxScale` of at least 1 — its setter refuses less —, so that the boxes of
   * neighbouring tiles leave no gap.
   *
   * Besides the boxes `intersectsBox()` lets through past an edge, two cases lie outside the
   * argument:
   *
   * - On a map node turned by anything other than a quarter turn about an axis of the world, the
   *   box in world space — the axis-aligned box around the turned frustum box, which the frustum
   *   test reads — reaches beyond the turned box. A tile that is visible only through that can be
   *   left out for one further away.
   * - A world matrix with shear — a parent node scaled unevenly under a rotation — tips the local
   *   y axis out of the normal of the plane, and the margin leaves out that share of the height of
   *   a box.
   *
   * A tile in and a boolean out: the distance it is held against lies in `#searchStop`, see the
   * note on doubles at the top of `CameraBasedVisibility.ts`.
   */
  #searchCanStop(next: PooledTileBox): boolean {
    const distance = next.distanceToCamera;
    // both sides squared: both are at least 0, so the order stays, and no square root is taken.
    // A fixed index of an array of three
    return distance * distance > this.#searchStop[SEARCH_STOP_DISTANCE_SQ]!;
  }

  /**
   * Puts the eight neighbours of a tile into the frontier. The table answers one that was visited
   * already with its slot, and {@link enqueue} passes it by.
   */
  #pushNeighbors(tile: PooledTileBox): void {
    for (let i = 0; i < NEIGHBOR_DX_DY.length; ++i) {
      // The loop bound is `NEIGHBOR_DX_DY.length`. Read by index: a tuple destructured costs an
      // allocation wherever the compiler leaves the iteration in place
      const offset = NEIGHBOR_DX_DY[i]!;
      this.enqueue(this.#pool.acquire(tile.x + offset[0], tile.y + offset[1]), false);
    }
  }
}
