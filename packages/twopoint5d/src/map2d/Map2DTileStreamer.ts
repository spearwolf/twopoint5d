import type {Object3D} from 'three/webgpu';
import { Vector2, Vector3} from 'three/webgpu';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';
import type {IMap2DTileCoords, IMap2DTileRenderer, IMap2DVisibilitor} from './types.js';

/**
 * `Map2DTileStreamer` is a tile streaming manager for 2D maps that loads and discards tiles based on their visibility.
 *
 * `Map2DTileStreamer` divides a 2D world into an equal-sized grid of tiles (`tileWidth` + `tileHeight` and `xOffset` + `yOffset`)
 * and only loads the visible tiles.
 *
 * Visibility is checked based on the _view center position_ (`centerX` + `centerY`) and a _visibilitor_ (see `IMap2DVisibilitor`).
 *
 * Tile rendering is delegated to a _renderer_ (see `IMap2DTileRenderer`).
 */
export class Map2DTileStreamer {
  centerX = 0;
  centerY = 0;

  visibilitor?: IMap2DVisibilitor;

  #tileCoords: Map2DTileCoordsUtil;

  #clearTilesOnNextUpdate = false;

  get tileWidth(): number {
    return this.#tileCoords.tileWidth;
  }

  set tileWidth(width: number) {
    this.#tileCoords.tileWidth = width;
  }

  get tileHeight(): number {
    return this.#tileCoords.tileHeight;
  }

  set tileHeight(height: number) {
    this.#tileCoords.tileHeight = height;
  }

  get xOffset(): number {
    return this.#tileCoords.xOffset;
  }

  set xOffset(offset: number) {
    this.#tileCoords.xOffset = offset;
  }

  get yOffset(): number {
    return this.#tileCoords.yOffset;
  }

  set yOffset(offset: number) {
    this.#tileCoords.yOffset = offset;
  }

  tiles: IMap2DTileCoords[] = [];
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

    if (this.#clearTilesOnNextUpdate) {
      for (const tileRenderer of this.renderers) {
        tileRenderer.clearTiles();
      }
      this.tiles.length = 0;
      this.#clearTilesOnNextUpdate = false;
    }

    node.updateWorldMatrix(true, false);

    const visible = this.visibilitor.computeVisibleTiles(
      this.tiles,
      [this.centerX, this.centerY],
      this.#tileCoords,
      node.matrixWorld,
    );

    if (visible) {
      this.tiles = visible?.tiles;

      const offset = visible.offset ?? new Vector2();
      const translate = visible.translate ?? new Vector3();
      const position = new Vector3(offset.x + translate.x, translate.y, offset.y + translate.z);

      for (const tileRenderer of this.renderers) {
        tileRenderer.beginUpdatingTiles(position);

        visible.removeTiles?.forEach((tile) => {
          tileRenderer.removeTile(tile);
        });

        visible.createTiles?.forEach((tile) => {
          tileRenderer.addTile(tile);
        });

        visible.reuseTiles?.forEach((tile) => {
          tileRenderer.reuseTile(tile);
        });

        tileRenderer.endUpdatingTiles();
      }
    }
  }

  clearTiles(): void {
    this.#clearTilesOnNextUpdate = true;
  }
}
