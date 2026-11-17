import type {AnimationAction, Camera, OrthographicCamera, PerspectiveCamera} from 'three/webgpu';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {describeValue} from '../utils/describeValue.js';
import {applyEasingInPlace, type EasingSpec, easingOf} from '../utils/easing.js';
import {createPoseValues, type PoseValues, readPose} from './cameraPose.js';
import {CameraProjection} from './CameraProjection.js';
import {createRest, type Rest} from './cameraRest.js';
import {blendProgress, type CameraShot, type CameraShotKind, createShot} from './cameraShot.js';
import {createObjectFollow, kindOf, type ObjectFollow, type TargetKind} from './cameraTarget.js';
import type {IProjection} from './IProjection.js';

/**
 * A key of a track as a `CameraRig` keeps it: its span, its target, read once, and what the rig
 * resolves it into in every frame.
 * @internal
 */
export interface TrackKey {
  at: number;
  until: number;
  kind: TargetKind;
  /** The pose of a pose key; of an object key, the place of the object, rewritten in every frame. */
  readonly pose: PoseValues;
  /** The object of an object key, as the rig follows one, at no offset. */
  readonly follow: ObjectFollow | undefined;
  /** The projection of a projection key, and the `CameraProjection` of a camera key. */
  readonly projection: IProjection | undefined;
  /** The rest `projection` places for the container of the stage, and the container it was placed for. */
  readonly rest: Rest;
  placed: boolean;
  width: number;
  height: number;
  pixelRatio: number;
  readonly clip: AnimationAction | undefined;
  /** The time the rig last set on `clip`, `NaN` before the first. */
  clipTime: number;
  /** The easing of the stretch that arrives at this key. */
  readonly ease: EasingSpec;
  /** The shot of the key, resolved in the frame. */
  readonly shot: CameraShot;
}

/**
 * A track of a `CameraRig`: its keys, the progress `lerp()` asks for and the one it shows, and the
 * spring of `smooth` between them.
 * @internal
 */
export interface CameraTrack {
  readonly keys: readonly TrackKey[];
  /** The progress `lerp()` asked for, clamped to `[0, 1]`. */
  asked: number;
  /** The progress shown, which follows `asked` at once, or by the spring of `smooth`. */
  shown: number;
  velocity: number;
  /** The time constant of the spring, in seconds; 0 for none. */
  smooth: number;
  /**
   * Whether `lerp()` has asked for a progress since `track()`: the first one sets `shown` at once, so
   * that the track does not glide in from 0.
   */
  lerped: boolean;
  /** The shown progress of the last `step()`, which tells whether a step moved it. */
  stepped: number;
  /** In: the time of the step the spring advances by. */
  delta: number;
  /** Out of {@link locateTrack}: the key the progress lies in, or the one a stretch leaves. */
  index: number;
  /** Out of {@link locateTrack}: the key a stretch arrives at, `-1` inside a key. */
  next: number;
  /** Out of {@link locateTrack}: the eased share of the stretch. */
  share: number;
}

/** How a `CameraRig` lets {@link readTrack} ask what it knows of projections. @internal */
export interface TrackReader {
  /** The kind of camera `projection` builds. */
  kindOfProjection(projection: IProjection): CameraShotKind;
  /** The kind of camera the projection of the stage builds: the lens of a pose and an object key. */
  stageKind: CameraShotKind;
  /** Whether the projection of the stage has a plane. */
  stageHasPlane: boolean;
  /** Whether the projection of the stage takes no look other than 0. */
  orthographic: boolean;
}

const UNIT_MESSAGE = 'a finite number from 0 to 1';

const isUnit = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 1;

const isAnimationAction = (value: unknown): value is AnimationAction =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Partial<AnimationAction>).getMixer === 'function' &&
  typeof (value as Partial<AnimationAction>).getClip === 'function';

/**
 * Reads the keys `keys` into a track, or throws what `subject` refuses in them: what is not a
 * non-empty array of objects, an `at` or an `until` outside `[0, 1]`, an `until` before its `at`,
 * keys out of order — a key that starts before the one before it ends —, a `clip` that is not an
 * `AnimationAction` or whose key has no camera as its shot, an `ease` that is not an easing, a shot
 * as `jump()` refuses it, and a stretch between keys of the two kinds of lens where a key has no
 * projection plane to take as the focus of the lens change. A key of a camera gets a
 * `CameraProjection` of its own, fitted with the default fit. Changes nothing of the rig.
 * @internal
 */
