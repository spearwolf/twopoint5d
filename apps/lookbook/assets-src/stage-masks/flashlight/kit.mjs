// stage-masks/flashlight: the drawing kit of "The Crawlspace". A layer is a float RGBA image in
// straight alpha that covers a frame of the level in units; it is filled per pixel (dirt, brick,
// planks) and gets SVG laid over it, drawn in units with y up through one transform, rasterised by
// sharp's librsvg. A grain of fine noise goes over everything at the end, so flat SVG fills read as
// painted, and the layer is cut into webp tiles. The art is albedo: the demo lights it.
import sharp from 'sharp';
import {fbm, Img} from '../../lib/image.mjs';
import {el, rasterize, svgDoc} from '../spotlight/svg.mjs';

export {blobPath, blurFilter, el, n, poly, rasterize, rgb, sat, smoothstep, svgDoc} from '../spotlight/svg.mjs';

/** @typedef {[number, number, number]} RGB */
/** @typedef {{z: number, ppu: number, left: number, right: number, bottom: number, top: number, tiles: number}} Frame */

/** @param {number} x @param {number} y @param {number} seed  a hash in [0, 1) */
export function hash(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Layer {
  /** @param {Frame} frame */
  constructor(frame) {
    this.frame = frame;
    this.ppu = frame.ppu;
    this.width = Math.round((frame.right - frame.left) * frame.ppu);
    this.height = Math.round((frame.top - frame.bottom) * frame.ppu);
    /** straight-alpha rgba, 0..1 */
    this.data = new Float32Array(this.width * this.height * 4);
  }

  /** the unit x of the middle of a pixel column @param {number} px */
  u(px) {
    return this.frame.left + (px + 0.5) / this.ppu;
  }

  /** the unit y of the middle of a pixel row @param {number} py */
  v(py) {
    return this.frame.top - (py + 0.5) / this.ppu;
  }

  /**
   * Paints per pixel: `shade(u, v)` answers a straight rgba (alpha 0..1) or `undefined` to leave the
   * pixel, and the answer goes over what is there. Rows between `vTop` and `vBottom` only.
   * @param {(u: number, v: number) => [number, number, number, number] | undefined} shade
   * @param {number} [vTop] @param {number} [vBottom]
   */
  paint(shade, vTop = this.frame.top, vBottom = this.frame.bottom) {
    const y0 = Math.max(0, Math.floor((this.frame.top - vTop) * this.ppu));
    const y1 = Math.min(this.height, Math.ceil((this.frame.top - vBottom) * this.ppu));
    const d = this.data;
    for (let py = y0; py < y1; py++) {
      const v = this.v(py);
      for (let px = 0; px < this.width; px++) {
        const c = shade(this.u(px), v);
        if (!c || c[3] <= 0) continue;
        overPixel(d, (py * this.width + px) * 4, c[0], c[1], c[2], c[3]);
      }
    }
  }

  /**
   * Lays SVG over the layer. `body` is drawn in units, y up: a point (x, y) of the level lands where
   * it belongs in the image.
   * @param {string[]} defs @param {string[]} body
   */
  async svg(defs, body) {
    const {left, top} = this.frame;
    const s = this.ppu;
    const g = el('g', {transform: `matrix(${s} 0 0 ${-s} ${-left * s} ${top * s})`}, body);
    const src = await rasterize(svgDoc(this.width, this.height, defs, [g]), this.width, this.height);
    const d = this.data;
    for (let i = 0; i < src.length; i += 4) {
      const a = src[i + 3] / 255;
      if (a > 0) overPixel(d, i, src[i] / 255, src[i + 1] / 255, src[i + 2] / 255, a);
    }
  }

  /**
   * A grain over every pixel: rgb times a fine and a coarse noise, so flat fills read as painted.
   * @param {number} seed @param {number} [strength]
   */
  grain(seed, strength = 0.22) {
    const d = this.data;
    for (let py = 0; py < this.height; py++) {
      const v = this.v(py);
      for (let px = 0; px < this.width; px++) {
        const i = (py * this.width + px) * 4;
        if (d[i + 3] <= 0) continue;
        const u = this.u(px);
        const k = 1 - strength + strength * 2 * (0.6 * fbm(u / 2.5, v / 2.5, seed, 3) + 0.4 * fbm(u / 40, v / 40, seed + 9, 3));
        d[i] *= k;
        d[i + 1] *= k;
        d[i + 2] *= k;
      }
    }
  }

  /** The layer as an 8-bit image, for an atlas. @returns {Img} */
  toImg() {
    const bytes = new Uint8Array(this.width * this.height * 4);
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(Math.min(1, Math.max(0, this.data[i])) * 255);
    return new Img(this.width, this.height, bytes);
  }

  /**
   * The layer cut into `frame.tiles` webp images side by side, each `width / tiles` pixels wide.
   * @returns {Promise<Buffer[]>}
   */
  async tiles() {
    const n = this.frame.tiles;
    const tw = this.width / n;
    if (!Number.isInteger(tw)) throw new Error(`Layer: ${this.width} px do not cut into ${n} tiles`);
    const bytes = new Uint8Array(this.width * this.height * 4);
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(Math.min(1, Math.max(0, this.data[i])) * 255);
    const out = [];
    for (let t = 0; t < n; t++) {
      out.push(
        await sharp(Buffer.from(bytes.buffer), {raw: {width: this.width, height: this.height, channels: 4}})
          .extract({left: t * tw, top: 0, width: tw, height: this.height})
          .webp({quality: 86, alphaQuality: 90, effort: 6, smartSubsample: true})
          .toBuffer(),
      );
    }
    return out;
  }
}

/**
 * Straight-alpha "over" of one pixel into a float rgba array.
 * @param {Float32Array} d @param {number} i
 * @param {number} r @param {number} g @param {number} b @param {number} a
 */
function overPixel(d, i, r, g, b, a) {
  const da = d[i + 3];
  const oa = a + da * (1 - a);
  if (oa <= 0) return;
  d[i] = (r * a + d[i] * da * (1 - a)) / oa;
  d[i + 1] = (g * a + d[i + 1] * da * (1 - a)) / oa;
  d[i + 2] = (b * a + d[i + 2] * da * (1 - a)) / oa;
  d[i + 3] = oa;
}

/** @param {RGB} a @param {RGB} b @param {number} t @returns {RGB} */
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** @param {string} h a hex colour @returns {RGB} 0..1 */
export const hexRgb = (h) => {
  const v = Number.parseInt(h.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

/**
 * Dirt of a crawlspace, per pixel: packed earth with pebbles, darker and damper towards the back.
 * @param {number} u @param {number} v @param {number} seed @param {number} damp 0..1
 * @returns {RGB}
 */
export function dirt(u, v, seed, damp) {
  const base = fbm(u / 60, v / 30, seed, 4);
  const fine = fbm(u / 4, v / 3, seed + 3, 3);
  let c = mix3(hexRgb('#4a3a2a'), hexRgb('#6d5840'), base);
  c = mix3(c, hexRgb('#2c241c'), damp * (0.4 + 0.5 * fbm(u / 140, v / 80, seed + 5, 3)));
  // pebbles: cells with a stone in some of them, a lit top and a dark bottom
  const cs = 9;
  const ci = Math.floor(u / cs);
  const cj = Math.floor(v / cs);
  const h = hash(ci, cj, seed);
  if (h > 0.84) {
    const cx = (ci + 0.2 + 0.6 * hash(ci, cj, seed + 1)) * cs;
    const cy = (cj + 0.2 + 0.6 * hash(ci, cj, seed + 2)) * cs;
    const r = 1 + 3.4 * hash(ci, cj, seed + 4) ** 2;
    const dx = (u - cx) / r;
    const dy = (v - cy) / (r * 0.75);
    const q = dx * dx + dy * dy;
    if (q < 1) {
      const stone = mix3(hexRgb('#6f6a60'), hexRgb('#9a9183'), hash(ci, cj, seed + 6));
      const lit = 0.75 + 0.45 * dy;
      return mix3(c, [stone[0] * lit, stone[1] * lit, stone[2] * lit], Math.min(1, (1 - q) * 3));
    }
    // the shadow below a stone
    const sy = (v - cy + r * 0.7) / (r * 0.6);
    if (dx * dx + sy * sy < 1) c = mix3(c, [0.08, 0.06, 0.05], 0.5);
  }
  const k = 0.82 + 0.36 * fine;
  return [c[0] * k, c[1] * k, c[2] * k];
}

/**
 * Old wood, per pixel: grain along x, rings, a little rot — joists, posts, planks.
 * @param {number} u @param {number} v along the grain and across it @param {number} seed
 * @returns {RGB}
 */
export function wood(u, v, seed) {
  const g = fbm(u / 40, v / 1.6, seed, 4);
  const streak = 0.5 + 0.5 * Math.sin(v * 1.7 + g * 9);
  let c = mix3(hexRgb('#4a3424'), hexRgb('#7a5a3c'), 0.35 + 0.4 * g + 0.15 * streak);
  c = mix3(c, hexRgb('#2a1f17'), Math.max(0, fbm(u / 90, v / 20, seed + 7, 3) - 0.55) * 1.6);
  return c;
}

/**
 * Brick, per pixel: courses of `bw` × `bh` units with mortar, every other course shifted by half.
 * Answers the colour of the face and how much it is mortar.
 * @param {number} u @param {number} v @param {number} bw @param {number} bh @param {number} seed
 * @returns {RGB}
 */
export function brick(u, v, bw, bh, seed) {
  const row = Math.floor(v / bh);
  const fy = v / bh - row;
  const shift = row % 2 === 0 ? 0 : bw / 2;
  const col = Math.floor((u + shift) / bw);
  const fx = (u + shift) / bw - col;
  const m = Math.min(Math.min(fx, 1 - fx) * bw, Math.min(fy, 1 - fy) * bh);
  if (m < 1.1 * (1 + 0.35 * (fbm(u / 3, v / 3, seed + 1, 2) - 0.5))) {
    return mix3(hexRgb('#55504a'), hexRgb('#736d64'), fbm(u / 2, v / 2, seed + 2, 2));
  }
  let c = mix3(hexRgb('#5c3024'), hexRgb('#82503e'), hash(col, row, seed));
  if (hash(col, row, seed + 3) > 0.87) c = mix3(c, hexRgb('#2e1913'), 0.55);
  c = mix3(c, hexRgb('#2c1712'), Math.max(0, fbm(u / 1.8, v / 1.8, seed + 4, 2) - 0.62) * 2);
  return c;
}
