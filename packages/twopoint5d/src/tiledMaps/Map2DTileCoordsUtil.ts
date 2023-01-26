/**
 * A rectangular two-dimensional area consisting of one or more tiles
 */
export interface TilesWithinCoords {
  /**
   * the top coordinate of the area in _world space_
   */
  top: number;

  /**
   * the left coordinate of the area in _world space_
   */
  left: number;

  /**
   * the height of the area in _world space_
   */
  height: number;

  /**
   * the width of the area in _world space_
   */
  width: number;

  /**
   * the top coordinate of the area in _tile space_
   */
  tileTop: number;

  /**
   * the left coordinate of the area in _tile space_
   */
  tileLeft: number;

  /**
   * the height of a tile in _world space_
   */
  tileHeight: number;

  /**
   * the width of a tile in _world space_
   */
  tileWidth: number;

  /**
   * the number of tiles in a row
   */
  rows: number;

  /**
   * the number of tiles in a column
   */
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

  constructor(tileWidth = 1, tileHeight = 1, xOffset = 0, yOffset = 0) {
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.xOffset = xOffset;
    this.yOffset = yOffset;
  }

  copy(source: Map2DTileCoordsUtil): Map2DTileCoordsUtil {
    this.tileWidth = source.tileWidth;
    this.tileHeight = source.tileHeight;
    this.xOffset = source.xOffset;
    this.yOffset = source.yOffset;
    return this;
  }

  clone(): Map2DTileCoordsUtil {
    return new Map2DTileCoordsUtil(this.tileWidth, this.tileHeight, this.xOffset, this.yOffset);
  }

  equals(other: Map2DTileCoordsUtil): boolean {
    return (
      this.tileWidth === other.tileWidth &&
      this.tileHeight === other.tileHeight &&
      this.xOffset === other.xOffset &&
      this.yOffset === other.yOffset
    );
  }

  /**
   * @param left - the left coordinate of the selection rectangle in _world space_
   * @param top - the top coordinate of the selection rectangle in _world space_
   * @param width - the width of the selection rectangle in _world space_
   * @param height - the height of the selection rectangle in _world space_
   */
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

  /**
   * @param left - the left coordinate of the selection rectangle in _world space_
   * @param top - the top coordinate of the selection rectangle in _world space_
   * @param width - the width of the selection rectangle in _world space_
   * @param height - the height of the selection rectangle in _world space_
   */
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
