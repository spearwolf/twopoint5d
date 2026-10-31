// stage-masks/rift: the two rooms of "Deep Listening", side on and in one frame. The control room
// of an old radio-telescope station at night — racks with a tape recorder, three oscilloscopes on
// the desk, a mug of cold coffee, a desk lamp, a window onto the dish — and the same room as it is
// wherever the signal comes from: drowned, overgrown, lit by what lives in it. Both share every
// shape; the drowned one is the night one with its colours turned to the deep and things grown
// over it. The window is see-through in both: the demo lays the sky or the deep behind it.
//
// Each room is drawn in three passes: an albedo pass (SVG) multiplied by a light map worked out
// per pixel, an emissive pass laid over it unlit, and a glow pass added as light.
import {fbm, Rng} from '../../lib/image.mjs';
import {
  addLight,
  blobPath,
  blurFilter,
  box,
  DESK_Y,
  el,
  FLOOR_Y,
  IMG_H,
  IMG_W,
  KELP,
  LAMP,
  lerp,
  MULLION_W,
  MULLIONS,
  n,
  overRGBA,
  PX,
  poly,
  REEL_R,
  REELS,
  rasterize,
  rgb,
  rgrad,
  SCOPES,
  smoothstep,
  toFloat,
  vgrad,
  WINDOW,
  WORLD,
  worldDoc,
} from './kit.mjs';

/** @typedef {{drowned: boolean, c: (hex: string) => string}} Theme */

