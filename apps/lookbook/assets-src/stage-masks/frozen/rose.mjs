// stage-masks/frozen: the rose window of "The Moth Chapel" — every pane of its glass, the stone of
// its tracery and mouldings, and the lead between the panes. One classifier says for every point
// which pane it lies in (or that it is stone); the lead, the bevels of the stone and the edges of
// the glass all follow from one distance transform of the borders between those regions.
//
// Units: the rose's centre is the origin, y up. Everything is worked out at 4 points per unit and
// averaged down to the 2 texels per unit of the outputs.
import sharp from 'sharp';
import {fbm, Rng, valueNoise} from '../../lib/image.mjs';
import {check} from '../../lib/output.mjs';
import {el, rasterize, sat, smoothstep} from '../spotlight/svg.mjs';

/** texels per unit of the outputs */
export const PX = 2;
/** points per texel the computation takes along each axis */
const SS = 2;
/** points per unit of the computation */
const Q = PX * SS;

/** where the glass ends: the mouldings start here */
export const GLASS_R = 298;
/** `glass.webp` and `panes.png` cover x, y in ±GLASS_EXTENT */
export const GLASS_EXTENT = 320;
/** `frame.webp` covers x, y in ±FRAME_EXTENT */
export const FRAME_EXTENT = 400;
/** the outer edge of the voussoirs, where the wall of the demo takes over */
export const STONE_R = 393;

/** half the width of a lead came, in units */
const LEAD = 1.9;

const D22 = Math.PI / 8;
const D11 = Math.PI / 16;

// the eye in the middle: an almond between two arcs, an iris, a slit pupil
const EYE_R = 92;
const ALMOND_X = 78;
const UP_C = -56;
const UP_R = 96;
const LO_C = 72.5;
const LO_R = 106.5;
const IRIS_R = 31;

// the eight petals, a moth in each, pointing at the eye
const PETAL_IN = 103;
const PETAL_OUT = 196;
const PETAL_SPOKE = 5;
const PETAL_LS = 125;
const PETAL_TIP = 192;
const PETAL_W0 = PETAL_LS * Math.tan(D22) - PETAL_SPOKE / Math.cos(D22);
const PETAL_RA = ((PETAL_TIP - PETAL_LS) ** 2 + PETAL_W0 ** 2) / (2 * PETAL_W0);

// the sixteen lancets of the outer ring, a small eye in each
const LANCET_IN = 206;
const LANCET_SPOKE = 4;
const LANCET_LS = 240;
const LANCET_TIP = 296;
const LANCET_W0 = LANCET_LS * Math.tan(D11) - LANCET_SPOKE / Math.cos(D11);
const LANCET_RA = ((LANCET_TIP - LANCET_LS) ** 2 + LANCET_W0 ** 2) / (2 * LANCET_W0);
const ROUNDEL_X = 262;

/** the forewing, the hindwing of a moth, in petal coordinates (along the axis, across it) */
const FOREWING = [
  [128, 5],
  [119, 40],
  [146, 48],
  [180, 20],
  [163, 5],
];
const HINDWING = [
  [126, 5],
  [108, 15],
  [109, 37],
  [126, 33],
  [137, 8],
];

/** @param {number} x @param {number} y @param {number[][]} pts */
function inPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * The signed distance into a pointed arch springing at `ls` with half-width `w0` and arc radius
 * `ra`, folded about the axis: above 0 inside.
 * @param {number} lx @param {number} q |across| @param {number} ls @param {number} w0 @param {number} ra
 */
function archDist(lx, q, ls, w0, ra) {
  if (lx <= ls) return Infinity;
  return ra - Math.hypot(lx - ls, q - (w0 - ra));
}

// codes: 0 stone; 1..21 the eye; 100 + 20 k + part a petal; 300 + 10 k + part a lancet

