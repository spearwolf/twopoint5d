// stage-masks/flashlight: the back layer of "The Crawlspace", z = −400 — the brick foundation wall
// of the house with its vent, the dirt in front of it, the sill plate, the ends of the joists and
// the underside of the floor above. Bricks, mortar, damp, efflorescence, wood and dirt are worked out
// per pixel; the vent, its grate, cracks, a rust stain and cobwebs are SVG.
import {fbm, Rng} from '../../lib/image.mjs';
import {blurFilter, dirt, el, hash, hexRgb, Layer, mix3, n, poly, wood} from './kit.mjs';
import {FLOOR_Y, LAYERS, VENT} from './layout.mjs';

const SILL = 175;
const JOIST_BOTTOM = 200;
const JOIST_TOP = 290;
const JOIST_STEP = 110;
const JOIST_W = 16;
const BRICK_W = 22;
const BRICK_H = 8;
const MORTAR = 1.3;

/** where the dirt meets the wall, a little uneven @param {number} u */
const floorEdge = (u) => FLOOR_Y + 6 * Math.sin(u * 0.011) + 9 * (fbm(u / 70, 0.5, 31, 3) - 0.5);

/** @param {number} u @param {number} v @returns {[number, number, number, number]} */
function shadeWall(u, v) {
  const edge = floorEdge(u);
  if (v < edge) {
    const c = dirt(u, v, 11, 0.55);
    // the foot of the wall is in shadow, and damp
    const k = 0.7 + 0.3 * Math.min(1, (edge - v) / 40);
    return [c[0] * k, c[1] * k, c[2] * k, 1];
  }
  if (v < SILL) {
    // the courses, every other one shifted by half a brick
    const row = Math.floor((v - FLOOR_Y) / BRICK_H);
    const fy = (v - FLOOR_Y) / BRICK_H - row;
    const shift = row % 2 === 0 ? 0 : BRICK_W / 2;
    const col = Math.floor((u + shift) / BRICK_W);
    const fx = (u + shift) / BRICK_W - col;
    const mx = Math.min(fx, 1 - fx) * BRICK_W;
    const my = Math.min(fy, 1 - fy) * BRICK_H;
    const h = hash(col, row, 5);
    const wobble = 0.35 * (fbm(u / 3, v / 3, 17, 2) - 0.5);
    const inMortar = Math.min(mx, my) < MORTAR * (1 + wobble);
    const up = v - edge;
    const damp = Math.max(0, 1 - up / 90) * (0.6 + 0.4 * fbm(u / 50, v / 20, 23, 3));
    const bloom = Math.max(0, fbm(u / 36, v / 14, 29, 4) - 0.48) * 2.2 * Math.max(0, 1 - up / 140);
    // patches of grey parging over the brick
    const parge = fbm(u / 120, v / 60, 37, 4) > 0.71;
    /** @type {[number, number, number]} */
    let c;
    if (parge) {
      c = mix3(hexRgb('#5f5d58'), hexRgb('#7e7a72'), fbm(u / 6, v / 6, 41, 3));
    } else if (inMortar) {
      c = mix3(hexRgb('#5a554c'), hexRgb('#79736a'), fbm(u / 2, v / 2, 43, 2));
    } else {
      const tone = mix3(hexRgb('#5c3024'), hexRgb('#82503e'), h);
      c = mix3(tone, hexRgb('#3a1d16'), hash(col, row, 7) > 0.88 ? 0.6 : 0);
      // the face of a brick is pitted and its top edge catches more
      c = mix3(c, hexRgb('#2c1712'), Math.max(0, fbm(u / 1.8, v / 1.8, 47, 2) - 0.62) * 2);
      if (fy > 0.75) c = mix3(c, hexRgb('#a86a50'), 0.18);
    }
    c = mix3(c, hexRgb('#cfcabb'), Math.min(0.75, bloom));
    c = mix3(c, hexRgb('#1d1714'), damp * 0.55);
    // the sill throws a shadow down the top of the wall
    const shade = 0.62 + 0.38 * Math.min(1, (SILL - v) / 60);
    return [c[0] * shade, c[1] * shade, c[2] * shade, 1];
  }
  if (v < JOIST_BOTTOM) {
    const c = wood(u, v, 53);
    const k = v > JOIST_BOTTOM - 3 ? 0.55 : 1;
    return [c[0] * k, c[1] * k, c[2] * k, 1];
  }
  if (v < JOIST_TOP) {
    const k = Math.floor((u + JOIST_STEP / 2) / JOIST_STEP);
    const fx = u + JOIST_STEP / 2 - k * JOIST_STEP;
    if (fx < JOIST_W) {
      // the end of a joist: rings around a heart that lies below the board
      const rx = fx - JOIST_W * (0.3 + 0.4 * hash(k, 0, 59));
      const ry = v - JOIST_BOTTOM + 30;
      const rings = 0.5 + 0.5 * Math.sin(Math.hypot(rx, ry) * 1.9 + fbm(u / 3, v / 3, 61, 2) * 3);
      const c = mix3(hexRgb('#5c4330'), hexRgb('#8a6a4a'), 0.3 + 0.5 * rings);
      const s = fx < 1.2 || fx > JOIST_W - 1.2 ? 0.6 : 1;
      return [c[0] * s, c[1] * s, c[2] * s, 1];
    }
    // the deep, dark bay between two joists, a little lighter at its mouth
    const g = 0.4 + 0.6 * Math.max(0, 1 - (v - JOIST_BOTTOM) / 90);
    const c = mix3(hexRgb('#0f0b08'), hexRgb('#2a2018'), g * 0.6);
    return [c[0], c[1], c[2], 1];
  }
  // the underside of the floor: boards along x, a dark seam every 18 units
  const seam = (v - JOIST_TOP) % 18;
  const c = wood(u * 0.8, v, 67);
  const k = (seam < 1.4 ? 0.35 : 0.72) * Math.max(0.35, 1 - (v - JOIST_TOP) / 400);
  return [c[0] * k, c[1] * k, c[2] * k, 1];
}

