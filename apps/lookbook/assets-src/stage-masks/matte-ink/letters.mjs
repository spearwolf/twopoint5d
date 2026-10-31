// stage-masks/matte-ink: the art-deco capitals of the title card "THE DROWNED HOUSE" — only the
// letters the card spells (D E H N O R S T U W), built from rectangles, polygons and sampled
// elliptic rings, so no font is used. Thick verticals and hairline horizontals, as on the title
// cards of the early talkies. Every glyph sits on the baseline y = 0 with its cap height at
// y = 100, x from 0 to its advance, y up — the units of the stage the generators draw in.
import {n} from '../spotlight/svg.mjs';

/** the cap height of a glyph */
export const CAP = 100;
/** the width of a thick stem and of a hairline */
const THICK = 15;
const THIN = 4.5;

/** @typedef {[number, number][]} Contour */

/** @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @returns {Contour} */
const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/**
 * A segment of an elliptic ring from angle a0 to a1 (degrees, counter-clockwise from +x, y up):
 * the outer ellipse out, the inner one back — one closed contour.
 * @param {number} cx @param {number} cy @param {number} rxo @param {number} ryo @param {number} rxi @param {number} ryi
 * @param {number} a0 @param {number} a1
 * @returns {Contour}
 */
function ringSegment(cx, cy, rxo, ryo, rxi, ryi, a0, a1) {
  const steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 3));
  /** @type {Contour} */
  const outer = [];
  /** @type {Contour} */
  const inner = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    outer.push([cx + Math.cos(a) * rxo, cy + Math.sin(a) * ryo]);
    inner.push([cx + Math.cos(a) * rxi, cy + Math.sin(a) * ryi]);
  }
  return [...outer, ...inner.reverse()];
}

/** @param {number} cx @param {number} cy @param {number} rx @param {number} ry @returns {Contour} */
function ellipse(cx, cy, rx, ry) {
  /** @type {Contour} */
  const pts = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/**
 * The glyphs: an advance and closed contours, filled with the non-zero rule except where a glyph
 * says `evenodd` (the counter of the O).
 * @type {Record<string, {advance: number, contours: Contour[], evenodd?: boolean}>}
 */
const GLYPHS = {
  T: {advance: 60, contours: [rect(0, CAP - THIN * 1.6, 60, CAP), rect(30 - THICK / 2, 0, 30 + THICK / 2, CAP)]},
  H: {advance: 60, contours: [rect(0, 0, THICK, CAP), rect(60 - THICK, 0, 60, CAP), rect(THICK, 56, 60 - THICK, 56 + THIN)]},
  E: {
    advance: 48,
    contours: [
      rect(0, 0, THICK, CAP),
      rect(THICK, CAP - THIN, 48, CAP),
      rect(THICK, 58, 38, 58 + THIN),
      rect(THICK, 0, 48, THIN),
    ],
  },
  D: {
    advance: 60,
    contours: [
      rect(0, 0, THICK, CAP),
      rect(THICK, CAP - THIN, 28, CAP),
      rect(THICK, 0, 28, THIN),
      ringSegment(28, 50, 32, 50, 32 - THICK, 50 - THIN, 90, -90),
    ],
  },
  R: {
    advance: 58,
    contours: [
      rect(0, 0, THICK, CAP),
      rect(THICK, CAP - THIN, 26, CAP),
      rect(THICK, 52, 26, 52 + THIN),
      ringSegment(26, 76, 27, 24, 27 - THICK * 0.9, 24 - THIN, 90, -90),
      [
        [22, 54],
        [36, 54],
        [58, 0],
        [43, 0],
      ],
    ],
  },
  O: {
    advance: 64,
    evenodd: true,
    contours: [ellipse(32, 50, 32, 50), ellipse(32, 50, 32 - THICK, 50 - THIN)],
  },
  W: {
    advance: 90,
    contours: [
      [
        [0, CAP],
        [THICK, CAP],
        [25 + THICK / 2, 0],
        [25 - THICK / 2, 0],
      ],
      [
        [25 - THIN / 2, 0],
        [25 + THIN / 2, 0],
        [45 + THIN / 2, CAP],
        [45 - THIN / 2, CAP],
      ],
      [
        [45 - THICK / 2, CAP],
        [45 + THICK / 2, CAP],
        [65 + THICK / 2, 0],
        [65 - THICK / 2, 0],
      ],
      [
        [65 - THIN / 2, 0],
        [65 + THIN / 2, 0],
        [90, CAP],
        [90 - THIN, CAP],
      ],
    ],
  },
  N: {
    advance: 60,
    contours: [
      rect(0, 0, THIN, CAP),
      rect(60 - THIN, 0, 60, CAP),
      [
        [0, CAP],
        [THICK, CAP],
        [60, 0],
        [60 - THICK, 0],
      ],
    ],
  },
  U: {
    advance: 60,
    contours: [
      rect(0, 34, THICK, CAP),
      rect(60 - THICK, 34, 60, CAP),
      ringSegment(30, 34, 30, 34, 30 - THICK, 34 - THIN, 180, 360),
    ],
  },
  S: {
    advance: 56,
    contours: [
      ringSegment(28, 74, 28, 26, 28 - THICK, 26 - THIN, 270, 20),
      ringSegment(28, 26, 28, 26, 28 - THICK, 26 - THIN, 90, -160),
    ],
  },
};

/** @param {Contour} c */
const contourPath = (c) => `M${c.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`;

/**
 * A line of capitals, scaled to the cap height `size`, its baseline at `y`, centred on `x`: one
 * SVG path `d` per contour (contours overlap, and one path of them all would cancel where their
 * windings differ), each with its fill rule, and the width of the line. A space is 0.55 of the cap
 * height.
 * @param {string} text
 * @param {number} x @param {number} y @param {number} size
 * @param {number} [tracking] the space between two letters, in units of the cap height
 * @returns {{paths: {d: string, rule: 'nonzero' | 'evenodd'}[], width: number}}
 */
export function capitals(text, x, y, size, tracking = 0.16) {
  const k = size / CAP;
  let width = 0;
  for (const ch of text) width += ch === ' ' ? 55 : glyphOf(ch).advance + tracking * CAP;
  width -= tracking * CAP;
  let pen = x - (width * k) / 2;
  /** @type {{d: string, rule: 'nonzero' | 'evenodd'}[]} */
  const paths = [];
  for (const ch of text) {
    if (ch === ' ') {
      pen += 55 * k;
      continue;
    }
    const glyph = glyphOf(ch);
    const placed = glyph.contours.map((c) => contourPath(c.map(([gx, gy]) => [pen + gx * k, y + gy * k])));
    if (glyph.evenodd) paths.push({d: placed.join(''), rule: 'evenodd'});
    else for (const d of placed) paths.push({d, rule: 'nonzero'});
    pen += (glyph.advance + tracking * CAP) * k;
  }
  return {paths, width: width * k};
}

/** @param {string} ch */
function glyphOf(ch) {
  const glyph = GLYPHS[ch];
  if (!glyph) throw new Error(`letters: no glyph for ${JSON.stringify(ch)}`);
  return glyph;
}
