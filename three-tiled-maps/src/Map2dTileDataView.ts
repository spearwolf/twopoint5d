import {IMap2dTileDataProvider} from './IMap2dTileDataProvider';
import {RepeatingTilesProvider} from './RepeatingTilesProvider';

export interface TileIdArray {
  top: number;
  left: number;
  rows: number;
  columns: number;
  data: Uint32Array;
}

/**
 * The Map2dTileDataView provides a view into the tile data of a provider
 * and does the mapping from the 2D coordinates to the _tile_ coordinates.
 *
 * Just as is the case with the tile coordinates, the origin of the 2D coordinate system
 * is assumed to be in the upper left corner (with the y-axis pointing down).
 */
export class Map2dTileDataView {
  tileWidth: number;
  tileHeight: number;

  xOffset: number;
  yOffset: number;

  provider: IMap2dTileDataProvider;

  constructor(
    tileWidth: number,
    tileHeight: number,
    provider: IMap2dTileDataProvider = new RepeatingTilesProvider(),
    xOffset = 0,
    yOffset = 0,
  ) {
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.provider = provider;
    this.xOffset = xOffset;
    this.yOffset = yOffset;
  }

  getTileIdsWithin(
    _left: number,
    _top: number,
    _width: number,
    _height: number,
  ): TileIdArray {
    throw new Error('TODO Map2dTileDataView.getTileIdsWithin()');
  }
}