/** @param {number} x @param {number} y */
function eyeCode(x, y) {
  const inAlmond =
    Math.abs(x) < ALMOND_X && y < UP_C + Math.sqrt(UP_R * UP_R - x * x) && y > LO_C - Math.sqrt(LO_R * LO_R - x * x);
  if (inAlmond) {
    if ((x / 7) ** 2 + (y / 23) ** 2 < 1) return 1;
    if (Math.hypot(x, y) < IRIS_R) {
      const wedge = Math.floor(((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * 12) % 12;
      return 2 + wedge;
    }
    return x < 0 ? 14 : 15;
  }
  const a = Math.atan2(y, x);
  if (a >= 0) return 16 + Math.min(2, Math.floor(a / (Math.PI / 3)));
  return 19 + Math.min(2, Math.floor((a + Math.PI) / (Math.PI / 3)));
}

/** the petal or lancet a point is in: its index and the point in its coordinates */
const local = {k: 0, lx: 0, ly: 0};

/** @param {number} x @param {number} y @param {number} count */
function toSector(x, y, count) {
  const step = (2 * Math.PI) / count;
  const a = Math.atan2(y, x) - Math.PI / 2;
  const k = (((Math.round(a / step) % count) + count) % count) | 0;
  const t = Math.PI / 2 + k * step;
  const c = Math.cos(t);
  const s = Math.sin(t);
  local.k = k;
  local.lx = x * c + y * s;
  local.ly = -x * s + y * c;
}

/** @param {number} x @param {number} y */
function petalCode(x, y) {
  toSector(x, y, 8);
  const {k, lx, ly} = local;
  const q = Math.abs(ly);
  const side = ly >= 0 ? 0 : 1;
  if (lx * Math.sin(D22) - q * Math.cos(D22) < PETAL_SPOKE) return 0;
  const base = 100 + 20 * k;
  const arch = archDist(lx, q, PETAL_LS, PETAL_W0, PETAL_RA);
  if (arch < -3) return base + 13 + side;
  if (arch <= 3) return 0;
  if (((lx - 148) / 27) ** 2 + (q / 6.5) ** 2 < 1 || Math.hypot(lx - 117, q) < 7) return base;
  if (inPolygon(lx, q, FOREWING)) {
    if (Math.hypot(lx - 146, q - 28) < 8.5) return base + 1 + side;
    return base + (lx < 150 ? 3 : 5) + side;
  }
  if (inPolygon(lx, q, HINDWING)) return base + 7 + side;
  return base + (lx < 150 ? 9 : 11) + side;
}

/** @param {number} x @param {number} y */
function lancetCode(x, y) {
  toSector(x, y, 16);
  const {k, lx, ly} = local;
  const q = Math.abs(ly);
  const side = ly >= 0 ? 0 : 1;
  if (lx * Math.sin(D11) - q * Math.cos(D11) < LANCET_SPOKE) return 0;
  const base = 300 + 10 * k;
  const arch = archDist(lx, q, LANCET_LS, LANCET_W0, LANCET_RA);
  if (arch < -2.5) return base + 5 + side;
  if (arch <= 2.5) return 0;
  const rr = Math.hypot(lx - ROUNDEL_X, ly);
  if (rr < 5.5) return base;
  if (rr < 14) return base + 1;
  if (lx < LANCET_LS) return base + 2 + side;
  return base + 4;
}

/** The region a point of the rose lies in: 0 for stone, a code of a pane otherwise. */
function classify(/** @type {number} */ x, /** @type {number} */ y) {
  const r = Math.hypot(x, y);
  if (r >= GLASS_R) return 0;
  if (r < EYE_R) return eyeCode(x, y);
  if (r < PETAL_IN) return 0;
  if (r < PETAL_OUT) return petalCode(x, y);
  if (r < LANCET_IN) return 0;
  return lancetCode(x, y);
}

/**
 * The glass of each kind: how much of the amber (red channel) and of the violet (blue channel) it
 * carries, and how much light it lets through (alpha).
 * @type {Record<string, {r: number, b: number, a: number}>}
 */
const KINDS = {
  clear: {r: 0, b: 0, a: 1},
  amber: {r: 1, b: 0, a: 0.94},
  violet: {r: 0, b: 1, a: 0.9},
  ruby: {r: 1, b: 1, a: 0.9},
  dusk: {r: 0.25, b: 0.85, a: 0.74},
  pale: {r: 0.14, b: 0, a: 0.9},
  mist: {r: 0.08, b: 0.28, a: 0.96},
  quarry: {r: 0.05, b: 0.04, a: 1},
};

/**
 * What a code is: its ring, its sector, its part and its kind of glass.
 * @param {number} code
 * @returns {{ring: 'eye' | 'petal' | 'lancet', sector: number, part: string, kind: string}}
 */
function describe(code) {
  if (code < 100) {
    const p = code - 1;
    if (p === 0) return {ring: 'eye', sector: 0, part: 'pupil', kind: 'clear'};
    if (p <= 12) return {ring: 'eye', sector: p - 1, part: 'iris', kind: p % 2 ? 'amber' : 'ruby'};
    if (p <= 14) return {ring: 'eye', sector: p - 13, part: 'sclera', kind: 'pale'};
    return {ring: 'eye', sector: p - 15, part: 'lid', kind: p % 2 ? 'violet' : 'mist'};
  }
  if (code < 300) {
    const sector = Math.floor((code - 100) / 20);
    const p = (code - 100) % 20;
    /** @type {[string, string][]} */
    const parts = [
      ['body', 'amber'],
      ['eyespot', 'clear'],
      ['eyespot', 'clear'],
      ['forewing', 'amber'],
      ['forewing', 'amber'],
      ['forewing-tip', 'pale'],
      ['forewing-tip', 'pale'],
      ['hindwing', 'ruby'],
      ['hindwing', 'ruby'],
      ['ground', 'mist'],
      ['ground', 'mist'],
      ['ground', 'quarry'],
      ['ground', 'quarry'],
      ['spandrel', 'quarry'],
      ['spandrel', 'quarry'],
    ];
    const [part, kind] = parts[p];
    return {ring: 'petal', sector, part, kind};
  }
  const sector = Math.floor((code - 300) / 10);
  const p = (code - 300) % 10;
  if (p === 0) return {ring: 'lancet', sector, part: 'pupil', kind: 'clear'};
  if (p === 1) return {ring: 'lancet', sector, part: 'iris', kind: 'amber'};
  if (p <= 3) return {ring: 'lancet', sector, part: 'light', kind: sector % 2 ? 'mist' : 'quarry'};
  if (p === 4) return {ring: 'lancet', sector, part: 'tip', kind: sector % 2 ? 'violet' : 'ruby'};
  return {ring: 'lancet', sector, part: 'spandrel', kind: 'dusk'};
}

/**
 * Exact squared Euclidean distance transform (Felzenszwalb & Huttenlocher) of the points where
 * `seed` is 1; returns the distances in points.
 * @param {Uint8Array} seed @param {number} w @param {number} h
 */
function distanceTransform(seed, w, h) {
  const INF = 1e20;
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const out = new Float32Array(w * h);
  /** @param {number} len */
  const pass = (len) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
  };
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = seed[y * w + x] ? 0 : INF;
    pass(h);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) f[x] = out[row + x];
    pass(w);
    for (let x = 0; x < w; x++) out[row + x] = Math.sqrt(d[x]);
  }
  return out;
}

