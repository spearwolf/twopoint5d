// stage-masks/heat-haze: what lies behind the crematorium window — a cemetery on a slope that rises
// to a crest of trees against the evening sky. Two pictures of the same place, the same graves in
// the same spots:
//
// - `snow`: dusk after snowfall. An indigo sky with a crescent moon and the sodium glow of a town
//   beyond the crest, snow-laden firs, headstones capped with snow, a trodden path, a sodium lamp
//   pooling orange on the snow.
// - `ash`: the snow has become ash. A sky of smoke lit red from below, burnt firs reduced to their
//   skeletons, ash on the graves, embers in the ground, the lamp dead — and figures, too tall and
//   too thin, standing among the graves, facing the window.
//
// Sky and ground are worked out per pixel, everything that stands on the ground is SVG laid over
// them, far things first. The perspective of the slope: a point at depth d (1 at the bottom of the
// picture) lies at y = Y0 − K / d, and a thing there is 1 / d of its size.
import {fbm, Rng} from '../../lib/image.mjs';
import {el, lerp, n, rasterize, sat, smoothstep} from '../spotlight/svg.mjs';
import {encodeWebpRGB, overRGBA, rgrad, vgrad, worldDoc} from '../rift/kit.mjs';
import {LAMP, OUTSIDE} from './layout.mjs';

const PX = 2;
const W = (OUTSIDE.right - OUTSIDE.left) * PX;
const H = (OUTSIDE.top - OUTSIDE.bottom) * PX;

/** the slope: y = Y0 − K / depth, depth 1 at the bottom of the picture */
const Y0 = 70;
const K = Y0 - OUTSIDE.bottom;
const yAt = (/** @type {number} */ depth) => Y0 - K / depth;
const depthAt = (/** @type {number} */ y) => K / Math.max(0.5, Y0 - y);

/** the crest of the slope, where the cemetery ends against the sky */
const crest = (/** @type {number} */ x) => 34 + 12 * Math.sin(x * 0.011 + 0.6) + 6 * Math.sin(x * 0.029 + 2.1);

/** the depth of the slope in ground units, so that a noise on the ground is round, not stretched */
const GZ = 110;

/**
 * Embers in the ash: one in some cells of a grid on the ground, a small round glow each.
 * @param {number} gx @param {number} gz
 */