/** A night colour as the deep sees it: most of its colour gone, the rest turned to teal and darker. */
function drownHex(/** @type {string} */ hex) {
  const [r, g, b] = rgb(hex);
  const l = 0.3 * r + 0.55 * g + 0.15 * b;
  const m = (/** @type {number} */ v, /** @type {number} */ k) => Math.round(Math.min(1, lerp(v, l, 0.7) * k) * 255);
  const out = [m(r, 0.55), m(g, 0.92), m(b, 1.0)];
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** @param {boolean} drowned @returns {Theme} */
const theme = (drowned) => ({drowned, c: drowned ? drownHex : (hex) => hex});

const defs = [
  blurFilter('b1', 0.6),
  blurFilter('b2', 1.5),
  blurFilter('b4', 3),
  blurFilter('b8', 7),
  blurFilter('b16', 14),
  blurFilter('b30', 26),
];

// ---------------------------------------------------------------- the room, shared by both

/** The wall with the window cut out, the wainscot, the ceiling, the floor. @param {Theme} T @param {Rng} rng */
function shell(T, rng) {
  const {c} = T;
  const out = [];
  out.push(
    vgrad('wallGrad', 250, -70, [
      [0, c('#2e2620')],
      [0.4, c('#4b3c2d')],
      [1, c('#55432f')],
    ]),
  );
  // the wall, with holes for the panes of the window (even-odd)
  const W = WORLD;
  let d = `M${W.left} ${W.bottom}H${W.right}V${W.top}H${W.left}Z`;
  const panes = paneRects();
  for (const p of panes) d += `M${p.x0} ${p.y0}V${p.y1}H${p.x1}V${p.y0}Z`;
  out.push(el('path', {d, fill: 'url(#wallGrad)', 'fill-rule': 'evenodd'}));
  // a faint stripe of old paper on the upper wall
  for (let x = W.left; x < W.right; x += 24) {
    if (x > WINDOW.left - 30 && x < WINDOW.right + 30) continue;
    out.push(box(x, -70, x + 2, 245, {fill: c('#3a2e22'), opacity: 0.5}));
  }
  // stains and patches of the plaster
  for (let i = 0; i < 9; i++) {
    const x = rng.range(-590, 590);
    const y = rng.range(-40, 230);
    if (x > WINDOW.left - 20 && x < WINDOW.right + 20 && y > WINDOW.bottom - 20) continue;
    out.push(
      el('ellipse', {
        cx: x,
        cy: y,
        rx: rng.range(20, 60),
        ry: rng.range(12, 40),
        fill: c('#2a2017'),
        opacity: 0.25,
        filter: 'url(#b16)',
      }),
    );
  }
  // the wainscot: rails, stiles and panels of dark wood
  out.push(box(W.left, FLOOR_Y, W.right, -70, {fill: c('#3a2416')}));
  out.push(box(W.left, -78, W.right, -66, {fill: c('#4d311d')}));
  out.push(box(W.left, -80, W.right, -78, {fill: c('#1b100a')}));
  for (let x = W.left + 10; x < W.right; x += 90) {
    out.push(box(x + 8, FLOOR_Y + 26, x + 82, -92, {fill: c('#331f12'), stroke: c('#22140b'), 'stroke-width': 2}));
    out.push(box(x + 14, FLOOR_Y + 32, x + 76, -98, {fill: 'none', stroke: c('#4a2f1c'), 'stroke-width': 1.2}));
  }
  // the ceiling, a beam, a conduit with its brackets
  out.push(box(W.left, 248, W.right, W.top, {fill: c('#16110d')}));
  out.push(box(W.left, 244, W.right, 250, {fill: c('#2b2119')}));
  out.push(box(W.left, 229, W.right, 235, {fill: c('#5b5850'), stroke: c('#2b2925'), 'stroke-width': 1}));
  for (let x = W.left + 40; x < W.right; x += 140) out.push(box(x, 226, x + 6, 238, {fill: c('#2f2d29')}));
  // a fluorescent fixture, off, hanging on two chains
  out.push(
    el('path', {d: 'M-235 248V218M-95 248V218', stroke: c('#3a3631'), 'stroke-width': 1.5, 'stroke-dasharray': '2 1.5'}),
    box(-250, 206, -80, 220, {fill: c('#5e5a50'), stroke: c('#26231f'), 'stroke-width': 1.5}),
    box(-246, 200, -84, 207, {fill: c('#8d8a80'), opacity: 0.9}),
  );
  // the floor: linoleum seen from a little above, a skirting board
  out.push(
    vgrad('floorGrad', FLOOR_Y, W.bottom, [
      [0, c('#3a3026')],
      [1, c('#1b1712')],
    ]),
  );
  out.push(box(W.left, W.bottom, W.right, FLOOR_Y, {fill: 'url(#floorGrad)'}));
  for (let k = 0; k < 7; k++) {
    const y = FLOOR_Y - 4 - k * k * 2.6;
    out.push(box(W.left, y - 0.8, W.right, y, {fill: c('#14100c'), opacity: 0.6}));
  }
  for (let x = W.left; x < W.right; x += 46) {
    out.push(
      el('path', {
        d: `M${x} ${FLOOR_Y}L${x + (x - 0) * 0.35} ${W.bottom}`,
        stroke: c('#14100c'),
        'stroke-width': 0.8,
        opacity: 0.6,
      }),
    );
  }
  out.push(box(W.left, FLOOR_Y, W.right, FLOOR_Y + 12, {fill: c('#24170e')}));
  out.push(box(W.left, FLOOR_Y + 12, W.right, FLOOR_Y + 14, {fill: c('#4a311f')}));
  return out;
}

/** The panes of the window: between the frame and the mullions. */
function paneRects() {
  const xs = [WINDOW.left, ...MULLIONS.flatMap((m) => [m - MULLION_W / 2, m + MULLION_W / 2]), WINDOW.right];
  const out = [];
  for (let i = 0; i < xs.length; i += 2) out.push({x0: xs[i], x1: xs[i + 1], y0: WINDOW.bottom, y1: WINDOW.top});
  return out;
}

/** The frame of the window, its mullions and sill. @param {Theme} T */
function windowFrame(T) {
  const {c} = T;
  const out = [];
  const f = c('#2c241c');
  const hi = c('#5b4a38');
  out.push(
    box(WINDOW.left - 12, WINDOW.top, WINDOW.right + 12, WINDOW.top + 12, {fill: f}),
    box(WINDOW.left - 12, WINDOW.bottom - 6, WINDOW.left, WINDOW.top, {fill: f}),
    box(WINDOW.right, WINDOW.bottom - 6, WINDOW.right + 12, WINDOW.top, {fill: f}),
    box(WINDOW.left - 22, WINDOW.bottom - 16, WINDOW.right + 22, WINDOW.bottom - 4, {fill: c('#4b3a2a')}),
    box(WINDOW.left - 22, WINDOW.bottom - 6, WINDOW.right + 22, WINDOW.bottom - 4, {fill: hi}),
    box(WINDOW.left - 22, WINDOW.bottom - 20, WINDOW.right + 22, WINDOW.bottom - 16, {fill: c('#1a130d')}),
  );
  for (const m of MULLIONS) out.push(box(m - MULLION_W / 2, WINDOW.bottom, m + MULLION_W / 2, WINDOW.top, {fill: f}));
  // a transom bar across all three panes
  out.push(box(WINDOW.left, 148, WINDOW.right, 154, {fill: f}));
  out.push(box(WINDOW.left, 153, WINDOW.right, 154, {fill: hi, opacity: 0.6}));
  return out;
}

/** The two racks: tape recorder, VU meters, a receiver, a patch bay, a chart recorder. @param {Theme} T @param {Rng} rng */
function racks(T, rng) {
  const {c} = T;
  const out = [];
  const L = -592;
  const R = -332;
  out.push(box(L - 6, FLOOR_Y, R + 6, 182, {fill: c('#1d1f20')}));
  out.push(box(L, FLOOR_Y + 4, R, 176, {fill: c('#2a2d2f')}));
  out.push(box(L - 6, 178, R + 6, 186, {fill: c('#3b3e40')}));
  // the tape deck: a brushed panel, the reels are sprites of the demo; their shadows and spindles here
  out.push(
    vgrad('deckGrad', 170, 66, [
      [0, c('#9a917c')],
      [1, c('#6c6556')],
    ]),
  );
  out.push(box(L + 4, 68, R - 4, 172, {fill: 'url(#deckGrad)', stroke: c('#2c2924'), 'stroke-width': 1.5}));
  for (let y = 70; y < 170; y += 2.2) out.push(box(L + 5, y, R - 5, y + 0.6, {fill: c('#ffffff'), opacity: 0.035}));
  for (const r of REELS) {
    out.push(el('circle', {cx: r.x + 3, cy: r.y - 4, r: REEL_R + 2, fill: c('#1a1712'), opacity: 0.55, filter: 'url(#b4)'}));
    out.push(el('circle', {cx: r.x, cy: r.y, r: 5, fill: c('#cfcab8')}));
  }
  // the tape path past the heads
  const hx = (REELS[0].x + REELS[1].x) / 2;
  out.push(
    box(hx - 22, 78, hx + 22, 100, {fill: c('#3c3a35'), stroke: c('#1c1b18'), 'stroke-width': 1}),
    el('path', {
      d: `M${REELS[0].x - 6} ${REELS[0].y - 30}L${hx - 26} 96L${hx + 26} 96L${REELS[1].x + 6} ${REELS[1].y - 30}`,
      stroke: c('#2b1c12'),
      'stroke-width': 1.6,
      fill: 'none',
    }),
    el('circle', {cx: hx - 26, cy: 96, r: 4, fill: c('#b9b4a4')}),
    el('circle', {cx: hx + 26, cy: 96, r: 4, fill: c('#b9b4a4')}),
  );
  // transport keys
  for (let i = 0; i < 5; i++) out.push(box(L + 70 + i * 22, 72, L + 88 + i * 22, 80, {fill: c(i === 1 ? '#7a2a1c' : '#2b2a27')}));
  // VU meters (faces are emissive)
  out.push(box(L + 4, 14, R - 4, 62, {fill: c('#3b3d3c'), stroke: c('#1b1c1c'), 'stroke-width': 1.5}));
  for (const x of [-520, -404]) out.push(box(x - 34, 20, x + 34, 56, {fill: c('#1a1a17'), rx: 2}));
  // the receiver: a long dial window (emissive), a big tuning knob, small knobs
  out.push(box(L + 4, -62, R - 4, 8, {fill: c('#4a4c4a'), stroke: c('#1b1c1c'), 'stroke-width': 1.5}));
  out.push(box(L + 16, -22, R - 70, 0, {fill: c('#14130f'), rx: 2}));
  out.push(el('circle', {cx: R - 36, cy: -24, r: 22, fill: c('#222'), stroke: c('#5a5a58'), 'stroke-width': 2}));
  out.push(el('circle', {cx: R - 36, cy: -24, r: 14, fill: c('#323232')}));
  out.push(el('path', {d: `M${R - 36} ${-24}L${R - 26} ${-14}`, stroke: c('#a8a8a0'), 'stroke-width': 2}));
  for (let i = 0; i < 6; i++) {
    const x = L + 26 + i * 26;
    out.push(el('circle', {cx: x, cy: -44, r: 7, fill: c('#1e1e1e'), stroke: c('#6a6a66'), 'stroke-width': 1}));
    const a = rng.range(-2.4, 2.4);
    out.push(
      el('path', {d: `M${x} -44L${n(x + Math.sin(a) * 6)} ${n(-44 + Math.cos(a) * 6)}`, stroke: c('#d0ccc0'), 'stroke-width': 1}),
    );
  }
  // the patch bay, cables in arcs
  out.push(box(L + 4, -98, R - 4, -66, {fill: c('#303231'), stroke: c('#1b1c1c'), 'stroke-width': 1.5}));
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 20; i++) out.push(el('circle', {cx: L + 16 + i * 12, cy: -76 - row * 12, r: 2.4, fill: c('#0b0b0b')}));
  const cableColours = ['#7a2418', '#1c3a5c', '#9a7a1c', '#2a2a2a', '#5a1c4a'];
  for (let k = 0; k < 6; k++) {
    const x0 = L + 16 + rng.int(0, 19) * 12;
    const x1 = L + 16 + rng.int(0, 19) * 12;
    const y0 = -76 - rng.int(0, 1) * 12;
    const y1 = -76 - rng.int(0, 1) * 12;
    const sag = rng.range(30, 70);
    out.push(
      el('path', {
        d: `M${x0} ${y0}C${x0} ${y0 - sag} ${x1} ${y1 - sag} ${x1} ${y1}`,
        stroke: c(cableColours[k % cableColours.length]),
        'stroke-width': 2.4,
        fill: 'none',
        'stroke-linecap': 'round',
      }),
    );
  }
  // a chart recorder: a drum of paper and a pen
  out.push(box(L + 4, -172, R - 4, -104, {fill: c('#454744'), stroke: c('#1b1c1c'), 'stroke-width': 1.5}));
  out.push(box(L + 20, -160, R - 20, -116, {fill: c('#d8d0b8')}));
  let d = '';
  for (let x = L + 22; x < R - 22; x += 2) {
    const y = -138 + Math.sin(x * 0.11) * 6 + Math.sin(x * 0.37) * 3 + (x > -470 && x < -440 ? Math.sin(x * 0.9) * 14 : 0);
    d += `${d ? 'L' : 'M'}${n(x)} ${n(y)}`;
  }
  out.push(el('path', {d, stroke: c('#8a1c14'), 'stroke-width': 1, fill: 'none'}));
  for (let y = -156; y < -116; y += 8) out.push(box(L + 20, y, R - 20, y + 0.5, {fill: c('#7a8a9a'), opacity: 0.5}));
  // the base: a vent grille
  out.push(box(L + 4, FLOOR_Y + 6, R - 4, -178, {fill: c('#262828')}));
  for (let y = FLOOR_Y + 12; y < -182; y += 5) out.push(box(L + 14, y, R - 14, y + 2, {fill: c('#121313')}));
  // rack screws
  for (const y of [170, 60, 4, -66, -104, -176]) {
    out.push(
      el('circle', {cx: L + 4, cy: y, r: 1.6, fill: c('#8a8a86')}),
      el('circle', {cx: R - 4, cy: y, r: 1.6, fill: c('#8a8a86')}),
    );
  }
  return out;
}

