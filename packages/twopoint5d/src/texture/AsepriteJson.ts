import {assertFinite} from '../utils/assertFinite.js';
import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {describeValue} from '../utils/describeValue.js';
import {isObject} from '../utils/isObject.js';
import {isAnimationPlayback} from './animationPlayback.js';
import {type AnimationPlayback, type AnimationTimingOptions, FrameBasedAnimations} from './FrameBasedAnimations.js';
import {TextureAtlas} from './TextureAtlas.js';
import type {TextureCoords} from './TextureCoords.js';
import {type TexturePackerFrameData, TexturePackerJson, type TexturePackerMetaData} from './TexturePackerJson.js';

/** A rectangle in pixels as Aseprite writes it. */
export interface AsepriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A frame entry of an Aseprite json: a TexturePacker entry and the duration of the frame. */
export interface AsepriteJsonFrameData extends TexturePackerFrameData {
  /** Milliseconds. */
  duration: number;
}

/** A frame entry of the layout "Array", which names itself by `filename`. */
export interface AsepriteJsonArrayFrameData extends AsepriteJsonFrameData {
  filename: string;
}

/** Aseprite's four directions of a tag. */
export type AsepriteDirection = 'forward' | 'reverse' | 'pingpong' | 'pingpong_reverse';

/** A frame tag of `meta.frameTags`: the frames `from` to `to` (both included) of the sprite. */
export interface AsepriteFrameTag {
  name: string;
  from: number;
  to: number;
  direction: AsepriteDirection;
  /** How often the tag plays, absent or 0 for ever. Aseprite writes it as a string, `"3"`. */
  repeat?: string | number;
  color?: string;
  data?: string;
}

/** A key of a slice: where the slice lies from the frame `frame` on, up to the next key. */
export interface AsepriteSliceKey {
  frame: number;
  bounds: AsepriteRect;
  center?: AsepriteRect;
  pivot?: {x: number; y: number};
}

/** A slice of `meta.slices`. */
export interface AsepriteSlice {
  name: string;
  color?: string;
  data?: string;
  keys: AsepriteSliceKey[];
}

/** A layer of `meta.layers`; kept as it is, not read. */
export interface AsepriteLayer {
  name: string;
  opacity?: number;
  blendMode?: string;
  group?: string;
  color?: string;
  data?: string;
}

/** The `meta` of an Aseprite json. */
export interface AsepriteMetaData extends TexturePackerMetaData {
  app?: string;
  version?: string;
  format?: string;
  scale?: string;
  frameTags?: AsepriteFrameTag[];
  layers?: AsepriteLayer[];
  slices?: AsepriteSlice[];
}

/** The json of Aseprite's "Export Sprite Sheet", in the layout "Hash" or "Array". */
export interface AsepriteJsonData {
  frames: Record<string, AsepriteJsonFrameData> | AsepriteJsonArrayFrameData[];
  meta: AsepriteMetaData;
}

/**
 * The key of a slice in force at one frame. All in pixels of the untrimmed frame (`sourceSize`),
 * counted from its top left.
 */
export interface AsepriteFrameSlice {
  /** Where the slice lies in the frame. */
  readonly bounds: AsepriteRect;
  /** The center of a nine-slice, relative to `bounds` as Aseprite writes it. */
  readonly center?: AsepriteRect;
  /** The pivot, relative to `bounds` as Aseprite writes it. */
  readonly pivot?: {x: number; y: number};
}

/** The data of a frame of the atlas `AsepriteJson.parse()` builds: a copy of its json entry, and two fields more. */
export interface AsepriteFrameData extends AsepriteJsonFrameData {
  /** The index of the frame in the sprite: its position in `frames`. */
  index: number;
  /** The slices in force at this frame, by name. */
  slices: Readonly<Record<string, AsepriteFrameSlice>>;
}

export interface AsepriteParseOptions {
  /** The coords the frames are laid out in; by default the whole of `meta.size`. */
  parentCoords?: TextureCoords;
  /** An atlas to add the frames to, in place of a new one. */
  target?: TextureAtlas<AsepriteFrameData>;
  /**
   * The playback of a tag by its name, in place of the one its `direction` and `repeat` give: the
   * frames still follow the direction, the repeat is left out. Only own keys name a tag — an inherited
   * one such as `constructor` names none.
   */
  playback?: Readonly<Record<string, AnimationPlayback>>;
}