function emberAt(gx, gz) {
  const cell = 9;
  const cx = Math.floor(gx / cell);
  const cz = Math.floor(gz / cell);
  let h = Math.imul(cx, 374761393) + Math.imul(cz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  const r = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  if (r > 0.1) return 0;
  const ox = (cx + 0.2 + ((r * 97) % 0.6)) * cell;
  const oz = (cz + 0.2 + ((r * 531) % 0.6)) * cell;
  const dist = Math.hypot(gx - ox, gz - oz);
  return (1 - smoothstep(0.4, 1.6, dist)) * (0.5 + r * 5);
}

/** the trodden path from the near end up the slope, in ground units (x × depth) */
const pathX = (/** @type {number} */ depth) => -40 + 46 * Math.sin(depth * 0.55 + 0.4);
const PATH_W = 30;

/** @typedef {[number, number, number]} RGB */
/** @param {RGB} c */
const hex = (c) =>
  `#${c
    .map((v) =>
      Math.round(sat(v) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
/** @param {string} h @returns {RGB} */
const rgb = (h) => {
  const v = Number.parseInt(h.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};
/** @param {RGB} a @param {RGB} b @param {number} t @returns {RGB} */
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** The palettes of the two pictures. */
const PALETTES = {
  snow: {
    skyTop: rgb('#070a1c'),
    skyMid: rgb('#1d1f45'),
    skyLow: rgb('#4a3a66'),
    horizon: rgb('#8a5a6a'),
    glow: rgb('#ff9a48'),
    cloud: rgb('#141532'),
    ground: rgb('#8e95c4'),
    groundShade: rgb('#4a4f80'),
    fog: rgb('#5a4a74'),
    stone: rgb('#3c3e4c'),
    stoneLit: rgb('#6a6c80'),
    stoneDark: rgb('#16171f'),
    cap: rgb('#c9d0ee'),
    capShade: rgb('#8a92c0'),
    rim: rgb('#d88a62'),
    tree: rgb('#0b1416'),
    treeLit: rgb('#1d2e30'),
    iron: rgb('#0d0e14'),
  },
  ash: {
    skyTop: rgb('#0d0807'),
    skyMid: rgb('#2a1a15'),
    skyLow: rgb('#5a2c1c'),
    horizon: rgb('#b0442a'),
    glow: rgb('#ff6a2a'),
    cloud: rgb('#1a100c'),
    ground: rgb('#6a625e'),
    groundShade: rgb('#2e2826'),
    fog: rgb('#4a2a20'),
    stone: rgb('#2a2624'),
    stoneLit: rgb('#4a403a'),
    stoneDark: rgb('#0e0b0a'),
    cap: rgb('#8a827c'),
    capShade: rgb('#554c48'),
    rim: rgb('#e0582c'),
    tree: rgb('#0a0605'),
    treeLit: rgb('#3a1a10'),
    iron: rgb('#0a0807'),
  },
};

/** @typedef {typeof PALETTES.snow} Palette */
/** @typedef {'snow' | 'ash'} Variant */

/** how much of the far haze a thing at `depth` takes on */
const fogOf = (/** @type {number} */ depth) => 1 - Math.exp(-(depth - 1) * 0.13);

// ---------------------------------------------------------------- the things on the slope

/**
 * The graves, the trees on the crest and the figures, one seeded layout for both pictures.
 * @returns {{kind: string, x: number, depth: number, seed: number, h: number, rot: number}[]}
 */
function layoutThings() {
  const rng = new Rng(31013);
  /** @type {{kind: string, x: number, depth: number, seed: number, h: number, rot: number}[]} */
  const list = [];
  // rows of graves, nearer rows wider apart in ground units
  for (let depth = 1.12; depth < 9.5; depth *= 1.21) {
    const spacing = rng.range(74, 96);
    const half = (OUTSIDE.right + 20) * depth;
    for (let gx = -half + rng.range(0, spacing); gx < half; gx += spacing * rng.range(0.8, 1.25)) {
      const d = depth * rng.range(0.97, 1.03);
      if (Math.abs(gx - pathX(d)) < PATH_W + 18 || rng.next() < 0.22) continue;
      const y = yAt(d);
      if (y > crest(gx / d) - 4) continue;
      const kind = rng.pick(['round', 'round', 'gothic', 'cross', 'cross', 'slab', 'obelisk', 'round', 'gothic']);
      list.push({kind, x: gx / d, depth: d, seed: rng.int(1, 1e6), h: rng.range(62, 96), rot: rng.range(-5, 5)});
    }
  }
  // one angel on a plinth, half way up, and the lamp by the path
  list.push({kind: 'angel', x: -112, depth: depthAt(-62), seed: 77, h: 150, rot: 0});
  list.push({kind: 'lamp', x: LAMP.x, depth: depthAt(-92), seed: 5, h: 0, rot: 0});
  // the trees on the crest, and one big fir in front on the left
  for (let x = -260; x < 270; x += rng.range(26, 46)) {
    if (Math.abs(x - 40) < 34) continue;
    const y = crest(x);
    list.push({kind: 'tree', x, depth: depthAt(y - 1), seed: rng.int(1, 1e6), h: rng.range(70, 130), rot: 0});
  }
  list.push({kind: 'tree', x: -196, depth: depthAt(-122), seed: 911, h: 290, rot: 0});
  list.push({kind: 'tree', x: 212, depth: depthAt(-40), seed: 4242, h: 230, rot: 0});
  // the figures: they stand in the gaps, at the same spots in the ash only
  const figures = [
    [-58, -112, 0],
    [36, -52, 1],
    [146, -78, 2],
    [-150, -28, 3],
    [86, -6, 4],
    [-14, 6, 5],
    [190, 0, 6],
  ];
  for (const [x, y, i] of figures) list.push({kind: 'figure', x, depth: depthAt(y), seed: 600 + i, h: 205, rot: 0});
  // far first
  list.sort((a, b) => b.depth - a.depth);
  return list;
}

/**
 * Tints a colour by the haze of its depth.
 * @param {RGB} c @param {number} depth @param {Palette} pal
 */
const fogged = (c, depth, pal) => hex(mixc(c, pal.fog, fogOf(depth) * 0.85));

/**
 * A headstone, cross or obelisk on its little mound, in ground units around (0, 0), drawn at 1/depth.
 * @param {{kind: string, x: number, depth: number, seed: number, h: number, rot: number}} t
 * @param {Variant} variant @param {Palette} pal @param {string[]} defs
 */
function grave(t, variant, pal, defs) {
  const rng = new Rng(t.seed);
  const s = 1 / t.depth;
  const h = t.h;
  const w = h * rng.range(0.5, 0.66);
  const id = `g${t.seed}`;
  const lit = t.x > LAMP.x - 60 && t.x < LAMP.x + 90 && Math.abs(t.depth - depthAt(-92)) < 0.8 && variant === 'snow';
  defs.push(
    el(
      'linearGradient',
      {id, x1: 0, y1: 0, x2: 1, y2: 0},
      [
        el('stop', {offset: 0, 'stop-color': fogged(pal.stoneLit, t.depth, pal)}),
        el('stop', {offset: 0.45, 'stop-color': fogged(pal.stone, t.depth, pal)}),
        el('stop', {offset: 1, 'stop-color': fogged(lit ? pal.rim : pal.stoneDark, t.depth, pal)}),
      ].join(''),
    ),
  );
  let stone = '';
  let cap = '';
  const capC = fogged(pal.cap, t.depth, pal);
  const capT = h * 0.07;
  if (t.kind === 'round') {
    const r = w / 2;
    stone = `M${n(-r)} 0L${n(-r)} ${n(h - r)}A${n(r)} ${n(r)} 0 0 0 ${n(r)} ${n(h - r)}L${n(r)} 0Z`;
    cap = `M${n(-r * 0.98)} ${n(h - r)}A${n(r)} ${n(r)} 0 0 0 ${n(r * 0.98)} ${n(h - r)}A${n(r)} ${n(r + capT)} 0 0 1 ${n(-r * 0.98)} ${n(h - r - capT * 0.4)}Z`;
  } else if (t.kind === 'gothic') {
    const r = w / 2;
    stone = `M${n(-r)} 0L${n(-r)} ${n(h * 0.68)}Q${n(-r)} ${n(h * 0.9)} 0 ${n(h)}Q${n(r)} ${n(h * 0.9)} ${n(r)} ${n(h * 0.68)}L${n(r)} 0Z`;
    cap = `M${n(-r)} ${n(h * 0.68)}Q${n(-r)} ${n(h * 0.9)} 0 ${n(h)}Q${n(r)} ${n(h * 0.9)} ${n(r)} ${n(h * 0.68)}L${n(r * 0.9)} ${n(h * 0.62)}Q${n(r * 0.8)} ${n(h * 0.84)} 0 ${n(h - capT * 1.4)}Q${n(-r * 0.8)} ${n(h * 0.84)} ${n(-r * 0.9)} ${n(h * 0.62)}Z`;
  } else if (t.kind === 'cross') {
    const b = w * 0.17;
    const arm = h * 0.7;
    const span = w * 0.5;
    const base = h * 0.16;
    stone = `M${n(-w * 0.4)} 0L${n(-w * 0.4)} ${n(base)}L${n(-b)} ${n(base)}L${n(-b)} ${n(arm - b)}L${n(-span)} ${n(arm - b)}L${n(-span)} ${n(arm + b)}L${n(-b)} ${n(arm + b)}L${n(-b)} ${n(h)}L${n(b)} ${n(h)}L${n(b)} ${n(arm + b)}L${n(span)} ${n(arm + b)}L${n(span)} ${n(arm - b)}L${n(b)} ${n(arm - b)}L${n(b)} ${n(base)}L${n(w * 0.4)} ${n(base)}L${n(w * 0.4)} 0Z`;
    cap = [
      `M${n(-b)} ${n(h)}L${n(b)} ${n(h)}L${n(b)} ${n(h + capT)}Q0 ${n(h + capT * 1.6)} ${n(-b)} ${n(h + capT)}Z`,
      `M${n(-span)} ${n(arm + b)}L${n(span)} ${n(arm + b)}L${n(span)} ${n(arm + b + capT * 0.8)}Q0 ${n(arm + b + capT * 1.3)} ${n(-span)} ${n(arm + b + capT * 0.8)}Z`,
      `M${n(-w * 0.42)} ${n(base)}L${n(w * 0.42)} ${n(base)}L${n(w * 0.4)} ${n(base + capT)}L${n(-w * 0.4)} ${n(base + capT)}Z`,
    ].join('');
  } else if (t.kind === 'slab') {
    const ww = w * 1.5;
    const hh = h * 0.32;
    stone = `M${n(-ww / 2)} 0L${n(-ww / 2 + 4)} ${n(hh)}L${n(ww / 2 - 4)} ${n(hh)}L${n(ww / 2)} 0Z`;
    cap = `M${n(-ww / 2 + 3)} ${n(hh)}L${n(ww / 2 - 3)} ${n(hh)}Q${n(ww * 0.3)} ${n(hh + capT * 2.2)} 0 ${n(hh + capT * 1.8)}Q${n(-ww * 0.3)} ${n(hh + capT * 2.4)} ${n(-ww / 2 + 3)} ${n(hh)}Z`;
  } else if (t.kind === 'obelisk') {
    const hh = h * 1.35;
    const b = w * 0.32;
    stone = `M${n(-w * 0.42)} 0L${n(-w * 0.42)} ${n(hh * 0.16)}L${n(-b)} ${n(hh * 0.16)}L${n(-b * 0.62)} ${n(hh * 0.9)}L0 ${n(hh)}L${n(b * 0.62)} ${n(hh * 0.9)}L${n(b)} ${n(hh * 0.16)}L${n(w * 0.42)} ${n(hh * 0.16)}L${n(w * 0.42)} 0Z`;
    cap = `M${n(-b * 0.62)} ${n(hh * 0.9)}L0 ${n(hh)}L${n(b * 0.62)} ${n(hh * 0.9)}L0 ${n(hh * 0.93)}ZM${n(-w * 0.44)} ${n(hh * 0.16)}L${n(w * 0.44)} ${n(hh * 0.16)}L${n(w * 0.4)} ${n(hh * 0.16 + capT)}L${n(-w * 0.4)} ${n(hh * 0.16 + capT)}Z`;
  }
  const mound = el('ellipse', {cx: 0, cy: 0, rx: w * 0.78, ry: w * 0.16, fill: fogged(pal.capShade, t.depth, pal)});
  const moundTop = el('ellipse', {cx: -w * 0.08, cy: w * 0.03, rx: w * 0.62, ry: w * 0.1, fill: capC});
  const shadow = el('ellipse', {
    cx: w * 0.5,
    cy: -w * 0.05,
    rx: w * 0.95,
    ry: w * 0.16,
    fill: hex(pal.groundShade),
    opacity: 0.55 * (1 - fogOf(t.depth)),
    filter: 'url(#soft)',
  });
  // the inscription: a few faint lines cut into the face
  const lines = [];
  if (t.kind === 'round' || t.kind === 'gothic') {
    for (let i = 0; i < 3; i++) {
      const yy = h * (0.55 - i * 0.11);
      const ww = w * (i === 0 ? 0.5 : 0.36);
      lines.push(`M${n(-ww / 2)} ${n(yy)}L${n(ww / 2)} ${n(yy)}`);
    }
  }
  const body = [
    shadow,
    mound,
    el('path', {d: stone, fill: `url(#${id})`}),
    lines.length
      ? el('path', {
          d: lines.join(''),
          stroke: fogged(pal.stoneDark, t.depth, pal),
          'stroke-width': 2.2,
          opacity: 0.6,
          fill: 'none',
        })
      : '',
    el('path', {d: cap, fill: capC}),
    moundTop,
  ];
  return el('g', {transform: `translate(${n(t.x)} ${n(yAt(t.depth))}) scale(${n(s)}) rotate(${n(-t.rot)})`}, body);
}

