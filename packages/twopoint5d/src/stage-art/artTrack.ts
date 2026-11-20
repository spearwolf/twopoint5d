import type {AnimationPlayback} from '../texture/FrameBasedAnimations.js';
import {isAnimationPlayback} from '../texture/animationPlayback.js';
import {describeValue} from '../utils/describeValue.js';
import {applyEasingInPlace, type Easing, type EasingSpec, easingOf} from '../utils/easing.js';
import {isRecord} from '../utils/isRecord.js';
import {
  type ArtPose,
  checkPoseField,
  POSE_DEG,
  POSE_DEPTH,
  POSE_FIELDS,
  POSE_FRAME,
  POSE_OPACITY,
  POSE_ORDER,
  POSE_SCALE_X,
  POSE_SCALE_Y,
  POSE_SIZE,
  POSE_VISIBLE,
  POSE_X,
  POSE_Y,
  poseSlotOf,
  refuseUnknownPoseField,
} from './artPose.js';

/** A key of an {@link ArtTrack}: a pose at a time. */
export interface ArtKey extends ArtPose {
  /** Seconds, of 0 or more and ascending; keys at the same time make a cut. */
  at: number;
  /** The easing of the stretch that arrives at this key. Default: the `ease` of the track. */
  ease?: Easing;
}

/** The options of {@link artTrack}. */
export interface ArtTrackOptions {
  /** The easing of every key without one of its own. Default `'linear'`. */
  ease?: Easing;
  /** What the track does once its keys are through. Default `'once'`. */
  playback?: AnimationPlayback;
}

/** A timeline of poses: what {@link artTrack} builds. */
export interface ArtTrack {
  /** The time of the last key, in seconds. */
  readonly duration: number;
  /**
   * Writes the fields the track has into `target` at `seconds` and answers it; a field the track
   * does not have stays as it is. A pure function of `seconds`, which may be any finite number.
   */
  sample(seconds: number, target: ArtPose): ArtPose;
  /**
   * Whether the pose at `seconds` is still on its way: within the keys, and always under `'loop'` and
   * `'pingpong'` for a track with a duration above 0; a track of duration 0 never changes.
   */
  isMoving(seconds: number): boolean;
}

const bit = (slot: number): number => 1 << slot;

// the discrete fields change at their key; the rest blend
const DISCRETE_BITS = bit(POSE_FRAME) | bit(POSE_VISIBLE) | bit(POSE_ORDER);

const PLAYBACK_ONCE = 0;
const PLAYBACK_LOOP = 1;
const PLAYBACK_PINGPONG = 2;

// the slot an easing works on, one for all: a fraction handed through a typed array stays unboxed
const easeSlot = new Float64Array(1);
const timeSlot = new Float64Array(1);

const refuseSeconds = (subject: string, name: string, value: unknown): never => {
  throw new RangeError(`${subject}: ${name} must be a finite number, got ${describeValue(value)}`);
};

/**
 * Builds a track of poses along time. Each key holds what it leaves out — a field is filled
 * forward from the key before it, once, here —, a field the first key leaves out is not part of
 * the track, and `sample()` leaves it alone on its target. The continuous fields (`x`, `y`,
 * `depth`, `deg`, `scaleX`, `scaleY`, `opacity`) blend between two keys at the eased share of the
 * stretch, `deg` as written; the discrete ones (`frame`, `visible`, `order`) change at their key.
 * Before the first key the track shows the first, after the last the last — or runs on under
 * `'loop'` and `'pingpong'`.
 *
 * Throws, before anything is built: keys that are no non-empty array of objects, an `at` that is no
 * finite number of 0 or more or smaller than the one before, a field a later key sets that the first leaves out, a field as `StageArt#set()` refuses it
 * (the depth limit, which needs a camera, apart), a key that is no field of a pose, an `ease`
 * `easingOf()` refuses and a `playback` that is none of the three.
 */
