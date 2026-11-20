import {assertFinite} from '../utils/assertFinite.js';
import {assertWholeNumber} from '../utils/assertWholeNumber.js';
import {type AnimationPlayback, cycleDurationOf} from './FrameBasedAnimations.js';

/**
 * What {@link animationFrameAt} needs to know about an animation: how many frames it runs through,
 * the seconds they last, the seconds of each frame where they differ, and what the animation does
 * once its frames are through. A {@link FrameBasedAnimationInfo} has all four.
 */
export interface AnimationTiming {
  /** How many frames the animation runs through, once. */
  readonly frameCount: number;
  /** Seconds, the frames once through; the sum of `durations` where there are some. */
  readonly duration: number;
  /** Seconds per frame, or `undefined` for an animation of one duration. */
  readonly durations: readonly number[] | undefined;
  /** What the animation does once its frames are through. */
  readonly playback: AnimationPlayback;
}

// the floored mod of the shader, x − y · floor(x / y), where `%` keeps the sign of x
const flooredMod = (x: number, y: number): number => x - y * Math.floor(x / y);

/**
 * The index of the frame an animation shows `seconds` into it, the CPU's answer to what
 * `AnimatedFrames` picks in the shader: a sprite animated on the CPU — an art layer, a hit box, the
 * key frame of a strike — reads the frame the GPU shows for a sprite at the same time. `seconds` is
 * `time + animOffset`; a negative one is before the start, and a `'once'` holds its first frame
 * there. A `duration` of 0 is a still image and answers 0. Allocates nothing.
 *
 * @param animation - a {@link FrameBasedAnimationInfo}, or any object of the same timing
 * @param seconds - a finite number
 * @throws a `RangeError` for a `frameCount` that is not a whole number of 1 or more, and for
 *   `seconds` that is no finite number
 */
export function animationFrameAt(animation: AnimationTiming, seconds: number): number {
  const {frameCount, duration, durations, playback} = animation;
  assertWholeNumber(frameCount, 'animationFrameAt', 'frameCount', 1);
  assertFinite(seconds, 'animationFrameAt', 'seconds');

  if (!(duration > 0)) return 0;
  const lastFrame = frameCount - 1;

  if (durations === undefined) {
    const steps = (seconds / duration) * frameCount;
    if (playback === 'pingpong') {
      const turnStep = Math.floor(flooredMod(steps, Math.max(2 * frameCount - 2, 1)));
      return Math.min(Math.max(lastFrame - Math.abs(turnStep - lastFrame), 0), lastFrame);
    }
    if (playback === 'once') return Math.min(Math.max(Math.floor(steps), 0), lastFrame);
    return Math.min(Math.max(Math.floor(flooredMod(steps, frameCount)), 0), lastFrame);
  }

  // the seconds searched in the cycle of the animation; the way back of a ping-pong mirrors its
  // time into the way there, over the frames frameCount − 2 down to 1
  let searched: number;
  if (playback === 'pingpong') {
    const cycleDuration = cycleDurationOf(animation);
    const turnTime = flooredMod(seconds, cycleDuration);
    searched = turnTime >= duration ? cycleDuration + durations[0]! - turnTime : turnTime;
  } else if (playback === 'once') {
    searched = seconds;
  } else {
    searched = flooredMod(seconds, duration);
  }

  // the frame is the count of the frames that end at or before the time searched for, the end of a
  // frame being the sum of the durations up to it: a linear walk that builds no array of end times
  let count = 0;
  let end = 0;
  const walkable = Math.min(durations.length, frameCount);
  while (count < walkable) {
    end += durations[count]!;
    if (end > searched) break;
    count++;
  }
  return Math.min(count, lastFrame);
}
