import {TextureCoords} from './TextureCoords.js';

export type TextureAtlasFrameData = Record<string, any>;

export interface TextureAtlasFrame {
  coords: TextureCoords;
  data?: TextureAtlasFrameData;
}

type TextureAtlasArgs = [coords: TextureCoords, data?: TextureAtlasFrameData];

type TextureAtlasFrameName = string | symbol;

type NamedTextureAtlasArgs = [name: TextureAtlasFrameName, coords: TextureCoords, data?: TextureAtlasFrameData];

const isNamedTextureAtlasArgs = (args: TextureAtlasArgs | NamedTextureAtlasArgs): args is NamedTextureAtlasArgs =>
  typeof args[0] === 'string' || typeof args[0] === 'symbol';

const rand = (max: number) => (Math.random() * max) | 0;

export class TextureAtlas {
  #frames: TextureAtlasFrame[] = [];
  #frameNames: Map<TextureAtlasFrameName, number> = new Map();

  /**
   * returns the frame id.
   * the frame id starts at 0 and increases by 1 each time you add another frame.
   */
  add(...args: TextureAtlasArgs | NamedTextureAtlasArgs): number {
    const id = this.#frames.length;
    if (isNamedTextureAtlasArgs(args)) {
      this.#frameNames.set(args[0], id);
      this.#frames.push({coords: args[1], data: args[2]});
    } else {
      this.#frames.push({coords: args[0], data: args[1]});
    }
    return id;
  }

  get size(): number {
    return this.#frames.length;
  }

  get(id: number): TextureAtlasFrame | undefined {
    return this.#frames[id];
  }

  frameId(name: TextureAtlasFrameName): number | undefined {
    return this.#frameNames.get(name);
  }

  frame(name: TextureAtlasFrameName): TextureAtlasFrame | undefined {
    return this.#frames[this.#frameNames.get(name)!];
  }

  /**
   * frame names that are symbols are not found here,
   * but if no argument is given, all names are returned (including symbols)
   */
  frameNames(match?: string | RegExp): TextureAtlasFrameName[] {
    const frameNames = Array.from(this.#frameNames.keys());
    if (match != null) {
      const regex = typeof match === 'string' ? new RegExp(match) : match;
      return frameNames.filter((name) => typeof name === 'string' && regex.test(name));
    }
    return frameNames;
  }

  randomFrameId(): number {
    return rand(this.#frames.length);
  }

  randomFrame(): TextureAtlasFrame {
    return this.#frames[this.randomFrameId()];
  }

  randomFrameName(): TextureAtlasFrameName {
    const randomIdx = rand(this.#frameNames.size);
    let idx = 0;
    for (const name of this.#frameNames.keys()) {
      if (idx === randomIdx) {
        return name;
      }
      ++idx;
    }
    // @ts-ignore
    return;
  }

  randomFrameIds(count: number): number[] {
    const frameIds: number[] = [];
    for (let i = 0; i < count; i++) {
      frameIds.push(this.randomFrameId());
    }
    return frameIds;
  }

  randomFrames(count: number): TextureAtlasFrame[] {
    const frames: TextureAtlasFrame[] = [];
    for (let i = 0; i < count; i++) {
      frames.push(this.randomFrame());
    }
    return frames;
  }

  randomFrameNames(count: number): TextureAtlasFrameName[] {
    const names: TextureAtlasFrameName[] = [];
    for (let i = 0; i < count; i++) {
      names.push(this.randomFrameName());
    }
    return names;
  }
}
