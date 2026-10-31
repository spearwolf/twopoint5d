// stage-masks/flashlight: the sprites of "The Crawlspace" in one atlas — the player crawling with a
// flashlight (four frames), the three crayon drawings pinned to the post, the eyes in the dark, a
// drop and its splash, and the near things in front of the plane (a timber post, a cobweb, dangling
// wires, rubble, a tuft of insulation). Every frame is a small layer of its own, authored y-down
// around its middle, at its own texels per unit; `layout.json` gives each frame its size in units.
import {Rng} from '../../lib/image.mjs';
import {pack} from '../../lib/pack.mjs';
import {blurFilter, el, Layer, n, poly, wood} from './kit.mjs';

/**
 * @typedef {object} Sprite
 * @property {string} name
 * @property {number} ppu texels per unit
 * @property {number} w width in units
 * @property {number} h height in units
 * @property {string[]} [defs]
 * @property {() => string[]} body SVG, y-down, origin in the middle of the frame
 * @property {(u: number, v: number) => [number, number, number, number] | undefined} [paint] per pixel, y up
 */

// ------------------------------------------------------------------------------------------ player

/** where the lens of the flashlight is in a player frame facing +x, from its middle, y up */
export const LENS = {x: 88, y: 4};
const PLAYER_W = 220;
const PLAYER_H = 120;
/** the ground under the player, from the middle of the frame, y down */
const GROUND = 54;