/**
 * The regions of the whole frame at 4 points per unit: the pane id of every point (0 stone), the
 * distance of every point to the nearest border between regions, in units, and the panes.
 */
function computeRegions() {
  const size = FRAME_EXTENT * 2 * Q;
  const codes = new Uint16Array(size * size);
  /** @type {Set<number>} */
  const seen = new Set();
  for (let j = 0; j < size; j++) {
    const y = FRAME_EXTENT - (j + 0.5) / Q;
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5) / Q - FRAME_EXTENT;
      const code = classify(x, y);
      codes[j * size + i] = code;
      if (code) seen.add(code);
    }
  }
  // ids in the order of the codes: the eye from the pupil out, then petal by petal, lancet by lancet
  const sorted = [...seen].sort((a, b) => a - b);
  const idOf = new Uint16Array(512);
  sorted.forEach((code, i) => {
    idOf[code] = i + 1;
  });
  const ids = new Uint16Array(size * size);
  for (let p = 0; p < ids.length; p++) ids[p] = idOf[codes[p]];

  const border = new Uint8Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const p = j * size + i;
      const id = ids[p];
      if ((i + 1 < size && ids[p + 1] !== id) || (j + 1 < size && ids[p + size] !== id)) border[p] = 1;
      else if ((i > 0 && ids[p - 1] !== id) || (j > 0 && ids[p - size] !== id)) border[p] = 1;
    }
  }
  const dist = distanceTransform(border, size, size);
  for (let p = 0; p < dist.length; p++) dist[p] = dist[p] / Q;

  // the extent and the middle of every pane
  const count = sorted.length;
  const minX = new Float64Array(count + 1).fill(Infinity);
  const minY = new Float64Array(count + 1).fill(Infinity);
  const maxX = new Float64Array(count + 1).fill(-Infinity);
  const maxY = new Float64Array(count + 1).fill(-Infinity);
  const sumX = new Float64Array(count + 1);
  const sumY = new Float64Array(count + 1);
  const area = new Float64Array(count + 1);
  for (let j = 0; j < size; j++) {
    const y = FRAME_EXTENT - (j + 0.5) / Q;
    for (let i = 0; i < size; i++) {
      const id = ids[j * size + i];
      if (!id) continue;
      const x = (i + 0.5) / Q - FRAME_EXTENT;
      if (x < minX[id]) minX[id] = x;
      if (x > maxX[id]) maxX[id] = x;
      if (y < minY[id]) minY[id] = y;
      if (y > maxY[id]) maxY[id] = y;
      sumX[id] += x;
      sumY[id] += y;
      area[id]++;
    }
  }
  const round = (/** @type {number} */ v) => Math.round(v * 100) / 100;
  const panes = sorted.map((code, i) => {
    const id = i + 1;
    const {ring, sector, part, kind} = describe(code);
    // the quad of a pane reaches over the lead around it: its glass fades out under the lead
    const pad = LEAD + 1;
    return {
      id,
      ring,
      sector,
      part,
      kind,
      x0: round(Math.max(-GLASS_EXTENT, minX[id] - pad)),
      y0: round(Math.max(-GLASS_EXTENT, minY[id] - pad)),
      x1: round(Math.min(GLASS_EXTENT, maxX[id] + pad)),
      y1: round(Math.min(GLASS_EXTENT, maxY[id] + pad)),
      cx: round(sumX[id] / area[id]),
      cy: round(sumY[id] / area[id]),
      area: round(area[id] / (Q * Q)),
    };
  });
  return {size, ids, dist, panes};
}

// ---------------------------------------------------------------------------------------------
// the grisaille: the dark paint on the glass, drawn as SVG
// ---------------------------------------------------------------------------------------------

/** @param {number} v */
const f2 = (v) => (Math.round(v * 100) / 100).toString();
/** @param {number[][]} pts */
const pathOf = (pts) => `M${pts.map(([x, y]) => `${f2(x)} ${f2(y)}`).join('L')}`;

