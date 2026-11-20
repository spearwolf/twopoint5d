import type {Object3D} from 'three/webgpu';

import type {ProjectionPlane} from '../stage/ProjectionPlane.js';
import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {describeValue} from '../utils/describeValue.js';
import {isFiniteNumber} from '../utils/isFiniteNumber.js';
import {POSE_DEG, POSE_DEPTH, POSE_SCALE_X, POSE_SCALE_Y, POSE_SIZE, POSE_X, POSE_Y} from './artPose.js';

/**
 * How the canvas of the artwork lies in the art frame, worked out once from the options of the art.
 * `originX` and `originY` are canvas pixels; the focus is in units of the art frame.
 */
export interface ArtFrame {
  pxPerUnit: number;
  originX: number;
  originY: number;
  focusX: number;
  focusY: number;
}

/** The box of a layer on the canvas, in artwork pixels. */
export interface LayerBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function pairOf(subject: string, name: string, value: unknown): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || !isFiniteNumber(value[0]) || !isFiniteNumber(value[1])) {
    throw new TypeError(`${subject}: ${name} must be a pair of finite numbers, got ${describeValue(value)}`);
  }
  return [value[0], value[1]];
}

/**
 * Checks `pxPerUnit`, `origin` and `focus` as the options of an art give them (`undefined` is not
 * given) and answers the frame: `pxPerUnit` 1, `origin` the middle of the canvas, `[0, 0]` without
 * a canvas, `focus` the origin.
 *
 * @throws {RangeError} for a `pxPerUnit` that is no finite number above 0.
 * @throws {TypeError} for an `origin` or `focus` that is no pair of finite numbers.
 */
export function artFrameOf(
  subject: string,
  pxPerUnit: unknown,
  origin: unknown,
  focus: unknown,
  canvas: {width: number; height: number} | undefined,
): ArtFrame {
  const scale = pxPerUnit === undefined ? 1 : assertPositiveFinite(pxPerUnit, subject, 'pxPerUnit');
  const [originX, originY] =
    origin === undefined ? [(canvas?.width ?? 0) / 2, (canvas?.height ?? 0) / 2] : pairOf(subject, 'origin', origin);
  const [focusPxX, focusPxY] = focus === undefined ? [originX, originY] : pairOf(subject, 'focus', focus);
  return {
    pxPerUnit: scale,
    originX,
    originY,
    focusX: (focusPxX - originX) / scale,
    focusY: (originY - focusPxY) / scale,
  };
}

/**
 * Writes `k = (D + δ) / D` into `out[0]`, with `δ = depthPx / pxPerUnit`; 1 for a depth of 0.
 * A `D` of `NaN` means "draw uncompensated" and gives 1; the caller tells "no view yet" (lay out
 * again once a view gives a `D`) from "never compensated" (an orthographic projection, no
 * projection, `compensateDepth: false`). The caller has checked `D + δ > 0`: this does not guard it.
 */
export function depthScaleInto(D: number, depthPx: number, frame: ArtFrame, out: Float64Array): void {
  out[0] = Number.isNaN(D) ? 1 : (D + depthPx / frame.pxPerUnit) / D;
}

/**
 * Writes the sprite of a layer into `out[0…5]`: `x`, `y`, `z` — the place of the pivot in the art
 * frame, scaled about the focus by `k` —, the `width` and `height` of the box times the scale and
 * `k`, in units, and the `rotation` in radians (clockwise degrees are negative about +z).
 * The pose is the row `row` of `pose`.
 */
export function layoutLayerInto(
  frame: ArtFrame,
  pose: Float64Array,
  row: number,
  box: LayerBox,
  k: number,
  out: Float64Array,
): void {
  const at = row * POSE_SIZE;
  const ppu = frame.pxPerUnit;
  const ux = (pose[at + POSE_X]! - frame.originX) / ppu;
  const uy = (frame.originY - pose[at + POSE_Y]!) / ppu;
  out[0] = frame.focusX + (ux - frame.focusX) * k;
  out[1] = frame.focusY + (uy - frame.focusY) * k;
  out[2] = -pose[at + POSE_DEPTH]! / ppu;
  out[3] = (box.w * pose[at + POSE_SCALE_X]! * k) / ppu;
  out[4] = (box.h * pose[at + POSE_SCALE_Y]! * k) / ppu;
  out[5] = (-pose[at + POSE_DEG]! * Math.PI) / 180;
}

/** Writes the anchor of a pivot in a box, fractions from its top left, into `out[0…1]`. */
export function anchorOf(box: LayerBox, pivotX: number, pivotY: number, out: Float64Array): void {
  out[0] = (pivotX - box.x) / box.w;
  out[1] = (pivotY - box.y) / box.h;
}

/**
 * Turns `mesh` to face `plane` — its rotation reset first, since `applyRotation()` multiplies onto
 * what is there.
 */
export function turnToPlane(mesh: Object3D, plane: ProjectionPlane): void {
  mesh.quaternion.identity();
  plane.applyRotation(mesh);
}
