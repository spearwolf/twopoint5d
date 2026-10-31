// stage-masks/portal: the shared numbers and helpers of "The Painting in the Hallway". The hallway
// is a box in units of the stage — x across, y up, z along the hallway towards the viewer — and
// every image is drawn in those units, so the numbers below are the numbers the demo uses. The
// generic SVG kit (paths, filters, rasterising) is the one of the spotlight demo, the webp encoders
// are the ones of the rift demo.
export {encodeWebpRGB, encodeWebpRGBA} from '../rift/kit.mjs';
export {blobPath, blurFilter, el, lerp, n, poly, rasterize, rgb, sat, smoothstep, strokeText, svgDoc} from '../spotlight/svg.mjs';

/** The cross-section of the hallway, in units: the floor, the ceiling and the two walls. */
export const HALL = {floor: -200, ceiling: 220, halfWidth: 180};
/** One repeat of the wall along the hallway (one wainscot panel, two repeats of the damask). */
export const WALL_PERIOD = 128;
/** One repeat of the floor and the runner along the hallway. */
export const FLOOR_PERIOD = 256;
/** The heights of the wall's parts, in units: skirting, wainscot, dado rail, paper, cornice. */
export const WALL = {skirting: -186, rail: -66, paper: -56, cornice: 186};
/** The runner on the floor: its half width, in units. */
export const RUNNER = 98;

/** The portrait frame: its outer half extents, the width of its moulding and the oval of the canvas. */
export const FRAME = {hw: 118, hh: 148, moulding: 38, rx: 72, ry: 100};
/** The doors: the size of a door with its architrave, standing on the floor. */
export const DOOR = {w: 132, h: 300};

/** texels per unit of each image */
export const TX = {wall: 4, floor: 4, door: 4, frame: 5};

/** @param {number} a @param {number} b @param {number} t */
const mix = (a, b, t) => a + (b - a) * t;

/** @param {number} x @param {number} y @param {number} seed */
function hash(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Value noise in [0, 1] that repeats every `px` cells along x and every `py` along y (0: never), so
 * an image drawn from it tiles.
 * @param {number} x @param {number} y @param {number} seed @param {number} px @param {number} py
 */
export function tileNoise(x, y, seed, px = 0, py = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const wx = (/** @type {number} */ v) => (px ? ((v % px) + px) % px : v);
  const wy = (/** @type {number} */ v) => (py ? ((v % py) + py) % py : v);
  const a = hash(wx(x0), wy(y0), seed);
  const b = hash(wx(x0 + 1), wy(y0), seed);
  const c = hash(wx(x0), wy(y0 + 1), seed);
  const d = hash(wx(x0 + 1), wy(y0 + 1), seed);
  return mix(mix(a, b, sx), mix(c, d, sx), sy);
}

/**
 * Fractal {@link tileNoise}: each octave twice as fine, its periods doubled with it.
 * @param {number} x @param {number} y @param {number} seed @param {number} octaves
 * @param {number} [px] @param {number} [py]
 */
export function tileFbm(x, y, seed, octaves, px = 0, py = 0) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileNoise(x * f, y * f, seed + o * 131, px * f, py * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/** A float RGBA image, 0..1 per channel. @param {number} w @param {number} h */
export const floatImage = (w, h) => new Float32Array(w * h * 4);

/**
 * Lays a straight-alpha RGBA byte image over a float RGBA image, in place: colour by its alpha,
 * and the alpha of the result grows as "over" says.
 * @param {Float32Array} dst @param {Uint8Array} src @param {number} [opacity]
 */
export function overFloat(dst, src, opacity = 1) {
  for (let i = 0; i < src.length; i += 4) {
    const a = (src[i + 3] / 255) * opacity;
    if (a === 0) continue;
    dst[i] = mix(dst[i], src[i] / 255, a);
    dst[i + 1] = mix(dst[i + 1], src[i + 1] / 255, a);
    dst[i + 2] = mix(dst[i + 2], src[i + 2] / 255, a);
    dst[i + 3] = a + dst[i + 3] * (1 - a);
  }
}