/** The desk and what stands on it. @param {Theme} T @param {Rng} rng */
function desk(T, rng) {
  const {c} = T;
  const out = [];
  const L = -330;
  const R = 222;
  // the desk: a top, a block of drawers at the left, a leg at the right, a modesty panel
  out.push(box(L + 6, FLOOR_Y, R - 6, DESK_Y - 10, {fill: c('#22180f')}));
  out.push(box(L, FLOOR_Y, L + 104, DESK_Y - 10, {fill: c('#46321f'), stroke: c('#1c130b'), 'stroke-width': 1.5}));
  for (let i = 0; i < 3; i++) {
    const y0 = FLOOR_Y + 8 + i * 40;
    out.push(box(L + 6, y0, L + 98, y0 + 34, {fill: c('#523a24'), stroke: c('#22170d'), 'stroke-width': 1.2}));
    out.push(box(L + 38, y0 + 15, L + 66, y0 + 19, {fill: c('#a09070'), rx: 2}));
  }
  out.push(box(R - 22, FLOOR_Y, R - 6, DESK_Y - 10, {fill: c('#46321f'), stroke: c('#1c130b'), 'stroke-width': 1.2}));
  out.push(box(L - 4, DESK_Y - 10, R + 4, DESK_Y, {fill: c('#6d5038'), stroke: c('#2a1d12'), 'stroke-width': 1.2}));
  out.push(box(L - 4, DESK_Y - 1.5, R + 4, DESK_Y, {fill: c('#9a7a58')}));
  // cables behind the scopes
  out.push(
    el('path', {d: 'M-312 -60C-330 -20 -340 40 -336 90', stroke: c('#151515'), 'stroke-width': 3, fill: 'none'}),
    el('path', {d: '-30 -50C0 -10 10 30 -5 60'.replace(/^/, 'M'), stroke: c('#151515'), 'stroke-width': 2.5, fill: 'none'}),
  );
  // three oscilloscopes, a speaker on top of the middle one
  for (const s of SCOPES) {
    const x0 = s.x - 46;
    const x1 = s.x + 46;
    out.push(box(x0 + 3, DESK_Y, x1 + 3, 26 - 3, {fill: c('#0f0d0b'), opacity: 0.5, filter: 'url(#b2)'}));
    out.push(box(x0, DESK_Y, x1, 26, {fill: c('#46535c'), stroke: c('#1a2024'), 'stroke-width': 1.5, rx: 3}));
    out.push(box(x0 + 4, DESK_Y + 4, x1 - 4, 22, {fill: c('#55636c'), rx: 2}));
    // the bezel; the glass is emissive
    out.push(box(s.x - s.w / 2 - 5, s.y - s.h / 2 - 5, s.x + s.w / 2 + 5, s.y + s.h / 2 + 5, {fill: c('#16191b'), rx: 5}));
    for (let i = 0; i < 4; i++) {
      const kx = x0 + 16 + i * 20;
      out.push(el('circle', {cx: kx, cy: DESK_Y + 14, r: 5, fill: c('#1d1d1d'), stroke: c('#8a8a84'), 'stroke-width': 1}));
      out.push(el('circle', {cx: kx, cy: DESK_Y + 14, r: 1.4, fill: c('#c0bdb0')}));
    }
    out.push(box(x0 + 8, 18, x0 + 30, 21, {fill: c('#d0c9b0'), opacity: 0.8}));
  }
  out.push(box(-200, 26, -130, 58, {fill: c('#2c2620'), stroke: c('#120f0c'), 'stroke-width': 1.5, rx: 3}));
  out.push(el('circle', {cx: -165, cy: 42, r: 12, fill: c('#161310')}));
  for (let k = 0; k < 4; k++)
    out.push(el('circle', {cx: -165, cy: 42, r: 3 + k * 3, fill: 'none', stroke: c('#2a241e'), 'stroke-width': 0.8}));
  // the mug of cold coffee, rings on the desk
  const mx = 30;
  out.push(
    el('ellipse', {cx: mx - 26, cy: DESK_Y + 0.5, rx: 12, ry: 1.5, fill: 'none', stroke: c('#3a2314'), 'stroke-width': 0.8}),
  );
  out.push(
    el('path', {
      d: `M${mx - 12} ${DESK_Y}L${mx - 13} ${DESK_Y + 28}L${mx + 13} ${DESK_Y + 28}L${mx + 12} ${DESK_Y}Z`,
      fill: c('#c9b48f'),
    }),
    el('path', {
      d: `M${mx + 12} ${DESK_Y + 22}C${mx + 22} ${DESK_Y + 22} ${mx + 22} ${DESK_Y + 8} ${mx + 12} ${DESK_Y + 8}`,
      stroke: c('#b8a27c'),
      'stroke-width': 3.2,
      fill: 'none',
    }),
    box(mx - 13, DESK_Y + 26, mx + 13, DESK_Y + 28, {fill: c('#1d1e2a')}),
    box(mx - 9, DESK_Y + 9, mx - 2, DESK_Y + 12, {fill: c('#5a3a1c'), opacity: 0.6}),
    el('path', {d: `M${mx - 8} ${DESK_Y + 2}L${mx - 9} ${DESK_Y + 24}`, stroke: c('#efe4c8'), 'stroke-width': 2, opacity: 0.55}),
  );
  // a stack of fanfold printout, its strip spilling over the edge of the desk to a heap on the floor
  out.push(box(60, DESK_Y, 136, DESK_Y + 22, {fill: c('#d8d0b8'), stroke: c('#8a8270'), 'stroke-width': 0.8}));
  for (let y = DESK_Y + 3; y < DESK_Y + 22; y += 2.4) out.push(box(60, y, 136, y + 0.5, {fill: c('#8a8270'), opacity: 0.7}));
  const strip = 'M124 -56C140 -60 150 -72 152 -80C154 -100 146 -130 150 -160C153 -180 146 -196 140 -204';
  out.push(el('path', {d: strip, stroke: c('#d8d0b8'), 'stroke-width': 18, fill: 'none'}));
  out.push(
    el('path', {
      d: strip,
      stroke: c('#8a1c14'),
      'stroke-width': 0.9,
      fill: 'none',
      'stroke-dasharray': '3 1 6 2 1 4',
      opacity: 0.8,
    }),
  );
  // the heap on the floor: folds of paper
  for (let k = 0; k < 7; k++) {
    const x = 118 + k * 9 + rng.range(-3, 3);
    out.push(
      el('path', {
        d: `M${x - 18} ${FLOOR_Y - 2}L${x - 12} ${FLOOR_Y + 14 + k * 0.6}L${x + 16} ${FLOOR_Y + 12 + rng.range(-2, 3)}L${x + 18} ${FLOOR_Y - 2}Z`,
        fill: c(k % 2 ? '#cfc6ad' : '#ddd5bd'),
        stroke: c('#8a8270'),
        'stroke-width': 0.6,
      }),
    );
  }
  // the desk lamp: a base, two arms, a shade pointing down at the desk
  out.push(
    el('ellipse', {cx: 196, cy: DESK_Y + 3, rx: 20, ry: 4, fill: c('#2b3f33')}),
    box(176, DESK_Y, 216, DESK_Y + 4, {fill: c('#2f4a3a')}),
    el('path', {
      d: `M196 ${DESK_Y + 4}L214 40L170 70`,
      stroke: c('#6e6c64'),
      'stroke-width': 3,
      fill: 'none',
      'stroke-linejoin': 'round',
    }),
    el('path', {d: `M199 ${DESK_Y + 4}L217 40`, stroke: c('#3a3934'), 'stroke-width': 1, fill: 'none'}),
    el('circle', {cx: 214, cy: 40, r: 4, fill: c('#3a3934')}),
    el('path', {d: 'M178 76L170 70L120 -6L180 -24Z', fill: c('#2f4a3a'), stroke: c('#162219'), 'stroke-width': 1.5}),
    el('path', {d: 'M176 70L128 -4', stroke: c('#5d8a70'), 'stroke-width': 2, opacity: 0.6}),
  );
  // headphones hanging from a hook under the desk top, the cord to the receiver
  out.push(
    el('path', {
      d: `M-198 ${DESK_Y - 12}C-220 ${DESK_Y - 40} -204 ${DESK_Y - 70} -184 ${DESK_Y - 52}`,
      stroke: c('#1c1c1c'),
      'stroke-width': 4,
      fill: 'none',
    }),
    el('ellipse', {cx: -212, cy: DESK_Y - 54, rx: 7, ry: 11, fill: c('#2a2a2a'), stroke: c('#0e0e0e'), 'stroke-width': 1}),
    el('ellipse', {cx: -181, cy: DESK_Y - 56, rx: 7, ry: 11, fill: c('#2a2a2a'), stroke: c('#0e0e0e'), 'stroke-width': 1}),
    el('path', {
      d: `M-181 ${DESK_Y - 66}C-160 ${DESK_Y - 130} -260 -190 -340 -150`,
      stroke: c('#151515'),
      'stroke-width': 1.5,
      fill: 'none',
    }),
  );
  return out;
}

