// stage-masks/frozen: the séance behind the rose window of "The Moth Chapel" — seen from the
// window, high in the west wall, looking down into the nave: a round table under a violet cloth, a
// talking board, three candles, four sitters without their heads (the demo turns those on spheres
// of their own), the apse with a fresco of a saint with moth wings and scratched-out eyes. The room
// is drawn as SVG in units of the stage (origin the middle of the rose, y up, 2 texels per unit),
// then lit per pixel by the candles. LAYOUT is what the demo reads back from `room.json`.
import {fbm, Rng} from '../../lib/image.mjs';
import {blurFilter, box, el, poly, rasterize, rgrad, toFloat, vgrad, worldDoc} from '../rift/kit.mjs';
import {glyphPath} from './letters.mjs';

/** the room covers x, y in ±EXTENT */
export const EXTENT = 320;
const FRAME = {left: -EXTENT, right: EXTENT, bottom: -EXTENT, top: EXTENT};
export const ROOM_SIZE = EXTENT * 2 * 2;

const TABLE = {x: 0, y: -40, rx: 178, ry: 74, drop: 64};
const BOARD = {x: 0, y: -36, w: 168, h: 64};
const WALL_Y = 74;

/** where the planchette's lens sits on the sprite, in units from the middle of the sprite */
const LENS = {x: 0, y: 4.5};

/** the candles on the table: the foot of the wax, its height and radius */
const CANDLES = [
  {x: -108, y: -24, h: 36, r: 8.5},
  {x: 106, y: -46, h: 27, r: 8},
  {x: 78, y: 14, h: 18, r: 7},
];
/** the two iron stands in front of the apse wall */
const STANDS = [
  {x: -214, y: 96, h: 58},
  {x: 214, y: 96, h: 58},
];

/** the four heads: where the demo puts their spheres, how big, which face, and how they look */
const HEADS = [
  // the medium, behind the table, facing the window; she looks down at the board, then up
  {name: 'medium', x: 0, y: 122, r: 30, face: 'face-medium', yaw: 0, pitch: -0.75},
  // the old man, left, looking across at the board
  {name: 'widower', x: -180, y: 60, r: 30, face: 'face-widower', yaw: 1.25, pitch: -0.5},
  // the woman, right
  {name: 'sister', x: 181, y: 58, r: 29, face: 'face-sister', yaw: -1.25, pitch: -0.5},
  // the young man, near, his back to the window
  {name: 'nephew', x: 0, y: -168, r: 37, face: 'face-nephew', yaw: Math.PI, pitch: -0.55},
];

/**
 * The board: its letters in two arcs, the digits, YES, NO and GOOD BYE. Returns the SVG and where
 * each mark lies in the room.
 * @param {Rng} rng
 */
