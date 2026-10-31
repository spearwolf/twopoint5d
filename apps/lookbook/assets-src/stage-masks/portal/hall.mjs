// stage-masks/portal: the hallway of the manor — a strip of its wall (skirting, wainscot, dado
// rail, flocked damask, cornice) that repeats along the hallway, a strip of its floor (oak boards
// and a worn runner) that repeats as well, two doors, and the gilt frame of the portrait whose
// canvas is the portal. Every image is unlit albedo but for the frame, whose relief is shaded by
// the picture lamp above it: the demo lights the rest per pixel by its sconces.
import {Rng} from '../../lib/image.mjs';
import {
  blurFilter,
  DOOR,
  el,
  FLOOR_PERIOD,
  FRAME,
  floatImage,
  HALL,
  lerp,
  n,
  overFloat,
  RUNNER,
  rasterize,
  sat,
  smoothstep,
  strokeText,
  svgDoc,
  TX,
  tileFbm,
  tileNoise,
  WALL,
  WALL_PERIOD,
} from './kit.mjs';

/** @typedef {[number, number, number]} RGB */

/** @param {string} h @returns {RGB} linear-ish 0..1 sRGB values, mixed as they are */
const hex = (h) => {
  const v = Number.parseInt(h.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};
/** @param {RGB} a @param {RGB} b @param {number} t @returns {RGB} */
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** @param {RGB} a @param {number} k @returns {RGB} */
const mulc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
/** @param {number} v */
const fract = (v) => v - Math.floor(v);

// ------------------------------------------------------------------------------------------ wall

const WALNUT_DARK = hex('#24150d');
const WALNUT_LIGHT = hex('#4d2f1b');
const PAPER_GROUND = hex('#3b2338');
const PLASTER = hex('#857b69');
const STAIN = hex('#4a3a22');

/**
 * Walnut: rings from a stretched noise, horizontal or vertical grain, repeating every
 * `WALL_PERIOD` units along x.
 * @param {number} x @param {number} y @param {boolean} horizontal @param {number} seed @returns {RGB}
 */
function walnut(x, y, horizontal, seed) {
  const g = horizontal
    ? tileFbm(x / 32, y / 1.6, seed, 4, WALL_PERIOD / 32, 0)
    : tileFbm(x / 1.6, y / 32, seed, 4, WALL_PERIOD / 1.6, 0);
  const rings = 0.5 + 0.5 * Math.sin(g * 34);
  const pores = tileNoise(
    horizontal ? x * 2 : x * 6,
    horizontal ? y * 6 : y * 2,
    seed + 7,
    horizontal ? WALL_PERIOD * 2 : WALL_PERIOD * 6,
    0,
  );
  return mulc(mixc(WALNUT_DARK, WALNUT_LIGHT, rings * 0.65 + g * 0.35), 0.85 + pores * 0.25);
}

/** The motif of the damask, one half (the other is its mirror), in units around its middle, y down. */
function damaskHalf() {
  return [
    // the vase: a pointed body narrowing to a stem
    'M0 -40 C9 -34 15 -20 11 -6 C8 4 5 16 3 26 L0 30 Z',
    // the leaves that curl out of the vase's shoulders
    'M7 -18 C17 -24 27 -20 28 -10 C29 -1 21 3 17 -2 C14 -6 18 -10 21 -8 C19 -14 12 -14 8 -10 Z',
    'M5 6 C14 4 24 10 24 19 C24 27 16 30 12 25 C9 21 13 17 16 19 C15 13 10 11 4 13 Z',
    // a lily on the top, three petals
    'M0 -40 C4 -46 10 -48 12 -54 C6 -52 3 -50 0 -48 Z',
    // the drops under the stem
    'M0 32 C3 36 4 40 0 44 Z',
    // a scroll that reaches into the next motif
    'M22 -32 C28 -38 34 -36 33 -30 C32 -26 27 -27 28 -30',
  ];
}

/** The damask as an SVG document of the wallpaper band, in pixels: a half-drop repeat, 64 × 96 units. */
function damaskSvg(/** @type {number} */ w, /** @type {number} */ h) {
  const T = TX.wall;
  const half = damaskHalf();
  const motif = (/** @type {number} */ cx, /** @type {number} */ cy) => {
    const tf = `translate(${n(cx * T)} ${n(cy * T)}) scale(${T * 0.74})`;
    const paths = half.map((d, i) =>
      el('path', {d, fill: i === 5 ? 'none' : 'url(#flock)', stroke: '#5c4250', 'stroke-width': 0.45}),
    );
    return el('g', {transform: tf}, [el('g', {}, paths), el('g', {transform: 'scale(-1 1)'}, paths)]);
  };
  const cells = [];
  // the band starts at the top of the paper; the repeat runs from there, across two repeats of x
  for (let ry = -1; ry <= Math.ceil(h / T / 96) + 1; ry++) {
    for (let rx = 0; rx <= 2; rx++) {
      cells.push(motif(rx * 64, ry * 96 + 30));
      cells.push(motif(rx * 64 + 32, ry * 96 + 78));
    }
  }
  // small diamonds between the motifs
  for (let ry = -1; ry <= Math.ceil(h / T / 96) + 1; ry++) {
    for (let rx = 0; rx <= 4; rx++) {
      const cx = rx * 32 + 16;
      const cy = ry * 48 + (rx % 2 ? 6 : 54);
      cells.push(
        el('path', {
          d: `M${n(cx * T)} ${n((cy - 4) * T)}L${n((cx + 2.5) * T)} ${n(cy * T)}L${n(cx * T)} ${n((cy + 4) * T)}L${n((cx - 2.5) * T)} ${n(cy * T)}Z`,
          fill: '#26131f',
          stroke: '#5c4250',
          'stroke-width': 1.6,
        }),
      );
    }
  }
  const defs = [
    el('linearGradient', {id: 'flock', x1: 0, y1: 0, x2: 0, y2: 1}, [
      el('stop', {offset: 0, 'stop-color': '#2a1525'}),
      el('stop', {offset: 1, 'stop-color': '#1a0c17'}),
    ]),
  ];
  return svgDoc(w, h, defs, [el('rect', {width: w, height: h, fill: '#000', 'fill-opacity': 0}), ...cells]);
}

/**
 * The wall: one strip of `WALL_PERIOD` × (ceiling − floor) units that repeats along the hallway.
 * Opaque albedo, the floor at the bottom of the image.
 */
export async function renderWall() {
  const T = TX.wall;
  const W = WALL_PERIOD * T;
  const H = (HALL.ceiling - HALL.floor) * T;
  const img = floatImage(W, H);
  const paperTop = Math.round((HALL.ceiling - WALL.cornice) * T);
  const paperH = Math.round((WALL.cornice - WALL.paper) * T);
  const damask = await rasterize(damaskSvg(W, paperH), W, paperH);

  /** @param {number} x @param {number} y @param {number} px @param {number} py @returns {RGB} */
  const wallColor = (x, y, px, py) => {
    /** @type {RGB} */
    let c;
    if (y >= WALL.cornice) {
      // the cornice: a bead, a cove, dentils, an ogee and the fascia under the ceiling
      const k = y - WALL.cornice;
      let shade;
      if (k < 4) shade = 0.85 + 0.35 * Math.sin((k / 4) * Math.PI);
      else if (k < 10) shade = lerp(0.55, 1.05, (k - 4) / 6);
      else if (k < 18) {
        const dentil = fract(x / 8) < 0.62;
        shade = dentil ? (k < 11 ? 0.6 : 1.0) : 0.38;
      } else if (k < 27) shade = 0.75 + 0.35 * Math.sin(((k - 18) / 9) * Math.PI * 1.4);
      else shade = lerp(0.8, 0.45, (k - 27) / 7);
      const grime = tileFbm(x / 10, y / 6, 31, 4, WALL_PERIOD / 10, 0);
      c = mulc(mixc(PLASTER, STAIN, 0.25 + grime * 0.35), shade * (0.82 + grime * 0.25));
    } else if (y >= WALL.paper) {
      // the paper: damask flock on a ground with a faint sheen, seams every 64 units, stains
      const i = ((py - paperTop) * W + px) * 4;
      const a = damask[i + 3] / 255;
      const flock = [damask[i] / 255, damask[i + 1] / 255, damask[i + 2] / 255];
      const sheen = tileFbm(x / 16, y / 16, 41, 3, WALL_PERIOD / 16, 0);
      const ground = mulc(PAPER_GROUND, 0.85 + sheen * 0.3);
      c = /** @type {RGB} */ (a > 0 ? mixc(ground, /** @type {RGB} */ (flock), a) : ground);
      // a seam where two lengths of paper meet: a dark gap and the lifted, lighter edge beside it
      const seam = Math.min(fract(x / 64), 1 - fract(x / 64)) * 64;
      if (seam < 0.35) c = mulc(c, 0.45);
      else if (seam < 1.2 && fract(x / 64) < 0.5) c = mulc(c, 1.25);
      // the water came through the cornice: a stain that runs down, ringed by tide lines
      const s = tileFbm(x / 24, y / 30, 51, 5, WALL_PERIOD / 24, 0) + (y - 120) / 140;
      const stain = smoothstep(0.55, 0.75, s);
      c = mixc(c, mulc(STAIN, 0.7 + sheen * 0.3), stain * 0.55);
      const tide = Math.exp(-(((s - 0.75) / 0.018) ** 2));
      c = mixc(c, mulc(STAIN, 0.45), tide * 0.6);
      // mould, in colonies, near the rail
      const mould = tileFbm(x / 6, y / 6, 61, 4, WALL_PERIOD / 6, 0) - (y + 56) / 90;
      c = mulc(c, 1 - smoothstep(0.42, 0.6, mould) * 0.55);
    } else if (y >= WALL.rail) {
      // the dado rail: a rounded moulding, lit from above
      const k = (y - WALL.rail) / (WALL.paper - WALL.rail);
      const shade =
        k < 0.12
          ? 0.35
          : k < 0.5
            ? 0.6 + 0.5 * Math.sin(((k - 0.12) / 0.38) * Math.PI)
            : k < 0.58
              ? 0.45
              : 0.75 + 0.5 * Math.sin(((k - 0.58) / 0.42) * Math.PI);
      c = mulc(walnut(x, y, true, 71), shade);
    } else if (y >= WALL.skirting) {
      c = wainscot(x, y);
    } else {
      // the skirting: a bead on top, a face scuffed by shoes
      const k = (y - HALL.floor) / (WALL.skirting - HALL.floor);
      const shade = k > 0.85 ? 1.15 : k > 0.75 ? 0.55 : 0.8;
      const scuff = tileFbm(x / 3, y / 2, 81, 3, WALL_PERIOD / 3, 0);
      c = mulc(walnut(x, y, true, 83), shade * (0.85 + (scuff > 0.62 ? 0.35 : 0)));
    }
    return c;
  };
  supersample(img, W, H, (px, py, sx, sy) => wallColor((px + sx) / T, HALL.ceiling - (py + sy) / T, px, Math.min(H - 1, py)));
  return {img, w: W, h: H};
}

/**
 * Fills an opaque float image from a colour function, 2 × 2 samples per texel: the hard edges of
 * the patterns come out anti-aliased.
 * @param {Float32Array} img @param {number} W @param {number} H
 * @param {(px: number, py: number, sx: number, sy: number) => RGB} color sx, sy within the texel
 */
function supersample(img, W, H, color) {
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const [sx, sy] of SAMPLES) {
        const c = color(px, py, sx, sy);
        r += c[0];
        g += c[1];
        b += c[2];
      }
      const o = (py * W + px) * 4;
      img[o] = r / 4;
      img[o + 1] = g / 4;
      img[o + 2] = b / 4;
      img[o + 3] = 1;
    }
  }
}
const SAMPLES = [
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
];

