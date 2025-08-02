import {AABB2} from './AABB2.js';
import type {IMap2DTileCoords} from './types.js';

export class Map2DTileCoords implements IMap2DTileCoords {
  static createID(x: number, y: number): string {
    return `y${y.toString(16)}${x < 0 ? '' : 'x'}${x.toString(16)}`;
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
