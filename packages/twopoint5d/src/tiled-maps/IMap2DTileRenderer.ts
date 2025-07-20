import type {Vector2, Vector3} from 'three/webgpu';
import type {Map2DTile} from './Map2DTile.js';

export interface IMap2DTileRenderer {
  beginUpdate(offset: Vector2, translate: Vector3): void;

  addTile(tile: Map2DTile): void;
  reuseTile(tile: Map2DTile): void;
  removeTile(tile: Map2DTile): void;

  endUpdate(): void;

  resetTiles(): void;

  dispose(): void;
}
