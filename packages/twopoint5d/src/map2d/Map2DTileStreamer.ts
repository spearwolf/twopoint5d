import type {Object3D} from 'three/webgpu';
import {Vector3} from 'three/webgpu';
import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';
import type {IMap2DTileCoords, IMap2DTileRenderer, IMap2DVisibilitor, IMap2DVisibleTiles} from './types.js';

/**
 * `Map2DTileStreamer` is a tile streaming manager for 2D maps that loads and discards tiles based on their visibility.
 *
 * `Map2DTileStreamer` divides a 2D world into an equal-sized grid of tiles (`tileWidth` + `tileHeight` and `xOffset` + `yOffset`)
 * and only loads the visible tiles. The grid is corner-anchored: a tile `(c, r)` covers
 * `[c · tileWidth + xOffset, (c + 1) · tileWidth + xOffset)` on X and the same with `r`,
 * `tileHeight` and `yOffset` along the rows — it is not centered on its coordinates.
 *
 * Visibility is checked based on the _view center position_ (`centerX` + `centerY`) and a _visibilitor_
 * (see `IMap2DVisibilitor`). The view center means what the visibilitor makes of it — see {@link centerX}: under
 * `CameraBasedVisibility` with its default `lookAtCenter = false` it shifts the map under the
 * camera and stays `0` for a world-fixed map under a moving camera.
 *
 * Tile rendering is delegated to a _renderer_ (see `IMap2DTileRenderer`).
 */
export class Map2DTileStreamer {
  /**
   * The view center on the map plane, handed to the visibilitor on every {@link update}. What it
   * does is the visibilitor's to say:
   *
   * - `CameraBasedVisibility` with `lookAtCenter = false` (the default): the view center **shifts
   *   the map under the camera** — the camera sees the map point that lies `(centerX, centerY)`
   *   away from where it looks on the plane. The camera's own position already drives visibility,
   *   so for a map fixed in the world under a moving camera, leave both at `0`: feeding the camera
   *   position in here scrolls the ground with the camera, on top of the camera's own motion. Use
   *   it as a scroll or pan offset under a fixed camera.
   * - `CameraBasedVisibility` with `lookAtCenter = true`: the map point that appears where the
   *   camera looks — the tiles are laid out around `(centerX, centerY)` wherever the camera points.
   * - `RectangularVisibilityArea`: the map point the visible rectangle is laid out around — its
   *   center. The rectangle appears at the origin of the map node, so `(centerX, centerY)` is the
   *   map point shown there.
   */
  centerX = 0;

  /**
   * The view center on the map plane, along the same axis as the rows of the tile grid. See
   * {@link centerX} for what the value means under each visibilitor — it always describes one
   * point `(centerX, centerY)` together with it.
   */
  centerY = 0;

  #visibilitor?: IMap2DVisibilitor;

  /**
   * The visibilitor that decides which tiles are visible.
   *
   * A visibilitor answers from the state of its own last call and holds the tile list it is
   * handed against that state — the tiles another visibilitor laid out are no ground for its
   * answer. Replacing a visibilitor, with another one or with `undefined`, therefore clears the
   * tiles as a change of the tile grid does: the next {@link update} empties every renderer and
   * the visibilitor then in place, if there is one, lays out the whole set. The first visibilitor,
   * and the one already held, cost nothing.
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

  // The `serial` of the visibilitor result each renderer last went through a whole update cycle
  // with. A renderer missing here has laid out nothing since it came on or since the tiles were
  // cleared — an update cycle that throws clears them —, and goes through the next cycle whatever
  // the result says. Weak, because `renderers` is a public set: a renderer taken out of it
  // directly is not held here either.
  #laidOutSerials = new WeakMap<IMap2DTileRenderer, number>();

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

  /**
   * Where the tile grid starts on the x axis in map-plane coordinates, before the visibilitor's
   * translation and the map node's world transform. A tile `(c, r)` covers
   * `[c · tileWidth + xOffset, (c + 1) · tileWidth + xOffset)` on X. The tile quad starts at that
   * corner — it is **not** centered on its coordinates — so a tile at `(0, 0)` spans
   * `[xOffset, xOffset + tileWidth)`, and the `xOffset` that centers the grid on the map-plane
   * origin is `-tileWidth / 2`. Defaults to `0`.
   *
   * Changing it clears the tiles, as every grid change does: the next {@link update} lays out the
   * whole tile set again.
   */
  get xOffset(): number {
    return this.#tileCoords.xOffset;
  }

