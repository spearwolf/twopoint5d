import type {WebGPURenderer} from 'three/webgpu';
import {DataTexture, FloatType, RGBAFormat} from 'three/webgpu';
import {describeValue} from '../utils/describeValue.js';
import {findNextPowerOf2} from '../utils/findNextPowerOf2.js';
import {isAnimationPlayback} from './animationPlayback.js';
import {writeFrameTexels} from './frameTexels.js';
import {frameTrimMargins, type FrameTrimMargins} from './frameTrimMargins.js';
import {isTextureSize, readMaxTextureSize} from './readMaxTextureSize.js';
import {TextureAtlas, type TextureAtlasFrame} from './TextureAtlas.js';
import type {TextureCoords} from './TextureCoords.js';
import {TileSet} from './TileSet.js';

/**
 * The name of an animation, a string or a symbol. An animation added without a name, or with the
 * empty string, is given `anim_0`, `anim_1` and so on by {@link FrameBasedAnimations.add}.
 */
export type AnimName = string | symbol;

/**
 * How an animation runs once its frames are through: `'loop'` starts it again, `'once'` holds its
 * last frame, `'pingpong'` runs it back and forth and shows each end frame once per turn —
 * `0 1 2 3 2 1 0 1 …`.
 */
export type AnimationPlayback = 'loop' | 'once' | 'pingpong';

/**
 * The record a {@link FrameBasedAnimations} keeps for each registered animation. A caller reads an
 * animation through {@link FrameBasedAnimations.animation}, which answers a {@link FrameBasedAnimationInfo}.
 */
export interface FrameBasedAnimDef {
  /** The coords of the frames, in the order they are played. */
  frames: TextureCoords[];
  /** Seconds, the frames once through; the sum of `durations` where there are some. */
  duration: number;
  /** The name of the animation. */
  name: AnimName;
  /** The id `add()` answered for the animation: 0 for the first one registered, one more for each after it. */
  id: number;
  /** What the animation does once its frames are through. */
  playback: AnimationPlayback;
  /** Seconds per frame, in the order of `frames`, or `undefined` for an animation of one duration. */
  durations: readonly number[] | undefined;
}

/** What {@link FrameBasedAnimations.animation} answers about a registered animation. Frozen. */
export interface FrameBasedAnimationInfo {
  /**
   * The id `add()` answered for the animation: 0 for the first one registered, one more for each after
   * it. A sprite writes it as its `animId`, and `animation()` reads it back.
   */
  readonly id: number;
  /** The name of the animation. */
  readonly name: AnimName;
  /** How many frames the animation runs through, once. */
  readonly frameCount: number;
  /** Seconds, the frames once through; the sum of `durations` where there are some. */
  readonly duration: number;
  /** What the animation does once its frames are through. */
  readonly playback: AnimationPlayback;
  /** Seconds per frame, or `undefined` for an animation of one duration. */
  readonly durations: readonly number[] | undefined;
  /**
   * The frames, in the order they are played, one per frame of `frameCount`: out of an atlas the
   * frame objects of that atlas, `coords` and `data` — a name listed twice stands here twice —, out
   * of a `TileSet` `tileSet.frame(tileId)`, out of a list of `TextureCoords` `{coords}` without
   * `data`. Frozen, and the same array at every call. The `data` is typed `unknown`: read the data of
   * an Aseprite frame through `isAsepriteFrameData()`.
   */
  readonly frames: readonly TextureAtlasFrame<unknown>[];
  /**
   * Seconds of one cycle: `duration` for `'loop'` and `'once'` — from then on a `'once'` holds its
   * last frame — and the way there and back for `'pingpong'`, which shows each end frame once.
   */
  readonly cycleDuration: number;
}

/** The options of {@link FrameBasedAnimations.bakeDataTexture}. */
export interface BakeTextureOptions {
  /**
   * Gives every frame a second texel, `[width, height, flipDiagonal, endTime]`. A bake with a frame
   * under `TextureCoords.FLIP_DIAGONAL` brings that texel without the option, and so does a bake
   * with a trimmed frame or with an animation of per-frame `durations`.
   */
  includeTextureSize?: boolean;
  /**
   * The widest data texture the bake may build, in texels — a whole number of 1 or more. It takes
   * the place of the limit of `renderer` and of {@link FrameBasedAnimations.MaxTextureSize}.
   */
  maxTextureSize?: number;
  /**
   * The renderer the data texture is meant for. Without a `maxTextureSize` the bake reads the limit
   * of its device — `maxTextureDimension2D` of a WebGPU device, `MAX_TEXTURE_SIZE` of a WebGL2
   * context. A renderer that has not been initialized has no device to ask, and the bake falls back
   * to {@link FrameBasedAnimations.MaxTextureSize}.
   */
  renderer?: WebGPURenderer;
}

