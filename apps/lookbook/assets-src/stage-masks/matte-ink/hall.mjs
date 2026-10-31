// stage-masks/matte-ink: the level of "The Drowned House" — the hallway on the ground floor, side
// on: a violet damask gone to mould above the tide line, a mahogany wainscot under the black water,
// an open door onto a stair that climbs into the dark, two dead gas sconces, and four portraits in
// gilt frames whose eyes are holes (alpha 0): the demo draws the eyeballs under the wall, so they
// can look wherever they like. Drawn as SVG in units of the stage (origin the middle, y up, 2
// texels per unit), the wallpaper damaged and the paintings crazed per pixel in JavaScript. Also
// the eye parts: a sclera and an iris.
import {fbm, Rng} from '../../lib/image.mjs';
import {encodePng} from '../../lib/png.mjs';
import {blobPath, el, poly, rasterize} from '../spotlight/svg.mjs';
import {box, encodeWebpRGBA, IMG_H, IMG_W, PX, rgrad, toFloat, vgrad, WORLD, worldDoc} from '../rift/kit.mjs';

/** the water surface of the hallway, in units */
export const WATER_Y = -150;
/** the top of the dado rail */
const RAIL_Y = -38;
/** the underside of the cornice */
const CORNICE_Y = 252;
/** the open door: its opening, in units */
const DOOR = {x0: -42, x1: 82, top: 178};
/** where the light at the top of the stair comes from */
export const STAIR_LIGHT = {x: 62, y: 150};
/** the two gas sconces, in units: where their dead mantles sit */
export const SCONCES = [
  {x: -272, y: 122},
  {x: 138, y: 122},
];

/** @param {number} e0 @param {number} e1 @param {number} x */
const ss = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * @typedef {{x: number, y: number, rx: number, ry: number}} LocalEye an eye in the units of its
 *   portrait: middle and the half extents of the almond
 * @typedef {{name: string, cx: number, cy: number, w: number, h: number, rot: number, frame: number,
 *   paint: (rng: Rng) => {svg: string[], eyes: LocalEye[]}}} Portrait
 */

/** a face lit from the upper left: a radial gradient of skin */
const skin = (
  /** @type {string} */ id,
  /** @type {number} */ cx,
  /** @type {number} */ cy,
  /** @type {number} */ r,
  /** @type {string[]} */ tones,
) =>
  rgrad(id, cx, cy, r, [
    [0, tones[0]],
    [0.55, tones[1]],
    [1, tones[2]],
  ]);

/** Lids and a socket shadow around an eye: drawn under the hole the generator punches later. @param {LocalEye} e */
function eyeFrame(e, socket = '#3a2a20') {
  const {x, y, rx, ry} = e;
  return [
    el('ellipse', {cx: x, cy: y + ry * 0.3, rx: rx * 1.7, ry: ry * 2.4, fill: socket, opacity: 0.45, filter: 'url(#soft2)'}),
    // the upper lid: a heavy dark arc, the crease above it
    el('path', {
      d: `M${x - rx * 1.12} ${y} Q${x} ${y + ry * 2.3} ${x + rx * 1.12} ${y}`,
      fill: 'none',
      stroke: '#140c08',
      'stroke-width': 1.1,
    }),
    el('path', {
      d: `M${x - rx} ${y + ry * 1.2} Q${x} ${y + ry * 2.9} ${x + rx * 1.05} ${y + ry * 1.1}`,
      fill: 'none',
      stroke: '#2a1a12',
      'stroke-width': 0.5,
      opacity: 0.7,
    }),
    el('path', {
      d: `M${x - rx * 1.05} ${y} Q${x} ${y - ry * 1.9} ${x + rx * 1.05} ${y}`,
      fill: 'none',
      stroke: '#3a241a',
      'stroke-width': 0.6,
    }),
  ];
}

/** A nose, a mouth and brows for a face whose eyes sit at ±ex, ey. */
function features(
  /** @type {number} */ ex,
  /** @type {number} */ ey,
  /** @type {number} */ s,
  /** @type {{frown?: number, lips?: string, brow?: string}} */ o = {},
) {
  const frown = o.frown ?? 0;
  const brow = o.brow ?? '#1e140e';
  return [
    // brows
    el('path', {
      d: `M${-ex - 5 * s} ${ey + 5 * s + frown * 0.5} Q${-ex} ${ey + 7.5 * s} ${-ex + 5 * s} ${ey + 5 * s - frown}`,
      fill: 'none',
      stroke: brow,
      'stroke-width': 1.6 * s,
      'stroke-linecap': 'round',
    }),
    el('path', {
      d: `M${ex + 5 * s} ${ey + 5 * s + frown * 0.5} Q${ex} ${ey + 7.5 * s} ${ex - 5 * s} ${ey + 5 * s - frown}`,
      fill: 'none',
      stroke: brow,
      'stroke-width': 1.6 * s,
      'stroke-linecap': 'round',
    }),
    // the nose: a shadow down its right side, a lit bridge, the nostrils
    el('path', {
      d: `M${1 * s} ${ey - 1 * s} Q${3.5 * s} ${ey - 8 * s} ${3.6 * s} ${ey - 12 * s}`,
      fill: 'none',
      stroke: '#5a3e2c',
      'stroke-width': 1.6 * s,
      opacity: 0.6,
      filter: 'url(#soft1)',
    }),
    el('path', {
      d: `M${-0.8 * s} ${ey - 2 * s} L${-1 * s} ${ey - 10 * s}`,
      stroke: '#f0dcc0',
      'stroke-width': 1 * s,
      opacity: 0.35,
    }),
    el('path', {
      d: `M${-3.4 * s} ${ey - 12.4 * s} Q${0} ${ey - 14.2 * s} ${3.6 * s} ${ey - 12.4 * s}`,
      fill: 'none',
      stroke: '#3a2418',
      'stroke-width': 0.9 * s,
    }),
    // the mouth: a dark line and a lower lip
    el('path', {
      d: `M${-5.5 * s} ${ey - 19 * s - frown * 0.4} Q${0} ${ey - 18 * s} ${5.5 * s} ${ey - 19 * s - frown * 0.4}`,
      fill: 'none',
      stroke: '#2a120c',
      'stroke-width': 1.1 * s,
      'stroke-linecap': 'round',
    }),
    el('path', {
      d: `M${-4 * s} ${ey - 19.6 * s} Q${0} ${ey - 22.5 * s} ${4 * s} ${ey - 19.6 * s}`,
      fill: 'none',
      stroke: o.lips ?? '#7a4a3a',
      'stroke-width': 1.2 * s,
      opacity: 0.7,
    }),
  ];
}

