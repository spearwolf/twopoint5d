// stage-masks/flashlight: the middle layer of "The Crawlspace", z = −180 — the girder on its brick
// piers, the joists on the girder, the drain pipe with the joint that drips, a copper line, a sagging
// flex duct, pink insulation hanging out of the bays, cobwebs, and what was put down here and
// forgotten: a rusted tricycle, paint cans, a soft cardboard box, the puddle under the drip. The dirt,
// the wood and the brick are per pixel; the rest is SVG. Transparent between floor and girder.
import {fbm, Rng} from '../../lib/image.mjs';
import {blurFilter, brick, dirt, el, hash, hexRgb, Layer, mix3, n, poly, wood} from './kit.mjs';
import {DRAIN, FLOOR_Y, LAYERS} from './layout.mjs';

const GIRDER_BOTTOM = 140;
const GIRDER_TOP = 176;
const JOIST_TOP = 262;
const JOIST_STEP = 130;
const JOIST_W = 20;
const PIERS = [-1200, -600, 0, 600, 1200];
const PIER_HW = 30;

/** the top of the dirt, a few low mounds @param {number} u */
const floorEdge = (u) => FLOOR_Y + 10 * Math.sin(u * 0.006 + 1) + 14 * (fbm(u / 90, 2.5, 131, 3) - 0.5);

/** @param {number} u @param {number} v @returns {[number, number, number, number] | undefined} */
function shade(u, v) {
  const edge = floorEdge(u);
  if (v < edge) {
    const c = dirt(u, v, 101, 0.3);
    // the crest of the dirt catches a little more
    const k = 1 + 0.25 * Math.max(0, 1 - (edge - v) / 6);
    return [c[0] * k, c[1] * k, c[2] * k, 1];
  }
  if (v < GIRDER_BOTTOM) {
    for (const px of PIERS) {
      const dx = u - px;
      if (Math.abs(dx) < PIER_HW) {
        const c = brick(u, v, 15, 6, 107);
        // a column: darker towards its sides
        const k = 0.55 + 0.45 * Math.cos((dx / PIER_HW) * 1.3);
        return [c[0] * k, c[1] * k, c[2] * k, 1];
      }
    }
    return undefined;
  }
  if (v < GIRDER_TOP) {
    const c = wood(u, v, 109);
    const k = v < GIRDER_BOTTOM + 3 ? 0.5 : v > GIRDER_TOP - 4 ? 1.15 : 1;
    return [c[0] * k, c[1] * k, c[2] * k, 1];
  }
  if (v < JOIST_TOP) {
    const k = Math.floor((u + JOIST_STEP / 2) / JOIST_STEP);
    const fx = u + JOIST_STEP / 2 - k * JOIST_STEP;
    if (fx < JOIST_W) {
      const rx = fx - JOIST_W * (0.3 + 0.4 * hash(k, 0, 113));
      const ry = v - GIRDER_TOP + 34;
      const rings = 0.5 + 0.5 * Math.sin(Math.hypot(rx, ry) * 1.6 + fbm(u / 3, v / 3, 115, 2) * 3);
      const c = mix3(hexRgb('#5c4330'), hexRgb('#8f6e4c'), 0.3 + 0.5 * rings);
      const s = fx < 1.4 || fx > JOIST_W - 1.4 ? 0.55 : 1;
      return [c[0] * s, c[1] * s, c[2] * s, 1];
    }
    const g = Math.max(0, 1 - (v - GIRDER_TOP) / 80);
    const c = mix3(hexRgb('#0d0a07'), hexRgb('#2a2018'), g * 0.55);
    return [c[0], c[1], c[2], 1];
  }
  const seam = (v - JOIST_TOP) % 16;
  const c = wood(u * 0.8, v, 117);
  const k = (seam < 1.3 ? 0.35 : 0.7) * Math.max(0.4, 1 - (v - JOIST_TOP) / 300);
  return [c[0] * k, c[1] * k, c[2] * k, 1];
}