export function readTrack(subject: string, keys: unknown, reader: TrackReader): CameraTrack {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new TypeError(`${subject}: keys must be a non-empty array of CameraTrackKey, got ${describeValue(keys)}`);
  }
  const read: TrackKey[] = [];
  // the kind of lens of each key, and whether its frame has a plane for the focus of a lens change
  const kinds: CameraShotKind[] = [];
  const planes: boolean[] = [];
  const stagePlane = reader.stageHasPlane;
  for (let i = 0; i < keys.length; i++) {
    const key: unknown = keys[i];
    const name = `keys[${i}]`;
    if (typeof key !== 'object' || key === null) {
      throw new TypeError(`${subject}: ${name} must be an object with at and shot, got ${describeValue(key)}`);
    }
    const {at, until, shot, clip, ease} = key as {at: unknown; until?: unknown; shot: unknown; clip?: unknown; ease?: unknown};
    if (!isUnit(at)) throw new RangeError(`${subject}: ${name}.at must be ${UNIT_MESSAGE}, got ${describeValue(at)}`);
    if (until !== undefined) {
      if (!isUnit(until)) throw new RangeError(`${subject}: ${name}.until must be ${UNIT_MESSAGE}, got ${describeValue(until)}`);
      if (until < at) {
        throw new RangeError(
          `${subject}: ${name}.until must be of its at, ${describeValue(at)}, or more, got ${describeValue(until)}`,
        );
      }
    }
    const previous = read[i - 1];
    if (previous !== undefined && at < previous.until) {
      throw new RangeError(
        `${subject}: the keys must go in order: ${name}.at must be of ${describeValue(previous.until)} or more, where keys[${i - 1}] ends, got ${describeValue(at)}`,
      );
    }

    const pose = createPoseValues();
    let kind: TargetKind;
    let lensKind: CameraShotKind;
    let plane = stagePlane;
    let projection: IProjection | undefined;
    let follow: ObjectFollow | undefined;
    if (typeof shot === 'object' && shot !== null && (shot as Partial<Camera>).isCamera === true) {
      const cameraKind = kindOf(shot as Camera);
      if (cameraKind === undefined) {
        throw new TypeError(
          `${subject}: ${name}.shot must be a PerspectiveCamera or an OrthographicCamera where it is a camera, got ${describeThreeValue(shot, 'isObject3D')}`,
        );
      }
      kind = 'camera';
      lensKind = cameraKind;
      plane = false;
      projection = new CameraProjection(shot as PerspectiveCamera | OrthographicCamera);
    } else if (typeof shot === 'object' && shot !== null && (shot as {isObject3D?: unknown}).isObject3D === true) {
      kind = 'object';
      lensKind = reader.stageKind;
      follow = createObjectFollow();
      follow.object = shot as ObjectFollow['object'];
      follow.offsetX = 0;
      follow.offsetY = 0;
      pose.hasPosition = true;
    } else if (typeof shot === 'object' && shot !== null && typeof (shot as Partial<IProjection>).updateViewRect === 'function') {
      kind = 'projection';
      projection = shot as IProjection;
      lensKind = reader.kindOfProjection(projection);
      plane = projection.projectionPlane != null;
    } else {
      kind = 'pose';
      lensKind = reader.stageKind;
      readPose(subject, shot, reader.orthographic, pose, `${name}.shot`);
    }

    if (clip !== undefined) {
      if (!isAnimationAction(clip)) {
        throw new TypeError(`${subject}: ${name}.clip must be an AnimationAction, got ${describeValue(clip)}`);
      }
      if (kind !== 'camera') {
        const described = kind === 'pose' ? describeValue(shot) : describeThreeValue(shot, 'isObject3D');
        throw new TypeError(`${subject}: ${name}.clip needs a camera as the shot of its key, got ${described}`);
      }
    }
    const easing = ease === undefined ? easingOf(subject, 'linear') : easingOf(subject, ease, `${name}.ease`);

    read.push({
      at,
      until: until === undefined ? at : (until as number),
      kind,
      pose,
      follow,
      projection,
      rest: createRest(),
      placed: false,
      width: 0,
      height: 0,
      pixelRatio: 0,
      clip: clip as AnimationAction | undefined,
      clipTime: Number.NaN,
      ease: easing,
      shot: createShot(),
    });
    kinds.push(lensKind);
    planes.push(plane);
  }

  for (let i = 1; i < read.length; i++) {
    if (kinds[i - 1] === kinds[i] || (planes[i - 1] && planes[i])) continue;
    const camera = read[i - 1]!.kind === 'camera' || read[i]!.kind === 'camera';
    throw new Error(
      `${subject}: the stretch from keys[${i - 1}] to keys[${i}] is a lens change between a perspective and an orthographic camera, which needs a focus: ${
        camera ? 'a camera as the target has' : 'the projection has'
      } no projectionPlane, and a track names no focus`,
    );
  }

  return {
    keys: read,
    asked: 0,
    shown: 0,
    velocity: 0,
    smooth: 0.5,
    lerped: false,
    stepped: 0,
    delta: 0.5,
    index: 0,
    next: -1,
    share: 0.5,
  };
}