/** @param {number} ax @param {number} ay @param {number} bx @param {number} by @param {number} w @param {string} c */
const limb = (ax, ay, bx, by, w, c) =>
  el('path', {d: `M${n(ax)} ${n(ay)}L${n(bx)} ${n(by)}`, stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', fill: 'none'});

/**
 * A child crawling to the right in a parka too big for them, hood up, on the knees and the far hand,
 * the near arm forward with the flashlight. `phase` 0..1 is the step.
 * @param {number} phase
 */
function player(phase) {
  const a = phase * Math.PI * 2;
  const bob = Math.sin(a * 2) * 1.5;
  const g = GROUND;
  const hip = [-42, g - 50 + bob];
  const shoulder = [24, g - 58 + bob];
  // the far side first, darker
  const farKnee = [-34 - 12 * Math.sin(a + Math.PI), g - 6];
  const farFoot = [-84 - 6 * Math.sin(a + Math.PI), g - 8 - 4 * Math.max(0, Math.cos(a + Math.PI))];
  const nearKnee = [-34 - 12 * Math.sin(a), g - 6];
  const nearFoot = [-84 - 6 * Math.sin(a), g - 8 - 4 * Math.max(0, Math.cos(a))];
  const farHand = [44 + 16 * Math.sin(a), g - 2 - 6 * Math.max(0, Math.cos(a))];
  const farElbow = [(shoulder[0] + farHand[0]) / 2 + 6, (shoulder[1] + farHand[1]) / 2];
  const lensY = -LENS.y;
  const grip = [LENS.x - 26, lensY + 3];
  const nearElbow = [44, g - 38 + bob];
  return [
    el('ellipse', {cx: -10, cy: g + 1, rx: 92, ry: 5, fill: '#0b0806', opacity: 0.55, filter: 'url(#b3)'}),
    // far leg and arm
    limb(hip[0], hip[1], farKnee[0], farKnee[1], 19, '#1d2433'),
    limb(farKnee[0], farKnee[1], farFoot[0], farFoot[1], 15, '#1d2433'),
    el('ellipse', {cx: farFoot[0] - 6, cy: farFoot[1] + 1, rx: 11, ry: 6, fill: '#6f6a60'}),
    limb(shoulder[0], shoulder[1], farElbow[0], farElbow[1], 13, '#232b20'),
    limb(farElbow[0], farElbow[1], farHand[0], farHand[1], 11, '#232b20'),
    el('ellipse', {cx: farHand[0] + 3, cy: farHand[1], rx: 6, ry: 4, fill: '#8a6e5a'}),
    // the body: the parka, puffed, its hem riding up over the jeans
    limb(hip[0], hip[1], nearKnee[0], nearKnee[1], 20, '#2f3a50'),
    limb(nearKnee[0], nearKnee[1], nearFoot[0], nearFoot[1], 16, '#2f3a50'),
    el('path', {d: `M${n(nearKnee[0] - 6)} ${n(nearKnee[1] - 4)}l10 1`, stroke: '#4a5876', 'stroke-width': 2}),
    el('ellipse', {cx: nearFoot[0] - 7, cy: nearFoot[1] + 1, rx: 12, ry: 6.5, fill: '#b9b2a4'}),
    el('path', {d: `M${n(nearFoot[0] - 18)} ${n(nearFoot[1] + 4)}h20`, stroke: '#3b352d', 'stroke-width': 2.4}),
    el('path', {
      d: `M${n(hip[0] - 14)} ${n(hip[1] + 6)}C${n(hip[0] - 20)} ${n(hip[1] - 22)} ${n(shoulder[0] - 30)} ${n(shoulder[1] - 22)} ${n(shoulder[0] + 6)} ${n(shoulder[1] - 14)}C${n(shoulder[0] + 18)} ${n(shoulder[1] - 6)} ${n(shoulder[0] + 16)} ${n(shoulder[1] + 18)} ${n(shoulder[0])} ${n(shoulder[1] + 22)}C${n(shoulder[0] - 30)} ${n(shoulder[1] + 30)} ${n(hip[0])} ${n(hip[1] + 22)} ${n(hip[0] - 14)} ${n(hip[1] + 6)}Z`,
      fill: '#3d4a33',
    }),
    el('path', {
      d: `M${n(hip[0] - 10)} ${n(hip[1] - 10)}C${n(hip[0] + 10)} ${n(shoulder[1] - 22)} ${n(shoulder[0] - 20)} ${n(shoulder[1] - 18)} ${n(shoulder[0] + 4)} ${n(shoulder[1] - 12)}`,
      stroke: '#64744f',
      'stroke-width': 3,
      fill: 'none',
      opacity: 0.8,
    }),
    el('path', {
      d: `M${n(hip[0] + 10)} ${n(hip[1] - 14)}q4 14 0 26M${n(hip[0] + 34)} ${n(hip[1] - 18)}q4 14 0 28`,
      stroke: '#28311f',
      'stroke-width': 1.6,
      fill: 'none',
    }),
    // the hood, its fur trim, the dark where the face is
    el('circle', {cx: shoulder[0] + 18, cy: shoulder[1] - 6, r: 18, fill: '#3d4a33'}),
    el('path', {
      d: `M${n(shoulder[0] + 26)} ${n(shoulder[1] - 22)}C${n(shoulder[0] + 40)} ${n(shoulder[1] - 18)} ${n(shoulder[0] + 42)} ${n(shoulder[1] + 4)} ${n(shoulder[0] + 30)} ${n(shoulder[1] + 10)}`,
      stroke: '#8a7a5e',
      'stroke-width': 6,
      fill: 'none',
      'stroke-linecap': 'round',
      filter: 'url(#fuzz)',
    }),
    el('path', {
      d: `M${n(shoulder[0] + 27)} ${n(shoulder[1] - 16)}C${n(shoulder[0] + 36)} ${n(shoulder[1] - 12)} ${n(shoulder[0] + 36)} ${n(shoulder[1] + 2)} ${n(shoulder[0] + 28)} ${n(shoulder[1] + 6)}Z`,
      fill: '#0e0c0a',
    }),
    el('path', {
      d: `M${n(shoulder[0] + 31)} ${n(shoulder[1] - 6)}q3 3 1 7`,
      stroke: '#c8a58a',
      'stroke-width': 2.2,
      fill: 'none',
      'stroke-linecap': 'round',
    }),
    // the near arm and the flashlight
    limb(shoulder[0] + 4, shoulder[1] + 4, nearElbow[0], nearElbow[1], 14, '#465540'),
    limb(nearElbow[0], nearElbow[1], grip[0], grip[1], 12, '#465540'),
    el('rect', {x: grip[0] - 6, y: lensY - 1, width: 24, height: 8, rx: 2, fill: '#7d1f1b'}),
    el('rect', {x: grip[0] + 16, y: lensY - 3, width: 10, height: 12, rx: 1.5, fill: '#9a9d9c'}),
    el('rect', {x: grip[0] + 24, y: lensY - 3, width: 2.5, height: 12, fill: '#f6e6c0'}),
    el('ellipse', {cx: grip[0] + 2, cy: grip[1] + 1, rx: 6, ry: 5, fill: '#a3826a'}),
  ];
}

// ---------------------------------------------------------------------------------------- drawings

/** wax crayon: a wobbly displacement and a grainy edge */
const crayonDefs = [
  el('filter', {id: 'wax', x: '-10%', y: '-10%', width: '120%', height: '120%'}, [
    el('feTurbulence', {type: 'fractalNoise', baseFrequency: 0.9, numOctaves: 2, seed: 11, result: 't'}),
    el('feDisplacementMap', {
      in: 'SourceGraphic',
      in2: 't',
      scale: 1.2,
      xChannelSelector: 'R',
      yChannelSelector: 'G',
      result: 'd',
    }),
    el('feComponentTransfer', {in: 't', result: 'grain'}, el('feFuncA', {type: 'discrete', tableValues: '0 1 1 1'})),
    el('feComposite', {in: 'd', in2: 'grain', operator: 'in'}),
  ]),
];

/** capitals for the crayon, as polylines in a box of 1 × 1.4, y down */
const CRAYON_GLYPHS = /** @type {Record<string, [number, number][][]>} */ ({
  M: [
    [
      [0, 1.4],
      [0.1, 0],
      [0.5, 0.8],
      [0.9, 0],
      [1, 1.4],
    ],
  ],
  Y: [
    [
      [0, 0],
      [0.5, 0.7],
      [1, 0],
    ],
    [
      [0.5, 0.7],
      [0.5, 1.4],
    ],
  ],
  F: [
    [
      [0.9, 0],
      [0.1, 0],
      [0.1, 1.4],
    ],
    [
      [0.1, 0.65],
      [0.7, 0.65],
    ],
  ],
  R: [
    [
      [0.1, 1.4],
      [0.1, 0],
      [0.8, 0.1],
      [0.85, 0.55],
      [0.1, 0.7],
      [0.9, 1.4],
    ],
  ],
  I: [
    [
      [0.5, 0],
      [0.5, 1.4],
    ],
  ],
  E: [
    [
      [0.9, 0],
      [0.1, 0],
      [0.1, 1.4],
      [0.9, 1.4],
    ],
    [
      [0.1, 0.7],
      [0.7, 0.7],
    ],
  ],
  // the N the child wrote backwards
  N: [
    [
      [0.1, 1.4],
      [0.1, 0],
      [0.9, 1.4],
      [0.9, 0],
    ],
  ],
  D: [
    [
      [0.1, 0],
      [0.1, 1.4],
      [0.7, 1.2],
      [0.9, 0.7],
      [0.7, 0.2],
      [0.1, 0],
    ],
  ],
});

/**
 * Crayon capitals, one stroke path. `mirror` lists letters the child wrote backwards.
 * @param {string} text @param {number} x @param {number} y @param {number} size the height of a letter
 * @param {Rng} rng @param {string[]} [mirror]
 */
function crayonText(text, x, y, size, rng, mirror = []) {
  const s = size / 1.4;
  let d = '';
  let cx = x;
  for (const ch of text) {
    if (ch === ' ') {
      cx += s * 0.7;
      continue;
    }
    const glyph = CRAYON_GLYPHS[ch];
    if (!glyph) throw new Error(`crayonText: no glyph for "${ch}"`);
    const flip = mirror.includes(ch);
    const lift = rng.range(-0.12, 0.12) * size;
    for (const line of glyph) {
      d += `M${line.map(([gx, gy]) => `${n(cx + (flip ? 1 - gx : gx) * s + rng.range(-0.3, 0.3))} ${n(y + lift + gy * s + rng.range(-0.3, 0.3))}`).join('L')}`;
    }
    cx += s * (1.25 + rng.range(-0.1, 0.2));
  }
  return d;
}

const SHEET_W = 56;
const SHEET_H = 72;

/** @param {string} d @param {string} c @param {number} [w] */
const crayon = (d, c, w = 1.4) =>
  el('path', {
    d,
    stroke: c,
    'stroke-width': w,
    fill: 'none',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    filter: 'url(#wax)',
  });

/** @param {number} x @param {number} y @param {number} r @param {string} c */
const scribbleDisc = (x, y, r, c, rng = new Rng(5)) => {
  let d = '';
  for (let i = 0; i < 9; i++) {
    const a = rng.range(0, Math.PI);
    d += `M${n(x + Math.cos(a) * r)} ${n(y + Math.sin(a) * r)}L${n(x - Math.cos(a) * r)} ${n(y - Math.sin(a) * r)}`;
  }
  return crayon(d, c, 1.6);
};

/** The sheet: aged paper, a fold across it, a dog-ear, the red thumbtack. */
function sheet(/** @type {number} */ tilt, /** @type {string[]} */ art) {
  const hw = SHEET_W / 2 - 3;
  const hh = SHEET_H / 2 - 3;
  return [
    el('g', {transform: `rotate(${n(tilt)})`}, [
      el('rect', {x: -hw + 1.5, y: -hh + 2, width: hw * 2, height: hh * 2, fill: '#000', opacity: 0.45, filter: 'url(#b1)'}),
      el('path', {d: `M${-hw} ${-hh}H${hw}V${hh - 7}L${hw - 7} ${hh}H${-hw}Z`, fill: '#cfc4a8'}),
      el('path', {d: `M${hw} ${hh - 7}L${hw - 7} ${hh - 6}L${hw - 7} ${hh}Z`, fill: '#a99c80'}),
      el('path', {d: `M${-hw} 2H${hw}`, stroke: '#a89b7f', 'stroke-width': 0.5}),
      el('rect', {x: -hw, y: -hh, width: hw * 2, height: hh * 2, fill: '#5a4a30', opacity: 0.12, filter: 'url(#b3)'}),
      ...art,
      el('circle', {cx: 0, cy: -hh + 3.5, r: 2.4, fill: '#8f1d18'}),
      el('circle', {cx: -0.7, cy: -hh + 2.8, r: 0.8, fill: '#e57a6a'}),
    ]),
  ];
}

/** A house in crayon, the sun, and under the house a scribbled black space with two eyes, and a child with a yellow light. */
function drawingHouse() {
  const rng = new Rng(301);
  return sheet(0, [
    crayon('M-16 -6L0 -20L16 -6Z', '#a3352c', 1.6),
    crayon('M-13 -6V10H13V-6', '#6b5a40', 1.6),
    crayon('M-4 10V2H3V10', '#3b5b8a'),
    crayon('M-10 -3h5v4h-5zM5 -3h5v4h-5z', '#3b5b8a', 1.1),
    scribbleDisc(13, -23, 4, '#d8a62a', rng),
    crayon('M13 -29v-2M19 -23h2M17.5 -27.5l1.5 -1.5M8.5 -27.5l-1.5 -1.5', '#d8a62a', 1.2),
    crayon('M-22 10H22', '#3d6a3a', 1.8),
    // under the floor: black scribble, two eyes, the child and the cone of a light
    crayon('M-20 13h40M-20 15h40M-20 17h40M-20 19h40M-20 21h40M-20 23h40M-20 25h40', '#1c1a1a', 1.8),
    el('circle', {cx: 10, cy: 18, r: 1.3, fill: '#e9e1c0'}),
    el('circle', {cx: 14, cy: 18, r: 1.3, fill: '#e9e1c0'}),
    crayon('M-16 22l6 -1M-15 22v2M-11 21v2', '#e9e1c0', 1),
    crayon('M-10 21L4 16M-10 21L4 25', '#e8c02a', 1.2),
  ]);
}

/** The family in crayon — mother, father, child, dog — and at the edge something tall and grey with long arms. */
function drawingFamily() {
  const rng = new Rng(303);
  const stick = (/** @type {number} */ x, /** @type {number} */ h, /** @type {string} */ c) =>
    crayon(
      `M${n(x)} ${n(16 - h * 0.45)}V${n(16 - h * 0.15)}M${n(x)} ${n(16 - h * 0.15)}l-4 ${n(h * 0.15)}M${n(x)} ${n(16 - h * 0.15)}l4 ${n(h * 0.15)}M${n(x - 6)} ${n(16 - h * 0.38)}H${n(x + 6)}`,
      c,
    );
  return sheet(0, [
    crayon('M-24 18H24', '#3d6a3a', 1.8),
    el('circle', {cx: -15, cy: -2, r: 3.4, fill: 'none', stroke: '#a3352c', 'stroke-width': 1.2, filter: 'url(#wax)'}),
    stick(-15, 38, '#a3352c'),
    el('circle', {cx: -5, cy: -6, r: 3.6, fill: 'none', stroke: '#3b5b8a', 'stroke-width': 1.2, filter: 'url(#wax)'}),
    stick(-5, 46, '#3b5b8a'),
    el('circle', {cx: 4, cy: 4, r: 2.8, fill: 'none', stroke: '#d8a62a', 'stroke-width': 1.2, filter: 'url(#wax)'}),
    stick(4, 26, '#d8a62a'),
    crayon('M9 14h6M10 14v2M14 14v2M15 14l2 -2M9 14l-1 -2', '#6b5a40', 1.2),
    crayonText('ME', 0, -10, 5, rng),
    // the tall grey one, too thin, arms to the ground, a row of eyes
    crayon('M20 -22V10M20 -16L14 16M20 -16L26 16M20 10l-3 8M20 10l3 8', '#77746e', 1.2),
    el('ellipse', {cx: 20, cy: -25, rx: 3, ry: 4.5, fill: 'none', stroke: '#77746e', 'stroke-width': 1.2, filter: 'url(#wax)'}),
    crayon('M18.5 -27h0.1M20 -26h0.1M21.5 -27h0.1M19 -24h0.1M21 -24h0.1', '#1c1a1a', 1.3),
  ]);
}

/** "MY FRIEND", the N backwards: the tall pale thing under the floorboards, holding the child's hand. */
function drawingFriend() {
  const rng = new Rng(305);
  const eyes = [];
  for (let i = 0; i < 7; i++)
    eyes.push(el('circle', {cx: -8 + rng.range(-4, 4), cy: -6 + i * 1.8 - 6 + rng.range(-1, 1), r: 0.9, fill: '#1c1a1a'}));
  return sheet(0, [
    crayon(crayonText('MY FRIEND', -21, -30, 6, rng, ['N']), '#a3352c', 1.3),
    // floorboards above them
    crayon('M-24 -18H24M-24 -15H24M-12 -18v3M6 -18v3', '#6b5a40', 1.4),
    // the friend: pale, long, bent under the boards, arms to its knees
    el('path', {
      d: 'M-14 -12C-14 -2 -12 14 -10 24M-2 -12C-2 -2 -4 14 -6 24',
      stroke: '#d9d4c4',
      'stroke-width': 1.6,
      fill: 'none',
      filter: 'url(#wax)',
    }),
    el('ellipse', {cx: -8, cy: -8, rx: 7, ry: 5, fill: '#e3ddcd', filter: 'url(#wax)'}),
    ...eyes,
    crayon('M-14 -4C-22 4 -20 14 -18 20M-2 -4C4 2 8 8 9 12', '#bdb7a6', 1.2),
    // the child, small, its hand in the long hand
    el('circle', {cx: 13, cy: 6, r: 3, fill: 'none', stroke: '#d8a62a', 'stroke-width': 1.2, filter: 'url(#wax)'}),
    crayon('M13 9V18M13 18l-3 6M13 18l3 6M9 12h8', '#d8a62a', 1.2),
    crayon('M12 5h0.1M14 5h0.1M11.8 7.4q1.2 1 2.4 0', '#1c1a1a', 0.8),
    crayon('M-24 24H24', '#3d3a36', 1.6),
  ]);
}

// -------------------------------------------------------------------------------------------- eyes

/**
 * Eyes in the dark: almond glows with a slit pupil, a halo around them. Drawn bright: the demo adds
 * them over the dark.
 * @param {string} core @param {string} glow @param {number} count @param {number} gap
 */
function eyes(core, glow, count, gap) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const x = (k - (count - 1) / 2) * gap;
    const y = count === 3 && k === 1 ? -3 : 0;
    out.push(el('ellipse', {cx: x, cy: y, rx: 7, ry: 4.5, fill: glow, opacity: 0.55, filter: 'url(#b3)'}));
    out.push(
      el('path', {
        d: `M${n(x - 5)} ${n(y)}Q${n(x)} ${n(y - 3.4)} ${n(x + 5)} ${n(y)}Q${n(x)} ${n(y + 3.4)} ${n(x - 5)} ${n(y)}Z`,
        fill: core,
      }),
    );
    out.push(el('ellipse', {cx: x, cy: y, rx: 0.7, ry: 2.6, fill: '#140c08'}));
  }
  return out;
}

