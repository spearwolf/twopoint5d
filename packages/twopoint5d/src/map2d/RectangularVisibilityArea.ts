import type {Matrix4} from 'three/webgpu';
import {Vector2, Vector3} from 'three/webgpu';
import {Dependencies, type DependencyValues} from '../utils/Dependencies.js';
import {describeValue} from '../utils/describeValue.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import {truncateArray} from '../utils/truncateArray.js';
import {AABB2} from './AABB2.js';
import {createTilesWithinCoords} from './createTilesWithinCoords.js';
import {Map2DTileCoords} from './Map2DTileCoords.js';
import type {Map2DTileCoordsUtil, TilesWithinCoords} from './Map2DTileCoordsUtil.js';
import type {IMap2DTileCoords, IMap2DVisibilitor, IMap2DVisibleTiles} from './types.js';

// 0 is the off switch of an area, so it is as valid as a finite number above 0
function assertAreaSize(value: number, name: 'width' | 'height'): void {
  if (value !== 0 && !isPositiveFinite(value)) {
    throw new RangeError(`RectangularVisibilityArea: ${name} must be 0 or a finite number above 0, got ${describeValue(value)}`);
  }
}

/** The objects the dependency gate of {@link RectangularVisibilityArea} compares. */
interface AreaDependencies {
  map2dTileCoords: Map2DTileCoordsUtil;
  matrixWorld: Matrix4;
}

export class RectangularVisibilityArea implements IMap2DVisibilitor {
  #width = 0;
  #height = 0;
  #maxVisibleTiles = 10_000;

  /**
   * Forces the next {@link computeVisibleTiles} to compute a fresh tile set instead of handing
   * back the previous one. The `width`, `height` and `maxVisibleTiles` setters raise it, a call
   * the limit refuses leaves it raised, and anyone who changed something this area cannot see may
   * raise it too. `computeVisibleTiles()` puts it back to `false` as it recomputes, so one `true`
   * buys exactly one recomputation.
   */
  needsUpdate = true;

  #tileCreated?: Uint8Array;