const DIRECTIONS: readonly string[] = ['forward', 'reverse', 'pingpong', 'pingpong_reverse'];

// Aseprite writes a repeat as a string; a number is read the same. Absent is 0, for ever
const repeatOf = (tag: AsepriteFrameTag): number => {
  const {repeat} = tag;
  if (repeat === undefined) return 0;
  const count = typeof repeat === 'string' && /^\d+$/.test(repeat) ? Number(repeat) : repeat;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error(
      `AsepriteJson: the tag "${tag.name}" has a repeat of ${describeValue(repeat)} — a repeat is a whole number of 0 or more`,
    );
  }
  return count;
};

// an own key only: `{}` would answer Object.prototype.constructor for a tag named "constructor"
const playbackOf = (options: AsepriteParseOptions | undefined, tagName: string): unknown => {
  const playback = options?.playback;
  return playback != null && Object.hasOwn(playback, tagName) ? playback[tagName] : undefined;
};

// The indices of the frames a tag shows, and the playback they are played with. A repeat of r ≥ 1 is
// a one-shot over the frames played r times; a ping-pong counts each direction as one pass, and each
// pass after the first leaves out the frame it turns on
const framesOfTag = (tag: AsepriteFrameTag, playbackOverride: AnimationPlayback | undefined) => {
  const forward = Array.from({length: tag.to - tag.from + 1}, (_, i) => tag.from + i);
  const reversed = tag.direction === 'reverse' || tag.direction === 'pingpong_reverse';
  const pass = reversed ? forward.reverse() : forward;
  const isPingpong = tag.direction === 'pingpong' || tag.direction === 'pingpong_reverse';

  if (playbackOverride !== undefined) return {indices: pass, playback: playbackOverride};

  const repeat = repeatOf(tag);
  if (repeat === 0) return {indices: pass, playback: (isPingpong ? 'pingpong' : 'loop') as AnimationPlayback};

  const indices: number[] = [];
  let current = pass;
  for (let i = 0; i < repeat; i++) {
    if (!isPingpong) {
      indices.push(...pass);
    } else if (i === 0) {
      indices.push(...current);
    } else {
      current = current.slice().reverse();
      indices.push(...current.slice(1));
    }
  }
  return {indices, playback: 'once' as AnimationPlayback};
};

// A rectangle of a slice key: x and y are any finite number (a slice may reach over the edge of the canvas),
// w and h are not below 0.
const assertSliceRect = (value: unknown, field: string, where: string): void => {
  if (!isObject(value)) {
    const verb = field === 'bounds' ? 'are' : 'is';
    throw new TypeError(
      `AsepriteJson: the ${field} of ${where} ${verb} ${describeValue(value)} — a rectangle of a slice is an object {x, y, w, h}`,
    );
  }
  for (const side of ['x', 'y'] as const) {
    assertFinite(value[side], 'AsepriteJson', `the ${side} of the ${field} of ${where}`);
  }
  for (const side of ['w', 'h'] as const) {
    const measure = assertFinite(value[side], 'AsepriteJson', `the ${side} of the ${field} of ${where}`);
    if (measure < 0) {
      throw new RangeError(
        `AsepriteJson: the ${side} of the ${field} of ${where} must be a finite number of 0 or more, got ${describeValue(measure)}`,
      );
    }
  }
};

