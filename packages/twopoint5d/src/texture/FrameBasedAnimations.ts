import {DataTexture, FloatType, RGBAFormat} from 'three/webgpu';
import {describeValue} from '../utils/describeValue.js';
import {findNextPowerOf2} from '../utils/findNextPowerOf2.js';
import {frameTrimMargins, type FrameTrimMargins} from './frameTrimMargins.js';
import {TextureAtlas} from './TextureAtlas.js';
import type {TextureCoords} from './TextureCoords.js';
import {TileSet} from './TileSet.js';

export type AnimName = string | symbol;

export interface FrameBasedAnimDef {
  frames: TextureCoords[];
  duration: number;
  name: AnimName;
  id: number;
}

export interface BakeTextureOptions {
  /**
   * Gives every frame a second texel, `[width, height, flipDiagonal, 0]`. A bake with a frame under
   * `TextureCoords.FLIP_DIAGONAL` brings that texel without the option, and so does a bake with a
   * trimmed frame.
   */
  includeTextureSize: boolean;
}

/**
 * Timing options for frame-based animations.
 * Provide exactly one of the following:
 * - `duration`: Total animation time in seconds (e.g., 1.0 for 1 second)
 * - `frameRate`: Frames per second (e.g., 10 for 10 FPS). Must be greater than 0.
 *
 * When `frameRate` is used, the duration is automatically calculated as:
 * `duration = frameCount / frameRate`
 *
 * Whichever way it is reached, the duration is a finite number at or above zero: a duration of
 * zero is a still image, a negative, infinite or `NaN` duration is refused by `add()`.
 * A `frameRate` that is not a number above zero — `NaN` among them — is refused by `add()` as well.
 *
 * @example
 * // Using duration (animation takes 0.5 seconds total)
 * { duration: 0.5 }
 *
 * // Using frameRate (10 frames at 20 fps = 0.5 seconds)
 * { frameRate: 20 }
 */
export type AnimationTimingOptions = {duration: number; frameRate?: never} | {duration?: never; frameRate: number};

// the name is what tells one entry of an animation map from the next in an error message, and an
// add() that was given none has nothing else to be recognized by
const animNameInError = (name: AnimName | undefined): string => name?.toString() ?? '(no name)';

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
      `FrameBasedAnimations: add() got a frameRate of ${describeValue(frameRate)} for the animation \`${animNameInError(name)}\` — a frameRate is a number above zero`,
    );
  }
  return frameCount / frameRate;
};

/**
 * Extracts the duration from timing options, calculating from frameRate if necessary.
 * @param timing Either a duration number or AnimationTimingOptions object
 * @param frameCount Number of frames (required when using frameRate)
 * @param name The name of the animation, for the error
 * @returns Duration in seconds
 * @throws Error if neither duration nor frameRate is provided
 */
const resolveDuration = (timing: number | AnimationTimingOptions, frameCount: number, name: AnimName | undefined): number => {
  if (typeof timing === 'number') {
    return timing;
  }
  if ('frameRate' in timing && timing.frameRate !== undefined) {
    return calculateDurationFromFrameRate(frameCount, timing.frameRate, name);
  }
  if ('duration' in timing && timing.duration !== undefined) {
    return timing.duration;
  }
  throw new Error(
    `FrameBasedAnimations: add() got neither a duration nor a frameRate for the animation \`${animNameInError(name)}\``,
  );
};

const FRAME_NAME_ORDER = new Intl.Collator('en', {numeric: true});

// the trim margins of the frames, in the order of `frames`, travel beside the definition
type AnimEntry = FrameBasedAnimDef & {trims: FrameTrimMargins[]};

type AnimationsMap = Map<AnimName, AnimEntry>;

// the default is read at the call, after the class below has been initialized
const getBufferSize = (
  animationsMap: AnimationsMap,
  texelsPerFrame = 1,
  maxTextureSize = FrameBasedAnimations.MaxTextureSize,
) => {
  const anims = Array.from(animationsMap.values());
  const totalFramesCount = anims.reduce((sum, anim) => sum + anim.frames.length, 0);
  const minBufSize = anims.length + totalFramesCount * texelsPerFrame;
  const bufSize = findNextPowerOf2(minBufSize);

  if (bufSize > maxTextureSize) {
    throw new Error(
      `FrameBasedAnimations: ${totalFramesCount} frame(s) in ${anims.length} animation(s) ask for a data texture of ${bufSize} texels, over the maximum of ${maxTextureSize}`,
    );
  }

  return bufSize;
};