/** the grisaille of the eye, in rose coordinates */
function eyeGrisaille(/** @type {Rng} */ rng) {
  const out = [];
  // fibres of the iris and its rings
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + rng.range(-0.02, 0.02);
    const r0 = 9 + rng.range(0, 3);
    const r1 = IRIS_R - rng.range(0, 6);
    const mid = (r0 + r1) / 2;
    const bend = rng.range(-0.08, 0.08);
    out.push(
      el('path', {
        d: `M${f2(Math.cos(a) * r0)} ${f2(Math.sin(a) * r0)}Q${f2(Math.cos(a + bend) * mid)} ${f2(Math.sin(a + bend) * mid)} ${f2(Math.cos(a) * r1)} ${f2(Math.sin(a) * r1)}`,
        stroke: '#000',
        'stroke-width': rng.range(0.45, 0.9),
        'stroke-opacity': rng.range(0.35, 0.7),
        fill: 'none',
      }),
    );
  }
  out.push(
    el('circle', {cx: 0, cy: 0, r: IRIS_R - 2.4, fill: 'none', stroke: '#000', 'stroke-width': 3.2, 'stroke-opacity': 0.75}),
  );
  out.push(el('circle', {cx: 0, cy: 0, r: 16, fill: 'none', stroke: '#000', 'stroke-width': 1, 'stroke-opacity': 0.5}));
  out.push(
    el('ellipse', {cx: 0, cy: 0, rx: 6.2, ry: 21.5, fill: 'none', stroke: '#000', 'stroke-width': 1.6, 'stroke-opacity': 0.8}),
  );
  // the lids: a crease above, lashes along both edges
  const up = (/** @type {number} */ x) => UP_C + Math.sqrt(UP_R * UP_R - x * x);
  const lo = (/** @type {number} */ x) => LO_C - Math.sqrt(LO_R * LO_R - x * x);
  /** @type {number[][]} */
  const crease = [];
  for (let x = -70; x <= 70; x += 5) crease.push([x, up(x) + 11 - (x * x) / 900]);
  out.push(el('path', {d: pathOf(crease), stroke: '#000', 'stroke-width': 1.8, 'stroke-opacity': 0.7, fill: 'none'}));
  for (let i = 0; i <= 22; i++) {
    const x = -72 + (i / 22) * 144;
    const y = up(x);
    const slope = -x / Math.sqrt(UP_R * UP_R - x * x);
    const len = Math.hypot(1, slope);
    const nx = -slope / len;
    const ny = 1 / len;
    const l = 9 + 9 * Math.sin((i / 22) * Math.PI) + rng.range(-1.5, 1.5);
    const sweep = x * 0.1;
    out.push(
      el('path', {
        d: `M${f2(x)} ${f2(y)}Q${f2(x + nx * l * 0.6 + sweep * 0.3)} ${f2(y + ny * l * 0.6)} ${f2(x + nx * l + sweep)} ${f2(y + ny * l - 1)}`,
        stroke: '#000',
        'stroke-width': 1.6,
        'stroke-opacity': 0.85,
        'stroke-linecap': 'round',
        fill: 'none',
      }),
    );
  }
  for (let i = 1; i < 16; i++) {
    const x = -66 + (i / 16) * 132;
    const y = lo(x);
    const l = 4 + 4 * Math.sin((i / 16) * Math.PI);
    out.push(
      el('path', {
        d: `M${f2(x)} ${f2(y)}L${f2(x * 1.04)} ${f2(y - l)}`,
        stroke: '#000',
        'stroke-width': 1.1,
        'stroke-opacity': 0.7,
        'stroke-linecap': 'round',
      }),
    );
  }
  // veins in the white of the eye, running in from the corners
  for (let i = 0; i < 10; i++) {
    const s = i < 5 ? -1 : 1;
    /** @type {number[][]} */
    const pts = [[s * 70, rng.range(-6, 6)]];
    for (let j = 1; j < 6; j++) {
      const [px, py] = pts[pts.length - 1];
      pts.push([px - s * rng.range(5, 8), py + rng.range(-4, 4)]);
    }
    out.push(el('path', {d: pathOf(pts), stroke: '#000', 'stroke-width': 0.55, 'stroke-opacity': 0.45, fill: 'none'}));
  }
  // a glory of thin rays in the lids
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r0 = 56 + rng.range(0, 12);
    out.push(
      el('path', {
        d: `M${f2(Math.cos(a) * r0)} ${f2(Math.sin(a) * r0)}L${f2(Math.cos(a) * 89)} ${f2(Math.sin(a) * 89)}`,
        stroke: '#000',
        'stroke-width': i % 3 === 0 ? 1.1 : 0.55,
        'stroke-opacity': 0.4,
      }),
    );
  }
  return out;
}

