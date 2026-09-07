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

const FRAME_NAME_ORDER = new Intl.Collator('en', {numeric: true});

type AnimationsMap = Map<AnimName, FrameBasedAnimDef>;

const getBufferSize = (animationsMap: AnimationsMap, sizePerTexture = 1, maxTextureSize = 16384) => {
  const anims = Array.from(animationsMap.values());
  const totalFramesCount = anims.reduce((sum, anim) => sum + anim.frames.length, 0);
  const minBufSize = anims.length + totalFramesCount * sizePerTexture;
  const bufSize = findNextPowerOf2(minBufSize);

  if (bufSize > maxTextureSize) {
    throw new Error('TODO too many animation frames - we need better way here to calculate a corresponding buffer size!');
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
   * A name is registered once; a second animation under the same name is refused with an
   * error. Without a name the animation is reachable through the id alone.
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

    if (name) {
      if (this.#animations.has(name)) {
        throw new Error(`name='${name.toString()}' must be unique!`);
      }
    } else {
      name = Symbol('n/a');
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
        .filter((name) => typeof name === 'string')
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
    const timing = args[1];
    const duration = resolveDuration(timing, frames.length);

    this.#names.push(name);
    this.#animations.set(name, {
      id,
      name,
      frames,
      duration,
    });

    return id;
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