// the spring has reached the asked progress where the gap falls below this: |q - p| < 1e-4
const SETTLED = 1e-4;

/**
 * Advances the shown progress of `track` by `track.delta` seconds toward the asked one: at once
 * without `smooth`, otherwise as a critically damped spring with the time constant `smooth`, worked
 * out exactly for an asked progress that stands through the step, so that it closes the gap without
 * overshooting it from rest. Where the gap falls below `1e-4` it settles on the asked progress.
 * Allocates nothing.
 * @internal
 */
export function advanceTrack(track: CameraTrack): void {
  const asked = track.asked;
  const smooth = track.smooth;
  if (!(smooth > 0)) {
    track.shown = asked;
    track.velocity = 0;
    return;
  }
  const dt = track.delta;
  if (dt > 0) {
    // e(t) = (e + (v + ωe)·t)·exp(−ωt), v(t) = (v − ω(v + ωe)·t)·exp(−ωt), with e the gap p − q
    const omega = 1 / smooth;
    const decay = Math.exp(-omega * dt);
    const gap = track.shown - asked;
    const t = (track.velocity + omega * gap) * dt;
    track.shown = asked + (gap + t) * decay;
    track.velocity = (track.velocity - omega * t) * decay;
  }
  const gap = asked - track.shown;
  if (gap < SETTLED && gap > -SETTLED) {
    track.shown = asked;
    track.velocity = 0;
  }
}

/**
 * Where the shown progress of `track` lies, into `index`, `next` and `share`: inside a key — or
 * before the first, or after the last, which hold that key — `index` is the key and `next` is
 * `-1`; between two keys `index` is the key the stretch leaves, `next` the one it arrives at, and
 * `share` the share of the stretch, eased by the `ease` of the key it arrives at. Allocates nothing.
 * @internal
 */
export function locateTrack(track: CameraTrack): void {
  const keys = track.keys;
  const p = track.shown;
  const last = keys.length - 1;
  let i = 0;
  // the last key that starts at or before the progress
  while (i < last && keys[i + 1]!.at <= p) i++;
  const key = keys[i]!;
  track.index = i;
  if (i === last || p <= key.until) {
    track.next = -1;
    return;
  }
  const next = keys[i + 1]!;
  const from = key.until;
  blendProgress[0] = (p - from) / (next.at - from);
  applyEasingInPlace(next.ease, blendProgress);
  track.share = blendProgress[0]!;
  track.next = i + 1;
}

/**
 * Sets the time of the clip of each key of `track` where the shown progress puts it — inside the
 * key, the share of its span on `0 … clip.getClip().duration`; before the key its start, after it
 * its end — and lets the mixer of the clip apply it, `getMixer().update(0)`, where that time
 * differs from the one the clip has. The clip is neither played nor stopped. Allocates nothing of
 * its own.
 * @internal
 */
export function scrubTrackClips(track: CameraTrack): void {
  const keys = track.keys;
  const p = track.shown;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const clip = key.clip;
    if (clip === undefined) continue;
    const duration = clip.getClip().duration;
    const at = key.at;
    const until = key.until;
    const time = p <= at ? 0 : p >= until ? duration : ((p - at) / (until - at)) * duration;
    if (time === key.clipTime && clip.time === time) continue;
    clip.time = time;
    key.clipTime = time;
    clip.getMixer().update(0);
  }
}
