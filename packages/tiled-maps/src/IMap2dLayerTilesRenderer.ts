import {Object3D} from 'three';

import {AABB2} from './AABB2';
import {Map2DAreaTile} from './Map2dAreaTile';
import {Map2DLayer} from './Map2dLayer';

export interface IMap2DLayerTilesRenderer {
  beginUpdate(layer: Map2DLayer, offsetX: number, offsetY: number, viewArea: AABB2): void;

  addTile(tile: Map2DAreaTile): void;
  reuseTile(tile: Map2DAreaTile): void;
  removeTile(tile: Map2DAreaTile): void;

  endUpdate(): void;

  getObject3D(): Object3D;

  dispose(): void;
}