/**
 * Timing options for frame-based animations.
 * Provide exactly one of the following:
 * - `duration`: Total animation time in seconds (e.g., 1.0 for 1 second), each frame `duration / frameCount`
 * - `frameRate`: Frames per second (e.g., 10 for 10 FPS). Must be greater than 0.
 * - `durations`: seconds per frame, one for each frame in the order of the frames; the duration of
 *   the animation is their sum. Each is a finite number above zero.
 *
 * When `frameRate` is used, the duration is automatically calculated as:
 * `duration = frameCount / frameRate`
 *
 * Whichever way it is reached, the duration is a finite number at or above zero: a duration of
 * zero is a still image, a negative, infinite or `NaN` duration is refused by `add()`.
 * A `frameRate` that is not a number above zero — `NaN` among them — is refused by `add()` as well.
 * Timing that gives more than one of them is refused by `add()`.
 *
 * `playback` says what happens once the frames are through — see {@link AnimationPlayback}; it
 * defaults to `'loop'`. A ping-pong runs at the same time per frame, so its cycle of
 * `2 · frameCount − 2` frames takes longer than `duration`.
 *
 * @example
 * // Using duration (animation takes 0.5 seconds total)
 * { duration: 0.5 }
 *
 * // Using frameRate (10 frames at 20 fps = 0.5 seconds), played once and held on its last frame
 * { frameRate: 20, playback: 'once' }
 *
 * // A hold on the third frame
 * { durations: [0.05, 0.05, 0.3, 0.1] }
 */
export type AnimationTimingOptions = (
  | {duration: number; frameRate?: never; durations?: never}
  | {duration?: never; frameRate: number; durations?: never}
  | {duration?: never; frameRate?: never; durations: readonly number[]}
) & {playback?: AnimationPlayback};

/**
 * The most frames an animation with per-frame durations holds: the shader finds the frame of such
 * an animation by a binary search of a fixed 13 steps, which covers 8191 frames.
 */
const MAX_FRAMES_WITH_DURATIONS = 8191;

// the name is what tells one entry of an animation map from the next in an error message, and an
// add() that was given none — or the empty string, which counts as none — has nothing else to be
// recognized by
const animNameInError = (name: AnimName | undefined): string => (name ? describeValue(name) : '(no name)');

/**
 * Calculates the duration of an animation based on frame count and frame rate.
 * @param frameCount Number of frames in the animation
 * @param frameRate Frames per second (must be greater than 0)
 * @param name The name of the animation, for the error
 * @returns Duration in seconds
 * @throws Error if frameRate is not a number above 0, `NaN` among them
 */
const calculateDurationFromFrameRate = (frameCount: number, frameRate: number, name: AnimName | undefined): number => {
  // The type first: a string such as `"12"` passes `> 0` by coercion and would divide as a number,
  // where a duration of `"1"` is refused. And `!(frameRate > 0)` rather than `frameRate <= 0` —
  // every comparison with `NaN` is false, and only this form refuses a `NaN` here, where the error
  // can name the frameRate instead of the duration it would turn into
  if (typeof frameRate !== 'number' || !(frameRate > 0)) {
    throw new Error(
      `FrameBasedAnimations: add() got a frameRate of ${describeValue(frameRate)} for the animation ${animNameInError(name)} — a frameRate is a number above zero`,
    );
  }
  return frameCount / frameRate;
};

interface ResolvedTiming {
  duration: number;
  durations: readonly number[] | undefined;
  playback: AnimationPlayback;
}

/**
 * Extracts the duration, the per-frame durations and the playback from timing options,
 * calculating the duration from a frameRate or summing the durations if necessary.
 * @param timing Either a duration number or AnimationTimingOptions object
 * @param frameCount Number of frames (required when using frameRate or durations)
 * @param name The name of the animation, for the error
 * @throws Error if neither duration, frameRate nor durations is provided, for timing that gives more
 *   than one of `duration`, `frameRate` and `durations`, for durations that do not give each frame a
 *   duration above zero, and for a playback that is none of the three
 */