/** One raised panel per repeat: stiles, rails, a bevel lit from above, a groove round the field. */
function wainscot(/** @type {number} */ x, /** @type {number} */ y) {
  const bottom = WALL.skirting;
  const top = WALL.rail;
  const inStile = x < 10 || x > WALL_PERIOD - 10;
  const inRail = y < bottom + 12 || y > top - 14;
  if (inStile || inRail) {
    const c = walnut(x, y, !inStile, 91);
    // the inner edge of the frame casts a thin shadow on the panel below it
    return mulc(c, inRail && y > top - 14 && y < top - 12.5 && !inStile ? 0.6 : 1);
  }
  // the panel: field inset by the bevel
  const dx = Math.min(x - 10, WALL_PERIOD - 10 - x);
  const dy = Math.min(y - (bottom + 12), top - 14 - y);
  const d = Math.min(dx, dy);
  let shade = 1;
  if (d < 1) shade = 0.35;
  else if (d < 9) {
    // which bevel: the one whose edge is nearest
    if (dy < dx) shade = y > (bottom + top) / 2 ? 1.3 : 0.55;
    else shade = x < WALL_PERIOD / 2 ? 0.95 : 0.75;
  }
  return mulc(walnut(x, y, d >= 9, 93), shade);
}

// ----------------------------------------------------------------------------------------- floor

