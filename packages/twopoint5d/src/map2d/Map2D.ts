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
    if (this.#tileStreamer !== streamer) {
      if (this.#renderers.size > 0) {
        if (this.#tileStreamer) {
          for (const renderer of this.#renderers) {
            this.#tileStreamer.removeTileRenderer(renderer);
          }
        }
      }

      this.#tileStreamer = streamer;

      if (this.#visibilitor) {
        this.#tileStreamer.visibilitor = this.#visibilitor;
      }

      if (this.#tileStreamer) {
        for (const renderer of this.#renderers) {
          this.#tileStreamer.addTileRenderer(renderer);
        }
      }
    }
  }

  get visibilitor(): IMap2DVisibilitor {
    return this.#visibilitor;
  }

  set visibilitor(v: IMap2DVisibilitor) {
    if (this.#visibilitor !== v) {
      this.#visibilitor = v;
      if (this.#tileStreamer != null) {
        this.#tileStreamer.visibilitor = v;
      }
    }
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
    this.updateMatrixWorld();
    this.#tileStreamer.update(this);
  }

  clearTiles(): void {
    this.#tileStreamer.clearTiles();
  }

  dispose(): void {
    for (const renderer of this.#renderers) {
      this.removeTileRenderer(renderer);
      renderer.dispose();
    }
  }
}