function talkingBoard(rng) {
  const {x: bx, y: by, w, h} = BOARD;
  /** @type {Record<string, [number, number]>} */
  const marks = {};
  const ink = '#24160c';
  const glyph = (
    /** @type {string} */ ch,
    /** @type {number} */ x,
    /** @type {number} */ y,
    /** @type {number} */ size,
    /** @type {number} */ rot,
  ) =>
    el('path', {
      d: glyphPath(ch, size),
      transform: `translate(${(x + rng.range(-0.15, 0.15)).toFixed(2)} ${y.toFixed(2)}) scale(1 -0.62) rotate(${rot.toFixed(1)})`,
      stroke: ink,
      'stroke-width': 0.85,
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
  const out = [];
  out.push(
    el('ellipse', {
      cx: bx + 3,
      cy: by - 5,
      rx: w / 2 + 4,
      ry: h / 2 + 2,
      fill: '#000',
      'fill-opacity': 0.55,
      filter: 'url(#blur4)',
    }),
  );
  out.push(
    el('rect', {
      x: bx - w / 2,
      y: by - h / 2,
      width: w,
      height: h,
      rx: 9,
      ry: 6,
      fill: 'url(#boardWood)',
      stroke: '#3a2614',
      'stroke-width': 1.6,
    }),
  );
  out.push(
    el('rect', {
      x: bx - w / 2 + 4,
      y: by - h / 2 + 3,
      width: w - 8,
      height: h - 6,
      rx: 6,
      ry: 4,
      fill: 'none',
      stroke: ink,
      'stroke-width': 0.6,
      'stroke-opacity': 0.7,
    }),
  );
  // the grain of the wood
  for (let i = 0; i < 16; i++) {
    const y = by - h / 2 + 4 + i * 3.6 + rng.range(-0.8, 0.8);
    out.push(
      el('path', {
        d: `M${bx - w / 2 + 3} ${y.toFixed(2)}C${(bx - 30).toFixed(1)} ${(y + rng.range(-1.5, 1.5)).toFixed(2)} ${(bx + 30).toFixed(1)} ${(y + rng.range(-1.5, 1.5)).toFixed(2)} ${bx + w / 2 - 3} ${y.toFixed(2)}`,
        stroke: '#4a3019',
        'stroke-width': 0.35,
        'stroke-opacity': 0.4,
        fill: 'none',
      }),
    );
  }
  // two arcs of letters
  const rows = [
    {text: 'ABCDEFGHIJKLM', y: by + 9, span: 132, bow: 7},
    {text: 'NOPQRSTUVWXYZ', y: by - 3, span: 136, bow: 7},
  ];
  for (const row of rows) {
    const n = row.text.length;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      const x = bx + t * row.span;
      const y = row.y + row.bow * (1 - 4 * t * t);
      const rot = -t * 24;
      out.push(glyph(row.text[i], x, y, 8.5, rot));
      marks[row.text[i]] = [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
    }
  }
  const digits = '1234567890';
  for (let i = 0; i < digits.length; i++) {
    const x = bx - 45 + i * 10;
    out.push(glyph(digits[i], x, by - 15, 6.5, 0));
    marks[digits[i]] = [x, by - 15];
  }
  for (const [word, x, y] of /** @type {[string, number, number][]} */ ([
    ['YES', bx - 58, by + 24],
    ['NO', bx + 58, by + 24],
    ['GOOD BYE', bx, by - 25],
  ])) {
    const size = 6;
    const adv = 5.4;
    const start = x - ((word.length - 1) * adv) / 2;
    for (let i = 0; i < word.length; i++) if (word[i] !== ' ') out.push(glyph(word[i], start + i * adv, y, size, 0));
    marks[word] = [x, y];
  }
  // a sun and a moon in the top corners
  out.push(el('circle', {cx: bx - 74, cy: by + 23, r: 3.4, fill: 'none', stroke: ink, 'stroke-width': 0.8}));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    out.push(
      el('path', {
        d: `M${(bx - 74 + Math.cos(a) * 4.6).toFixed(2)} ${(by + 23 + Math.sin(a) * 2.9).toFixed(2)}L${(bx - 74 + Math.cos(a) * 6.6).toFixed(2)} ${(by + 23 + Math.sin(a) * 4.1).toFixed(2)}`,
        stroke: ink,
        'stroke-width': 0.6,
      }),
    );
  }
  out.push(
    el('path', {
      d: `M${bx + 72} ${by + 27}A4.5 3 0 1 0 ${bx + 72} ${by + 19}A3.4 2.4 0 1 1 ${bx + 72} ${by + 27}Z`,
      fill: ink,
      'fill-opacity': 0.85,
    }),
  );
  // a moth at the bottom, in the middle of GOOD BYE's flourish
  out.push(
    el('path', {
      d: `M${bx - 20} ${by - 25}C${bx - 30} ${by - 30} ${bx - 34} ${by - 22} ${bx - 26} ${by - 22}M${bx + 20} ${by - 25}C${bx + 30} ${by - 30} ${bx + 34} ${by - 22} ${bx + 26} ${by - 22}`,
      stroke: ink,
      'stroke-width': 0.6,
      fill: 'none',
    }),
  );
  return {svg: out, marks};
}

/** A hand on the cloth, fingers towards (dx, dy). @param {number} x @param {number} y @param {number} dx @param {number} dy @param {number} s */
function hand(x, y, dx, dy, s = 1) {
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const off = (i - 1.5) * 3.1 * s;
    const len = (13 - Math.abs(i - 1.3) * 1.8) * s;
    fingers.push(el('rect', {x: 4 * s, y: off - 1.3 * s, width: len, height: 2.6 * s, rx: 1.3 * s, fill: 'url(#skin)'}));
  }
  return el('g', {transform: `translate(${x} ${y}) rotate(${a.toFixed(1)})`}, [
    el('ellipse', {cx: 8 * s, cy: -1.5 * s, rx: 15 * s, ry: 9 * s, fill: '#000', 'fill-opacity': 0.5, filter: 'url(#blur3)'}),
    el('ellipse', {cx: 2 * s, cy: 0, rx: 8.5 * s, ry: 7 * s, fill: 'url(#skin)'}),
    ...fingers,
    el('ellipse', {
      cx: 3 * s,
      cy: 6.5 * s,
      rx: 5 * s,
      ry: 2.4 * s,
      transform: `rotate(28 ${3 * s} ${6.5 * s})`,
      fill: 'url(#skin)',
    }),
    el('path', {d: `M${-6 * s} ${-4 * s}L${-8 * s} ${4 * s}`, stroke: '#3b2a22', 'stroke-width': 0.6 * s, 'stroke-opacity': 0.4}),
  ]);
}

/** A candle on its brass dish: wax, drips, the wick. @param {{x: number, y: number, h: number, r: number}} c @param {Rng} rng */
function candle(c, rng) {
  const {x, y, h, r} = c;
  const out = [];
  out.push(
    el('ellipse', {cx: x + 2, cy: y - 3, rx: r * 2.3, ry: r * 0.9, fill: '#000', 'fill-opacity': 0.5, filter: 'url(#blur3)'}),
  );
  out.push(el('ellipse', {cx: x, cy: y, rx: r * 1.9, ry: r * 0.75, fill: '#6a4a22', stroke: '#2e1e0c', 'stroke-width': 0.8}));
  out.push(el('ellipse', {cx: x, cy: y + 0.8, rx: r * 1.5, ry: r * 0.5, fill: '#8f6a34'}));
  out.push(box(x - r, y, x + r, y + h, {fill: 'url(#wax)'}));
  out.push(el('ellipse', {cx: x, cy: y + h, rx: r, ry: r * 0.38, fill: '#f2e6c8'}));
  out.push(el('ellipse', {cx: x, cy: y + h - 0.4, rx: r * 0.7, ry: r * 0.24, fill: '#d9c39a'}));
  // drips down the side
  for (let i = 0; i < 4; i++) {
    const dx = rng.range(-r * 0.85, r * 0.85);
    const len = rng.range(h * 0.15, h * 0.6);
    out.push(
      el('path', {
        d: `M${(x + dx - 1.2).toFixed(2)} ${y + h}L${(x + dx - 1).toFixed(2)} ${(y + h - len).toFixed(2)}A1.2 1.2 0 0 0 ${(x + dx + 1.2).toFixed(2)} ${(y + h - len).toFixed(2)}L${(x + dx + 1.2).toFixed(2)} ${y + h}Z`,
        fill: '#f6ecd4',
        'fill-opacity': 0.9,
      }),
    );
  }
  out.push(el('path', {d: `M${x} ${y + h}l0.4 3.2`, stroke: '#1a120a', 'stroke-width': 0.9}));
  return out;
}

