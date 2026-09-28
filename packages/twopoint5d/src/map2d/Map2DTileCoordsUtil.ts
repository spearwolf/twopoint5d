import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {AABB2} from './AABB2.js';
import {createTilesWithinCoords} from './createTilesWithinCoords.js';

/**
 * A rectangular two-dimensional area consisting of one or more tiles
 */
export interface TilesWithinCoords {
  /**
   * the top edge of the area relative to the origin of the tile grid, `tileTop * tileHeight`,
   * without the `yOffset` of the grid
   */
  top: number;

  /**
   * the left edge of the area relative to the origin of the tile grid, `tileLeft * tileWidth`,
   * without the `xOffset` of the grid
   */
  left: number;

  /**
   * the height of the area in _world space_, `rows * tileHeight`
   */
  height: number;

  /**
   * the width of the area in _world space_, `columns * tileWidth`
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
   * the number of rows the area spans — tiles along the y-axis
   */
  rows: number;

  /**
   * the number of columns the area spans — tiles along the x-axis
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
  #tileWidth = 1;
  #tileHeight = 1;

  /**
   * The width of a tile in _world space_: a finite number above 0, because every mapping from
   * 2D coordinates to tile coordinates divides by it. Writing anything else throws a `RangeError`.
   */
  get tileWidth(): number {
    return this.#tileWidth;
  }

  set tileWidth(width: number) {
    assertPositiveFinite(width, 'Map2DTileCoordsUtil', 'tileWidth');
    this.#tileWidth = width;
  }

  /**
   * The height of a tile in _world space_: a finite number above 0, because every mapping from
   * 2D coordinates to tile coordinates divides by it. Writing anything else throws a `RangeError`.
   */
  get tileHeight(): number {
    return this.#tileHeight;
  }

  set tileHeight(height: number) {
    assertPositiveFinite(height, 'Map2DTileCoordsUtil', 'tileHeight');
    this.#tileHeight = height;
  }

  xOffset: number;
  yOffset: number;

  // the rectangle and the answer the public queries hand `computeTilesWithinArea()`, written
  // again on every call
  readonly #area = new AABB2();
  readonly #tilesWithin: TilesWithinCoords = createTilesWithinCoords();

  constructor(tileWidth = 1, tileHeight = 1, xOffset = 0, yOffset = 0) {
    // through the setters, so a grid of 0 is refused here as much as it is later on
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
   * The tiles a selection rectangle touches: the tile coordinate of its upper left corner and how
   * many columns and rows it spans.
   *
   * @param left - the left coordinate of the selection rectangle in _world space_
   * @param top - the top coordinate of the selection rectangle in _world space_
   * @param width - the width of the selection rectangle in _world space_
   * @param height - the height of the selection rectangle in _world space_
   * @param target - the tuple to write the answer into and to return, which allocates nothing;
   * without one, the answer is a new tuple
   */
  getTileCoords(
    left: number,
    top: number,
    width: number,
    height: number,
    target?: [tileLeft: number, tileTop: number, columns: number, rows: number],
  ): [tileLeft: number, tileTop: number, columns: number, rows: number] {
    const within = this.computeTilesWithinArea(this.#area.set(left, top, width, height), this.#tilesWithin);

    if (target === undefined) return [within.tileLeft, within.tileTop, within.columns, within.rows];

    target[0] = within.tileLeft;
    target[1] = within.tileTop;
    target[2] = within.columns;
    target[3] = within.rows;
    return target;
  }

  /**
   * The tiles a selection rectangle touches, as the area they cover together.
   *
   * @param left - the left coordinate of the selection rectangle in _world space_
   * @param top - the top coordinate of the selection rectangle in _world space_
   * @param width - the width of the selection rectangle in _world space_
   * @param height - the height of the selection rectangle in _world space_
   * @param target - the object to write every field of the answer into and to return, which
   * allocates nothing; without one, the answer is a new object
   */
  computeTilesWithinCoords(
    left: number,
    top: number,
    width: number,
    height: number,
    target?: TilesWithinCoords,
  ): TilesWithinCoords {
    return this.computeTilesWithinArea(this.#area.set(left, top, width, height), target ?? createTilesWithinCoords());
  }

  /**
   * {@link computeTilesWithinCoords} for a selection rectangle handed over as an object, in
   * _world space_, written into `target` and returned.
   *
   * For the visibilities, which ask on every frame: a double handed to a call the compiler does
   * not inline is boxed, one held in the field of an object is not. So everything the answer is
   * worked out from comes in through `area`, and nothing here calls out.
   *
   * @internal
   */
  computeTilesWithinArea(area: AABB2, target: TilesWithinCoords): TilesWithinCoords {
    const {left, top, width, height} = area;
    const tileWidth = this.#tileWidth;
    const tileHeight = this.#tileHeight;
    const {xOffset, yOffset} = this;

    const tileLeft = Math.floor((left - xOffset) / tileWidth);
    const tileTop = Math.floor((top - yOffset) / tileHeight);
    // where the grid places the first tile, and the rectangle measured from there
    const firstLeft = tileLeft * tileWidth + xOffset;
    const firstTop = tileTop * tileHeight + yOffset;
    const columns = Math.ceil(tileLeft + (width + left - firstLeft) / tileWidth) - tileLeft;
    const rows = Math.ceil(tileTop + (height + top - firstTop) / tileHeight) - tileTop;

    target.tileTop = tileTop;
    target.tileLeft = tileLeft;
    // the edge less the offset, which is not always the product alone
    target.top = firstTop - yOffset;
    target.left = firstLeft - xOffset;
    target.height = rows * tileHeight;
    target.width = columns * tileWidth;
    target.tileHeight = tileHeight;
    target.tileWidth = tileWidth;
    target.rows = rows;
    target.columns = columns;
    return target;
  }
}