/**
 * The angel on its plinth: wings folded, head bowed, a hand to its face.
 * @param {{x: number, depth: number}} t @param {Variant} variant @param {Palette} pal
 */
function angel(t, variant, pal) {
  const s = 1 / t.depth;
  const stone = fogged(pal.stone, t.depth, pal);
  const lit = fogged(pal.stoneLit, t.depth, pal);
  const dark = fogged(pal.stoneDark, t.depth, pal);
  const cap = fogged(pal.cap, t.depth, pal);
  const body = [
    el('ellipse', {cx: 0, cy: 0, rx: 70, ry: 12, fill: fogged(pal.capShade, t.depth, pal)}),
    // the plinth
    el('path', {d: 'M-34 0L-34 50L-40 56L40 56L34 50L34 0Z', fill: stone}),
    el('path', {d: 'M-34 0L-34 50L-10 50L-10 0Z', fill: lit, opacity: 0.6}),
    el('path', {d: 'M-42 56L42 56L42 62L-42 62Z', fill: cap}),
    // the wings, folded down along its back, their tips above the shoulders
    el('path', {d: 'M-10 140C-30 168 -42 178 -40 152C-46 124 -42 98 -28 74C-30 100 -22 122 -10 128Z', fill: dark}),
    el('path', {d: 'M10 140C30 168 42 178 40 152C46 124 42 98 28 74C30 100 22 122 10 128Z', fill: stone}),
    // the robe
    el('path', {d: 'M-22 62C-26 100 -20 130 -14 150L14 150C20 130 26 100 22 62Z', fill: stone}),
    el('path', {d: 'M-22 62C-26 100 -20 130 -14 150L-4 150C-8 120 -10 90 -8 62Z', fill: lit}),
    // the bowed head and the hand at its face
    el('ellipse', {cx: 4, cy: 160, rx: 10, ry: 12, fill: stone}),
    el('path', {d: 'M-2 146C6 150 12 156 10 166L4 168C2 160 -2 154 -8 150Z', fill: lit}),
    // snow on the shoulders of the wings and the head
    el('path', {d: 'M-10 140C-30 168 -42 178 -40 152C-36 166 -26 160 -12 136Z', fill: cap}),
    el('path', {d: 'M10 140C30 168 42 178 40 152C36 166 26 160 12 136Z', fill: cap, opacity: 0.8}),
    el('path', {d: 'M-6 170Q4 176 14 168L12 165Q4 170 -4 166Z', fill: cap}),
    el('path', {d: 'M-22 64L22 64L20 60L-20 60Z', fill: cap}),
  ];
  if (variant === 'ash') {
    // the face of the angel has been worn smooth by the heat: a dark streak runs down from its eyes
    body.push(el('path', {d: 'M0 158L1 140L3 140L2 158Z', fill: dark, opacity: 0.8}));
  }
  return el('g', {transform: `translate(${n(t.x)} ${n(yAt(t.depth))}) scale(${n(s)})`}, body);
}

