import {AABB2} from './AABB2';
import {Map2dAreaTile} from './Map2dAreaTile';
import {Map2dLayer} from './Map2dLayer';

export interface IMap2dLayerTilesRenderer {
  beginRender(layer: Map2dLayer, viewArea: AABB2): void;

  addTile(tile: Map2dAreaTile): void;
  reuseTile(tile: Map2dAreaTile): void;
  removeTile(tile: Map2dAreaTile): void;

  endRender(): void;

  dispose(): void;
}