const defs = [
  blurFilter('b2', 2),
  blurFilter('b4', 4),
  el('linearGradient', {id: 'iron', x1: 0, y1: 0, x2: 0, y2: 1}, [
    el('stop', {offset: 0, 'stop-color': '#1b1714'}),
    el('stop', {offset: 0.35, 'stop-color': '#4a423b'}),
    el('stop', {offset: 0.55, 'stop-color': '#6b5f53'}),
    el('stop', {offset: 1, 'stop-color': '#1d1915'}),
  ]),
  el('linearGradient', {id: 'copper', x1: 0, y1: 0, x2: 0, y2: 1}, [
    el('stop', {offset: 0, 'stop-color': '#3a2014'}),
    el('stop', {offset: 0.5, 'stop-color': '#a86a43'}),
    el('stop', {offset: 1, 'stop-color': '#3a2014'}),
  ]),
  el('linearGradient', {id: 'foil', x1: 0, y1: 0, x2: 0, y2: 1}, [
    el('stop', {offset: 0, 'stop-color': '#3b3c3d'}),
    el('stop', {offset: 0.4, 'stop-color': '#a3a6a6'}),
    el('stop', {offset: 0.6, 'stop-color': '#c9cbca'}),
    el('stop', {offset: 1, 'stop-color': '#4a4b4c'}),
  ]),
  el('linearGradient', {id: 'can', x1: 0, y1: 0, x2: 1, y2: 0}, [
    el('stop', {offset: 0, 'stop-color': '#2a2a2a'}),
    el('stop', {offset: 0.3, 'stop-color': '#7d7a72'}),
    el('stop', {offset: 0.45, 'stop-color': '#a39f95'}),
    el('stop', {offset: 1, 'stop-color': '#2a2826'}),
  ]),
  // fluffy: the outline of fiberglass, torn
  el('filter', {id: 'fluff', x: '-20%', y: '-20%', width: '140%', height: '140%'}, [
    el('feTurbulence', {type: 'fractalNoise', baseFrequency: 0.14, numOctaves: 3, seed: 7, result: 't'}),
    el('feDisplacementMap', {in: 'SourceGraphic', in2: 't', scale: 7, xChannelSelector: 'R', yChannelSelector: 'G'}),
  ]),
];

/** The drain: cast iron with a hub every 300 units, straps up to the girder, the weeping joint. */
function drain() {
  const {y, drip} = DRAIN;
  const {left, right} = LAYERS.mid;
  const r = 7;
  const out = [];
  out.push(el('rect', {x: left, y: y - r, width: right - left, height: r * 2, fill: 'url(#iron)'}));
  for (let x = Math.ceil(left / 300) * 300 - 40; x < right; x += 300) {
    out.push(el('rect', {x: x - 9, y: y - r - 2.5, width: 18, height: r * 2 + 5, rx: 2, fill: 'url(#iron)'}));
    out.push(
      el('rect', {
        x: x - 9,
        y: y - r - 2.5,
        width: 18,
        height: r * 2 + 5,
        rx: 2,
        fill: 'none',
        stroke: '#14110f',
        'stroke-width': 1,
      }),
    );
    // a strap from the girder
    out.push(el('rect', {x: x + 24, y: y + r - 1, width: 3, height: GIRDER_BOTTOM - y - r + 2, fill: '#3a332c'}));
    out.push(
      el('path', {
        d: `M${n(x + 18)} ${n(y + r)}Q${n(x + 25.5)} ${n(y - r - 6)} ${n(x + 33)} ${n(y + r)}`,
        stroke: '#3a332c',
        'stroke-width': 3,
        fill: 'none',
      }),
    );
  }
  // the joint that weeps: rust down from it, a bead of water hanging under it
  out.push(el('rect', {x: drip - 10, y: y - r - 3, width: 20, height: r * 2 + 6, rx: 2, fill: 'url(#iron)'}));
  out.push(el('rect', {x: drip - 10, y: y - r - 3, width: 20, height: r * 2 + 6, rx: 2, fill: '#6b3c1c', opacity: 0.55}));
  out.push(el('ellipse', {cx: drip, cy: y - r - 5, rx: 7, ry: 6, fill: '#3b2416', opacity: 0.7, filter: 'url(#b2)'}));
  out.push(el('path', {d: `M${n(drip - 2)} ${n(y - r - 2)}q2 -7 4 0q-2 3 -4 0Z`, fill: '#9fb2b8'}));
  return out;
}

/** The copper line above the drain, green where it sweats. */
function copper() {
  const y = 126;
  const {left, right} = LAYERS.mid;
  const rng = new Rng(121);
  const out = [el('rect', {x: left, y: y - 2.6, width: right - left, height: 5.2, fill: 'url(#copper)'})];
  for (let i = 0; i < 40; i++) {
    const x = rng.range(left, right);
    out.push(el('ellipse', {cx: x, cy: y - 1, rx: rng.range(4, 14), ry: 2.2, fill: '#3f6b55', opacity: rng.range(0.3, 0.7)}));
  }
  return out;
}

