// stage-masks/matte-threshold: the eyes of the thing, as an atlas of frames from shut to open. Each
// frame comes in two layers: the lids and the eyeball (pale flesh, tinted by the light of the scene
// at the eye) and the glow (a cyan iris with a black slit, drawn untinted, it shines by itself).
// One row of 16 cells of 128 × 64 texels: cells 0–7 the lids from shut to open, cells 8–15 the glow
// of the same frames. The almond fills the middle 96 × 40 texels of a cell; the lids fade into the
// flesh around it, so the sprite sits on the body without an edge.
import sharp from 'sharp';
import {el, n, svgDoc} from '../spotlight/svg.mjs';

export const EYE_FRAMES = 8;
export const EYE_CELL = {w: 128, h: 64};

/** the opening of frame `k`: eased, so the last frames widen less — an eye that strains open */
const opening = (/** @type {number} */ k) => 1 - (1 - k / (EYE_FRAMES - 1)) ** 1.6;

/**
 * The almond of an eye opened by `o` (0 shut, 1 open), centred at (cx, cy): the upper lid lifts
 * further than the lower one drops.
 * @param {number} cx @param {number} cy @param {number} o
 */
function almond(cx, cy, o) {
  const hw = 46;
  const up = 2 + o * 19;
  const down = 1 + o * 9;
  return `M${n(cx - hw)} ${n(cy)}C${n(cx - hw * 0.45)} ${n(cy - up * 1.25)} ${n(cx + hw * 0.45)} ${n(cy - up * 1.25)} ${n(cx + hw)} ${n(cy)}C${n(cx + hw * 0.45)} ${n(cy + down * 1.25)} ${n(cx - hw * 0.45)} ${n(cy + down * 1.25)} ${n(cx - hw)} ${n(cy)}Z`;
}

/** @returns {Promise<Buffer>} a straight-alpha PNG of 2048 × 64 texels */
export async function renderEyes() {
  const {w, h} = EYE_CELL;
  const defs = [
    el(
      'radialGradient',
      {id: 'flesh', cx: 0.5, cy: 0.5, r: 0.5},
      [
        el('stop', {offset: 0, 'stop-color': '#e2ddd2', 'stop-opacity': 1}),
        el('stop', {offset: 0.55, 'stop-color': '#d5cfc4', 'stop-opacity': 1}),
        el('stop', {offset: 1, 'stop-color': '#d0cabd', 'stop-opacity': 0}),
      ].join(''),
    ),
    el(
      'radialGradient',
      {id: 'ball', cx: 0.5, cy: 0.42, r: 0.6},
      [
        el('stop', {offset: 0, 'stop-color': '#3b3a46'}),
        el('stop', {offset: 0.7, 'stop-color': '#16141c'}),
        el('stop', {offset: 1, 'stop-color': '#050407'}),
      ].join(''),
    ),
    el(
      'radialGradient',
      {id: 'iris', cx: 0.5, cy: 0.5, r: 0.5},
      [
        el('stop', {offset: 0, 'stop-color': '#f4fffc'}),
        el('stop', {offset: 0.35, 'stop-color': '#7ff6ea'}),
        el('stop', {offset: 0.8, 'stop-color': '#1fb8b0'}),
        el('stop', {offset: 1, 'stop-color': '#0a4a50'}),
      ].join(''),
    ),
    el('filter', {id: 'soft', x: '-50%', y: '-50%', width: '200%', height: '200%'}, el('feGaussianBlur', {stdDeviation: 1.6})),
  ];
  const body = [];
  for (let k = 0; k < EYE_FRAMES; k++) {
    const o = opening(k);
    const cx = k * w + w / 2;
    const cy = h / 2;
    const clip = `clip${k}`;
    defs.push(el('clipPath', {id: clip}, el('path', {d: almond(cx, cy, o)})));
    // the lids: a patch of flesh, folds above and below the almond, the dark slit or the eyeball in it
    body.push(
      el('ellipse', {cx, cy, rx: 62, ry: 31, fill: 'url(#flesh)'}),
      el('path', {
        d: `M${n(cx - 52)} ${n(cy - 4)}C${n(cx - 20)} ${n(cy - 30 - o * 6)} ${n(cx + 20)} ${n(cy - 30 - o * 6)} ${n(cx + 52)} ${n(cy - 4)}`,
        stroke: '#8e877c',
        'stroke-width': 1.6,
        fill: 'none',
        opacity: 0.55,
        filter: 'url(#soft)',
      }),
      el('path', {
        d: `M${n(cx - 40)} ${n(cy + 8)}C${n(cx - 14)} ${n(cy + 18 + o * 4)} ${n(cx + 14)} ${n(cy + 18 + o * 4)} ${n(cx + 40)} ${n(cy + 8)}`,
        stroke: '#9a9286',
        'stroke-width': 1.2,
        fill: 'none',
        opacity: 0.45,
        filter: 'url(#soft)',
      }),
      el('path', {d: almond(cx, cy, Math.max(o, 0.04)), fill: o < 0.02 ? '#3a3530' : 'url(#ball)'}),
      // the wet rim of the lids
      el('path', {d: almond(cx, cy, Math.max(o, 0.04)), fill: 'none', stroke: '#5e4a4a', 'stroke-width': 1.8}),
      // lashes? no: a row of small dark pores along the upper lid
      ...[-30, -18, -6, 6, 18, 30].map((dx) =>
        el('circle', {cx: cx + dx, cy: cy - 4 - o * 20 * (1 - (dx / 46) ** 2) - 4, r: 0.9, fill: '#5a5048', opacity: 0.7}),
      ),
    );
    // the glow: the iris and its slit, inside the almond only, and a faint wet shine
    const glow = w * EYE_FRAMES + k * w + w / 2;
    defs.push(el('clipPath', {id: `g${clip}`}, el('path', {d: almond(glow, cy, o)})));
    if (o > 0.02) {
      body.push(
        el('g', {'clip-path': `url(#g${clip})`}, [
          el('circle', {cx: glow, cy: cy - 3, r: 21, fill: 'url(#iris)'}),
          el('path', {
            d: `M${n(glow)} ${n(cy - 22)}C${n(glow + 4.5)} ${n(cy - 9)} ${n(glow + 4.5)} ${n(cy + 3)} ${n(glow)} ${n(cy + 16)}C${n(glow - 4.5)} ${n(cy + 3)} ${n(glow - 4.5)} ${n(cy - 9)} ${n(glow)} ${n(cy - 22)}Z`,
            fill: '#020304',
          }),
          el('ellipse', {cx: glow - 6, cy: cy - 8, rx: 3.5, ry: 1.8, fill: '#ffffff', opacity: 0.8}),
        ]),
      );
    }
  }
  const W = w * EYE_FRAMES * 2;
  const svg = svgDoc(W, h, defs, body);
  return sharp(Buffer.from(svg), {density: 72}).ensureAlpha().png({compressionLevel: 9}).toBuffer();
}