/** the grisaille of one moth, in petal coordinates (the axis along x, the head towards the eye) */
function mothGrisaille(/** @type {Rng} */ rng) {
  const out = [];
  const stroke = (/** @type {string} */ d, /** @type {number} */ w, /** @type {number} */ o) =>
    el('path', {d, stroke: '#000', 'stroke-width': w, 'stroke-opacity': o, fill: 'none', 'stroke-linecap': 'round'});
  for (const s of [1, -1]) {
    // feathered antennae, curling towards the eye
    /** @type {number[][]} */
    const ant = [];
    for (let t = 0; t <= 1.001; t += 0.1) ant.push([112 - t * 9, s * (3 + t * 19 + Math.sin(t * 3) * 2)]);
    out.push(stroke(pathOf(ant), 1.1, 0.85));
    for (let t = 0.15; t < 1; t += 0.12) {
      const x = 112 - t * 9;
      const y = s * (3 + t * 19 + Math.sin(t * 3) * 2);
      out.push(stroke(`M${f2(x)} ${f2(y)}L${f2(x - 3.4)} ${f2(y - s * 1.2)}`, 0.6, 0.7));
      out.push(stroke(`M${f2(x)} ${f2(y)}L${f2(x + 1.5)} ${f2(y + s * 2.6)}`, 0.6, 0.6));
    }
    // the eye of the moth's head
    out.push(el('circle', {cx: 115, cy: s * 3.6, r: 2.2, fill: '#000', 'fill-opacity': 0.9}));
    // forewing: veins fanning from the root, a scalloped band, a dark margin
    const root = [129, s * 6];
    for (const [ex, ey] of [
      [121, 38],
      [133, 44],
      [148, 46],
      [164, 34],
      [176, 21],
    ]) {
      out.push(
        stroke(
          `M${root[0]} ${f2(root[1])}Q${f2((root[0] + ex) / 2 + 3)} ${f2((s * (6 + ey)) / 2)} ${ex} ${f2(s * ey)}`,
          0.8,
          0.6,
        ),
      );
    }
    /** @type {number[][]} */
    const band = [];
    for (let t = 0; t <= 1.001; t += 0.05) {
      const x = 123 + t * 48;
      band.push([x, s * (36 - t * 18 + Math.sin(t * 28) * 1.6)]);
    }
    out.push(stroke(pathOf(band), 1.3, 0.75));
    out.push(stroke(pathOf(FOREWING.slice(1, 4).map(([x, y]) => [x, s * y])), 3.2, 0.45));
    // the ring and the pupil of the eyespot
    out.push(
      el('circle', {cx: 146, cy: s * 28, r: 6.2, fill: 'none', stroke: '#000', 'stroke-width': 1.3, 'stroke-opacity': 0.8}),
    );
    out.push(el('ellipse', {cx: 146, cy: s * 28, rx: 1.4, ry: 3.4, fill: '#000', 'fill-opacity': 0.92}));
    // hindwing: rings like a target, and a dark root
    for (const r of [7, 12, 17]) {
      out.push(el('circle', {cx: 124, cy: s * 22, r, fill: 'none', stroke: '#000', 'stroke-width': 0.8, 'stroke-opacity': 0.55}));
    }
    out.push(el('circle', {cx: 124, cy: s * 22, r: 3, fill: '#000', 'fill-opacity': 0.75}));
    // ground: a sparse diaper of dots and crosses
    for (let i = 0; i < 9; i++) {
      const x = rng.range(110, 175);
      const y = s * rng.range(8, 44);
      out.push(el('circle', {cx: x, cy: y, r: rng.range(0.6, 1.2), fill: '#000', 'fill-opacity': 0.55}));
    }
  }
  // abdomen segments and the fur of the thorax
  for (let x = 134; x < 172; x += 5.2) {
    const h = 6.5 * Math.sqrt(Math.max(0, 1 - ((x - 148) / 27) ** 2));
    out.push(stroke(`M${f2(x)} ${f2(-h)}Q${f2(x + 1.8)} 0 ${f2(x)} ${f2(h)}`, 1, 0.65));
  }
  for (let i = 0; i < 26; i++) {
    const x = rng.range(121, 134);
    const y = rng.range(-5, 5);
    out.push(stroke(`M${f2(x)} ${f2(y)}l${f2(rng.range(-1, 1))} ${f2(rng.range(-2, 2))}`, 0.6, 0.6));
  }
  out.push(stroke('M170 0L178 0', 1.2, 0.6));
  return out;
}

/** the grisaille of one lancet, in lancet coordinates */
function lancetGrisaille(/** @type {Rng} */ rng) {
  const out = [];
  const stroke = (/** @type {string} */ d, /** @type {number} */ w, /** @type {number} */ o) =>
    el('path', {d, stroke: '#000', 'stroke-width': w, 'stroke-opacity': o, fill: 'none', 'stroke-linecap': 'round'});
  // the small eye: a slit pupil, a ring of ticks
  out.push(el('ellipse', {cx: ROUNDEL_X, cy: 0, rx: 1.3, ry: 4, fill: '#000', 'fill-opacity': 0.95}));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    out.push(
      stroke(
        `M${f2(ROUNDEL_X + Math.cos(a) * 7.5)} ${f2(Math.sin(a) * 7.5)}L${f2(ROUNDEL_X + Math.cos(a) * 12)} ${f2(Math.sin(a) * 12)}`,
        0.7,
        0.6,
      ),
    );
  }
  // a vine climbing each light, leaves alternating
  for (const s of [1, -1]) {
    /** @type {number[][]} */
    const stem = [];
    for (let x = 211; x <= 238; x += 1.5) stem.push([x, s * (11 + Math.sin((x - 211) * 0.42) * 4)]);
    out.push(stroke(pathOf(stem), 1, 0.7));
    for (let x = 214; x < 237; x += 6) {
      const y = s * (11 + Math.sin((x - 211) * 0.42) * 4);
      const up = (x / 6) % 2 < 1 ? 1 : -1;
      out.push(
        el('ellipse', {
          cx: x + 1.5,
          cy: y + up * 4,
          rx: 3.2,
          ry: 1.4,
          transform: `rotate(${up * 35} ${f2(x + 1.5)} ${f2(y + up * 4)})`,
          fill: '#000',
          'fill-opacity': 0.5,
        }),
      );
    }
  }
  // a trefoil in the tip
  for (const [cx, cy] of [
    [283, 0],
    [277, 4.5],
    [277, -4.5],
  ]) {
    out.push(el('circle', {cx, cy, r: 3.6, fill: 'none', stroke: '#000', 'stroke-width': 0.9, 'stroke-opacity': 0.6}));
  }
  out.push(el('circle', {cx: 288, cy: rng.range(-0.5, 0.5), r: 0.9, fill: '#000', 'fill-opacity': 0.6}));
  return out;
}