export function artTrack(keys: readonly ArtKey[], options?: ArtTrackOptions): ArtTrack {
  const subject = 'artTrack';
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new TypeError(`${subject}: keys must be a non-empty array of ArtKey, got ${describeValue(keys)}`);
  }
  if (options !== undefined && !isRecord(options)) {
    throw new TypeError(`${subject}: options must be an object, got ${describeValue(options)}`);
  }
  const defaultEase = easingOf(subject, (options as ArtTrackOptions | undefined)?.ease ?? 'linear', 'options.ease');
  const playbackOption: unknown = (options as ArtTrackOptions | undefined)?.playback ?? 'once';
  if (!isAnimationPlayback(playbackOption)) {
    throw new TypeError(
      `${subject}: options.playback must be 'once', 'loop' or 'pingpong', got ${describeValue(playbackOption)}`,
    );
  }
  const playback = playbackOption === 'loop' ? PLAYBACK_LOOP : playbackOption === 'pingpong' ? PLAYBACK_PINGPONG : PLAYBACK_ONCE;

  const count = keys.length;
  const times = new Float64Array(count);
  const rows = new Float64Array(count * POSE_SIZE);
  const eases: EasingSpec[] = [];
  // the pose carried forward from key to key
  const current = new Float64Array(POSE_SIZE);
  let mask = 0;

  for (let i = 0; i < count; i++) {
    const key: unknown = keys[i];
    const name = `keys[${i}]`;
    if (!isRecord(key)) {
      throw new TypeError(`${subject}: ${name} must be an object with at, got ${describeValue(key)}`);
    }
    const at = (key as Partial<ArtKey>).at;
    if (typeof at !== 'number' || !(Number.isFinite(at) && at >= 0)) {
      throw new RangeError(`${subject}: ${name}.at must be a finite number of 0 or more, got ${describeValue(at)}`);
    }
    if (i > 0 && at < times[i - 1]!) {
      throw new RangeError(
        `${subject}: ${name}.at must be ${describeValue(times[i - 1])} or more, the at of keys[${i - 1}], got ${describeValue(at)}`,
      );
    }
    times[i] = at;

    for (const field of Object.keys(key)) {
      if (field === 'at' || field === 'ease') continue;
      if (poseSlotOf(field) === -1) refuseUnknownPoseField(subject, name, field, ['at', 'ease']);
    }
    for (let slot = 0; slot < POSE_SIZE; slot++) {
      const field = POSE_FIELDS[slot]!;
      const value = key[field];
      // a field a key leaves out, or sets undefined, is held
      if (value === undefined) continue;
      checkPoseField(subject, field, value, `${name}.${field}`);
      if (i === 0) {
        mask |= bit(slot);
      } else if (!(mask & bit(slot))) {
        throw new RangeError(
          `${subject}: ${name}.${field} is set, but keys[0] leaves ${field} out, so the track has no value to start from: give ${field} a value in keys[0]`,
        );
      }
      current[slot] = value === true ? 1 : value === false ? 0 : (value as number);
    }
    rows.set(current, i * POSE_SIZE);

    const ease = (key as Partial<ArtKey>).ease;
    eases.push(ease === undefined ? defaultEase : easingOf(subject, ease, `${name}.ease`));
  }

  const first = times[0]!;
  const last = count - 1;
  const duration = times[last]!;

  return {
    duration,

    sample(seconds: number, target: ArtPose): ArtPose {
      // inline, not through assertFinite(): a number handed through a call that is not inlined is boxed
      if (typeof seconds !== 'number' || !Number.isFinite(seconds)) refuseSeconds('ArtTrack#sample()', 'seconds', seconds);
      // the wrapped time goes through a typed array: a `let` that holds the tagged argument in one branch
      // and a computed double in the other is a heap number at each call V8 does not inline
      timeSlot[0] = seconds;
      if (playback !== PLAYBACK_ONCE && duration > 0) {
        if (playback === PLAYBACK_LOOP) {
          timeSlot[0] = seconds - Math.floor(seconds / duration) * duration;
        } else {
          const period = 2 * duration;
          const phase = seconds - Math.floor(seconds / period) * period;
          timeSlot[0] = phase > duration ? period - phase : phase;
        }
      }
      const t = timeSlot[0]!;

      // the last key that starts at or before t, the first one before them all
      let i = 0;
      while (i < last && times[i + 1]! <= t) i++;

      let share = 0;
      let to = i * POSE_SIZE;
      const from = to;
      if (i < last) {
        // times[i + 1] > t >= times[i] where i is not the first key; before the first key the share is clamped to 0
        const span = times[i + 1]! - times[i]!;
        easeSlot[0] = t > times[i]! ? (t - times[i]!) / span : 0;
        applyEasingInPlace(eases[i + 1]!, easeSlot);
        share = easeSlot[0]!;
        to = from + POSE_SIZE;
      }

      if (mask & bit(POSE_X)) target.x = rows[from + POSE_X]! + (rows[to + POSE_X]! - rows[from + POSE_X]!) * share;
      if (mask & bit(POSE_Y)) target.y = rows[from + POSE_Y]! + (rows[to + POSE_Y]! - rows[from + POSE_Y]!) * share;
      if (mask & bit(POSE_DEPTH)) {
        target.depth = rows[from + POSE_DEPTH]! + (rows[to + POSE_DEPTH]! - rows[from + POSE_DEPTH]!) * share;
      }
      if (mask & bit(POSE_DEG)) target.deg = rows[from + POSE_DEG]! + (rows[to + POSE_DEG]! - rows[from + POSE_DEG]!) * share;
      if (mask & bit(POSE_SCALE_X)) {
        target.scaleX = rows[from + POSE_SCALE_X]! + (rows[to + POSE_SCALE_X]! - rows[from + POSE_SCALE_X]!) * share;
      }
      if (mask & bit(POSE_SCALE_Y)) {
        target.scaleY = rows[from + POSE_SCALE_Y]! + (rows[to + POSE_SCALE_Y]! - rows[from + POSE_SCALE_Y]!) * share;
      }
      if (mask & bit(POSE_OPACITY)) {
        target.opacity = rows[from + POSE_OPACITY]! + (rows[to + POSE_OPACITY]! - rows[from + POSE_OPACITY]!) * share;
      }
      if (mask & DISCRETE_BITS) {
        if (mask & bit(POSE_FRAME)) target.frame = rows[from + POSE_FRAME]!;
        if (mask & bit(POSE_VISIBLE)) target.visible = rows[from + POSE_VISIBLE] !== 0;
        if (mask & bit(POSE_ORDER)) target.order = rows[from + POSE_ORDER]!;
      }
      return target;
    },

    isMoving(seconds: number): boolean {
      if (typeof seconds !== 'number' || !Number.isFinite(seconds)) refuseSeconds('ArtTrack#isMoving()', 'seconds', seconds);
      // a track of a duration of 0 has nowhere to go, whatever its playback
      if (duration === 0) return false;
      if (playback !== PLAYBACK_ONCE) return true;
      return seconds >= first && seconds < duration;
    },
  };
}