/** An iron candle stand in front of the apse wall. @param {{x: number, y: number, h: number}} s */
function stand(s) {
  const {x, y, h} = s;
  const iron = '#17130f';
  return [
    el('ellipse', {cx: x + 6, cy: y - 2, rx: 22, ry: 5, fill: '#000', 'fill-opacity': 0.45, filter: 'url(#blur3)'}),
    el('path', {
      d: `M${x - 14} ${y - 4}L${x} ${y + 10}L${x + 14} ${y - 4}M${x} ${y + 10}L${x} ${y - 5}`,
      stroke: iron,
      'stroke-width': 2.4,
      fill: 'none',
    }),
    el('path', {d: `M${x} ${y + 10}L${x} ${y + h}`, stroke: iron, 'stroke-width': 3}),
    el('circle', {cx: x, cy: y + h * 0.45, r: 2.6, fill: iron}),
    el('path', {d: `M${x - 9} ${y + h}L${x + 9} ${y + h}L${x + 6} ${y + h - 4}L${x - 6} ${y + h - 4}Z`, fill: iron}),
    box(x - 4.5, y + h, x + 4.5, y + h + 22, {fill: 'url(#wax)'}),
    el('ellipse', {cx: x, cy: y + h + 22, rx: 4.5, ry: 1.7, fill: '#efe2c2'}),
    el('path', {d: `M${x} ${y + h + 22}l0.3 2.6`, stroke: '#1a120a', 'stroke-width': 0.8}),
    el('path', {d: `M${x - 4.5} ${y + h + 18}q-1 -9 0.4 -12`, stroke: '#f6ecd4', 'stroke-width': 1.6, fill: 'none'}),
  ];
}

/** The back wall, the apse with its fresco, the scar of a crucifix, a boarded window. @param {Rng} rng */
function wall(rng) {
  const out = [];
  out.push(box(-EXTENT, WALL_Y, EXTENT, EXTENT, {fill: 'url(#wallGrad)'}));
  // courses of stone
  for (let y = WALL_Y + 4, row = 0; y < EXTENT; y += 31, row++) {
    out.push(el('path', {d: `M${-EXTENT} ${y}L${EXTENT} ${y}`, stroke: '#120e0b', 'stroke-width': 1, 'stroke-opacity': 0.5}));
    for (let x = -EXTENT + (row % 2) * 34; x < EXTENT; x += 68 + rng.range(-8, 8)) {
      out.push(
        el('path', {
          d: `M${x.toFixed(1)} ${y}L${x.toFixed(1)} ${y + 31}`,
          stroke: '#120e0b',
          'stroke-width': 1,
          'stroke-opacity': 0.45,
        }),
      );
    }
  }
  // plaster that still clings
  for (let i = 0; i < 9; i++) {
    const cx = rng.range(-300, 300);
    const cy = rng.range(WALL_Y + 20, 300);
    if (Math.abs(cx) < 120) continue;
    const pts = [];
    const rx = rng.range(18, 44);
    const ry = rng.range(12, 30);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const j = rng.range(0.7, 1.15);
      pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
    }
    out.push(el('path', {d: poly(/** @type {[number, number][]} */ (pts)), fill: '#6a5e52', 'fill-opacity': 0.35}));
  }
  // the pale ghost of a crucifix, the nail holes
  out.push(
    el('path', {
      d: 'M-178 175L-162 175L-162 228L-140 228L-140 242L-162 242L-162 262L-178 262L-178 242L-200 242L-200 228L-178 228Z',
      fill: '#776a5d',
      'fill-opacity': 0.55,
    }),
  );
  for (const [cx, cy] of [
    [-170, 252],
    [-192, 235],
    [-148, 235],
    [-170, 185],
  ]) {
    out.push(el('circle', {cx, cy, r: 1.3, fill: '#0c0907'}));
  }
  // a boarded window on the right
  out.push(el('path', {d: 'M140 150L140 238A35 35 0 0 1 210 238L210 150Z', fill: '#0b0908'}));
  for (let i = 0; i < 4; i++) {
    const y = 162 + i * 26;
    const tilt = (i % 2 ? 1 : -1) * rng.range(4, 9);
    out.push(
      el('path', {
        d: `M134 ${y - tilt}L216 ${y + tilt}L216 ${y + tilt + 11}L134 ${y - tilt + 11}Z`,
        fill: '#3d2a1c',
        stroke: '#1d140c',
        'stroke-width': 0.8,
      }),
    );
    out.push(el('circle', {cx: 139, cy: y - tilt + 5.5, r: 1, fill: '#0c0907'}));
    out.push(el('circle', {cx: 211, cy: y + tilt + 5.5, r: 1, fill: '#0c0907'}));
  }
  // the apse: a pointed niche, the fresco in it
  const apse = 'M-108 138L-108 250A190 190 0 0 1 0 380A190 190 0 0 1 108 250L108 138Z';
  out.push(el('path', {d: apse, fill: '#1a1512'}));
  out.push(el('path', {d: 'M-100 146L-100 252A178 178 0 0 1 0 370A178 178 0 0 1 100 252L100 146Z', fill: 'url(#frescoGrad)'}));
  out.push(el('g', {'clip-path': 'url(#apseClip)'}, fresco(rng)));
  out.push(el('path', {d: apse, fill: 'none', stroke: '#0e0b09', 'stroke-width': 3}));
  // the step of the apse
  out.push(box(-120, WALL_Y, 120, 138, {fill: '#2a231e'}));
  out.push(box(-120, 132, 120, 138, {fill: '#4a4038'}));
  // the junction of wall and floor
  out.push(box(-EXTENT, WALL_Y - 3, EXTENT, WALL_Y + 5, {fill: '#0d0a08'}));
  return out;
}

