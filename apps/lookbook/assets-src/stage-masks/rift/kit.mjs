// stage-masks/rift: the frame and the helpers of the "Deep Listening" generators. Every scene is
// drawn in units of the stage — origin in the middle, y up — under one SVG transform, so the
// numbers below are the numbers the demo uses. The generic SVG kit (paths, filters, rasterising)
// is the one of the spotlight demo.
import sharp from 'sharp';
import {el, n, sat} from '../spotlight/svg.mjs';

export {blobPath, blurFilter, el, lerp, n, poly, rasterize, rgb, sat, smoothstep, svgDoc} from '../spotlight/svg.mjs';

/** 2 texels per unit: crisp at 1080p, where the `cover` view of 960 × 540 units has 2 px per unit */
export const PX = 2;
/** the world the two room images cover, in units: wider and taller than the view, for `cover` */
export const WORLD = {left: -600, right: 600, bottom: -320, top: 320};
export const IMG_W = (WORLD.right - WORLD.left) * PX;
export const IMG_H = (WORLD.top - WORLD.bottom) * PX;

/** The opening of the window, in units: the two rooms are see-through here, the backdrops lie behind. */
export const WINDOW = {left: 42, right: 418, bottom: -28, top: 213};
/** The mullions of the window: the x of their middles and their width. */
export const MULLIONS = [167, 293];
export const MULLION_W = 8;
/** The backdrop behind the window (sky or deep), in units: the opening and a margin. */
export const BACKDROP = {left: 20, right: 440, bottom: -50, top: 235};

/** The floor line and the top of the desk, in units. */
export const FLOOR_Y = -210;
export const DESK_Y = -78;

/** The three oscilloscopes on the desk: the middle and the size of each screen, in units. */
export const SCOPES = [
  {x: -265, y: -14, w: 66, h: 50},
  {x: -165, y: -14, w: 66, h: 50},
  {x: -65, y: -14, w: 66, h: 50},
];
/** The two reels of the tape recorder in the rack: middles and radius, in units. */
export const REELS = [
  {x: -522, y: 124},
  {x: -398, y: 124},
];
export const REEL_R = 40;
/** The desk lamp's bulb, in units: the warm light of the night room comes from here. */
export const LAMP = {x: 150, y: -14};
/** The dish outside (the night) and the jellyfish in its place (the deep), in units. */
export const DISH = {x: 262, y: 66};
/** Where the kelp of the drowned room grows from the floor: x, height in units. */
export const KELP = [
  {x: -585, h: 330, frame: 'kelp-a'},
  {x: -330, h: 250, frame: 'kelp-b'},
  {x: -205, h: 300, frame: 'kelp-c'},
  {x: 8, h: 210, frame: 'kelp-d'},
  {x: 238, h: 270, frame: 'kelp-b'},
  {x: 438, h: 345, frame: 'kelp-a'},
  {x: 585, h: 290, frame: 'kelp-c'},
];

/**
 * A whole SVG document of the world, drawn in units with y up.
 * @param {string[]} defs @param {string[]} body
 * @param {{left: number, right: number, bottom: number, top: number}} [frame]
 */
export function worldDoc(defs, body, frame = WORLD) {
  const w = (frame.right - frame.left) * PX;
  const h = (frame.top - frame.bottom) * PX;
  const t = `matrix(${PX} 0 0 ${-PX} ${n(-frame.left * PX)} ${n(frame.top * PX)})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs.join('')}</defs><g transform="${t}">${body.join('')}</g></svg>`;
}

/**
 * A rectangle from (x0, y0) to (x1, y1) in units.
 * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
 * @param {Record<string, string | number | undefined>} attrs
 */
export const box = (x0, y0, x1, y1, attrs) =>
  el('rect', {x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0), ...attrs});

/**
 * A vertical linear gradient in units.
 * @param {string} id @param {number} y0 @param {number} y1 @param {[number, string, number?][]} stops offset, colour, opacity
 */
