import {AABB2} from './AABB2';
import {IMap2dRenderable} from './IMap2dRenderable';
import {Map2dTileCoordsUtil} from './Map2dTileCoordsUtil';

export type Map2dSpatialHashGridKeyType = string;

export class Map2dSpatialHashGrid<Renderable extends IMap2dRenderable> {
  static getKey(x: number, y: number): Map2dSpatialHashGridKeyType {
    return `${x};${y}`;
  }

  #tiles: Map<Map2dSpatialHashGridKeyType, Set<Renderable>>;
  #tileCoordsUtil: Map2dTileCoordsUtil;

  constructor(tileWidth = 0, tileHeight = 0, xOffset = 0, yOffset = 0) {
    this.#tiles = new Map();
    this.#tileCoordsUtil = new Map2dTileCoordsUtil(tileWidth, tileHeight, xOffset, yOffset);
  }

  add(...renderables: Array<Renderable>) {
    for (const renderable of renderables) {
      const {left, top, width, height} = renderable.aabb;
      const [tileLeft, tileTop, tileColumns, tileRows] = this.#tileCoordsUtil.getTileCoords(
        left,
        top,
        width,
        height,
      );
      for (let y = 0; y < tileRows; y++) {
        for (let x = 0; x < tileColumns; x++) {
          const tileKey = Map2dSpatialHashGrid.getKey(tileLeft + x, tileTop + y);
          let tileSet = this.#tiles.get(tileKey);
          if (tileSet) {
            tileSet.add(renderable);
          } else {
            tileSet = new Set<Renderable>();
            this.#tiles.set(tileKey, tileSet);
          }
          tileSet.add(renderable);
        }
      }
    }
    return this;
  }

  remove(...renderables: Array<Renderable>) {
    for (const renderable of renderables) {
      const {left, top, width, height} = renderable.aabb;
      const [tileLeft, tileTop, tileColumns, tileRows] = this.#tileCoordsUtil.getTileCoords(
        left,
        top,
        width,
        height,
      );
      for (let y = 0; y < tileRows; y++) {
        for (let x = 0; x < tileColumns; x++) {
          const tileKey = Map2dSpatialHashGrid.getKey(tileLeft + x, tileTop + y);
          let tileSet = this.#tiles.get(tileKey);
          if (tileSet) {
            tileSet.add(renderable);
          } else {
            tileSet = new Set<Renderable>();
            this.#tiles.set(tileKey, tileSet);
          }
          tileSet.add(renderable);
        }
      }
    }
    return this;
  }

  findWithin(aabb: AABB2): Set<Renderable> | undefined {
    const {left, top, width, height} = aabb;
    const [tileLeft, tileTop, tileColumns, tileRows] = this.#tileCoordsUtil.getTileCoords(
      left,
      top,
      width,
      height,
    );
    return this.getTiles(tileLeft, tileTop, tileColumns, tileRows);
  }

  getTiles(tileX: number, tileY: number, width = 1, height = 1): Set<Renderable> | undefined {
    let renderables: Set<Renderable>;
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
    const tileKey = Map2dSpatialHashGrid.getKey(tileX, tileY);
    return this.#tiles.get(tileKey);
  }
}
