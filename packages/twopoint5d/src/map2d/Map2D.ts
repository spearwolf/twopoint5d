import {Group} from 'three/webgpu';
import {Map2DTileStreamer} from './Map2DTileStreamer.js';
import type {IMap2DTileRenderer, IMap2DVisibilitor} from './types.js';

export class Map2D extends Group {
  #renderers: Set<IMap2DTileRenderer> = new Set();
  #tileStreamer: Map2DTileStreamer;
  #visibilitor?: IMap2DVisibilitor;

  get tileStreamer(): Map2DTileStreamer {
    return this.#tileStreamer;
  }

  set tileStreamer(streamer: Map2DTileStreamer) {
    if (this.#tileStreamer === streamer) return;

    const previous = this.#tileStreamer;

    for (const renderer of this.#renderers) {
      previous.removeTileRenderer(renderer);
    }

    this.#tileStreamer = streamer;

    // the view center belongs to the map: whoever set it through Map2D reads it back through
    // Map2D, whichever streamer carries it underneath
    streamer.centerX = previous.centerX;
    streamer.centerY = previous.centerY;

    if (this.#visibilitor) {
      streamer.visibilitor = this.#visibilitor;
    }

    for (const renderer of this.#renderers) {
      streamer.addTileRenderer(renderer);
    }

    // the renderers hold the tiles of the streamer that left, and the one taking over starts with
    // an empty tile list: without this every one of those tiles comes back as a createTile and
    // overwrites its map entry, and the tile it replaces never reaches destroyTile()
    streamer.clearTiles();
  }

  get visibilitor(): IMap2DVisibilitor | undefined {
    return this.#visibilitor;
  }

  set visibilitor(v: IMap2DVisibilitor) {
    if (this.#visibilitor === v) return;
    this.#visibilitor = v;
    this.#tileStreamer.visibilitor = v;
  }

  get centerX(): number {
    return this.#tileStreamer.centerX;
  }

  set centerX(x: number) {
    this.#tileStreamer.centerX = x;
  }

  get centerY(): number {
    return this.#tileStreamer.centerY;
  }

  set centerY(y: number) {
    this.#tileStreamer.centerY = y;
  }

  get tileWidth(): number {
    return this.#tileStreamer.tileWidth;
  }

  set tileWidth(width: number) {
    this.#tileStreamer.tileWidth = width;
  }

  get tileHeight(): number {
    return this.#tileStreamer.tileHeight;
  }

  set tileHeight(height: number) {
    this.#tileStreamer.tileHeight = height;
  }

  get xOffset(): number {
    return this.#tileStreamer.xOffset;
  }

  set xOffset(offset: number) {
    this.#tileStreamer.xOffset = offset;
  }

  get yOffset(): number {
    return this.#tileStreamer.yOffset;
  }

  set yOffset(offset: number) {
    this.#tileStreamer.yOffset = offset;
  }

  constructor(tileStreamer: Map2DTileStreamer = new Map2DTileStreamer()) {
    super();
    this.#tileStreamer = tileStreamer;
  }

  addTileRenderer(renderer: IMap2DTileRenderer): void {
    if (!this.#renderers.has(renderer)) {
      this.#renderers.add(renderer);
      this.#tileStreamer.addTileRenderer(renderer);
      this.add(renderer.node);
    }
  }

  removeTileRenderer(renderer: IMap2DTileRenderer): void {
    if (this.#renderers.has(renderer)) {
      this.remove(renderer.node);
      this.#tileStreamer.removeTileRenderer(renderer);
      this.#renderers.delete(renderer);
    }
  }

  update(): void {
    // this node's `matrixWorld` is left to the streamer, which brings it in order with
    // `updateWorldMatrix(true, false)` — walking the parent chain up first — on every update in
    // which it has a visibilitor and a tile renderer to lay out tiles for. An update that is missing
    // either of the two touches no matrix at all, and nothing here needs one: the renderer nodes
    // are placed in `beginUpdatingTiles()`, which that update does not reach either, and the
    // three.js renderer brings the scene graph up to date before it draws.
    this.#tileStreamer.update(this);
  }

  clearTiles(): void {
    this.#tileStreamer.clearTiles();
  }

  /**
   * Takes every tile renderer off this map and leaves the scene graph.
   *
   * Releases nothing: the tile renderers, the visibilitor and a `Map2DTileStreamer` handed to
   * the constructor all belong to the caller, and whoever wants a renderer disposed disposes it.
   * Every member answers afterwards as it did before — `tileStreamer` included — because nothing
   * was given up. A second call does nothing.
   */
  dispose(): void {
    // this map is a scene-graph node itself: it goes before it lets its renderers go,
    // so nothing reaches a half-emptied group in the next frame
    this.removeFromParent();

    for (const renderer of this.#renderers) {
      this.removeTileRenderer(renderer);
    }
  }
}
