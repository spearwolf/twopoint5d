// stage-masks/without-director: "the wallpaper is watching". A Victorian flocked damask in two
// versions of one geometry — the ordinary paper, and the same paper where the ornament has become
// eyes and mouths — plus the wainscot under it in the same two versions and the parts of an eye.
//
// Everything is drawn from signed distance functions in tile units (0..1, y down) and shaded at the
// output resolution: analytic anti-aliasing from the distance, a bevel from its gradient, a cast
// shadow from a second look-up. Both wallpaper tiles share every shape, so the haunted one lies
// exactly over the ordinary one wherever a mask reveals it.
import sharp from 'sharp';
import {check} from '../../lib/output.mjs';
import {encodePng} from '../../lib/png.mjs';

/** @typedef {import('../../lib/output.mjs').Output} Output */
/** @typedef {[number, number, number]} RGB */

const DIR = 'without-director';
const TILE = 1024;
const WAINSCOT_W = 1024;
const WAINSCOT_H = 256;

// ---------------------------------------------------------------- helpers

/** @param {string} h @returns {RGB} */
const rgb = (h) => {
  const n = Number.parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
/** @param {RGB} a @param {RGB} b @param {number} t @returns {RGB} */
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** @param {RGB} a @param {number} k @returns {RGB} */
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
/** @param {number} v */
const sat = (v) => Math.min(1, Math.max(0, v));
/** @param {number} e0 @param {number} e1 @param {number} x */
const smoothstep = (e0, e1, x) => {
  const t = sat((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** smooth minimum, polynomial; k in tile units */
const smin = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ k) => {
  const h = sat(0.5 + (0.5 * (b - a)) / k);
  return b + (a - b) * h - k * h * (1 - h);
};

/** @param {number} x @param {number} y @param {number} seed */
function hash(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Value noise, periodic with `px` × `py` cells, so a tile of it repeats without a seam.
 * @param {number} x @param {number} y @param {number} px @param {number} py @param {number} seed
 */
function pnoise(x, y, px, py, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const wx = (/** @type {number} */ v) => ((v % px) + px) % px;
  const wy = (/** @type {number} */ v) => ((v % py) + py) % py;
  const a = hash(wx(x0), wy(y0), seed);
  const b = hash(wx(x0 + 1), wy(y0), seed);
  const c = hash(wx(x0), wy(y0 + 1), seed);
  const d = hash(wx(x0 + 1), wy(y0 + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** fractal periodic noise in [0, 1]; (u, v) in tile units, `cells` the base frequency per tile */
function pfbm(
  /** @type {number} */ u,
  /** @type {number} */ v,
  /** @type {number} */ cellsX,
  /** @type {number} */ cellsY,
  /** @type {number} */ seed,
  octaves = 5,
) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let fx = cellsX;
  let fy = cellsY;
  for (let o = 0; o < octaves; o++) {
    sum += amp * pnoise(u * fx, v * fy, fx, fy, seed + o * 131);
    norm += amp;
    amp *= 0.5;
    fx *= 2;
    fy *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------- distance functions (tile units)

/** iq's ellipse approximation */
function sdEllipse(/** @type {number} */ px, /** @type {number} */ py, /** @type {number} */ rx, /** @type {number} */ ry) {
  const k0 = Math.hypot(px / rx, py / ry);
  const k1 = Math.hypot(px / (rx * rx), py / (ry * ry));
  return k1 === 0 ? -Math.min(rx, ry) : (k0 * (k0 - 1)) / k1;
}

/**
 * A vesica (pointed at both ends): half-length `h` along y, half-width `w` along x, centred.
 * @param {number} px @param {number} py @param {number} h @param {number} w
 */
function sdVesica(px, py, h, w) {
  const r = (h * h + w * w) / (2 * w);
  const d = r - w;
  const x = Math.abs(px);
  const y = Math.abs(py);
  return (y - h) * d > x * h ? Math.hypot(x, y - h) : Math.hypot(x + d, y) - r;
}

/**
 * A tapered capsule from its base (radius r1) along +y to its tip (radius r2) at height h.
 * @param {number} px @param {number} py @param {number} r1 @param {number} r2 @param {number} h
 */
function sdUnevenCapsule(px, py, r1, r2, h) {
  const x = Math.abs(px);
  const b = (r1 - r2) / h;
  const a = Math.sqrt(1 - b * b);
  const k = -b * x + a * py;
  if (k < 0) return Math.hypot(x, py) - r1;
  if (k > a * h) return Math.hypot(x, py - h) - r2;
  return x * a + py * b - r1;
}

/**
 * An arc of radius `ra` and thickness `rb`, open towards −y, `half` the half-aperture of the open
 * part in radians.
 */
function sdArc(
  /** @type {number} */ px,
  /** @type {number} */ py,
  /** @type {number} */ ra,
  /** @type {number} */ rb,
  /** @type {number} */ half,
) {
  // iq's arc is symmetric about the y axis and spans from +y over the sides; flip so it opens at −y
  const sc0 = Math.sin(Math.PI - half);
  const sc1 = Math.cos(Math.PI - half);
  const x = Math.abs(px);
  const y = -py;
  return (sc1 * x > sc0 * y ? Math.hypot(x - sc0 * ra, y - sc1 * ra) : Math.abs(Math.hypot(x, y) - ra)) - rb;
}

/** the point (px, py) in a frame at (ox, oy), turned by `angle` (0: the frame's +y is the world's +y) */
function local(
  /** @type {number} */ px,
  /** @type {number} */ py,
  /** @type {number} */ ox,
  /** @type {number} */ oy,
  /** @type {number} */ angle,
) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = px - ox;
  const dy = py - oy;
  return [dx * c + dy * s, -dx * s + dy * c];
}

/** a leaf from (ax, ay) to (bx, by), half-width w, bent sideways by `bend` at its middle */
function sdLeaf(
  /** @type {number} */ px,
  /** @type {number} */ py,
  /** @type {number} */ ax,
  /** @type {number} */ ay,
  /** @type {number} */ bx,
  /** @type {number} */ by,
  /** @type {number} */ w,
  bend = 0,
) {
  const angle = Math.atan2(bx - ax, by - ay);
  const h = Math.hypot(bx - ax, by - ay) / 2;
  const [lx, ly] = local(px, py, (ax + bx) / 2, (ay + by) / 2, -angle);
  const t = ly / h;
  return sdVesica(lx - bend * (1 - t * t), ly, h, w);
}

// ---------------------------------------------------------------- the damask

// The ogee lattice: cell 1 centred at (0.5, 0.5), cell 2 at the corners (half-drop). The boundary
// is |x − 0.5| = 0.5 cos²(π (y − 0.5)) with x taken modulo 1; the two cells tile exactly.
function latticeDistance(/** @type {number} */ x, /** @type {number} */ y) {
  const fx = x - Math.floor(x);
  const u = y - 0.5;
  const g = Math.abs(fx - 0.5) - 0.5 * Math.cos(Math.PI * u) ** 2;
  const dy = -0.5 * Math.PI * Math.sin(2 * Math.PI * u);
  return g / Math.hypot(1, dy);
}

/** local coordinates in cell 1 and in cell 2 */
function cells(/** @type {number} */ x, /** @type {number} */ y) {
  const ax = x - 0.5;
  const ay = y - 0.5;
  const bx = x + 0.5 - Math.floor(x + 0.5) - 0.5;
  const by = y + 0.5 - Math.floor(y + 0.5) - 0.5;
  return [ax, ay, bx, by];
}

// the places of the eyes, in tile units of the ordinary geometry, shared with the demo
const BIG_EYE = {x: 0, y: 0.015, rx: 0.098, ry: 0.052};
const SCROLL = {x: 0.165, y: 0.075, r: 0.064};
const SCROLL_EYE = {rx: 0.03, ry: 0.024};
const FACE_EYE = {x: 0.072, y: -0.07, rx: 0.034, ry: 0.02};
const MOUTH = {y: 0.035, h: 0.088, w: 0.034};

/**
 * The main motif in cell 1, mirrored about its axis: the flock (raised shapes) and the inlaid lines.
 * @returns {{flock: number, inlay: number}}
 */
function motifA(/** @type {number} */ qx, /** @type {number} */ qy) {
  const ax = Math.abs(qx);
  // the cartouche around the seed (the big eye)
  let flock = sdEllipse(qx, qy - BIG_EYE.y, BIG_EYE.rx + 0.03, BIG_EYE.ry + 0.03);
  // the palmette: five petals fanning upwards from above the cartouche
  const base = [0, BIG_EYE.y - BIG_EYE.ry - 0.012];
  const petals = [
    [0, 0.2, 0.03],
    [0.42, 0.17, 0.027],
    [0.86, 0.12, 0.022],
  ];
  for (const [angle, length, width] of petals) {
    const [lx, ly] = local(ax, qy, base[0], base[1], Math.PI + angle);
    flock = smin(flock, sdUnevenCapsule(lx, ly, 0.008, width, length), 0.012);
  }
  // the volutes: an arc that curls in on a knob, either side
  const [sx, sy] = [ax - SCROLL.x, qy - SCROLL.y];
  const [rx, ry] = local(sx, sy, 0, 0, -0.5);
  const arc = sdArc(rx, ry, SCROLL.r * 0.78, 0.016, 0.9);
  const knob = Math.hypot(sx, sy) - SCROLL.r * 0.42;
  flock = smin(flock, Math.min(arc, knob), 0.01);
  // the stalk from the cartouche to the volutes
  flock = smin(flock, sdLeaf(ax, qy, 0.05, BIG_EYE.y + 0.03, SCROLL.x - 0.02, SCROLL.y + 0.05, 0.012, 0.02), 0.01);
  // acanthus leaves that sweep up and out from the shoulders of the cartouche
  flock = smin(flock, sdLeaf(ax, qy, 0.09, BIG_EYE.y - 0.04, 0.21, -0.19, 0.022, 0.035), 0.01);
  flock = Math.min(flock, sdLeaf(ax, qy, 0.2, -0.17, 0.235, -0.24, 0.01, 0.006));
  // small leaves either side of the tall middle petal
  flock = Math.min(flock, sdLeaf(ax, qy, 0.012, -0.2, 0.06, -0.25, 0.011, 0.008));
  // the drooping leaves and the pendant below
  flock = smin(flock, sdLeaf(ax, qy, 0.02, 0.09, 0.13, 0.27, 0.03, -0.025), 0.012);
  flock = Math.min(flock, sdUnevenCapsule(qx, -(qy - 0.33), 0.008, 0.026, 0.07));
  // the finial at the top tip of the cell
  flock = Math.min(flock, sdVesica(qx, qy + 0.37, 0.05, 0.022));
  flock = Math.min(flock, Math.hypot(qx, qy + 0.3) - 0.014);
  // inlays: a vein in every petal and leaf, the inner ring of the cartouche, the spiral groove
  let inlay = Math.abs(sdEllipse(qx, qy - BIG_EYE.y, BIG_EYE.rx + 0.012, BIG_EYE.ry + 0.012));
  for (const [angle, length] of petals) {
    const [lx, ly] = local(ax, qy, base[0], base[1], Math.PI + angle);
    inlay = Math.min(inlay, ly > 0.03 && ly < length * 0.92 ? Math.abs(lx) : 1);
  }
  inlay = Math.min(inlay, Math.abs(sdLeaf(ax, qy, 0.03, 0.1, 0.12, 0.25, 0.0001, -0.022)) + 0.0004);
  inlay = Math.min(inlay, Math.abs(Math.hypot(sx, sy) - SCROLL.r * 0.26));
  inlay = Math.min(inlay, Math.abs(sdLeaf(ax, qy, 0.1, BIG_EYE.y - 0.05, 0.2, -0.175, 0.0001, 0.03)) + 0.0004);
  return {flock, inlay};
}

/** the small motif in cell 2: a rosette of eight petals round a ring, with tendrils */
function motifB(/** @type {number} */ qx, /** @type {number} */ qy) {
  const ax = Math.abs(qx);
  let flock = Math.abs(Math.hypot(qx, qy) - 0.05) - 0.014;
  let inlay = 1;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const [lx, ly] = local(qx, qy, 0, 0, angle);
    flock = smin(flock, sdVesica(lx, ly - 0.105, 0.042, 0.018), 0.008);
    inlay = Math.min(inlay, ly > 0.075 && ly < 0.135 ? Math.abs(lx) : 1);
  }
  flock = Math.min(flock, Math.hypot(qx, qy) - 0.022);
  // sprigs left and right: a stem with two leaves
  flock = Math.min(flock, sdLeaf(ax, qy, 0.15, 0.0, 0.25, -0.02, 0.006, 0.004));
  flock = Math.min(flock, sdLeaf(ax, qy, 0.19, -0.008, 0.23, -0.06, 0.013, 0.006));
  flock = Math.min(flock, sdLeaf(ax, qy, 0.2, -0.01, 0.245, 0.03, 0.012, -0.006));
  flock = Math.min(flock, Math.hypot(ax - 0.255, qy + 0.022) - 0.008);
  return {flock, inlay};
}

/** beads where the lattice cells meet */
function beads(/** @type {number} */ x, /** @type {number} */ y) {
  const pts = [
    [0.5, 0],
    [0.5, 1],
    [0, 0.5],
    [1, 0.5],
  ];
  let d = 1;
  for (const [bx, by] of pts) d = Math.min(d, sdVesica(x - bx, y - by, 0.024, 0.012));
  return d;
}

/**
 * Everything raised (flock) and every inlaid line at (x, y) of the ordinary tile.
 * @returns {{flock: number, inlay: number, lattice: number}}
 */
function damask(/** @type {number} */ x, /** @type {number} */ y) {
  const [ax, ay, bx, by] = cells(x, y);
  const a = motifA(ax, ay);
  const b = motifB(bx, by);
  const ld = latticeDistance(x, y);
  const lines = Math.min(Math.abs(ld - 0.0085), Math.abs(ld + 0.0085)) - 0.0028;
  // beads on the middle of the double line, spaced along y
  const by2 = (y * 48 - Math.floor(y * 48) - 0.5) / 48;
  const bead = Math.hypot(ld, by2) - 0.0042;
  const lattice = Math.min(lines, bead);
  const flock = Math.min(a.flock, b.flock, lattice, beads(x, y));
  return {flock, inlay: Math.min(a.inlay, b.inlay), lattice};
}

/** the holes of the haunted tile: the eyes, as the distance to their almond */
function eyeHoles(/** @type {number} */ x, /** @type {number} */ y) {
  const [ax, ay, bx, by] = cells(x, y);
  const big = sdVesica(ay - BIG_EYE.y, ax, BIG_EYE.rx, BIG_EYE.ry);
  const scroll = sdEllipse(Math.abs(ax) - SCROLL.x, ay - SCROLL.y, SCROLL_EYE.rx, SCROLL_EYE.ry);
  const face = sdVesica(by - FACE_EYE.y, Math.abs(bx) - FACE_EYE.x, FACE_EYE.rx, FACE_EYE.ry);
  return Math.min(big, scroll, face);
}

const P = {
  paper: rgb('#1f3a31'),
  paperDark: rgb('#0f211c'),
  stripe: rgb('#27463b'),
  flock: rgb('#b08d4c'),
  flockDark: rgb('#6b5129'),
  flockLight: rgb('#e2c58a'),
  inlay: rgb('#4a3417'),
  stain: rgb('#3b2c16'),
  // the haunted palette: the same paper gone bruised, the ornament gone to bone and skin
  hPaper: rgb('#2c3431'),
  hPaperDark: rgb('#141317'),
  hVein: rgb('#6a2550'),
  hFlock: rgb('#c4a585'),
  hFlockDark: rgb('#6e4a4c'),
  hFlockLight: rgb('#f0dcc0'),
  hInlay: rgb('#5a1f3c'),
  lid: rgb('#4a1730'),
  lidLight: rgb('#8a4058'),
  lash: rgb('#140a10'),
  lip: rgb('#6a2346'),
  lipLight: rgb('#b0587a'),
  maw: rgb('#0c0408'),
  tooth: rgb('#e4d8b8'),
  toothDark: rgb('#8a7a5a'),
};

// light comes from the top left; y points down in the image
const LIGHT = [-0.55, -0.83];
const BEVEL = 0.009;
const SHADOW_OFFSET = 0.006;

/**
 * Shades one pixel of the damask, ordinary or haunted.
 * @param {number} x @param {number} y tile units
 * @param {boolean} haunted
 * @returns {[number, number, number, number]} straight rgba, 0..1
 */
function shadeWallpaper(x, y, haunted) {
  const px = 1 / TILE;
  const e = 0.5 * px;
  const here = damask(x, y);
  const d = here.flock;

  // the paper: mottled, with a fine woven stripe and fibres
  const mottle = pfbm(x, y, 4, 4, 11);
  const fibre = pnoise(x * 512, y * 64, 512, 64, 3);
  const stripe = 0.5 + 0.5 * Math.cos(2 * Math.PI * x * 64);
  let col = haunted ? mixc(P.hPaperDark, P.hPaper, 0.35 + mottle * 0.9) : mixc(P.paperDark, P.paper, 0.35 + mottle * 0.9);
  if (!haunted) col = mixc(col, P.stripe, stripe * 0.18);
  // a tone-on-tone diaper in the ground: a small four-petal sprig on a half-dropped grid
  const gx = x * 20 - Math.floor(x * 20) - 0.5;
  const gyRaw = y * 20 + (Math.floor(x * 20) % 2) * 0.5;
  const gy = gyRaw - Math.floor(gyRaw) - 0.5;
  const sprig = Math.min(sdVesica(gx, gy, 0.22, 0.07), sdVesica(gy, gx, 0.22, 0.07)) / 20;
  col = scale(col, 1 + 0.07 * sat(0.5 - sprig * TILE));
  col = scale(col, 0.93 + fibre * 0.12);

  if (haunted) {
    // veins under the skin of the paper: ridges of a warped noise
    const wx = x + (pfbm(x, y, 3, 3, 21) - 0.5) * 0.12;
    const wy = y + (pfbm(x, y, 3, 3, 22) - 0.5) * 0.12;
    const ridge = 1 - Math.abs(2 * pfbm(wx, wy, 5, 5, 23, 4) - 1);
    const bruise = smoothstep(0.7, 0.95, ridge);
    const vein = smoothstep(0.962, 0.988, ridge);
    const fine = smoothstep(0.972, 0.992, 1 - Math.abs(2 * pfbm(wx, wy, 11, 11, 29, 3) - 1));
    col = mixc(col, P.hVein, bruise * 0.14 + vein * 0.7 + fine * 0.35);
  }

  // the cast shadow of the flock on the paper
  const shadowD = damask(x - LIGHT[0] * SHADOW_OFFSET, y - LIGHT[1] * SHADOW_OFFSET).flock;
  const shadow = 1 - smoothstep(-0.004, 0.004, shadowD);
  col = scale(col, 1 - shadow * 0.45);

  // the flock: raised, bevelled, lit from the top left, ink at its edge
  const cover = sat(0.5 - d / px);
  if (cover > 0) {
    const gx = damask(x + e, y).flock - damask(x - e, y).flock;
    const gy = damask(x, y + e).flock - damask(x, y - e).flock;
    const gl = Math.hypot(gx, gy) || 1;
    const facing = (gx * LIGHT[0] + gy * LIGHT[1]) / gl; // outward normal towards the light: lit
    const rim = 1 - smoothstep(0, BEVEL, -d);
    const body = pfbm(x, y, 16, 16, 41, 3); // the velvet of the flock
    const base = haunted ? mixc(P.hFlockDark, P.hFlock, 0.55 + body * 0.6) : mixc(P.flockDark, P.flock, 0.5 + body * 0.7);
    const light = haunted ? P.hFlockLight : P.flockLight;
    const dark = haunted ? P.hFlockDark : P.flockDark;
    let f = facing > 0 ? mixc(base, light, facing * rim * 0.75) : mixc(base, dark, -facing * rim * 0.8);
    // the inlaid lines, pressed into the flock
    const inlay = sat(1 - (here.inlay - 0.0018) / px);
    f = mixc(f, haunted ? P.hInlay : P.inlay, inlay * 0.85);
    // an ink line along the edge
    f = scale(f, 1 - 0.35 * smoothstep(-2.2 * px, 0, d));
    col = mixc(col, f, cover);
  }

  // age: brown stains that bloom from the top and a darkening towards the bottom of the tile
  const stain = smoothstep(0.62, 0.8, pfbm(x, y, 2, 2, 51));
  col = mixc(col, P.stain, stain * (haunted ? 0.15 : 0.3));

  let alpha = 1;
  if (haunted) {
    const [ax, ay, bx, by] = cells(x, y);
    col = hauntedFeatures(col, x, y, ax, ay, bx, by);
    alpha = sat(eyeHoles(x, y) / px + 0.5);
  }
  return [col[0], col[1], col[2], alpha];
}

/**
 * The lids round every eye and the mouth of the face in cell 2.
 * @param {RGB} col @param {number} x @param {number} y
 * @param {number} ax @param {number} ay @param {number} bx @param {number} by
 * @returns {RGB}
 */
function hauntedFeatures(col, x, y, ax, ay, bx, by) {
  const px = 1 / TILE;
  // lids: a band of skin round the almond, darker towards the hole, lashes on the upper lid
  const lids = [
    {
      d: sdVesica(ay - BIG_EYE.y, ax, BIG_EYE.rx, BIG_EYE.ry),
      w: 0.016,
      lx: ax,
      ly: ay - BIG_EYE.y,
      rx: BIG_EYE.rx,
      ry: BIG_EYE.ry,
      lashes: 13,
    },
    {
      d: sdEllipse(Math.abs(ax) - SCROLL.x, ay - SCROLL.y, SCROLL_EYE.rx, SCROLL_EYE.ry),
      w: 0.009,
      lx: Math.abs(ax) - SCROLL.x,
      ly: ay - SCROLL.y,
      rx: SCROLL_EYE.rx,
      ry: SCROLL_EYE.ry,
      lashes: 7,
    },
    {
      d: sdVesica(by - FACE_EYE.y, Math.abs(bx) - FACE_EYE.x, FACE_EYE.rx, FACE_EYE.ry),
      w: 0.009,
      lx: Math.abs(bx) - FACE_EYE.x,
      ly: by - FACE_EYE.y,
      rx: FACE_EYE.rx,
      ry: FACE_EYE.ry,
      lashes: 7,
    },
  ];
  for (const lid of lids) {
    if (lid.d > lid.w + 0.03) continue;
    const band = sat(0.5 - (lid.d - lid.w) / px) * sat(lid.d / px + 1.5);
    if (band > 0) {
      const t = sat(lid.d / lid.w);
      // the upper lid catches the light, the lower one sits in shadow
      const upper = lid.ly < 0 ? 1 : 0.55;
      let skin = mixc(P.lid, P.lidLight, (1 - Math.abs(2 * t - 1)) * upper);
      skin = scale(skin, 0.75 + 0.25 * t);
      col = mixc(col, skin, band);
    }
    // a shadow ring inside the hole's rim reads as depth once the sclera shows through
    if (lid.ly < 0) {
      for (let i = 0; i < lid.lashes; i++) {
        const s = (i + 0.5) / lid.lashes;
        const tx = (s * 2 - 1) * lid.rx * 0.92;
        // a point on the upper rim of the almond, and the lash curving up and out from it
        const rimY = -lid.ry * (1 - (tx / lid.rx) ** 2) - lid.w * 0.6;
        const out = (s - 0.5) * 1.4;
        const len = lid.w * (1.6 + 0.6 * Math.cos((s - 0.5) * Math.PI));
        const [lx, ly] = local(lid.lx, lid.ly, tx, rimY, Math.PI - out);
        const lash = sdUnevenCapsule(lx, ly, px * 1.6, px * 0.5, len);
        col = mixc(col, P.lash, sat(0.5 - lash / px) * 0.9);
      }
    }
  }

  // the mouth of the face in cell 2: lips, a dark maw, two rows of teeth
  const my = by - MOUTH.y;
  const lips = sdVesica(my, bx, MOUTH.h, MOUTH.w);
  if (lips < 0.004) {
    const cover = sat(0.5 - lips / px);
    const inner = sdVesica(my * 1.0, bx, MOUTH.h * 0.86, MOUTH.w * 0.55);
    const lower = my > 0;
    let lip = mixc(P.lip, P.lipLight, lower ? sat(1 - Math.abs(my / MOUTH.w - 0.55) * 2.2) * 0.8 : 0.15);
    lip = scale(lip, 1 - 0.4 * smoothstep(-0.006, 0, lips));
    col = mixc(col, lip, cover);
    if (inner < px) {
      let maw = scale(P.maw, 1 + 2 * sat(-inner / 0.02));
      // teeth hang from the upper rim and stand on the lower, pointed, with gaps
      const toothW = 0.0105;
      const k = Math.round(bx / toothW);
      const dx = (bx - k * toothW) / (toothW * 0.42);
      const rimHalf = MOUTH.w * 0.55 * (1 - (bx / (MOUTH.h * 0.86)) ** 2);
      const tlen = 0.013 * (1 - Math.min(1, Math.abs(bx) / (MOUTH.h * 0.86)) ** 3);
      const tooth =
        Math.abs(dx) < 1 && (my < -rimHalf + tlen * (1 - Math.abs(dx)) || my > rimHalf - tlen * 0.8 * (1 - Math.abs(dx)));
      if (tooth) maw = mixc(P.toothDark, P.tooth, sat(1 - Math.abs(dx) * 0.8));
      col = mixc(col, maw, sat(0.5 - inner / px));
    }
  }
  void x;
  void y;
  return col;
}

// ---------------------------------------------------------------- the wainscot

const W = {
  wood: rgb('#512819'),
  woodDark: rgb('#24100a'),
  woodLight: rgb('#94522f'),
  rail: rgb('#4a2214'),
  raw: rgb('#8a5a3a'),
  mould: rgb('#141612'),
};

/** the height of the moulding profile of the dado rail at row v (0 at its top), 0..1 bright */
function railProfile(/** @type {number} */ v) {
  // a stack of rounded bands: a lip, a cove, a bead, a fillet
  if (v < 6) return 0.35 + 0.65 * Math.sin((v / 6) * Math.PI);
  if (v < 16) return 0.25 + 0.5 * Math.sin(((v - 6) / 10) * Math.PI) ** 0.6;
  if (v < 22) return 0.15 + 0.7 * Math.sin(((v - 16) / 6) * Math.PI);
  if (v < 26) return 0.1;
  return -1;
}

/**
 * @param {number} px pixel column
 * @param {number} py pixel row
 * @param {boolean} haunted
 * @returns {[number, number, number, number]}
 */
function shadeWainscot(px, py, haunted) {
  const u = px / WAINSCOT_W;
  const v = py / WAINSCOT_H;
  // the grain: long, horizontal, warped
  const warp = pfbm(u, v, 3, 2, 61) * 6;
  const grain = 0.5 + 0.5 * Math.sin((v * 90 + warp) * Math.PI * 2 * 0.5 + pnoise(u * 64, v * 8, 64, 8, 62) * 2);
  const fine = pnoise(u * 512, v * 48, 512, 48, 63);
  let col = mixc(W.woodDark, W.wood, 0.45 + grain * 0.4 + fine * 0.25);

  const rail = railProfile(py);
  if (rail >= 0) {
    col = mixc(W.woodDark, W.woodLight, rail);
    col = scale(col, 0.85 + fine * 0.3);
  } else if (py >= WAINSCOT_H - 22) {
    // the skirting board, darker, with a shadow line on top
    const t = (py - (WAINSCOT_H - 22)) / 22;
    col = scale(mixc(W.woodDark, W.wood, 0.4 + grain * 0.3), py < WAINSCOT_H - 19 ? 0.45 : 0.75 + 0.15 * (1 - t));
  } else {
    // two raised panels per tile between stiles, bevelled
    const panelW = WAINSCOT_W / 2;
    const lx = px % panelW;
    const top = 44;
    const bottom = WAINSCOT_H - 40;
    const left = 34;
    const right = panelW - 34;
    const inside = lx > left && lx < right && py > top && py < bottom;
    // the shadow of the rail on the stile
    if (py < 34) col = scale(col, 0.55 + 0.45 * ((py - 26) / 8));
    if (inside) {
      const dx = Math.min(lx - left, right - lx);
      const dy = Math.min(py - top, bottom - py);
      const edge = Math.min(dx, dy);
      const bevel = 14;
      if (edge < bevel) {
        // the bevel faces: top and left catch the light
        const faceTopLeft = (dy < dx && py - top < bottom - py) || (dx <= dy && lx - left < right - lx);
        col = scale(col, faceTopLeft ? 1.35 - (edge / bevel) * 0.2 : 0.55 + (edge / bevel) * 0.2);
      } else {
        col = scale(col, 1.08);
      }
      if (edge < 1.5) col = scale(col, 0.5);
    }
  }

  if (haunted) {
    // a mould that seeps down from under the rail
    const seep = smoothstep(0.55, 0.75, pfbm(u, v, 6, 2, 71) + (1 - v) * 0.25 - 0.15);
    if (py > 26) col = mixc(col, W.mould, seep * 0.55);
    col = scratches(col, px, py);
  }
  return [col[0], col[1], col[2], 1];
}

// claw marks: groups of four strokes, raw wood in the cut, a dark lip on either side
const CLAWS = [
  {x: 300, y: 70, len: 130, angle: 0.45},
  {x: 780, y: 120, len: 110, angle: -0.35},
];

/** @param {RGB} col @param {number} px @param {number} py @returns {RGB} */
function scratches(col, px, py) {
  for (const claw of CLAWS) {
    for (let i = 0; i < 4; i++) {
      const ox = claw.x + i * 13 - 20;
      const [lx, ly] = local(px, py, ox, claw.y + Math.abs(i - 1.5) * 6, claw.angle);
      if (ly < 0 || ly > claw.len) continue;
      const t = ly / claw.len;
      const bend = 6 * Math.sin(t * Math.PI);
      const width = 2.4 * Math.sin(t * Math.PI) ** 0.5;
      const dist = Math.abs(lx - bend);
      if (dist < width) col = mixc(W.raw, W.woodLight, dist / Math.max(width, 0.01));
      else if (dist < width + 1.6) col = scale(col, 0.55);
    }
  }
  return col;
}

// ---------------------------------------------------------------- the parts of an eye

/** A sclera (256²) and an iris (256²) side by side, 512 × 256, straight alpha. */
function eyeParts() {
  const w = 512;
  const h = 256;
  const data = new Uint8Array(w * h * 4);
  const scleraC = rgb('#ddd2b0');
  const scleraEdge = rgb('#6f5a4c');
  const veinC = rgb('#8a2440');
  const irisIn = rgb('#e3b23c');
  const irisOut = rgb('#6a5a14');
  const irisFleck = rgb('#9ec23a');
  const limbus = rgb('#1c1408');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      /** @type {RGB} */
      let c;
      let a = 1;
      if (x < 256) {
        // the sclera: a ball, lit from the top left, veined from its rim
        const nx = (x + 0.5 - 128) / 128;
        const ny = (y + 0.5 - 128) / 128;
        const r = Math.hypot(nx, ny);
        const ball = Math.sqrt(Math.max(0, 1 - Math.min(1, r) ** 2));
        const lit = sat(0.55 + 0.45 * (ball * 0.7 - nx * 0.25 - ny * 0.35));
        c = mixc(scleraEdge, scleraC, lit);
        const angle = Math.atan2(ny, nx);
        const veinField = pnoise((angle / (2 * Math.PI) + 0.5) * 48 + r * 6, r * 3, 48, 1e6, 81);
        const vein = smoothstep(0.035, 0.0, Math.abs(veinField - 0.5)) * smoothstep(0.35, 0.95, r);
        c = mixc(c, veinC, vein * 0.8);
      } else {
        // the iris: amber fibres round a slit pupil, a dark limbus, a wet highlight
        const nx = (x - 256 + 0.5 - 128) / 128;
        const ny = (y + 0.5 - 128) / 128;
        const r = Math.hypot(nx, ny);
        const angle = Math.atan2(ny, nx);
        const fibres = pnoise((angle / (2 * Math.PI) + 0.5) * 96, r * 4, 96, 1e6, 91);
        c = mixc(irisIn, irisOut, smoothstep(0.25, 0.92, r));
        c = scale(c, 0.7 + fibres * 0.6);
        c = mixc(
          c,
          irisFleck,
          smoothstep(0.6, 0.85, pnoise((angle / (2 * Math.PI) + 0.5) * 24, r * 2, 24, 1e6, 92)) * 0.5 * smoothstep(0.3, 0.6, r),
        );
        c = mixc(c, limbus, smoothstep(0.78, 0.92, r));
        // the pupil, a tall slit
        const pupil = sdEllipse(nx, ny, 0.16, 0.5);
        c = mixc(c, rgb('#030203'), sat(0.5 - pupil * 128));
        const hl = sdEllipse(nx + 0.32, ny + 0.38, 0.13, 0.09);
        c = mixc(c, rgb('#fff6e0'), sat(0.5 - hl * 128) * 0.85);
        a = sat((0.96 - r) * 128 + 0.5);
      }
      data[i] = Math.round(sat(c[0]) * 255);
      data[i + 1] = Math.round(sat(c[1]) * 255);
      data[i + 2] = Math.round(sat(c[2]) * 255);
      data[i + 3] = Math.round(a * 255);
      if (data[i + 3] === 0) data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
  return {width: w, height: h, data};
}

// ---------------------------------------------------------------- output

/**
 * @param {number} width @param {number} height
 * @param {(x: number, y: number) => [number, number, number, number]} shade
 */
function render(width, height, shade) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = shade(x, y);
      const i = (y * width + x) * 4;
      data[i] = Math.round(sat(c[0]) * 255);
      data[i + 1] = Math.round(sat(c[1]) * 255);
      data[i + 2] = Math.round(sat(c[2]) * 255);
      data[i + 3] = Math.round(sat(c[3]) * 255);
    }
  }
  return data;
}

/**
 * @param {Output} out @param {string} name
 * @param {Uint8Array} data @param {number} width @param {number} height
 * @param {boolean} withAlpha
 */
async function webp(out, name, data, width, height, withAlpha) {
  const image = sharp(Buffer.from(data.buffer, data.byteOffset, data.length), {raw: {width, height, channels: 4}});
  const encoded = await (withAlpha ? image : image.removeAlpha())
    .webp({quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true})
    .toBuffer();
  out.bytes(name, encoded);
}

/** @param {Output} out */
export async function generate(out) {
  const plain = render(TILE, TILE, (x, y) => shadeWallpaper((x + 0.5) / TILE, (y + 0.5) / TILE, false));
  const haunted = render(TILE, TILE, (x, y) => shadeWallpaper((x + 0.5) / TILE, (y + 0.5) / TILE, true));
  // the haunted tile must have holes, and the ordinary one none
  let holes = 0;
  for (let i = 3; i < haunted.length; i += 4) if (haunted[i] < 128) holes++;
  check(holes > TILE * TILE * 0.01, `${DIR}: the haunted wallpaper has eye holes`);
  await webp(out, `${DIR}/wallpaper-plain.webp`, plain, TILE, TILE, false);
  await webp(out, `${DIR}/wallpaper-haunted.webp`, haunted, TILE, TILE, true);

  const wainPlain = render(WAINSCOT_W, WAINSCOT_H, (x, y) => shadeWainscot(x, y, false));
  const wainHaunted = render(WAINSCOT_W, WAINSCOT_H, (x, y) => shadeWainscot(x, y, true));
  await webp(out, `${DIR}/wainscot-plain.webp`, wainPlain, WAINSCOT_W, WAINSCOT_H, false);
  await webp(out, `${DIR}/wainscot-haunted.webp`, wainHaunted, WAINSCOT_W, WAINSCOT_H, false);

  const parts = eyeParts();
  out.bytes(`${DIR}/eye-parts.png`, encodePng(parts.width, parts.height, parts.data));

  // every eye of one tile: its centre and the radii of its almond, in tile units (y down), so the
  // demo puts a sclera and an iris behind each hole
  /** @type {{x: number, y: number, rx: number, ry: number, kind: string}[]} */
  const eyes = [
    {x: 0.5, y: 0.5 + BIG_EYE.y, rx: BIG_EYE.rx, ry: BIG_EYE.ry, kind: 'big'},
    {x: 0.5 - SCROLL.x, y: 0.5 + SCROLL.y, rx: SCROLL_EYE.rx, ry: SCROLL_EYE.ry, kind: 'scroll'},
    {x: 0.5 + SCROLL.x, y: 0.5 + SCROLL.y, rx: SCROLL_EYE.rx, ry: SCROLL_EYE.ry, kind: 'scroll'},
    {x: 1 - FACE_EYE.x, y: 1 + FACE_EYE.y, rx: FACE_EYE.rx, ry: FACE_EYE.ry, kind: 'face'},
    {x: FACE_EYE.x, y: 1 + FACE_EYE.y, rx: FACE_EYE.rx, ry: FACE_EYE.ry, kind: 'face'},
  ];
  out.json(`${DIR}/eyes.json`, {
    tileSize: TILE,
    eyes: eyes.map((eye) => ({...eye, x: round(eye.x), y: round(eye.y), rx: round(eye.rx), ry: round(eye.ry)})),
    eyeParts: {sclera: [0, 0, 256, 256], iris: [256, 0, 256, 256], irisRadius: 0.96},
  });
}

/** @param {number} v */
const round = (v) => Math.round(v * 1e5) / 1e5;
