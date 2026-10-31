// stage-masks/spotlight: the sprites of "Ward C, 3:07 a.m." in one atlas — the player in a yellow
// raincoat, the eyes in the dark, the drowned hand under the water, the lamps the demo lights, what
// drifts on the water, a wake ring. Each frame is an SVG document of its own, packed by lib/pack.
import {Img, Rng} from '../../lib/image.mjs';
import {pack} from '../../lib/pack.mjs';
import {blobPath, blurFilter, el, n, rasterize, strokeText, svgDoc} from './svg.mjs';

/**
 * @typedef {object} Frame
 * @property {string} name
 * @property {number} w
 * @property {number} h
 * @property {(rng: Rng) => string[]} draw the body, centred on (w / 2, h / 2)
 * @property {number} [scale] the body is drawn at this scale, default 1
 */

const glowDefs = [blurFilter('b1', 1), blurFilter('b2', 2), blurFilter('b4', 4), blurFilter('b8', 8)];

/** The player from above, facing +x: a child in a yellow raincoat with a torch. */
function player() {
  return [
    // arms forward, the sleeves
    el('path', {
      d: 'M-4 -20 C10 -22 22 -12 30 -6 L28 2 C18 -2 6 -8 -4 -8 Z',
      fill: '#c48f1c',
      stroke: '#5a3e07',
      'stroke-width': 2,
    }),
    el('path', {d: 'M-4 20 C10 22 22 12 30 6 L28 -2 C18 2 6 8 -4 8 Z', fill: '#b9861a', stroke: '#5a3e07', 'stroke-width': 2}),
    // the torch in both hands
    el('rect', {x: 26, y: -5, width: 24, height: 10, rx: 3, fill: '#2b2e30', stroke: '#0c0d0e', 'stroke-width': 1.5}),
    el('rect', {x: 46, y: -7, width: 7, height: 14, rx: 2, fill: '#4c5154', stroke: '#0c0d0e', 'stroke-width': 1.5}),
    el('rect', {x: 51, y: -5, width: 3, height: 10, fill: '#f4f7ff'}),
    el('circle', {cx: 29, cy: -5, r: 4, fill: '#e7c6a6', stroke: '#6e4d33', 'stroke-width': 1}),
    el('circle', {cx: 29, cy: 5, r: 4, fill: '#ddbb9a', stroke: '#6e4d33', 'stroke-width': 1}),
    // the coat over the shoulders
    el('ellipse', {cx: -6, cy: 0, rx: 18, ry: 25, fill: '#d6a326', stroke: '#5a3e07', 'stroke-width': 2.2}),
    el('path', {d: 'M-20 -14 C-24 -4 -24 6 -20 14', stroke: '#f2d46a', 'stroke-width': 2.5, fill: 'none', opacity: 0.7}),
    el('path', {d: 'M-6 -25 C2 -18 2 18 -6 25', stroke: '#8f6a12', 'stroke-width': 1.5, fill: 'none'}),
    // the hood, its opening towards the front, the dark of the face in it
    el('ellipse', {cx: 0, cy: 0, rx: 15, ry: 14, fill: '#e2b230', stroke: '#5a3e07', 'stroke-width': 2.2}),
    el('path', {d: 'M5 -10 C14 -8 16 8 5 10 C9 4 9 -4 5 -10 Z', fill: '#2a1f12'}),
    el('path', {
      d: 'M-10 -8 C-6 -12 2 -12 4 -9',
      stroke: '#fbe58f',
      'stroke-width': 2.5,
      fill: 'none',
      'stroke-linecap': 'round',
    }),
    el('path', {d: 'M-12 0 C-10 -2 -2 -2 2 0', stroke: '#a77c16', 'stroke-width': 1.3, fill: 'none'}),
  ];
}

/**
 * A pair (or a triple) of eyes in the dark: almond glows with a slit, a halo around them.
 * @param {string} core @param {string} colour @param {number} count @param {number} size @param {number} gap
 */
function eyes(core, colour, count, size, gap) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const x = (k - (count - 1) / 2) * gap;
    const y = count === 3 && k === 1 ? -size * 0.5 : 0;
    const d = `M${n(x - size)} ${n(y)} Q${n(x)} ${n(y - size * 0.75)} ${n(x + size)} ${n(y)} Q${n(x)} ${n(y + size * 0.75)} ${n(x - size)} ${n(y)} Z`;
    out.push(
      el('ellipse', {cx: x, cy: y, rx: size * 1.6, ry: size * 1.1, fill: colour, opacity: 0.35, filter: 'url(#b8)'}),
      el('path', {d, fill: 'url(#eyeGlow)'}),
      el('ellipse', {cx: x, cy: y, rx: size * 0.13, ry: size * 0.5, fill: '#0a0503', opacity: 0.85}),
      el('circle', {cx: x - size * 0.3, cy: y - size * 0.18, r: size * 0.12, fill: '#fff', opacity: 0.9}),
    );
  }
  return [
    el('radialGradient', {id: 'eyeGlow', cx: 0.5, cy: 0.5, r: 0.5}, [
      el('stop', {offset: 0, 'stop-color': core}),
      el('stop', {offset: 0.55, 'stop-color': colour}),
      el('stop', {offset: 1, 'stop-color': colour, 'stop-opacity': 0.2}),
    ]),
    ...out,
  ];
}

