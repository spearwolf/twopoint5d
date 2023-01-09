import {Object3D} from 'three';
import {IMap2DTileRenderer} from './IMap2DTileRenderer';

export interface IMap2DLayer {
  addTileRenderer(renderer: IMap2DTileRenderer): void;
  removeTileRenderer(renderer: IMap2DTileRenderer): void;

  update(parentNode: Object3D): void;
}