/**
 * A fir, laden with snow — or burnt to its skeleton in the ash: the trunk and the stubs of its
 * branches, drooping, some broken off.
 * @param {{x: number, depth: number, seed: number, h: number}} t @param {Variant} variant @param {Palette} pal
 */
function tree(t, variant, pal) {
  const rng = new Rng(t.seed);
  const s = 1 / t.depth;
  const h = t.h;
  const dark = fogged(pal.tree, t.depth, pal);
  const lit = fogged(pal.treeLit, t.depth, pal);
  const cap = fogged(pal.cap, t.depth, pal);
  const capShade = fogged(pal.capShade, t.depth, pal);
  /** @type {string[]} */
  const body = [];
  const tiers = Math.max(5, Math.round(h / 16));
  if (variant === 'snow') {
    body.push(el('path', {d: `M-3 0L-2 ${n(h * 0.3)}L2 ${n(h * 0.3)}L3 0Z`, fill: dark}));
    for (let i = 0; i < tiers; i++) {
      const k = i / tiers;
      const y0 = h * (0.08 + k * 0.84);
      const y1 = y0 + h * 0.2;
      const half = h * 0.3 * (1 - k * 0.88) * rng.range(0.85, 1.12);
      const lean = rng.range(-0.08, 0.08) * half;
      // a tier: a ragged skirt of needles, snow on its upper face
      const pts = [];
      const count = 9;
      for (let j = 0; j <= count; j++) {
        const u = j / count;
        const xx = lerp(-half, half, u) + lean;
        const sag = Math.sin(u * Math.PI) * h * 0.03 + rng.range(-1.5, 1.5);
        pts.push(`${n(xx)} ${n(y0 - sag + (j % 2 ? -h * 0.012 : 0))}`);
      }
      body.push(el('path', {d: `M${pts.join('L')}L${n(lean * 0.3)} ${n(y1)}Z`, fill: i % 2 ? dark : lit}));
      const snow = [];
      for (let j = 0; j <= count; j++) {
        const u = j / count;
        const xx = lerp(-half * 0.92, half * 0.92, u) + lean;
        const yy = lerp(y0 + h * 0.012, y1 - h * 0.02, 1 - Math.abs(u - 0.5) * 2) + rng.range(-0.8, 0.8);
        snow.push(`${n(xx)} ${n(yy)}`);
      }
      const back = [];
      for (let j = count; j >= 0; j--) {
        const u = j / count;
        const xx = lerp(-half * 0.92, half * 0.92, u) + lean;
        const yy = lerp(y0 + h * 0.012, y1 - h * 0.02, 1 - Math.abs(u - 0.5) * 2) - h * 0.022 * (1 - Math.abs(u - 0.5) * 1.4);
        back.push(`${n(xx)} ${n(yy)}`);
      }
      body.push(el('path', {d: `M${snow.join('L')}L${back.join('L')}Z`, fill: i % 3 === 2 ? capShade : cap}));
    }
  } else {
    const trunkW = Math.max(2.4, h * 0.026);
    const lean = rng.range(-0.04, 0.04) * h;
    body.push(
      el('path', {
        d: `M${n(-trunkW)} 0L${n(lean - trunkW * 0.25)} ${n(h * 0.97)}L${n(lean)} ${n(h)}L${n(lean + trunkW * 0.25)} ${n(h * 0.97)}L${n(trunkW)} 0Z`,
        fill: dark,
      }),
    );
    const strokes = [];
    const embers = [];
    for (let i = 0; i < tiers * 2; i++) {
      const k = 0.12 + (i / (tiers * 2)) * 0.82;
      const side = i % 2 ? 1 : -1;
      if (rng.next() < 0.22) continue;
      const len = h * 0.3 * (1 - k * 0.8) * rng.range(0.4, 1.1);
      const x0 = lean * k;
      const y0 = h * k;
      const droop = len * rng.range(0.15, 0.55);
      const x1 = x0 + side * len;
      const y1 = y0 - droop;
      strokes.push(`M${n(x0)} ${n(y0)}Q${n(x0 + side * len * 0.5)} ${n(y0 + len * 0.08)} ${n(x1)} ${n(y1)}`);
      // a twig or two off the branch, bent down
      if (len > 8 && rng.next() < 0.7) {
        const u = rng.range(0.4, 0.8);
        const tx = x0 + side * len * u;
        const ty = y0 - droop * u * u + len * 0.05;
        strokes.push(`M${n(tx)} ${n(ty)}l${n(side * len * 0.25)} ${n(-len * rng.range(0.15, 0.35))}`);
      }
      if (rng.next() < 0.18) embers.push([x1, y1]);
    }
    body.push(
      el('path', {
        d: strokes.join(''),
        stroke: dark,
        'stroke-width': Math.max(1.1, trunkW * 0.45),
        'stroke-linecap': 'round',
        fill: 'none',
      }),
      // the red of the sky catches the right side of the trunk
      el('path', {
        d: `M${n(trunkW * 0.5)} 0L${n(lean + trunkW * 0.1)} ${n(h * 0.95)}`,
        stroke: lit,
        'stroke-width': Math.max(0.8, trunkW * 0.4),
        fill: 'none',
      }),
    );
    // still glowing at the broken ends of a few branches
    for (const [ex, ey] of embers)
      body.push(
        el('circle', {cx: ex, cy: ey, r: Math.max(1.2, h * 0.008), fill: '#ff8a3a', opacity: 0.8 * (1 - fogOf(t.depth))}),
      );
  }
  return el('g', {transform: `translate(${n(t.x)} ${n(yAt(t.depth))}) scale(${n(s)})`}, body);
}

