import {DataTexture, FloatType, RGBAFormat} from 'three/webgpu';
import {findNextPowerOf2} from '../utils/findNextPowerOf2.js';
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
 *
 * @example
 * // Using duration (animation takes 0.5 seconds total)
 * { duration: 0.5 }
 *
 * // Using frameRate (10 frames at 20 fps = 0.5 seconds)
 * { frameRate: 20 }
 */
export type AnimationTimingOptions = {duration: number; frameRate?: never} | {duration?: never; frameRate: number};

/**
 * Calculates the duration of an animation based on frame count and frame rate.
 * @param frameCount Number of frames in the animation
 * @param frameRate Frames per second (must be greater than 0)
 * @returns Duration in seconds
 * @throws Error if frameRate is not greater than 0
 */
const calculateDurationFromFrameRate = (frameCount: number, frameRate: number): number => {
  if (frameRate <= 0) {
    throw new Error('frameRate must be greater than 0');
  }
  return frameCount / frameRate;
};

/**
 * Extracts the duration from timing options, calculating from frameRate if necessary.
 * @param timing Either a duration number or AnimationTimingOptions object
 * @param frameCount Number of frames (required when using frameRate)
 * @returns Duration in seconds
 * @throws Error if neither duration nor frameRate is provided
 */
const resolveDuration = (timing: number | AnimationTimingOptions, frameCount: number): number => {
  if (typeof timing === 'number') {
    return timing;
  }
  if ('frameRate' in timing && timing.frameRate !== undefined) {
    return calculateDurationFromFrameRate(frameCount, timing.frameRate);
  }
  if ('duration' in timing && timing.duration !== undefined) {
    return timing.duration;
  }
  throw new Error('Either duration or frameRate must be provided');
};

// the name is what tells one entry of an animation map from the next in an error message, and an
// add() that was given none has nothing else to be recognized by
const animNameInError = (name: AnimName | undefined): string => name?.toString() ?? '(no name)';

const FRAME_NAME_ORDER = new Intl.Collator('en', {numeric: true});

type AnimationsMap = Map<AnimName, FrameBasedAnimDef>;

const getBufferSize = (animationsMap: AnimationsMap, sizePerTexture = 1, maxTextureSize = 16384) => {
  const anims = Array.from(animationsMap.values());
  const totalFramesCount = anims.reduce((sum, anim) => sum + anim.frames.length, 0);
  const minBufSize = anims.length + totalFramesCount * sizePerTexture;
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
  includeTextureSize: boolean,
) => {
  let curOffset = names.length;

  floatsBuffer.set(
    names.flatMap((name) => {
      const {frames, duration} = animations.get(name)!;
      const offset = curOffset;
      curOffset += frames.length * (includeTextureSize ? 2 : 1);
      return [frames.length, duration, offset, 0];
    }),
  );

  floatsBuffer.set(
    includeTextureSize
      ? names.flatMap((name) =>
          animations.get(name)!.frames.flatMap(({s, t, u, v, width, height}) => [s, t, u, v, width, height, 0, 0]),
        )
      : names.flatMap((name) => animations.get(name)!.frames.flatMap(({s, t, u, v}) => [s, t, u, v])),
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
   * the set to the names it matches.
   *
   * An animation carries at least one frame and a duration that is a finite number at or above
   * zero — zero being a still image. A set of frames that comes out empty, an atlas query that
   * matches nothing among them, and a duration that is negative, `NaN` or infinite are each
   * refused with an error naming the case.
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
      throw new Error(`name='${name.toString()}' must be unique!`);
    }

    let frames: TextureCoords[];

    if (Array.isArray(args[2])) {
      frames = args[2];
    } else if (args[2] instanceof TextureAtlas) {
      const atlas = args[2];
      // both forms of a query reach the atlas: `frameNames()` takes a pattern as a string or
      // as a RegExp, and letting one of them fall away would quietly widen the animation to
      // every frame of the atlas
      const frameNameQuery = typeof args[3] === 'string' || args[3] instanceof RegExp ? args[3] : undefined;
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
      frames = frameNames.map((frameName) => atlas.frame(frameName)!.coords);
    } else if (args[2] instanceof TileSet) {
      const tileSet = args[2];
      if (Array.isArray(args[3])) {
        const tileIds = args[3];
        frames = tileIds.map((tileId) => tileSet.frame(tileId).coords);
      } else {
        const firstTileId = (args[3] as number | undefined) ?? tileSet.firstId;
        const tileCount: number = args[4] ?? tileSet.tileCount;
        frames = [];
        for (let tileId = firstTileId; tileId < firstTileId + tileCount; tileId++) {
          frames.push(tileSet.frame(tileId).coords);
        }
      }
    } else {
      throw new Error('add(): the third argument must be a TextureAtlas, a TileSet or an array of frames');
    }

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
    const duration = resolveDuration(timing, frames.length);

    // the duration divides the animation time in the shader: zero is a still image, everything
    // below it and everything that is no number at all is a configuration error
    if (!Number.isFinite(duration) || duration < 0) {
      throw new Error(
        `FrameBasedAnimations: add() got a duration of ${duration} for the animation \`${animNameInError(name)}\` — a duration is a finite number at or above zero`,
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

  bakeDataTexture(options?: BakeTextureOptions): DataTexture {
    const includeTextureSize = Boolean(options?.includeTextureSize);

    const bufSize = getBufferSize(this.#animations, includeTextureSize ? 2 : 1, FrameBasedAnimations.MaxTextureSize);

    const floatsBuffer = renderFloatsBuffer(new Float32Array(bufSize * 4), this.#names, this.#animations, includeTextureSize);

    const dataTexture = new DataTexture(floatsBuffer, bufSize, 1, RGBAFormat, FloatType);
    dataTexture.needsUpdate = true;

    return dataTexture;
  }
}
