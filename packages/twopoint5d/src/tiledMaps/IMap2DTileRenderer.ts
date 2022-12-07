import {Map2DTile} from './Map2DTile';

export interface IMap2DTileRenderer {
  beginUpdate(offsetX: number, offsetY: number): void;

  addTile(tile: Map2DTile): void;
  reuseTile(tile: Map2DTile): void;
  removeTile(tile: Map2DTile): void;

  endUpdate(): void;

  resetTiles(): void;

  dispose(): void;
}
