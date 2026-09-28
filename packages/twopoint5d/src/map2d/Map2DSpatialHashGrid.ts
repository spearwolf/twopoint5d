import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {describeValue} from '../utils/describeValue.js';
import {undefinedValueError} from '../utils/expectDefined.js';
import {truncateArray} from '../utils/truncateArray.js';
import type {AABB2} from './AABB2.js';
import {createTilesWithinCoords} from './createTilesWithinCoords.js';
import type {IMap2DRenderableArea} from './types.js';
import {Map2DTileCoordsUtil, type TilesWithinCoords} from './Map2DTileCoordsUtil.js';
import {tileKey} from './tileKeys.js';
import {TileSlotTable, type TileSlotTableEntry} from './TileSlotTable.js';

/**
 * @deprecated The return type of the deprecated {@link Map2DSpatialHashGrid.getKey}; `tileKey()`
 * answers a `string`.
 */
export type Map2DSpatialHashGridKeyType = string;

// A cell of the grid: its tile coordinate and the renderables in it; `nextInBucket` belongs to the
// table that finds the cell
interface GridCell<Renderable> extends TileSlotTableEntry<GridCell<Renderable>> {
  readonly renderables: Set<Renderable>;
}

// Where `add()` put a renderable, and the last query that handed it out — so that a query hands a
// renderable of several cells out once, without a set to fill
interface Placement<Renderable> {
  readonly cells: GridCell<Renderable>[];
  queryStamp: number;
}

// An aabb that is not finite has no cells to lie in: an infinite extent runs the loop over its
// cells without end, and NaN computes no cell at all.
function assertFiniteAABB(aabb: AABB2, what: string): void {
  const {left, top, width, height} = aabb;
  if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(width) && Number.isFinite(height)) return;
  throw new RangeError(
    `[Map2DSpatialHashGrid] ${what} must have a finite left, top, width and height, got left ${describeValue(left)}, top ${describeValue(top)}, width ${describeValue(width)}, height ${describeValue(height)}`,
  );
}

/**
 * A spatial index over a grid of tiles: every renderable lies in the cells its `aabb` reaches
 * into when it is added, in one cell at the very least.
 */
export class Map2DSpatialHashGrid<Renderable extends IMap2DRenderableArea> {
  /**
   * The textual key of the tile at these coordinates, the string `tileKey()` builds and the
   * `id` of a `Map2DTileCoords` carries. The grid finds its cells by coordinate and takes no key.
   *
   * @deprecated Use `tileKey()`.
   */
  static getKey(x: number, y: number): Map2DSpatialHashGridKeyType {
    return tileKey(x, y);
  }

  readonly #cells = new TileSlotTable<GridCell<Renderable>>();

  // The cells `add()` put a renderable into, so `remove()` finds them whatever the `aabb` of the
  // renderable says by then.
  readonly #placements = new Map<Renderable, Placement<Renderable>>();

  // counts the queries with an `out` array; 2^53 queries before it runs out of whole numbers
  #queryStamp = 0;

  #tileCoordsUtil: Map2DTileCoordsUtil;

  // what `#cellsOf()` answers, written again on every call
  readonly #within: TilesWithinCoords = createTilesWithinCoords();

  constructor(tileWidth = 1, tileHeight = 1, xOffset = 0, yOffset = 0) {
    // checked here as well as in the util underneath, so the message names the class the caller
    // holds in its hands
    assertPositiveFinite(tileWidth, 'Map2DSpatialHashGrid', 'tileWidth');
    assertPositiveFinite(tileHeight, 'Map2DSpatialHashGrid', 'tileHeight');

    this.#tileCoordsUtil = new Map2DTileCoordsUtil(tileWidth, tileHeight, xOffset, yOffset);
  }

  /**
   * Puts the renderables into the cells their `aabb` reaches into right now — at least the cell
   * the upper left corner lies in.
   *
   * The grid remembers those cells. Changing an `aabb` afterwards leaves the renderable where it
   * lies, until it is added again (it then moves to the cells of its current `aabb`) or removed.
   *
   * Throws a `RangeError` for an `aabb` whose left, top, width or height is not a finite number,
   * and then adds none of the renderables.
   */
  add(...renderables: Array<Renderable>): Map2DSpatialHashGrid<Renderable> {
    // every aabb is checked before the first renderable moves, so that an add() that throws leaves
    // the grid as it was — a renderable the grid holds stays in its cells as well
    for (const renderable of renderables) {
      assertFiniteAABB(renderable.aabb, 'the aabb of a renderable');
    }
    for (const renderable of renderables) {
      this.#takeOut(renderable);

      const {tileLeft, tileTop, columns, rows} = this.#cellsOf(renderable.aabb);
      const cells: GridCell<Renderable>[] = [];
      for (let y = tileTop; y < tileTop + rows; y++) {
        for (let x = tileLeft; x < tileLeft + columns; x++) {
          let cell = this.#cells.get(x, y);
          if (cell === undefined) {
            cell = {x, y, nextInBucket: undefined, renderables: new Set()};
            this.#cells.add(cell);
          }
          cell.renderables.add(renderable);
          cells.push(cell);
        }
      }
      this.#placements.set(renderable, {cells, queryStamp: 0});
    }
    return this;
  }

