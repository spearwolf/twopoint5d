import {Group} from 'three/webgpu';
import {Map2DTileStreamer} from './Map2DTileStreamer.js';
import type {IMap2DTileRenderer, IMap2DVisibilitor} from './types.js';

export class Map2D extends Group {
  #renderers: Set<IMap2DTileRenderer> = new Set();
  #tileStreamer: Map2DTileStreamer;

  /**
   * The tile streamer that lays out the tiles of this map.
   *
   * Assigning another one moves the map onto it. Every tile renderer of the map comes off the
   * streamer that leaves — empty, its tiles given back — and goes to the one taking over, and so
   * does the view center. The visibilitor goes with the map as well and serves one streamer at a
   * time: when the map has one, the streamer that leaves gives it up and the one taking over holds
   * it, in place of any visibilitor it brought along; when the map has none, the streamer taking
   * over keeps its own. The tile grid stays with the streamer that carries it, and the next
   * {@link update} lays out the whole tile set in that grid.
   *
   * When the `clearTiles()` of a renderer throws as it comes off the streamer that leaves, the map
   * stays on that streamer with every renderer on it — those taken off before the throw go back
   * onto it empty, and the next {@link update} lays out the whole tile set in them again — and the
   * error goes on unchanged. Assigning the streamer again takes the move up.
   */
  get tileStreamer(): Map2DTileStreamer {
    return this.#tileStreamer;
  }

  set tileStreamer(streamer: Map2DTileStreamer) {
    if (this.#tileStreamer === streamer) return;

    const previous = this.#tileStreamer;

    // every renderer comes off the streamer that leaves before anything else moves. When the
    // clearTiles() of one throws, the renderers taken off before it go back onto that streamer and
    // the error goes on: the map stays where it was, every renderer on exactly one streamer, and the
    // next assignment takes the move up. The renderer that threw is still on the streamer, as
    // Map2DTileStreamer#removeTileRenderer() leaves it
    const takenOff: IMap2DTileRenderer[] = [];
    try {
      for (const renderer of this.#renderers) {
        // `renderers` of a streamer is a public set: a renderer taken out of it directly is not
        // put back onto it
        if (!previous.renderers.has(renderer)) continue;
        previous.removeTileRenderer(renderer);
        takenOff.push(renderer);
      }
    } catch (error) {
      for (const renderer of takenOff) previous.addTileRenderer(renderer);
      throw error;
    }

    this.#tileStreamer = streamer;

    // the view center belongs to the map: whoever set it through Map2D reads it back through
    // Map2D, whichever streamer carries it underneath
    streamer.centerX = previous.centerX;
    streamer.centerY = previous.centerY;

    // the visibilitor goes with the map as the view center does, and it serves one streamer at a
    // time: the streamer that leaves gives it up. A streamer taking over from one that had none
    // keeps the visibilitor it brings along
    const visibilitor = previous.visibilitor;
    if (visibilitor) {
      previous.visibilitor = undefined;
      streamer.visibilitor = visibilitor;
    }

    for (const renderer of this.#renderers) {
      streamer.addTileRenderer(renderer);
    }

    // the renderers came off the streamer that left empty. The visibilitor handed on last answered
    // for the tile list of that streamer, and the list of the streamer taking over is no ground for
    // its answer: clearing has the next update() hand it an empty one and lay out the whole set in
    // the grid of the streamer taking over
    streamer.clearTiles();
  }

  /**
   * The visibilitor of the tile streamer underneath. Assigning one hands it to the streamer,
   * which has the tiles built again when it replaces another one.
   */
  get visibilitor(): IMap2DVisibilitor | undefined {
    return this.#tileStreamer.visibilitor;
  }

  set visibilitor(v: IMap2DVisibilitor) {
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

  /**
   * Takes a tile renderer off this map: its node leaves the map, and the tile streamer has it give
   * back the tiles laid out in it. The renderer comes off empty and is not disposed — it belongs
   * to the caller, and it can be added again. When its `clearTiles()` throws, the renderer stays on
   * the map — node, streamer and all — and the error goes on; a second call takes it off.
   */
  removeTileRenderer(renderer: IMap2DTileRenderer): void {
    if (this.#renderers.has(renderer)) {
      // the streamer first: when the clearTiles() of the renderer throws, the map stays as it was,
      // and the renderer does not go on taking tiles nobody sees
      this.#tileStreamer.removeTileRenderer(renderer);
      this.remove(renderer.node);
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
   * Takes every tile renderer off this map and leaves the scene graph. Every renderer goes as
   * {@link removeTileRenderer} leaves it — empty, its tiles given back to its factory, not disposed.
   *
   * Releases nothing: the tile renderers, the visibilitor and a `Map2DTileStreamer` handed to
   * the constructor all belong to the caller, and whoever wants a renderer disposed disposes it.
   * Every member answers afterwards as it did before — `tileStreamer` included — because nothing
   * was given up. When the `clearTiles()` of a renderer throws, the error goes on, and that
   * renderer and those not reached yet stay on the map; a second call takes off what is left.
   * Every call that gets through fires three's `dispose` event, as `Object3D.dispose()` does;
   * beyond that a second call does nothing.
   */
  override dispose(): void {
    // this map is a scene-graph node itself: it goes before it lets its renderers go,
    // so nothing reaches a half-emptied group in the next frame
    this.removeFromParent();

    for (const renderer of this.#renderers) {
      this.removeTileRenderer(renderer);
    }

    super.dispose();
  }
}