/** @type {Portrait[]} */
const PORTRAITS = [
  {
    // the master of the house: mutton chops, a frock coat, a frown
    name: 'patriarch',
    cx: -384,
    cy: 96,
    w: 104,
    h: 144,
    rot: 0,
    frame: 11,
    paint: () => {
      const eyes = [
        {x: -8.6, y: 26, rx: 4.6, ry: 2.15},
        {x: 8.6, y: 26, rx: 4.6, ry: 2.15},
      ];
      const svg = [
        rgrad('bg-patriarch', -10, 30, 90, [
          [0, '#3a3524'],
          [0.6, '#1c1a12'],
          [1, '#0b0a07'],
        ]),
        skin('skin-patriarch', -9, 34, 34, ['#e2c9a2', '#a07e5e', '#4a3324']),
        box(-52, -72, 52, 72, {fill: 'url(#bg-patriarch)'}),
        el('path', {d: 'M-60 -80 L-56 -40 Q-40 -18 -14 -14 L14 -14 Q40 -18 56 -40 L60 -80 Z', fill: '#121014'}),
        el('path', {d: 'M-14 -14 L-26 -60 M14 -14 L26 -60', stroke: '#2a2830', 'stroke-width': 1.4}),
        el('path', {d: 'M-13 -14 L0 -42 L13 -14 Z', fill: '#d8d2c2'}),
        el('path', {d: 'M-7 -18 L0 -30 L7 -18 L0 -22 Z', fill: '#1a1416'}),
        box(-8, -16, 8, 0, {fill: '#8a6a4e'}),
        el('ellipse', {cx: 0, cy: 22, rx: 22, ry: 29, fill: 'url(#skin-patriarch)'}),
        // the bald crown catches the light; grey hair at the temples, chops down the jaw, a moustache
        el('ellipse', {cx: -6, cy: 42, rx: 9, ry: 5, fill: '#f2e0c0', opacity: 0.35, filter: 'url(#soft2)'}),
        el('path', {
          d: blobPath([
            [-23, 30],
            [-21, 16],
            [-19, 2],
            [-12, -4],
            [-14, 8],
            [-17, 20],
          ]),
          fill: '#8e8a84',
        }),
        el('path', {
          d: blobPath([
            [23, 30],
            [21, 16],
            [19, 2],
            [12, -4],
            [14, 8],
            [17, 20],
          ]),
          fill: '#77736e',
        }),
        el('path', {
          d: blobPath([
            [-12, 6],
            [-4, 9],
            [0, 8],
            [4, 9],
            [12, 6],
            [6, 3.5],
            [0, 5],
            [-6, 3.5],
          ]),
          fill: '#8a8580',
        }),
        ...features(8.6, 26, 1, {frown: 1.6, brow: '#5a5550'}),
        ...eyes.flatMap((e) => eyeFrame(e)),
      ];
      return {svg, eyes};
    },
  },
  {
    // the bride: her hair up, a high lace collar, a ribbon at the throat
    name: 'bride',
    cx: -168,
    cy: 112,
    w: 92,
    h: 128,
    rot: -4,
    frame: 10,
    paint: () => {
      const eyes = [
        {x: -7.4, y: 18, rx: 4.1, ry: 2.0},
        {x: 7.4, y: 18, rx: 4.1, ry: 2.0},
      ];
      const svg = [
        rgrad('bg-bride', 8, 20, 80, [
          [0, '#2c3a30'],
          [0.6, '#152019'],
          [1, '#080c0a'],
        ]),
        skin('skin-bride', -7, 28, 30, ['#f0ddca', '#bea08c', '#5e4436']),
        box(-46, -64, 46, 64, {fill: 'url(#bg-bride)'}),
        el('path', {d: 'M-54 -70 L-48 -38 Q-30 -22 -10 -20 L10 -20 Q30 -22 48 -38 L54 -70 Z', fill: '#2a1e2c'}),
        // the lace collar up to the chin
        el('path', {d: 'M-14 -26 L-13 -6 Q0 -1 13 -6 L14 -26 Q0 -30 -14 -26 Z', fill: '#d8d0c4'}),
        ...Array.from({length: 6}, (_, i) =>
          el('path', {
            d: `M-13 ${-24 + i * 3.4} Q0 ${-21 + i * 3.4} 13 ${-24 + i * 3.4}`,
            fill: 'none',
            stroke: '#9a9088',
            'stroke-width': 0.5,
          }),
        ),
        el('path', {d: 'M-4 -28 L0 -24 L4 -28 L2 -34 L0 -28 L-2 -34 Z', fill: '#4a1a2a'}),
        el('ellipse', {cx: 0, cy: 16, rx: 18, ry: 24.5, fill: 'url(#skin-bride)'}),
        // dark hair parted in the middle, drawn back over the ears, a bun on top
        el('path', {
          d: blobPath([
            [0, 41],
            [-14, 38],
            [-20, 26],
            [-20, 12],
            [-16, 18],
            [-10, 32],
            [0, 35],
            [10, 32],
            [16, 18],
            [20, 12],
            [20, 26],
            [14, 38],
          ]),
          fill: '#20140e',
        }),
        el('ellipse', {cx: 0, cy: 46, rx: 11, ry: 7, fill: '#1a100a'}),
        el('path', {d: 'M0 40 L0 34', stroke: '#3a281e', 'stroke-width': 0.8}),
        el('ellipse', {cx: -9, cy: 6, rx: 4, ry: 2.4, fill: '#c07a6a', opacity: 0.25, filter: 'url(#soft2)'}),
        el('ellipse', {cx: 9, cy: 6, rx: 4, ry: 2.4, fill: '#c07a6a', opacity: 0.25, filter: 'url(#soft2)'}),
        ...features(7.4, 18, 0.82, {lips: '#8a3a3a'}),
        ...eyes.flatMap((e) => eyeFrame(e, '#4a3028')),
      ];
      return {svg, eyes};
    },
  },
  {
    // the twins, side by side, in the same dress, with the same stare
    name: 'twins',
    cx: 238,
    cy: 100,
    w: 132,
    h: 112,
    rot: 0,
    frame: 11,
    paint: () => {
      const eyes = [];
      const svg = [
        rgrad('bg-twins', 0, 10, 90, [
          [0, '#36283a'],
          [0.6, '#1a1220'],
          [1, '#09070b'],
        ]),
        box(-66, -56, 66, 56, {fill: 'url(#bg-twins)'}),
      ];
      for (const [k, cx] of [-31, 31].entries()) {
        const left = {x: cx - 5.6, y: 10, rx: 3.5, ry: 1.75};
        const right = {x: cx + 5.6, y: 10, rx: 3.5, ry: 1.75};
        eyes.push(left, right);
        svg.push(
          skin(`skin-twin-${k}`, cx - 6, 18, 24, ['#efdccc', '#b89a88', '#54403a']),
          el('path', {
            d: `M${cx - 30} -60 L${cx - 26} -30 Q${cx - 14} -18 ${cx} -18 Q${cx + 14} -18 ${cx + 26} -30 L${cx + 30} -60 Z`,
            fill: '#1c1820',
          }),
          el('path', {
            d: `M${cx - 12} -19 Q${cx - 6} -27 ${cx} -22 Q${cx + 6} -27 ${cx + 12} -19 Q${cx} -15 ${cx - 12} -19 Z`,
            fill: '#e2dbd0',
          }),
          box(cx - 5, -18, cx + 5, -6, {fill: '#a88a78'}),
          el('ellipse', {cx, cy: 8, rx: 15, ry: 19, fill: `url(#skin-twin-${k})`}),
          // a black bob with a straight fringe
          el('path', {
            d: `M${cx - 17} -6 Q${cx - 19} 22 ${cx - 12} 29 Q${cx} 34 ${cx + 12} 29 Q${cx + 19} 22 ${cx + 17} -6 L${cx + 13} -6 L${cx + 13} 16 L${cx - 13} 16 L${cx - 13} -6 Z`,
            fill: '#0e0a0c',
          }),
          el('path', {d: `M${cx - 13} 17 L${cx + 13} 17 L${cx + 13} 15 L${cx - 13} 15 Z`, fill: '#1a1214'}),
          ...features(5.6, 10, 0.62, {lips: '#7a3a3a', brow: '#120c0a'}).map((s) => `<g transform="translate(${cx} 0)">${s}</g>`),
          ...eyeFrame(left, '#3a2a2a'),
          ...eyeFrame(right, '#3a2a2a'),
        );
      }
      return {svg, eyes};
    },
  },
  {
    // the widow behind a black veil, gaunt
    name: 'widow',
    cx: 402,
    cy: 94,
    w: 92,
    h: 130,
    rot: 5,
    frame: 10,
    paint: () => {
      const eyes = [
        {x: -7, y: 18, rx: 4, ry: 1.9},
        {x: 7, y: 18, rx: 4, ry: 1.9},
      ];
      const svg = [
        rgrad('bg-widow', -6, 18, 80, [
          [0, '#22201e'],
          [0.6, '#110f0e'],
          [1, '#050404'],
        ]),
        skin('skin-widow', -6, 24, 28, ['#d8cfc4', '#958478', '#3a302a']),
        box(-46, -65, 46, 65, {fill: 'url(#bg-widow)'}),
        el('path', {d: 'M-52 -72 L-46 -36 Q-28 -22 -10 -20 L10 -20 Q28 -22 46 -36 L52 -72 Z', fill: '#0c0a0c'}),
        box(-6, -22, 6, -4, {fill: '#7a6a5e'}),
        el('ellipse', {cx: 0, cy: 14, rx: 16, ry: 24, fill: 'url(#skin-widow)'}),
        // hollow cheeks
        el('ellipse', {cx: -10, cy: 4, rx: 4, ry: 7, fill: '#3a2c24', opacity: 0.4, filter: 'url(#soft2)'}),
        el('ellipse', {cx: 10, cy: 4, rx: 4, ry: 7, fill: '#3a2c24', opacity: 0.4, filter: 'url(#soft2)'}),
        ...features(7, 18, 0.78, {lips: '#5a3a3a', frown: 0.8}),
        ...eyes.flatMap((e) => eyeFrame(e, '#2a201c')),
        // the veil: a black hood and a net of fine lines over the face
        el('path', {d: 'M-30 -40 Q-30 50 0 52 Q30 50 30 -40 L20 -38 Q24 30 0 38 Q-24 30 -20 -38 Z', fill: '#060506'}),
        ...Array.from({length: 14}, (_, i) =>
          el('path', {d: `M${-20 + i * 3} 40 L${-26 + i * 4} -14`, stroke: '#000', 'stroke-width': 0.35, opacity: 0.55}),
        ),
        ...Array.from({length: 10}, (_, i) =>
          el('path', {
            d: `M-20 ${36 - i * 5} Q0 ${33 - i * 5} 20 ${36 - i * 5}`,
            fill: 'none',
            stroke: '#000',
            'stroke-width': 0.35,
            opacity: 0.5,
          }),
        ),
      ];
      return {svg, eyes};
    },
  },
];

