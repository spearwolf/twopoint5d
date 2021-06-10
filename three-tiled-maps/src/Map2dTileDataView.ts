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

  #tileLeft = (left: number) => {
    return Math.floor((left - this.xOffset) / this.tileWidth);
  };

  #tileColumns = (tileLeft: number, width: number) => {
    return Math.ceil(tileLeft + width / this.tileWidth) - tileLeft;
  };

  #tileTop = (top: number) => {
    return Math.floor((top - this.yOffset) / this.tileHeight);
  };

  #tileRows = (tileTop: number, height: number) => {
    return Math.ceil(tileTop + height / this.tileHeight) - tileTop;
  };

  getTileCoords(left: number, top: number, width: number, height: number) {
    const tileLeft = this.#tileLeft(left);
    const tileTop = this.#tileTop(top);
    return [
      tileLeft,
      tileTop,
      this.#tileColumns(tileLeft, width),
      this.#tileRows(tileTop, height),
    ];
  }

  getTileIdsWithin(
    left: number,
    top: number,
    width: number,
    height: number,
  ): TileIdArray {
    const [tileLeft, tileTop, tileColumns, tileRows] = this.getTileCoords(
      left,
      top,
      width,
      height,
    );

    const tileIds: TileIdArray = {
      top: tileTop * this.tileHeight,
      left: tileLeft * this.tileWidth,
      rows: tileRows,
      columns: tileColumns,
      data: new Uint32Array(tileRows * tileColumns),
    };

    this.provider.getTileIdsWithin(
      tileLeft,
      tileTop,
      tileColumns,
      tileRows,
      tileIds.data,
    );

    return tileIds;
  }
}