const OAK_DARK = hex('#1f140c');
const OAK_LIGHT = hex('#46301d');
const RUNNER_FIELD = hex('#56121a');
const RUNNER_NAVY = hex('#161a30');
const RUNNER_OCHRE = hex('#83602a');
const RUNNER_BLACK = hex('#120d10');

/**
 * The floor: the width of the hallway across, `FLOOR_PERIOD` units along it, repeating. Oak boards
 * along the hallway, a runner in the middle — a black and ochre key border, an oxblood field with a
 * navy medallion every 128 units — worn pale where people walked.
 */
export function renderFloor() {
  const T = TX.floor;
  const W = HALL.halfWidth * 2 * T;
  const H = FLOOR_PERIOD * T;
  const img = floatImage(W, H);
  const P = FLOOR_PERIOD;
  /** @param {number} x @param {number} z @returns {RGB} */
  const floorColor = (x, z) => {
    const ax = Math.abs(x);
    /** @type {RGB} */
    let c;
    if (ax <= RUNNER) {
      const e = RUNNER - ax;
      const pile = tileNoise(x * 2.2, z * 2.2, 11, 0, P * 2.2);
      if (e < 2) c = mulc(RUNNER_BLACK, 0.8 + pile * 0.3);
      else if (e < 7) c = RUNNER_NAVY;
      else if (e < 15) {
        // a running key of dark red on ochre
        const b = (e - 7) / 8;
        const zig = Math.abs(fract(z / 10) - 0.5) * 2;
        c = Math.abs(b - zig) < 0.2 ? RUNNER_FIELD : RUNNER_OCHRE;
      } else if (e < 18) c = RUNNER_BLACK;
      else {
        c = RUNNER_FIELD;
        // a medallion every 128 units: a navy lozenge, an ochre outline, a rosette
        const dz = (((z % 128) + 128) % 128) - 64;
        const loz = ax / 46 + Math.abs(dz) / 58;
        if (loz < 1) {
          c = RUNNER_NAVY;
          if (loz > 0.86 && loz < 0.93) c = RUNNER_OCHRE;
          const r = Math.hypot(x, dz);
          const petals = 0.5 + 0.5 * Math.cos(Math.atan2(dz, x) * 8);
          if (r < 12 + petals * 7) c = mixc(RUNNER_FIELD, RUNNER_OCHRE, r < 5 ? 0.9 : 0.15);
        } else {
          // small crosses on a grid between the medallions
          const gz = (((z + 32) % 64) + 64) % 64;
          const gx = ax - 52;
          if (Math.abs(gx) < 1.2 + (Math.abs(gz - 32) < 6 ? 2 : 0) && Math.abs(gz - 32) < 7) c = RUNNER_OCHRE;
          if (Math.abs(gz - 32) < 1.2 && Math.abs(gx) < 7) c = RUNNER_OCHRE;
        }
      }
      // the pile, and the path worn into the middle: paler, greyer, threadbare
      const wearNoise = tileFbm(x / 14, z / 16, 21, 4, 0, P / 16);
      const worn = (1 - smoothstep(12, 62, ax)) * (0.35 + wearNoise * 0.65);
      const grey = (c[0] + c[1] + c[2]) / 3;
      c = mixc(c, [grey * 1.25 + 0.04, grey * 1.1 + 0.03, grey + 0.03], worn * 0.55);
      c = mulc(c, 0.82 + pile * 0.3 - (e < 18 ? 0 : 0.06 * (1 - smoothstep(0, 30, e - 18))));
    } else {
      // the boards: 14 units wide, a butt joint somewhere in each, grain along the hallway
      const bx = (x + HALL.halfWidth) / 14;
      const board = Math.floor(bx);
      const inBoard = fract(bx) * 14;
      const joint = tileNoise(board * 7.3, 3, 5) * P;
      const dj = Math.abs(((z - joint + P * 1.5) % P) - P / 2);
      const grain = tileFbm(x / 1.4, z / 32, 31 + board, 4, 0, P / 32);
      const tone = 0.75 + tileNoise(board * 3.1, 9, 6) * 0.5;
      c = mulc(mixc(OAK_DARK, OAK_LIGHT, 0.5 + 0.5 * Math.sin(grain * 26)), tone);
      if (inBoard < 0.5 || inBoard > 13.6 || dj > P / 2 - 0.45) c = mulc(c, 0.3);
      // dust against the skirting, and the shadow of the runner's edge
      const dust = smoothstep(150, 178, ax) * (0.4 + 0.6 * tileFbm(x / 5, z / 5, 41, 3, 0, P / 5));
      c = mixc(c, hex('#3a3632'), dust * 0.5);
      c = mulc(c, 1 - (1 - smoothstep(RUNNER, RUNNER + 5, ax)) * 0.55);
    }
    return c;
  };
  supersample(img, W, H, (px, py, sx, sy) => floorColor((px + sx) / T - HALL.halfWidth, (py + sy) / T));
  return {img, w: W, h: H};
}