/** The swivel chair, side on. @param {Theme} T */
function chair(T) {
  const {c} = T;
  const x = -48;
  return [
    el('ellipse', {cx: x + 6, cy: FLOOR_Y - 4, rx: 60, ry: 5, fill: c('#0c0907'), opacity: 0.6, filter: 'url(#b4)'}),
    // the five-star base and casters
    el('path', {
      d: `M${x - 52} ${FLOOR_Y + 8}L${x} ${FLOOR_Y + 20}L${x + 52} ${FLOOR_Y + 8}`,
      stroke: c('#2b2b2b'),
      'stroke-width': 6,
      fill: 'none',
    }),
    el('path', {
      d: `M${x - 20} ${FLOOR_Y + 12}L${x} ${FLOOR_Y + 20}L${x + 24} ${FLOOR_Y + 13}`,
      stroke: c('#1b1b1b'),
      'stroke-width': 5,
      fill: 'none',
    }),
    ...[-52, -20, 24, 52].map((dx) => el('circle', {cx: x + dx, cy: FLOOR_Y + 4, r: 5, fill: c('#111')})),
    // the column
    box(x - 5, FLOOR_Y + 18, x + 5, -122, {fill: c('#8c8c88')}),
    box(x - 3, FLOOR_Y + 18, x - 1, -122, {fill: c('#d0d0cc'), opacity: 0.6}),
    // the seat and the back
    el('path', {
      d: `M${x - 48} -122C${x - 50} -106 ${x + 44} -104 ${x + 46} -116L${x + 40} -126L${x - 44} -128Z`,
      fill: c('#3a2b25'),
    }),
    el('path', {
      d: `M${x - 44} -112C${x - 10} -108 ${x + 20} -108 ${x + 40} -112`,
      stroke: c('#5a4438'),
      'stroke-width': 2,
      fill: 'none',
    }),
    el('path', {d: `M${x + 30} -118L${x + 46} -60`, stroke: c('#2b2b2b'), 'stroke-width': 5}),
    el('path', {
      d: `M${x + 38} -70C${x + 36} -40 ${x + 40} -10 ${x + 52} 6C${x + 64} 10 ${x + 68} -6 ${x + 62} -30C${x + 58} -54 ${x + 56} -72 ${x + 50} -78Z`,
      fill: c('#3a2b25'),
      stroke: c('#1c1411'),
      'stroke-width': 1.5,
    }),
    el('path', {
      d: `M${x + 50} -64C${x + 50} -40 ${x + 52} -16 ${x + 58} -4`,
      stroke: c('#5a4438'),
      'stroke-width': 1.5,
      fill: 'none',
    }),
    // a cardigan over the back
    el('path', {
      d: `M${x + 46} 2C${x + 30} -10 ${x + 34} -50 ${x + 40} -70L${x + 48} -66C${x + 44} -40 ${x + 46} -16 ${x + 56} 0Z`,
      fill: c('#5a4a2c'),
      opacity: 0.95,
    }),
  ];
}

