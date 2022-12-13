import {Matrix4} from 'three';
import {IMap2DTileRenderer} from './IMap2DTileRenderer';

export interface IMap2DLayer {
  addTileRenderer(renderer: IMap2DTileRenderer): void;
  removeTileRenderer(renderer: IMap2DTileRenderer): void;

  update(matrixWorld: Matrix4): void;
}
