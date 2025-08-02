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
  limitToAxis: LimitToAxisType;

  #tileIds: number[][];

  #rows = 0;
  #cols = 0;

  get tileIds(): number[][] {
    return this.#tileIds;
  }

  set tileIds(tileIds: number[][]) {
    this.#tileIds = tileIds;
    this.#rows = tileIds.length;
    this.#cols = tileIds[0].length;
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
    switch (this.limitToAxis) {
      case 'vertical':
        if (col >= 0 && col < this.#cols) {
          row = row < 0 ? row + Math.ceil(-row / this.#rows) * this.#rows : row;
          return this.#tileIds[row % this.#rows][col];
        }
        break;
      case 'horizontal':
        if (row >= 0 && row < this.#rows) {
          col = col < 0 ? col + Math.ceil(-col / this.#cols) * this.#cols : col;
          return this.#tileIds[row][col % this.#cols];
        }
        break;
      case 'none':
      default:
        col = col < 0 ? col + Math.ceil(-col / this.#cols) * this.#cols : col;
        row = row < 0 ? row + Math.ceil(-row / this.#rows) * this.#rows : row;
        return this.#tileIds[row % this.#rows][col % this.#cols];
    }
    return 0;
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
          const leftOffset = -left;
          let tilesRowOffset = top < 0 ? top + Math.ceil(-top / this.#rows) * this.#rows : top;
          for (let y = 0; y < height; y++) {
            const tiles = this.tileIds[tilesRowOffset++ % this.#rows].slice(0, width - leftOffset);
            const rowOffset = y * width;
            if (leftOffset > 0) {
              target.fill(0, rowOffset, rowOffset + leftOffset);
            }
            target.set(tiles, rowOffset + leftOffset);
            const lastCol = rowOffset + width;
            const tilesCount = tiles.length;
            target.fill(0, rowOffset + leftOffset + tilesCount, lastCol);
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
              if (this.#cols === 1) {
                target.fill(this.tileIds[patternRow][0], targetRowOffset, targetRowOffset + width);
              } else {
                let x = 0;
                let col = (left < 0 ? left + Math.ceil(-left / this.#cols) * this.#cols : left) % this.#cols;
                while (x < width) {
                  const tiles = this.tileIds[patternRow].slice(col, col + width - x);
                  target.set(tiles, targetRowOffset + x);
                  x += tiles.length;
                  col = (col + x) % this.#cols;
                }
              }
            } else {
              target.fill(0, targetRowOffset);
              break;
            }
          }
        }
        break;

      case 'none':
        if (this.#cols === 1 && this.#rows === 1) {
          target.fill(this.tileIds[0][0]);
        } else {
          const topOffset = top < 0 ? top + Math.ceil(-top / this.#rows) * this.#rows : top;
          for (let y = 0; y < height; y++) {
            const patternRow = (y + topOffset) % this.#rows;
            const targetRowOffset = y * width;
            if (this.#cols === 1) {
              target.fill(this.tileIds[patternRow][0], targetRowOffset, targetRowOffset + width);
            } else {
              let x = 0;
              let col = (left < 0 ? left + Math.ceil(-left / this.#cols) * this.#cols : left) % this.#cols;
              while (x < width) {
                const tiles = this.tileIds[patternRow].slice(col, col + width - x);
                target.set(tiles, targetRowOffset + x);
                x += tiles.length;
                col = (col + x) % this.#cols;
              }
            }
          }
        }
        break;
    }

    return target;
  }
}
