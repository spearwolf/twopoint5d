// stage-masks/spotlight: the second level — an all-night laundromat at 3 a.m., in the same frame as
// Ward C: the same walls, the lamps at the same places, so that the porthole of the mask fits both.
// A checkered linoleum floor with a puddle, a row of dryers built into the north wall (one door
// hanging open), an island of top loaders, and a trail of socks that leads off into the dark.
import {fbm, Rng} from '../../lib/image.mjs';
import {
  blobPath,
  blurFilter,
  el,
  IMG_H,
  IMG_W,
  mixc,
  n,
  over,
  PX,
  rasterize,
  rgb,
  smoothstep,
  svgDoc,
  WORLD,
  wobblyRing,
  X,
  Y,
} from './svg.mjs';
import {FLOOR_BOTTOM, FLOOR_TOP, reflectWall} from './ward-c.mjs';

/** @typedef {import('./svg.mjs').RGB} RGB */

const SQUARE = 30;
const WALL_TOP = 275;

/** the island of top loaders, in units: an obstacle for the player */
export const WASHER_ISLAND = {left: -250, right: 30, bottom: -16, top: 96};
/** the folding table */
export const FOLDING_TABLE = {left: 230, right: 370, bottom: -70, top: -10};

/** @param {number} x @param {number} y @param {number} seed */
function hash(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** how wet the floor is: the puddle from the island and the one in front of the open dryer */
function wetness(/** @type {number} */ u, /** @type {number} */ v) {
  const wobble = fbm(u / 40, v / 40, 91, 4) * 60;
  const a = 1 - smoothstep(70, 120, Math.hypot((u + 130) / 1.6, v + 70) + wobble - 30);
  const b = 1 - smoothstep(40, 80, Math.hypot((u + 60) / 1.2, (v - 140) * 1.4) + wobble - 30);
  return Math.max(a, b);
}

/** @param {number} u @param {number} v @returns {RGB} */
function shadeFloor(u, v) {
  const i = Math.floor(u / SQUARE);
  const j = Math.floor(v / SQUARE);
  const fx = u / SQUARE - i;
  const fy = v / SQUARE - j;
  const edge = Math.min(fx, 1 - fx, fy, 1 - fy) * SQUARE;
  const dark = (i + j) % 2 === 0;
  const h = hash(i, j, 5);
  /** @type {RGB} */
  let col = dark ? mixc(rgb('#2f5f5c'), rgb('#3b6a62'), h) : mixc(rgb('#c9c09c'), rgb('#d6cda8'), h);
  // the linoleum: a fine mottle, worn pale along the edges of the squares and where feet go
  const mottle = fbm(u / 2.2, v / 2.2, 17, 3);
  col = mixc(col, dark ? rgb('#5a807a') : rgb('#a69c78'), mottle * 0.35);
  const worn = smoothstep(0.55, 0.8, fbm(u / 60, v / 30, 19, 4));
  col = mixc(col, rgb('#b3ab8b'), worn * (dark ? 0.35 : 0.15));
  const seam = 1 - smoothstep(0.15, 0.6, edge);
  col = mixc(col, rgb('#2a2c25'), seam * 0.55);
  // dirt and scuffs
  const dirt = fbm(u / 80, v / 80, 23, 5);
  const k = 0.66 + 0.4 * dirt;
  col = [col[0] * k, col[1] * k, col[2] * k];
  const scuff = hash(Math.floor(u / 3), Math.floor(v * 1.4), 29) > 0.995 ? 0.55 : 1;
  col = [col[0] * scuff, col[1] * scuff, col[2] * scuff];
  return col;
}

/** the wet and the shadow at the wall @param {RGB} col @param {number} u @param {number} v @returns {RGB} */
function wetFloor(col, u, v) {
  const w = wetness(u, v);
  let c = mixc(col, rgb('#0d1716'), w * 0.38);
  c = mixc(c, rgb('#3d3524'), (1 - smoothstep(0, 14, Math.abs(w - 0.35) * 40)) * 0.25 * w);
  const shadow = 0.5 + 0.5 * smoothstep(0, 34, FLOOR_TOP - v);
  return [c[0] * shadow, c[1] * shadow, c[2] * shadow];
}

// ---------------------------------------------------------------- the north wall

/** @param {Rng} rng */
function northWall(rng) {
  const out = [];
  const yCap = Y(WALL_TOP);
  const yFloor = Y(FLOOR_TOP);
  out.push(el('rect', {x: 0, y: 0, width: IMG_W, height: yCap, fill: '#131514'}));
  out.push(el('rect', {x: 0, y: yCap - 6, width: IMG_W, height: 6, fill: '#2d302c'}));
  // the wall behind the machines: a dull teal paint, nicotine at the top
  out.push(el('rect', {x: 0, y: yCap, width: IMG_W, height: yFloor - yCap, fill: 'url(#paint)'}));
  // flyers above the dryers, curling
  for (let k = 0; k < 13; k++) {
    const x = X(rng.range(-580, 560));
    if (Math.abs(x - X(-290)) < 120 || Math.abs(x - X(330)) < 80) continue;
    const y = yCap + rng.range(4, 18);
    const w = rng.range(20, 34);
    const h = rng.range(24, 34);
    const lines = [];
    for (let l = 0; l < 4; l++)
      lines.push(
        el('path', {
          d: `M${n(-w / 2 + 4)} ${n(-h / 2 + 12 + l * 4.5)}h${n(rng.range(8, w - 8))}`,
          stroke: '#545049',
          'stroke-width': 1.2,
        }),
      );
    const tabs = [];
    for (let t = 0; t < 5; t++)
      tabs.push(el('path', {d: `M${n(-w / 2 + 3 + (t * (w - 6)) / 5)} ${n(h / 2 - 7)}v7`, stroke: '#8d887a', 'stroke-width': 1}));
    out.push(
      el('g', {transform: `translate(${n(x)} ${n(y + h / 2)}) rotate(${n(rng.range(-6, 6))})`}, [
        el('rect', {x: -w / 2 + 2, y: -h / 2 + 3, width: w, height: h, fill: '#000', opacity: 0.35}),
        el('rect', {x: -w / 2, y: -h / 2, width: w, height: h, fill: rng.pick(['#e2dcc6', '#d8cf9a', '#e7c9c1', '#c9d7d3'])}),
        el('rect', {x: -w / 2 + 4, y: -h / 2 + 3, width: w - 8, height: 6, fill: rng.pick(['#7a2e28', '#2c4a6b', '#3a3a3a'])}),
        ...lines,
        ...tabs,
        el('circle', {cx: 0, cy: -h / 2 + 2, r: 1.6, fill: '#a33'}),
      ]),
    );
  }
  // the dryers, built into the wall
  const top = Y(252);
  const w = 66 * PX;
  const h = yFloor - top;
  for (let x = X(-596); x < IMG_W; x += w + 4) {
    const open = Math.abs(x + w / 2 - X(-60)) < w / 2;
    out.push(...dryer(rng, x, top, w, h, open));
  }
  out.push(el('rect', {x: 0, y: yFloor - 4, width: IMG_W, height: 4, fill: '#0b0d0c'}));
  return out;
}

/**
 * One dryer: a steel front, a coin panel at the top, a round glass door with clothes behind it.
 * @param {Rng} rng @param {number} x @param {number} y @param {number} w @param {number} h @param {boolean} open
 */
function dryer(rng, x, y, w, h, open) {
  const cx = x + w / 2;
  const cy = y + h * 0.6;
  const r = w * 0.34;
  const out = [
    el('rect', {x, y, width: w, height: h, fill: 'url(#steel)', stroke: '#2a2f30', 'stroke-width': 2}),
    el('rect', {x: x + 6, y: y + 6, width: w - 12, height: 20, fill: '#30383a', rx: 2}),
    el('rect', {x: x + 12, y: y + 11, width: 18, height: 9, fill: '#0c1110'}),
    el('path', {
      d: `M${n(x + 14)} ${n(y + 16)}h4m3 0h4m3 0h3`,
      stroke: '#c4472a',
      'stroke-width': 2,
      opacity: rng.next() < 0.7 ? 0.9 : 0.2,
    }),
    el('rect', {x: x + w - 34, y: y + 9, width: 22, height: 14, fill: '#9aa1a2', rx: 2}),
    el('rect', {x: x + w - 26, y: y + 12, width: 6, height: 8, fill: '#151818'}),
  ];
  if (!open) {
    const clothes = [];
    for (let c = 0; c < 6; c++) {
      const pts = wobblyRing(
        rng,
        cx + rng.range(-r * 0.5, r * 0.5),
        cy + rng.range(-r * 0.1, r * 0.6),
        rng.range(8, 16),
        rng.range(6, 12),
        0.4,
        7,
      );
      clothes.push(
        el('path', {d: blobPath(pts), fill: rng.pick(['#5d2b31', '#2f4562', '#7c7a6c', '#3e5b3b', '#8a6a3c']), opacity: 0.85}),
      );
    }
    out.push(
      el('circle', {cx, cy, r: r + 7, fill: '#cfd5d6', stroke: '#4a5052', 'stroke-width': 2}),
      el('circle', {cx, cy, r, fill: '#121718'}),
      el('g', {'clip-path': `circle(${n(r)}px at ${n(cx)}px ${n(cy)}px)`}, clothes),
      el('circle', {cx, cy, r, fill: 'url(#glass)'}),
      el('rect', {x: cx + r + 2, y: cy - 8, width: 6, height: 16, fill: '#7d8486', rx: 2}),
    );
    return out;
  }
  // the open one: a dark drum, the door hanging off to the side, a sock over the rim
  out.push(
    el('circle', {cx, cy, r: r + 3, fill: '#2b3031'}),
    el('circle', {cx, cy, r, fill: 'url(#drum)'}),
    el('path', {
      d: `M${n(cx - 4)} ${n(cy + r - 6)} c 4 14 -2 24 6 34 c 6 6 14 4 16 -2`,
      stroke: '#b23a32',
      'stroke-width': 9,
      fill: 'none',
      'stroke-linecap': 'round',
    }),
    el('path', {
      d: `M${n(cx - 4)} ${n(cy + r)} c 4 10 0 18 4 26`,
      stroke: '#e8e2d2',
      'stroke-width': 2,
      fill: 'none',
      opacity: 0.6,
    }),
    el('ellipse', {cx: cx - r - 18, cy, rx: 12, ry: r + 7, fill: '#9ca3a5', stroke: '#3c4244', 'stroke-width': 2}),
    el('ellipse', {cx: cx - r - 16, cy, rx: 7, ry: r, fill: '#1b2324'}),
  );
  return out;
}

// ---------------------------------------------------------------- the room

/**
 * A top loader seen from above: the console at the back, the lid in the middle.
 * @param {Rng} rng @param {number} x @param {number} y the top left, px @param {number} s px @param {boolean} facingSouth
 */
function topLoader(rng, x, y, s, facingSouth) {
  const consoleY = facingSouth ? y + 4 : y + s - 30;
  const lidY = facingSouth ? y + 34 : y + 8;
  const dials = [];
  for (let k = 0; k < 3; k++) {
    const dx = x + 22 + k * 26;
    dials.push(el('circle', {cx: dx, cy: consoleY + 13, r: 7, fill: '#d9d6cd', stroke: '#55534c', 'stroke-width': 1.5}));
    const a = rng.range(0, Math.PI * 2);
    dials.push(
      el('path', {
        d: `M${n(dx)} ${n(consoleY + 13)}l${n(Math.cos(a) * 6)} ${n(Math.sin(a) * 6)}`,
        stroke: '#2b2a26',
        'stroke-width': 1.5,
      }),
    );
  }
  return [
    el('rect', {x: x + 4, y: y + 8, width: s, height: s, rx: 8, fill: '#000', opacity: 0.5, filter: 'url(#blur4)'}),
    el('rect', {x, y, width: s - 2, height: s - 2, rx: 8, fill: 'url(#enamel)', stroke: '#6f6b60', 'stroke-width': 2}),
    el('rect', {
      x: x + 6,
      y: consoleY,
      width: s - 14,
      height: 26,
      rx: 4,
      fill: '#bab5a6',
      stroke: '#79756a',
      'stroke-width': 1.5,
    }),
    ...dials,
    el('rect', {x: x + s - 48, y: consoleY + 6, width: 34, height: 14, fill: '#8d9292', rx: 2}),
    el('rect', {
      x: x + 10,
      y: lidY,
      width: s - 22,
      height: s - 46,
      rx: 10,
      fill: '#ece8dc',
      stroke: '#8f8b7f',
      'stroke-width': 1.5,
    }),
    el('path', {d: `M${n(x + 18)} ${n(lidY + (facingSouth ? 4 : s - 50))}h${n(s - 38)}`, stroke: '#a5a194', 'stroke-width': 2}),
    el('ellipse', {cx: x + s / 2, cy: lidY + (s - 46) / 2, rx: 20, ry: 10, fill: '#fff', opacity: 0.25}),
  ];
}

/** @param {Rng} rng */
function washerIsland(rng) {
  const out = [];
  const s = 56 * PX;
  const {left, top} = WASHER_ISLAND;
  out.push(
    el('rect', {
      x: X(left) - 8,
      y: Y(top) - 6,
      width: 5 * s + 12,
      height: 2 * s + 12,
      fill: '#000',
      opacity: 0.5,
      filter: 'url(#blur8)',
    }),
  );
  for (let k = 0; k < 5; k++) {
    out.push(...topLoader(rng, X(left) + k * s, Y(top), s, false));
    out.push(...topLoader(rng, X(left) + k * s, Y(top) + s, s, true));
  }
  return out;
}

/** a sock lying on the floor; `colours` the body, the heel and toe, the stripes */
function sock(
  /** @type {number} */ x,
  /** @type {number} */ y,
  /** @type {number} */ rot,
  /** @type {string[]} */ colours,
  wet = false,
) {
  const [body, heel, stripe] = colours;
  const d = 'M-22 -8 L6 -8 C14 -8 18 -4 20 2 L24 14 C26 22 18 26 12 22 L4 8 L-22 8 Z';
  return el('g', {transform: `translate(${n(x)} ${n(y)}) rotate(${n(rot)})`, opacity: wet ? 0.8 : 1}, [
    el('path', {d, fill: '#000', opacity: 0.4, transform: 'translate(2 3)', filter: 'url(#blur2)'}),
    el('path', {d, fill: body, stroke: '#1d1c1a', 'stroke-width': 1}),
    el('path', {d: 'M-22 -8 h8 v16 h-8 z', fill: stripe}),
    el('path', {d: 'M12 22 C18 26 26 22 24 14 L21 6 C16 10 12 14 12 22 Z', fill: heel}),
    el('path', {d: 'M-10 -8 v16 M-6 -8 v16', stroke: stripe, 'stroke-width': 2}),
    wet ? el('path', {d, fill: '#0d1716', opacity: 0.4}) : '',
  ]);
}

/** The socks, from the open dryer across the floor into the dark, ever further apart. @param {Rng} rng */
function sockTrail(rng) {
  const palette = [
    ['#e9e5da', '#9a988f', '#b23a32'],
    ['#b23a32', '#e2ddd0', '#e2ddd0'],
    ['#2c3a2c', '#7f9a5a', '#c9b36a'],
    ['#202124', '#4a4b50', '#4a4b50'],
    ['#e9e5da', '#c3bfb2', '#3a5c8a'],
  ];
  const out = [];
  let t = 0;
  let gap = 18;
  for (let k = 0; k < 15; k++) {
    // a lazy curve from (-60, 150) to (560, -270)
    const u = -60 + t * 620 + Math.sin(t * 5) * 60;
    const v = 150 - t * 420 + Math.sin(t * 7 + 1) * 30;
    t += gap / 700;
    gap *= 1.17;
    if (
      u > WASHER_ISLAND.left - 20 &&
      u < WASHER_ISLAND.right + 20 &&
      v > WASHER_ISLAND.bottom - 20 &&
      v < WASHER_ISLAND.top + 20
    )
      continue;
    out.push(sock(X(u), Y(v), rng.range(-180, 180) + t * 90, palette[k % palette.length], k > 9));
  }
  return out;
}

function foldingTable() {
  const {left, right, top, bottom} = FOLDING_TABLE;
  const x = X(left);
  const y = Y(top);
  const w = (right - left) * PX;
  const h = (top - bottom) * PX;
  const weave = [];
  for (let k = 0; k < 7; k++) weave.push(el('path', {d: `M${n(-44 + k * 14)} -32 v64`, stroke: '#1f3f6b', 'stroke-width': 3}));
  for (let k = 0; k < 5; k++) weave.push(el('path', {d: `M-48 ${n(-24 + k * 12)} h96`, stroke: '#1f3f6b', 'stroke-width': 3}));
  return [
    el('rect', {x: x + 8, y: y + 12, width: w, height: h, fill: '#000', opacity: 0.55, filter: 'url(#blur8)'}),
    el('rect', {x, y, width: w, height: h, rx: 4, fill: '#8f6d47', stroke: '#3d2c1b', 'stroke-width': 2}),
    el('rect', {x: x + 4, y: y + 4, width: w - 8, height: 5, fill: '#b48d62', opacity: 0.6}),
    // a stack of folded towels
    el('rect', {x: x + 30, y: y + 20, width: 70, height: 50, rx: 6, fill: '#c97d6a', stroke: '#6e3a2e', 'stroke-width': 1.5}),
    el('rect', {x: x + 34, y: y + 24, width: 62, height: 42, rx: 5, fill: '#d68e7b'}),
    el('path', {d: `M${n(x + 34)} ${n(y + 45)}h62`, stroke: '#9c5444', 'stroke-width': 1.5}),
    // the basket, tipped over at the edge
    el('g', {transform: `translate(${n(x + w - 70)} ${n(y + h / 2)}) rotate(18)`}, [
      el('rect', {x: -50, y: -36, width: 100, height: 72, rx: 10, fill: '#2f5a94', stroke: '#16304f', 'stroke-width': 3}),
      ...weave,
      el('rect', {x: -50, y: -36, width: 100, height: 72, rx: 10, fill: 'none', stroke: '#4a78b8', 'stroke-width': 2}),
    ]),
    // spilled blue detergent
    el('path', {
      d: blobPath([
        [x + 120, y + h + 4],
        [x + 160, y + h + 10],
        [x + 150, y + h + 40],
        [x + 110, y + h + 30],
      ]),
      fill: '#3aa0c4',
      opacity: 0.55,
    }),
  ];
}

/** @param {Rng} rng */
function chairs(rng) {
  const out = [];
  for (let k = 0; k < 4; k++) {
    const x = X(-470 + k * 62);
    const y = Y(-222);
    const rot = rng.range(-8, 8) + (k === 2 ? 28 : 0);
    out.push(
      el('g', {transform: `translate(${n(x)} ${n(y)}) rotate(${n(rot)})`}, [
        el('rect', {x: -40, y: -34, width: 84, height: 78, rx: 18, fill: '#000', opacity: 0.45, filter: 'url(#blur4)'}),
        el('rect', {x: -42, y: -38, width: 84, height: 72, rx: 18, fill: '#c25a28', stroke: '#5c2510', 'stroke-width': 2}),
        el('rect', {x: -36, y: -32, width: 72, height: 46, rx: 14, fill: '#d36a35'}),
        el('rect', {x: -42, y: 18, width: 84, height: 16, rx: 7, fill: '#a84b20'}),
        el('ellipse', {cx: -10, cy: -14, rx: 20, ry: 8, fill: '#fff', opacity: 0.18}),
      ]),
    );
  }
  return out;
}

/** a wire cart with a heap of clothes @param {Rng} rng */
function cart(rng) {
  const x = X(-430);
  const y = Y(-60);
  const wires = [];
  for (let k = -3; k <= 3; k++) wires.push(el('path', {d: `M${k * 14} -44 v88`, stroke: '#9ea6a8', 'stroke-width': 1.5}));
  for (let k = -2; k <= 2; k++) wires.push(el('path', {d: `M-48 ${k * 16} h96`, stroke: '#9ea6a8', 'stroke-width': 1.5}));
  const heap = [];
  for (let k = 0; k < 9; k++) {
    const pts = wobblyRing(rng, rng.range(-26, 26), rng.range(-22, 22), rng.range(12, 22), rng.range(9, 16), 0.4, 8);
    heap.push(
      el('path', {
        d: blobPath(pts),
        fill: rng.pick(['#5b6e8f', '#d8d2c2', '#7a3b3b', '#4a5b44', '#b7a37a']),
        stroke: '#1d1c1a',
        'stroke-width': 1,
      }),
    );
  }
  return [
    el('g', {transform: `translate(${n(x)} ${n(y)}) rotate(-9)`}, [
      el('rect', {x: -46, y: -40, width: 104, height: 96, fill: '#000', opacity: 0.45, filter: 'url(#blur8)'}),
      el('rect', {x: -50, y: -46, width: 100, height: 92, fill: '#1b1e1f', opacity: 0.6}),
      ...wires,
      ...heap,
      el('rect', {x: -50, y: -46, width: 100, height: 92, fill: 'none', stroke: '#c5ccce', 'stroke-width': 4}),
      el('path', {d: 'M-50 -46 l-16 -10 M50 -46 l16 -10', stroke: '#c5ccce', 'stroke-width': 4}),
    ]),
  ];
}

/** the yellow "wet floor" sign, folded open */
function wetFloorSign() {
  const x = X(120);
  const y = Y(-150);
  return el('g', {transform: `translate(${n(x)} ${n(y)}) rotate(-22)`}, [
    el('rect', {x: -30, y: -22, width: 70, height: 56, fill: '#000', opacity: 0.45, filter: 'url(#blur4)'}),
    el('path', {d: 'M-34 -24 L0 -26 L0 26 L-34 24 Z', fill: '#d4a91f', stroke: '#5c4708', 'stroke-width': 2}),
    el('path', {d: 'M0 -26 L34 -24 L34 24 L0 26 Z', fill: '#e8c033', stroke: '#5c4708', 'stroke-width': 2}),
    el('path', {d: 'M0 -26 V26', stroke: '#fff2b0', 'stroke-width': 2}),
    // the little falling man on one side
    el('circle', {cx: 16, cy: -10, r: 3.5, fill: '#1d1a12'}),
    el('path', {
      d: 'M14 -5 L10 6 L18 14 M10 6 L4 12 M12 0 L22 2',
      stroke: '#1d1a12',
      'stroke-width': 2.5,
      fill: 'none',
      'stroke-linecap': 'round',
    }),
  ]);
}

/** lint, coins, a dryer sheet @param {Rng} rng */
function litter(rng) {
  const out = [];
  for (let k = 0; k < 18; k++) {
    const x = X(rng.range(-560, 560));
    const y = Y(rng.range(-240, 160));
    const pts = wobblyRing(rng, x, y, rng.range(4, 9), rng.range(3, 7), 0.5, 9);
    out.push(el('path', {d: blobPath(pts), fill: '#8b8f96', opacity: 0.7}));
  }
  for (let k = 0; k < 6; k++) {
    const x = X(rng.range(-300, 300));
    const y = Y(rng.range(-220, -40));
    out.push(el('circle', {cx: x, cy: y, r: 4.5, fill: '#a8946a', stroke: '#5c4f33', 'stroke-width': 1}));
    out.push(el('circle', {cx: x - 1.2, cy: y - 1.2, r: 1.4, fill: '#f2e6c4'}));
  }
  out.push(
    el('rect', {
      x: X(-200),
      y: Y(-130),
      width: 40,
      height: 30,
      fill: '#efece4',
      opacity: 0.8,
      transform: `rotate(24 ${n(X(-180))} ${n(Y(-145))})`,
    }),
  );
  return out;
}

function southWall() {
  const y = Y(FLOOR_BOTTOM);
  return [
    el('rect', {x: 0, y: y - 14, width: IMG_W, height: 16, fill: '#000', opacity: 0.4, filter: 'url(#blur4)'}),
    el('rect', {x: 0, y, width: IMG_W, height: IMG_H - y, fill: '#121413'}),
    el('rect', {x: 0, y, width: IMG_W, height: 4, fill: '#4c514d'}),
    el('rect', {x: 0, y: y + 4, width: IMG_W, height: 10, fill: '#1f2321'}),
  ];
}

function defs() {
  return [
    blurFilter('blur2', 2),
    blurFilter('blur4', 4),
    blurFilter('blur8', 8),
    el('linearGradient', {id: 'paint', x1: 0, y1: 0, x2: 0, y2: 1}, [
      el('stop', {offset: 0, 'stop-color': '#3b3a2a'}),
      el('stop', {offset: 0.4, 'stop-color': '#3f5a55'}),
      el('stop', {offset: 1, 'stop-color': '#2f4642'}),
    ]),
    el('linearGradient', {id: 'steel', x1: 0, y1: 0, x2: 1, y2: 0}, [
      el('stop', {offset: 0, 'stop-color': '#6f777a'}),
      el('stop', {offset: 0.45, 'stop-color': '#a7afb1'}),
      el('stop', {offset: 1, 'stop-color': '#5f676a'}),
    ]),
    el('radialGradient', {id: 'glass', cx: 0.35, cy: 0.3, r: 0.8}, [
      el('stop', {offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.35}),
      el('stop', {offset: 0.25, 'stop-color': '#fff', 'stop-opacity': 0.05}),
      el('stop', {offset: 1, 'stop-color': '#000', 'stop-opacity': 0.4}),
    ]),
    el('radialGradient', {id: 'drum', cx: 0.5, cy: 0.5, r: 0.5}, [
      el('stop', {offset: 0, 'stop-color': '#000'}),
      el('stop', {offset: 0.7, 'stop-color': '#0b0e0f'}),
      el('stop', {offset: 1, 'stop-color': '#3a4244'}),
    ]),
    el('linearGradient', {id: 'enamel', x1: 0, y1: 0, x2: 1, y2: 1}, [
      el('stop', {offset: 0, 'stop-color': '#efebdf'}),
      el('stop', {offset: 1, 'stop-color': '#c9c4b5'}),
    ]),
  ];
}

/** @returns {Promise<Float32Array>} */
export async function renderLaundromat() {
  const rng = new Rng(2403);
  const img = new Float32Array(IMG_W * IMG_H * 3);
  for (let py = 0; py < IMG_H; py++) {
    for (let px = 0; px < IMG_W; px++) {
      const u = (px + 0.5) / PX + WORLD.left;
      const v = WORLD.top - (py + 0.5) / PX;
      let c = shadeFloor(u, v);
      if (v < FLOOR_TOP && v > FLOOR_BOTTOM) c = wetFloor(c, u, v);
      const i = (py * IMG_W + px) * 3;
      img[i] = c[0];
      img[i + 1] = c[1];
      img[i + 2] = c[2];
    }
  }
  const body = [
    ...northWall(rng),
    ...southWall(),
    ...litter(rng),
    ...sockTrail(rng),
    ...chairs(rng),
    ...cart(rng),
    ...washerIsland(rng),
    ...foldingTable(),
    wetFloorSign(),
  ];
  over(img, await rasterize(svgDoc(IMG_W, IMG_H, defs(), body), IMG_W, IMG_H));
  reflectWall(img);
  return img;
}