/** The grisaille of the whole rose as the opacity of its paint, at 4 points per unit over ±GLASS_EXTENT. */
async function renderGrisaille() {
  const rng = new Rng(0x6d07);
  const size = GLASS_EXTENT * 2 * Q;
  const body = [...eyeGrisaille(rng)];
  for (let k = 0; k < 8; k++) {
    const deg = 90 + k * 45;
    body.push(el('g', {transform: `rotate(${deg})`}, mothGrisaille(rng)));
  }
  for (let k = 0; k < 16; k++) {
    const deg = 90 + k * 22.5;
    body.push(el('g', {transform: `rotate(${f2(deg)})`}, lancetGrisaille(rng)));
  }
  const t = `matrix(${Q} 0 0 ${-Q} ${GLASS_EXTENT * Q} ${GLASS_EXTENT * Q})`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g transform="${t}">${body.join('')}</g></svg>`;
  const data = await rasterize(svg, size, size);
  const paint = new Float32Array(size * size);
  for (let p = 0; p < paint.length; p++) paint[p] = data[p * 4 + 3] / 255;
  return paint;
}

// ---------------------------------------------------------------------------------------------
// the outputs
// ---------------------------------------------------------------------------------------------

/**
 * The glass (`glass.webp`, straight RGBA: red the amber, blue the violet, alpha the light it lets
 * through), the ids of its panes (`panes.png`) and their list.
 */
export async function renderRose() {
  const {size, ids, dist, panes} = computeRegions();
  check(panes.length < 65535, `the ids of the panes fit 16 bits, got ${panes.length}`);
  const paint = await renderGrisaille();

  // the variation of every pane: how strong its tint is, how its streaks run
  const rng = new Rng(0x91a55);
  const vary = panes.map(() => ({
    tint: rng.range(0.82, 1),
    light: rng.range(0.93, 1.04),
    angle: rng.range(0, Math.PI),
    seed: rng.int(1, 1 << 20),
  }));

  const offset = (FRAME_EXTENT - GLASS_EXTENT) * Q;
  const gsize = GLASS_EXTENT * 2 * Q;
  const out = GLASS_EXTENT * 2 * PX;
  const rgba = new Float32Array(out * out * 4);
  const idBytes = new Uint8Array(out * out * 4);
  for (let oy = 0; oy < out; oy++) {
    for (let ox = 0; ox < out; ox++) {
      let r = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const gi = ox * SS + sx;
          const gj = oy * SS + sy;
          const p = (gj + offset) * size + gi + offset;
          const id = ids[p];
          if (!id) continue;
          const pane = panes[id - 1];
          const kind = KINDS[pane.kind];
          const v = vary[id - 1];
          const d = dist[p];
          const x = (gi + 0.5) / Q - GLASS_EXTENT;
          const y = GLASS_EXTENT - (gj + 0.5) / Q;
          // streaks along a direction of its own in every pane, and a fine seedy grain
          const c = Math.cos(v.angle);
          const s = Math.sin(v.angle);
          const u = x * c + y * s;
          const w = -x * s + y * c;
          const streak = fbm(u * 0.035, w * 0.32, v.seed, 3);
          const grain = valueNoise(x * 1.7, y * 1.7, 77);
          // the painter's matt: darker towards the lead, a cushion of light in the middle
          const matt = 0.8 + 0.2 * smoothstep(LEAD - 0.2, 10, d);
          const edge = smoothstep(LEAD - 0.75, LEAD - 0.05, d);
          const ga = paint[gj * gsize + gi];
          const alpha = sat(kind.a * v.light * (0.86 + 0.18 * streak) * (0.95 + 0.05 * grain) * matt * edge * (1 - 0.86 * ga));
          r += sat(kind.r * v.tint * (0.8 + 0.3 * streak)) * alpha;
          b += sat(kind.b * (0.85 + 0.2 * streak)) * alpha;
          a += alpha;
        }
      }
      const o = (oy * out + ox) * 4;
      const n = SS * SS;
      if (a > 0) {
        rgba[o] = r / a;
        rgba[o + 2] = b / a;
      }
      rgba[o + 3] = a / n;
      // the id at the middle of the texel, little-endian over red and green
      const cp = (oy * SS + 1 + offset) * size + ox * SS + 1 + offset;
      const id = ids[cp];
      idBytes[o] = id & 255;
      idBytes[o + 1] = id >> 8;
      idBytes[o + 3] = 255;
    }
  }

  const bytes = new Uint8Array(out * out * 4);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(sat(rgba[i]) * 255);
  for (let i = 0; i < bytes.length; i += 4) if (bytes[i + 3] === 0) bytes[i] = bytes[i + 1] = bytes[i + 2] = 0;
  const glass = await sharp(Buffer.from(bytes.buffer), {raw: {width: out, height: out, channels: 4}})
    .webp({lossless: true, effort: 6})
    .toBuffer();
  return {glass, idBytes, size: out, panes, regions: {size, ids, dist}};
}

/** Moonlight from the top left, and the warm light of the candles that comes out of the glass. */
const MOON = (() => {
  const v = [-0.5, 0.68, 0.54];
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
})();
const MOON_RGB = [0.44, 0.48, 0.58];
const AMBIENT = [0.06, 0.065, 0.085];
const WARM_RGB = [1, 0.56, 0.24];

/** the profile of the mouldings: height over the distance from the edge of the glass */
function mouldingHeight(/** @type {number} */ t) {
  if (t < 6) return t * 0.7;
  if (t < 14) return 4.2 - 2.4 * Math.sin((Math.PI * (t - 6)) / 8);
  if (t < 26) return 4.2 + 5.5 * Math.sin((Math.PI * (t - 14)) / 12);
  if (t < 30) return 5;
  return 5 + (t - 30) * 0.65;
}

/** the voussoirs: 24 blocks around the mouldings */
const VOUSSOIRS = 24;
const VOUSSOIR_IN = 347;

/**
 * The stone of the rose — the tracery between the panes, the mouldings, a ring of voussoirs — and
 * the lead between the panes, as straight RGBA over ±FRAME_EXTENT. The glass itself is clear.
 * @param {{size: number, ids: Uint16Array, dist: Float32Array}} regions
 */
export async function renderFrame(regions) {
  const {size, ids, dist} = regions;
  const rng = new Rng(0x570e);
  const blocks = Array.from({length: VOUSSOIRS}, () => ({
    tone: rng.range(0.82, 1.08),
    warm: rng.range(-0.04, 0.04),
    seed: rng.int(1, 1 << 20),
  }));

  // heights of the stone, for its normals
  const height = new Float32Array(size * size);
  const zone = new Uint8Array(size * size);
  for (let j = 0; j < size; j++) {
    const y = FRAME_EXTENT - (j + 0.5) / Q;
    for (let i = 0; i < size; i++) {
      const p = j * size + i;
      const x = (i + 0.5) / Q - FRAME_EXTENT;
      const r = Math.hypot(x, y);
      if (r > STONE_R + 1) continue;
      const d = dist[p];
      if (ids[p]) {
        // lead: a rounded came along every border between panes
        if (d < LEAD) {
          zone[p] = 4;
          height[p] = 1.4 * Math.sqrt(1 - (d / LEAD) ** 2);
        }
        continue;
      }
      const chamfer = Math.min(d, 4.2);
      if (r < GLASS_R) {
        zone[p] = 1;
        height[p] = chamfer + fbm(x * 0.4, y * 0.4, 5, 2) * 0.35;
      } else if (r < VOUSSOIR_IN) {
        zone[p] = 2;
        height[p] = Math.min(chamfer, 4.2) + mouldingHeight(r - GLASS_R) + fbm(x * 0.3, y * 0.3, 6, 2) * 0.3;
      } else {
        const a = Math.atan2(y, x);
        const step = (2 * Math.PI) / VOUSSOIRS;
        const ja = (((a / step) % 1) + 1) % 1;
        const joint = Math.min(ja, 1 - ja) * step * r;
        const chip = (fbm(x * 0.25, y * 0.25, 9, 3) - 0.5) * 2.4;
        const edge = Math.min(joint, r - VOUSSOIR_IN, STONE_R - 1.4 - r) + chip;
        if (edge < 0.9) {
          zone[p] = 5;
          height[p] = mouldingHeight(VOUSSOIR_IN - GLASS_R) + 7 - 1.5;
        } else {
          zone[p] = 3;
          height[p] = mouldingHeight(VOUSSOIR_IN - GLASS_R) + 7 + Math.min(edge - 0.9, 2.2) + fbm(x * 0.35, y * 0.35, 7, 3) * 0.6;
        }
      }
    }
  }

  const out = FRAME_EXTENT * 2 * PX;
  const rgba = new Float32Array(out * out * 4);
  const step = 1 / Q;
  for (let oy = 0; oy < out; oy++) {
    for (let ox = 0; ox < out; ox++) {
      let cr = 0;
      let cg = 0;
      let cb = 0;
      let ca = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ox * SS + sx;
          const j = oy * SS + sy;
          const p = j * size + i;
          const z = zone[p];
          if (!z) continue;
          const x = (i + 0.5) / Q - FRAME_EXTENT;
          const y = FRAME_EXTENT - (j + 0.5) / Q;
          const r = Math.hypot(x, y);
          // the normal from the heights (y up)
          const hl = i > 0 && zone[p - 1] ? height[p - 1] : height[p];
          const hr = i + 1 < size && zone[p + 1] ? height[p + 1] : height[p];
          const hu = j > 0 && zone[p - size] ? height[p - size] : height[p];
          const hd = j + 1 < size && zone[p + size] ? height[p + size] : height[p];
          let nx = -(hr - hl) / (2 * step);
          let ny = -(hu - hd) / (2 * step);
          let nz = 1;
          const nl = Math.hypot(nx, ny, nz);
          nx /= nl;
          ny /= nl;
          nz /= nl;
          const d = dist[p];

          // the warm light out of the glass, falling on what faces it
          let wx;
          let wy;
          let warmFall;
          if (z === 4 || z === 1) {
            // towards the nearest border: the gradient of the distance, downhill
            const dl = i > 0 ? dist[p - 1] : d;
            const dr = i + 1 < size ? dist[p + 1] : d;
            const du = j > 0 ? dist[p - size] : d;
            const dd = j + 1 < size ? dist[p + size] : d;
            const gx = dr - dl;
            const gy = du - dd;
            const gl = Math.hypot(gx, gy) || 1;
            wx = -gx / gl;
            wy = -gy / gl;
            warmFall = z === 4 ? 0.9 : Math.exp(-d / 3) * 0.55;
          } else {
            wx = -x / r;
            wy = -y / r;
            warmFall = Math.exp(-(r - GLASS_R) / 16) * 0.8;
          }
          const wl = Math.hypot(wx, wy, 0.45);
          const warm = warmFall * Math.max(0, (nx * wx + ny * wy + nz * 0.45) / wl);
          const moon = Math.max(0, nx * MOON[0] + ny * MOON[1] + nz * MOON[2]);

          // albedo
          let ar;
          let ag;
          let ab;
          let ao = 1;
          if (z === 4) {
            const ox2 = valueNoise(x * 0.9, y * 0.9, 41);
            const white = smoothstep(0.72, 0.9, ox2) * 0.35;
            ar = 0.15 + white;
            ag = 0.15 + white;
            ab = 0.16 + white;
            // the edges of the came catch the glow of both panes
            const t = d / LEAD;
            const glow = 0.15 + 0.6 * t * t;
            const lr = AMBIENT[0] + MOON_RGB[0] * moon * 0.8 + WARM_RGB[0] * glow * 0.75;
            const lg = AMBIENT[1] + MOON_RGB[1] * moon * 0.8 + WARM_RGB[1] * glow * 0.75;
            const lb = AMBIENT[2] + MOON_RGB[2] * moon * 0.8 + WARM_RGB[2] * glow * 0.75;
            cr += ar * lr;
            cg += ag * lg;
            cb += ab * lb;
            ca += 1;
            continue;
          }
          const base = fbm(x * 0.045, y * 0.045, 3, 4);
          const fine = fbm(x * 0.6, y * 0.6, 4, 3);
          let tone = 0.78 + 0.32 * base + 0.12 * (fine - 0.5);
          let tw = 0;
          if (z === 3) {
            const a = Math.atan2(y, x);
            const step2 = (2 * Math.PI) / VOUSSOIRS;
            const b = blocks[((Math.floor(a / step2) % VOUSSOIRS) + VOUSSOIRS) % VOUSSOIRS];
            tone *= b.tone;
            tw = b.warm;
            // tool marks across each block
            tone *= 0.96 + 0.04 * Math.sin(r * 2.1 + valueNoise(x * 0.2, y * 0.2, b.seed) * 4);
          }
          if (z === 5) {
            tone = 0.42 + 0.12 * fine;
            ao = 0.55;
          }
          // grime runs down the stone: streaks stretched along y, heavier under the window
          const streaks = fbm(x * 0.09, y * 0.008, 13, 4);
          const grime = smoothstep(0.45, 0.8, streaks) * (0.35 + 0.35 * smoothstep(0, -320, y));
          tone *= 1 - grime * 0.55;
          ar = 0.43 * tone + tw;
          ag = 0.42 * tone;
          ab = 0.39 * tone - tw;
          // lichen on what faces up
          const lichen = smoothstep(0.66, 0.78, fbm(x * 0.11, y * 0.11, 21, 4)) * smoothstep(0.1, 0.5, ny + 0.3);
          ar += (0.5 - ar) * lichen * 0.35;
          ag += (0.55 - ag) * lichen * 0.35;
          ab += (0.28 - ab) * lichen * 0.35;
          // the hollow of the moulding and the inside corners hold the dark
          if (z === 2) {
            const t = r - GLASS_R;
            if (t > 6 && t < 14) ao = 0.62 + 0.38 * Math.abs((t - 10) / 4);
          }
          if (z === 1) ao = 0.75 + 0.25 * smoothstep(0, 2.5, d);
          const lr = AMBIENT[0] + MOON_RGB[0] * moon + WARM_RGB[0] * warm;
          const lg = AMBIENT[1] + MOON_RGB[1] * moon + WARM_RGB[1] * warm;
          const lb = AMBIENT[2] + MOON_RGB[2] * moon + WARM_RGB[2] * warm;
          cr += ar * lr * ao;
          cg += ag * lg * ao;
          cb += ab * lb * ao;
          ca += 1;
        }
      }
      const o = (oy * out + ox) * 4;
      if (ca > 0) {
        rgba[o] = cr / ca;
        rgba[o + 1] = cg / ca;
        rgba[o + 2] = cb / ca;
      }
      rgba[o + 3] = ca / (SS * SS);
    }
  }
  return {rgba, size: out};
}
