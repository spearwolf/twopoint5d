import {AABB2} from './AABB2.js';
import {tileKey} from './tileKeys.js';
import type {IMap2DTileCoords} from './types.js';

export class Map2DTileCoords implements IMap2DTileCoords {
  /**
   * The id of the tile at these coordinates: the shared tile key, so the id of a tile and the
   * bucket key of a `Map2DSpatialHashGrid` for the same coordinate are the same string.
   */
  static createID(x: number, y: number): string {
    return tileKey(x, y);
  }

  readonly id: string;

  readonly x: number;
  readonly y: number;

  view: AABB2;

  constructor(x: number, y: number, view?: AABB2) {
    this.id = Map2DTileCoords.createID(x, y);
    this.x = x;
    this.y = y;
    this.view = view ?? new AABB2();
  }
}
