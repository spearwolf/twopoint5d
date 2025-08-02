import {Matrix4, Vector2, Vector3} from 'three/webgpu';
import {AABB2} from './AABB2.js';
import {Map2DTileCoords} from './Map2DTileCoords.js';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';
import type {IMap2DTileCoords, IMap2DVisibilitor, IMap2DVisibleTiles} from './types.js';

export class RectangularVisibilityArea implements IMap2DVisibilitor {
  #width = 0;
  #height = 0;

  needsUpdate = true;

  #tileCreated?: Uint8Array;

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

    const {width, height} = this;

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const left = centerX - halfWidth;
    const top = centerY - halfHeight;

    const tileCoords = map2dTileCoords.computeTilesWithinCoords(left, top, width, height);
    const fullViewArea = AABB2.from(tileCoords);

    const removeTiles: IMap2DTileCoords[] = [];
    const reuseTiles: IMap2DTileCoords[] = [];

    const tilesLength = tileCoords.rows * tileCoords.columns;

    let tileCreated = this.#tileCreated;
    if (tileCreated == null || tileCreated.length < tilesLength) {
      this.#tileCreated = new Uint8Array(tilesLength);
      tileCreated = this.#tileCreated;
    } else {
      tileCreated.fill(0);
    }

    previousTiles.forEach((tile) => {
      if (fullViewArea.isIntersecting(tile.view)) {
        reuseTiles.push(tile);
        const tx = tile.x - tileCoords.tileLeft;
        const ty = tile.y - tileCoords.tileTop;
        tileCreated[ty * tileCoords.columns + tx] = 1;
      } else {
        removeTiles.push(tile);
      }
    });

    const createTiles: IMap2DTileCoords[] = [];

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

    const offset = new Vector2(map2dTileCoords.xOffset - centerX, map2dTileCoords.yOffset - centerY);
    const translate = new Vector3().setFromMatrixPosition(matrixWorld);

    return {
      tiles: reuseTiles.concat(createTiles),
      offset,
      translate,
      removeTiles,
      createTiles,
      reuseTiles,
    };
  }
}