/** The saint with moth wings and no eyes, the colours long gone grey. @param {Rng} rng */
function fresco(rng) {
  const out = [];
  // wings
  for (const s of [-1, 1]) {
    out.push(
      el('path', {
        d: `M${s * 10} 232C${s * 50} 300 ${s * 105} 310 ${s * 98} 262C${s * 92} 228 ${s * 60} 214 ${s * 14} 216Z`,
        fill: '#7d5f62',
        'fill-opacity': 0.75,
      }),
    );
    out.push(
      el('path', {
        d: `M${s * 12} 214C${s * 52} 200 ${s * 82} 170 ${s * 70} 156C${s * 52} 146 ${s * 26} 180 ${s * 12} 204Z`,
        fill: '#6b5357',
        'fill-opacity': 0.7,
      }),
    );
    out.push(el('circle', {cx: s * 62, cy: 262, r: 13, fill: '#a58a5a', 'fill-opacity': 0.7}));
    out.push(el('circle', {cx: s * 62, cy: 262, r: 5, fill: '#231a16', 'fill-opacity': 0.8}));
    out.push(el('circle', {cx: s * 48, cy: 174, r: 7, fill: '#a58a5a', 'fill-opacity': 0.6}));
  }
  // robe, hands together
  out.push(el('path', {d: 'M-30 150L-22 222Q0 236 22 222L30 150Z', fill: '#59665f', 'fill-opacity': 0.85}));
  out.push(el('path', {d: 'M-6 186L0 200L6 186Z', fill: '#b4a088', 'fill-opacity': 0.8}));
  // halo and head
  out.push(el('circle', {cx: 0, cy: 258, r: 40, fill: '#a5874a', 'fill-opacity': 0.55}));
  out.push(el('circle', {cx: 0, cy: 258, r: 40, fill: 'none', stroke: '#6e5728', 'stroke-width': 1.6}));
  out.push(el('ellipse', {cx: 0, cy: 252, rx: 15, ry: 19, fill: '#b9a48a', 'fill-opacity': 0.9}));
  // the eyes, scratched out
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const x0 = s * 6 + rng.range(-4, 4);
      const y0 = 256 + rng.range(-3, 3);
      out.push(
        el('path', {
          d: `M${(x0 - 4).toFixed(1)} ${(y0 + rng.range(-3, 3)).toFixed(1)}L${(x0 + 4).toFixed(1)} ${(y0 + rng.range(-3, 3)).toFixed(1)}`,
          stroke: '#1a1210',
          'stroke-width': rng.range(0.5, 1.2),
          'stroke-opacity': 0.85,
        }),
      );
    }
  }
  out.push(el('path', {d: 'M-4 242Q0 240 4 242', stroke: '#4a3a30', 'stroke-width': 0.8, fill: 'none'}));
  // flaking: patches where the paint went, cracks
  for (let i = 0; i < 26; i++) {
    out.push(
      el('ellipse', {
        cx: rng.range(-100, 100),
        cy: rng.range(146, 330),
        rx: rng.range(3, 12),
        ry: rng.range(2, 8),
        fill: '#5c5248',
        'fill-opacity': rng.range(0.4, 0.8),
      }),
    );
  }
  for (let i = 0; i < 7; i++) {
    let x = rng.range(-90, 90);
    let y = rng.range(150, 320);
    const pts = [[x, y]];
    for (let j = 0; j < 7; j++) {
      x += rng.range(-9, 9);
      y += rng.range(-12, 4);
      pts.push([x, y]);
    }
    out.push(
      el('path', {
        d: poly(/** @type {[number, number][]} */ (pts), false),
        stroke: '#15100d',
        'stroke-width': 0.6,
        fill: 'none',
        'stroke-opacity': 0.7,
      }),
    );
  }
  // VIGILATE on a band under the saint
  out.push(box(-70, 146, 70, 160, {fill: '#5a4b3c', 'fill-opacity': 0.8}));
  const word = 'VIGILATE';
  for (let i = 0; i < word.length; i++) {
    out.push(
      el('path', {
        d: glyphPath(word[i], 8),
        transform: `translate(${-49 + i * 14} 153) scale(1 -1)`,
        stroke: '#1f1612',
        'stroke-width': 1,
        fill: 'none',
      }),
    );
  }
  return out;
}

