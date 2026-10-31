// stage-masks/flashlight: the layer the player crawls in, z = 0 — the dirt, the ends of the joists
// overhead with wire looping between them, two posts (muddy little handprints up one of them, higher
// than a child reaches), and the toys: a teddy bear with one button eye, a
// porcelain doll, a rocking horse, building blocks. The toys stand where the eyes wait in the dark
// below the level, so the light finds a toy where the eyes were. The drawings pinned to the first
// post are sprites of their own. Dirt, wood and posts per pixel; the rest SVG.
import {fbm, Rng} from '../../lib/image.mjs';
import {blurFilter, dirt, el, hash, hexRgb, Layer, mix3, n, wood} from './kit.mjs';
import {FLOOR_Y, LAYERS, POSTS} from './layout.mjs';

const JOIST_BOTTOM = 160;
const JOIST_TOP = 255;
const JOIST_STEP = 160;
const JOIST_W = 26;
const POST_HW = 15;

/** @param {number} u */
const floorEdge = (u) => FLOOR_Y + 4 * Math.sin(u * 0.009) + 8 * (fbm(u / 60, 4.5, 201, 3) - 0.5);

/** @param {number} u @param {number} v @returns {[number, number, number, number] | undefined} */
function shade(u, v) {
  const edge = floorEdge(u);
  if (v < edge) {
    const c = dirt(u, v, 203, 0.12);
    const k = 1 + 0.3 * Math.max(0, 1 - (edge - v) / 5);
    return [c[0] * k, c[1] * k, c[2] * k, 1];
  }
  if (v < JOIST_BOTTOM) {
    for (const px of POSTS) {
      const dx = u - px;
      if (Math.abs(dx) < POST_HW) {
        const c = wood(v, dx * 2, 205 + px);
        const k = 0.6 + 0.4 * Math.cos((dx / POST_HW) * 1.2) + (dx < -POST_HW + 2 ? 0.15 : 0);
        return [c[0] * k, c[1] * k, c[2] * k, 1];
      }
    }
    return undefined;
  }
  if (v < JOIST_TOP) {
    const k = Math.floor((u + JOIST_STEP / 2) / JOIST_STEP);
    const fx = u + JOIST_STEP / 2 - k * JOIST_STEP;
    if (fx < JOIST_W) {
      const rx = fx - JOIST_W * (0.3 + 0.4 * hash(k, 0, 207));
      const ry = v - JOIST_BOTTOM + 40;
      const rings = 0.5 + 0.5 * Math.sin(Math.hypot(rx, ry) * 1.4 + fbm(u / 3, v / 3, 209, 2) * 3);
      let c = mix3(hexRgb('#5e4532'), hexRgb('#94724f'), 0.3 + 0.5 * rings);
      // a check, the split of the end grain
      if (Math.abs(fx - JOIST_W * 0.5 - 4 * Math.sin(v * 0.1 + k)) < 0.6 && hash(k, 1, 211) > 0.5)
        c = mix3(c, [0.05, 0.03, 0.02], 0.8);
      const s = fx < 1.6 || fx > JOIST_W - 1.6 ? 0.55 : 1;
      return [c[0] * s, c[1] * s, c[2] * s, 1];
    }
    const g = Math.max(0, 1 - (v - JOIST_BOTTOM) / 70);
    const c = mix3(hexRgb('#0c0906'), hexRgb('#2c2119'), g * 0.55);
    return [c[0], c[1], c[2], 1];
  }
  const seam = (v - JOIST_TOP) % 15;
  const c = wood(u * 0.8, v, 213);
  const k = (seam < 1.2 ? 0.35 : 0.72) * Math.max(0.45, 1 - (v - JOIST_TOP) / 200);
  return [c[0] * k, c[1] * k, c[2] * k, 1];
}

