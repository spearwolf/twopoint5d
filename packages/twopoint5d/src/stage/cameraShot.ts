import {type Camera, type OrthographicCamera, type PerspectiveCamera, Quaternion, Vector3} from 'three/webgpu';

const RAD_PER_DEG = Math.PI / 180;

/** The kind of lens of a shot. @internal */
export type CameraShotKind = 'perspective' | 'orthographic';

/**
 * A resolved camera state, as a `CameraRig` blends it: a world position, a world orientation and a
 * lens. The aspect is not part of it — the rig takes it from the container when it writes the shot.
 * @internal
 */
export interface CameraShot {
  position: Vector3;
  quaternion: Quaternion;
  kind: CameraShotKind;
  /** `tan(fov / 2)` of a perspective lens, the height of the view of an orthographic one. */
  lens: number;
  near: number;
  far: number;
  /** The factor on the lens of the base this shot was resolved against: `base lens / lens`. */
  zoom: number;
  /** A share of the picture height by which the picture moves up, through the view offset. */
  lift: number;
}

/** A shot at the origin, unturned, with a perspective lens of 90°. @internal */
export function createShot(): CameraShot {
  return {
    position: new Vector3(),
    quaternion: new Quaternion(),
    kind: 'perspective',
    lens: 1,
    near: 0.1,
    far: 100000,
    zoom: 1,
    lift: 0,
  };
}

/** @internal */
export function copyShot(source: CameraShot, target: CameraShot): CameraShot {
  target.position.copy(source.position);
  target.quaternion.copy(source.quaternion);
  target.kind = source.kind;
  target.lens = source.lens;
  target.near = source.near;
  target.far = source.far;
  target.zoom = source.zoom;
  target.lift = source.lift;
  return target;
}

/** The lens of a perspective camera with the vertical field of view `fov`, in degrees: `tan(fov / 2)`. @internal */
export function perspectiveLens(fov: number): number {
  return Math.tan((fov * RAD_PER_DEG) / 2);
}

/**
 * Blends `a` into `b` at the eased progress `e` and writes the result into `target`, which may be
 * `a`: the position, near, far and lift linearly, the orientation by a slerp that takes the short
 * way, the lens linearly — a perspective one in `tan(fov / 2)`, an orthographic one in the height of
 * its view —, and the zoom so that it stays the factor of the blended lens on the blended base lens.
 * `e` of 0 or below answers `a`, of 1 or above `b`, exactly. For two shots of one kind; a move
 * between the kinds goes through `blendLensChangeAtProgress()`, and a blend of two kinds here keeps
 * `a`'s kind until the end. Allocates nothing.
 * @internal
 */
export function blendShots(a: CameraShot, b: CameraShot, e: number, target: CameraShot): CameraShot {
  blendProgress[0] = e;
  return blendShotsAtProgress(a, b, target);
}

/**
 * The progress {@link blendShotsAtProgress} blends at. V8 boxes a fraction handed across a call it
 * does not inline, and a typed array holds one as it is: a caller on a hot path writes the progress
 * here and calls {@link blendShotsAtProgress}, which takes objects alone.
 * @internal
 */
export const blendProgress = new Float64Array(1);

const quaternionA = new Float64Array(4);
const quaternionB = new Float64Array(4);

/** {@link blendShots} at the progress in `blendProgress[0]`. Allocates nothing. @internal */
export function blendShotsAtProgress(a: CameraShot, b: CameraShot, target: CameraShot): CameraShot {
  const e = blendProgress[0]!;
  if (e <= 0) return copyShot(a, target);
  if (e >= 1) return copyShot(b, target);
  const f = 1 - e;

  // each component on its own, and a * f + b * e: exact at both ends, no call that takes a fraction
  const p = target.position;
  const pa = a.position;
  const pb = b.position;
  p.x = pa.x * f + pb.x * e;
  p.y = pa.y * f + pb.y * e;
  p.z = pa.z * f + pb.z * e;

  // a slerp that turns the short way, as the one of three.js does, worked out on typed arrays: the
  // slerp of three.js takes the progress as an argument, and the accessors of a quaternion answer
  // fractions — toArray() and fromArray() hand objects alone
  const qa = quaternionA;
  const qb = quaternionB;
  a.quaternion.toArray(qa);
  b.quaternion.toArray(qb);
  let cos = qa[0]! * qb[0]! + qa[1]! * qb[1]! + qa[2]! * qb[2]! + qa[3]! * qb[3]!;
  let sign = 1;
  if (cos < 0) {
    sign = -1;
    cos = -cos;
  }
  let ka = f;
  let kb = e * sign;
  const sqrSin = 1 - cos * cos;
  if (sqrSin > Number.EPSILON) {
    const sin = Math.sqrt(sqrSin);
    const half = Math.atan2(sin, cos);
    ka = Math.sin(f * half) / sin;
    kb = (Math.sin(e * half) / sin) * sign;
  }
  let x = qa[0]! * ka + qb[0]! * kb;
  let y = qa[1]! * ka + qb[1]! * kb;
  let z = qa[2]! * ka + qb[2]! * kb;
  let w = qa[3]! * ka + qb[3]! * kb;
  if (sqrSin <= Number.EPSILON) {
    // nearly the same orientation: a linear blend, normalized
    const length = Math.sqrt(x * x + y * y + z * z + w * w);
    x /= length;
    y /= length;
    z /= length;
    w /= length;
  }
  qa[0] = x;
  qa[1] = y;
  qa[2] = z;
  qa[3] = w;
  target.quaternion.fromArray(qa);

  const lens = a.lens * f + b.lens * e;
  // the base lens of each end is lens * zoom; their blend over the blended lens is the zoom
  target.zoom = (a.lens * a.zoom * f + b.lens * b.zoom * e) / lens;
  target.lens = lens;
  target.near = a.near * f + b.near * e;
  target.far = a.far * f + b.far * e;
  target.lift = a.lift * f + b.lift * e;
  target.kind = a.kind;
  return target;
}

