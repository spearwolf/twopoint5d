import {IMap2dTileDataProvider} from './IMap2dTileDataProvider';

export type RepeatingTilesPatternType = number | number[] | number[][];
export type LimitToAxisType = 'horizontal' | 'vertical' | 'none';

/**
 * The `RepeatingTilesProvider` repeats a 2D pattern of tile IDs endlessly.
 * If you want you can limit the repeat to only horizontal or only vertical.
 */
export class RepeatingTilesProvider implements IMap2dTileDataProvider {
  limitToAxis: LimitToAxisType;

  #tileIds: number[][];

  #rows: number = 0;
  #cols: number = 0;

  get tileIds(): number[][] {
    return this.#tileIds;
  }

  set tileIds(tileIds: number[][]) {
    this.#tileIds = tileIds;
    this.#rows = tileIds.length;
    this.#cols = tileIds[0].length;
  }

  constructor(
    tileIds?: RepeatingTilesPatternType,
    limitToAxis: LimitToAxisType = 'none',
  ) {
    if (typeof tileIds === 'number') {
      this.tileIds = [[tileIds]];
    } else if (Array.isArray(tileIds)) {
      if (typeof tileIds[0] === 'number') {
        this.tileIds = [tileIds as number[]];
      } else if (
        Array.isArray(tileIds[0]) &&
        typeof tileIds[0][0] === 'number'
      ) {
        this.tileIds = tileIds as number[][];
      }
    }
    if (!this.tileIds) {
      this.tileIds = [[]];
    }
    this.limitToAxis = limitToAxis;
  }

  getTileIdsWithin(
    left: number,
    top: number,
    width: number,
    height: number,
    target?: Uint32Array,
  ): Uint32Array {
    target = target ?? new Uint32Array(width * height);

    const right = left + width - 1;
    const bottom = top + height - 1;

    switch (this.limitToAxis) {
      case 'vertical': {
        if (right < 0 || left >= this.#cols) {
          // === outside ===
          target.fill(0);
        } else {
          // === inside ===
          const leftOffset = -left;
          let tilesRowOffset =
            top < 0 ? top + Math.ceil(-top / this.#rows) * this.#rows : top;
          for (let y = 0; y < height; y++) {
            const tiles = this.tileIds[tilesRowOffset++ % this.#rows].slice(
              0,
              width - leftOffset,
            );
            const rowOffset = y * width;
            // left
            if (leftOffset > 0) {
              target.fill(0, rowOffset, rowOffset + leftOffset);
            }
            // pattern
            target.set(tiles, rowOffset + leftOffset);
            // right
            const lastCol = rowOffset + width;
            const tilesCount = tiles.length;
            target.fill(0, rowOffset + leftOffset + tilesCount, lastCol);
          }
        }
        break;
      }

      case 'horizontal':
        // outside
        if (bottom < 0 || top >= this.#rows) {
          target.fill(0);
        }
        break;
    }

    return target;
  }
}