const resolveTiming = (
  timing: number | AnimationTimingOptions,
  frameCount: number,
  name: AnimName | undefined,
): ResolvedTiming => {
  if (typeof timing === 'number') {
    return {duration: timing, durations: undefined, playback: 'loop'};
  }

  // a catalog is json, so the playback is checked rather than trusted to the type; absent is
  // `undefined`, a `null` is a playback of the wrong kind
  const playback: unknown = timing.playback === undefined ? 'loop' : timing.playback;
  if (!isAnimationPlayback(playback)) {
    throw new Error(
      `FrameBasedAnimations: add() got a playback of ${describeValue(playback)} for the animation ${animNameInError(name)} — a playback is 'loop', 'once' or 'pingpong'`,
    );
  }

  // the type allows one of the three, and a catalog is json: a second field would be dropped
  // without a word — the frameRate branch comes first and would win — so it is refused
  const given = [
    'durations' in timing && timing.durations !== undefined ? 'durations' : undefined,
    'duration' in timing && timing.duration !== undefined ? 'a duration' : undefined,
    'frameRate' in timing && timing.frameRate !== undefined ? 'a frameRate' : undefined,
  ].filter((field) => field !== undefined);
  if (given.length > 1) {
    const fields = given.length === 2 ? `${given[0]} and ${given[1]}` : `${given[0]}, ${given[1]} and ${given[2]}`;
    throw new Error(
      `FrameBasedAnimations: add() got ${fields} for the animation ${animNameInError(name)} — give one of duration, frameRate and durations`,
    );
  }

  if ('durations' in timing && timing.durations !== undefined) {
    const durations = resolveDurations(timing.durations, frameCount, name);
    return {duration: durations.reduce((sum, value) => sum + value, 0), durations, playback};
  }
  if ('frameRate' in timing && timing.frameRate !== undefined) {
    return {
      duration: calculateDurationFromFrameRate(frameCount, timing.frameRate, name),
      durations: undefined,
      playback,
    };
  }
  if ('duration' in timing && timing.duration !== undefined) {
    return {duration: timing.duration, durations: undefined, playback};
  }
  throw new Error(
    `FrameBasedAnimations: add() got neither a duration nor a frameRate for the animation ${animNameInError(name)}`,
  );
};

// every frame gets a duration above zero: a frame of no time is never shown, and the shader walks
// the end times of the frames, which have to rise
const resolveDurations = (durations: unknown, frameCount: number, name: AnimName | undefined): readonly number[] => {
  if (!Array.isArray(durations)) {
    throw new Error(
      `FrameBasedAnimations: add() got durations of ${describeValue(durations)} for the animation ${animNameInError(name)} — durations is an array of seconds, one per frame`,
    );
  }
  if (durations.length !== frameCount) {
    throw new Error(
      `FrameBasedAnimations: add() got ${durations.length} durations for the ${frameCount} frames of the animation ${animNameInError(name)} — give one duration per frame`,
    );
  }
  if (frameCount > MAX_FRAMES_WITH_DURATIONS) {
    throw new Error(
      `FrameBasedAnimations: add() got ${frameCount} frames with durations for the animation ${animNameInError(name)} — an animation with per-frame durations holds at most ${MAX_FRAMES_WITH_DURATIONS} frames; split it`,
    );
  }
  durations.forEach((value: unknown, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || !(value > 0)) {
      throw new Error(
        `FrameBasedAnimations: add() got a duration of ${describeValue(value)} at index ${index} for the animation ${animNameInError(name)} — a frame duration is a finite number of seconds above zero`,
      );
    }
  });
  // a copy, frozen: the caller keeps its array, and animation() hands this one out
  return Object.freeze(durations.slice() as number[]);
};

/**
 * The seconds of one cycle of an animation: its duration, except for a ping-pong, whose way back
 * shows every frame but the two ends once more.
 */
const cycleDurationOf = ({playback, duration, durations, frames}: FrameBasedAnimDef): number => {
  const frameCount = frames.length;
  if (playback !== 'pingpong' || frameCount < 2) return duration;
  if (durations) return 2 * duration - durations[0]! - durations[frameCount - 1]!;
  return ((2 * frameCount - 2) / frameCount) * duration;
};

const FRAME_NAME_ORDER = new Intl.Collator('en', {numeric: true});

// the trim margins of the frames and the frames as animation() hands them out, both in the order of
// `frames`, travel beside the definition
type AnimEntry = FrameBasedAnimDef & {trims: FrameTrimMargins[]; atlasFrames: readonly TextureAtlasFrame<unknown>[]};