// -------------------------------------------------------------------------------------- the near things

/**
 * A timber post close to the camera — a dark, weathered 6 × 6 with a split down its face and the
 * iron of a strap, so it reads as a thing in front of the scene, not as more of the brick behind
 * it. Its sides fall off to black and its outline is soft, so no hard seam shows where the light
 * meets its edge.
 */
function nearPostPaint(/** @type {number} */ u, /** @type {number} */ v) {
  const hw = 34;
  const d = Math.abs(u) / hw;
  if (d > 1) return undefined;
  let c = wood(v * 0.6, u * 1.6, 401);
  // weathered grey timber, darker than every wood behind it
  const grey = (c[0] + c[1] + c[2]) / 3;
  c = [c[0] * 0.35 + grey * 0.25, c[1] * 0.35 + grey * 0.25, c[2] * 0.35 + grey * 0.27];
  // the split down the face, and an iron strap across it
  if (Math.abs(u - 6 - 2 * Math.sin(v * 0.04)) < 0.8) c = [0.02, 0.015, 0.012];
  if (Math.abs(v + 120) < 7) c = [0.09, 0.08, 0.075];
  if (Math.abs(v + 120) < 7 && Math.abs(Math.abs(u) - 18) < 2.2) c = [0.16, 0.14, 0.12];
  // round towards the sides, black at the edge, the outline feathered over the last 3 units
  const k = Math.cos(d * 1.45) ** 1.6;
  const a = Math.min(1, (hw - Math.abs(u)) / 3);
  return /** @type {[number, number, number, number]} */ ([c[0] * k, c[1] * k, c[2] * k, a]);
}