/** The flex duct: a foil tube sagging between two straps, torn open at one place. */
function duct() {
  const out = [];
  const x0 = 140;
  const x1 = 1010;
  const sagAt = (/** @type {number} */ t) => 88 - 52 * Math.sin(Math.PI * t) - 10 * Math.sin(Math.PI * 3 * t);
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    pts.push([x0 + (x1 - x0) * t, sagAt(t)]);
  }
  const d = poly(/** @type {[number, number][]} */ (pts), false);
  out.push(el('path', {d, stroke: '#1a1a1b', 'stroke-width': 36, fill: 'none', 'stroke-linecap': 'round'}));
  out.push(el('path', {d, stroke: '#6c6f70', 'stroke-width': 32, fill: 'none', 'stroke-linecap': 'round'}));
  out.push(
    el('path', {
      d: poly(/** @type {[number, number][]} */ (pts.map(([x, y]) => [x, y + 6])), false),
      stroke: '#b5b8b7',
      'stroke-width': 10,
      fill: 'none',
      opacity: 0.8,
    }),
  );
  // the ribs of the wire inside the foil
  let ribs = '';
  for (let i = 0; i <= 160; i++) {
    const t = i / 160;
    const x = x0 + (x1 - x0) * t;
    const y = sagAt(t);
    ribs += `M${n(x - 3)} ${n(y - 15)}Q${n(x + 2)} ${n(y)} ${n(x - 3)} ${n(y + 15)}`;
  }
  out.push(el('path', {d: ribs, stroke: '#2c2d2e', 'stroke-width': 1.2, fill: 'none', opacity: 0.7}));
  // the tear: yellow fiberglass bulging out of the foil
  const tx = x0 + (x1 - x0) * 0.62;
  const ty = sagAt(0.62) - 6;
  out.push(el('ellipse', {cx: tx, cy: ty, rx: 34, ry: 14, fill: '#b39a4c', filter: 'url(#fluff)'}));
  out.push(el('ellipse', {cx: tx + 4, cy: ty - 2, rx: 22, ry: 8, fill: '#d4bd6a', filter: 'url(#fluff)'}));
  // the straps up into the joists
  for (const t of [0.04, 0.5, 0.96]) {
    const x = x0 + (x1 - x0) * t;
    out.push(
      el('path', {
        d: `M${n(x)} ${n(sagAt(t) + 14)}L${n(x + 3)} ${n(GIRDER_TOP + 60)}`,
        stroke: '#3c3a36',
        'stroke-width': 2.4,
        fill: 'none',
      }),
    );
  }
  return out;
}

/**
 * Pink insulation sagging out of the bays between the joists; here and there a torn batt hangs down
 * over the girder, with strands below it.
 */
function insulation() {
  const rng = new Rng(127);
  const out = [];
  const {left, right} = LAYERS.mid;
  for (let k = Math.ceil(left / JOIST_STEP); k * JOIST_STEP < right; k++) {
    if (hash(k, 1, 129) < 0.4) continue;
    const x0 = k * JOIST_STEP - JOIST_STEP / 2 + JOIST_W;
    const x1 = x0 + JOIST_STEP - JOIST_W;
    const torn = hash(k, 2, 131) > 0.62;
    const drop = torn ? rng.range(40, 90) : rng.range(4, 24);
    /** @type {[number, number][]} */
    const pts = [
      [x0 + 1, JOIST_TOP - 2],
      [x1 - 1, JOIST_TOP - 2],
      [x1 - 1, GIRDER_TOP + rng.range(10, 40)],
    ];
    const steps = 9;
    for (let i = 1; i < steps; i++) {
      const x = x1 - ((x1 - x0) * i) / steps;
      const sag = Math.sin((Math.PI * i) / steps) ** 0.7 * drop;
      pts.push([x, GIRDER_TOP + 30 - sag + rng.range(-7, 7)]);
    }
    pts.push([x0 + 1, GIRDER_TOP + rng.range(10, 40)]);
    const yellow = hash(k, 4, 139) > 0.75;
    const base = yellow ? '#8e7748' : '#8a535a';
    const lit = yellow ? '#b89d62' : '#b0737a';
    out.push(el('path', {d: poly(pts), fill: base, filter: 'url(#fluff)'}));
    out.push(
      el('path', {
        d: poly(pts.map(([x, y]) => [x * 0.9 + (x0 + x1) * 0.05, y + 6])),
        fill: lit,
        opacity: 0.45,
        filter: 'url(#fluff)',
      }),
    );
    // fibres: short light strokes over the batt
    let fibres = '';
    for (let i = 0; i < 40; i++) {
      const fx = rng.range(x0 + 4, x1 - 4);
      const fy = rng.range(GIRDER_TOP + 30 - Math.max(0, drop), JOIST_TOP - 6);
      fibres += `M${n(fx)} ${n(fy)}l${n(rng.range(-6, 6))} ${n(rng.range(-3, 3))}`;
    }
    out.push(el('path', {d: fibres, stroke: lit, 'stroke-width': 0.8, fill: 'none', opacity: 0.6}));
    if (!torn) continue;
    for (let i = 0; i < 3; i++) {
      const sx = rng.range(x0 + 10, x1 - 10);
      const top = GIRDER_TOP + 30 - drop * 0.8;
      const len = rng.range(20, 60);
      out.push(
        el('path', {
          d: `M${n(sx)} ${n(top)}q${n(rng.range(-6, 6))} ${n(-len * 0.5)} ${n(rng.range(-4, 4))} ${n(-len)}`,
          stroke: base,
          'stroke-width': rng.range(2, 4),
          fill: 'none',
          filter: 'url(#fluff)',
        }),
      );
    }
  }
  return out;
}

