import {
  type Camera,
  type Object3D,
  type OrthographicCamera,
  type PerspectiveCamera,
  Quaternion,
  type Vector3,
} from 'three/webgpu';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {copyPoseValues, type PoseValues} from './cameraPose.js';
import type {CameraShot, CameraShotKind} from './cameraShot.js';
import type {IProjection} from './IProjection.js';
import type {Rest} from './cameraRest.js';

/** What a target of a `CameraRig` is, in the order the rig asks: camera, other `Object3D`, projection, pose. @internal */
export type TargetKind = 'camera' | 'object' | 'projection' | 'pose';

/** The kind of lens of `camera`: perspective, orthographic, or neither. @internal */
export const kindOf = (camera: Camera): CameraShotKind | undefined => {
  if ((camera as PerspectiveCamera).isPerspectiveCamera === true) return 'perspective';
  if ((camera as OrthographicCamera).isOrthographicCamera === true) return 'orthographic';
  return undefined;
};

/**
 * The kind of `target`, asked in this order: a camera (`isCamera`), any other `Object3D`
 * (`isObject3D`), an `IProjection` (it has `updateViewRect()`), and a pose for anything else, which
 * the pose reader then checks. A camera of neither lens kind is refused with `subject`. Allocates
 * nothing.
 * @internal
 */
export function kindOfTarget(subject: string, target: unknown): TargetKind {
  if (typeof target === 'object' && target !== null) {
    if ((target as Partial<Camera>).isCamera === true) {
      if (kindOf(target as Camera) === undefined) {
        throw new TypeError(
          `${subject}: a camera as a target must be a PerspectiveCamera or an OrthographicCamera, got ${describeThreeValue(target, 'isObject3D')}`,
        );
      }
      return 'camera';
    }
    if ((target as Partial<Object3D>).isObject3D === true) return 'object';
    if (typeof (target as Partial<IProjection>).updateViewRect === 'function') return 'projection';
  }
  return 'pose';
}

/**
 * The pose of an `Object3D` target into `out`: the zoom and the distance of `current`, the pose of
 * the rig — or of `shown`, where there is one, against `rest`: the shot `cancel()` holds, or the one
 * a track or a camera shows, whose look the object drops —, the distance of `offset` where it names
 * one, and a place the object gives in every frame. Its look is the one of the rig, which it keeps.
 * Allocates nothing.
 * @internal
 */
export function readObjectPose(
  current: PoseValues,
  shown: CameraShot | undefined,
  rest: Rest,
  offset: readonly number[] | undefined,
  out: PoseValues,
): void {
  copyPoseValues(current, out);
  if (shown !== undefined) {
    const p = shown.position;
    const o = rest.origin;
    const n = rest.normal;
    out.zoom = shown.kind === rest.kind ? shown.zoom : 1;
    out.hasDistance = rest.hasPlane;
    out.distance = (p.x - o.x) * n.x + (p.y - o.y) * n.y + (p.z - o.z) * n.z;
  }
  out.hasPosition = true;
  out.x = 0;
  out.y = 0;
  out.hasLook = false;
  if (offset !== undefined && offset.length === 3) {
    out.hasDistance = true;
    out.distance = offset[2]!;
  }
}

/**
 * What a `CameraRig` keeps of an `Object3D` it follows: the object, the offset of the move and its
 * `smooth`, and the trailing — the place of the camera in the frame, relative to the rest, and its
 * velocity, as a critically damped spring has carried them toward the object.
 * @internal
 */