function nearCobweb() {
  const rng = new Rng(403);
  let d = '';
  // a tangled sheet of web from the top left corner, sagging, with dust caught in it
  for (let i = 0; i < 26; i++) {
    const x0 = rng.range(-130, -40);
    const y0 = -100 + rng.range(0, 10);
    const x1 = rng.range(20, 130);
    const y1 = rng.range(-100, 20);
    d += `M${n(x0)} ${n(y0)}Q${n((x0 + x1) / 2)} ${n(Math.max(y0, y1) + rng.range(20, 70))} ${n(x1)} ${n(y1)}`;
  }
  for (let i = 0; i < 14; i++) {
    const x = rng.range(-120, 120);
    d += `M${n(x)} -100q${n(rng.range(-10, 10))} ${n(rng.range(40, 90))} ${n(rng.range(-20, 20))} ${n(rng.range(80, 190))}`;
  }
  return [
    el('path', {d, stroke: '#d8d2c4', 'stroke-width': 0.7, fill: 'none', opacity: 0.55}),
    el('path', {d, stroke: '#d8d2c4', 'stroke-width': 2.4, fill: 'none', opacity: 0.08, filter: 'url(#b2)'}),
    ...Array.from({length: 18}, () =>
      el('circle', {cx: rng.range(-110, 110), cy: rng.range(-90, 40), r: rng.range(0.6, 1.8), fill: '#9d968a', opacity: 0.7}),
    ),
    // a husk, caught
    el('ellipse', {cx: 30, cy: -28, rx: 3, ry: 6, fill: '#4a3f33', transform: 'rotate(20 30 -28)'}),
  ];
}