const defs = [
  blurFilter('b1', 1),
  blurFilter('b2', 2),
  el('radialGradient', {id: 'porcelain', cx: 0.4, cy: 0.35, r: 0.7}, [
    el('stop', {offset: 0, 'stop-color': '#e8ddd0'}),
    el('stop', {offset: 0.7, 'stop-color': '#b9a999'}),
    el('stop', {offset: 1, 'stop-color': '#6f6257'}),
  ]),
  el('radialGradient', {id: 'fur', cx: 0.45, cy: 0.35, r: 0.75}, [
    el('stop', {offset: 0, 'stop-color': '#8a6a48'}),
    el('stop', {offset: 1, 'stop-color': '#3f2c1d'}),
  ]),
  el('filter', {id: 'fuzz', x: '-10%', y: '-10%', width: '120%', height: '120%'}, [
    el('feTurbulence', {type: 'fractalNoise', baseFrequency: 0.35, numOctaves: 2, seed: 3, result: 't'}),
    el('feDisplacementMap', {in: 'SourceGraphic', in2: 't', scale: 2.4, xChannelSelector: 'R', yChannelSelector: 'G'}),
  ]),
];

/** a group authored y-down with its origin at the foot of the thing, placed at (x, y) of the level */
const at = (/** @type {number} */ x, /** @type {number} */ y, /** @type {string[]} */ body, k = 1) =>
  el('g', {transform: `translate(${n(x)} ${n(y)}) scale(${k} ${-k})`}, body);

/** A teddy bear sitting against nothing, one button eye left, the other a tuft of thread. */
function teddy() {
  const fur = 'url(#fur)';
  return at(-122, FLOOR_Y - 4, [
    el('ellipse', {cx: 0, cy: 2, rx: 34, ry: 5, fill: '#120d09', opacity: 0.6, filter: 'url(#b2)'}),
    // legs, body, arms
    el('ellipse', {cx: -16, cy: -8, rx: 13, ry: 9, fill: fur, filter: 'url(#fuzz)'}),
    el('ellipse', {cx: 18, cy: -8, rx: 13, ry: 9, fill: fur, filter: 'url(#fuzz)'}),
    el('ellipse', {cx: 22, cy: -8, rx: 6, ry: 6, fill: '#b49a76'}),
    el('ellipse', {cx: 0, cy: -28, rx: 21, ry: 24, fill: fur, filter: 'url(#fuzz)'}),
    el('ellipse', {cx: 0, cy: -26, rx: 11, ry: 14, fill: '#a0835f', opacity: 0.7}),
    el('ellipse', {cx: -22, cy: -30, rx: 7, ry: 15, fill: fur, transform: 'rotate(18 -22 -30)', filter: 'url(#fuzz)'}),
    el('ellipse', {cx: 21, cy: -24, rx: 7, ry: 15, fill: fur, transform: 'rotate(-40 21 -24)', filter: 'url(#fuzz)'}),
    // a seam split open at the side, stuffing in it
    el('path', {d: 'M12 -38q5 6 2 14', stroke: '#1d140c', 'stroke-width': 2, fill: 'none'}),
    el('ellipse', {cx: 14, cy: -31, rx: 3, ry: 5, fill: '#cfc6b4'}),
    // the head, tilted
    el('g', {transform: 'rotate(-12 0 -60)'}, [
      el('circle', {cx: -15, cy: -76, r: 8, fill: fur}),
      el('circle', {cx: 15, cy: -76, r: 8, fill: fur}),
      el('circle', {cx: -15, cy: -76, r: 4, fill: '#a0835f'}),
      el('circle', {cx: 0, cy: -60, r: 18, fill: fur, filter: 'url(#fuzz)'}),
      el('ellipse', {cx: 1, cy: -54, rx: 8, ry: 6, fill: '#b49a76'}),
      el('path', {d: 'M-2 -56h6l-3 3z', fill: '#1a120c'}),
      el('path', {d: 'M1 -53v3m0 0q-3 2 -5 0m5 0q3 2 5 0', stroke: '#1a120c', 'stroke-width': 1, fill: 'none'}),
      el('circle', {cx: -7, cy: -64, r: 2.8, fill: '#0e0b09'}),
      el('circle', {cx: -7.8, cy: -64.8, r: 0.9, fill: '#c9c2b8'}),
      el('path', {d: 'M7 -64l2 2m-1 -3l1 4m1 -3l-2 2', stroke: '#2a1d12', 'stroke-width': 0.8}),
    ]),
  ]);
}

