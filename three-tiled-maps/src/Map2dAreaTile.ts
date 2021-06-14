import {AABB2} from './AABB2';

export class Map2dAreaTile {
  static createID(x: number, y: number) {
    return `${y.toString(16)}_${x.toString(16)}`;
  }

  readonly id: string;

  readonly x: number;
  readonly y: number;

  view: AABB2;

  constructor(x: number, y: number, view?: AABB2) {
    this.id = Map2dAreaTile.createID(x, y);
    this.x = x;
    this.y = y;
    this.view = view ?? new AABB2();
  }
}