// Everything slicesAt() reads of meta.slices. An absent slice list and absent keys mean none; a center and
// a pivot are optional, so null and undefined mean they are missing.
const assertSlices = (slices: unknown): void => {
  if (!Array.isArray(slices)) {
    throw new TypeError(`AsepriteJson: meta.slices is ${describeValue(slices)} — Aseprite writes the slices as a list`);
  }
  const sliceNames = new Set<string>();
  for (const [i, slice] of slices.entries()) {
    if (!isObject(slice)) {
      throw new TypeError(`AsepriteJson: the slice ${i} is ${describeValue(slice)} — a slice is an object`);
    }
    const name = slice['name'];
    if (typeof name !== 'string') {
      throw new TypeError(`AsepriteJson: the slice ${i} has a name of ${describeValue(name)} — a slice is named by a string`);
    }
    if (sliceNames.has(name)) {
      throw new Error(`AsepriteJson: two slices are named "${name}" — rename one of them in Aseprite`);
    }
    sliceNames.add(name);
    const keys = slice['keys'];
    if (keys == null) continue;
    if (!Array.isArray(keys)) {
      throw new TypeError(
        `AsepriteJson: the slice "${name}" has keys of ${describeValue(keys)} — Aseprite writes the keys of a slice as a list`,
      );
    }
    for (const [k, key] of keys.entries()) {
      if (!isObject(key)) {
        throw new TypeError(
          `AsepriteJson: the key ${k} of the slice "${name}" is ${describeValue(key)} — a key of a slice is an object`,
        );
      }
      const frame = key['frame'];
      if (typeof frame !== 'number' || !Number.isInteger(frame) || frame < 0) {
        throw new RangeError(
          `AsepriteJson: the frame of the key ${k} of the slice "${name}" must be a whole number of 0 or more, got ${describeValue(frame)}`,
        );
      }
      const where = `the key ${k} of the slice "${name}"`;
      assertSliceRect(key['bounds'], 'bounds', where);
      if (key['center'] != null) assertSliceRect(key['center'], 'center', where);
      const pivot = key['pivot'];
      if (pivot != null) {
        if (!isObject(pivot)) {
          throw new TypeError(`AsepriteJson: the pivot of ${where} is ${describeValue(pivot)} — a pivot is an object {x, y}`);
        }
        // any sign: Aseprite sets a pivot outside the bounds as well
        assertFinite(pivot['x'], 'AsepriteJson', `the x of the pivot of ${where}`);
        assertFinite(pivot['y'], 'AsepriteJson', `the y of the pivot of ${where}`);
      }
    }
  }
};

// the key of every slice in force at the frame `index`: the last key at or before it
const slicesAt = (slices: readonly AsepriteSlice[], index: number): Record<string, AsepriteFrameSlice> => {
  const inForce: Record<string, AsepriteFrameSlice> = {};
  for (const slice of slices) {
    let key: AsepriteSliceKey | undefined;
    for (const candidate of slice.keys ?? []) {
      if (candidate.frame <= index && (key === undefined || candidate.frame >= key.frame)) key = candidate;
    }
    if (key === undefined) continue;
    const {bounds, center, pivot} = key;
    inForce[slice.name] = Object.freeze({bounds, ...(center ? {center} : {}), ...(pivot ? {pivot} : {})});
  }
  return inForce;
};

/**
 * Reads the json of Aseprite's "Export Sprite Sheet" — the layout "Hash" or "Array".
 */
