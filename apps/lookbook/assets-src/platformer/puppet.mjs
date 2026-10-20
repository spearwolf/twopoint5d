// A pixel puppet: body parts as capsules and discs, shaded in bands by their 2D normal, with
// two-bone IK for arms and legs. A pose is a handful of numbers, the drawing is the same on every
// run — pixel-art figures that can be animated by editing poses instead of pixels.
import {Img} from '../lib/image.mjs';

/** @typedef {import('../lib/image.mjs').RGBA} RGBA */
/** @typedef {[number, number]} Vec */

/**
 * The shading of a part at one pixel.
 * @callback Shade
 * @param {{lit: number, across: number, along: number, nx: number, ny: number}} at `lit` the
 *   normal against the light in [-1, 1], `across` the signed distance from the axis in [-1, 1],
 *   `along` the position on the axis in [0, 1], (`nx`, `ny`) the offset from the axis in radii
 * @returns {RGBA | undefined}
 */

/**
 * Three bands, the classic pixel-art shading of a round part.
 * @param {RGBA} light
 * @param {RGBA} mid
 * @param {RGBA} shadow
 * @param {{high?: number, low?: number}} [cut]
 * @returns {Shade}
 */
export function bands(light, mid, shadow, cut = {}) {
  const {high = 0.35, low = -0.3} = cut;
  return ({lit}) => (lit > high ? light : lit < low ? shadow : mid);
}

export class Puppet {
  /**
   * @param {number} width
   * @param {number} height
   * @param {Vec} [light] where the light comes from, in image space (y down); upper left by default
   */
  constructor(width, height, light = [-0.55, -0.85]) {
    this.img = new Img(width, height);
    const l = Math.hypot(light[0], light[1]);
    /** @type {Vec} */
    this.light = [light[0] / l, light[1] / l];
  }

  /**
   * A capsule from `a` to `b`, radius `r0` at `a` and `r1` at `b`.
   * @param {Vec} a
   * @param {Vec} b
   * @param {number} r0
   * @param {number} r1
   * @param {Shade} shade
   */
  capsule(a, b, r0, r1, shade) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1e-9;
    const len = Math.sqrt(len2);
    const rmax = Math.max(r0, r1);
    const x0 = Math.floor(Math.min(a[0], b[0]) - rmax);
    const x1 = Math.ceil(Math.max(a[0], b[0]) + rmax);
    const y0 = Math.floor(Math.min(a[1], b[1]) - rmax);
    const y1 = Math.ceil(Math.max(a[1], b[1]) + rmax);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
        const cx = a[0] + dx * t;
        const cy = a[1] + dy * t;
        const vx = px - cx;
        const vy = py - cy;
        const r = r0 + (r1 - r0) * t;
        const dist = Math.hypot(vx, vy);
        if (dist > r) continue;
        const nx = vx / r;
        const ny = vy / r;
        const c = shade({
          lit: nx * this.light[0] + ny * this.light[1],
          across: (dx * vy - dy * vx) / len / r,
          along: t,
          nx,
          ny,
        });
        if (c) this.img.set(x, y, c);
      }
    }
  }

  /**
   * @param {Vec} c
   * @param {number} r
   * @param {Shade} shade
   */
  disc(c, r, shade) {
    this.capsule(c, c, r, r, shade);
  }
}

/**
 * Two-bone IK: where the middle joint (knee, elbow) sits for a root, a target and two bone
 * lengths. Of the two solutions it takes the one whose joint lies further along `bend`.
 * @param {Vec} root
 * @param {Vec} target
 * @param {number} l1
 * @param {number} l2
 * @param {Vec} bend a direction the joint should point to
 * @returns {{joint: Vec, end: Vec}} `end` is the target, pulled in when out of reach
 */
export function ik(root, target, l1, l2, bend) {
  let dx = target[0] - root[0];
  let dy = target[1] - root[1];
  let d = Math.hypot(dx, dy) || 1e-6;
  const reach = l1 + l2 - 0.01;
  if (d > reach) {
    dx *= reach / d;
    dy *= reach / d;
    d = reach;
  }
  const end = /** @type {Vec} */ ([root[0] + dx, root[1] + dy]);
  const cos = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const angle = Math.acos(cos);
  const base = Math.atan2(dy, dx);
  const options = [base + angle, base - angle].map(
    (a) => /** @type {Vec} */ ([root[0] + Math.cos(a) * l1, root[1] + Math.sin(a) * l1]),
  );
  const score = (/** @type {Vec} */ j) => (j[0] - root[0]) * bend[0] + (j[1] - root[1]) * bend[1];
  return {joint: score(options[0]) >= score(options[1]) ? options[0] : options[1], end};
}

/**
 * @param {number} degrees 0 = straight down, positive turns towards +x
 * @param {number} length
 * @returns {Vec}
 */
export function down(degrees, length) {
  const a = (degrees * Math.PI) / 180;
  return [Math.sin(a) * length, Math.cos(a) * length];
}

/**
 * @param {Vec} a
 * @param {Vec} b
 * @returns {Vec}
 */
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
