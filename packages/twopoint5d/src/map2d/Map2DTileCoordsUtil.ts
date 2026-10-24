import type {Vector2} from 'three/webgpu';
import {assertFinite} from '../utils/assertFinite.js';
import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {describeValue} from '../utils/describeValue.js';
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

// where `Map2DTileCoordsUtil` keeps its two offsets in its typed array
const X_OFFSET = 0;
const Y_OFFSET = 1;

/**
 * The Map2DTileCoordsUtil does the mapping from _2D_ coordinates to _tile_ coordinates.
 *
 * The origin of the 2D coordinate system is assumed to be in the upper left corner (with the
 * y-axis pointing down).
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

  // The offsets of the grid, at `X_OFFSET` and `Y_OFFSET`, in a typed array, which holds a double
  // as it is. A `#` field would box every double written to it: the emitted class declares the
  // field before the constructor assigns it, and that leaves V8 a tagged field.
  readonly #offsets = new Float64Array(2);

  /**
   * Where the tile grid starts on the x axis, in _world space_: a tile `(c, r)` covers
   * `[c · tileWidth + xOffset, (c + 1) · tileWidth + xOffset)` on X. The tile is anchored at that
   * corner, not centered on its coordinates, so the `xOffset` that centers the grid on the origin
   * is `-tileWidth / 2`.
   *
   * Takes a finite number; anything else throws a `RangeError` and leaves the offset as it was —
   * in the constructor as well.
   */
  get xOffset(): number {
    return this.#offsets[X_OFFSET]!;
  }

  set xOffset(offset: number) {
    assertFinite(offset, 'Map2DTileCoordsUtil', 'xOffset');
    this.#offsets[X_OFFSET] = offset;
  }

  /**
   * Where the tile grid starts on the y axis, in _world space_: a tile `(c, r)` covers
   * `[r · tileHeight + yOffset, (r + 1) · tileHeight + yOffset)` on Y — corner-anchored like
   * {@link xOffset}, not centered.
   *
   * Takes a finite number; anything else throws a `RangeError` and leaves the offset as it was —
   * in the constructor as well.
   */
  get yOffset(): number {
    return this.#offsets[Y_OFFSET]!;
  }

  set yOffset(offset: number) {
    assertFinite(offset, 'Map2DTileCoordsUtil', 'yOffset');
    this.#offsets[Y_OFFSET] = offset;
  }

  // the rectangle and the answer the public queries hand `computeTilesWithinArea()`, written
  // again on every call
  readonly #area = new AABB2();
  readonly #tilesWithin: TilesWithinCoords = createTilesWithinCoords();

  constructor(tileWidth = 1, tileHeight = 1, xOffset = 0, yOffset = 0) {
    // through the setters, so a grid of 0 or an offset that is no finite number is refused here as
    // much as it is later on
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.xOffset = xOffset;
    this.yOffset = yOffset;
  }

  // `copy()` and `equals()` read and write the private fields: `source` and `other` are instances
  // that checked their values, and `CameraBasedVisibility` copies the grid on every call, so no
  // getter runs on this way
  copy(source: Map2DTileCoordsUtil): Map2DTileCoordsUtil {
    this.#tileWidth = source.#tileWidth;
    this.#tileHeight = source.#tileHeight;
    this.#offsets[X_OFFSET] = source.#offsets[X_OFFSET]!;
    this.#offsets[Y_OFFSET] = source.#offsets[Y_OFFSET]!;
    return this;
  }

  clone(): Map2DTileCoordsUtil {
    return new Map2DTileCoordsUtil(this.#tileWidth, this.#tileHeight, this.#offsets[X_OFFSET]!, this.#offsets[Y_OFFSET]!);
  }

  equals(other: Map2DTileCoordsUtil): boolean {
    return (
      this.#tileWidth === other.#tileWidth &&
      this.#tileHeight === other.#tileHeight &&
      this.#offsets[X_OFFSET] === other.#offsets[X_OFFSET] &&
      this.#offsets[Y_OFFSET] === other.#offsets[Y_OFFSET]
    );
  }

  /**
   * Writes {@link xOffset} into `target.x` and {@link yOffset} into `target.y`, and returns
   * `target`.
   *
   * For the visibilities, which ask on every frame: a double a call the compiler does not inline
   * answers is boxed, one held in the field of an object is not.
   *
   * @internal
   */
  readOffset(target: Vector2): Vector2 {
    const offsets = this.#offsets;
    target.x = offsets[X_OFFSET]!;
    target.y = offsets[Y_OFFSET]!;
    return target;
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
   * @throws a RangeError for a left or a top that is no finite number and a width or a height that is
   * no finite number of 0 or more; target stays as it was
   */
  getTileCoords(
    left: number,
    top: number,
    width: number,
    height: number,
    target?: [tileLeft: number, tileTop: number, columns: number, rows: number],
  ): [tileLeft: number, tileTop: number, columns: number, rows: number] {
    // checked inline and not through `assertFinite()`: a double handed to a call the compiler does
    // not inline is boxed
    if (
      !(
        Number.isFinite(left) &&
        Number.isFinite(top) &&
        Number.isFinite(width) &&
        width >= 0 &&
        Number.isFinite(height) &&
        height >= 0
      )
    ) {
      Map2DTileCoordsUtil.#refuseSelection('getTileCoords', left, top, width, height);
    }
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
   * @throws a RangeError for a left or a top that is no finite number and a width or a height that is
   * no finite number of 0 or more; target stays as it was
   */
  computeTilesWithinCoords(
    left: number,
    top: number,
    width: number,
    height: number,
    target?: TilesWithinCoords,
  ): TilesWithinCoords {
    // checked inline and not through `assertFinite()`: a double handed to a call the compiler does
    // not inline is boxed
    if (
      !(
        Number.isFinite(left) &&
        Number.isFinite(top) &&
        Number.isFinite(width) &&
        width >= 0 &&
        Number.isFinite(height) &&
        height >= 0
      )
    ) {
      Map2DTileCoordsUtil.#refuseSelection('computeTilesWithinCoords', left, top, width, height);
    }
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
    const offsets = this.#offsets;
    const xOffset = offsets[X_OFFSET]!;
    const yOffset = offsets[Y_OFFSET]!;

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

  static #refuseSelection(where: string, left: number, top: number, width: number, height: number): never {
    const subject = `Map2DTileCoordsUtil#${where}()`;
    if (!Number.isFinite(left)) {
      throw new RangeError(`${subject}: left must be a finite number, got ${describeValue(left)}`);
    }
    if (!Number.isFinite(top)) {
      throw new RangeError(`${subject}: top must be a finite number, got ${describeValue(top)}`);
    }
    if (!(Number.isFinite(width) && width >= 0)) {
      throw new RangeError(`${subject}: width must be a finite number of 0 or more, got ${describeValue(width)}`);
    }
    throw new RangeError(`${subject}: height must be a finite number of 0 or more, got ${describeValue(height)}`);
  }
}