export class AsepriteJson {
  /**
   * Builds the atlas of the frames, and one animation per frame tag.
   *
   * The frames go through `TexturePackerJson.parse()`, so a frame the exporter turned or trimmed is
   * drawn as `TexturePackerJson` draws it. Every frame's `data` is a copy of its json entry with its
   * `index` — its position in `frames` — and the `slices` in force at it, each the last key of the
   * slice at or before the frame; a frame before the first key of a slice carries none of it. The
   * json handed in is left as it is.
   *
   * The frame indices of a tag — `from`, `to` — and of a slice key are positions in `frames`, as
   * Aseprite's default export writes them, one entry per frame of the sprite: a sheet exported with
   * "Split Layers" or "Split Tags" lists more entries than frames, and its tags point at the wrong ones.
   *
   * A tag becomes the animation of its name, its frames `from` to `to` — backwards for `reverse` and
   * `pingpong_reverse` — played as a `'loop'` or, for both ping-pongs, a `'pingpong'`. A `repeat` of
   * `r` ≥ 1 makes it a `'once'` over the frames played `r` times; a ping-pong counts each direction as
   * one pass and leaves out the frame it turns on. The frames keep their durations, in seconds — as
   * `durations` when they differ, as one `duration` when they are all alike. `options.playback` names
   * the playback of a tag outright; its frames still follow the direction, and its repeat is left out.
   * It is read by its own keys only: an inherited one such as `constructor` names no tag.
   *
   * Refused, with the tag named: a range outside the frames or running backwards, an unknown
   * direction, a repeat that is no whole number of 0 or more, two tags of one name, a tag that
   * plays more than `FrameBasedAnimations.MaxFramesWithDurations` frames of differing durations, a
   * playback that is none of `'loop'`, `'once'` and `'pingpong'`, and a playback for a tag the
   * sheet does not carry. Refused as well: a frame name twice in the layout "Array"; a frame — in a
   * tag or outside every tag — without a duration above zero, with a `RangeError` naming the frame;
   * a frame or a frame tag that is no object, and `meta.frameTags` that is no list, with a
   * `TypeError`; and what `TexturePackerJson.parse()` refuses of a frame and of `meta.size`. A
   * json, its `frames` or its `meta` that is no object, a frame of the layout "Array" without a
   * string `filename` and a tag without a string `name` are refused with a `TypeError` as well, and
   * so are `meta.slices` that is no list, a slice that is no object or has no string `name`, keys
   * that are no list, a key that is no object, and a `bounds`, `center` or `pivot` that is no
   * object. A `frame` of a slice key that is no whole number of 0 or more, and a coordinate of a
   * `bounds`, `center` or `pivot` that is no finite number or, as `w` or `h`, lies below 0, are
   * refused with a `RangeError`; two slices of one name with an `Error`. Every check runs before
   * the first frame is added: a refused sheet leaves `options.target` as it was.
   */
  static parse(
    data: AsepriteJsonData,
    options?: AsepriteParseOptions,
  ): [atlas: TextureAtlas<AsepriteFrameData>, meta: AsepriteMetaData, animations: FrameBasedAnimations] {
    if (!isObject(data)) {
      throw new TypeError(`AsepriteJson: the json is ${describeValue(data)} — Aseprite writes an object {frames, meta}`);
    }
    const jsonFrames: unknown = data.frames;
    if (!Array.isArray(jsonFrames) && !isObject(jsonFrames)) {
      throw new TypeError(
        `AsepriteJson: the json has frames of ${describeValue(jsonFrames)} — Aseprite writes the frames as an object ("Hash") or a list ("Array")`,
      );
    }
    const meta: unknown = data.meta;
    if (!isObject(meta)) {
      throw new TypeError(`AsepriteJson: the json has a meta of ${describeValue(meta)} — Aseprite writes meta as an object`);
    }
    const isArray = Array.isArray(jsonFrames);
    // a filename is only read from an object: an entry that is no object is refused below, by its index, and
    // a filename that is no string likewise
    const entries: [name: string, frameData: AsepriteJsonFrameData][] = Array.isArray(jsonFrames)
      ? jsonFrames.map((frameData: unknown) => [
          (isObject(frameData) ? frameData['filename'] : undefined) as string,
          frameData as AsepriteJsonFrameData,
        ])
      : Object.entries(jsonFrames as Record<string, AsepriteJsonFrameData>);
    const tags: unknown = meta['frameTags'] ?? [];
    const slices: unknown = meta['slices'] ?? [];

    if (!Array.isArray(tags)) {
      throw new TypeError(`AsepriteJson: meta.frameTags is ${describeValue(tags)} — Aseprite writes the frame tags as a list`);
    }

    // Everything is checked and every animation planned before the first frame is added, so a
    // refused sheet leaves the target as it was. A name twice in "Array" would overwrite its first
    // frame below; Aseprite writes it when the filename format has no {frame}
    for (const [index, [name, frameData]] of entries.entries()) {
      if (!isObject(frameData)) {
        throw new TypeError(
          isArray
            ? `AsepriteJson: the frame ${index} of the "Array" frames is ${describeValue(frameData)} — a frame of the json is an object`
            : `AsepriteJson: the frame "${name}" is ${describeValue(frameData)} — a frame of the json is an object`,
        );
      }
      // only a frame of the layout "Array" can miss its name: a key of the layout "Hash" is a string
      if (isArray && typeof name !== 'string') {
        throw new TypeError(
          `AsepriteJson: the frame ${index} of the "Array" frames has a filename of ${describeValue(name)} — a frame of that layout is named by its filename, a string`,
        );
      }
    }
    const frameNames = new Set<string>();
    for (const [name] of entries) {
      if (frameNames.has(name)) {
        throw new Error(
          `AsepriteJson: the frame name "${name}" appears twice — export with a filename format that contains {frame}`,
        );
      }
      frameNames.add(name);
    }
    // every frame, not only those of a tag: the frames of the atlas are typed to carry their duration
    for (const [name, {duration}] of entries) {
      assertPositiveFinite(duration, 'AsepriteJson', `the duration of the frame "${name}"`);
    }
    const plans: {name: string; timing: AnimationTimingOptions; frameNames: string[]}[] = [];
    const tagNames = new Set<string>();
    const overrides = new Map<string, AnimationPlayback>();
    for (const [index, tag] of tags.entries()) {
      if (!isObject(tag)) {
        throw new TypeError(`AsepriteJson: the frame tag ${index} is ${describeValue(tag)} — a frame tag is an object`);
      }
      if (typeof tag['name'] !== 'string') {
        throw new TypeError(
          `AsepriteJson: the frame tag ${index} has a name of ${describeValue(tag['name'])} — a frame tag is named by a string`,
        );
      }
    }
    const frameTags = tags as AsepriteFrameTag[];
    for (const tag of frameTags) {
      if (tagNames.has(tag.name)) {
        throw new Error(`AsepriteJson: two tags are named "${tag.name}" — rename one of them in Aseprite`);
      }
      tagNames.add(tag.name);
      const inRange = (index: number) => Number.isInteger(index) && index >= 0 && index < entries.length;
      if (!inRange(tag.from) || !inRange(tag.to)) {
        throw new Error(
          `AsepriteJson: the tag "${tag.name}" runs from frame ${describeValue(tag.from)} to frame ${describeValue(tag.to)}, outside the ${entries.length} frames of the sheet`,
        );
      }
      if (tag.from > tag.to) {
        throw new Error(
          `AsepriteJson: the tag "${tag.name}" runs from frame ${tag.from} back to frame ${tag.to} — export the sheet again from Aseprite`,
        );
      }
      if (!DIRECTIONS.includes(tag.direction)) {
        throw new Error(
          `AsepriteJson: the tag "${tag.name}" has the direction ${describeValue(tag.direction)} — Aseprite's directions are forward, reverse, pingpong and pingpong_reverse`,
        );
      }
      repeatOf(tag);
      const override = playbackOf(options, tag.name);
      if (override !== undefined && !isAnimationPlayback(override)) {
        throw new Error(
          `AsepriteJson: parse() got a playback of ${describeValue(override)} for the tag "${tag.name}" — a playback is 'loop', 'once' or 'pingpong'`,
        );
      }
      if (override !== undefined) overrides.set(tag.name, override);
    }
    for (const tag of frameTags) {
      const {indices, playback} = framesOfTag(tag, overrides.get(tag.name));
      const durations = indices.map((index) => entries[index]![1].duration / 1000);
      const even = durations.every((duration) => duration === durations[0]);
      if (!even && indices.length > FrameBasedAnimations.MaxFramesWithDurations) {
        throw new Error(
          `AsepriteJson: the tag "${tag.name}" plays ${indices.length} frames with their own durations — an animation with per-frame durations holds at most ${FrameBasedAnimations.MaxFramesWithDurations} frames; lower its repeat`,
        );
      }
      plans.push({
        name: tag.name,
        timing: even ? {duration: durations.reduce((sum, duration) => sum + duration, 0), playback} : {durations, playback},
        frameNames: indices.map((index) => entries[index]![0]),
      });
    }
    for (const tagName of Object.keys(options?.playback ?? {})) {
      if (!tagNames.has(tagName)) {
        throw new Error(
          `AsepriteJson: parse() got a playback for the tag "${tagName}", which the sheet does not carry — its tags are: ${[...tagNames].join(', ') || '(none)'}`,
        );
      }
    }
    assertSlices(slices);

    // the json entries stay as they are: every frame gets a copy with its index and its slices
    const frames: Record<string, AsepriteFrameData> = {};
    entries.forEach(([name, frameData], index) => {
      frames[name] = {...frameData, index, slices: Object.freeze(slicesAt(slices as AsepriteSlice[], index))};
    });
    // TexturePackerJson refuses a name twice in the json or taken in the target before it adds a frame
    const [atlas] = TexturePackerJson.parse(
      {frames, meta: data.meta},
      options?.parentCoords,
      options?.target ?? new TextureAtlas<AsepriteFrameData>(),
    );

    // every plan was checked against what add() refuses: no add() below throws
    const animations = new FrameBasedAnimations();
    for (const {name, timing, frameNames: names} of plans) {
      animations.add(name, timing, atlas, names);
    }

    return [atlas, data.meta, animations];
  }
}