/** The vent: its frame, the night outside, the cast-iron grate, the rust it weeps down the wall. */
function vent() {
  const {x, y, hw, hh} = VENT;
  const out = [];
  // rust weeping from the sill of the vent
  out.push(
    el('path', {
      d: `M${n(x - hw + 8)} ${n(y - hh)} C${n(x - hw + 4)} ${n(y - hh - 60)} ${n(x - 10)} ${n(y - hh - 110)} ${n(x - 18)} ${n(y - hh - 170)} L${n(x + 8)} ${n(y - hh - 150)} C${n(x + 10)} ${n(y - hh - 90)} ${n(x + hw - 6)} ${n(y - hh - 40)} ${n(x + hw - 10)} ${n(y - hh)} Z`,
      fill: '#4a2a14',
      opacity: 0.55,
      filter: 'url(#b3)',
    }),
  );
  // the opening: grass and the pale night beyond
  out.push(el('rect', {x: x - hw, y: y - hh, width: hw * 2, height: hh * 2, fill: '#8fa4b0'}));
  out.push(el('rect', {x: x - hw, y: y - hh, width: hw * 2, height: hh * 0.9, fill: '#4b5e52'}));
  const rng = new Rng(71);
  let grass = '';
  for (let i = 0; i < 70; i++) {
    const gx = x - hw + rng.range(0, hw * 2);
    const gh = rng.range(6, 22);
    grass += `M${n(gx)} ${n(y - hh * 0.2)}l${n(rng.range(-3, 3))} ${n(gh)}`;
  }
  out.push(el('path', {d: grass, stroke: '#2b3a31', 'stroke-width': 1.4, fill: 'none'}));
  // the frame and the bars of the grate
  out.push(
    el('rect', {
      x: x - hw,
      y: y - hh,
      width: hw * 2,
      height: hh * 2,
      fill: 'none',
      stroke: '#26211d',
      'stroke-width': 5,
    }),
  );
  for (let bx = x - hw + 9; bx < x + hw - 4; bx += 10) {
    out.push(el('rect', {x: bx - 1.6, y: y - hh, width: 3.2, height: hh * 2, fill: '#2f2925'}));
    out.push(el('rect', {x: bx - 1.6, y: y - hh, width: 1, height: hh * 2, fill: '#5a4d43'}));
  }
  out.push(el('rect', {x: x - hw, y: y - 1.5, width: hw * 2, height: 3, fill: '#2f2925'}));
  return out;
}

/** Cracks in the brick, a few strands of cobweb between the joists. */
function details() {
  const rng = new Rng(73);
  const out = [];
  for (const [cx, cy, len] of [
    [-980, 40, 120],
    [-210, -60, 90],
    [210, 120, 70],
    [1180, -20, 110],
  ]) {
    const pts = [[cx, cy]];
    let px = cx;
    let py = cy;
    for (let i = 0; i < 9; i++) {
      px += rng.range(-10, 10);
      py -= len / 9;
      pts.push([px, py]);
    }
    out.push(
      el('path', {d: poly(/** @type {[number, number][]} */ (pts), false), stroke: '#1b120e', 'stroke-width': 1.6, fill: 'none'}),
    );
  }
  let web = '';
  for (let k = -14; k <= 14; k++) {
    if (hash(k, 3, 79) < 0.55) continue;
    const x0 = k * JOIST_STEP - JOIST_STEP / 2 + JOIST_W;
    const x1 = x0 + JOIST_STEP - JOIST_W;
    for (let s = 0; s < 4; s++) {
      const y0 = JOIST_BOTTOM + rng.range(4, 40);
      const sag = rng.range(6, 22);
      web += `M${n(x0)} ${n(y0)}Q${n((x0 + x1) / 2)} ${n(y0 - sag)} ${n(x1)} ${n(y0 + rng.range(-8, 8))}`;
    }
  }
  out.push(el('path', {d: web, stroke: '#b9b4aa', 'stroke-width': 0.5, fill: 'none', opacity: 0.45}));
  return out;
}

/** @returns {Promise<Buffer[]>} the tiles of the back layer, left to right */
export async function renderBack() {
  const layer = new Layer(LAYERS.back);
  layer.paint(shadeWall);
  await layer.svg([blurFilter('b3', 3)], [...vent(), ...details()]);
  layer.grain(83, 0.16);
  return layer.tiles();
}
