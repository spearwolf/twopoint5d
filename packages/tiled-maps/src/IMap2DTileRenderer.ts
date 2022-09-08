import {Object3D} from 'three';

import {AABB2} from './AABB2';
import {Map2DLayer} from './Map2DLayer';
import {Map2DTile} from './Map2DTile';

export interface IMap2DTileRenderer {
  beginUpdate(layer: Map2DLayer, offsetX: number, offsetY: number, viewArea: AABB2): void;

  addTile(tile: Map2DTile): void;
  reuseTile(tile: Map2DTile): void;
  removeTile(tile: Map2DTile): void;

  endUpdate(): void;

  getObject3D(): Object3D;

  dispose(): void;
}
