export interface TilesWithinCoords {
  top: number;
  left: number;
  height: number;
  width: number;
  tileTop: number;
  tileLeft: number;
  tileHeight: number;
  tileWidth: number;
  rows: number;
  columns: number;
}

/**
 * The Map2dTileCoordsUtil does the mapping from _2D_ coordinates to _tile_ coordinates.
 *
 * The origin of the 2D coordinate system is assumed
 * to be in the upper left corner (with the y-axis pointing down).
 */
export class Map2dTileCoordsUtil {
  tileWidth: number;
  tileHeight: number;

  xOffset: number;
  yOffset: number;

  constructor(tileWidth: number, tileHeight: number, xOffset = 0, yOffset = 0) {
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
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

  computeTilesWithinCoords(
    left: number,
    top: number,
    width: number,
    height: number,
  ): TilesWithinCoords {
    const [tileLeft, tileTop, tileColumns, tileRows] = this.getTileCoords(
      left,
      top,
      width,
      height,
    );

    const coords: TilesWithinCoords = {
      tileTop,
      tileLeft,
      top: tileTop * this.tileHeight + this.yOffset,
      left: tileLeft * this.tileWidth + this.xOffset,
      height: tileRows * this.tileHeight,
      width: tileColumns * this.tileWidth,
      tileHeight: this.tileHeight,
      tileWidth: this.tileWidth,
      rows: tileRows,
      columns: tileColumns,
    };

    return coords;
  }
}