export const vgrad = (id, y0, y1, stops) =>
  el(
    'linearGradient',
    {id, gradientUnits: 'userSpaceOnUse', x1: 0, y1: y0, x2: 0, y2: y1},
    stops.map(([o, c, a]) => el('stop', {offset: o, 'stop-color': c, 'stop-opacity': a ?? 1})),
  );

/**
 * A radial gradient in units.
 * @param {string} id @param {number} cx @param {number} cy @param {number} r @param {[number, string, number?][]} stops
 */
export const rgrad = (id, cx, cy, r, stops) =>
  el(
    'radialGradient',
    {id, gradientUnits: 'userSpaceOnUse', cx, cy, r},
    stops.map(([o, c, a]) => el('stop', {offset: o, 'stop-color': c, 'stop-opacity': a ?? 1})),
  );

/**
 * Encodes a straight-alpha RGBA float image (0..1) as a webp with alpha.
 * @param {Float32Array} rgbaf @param {number} w @param {number} h
 * @returns {Promise<Buffer>}
 */
export async function encodeWebpRGBA(rgbaf, w, h) {
  const bytes = new Uint8Array(w * h * 4);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(sat(rgbaf[i]) * 255);
  // a fully transparent texel keeps no colour: it compresses better and bleeds nothing when filtered
  for (let i = 0; i < bytes.length; i += 4) if (bytes[i + 3] === 0) bytes[i] = bytes[i + 1] = bytes[i + 2] = 0;
  return sharp(Buffer.from(bytes.buffer), {raw: {width: w, height: h, channels: 4}})
    .webp({quality: 88, alphaQuality: 90, effort: 6, smartSubsample: true})
    .toBuffer();
}

/**
 * Encodes an RGB float image (0..1, 4 floats per pixel, alpha ignored) as an opaque webp.
 * @param {Float32Array} rgbaf @param {number} w @param {number} h
 * @returns {Promise<Buffer>}
 */
export async function encodeWebpRGB(rgbaf, w, h) {
  const bytes = new Uint8Array(w * h * 3);
  for (let p = 0, i = 0; i < bytes.length; p += 4, i += 3) {
    bytes[i] = Math.round(sat(rgbaf[p]) * 255);
    bytes[i + 1] = Math.round(sat(rgbaf[p + 1]) * 255);
    bytes[i + 2] = Math.round(sat(rgbaf[p + 2]) * 255);
  }
  return sharp(Buffer.from(bytes.buffer), {raw: {width: w, height: h, channels: 3}})
    .webp({quality: 88, effort: 6, smartSubsample: true})
    .toBuffer();
}

/**
 * Straight RGBA bytes to RGBA floats.
 * @param {Uint8Array} src
 */
export function toFloat(src) {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i] / 255;
  return out;
}

/**
 * Lays straight RGBA bytes over a straight RGBA float image, in place (`over`, alpha included).
 * @param {Float32Array} dst @param {Uint8Array} src
 */
export function overRGBA(dst, src) {
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3] / 255;
    if (a === 0) continue;
    const da = dst[i + 3];
    const oa = a + da * (1 - a);
    for (let c = 0; c < 3; c++) dst[i + c] = (src[i + c] / 255) * a + (dst[i + c] * da * (1 - a)) / oa;
    dst[i + 3] = oa;
  }
}

/**
 * Adds straight RGBA bytes as light (rgb × alpha) to a straight RGBA float image, in place. Where
 * the image is see-through the light is weighed by its alpha: a glow does not paint the window.
 * @param {Float32Array} dst @param {Uint8Array} src @param {number} [gain]
 */
export function addLight(dst, src, gain = 1) {
  for (let i = 0; i < src.length; i += 4) {
    const a = (src[i + 3] / 255) * gain;
    if (a === 0) continue;
    for (let c = 0; c < 3; c++) dst[i + c] += (src[i + c] / 255) * a;
  }
}
