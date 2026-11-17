import {blendProgress, blendShotsAtProgress, type CameraShot, copyShot} from './cameraShot.js';

/**
 * The distance of the camera from the focus plane is capped at this many times the visible height
 * there: further away the precision of float32 in the view matrix shows.
 * @internal
 */
export const LENS_CHANGE_DISTANCE_CAP = 1000;

/**
 * What a lens change — a move between a perspective and an orthographic shot — needs beside its two
 * ends, and what it reports back. A `CameraRig` keeps one and rewrites its inputs in every frame.
 * @internal
 */
export interface LensChange {
  /** In: the distance from the camera of the first shot to its focus plane. */
  focusA: number;
  /** In: the distance from the camera of the second shot to its focus plane. */
  focusB: number;
  /** In: the depth of the scene in front of and behind the focus plane; `NaN` for the visible height. */
  depth: number;
  /** In: the larger side of the container, in its units — what half a pixel is measured in. */
  containerSize: number;
  /** Out: the distance from the focus plane at which the perspective camera meets the orthographic one. */
  swapDistance: number;
  /** Out: the parallax there across the depth, in units of the container — the step of the swap. */
  swapStep: number;
}

/** @internal */
export function createLensChange(): LensChange {
  // fractions from the start, so that V8 keeps the fields as doubles
  return {focusA: 0.5, focusB: 0.5, depth: Number.NaN, containerSize: 0.5, swapDistance: 0.5, swapStep: 0.5};
}

/**
 * The parallax, in units of the container, between a perspective camera `distance` away from the
 * focus plane and the orthographic camera that shows the same height there, for what lies `depth` in
 * front of the focus plane at the edge of a container whose larger side is `containerSize`. For
 * specs and the guide; the blend works it out inline.
 * @internal
 */
export function lensChangeStep(distance: number, depth: number, containerSize: number): number {
  return distance > depth ? ((containerSize / 2) * depth) / (distance - depth) : Number.POSITIVE_INFINITY;
}

// the quaternions of the ends and of the blend, as toArray() hands them: the accessors of a
// quaternion answer fractions, and a fraction a call answers may be boxed
const quaternionSlot = new Float64Array(4);

/**
 * Blends shot `a` into shot `b` of the other kind at the progress in `blendProgress[0]`, as a dolly
 * zoom, into `out`: the focus plane keeps its size on the screen. Its visible height `h` blends
 * linearly from one end to the other; the strength of the perspective `s = tan(fov / 2)` falls in
 * log space toward the orthographic end while the camera backs off to `d = h / (2s)` along its axis,
 * so the parallax fades; near and far keep their distances from the focus plane. The perspective
 * reaches the orthographic end where the parallax across `depth` in front of and behind the focus
 * plane stays below half a unit of the container, at a distance capped at
 * {@link LENS_CHANGE_DISTANCE_CAP} times `h`: `out` is the perspective shot there for every progress
 * inside `(0, 1)`, `a` at 0 and below, `b` at 1 and above, exactly. Position and orientation blend
 * as `blendShotsAtProgress()` blends them, about the focus points of the two ends. `out` may be `a`.
 *
 * Writes the swap distance and its step into `change`. Allocates nothing.
 * @internal
 */
export function blendLensChangeAtProgress(a: CameraShot, b: CameraShot, change: LensChange, out: CameraShot): CameraShot {
  const e = blendProgress[0]!;
  if (e <= 0) return copyShot(a, out);
  if (e >= 1) return copyShot(b, out);
  const f = 1 - e;

  const perspectiveA = a.kind === 'perspective';
  const focusA = change.focusA;
  const focusB = change.focusB;
  const q = quaternionSlot;

  // the focus point of each end: the point its camera looks at on the focus plane
  a.quaternion.toArray(q);
  let x = q[0]!;
  let y = q[1]!;
  let z = q[2]!;
  let w = q[3]!;
  // the direction a camera looks along: (0, 0, -1) turned by its quaternion
  const pa = a.position;
  const focusAx = pa.x - 2 * (x * z + w * y) * focusA;
  const focusAy = pa.y + 2 * (w * x - y * z) * focusA;
  const focusAz = pa.z - (1 - 2 * (x * x + y * y)) * focusA;

  b.quaternion.toArray(q);
  x = q[0]!;
  y = q[1]!;
  z = q[2]!;
  w = q[3]!;
  const pb = b.position;
  const focusBx = pb.x - 2 * (x * z + w * y) * focusB;
  const focusBy = pb.y + 2 * (w * x - y * z) * focusB;
  const focusBz = pb.z - (1 - 2 * (x * x + y * y)) * focusB;

  // the visible height at the focus plane: 2 · distance · tan(fov / 2), or the height of the view
  const heightA = perspectiveA ? 2 * focusA * a.lens : a.lens;
  const heightB = perspectiveA ? b.lens : 2 * focusB * b.lens;
  const perspectiveLens = perspectiveA ? a.lens : b.lens;
  const perspectiveZoom = perspectiveA ? a.zoom : b.zoom;
  const orthographicHeight = perspectiveA ? heightB : heightA;

  // where the perspective meets the orthographic end: the parallax at the edge of the container,
  // (size / 2) · depth / (d − depth), below half a unit — d = depth · (size + 2) —, capped
  const depth = change.depth > 0 ? change.depth : orthographicHeight;
  const size = change.containerSize;
  let swapDistance = depth * (size + 2);
  const cap = LENS_CHANGE_DISTANCE_CAP * orthographicHeight;
  if (swapDistance > cap) swapDistance = cap;
  let swapLens = orthographicHeight / (2 * swapDistance);
  // a scene flat enough for the perspective end itself needs no backing off
  if (swapLens > perspectiveLens) {
    swapLens = perspectiveLens;
    swapDistance = orthographicHeight / (2 * swapLens);
  }
  change.swapDistance = swapDistance;
  change.swapStep = swapDistance > depth ? ((size / 2) * depth) / (swapDistance - depth) : Number.POSITIVE_INFINITY;

  // everything of `a` before the slerp below writes `out`, which may be `a`
  const height = heightA * f + heightB * e;
  const lensA = perspectiveA ? a.lens : swapLens;
  const lensB = perspectiveA ? swapLens : b.lens;
  const lens = Math.exp(Math.log(lensA) * f + Math.log(lensB) * e);
  const distance = height / (2 * lens);
  // near and far as distances from the focus plane, which the camera carries along as it backs off
  const nearOffset = (focusA - a.near) * f + (focusB - b.near) * e;
  const farOffset = (a.far - focusA) * f + (b.far - focusB) * e;

  // the orientation by the slerp of a blend of one kind; the rest is written over below
  blendShotsAtProgress(a, b, out);

  out.quaternion.toArray(q);
  x = q[0]!;
  y = q[1]!;
  z = q[2]!;
  w = q[3]!;
  const p = out.position;
  p.x = focusAx * f + focusBx * e + 2 * (x * z + w * y) * distance;
  p.y = focusAy * f + focusBy * e - 2 * (w * x - y * z) * distance;
  p.z = focusAz * f + focusBz * e + (1 - 2 * (x * x + y * y)) * distance;

  let near = distance - nearOffset;
  const minNear = distance * 1e-6;
  if (!(near > minNear)) near = minNear;
  let far = distance + farOffset;
  if (!(far > near)) far = near + distance;

  out.kind = 'perspective';
  out.lens = lens;
  // the factor on the base lens of the perspective end, as the zoom of a perspective shot is
  out.zoom = (perspectiveLens * perspectiveZoom) / lens;
  out.near = near;
  out.far = far;
  return out;
}