/**
 * A figure in the ash: a long coat to the ground, the arms hanging down to its knees, a narrow head
 * with a pale smear where a face should be. It faces the window.
 * @param {{x: number, depth: number, seed: number, h: number}} t @param {Palette} pal
 */
function figure(t, pal) {
  const rng = new Rng(t.seed);
  const s = 1 / t.depth;
  const h = t.h * rng.range(0.94, 1.08);
  const w = h * 0.16;
  const dark = fogged([0.025, 0.018, 0.016], t.depth, pal);
  const rim = hex(mixc(pal.rim, pal.fog, fogOf(t.depth) * 0.7));
  const face = hex(mixc([0.62, 0.56, 0.52], pal.fog, fogOf(t.depth) * 0.75));
  const tilt = rng.range(-6, 6);
  const coat = `M${n(-w * 0.62)} 0C${n(-w * 0.58)} ${n(h * 0.35)} ${n(-w * 0.56)} ${n(h * 0.62)} ${n(-w * 0.5)} ${n(h * 0.82)}Q${n(-w * 0.32)} ${n(h * 0.87)} ${n(-w * 0.12)} ${n(h * 0.86)}L${n(w * 0.12)} ${n(h * 0.86)}Q${n(w * 0.32)} ${n(h * 0.87)} ${n(w * 0.5)} ${n(h * 0.82)}C${n(w * 0.56)} ${n(h * 0.62)} ${n(w * 0.58)} ${n(h * 0.35)} ${n(w * 0.62)} 0Z`;
  const arms = `M${n(-w * 0.5)} ${n(h * 0.8)}C${n(-w * 0.72)} ${n(h * 0.6)} ${n(-w * 0.74)} ${n(h * 0.42)} ${n(-w * 0.7)} ${n(h * 0.3)}M${n(w * 0.5)} ${n(h * 0.8)}C${n(w * 0.72)} ${n(h * 0.6)} ${n(w * 0.74)} ${n(h * 0.42)} ${n(w * 0.7)} ${n(h * 0.3)}`;
  const body = [
    el('ellipse', {cx: w * 0.3, cy: 0, rx: w * 1.1, ry: w * 0.18, fill: '#000', opacity: 0.4, filter: 'url(#soft)'}),
    el('path', {d: coat, fill: dark}),
    el('path', {d: arms, stroke: dark, 'stroke-width': w * 0.2, 'stroke-linecap': 'round', fill: 'none'}),
    // long fingers
    el('path', {
      d: `M${n(-w * 0.7)} ${n(h * 0.3)}l${n(-w * 0.03)} ${n(-h * 0.045)}M${n(-w * 0.68)} ${n(h * 0.3)}l${n(w * 0.02)} ${n(-h * 0.05)}M${n(w * 0.7)} ${n(h * 0.3)}l${n(w * 0.03)} ${n(-h * 0.045)}M${n(w * 0.68)} ${n(h * 0.3)}l${n(-w * 0.02)} ${n(-h * 0.05)}`,
      stroke: dark,
      'stroke-width': w * 0.06,
      'stroke-linecap': 'round',
    }),
    // the neck and the head, tilted
    el('g', {transform: `translate(0 ${n(h * 0.86)}) rotate(${n(tilt)})`}, [
      el('path', {
        d: `M${n(-w * 0.1)} 0L${n(-w * 0.09)} ${n(h * 0.05)}L${n(w * 0.09)} ${n(h * 0.05)}L${n(w * 0.1)} 0Z`,
        fill: dark,
      }),
      el('ellipse', {cx: 0, cy: h * 0.1, rx: w * 0.26, ry: h * 0.06, fill: dark}),
      el('ellipse', {cx: 0, cy: h * 0.097, rx: w * 0.17, ry: h * 0.043, fill: face, opacity: 0.28, filter: 'url(#soft)'}),
      el('path', {
        d: `M${n(w * 0.2)} ${n(h * 0.06)}Q${n(w * 0.3)} ${n(h * 0.1)} ${n(w * 0.18)} ${n(h * 0.15)}`,
        stroke: rim,
        'stroke-width': w * 0.05,
        fill: 'none',
        opacity: 0.8,
      }),
    ]),
    // the red of the sky along the right edge of the coat and the shoulder
    el('path', {
      d: `M${n(w * 0.6)} ${n(h * 0.1)}C${n(w * 0.58)} ${n(h * 0.4)} ${n(w * 0.56)} ${n(h * 0.62)} ${n(w * 0.5)} ${n(h * 0.82)}Q${n(w * 0.32)} ${n(h * 0.87)} ${n(w * 0.14)} ${n(h * 0.86)}`,
      stroke: rim,
      'stroke-width': w * 0.06,
      fill: 'none',
      opacity: 0.7,
    }),
  ];
  return el('g', {transform: `translate(${n(t.x)} ${n(yAt(t.depth))}) scale(${n(s)})`}, body);
}

