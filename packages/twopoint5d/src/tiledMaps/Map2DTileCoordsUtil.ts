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
 * The Map2DTileCoordsUtil does the mapping from _2D_ coordinates to _tile_ coordinates.
 *
 * The origin of the 2D coordinate system is assumed
 * to be in the upper left corner (with the y-axis pointing down).
 */
export class Map2DTileCoordsUtil {
  tileWidth: number;
  tileHeight: number;

  xOffset: number;
  yOffset: number;

  constructor(tileWidth = 1, tileHeight = 1, xOffset = 0, yOffset = 0) {
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.xOffset = xOffset;
    this.yOffset = yOffset;
  }

  #left = (tileLeft: number): number => tileLeft * this.tileWidth + this.xOffset;
  #top = (tileTop: number): number => tileTop * this.tileHeight + this.yOffset;

  #tileLeft = (left: number): number => {
    return Math.floor((left - this.xOffset) / this.tileWidth);
  };

  #tileColumns = (tileLeft: number, width: number): number => {
    return Math.ceil(tileLeft + width / this.tileWidth) - tileLeft;
  };

  #tileTop = (top: number): number => {
    return Math.floor((top - this.yOffset) / this.tileHeight);
  };

  #tileRows = (tileTop: number, height: number): number => {
    return Math.ceil(tileTop + height / this.tileHeight) - tileTop;
  };

  getTileCoords(
    left: number,
    top: number,
    width: number,
    height: number,
  ): [tileLeft: number, tileTop: number, columns: number, rows: number] {
    const tileLeft = this.#tileLeft(left);
    const w = width + left - this.#left(tileLeft);
    const tileTop = this.#tileTop(top);
    const h = height + top - this.#top(tileTop);
    return [tileLeft, tileTop, this.#tileColumns(tileLeft, w), this.#tileRows(tileTop, h)];
  }

  computeTilesWithinCoords(left: number, top: number, width: number, height: number): TilesWithinCoords {
    const [tileLeft, tileTop, tileColumns, tileRows] = this.getTileCoords(left, top, width, height);

    return {
      tileTop,
      tileLeft,
      top: this.#top(tileTop) - this.yOffset,
      left: this.#left(tileLeft) - this.xOffset,
      height: tileRows * this.tileHeight,
      width: tileColumns * this.tileWidth,
      tileHeight: this.tileHeight,
      tileWidth: this.tileWidth,
      rows: tileRows,
      columns: tileColumns,
    };
  }
}