/** Flagstones from the wall to the window, in perspective. @param {Rng} rng */
function floor(rng) {
  const out = [box(-EXTENT, -EXTENT, EXTENT, WALL_Y, {fill: 'url(#floorGrad)'})];
  const rows = [WALL_Y, 48, 18, -18, -62, -116, -182, -262, -360];
  const vanish = 900;
  for (let i = 0; i + 1 < rows.length; i++) {
    const y0 = rows[i];
    const y1 = rows[i + 1];
    out.push(el('path', {d: `M${-EXTENT} ${y1}L${EXTENT} ${y1}`, stroke: '#0c0908', 'stroke-width': 1.3}));
    const shift = rng.range(0, 1);
    for (let k = -8; k <= 8; k++) {
      const xf = (k + shift + (i % 2) * 0.5) * 70;
      // x at a height y on a line from (xf, 0) to the vanishing point
      const at = (/** @type {number} */ y) => xf * (1 - y / vanish) * 1.35;
      out.push(el('path', {d: `M${at(y0).toFixed(1)} ${y0}L${at(y1).toFixed(1)} ${y1}`, stroke: '#0c0908', 'stroke-width': 1.1}));
    }
    // wear and stains
    for (let k = 0; k < 4; k++) {
      out.push(
        el('ellipse', {
          cx: rng.range(-300, 300),
          cy: rng.range(y1, y0),
          rx: rng.range(10, 40),
          ry: rng.range(4, 12),
          fill: '#16120f',
          'fill-opacity': 0.4,
          filter: 'url(#blur2)',
        }),
      );
    }
  }
  // wax spilled on the floor, a fallen candle stub
  out.push(el('ellipse', {cx: -260, cy: -150, rx: 9, ry: 4, fill: '#cdbf9e', 'fill-opacity': 0.6}));
  out.push(el('rect', {x: 236, y: -112, width: 18, height: 6, rx: 3, fill: '#d8caa8', transform: 'rotate(-22 245 -109)'}));
  return out;
}

/** The medium's tall chair, behind her. */
function mediumChair() {
  const wood = '#24180f';
  return [
    el('path', {
      d: 'M-46 60L-46 190L-34 214L-22 196L0 232L22 196L34 214L46 190L46 60Z',
      fill: wood,
      stroke: '#0e0905',
      'stroke-width': 1.2,
    }),
    el('path', {d: 'M-30 150L-30 186L-15 200L0 214L15 200L30 186L30 150Z', fill: '#0e0a07'}),
    el('circle', {cx: 0, cy: 186, r: 8, fill: wood}),
    el('circle', {cx: 0, cy: 186, r: 4, fill: '#0e0a07'}),
    el('circle', {cx: -34, cy: 218, r: 3.4, fill: wood}),
    el('circle', {cx: 34, cy: 218, r: 3.4, fill: wood}),
    el('circle', {cx: 0, cy: 236, r: 4, fill: wood}),
  ];
}

/** A sleeve: a thick stroke from the shoulder over the elbow to the wrist, and a cuff. @param {string} d @param {string} fill @param {number} w */
function sleeve(d, fill, w, cuff = /** @type {string | undefined} */ ('#ddd4c2')) {
  const end = d
    .trim()
    .split(/[ A-Za-z]+/)
    .filter(Boolean)
    .map(Number)
    .slice(-2);
  return [
    el('path', {d, stroke: '#050405', 'stroke-width': w + 2.2, 'stroke-linecap': 'round', fill: 'none', 'stroke-opacity': 0.7}),
    el('path', {d, stroke: fill, 'stroke-width': w, 'stroke-linecap': 'round', fill: 'none'}),
    ...(cuff ? [el('circle', {cx: end[0], cy: end[1], r: w * 0.3, fill: cuff})] : []),
  ];
}

/** The medium: a black dress, a lace collar, a cameo. */
function mediumBody() {
  return [
    el('ellipse', {cx: 0, cy: 52, rx: 74, ry: 40, fill: '#000', 'fill-opacity': 0.5, filter: 'url(#blur6)'}),
    el('path', {
      d: 'M-60 30C-64 52 -62 76 -50 88C-38 98 -22 102 0 102C22 102 38 98 50 88C62 76 64 52 60 30Z',
      fill: 'url(#dressMedium)',
    }),
    // the bodice: a seam, buttons, the shine of the cloth where the candles reach
    el('path', {d: 'M0 98L0 34', stroke: '#07060a', 'stroke-width': 1}),
    ...[90, 80, 70, 60, 50, 40].map((y) => el('circle', {cx: 2.6, cy: y, r: 1.2, fill: '#5a4a62'})),
    el('path', {d: 'M-44 40C-48 60 -46 76 -40 84', stroke: '#4d3d5c', 'stroke-width': 3, fill: 'none', 'stroke-opacity': 0.6}),
    el('path', {d: 'M44 40C48 60 46 76 40 84', stroke: '#4d3d5c', 'stroke-width': 3, fill: 'none', 'stroke-opacity': 0.6}),
    // puffed shoulders
    el('ellipse', {cx: -52, cy: 84, rx: 16, ry: 12, fill: 'url(#dressMedium)'}),
    el('ellipse', {cx: 52, cy: 84, rx: 16, ry: 12, fill: 'url(#dressMedium)'}),
    // the lace collar, scalloped, and its holes
    el('path', {
      d: `${Array.from({length: 13}, (_, i) => {
        const a = Math.PI * (i / 12);
        const x = -Math.cos(a) * 26;
        const y = 98 - Math.sin(a) * 12 - (i % 2) * 2.4;
        return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join('')}L20 102L-20 102Z`,
      fill: '#d6ccb8',
      stroke: '#7d7362',
      'stroke-width': 0.6,
    }),
    ...Array.from({length: 9}, (_, i) => {
      const a = Math.PI * (0.1 + (i / 8) * 0.8);
      return el('circle', {cx: -Math.cos(a) * 19, cy: 96 - Math.sin(a) * 6, r: 0.9, fill: '#6a6050'});
    }),
    el('ellipse', {cx: 0, cy: 82, rx: 5, ry: 6.5, fill: '#e6d8bc', stroke: '#6e5326', 'stroke-width': 1.4}),
    el('ellipse', {cx: 0, cy: 82, rx: 2.4, ry: 3.6, fill: '#a58c6c'}),
    el('rect', {x: -9, y: 98, width: 18, height: 10, fill: 'url(#skin)'}),
  ];
}

