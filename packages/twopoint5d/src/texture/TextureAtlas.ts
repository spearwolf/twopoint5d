import type {TextureCoords} from './TextureCoords.js';
import type {TexturePackerFrameData} from './TexturePackerJson.js';

/** The data a frame of a {@link TextureAtlas} carries when the atlas names no type of its own: its entry in a TexturePacker json. */
export type TextureAtlasFrameData = TexturePackerFrameData;

export interface TextureAtlasFrame<D = TextureAtlasFrameData> {
  coords: TextureCoords;
  data?: D;
}

export type TextureAtlasArgs<D = TextureAtlasFrameData> = [coords: TextureCoords, data?: D];

export type TextureAtlasFrameName = string | symbol;

export type NamedTextureAtlasArgs<D = TextureAtlasFrameData> = [name: TextureAtlasFrameName, coords: TextureCoords, data?: D];

const isNamedTextureAtlasArgs = <D>(args: TextureAtlasArgs<D> | NamedTextureAtlasArgs<D>): args is NamedTextureAtlasArgs<D> =>
  typeof args[0] === 'string' || typeof args[0] === 'symbol';

const rand = (max: number) => (Math.random() * max) | 0;

/**
 * Frames of a texture, each with its `TextureCoords`, reachable by id and, if it has one, by name.
 *
 * `D` is the type of the `data` the frames carry. Without it, it is the entry of a TexturePacker
 * json, which `TexturePackerJson.parse()` registers; an atlas with data of another shape names its
 * type, `new TextureAtlas<MyFrameData>()`. A frame may carry no data at all.
 */
export class TextureAtlas<D = TextureAtlasFrameData> {
  #frames: TextureAtlasFrame<D>[] = [];
  #frameNames: Map<TextureAtlasFrameName, number> = new Map();
  // the names in the order they were added, beside the map: a name is drawn at random by its
  // index, and frameNames() hands out a copy
  #frameNameList: TextureAtlasFrameName[] = [];

  /**
   * returns the frame id.
   * the frame id starts at 0 and increases by 1 each time you add another frame.
   *
   * A name belongs to exactly one frame: a second frame offered under a name that is
   * already taken is refused with an error, and the atlas is left as it was.
   */
  add(...args: TextureAtlasArgs<D> | NamedTextureAtlasArgs<D>): number {
    const id = this.#frames.length;
    if (isNamedTextureAtlasArgs(args)) {
      // checked before the push, so a refused frame leaves no half of itself behind
      if (this.#frameNames.has(args[0])) {
        // `toString()` and not an interpolation: a name can be a symbol, and interpolating
        // one throws in place of the message it was supposed to carry
        throw new Error(`TextureAtlas: the frame name "${args[0].toString()}" is already taken`);
      }
      this.#frameNames.set(args[0], id);
      this.#frameNameList.push(args[0]);
      this.#frames.push({coords: args[1], data: args[2]});
    } else {
      this.#frames.push({coords: args[0], data: args[1]});
    }
    return id;
  }

  get size(): number {
    return this.#frames.length;
  }

  get(id: number): TextureAtlasFrame<D> | undefined {
    return this.#frames[id];
  }

  frameId(name: TextureAtlasFrameName): number | undefined {
    return this.#frameNames.get(name);
  }

  frame(name: TextureAtlasFrameName): TextureAtlasFrame<D> | undefined {
    const frameId = this.#frameNames.get(name);
    return frameId != null ? this.#frames[frameId] : undefined;
  }

  /**
   * frame names that are symbols are not found here,
   * but if no argument is given, all names are returned (including symbols)
   *
   * A `RegExp` is tested against every name from the start of that name, whatever its flags —
   * with `y` the match has to begin there. The `RegExp` handed in stays as it was, its
   * `lastIndex` included.
   */
  frameNames(match?: string | RegExp): TextureAtlasFrameName[] {
    if (match != null) {
      // a copy with the same flags, so that every name is tested from its start: a RegExp with `g`
      // or `y` goes on from its `lastIndex`, and the RegExp handed in keeps the `lastIndex` it had
      const regex = new RegExp(match);
      return this.#frameNameList.filter((name) => {
        if (typeof name !== 'string') return false;
        regex.lastIndex = 0;
        return regex.test(name);
      });
    }
    return this.#frameNameList.slice();
  }

  randomFrameId(): number {
    return rand(this.#frames.length);
  }

  /** A frame drawn at random, or `undefined` for an atlas without frames. */
  randomFrame(): TextureAtlasFrame<D> | undefined {
    return this.#frames[this.randomFrameId()];
  }

  /** A frame name drawn at random, or `undefined` for an atlas without named frames. */
  randomFrameName(): TextureAtlasFrameName | undefined {
    return this.#frameNameList[rand(this.#frameNameList.length)];
  }

  randomFrameIds(count: number): number[] {
    const frameIds: number[] = [];
    for (let i = 0; i < count; i++) {
      frameIds.push(this.randomFrameId());
    }
    return frameIds;
  }

  /** `count` frames drawn at random; every one of them is `undefined` for an atlas without frames. */
  randomFrames(count: number): (TextureAtlasFrame<D> | undefined)[] {
    const frames: (TextureAtlasFrame<D> | undefined)[] = [];
    for (let i = 0; i < count; i++) {
      frames.push(this.randomFrame());
    }
    return frames;
  }

  /** `count` frame names drawn at random; every one of them is `undefined` for an atlas without named frames. */
  randomFrameNames(count: number): (TextureAtlasFrameName | undefined)[] {
    const names: (TextureAtlasFrameName | undefined)[] = [];
    for (let i = 0; i < count; i++) {
      names.push(this.randomFrameName());
    }
    return names;
  }
}