  set xOffset(offset: number) {
    if (this.#tileCoords.xOffset === offset) return;
    this.#tileCoords.xOffset = offset;
    this.clearTiles();
  }

  /**
   * Where the tile grid starts on the axis of the rows in map-plane coordinates, before the
   * visibilitor's translation and the map node's world transform. A tile `(c, r)` covers
   * `[r · tileHeight + yOffset, (r + 1) · tileHeight + yOffset)` there — corner-anchored like
   * {@link xOffset}, not centered. Defaults to `0`, and changing it clears the tiles as every grid
   * change does.
   */
  get yOffset(): number {
    return this.#tileCoords.yOffset;
  }

  set yOffset(offset: number) {
    if (this.#tileCoords.yOffset === offset) return;
    this.#tileCoords.yOffset = offset;
    this.clearTiles();
  }

  #tiles: IMap2DTileCoords[] = [];

  /**
   * The tiles the last {@link update} laid out — the list the visibilitor gave back, and the one it
   * gets as `previousTiles` in the next `update()`; empty after an update that cleared the tiles.
   * Read-only: {@link clearTiles} has the next `update()` lay out the whole set again.
   */
  get tiles(): readonly IMap2DTileCoords[] {
    return this.#tiles;
  }

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
   *
   * When `clearTiles()` throws, the renderer stays on this streamer and the error goes on unchanged:
   * a second call gives back the tiles that remain and takes it off, and an {@link update} in between
   * lays out the whole tile set in it again.
   */
  removeTileRenderer(renderer: IMap2DTileRenderer): void {
    // only update() takes a tile out of a renderer again: one let go with its tiles would keep
    // those that leave the view while it is away, and bring back as a reuse the tiles of a grid
    // that has changed since, with that grid's size and texture coordinates
    if (!this.renderers.has(renderer)) return;

    // forgotten before the clear: a renderer whose clearTiles() throws stays here, and without a
    // laid-out serial it goes through the next update, which lays out the whole tile set in it again
    this.#laidOutSerials.delete(renderer);
    renderer.clearTiles();
    // off only once clearTiles() has come back: a renderer let go with tiles it had yet to give back
    // would keep them, and nothing but a clearTiles() of the caller would reach them again
    this.renderers.delete(renderer);
  }

  /**
   * Lays out the tiles the visibilitor finds around the view center in every tile renderer.
   *
   * `node` is the node the tile renderer nodes are children of — `Map2D` hands itself over. Its
   * world matrix goes to the visibilitor, and the renderer nodes are placed in its local space.
   *
   * A tile renderer sits an update out when there is nothing to lay out: the visibilitor hands
   * back the result the renderer went through its last update cycle with — the same
   * {@link IMap2DVisibleTiles.serial} — and the renderer reports no
   * {@link IMap2DTileRenderer.hasPendingTiles}. Its node then stays where that cycle placed it.
   * A renderer that has just come on, every renderer after the tiles were cleared, and every
   * renderer of a visibilitor whose results carry no `serial` go through the cycle.
   *
   * An update without a visibilitor carries out a pending clear and nothing else: it touches no
   * matrix and lays out no tile.
   *
   * An update cycle that throws — in a renderer or in its factory, `endUpdatingTiles()` included —
   * clears the tiles as {@link clearTiles} does: the next `update()` empties every renderer and
   * lays out the whole set again. The error goes on unchanged.
   */
  update(node: Object3D): void {
    if (this.renderers.size === 0) return;

    if (this.#clearTilesOnNextUpdate) {
      for (const tileRenderer of this.renderers) {
        tileRenderer.clearTiles();
      }
      // a new list, not `length = 0`: the visibilitor holds this very array as the tile set of
      // its last result, and its cache path hands that result back untouched by previousTiles
      this.#tiles = [];
      this.#laidOutSerials = new WeakMap();
      this.#clearTilesOnNextUpdate = false;
    }

    // after the clear: a visibilitor taken away leaves the tiles of the one before to be taken down
    const visibilitor = this.#visibilitor;
    if (visibilitor == null) return;

    node.updateWorldMatrix(true, false);

    this.#viewCenter[0] = this.centerX;
    this.#viewCenter[1] = this.centerY;
    const visible: IMap2DVisibleTiles | undefined = visibilitor.computeVisibleTiles(
      this.#tiles,
      this.#viewCenter,
      this.#tileCoords,
      node.matrixWorld,
    );

    if (visible) {
      this.#tiles = visible.tiles;

      // the renderer nodes are children of `node` — Map2D adds them to itself — so they are placed
      // in its local space, and its own world matrix carries them into the world
      const offset = visible.offset;
      const position = this.#position.set(offset?.x ?? 0, 0, offset?.y ?? 0);

      const serial = visible.serial;
      try {
        for (const tileRenderer of this.renderers) {
          // nothing to lay out: the renderer holds this very result and misses none of its tiles
          if (
            serial !== undefined &&
            tileRenderer.hasPendingTiles === false &&
            this.#laidOutSerials.get(tileRenderer) === serial
          ) {
            continue;
          }

          tileRenderer.beginUpdatingTiles(position, visible.changed ?? true);

          if (visible.removeTiles) for (const tile of visible.removeTiles) tileRenderer.removeTile(tile);
          if (visible.createTiles) for (const tile of visible.createTiles) tileRenderer.addTile(tile);
          if (visible.reuseTiles) for (const tile of visible.reuseTiles) tileRenderer.reuseTile(tile);

          tileRenderer.endUpdatingTiles();

          if (serial !== undefined) this.#laidOutSerials.set(tileRenderer, serial);
        }
      } catch (error) {
        // No later result carries the removes this cycle had yet to go through, nor the whole
        // result for the renderers after the one that threw — the visibilitor computes against
        // `this.#tiles`, which holds the new set already. So the next update lays out everything
        // again.
        this.clearTiles();
        throw error;
      }
    }
  }

  clearTiles(): void {
    this.#clearTilesOnNextUpdate = true;
  }
}