/** A tarnished gilt frame around a canvas of w × h, in the units of the portrait. */
function gilt(/** @type {number} */ w, /** @type {number} */ h, /** @type {number} */ f, /** @type {string} */ id) {
  const out = [];
  const W = w / 2;
  const H = h / 2;
  // four mitred bevels, lit from the top left: top and left bright, bottom and right in shadow
  const sides = [
    {
      pts: [
        [-W - f, H + f],
        [W + f, H + f],
        [W, H],
        [-W, H],
      ],
      fill: `url(#${id}-top)`,
    },
    {
      pts: [
        [-W - f, -H - f],
        [-W, -H],
        [W, -H],
        [W + f, -H - f],
      ],
      fill: '#3a2a10',
    },
    {
      pts: [
        [-W - f, H + f],
        [-W, H],
        [-W, -H],
        [-W - f, -H - f],
      ],
      fill: `url(#${id}-left)`,
    },
    {
      pts: [
        [W + f, H + f],
        [W + f, -H - f],
        [W, -H],
        [W, H],
      ],
      fill: '#4a3614',
    },
  ];
  for (const s of sides) out.push(el('path', {d: poly(/** @type {[number, number][]} */ (s.pts)), fill: s.fill}));
  // the mouldings: a bead at the outer rim, a sight edge at the canvas
  out.push(
    el('rect', {
      x: -W - f + 1.2,
      y: -H - f + 1.2,
      width: w + 2 * f - 2.4,
      height: h + 2 * f - 2.4,
      fill: 'none',
      stroke: '#c8a050',
      'stroke-width': 1,
      'stroke-dasharray': '1.4 1.2',
      opacity: 0.8,
    }),
  );
  out.push(
    el('rect', {
      x: -W - f * 0.45,
      y: -H - f * 0.45,
      width: w + f * 0.9,
      height: h + f * 0.9,
      fill: 'none',
      stroke: '#1e1406',
      'stroke-width': 0.8,
    }),
  );
  out.push(el('rect', {x: -W - 1, y: -H - 1, width: w + 2, height: h + 2, fill: 'none', stroke: '#d4b060', 'stroke-width': 1.2}));
  // corner ornaments: a shell of leaves
  for (const [sx, sy] of [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    const x = sx * (W + f * 0.5);
    const y = sy * (H + f * 0.5);
    out.push(el('circle', {cx: x, cy: y, r: f * 0.55, fill: '#8a6a2a', stroke: '#2a1c08', 'stroke-width': 0.6}));
    out.push(el('circle', {cx: x - 0.8, cy: y + 0.8, r: f * 0.25, fill: '#e0c070', opacity: 0.7}));
  }
  // a cartouche at the top middle
  out.push(
    el('ellipse', {cx: 0, cy: H + f * 0.5, rx: f * 1.3, ry: f * 0.6, fill: '#9a7a32', stroke: '#2a1c08', 'stroke-width': 0.6}),
  );
  return out;
}

/** @param {number} rot degrees @param {number} x @param {number} y */
const rotate = (rot, x, y) => {
  const a = (rot * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};

/** The wallpaper: a damask tile as an SVG pattern, 44 × 60 units. */
function wallpaper() {
  const motif = blobPath([
    [0, 22],
    [5, 12],
    [12, 6],
    [8, -2],
    [14, -12],
    [4, -10],
    [0, -22],
    [-4, -10],
    [-14, -12],
    [-8, -2],
    [-12, 6],
    [-5, 12],
  ]);
  const defs = [
    el('pattern', {id: 'damask', patternUnits: 'userSpaceOnUse', width: 44, height: 60}, [
      box(0, 0, 44, 60, {fill: '#3b3342'}),
      box(0, 0, 1.2, 60, {fill: '#30293a'}),
      box(21.4, 0, 22.6, 60, {fill: '#352e3e'}),
      el('path', {d: motif, transform: 'translate(22 30)', fill: '#4a4054'}),
      el('path', {d: motif, transform: 'translate(22 30) scale(0.55)', fill: '#3b3342'}),
      el('path', {d: motif, transform: 'translate(0 0) scale(0.45)', fill: '#443a4c'}),
      el('path', {d: motif, transform: 'translate(44 0) scale(0.45)', fill: '#443a4c'}),
      el('path', {d: motif, transform: 'translate(0 60) scale(0.45)', fill: '#443a4c'}),
      el('path', {d: motif, transform: 'translate(44 60) scale(0.45)', fill: '#443a4c'}),
    ]),
  ];
  return {defs, body: [box(WORLD.left, RAIL_Y, WORLD.right, CORNICE_Y, {fill: 'url(#damask)'})]};
}

/** Wainscot, rail, cornice, the door and its stair, the sconces. */
function joinery() {
  const out = [];
  // the wainscot: raised panels between stiles, under the water and above it
  out.push(box(WORLD.left, WORLD.bottom, WORLD.right, RAIL_Y, {fill: '#3a2618'}));
  for (let x = WORLD.left + 10; x < WORLD.right; x += 92) {
    for (const [y0, y1] of [
      [-136, -50],
      [-300, -150],
    ]) {
      out.push(box(x + 8, y0, x + 82, y1, {fill: '#2c1c12'}));
      out.push(box(x + 12, y0 + 4, x + 78, y1 - 4, {fill: '#432c1c'}));
      out.push(box(x + 12, y1 - 6, x + 78, y1 - 4, {fill: '#5a3e28'}));
      out.push(box(x + 12, y0 + 4, x + 78, y0 + 6, {fill: '#20140c'}));
    }
  }
  out.push(box(WORLD.left, RAIL_Y - 8, WORLD.right, RAIL_Y, {fill: '#4e3420'}));
  out.push(box(WORLD.left, RAIL_Y - 2, WORLD.right, RAIL_Y, {fill: '#6e4c30'}));
  out.push(box(WORLD.left, RAIL_Y - 9, WORLD.right, RAIL_Y - 8, {fill: '#1a0e08'}));
  // the cornice: a dark crown moulding, dentils, the ceiling in shadow above
  out.push(box(WORLD.left, CORNICE_Y, WORLD.right, WORLD.top, {fill: '#17131a'}));
  out.push(box(WORLD.left, CORNICE_Y, WORLD.right, CORNICE_Y + 14, {fill: '#2a2430'}));
  out.push(box(WORLD.left, CORNICE_Y + 14, WORLD.right, CORNICE_Y + 18, {fill: '#3a3340'}));
  for (let x = WORLD.left; x < WORLD.right; x += 9) out.push(box(x, CORNICE_Y + 2, x + 5, CORNICE_Y + 10, {fill: '#3a3340'}));
  out.push(box(WORLD.left, CORNICE_Y - 3, WORLD.right, CORNICE_Y, {fill: '#0e0b10'}));

  // the door: a moulded case with a pediment, the opening on a stair that climbs into the dark
  const {x0, x1, top} = DOOR;
  out.push(box(x0, WORLD.bottom, x1, top, {fill: '#050406'}));
  // the stair: treads rising to the right, faintly lit from above
  for (let i = 0; i < 14; i++) {
    const y = WATER_Y - 30 + i * 22;
    const x = x0 + 6 + i * 9;
    const l = 0.05 + i * 0.012;
    const c = Math.round(l * 255);
    out.push(box(x, y, x1, y + 3, {fill: `rgb(${c + 6},${c + 10},${c + 4})`}));
    out.push(box(x, y - 19, x1, y, {fill: `rgb(${Math.round(c * 0.5)},${Math.round(c * 0.55)},${Math.round(c * 0.5)})`}));
  }
  // a banister going up with the treads
  out.push(el('path', {d: `M${x0 + 10} ${WATER_Y + 20} L${x1 - 6} ${WATER_Y + 330}`, stroke: '#1a1410', 'stroke-width': 3.5}));
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const bx = x0 + 14 + t * (x1 - x0 - 22);
    const by = WATER_Y + 20 + t * 310;
    out.push(box(bx - 0.8, by - 40, bx + 0.8, by, {fill: '#150f0c'}));
  }
  out.push(el('rect', {x: x0, y: WORLD.bottom, width: x1 - x0, height: top - WORLD.bottom, fill: 'url(#stair-light)'}));
  // the leaf, swung open against the wall on the left
  out.push(
    el('path', {
      d: poly([
        [x0 - 2, WORLD.bottom],
        [x0 - 2, top - 2],
        [x0 - 24, top - 16],
        [x0 - 24, WORLD.bottom],
      ]),
      fill: '#2a1a10',
      stroke: '#120a06',
      'stroke-width': 1,
    }),
  );
  out.push(box(x0 - 20, 40, x0 - 6, 120, {fill: '#22140c'}));
  out.push(box(x0 - 20, -110, x0 - 6, 20, {fill: '#22140c'}));
  // the case
  out.push(box(x0 - 12, WORLD.bottom, x0, top + 12, {fill: '#4a301e'}));
  out.push(box(x1, WORLD.bottom, x1 + 12, top + 12, {fill: '#3a2414'}));
  out.push(box(x0 - 12, top, x1 + 12, top + 12, {fill: '#4e3420'}));
  out.push(
    el('path', {
      d: poly([
        [x0 - 22, top + 12],
        [x1 + 22, top + 12],
        [x1 + 16, top + 22],
        [(x0 + x1) / 2, top + 50],
        [x0 - 16, top + 22],
      ]),
      fill: '#4a301e',
      stroke: '#1a0e08',
      'stroke-width': 1.2,
    }),
  );
  out.push(
    el('path', {
      d: `M${x0 - 6} ${top + 22} L${(x0 + x1) / 2} ${top + 42} L${x1 + 6} ${top + 22}`,
      fill: 'none',
      stroke: '#6e4c30',
      'stroke-width': 1.2,
    }),
  );

  // the sconces: a brass arm and the dead mantle in a cracked glass shade
  for (const {x, y} of SCONCES) {
    out.push(el('ellipse', {cx: x, cy: y - 26, rx: 7, ry: 11, fill: '#5a4420', stroke: '#1e1408', 'stroke-width': 0.8}));
    out.push(
      el('path', {d: `M${x} ${y - 22} Q${x + 12} ${y - 16} ${x} ${y - 6}`, fill: 'none', stroke: '#6a5028', 'stroke-width': 2.4}),
    );
    out.push(
      el('path', {
        d: `M${x - 9} ${y + 16} L${x - 6} ${y - 4} L${x + 6} ${y - 4} L${x + 9} ${y + 16} Z`,
        fill: '#8a9488',
        opacity: 0.45,
        stroke: '#c0c8bc',
        'stroke-width': 0.6,
      }),
    );
    out.push(
      el('path', {
        d: `M${x - 4} ${y + 12} L${x + 1} ${y + 4} L${x + 5} ${y + 10}`,
        fill: 'none',
        stroke: '#e0e8dc',
        'stroke-width': 0.5,
        opacity: 0.7,
      }),
    );
    out.push(
      el('path', {
        d: `M${x - 3} ${y - 4} L${x + 3} ${y - 4} L${x + 2} ${y + 6} L${x - 2} ${y + 6} Z`,
        fill: '#d8d2c0',
        opacity: 0.6,
      }),
    );
  }
  return out;
}

/** The eye parts: a sclera (0, 0, 64, 64) and an iris (64, 0, 64, 64), straight alpha. */
function eyeParts() {
  const w = 128;
  const h = 64;
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const iris = x >= 64;
      const u = ((x % 64) + 0.5) / 32 - 1;
      const v = (y + 0.5) / 32 - 1;
      const r = Math.hypot(u, v);
      let c;
      let a;
      if (!iris) {
        // a wet ball: yellowed, darker to its rim, thin red veins coming in from the edge
        const shade = 1 - 0.55 * r * r;
        const vein = Math.max(0, fbm(Math.atan2(v, u) * 3 + 10, r * 3, 61, 3) - 0.62) * 4 * ss(0.3, 0.95, r);
        c = [0.86 * shade, (0.8 - vein * 0.5) * shade, (0.66 - vein * 0.45) * shade];
        a = 1 - ss(0.94, 1, r);
      } else {
        // hazel fibres around a black pupil, a dark limbus, one highlight
        const ang = Math.atan2(v, u);
        const fib = fbm(ang * 6 + 20, r * 4, 71, 3);
        const t = r / 0.92;
        c = [0.32 + fib * 0.22 - t * 0.12, 0.26 + fib * 0.18 - t * 0.1, 0.1 + fib * 0.08];
        const limbus = ss(0.72, 0.92, r);
        c = c.map((k) => k * (1 - limbus * 0.75));
        const pupil = 1 - ss(0.3, 0.36, r);
        c = c.map((k) => k * (1 - pupil));
        const hl = 1 - ss(0.06, 0.13, Math.hypot(u + 0.28, v + 0.3));
        c = c.map((k) => k + hl * 0.9);
        a = 1 - ss(0.88, 0.94, r);
      }
      rgba[i] = Math.round(Math.min(1, Math.max(0, c[0])) * 255);
      rgba[i + 1] = Math.round(Math.min(1, Math.max(0, c[1])) * 255);
      rgba[i + 2] = Math.round(Math.min(1, Math.max(0, c[2])) * 255);
      rgba[i + 3] = Math.round(a * 255);
      if (rgba[i + 3] === 0) rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
    }
  }
  return encodePng(w, h, rgba);
}