type AnimationsMap = Map<AnimName, AnimEntry>;

// the default is read at the call, after the class below has been initialized
const getBufferSize = (
  animationsMap: AnimationsMap,
  texelsPerFrame = 1,
  maxTextureSize = FrameBasedAnimations.MaxTextureSize,
) => {
  const anims = Array.from(animationsMap.values());
  const totalFramesCount = anims.reduce((sum, anim) => sum + anim.frames.length, 0);
  // a header for each animation, its frames, and its second header behind them
  const minBufSize = anims.length * 2 + totalFramesCount * texelsPerFrame;
  const bufSize = findNextPowerOf2(minBufSize);

  if (bufSize > maxTextureSize) {
    throw new Error(
      `FrameBasedAnimations: ${totalFramesCount} frame(s) in ${anims.length} animation(s) ask for a data texture of ${bufSize} texels, over the maximum of ${maxTextureSize}`,
    );
  }

  return bufSize;
};

// the first component of the second header texel, read by `AnimatedFrames`
const PLAYBACK_CODE: Record<AnimationPlayback, number> = {loop: 0, once: 1, pingpong: 2};

// the fourth component of a second header texel. No texel of the layout before it carries a
// fourth component below -1: a header carries its texelsPerFrame, a size texel 0, trim margins
// fractions of 0 to 1 — and the tex coords their `v`, which is negative for a frame with
// FLIP_VERTICAL (every frame TexturePacker turned) and -1 for one that is as high as its image. A
// reader tells a second header by a fourth component below -1.5
const SECOND_HEADER_MARK = -2;

const renderFloatsBuffer = (
  floatsBuffer: Float32Array,
  names: AnimName[],
  animations: AnimationsMap,
  texelsPerFrame: 1 | 2 | 3,
) => {
  let offset = names.length * 4;

  for (const name of names) {
    const anim = animations.get(name)!;
    const {frames, trims, durations} = anim;
    const firstFrameTexel = offset / 4;

    floatsBuffer.set([frames.length, anim.duration, firstFrameTexel, texelsPerFrame], anim.id * 4);

    let endTime = 0;
    frames.forEach((coords, i) => {
      // the end of the frame within the animation, for the walk of the shader over the frames of an
      // animation with durations; 0 for every other
      if (durations) endTime += durations[i]!;
      writeFrameTexels(floatsBuffer, offset, coords, texelsPerFrame, trims[i]!, durations ? endTime : 0);
      offset += texelsPerFrame * 4;
    });

    floatsBuffer.set([PLAYBACK_CODE[anim.playback], durations ? 1 : 0, cycleDurationOf(anim), SECOND_HEADER_MARK], offset);
    offset += 4;
  }

  return floatsBuffer;
};

/**
 * Registers animations over the frames of a {@link TextureAtlas}, of a {@link TileSet} or of a list of
 * {@link TextureCoords}, and bakes them into a data texture that `AnimatedFrames` reads.
 */
export class FrameBasedAnimations {
  /**
   * The widest data texture a bake builds when it is told no limit: 8192 texels, the
   * `maxTextureDimension2D` every WebGPU device offers. A WebGL2 device offers only 2048 — a bake
   * that is handed its renderer, `bakeDataTexture({renderer})`, gets the limit of that device.
   *
   * It is also the upper bound of a `tileCount` in {@link FrameBasedAnimations.add}.
   *
   * Read-only: a bake takes a limit of its own through `maxTextureSize` or `renderer` of
   * {@link BakeTextureOptions}, a `FrameTable` through the same options of its `bakeDataTexture()`.
   */
  static readonly MaxTextureSize: number = 8192;

  /**
   * The most frames an animation with per-frame `durations` holds: `AnimatedFrames` finds the frame
   * of such an animation by a binary search of a fixed 13 steps, which covers 8191 frames.
   */
  static readonly MaxFramesWithDurations: number = MAX_FRAMES_WITH_DURATIONS;

  #animations: AnimationsMap = new Map();

  // NOTE we can not just use animations.keys() here, because we need a consistent name <-> id mapping
  #names: AnimName[] = [];

  #anonymousCounter = 0;

