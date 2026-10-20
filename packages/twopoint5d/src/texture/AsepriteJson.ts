import {describeValue} from '../utils/describeValue.js';
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
   * frames still follow the direction, the repeat is left out.
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
   *
   * Refused, with the tag named: a range outside the frames or running backwards, an unknown
   * direction, a repeat that is no whole number of 0 or more, two tags of one name, a frame without
   * a duration above zero, and a playback for a tag the sheet does not carry. A refused sheet leaves
   * `options.target` as it was.
   */
  static parse(
    data: AsepriteJsonData,
    options?: AsepriteParseOptions,
  ): [atlas: TextureAtlas<AsepriteFrameData>, meta: AsepriteMetaData, animations: FrameBasedAnimations] {
    const entries: [name: string, frameData: AsepriteJsonFrameData][] = Array.isArray(data.frames)
      ? data.frames.map((frameData) => [frameData.filename, frameData])
      : Object.entries(data.frames);
    const tags = data.meta.frameTags ?? [];
    const slices = data.meta.slices ?? [];

    // every tag is checked before the first frame is added, so a refused sheet leaves the target as it was
    const tagNames = new Set<string>();
    for (const tag of tags) {
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
          `AsepriteJson: the tag "${tag.name}" has the direction ${JSON.stringify(tag.direction)} — Aseprite's directions are forward, reverse, pingpong and pingpong_reverse`,
        );
      }
      repeatOf(tag);
      for (let index = tag.from; index <= tag.to; index++) {
        const [name, {duration}] = entries[index]!;
        if (typeof duration !== 'number' || !Number.isFinite(duration) || !(duration > 0)) {
          throw new Error(
            `AsepriteJson: the frame "${name}" carries a duration of ${describeValue(duration)} — Aseprite writes one in ms above zero for every frame`,
          );
        }
      }
    }
    for (const tagName of Object.keys(options?.playback ?? {})) {
      if (!tagNames.has(tagName)) {
        throw new Error(
          `AsepriteJson: parse() got a playback for the tag "${tagName}", which the sheet does not carry — its tags are: ${[...tagNames].join(', ') || '(none)'}`,
        );
      }
    }

    // the json entries stay as they are: every frame gets a copy with its index and its slices
    const frames: Record<string, AsepriteFrameData> = {};
    entries.forEach(([name, frameData], index) => {
      frames[name] = {...frameData, index, slices: Object.freeze(slicesAt(slices, index))};
    });
    // TexturePackerJson refuses a name twice in the json or taken in the target before it adds a frame
    const [atlas] = TexturePackerJson.parse(
      {frames, meta: data.meta},
      options?.parentCoords,
      (options?.target ?? new TextureAtlas<AsepriteFrameData>()) as unknown as TextureAtlas,
    ) as unknown as [TextureAtlas<AsepriteFrameData>];

    const animations = new FrameBasedAnimations();
    for (const tag of tags) {
      const {indices, playback} = framesOfTag(tag, options?.playback?.[tag.name]);
      const names = indices.map((index) => entries[index]![0]);
      const durations = indices.map((index) => entries[index]![1].duration / 1000);
      const even = durations.every((duration) => duration === durations[0]);
      const timing: AnimationTimingOptions = even
        ? {duration: durations.reduce((sum, duration) => sum + duration, 0), playback}
        : {durations, playback};
      animations.add(tag.name, timing, atlas, names);
    }

    return [atlas, data.meta, animations];
  }
}