  // The objects the gate compares. The center is held against `#seenCenter` instead: a double
  // read through the generic lookup of `Dependencies` is boxed on every call.
  readonly #deps = new Dependencies<AreaDependencies>([
    Dependencies.cloneable<Map2DTileCoordsUtil>('map2dTileCoords'),
    Dependencies.cloneable<Matrix4>('matrixWorld'),
  ]);

  // what `#deps` is asked about, written again on every call rather than built as a new literal
  readonly #dependencyValues: DependencyValues<AreaDependencies> = {map2dTileCoords: null, matrixWorld: null};

  // The center of the last call, x and y, in a typed array, which holds a double as it is. A `#`
  // field would box every double written to it: the emitted class declares the field before the
  // constructor assigns it, and that leaves V8 a tagged field. `NaN` equals nothing, so the first
  // call counts as a change.
  readonly #seenCenter = new Float64Array([NaN, NaN]);

  #visibleTiles?: IMap2DVisibleTiles;

  // counts the recomputations; the result carries it as `serial`
  #serial = 0;

  // A refused call has taken the new grid into the snapshot already; the grid change it saw must
  // reach the next call that computes.
  #gridChangeRefused = false;

  // What the grid is asked about and what it answers. The rectangle goes in as an object: a
  // double handed to a call the compiler does not inline is boxed, one held in the field of an
  // object is not.
  readonly #queryArea = new AABB2();
  readonly #tileCoords: TilesWithinCoords = createTilesWithinCoords();

  // Per-call scratch — reused across calls, handed out in the result. See IMap2DVisibleTiles.
  readonly #offset = new Vector2();
  readonly #translate = new Vector3();

  // The lists and the object a recomputation hands out, written again by the next one. A
  // recomputation writes the lists here and never through `#result`: the cache path puts `tiles`
  // into `#result.reuseTiles`.
  readonly #tiles: IMap2DTileCoords[] = [];
  readonly #reuseTiles: IMap2DTileCoords[] = [];
  readonly #createTiles: IMap2DTileCoords[] = [];
  readonly #removeTiles: IMap2DTileCoords[] = [];
  readonly #result: IMap2DVisibleTiles = {tiles: this.#tiles};

  constructor(width = 320, height = 240) {
    this.width = width;
    this.height = height;
  }

  /**
   * The width of the visible area in _world space_, around the center the streamer hands over.
   * `0` switches the area off: the next {@link computeVisibleTiles} hands every tile it is given
   * back in `removeTiles` and lays out none, and while a side stays 0 and no tile is left, it
   * answers `undefined`. A new size lays out the whole set again on the next call.
   * Any other value must be a finite number above 0, or a `RangeError` is thrown and the width
   * stays what it was.
   */
  get width(): number {
    return this.#width;
  }

  set width(width: number) {
    assertAreaSize(width, 'width');
    if (this.#width !== width) {
      this.#width = width;
      this.needsUpdate = true;
    }
  }

  /**
   * The height of the visible area in _world space_, around the center the streamer hands over.
   * `0` switches the area off: the next {@link computeVisibleTiles} hands every tile it is given
   * back in `removeTiles` and lays out none, and while a side stays 0 and no tile is left, it
   * answers `undefined`. A new size lays out the whole set again on the next call.
   * Any other value must be a finite number above 0, or a `RangeError` is thrown and the height
   * stays what it was.
   */
  get height(): number {
    return this.#height;
  }

  set height(height: number) {
    assertAreaSize(height, 'height');
    if (this.#height !== height) {
      this.#height = height;
      this.needsUpdate = true;
    }
  }

  /**
   * The most tiles the rectangle may cover on the grid of a call. A call whose rectangle covers
   * more throws a `RangeError` before it builds a tile, and the next call computes again: the
   * limit catches an area too wide for its tiles before one frame builds tens of thousands of
   * them. Defaults to 10 000, as `CameraBasedVisibility#maxVisibleTiles`; `Infinity` turns it
   * off.
   *
   * Takes a whole number above 0 or `Infinity` and throws a `RangeError` for anything else,
   * keeping the value it had. A new value recomputes on the next call.
   */
  get maxVisibleTiles(): number {
    return this.#maxVisibleTiles;
  }

  set maxVisibleTiles(value: number) {
    if (!(Number.isInteger(value) && value >= 1) && value !== Infinity) {
      throw new RangeError(
        `RectangularVisibilityArea: maxVisibleTiles must be a whole number above 0 or Infinity, got ${describeValue(value)}`,
      );
    }
    if (this.#maxVisibleTiles !== value) {
      this.#maxVisibleTiles = value;
      this.needsUpdate = true;
    }
  }

  /**
   * Returns the tiles the rectangle covers on the `map2dTileCoords` grid around `centerPoint`,
   * split into the tiles to create and to reuse, with the tiles of `previousTiles` that fall out
   * as `removeTiles`.
   *
   * While a side of the area is `0` the area is switched off: a call hands every tile of
   * `previousTiles` back in `removeTiles` and lays out none, and a call that is given no tile
   * answers `undefined`.
   *
   * Throws a `RangeError` when the rectangle covers more than {@link maxVisibleTiles} tiles of the
   * grid, before anything of the result is written; the next call computes again.
   */
  computeVisibleTiles(
    previousTiles: IMap2DTileCoords[],
    centerPoint: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
    matrixWorld: Matrix4,
  ): IMap2DVisibleTiles | undefined {
    if (this.width === 0 || this.height === 0) {
      return this.#switchedOff(previousTiles);
    }

    // read by index: a tuple of doubles destructured in the signature costs an allocation per call
    const centerX = centerPoint[0];
    const centerY = centerPoint[1];

    // asked before changed() writes the new state over it: the answer is what the previous call
    // was given, and `Dependencies` hands out its own clone
    const storedTileCoords = this.#deps.value('map2dTileCoords');

    // a tile of another grid carries indices this grid cannot place: `tile.x - tileLeft` lands
    // outside the occupancy array — or, worse, inside it on the wrong cell, where it marks a
    // place as taken that nothing covers
    const tileGridChanged = this.#gridChangeRefused || (storedTileCoords != null && !storedTileCoords.equals(map2dTileCoords));

    // always ask both halves, even when needsUpdate already forces the recompute: asking is what
    // keeps each snapshot current, and a snapshot left behind reports a change on the next call
    const values = this.#dependencyValues;
    values.map2dTileCoords = map2dTileCoords;
    values.matrixWorld = matrixWorld;
    const objectsChanged = this.#deps.changed(values);
    const seenCenter = this.#seenCenter;
    const centerChanged = centerX !== seenCenter[0] || centerY !== seenCenter[1];
    seenCenter[0] = centerX;
    seenCenter[1] = centerY;
    const depsChanged = objectsChanged || centerChanged;

    if (!depsChanged && !this.needsUpdate && this.#visibleTiles != null) {
      this.#visibleTiles.createTiles = undefined;
      this.#visibleTiles.reuseTiles = this.#visibleTiles.tiles;
      this.#visibleTiles.removeTiles = undefined;
      this.#visibleTiles.changed = false;
      return this.#visibleTiles;
    }

    const {width, height} = this;

    const area = this.#queryArea;
    area.left = centerX - width / 2;
    area.top = centerY - height / 2;
    area.width = width;
    area.height = height;
    const tileCoords = map2dTileCoords.computeTilesWithinArea(area, this.#tileCoords);

    const tilesLength = tileCoords.rows * tileCoords.columns;
    if (tilesLength > this.#maxVisibleTiles) {
      // the gate has taken the new center and objects in already: a refused call must not leave
      // the next one the cached result of an earlier call, nor let it compare against the grid
      // it refused
      this.needsUpdate = true;
      this.#gridChangeRefused = tileGridChanged;
      throw new RangeError(
        `RectangularVisibilityArea: the area covers ${tilesLength} tiles of the grid, more than maxVisibleTiles (${this.#maxVisibleTiles}) — make the area smaller or the tiles larger, or raise maxVisibleTiles`,
      );
    }

    this.needsUpdate = false;
    this.#gridChangeRefused = false;
    this.#serial += 1;

    const reuseTiles = this.#reuseTiles;
    const removeTiles = this.#removeTiles;
    const createTiles = this.#createTiles;
    truncateArray(reuseTiles);
    truncateArray(removeTiles);
    truncateArray(createTiles);

    let tileCreated = this.#tileCreated;
    if (tileCreated == null || tileCreated.length < tilesLength) {
      this.#tileCreated = new Uint8Array(tilesLength);
      tileCreated = this.#tileCreated;
    } else {
      tileCreated.fill(0);
    }

    // `previousTiles` can be the `tiles` list of the last result — the tile streamer hands it
    // back — so it is read whole here, before that list is emptied below
    for (let i = 0; i < previousTiles.length; ++i) {
      // The loop bound is `previousTiles.length`.
      const tile = previousTiles[i]!;
      const tx = tile.x - tileCoords.tileLeft;
      const ty = tile.y - tileCoords.tileTop;
      // by the integer indices, not by the edges: an edge worked out as `tileX * tileWidth` and one
      // worked out as `left + columns * tileWidth` round apart on tile sizes like 0.1, and an index
      // outside the columns would mark the cell of the neighbouring row as taken
      if (!tileGridChanged && tx >= 0 && tx < tileCoords.columns && ty >= 0 && ty < tileCoords.rows) {
        reuseTiles.push(tile);
        tileCreated[ty * tileCoords.columns + tx] = 1;
      } else {
        removeTiles.push(tile);
      }
    }

    for (let ty = 0; ty < tileCoords.rows; ty++) {
      for (let tx = 0; tx < tileCoords.columns; tx++) {
        if (tileCreated[ty * tileCoords.columns + tx] === 0) {
          const tileX = tx + tileCoords.tileLeft;
          const tileY = ty + tileCoords.tileTop;
          const tile = new Map2DTileCoords(
            tileX,
            tileY,
            new AABB2(tileX * tileCoords.tileWidth, tileY * tileCoords.tileHeight, tileCoords.tileWidth, tileCoords.tileHeight),
          );
          createTiles.push(tile);
        }
      }
    }

    const offset = this.#offset.set(map2dTileCoords.xOffset - centerX, map2dTileCoords.yOffset - centerY);
    const translate = this.#translate.setFromMatrixPosition(matrixWorld);

    const tiles = this.#tiles;
    truncateArray(tiles);
    for (let i = 0; i < reuseTiles.length; ++i) tiles.push(reuseTiles[i]!);
    for (let i = 0; i < createTiles.length; ++i) tiles.push(createTiles[i]!);

    const result = this.#result;
    result.tiles = tiles;
    result.offset = offset;
    result.translate = translate;
    result.removeTiles = removeTiles;
    result.createTiles = createTiles;
    result.reuseTiles = reuseTiles;
    // the view of a tile hangs on the grid alone, so a reused tile carries the view it was handed
    // out with unless the grid changed; a first call has no grid before it to say so
    result.changed = storedTileCoords == null || tileGridChanged;
    result.serial = this.#serial;

    this.#visibleTiles = result;
    return result;
  }

  // The way out of a switched-off area. The snapshots of the gate are not asked here: switching
  // the area on again goes through a setter that raises `needsUpdate`, and that recomputes anyway.
  #switchedOff(previousTiles: IMap2DTileCoords[]): IMap2DVisibleTiles | undefined {
    if (previousTiles.length === 0) {
      this.#visibleTiles = undefined;
      return undefined;
    }

    this.#serial += 1;

    // `previousTiles` can be the `tiles` list of the last result — the tile streamer hands it
    // back — so every entry is out of it before that list is emptied
    const removeTiles = this.#removeTiles;
    truncateArray(removeTiles);
    for (let i = 0; i < previousTiles.length; ++i) removeTiles.push(previousTiles[i]!);
    truncateArray(this.#tiles);
    truncateArray(this.#createTiles);
    truncateArray(this.#reuseTiles);

    const result = this.#result;
    result.tiles = this.#tiles;
    result.removeTiles = removeTiles;
    // nothing of the result before may stand: this way out has no tiles to place
    result.createTiles = undefined;
    result.reuseTiles = undefined;
    result.offset = undefined;
    result.translate = undefined;
    // no tile is reused, so there is no view to write again
    result.changed = false;
    result.serial = this.#serial;

    this.#visibleTiles = result;
    return result;
  }
}