  /**
   * Register an animation and return its id.
   *
   * The frames come from an array of `TextureCoords`, from a `TileSet` — by tile ids or by
   * a range — or from a `TextureAtlas`.
   *
   * Out of an atlas only the frames carrying a string name go into the animation, and they
   * run in the order a numeric collation puts their names in: `walk.2` before `walk.10`.
   * Names that collation ranks equal — `walk.01` beside `walk.1` — keep the order the atlas
   * registered them in. A `frameNameQuery`, a pattern as a string or as a `RegExp`, narrows
   * the set to the names it matches. An array of frames is copied: a change to it after the call
   * leaves the animation as it was registered.
   *
   * The frames out of an atlas bring their trim margins along, read from `spriteSourceSize` and
   * `sourceSize` of their data; frames out of a `TileSet` or a list of `TextureCoords` are untrimmed.
   *
   * An animation carries at least one frame and a duration that is a finite number at or above
   * zero — zero being a still image. A set of frames that comes out empty, an atlas query that
   * matches nothing among them, and a duration that is negative, `NaN` or infinite are each
   * refused with an error naming the case, as are a `frameRate` that is not a number above zero,
   * timing that carries neither a `duration` nor a `frameRate`, and timing that gives more than one
   * of `duration`, `frameRate` and `durations`.
   *
   * What picks the frames is refused as well when it cannot pick any: a tile id that is no whole
   * number, naming its index; a `firstTileId` that is no whole number; a `tileCount` that is no
   * whole number from 1 to {@link FrameBasedAnimations.MaxTextureSize} — more frames fit into no
   * data texture; and a `frameNameQuery` that is neither a string nor a `RegExp`. Tile ids and a
   * `firstTileId` may be negative, the tile set wraps them. `firstTileId` and `tileCount` are
   * checked only when they are passed: their defaults come from the tile set, which may hold more
   * tiles than `MaxTextureSize`.
   *
   * A name is registered once; a second animation under the same name is refused with an
   * error. An animation added without a name is given one — `anim_0`, `anim_1`, and so on,
   * stepping over every name already taken — so it is reachable through `animId()` like
   * any other. The empty string counts as no name: an animation added under it gets a name of the
   * counter too, `hasAnimation('')` answers `false`, and `animId('')` throws as it does for any
   * name that was never registered. The counter moves for an animation that was registered: an
   * `add()` that throws spends no name.
   */
  add(
    ...args:
      | [name: AnimName | undefined, timing: number | AnimationTimingOptions, texCoords: TextureCoords[]]
      | [
          name: AnimName | undefined,
          timing: number | AnimationTimingOptions,
          atlas: TextureAtlas<unknown>,
          frameNameQuery?: string | RegExp,
        ]
      | [
          name: AnimName | undefined,
          timing: number | AnimationTimingOptions,
          atlas: TextureAtlas<unknown>,
          frameNames: readonly string[],
        ]
      | [
          name: AnimName | undefined,
          timing: number | AnimationTimingOptions,
          tileSet: TileSet<unknown>,
          firstTileId?: number,
          tileCount?: number,
        ]
      | [name: AnimName | undefined, timing: number | AnimationTimingOptions, tileSet: TileSet<unknown>, tileIds: number[]]
  ): number {
    let [name] = args;

    // the empty string is no name, so there is nothing for the uniqueness check to compare
    if (name && this.#animations.has(name)) {
      throw new Error(
        `FrameBasedAnimations: add() got the name ${animNameInError(name)}, which another animation already carries — an animation name must be unique`,
      );
    }

    let frames: TextureCoords[];
    let trims: FrameTrimMargins[] | undefined;
    let atlasFrames: TextureAtlasFrame<unknown>[] | undefined;

    if (Array.isArray(args[2])) {
      // the caller keeps its array and may change it later; the checks below and the bake see what
      // was registered, so the animation gets a copy
      frames = args[2].slice();
    } else if (args[2] instanceof TextureAtlas && Array.isArray(args[3])) {
      // a list of names picks the frames in its order, a name as often as it is named: the frames
      // of an Aseprite tag are a range of frames, not a pattern of names, and a reversed tag runs
      // the range backwards
      const atlas = args[2];
      const picked = (args[3] as readonly unknown[]).map((frameName, index) => {
        if (typeof frameName !== 'string') {
          throw new Error(
            `FrameBasedAnimations: add() got a frame name of ${describeValue(frameName)} at index ${index} for the animation ${animNameInError(name)} — a frame name is a string`,
          );
        }
        const frame = atlas.frame(frameName);
        if (frame == null) {
          throw new Error(
            `FrameBasedAnimations: add() got the frame name "${frameName}" at index ${index} for the animation ${animNameInError(name)}, which the atlas does not carry`,
          );
        }
        return frame;
      });
      frames = picked.map(({coords}) => coords);
      trims = picked.map(({data}) => frameTrimMargins(data));
      atlasFrames = picked;
    } else if (args[2] instanceof TextureAtlas) {
      const atlas = args[2];
      const query: unknown = args[3];
      // a query of any other kind is refused rather than dropped: without a query the atlas hands
      // out every frame it has
      if (query !== undefined && typeof query !== 'string' && !(query instanceof RegExp)) {
        throw new Error(
          `FrameBasedAnimations: add() got a frameNameQuery of ${describeValue(query)} for the animation ${animNameInError(name)} — a frameNameQuery is a string or a RegExp`,
        );
      }
      // from here the query is a pattern as a string, a RegExp or no query at all — both forms
      // of a pattern reach the atlas, whose `frameNames()` takes either
      const frameNameQuery = query;
      // Only string names go into an animation: a frame registered under a symbol has no
      // place in an ordered sequence, and the default comparator of Array#sort() converts
      // every value to a string, which throws on a symbol.
      // The collator orders "walk.2" before "walk.10"; the frames of an animation are a
      // sequence, and a plain lexicographic order breaks it for every name that carries an
      // unpadded number. Names it ranks equal keep the order the atlas registered them in,
      // because Array#sort() is stable.
      const frameNames = atlas
        .frameNames(frameNameQuery)
        .filter((frameName) => typeof frameName === 'string')
        .sort(FRAME_NAME_ORDER.compare);
      // every name here came out of `frameNames()` of this very atlas, so it is registered there
      const picked = frameNames.map((frameName) => atlas.frame(frameName)!);
      frames = picked.map(({coords}) => coords);
      trims = picked.map(({data}) => frameTrimMargins(data));
      atlasFrames = picked;
    } else if (args[2] instanceof TileSet) {
      const tileSet = args[2];
      if (Array.isArray(args[3])) {
        const tileIds = args[3];
        // a tile id that is no whole number finds no frame, and a string is concatenated, not added
        tileIds.forEach((tileId: unknown, index) => {
          if (!Number.isInteger(tileId)) {
            throw new Error(
              `FrameBasedAnimations: add() got a tileId of ${describeValue(tileId)} at index ${index} for the animation ${animNameInError(name)} — a tileId is a whole number`,
            );
          }
        });
        atlasFrames = tileIds.map((tileId) => tileSet.frame(tileId));
        frames = atlasFrames.map(({coords}) => coords);
      } else {
        // only what was passed is checked: the defaults come from the tile set, which may hold
        // more tiles than a data texture can, and an add() that is never baked is legitimate
        if (args[3] !== undefined && !Number.isInteger(args[3])) {
          throw new Error(
            `FrameBasedAnimations: add() got a firstTileId of ${describeValue(args[3])} for the animation ${animNameInError(name)} — a firstTileId is a whole number`,
          );
        }
        // the upper bound keeps the loop below finite: more frames than this fit into no data
        // texture, and the exact capacity is left to bakeDataTexture()
        const maxTileCount = FrameBasedAnimations.MaxTextureSize;
        if (args[4] !== undefined && (!Number.isInteger(args[4]) || args[4] < 1 || args[4] > maxTileCount)) {
          throw new Error(
            `FrameBasedAnimations: add() got a tileCount of ${describeValue(args[4])} for the animation ${animNameInError(name)} — a tileCount is a whole number from 1 to ${maxTileCount}`,
          );
        }
        const firstTileId = (args[3] as number | undefined) ?? tileSet.firstId;
        const tileCount: number = args[4] ?? tileSet.tileCount;
        atlasFrames = [];
        for (let tileId = firstTileId; tileId < firstTileId + tileCount; tileId++) {
          atlasFrames.push(tileSet.frame(tileId));
        }
        frames = atlasFrames.map(({coords}) => coords);
      }
    } else {
      throw new Error(
        `FrameBasedAnimations: add() got a third argument of ${describeValue(args[2])} for the animation ${animNameInError(name)} — the third argument is a TextureAtlas, a TileSet or an array of frames`,
      );
    }

    // only the frames of an atlas carry data to read margins from
    trims ??= frames.map((): FrameTrimMargins => [0, 0, 0, 0]);
    // a list of coords names no frame of an atlas: each becomes a frame without data
    atlasFrames ??= frames.map((coords) => ({coords}));

    const id = this.#names.length;

    // an animation of no frames writes a frame count of 0 into the data texture, which no shader
    // can read a frame out of. The guard sits behind the branches, because all four of them can
    // arrive here empty
    if (frames.length === 0) {
      throw new Error(
        `FrameBasedAnimations: add() got no frames for the animation ${animNameInError(name)} — an atlas query without a match, an empty tile range or an empty frame list registers nothing`,
      );
    }

    const timing = args[1];
    const {duration, durations, playback} = resolveTiming(timing, frames.length, name);

    // the duration divides the animation time in the shader: zero is a still image, everything
    // below it and everything that is no number at all is a configuration error
    if (!Number.isFinite(duration) || duration < 0) {
      throw new Error(
        `FrameBasedAnimations: add() got a duration of ${describeValue(duration)} for the animation ${animNameInError(name)} — a duration is a finite number at or above zero`,
      );
    }

    // the counter hands out a name only once the animation can be built: an add() that throws
    // spends none, and the names follow the animations that were registered. The empty string
    // counts as no name and gets one from the counter as well
    if (!name) {
      name = this.#nextAnonymousName();
    }

    this.#names.push(name);
    this.#animations.set(name, {
      id,
      name,
      frames,
      duration,
      playback,
      durations,
      trims,
      atlasFrames: Object.freeze(atlasFrames),
    });

    return id;
  }

  // a name handed out here goes into the same lookup as one the caller picked, so it has to
  // step over every name that is already taken — the counter alone cannot promise a free one
  #nextAnonymousName(): string {
    let name = `anim_${this.#anonymousCounter++}`;
    while (this.#animations.has(name)) {
      name = `anim_${this.#anonymousCounter++}`;
    }
    return name;
  }

  /**
   * The id of a registered animation. A name that was never registered is an error,
   * not an absent value: the id goes straight into a typed vertex-object buffer, where
   * an `undefined` would quietly become `NaN`. Ask `hasAnimation()` first when the name
   * comes from outside.
   */
  animId(name: AnimName): number {
    const anim = this.#animations.get(name);
    if (anim == null) {
      throw new Error(`FrameBasedAnimations: there is no animation named ${describeValue(name)}`);
    }
    return anim.id;
  }

  /** Whether an animation is registered under this name. */
  hasAnimation(name: AnimName): boolean {
    return this.#animations.has(name);
  }

  /**
   * What a registered animation is, by its name or its id: frame count, frames, duration, playback,
   * per-frame durations and the length of one cycle — `cycleDuration` is when a `'once'` animation
   * started at `animOffset = -now` reaches its last frame. A frozen object, built per call.
   *
   * Like {@link FrameBasedAnimations.animId}, an animation that was never registered is an error.
   */
  animation(nameOrId: AnimName | number): FrameBasedAnimationInfo {
    const anim =
      typeof nameOrId === 'number' ? this.#animations.get(this.#names[nameOrId] as AnimName) : this.#animations.get(nameOrId);
    if (anim == null) {
      throw new Error(
        typeof nameOrId === 'number'
          ? `FrameBasedAnimations: there is no animation of the id ${nameOrId}`
          : `FrameBasedAnimations: there is no animation named ${describeValue(nameOrId)}`,
      );
    }
    return Object.freeze({
      id: anim.id,
      name: anim.name,
      frameCount: anim.frames.length,
      duration: anim.duration,
      playback: anim.playback,
      durations: anim.durations,
      frames: anim.atlasFrames,
      cycleDuration: cycleDurationOf(anim),
    });
  }

  /**
   * A copy with the same animations under the same names and ids, which goes on with the counter of
   * anonymous names where this one stands. An animation added to either afterwards leaves the other
   * alone. A registered animation is never changed, so the copy shares its frames.
   */
  clone(): FrameBasedAnimations {
    const copy = new FrameBasedAnimations();
    copy.#animations = new Map(this.#animations);
    copy.#names = this.#names.slice();
    copy.#anonymousCounter = this.#anonymousCounter;
    return copy;
  }

  /**
   * Bake every registered animation into a `DataTexture`, the `animsMap` a material reads the
   * frames from.
   *
   * The texture is one row of RGBA float texels, as many as the smallest power of 2 that holds
   * the texels the animations take. Its layout is the contract between this method and every reader:
   *
   * - texels `0` to `n - 1`, one for each of the `n` animations in the order of their ids:
   *   `[frameCount, duration, first frame texel, texelsPerFrame]`
   * - from texel `n` on, for each animation in the order of the ids, its frames one after the
   *   other, `texelsPerFrame` texels each, and behind them its second header texel
   * - the texels of a frame: first `[s, t, u, v]` as `TextureCoords#getTexCoords()` answers them,
   *   and with two texels a second one, `[width, height, flipDiagonal, endTime]` — `width` and
   *   `height` the measures of the area in the image as `TextureCoords` holds them, `flipDiagonal`
   *   `1` for a frame with `TextureCoords.FLIP_DIAGONAL` and `0` otherwise, `endTime` the end of the
   *   frame within its animation in seconds for an animation with `durations` and `0` for any
   *   other — and with three texels a third one, `[left, top, right, bottom]`: the trim margins of
   *   the frame as fractions of the untrimmed sprite — `left` and `right` of its width, `top` and
   *   `bottom` of its height, `top` counted from the top — and `0` at every side for an untrimmed
   *   frame of the same bake
   * - the second header texel of an animation, at `first frame texel + frameCount · texelsPerFrame`:
   *   `[playback, hasDurations, cycleDuration, -2]` — `playback` `0` for `'loop'`, `1` for `'once'`,
   *   `2` for `'pingpong'`; `hasDurations` `1` for an animation with `durations`; `cycleDuration` as
   *   {@link FrameBasedAnimations.animation} answers it; the `-2` marks it. No texel of a header or a
   *   frame carries a fourth component below `-1`: the `v` of the tex coords is negative for a frame
   *   with `FLIP_VERTICAL` — every frame TexturePacker turned — and `-1` for one as high as its
   *   image, but a frame that lies within its image goes no further
   * - `texelsPerFrame` is `3` when a registered frame is trimmed, else `2` when
   *   `includeTextureSize` is set, a registered frame carries `FLIP_DIAGONAL` or an animation has
   *   `durations`, and `1` otherwise — the same for every animation of a bake
   *
   * The texture is at most as wide as the device it is meant for can take: `options.maxTextureSize`
   * when it is given, else the limit of the device of `options.renderer`, else
   * {@link FrameBasedAnimations.MaxTextureSize}. A bake that needs a wider texture is refused with
   * an error that names the frames, the width they ask for and the limit. A `maxTextureSize` that
   * is no whole number of 1 or more is refused with a `RangeError`.
   *
   * Every call builds a new `DataTexture` and keeps no reference to it: the caller owns it and
   * disposes it. A material it is handed to as `animsMap` borrows it and does not dispose it.
   */
  bakeDataTexture(options?: BakeTextureOptions): DataTexture {
    const givenMaxTextureSize = options?.maxTextureSize;
    if (givenMaxTextureSize !== undefined && !isTextureSize(givenMaxTextureSize)) {
      throw new RangeError(
        `FrameBasedAnimations: bakeDataTexture() got a maxTextureSize of ${describeValue(givenMaxTextureSize)} — a maxTextureSize is a whole number of 1 or more`,
      );
    }
    const maxTextureSize =
      givenMaxTextureSize ??
      (options?.renderer ? readMaxTextureSize(options.renderer) : undefined) ??
      FrameBasedAnimations.MaxTextureSize;

    const anims = Array.from(this.#animations.values());
    // a turned frame needs the second texel to carry its diagonal flip to the shader, and a frame of
    // an animation with durations to carry its end time
    const hasTurnedFrame = anims.some(({frames}) => frames.some((coords) => coords.flipD));
    const hasDurations = anims.some(({durations}) => durations !== undefined);
    // a trimmed frame needs the third texel for its margins, and brings the second along with it
    const hasTrimmedFrame = anims.some(({trims}) => trims.some((margins) => margins.some((margin) => margin !== 0)));
    const texelsPerFrame = hasTrimmedFrame ? 3 : options?.includeTextureSize || hasTurnedFrame || hasDurations ? 2 : 1;

    const bufSize = getBufferSize(this.#animations, texelsPerFrame, maxTextureSize);

    const floatsBuffer = renderFloatsBuffer(new Float32Array(bufSize * 4), this.#names, this.#animations, texelsPerFrame);

    const dataTexture = new DataTexture(floatsBuffer, bufSize, 1, RGBAFormat, FloatType);
    dataTexture.needsUpdate = true;

    return dataTexture;
  }
}
