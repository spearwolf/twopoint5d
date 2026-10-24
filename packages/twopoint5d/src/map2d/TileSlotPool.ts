import {Box3, Vector3} from 'three/webgpu';
import {truncateArray} from '../utils/truncateArray.js';
import type {TileBox} from './CameraBasedVisibility.js';
import {createTilesWithinCoords} from './createTilesWithinCoords.js';
import type {Map2DTileCoordsUtil, TilesWithinCoords} from './Map2DTileCoordsUtil.js';
import {writePackedTileCoords} from './packedTileKey.js';
import {TileSlotTable, type TileSlotTableEntry} from './TileSlotTable.js';
import type {IMap2DTileCoords} from './types.js';

// The slots of `CameraBasedVisibility`, on the path a frame loop runs. No double crosses a call
// here: a tile coordinate is a small integer, and the edges of a tile are written into the fields
// of its slot — see the note on doubles at the top of `CameraBasedVisibility.ts`.

/**
 * The slot `CameraBasedVisibility` keeps for a tile — the public shape plus what the search
 * needs on the way. Every slot carries all of its fields from the start, see `createTileSlot()`.
 */
export interface PooledTileBox extends TileBox, TileSlotTableEntry<PooledTileBox> {
  packedKey: number;
  x: number;
  y: number;
  coords: TilesWithinCoords;
  box: Box3;
  frustumBox: Box3;
  centerWorld: Vector3;
  distanceToCamera: number;
  map2dTile: IMap2DTileCoords | undefined;
  primary: boolean;
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

/**
 * A slot with every field in place and in the same order, so that all slots share one hidden
 * class. A new slot carries the stamp 0, which no recomputation has.
 */
const createTileSlot = (): PooledTileBox => ({
  packedKey: 0,
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

/**
 * The slot of every tile the last recomputation of a `CameraBasedVisibility` put into its frontier
 * — the visible tiles and the ring of tested ones around them —, found by its tile coordinate. A
 * slot owns the TilesWithinCoords, Box3s and Vector3 it hands out, so that a recomputation writes
 * them in place. What a slot took part in is a stamp, the `serial` of the recomputation, written
 * on the slot itself — see {@link PooledTileBox} —: there is no set to clear and no map to fill
 * again.
 *
 * The pool holds the tiles of the last recomputation that found the map plane, and no others: a
 * frame in which the camera looks past the plane computes no tiles and leaves it as it stands. The
 * slots of tiles that left the view wait in a free list for the tiles that enter it.
 */
export class TileSlotPool {
  readonly #grid: Map2DTileCoordsUtil;
  readonly #table = new TileSlotTable<PooledTileBox>();
  // every slot of the table, so that the eviction walks them without an iterator
  readonly #slots: PooledTileBox[] = [];
  // The slots a recomputation evicted, for the tiles that enter the view in the next one. At most
  // as many as the table holds after the eviction: those tested around the visible tiles count
  // too, and that is how many slots the next recomputation of a similar view takes. When the view
  // shrinks, the rest goes to the GC.
  readonly #freeSlots: PooledTileBox[] = [];

  /**
   * @param grid - the grid the slots are written for, read for every slot written: the pool
   * follows a grid that is written in place
   */
  constructor(grid: Map2DTileCoordsUtil) {
    this.#grid = grid;
  }

  /** The slot of the tile `(x, y)`, or `undefined` if the pool holds none. */
  get(x: number, y: number): PooledTileBox | undefined {
    return this.#table.get(x, y);
  }

  /**
   * The slot of the tile `(x, y)`: the one the pool holds, or else a free slot — a new one only
   * when there is none — written for the tile. Its stamps stay as they are; they are held against
   * the `serial` of the running recomputation, and a slot out of the free list carries an older
   * one.
   */
  acquire(x: number, y: number): PooledTileBox {
    const found = this.#table.get(x, y);
    if (found !== undefined) return found;

    const slot = this.#freeSlots.pop() ?? createTileSlot();
    writePackedTileCoords(slot, x, y);
    slot.x = x;
    slot.y = y;
    this.#writeTileCoords(slot);
    slot.map2dTile = undefined;
    this.#table.add(slot);
    this.#slots.push(slot);
    return slot;
  }

  /**
   * Writes `coords` of every slot again for the grid as it stands, and lets go of the shell of
   * each: the caller still holds that shell as a tile of the grid before and gets it back in
   * `removeTiles`, so the recomputation builds a fresh one instead of writing under the caller's
   * feet.
   */
  rewriteForGrid(): void {
    const slots = this.#slots;
    for (let i = 0; i < slots.length; ++i) {
      // The loop bound is `slots.length`.
      const slot = slots[i]!;
      this.#writeTileCoords(slot);
      slot.map2dTile = undefined;
    }
  }

  /**
   * Hands every slot whose `visitedStamp` is not `stamp` to the free list. Such a slot keeps a
   * Box3, a Vector3 and a TilesWithinCoords for a tile the camera has left behind; the next tile
   * that enters the view writes them again instead of building its own.
   *
   * The slots are walked from the back, so that `pop()` hands the evicted ones out in the order
   * their tiles were taken: the tiles that enter the view first — the seeds and the nearest — get
   * the slots of the tiles that were nearest, and the tiles tested around the view get the slots
   * of the ring before.
   */
  evict(stamp: number): void {
    const slots = this.#slots;
    let firstStaying = slots.length;
    for (let i = slots.length - 1; i >= 0; --i) {
      // The index runs down from the last entry, and `firstStaying` never drops below `i`.
      const slot = slots[i]!;
      if (slot.visitedStamp === stamp) {
        slots[--firstStaying] = slot;
        continue;
      }
      this.#table.remove(slot);
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
   * Writes `coords` of a slot for its tile on the grid: the tile itself, one column and one row,
   * taken from the tile coordinate. A query rectangle would meet a neighbouring tile wherever the
   * grid is finer than the rectangle or an edge comes out a rounding step off in floating point.
   */
  #writeTileCoords(slot: PooledTileBox): void {
    const grid = this.#grid;
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
}
