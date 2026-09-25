import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import type {AABB2} from './AABB2.js';
import type {IMap2DRenderableArea} from './types.js';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';
import {tileKey} from './tileKeys.js';

export type Map2DSpatialHashGridKeyType = string;

/**
 * A spatial index over a grid of tiles: every renderable lies in the cells its `aabb` reaches
 * into when it is added, in one cell at the very least.
 */
export class Map2DSpatialHashGrid<Renderable extends IMap2DRenderableArea> {
  /**
   * The bucket key of the tile at these coordinates: the shared tile key, the same string the
   * `id` of a `Map2DTileCoords` carries. A tile that comes out of a visibilitor looks itself up
   * in the grid without any conversion.
   */
  static getKey(x: number, y: number): Map2DSpatialHashGridKeyType {
    return tileKey(x, y);
  }

  #tiles: Map<Map2DSpatialHashGridKeyType, Set<Renderable>>;

  // The cells `add()` put a renderable into, so `remove()` finds them whatever the `aabb` of the
  // renderable says by then.
  readonly #cellKeys = new Map<Renderable, Map2DSpatialHashGridKeyType[]>();
  #tileCoordsUtil: Map2DTileCoordsUtil;

  constructor(tileWidth = 1, tileHeight = 1, xOffset = 0, yOffset = 0) {
    // checked here as well as in the util underneath, so the message names the class the caller
    // holds in its hands
    assertPositiveFinite(tileWidth, 'Map2DSpatialHashGrid', 'tileWidth');
    assertPositiveFinite(tileHeight, 'Map2DSpatialHashGrid', 'tileHeight');

    this.#tiles = new Map();
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

      const [tileLeft, tileTop, tileColumns, tileRows] = this.#cellsOf(renderable.aabb);
      const keys: Map2DSpatialHashGridKeyType[] = [];
      for (let y = 0; y < tileRows; y++) {
        for (let x = 0; x < tileColumns; x++) {
          const key = Map2DSpatialHashGrid.getKey(tileLeft + x, tileTop + y);
          let tileSet = this.#tiles.get(key);
          if (tileSet == null) {
            tileSet = new Set<Renderable>();
            this.#tiles.set(key, tileSet);
          }
          tileSet.add(renderable);
          keys.push(key);
        }
      }
      this.#cellKeys.set(renderable, keys);
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
    const keys = this.#cellKeys.get(renderable);
    if (keys == null) return;

    for (const key of keys) {
      const tileSet = this.#tiles.get(key);
      if (tileSet) {
        tileSet.delete(renderable);
        if (tileSet.size === 0) {
          this.#tiles.delete(key);
        }
      }
    }
    this.#cellKeys.delete(renderable);
  }

  // An aabb reaches into the cell its upper left corner lies in at the very least — also with a
  // width or height of 0 on a cell border, where the plain computation ends up with 0 columns
  // or rows.
  #cellsOf(aabb: AABB2): [tileLeft: number, tileTop: number, columns: number, rows: number] {
    const {left, top, width, height} = aabb;
    const [tileLeft, tileTop, columns, rows] = this.#tileCoordsUtil.getTileCoords(left, top, width, height);
    return [tileLeft, tileTop, Math.max(1, columns), Math.max(1, rows)];
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
    const [tileLeft, tileTop, tileColumns, tileRows] = this.#cellsOf(aabb);
    return out
      ? this.getTiles(tileLeft, tileTop, tileColumns, tileRows, out)
      : this.getTiles(tileLeft, tileTop, tileColumns, tileRows);
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
    const key = Map2DSpatialHashGrid.getKey(tileX, tileY);
    return this.#tiles.get(key);
  }
}