/**
 * The share of a ramp that has run at `seconds`: 0 until `start`, 1 from `start + duration` on, the
 * eased share in between (`'linear'` by default) — for a value that eases once, not on a track:
 * `rampAt(now, started, 0.4, 'ease-out')`. Throws a `RangeError` for a `seconds` or a `start` that
 * is no finite number and a `duration` that is no finite number above 0, and a `TypeError` for an
 * `ease` that is none. Allocates nothing.
 */
export function rampAt(seconds: number, start: number, duration: number, ease: Easing = 'linear'): number {
  // inline, not through the assert helpers: a number handed through a call that is not inlined is boxed
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) refuseSeconds('rampAt', 'seconds', seconds);
  if (typeof start !== 'number' || !Number.isFinite(start)) refuseSeconds('rampAt', 'start', start);
  if (typeof duration !== 'number' || !(Number.isFinite(duration) && duration > 0)) {
    throw new RangeError(`rampAt: duration must be a finite number above 0, got ${describeValue(duration)}`);
  }
  const spec = easingOf('rampAt', ease, 'ease');
  const share = (seconds - start) / duration;
  easeSlot[0] = Math.min(Math.max(share, 0), 1);
  applyEasingInPlace(spec, easeSlot);
  return easeSlot[0]!;
}
