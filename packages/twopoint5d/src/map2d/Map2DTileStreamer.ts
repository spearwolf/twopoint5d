import type {Object3D} from 'three/webgpu';
import {Vector3} from 'three/webgpu';
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

  // Per-frame scratch — handed to beginUpdatingTiles(), which reads it during the call.
  readonly #position = new Vector3();

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
      // a new list, not `length = 0`: the visibilitor holds this very array as the tile set of
      // its last result, and its cache path hands that result back untouched by previousTiles
      this.tiles = [];
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

      const offset = visible.offset;
      const translate = visible.translate;
      const position = this.#position.set(
        (offset?.x ?? 0) + (translate?.x ?? 0),
        translate?.y ?? 0,
        (offset?.y ?? 0) + (translate?.z ?? 0),
      );

      for (const tileRenderer of this.renderers) {
        tileRenderer.beginUpdatingTiles(position, visible.changed ?? true);

        if (visible.removeTiles) for (const tile of visible.removeTiles) tileRenderer.removeTile(tile);
        if (visible.createTiles) for (const tile of visible.createTiles) tileRenderer.addTile(tile);
        if (visible.reuseTiles) for (const tile of visible.reuseTiles) tileRenderer.reuseTile(tile);

        tileRenderer.endUpdatingTiles();
      }
    }
  }

  clearTiles(): void {
    this.#clearTilesOnNextUpdate = true;
  }
}
