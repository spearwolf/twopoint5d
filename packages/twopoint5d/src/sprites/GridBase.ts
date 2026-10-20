import type {QuadBaseArgs, SpriteBase, SpriteBaseVO} from './SpriteBase.js';

export interface GridBaseOptions {
  /** The cells across, a whole number from 1 to 1024. */
  readonly columns: number;
  /** The cells down, a whole number from 1 to 1024. */
  readonly rows: number;
}

/**
 * A base of `columns × rows` cells: the quad of `QuadBase` cut into a grid, its grid lines evenly
 * spaced. `columns` and `rows` say which grid it is; `gridBase()` answers one base per pair.
 */
export interface GridBase extends SpriteBase<QuadBaseArgs> {
  readonly columns: number;
  readonly rows: number;
}

/** The base vertex object of a {@link GridBase} as its pool hands it out. */
export interface GridBaseVO extends SpriteBaseVO {
  getPosition(): ArrayLike<number>;
  getUv(): ArrayLike<number>;
  setPosition(position: ArrayLike<number>): void;
  setUv(uv: ArrayLike<number>): void;
  /** Lays the grid out over the quad `QuadBase.make()` lays out from the same arguments. */
  make(halfWidth?: number, halfHeight?: number, xOffset?: number, yOffset?: number): void;
}

// no GPU limit: it keeps a typo from building a base of a million vertices for every sprite
const MAX_CELLS = 1024;

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_CELLS;

function gridPrototype(columns: number, rows: number): object {
  return {
    make(this: GridBaseVO, halfWidth = 0.5, halfHeight = 0.5, xOffset = 0, yOffset = 0): void {
      // row by row from the top, left to right: vertex k = j · (columns + 1) + i lies on the column
      // line i and the row line j, at uv (i / columns, j / rows) — (0, 0) at the top left, y downwards
      const count = (columns + 1) * (rows + 1);
      const position = new Float32Array(count * 3);
      const uv = new Float32Array(count * 2);
      for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= columns; i++) {
          const k = j * (columns + 1) + i;
          position[k * 3] = -halfWidth + xOffset + (2 * halfWidth * i) / columns;
          position[k * 3 + 1] = halfHeight + yOffset - (2 * halfHeight * j) / rows;
          uv[k * 2] = i / columns;
          uv[k * 2 + 1] = j / rows;
        }
      }
      this.setPosition(position);
      this.setUv(uv);
    },
  };
}

// two triangles per cell with the winding and the diagonal of the quad: its [A, C, B] and [A, D, C]
// are [BL, TR, TL] and [BL, BR, TR]
function gridIndices(columns: number, rows: number): number[] {
  const indices: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const topLeft = j * (columns + 1) + i;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + columns + 1;
      const bottomRight = bottomLeft + 1;
      indices.push(bottomLeft, topRight, topLeft, bottomLeft, bottomRight, topRight);
    }
  }
  return indices;
}

// one base per grid: a feature recognizes its base by identity, and every geometry of a kind shares
// one descriptor
const grids = new Map<string, GridBase>();

/**
 * A base of `columns × rows` cells — `(columns + 1) × (rows + 1)` vertices, `columns · rows · 2`
 * triangles — laid out as `QuadBase` lays out its four: `position` on the XY plane, centred on the
 * pivot, and `uv` from `(0, 0)` at the top left to `(1, 1)` at the bottom right, from the same
 * `make(halfWidth, halfHeight, xOffset, yOffset)`. A stage that moves grid lines — a nine-slice — or
 * bends the sprite — a wave — needs it; every other sprite takes the quad.
 *
 * The uv of a vertex names its grid line exactly: `round(uv.x · columns)` is its column line,
 * `round(uv.y · rows)` its row line. Equal options answer the same frozen base.
 *
 * @throws a `TypeError` for options that are no object, and for a `columns` or `rows` that is no
 *   whole number from 1 to 1024
 */
export function gridBase(options: GridBaseOptions): GridBase {
  if (options == null || typeof options !== 'object') {
    throw new TypeError('gridBase: takes {columns, rows} — gridBase({columns: 3, rows: 3})');
  }
  const {columns, rows} = options;
  for (const [name, value] of [
    ['columns', columns],
    ['rows', rows],
  ] as const) {
    if (!isCount(value)) {
      throw new TypeError(
        `gridBase: ${name} is ${typeof value === 'string' ? JSON.stringify(value) : String(value)} — columns and rows are whole numbers from 1 to ${MAX_CELLS}`,
      );
    }
  }

  const key = `${columns}x${rows}`;
  let grid = grids.get(key);
  if (grid == null) {
    grid = Object.freeze({
      name: `grid ${key}`,
      columns,
      rows,
      description: {
        vertexCount: (columns + 1) * (rows + 1),
        indices: gridIndices(columns, rows),
        attributes: {
          position: {size: 3},
          uv: {size: 2},
        },
        basePrototype: gridPrototype(columns, rows),
      },
      defaultArgs: Object.freeze([0.5, 0.5] as const),
    });
    grids.set(key, grid);
  }
  return grid;
}
