import type {IMap2DTileDataProvider} from './types.js';

export type RepeatingTilesPatternType = number | number[] | number[][];
export type LimitToAxisType = 'horizontal' | 'vertical' | 'none';

// Lifts every integer index, a negative one too, into `[0, n)` — the pattern repeats from `(0, 0)`
// on in both directions.
const wrap = (i: number, n: number): number => ((i % n) + n) % n;

/**
 * The `RepeatingTilesProvider` repeats a 2D pattern of tile IDs endlessly.
 * If you want you can limit the repeat to only horizontal or only vertical.
 *
 * The tile IDs pattern always starts at (0,0)
 */
export class RepeatingTilesProvider implements IMap2DTileDataProvider {
  /**
   * The axis the pattern repeats along: `'horizontal'` repeats it along the x axis only (outside
   * its rows every id is `0`), `'vertical'` along the y axis only (outside its columns every id
   * is `0`), and `'none'` along both. Any other value, which JavaScript can assign, counts as
   * `'none'`.
   */
  limitToAxis: LimitToAxisType;

  // Every path of the constructor writes this through the `tileIds` setter. The `!` stays
  // because TypeScript does not count an assignment through a setter as a definite one.
  #tileIds!: number[][];

  // `#rows` and `#cols` are taken from the very array that is indexed below, in the `tileIds`
  // setter, which lets a pattern in only when every row of it has the length of the first one.
  // Every index into `#tileIds` therefore passes through `wrap()` or through a range check
  // against them first, and cannot point past the pattern.
  #rows = 0;
  #cols = 0;

  get tileIds(): number[][] {
    return this.#tileIds;
  }

  set tileIds(tileIds: number[][]) {
    // the whole pattern is checked before the first field is written: a refused pattern leaves
    // the provider with the one it had rather than half of a new one
    const rows = tileIds.length;
    if (rows === 0) {
      throw new Error('RepeatingTilesProvider: a tile id pattern needs at least one row');
    }
    const cols = tileIds[0]!.length;
    for (let row = 1; row < rows; row++) {
      if (tileIds[row]!.length !== cols) {
        throw new Error(
          `RepeatingTilesProvider: every row of a tile id pattern has the same length, but row ${row} has ${tileIds[row]!.length} instead of ${cols}`,
        );
      }
    }
    this.#tileIds = tileIds;
    this.#rows = rows;
    this.#cols = cols;
  }

  constructor(tileIds?: RepeatingTilesPatternType, limitToAxis: LimitToAxisType = 'none') {
    if (typeof tileIds === 'number') {
      this.tileIds = [[tileIds]];
    } else if (Array.isArray(tileIds) && typeof tileIds[0] === 'number') {
      this.tileIds = [tileIds as number[]];
    } else if (Array.isArray(tileIds) && Array.isArray(tileIds[0]) && typeof tileIds[0][0] === 'number') {
      this.tileIds = tileIds as number[][];
    } else {
      // anything else — no argument, an empty array, a shape of another kind — is a pattern
      // without cells, which every lookup answers with 0
      this.tileIds = [[]];
    }
    this.limitToAxis = limitToAxis;
  }

  getTileIdAt(col: number, row: number): number {
    // the guard `getTileIdsWithin()` opens with: a pattern without cells has no id to answer
    // with, and the `% 0` in `wrap()` would turn the index into NaN
    if (this.#cols === 0 || this.#rows === 0) return 0;

    switch (this.limitToAxis) {
      case 'vertical':
        if (col >= 0 && col < this.#cols) {
          return this.#tileIds[wrap(row, this.#rows)]![col]!;
        }
        break;
      case 'horizontal':
        if (row >= 0 && row < this.#rows) {
          return this.#tileIds[row]![wrap(col, this.#cols)]!;
        }
        break;
      case 'none':
      default:
        return this.#tileIds[wrap(row, this.#rows)]![wrap(col, this.#cols)]!;
    }
    return 0;
  }

  /**
   * Writes one row of `target`, the one that starts at `rowOffset`, `width` cells long: the
   * cells `from` up to (not including) `to` take the pattern row `patternRow`, the cell `x` the
   * pattern column `left + x` wrapped into the pattern; every other cell of the row is `0`.
   */
  #writeRow(
    target: Uint32Array,
    rowOffset: number,
    patternRow: number,
    left: number,
    width: number,
    from: number,
    to: number,
  ): void {
    const row = this.#tileIds[patternRow]!;
    target.fill(0, rowOffset, rowOffset + from);
    let col = wrap(left + from, this.#cols);
    for (let x = from; x < to; x++) {
      target[rowOffset + x] = row[col]!;
      if (++col === this.#cols) col = 0;
    }
    target.fill(0, rowOffset + to, rowOffset + width);
  }

  /**
   * The tile ids of the rectangle of `width` × `height` tiles whose upper left corner is
   * `(left, top)`, row by row: the id of the tile `(left + i, top + j)` is at index
   * `j * width + i`, the value that {@link getTileIdAt} gives for that tile.
   *
   * All four numbers are given in _tile space_ and are integers.
   *
   * @param target - takes the ids; its first `width * height` cells are overwritten, the cells
   *   behind them stay as they are. A shorter one throws a `RangeError`.
   * @returns `target`, or a new `Uint32Array` of `width * height` ids without one.
   */
  getTileIdsWithin(left: number, top: number, width: number, height: number, target?: Uint32Array): Uint32Array {
    if (target === undefined) {
      target = new Uint32Array(width * height);
    } else if (target.length < width * height) {
      throw new RangeError(
        `RepeatingTilesProvider: a target for ${width}x${height} tile ids needs ${width * height} cells, got ${target.length}`,
      );
    }

    if (this.#cols === 0 || this.#rows === 0) {
      target.fill(0, 0, width * height);
      return target;
    }

    switch (this.limitToAxis) {
      case 'vertical': {
        // the columns the rectangle shares with the pattern — left and right of them the
        // pattern does not repeat along this axis, and there is nothing but 0; a rectangle
        // beside the pattern has `from === to`, and every row of it is 0
        const from = Math.min(Math.max(-left, 0), width);
        const to = Math.max(Math.min(this.#cols - left, width), from);
        for (let y = 0; y < height; y++) {
          this.#writeRow(target, y * width, wrap(top + y, this.#rows), left, width, from, to);
        }
        break;
      }

      case 'horizontal':
        for (let y = 0; y < height; y++) {
          const patternRow = top + y;
          if (patternRow >= 0 && patternRow < this.#rows) {
            this.#writeRow(target, y * width, patternRow, left, width, 0, width);
          } else {
            target.fill(0, y * width, (y + 1) * width);
          }
        }
        break;

      // a value outside LimitToAxisType, which JavaScript can assign, repeats along both axes as in getTileIdAt()
      case 'none':
      default:
        for (let y = 0; y < height; y++) {
          this.#writeRow(target, y * width, wrap(top + y, this.#rows), left, width, 0, width);
        }
        break;
    }

    return target;
  }
}
