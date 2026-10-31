// stage-masks/spotlight: the drawing kit of the "Ward C, 3:07 a.m." generators. The scenes are
// written as SVG — paths, gradients, blurred shadows, strokes — and rasterised by sharp's librsvg
// at the output resolution, then laid over a floor that is shaded pixel by pixel in JavaScript.
// No font is used: the few letters and numbers in the scenes are strokes of a font defined here,
// so the output does not depend on the fonts of the machine.
import sharp from 'sharp';

/** @typedef {[number, number, number]} RGB */

/** 2 texels per unit of the stage: crisp at 1080p, where the `cover` view has 2 px per unit */
export const PX = 2;
/** the world the two level images cover, in units, origin in the middle, y up */
export const WORLD = {left: -600, right: 600, bottom: -320, top: 320};
export const IMG_W = (WORLD.right - WORLD.left) * PX;
export const IMG_H = (WORLD.top - WORLD.bottom) * PX;

/** world x in units to image x in pixels */
export const X = (/** @type {number} */ x) => (x - WORLD.left) * PX;
/** world y in units (up) to image y in pixels (down) */
export const Y = (/** @type {number} */ y) => (WORLD.top - y) * PX;

/** @param {number} v */
export const sat = (v) => Math.min(1, Math.max(0, v));
/** @param {number} e0 @param {number} e1 @param {number} x  e0 < e1 */
export const smoothstep = (e0, e1, x) => {
  const t = sat((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** @param {number} a @param {number} b @param {number} t */
export const lerp = (a, b, t) => a + (b - a) * t;

/** @param {string} h @returns {RGB} 0..1 */
export const rgb = (h) => {
  const n = Number.parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
/** @param {RGB} a @param {RGB} b @param {number} t @returns {RGB} */
export const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** a number for an SVG attribute: two decimals are plenty at 2 px per unit */
export const n = (/** @type {number} */ v) => (Math.round(v * 100) / 100).toString();

/**
 * An SVG element. `attrs` with `undefined` values are left out.
 * @param {string} tag
 * @param {Record<string, string | number | undefined>} attrs
 * @param {string | string[]} [children]
 */
export function el(tag, attrs, children) {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${typeof v === 'number' ? n(v) : v}"`)
    .join('');
  const c = Array.isArray(children) ? children.join('') : (children ?? '');
  return c ? `<${tag}${a}>${c}</${tag}>` : `<${tag}${a}/>`;
}

/** A path through points, closed with `close`. @param {[number, number][]} pts */
export function poly(pts, close = true) {
  return `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}${close ? 'Z' : ''}`;
}

/**
 * A smooth closed path through points (Catmull-Rom as cubic Béziers).
 * @param {[number, number][]} pts
 */
export function blobPath(pts) {
  const p = (/** @type {number} */ i) => pts[(i + pts.length) % pts.length];
  let d = `M${n(p(0)[0])} ${n(p(0)[1])}`;
  for (let i = 0; i < pts.length; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return `${d}Z`;
}

/**
 * An irregular round outline: `count` points around (cx, cy) at radius r, each pushed in or out by
 * up to `jitter` (a fraction of r).
 * @param {import('../../lib/image.mjs').Rng} rng
 * @param {number} cx @param {number} cy @param {number} rx @param {number} ry
 * @param {number} jitter @param {number} count
 * @returns {[number, number][]}
 */
export function wobblyRing(rng, cx, cy, rx, ry, jitter, count) {
  /** @type {[number, number][]} */
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const k = 1 + rng.range(-jitter, jitter);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

/**
 * A soft drop shadow filter and the blur filters the scenes share.
 * @param {string} id @param {number} blur in pixels
 */
export const blurFilter = (id, blur) =>
  el('filter', {id, x: '-50%', y: '-50%', width: '200%', height: '200%'}, el('feGaussianBlur', {stdDeviation: blur}));

/**
 * A whole SVG document of `w` × `h` pixels.
 * @param {number} w @param {number} h @param {string[]} defs @param {string[]} body
 */
export const svgDoc = (w, h, defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;

/**
 * Rasterises an SVG document at its own size. Straight (not premultiplied) RGBA.
 * @param {string} svg @param {number} w @param {number} h
 * @returns {Promise<Uint8Array>}
 */
export async function rasterize(svg, w, h) {
  const {data, info} = await sharp(Buffer.from(svg), {density: 72}).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  if (info.width !== w || info.height !== h || info.channels !== 4) {
    throw new Error(`rasterize: expected ${w} × ${h} × 4, got ${info.width} × ${info.height} × ${info.channels}`);
  }
  return new Uint8Array(data.buffer, data.byteOffset, data.length);
}

/**
 * Lays a straight-alpha RGBA image over an RGB float image (0..1), in place.
 * @param {Float32Array} dst rgb, 3 floats per pixel
 * @param {Uint8Array} src rgba
 */
export function over(dst, src) {
  for (let i = 0, j = 0; j < src.length; i += 3, j += 4) {
    const a = src[j + 3] / 255;
    if (a === 0) continue;
    dst[i] = lerp(dst[i], src[j] / 255, a);
    dst[i + 1] = lerp(dst[i + 1], src[j + 1] / 255, a);
    dst[i + 2] = lerp(dst[i + 2], src[j + 2] / 255, a);
  }
}

/**
 * Encodes an RGB float image as an opaque webp.
 * @param {Float32Array} rgbf @param {number} w @param {number} h
 * @returns {Promise<Buffer>}
 */
export async function encodeWebp(rgbf, w, h) {
  const bytes = new Uint8Array(w * h * 3);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(sat(rgbf[i]) * 255);
  return sharp(Buffer.from(bytes.buffer), {raw: {width: w, height: h, channels: 3}})
    .webp({quality: 88, effort: 6, smartSubsample: true})
    .toBuffer();
}

// ---------------------------------------------------------------- a stroke font

/**
 * The glyphs of the scenes as polylines in a box of 1 × 1.6 (x right, y down). Hand lettering is
 * made from these by a wobble per point, see {@link strokeText}.
 * @type {Record<string, [number, number][][]>}
 */
const GLYPHS = {
  0: [
    [
      [0.5, 0],
      [0.95, 0.3],
      [0.95, 1.3],
      [0.5, 1.6],
      [0.05, 1.3],
      [0.05, 0.3],
      [0.5, 0],
    ],
  ],
  1: [
    [
      [0.2, 0.3],
      [0.55, 0],
      [0.55, 1.6],
    ],
  ],
  2: [
    [
      [0.05, 0.35],
      [0.4, 0],
      [0.85, 0.1],
      [0.95, 0.5],
      [0.05, 1.6],
      [0.95, 1.6],
    ],
  ],
  3: [
    [
      [0.05, 0.15],
      [0.5, 0],
      [0.9, 0.3],
      [0.5, 0.75],
      [0.95, 1.15],
      [0.55, 1.6],
      [0.05, 1.45],
    ],
  ],
  4: [
    [
      [0.7, 1.6],
      [0.7, 0],
      [0.05, 1.1],
      [0.95, 1.1],
    ],
  ],
  7: [
    [
      [0.05, 0],
      [0.95, 0],
      [0.35, 1.6],
    ],
  ],
  9: [
    [
      [0.95, 0.5],
      [0.5, 0.9],
      [0.05, 0.5],
      [0.5, 0],
      [0.95, 0.5],
      [0.8, 1.6],
    ],
  ],
  C: [
    [
      [0.95, 0.2],
      [0.5, 0],
      [0.05, 0.4],
      [0.05, 1.2],
      [0.5, 1.6],
      [0.95, 1.4],
    ],
  ],
  '-': [
    [
      [0.15, 0.85],
      [0.85, 0.85],
    ],
  ],
  ':': [
    [
      [0.5, 0.45],
      [0.5, 0.55],
    ],
    [
      [0.5, 1.15],
      [0.5, 1.25],
    ],
  ],
  W: [
    [
      [0, 0],
      [0.25, 1.6],
      [0.5, 0.5],
      [0.75, 1.6],
      [1, 0],
    ],
  ],
  A: [
    [
      [0, 1.6],
      [0.5, 0],
      [1, 1.6],
    ],
    [
      [0.2, 1],
      [0.8, 1],
    ],
  ],
  S: [
    [
      [0.95, 0.2],
      [0.5, 0],
      [0.05, 0.35],
      [0.5, 0.8],
      [0.95, 1.25],
      [0.5, 1.6],
      [0.05, 1.4],
    ],
  ],
  H: [
    [
      [0.05, 0],
      [0.05, 1.6],
    ],
    [
      [0.95, 0],
      [0.95, 1.6],
    ],
    [
      [0.05, 0.8],
      [0.95, 0.8],
    ],
  ],
};

/**
 * The strokes of a text as one path: `size` is the height of a letter in pixels, (x, y) its top
 * left. `wobble` (in pixels) shakes every point, for a hand that is not steady.
 * @param {string} text @param {number} x @param {number} y @param {number} size
 * @param {{wobble?: number, rng?: import('../../lib/image.mjs').Rng, spacing?: number}} [opts]
 */
export function strokeText(text, x, y, size, opts = {}) {
  const {wobble = 0, rng, spacing = 0.45} = opts;
  const s = size / 1.6;
  let d = '';
  let cx = x;
  for (const ch of text) {
    if (ch === ' ') {
      cx += s * 0.8;
      continue;
    }
    const glyph = GLYPHS[ch];
    if (!glyph) throw new Error(`strokeText: no glyph for ${JSON.stringify(ch)}`);
    for (const line of glyph) {
      const pts = line.map(([gx, gy]) => [
        cx + gx * s + (rng ? rng.range(-wobble, wobble) : 0),
        y + gy * s + (rng ? rng.range(-wobble, wobble) : 0),
      ]);
      d += `M${pts.map(([px, py]) => `${n(px)} ${n(py)}`).join('L')}`;
    }
    cx += s * (1 + spacing);
  }
  return d;
}