/** Whether `a` and `b` carry the same values, compared exactly. Allocates nothing. @internal */
export function shotsEqual(a: CameraShot, b: CameraShot): boolean {
  return (
    a.kind === b.kind &&
    a.lens === b.lens &&
    a.near === b.near &&
    a.far === b.far &&
    a.zoom === b.zoom &&
    a.lift === b.lift &&
    a.position.equals(b.position) &&
    a.quaternion.equals(b.quaternion)
  );
}

type ViewOf<C extends PerspectiveCamera | OrthographicCamera> = NonNullable<C['view']>;

// the view object of `camera`, made on the first call: three makes it in setViewOffset() alone
function viewOf<C extends PerspectiveCamera | OrthographicCamera>(camera: C): ViewOf<C> {
  if (camera.view === null) {
    camera.setViewOffset(1, 1, 0, 0, 1, 1);
    camera.view!.enabled = false;
  }
  return camera.view as ViewOf<C>;
}

/**
 * Writes `shot` into `camera`, which is of the kind of the shot, over `base`, the camera the
 * projection placed: the position, the orientation, near and far, and the lens. A perspective camera
 * takes the aspect `aspect` and the view offset of a perspective base — the offset of `pixelSnap`
 * —; an orthographic camera takes the frustum of an orthographic base, which carries the offset of
 * `pixelSnap` itself, and zooms it by the lens. The lift goes on top as a view offset. A lens equal
 * to the base lens takes the field of view or the zoom of the base as it is, so a shot at the rest
 * writes the very camera the projection placed. Over a base of the other kind — the perspective
 * camera of a lens change on a stage that still has its orthographic projection — the camera takes
 * a field of view from the lens, or a frustum of the height of the lens and of `aspect`, around its
 * axis. Allocates nothing once the camera has a view object.
 * @internal
 */
export function writeShot(shot: CameraShot, base: Camera, camera: Camera, aspect: number): void {
  writeAspect[0] = aspect;
  writeShotAtAspect(shot, base, camera);
}

/**
 * The aspect {@link writeShotAtAspect} writes with, for a caller on a hot path, as
 * {@link blendProgress} is for a blend: the body of the write is too large for V8 to inline, and a
 * fraction handed across a call it does not inline is boxed.
 * @internal
 */
export const writeAspect = new Float64Array(1);

/** {@link writeShot} with the aspect in `writeAspect[0]`. @internal */
export function writeShotAtAspect(shot: CameraShot, base: Camera, camera: Camera): void {
  const aspect = writeAspect[0]!;
  camera.position.copy(shot.position);
  camera.quaternion.copy(shot.quaternion);

  if ((camera as PerspectiveCamera).isPerspectiveCamera === true) {
    const target = camera as PerspectiveCamera;
    const from = (base as PerspectiveCamera).isPerspectiveCamera === true ? (base as PerspectiveCamera) : undefined;
    // before the aspect: the first setViewOffset() writes one of its own
    const view = viewOf(target);
    target.near = shot.near;
    target.far = shot.far;
    target.fov =
      // the lens of the base, inline: a call that V8 does not inline boxes the fraction it answers
      from !== undefined && from.zoom === 1 && shot.lens === Math.tan((from.fov * RAD_PER_DEG) / 2)
        ? from.fov
        : (2 * Math.atan(shot.lens)) / RAD_PER_DEG;
    target.aspect = aspect;
    target.zoom = 1;
    const baseView = from?.view;
    if (baseView != null && baseView.enabled) {
      view.fullWidth = baseView.fullWidth;
      view.fullHeight = baseView.fullHeight;
      view.offsetX = baseView.offsetX;
      view.offsetY = baseView.offsetY + shot.lift * baseView.fullHeight;
      view.width = baseView.width;
      view.height = baseView.height;
      view.enabled = true;
    } else if (shot.lift !== 0) {
      // a full window of the size of the picture, moved down by the lift: the picture moves up
      view.fullWidth = aspect;
      view.fullHeight = 1;
      view.offsetX = 0;
      view.offsetY = shot.lift;
      view.width = aspect;
      view.height = 1;
      view.enabled = true;
    } else {
      view.enabled = false;
    }
  } else {
    const target = camera as OrthographicCamera;
    const from = (base as OrthographicCamera).isOrthographicCamera === true ? (base as OrthographicCamera) : undefined;
    target.near = shot.near;
    target.far = shot.far;
    if (from !== undefined) {
      target.left = from.left;
      target.right = from.right;
      target.top = from.top;
      target.bottom = from.bottom;
      target.zoom = shot.lens === (from.top - from.bottom) / from.zoom ? from.zoom : (from.top - from.bottom) / shot.lens;
    } else {
      const halfHeight = shot.lens / 2;
      target.left = -halfHeight * aspect;
      target.right = halfHeight * aspect;
      target.top = halfHeight;
      target.bottom = -halfHeight;
      target.zoom = 1;
    }
    const view = viewOf(target);
    if (shot.lift !== 0) {
      view.fullWidth = 1;
      view.fullHeight = 1;
      view.offsetX = 0;
      view.offsetY = shot.lift;
      view.width = 1;
      view.height = 1;
      view.enabled = true;
    } else {
      view.enabled = false;
    }
  }

  (camera as PerspectiveCamera | OrthographicCamera).updateProjectionMatrix();
  camera.updateMatrixWorld();
}
