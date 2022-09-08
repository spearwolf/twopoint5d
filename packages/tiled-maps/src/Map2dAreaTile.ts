import {AABB2} from './AABB2';

/**
 * The `Map2dAreaTile` addresses a single tile in a tile grid.
 * Has `x` and `y` coordinates (as tile coordinates) and an `id`,
 * as well as an {@link AABB2} (as real world coordinates).
 * Used in {@link Map2DLayer} for identifying tiles.
 */
export class Map2DAreaTile {
  static createID(x: number, y: number): string {
    return `y${y.toString(16)}${x < 0 ? '' : 'x'}${x.toString(16)}`;
  }

  readonly id: string;

  readonly x: number;
  readonly y: number;

  view: AABB2;

  constructor(x: number, y: number, view?: AABB2) {
    this.id = Map2DAreaTile.createID(x, y);
    this.x = x;
    this.y = y;
    this.view = view ?? new AABB2();
  }
}