function nearWires() {
  return [
    el('path', {d: 'M-60 -100C-50 -40 -10 -10 -20 40C-24 60 -14 70 -6 72', stroke: '#141312', 'stroke-width': 4, fill: 'none'}),
    el('path', {d: 'M-40 -100C-30 -60 20 -40 30 0C36 24 24 40 34 56', stroke: '#2b1b14', 'stroke-width': 3, fill: 'none'}),
    el('path', {d: 'M40 -100C46 -70 50 -40 46 -20', stroke: '#141312', 'stroke-width': 3, fill: 'none'}),
    // a bare socket on its cord, no bulb in it
    el('rect', {x: -14, y: 70, width: 16, height: 22, rx: 3, fill: '#2b2622'}),
    el('rect', {x: -11, y: 90, width: 10, height: 6, fill: '#5c564c'}),
    el('path', {d: 'M-14 76h16M-14 82h16', stroke: '#45403a', 'stroke-width': 1}),
    // frayed copper at an end
    el('path', {d: 'M46 -20l-3 6M46 -20l1 7M46 -20l4 5', stroke: '#8f5a34', 'stroke-width': 1}),
  ];
}

function nearRubble() {
  const rng = new Rng(407);
  const out = [];
  for (let i = 0; i < 16; i++) {
    const x = rng.range(-120, 120);
    const w = rng.range(14, 34);
    const h = rng.range(8, 18);
    const y = 40 - h / 2 - rng.range(0, 14) * (1 - Math.abs(x) / 130);
    const c = rng.next() > 0.4 ? '#4d2a1f' : '#4b4740';
    out.push(
      el('rect', {
        x: x - w / 2,
        y: y - h / 2,
        width: w,
        height: h,
        rx: 2,
        fill: c,
        transform: `rotate(${n(rng.range(-25, 25))} ${n(x)} ${n(y)})`,
      }),
    );
    out.push(
      el('rect', {
        x: x - w / 2,
        y: y - h / 2,
        width: w,
        height: 2,
        fill: '#7a5a48',
        opacity: 0.5,
        transform: `rotate(${n(rng.range(-25, 25))} ${n(x)} ${n(y)})`,
      }),
    );
  }
  out.unshift(el('ellipse', {cx: 0, cy: 38, rx: 130, ry: 6, fill: '#0b0806', opacity: 0.6, filter: 'url(#b3)'}));
  // a length of pipe in the heap
  out.push(el('rect', {x: -40, y: 14, width: 120, height: 12, rx: 5, fill: '#2e2a26', transform: 'rotate(-6 20 20)'}));
  out.push(el('rect', {x: -40, y: 16, width: 120, height: 3, fill: '#5d554c', transform: 'rotate(-6 20 20)'}));
  return out;
}

