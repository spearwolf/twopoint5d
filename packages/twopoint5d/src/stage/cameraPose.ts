import {describeValue} from '../utils/describeValue.js';

/**
 * A viewpoint in the frame of the projection of a stage, as a `CameraRig` takes it. A field left
 * out is the rest's — the placement the projection gives the camera by itself —, so `{}` is that
 * placement, pixel-exact.
 *
 * Under a `ParallaxProjection` the right and the up axis of the projection plane carry `x` and `y`,
 * its normal carries the distance; for an `'xy|bottom-left'` plane through the origin these are
 * world coordinates. Under an `OrthographicProjection` the pose takes `x`, `y` and `zoom`: the
 * distance is ignored, since it changes nothing an orthographic camera shows, so one list of poses
 * serves both kinds of projection, and a `look` other than 0 is refused.
 *
 * Tuples stay the form for JSON content. A viewpoint authored with an absolute field of view
 * converts once: `zoom = tan(fitFov / 2) / tan(fov / 2)`.
 */
export interface CameraPose {
  /**
   * On the axes of the frame: x and y on the projection plane, then the distance from it. A tuple,
   * or anything with x, y and an optional z — a `Vector2`, a `Vector3`; a distance left out is the
   * rest's.
   */
  position?: readonly [number, number] | readonly [number, number, number] | {x: number; y: number; z?: number};
  /**
   * Radians, relative to the orientation of the rest: yaw about the up axis of the frame, then
   * pitch about the right axis of the camera. Positive yaw turns left, positive pitch looks up.
   */
  look?: {yaw: number; pitch: number};
  /** A factor on the field of view (perspective) or on the view (orthographic) of the fit; `1` is the fit. */
  zoom?: number;
}

/**
 * A pose as a `CameraRig` keeps it: plain numbers, read once from what the caller handed in.
 * @internal
 */
export interface PoseValues {
  hasPosition: boolean;
  x: number;
  y: number;
  hasDistance: boolean;
  distance: number;
  hasLook: boolean;
  yaw: number;
  pitch: number;
  zoom: number;
}

/** @internal */
export function createPoseValues(): PoseValues {
  return {hasPosition: false, x: 0, y: 0, hasDistance: false, distance: 0, hasLook: false, yaw: 0, pitch: 0, zoom: 1};
}

/** @internal */
export function copyPoseValues(source: PoseValues, target: PoseValues): PoseValues {
  target.hasPosition = source.hasPosition;
  target.x = source.x;
  target.y = source.y;
  target.hasDistance = source.hasDistance;
  target.distance = source.distance;
  target.hasLook = source.hasLook;
  target.yaw = source.yaw;
  target.pitch = source.pitch;
  target.zoom = source.zoom;
  return target;
}

// The checks below stay inline rather than going through assertFinite(): a rig reads a pose the
// caller keeps and rewrites in every frame, and a fractional number handed to a call that V8 does
// not inline is boxed. Only a refusal calls out, to write its message.

function refuseNumber(subject: string, name: string, value: unknown, what = 'a finite number'): never {
  throw new RangeError(`${subject}: ${name} must be ${what}, got ${describeValue(value)}`);
}

function refusePosition(subject: string, position: unknown, at = ''): never {
  throw new TypeError(
    `${subject}: ${at}position must be a tuple of 2 or 3 numbers or an object with x, y and an optional z, got ${describeValue(position)}`,
  );
}

function refuseLookShape(subject: string, look: unknown, at = ''): never {
  throw new TypeError(`${subject}: ${at}look must be an object with yaw and pitch, got ${describeValue(look)}`);
}

function refuseOrthographicLook(subject: string, look: unknown): never {
  throw new RangeError(`${subject}: an orthographic projection takes no look other than 0, got ${describeValue(look)}`);
}

/**
 * Reads `pose` into `out`, or throws what `subject` refuses in it: a value that is not an object, a
 * position of another shape or with a number that is not finite, a look that is not an object of
 * two finite numbers or is not 0 under an orthographic projection, a zoom that is not a finite number
 * above 0. `out` is written only once the whole pose has passed. Under an orthographic projection a
 * distance is checked and then ignored. A refusal names the pose `target`, and its fields bare; with
 * `path` — the place of the pose in an argument, as `keys[1].shot` — it names both by that path.
 * Allocates nothing.
 * @internal
 */
