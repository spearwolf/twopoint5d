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

  #visibilitor?: IMap2DVisibilitor;

  /**
   * The visibilitor that decides which tiles are visible.
   *
   * A visibilitor answers from the state of its own last call and holds the tile list it is
   * handed against that state — the tiles another visibilitor laid out are no ground for its
   * answer. Replacing a visibilitor, with another one or with `undefined`, therefore clears the
   * tiles as a change of the tile grid does: the next {@link update} empties every renderer and
   * the visibilitor then in place lays out the whole set. The first visibilitor, and the one
   * already held, cost nothing.
   */
  get visibilitor(): IMap2DVisibilitor | undefined {
    return this.#visibilitor;
  }

  set visibilitor(visibilitor: IMap2DVisibilitor | undefined) {
    if (this.#visibilitor === visibilitor) return;
    const previous = this.#visibilitor;
    this.#visibilitor = visibilitor;
    if (previous != null) this.clearTiles();
  }

  #tileCoords: Map2DTileCoordsUtil;

  #clearTilesOnNextUpdate = false;

  get tileWidth(): number {
    return this.#tileCoords.tileWidth;
  }

  // A grid change costs the tiles: a tile is recognised by its id `(x, y)` and comes back as a
  // reuse, but `IMapTileFactory#updateTile()` writes only its position — its size and its texture
  // coordinates would go on describing the grid it was built in. The four setters below
  // therefore clear, and each of them only when the value really moves.
  set tileWidth(width: number) {
    if (this.#tileCoords.tileWidth === width) return;
    this.#tileCoords.tileWidth = width;
    this.clearTiles();
  }

  get tileHeight(): number {
    return this.#tileCoords.tileHeight;
  }

  set tileHeight(height: number) {
    if (this.#tileCoords.tileHeight === height) return;
    this.#tileCoords.tileHeight = height;
    this.clearTiles();
  }

  get xOffset(): number {
    return this.#tileCoords.xOffset;
  }

  set xOffset(offset: number) {
    if (this.#tileCoords.xOffset === offset) return;
    this.#tileCoords.xOffset = offset;
    this.clearTiles();
  }

  get yOffset(): number {
    return this.#tileCoords.yOffset;
  }

  set yOffset(offset: number) {
    if (this.#tileCoords.yOffset === offset) return;
    this.#tileCoords.yOffset = offset;
    this.clearTiles();
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

  /**
   * Lays out the tiles the visibilitor finds around the view center in every tile renderer.
   *
   * `node` is the node the tile renderer nodes are children of — `Map2D` hands itself over. Its
   * world matrix goes to the visibilitor, and the renderer nodes are placed in its local space.
   */
  update(node: Object3D): void {
    const visibilitor = this.#visibilitor;
    if (this.renderers.size === 0 || visibilitor == null) return;

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

    const visible = visibilitor.computeVisibleTiles(this.tiles, [this.centerX, this.centerY], this.#tileCoords, node.matrixWorld);

    if (visible) {
      this.tiles = visible.tiles;

      // the renderer nodes are children of `node` — Map2D adds them to itself — so they are placed
      // in its local space, and its own world matrix carries them into the world
      const offset = visible.offset;
      const position = this.#position.set(offset?.x ?? 0, 0, offset?.y ?? 0);

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