function nearTuft() {
  /** @type {[number, number][]} */
  const pts = [
    [-70, -85],
    [70, -85],
    [60, -20],
    [30, 30],
    [10, 80],
    [-6, 40],
    [-30, 60],
    [-40, 0],
  ];
  return [
    el('path', {d: poly(pts), fill: '#6e3f45', filter: 'url(#fluffNear)'}),
    el('path', {d: poly(pts.map(([x, y]) => [x * 0.8, y * 0.85 - 4])), fill: '#8f5860', opacity: 0.6, filter: 'url(#fluffNear)'}),
  ];
}

/** @type {Sprite[]} */
const SPRITES = [
  ...[0, 1, 2, 3].map((i) => ({name: `player-${i}`, ppu: 2, w: PLAYER_W, h: PLAYER_H, body: () => player(i / 4)})),
  {name: 'drawing-house', ppu: 3, w: SHEET_W, h: SHEET_H, defs: crayonDefs, body: drawingHouse},
  {name: 'drawing-family', ppu: 3, w: SHEET_W, h: SHEET_H, defs: crayonDefs, body: drawingFamily},
  {name: 'drawing-friend', ppu: 3, w: SHEET_W, h: SHEET_H, defs: crayonDefs, body: drawingFriend},
  {name: 'eyes-pale', ppu: 3, w: 40, h: 18, body: () => eyes('#e9f7c8', '#b8f07a', 2, 15)},
  {name: 'eyes-ember', ppu: 3, w: 40, h: 18, body: () => eyes('#ffd08a', '#ff6a1a', 2, 13)},
  {name: 'eyes-three', ppu: 3, w: 46, h: 20, body: () => eyes('#f4ffb0', '#c6e84a', 3, 11)},
  {
    name: 'drip',
    ppu: 4,
    w: 6,
    h: 12,
    body: () => [
      el('path', {d: 'M0 -5Q3 1 2.2 3A2.3 2.3 0 0 1 -2.2 3Q-3 1 0 -5Z', fill: '#a9bcc2'}),
      el('circle', {cx: -0.8, cy: 2, r: 0.7, fill: '#eef6f8'}),
    ],
  },
  {
    name: 'splash',
    ppu: 4,
    w: 24,
    h: 10,
    body: () => [
      el('path', {d: 'M-9 3Q-6 -3 -4 2M-2 2Q0 -4 2 2M4 2Q6 -3 9 3', stroke: '#a9bcc2', 'stroke-width': 1, fill: 'none'}),
    ],
  },
  {name: 'near-post', ppu: 3, w: 68, h: 520, paint: nearPostPaint, body: () => []},
  {name: 'near-cobweb', ppu: 3, w: 260, h: 200, body: nearCobweb},
  {name: 'near-wires', ppu: 3, w: 140, h: 200, body: nearWires},
  {name: 'near-rubble', ppu: 3, w: 270, h: 90, body: nearRubble},
  {name: 'near-tuft', ppu: 3, w: 160, h: 180, body: nearTuft},
];

