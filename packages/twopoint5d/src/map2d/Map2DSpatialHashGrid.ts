import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
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
  readonly #cellsOfRenderable = new Map<Renderable, GridCell<Renderable>[]>();
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
   */
  add(...renderables: Array<Renderable>): Map2DSpatialHashGrid<Renderable> {
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
      this.#cellsOfRenderable.set(renderable, cells);
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
    const cells = this.#cellsOfRenderable.get(renderable);
    if (cells == null) return;

    for (const cell of cells) {
      cell.renderables.delete(renderable);
      if (cell.renderables.size === 0) {
        this.#cells.remove(cell);
      }
    }
    this.#cellsOfRenderable.delete(renderable);
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
   * With `out` that set is emptied, filled and handed back — empty rather than `undefined` when
   * nothing lies within — so a caller that asks every frame keeps one set.
   */
  findWithin(aabb: AABB2): Set<Renderable> | undefined;
  findWithin(aabb: AABB2, out: Set<Renderable>): Set<Renderable>;
  findWithin(aabb: AABB2, out?: Set<Renderable>): Set<Renderable> | undefined {
    const {tileLeft, tileTop, columns, rows} = this.#cellsOf(aabb);
    return out ? this.getTiles(tileLeft, tileTop, columns, rows, out) : this.getTiles(tileLeft, tileTop, columns, rows);
  }

  /**
   * The renderables in the `width` × `height` cells from `(tileX, tileY)` on. Without `out` the
   * answer is a new set, or `undefined` when nothing lies in those cells.
   *
   * With `out` that set is emptied, filled and handed back — empty rather than `undefined` when
   * nothing lies within.
   */
  getTiles(tileX: number, tileY: number, width?: number, height?: number): Set<Renderable> | undefined;
  getTiles(tileX: number, tileY: number, width: number, height: number, out: Set<Renderable>): Set<Renderable>;
  getTiles(tileX: number, tileY: number, width = 1, height = 1, out?: Set<Renderable>): Set<Renderable> | undefined {
    out?.clear();
    let renderables: Set<Renderable> | undefined = out;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tileSet = this.getTile(tileX + x, tileY + y);
        if (tileSet) {
          renderables ??= new Set();
          for (const renderable of tileSet) {
            renderables.add(renderable);
          }
        }
      }
    }
    return renderables;
  }

  getTile(tileX: number, tileY: number): Set<Renderable> | undefined {
    return this.#cells.get(tileX, tileY)?.renderables;
  }
}
