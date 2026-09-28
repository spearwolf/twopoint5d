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
    throw new RangeError(`[RectangularVisibilityArea] ${name} must be 0 or a finite number above 0, got ${describeValue(value)}`);
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

  /**
   * Forces the next {@link computeVisibleTiles} to compute a fresh tile set instead of handing
   * back the previous one. The `width` and `height` setters raise it, and anyone who changed
   * something this area cannot see may raise it too. `computeVisibleTiles()` puts it back to
   * `false` as it recomputes, so one `true` buys exactly one recomputation.
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

  // What the grid is asked about and what it answers. The rectangle goes in as an object: a
  // double handed to a call the compiler does not inline is boxed, one held in the field of an
  // object is not.
  readonly #queryArea = new AABB2();
  readonly #tileCoords: TilesWithinCoords = createTilesWithinCoords();

  // Per-call scratch — reused across calls, handed out in the result. See IMap2DVisibleTiles.
  readonly #fullViewArea = new AABB2();
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
   * `0` switches the area off: {@link computeVisibleTiles} answers `undefined` while a side is 0.
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
   * `0` switches the area off: {@link computeVisibleTiles} answers `undefined` while a side is 0.
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

  computeVisibleTiles(
    previousTiles: IMap2DTileCoords[],
    centerPoint: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
    matrixWorld: Matrix4,
  ): IMap2DVisibleTiles | undefined {
    if (this.width === 0 || this.height === 0) {
      return undefined;
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
    const tileGridChanged = storedTileCoords != null && !storedTileCoords.equals(map2dTileCoords);

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

    this.needsUpdate = false;

    const {width, height} = this;

    const area = this.#queryArea;
    area.left = centerX - width / 2;
    area.top = centerY - height / 2;
    area.width = width;
    area.height = height;
    const tileCoords = map2dTileCoords.computeTilesWithinArea(area, this.#tileCoords);
    const fullViewArea = AABB2.from(tileCoords, this.#fullViewArea);

    const reuseTiles = this.#reuseTiles;
    const removeTiles = this.#removeTiles;
    const createTiles = this.#createTiles;
    truncateArray(reuseTiles);
    truncateArray(removeTiles);
    truncateArray(createTiles);

    const tilesLength = tileCoords.rows * tileCoords.columns;

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
      if (!tileGridChanged && fullViewArea.isIntersecting(tile.view)) {
        reuseTiles.push(tile);
        const tx = tile.x - tileCoords.tileLeft;
        const ty = tile.y - tileCoords.tileTop;
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

    this.#visibleTiles = result;
    return result;
  }
}
