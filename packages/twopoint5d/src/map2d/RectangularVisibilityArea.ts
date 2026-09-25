import type {Matrix4} from 'three/webgpu';
import {Vector2, Vector3} from 'three/webgpu';
import {Dependencies} from '../utils/Dependencies.js';
import {AABB2} from './AABB2.js';
import {Map2DTileCoords} from './Map2DTileCoords.js';
import type {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';
import type {IMap2DTileCoords, IMap2DVisibilitor, IMap2DVisibleTiles} from './types.js';

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

  readonly #deps = new Dependencies<{
    centerX: number;
    centerY: number;
    map2dTileCoords: Map2DTileCoordsUtil;
    matrixWorld: Matrix4;
  }>([
    'centerX',
    'centerY',
    Dependencies.cloneable<Map2DTileCoordsUtil>('map2dTileCoords'),
    Dependencies.cloneable<Matrix4>('matrixWorld'),
  ]);

  #visibleTiles?: IMap2DVisibleTiles;

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

  get width(): number {
    return this.#width;
  }

  set width(width: number) {
    if (this.#width !== width) {
      this.#width = width;
      this.needsUpdate = true;
    }
  }

  get height(): number {
    return this.#height;
  }

  set height(height: number) {
    if (this.#height !== height) {
      this.#height = height;
      this.needsUpdate = true;
    }
  }

  computeVisibleTiles(
    previousTiles: IMap2DTileCoords[],
    [centerX, centerY]: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
    matrixWorld: Matrix4,
  ): IMap2DVisibleTiles | undefined {
    if (this.width === 0 || this.height === 0) {
      return undefined;
    }

    // asked before changed() writes the new state over it: the answer is what the previous call
    // was given, and `Dependencies` hands out its own clone
    const storedTileCoords = this.#deps.value('map2dTileCoords');

    // a tile of another grid carries indices this grid cannot place: `tile.x - tileLeft` lands
    // outside the occupancy array — or, worse, inside it on the wrong cell, where it marks a
    // place as taken that nothing covers
    const tileGridChanged = storedTileCoords != null && !storedTileCoords.equals(map2dTileCoords);

    // always ask, even when needsUpdate already forces the recompute: changed() is what keeps
    // the snapshot current, and a snapshot left behind reports a change on the next call
    const depsChanged = this.#deps.changed({centerX, centerY, map2dTileCoords, matrixWorld});

    if (!depsChanged && !this.needsUpdate && this.#visibleTiles != null) {
      this.#visibleTiles.createTiles = undefined;
      this.#visibleTiles.reuseTiles = this.#visibleTiles.tiles;
      this.#visibleTiles.removeTiles = undefined;
      this.#visibleTiles.changed = false;
      return this.#visibleTiles;
    }

    this.needsUpdate = false;

    const {width, height} = this;

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const left = centerX - halfWidth;
    const top = centerY - halfHeight;

    const tileCoords = map2dTileCoords.computeTilesWithinCoords(left, top, width, height);
    const fullViewArea = AABB2.from(tileCoords, this.#fullViewArea);

    const reuseTiles = this.#reuseTiles;
    const removeTiles = this.#removeTiles;
    const createTiles = this.#createTiles;
    reuseTiles.length = 0;
    removeTiles.length = 0;
    createTiles.length = 0;

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
    tiles.length = 0;
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