const renderFloatsBuffer = (
  floatsBuffer: Float32Array,
  names: AnimName[],
  animations: AnimationsMap,
  texelsPerFrame: 1 | 2 | 3,
) => {
  let curOffset = names.length;

  floatsBuffer.set(
    names.flatMap((name) => {
      const {frames, duration} = animations.get(name)!;
      const offset = curOffset;
      curOffset += frames.length * texelsPerFrame;
      return [frames.length, duration, offset, texelsPerFrame];
    }),
  );

  floatsBuffer.set(
    names.flatMap((name) => {
      const {frames, trims} = animations.get(name)!;
      return frames.flatMap((coords, i) => {
        const texels: number[] = coords.getTexCoords();
        if (texelsPerFrame >= 2) texels.push(coords.width, coords.height, coords.flipD ? 1 : 0, 0);
        if (texelsPerFrame === 3) texels.push(...trims[i]!);
        return texels;
      });
    }),
    names.length * 4,
  );

  return floatsBuffer;
};

export class FrameBasedAnimations {
  static MaxTextureSize = 16384;

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
   * refused with an error naming the case, as are a `frameRate` that is not a number above zero
   * and timing that carries neither a `duration` nor a `frameRate`.
   *
   * What picks the frames is refused as well when it cannot pick any: a tile id that is no whole
   * number, naming its index; a `firstTileId` that is no whole number; a `tileCount` that is no
   * whole number from 1 to {@link FrameBasedAnimations.MaxTextureSize}, as read at the call —
   * more frames fit into no data texture; and a `frameNameQuery` that is neither a string nor a
   * `RegExp`. Tile ids and a `firstTileId` may be negative, the tile set wraps them. `firstTileId`
   * and `tileCount` are checked only when they are passed: their defaults come from the tile set,
   * which may hold more tiles than `MaxTextureSize`.
   *
   * A name is registered once; a second animation under the same name is refused with an
   * error. An animation added without a name is given one — `anim_0`, `anim_1`, and so on,
   * stepping over every name already taken — so it is reachable through `animId()` like
   * any other. The counter moves for an animation that was registered: an `add()` that throws
   * spends no name.
   */
  add(
    ...args:
      | [name: AnimName | undefined, timing: number | AnimationTimingOptions, texCoords: TextureCoords[]]
      | [
          name: AnimName | undefined,
          timing: number | AnimationTimingOptions,
          atlas: TextureAtlas,
          frameNameQuery?: string | RegExp,
        ]
      | [
          name: AnimName | undefined,
          timing: number | AnimationTimingOptions,
          tileSet: TileSet,
          firstTileId?: number,
          tileCount?: number,
        ]
      | [name: AnimName | undefined, timing: number | AnimationTimingOptions, tileSet: TileSet, tileIds: number[]]
  ): number {
    let [name] = args;

    if (name && this.#animations.has(name)) {
      throw new Error(
        `FrameBasedAnimations: add() got the name \`${animNameInError(name)}\`, which another animation already carries — an animation name must be unique`,
      );
    }

    let frames: TextureCoords[];
    let trims: FrameTrimMargins[] | undefined;

    if (Array.isArray(args[2])) {
      // the caller keeps its array and may change it later; the checks below and the bake see what
      // was registered, so the animation gets a copy
      frames = args[2].slice();
    } else if (args[2] instanceof TextureAtlas) {
      const atlas = args[2];
      const query: unknown = args[3];
      // a query of any other kind is refused rather than dropped: without a query the atlas hands
      // out every frame it has
      if (query !== undefined && typeof query !== 'string' && !(query instanceof RegExp)) {
        throw new Error(
          `FrameBasedAnimations: add() got a frameNameQuery of ${describeValue(query)} for the animation \`${animNameInError(name)}\` — a frameNameQuery is a string or a RegExp`,
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
      const atlasFrames = frameNames.map((frameName) => atlas.frame(frameName)!);
      frames = atlasFrames.map(({coords}) => coords);
      trims = atlasFrames.map(({data}) => frameTrimMargins(data));
    } else if (args[2] instanceof TileSet) {
      const tileSet = args[2];
      if (Array.isArray(args[3])) {
        const tileIds = args[3];
        // a tile id that is no whole number finds no frame, and a string is concatenated, not added
        tileIds.forEach((tileId: unknown, index) => {
          if (!Number.isInteger(tileId)) {
            throw new Error(
              `FrameBasedAnimations: add() got a tileId of ${describeValue(tileId)} at index ${index} for the animation \`${animNameInError(name)}\` — a tileId is a whole number`,
            );
          }
        });
        frames = tileIds.map((tileId) => tileSet.frame(tileId).coords);
      } else {
        // only what was passed is checked: the defaults come from the tile set, which may hold
        // more tiles than a data texture can, and an add() that is never baked is legitimate
        if (args[3] !== undefined && !Number.isInteger(args[3])) {
          throw new Error(
            `FrameBasedAnimations: add() got a firstTileId of ${describeValue(args[3])} for the animation \`${animNameInError(name)}\` — a firstTileId is a whole number`,
          );
        }
        // the upper bound keeps the loop below finite: more frames than this fit into no data
        // texture, and the exact capacity is left to bakeDataTexture()
        const maxTileCount = FrameBasedAnimations.MaxTextureSize;
        if (args[4] !== undefined && (!Number.isInteger(args[4]) || args[4] < 1 || args[4] > maxTileCount)) {
          throw new Error(
            `FrameBasedAnimations: add() got a tileCount of ${describeValue(args[4])} for the animation \`${animNameInError(name)}\` — a tileCount is a whole number from 1 to ${maxTileCount}`,
          );
        }
        const firstTileId = (args[3] as number | undefined) ?? tileSet.firstId;
        const tileCount: number = args[4] ?? tileSet.tileCount;
        frames = [];
        for (let tileId = firstTileId; tileId < firstTileId + tileCount; tileId++) {
          frames.push(tileSet.frame(tileId).coords);
        }
      }
    } else {
      throw new Error(
        `FrameBasedAnimations: add() got a third argument of ${describeValue(args[2])} for the animation \`${animNameInError(name)}\` — the third argument is a TextureAtlas, a TileSet or an array of frames`,
      );
    }

    // only the frames of an atlas carry data to read margins from
    trims ??= frames.map((): FrameTrimMargins => [0, 0, 0, 0]);

    const id = this.#names.length;

    // an animation of no frames writes a frame count of 0 into the data texture, which no shader
    // can read a frame out of. The guard sits behind the branches, because all four of them can
    // arrive here empty
    if (frames.length === 0) {
      throw new Error(
        `FrameBasedAnimations: add() got no frames for the animation \`${animNameInError(name)}\` — an atlas query without a match, an empty tile range or an empty frame list registers nothing`,
      );
    }

    const timing = args[1];
    const duration = resolveDuration(timing, frames.length, name);

    // the duration divides the animation time in the shader: zero is a still image, everything
    // below it and everything that is no number at all is a configuration error
    if (!Number.isFinite(duration) || duration < 0) {
      throw new Error(
        `FrameBasedAnimations: add() got a duration of ${describeValue(duration)} for the animation \`${animNameInError(name)}\` — a duration is a finite number at or above zero`,
      );
    }

    // the counter hands out a name only once the animation can be built: an add() that throws
    // spends none, and the names follow the animations that were registered
    if (!name) {
      name = this.#nextAnonymousName();
    }

    this.#names.push(name);
    this.#animations.set(name, {
      id,
      name,
      frames,
      duration,
      trims,
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
      throw new Error(`FrameBasedAnimations: there is no animation named "${name.toString()}"`);
    }
    return anim.id;
  }

  /** Whether an animation is registered under this name. */
  hasAnimation(name: AnimName): boolean {
    return this.#animations.has(name);
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
   * - from texel `n` on, `texelsPerFrame` texels for each frame, the frames of an animation one
   *   after the other: first `[s, t, u, v]` as `TextureCoords#getTexCoords()` answers them, and with
   *   two texels a second one, `[width, height, flipDiagonal, 0]` — `width` and `height` the
   *   measures of the area in the image as `TextureCoords` holds them, `flipDiagonal` `1` for a
   *   frame with `TextureCoords.FLIP_DIAGONAL` and `0` otherwise — and with three texels a third
   *   one, `[left, top, right, bottom]`: the trim margins of the frame as fractions of the
   *   untrimmed sprite — `left` and `right` of its width, `top` and `bottom` of its height, `top`
   *   counted from the top — and `0` at every side for an untrimmed frame of the same bake
   * - `texelsPerFrame` is `3` when a registered frame is trimmed, else `2` when
   *   `includeTextureSize` is set or a registered frame carries `FLIP_DIAGONAL`, and `1` otherwise
   *   — the same for every animation of a bake
   *
   * Every call builds a new `DataTexture` and keeps no reference to it: the caller owns it and
   * disposes it. A material it is handed to as `animsMap` borrows it and does not dispose it.
   */
  bakeDataTexture(options?: BakeTextureOptions): DataTexture {
    const anims = Array.from(this.#animations.values());
    // a turned frame needs the second texel to carry its diagonal flip to the shader
    const hasTurnedFrame = anims.some(({frames}) => frames.some((coords) => coords.flipD));
    // a trimmed frame needs the third texel for its margins, and brings the second along with it
    const hasTrimmedFrame = anims.some(({trims}) => trims.some((margins) => margins.some((margin) => margin !== 0)));
    const texelsPerFrame = hasTrimmedFrame ? 3 : options?.includeTextureSize || hasTurnedFrame ? 2 : 1;

    const bufSize = getBufferSize(this.#animations, texelsPerFrame, FrameBasedAnimations.MaxTextureSize);

    const floatsBuffer = renderFloatsBuffer(new Float32Array(bufSize * 4), this.#names, this.#animations, texelsPerFrame);

    const dataTexture = new DataTexture(floatsBuffer, bufSize, 1, RGBAFormat, FloatType);
    dataTexture.needsUpdate = true;

    return dataTexture;
  }
}