/** Radial cobwebs in the corners where the piers meet the girder. */
function cobwebs() {
  const rng = new Rng(133);
  let d = '';
  for (const px of PIERS) {
    for (const side of [-1, 1]) {
      if (rng.next() < 0.35) continue;
      const cx = px + side * PIER_HW;
      const cy = GIRDER_BOTTOM;
      const rad = rng.range(40, 75);
      const spokes = 7;
      /** @type {[number, number][]} */
      const ends = [];
      for (let i = 0; i <= spokes; i++) {
        const a = -Math.PI / 2 + ((side > 0 ? 1 : -1) * ((Math.PI / 2) * i)) / spokes;
        const x = side > 0 ? cx + Math.abs(Math.cos(a)) * rad : cx - Math.abs(Math.cos(a)) * rad;
        const y = cy - Math.abs(Math.sin(a)) * rad;
        ends.push([x, y]);
        d += `M${n(cx)} ${n(cy)}L${n(x)} ${n(y)}`;
      }
      for (let ring = 1; ring <= 5; ring++) {
        const f = ring / 5.5;
        for (let i = 0; i < ends.length - 1; i++) {
          const [ax, ay] = ends[i];
          const [bx, by] = ends[i + 1];
          const p0 = [cx + (ax - cx) * f, cy + (ay - cy) * f];
          const p1 = [cx + (bx - cx) * f, cy + (by - cy) * f];
          const mx = (p0[0] + p1[0]) / 2 + (cx - (p0[0] + p1[0]) / 2) * 0.12;
          const my = (p0[1] + p1[1]) / 2 + (cy - (p0[1] + p1[1]) / 2) * 0.12;
          d += `M${n(p0[0])} ${n(p0[1])}Q${n(mx)} ${n(my)} ${n(p1[0])} ${n(p1[1])}`;
        }
      }
    }
  }
  return [el('path', {d, stroke: '#cfcabe', 'stroke-width': 0.6, fill: 'none', opacity: 0.5})];
}

/** A child's tricycle, rusted, tipped a little. */
function tricycle(/** @type {number} */ x) {
  const y = FLOOR_Y + 2;
  const g = (/** @type {string[]} */ body) => el('g', {transform: `translate(${n(x)} ${n(y)}) rotate(-4) scale(2)`}, body);
  const rust = '#563222';
  const wheel = (/** @type {number} */ cx, /** @type {number} */ r) => [
    el('circle', {cx, cy: r, r, fill: 'none', stroke: '#1c1a19', 'stroke-width': 4}),
    el('circle', {cx, cy: r, r: r - 3, fill: 'none', stroke: '#5b5650', 'stroke-width': 1}),
    el('path', {
      d: `M${n(cx - r + 3)} ${n(r)}H${n(cx + r - 3)}M${n(cx)} 3V${n(2 * r - 3)}`,
      stroke: '#6e6760',
      'stroke-width': 0.8,
    }),
    el('circle', {cx, cy: r, r: 2.5, fill: rust}),
  ];
  return g([
    ...wheel(-32, 9),
    ...wheel(-16, 9),
    ...wheel(30, 18),
    el('path', {
      d: 'M-24 9L8 26L30 18M8 26L14 48M-24 9L-2 36',
      stroke: rust,
      'stroke-width': 4.5,
      fill: 'none',
      'stroke-linecap': 'round',
    }),
    el('path', {d: 'M-10 34h20l-3 6h-14z', fill: '#2b2622'}),
    el('path', {d: 'M14 48l-10 -2M14 48l10 -3', stroke: '#2a2724', 'stroke-width': 3.5, 'stroke-linecap': 'round'}),
    el('path', {d: 'M-24 9L8 26', stroke: '#a05a2c', 'stroke-width': 1.2, opacity: 0.6}),
  ]);
}