const commonDefs = [
  blurFilter('b1', 0.8),
  blurFilter('b2', 2),
  blurFilter('b3', 3),
  el('filter', {id: 'fuzz', x: '-10%', y: '-10%', width: '120%', height: '120%'}, [
    el('feTurbulence', {type: 'fractalNoise', baseFrequency: 0.5, numOctaves: 2, seed: 5, result: 't'}),
    el('feDisplacementMap', {in: 'SourceGraphic', in2: 't', scale: 2, xChannelSelector: 'R', yChannelSelector: 'G'}),
  ]),
  el('filter', {id: 'fluffNear', x: '-20%', y: '-20%', width: '140%', height: '140%'}, [
    el('feTurbulence', {type: 'fractalNoise', baseFrequency: 0.1, numOctaves: 3, seed: 9, result: 't'}),
    el('feDisplacementMap', {in: 'SourceGraphic', in2: 't', scale: 10, xChannelSelector: 'R', yChannelSelector: 'G'}),
  ]),
];

/**
 * Renders every sprite and packs the atlas.
 * @returns {Promise<{sheet: import('../../lib/image.mjs').Img, frames: import('../../lib/pack.mjs').PackedFrame[], units: Record<string, {w: number, h: number}>}>}
 */
export async function renderSprites() {
  const inputs = [];
  /** @type {Record<string, {w: number, h: number}>} */
  const units = {};
  for (const s of SPRITES) {
    const layer = new Layer({z: 0, ppu: s.ppu, left: -s.w / 2, right: s.w / 2, bottom: -s.h / 2, top: s.h / 2, tiles: 1});
    if (s.paint) layer.paint(s.paint);
    const body = s.body();
    if (body.length) await layer.svg([...commonDefs, ...(s.defs ?? [])], [el('g', {transform: 'scale(1 -1)'}, body)]);
    if (s.name.startsWith('near-') || s.name.startsWith('player-')) layer.grain(409, 0.14);
    inputs.push({name: s.name, img: layer.toImg()});
    units[s.name] = {w: s.w, h: s.h};
  }
  const {sheet, frames} = pack(inputs, {padding: 4, powerOfTwo: false});
  return {sheet, frames, units};
}
