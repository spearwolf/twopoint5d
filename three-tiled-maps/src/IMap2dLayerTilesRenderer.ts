import {Map2dAreaTile} from './Map2dAreaTile';
import {Map2dLayer} from './Map2dLayer';

export interface IMap2dLayerTilesRenderer {
  beginRender(layer: Map2dLayer): void;

  addTile(tile: Map2dAreaTile, layer: Map2dLayer): void;
  updateTile(tile: Map2dAreaTile, layer: Map2dLayer): void;
  removeTile(tile: Map2dAreaTile, layer: Map2dLayer): void;

  endRender(layer: Map2dLayer): void;

  dispose(): void;
}
