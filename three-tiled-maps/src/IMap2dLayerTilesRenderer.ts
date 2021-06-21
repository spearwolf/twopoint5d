import {AABB2} from './AABB2';
import {Map2dAreaTile} from './Map2dAreaTile';
import {Map2dLayer} from './Map2dLayer';

export interface IMap2dLayerTilesRenderer {
  beginUpdate(layer: Map2dLayer, offsetX: number, offsetY: number, viewArea: AABB2): void;

  addTile(tile: Map2dAreaTile): void;
  reuseTile(tile: Map2dAreaTile): void;
  removeTile(tile: Map2dAreaTile): void;

  endUpdate(): void;

  dispose(): void;
}