/**
 * The cemetery lamp: an iron post, a lantern with a sodium glow — dead and cracked in the ash.
 * @param {{x: number, depth: number}} t @param {Variant} variant @param {Palette} pal
 */
function lamp(t, variant, pal) {
  const s = 1 / t.depth;
  const y0 = yAt(t.depth);
  const top = (LAMP.y - y0) / s;
  const iron = fogged(pal.iron, t.depth, pal);
  const body = [
    el('ellipse', {cx: 0, cy: 0, rx: 16, ry: 4, fill: fogged(pal.capShade, t.depth, pal)}),
    el('path', {d: `M-5 0L-3.5 ${n(top - 12)}L3.5 ${n(top - 12)}L5 0Z`, fill: iron}),
    el('path', {d: `M-8 0L-8 10L8 10L8 0Z`, fill: iron}),
    el('path', {d: `M-9 ${n(top - 12)}L9 ${n(top - 12)}L12 ${n(top + 14)}L-12 ${n(top + 14)}Z`, fill: iron}),
    el('path', {d: `M-14 ${n(top + 14)}L14 ${n(top + 14)}L0 ${n(top + 24)}Z`, fill: iron}),
  ];
  if (variant === 'snow') {
    body.push(
      el('path', {
        d: `M-7 ${n(top - 9)}L7 ${n(top - 9)}L9.5 ${n(top + 12)}L-9.5 ${n(top + 12)}Z`,
        fill: 'url(#sodium)',
      }),
      el('path', {d: `M-1 ${n(top - 9)}L1 ${n(top - 9)}L1.2 ${n(top + 12)}L-1.2 ${n(top + 12)}Z`, fill: iron}),
      el('path', {d: `M-15 ${n(top + 14)}L15 ${n(top + 14)}L0 ${n(top + 26)}Z`, fill: hex(pal.cap)}),
    );
  } else {
    body.push(
      el('path', {
        d: `M-7 ${n(top - 9)}L7 ${n(top - 9)}L9.5 ${n(top + 12)}L-9.5 ${n(top + 12)}Z`,
        fill: '#1a1210',
      }),
      el('path', {d: `M-6 ${n(top + 8)}L2 ${n(top - 2)}L-1 ${n(top - 8)}`, stroke: '#4a3a32', 'stroke-width': 0.8, fill: 'none'}),
      el('path', {d: `M-15 ${n(top + 14)}L15 ${n(top + 14)}L0 ${n(top + 26)}Z`, fill: hex(pal.cap)}),
    );
  }
  return el('g', {transform: `translate(${n(t.x)} ${n(y0)}) scale(${n(s)})`}, body);
}