function mediumArms() {
  return [
    ...sleeve('M-50 82C-55 60 -50 36 -40 22', 'url(#dressMedium)', 17, '#e0d6c2'),
    ...sleeve('M50 82C55 60 50 36 40 22', 'url(#dressMedium)', 17, '#e0d6c2'),
    hand(-37, 14, 0.25, -1, 0.95),
    hand(37, 14, -0.25, -1, 0.95),
  ];
}

/** The widower on the left: frock coat, wing collar, cravat, arms across to the cloth, his chair. */
function widower() {
  const wood = '#21160e';
  return [
    el('ellipse', {cx: -210, cy: -10, rx: 62, ry: 60, fill: '#000', 'fill-opacity': 0.5, filter: 'url(#blur6)'}),
    // the back of his chair, behind him
    el('path', {d: 'M-262 -40L-262 60Q-256 70 -246 62L-246 -40Z', fill: wood}),
    el('path', {
      d: 'M-248 -86C-256 -40 -258 -2 -246 20C-238 34 -224 40 -208 40L-190 40C-176 38 -166 30 -164 14C-160 -12 -164 -50 -172 -86Z',
      fill: 'url(#coatLeft)',
    }),
    // lapels, the waistcoat, a watch chain
    el('path', {d: 'M-214 40L-202 4L-192 4L-180 40Z', fill: '#2c2620'}),
    el('path', {d: 'M-208 40L-198 18L-188 40Z', fill: '#d8d0c0'}),
    el('path', {d: 'M-204 30L-198 22L-192 30L-198 26Z', fill: '#140f0c'}),
    el('path', {d: 'M-202 0Q-192 -10 -180 -2', stroke: '#b08a3e', 'stroke-width': 0.9, fill: 'none'}),
    el('path', {
      d: 'M-186 34C-176 10 -172 -20 -174 -50',
      stroke: '#4a4038',
      'stroke-width': 2.2,
      fill: 'none',
      'stroke-opacity': 0.6,
    }),
    ...sleeve('M-200 8C-206 -16 -186 -40 -156 -54', 'url(#coatLeft)', 14),
    ...sleeve('M-178 30C-170 14 -168 0 -156 -8', 'url(#coatLeft)', 14),
    hand(-150, -11, 1, -0.2),
    hand(-150, -57, 1, 0.1),
    el('rect', {x: -207, y: 34, width: 20, height: 10, fill: 'url(#skin)'}),
  ];
}

/** The sister on the right: a mourning dress, a plum shawl with a fringe, her chair. */
function sister() {
  const wood = '#21160e';
  const fringe = [];
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const x = 254 - t * 76;
    const y = 18 - t * 54 + Math.sin(t * Math.PI) * -6;
    fringe.push(
      el('path', {
        d: `M${x.toFixed(1)} ${y.toFixed(1)}l${(-3 + Math.sin(i) * 1.4).toFixed(2)} -7`,
        stroke: '#5a3550',
        'stroke-width': 1,
      }),
    );
  }
  return [
    el('ellipse', {cx: 210, cy: -10, rx: 60, ry: 58, fill: '#000', 'fill-opacity': 0.5, filter: 'url(#blur6)'}),
    el('path', {d: 'M262 -40L262 60Q256 70 246 62L246 -40Z', fill: wood}),
    el('path', {
      d: 'M248 -86C256 -40 258 -2 246 20C238 34 224 40 208 40L190 40C176 38 166 30 164 14C160 -12 164 -50 172 -86Z',
      fill: 'url(#dressSister)',
    }),
    // the shawl over her shoulders, falling in a point to her right
    el('path', {
      d: 'M252 22C246 36 228 42 206 42L186 40C172 36 168 24 170 10C172 -8 176 -24 180 -38L254 18Z',
      fill: 'url(#shawl)',
    }),
    ...Array.from({length: 7}, (_, i) =>
      el('path', {
        d: `M${248 - i * 10} ${22 - i * 7.6}L${196 - i * 3} 40`,
        stroke: '#2a1624',
        'stroke-width': 0.7,
        'stroke-opacity': 0.6,
      }),
    ),
    ...fringe,
    ...sleeve('M200 8C206 -16 186 -40 156 -58', 'url(#dressSister)', 13, '#1a1418'),
    ...sleeve('M178 30C170 14 168 0 156 -12', 'url(#dressSister)', 13, '#1a1418'),
    hand(152, -15, -1, -0.2, 0.9),
    hand(151, -61, -1, 0.1, 0.9),
    el('rect', {x: 189, y: 32, width: 18, height: 10, fill: 'url(#skin)'}),
    el('path', {d: 'M188 38Q198 44 208 38', stroke: '#140c10', 'stroke-width': 3, fill: 'none'}),
  ];
}