export interface ObjectFollow {
  object: Object3D | undefined;
  offsetX: number;
  offsetY: number;
  /** The time constant of the trailing in seconds; 0 sticks to the object. */
  smooth: number;
  /** Whether the trailing has its start: it starts where the object stands once the rig locked on. */
  started: boolean;
  /** Whether the trailing has yet to reach the object. */
  trailing: boolean;
  /** In: the time of the step the trailing advances by. */
  delta: number;
  /** The place the object gives the camera, relative to the rest: its foot plus the offset. */
  goalX: number;
  goalY: number;
  /** The place the trailing has reached, and its velocity. */
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** @internal */
export function createObjectFollow(): ObjectFollow {
  // fractions from the start, so that V8 keeps the fields as doubles
  return {
    object: undefined,
    offsetX: 0.5,
    offsetY: 0.5,
    smooth: 0.5,
    started: false,
    trailing: false,
    delta: 0.5,
    goalX: 0.5,
    goalY: 0.5,
    x: 0.5,
    y: 0.5,
    vx: 0.5,
    vy: 0.5,
  };
}

/**
 * The place the object of `follow` gives the camera, into `goalX` and `goalY`: the world position of
 * the object — `updateWorldMatrix(true, false)`, then the translation of `matrixWorld`; its
 * orientation and scale left out —, carried into the frame of `rest` along its right and up axes,
 * relative to the position of the rest, plus the offset. Under a plane this is the foot of the
 * object on the plane. Allocates nothing.
 * @internal
 */
export function readObjectGoal(follow: ObjectFollow, rest: Rest): void {
  const object = follow.object!;
  object.updateWorldMatrix(true, false);
  const e = object.matrixWorld.elements;
  const at = rest.position;
  const dx = e[12]! - at.x;
  const dy = e[13]! - at.y;
  const dz = e[14]! - at.z;
  const r = rest.right;
  const u = rest.up;
  follow.goalX = dx * r.x + dy * r.y + dz * r.z + follow.offsetX;
  follow.goalY = dx * u.x + dy * u.y + dz * u.z + follow.offsetY;
}

// the trailing has reached the object where the gap falls below this, squared: |q - p| < 1e-4
const SETTLED_SQUARED = 1e-8;

/**
 * Advances the trailing of `follow` by `follow.delta` seconds toward the place the object gives the
 * camera now, as a critically damped spring with the time constant `smooth`, worked out exactly for
 * a goal that stands through the step: it closes the gap without overshooting it from rest. The
 * first call after a lock-on starts it on the object. Where the gap falls below `1e-4` the trailing
 * settles on the object and `trailing` turns `false`. Allocates nothing.
 * @internal
 */
export function trailObject(follow: ObjectFollow, rest: Rest): void {
  readObjectGoal(follow, rest);
  const goalX = follow.goalX;
  const goalY = follow.goalY;
  if (!follow.started) {
    follow.x = goalX;
    follow.y = goalY;
    follow.vx = 0;
    follow.vy = 0;
    follow.started = true;
    follow.trailing = false;
    return;
  }

  const dt = follow.delta;
  if (dt > 0) {
    // e(t) = (e + (v + ωe)·t)·exp(−ωt), v(t) = (v − ω(v + ωe)·t)·exp(−ωt), with e the gap p − q
    const omega = 1 / follow.smooth;
    const decay = Math.exp(-omega * dt);
    const ex = follow.x - goalX;
    const ey = follow.y - goalY;
    const tx = (follow.vx + omega * ex) * dt;
    const ty = (follow.vy + omega * ey) * dt;
    follow.x = goalX + (ex + tx) * decay;
    follow.y = goalY + (ey + ty) * decay;
    follow.vx = (follow.vx - omega * tx) * decay;
    follow.vy = (follow.vy - omega * ty) * decay;
  }

  const gx = goalX - follow.x;
  const gy = goalY - follow.y;
  if (gx * gx + gy * gy < SETTLED_SQUARED) {
    follow.x = goalX;
    follow.y = goalY;
    follow.vx = 0;
    follow.vy = 0;
    follow.trailing = false;
  } else {
    follow.trailing = true;
  }
}

/**
 * A look of a `CameraRig`, in radians, relative to the orientation of a rest: yaw about the up axis
 * of the frame, then pitch about the right axis of the camera.
 * @internal
 */
export interface Look {
  yaw: number;
  pitch: number;
}

/** A look of 0. @internal */
export function createLook(): Look {
  // fractions from the start, so that V8 keeps the fields as doubles
  const look = {yaw: 0.5, pitch: 0.5};
  look.yaw = 0;
  look.pitch = 0;
  return look;
}

// the turn of a look, as a quaternion handed to fromArray(): setFromAxisAngle() takes the angle as
// an argument, and a fraction handed to a call that V8 does not inline is boxed
const turnSlot = new Float64Array(4);
const turn = new Quaternion();

/**
 * The orientation of `rest` turned by `look` into `out`: the yaw about the up axis of the frame, in
 * the world — premultiplied —, then the pitch about the right axis of the camera, in its own space
 * — multiplied. Allocates nothing.
 * @internal
 */
export function writeTurn(rest: Rest, look: Look, out: Quaternion): void {
  out.copy(rest.quaternion);
  applyLook(rest.up, look, out);
}

/**
 * Turns `out` by `look`: the yaw about `up`, in the world — premultiplied —, then the pitch about
 * the right axis of the camera, in its own space — multiplied. A look of 0 leaves `out` as it is.
 * Allocates nothing.
 * @internal
 */
export function applyLook(up: Vector3, look: Look, out: Quaternion): void {
  const slot = turnSlot;
  const yaw = look.yaw;
  if (yaw !== 0) {
    const half = yaw / 2;
    const sin = Math.sin(half);
    slot[0] = up.x * sin;
    slot[1] = up.y * sin;
    slot[2] = up.z * sin;
    slot[3] = Math.cos(half);
    out.premultiply(turn.fromArray(slot));
  }
  const pitch = look.pitch;
  if (pitch !== 0) {
    const half = pitch / 2;
    slot[0] = Math.sin(half);
    slot[1] = 0;
    slot[2] = 0;
    slot[3] = Math.cos(half);
    out.multiply(turn.fromArray(slot));
  }
}

/**
 * The position of `pose` against `rest` into `out`: x and y along the axes of the frame, the
 * distance along its normal, relative to the position of the rest; the rest's own where the pose
 * names none. An orthographic rest leaves the distance out. Allocates nothing.
 * @internal
 */
export function writePosePosition(rest: Rest, pose: PoseValues, out: Vector3): void {
  if (!pose.hasPosition) {
    out.copy(rest.position);
    return;
  }
  const along = pose.hasDistance && rest.kind === 'perspective' ? pose.distance - rest.distance : 0;
  const r = rest.right;
  const u = rest.up;
  const n = rest.normal;
  const x = pose.x;
  const y = pose.y;
  const at = rest.position;
  out.x = at.x + r.x * x + u.x * y + n.x * along;
  out.y = at.y + r.y * x + u.y * y + n.y * along;
  out.z = at.z + r.z * x + u.z * y + n.z * along;
}

/**
 * The shot of `pose` against `rest` into `out`: its position, the orientation of the rest turned by
 * `look`, the lens of the rest divided by the zoom of the pose, near and far of the rest, no lift.
 * The look of the pose is not read: the caller hands the one it shows in `look`. Allocates nothing.
 * @internal
 */
export function resolvePoseShot(rest: Rest, pose: PoseValues, look: Look, out: CameraShot): void {
  writePosePosition(rest, pose, out.position);
  writeTurn(rest, look, out.quaternion);
  const zoom = pose.zoom;
  out.kind = rest.kind;
  out.zoom = zoom;
  out.lens = rest.lens / zoom;
  out.near = rest.near;
  out.far = rest.far;
  out.lift = 0;
}