/** The wall at the right: a filing cabinet, a corkboard with printouts, a clock. @param {Theme} T @param {Rng} rng */
function rightWall(T, rng) {
  const {c} = T;
  const out = [];
  // the filing cabinet
  out.push(box(452, FLOOR_Y, 566, -52, {fill: c('#4d5248'), stroke: c('#1e201c'), 'stroke-width': 1.5}));
  for (let i = 0; i < 3; i++) {
    const y0 = FLOOR_Y + 8 + i * 50;
    out.push(box(458, y0, 560, y0 + 44, {fill: c('#565b51'), stroke: c('#23251f'), 'stroke-width': 1}));
    out.push(box(496, y0 + 26, 522, y0 + 30, {fill: c('#a5a59a'), rx: 1.5}));
    out.push(box(498, y0 + 32, 520, y0 + 40, {fill: c('#d8d0b8'), opacity: 0.8}));
  }
  // a thermos and a transistor radio on top
  out.push(box(470, -52, 488, -6, {fill: c('#6a1e18'), rx: 3}), box(468, -10, 490, -2, {fill: c('#9a9a92'), rx: 2}));
  out.push(box(504, -52, 556, -18, {fill: c('#3a2a1c'), rx: 4}), box(510, -46, 536, -24, {fill: c('#7a6a4a'), rx: 2}));
  out.push(el('path', {d: 'M550 -18L580 40', stroke: c('#a0a09a'), 'stroke-width': 1.2}));
  // the corkboard and its printouts, one circled in red
  out.push(box(448, 18, 592, 176, {fill: c('#6e4f30'), stroke: c('#2e2014'), 'stroke-width': 4}));
  const sheets = [
    {x: 462, y: 104, w: 56, h: 64, r: -3},
    {x: 526, y: 112, w: 54, h: 56, r: 4},
    {x: 466, y: 28, w: 48, h: 66, r: 2},
    {x: 522, y: 30, w: 58, h: 70, r: -5},
  ];
  sheets.forEach((s, i) => {
    const g = [];
    g.push(box(s.x, s.y, s.x + s.w, s.y + s.h, {fill: c('#ddd5bd')}));
    let d = '';
    for (let x = s.x + 4; x < s.x + s.w - 4; x += 1.5) {
      const spike = i === 3 && x > s.x + 26 && x < s.x + 34 ? Math.sin((x - s.x - 26) * 0.4) * 22 : 0;
      d += `${d ? 'L' : 'M'}${n(x)} ${n(s.y + s.h * 0.35 + rng.range(-2, 2) + spike)}`;
    }
    g.push(el('path', {d, stroke: c('#2a2a3a'), 'stroke-width': 0.7, fill: 'none'}));
    for (let k = 0; k < 5; k++)
      g.push(
        box(s.x + 4, s.y + s.h * 0.62 + k * 4, s.x + s.w - rng.range(6, 18), s.y + s.h * 0.62 + k * 4 + 0.8, {
          fill: c('#6a6a70'),
          opacity: 0.6,
        }),
      );
    if (i === 3)
      g.push(
        el('ellipse', {
          cx: s.x + 30,
          cy: s.y + s.h * 0.5,
          rx: 13,
          ry: 18,
          fill: 'none',
          stroke: c('#b01c14'),
          'stroke-width': 1.6,
        }),
      );
    g.push(
      el('circle', {cx: s.x + s.w / 2, cy: s.y + s.h - 4, r: 2.4, fill: c(['#b01c14', '#1c5ab0', '#d0a020', '#20a050'][i])}),
    );
    out.push(el('g', {transform: `rotate(${s.r} ${s.x + s.w / 2} ${s.y + s.h / 2})`}, g));
  });
  // the clock: twenty to four
  out.push(el('circle', {cx: 520, cy: 210, r: 22, fill: c('#d8d0b8'), stroke: c('#2a2420'), 'stroke-width': 3}));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    out.push(
      el('path', {
        d: `M${n(520 + Math.sin(a) * 16)} ${n(210 + Math.cos(a) * 16)}L${n(520 + Math.sin(a) * 19)} ${n(210 + Math.cos(a) * 19)}`,
        stroke: c('#2a2420'),
        'stroke-width': 1.2,
      }),
    );
  }
  const hour = ((3 + 40 / 60) / 12) * Math.PI * 2;
  const minute = (40 / 60) * Math.PI * 2;
  out.push(
    el('path', {
      d: `M520 210L${n(520 + Math.sin(hour) * 10)} ${n(210 + Math.cos(hour) * 10)}`,
      stroke: c('#1a1612'),
      'stroke-width': 2,
    }),
    el('path', {
      d: `M520 210L${n(520 + Math.sin(minute) * 16)} ${n(210 + Math.cos(minute) * 16)}`,
      stroke: c('#1a1612'),
      'stroke-width': 1.2,
    }),
  );
  // a framed photo of the dish at the left of the window, and a speaker box high on the wall
  out.push(box(-300, 96, -200, 170, {fill: c('#1a140e'), stroke: c('#5a4a38'), 'stroke-width': 3}));
  out.push(box(-294, 102, -206, 164, {fill: c('#8a8a80')}));
  out.push(
    el('path', {d: 'M-280 112L-250 150L-226 116Z', fill: c('#3a3a36')}),
    el('path', {d: 'M-284 140C-262 158 -238 156 -222 132', stroke: c('#3a3a36'), 'stroke-width': 3, fill: 'none'}),
  );
  out.push(box(-96, 150, -40, 196, {fill: c('#2c2620'), stroke: c('#120f0c'), 'stroke-width': 1.5, rx: 2}));
  for (let y = 156; y < 192; y += 4) out.push(box(-90, y, -46, y + 2, {fill: c('#141210')}));
  return out;
}

/** Cables across the floor, the same in both rooms. @param {Theme} T */
function floorCables(T) {
  const {c} = T;
  return [
    el('path', {
      d: `M-340 ${FLOOR_Y - 20}C-200 ${FLOOR_Y - 34} -60 ${FLOOR_Y - 10} 80 ${FLOOR_Y - 30}S300 ${FLOOR_Y - 18} 460 ${FLOOR_Y - 40}`,
      stroke: c('#111'),
      'stroke-width': 3,
      fill: 'none',
    }),
    el('path', {
      d: `M-360 ${FLOOR_Y - 8}C-250 ${FLOOR_Y - 50} -100 ${FLOOR_Y - 40} -20 ${FLOOR_Y - 60}`,
      stroke: c('#2a1810'),
      'stroke-width': 2.5,
      fill: 'none',
    }),
  ];
}

// ---------------------------------------------------------------- the dressing of the deep

