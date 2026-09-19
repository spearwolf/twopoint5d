import type {IMap2DTileDataProvider} from './types.js';

export type RepeatingTilesPatternType = number | number[] | number[][];
export type LimitToAxisType = 'horizontal' | 'vertical' | 'none';

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

  // Assigned in the constructor through the `tileIds` setter, which falls back to an empty pattern.
  #tileIds!: number[][];

  // `#rows` and `#cols` are taken from the very array that is indexed below, in the `tileIds`
  // setter, which lets a pattern in only when every row of it has the length of the first one.
  // Every index into `#tileIds` therefore passes through `% #rows` / `% #cols` or through a
  // range check against them first, and cannot point past the pattern.
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
    } else if (Array.isArray(tileIds)) {
      if (typeof tileIds[0] === 'number') {
        this.tileIds = [tileIds as number[]];
      } else if (Array.isArray(tileIds[0]) && typeof tileIds[0][0] === 'number') {
        this.tileIds = tileIds as number[][];
      }
    }
    if (!this.tileIds) {
      this.tileIds = [[]];
    }
    this.limitToAxis = limitToAxis;
  }

  getTileIdAt(col: number, row: number): number {
    // the guard `getTileIdsWithin()` opens with: a pattern without cells has no id to answer
    // with, and the `% 0` below would turn the index into NaN
    if (this.#cols === 0 || this.#rows === 0) return 0;

    switch (this.limitToAxis) {
      case 'vertical':
        if (col >= 0 && col < this.#cols) {
          row = row < 0 ? row + Math.ceil(-row / this.#rows) * this.#rows : row;
          return this.#tileIds[row % this.#rows]![col]!;
        }
        break;
      case 'horizontal':
        if (row >= 0 && row < this.#rows) {
          col = col < 0 ? col + Math.ceil(-col / this.#cols) * this.#cols : col;
          return this.#tileIds[row]![col % this.#cols]!;
        }
        break;
      case 'none':
      default:
        col = col < 0 ? col + Math.ceil(-col / this.#cols) * this.#cols : col;
        row = row < 0 ? row + Math.ceil(-row / this.#rows) * this.#rows : row;
        return this.#tileIds[row % this.#rows]![col % this.#cols]!;
    }
    return 0;
  }

  /**
   * Writes one row of `target` with the pattern row `patternRow`, repeated horizontally
   * from tile column `left` onwards.
   */
  #writePatternRow(target: Uint32Array, targetRowOffset: number, patternRow: number, left: number, width: number): void {
    const row = this.#tileIds[patternRow]!;

    if (this.#cols === 1) {
      target.fill(row[0]!, targetRowOffset, targetRowOffset + width);
      return;
    }

    let col = (left < 0 ? left + Math.ceil(-left / this.#cols) * this.#cols : left) % this.#cols;
    let x = 0;

    while (x < width) {
      const piece = row.slice(col, col + width - x);
      target.set(piece, targetRowOffset + x);
      x += piece.length;
      // the next piece picks up at the pattern column right after the one just written
      col = (col + piece.length) % this.#cols;
    }
  }

  /**
   * Please bear in mind that all coordinates are given in _tile space_
   * - therefore only integer numbers should be used here
   */
  getTileIdsWithin(left: number, top: number, width: number, height: number, target?: Uint32Array): Uint32Array {
    target = target ?? new Uint32Array(width * height);

    if (this.#cols === 0 || this.#rows === 0) {
      target.fill(0);
      return target;
    }

    const right = left + width - 1;
    const bottom = top + height - 1;

    switch (this.limitToAxis) {
      case 'vertical':
        if (right < 0 || left >= this.#cols) {
          // === outside ===
          target.fill(0);
        } else {
          // === inside ===
          // the columns the rectangle shares with the pattern — left and right of them the
          // pattern does not repeat along this axis, and there is nothing but 0
          const overlapStart = Math.max(left, 0);
          const overlapEnd = Math.min(right, this.#cols - 1);
          const targetStart = overlapStart - left;
          const targetEnd = targetStart + overlapEnd - overlapStart + 1;
          let patternRow = top < 0 ? top + Math.ceil(-top / this.#rows) * this.#rows : top;
          for (let y = 0; y < height; y++) {
            const row = this.#tileIds[patternRow++ % this.#rows]!;
            const rowOffset = y * width;
            target.fill(0, rowOffset, rowOffset + targetStart);
            target.set(row.slice(overlapStart, overlapEnd + 1), rowOffset + targetStart);
            target.fill(0, rowOffset + targetEnd, rowOffset + width);
          }
        }
        break;

      case 'horizontal':
        if (bottom < 0 || top >= this.#rows) {
          // === outside ===
          target.fill(0);
        } else {
          // === inside ===
          let skipPatternRows = 0;
          if (top < 0) {
            skipPatternRows = -top;
            target.fill(0, 0, skipPatternRows * width);
          }
          for (let y = skipPatternRows; y < height; y++) {
            const patternRow = y + top;
            const targetRowOffset = y * width;
            if (patternRow < this.#rows) {
              this.#writePatternRow(target, targetRowOffset, patternRow, left, width);
            } else {
              target.fill(0, targetRowOffset);
              break;
            }
          }
        }
        break;

      // a value outside LimitToAxisType, which JavaScript can assign, repeats along both axes as in getTileIdAt()
      case 'none':
      default:
        if (this.#cols === 1 && this.#rows === 1) {
          target.fill(this.tileIds[0]![0]!);
        } else {
          const topOffset = top < 0 ? top + Math.ceil(-top / this.#rows) * this.#rows : top;
          for (let y = 0; y < height; y++) {
            const patternRow = (y + topOffset) % this.#rows;
            const targetRowOffset = y * width;
            this.#writePatternRow(target, targetRowOffset, patternRow, left, width);
          }
        }
        break;
    }

    return target;
  }
}