/** The drowned hand: pale, huge, soft under the water. */
function hand() {
  const finger = (/** @type {number} */ a, /** @type {number} */ len, /** @type {number} */ w) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const bx = c * 52;
    const by = s * 52;
    const tx = c * (52 + len);
    const ty = s * (52 + len);
    const kx = c * (52 + len * 0.55) - s * 6;
    const ky = s * (52 + len * 0.55) + c * 6;
    return el('path', {
      d: `M${n(bx)} ${n(by)} Q${n(kx)} ${n(ky)} ${n(tx)} ${n(ty)}`,
      stroke: '#b9c6bf',
      'stroke-width': w,
      'stroke-linecap': 'round',
      fill: 'none',
    });
  };
  return [
    el('g', {filter: 'url(#b4)'}, [
      el('ellipse', {cx: -10, cy: 0, rx: 70, ry: 62, fill: '#b9c6bf'}),
      el('path', {d: 'M-60 -30 L-170 -40 L-170 40 L-60 34 Z', fill: '#aebcb5'}),
      finger(-1.05, 105, 26),
      finger(-0.45, 128, 27),
      finger(0.1, 134, 27),
      finger(0.62, 118, 25),
      finger(1.5, 80, 28),
      el('path', {d: 'M-20 -30 C10 -10 10 20 -10 40', stroke: '#7f8e88', 'stroke-width': 6, fill: 'none', opacity: 0.6}),
    ]),
  ];
}

/** A caged pendant seen from above: the enamel shade, the cord, light spilling at the rim. */
function cagePendant() {
  return [
    el('circle', {cx: 0, cy: 0, r: 34, fill: '#ffb455', opacity: 0.6, filter: 'url(#b2)'}),
    el('circle', {cx: 0, cy: 0, r: 31, fill: '#2f4a3c', stroke: '#14211a', 'stroke-width': 2}),
    el('circle', {cx: -6, cy: -6, r: 22, fill: '#456a57', opacity: 0.8}),
    el('path', {
      d: 'M-18 -18 A26 26 0 0 1 12 -24',
      stroke: '#9cc4ad',
      'stroke-width': 3,
      fill: 'none',
      'stroke-linecap': 'round',
    }),
    el('circle', {cx: 0, cy: 0, r: 7, fill: '#1c1f1d', stroke: '#565c58', 'stroke-width': 2}),
    el('circle', {cx: 0, cy: 0, r: 2.5, fill: '#0b0c0b'}),
  ];
}

/** A hanging fluorescent fixture seen from above. */
function tubePendant() {
  return [
    el('rect', {x: -94, y: -18, width: 188, height: 36, rx: 6, fill: '#d9ffe9', opacity: 0.55, filter: 'url(#b2)'}),
    el('rect', {x: -90, y: -14, width: 180, height: 28, rx: 4, fill: '#cfd3cf', stroke: '#545a56', 'stroke-width': 2}),
    el('rect', {x: -86, y: -10, width: 172, height: 8, rx: 3, fill: '#e9ece8'}),
    el('path', {d: 'M-86 6 h172', stroke: '#9da39f', 'stroke-width': 2}),
    el('circle', {cx: -60, cy: 0, r: 4, fill: '#3a3f3c'}),
    el('circle', {cx: 60, cy: 0, r: 4, fill: '#3a3f3c'}),
    el('rect', {x: -40, y: -3, width: 30, height: 6, fill: '#7e8682', opacity: 0.6}),
  ];
}