/** Algae streaks down the walls, barnacles, sand over the floor, holdfasts of the kelp, coral on the chair. @param {Rng} rng */
function drownedGrowth(rng) {
  const out = [];
  // the tide of silt: darker towards the floor
  out.push(
    vgrad('silt', FLOOR_Y + 160, FLOOR_Y, [
      [0, '#0a1a18', 0],
      [1, '#0a1a18', 0.55],
    ]),
  );
  out.push(box(WORLD.left, FLOOR_Y, WORLD.right, FLOOR_Y + 160, {fill: 'url(#silt)'}));
  // algae streaks hanging from the ceiling and the window frame
  for (let i = 0; i < 46; i++) {
    const x = rng.range(-600, 600);
    if (x > WINDOW.left + 4 && x < WINDOW.right - 4 && rng.next() < 0.8) continue;
    const top = x > WINDOW.left - 14 && x < WINDOW.right + 14 ? WINDOW.bottom - 18 : 244;
    const len = rng.range(30, 160);
    const w = rng.range(1.5, 5);
    out.push(
      el('path', {
        d: `M${n(x)} ${top}C${n(x + rng.range(-6, 6))} ${n(top - len * 0.4)} ${n(x + rng.range(-8, 8))} ${n(top - len * 0.7)} ${n(x + rng.range(-4, 4))} ${n(top - len)}`,
        stroke: rng.pick(['#0d2a1e', '#123826', '#0a2018']),
        'stroke-width': w,
        fill: 'none',
        'stroke-linecap': 'round',
        opacity: 0.8,
      }),
    );
  }
  // barnacle clusters on the rack, the scopes, the desk edge, the cabinet
  const spots = [
    [-560, 170, 30],
    [-350, 60, 24],
    [-480, -100, 28],
    [-340, -176, 20],
    [-300, 22, 20],
    [-120, 24, 18],
    [-28, -70, 16],
    [210, DESK_Y, 26],
    [-320, DESK_Y - 4, 22],
    [470, -56, 26],
    [560, -120, 20],
    [430, 214, 22],
    [50, 214, 20],
    [590, 160, 24],
  ];
  for (const [cx, cy, r] of spots) {
    for (let k = 0; k < r * 0.9; k++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * r;
      const s = rng.range(1.6, 4.2);
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d * 0.7;
      out.push(
        el('circle', {cx: x, cy: y, r: s, fill: '#8a9a92', stroke: '#2a3a36', 'stroke-width': 0.8}),
        el('circle', {cx: x, cy: y + s * 0.15, r: s * 0.38, fill: '#1a2624'}),
      );
    }
  }
  // sand drifted over the floor, rippled, a few shells
  const sand = [];
  for (let x = WORLD.left; x <= WORLD.right; x += 20)
    sand.push([x, FLOOR_Y - 6 + Math.sin(x * 0.012) * 9 + Math.sin(x * 0.041) * 4]);
  out.push(
    el('path', {
      d: `${poly([[WORLD.left, WORLD.bottom], ...sand, [WORLD.right, WORLD.bottom]].map(([x, y]) => [x, y]))}`,
      fill: '#5a6a5c',
    }),
  );
  for (let k = 0; k < 14; k++) {
    const y = FLOOR_Y - 18 - k * 7;
    let d = '';
    for (let x = WORLD.left; x <= WORLD.right; x += 12) d += `${d ? 'L' : 'M'}${x} ${n(y + Math.sin(x * 0.05 + k * 1.7) * 2.2)}`;
    out.push(el('path', {d, stroke: '#3a4a40', 'stroke-width': 1.2, fill: 'none', opacity: 0.7}));
  }
  for (let k = 0; k < 16; k++) {
    const x = rng.range(-590, 590);
    const y = rng.range(FLOOR_Y - 90, FLOOR_Y - 14);
    const s = rng.range(3, 6);
    out.push(
      el('path', {
        d: `M${n(x - s)} ${n(y)}Q${n(x)} ${n(y + s * 1.6)} ${n(x + s)} ${n(y)}Z`,
        fill: '#b0b8a8',
        stroke: '#4a5248',
        'stroke-width': 0.6,
      }),
    );
  }
  // the holdfasts of the kelp: knotted roots where each strand grows
  for (const k of KELP) {
    for (let j = 0; j < 7; j++) {
      const a = (j / 6) * Math.PI;
      out.push(
        el('path', {
          d: `M${k.x} ${FLOOR_Y - 4}Q${n(k.x + Math.cos(a) * 12)} ${n(FLOOR_Y + 2)} ${n(k.x + Math.cos(a) * 22)} ${n(FLOOR_Y - 10 - rng.range(0, 6))}`,
          stroke: '#2a3a1c',
          'stroke-width': 3,
          fill: 'none',
          'stroke-linecap': 'round',
        }),
      );
    }
    out.push(el('ellipse', {cx: k.x, cy: FLOOR_Y - 2, rx: 9, ry: 6, fill: '#34461f'}));
  }
  // coral and sponges grown over the chair, a soft violet against the teal
  const coral = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ s, /** @type {string} */ col) => {
    let d = '';
    const branch = (
      /** @type {number} */ bx,
      /** @type {number} */ by,
      /** @type {number} */ a,
      /** @type {number} */ len,
      /** @type {number} */ depth,
    ) => {
      const ex = bx + Math.cos(a) * len;
      const ey = by + Math.sin(a) * len;
      d += `M${n(bx)} ${n(by)}L${n(ex)} ${n(ey)}`;
      if (depth > 0) {
        branch(ex, ey, a + rng.range(0.25, 0.6), len * 0.72, depth - 1);
        branch(ex, ey, a - rng.range(0.25, 0.6), len * 0.72, depth - 1);
      }
    };
    branch(x, y, Math.PI / 2 + rng.range(-0.2, 0.2), s, 4);
    return el('path', {d, stroke: col, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round'});
  };
  out.push(coral(-36, -124, 16, '#5a3a6a'), coral(0, -110, 12, '#6a4a7a'), coral(8, 8, 10, '#5a3a6a'));
  out.push(coral(-560, 178, 14, '#5a3a6a'), coral(520, -50, 13, '#6a4a7a'), coral(-290, 26, 9, '#6a4a7a'));
  for (const [x, y, r] of [
    [-84, -126, 9],
    [-16, -128, 7],
    [500, -54, 8],
  ]) {
    out.push(el('ellipse', {cx: x, cy: y + r * 0.6, rx: r, ry: r * 1.3, fill: '#4a5a3a', stroke: '#22301c', 'stroke-width': 1}));
    out.push(el('ellipse', {cx: x, cy: y + r * 1.4, rx: r * 0.4, ry: r * 0.3, fill: '#101810'}));
  }
  // a starfish on the middle scope, a fish skeleton on the floor
  out.push(
    el('path', {
      d: (() => {
        const pts = [];
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 + 0.3;
          const r = k % 2 ? 4 : 11;
          pts.push([-140 + Math.cos(a) * r, 22 + Math.sin(a) * r]);
        }
        return blobPath(/** @type {[number, number][]} */ (pts));
      })(),
      fill: '#8a4a3a',
      stroke: '#3a1a14',
      'stroke-width': 1,
    }),
  );
  let bones = 'M300 -240L360 -236';
  for (let k = 0; k < 7; k++) bones += `M${306 + k * 7} -238L${304 + k * 7} -230M${306 + k * 7} -238L${304 + k * 7} -246`;
  out.push(el('path', {d: bones, stroke: '#a8b0a0', 'stroke-width': 1.2, fill: 'none'}));
  out.push(el('path', {d: 'M360 -236L372 -230L370 -242Z', fill: '#a8b0a0'}));
  // the shattered window: shards left in the frame
  for (const p of paneRects()) {
    const shards = [
      [
        [p.x0, p.y1],
        [p.x0 + rng.range(12, 30), p.y1],
        [p.x0, p.y1 - rng.range(20, 50)],
      ],
      [
        [p.x1, p.y0],
        [p.x1 - rng.range(14, 40), p.y0],
        [p.x1, p.y0 + rng.range(16, 36)],
      ],
      [
        [p.x1, p.y1],
        [p.x1, p.y1 - rng.range(10, 30)],
        [p.x1 - rng.range(8, 20), p.y1],
      ],
    ];
    for (const s of shards)
      out.push(
        el('path', {
          d: poly(/** @type {[number, number][]} */ (s)),
          fill: '#9ad0d0',
          opacity: 0.22,
          stroke: '#d0ffff',
          'stroke-width': 0.6,
        }),
      );
  }
  // anemone in the mug: a crown of tentacles (their tips are emissive)
  for (let k = 0; k < 13; k++) {
    const a = Math.PI * (0.1 + (0.8 * k) / 12);
    const len = rng.range(14, 24);
    out.push(
      el('path', {
        d: `M${n(30 + Math.cos(a) * 6)} ${DESK_Y + 27}Q${n(30 + Math.cos(a) * 14)} ${n(DESK_Y + 30 + len * 0.5)} ${n(30 + Math.cos(a) * len)} ${n(DESK_Y + 27 + Math.sin(a) * len)}`,
        stroke: '#4a7a6a',
        'stroke-width': 2.6,
        fill: 'none',
        'stroke-linecap': 'round',
      }),
    );
  }
  return out;
}