/**
 * The iron fence along the foot of the crest: spear-topped palings between stone posts.
 * @param {Palette} pal @param {Variant} variant
 */
function fence(pal, variant) {
  const rng = new Rng(808);
  const strokes = [];
  const rails = [];
  let prev;
  for (let x = OUTSIDE.left; x <= OUTSIDE.right; x += 4.2) {
    const y = crest(x) - 9;
    const d = depthAt(y);
    const bent = variant === 'ash' ? rng.range(-1.2, 1.2) : 0;
    const hh = 13 / (d / 8);
    strokes.push(`M${n(x)} ${n(y)}L${n(x + bent)} ${n(y + hh)}`);
    if (prev) rails.push(`M${n(prev[0])} ${n(prev[1] + prev[2] * 0.82)}L${n(x)} ${n(y + hh * 0.82)}`);
    prev = [x, y, hh];
  }
  const d = depthAt(crest(0) - 9);
  return el('g', {}, [
    el('path', {d: strokes.join(''), stroke: fogged(pal.iron, d, pal), 'stroke-width': 0.9, fill: 'none'}),
    el('path', {d: rails.join(''), stroke: fogged(pal.iron, d, pal), 'stroke-width': 0.8, fill: 'none'}),
  ]);
}

// ---------------------------------------------------------------- sky and ground, per pixel

/**
 * The sky and the slope, per pixel, as a straight RGBA float image.
 * @param {Variant} variant @param {Palette} pal
 */
function base(variant, pal) {
  const img = new Float32Array(W * H * 4);
  const lampDepth = depthAt(-92);
  const rng = new Rng(variant === 'snow' ? 9 : 10);
  for (let py = 0; py < H; py++) {
    const y = OUTSIDE.top - (py + 0.5) / PX;
    for (let px = 0; px < W; px++) {
      const x = OUTSIDE.left + (px + 0.5) / PX;
      const i = (py * W + px) * 4;
      const cy = crest(x);
      /** @type {RGB} */
      let c;
      if (y > cy) {
        // the sky: a gradient from the crest up, the glow of a town (or a fire) beyond the crest
        const t = sat((y - cy) / (OUTSIDE.top - cy));
        c =
          t < 0.25
            ? mixc(pal.horizon, pal.skyLow, t / 0.25)
            : t < 0.6
              ? mixc(pal.skyLow, pal.skyMid, (t - 0.25) / 0.35)
              : mixc(pal.skyMid, pal.skyTop, (t - 0.6) / 0.4);
        const gx = (x - 150) / 210;
        const gy = (y - cy) / 70;
        const glow = Math.exp(-(gx * gx + gy * gy)) * (variant === 'snow' ? 0.55 : 0.9);
        c = mixc(c, pal.glow, sat(glow));
        // clouds or smoke: long bands, billowing upwards in the ash
        const cloud =
          variant === 'snow'
            ? smoothstep(0.52, 0.72, fbm(x * 0.006, y * 0.022, 71, 5)) * smoothstep(60, 140, y) * 0.75
            : smoothstep(0.4, 0.75, fbm(x * 0.008 + y * 0.002, y * 0.012, 72, 6)) * 0.85;
        const cloudLit =
          variant === 'snow' ? smoothstep(0.62, 0.8, fbm(x * 0.006, y * 0.022 - 0.08, 71, 5)) : sat(1 - (y - cy) / 160);
        const cloudC = mixc(pal.cloud, pal.glow, cloudLit * (variant === 'snow' ? 0.18 : 0.42));
        c = mixc(c, cloudC, cloud);
        // stars in the clear sky of the snow
        if (variant === 'snow' && y > 110 && cloud < 0.2 && rng.next() < 0.0009) {
          const b = rng.range(0.4, 1) * smoothstep(110, 220, y);
          c = mixc(c, [0.85, 0.88, 1], b);
        }
      } else {
        // the slope, in ground units: x × depth across, depth up the slope
        const d = depthAt(y);
        const gx = x * d;
        const gz = d * GZ;
        const near = pal.ground;
        const drift = fbm(gx * 0.012, gz * 0.012, 81, 5);
        const ripples = fbm(gx * 0.05, gz * 0.03, 82, 3);
        let shade = 0.78 + (drift - 0.5) * 0.5 + (ripples - 0.5) * 0.12;
        // the slope darkens a little towards the near end, where the window's frame shades it
        shade *= 0.85 + 0.15 * smoothstep(1, 2.5, d);
        c = mixc(pal.groundShade, near, sat(shade));
        // the trodden path: a darker trough with footprints
        const off = Math.abs(gx - pathX(d));
        const inPath = 1 - smoothstep(PATH_W * 0.6, PATH_W, off);
        if (inPath > 0) {
          const steps = fbm(gx * 0.16, gz * 0.16, 83, 2);
          c = mixc(c, mixc(pal.groundShade, near, 0.55 + (steps - 0.5) * 0.4), inPath * 0.8);
        }
        if (variant === 'snow') {
          // the sodium lamp pools orange on the snow around its post
          const lx = gx - LAMP.x * lampDepth;
          const lz = (d - lampDepth) * 120;
          const pool = Math.exp(-(lx * lx + lz * lz) / (2 * 80 * 80));
          c = [c[0] + pool * 0.9, c[1] + pool * 0.48, c[2] + pool * 0.12];
          // the sky's glow along the top of the slope
          c = mixc(c, pal.horizon, smoothstep(cy - 30, cy, y) * 0.3);
        } else {
          // dark burnt patches, and embers glowing in the ash
          const burnt = smoothstep(0.55, 0.7, fbm(gx * 0.008, gz * 0.008, 84, 4));
          c = mixc(c, pal.groundShade, burnt * 0.7);
          const e = emberAt(gx, gz) * (0.35 + burnt);
          c = [c[0] + e * 0.9, c[1] + e * 0.3, c[2] + e * 0.05];
          c = mixc(c, pal.horizon, smoothstep(cy - 40, cy, y) * 0.45);
        }
        c = mixc(c, pal.fog, fogOf(d) * 0.75);
      }
      img[i] = c[0];
      img[i + 1] = c[1];
      img[i + 2] = c[2];
      img[i + 3] = 1;
    }
  }
  return img;
}