/** A porcelain doll in a faded dress, sitting up, a crack across her cheek, one eye gone. */
function doll() {
  return at(790, FLOOR_Y - 3, [
    el('ellipse', {cx: 0, cy: 2, rx: 32, ry: 4.5, fill: '#120d09', opacity: 0.6, filter: 'url(#b2)'}),
    // legs out in front, shoes
    el('path', {d: 'M-6 -6h30v-8h-30z', fill: '#cfc2b0'}),
    el('rect', {x: 22, y: -16, width: 9, height: 12, rx: 3, fill: '#1c1714'}),
    // the dress, a bell of faded lace
    el('path', {d: 'M-14 -2C-20 -20 -12 -40 0 -44C12 -40 18 -20 14 -2Z', fill: '#7d6f8c'}),
    el('path', {d: 'M-14 -2q4 -4 7 0q4 -4 7 0q4 -4 7 0q4 -4 7 0', stroke: '#c7bfb8', 'stroke-width': 1.5, fill: 'none'}),
    el('path', {d: 'M-8 -30C-4 -24 4 -24 8 -30', stroke: '#584c66', 'stroke-width': 1.2, fill: 'none'}),
    el('rect', {x: -16, y: -40, width: 7, height: 18, rx: 3, fill: '#d6c9b8', transform: 'rotate(14 -12 -40)'}),
    el('rect', {x: 9, y: -40, width: 7, height: 18, rx: 3, fill: '#d6c9b8', transform: 'rotate(-10 12 -40)'}),
    // the head
    el('g', {transform: 'rotate(8 0 -58)'}, [
      el('path', {
        d: 'M-16 -52C-22 -70 -16 -84 0 -86C16 -84 22 -70 16 -52C14 -46 10 -46 12 -56C6 -70 -6 -70 -12 -56C-10 -46 -14 -46 -16 -52Z',
        fill: '#2b1d14',
      }),
      el('circle', {cx: 0, cy: -62, r: 14, fill: 'url(#porcelain)'}),
      el('ellipse', {cx: -5, cy: -64, rx: 3.6, ry: 3, fill: '#2a3540'}),
      el('circle', {cx: -5.6, cy: -64.6, r: 1, fill: '#d9e1e6'}),
      el('ellipse', {cx: 6, cy: -64, rx: 3.6, ry: 3, fill: '#0b0807'}),
      el('path', {d: 'M-3 -55q3 2 6 0', stroke: '#8a3a38', 'stroke-width': 1.6, fill: 'none'}),
      el('circle', {cx: -9, cy: -58, r: 3, fill: '#c98f86', opacity: 0.5}),
      el('path', {d: 'M12 -70l-5 5l2 3l-6 6l1 4', stroke: '#3a2e26', 'stroke-width': 0.8, fill: 'none'}),
    ]),
  ]);
}