/** The glass of the night window: a faint reflection of the room, streaks of light. */
function nightGlass() {
  const out = [];
  for (const p of paneRects()) {
    out.push(box(p.x0, p.y0, p.x1, p.y1, {fill: '#a0b0c0', opacity: 0.04}));
    const w = p.x1 - p.x0;
    out.push(
      el('path', {
        d: poly([
          [p.x0 + w * 0.15, p.y0],
          [p.x0 + w * 0.32, p.y0],
          [p.x0 + w * 0.7, p.y1],
          [p.x0 + w * 0.53, p.y1],
        ]),
        fill: '#d8e4f0',
        opacity: 0.05,
      }),
      el('path', {
        d: poly([
          [p.x0 + w * 0.42, p.y0],
          [p.x0 + w * 0.47, p.y0],
          [p.x0 + w * 0.85, p.y1],
          [p.x0 + w * 0.8, p.y1],
        ]),
        fill: '#d8e4f0',
        opacity: 0.05,
      }),
    );
  }
  // the lamp mirrored faintly in the middle pane
  out.push(el('circle', {cx: 236, cy: 30, r: 10, fill: '#ffb060', opacity: 0.16, filter: 'url(#b4)'}));
  return out;
}

// ---------------------------------------------------------------- what glows

/** The emissive pass: unlit parts that shine by themselves. @param {Theme} T @param {Rng} rng */
function emissive(T, rng) {
  const out = [];
  const D = T.drowned;
  // the glass of the scopes: dark, a faint phosphor haze, a graticule (the traces are drawn by the demo)
  for (const s of SCOPES) {
    const id = `scr${s.x}`;
    out.push(
      rgrad(id, s.x, s.y, s.w * 0.7, [
        [0, D ? '#0b2a2a' : '#2a1a08'],
        [1, D ? '#031010' : '#0a0603'],
      ]),
    );
    out.push(box(s.x - s.w / 2, s.y - s.h / 2, s.x + s.w / 2, s.y + s.h / 2, {fill: `url(#${id})`, rx: 4}));
    let g = '';
    for (let k = 1; k < 10; k++) g += `M${n(s.x - s.w / 2 + (k * s.w) / 10)} ${s.y - s.h / 2}V${s.y + s.h / 2}`;
    for (let k = 1; k < 8; k++) g += `M${s.x - s.w / 2} ${n(s.y - s.h / 2 + (k * s.h) / 8)}H${s.x + s.w / 2}`;
    out.push(el('path', {d: g, stroke: D ? '#1a5a58' : '#5a3a14', 'stroke-width': 0.4, opacity: 0.6}));
  }
  // the VU meters: lit faces, a scale, a needle
  for (const x of [-520, -404]) {
    out.push(box(x - 31, 23, x + 31, 53, {fill: D ? '#5aa8a0' : '#e8b060', rx: 1.5}));
    let d = '';
    for (let k = 0; k <= 10; k++) {
      const a = -0.8 + (k / 10) * 1.6;
      d += `M${n(x + Math.sin(a) * 22)} ${n(26 + Math.cos(a) * 22)}L${n(x + Math.sin(a) * 25)} ${n(26 + Math.cos(a) * 25)}`;
    }
    out.push(el('path', {d, stroke: '#2a1a0a', 'stroke-width': 0.8}));
    out.push(
      el('path', {
        d: `M${x + 12} ${n(26 + 24)}A25 25 0 0 0 ${x + 22} ${n(26 + 12)}`,
        stroke: '#a01a0a',
        'stroke-width': 2,
        fill: 'none',
      }),
    );
    const a = rng.range(-0.5, 0.2);
    out.push(
      el('path', {d: `M${x} 25L${n(x + Math.sin(a) * 26)} ${n(26 + Math.cos(a) * 26)}`, stroke: '#1a0e06', 'stroke-width': 1}),
    );
  }
  // the dial of the receiver: a scale and a pointer
  out.push(box(-576, -20, -402, -2, {fill: D ? '#2a8a84' : '#d08a30', rx: 1.5}));
  let d = '';
  for (let x = -572; x < -404; x += 4) d += `M${x} -4V${x % 20 === 0 ? -12 : -8}`;
  out.push(el('path', {d, stroke: '#2a1a0a', 'stroke-width': 0.7}));
  out.push(box(-470, -20, -468, -2, {fill: '#c01a0a'}));
  // indicator lamps on the racks (a few blink in the demo)
  for (const [x, y, col] of [
    [-574, 166, '#ff3a1a'],
    [-560, 166, '#ffb020'],
    [-372, 166, '#40ff60'],
    [-574, 2, '#ffb020'],
    [-356, -110, '#ff3a1a'],
  ]) {
    out.push(el('circle', {cx: x, cy: y, r: 2.2, fill: D ? '#60fff0' : col}));
  }
  // the lamp: the mouth of the shade
  if (!D) {
    out.push(el('path', {d: 'M122 -5L178 -23', stroke: '#fff2c8', 'stroke-width': 4, 'stroke-linecap': 'round'}));
  } else {
    // a bioluminescent fungus grown in the shade
    for (let k = 0; k < 9; k++)
      out.push(el('circle', {cx: 130 + k * 5.5, cy: -8 - k * 1.8 + rng.range(-2, 2), r: rng.range(1.6, 3.2), fill: '#9affd0'}));
  }
  if (D) {
    // the tips of the anemone in the mug
    for (let k = 0; k < 13; k++) {
      const a = Math.PI * (0.1 + (0.8 * k) / 12);
      const len = 14 + ((k * 7) % 10);
      out.push(el('circle', {cx: 30 + Math.cos(a) * len, cy: DESK_Y + 27 + Math.sin(a) * len, r: 1.8, fill: '#b0ffe0'}));
    }
    // specks of light living on the walls and racks
    for (let k = 0; k < 140; k++) {
      const x = rng.range(-598, 598);
      const y = rng.range(FLOOR_Y - 40, 244);
      if (x > WINDOW.left && x < WINDOW.right && y > WINDOW.bottom && y < WINDOW.top) continue;
      out.push(
        el('circle', {
          cx: x,
          cy: y,
          r: rng.range(0.6, 1.6),
          fill: rng.pick(['#7affff', '#5ae0ff', '#a0fff0', '#c8a0ff']),
          opacity: rng.range(0.4, 0.95),
        }),
      );
    }
  }
  return out;
}