export function readPose(subject: string, pose: unknown, orthographic: boolean, out: PoseValues, path?: string): void {
  // the prefix of the name of a field
  const at = path === undefined ? '' : `${path}.`;
  if (typeof pose !== 'object' || pose === null) {
    throw new TypeError(
      `${subject}: ${path ?? 'target'} must be a CameraPose, a camera, a projection or an Object3D, got ${describeValue(pose)}`,
    );
  }
  const {position, look, zoom} = pose as CameraPose;

  let hasPosition = false;
  let x = 0;
  let y = 0;
  let hasDistance = false;
  let distance = 0;
  if (position !== undefined) {
    hasPosition = true;
    if (Array.isArray(position)) {
      const length = position.length;
      if (length !== 2 && length !== 3) refusePosition(subject, position, at);
      x = position[0];
      y = position[1];
      if (!Number.isFinite(x)) refuseNumber(subject, `${at}position[0]`, x);
      if (!Number.isFinite(y)) refuseNumber(subject, `${at}position[1]`, y);
      if (length === 3) {
        distance = position[2];
        if (!Number.isFinite(distance)) refuseNumber(subject, `${at}position[2]`, distance);
        hasDistance = true;
      }
    } else if (typeof position === 'object' && position !== null) {
      const p = position as {x: number; y: number; z?: number};
      x = p.x;
      y = p.y;
      if (!Number.isFinite(x)) refuseNumber(subject, `${at}position.x`, x);
      if (!Number.isFinite(y)) refuseNumber(subject, `${at}position.y`, y);
      const z = p.z;
      if (z !== undefined) {
        if (!Number.isFinite(z)) refuseNumber(subject, `${at}position.z`, z);
        distance = z;
        hasDistance = true;
      }
    } else {
      refusePosition(subject, position, at);
    }
  }

  let hasLook = false;
  let yaw = 0;
  let pitch = 0;
  if (look !== undefined) {
    if (typeof look !== 'object' || look === null) refuseLookShape(subject, look, at);
    yaw = look.yaw;
    pitch = look.pitch;
    if (!Number.isFinite(yaw)) refuseNumber(subject, `${at}look.yaw`, yaw);
    if (!Number.isFinite(pitch)) refuseNumber(subject, `${at}look.pitch`, pitch);
    if (orthographic && (yaw !== 0 || pitch !== 0)) refuseOrthographicLook(subject, look);
    hasLook = true;
  }

  let factor = 1;
  if (zoom !== undefined) {
    if (!(Number.isFinite(zoom) && zoom > 0)) refuseNumber(subject, `${at}zoom`, zoom, 'a finite number above 0');
    factor = zoom;
  }

  out.hasPosition = hasPosition;
  out.x = x;
  out.y = y;
  out.hasDistance = hasDistance && !orthographic;
  out.distance = hasDistance && !orthographic ? distance : 0;
  out.hasLook = hasLook;
  out.yaw = yaw;
  out.pitch = pitch;
  out.zoom = factor;
}

/**
 * Reads the look of `CameraRig#look()` into `out` — `hasLook`, `yaw` and `pitch` —, or throws what
 * `subject` refuses in it, as {@link readPose} does for the `look` of a pose. Allocates nothing.
 * @internal
 */
export function readLook(subject: string, look: unknown, orthographic: boolean, out: PoseValues): void {
  if (typeof look !== 'object' || look === null) refuseLookShape(subject, look);
  const {yaw, pitch} = look as {yaw: number; pitch: number};
  if (!Number.isFinite(yaw)) refuseNumber(subject, 'look.yaw', yaw);
  if (!Number.isFinite(pitch)) refuseNumber(subject, 'look.pitch', pitch);
  if (orthographic && (yaw !== 0 || pitch !== 0)) refuseOrthographicLook(subject, look);
  out.hasLook = true;
  out.yaw = yaw;
  out.pitch = pitch;
}
