import {AABB2} from './AABB2.js';
import {tileKey} from './tileKeys.js';
import type {IMap2DTileCoords} from './types.js';

/**
 * A tile a visibilitor hands out: its coordinate on the grid, the key it is known by, and the
 * rectangle it covers. `RectangularVisibilityArea` and `CameraBasedVisibility` build one per tile
 * that comes into view and hand the same object out again while the tile stays.
 */
export class Map2DTileCoords implements IMap2DTileCoords {
  /**
   * The id of the tile at these coordinates: the shared tile key that `tileKey()` builds.
   */
  static createID(x: number, y: number): string {
    return tileKey(x, y);
  }

  /** The key of the tile, `tileKey(x, y)`. */
  readonly id: string;

  /** The column of the tile on the grid. */
  readonly x: number;
  /** The row of the tile on the grid. */
  readonly y: number;

  /**
   * The rectangle the tile covers, in the units of the map. The box handed to the constructor is
   * held, not copied; without one it is a box of 0 at `(0, 0)`.
   */
  view: AABB2;

  /** The tile at `(x, y)`, covering `view`. */
  constructor(x: number, y: number, view?: AABB2) {
    this.id = Map2DTileCoords.createID(x, y);
    this.x = x;
    this.y = y;
    this.view = view ?? new AABB2();
  }
}