// ----------------------------------------------------------------------------------------- doors

/**
 * A door with its architrave, `DOOR.w` × `DOOR.h` units, standing on the bottom edge: a six-panel
 * mahogany slab, a brass knob and escutcheon, a brass number. `scratched`: three groups of scratches
 * low on the slab, pale where the wood shows — from the inside.
 * @param {string} number @param {boolean} scratched @param {Rng} rng
 */
async function renderDoor(number, scratched, rng) {
  const T = TX.door;
  const W = DOOR.w * T;
  const H = DOOR.h * T;
  const u = (/** @type {number} */ v) => v * T;
  // in units, x from the left edge, y from the floor up; the image has y down
  const Y = (/** @type {number} */ y) => u(DOOR.h - y);
  const slab = {l: 18, r: DOOR.w - 18, top: 262};
  const body = [];
  // the architrave and its head, with a profile: an outer bead, a flat, an inner step
  const archGrad = el('linearGradient', {id: 'arch', x1: 0, y1: 0, x2: 1, y2: 0}, [
    el('stop', {offset: 0, 'stop-color': '#1a0f09'}),
    el('stop', {offset: 0.18, 'stop-color': '#4c2e1b'}),
    el('stop', {offset: 0.3, 'stop-color': '#2d1a0f'}),
    el('stop', {offset: 0.62, 'stop-color': '#3c2415'}),
    el('stop', {offset: 0.82, 'stop-color': '#5a3721'}),
    el('stop', {offset: 1, 'stop-color': '#160c07'}),
  ]);
  const headGrad = el('linearGradient', {id: 'head', x1: 0, y1: 0, x2: 0, y2: 1}, [
    el('stop', {offset: 0, 'stop-color': '#6a4428'}),
    el('stop', {offset: 0.2, 'stop-color': '#2a180d'}),
    el('stop', {offset: 0.45, 'stop-color': '#4c2e1b'}),
    el('stop', {offset: 0.75, 'stop-color': '#2d1a0f'}),
    el('stop', {offset: 1, 'stop-color': '#5a3721'}),
  ]);
  body.push(el('rect', {x: 0, y: Y(slab.top + 10), width: u(slab.l), height: u(slab.top + 10), fill: 'url(#arch)'}));
  body.push(
    el('rect', {
      x: u(slab.r),
      y: Y(slab.top + 10),
      width: u(DOOR.w - slab.r),
      height: u(slab.top + 10),
      fill: 'url(#arch)',
      transform: `translate(${u(DOOR.w + slab.r)} 0) scale(-1 1)`,
    }),
  );
  body.push(el('rect', {x: u(-2), y: 0, width: u(DOOR.w + 4), height: u(DOOR.h - slab.top - 10), fill: 'url(#head)'}));
  body.push(el('rect', {x: 0, y: u(DOOR.h - slab.top - 10) - u(3), width: u(DOOR.w), height: u(3), fill: '#120a06'}));
  // the jamb, seen in the gap between the slab and the head
  body.push(el('rect', {x: u(slab.l), y: Y(slab.top + 10), width: u(slab.r - slab.l), height: u(10), fill: '#140b07'}));
  // the slab
  body.push(el('rect', {x: u(slab.l), y: Y(slab.top), width: u(slab.r - slab.l), height: u(slab.top), fill: '#33170f'}));
  body.push(
    el('rect', {
      x: u(slab.l),
      y: Y(slab.top),
      width: u(slab.r - slab.l),
      height: u(slab.top),
      fill: 'none',
      stroke: '#0e0604',
      'stroke-width': u(1.2),
    }),
  );
  // six raised panels: two columns, three rows
  const cols = [
    [slab.l + 10, (slab.l + slab.r) / 2 - 5],
    [(slab.l + slab.r) / 2 + 5, slab.r - 10],
  ];
  const rows = [
    [14, 92],
    [104, 190],
    [214, slab.top - 12],
  ];
  for (const [l, r] of cols) {
    for (const [b, t] of rows) {
      const bev = 6;
      const pts = (/** @type {number[][]} */ p) => p.map(([px, py]) => `${n(u(px))} ${n(Y(py))}`).join('L');
      body.push(el('rect', {x: u(l), y: Y(t), width: u(r - l), height: u(t - b), fill: '#0f0705'}));
      body.push(
        el('path', {
          d: `M${pts([
            [l, t],
            [r, t],
            [r - bev, t - bev],
            [l + bev, t - bev],
          ])}Z`,
          fill: '#5a2f1d',
        }),
      );
      body.push(
        el('path', {
          d: `M${pts([
            [l, b],
            [r, b],
            [r - bev, b + bev],
            [l + bev, b + bev],
          ])}Z`,
          fill: '#1c0c07',
        }),
      );
      body.push(
        el('path', {
          d: `M${pts([
            [l, b],
            [l, t],
            [l + bev, t - bev],
            [l + bev, b + bev],
          ])}Z`,
          fill: '#46241a',
        }),
      );
      body.push(
        el('path', {
          d: `M${pts([
            [r, b],
            [r, t],
            [r - bev, t - bev],
            [r - bev, b + bev],
          ])}Z`,
          fill: '#2a130c',
        }),
      );
      body.push(
        el('rect', {x: u(l + bev), y: Y(t - bev), width: u(r - l - 2 * bev), height: u(t - b - 2 * bev), fill: '#3a1a11'}),
      );
    }
  }
  // brass: the escutcheon, the knob, the keyhole, the number
  const brass = el('radialGradient', {id: 'brass', cx: 0.38, cy: 0.32, r: 0.75}, [
    el('stop', {offset: 0, 'stop-color': '#f2d48a'}),
    el('stop', {offset: 0.35, 'stop-color': '#a7782f'}),
    el('stop', {offset: 0.8, 'stop-color': '#4a3010'}),
    el('stop', {offset: 1, 'stop-color': '#21150a'}),
  ]);
  const kx = slab.r - 12;
  body.push(el('rect', {x: u(kx - 4.5), y: Y(140), width: u(9), height: u(34), rx: u(4), fill: 'url(#brass)'}));
  body.push(el('circle', {cx: u(kx + 1), cy: Y(130 - 1), r: u(6.5), fill: '#000', 'fill-opacity': 0.5, filter: 'url(#b6)'}));
  body.push(el('circle', {cx: u(kx), cy: Y(130), r: u(6), fill: 'url(#brass)'}));
  body.push(
    el('path', {
      d: `M${n(u(kx))} ${n(Y(117))}m-${u(1.4)} 0a${u(1.4)} ${u(1.4)} 0 1 1 ${u(2.8)} 0l${u(0.6)} ${u(4)}h-${u(4)}z`,
      fill: '#050302',
    }),
  );
  const plateW = 10 + number.length * 7;
  const cx = (slab.l + slab.r) / 2;
  body.push(el('rect', {x: u(cx - plateW / 2), y: Y(209), width: u(plateW), height: u(14), rx: u(2), fill: 'url(#brass)'}));
  body.push(
    el('path', {
      d: strokeText(number, u(cx - plateW / 2 + 5), Y(206.5), u(9), {spacing: 0.55}),
      fill: 'none',
      stroke: '#1c1006',
      'stroke-width': u(1.3),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  if (scratched) {
    for (let g = 0; g < 3; g++) {
      const gx = slab.l + 14 + rng.range(0, slab.r - slab.l - 34);
      const gy = 18 + rng.range(0, 60);
      const ang = rng.range(-0.5, 0.5);
      for (let k = 0; k < 4; k++) {
        const x0 = gx + k * 2.6;
        const len = rng.range(16, 34);
        const d = `M${n(u(x0))} ${n(Y(gy))}q${n(u(Math.sin(ang) * len * 0.5 + 1.5))} ${n(-u(len * 0.5))} ${n(u(Math.sin(ang) * len))} ${n(-u(len))}`;
        body.push(
          el('path', {d, fill: 'none', stroke: '#9a7050', 'stroke-width': u(0.6), 'stroke-linecap': 'round', opacity: 0.7}),
        );
        body.push(
          el('path', {
            d,
            fill: 'none',
            stroke: '#140906',
            'stroke-width': u(0.35),
            'stroke-linecap': 'round',
            transform: `translate(${u(0.5)} 0)`,
          }),
        );
      }
    }
  }
  const defs = [archGrad, headGrad, brass, blurFilter('b6', 6)];
  const raster = await rasterize(svgDoc(W, H, defs, body), W, H);
  // the grain and the grime over everything wooden: a multiply from a stretched noise
  const img = floatImage(W, H);
  overFloat(img, raster);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const o = (py * W + px) * 4;
      const x = px / T;
      const y = DOOR.h - py / T;
      const vertical = x < slab.l || x > slab.r || y < slab.top;
      const g = vertical ? tileFbm(x / 1.2, y / 28, 101, 4) : tileFbm(x / 28, y / 1.2, 103, 4);
      const grime = tileFbm(x / 20, y / 20, 107, 3);
      const k = (0.82 + 0.3 * (0.5 + 0.5 * Math.sin(g * 30))) * (0.8 + 0.25 * grime) * (1 - (1 - smoothstep(0, 40, y)) * 0.25);
      img[o] *= k;
      img[o + 1] *= k;
      img[o + 2] *= k;
    }
  }
  return {img, w: W, h: H};
}

/** The two doors, side by side in one image with 8 px between them: "13" and "17", the second scratched. */
export async function renderDoors() {
  const rng = new Rng(1313);
  const a = await renderDoor('13', false, rng);
  const b = await renderDoor('17', true, rng);
  const gap = 8;
  const W = a.w + gap + b.w;
  const H = a.h;
  const img = floatImage(W, H);
  for (let y = 0; y < H; y++) {
    img.set(a.img.subarray(y * a.w * 4, (y + 1) * a.w * 4), y * W * 4);
    img.set(b.img.subarray(y * b.w * 4, (y + 1) * b.w * 4), (y * W + a.w + gap) * 4);
  }
  return {img, w: W, h: H, frames: {'door-13': {x: 0, y: 0, w: a.w, h: a.h}, 'door-17': {x: a.w + gap, y: 0, w: b.w, h: b.h}}};
}

// ----------------------------------------------------------------------------------------- frame

/** The signed distance to the oval of the canvas, in units: negative inside (an approximation that is exact on the oval). */
export function ovalDistance(/** @type {number} */ x, /** @type {number} */ y) {
  const k1 = Math.hypot(x / FRAME.rx, y / FRAME.ry);
  const k2 = Math.hypot(x / (FRAME.rx * FRAME.rx), y / (FRAME.ry * FRAME.ry));
  return k2 === 0 ? -Math.min(FRAME.rx, FRAME.ry) : (k1 * (k1 - 1)) / k2;
}

/**
 * The height of the carved moulding (0 … ~1.1) at `t` (0 at the outer edge, 1 at the inner) and `s`,
 * the position along its bar in units: an outer roll, a torus of acanthus, a cove, egg and dart, an
 * ogee and an inner bead.
 */
function mouldingHeight(/** @type {number} */ t, /** @type {number} */ s) {
  if (t < 0.06) return 0.62 * Math.sin((t / 0.06) * (Math.PI / 2));
  if (t < 0.32) {
    const k = (t - 0.06) / 0.26;
    const roll = Math.sin(k * Math.PI);
    // acanthus: a lobe every 14 units, its veins running across the roll at a slant
    const q = fract((s + k * 6) / 14);
    const lobe = Math.sin(q * Math.PI) ** 0.7;
    const vein = Math.abs(fract((s - k * 9) / 3.5) - 0.5) < 0.08 ? -0.06 : 0;
    return 0.62 + 0.42 * roll + 0.2 * (lobe - 0.6) * roll + vein * roll;
  }
  if (t < 0.44) return 0.6 - 0.32 * Math.sin(((t - 0.32) / 0.12) * Math.PI);
  if (t < 0.6) {
    const q = fract(s / 8);
    const ex = (q - 0.5) / 0.36;
    const ey = (t - 0.52) / 0.07;
    const r2 = ex * ex + ey * ey;
    const egg = r2 < 1 ? 0.3 * Math.sqrt(1 - r2) : 0;
    const dart = Math.max(0, 1 - Math.abs(Math.min(q, 1 - q)) / 0.05) * 0.22 * Math.sin(((t - 0.44) / 0.16) * Math.PI);
    return 0.5 + egg + dart;
  }
  if (t < 0.82) {
    const k = (t - 0.6) / 0.22;
    return 0.56 - 0.38 * (k * k * (3 - 2 * k)) + 0.08 * Math.sin(k * Math.PI * 2);
  }
  return 0.14 + 0.2 * Math.sin(((t - 0.82) / 0.18) * Math.PI);
}

const GOLD = hex('#a8782c');
const GOLD_SPEC = hex('#ffe2a0');
const BOLE = hex('#5c1f10');
const GRIME = hex('#1c120a');
const GESSO = hex('#c8bea6');

/**
 * The gilt frame of the portrait: `2 hw` × `2 hh` units, a carved moulding round a gilt spandrel and
 * the oval sight of the canvas, which is clear — the portal shows through it. Shaded from its own
 * relief by the picture lamp above it, with grime in the hollows, red bole where the gilding wore
 * off the high points and a few chips down to the gesso.
 */
export function renderFrame() {
  const T = TX.frame;
  const W = FRAME.hw * 2 * T;
  const H = FRAME.hh * 2 * T;
  const M = FRAME.moulding;
  const height = new Float32Array(W * H);
  const kind = new Uint8Array(W * H); // 0 moulding, 1 spandrel, 2 sight
  const coverage = new Float32Array(W * H);
  for (let py = 0; py < H; py++) {
    const y = FRAME.hh - (py + 0.5) / T;
    for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / T - FRAME.hw;
      const i = py * W + px;
      const sideD = FRAME.hw - Math.abs(x);
      const topD = FRAME.hh - Math.abs(y);
      const dOut = Math.min(sideD, topD);
      const dO = ovalDistance(x, y);
      coverage[i] = sat(dO * T + 0.5);
      if (dOut < M) {
        const along = sideD < topD ? y : x;
        height[i] = mouldingHeight(dOut / M, along);
        kind[i] = 0;
      } else if (dO > 0) {
        // the spandrel: flat, hammered, rising to a bead at the sight, a fillet before it
        const bead = dO < 5 ? 0.24 * Math.sin((dO / 5) * Math.PI) : 0;
        const fillet = dO > 6 && dO < 8 ? -0.03 : 0;
        height[i] = 0.12 + bead + fillet + (tileNoise(x * 1.3, y * 1.3, 201) - 0.5) * 0.012;
        kind[i] = 1;
      } else {
        height[i] = 0;
        kind[i] = 2;
      }
    }
  }
  const img = floatImage(W, H);
  const HS = 9; // units of relief per unit of height
  const L = (() => {
    const v = [0.12, 0.72, 0.68];
    const l = Math.hypot(...v);
    return v.map((c) => c / l);
  })();
  const Hv = (() => {
    const v = [L[0], L[1], L[2] + 1];
    const l = Math.hypot(...v);
    return v.map((c) => c / l);
  })();
  const at = (/** @type {number} */ px, /** @type {number} */ py) =>
    height[Math.min(H - 1, Math.max(0, py)) * W + Math.min(W - 1, Math.max(0, px))];
  const rng = new Rng(4242);
  const chips = Array.from({length: 46}, () => ({
    x: rng.range(-FRAME.hw, FRAME.hw),
    y: rng.range(-FRAME.hh, FRAME.hh),
    r: rng.range(0.6, 2.4),
  }));
  for (let py = 0; py < H; py++) {
    const y = FRAME.hh - (py + 0.5) / T;
    for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / T - FRAME.hw;
      const i = py * W + px;
      const o = i * 4;
      if (coverage[i] <= 0) continue;
      const dhdx = ((at(px + 1, py) - at(px - 1, py)) * HS * T) / 2;
      const dhdy = (-(at(px, py + 1) - at(px, py - 1)) * HS * T) / 2;
      const nl = Math.hypot(dhdx, dhdy, 1);
      const N = [-dhdx / nl, -dhdy / nl, 1 / nl];
      const diff = Math.max(0, N[0] * L[0] + N[1] * L[1] + N[2] * L[2]);
      const spec = Math.max(0, N[0] * Hv[0] + N[1] * Hv[1] + N[2] * Hv[2]) ** 36;
      // the curvature: hollows hold grime, the high points lose their gold
      const lap = (at(px + 2, py) + at(px - 2, py) + at(px, py + 2) + at(px, py - 2) - 4 * at(px, py)) * HS;
      const patina = tileFbm(x / 22, y / 22, 211, 4);
      const fine = tileNoise(x * 2.5, y * 2.5, 213);
      let base = mulc(GOLD, 0.75 + patina * 0.45);
      if (kind[i] === 1) base = mulc(base, 0.8);
      const wear = sat(-lap * 0.9 - 0.15) * smoothstep(0.45, 0.7, patina + fine * 0.3);
      base = mixc(base, BOLE, wear * 0.8);
      /** @type {RGB} */
      let c = [
        base[0] * (0.16 + 0.95 * diff) + GOLD_SPEC[0] * spec * 0.9 * (1 - wear),
        base[1] * (0.16 + 0.95 * diff) + GOLD_SPEC[1] * spec * 0.9 * (1 - wear),
        base[2] * (0.16 + 0.95 * diff) + GOLD_SPEC[2] * spec * 0.9 * (1 - wear),
      ];
      const hollow = sat(lap * 1.2 - 0.05);
      c = mixc(c, GRIME, Math.min(0.85, hollow * 0.9 + (1 - patina) * 0.2));
      for (const chip of chips) {
        const d = Math.hypot(x - chip.x, y - chip.y);
        if (d < chip.r && kind[i] === 0) c = mixc(c, mulc(GESSO, 0.35 + diff * 0.6), sat((chip.r - d) * T * 0.5));
      }
      // the lamp is above: the lower bar lies a little in its own shadow
      c = mulc(c, 0.75 + 0.25 * smoothstep(-FRAME.hh, FRAME.hh * 0.6, y));
      img[o] = c[0];
      img[o + 1] = c[1];
      img[o + 2] = c[2];
      img[o + 3] = coverage[i];
    }
  }
  return {img, w: W, h: H};
}

export {HALL};
