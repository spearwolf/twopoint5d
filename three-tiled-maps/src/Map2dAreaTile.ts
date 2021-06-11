import {ViewRect} from './types';

export class Map2dAreaTile {
  static createID(x: number, y: number) {
    return `${y.toString(16)}_${x.toString(16)}`;
  }

  readonly id: string;

  readonly x: number;
  readonly y: number;

  view: ViewRect = {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  };

  constructor(x: number, y: number) {
    this.id = Map2dAreaTile.createID(x, y);
    this.x = x;
    this.y = y;
  }
}