  /**
   * Takes the renderables out of the cells {@link add} put them into, whatever their `aabb` says
   * by now. A renderable the grid does not hold is passed over.
   */
  remove(...renderables: Array<Renderable>): Map2DSpatialHashGrid<Renderable> {
    for (const renderable of renderables) {
      this.#takeOut(renderable);
    }
    return this;
  }

  #takeOut(renderable: Renderable): void {
    const placement = this.#placements.get(renderable);
    if (placement == null) return;

    for (const cell of placement.cells) {
      cell.renderables.delete(renderable);
      if (cell.renderables.size === 0) {
        this.#cells.remove(cell);
      }
    }
    this.#placements.delete(renderable);
  }

  // An aabb reaches into the cell its upper left corner lies in at the very least — also with a
  // width or height of 0 on a cell border, where the plain computation ends up with 0 columns
  // or rows.
  #cellsOf(aabb: AABB2): TilesWithinCoords {
    const within = this.#tileCoordsUtil.computeTilesWithinArea(aabb, this.#within);
    within.columns = Math.max(1, within.columns);
    within.rows = Math.max(1, within.rows);
    return within;
  }

  /**
   * The renderables in the cells `aabb` reaches into — the cell its upper left corner lies in at
   * the very least, also with a width or height of 0. Without `out` the answer is a new set, or
   * `undefined` when nothing lies in those cells.
   *
   * With `out` that array is emptied, filled with every renderable within once and handed back —
   * empty rather than `undefined` when nothing lies within —, so a caller that asks every frame
   * keeps one array and the query allocates nothing. The order of the renderables is not defined.
   *
   * Throws a `RangeError` for an `aabb` whose left, top, width or height is not a finite number.
   */
  findWithin(aabb: AABB2): Set<Renderable> | undefined;
  findWithin(aabb: AABB2, out: Renderable[]): Renderable[];
  findWithin(aabb: AABB2, out?: Renderable[]): Set<Renderable> | Renderable[] | undefined {
    assertFiniteAABB(aabb, 'the aabb of findWithin()');
    const within = this.#cellsOf(aabb);
    return out ? this.#collect(within, out) : this.#gather(within);
  }

  /**
   * The renderables in the `width` × `height` cells from `(tileX, tileY)` on. Without `out` the
   * answer is a new set, or `undefined` when nothing lies in those cells.
   *
   * With `out` that array is emptied, filled with every renderable within once and handed back —
   * empty rather than `undefined` when nothing lies within —, so a caller that asks every frame
   * keeps one array and the query allocates nothing. The order of the renderables is not defined.
   *
   * Throws a `RangeError` for a `width` or `height` that is not a finite number.
   */
  getTiles(tileX: number, tileY: number, width?: number, height?: number): Set<Renderable> | undefined;
  getTiles(tileX: number, tileY: number, width: number, height: number, out: Renderable[]): Renderable[];
  getTiles(tileX: number, tileY: number, width = 1, height = 1, out?: Renderable[]): Set<Renderable> | Renderable[] | undefined {
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      throw new RangeError(
        `[Map2DSpatialHashGrid] the width and height of getTiles() must be finite numbers, got width ${describeValue(width)}, height ${describeValue(height)}`,
      );
    }
    const within = this.#within;
    within.tileLeft = tileX;
    within.tileTop = tileY;
    within.columns = width;
    within.rows = height;
    return out ? this.#collect(within, out) : this.#gather(within);
  }

  getTile(tileX: number, tileY: number): Set<Renderable> | undefined {
    return this.#cells.get(tileX, tileY)?.renderables;
  }

  // The range is read from an object rather than handed over as four numbers: a fractional number
  // that goes as an argument into a call V8 does not inline is boxed on the heap.
  #collect(range: TilesWithinCoords, out: Renderable[]): Renderable[] {
    truncateArray(out);
    const stamp = ++this.#queryStamp;
    const {tileLeft, tileTop, columns, rows} = range;
    for (let y = tileTop; y < tileTop + rows; y++) {
      for (let x = tileLeft; x < tileLeft + columns; x++) {
        const cell = this.#cells.get(x, y);
        if (cell === undefined) continue;
        for (const renderable of cell.renderables) {
          const placement = this.#placements.get(renderable);
          if (placement === undefined) throw undefinedValueError('the placement of a renderable in the grid');
          if (placement.queryStamp !== stamp) {
            placement.queryStamp = stamp;
            out.push(renderable);
          }
        }
      }
    }
    return out;
  }

  #gather(range: TilesWithinCoords): Set<Renderable> | undefined {
    let renderables: Set<Renderable> | undefined;
    const {tileLeft, tileTop, columns, rows} = range;
    for (let y = tileTop; y < tileTop + rows; y++) {
      for (let x = tileLeft; x < tileLeft + columns; x++) {
        const cell = this.#cells.get(x, y);
        if (cell === undefined) continue;
        renderables ??= new Set();
        for (const renderable of cell.renderables) {
          renderables.add(renderable);
        }
      }
    }
    return renderables;
  }
}