/** A rocking horse with its paint flaking, its mane mostly gone, a glass eye. */
function rockingHorse() {
  return at(-640, FLOOR_Y - 2, [
    el('ellipse', {cx: 0, cy: 2, rx: 60, ry: 4, fill: '#120d09', opacity: 0.6, filter: 'url(#b2)'}),
    el('path', {d: 'M-62 -6Q0 10 62 -6', stroke: '#4a3020', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round'}),
    el('path', {
      d: 'M-36 -2L-28 -40M-20 2L-14 -40M22 2L16 -40M38 -2L30 -40',
      stroke: '#6d5640',
      'stroke-width': 6,
      'stroke-linecap': 'round',
    }),
    el('path', {d: 'M-38 -38C-40 -54 -20 -60 10 -58C30 -56 40 -50 38 -40C30 -34 -30 -32 -38 -38Z', fill: '#b6a690'}),
    el('path', {d: 'M-38 -44Q-54 -40 -60 -24', stroke: '#2d241c', 'stroke-width': 3, fill: 'none'}),
    // neck and head
    el('path', {
      d: 'M22 -52C26 -70 30 -82 44 -88C54 -90 62 -84 64 -76C62 -72 54 -72 50 -72C46 -64 40 -56 34 -46Z',
      fill: '#b6a690',
    }),
    el('circle', {cx: 50, cy: -82, r: 2.6, fill: '#0c0a08'}),
    el('circle', {cx: 49.4, cy: -82.6, r: 0.8, fill: '#e9e0d0'}),
    el('path', {d: 'M38 -86q-4 -10 2 -12l2 10', fill: '#9d8d77'}),
    el('path', {d: 'M30 -80q-8 4 -10 14M34 -84q-10 2 -12 10', stroke: '#3a2a1c', 'stroke-width': 2, fill: 'none'}),
    // the saddle, the flaking dapples
    el('path', {d: 'M-8 -58h22l-2 10h-18z', fill: '#5c2a22'}),
    ...[-26, -10, 4, 20, 30].map((x, i) =>
      el('ellipse', {cx: x, cy: -46 + (i % 2) * 4, rx: 4, ry: 3, fill: '#6e604e', opacity: 0.7}),
    ),
  ]);
}

/** Building blocks, one fallen over, their paint worn to the wood at the edges. */
function blocks() {
  const blk = (
    /** @type {number} */ x,
    /** @type {number} */ y,
    /** @type {number} */ s,
    /** @type {string} */ c,
    /** @type {number} */ r,
  ) =>
    el('g', {transform: `rotate(${r} ${x} ${y})`}, [
      el('rect', {x: x - s / 2, y: y - s, width: s, height: s, fill: '#8c7353'}),
      el('rect', {x: x - s / 2 + 2.5, y: y - s + 2.5, width: s - 5, height: s - 5, fill: c}),
      el('circle', {cx: x, cy: y - s / 2, r: s * 0.22, fill: '#d8ccb0', opacity: 0.8}),
    ]);
  return at(-900, FLOOR_Y - 2, [
    el('ellipse', {cx: 6, cy: 2, rx: 40, ry: 4, fill: '#120d09', opacity: 0.6, filter: 'url(#b2)'}),
    blk(-14, 0, 22, '#7a2f2a', 0),
    blk(10, 0, 22, '#2f4f6e', 0),
    blk(-2, -22, 22, '#6b6a2c', 4),
    blk(36, 0, 18, '#5e3a68', 28),
  ]);
}

/** Muddy handprints of a small hand, up the second post, further up than a child reaches. */
function handprints() {
  const x = POSTS[1];
  const rng = new Rng(223);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const y = -110 + i * 36 + rng.range(-4, 4);
    const side = i % 2 === 0 ? -1 : 1;
    const px = x + side * 4 + rng.range(-2, 2);
    const r = rng.range(-0.3, 0.3) + side * 0.15;
    const g = [
      el('ellipse', {cx: 0, cy: 0, rx: 4.6, ry: 5.4, fill: '#2a1b10'}),
      ...[-3.6, -1.3, 1.1, 3.4].map((fx, j) =>
        el('ellipse', {cx: fx, cy: 6.5 + (j === 0 || j === 3 ? -1 : 0), rx: 1, ry: 2.4, fill: '#2a1b10'}),
      ),
      el('ellipse', {
        cx: side * -5.5,
        cy: 1,
        rx: 1,
        ry: 2.2,
        fill: '#2a1b10',
        transform: `rotate(${side * 40} ${side * -5.5} 1)`,
      }),
    ];
    out.push(el('g', {transform: `translate(${n(px)} ${n(y)}) rotate(${n((r * 180) / Math.PI)})`, opacity: 0.75 - i * 0.04}, g));
  }
  return out;
}

/** Wire stapled along the joists, looping down between them. */
function wires() {
  const rng = new Rng(227);
  let d = '';
  const {left, right} = LAYERS.play;
  for (let x = left; x < right; x += JOIST_STEP) {
    const x0 = Math.round(x / JOIST_STEP) * JOIST_STEP - JOIST_STEP / 2 + JOIST_W / 2;
    const sag = rng.range(8, 30);
    d += `M${n(x0)} ${n(JOIST_BOTTOM + 6)}Q${n(x0 + JOIST_STEP / 2)} ${n(JOIST_BOTTOM + 6 - sag * 2)} ${n(x0 + JOIST_STEP)} ${n(JOIST_BOTTOM + 6)}`;
  }
  return [
    el('path', {d, stroke: '#121110', 'stroke-width': 3.2, fill: 'none'}),
    el('path', {d, stroke: '#8a857a', 'stroke-width': 0.8, fill: 'none', opacity: 0.6, transform: 'translate(0 0.8)'}),
  ];
}

/** @returns {Promise<Buffer[]>} the tiles of the play layer, left to right */
export async function renderPlay() {
  const layer = new Layer(LAYERS.play);
  layer.paint(shade);
  await layer.svg(defs, [...wires(), ...handprints(), blocks(), rockingHorse(), teddy(), doll()]);
  layer.grain(229, 0.16);
  return layer.tiles();
}