/** @returns {Promise<{hall: Buffer, eyes: Buffer, layout: object}>} */
export async function renderHall() {
  const rng = new Rng(1899);
  const w = IMG_W;
  const h = IMG_H;
  const sharedDefs = [
    el('filter', {id: 'soft1', x: '-50%', y: '-50%', width: '200%', height: '200%'}, el('feGaussianBlur', {stdDeviation: 1})),
    el('filter', {id: 'soft2', x: '-50%', y: '-50%', width: '200%', height: '200%'}, el('feGaussianBlur', {stdDeviation: 2.2})),
    el('filter', {id: 'paint', x: '-5%', y: '-5%', width: '110%', height: '110%'}, el('feGaussianBlur', {stdDeviation: 0.55})),
    el('filter', {id: 'cast', x: '-50%', y: '-50%', width: '200%', height: '200%'}, el('feGaussianBlur', {stdDeviation: 7})),
    rgrad('stair-light', STAIR_LIGHT.x, STAIR_LIGHT.y, 230, [
      [0, '#8ab070', 0.32],
      [0.5, '#3a5030', 0.12],
      [1, '#000', 0],
    ]),
  ];

  // the wallpaper alone, so its damage stays off the paintings and the joinery
  const paper = wallpaper();
  const paperImg = toFloat(await rasterize(worldDoc([...sharedDefs, ...paper.defs], paper.body), w, h));

  // paintings (canvases only), then frames, joinery and the cast shadows
  /** @type {{x: number, y: number, rx: number, ry: number, rot: number, portrait: string}[]} */
  const eyes = [];
  const canvases = [];
  const frames = [];
  const shadows = [];
  for (const p of PORTRAITS) {
    const {svg, eyes: local} = p.paint(rng);
    const defs = svg.filter((s) => s.startsWith('<radialGradient') || s.startsWith('<linearGradient'));
    const body = svg.filter((s) => !defs.includes(s));
    const t = `translate(${p.cx} ${p.cy}) rotate(${p.rot})`;
    canvases.push(...defs, el('g', {transform: t, filter: 'url(#paint)'}, body));
    frames.push(
      vgrad(`${p.name}-top`, p.h / 2 + p.frame, p.h / 2, [
        [0, '#e8c870'],
        [1, '#8a6624'],
      ]),
      el(
        'linearGradient',
        {id: `${p.name}-left`, gradientUnits: 'userSpaceOnUse', x1: -p.w / 2 - p.frame, y1: 0, x2: -p.w / 2, y2: 0},
        [el('stop', {offset: 0, 'stop-color': '#c8a456'}), el('stop', {offset: 1, 'stop-color': '#7a5a20'})],
      ),
      el('g', {transform: t}, gilt(p.w, p.h, p.frame, p.name)),
    );
    // the frame casts a soft shadow down and to the right on the paper; a wire up to a nail
    shadows.push(
      el('g', {transform: `translate(${p.cx + 6} ${p.cy - 9}) rotate(${p.rot})`}, [
        box(-p.w / 2 - p.frame, -p.h / 2 - p.frame, p.w / 2 + p.frame, p.h / 2 + p.frame, {
          fill: '#000',
          opacity: 0.6,
          filter: 'url(#cast)',
        }),
      ]),
    );
    const [tlx, tly] = rotate(p.rot, -p.w * 0.3, p.h / 2 + p.frame);
    const [trx, try_] = rotate(p.rot, p.w * 0.3, p.h / 2 + p.frame);
    const nail = {x: p.cx, y: p.cy + p.h / 2 + p.frame + 34};
    shadows.push(
      el('path', {
        d: `M${p.cx + tlx} ${p.cy + tly} L${nail.x} ${nail.y} L${p.cx + trx} ${p.cy + try_}`,
        fill: 'none',
        stroke: '#1a1612',
        'stroke-width': 0.9,
      }),
      el('circle', {cx: nail.x, cy: nail.y, r: 1.8, fill: '#2a2018'}),
    );
    for (const e of local) {
      const [ex, ey] = rotate(p.rot, e.x, e.y);
      eyes.push({x: p.cx + ex, y: p.cy + ey, rx: e.rx, ry: e.ry, rot: p.rot, portrait: p.name});
    }
  }
  const sceneImg = toFloat(await rasterize(worldDoc(sharedDefs, [...shadows, ...joinery()]), w, h));
  const canvasImg = toFloat(
    await rasterize(
      worldDoc(
        [...sharedDefs, ...canvases.filter((s) => !s.startsWith('<g'))],
        canvases.filter((s) => s.startsWith('<g')),
      ),
      w,
      h,
    ),
  );
  const frameImg = toFloat(
    await rasterize(
      worldDoc(
        frames.filter((s) => !s.startsWith('<g')),
        frames.filter((s) => s.startsWith('<g')),
      ),
      w,
      h,
    ),
  );

  const out = new Float32Array(w * h * 4);
  for (let py = 0; py < h; py++) {
    const y = WORLD.top - (py + 0.5) / PX;
    for (let px = 0; px < w; px++) {
      const x = WORLD.left + (px + 0.5) / PX;
      const i = (py * w + px) * 4;
      // 1. the paper, damaged: the tide line, the damp under it, mould, a few torn strips
      let r = paperImg[i];
      let g = paperImg[i + 1];
      let b = paperImg[i + 2];
      let a = paperImg[i + 3];
      if (a > 0) {
        const tide = -6 + (fbm(x * 0.012, 3, 81, 4) - 0.5) * 70;
        const damp = ss(tide + 10, tide - 40, y);
        const n = fbm(x * 0.03, y * 0.03, 83, 5);
        // tea-brown stains that bled up from the water
        const stain = ss(tide + 60, tide, y) * (0.4 + n * 0.6);
        r = r * (1 - stain * 0.25) + stain * 0.09;
        g = g * (1 - stain * 0.3) + stain * 0.06;
        b = b * (1 - stain * 0.45) + stain * 0.02;
        const line = Math.exp(-(((y - tide) / 2.2) ** 2));
        r += line * 0.12;
        g += line * 0.09;
        b += line * 0.04;
        // under the line the paper is soaked through: darker, greener
        r *= 1 - damp * 0.55;
        g *= 1 - damp * 0.4;
        b *= 1 - damp * 0.5;
        // mould in black speckled colonies
        const colony = fbm(x * 0.008 + 5, y * 0.012, 85, 4);
        const speck = fbm(x * 0.35, y * 0.35, 87, 2);
        const mould = ss(0.66, 0.8, colony + damp * 0.12 + ss(170, 250, y) * 0.1) * ss(0.5, 0.68, speck);
        r *= 1 - mould * 0.7;
        g *= 1 - mould * 0.65;
        b *= 1 - mould * 0.7;
        // torn strips: the plaster shows, a dark curled edge around it
        const tear = fbm(x * 0.006 + 40, y * 0.0045, 89, 4);
        if (y > tide + 30) {
          const inside = ss(0.705, 0.715, tear);
          const edge = Math.exp(-(((tear - 0.7) / 0.006) ** 2));
          const plaster = 0.36 + fbm(x * 0.1, y * 0.1, 91, 3) * 0.12;
          r = r * (1 - inside) + plaster * 0.95 * inside;
          g = g * (1 - inside) + plaster * 0.9 * inside;
          b = b * (1 - inside) + plaster * 0.82 * inside;
          r *= 1 - edge * 0.6;
          g *= 1 - edge * 0.6;
          b *= 1 - edge * 0.6;
        }
        // the paper's own mottling
        const mottle = 0.9 + n * 0.2;
        r *= mottle;
        g *= mottle;
        b *= mottle;
      }
      // 2. joinery, shadows
      const lay = (/** @type {Float32Array} */ src) => {
        const sa = src[i + 3];
        if (sa === 0) return;
        const oa = sa + a * (1 - sa);
        r = (src[i] * sa + r * a * (1 - sa)) / oa;
        g = (src[i + 1] * sa + g * a * (1 - sa)) / oa;
        b = (src[i + 2] * sa + b * a * (1 - sa)) / oa;
        a = oa;
      };
      lay(sceneImg);
      // the wood of the wainscot and the door case has a grain
      if (y < RAIL_Y && (x < DOOR.x0 - 24 || x > DOOR.x1 + 12)) {
        const grain = 0.82 + 0.3 * fbm(x * 0.6, y * 0.025, 99, 3);
        r *= grain;
        g *= grain;
        b *= grain;
      }
      // 3. the paintings, yellowed under old varnish and crazed
      if (canvasImg[i + 3] > 0) {
        // fine craquelure: thin dark lines along the level sets of a noise
        const crack = (1 - ss(0.002, 0.006, Math.abs(fbm(x * 0.16, y * 0.16, 93, 3) - 0.5))) * 0.3;
        const k = 1 - crack;
        const cr = canvasImg[i] * 0.92 * k + 0.02;
        const cg = canvasImg[i + 1] * 0.86 * k + 0.015;
        const cb = canvasImg[i + 2] * 0.66 * k;
        const sa = canvasImg[i + 3];
        r = r * (1 - sa) + cr * sa;
        g = g * (1 - sa) + cg * sa;
        b = b * (1 - sa) + cb * sa;
        a = sa + a * (1 - sa);
      }
      lay(frameImg);
      // 4. the eyes are holes: the eyeballs of the demo look through them
      for (const e of eyes) {
        const dx = x - e.x;
        const dy = y - e.y;
        if (Math.abs(dx) > e.rx + 1 || Math.abs(dy) > e.ry + 1) continue;
        const [lx, ly] = rotate(-e.rot, dx, dy);
        const u = lx / e.rx;
        const lid = e.ry * Math.max(0, 1 - u * u) ** 0.85;
        // a signed distance in units, roughly: below 0 inside the almond
        const d = Math.max(Math.abs(ly) - lid, (Math.abs(u) - 1) * e.rx);
        const cover = ss(-0.35, 0.35, d);
        a *= cover;
      }
      // 5. light: the top of the wall in shadow, the bottom too, a little grime everywhere
      const vertical = 0.72 + 0.28 * ss(CORNICE_Y + 40, 60, y) - 0.12 * ss(RAIL_Y, WATER_Y, y);
      const grime = 0.88 + fbm(x * 0.02, y * 0.02, 97, 4) * 0.24;
      out[i] = r * vertical * grime;
      out[i + 1] = g * vertical * grime;
      out[i + 2] = b * vertical * grime;
      out[i + 3] = a;
    }
  }
  const layout = {
    texelsPerUnit: PX,
    waterY: WATER_Y,
    stairLight: STAIR_LIGHT,
    sconces: SCONCES,
    door: DOOR,
    eyes: eyes.map((e) => ({...e, x: Math.round(e.x * 100) / 100, y: Math.round(e.y * 100) / 100})),
    eyeParts: {sclera: {x: 0, y: 0, w: 64, h: 64}, iris: {x: 64, y: 0, w: 64, h: 64}},
  };
  return {hall: await encodeWebpRGBA(out, w, h), eyes: eyeParts(), layout};
}