/** The glow pass: soft light around what shines, added. @param {Theme} T */
function glow(T) {
  const D = T.drowned;
  const out = [];
  const scope = D ? '#30d8d0' : '#d07a20';
  for (const s of SCOPES)
    out.push(el('ellipse', {cx: s.x, cy: s.y, rx: s.w * 0.75, ry: s.h * 0.8, fill: scope, opacity: 0.22, filter: 'url(#b16)'}));
  for (const x of [-520, -404])
    out.push(box(x - 36, 18, x + 36, 58, {fill: D ? '#40c0b0' : '#e0a050', opacity: 0.25, filter: 'url(#b8)'}));
  out.push(box(-580, -24, -398, 2, {fill: D ? '#30b0a8' : '#e09040', opacity: 0.3, filter: 'url(#b8)'}));
  if (!D) {
    out.push(el('ellipse', {cx: 150, cy: -14, rx: 34, ry: 14, fill: '#ffd8a0', opacity: 0.55, filter: 'url(#b8)'}));
    out.push(el('ellipse', {cx: 140, cy: DESK_Y + 2, rx: 120, ry: 8, fill: '#ffb060', opacity: 0.25, filter: 'url(#b16)'}));
  } else {
    out.push(el('ellipse', {cx: 152, cy: -14, rx: 30, ry: 14, fill: '#60ffc0', opacity: 0.45, filter: 'url(#b8)'}));
    out.push(el('circle', {cx: 30, cy: DESK_Y + 36, r: 22, fill: '#60ffd0', opacity: 0.35, filter: 'url(#b8)'}));
  }
  return out;
}

// ---------------------------------------------------------------- light

/**
 * The light that falls on a point of the room (in units), as linear rgb. The lamp, the scopes and
 * the dial of the night; the jellyfish beyond the window, the scopes and the anemone of the deep.
 * @param {boolean} D @param {number} x @param {number} y @param {Float32Array} out
 */
function lightAt(D, x, y, out) {
  const add = (/** @type {number} */ k, /** @type {number[]} */ c) => {
    out[0] += c[0] * k;
    out[1] += c[1] * k;
    out[2] += c[2] * k;
  };
  const point = (/** @type {number} */ px, /** @type {number} */ py, /** @type {number} */ r) => {
    const d = Math.hypot(x - px, y - py);
    return (1 / (1 + (d / r) ** 2)) * smoothstep(0, 1, 1 - d / (r * 4));
  };
  // the light through the window, falling down and to the left onto desk and floor, the mullions in it
  const windowPool = () => {
    if (y >= WINDOW.bottom - 4) return 0;
    const drop = WINDOW.bottom - y;
    const sx = x + drop * 0.45;
    let k = smoothstep(WINDOW.left - 30, WINDOW.left + 30, sx) * (1 - smoothstep(WINDOW.right - 30, WINDOW.right + 30, sx));
    for (const m of MULLIONS) k *= 0.35 + 0.65 * smoothstep(6, 16 + drop * 0.04, Math.abs(sx - m));
    return k * Math.max(0, 1 - drop / 340);
  };
  if (!D) {
    out[0] = 0.15;
    out[1] = 0.125;
    out[2] = 0.12;
    // the desk lamp: a pool below its shade, a little spill above
    const dx = x - LAMP.x;
    const dy = y - LAMP.y;
    const d = Math.hypot(dx, dy) || 1;
    const down = smoothstep(-0.2, 0.7, (-dy / d) * 0.94 - (dx / d) * 0.34);
    add((0.25 + 0.75 * down) * point(LAMP.x, LAMP.y - 30, 120) * 2.0, [1, 0.62, 0.3]);
    for (const s of SCOPES) add(point(s.x, s.y, 70) * 0.55, [1, 0.6, 0.22]);
    add(point(-490, -12, 80) * 0.6, [1, 0.6, 0.25]);
    add(point(-462, 38, 70) * 0.35, [1, 0.65, 0.3]);
    add(windowPool() * 0.5, [0.32, 0.42, 0.62]);
  } else {
    out[0] = 0.06;
    out[1] = 0.15;
    out[2] = 0.17;
    add(point(262, 80, 240) * 1.2, [0.3, 0.95, 1.0]);
    add(windowPool() * 0.9, [0.3, 0.9, 1.0]);
    for (const s of SCOPES) add(point(s.x, s.y, 70) * 0.6, [0.3, 1, 0.95]);
    add(point(30, DESK_Y + 34, 60) * 0.8, [0.5, 1, 0.8]);
    add(point(150, -12, 70) * 0.5, [0.4, 1, 0.7]);
    add(point(-470, 40, 140) * 0.25, [0.6, 0.5, 1.0]);
  }
  // the ceiling and the corners stay dark
  const top = 1 - 0.55 * smoothstep(180, 300, y);
  const side = 1 - 0.3 * smoothstep(420, 600, Math.abs(x));
  out[0] *= top * side;
  out[1] *= top * side;
  out[2] *= top * side;
}

// ---------------------------------------------------------------- the two rooms

/**
 * Renders a room: straight RGBA floats of IMG_W × IMG_H, see-through in the panes of the window.
 * @param {boolean} drowned
 */
export async function renderRoom(drowned) {
  const T = theme(drowned);
  // the shapes both rooms share draw from one seed; what grows in the deep from another
  const rng = new Rng(4119);
  const body = [
    ...shell(T, rng),
    ...windowFrame(T),
    ...rightWall(T, rng),
    ...racks(T, rng),
    ...desk(T, rng),
    ...chair(T),
    ...floorCables(T),
  ];
  if (drowned) body.push(...drownedGrowth(new Rng(6601)));
  const albedo = toFloat(await rasterize(worldDoc(defs, body), IMG_W, IMG_H));

  // the light, and a grain in the paint and the wood
  const light = new Float32Array(3);
  const fog = [0.015, 0.075, 0.095];
  for (let py = 0; py < IMG_H; py++) {
    const y = WORLD.top - (py + 0.5) / PX;
    for (let px = 0; px < IMG_W; px++) {
      const i = (py * IMG_W + px) * 4;
      if (albedo[i + 3] === 0) continue;
      const x = WORLD.left + (px + 0.5) / PX;
      lightAt(drowned, x, y, light);
      const grain = 0.9 + 0.2 * fbm(x * 0.09, y * 0.09, 17, 3);
      for (let c = 0; c < 3; c++) {
        let v = albedo[i + c] ** 2.2 * light[c] * grain;
        if (drowned) v = lerp(v, fog[c], 0.2 + 0.15 * smoothstep(-100, 300, y));
        albedo[i + c] = v ** (1 / 2.2);
      }
    }
  }

  if (!drowned) overRGBA(albedo, await rasterize(worldDoc(defs, nightGlass()), IMG_W, IMG_H));
  overRGBA(albedo, await rasterize(worldDoc(defs, emissive(T, new Rng(808))), IMG_W, IMG_H));
  addLight(albedo, await rasterize(worldDoc(defs, glow(T)), IMG_W, IMG_H));
  return albedo;
}
