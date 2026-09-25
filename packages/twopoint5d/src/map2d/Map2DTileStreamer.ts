import type {Object3D} from 'three/webgpu';
import {Vector3} from 'three/webgpu';
import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
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
    // before the equality check: an invalid value is invalid whatever the streamer holds right now
    assertPositiveFinite(width, 'Map2DTileStreamer', 'tileWidth');
    if (this.#tileCoords.tileWidth === width) return;
    this.#tileCoords.tileWidth = width;
    this.clearTiles();
  }

  get tileHeight(): number {
    return this.#tileCoords.tileHeight;
  }

  set tileHeight(height: number) {
    assertPositiveFinite(height, 'Map2DTileStreamer', 'tileHeight');
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

  // Per-frame scratch — handed to computeVisibleTiles(), which reads it during the call.
  readonly #viewCenter: [number, number] = [0, 0];

  constructor(tileWidth = 1, tileHeight = 1, xOffset = 0, yOffset = 0) {
    // checked here as well as in the util underneath, so the message names the class the caller
    // holds in its hands
    assertPositiveFinite(tileWidth, 'Map2DTileStreamer', 'tileWidth');
    assertPositiveFinite(tileHeight, 'Map2DTileStreamer', 'tileHeight');

    this.#tileCoords = new Map2DTileCoordsUtil(tileWidth, tileHeight, xOffset, yOffset);
  }

  addTileRenderer(renderer: IMap2DTileRenderer): void {
    this.renderers.add(renderer);
  }

  /**
   * Takes a tile renderer off this streamer and has it give back the tiles this streamer laid out
   * in it, through {@link IMap2DTileRenderer.clearTiles}. A renderer added again — here or to
   * another streamer — therefore starts empty and gets its tiles built in the grid then in place.
   * A renderer this streamer does not hold is left alone.
   */
  removeTileRenderer(renderer: IMap2DTileRenderer): void {
    // only update() takes a tile out of a renderer again: one let go with its tiles would keep
    // those that leave the view while it is away, and bring back as a reuse the tiles of a grid
    // that has changed since, with that grid's size and texture coordinates
    if (this.renderers.delete(renderer)) renderer.clearTiles();
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

    this.#viewCenter[0] = this.centerX;
    this.#viewCenter[1] = this.centerY;
    const visible = visibilitor.computeVisibleTiles(this.tiles, this.#viewCenter, this.#tileCoords, node.matrixWorld);

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
