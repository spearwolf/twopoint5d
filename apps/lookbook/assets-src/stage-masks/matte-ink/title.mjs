// stage-masks/matte-ink: the lettering of the title card — "THE DROWNED HOUSE" in chrome art-deco
// capitals between double rules and diamonds, and the prompt "ENTER THE HOUSE" under it. Drawn as
// SVG in units of the stage (y up, 2 texels per unit) over transparent black; the demo lays both
// over the photograph of the house.
import {el, poly, rasterize} from '../spotlight/svg.mjs';
import {encodeWebpRGBA, PX, toFloat, vgrad, worldDoc} from '../rift/kit.mjs';
import {capitals} from './letters.mjs';

/** the title block covers x in ±TITLE.w / 2, y in ±TITLE.h / 2 */
export const TITLE = {w: 960, h: 240};
/** the prompt covers x in ±PROMPT.w / 2, y in ±PROMPT.h / 2 */
export const PROMPT = {w: 400, h: 44};

const INK = '#09080b';

/**
 * Letters with a soft drop shadow, a dark outline and a fill.
 * @param {{d: string, rule: string}[]} paths @param {string} fill @param {number} outline @param {number} shadow
 */
function lettering(paths, fill, outline, shadow) {
  const each = (/** @type {Record<string, string | number>} */ attrs) =>
    paths.map(({d, rule}) => el('path', {d, 'fill-rule': rule, ...attrs}));
  return [
    el('g', {transform: `translate(${shadow * 0.8} ${-shadow})`, filter: 'url(#shadow)', opacity: 0.85}, each({fill: '#000'})),
    el('g', {}, each({fill: 'none', stroke: INK, 'stroke-width': outline, 'stroke-linejoin': 'round'})),
    // the fill stroked thinly in itself: the seams where two contours of a letter meet close up
    el('g', {}, each({fill, stroke: fill, 'stroke-width': 0.7})),
  ];
}

/** A diamond around (x, y), r to its points. @param {number} x @param {number} y @param {number} r @param {string} fill */
const diamond = (x, y, r, fill) =>
  el('path', {
    d: poly([
      [x - r, y],
      [x, y + r * 0.7],
      [x + r, y],
      [x, y - r * 0.7],
    ]),
    fill,
    stroke: INK,
    'stroke-width': 1.2,
  });

/** A double rule from x0 to x1 at y. @param {number} x0 @param {number} x1 @param {number} y */
const doubleRule = (x0, x1, y) => [
  el('rect', {
    x: Math.min(x0, x1),
    y: y + 1.4,
    width: Math.abs(x1 - x0),
    height: 1.6,
    fill: '#d9d5cc',
    stroke: INK,
    'stroke-width': 0.8,
  }),
  el('rect', {x: Math.min(x0, x1), y: y - 3, width: Math.abs(x1 - x0), height: 1, fill: '#9d9a98'}),
];

/** @returns {Promise<{title: Buffer, prompt: Buffer}>} */
export async function renderTitle() {
  const frame = {left: -TITLE.w / 2, right: TITLE.w / 2, bottom: -TITLE.h / 2, top: TITLE.h / 2};
  const the = capitals('THE', 0, 48, 30, 0.42);
  const name = capitals('DROWNED HOUSE', 0, -52, 84, 0.15);
  const ruleY = 63;
  const inner = the.width / 2 + 22;
  const outer = name.width / 2;
  const defs = [
    el('filter', {id: 'shadow', x: '-20%', y: '-50%', width: '140%', height: '200%'}, el('feGaussianBlur', {stdDeviation: 4})),
    el('filter', {id: 'halo', x: '-50%', y: '-50%', width: '200%', height: '200%'}, el('feGaussianBlur', {stdDeviation: 40})),
    // chrome: bright above, the dark horizon of a polished metal at a little under half height
    vgrad('chrome', -52 + 84, -52, [
      [0, '#fbf8f0'],
      [0.38, '#d3cfc6'],
      [0.47, '#77747b'],
      [0.53, '#3d3b44'],
      [0.6, '#a19ea0'],
      [0.85, '#e4dfd5'],
      [1, '#f6f1e6'],
    ]),
    vgrad('chrome-small', 48 + 30, 48, [
      [0, '#f7f3ea'],
      [0.5, '#8c8990'],
      [1, '#ebe6dc'],
    ]),
  ];
  const body = [
    // a dark breath behind the letters: they stand off the fog without a box
    el('ellipse', {cx: 0, cy: -4, rx: outer + 40, ry: 82, fill: '#000', opacity: 0.55, filter: 'url(#halo)'}),
    ...doubleRule(-outer, -inner, ruleY),
    ...doubleRule(inner, outer, ruleY),
    diamond(-outer - 12, ruleY, 9, '#e8e3d8'),
    diamond(outer + 12, ruleY, 9, '#e8e3d8'),
    diamond(-inner + 8, ruleY, 4.5, '#bdb9b2'),
    diamond(inner - 8, ruleY, 4.5, '#bdb9b2'),
    ...lettering(the.paths, 'url(#chrome-small)', 2.4, 2.5),
    ...lettering(name.paths, 'url(#chrome)', 4, 5),
    // under the name: a single rule broken by three diamonds
    ...doubleRule(-outer * 0.62, -26, -74),
    ...doubleRule(26, outer * 0.62, -74),
    diamond(0, -74, 8, '#e8e3d8'),
    diamond(-16, -74, 3.5, '#bdb9b2'),
    diamond(16, -74, 3.5, '#bdb9b2'),
  ];
  const w = TITLE.w * PX;
  const h = TITLE.h * PX;
  const title = await encodeWebpRGBA(toFloat(await rasterize(worldDoc(defs, body, frame), w, h)), w, h);

  const pframe = {left: -PROMPT.w / 2, right: PROMPT.w / 2, bottom: -PROMPT.h / 2, top: PROMPT.h / 2};
  const words = capitals('ENTER THE HOUSE', 0, -7.5, 15, 0.55);
  const pdefs = [
    el('filter', {id: 'shadow', x: '-20%', y: '-50%', width: '140%', height: '200%'}, el('feGaussianBlur', {stdDeviation: 2})),
  ];
  const pbody = [
    ...lettering(words.paths, '#e2ddd2', 1.8, 1.6),
    diamond(-words.width / 2 - 20, 0, 5, '#e2ddd2'),
    diamond(words.width / 2 + 20, 0, 5, '#e2ddd2'),
  ];
  const pw = PROMPT.w * PX;
  const ph = PROMPT.h * PX;
  const prompt = await encodeWebpRGBA(toFloat(await rasterize(worldDoc(pdefs, pbody, pframe), pw, ph)), pw, ph);
  return {title, prompt};
}