/** The nephew, his back to the window: shoulders, collar, elbows on the cloth, his chair. */
function nephew() {
  const out = [
    el('path', {
      d: 'M-130 -340C-128 -290 -126 -250 -112 -226C-98 -202 -70 -194 -40 -192L40 -192C70 -194 98 -202 112 -226C126 -250 128 -290 130 -340Z',
      fill: 'url(#coatNear)',
    }),
    ...sleeve('M-102 -214C-100 -180 -86 -150 -60 -130', 'url(#coatNear)', 26, undefined),
    ...sleeve('M102 -214C100 -180 86 -150 60 -130', 'url(#coatNear)', 26, undefined),
    el('path', {d: 'M-26 -196Q0 -208 26 -196L24 -184Q0 -192 -24 -184Z', fill: '#d6cdbd'}),
    el('rect', {x: -16, y: -196, width: 32, height: 14, fill: 'url(#skin)'}),
    hand(-56, -118, 0.3, 1, 1.05),
    hand(56, -118, -0.3, 1, 1.05),
    // a seam down the back, the shine of the cloth on the shoulders
    el('path', {d: 'M0 -200L0 -340', stroke: '#050506', 'stroke-width': 1.2}),
    el('path', {d: 'M-104 -224Q-60 -202 -24 -200', stroke: '#45434e', 'stroke-width': 2.4, fill: 'none', 'stroke-opacity': 0.55}),
    el('path', {d: 'M104 -224Q60 -202 24 -200', stroke: '#45434e', 'stroke-width': 2.4, fill: 'none', 'stroke-opacity': 0.55}),
  ];
  // the back of his chair, between him and the window
  const wood = '#21160e';
  out.push(
    el('path', {d: 'M-114 -250Q0 -230 114 -250L116 -264Q0 -244 -116 -264Z', fill: wood, stroke: '#0b0704', 'stroke-width': 1}),
  );
  out.push(
    el('path', {d: 'M-110 -253Q0 -234 110 -253', stroke: '#4a3424', 'stroke-width': 1.2, fill: 'none', 'stroke-opacity': 0.7}),
  );
  for (const x of [-80, -40, 40, 80]) out.push(box(x - 3.5, -340, x + 3.5, -246 - Math.abs(x) * 0.05, {fill: wood}));
  out.push(box(-114, -340, -102, -252, {fill: wood}));
  out.push(box(102, -340, 114, -252, {fill: wood}));
  out.push(el('circle', {cx: -108, cy: -260, r: 6.5, fill: wood}));
  out.push(el('circle', {cx: 108, cy: -260, r: 6.5, fill: wood}));
  return out;
}

/** The round table under its velvet cloth, falling to the floor in folds, with a gold fringe. @param {Rng} rng */
function table(rng) {
  const {x: tx, y: ty, rx, ry, drop} = TABLE;
  const out = [];
  out.push(
    el('ellipse', {
      cx: tx,
      cy: ty - drop - 4,
      rx: rx + 30,
      ry: ry + 14,
      fill: '#000',
      'fill-opacity': 0.6,
      filter: 'url(#blur6)',
    }),
  );
  /** @type {[number, number][]} */
  const skirt = [];
  for (let i = 0; i <= 48; i++) {
    const a = Math.PI + (i / 48) * Math.PI;
    const x = tx + Math.cos(a) * (rx + 6);
    const wave = Math.sin(i * 1.7) * 2.5;
    skirt.push([x, ty + Math.sin(a) * (ry + 2) - drop + wave]);
  }
  skirt.push([tx + rx + 1, ty]);
  skirt.unshift([tx - rx - 1, ty]);
  out.push(el('path', {d: poly(skirt), fill: 'url(#clothSkirt)'}));
  // folds
  for (let i = 1; i < 18; i++) {
    const a = Math.PI + (i / 18) * Math.PI;
    const x = tx + Math.cos(a) * rx;
    const y0 = ty + Math.sin(a) * ry;
    out.push(
      el('path', {
        d: `M${x.toFixed(1)} ${y0.toFixed(1)}Q${(x + rng.range(-4, 4)).toFixed(1)} ${(y0 - drop * 0.5).toFixed(1)} ${(x * 1.03).toFixed(1)} ${(y0 - drop + 2).toFixed(1)}`,
        stroke: i % 2 ? '#050405' : '#3c3438',
        'stroke-width': i % 2 ? 5 : 2.4,
        'stroke-opacity': i % 2 ? 0.5 : 0.35,
        fill: 'none',
        filter: 'url(#blur2)',
      }),
    );
  }
  // the fringe
  for (let i = 0; i <= 120; i++) {
    const a = Math.PI + (i / 120) * Math.PI;
    const x = tx + Math.cos(a) * (rx + 6);
    const y = ty + Math.sin(a) * (ry + 2) - drop + Math.sin(i * 0.68) * 2.5;
    out.push(el('path', {d: `M${x.toFixed(1)} ${y.toFixed(1)}l0 -6`, stroke: '#a5803a', 'stroke-width': 1.2}));
  }
  out.push(el('ellipse', {cx: tx, cy: ty, rx, ry, fill: 'url(#clothTop)'}));
  out.push(
    el('ellipse', {
      cx: tx,
      cy: ty,
      rx: rx - 1,
      ry: ry - 1,
      fill: 'none',
      stroke: '#7a4f7c',
      'stroke-width': 1.4,
      'stroke-opacity': 0.5,
    }),
  );
  return out;
}

