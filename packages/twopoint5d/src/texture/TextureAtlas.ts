import {describeValue} from '../utils/describeValue.js';
import {forgetFrameName, liveFrameIds} from './internals.js';
import type {TextureCoords} from './TextureCoords.js';
import type {TexturePackerFrameData} from './TexturePackerJson.js';

/**
 * The data a frame of a {@link TextureAtlas} carries when the atlas names no type of its own: its entry
 * in a TexturePacker json.
 */
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
  // the ids of the frames whose name was not let go of, ascending: a frame is drawn at random by its
  // index here
  #liveIds: number[] = [];

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
        // describeValue() and not an interpolation: a name can be a symbol, which an interpolation
        // throws for, and it writes a symbol apart from a string of the same text
        throw new Error(`TextureAtlas: the frame name ${describeValue(args[0])} is already taken`);
      }
      this.#frameNames.set(args[0], id);
      this.#frameNameList.push(args[0]);
      this.#frames.push({coords: args[1], data: args[2]});
    } else {
      this.#frames.push({coords: args[0], data: args[1]});
    }
    this.#liveIds.push(id);
    return id;
  }

  /**
   * How many frame ids the atlas has handed out: `get()` answers a frame for every id below it, a frame
   * `DynamicAtlas#remove()` let go of included.
   */
  get size(): number {
    return this.#frames.length;
  }

  /**
   * @internal Lets go of the name: `frame()` and `frameId()` find it no longer, `frameNames()` leaves it
   * out, and `add()` takes it again for a new frame. The frame stays at its id, so `get()` and `size`
   * are unchanged, but it leaves the random draws of the atlas and a selection of every frame. Answers
   * `false` for a name the atlas does not hold.
   */
  [forgetFrameName](name: TextureAtlasFrameName): boolean {
    const id = this.#frameNames.get(name);
    if (id === undefined) return false;
    this.#frameNames.delete(name);
    this.#frameNameList.splice(this.#frameNameList.indexOf(name), 1);
    this.#liveIds.splice(this.#liveIds.indexOf(id), 1);
    return true;
  }

  /** @internal The ids of the frames whose name was not let go of, ascending — the atlas's own array. */
  [liveFrameIds](): readonly number[] {
    return this.#liveIds;
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

  /**
   * The id of a frame drawn at random among those the atlas has not let go of — `DynamicAtlas#remove()`
   * lets go of one —, or `size`, an id without a frame, for an atlas without such a frame.
   */
  randomFrameId(): number {
    return this.#liveIds[rand(this.#liveIds.length)] ?? this.#frames.length;
  }

  /**
   * A frame drawn at random among those the atlas has not let go of, or `undefined` for an atlas
   * without such a frame.
   */
  randomFrame(): TextureAtlasFrame<D> | undefined {
    return this.#frames[this.randomFrameId()];
  }

  /** A frame name drawn at random, or `undefined` for an atlas without named frames. */
  randomFrameName(): TextureAtlasFrameName | undefined {
    return this.#frameNameList[rand(this.#frameNameList.length)];
  }

  /** `count` frame ids, each drawn as {@link randomFrameId} draws one. */
  randomFrameIds(count: number): number[] {
    const frameIds: number[] = [];
    for (let i = 0; i < count; i++) {
      frameIds.push(this.randomFrameId());
    }
    return frameIds;
  }

  /**
   * `count` frames drawn at random among those the atlas has not let go of; every one of them is
   * `undefined` for an atlas without such a frame.
   */
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