/** Old paint cans, one on its side, one with its lid off and a skin of dried paint. */
function paintCans(/** @type {number} */ x) {
  const y = FLOOR_Y;
  const can = (/** @type {number} */ cx, /** @type {number} */ h, /** @type {string} */ label, /** @type {string} */ drip) => [
    el('rect', {x: cx - 13, y, width: 26, height: h, fill: 'url(#can)'}),
    el('rect', {x: cx - 13, y: y + h * 0.3, width: 26, height: h * 0.4, fill: label, opacity: 0.85}),
    el('ellipse', {cx, cy: y + h, rx: 13, ry: 3.2, fill: '#3a3835'}),
    el('path', {d: `M${n(cx - 8)} ${n(y + h)}q2 -12 3 -16q1 6 2 0q1 8 3 -2`, stroke: drip, 'stroke-width': 3, fill: 'none'}),
  ];
  return [
    ...can(x, 34, '#5d6b4a', '#8c9a6c'),
    ...can(x + 30, 28, '#7a3a34', '#9d4d44'),
    el('g', {transform: `translate(${n(x - 40)} ${n(y + 12)}) rotate(90)`}, [
      el('rect', {x: -12, y: -13, width: 24, height: 26, fill: 'url(#can)'}),
      el('rect', {x: -4, y: -13, width: 8, height: 26, fill: '#4b5a6e', opacity: 0.85}),
    ]),
  ];
}

/** A cardboard box gone soft with damp, its flaps open, something in it the light never reaches. */
function box(/** @type {number} */ x) {
  const y = FLOOR_Y;
  return [
    el('path', {
      d: `M${n(x - 44)} ${n(y)}L${n(x - 46)} ${n(y + 52)}L${n(x + 42)} ${n(y + 56)}L${n(x + 46)} ${n(y)}Z`,
      fill: '#6e5638',
    }),
    el('path', {d: `M${n(x - 46)} ${n(y + 52)}L${n(x - 70)} ${n(y + 64)}L${n(x - 30)} ${n(y + 60)}Z`, fill: '#7f6744'}),
    el('path', {d: `M${n(x + 42)} ${n(y + 56)}L${n(x + 70)} ${n(y + 72)}L${n(x + 30)} ${n(y + 62)}Z`, fill: '#5d482e'}),
    el('path', {
      d: `M${n(x - 40)} ${n(y + 49)}L${n(x + 38)} ${n(y + 52)}L${n(x + 36)} ${n(y + 46)}L${n(x - 38)} ${n(y + 43)}Z`,
      fill: '#140f0a',
    }),
    // the damp line and the tape
    el('path', {
      d: `M${n(x - 45)} ${n(y + 16)}Q${n(x)} ${n(y + 24)} ${n(x + 45)} ${n(y + 14)}L${n(x + 46)} ${n(y)}L${n(x - 44)} ${n(y)}Z`,
      fill: '#3e2f1e',
      opacity: 0.7,
    }),
    el('rect', {x: x - 6, y: y + 2, width: 12, height: 50, fill: '#a99a73', opacity: 0.55}),
  ];
}

/** Draws `body` scaled by `k` about (x, y). @param {number} x @param {number} y @param {number} k @param {string[]} body */
const scaled = (x, y, k, body) =>
  el('g', {transform: `translate(${n(x)} ${n(y)}) scale(${k}) translate(${n(-x)} ${n(-y)})`}, body);

/** The puddle under the drip, dark and glossy. */
function puddle() {
  const x = DRAIN.drip;
  const y = FLOOR_Y - 6;
  return [
    el('ellipse', {cx: x, cy: y, rx: 46, ry: 7, fill: '#15191a'}),
    el('ellipse', {cx: x - 8, cy: y + 1.5, rx: 26, ry: 2.2, fill: '#5d6a6c', opacity: 0.6, filter: 'url(#b2)'}),
  ];
}

/** @returns {Promise<Buffer[]>} the tiles of the middle layer, left to right */
export async function renderMid() {
  const layer = new Layer(LAYERS.mid);
  layer.paint(shade);
  await layer.svg(defs, [
    ...cobwebs(),
    ...insulation(),
    ...copper(),
    ...drain(),
    ...duct(),
    tricycle(-850),
    scaled(380, FLOOR_Y, 1.4, paintCans(380)),
    scaled(905, FLOOR_Y, 1.5, box(905)),
    ...puddle(),
  ]);
  layer.grain(137, 0.18);
  return layer.tiles();
}