const DEFS = [
  blurFilter('blur2', 2),
  blurFilter('blur3', 3),
  blurFilter('blur4', 4),
  blurFilter('blur6', 6),
  vgrad('wallGrad', WALL_Y, EXTENT, [
    [0, '#4d433b'],
    [1, '#2a241f'],
  ]),
  vgrad('floorGrad', WALL_Y, -EXTENT, [
    [0, '#3a332d'],
    [1, '#4b423a'],
  ]),
  vgrad('frescoGrad', 146, 370, [
    [0, '#58605e'],
    [1, '#454d52'],
  ]),
  el('clipPath', {id: 'apseClip'}, el('path', {d: 'M-100 146L-100 252A178 178 0 0 1 0 370A178 178 0 0 1 100 252L100 146Z'})),
  rgrad('clothTop', TABLE.x, TABLE.y, TABLE.rx, [
    [0, '#3a3236'],
    [0.7, '#262024'],
    [1, '#1a1518'],
  ]),
  vgrad('clothSkirt', TABLE.y, TABLE.y - TABLE.ry - TABLE.drop, [
    [0, '#241e22'],
    [1, '#0e0b0d'],
  ]),
  vgrad('boardWood', BOARD.y + BOARD.h / 2, BOARD.y - BOARD.h / 2, [
    [0, '#a48250'],
    [1, '#8c6a3c'],
  ]),
  el('linearGradient', {id: 'wax', x1: 0, y1: 0, x2: 1, y2: 0}, [
    el('stop', {offset: 0, 'stop-color': '#bba882'}),
    el('stop', {offset: 0.55, 'stop-color': '#f4ead0'}),
    el('stop', {offset: 1, 'stop-color': '#d9c8a2'}),
  ]),
  el('linearGradient', {id: 'skin', x1: 0, y1: 0, x2: 0, y2: 1}, [
    el('stop', {offset: 0, 'stop-color': '#e2c3a6'}),
    el('stop', {offset: 1, 'stop-color': '#b98e72'}),
  ]),
  vgrad('dressMedium', 100, 10, [
    [0, '#17121c'],
    [0.7, '#2a2034'],
    [1, '#3b2d48'],
  ]),
  el('linearGradient', {id: 'coatLeft', gradientUnits: 'userSpaceOnUse', x1: -262, y1: 0, x2: -150, y2: 0}, [
    el('stop', {offset: 0, 'stop-color': '#100e0c'}),
    el('stop', {offset: 1, 'stop-color': '#3a332c'}),
  ]),
  el('linearGradient', {id: 'dressSister', gradientUnits: 'userSpaceOnUse', x1: 262, y1: 0, x2: 150, y2: 0}, [
    el('stop', {offset: 0, 'stop-color': '#0f0c10'}),
    el('stop', {offset: 1, 'stop-color': '#2e2630'}),
  ]),
  el('linearGradient', {id: 'shawl', gradientUnits: 'userSpaceOnUse', x1: 260, y1: 0, x2: 160, y2: 0}, [
    el('stop', {offset: 0, 'stop-color': '#2a1624'}),
    el('stop', {offset: 1, 'stop-color': '#6a3c58'}),
  ]),
  vgrad('coatNear', -340, -130, [
    [0, '#0a0a0c'],
    [0.75, '#1c1b21'],
    [1, '#34323c'],
  ]),
];

/** the lights of the room in units: the flames of the candles, high over the floor */
function lights() {
  const table = CANDLES.map((c) => ({x: c.x, y: c.y + c.h + 9, z: 60, power: 1}));
  const stands = STANDS.map((s) => ({x: s.x, y: s.y + s.h + 31, z: 110, power: 0.55}));
  return [...table, ...stands];
}

const WARM = [1, 0.6, 0.3];
const COLD = [0.05, 0.06, 0.09];

/**
 * The room, lit: straight RGBA floats, opaque, over ±EXTENT. Also the layout the demo reads.
 */
export async function renderRoom() {
  const rng = new Rng(0x5ea7ce);
  const board = talkingBoard(rng);
  const body = [
    ...floor(rng),
    ...wall(rng),
    ...STANDS.flatMap(stand),
    ...mediumChair(),
    ...mediumBody(),
    // the side sitters lean in to the table, their heads clear of the stone ring of the rose
    el('g', {transform: 'translate(17 6)'}, widower()),
    el('g', {transform: 'translate(-17 6)'}, sister()),
    ...table(rng),
    ...board.svg,
    ...mediumArms(),
    ...CANDLES.flatMap((c) => candle(c, rng)),
    ...nephew(),
  ];
  const size = ROOM_SIZE;
  const albedo = toFloat(await rasterize(worldDoc(DEFS, body, FRAME), size, size));
  const ls = lights();
  for (let py = 0; py < size; py++) {
    const y = EXTENT - (py + 0.5) / 2;
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;
      const x = (px + 0.5) / 2 - EXTENT;
      let light = 0;
      for (const l of ls) {
        const dx = x - l.x;
        // the room is seen from above at a slant: a distance up the picture is farther than across
        const dy = (y - l.y) * 1.3;
        const d2 = dx * dx + dy * dy + l.z * l.z;
        light += l.power * 2.2 * Math.exp(-Math.sqrt(d2) / 96);
      }
      const grain = 0.88 + 0.24 * fbm(x * 0.07, y * 0.07, 23, 4);
      for (let c = 0; c < 3; c++) {
        const lin = albedo[i + c] ** 2.2 * grain;
        const lit = lin * (COLD[c] * 2.5 + WARM[c] * light);
        // a soft shoulder instead of a hard clip at the brightest wax
        albedo[i + c] = (lit / (1 + lit * 0.35)) ** (1 / 2.2);
      }
      albedo[i + 3] = 1;
    }
  }
  const layout = {
    extent: EXTENT,
    table: TABLE,
    board: {...BOARD, marks: board.marks},
    lens: LENS,
    candles: CANDLES.map((c) => ({x: c.x, y: c.y + c.h + 0.6, size: c.r * 1.25})),
    stands: STANDS.map((s) => ({x: s.x, y: s.y + s.h + 22.4, size: 5.6})),
    heads: HEADS,
    lights: ls,
  };
  return {rgba: albedo, size, layout};
}
