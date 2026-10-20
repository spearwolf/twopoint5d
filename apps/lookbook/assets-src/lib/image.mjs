// The canvas every generator draws on: an RGBA image with the handful of operations pixel art
// needs, plus colour helpers, a seeded random generator, value noise and ordered dithering.

/** @typedef {[number, number, number, number]} RGBA */

/**
 * `#rgb`, `#rrggbb` or `#rrggbbaa` → RGBA.
 * @param {string} hex
 * @returns {RGBA}
 */
export function hex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = Number.parseInt(h.slice(0, 6), 16);
  const a = h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) : 255;
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, a];
}

/**
 * @param {RGBA} c
 * @returns {string} `#rrggbb`, or `#rrggbbaa` when not opaque
 */
export function toHex(c) {
  const s = (/** @type {number} */ v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${s(c[0])}${s(c[1])}${s(c[2])}${c[3] === 255 ? '' : s(c[3])}`;
}

/**
 * @param {RGBA} a
 * @param {RGBA} b
 * @param {number} t
 * @returns {RGBA}
 */
export function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t),
  ];
}

/**
 * @param {RGBA} c
 * @param {number} alpha 0–255
 * @returns {RGBA}
 */
export function withAlpha(c, alpha) {
  return [c[0], c[1], c[2], Math.round(alpha)];
}

/**
 * Hue in degrees, saturation and lightness in [0, 1].
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @returns {RGBA}
 */
export function hsl(h, s, l) {
  const k = (/** @type {number} */ n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (/** @type {number} */ n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255), 255];
}

/**
 * A ramp of `steps` colours through the given stops, evenly spaced.
 * @param {RGBA[]} stops
 * @param {number} steps
 * @returns {RGBA[]}
 */
export function ramp(stops, steps) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : (i / (steps - 1)) * (stops.length - 1);
    const j = Math.min(Math.floor(t), stops.length - 2);
    out.push(mix(stops[j], stops[j + 1], t - j));
  }
  return out;
}

/** mulberry32: a small seeded generator, the same sequence on every machine. */
export class Rng {
  /** @param {number} seed */
  constructor(seed) {
    this.state = seed >>> 0;
  }

  /** @returns {number} in [0, 1) */
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * @param {number} min
   * @param {number} max
   */
  range(min, max) {
    return min + (max - min) * this.next();
  }

  /**
   * @param {number} min
   * @param {number} max inclusive
   */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * @template T
   * @param {T[]} items
   * @returns {T}
   */
  pick(items) {
    return items[Math.floor(this.next() * items.length)];
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 */
function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** @param {number} t */
const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Value noise in [0, 1], periodic in x with `periodX` cells when given (seamless horizontal tiling).
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @param {number} [periodX]
 */
export function valueNoise(x, y, seed, periodX) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const wrap = (/** @type {number} */ v) => (periodX ? ((v % periodX) + periodX) % periodX : v);
  const a = hash2(wrap(x0), y0, seed);
  const b = hash2(wrap(x0 + 1), y0, seed);
  const c = hash2(wrap(x0), y0 + 1, seed);
  const d = hash2(wrap(x0 + 1), y0 + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * Fractal value noise in [0, 1]. With `periodX` the base octave repeats every `periodX` cells and
 * each finer octave twice as often, so the sum tiles horizontally.
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @param {number} octaves
 * @param {number} [periodX]
 */
export function fbm(x, y, seed, octaves, periodX) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * f, y * f, seed + o * 101, periodX ? periodX * f : undefined);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * The ordered-dither threshold of a pixel, in (0, 1).
 * @param {number} x
 * @param {number} y
 */
export function bayer(x, y) {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/**
 * Picks an entry of a ramp for a value in [0, 1], dithered between neighbours with a 4 × 4 Bayer
 * matrix — the banded gradients of 16-bit era art.
 * @param {RGBA[]} colours
 * @param {number} t
 * @param {number} x
 * @param {number} y
 * @returns {RGBA}
 */
export function ditherRamp(colours, t, x, y) {
  const v = Math.max(0, Math.min(1, t)) * (colours.length - 1);
  const i = Math.floor(v);
  const frac = v - i;
  return colours[Math.min(colours.length - 1, frac > bayer(x, y) ? i + 1 : i)];
}

export class Img {
  /**
   * @param {number} width
   * @param {number} height
   * @param {Uint8Array} [data]
   */
  constructor(width, height, data) {
    this.width = width;
    this.height = height;
    this.data = data ?? new Uint8Array(width * height * 4);
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {RGBA}
   */
  get(x, y) {
    if (!this.inside(x, y)) return [0, 0, 0, 0];
    const i = (y * this.width + x) * 4;
    const d = this.data;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  alpha(x, y) {
    return this.inside(x, y) ? this.data[(y * this.width + x) * 4 + 3] : 0;
  }

  /**
   * Writes a pixel, replacing what was there.
   * @param {number} x
   * @param {number} y
   * @param {RGBA} c
   */
  set(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    this.data.set(c, (y * this.width + x) * 4);
  }

  /**
   * Draws a pixel over what is there (straight alpha, "over").
   * @param {number} x
   * @param {number} y
   * @param {RGBA} c
   */
  blend(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y) || c[3] === 0) return;
    if (c[3] === 255) return this.set(x, y, c);
    const i = (y * this.width + x) * 4;
    const d = this.data;
    const sa = c[3] / 255;
    const da = d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    for (let k = 0; k < 3; k++) d[i + k] = Math.round((c[k] * sa + d[i + k] * da * (1 - sa)) / oa);
    d[i + 3] = Math.round(oa * 255);
  }

  /**
   * Adds light: rgb += c.rgb · c.a, alpha = max — for glows on an opaque ground.
   * @param {number} x
   * @param {number} y
   * @param {RGBA} c
   */
  add(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const i = (y * this.width + x) * 4;
    const d = this.data;
    for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, d[i + k] + Math.round((c[k] * c[3]) / 255));
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {RGBA} c
   */
  fillRect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  }

  /**
   * Strokes a one-pixel rectangle.
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {RGBA} c
   */
  strokeRect(x, y, w, h, c) {
    for (let i = x; i < x + w; i++) {
      this.set(i, y, c);
      this.set(i, y + h - 1, c);
    }
    for (let j = y; j < y + h; j++) {
      this.set(x, j, c);
      this.set(x + w - 1, j, c);
    }
  }

  /**
   * Bresenham line.
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   * @param {RGBA} c
   */
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /**
   * Fills every pixel whose centre lies inside the ellipse.
   * @param {number} cx
   * @param {number} cy
   * @param {number} rx
   * @param {number} ry
   * @param {RGBA} c
   */
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x + 0.5 - cx) / rx;
        const v = (y + 0.5 - cy) / ry;
        if (u * u + v * v <= 1) this.set(x, y, c);
      }
    }
  }

  /**
   * Calls `fn(x, y)` for every pixel and writes what it answers; `undefined` keeps the pixel.
   * @param {(x: number, y: number, current: RGBA) => RGBA | undefined} fn
   */
  paint(fn) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const c = fn(x, y, this.get(x, y));
        if (c) this.set(x, y, c);
      }
    }
  }

  /**
   * Draws `src` at (dx, dy), "over" by default or replacing with `mode: 'copy'`.
   * @param {Img} src
   * @param {number} dx
   * @param {number} dy
   * @param {{mode?: 'over' | 'copy', sx?: number, sy?: number, w?: number, h?: number}} [opts]
   */
  blit(src, dx, dy, opts = {}) {
    const {mode = 'over', sx = 0, sy = 0, w = src.width, h = src.height} = opts;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = src.get(sx + x, sy + y);
        if (mode === 'copy') this.set(dx + x, dy + y, c);
        else this.blend(dx + x, dy + y, c);
      }
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  crop(x, y, w, h) {
    const out = new Img(w, h);
    out.blit(this, 0, 0, {mode: 'copy', sx: x, sy: y, w, h});
    return out;
  }

  /** @returns {{x: number, y: number, w: number, h: number} | undefined} the box of the non-transparent pixels */
  opaqueBounds() {
    let x0 = this.width;
    let y0 = this.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.alpha(x, y) > 0) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
    }
    return x1 < 0 ? undefined : {x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1};
  }

  /**
   * Paints `c` on every transparent pixel next to an opaque one (4-neighbourhood, or 8 with
   * `diagonal`) — the dark outline of a sprite.
   * @param {RGBA} c
   * @param {{diagonal?: boolean}} [opts]
   */
  outline(c, opts = {}) {
    const marks = [];
    const n4 = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const n8 = [...n4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const ns = opts.diagonal ? n8 : n4;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.alpha(x, y) !== 0) continue;
        if (ns.some(([dx, dy]) => this.alpha(x + dx, y + dy) === 255)) marks.push([x, y]);
      }
    }
    for (const [x, y] of marks) this.set(x, y, c);
    return this;
  }

  /** @returns {Img} a mirror image about the vertical axis */
  flipX() {
    const out = new Img(this.width, this.height);
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) out.set(this.width - 1 - x, y, this.get(x, y));
    return out;
  }

  /**
   * Nearest-neighbour upscale by an integer factor.
   * @param {number} k
   */
  scale(k) {
    const out = new Img(this.width * k, this.height * k);
    for (let y = 0; y < out.height; y++)
      for (let x = 0; x < out.width; x++) out.set(x, y, this.get(Math.floor(x / k), Math.floor(y / k)));
    return out;
  }

  /** @returns {Set<string>} the `#rrggbb` colours of all opaque pixels; throws on a pixel that is neither opaque nor clear */
  opaqueColours() {
    const set = new Set();
    for (let i = 0; i < this.data.length; i += 4) {
      const a = this.data[i + 3];
      if (a === 0) continue;
      if (a !== 255) throw new Error(`pixel ${i / 4} has alpha ${a}; this image must be opaque or clear`);
      set.add(toHex([this.data[i], this.data[i + 1], this.data[i + 2], 255]));
    }
    return set;
  }

  /** Sets the colour of every fully transparent pixel to 0, so nothing stray is stored there. */
  clearTransparent() {
    for (let i = 0; i < this.data.length; i += 4) {
      if (this.data[i + 3] === 0) this.data.fill(0, i, i + 3);
    }
    return this;
  }
}

/**
 * Parses pixel art written as text: one string per row, one character per pixel, `.` or space
 * transparent, every other character a key of `palette`.
 * @param {string[]} rows
 * @param {Record<string, RGBA>} palette
 * @returns {Img}
 */
export function fromAscii(rows, palette) {
  const width = Math.max(...rows.map((r) => r.length));
  const img = new Img(width, rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return;
      const c = palette[ch];
      if (!c) throw new Error(`pixel art: no colour for '${ch}' (row ${y}, column ${x})`);
      img.set(x, y, c);
    });
  });
  return img;
}