/**
 * Everything that stands on the slope, as one SVG over the outside frame.
 * @param {Variant} variant @param {Palette} pal
 */
function thingsSvg(variant, pal) {
  /** @type {string[]} */
  const defs = [
    el('filter', {id: 'soft', x: '-50%', y: '-50%', width: '200%', height: '200%'}, el('feGaussianBlur', {stdDeviation: 2})),
    el('filter', {id: 'glow', x: '-100%', y: '-100%', width: '300%', height: '300%'}, el('feGaussianBlur', {stdDeviation: 9})),
    vgrad('sodium', LAMP.y - 30, LAMP.y + 30, [
      [0, '#ff8a2a'],
      [0.5, '#ffd27a'],
      [1, '#ffb050'],
    ]),
    el('mask', {id: 'crescent', maskUnits: 'userSpaceOnUse', x: -140, y: 190, width: 50, height: 50}, [
      el('rect', {x: -140, y: 190, width: 50, height: 50, fill: '#fff'}),
      el('circle', {cx: -111, cy: 219, r: 12, fill: '#000'}),
    ]),
    rgrad('moonGlow', -118, 214, 60, [
      [0, '#c8c8ff', 0.35],
      [1, '#c8c8ff', 0],
    ]),
    rgrad('lampGlow', LAMP.x, LAMP.y + 2, 46, [
      [0, '#ffb45a', 0.8],
      [0.35, '#ff9030', 0.3],
      [1, '#ff8020', 0],
    ]),
  ];
  /** @type {string[]} */
  const body = [];
  if (variant === 'snow') {
    // the crescent moon in its halo
    body.push(
      el('circle', {cx: -118, cy: 214, r: 60, fill: 'url(#moonGlow)'}),
      el('circle', {cx: -118, cy: 214, r: 13, fill: '#efeefa', mask: 'url(#crescent)'}),
    );
  } else {
    // a dull sun behind the smoke, or what is left of it
    body.push(el('circle', {cx: 150, cy: 120, r: 15, fill: '#d2602e', opacity: 0.55, filter: 'url(#soft)'}));
  }
  body.push(fence(pal, variant));
  for (const t of layoutThings()) {
    if (t.kind === 'figure') {
      if (variant === 'ash') body.push(figure(t, pal));
    } else if (t.kind === 'tree') body.push(tree(t, variant, pal));
    else if (t.kind === 'angel') body.push(angel(t, variant, pal));
    else if (t.kind === 'lamp') {
      body.push(lamp(t, variant, pal));
      if (variant === 'snow') body.push(el('circle', {cx: LAMP.x, cy: LAMP.y + 2, r: 46, fill: 'url(#lampGlow)'}));
    } else body.push(grave(t, variant, pal, defs));
  }
  return worldDoc(defs, body, OUTSIDE);
}

/**
 * One of the two pictures behind the window.
 * @param {Variant} variant
 */
export async function renderOutside(variant) {
  const pal = PALETTES[variant];
  const img = base(variant, pal);
  const things = await rasterize(thingsSvg(variant, pal), W, H);
  // a mottle of weather on the stones, the bark and the coats: darker pixels take more of it
  for (let py = 0, i = 0; py < H; py++) {
    for (let px = 0; px < W; px++, i += 4) {
      if (things[i + 3] === 0) continue;
      const lum = (things[i] + things[i + 1] + things[i + 2]) / 765;
      const m =
        1 + (fbm(px * 0.09, py * 0.09, 91, 4) - 0.5) * 0.55 * (1 - lum * 0.8) + (fbm(px * 0.4, py * 0.4, 92, 2) - 0.5) * 0.14;
      for (let c = 0; c < 3; c++) things[i + c] = Math.max(0, Math.min(255, Math.round(things[i + c] * m)));
    }
  }
  overRGBA(img, things);
  // a faint grain, the same in both pictures so it does not swim during the transition
  const grain = new Rng(4);
  for (let i = 0; i < img.length; i += 4) {
    const g = (grain.next() - 0.5) * 0.025;
    img[i] += g;
    img[i + 1] += g;
    img[i + 2] += g;
  }
  return {image: await encodeWebpRGB(img, W, H), width: W, height: H};
}
