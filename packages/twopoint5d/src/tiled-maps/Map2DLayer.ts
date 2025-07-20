import {Object3D, Vector2, Vector3} from 'three/webgpu';
import type {IMap2DLayer} from './IMap2DLayer.js';
import type {IMap2DTileRenderer} from './IMap2DTileRenderer.js';
import type {IMap2DVisibilitor} from './IMap2DVisibilitor.js';
import {Map2DTile} from './Map2DTile.js';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';

/**
 * A Map2DLayer divides a 2D map into a grid consisting of individual tiles of equal size.
 * The center-point specifies the center of the visible area.
 * The visibilitor interface is used to determine which tiles are visible.
 * The rendering of the visible tiles via update() method is delegated to the TileRenderer.
 */
export class Map2DLayer implements IMap2DLayer {
  #centerX = 0;
  #centerY = 0;

  #tileCoords: Map2DTileCoordsUtil;

  #needsUpdate = true;

  visibilitor?: IMap2DVisibilitor;

  #resetTilesOnNextUpdate = false;

  get needsUpdate(): boolean {
    return this.#needsUpdate || this.visibilitor?.needsUpdate;
  }

  set needsUpdate(update: boolean) {
    this.#needsUpdate = update;
    if (this.visibilitor) {
      this.visibilitor.needsUpdate = update;
    }
  }

  get centerX(): number {
    return this.#centerX;
  }

  set centerX(x: number) {
    if (this.#centerX !== x) {
      this.#centerX = x;
      this.#needsUpdate = true;
    }
  }

  get centerY(): number {
    return this.#centerY;
  }

  set centerY(y: number) {
    if (this.#centerY !== y) {
      this.#centerY = y;
      this.#needsUpdate = true;
    }
  }

  get tileWidth(): number {
    return this.#tileCoords.tileWidth;
  }

  set tileWidth(width: number) {
    if (this.#tileCoords.tileWidth !== width) {
      this.#tileCoords.tileWidth = width;
      this.#needsUpdate = true;
    }
  }

  get tileHeight(): number {
    return this.#tileCoords.tileHeight;
  }

  set tileHeight(height: number) {
    if (this.#tileCoords.tileHeight !== height) {
      this.#tileCoords.tileHeight = height;
      this.#needsUpdate = true;
    }
  }

  get xOffset(): number {
    return this.#tileCoords.xOffset;
  }

  set xOffset(offset: number) {
    if (this.#tileCoords.xOffset !== offset) {
      this.#tileCoords.xOffset = offset;
      this.#needsUpdate = true;
    }
  }

  get yOffset(): number {
    return this.#tileCoords.yOffset;
  }

  set yOffset(offset: number) {
    if (this.#tileCoords.yOffset !== offset) {
      this.#tileCoords.yOffset = offset;
      this.#needsUpdate = true;
    }
  }

  tiles: Map2DTile[] = [];
  renderers: Set<IMap2DTileRenderer> = new Set();

  constructor(tileWidth = 0, tileHeight = 0, xOffset = 0, yOffset = 0) {
    this.#tileCoords = new Map2DTileCoordsUtil(tileWidth, tileHeight, xOffset, yOffset);
  }

  addTileRenderer(renderer: IMap2DTileRenderer): void {
    this.renderers.add(renderer);
  }

  removeTileRenderer(renderer: IMap2DTileRenderer): void {
    this.renderers.delete(renderer);
  }

  update(node: Object3D): void {
    if (this.renderers.size === 0 || this.visibilitor == null) return;

    if (this.#resetTilesOnNextUpdate) {
      for (const tileRenderer of this.renderers) {
        tileRenderer.resetTiles();
      }
      this.tiles.length = 0;
      this.needsUpdate = true;
      this.#resetTilesOnNextUpdate = false;
    }

    if (this.needsUpdate) {
      node.updateWorldMatrix(true, false);

      const visible = this.visibilitor.computeVisibleTiles(this.tiles, [this.centerX, this.centerY], this.#tileCoords, node);

      if (visible) {
        this.tiles = visible?.tiles;
        this.needsUpdate = false;

        const offset = visible.offset ?? new Vector2();
        const translate = visible.translate ?? new Vector3();

        for (const tileRenderer of this.renderers) {
          tileRenderer.beginUpdate(offset, translate);

          visible.removeTiles?.forEach((tile) => {
            tileRenderer.removeTile(tile);
          });

          visible.createTiles?.forEach((tile) => {
            tileRenderer.addTile(tile);
          });

          visible.reuseTiles?.forEach((tile) => {
            tileRenderer.reuseTile(tile);
          });

          tileRenderer.endUpdate();
        }
      }
    }
  }

  resetTiles(): void {
    this.#resetTilesOnNextUpdate = true;
    this.needsUpdate = true;
  }
}