/** The neon "WASH": white-hot tubes that the tint colours; the H has died. */
function neonWash() {
  const word = strokeText('WAS', -98, -20, 40, {spacing: 0.32});
  const dead = strokeText('H', 48, -20, 40);
  return [
    el('path', {
      d: word,
      stroke: '#fff',
      'stroke-width': 10,
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      opacity: 0.45,
      filter: 'url(#b8)',
    }),
    el('path', {
      d: word,
      stroke: '#e8ffe8',
      'stroke-width': 6,
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      opacity: 0.85,
      filter: 'url(#b2)',
    }),
    el('path', {
      d: word,
      stroke: '#fff',
      'stroke-width': 2.4,
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
    el('path', {d: dead, stroke: '#5b6660', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round'}),
  ];
}

/** A wall-mounted fluorescent tube, lit: white, the tint colours it. */
function wallTube() {
  return [
    el('rect', {x: -84, y: -10, width: 168, height: 20, rx: 10, fill: '#fff', opacity: 0.45, filter: 'url(#b8)'}),
    el('rect', {x: -80, y: -5, width: 160, height: 10, rx: 5, fill: '#fff', opacity: 0.9, filter: 'url(#b1)'}),
    el('rect', {x: -78, y: -2.5, width: 156, height: 5, rx: 2.5, fill: '#fff'}),
  ];
}

/** a sheet of a patient record, floating @param {Rng} rng */
function paper(rng) {
  const lines = [];
  for (let l = 0; l < 8; l++)
    lines.push(
      el('path', {d: `M-18 ${n(-18 + l * 6)}h${n(rng.range(16, 34))}`, stroke: '#3b4a5c', 'stroke-width': 1.3, opacity: 0.8}),
    );
  return [
    el('path', {d: 'M-24 -32 L22 -30 L24 32 L-22 30 Z', fill: '#e2ded0', stroke: '#8f8a79', 'stroke-width': 1}),
    el('path', {d: 'M-24 -32 L22 -30 L22 -22 L-24 -24 Z', fill: '#b8a988'}),
    el('rect', {x: 6, y: -18, width: 12, height: 14, fill: '#8a8f97', opacity: 0.6}),
    ...lines,
    el('path', {d: 'M22 -30 L24 32 L18 26 Z', fill: '#c9c4b2'}),
  ];
}

function pillBottle() {
  return [
    el('rect', {
      x: -10,
      y: -14,
      width: 20,
      height: 32,
      rx: 4,
      fill: '#c76a1c',
      opacity: 0.85,
      stroke: '#5d2d07',
      'stroke-width': 1.2,
    }),
    el('rect', {x: -9, y: -4, width: 18, height: 12, fill: '#efe9da'}),
    el('rect', {x: -12, y: -20, width: 24, height: 8, rx: 2, fill: '#f2f0ea', stroke: '#8a877e', 'stroke-width': 1.2}),
    el('rect', {x: -6, y: -12, width: 3, height: 26, fill: '#fff', opacity: 0.35}),
  ];
}

function glove() {
  const d =
    'M-16 20 L-14 -2 L-20 -14 Q-22 -20 -16 -18 L-8 -8 L-8 -24 Q-6 -30 -2 -24 L0 -10 L2 -28 Q6 -32 8 -26 L8 -8 L12 -24 Q16 -28 18 -22 L14 -4 L18 -14 Q24 -14 22 -8 L14 14 L10 22 Z';
  return [
    el('path', {d, fill: '#a9c4cf', opacity: 0.9, stroke: '#56717c', 'stroke-width': 1.3}),
    el('path', {d: 'M-12 18 L10 22', stroke: '#d6e6ec', 'stroke-width': 3}),
  ];
}

/** a porcelain doll's head, floating face up, one eye gone */
function dollHead() {
  return [
    el('circle', {cx: 0, cy: 0, r: 18, fill: '#e8dccd', stroke: '#7d6b5a', 'stroke-width': 1.3}),
    el('path', {d: 'M-18 -2 C-18 -16 -8 -20 0 -20 C10 -20 18 -14 18 -4 C10 -12 -6 -14 -18 -2 Z', fill: '#4a3021'}),
    el('ellipse', {cx: -6, cy: 2, rx: 3.6, ry: 2.6, fill: '#2b3d56'}),
    el('ellipse', {cx: 7, cy: 2, rx: 3.6, ry: 2.6, fill: '#140c08'}),
    el('path', {d: 'M-3 10 Q1 12 4 10', stroke: '#a3423b', 'stroke-width': 2, fill: 'none'}),
    el('path', {d: 'M8 -6 L4 4 L9 10 L6 16', stroke: '#6e5b4a', 'stroke-width': 0.9, fill: 'none'}),
    el('circle', {cx: -9, cy: 7, r: 3, fill: '#e9a99d', opacity: 0.45}),
  ];
}

function idBand() {
  return [
    el('path', {d: 'M-20 -2 C-12 -10 12 -10 20 -2 C12 6 -12 6 -20 -2 Z', fill: 'none', stroke: '#e8e5dc', 'stroke-width': 4}),
    el('rect', {x: -8, y: -11, width: 16, height: 7, fill: '#f4f2ec', stroke: '#8b887e', 'stroke-width': 0.8}),
    el('path', {d: 'M-6 -7.5 h10', stroke: '#45464d', 'stroke-width': 1}),
  ];
}

function floatingSock() {
  return [
    el('path', {
      d: 'M-20 -6 L6 -6 C14 -6 16 -2 18 4 L20 10 C20 16 14 18 10 14 L4 6 L-20 6 Z',
      fill: '#e9e5da',
      stroke: '#575348',
      'stroke-width': 1.2,
    }),
    el('path', {d: 'M-20 -6 h7 v12 h-7 z', fill: '#b23a32'}),
    el('path', {d: 'M10 14 C14 18 20 16 20 10 L18 4 C14 8 10 10 10 14 Z', fill: '#9a988f'}),
  ];
}

function dryerSheet() {
  return [
    el('path', {d: 'M-18 -16 L16 -18 L18 16 L-16 18 Z', fill: '#f2efe8', opacity: 0.85, stroke: '#b9b5aa', 'stroke-width': 1}),
    el('path', {d: 'M-12 -6 L10 -8 M-10 4 L12 2', stroke: '#d3cfc4', 'stroke-width': 1}),
  ];
}

/** @param {Rng} rng */
function lint(rng) {
  const pts = [];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const r = rng.range(6, 11);
    pts.push(/** @type {[number, number]} */ ([Math.cos(a) * r, Math.sin(a) * r]));
  }
  return [el('path', {d: blobPath(pts), fill: '#8f949c', opacity: 0.85, filter: 'url(#b1)'})];
}

/** a thin ring of the water around the player's boots, white: the tint fades it */
function ripple() {
  return [
    el('circle', {cx: 0, cy: 0, r: 56, fill: 'none', stroke: '#fff', 'stroke-width': 4, opacity: 0.5, filter: 'url(#b2)'}),
    el('circle', {cx: 0, cy: 0, r: 56, fill: 'none', stroke: '#fff', 'stroke-width': 1.5}),
  ];
}

/** a soft round shadow */
function shadow() {
  return [el('circle', {cx: 0, cy: 0, r: 18, fill: '#000', opacity: 0.8, filter: 'url(#b8)'})];
}

/** @type {Frame[]} */
const FRAMES = [
  {name: 'player', w: 192, h: 144, draw: player, scale: 1.5},
  {name: 'eyes-pale', w: 192, h: 112, draw: () => eyes('#fffbe0', '#e8e35a', 2, 15, 56)},
  {name: 'eyes-ember', w: 144, h: 96, draw: () => eyes('#ffe6b8', '#ff5a1e', 2, 10, 38)},
  {name: 'eyes-three', w: 192, h: 128, draw: () => eyes('#f4fbff', '#9fd4ff', 3, 12, 42)},
  {name: 'hand', w: 384, h: 320, draw: hand},
  {name: 'cage-pendant', w: 96, h: 96, draw: cagePendant},
  {name: 'tube-pendant', w: 224, h: 72, draw: tubePendant},
  {name: 'neon-wash', w: 288, h: 128, draw: neonWash},
  {name: 'wall-tube', w: 224, h: 80, draw: wallTube},
  {name: 'paper-a', w: 64, h: 80, draw: (rng) => paper(rng)},
  {name: 'paper-b', w: 64, h: 80, draw: (rng) => paper(rng)},
  {name: 'pill-bottle', w: 40, h: 56, draw: pillBottle},
  {name: 'glove', w: 64, h: 72, draw: glove},
  {name: 'doll-head', w: 48, h: 48, draw: dollHead},
  {name: 'id-band', w: 56, h: 32, draw: idBand},
  {name: 'sock', w: 56, h: 40, draw: floatingSock},
  {name: 'dryer-sheet', w: 48, h: 48, draw: dryerSheet},
  {name: 'lint', w: 32, h: 32, draw: (rng) => lint(rng)},
  {name: 'ripple', w: 128, h: 128, draw: ripple},
  {name: 'shadow', w: 64, h: 64, draw: shadow},
];

/**
 * Renders and packs the atlas.
 * @returns {Promise<{sheet: Img, frames: import('../../lib/pack.mjs').PackedFrame[]}>}
 */
export async function renderSprites() {
  const rng = new Rng(1031);
  const inputs = [];
  for (const frame of FRAMES) {
    const body = el('g', {transform: `translate(${frame.w / 2} ${frame.h / 2}) scale(${frame.scale ?? 1})`}, frame.draw(rng));
    const data = await rasterize(svgDoc(frame.w, frame.h, glowDefs, [body]), frame.w, frame.h);
    inputs.push({name: frame.name, img: new Img(frame.w, frame.h, new Uint8Array(data))});
  }
  return pack(inputs, {padding: 6, keepOrder: false});
}
