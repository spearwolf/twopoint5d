// stage-masks/matte-threshold: "Sonar", the art of the demo stage-masks-matte-threshold — two
// pictures of the same deep-sea trench (the calm survey view, and the same view with the thing on
// the floor) and the eyes of the thing. README.md documents every file.
import {EYE_CELL, EYE_FRAMES, renderEyes} from './eyes.mjs';
import {LAYOUT, renderTrench} from './trench.mjs';

/** @typedef {import('../../lib/output.mjs').Output} Output */

const DIR = 'matte-threshold';

/** @param {Output} out */
export async function generate(out) {
  const survey = await renderTrench({thing: false});
  out.bytes(`${DIR}/survey.webp`, survey.image);
  const thing = await renderTrench({thing: true});
  out.bytes(`${DIR}/thing.webp`, thing.image);
  out.bytes(`${DIR}/eyes.png`, await renderEyes());
  const round = (/** @type {number} */ v) => Math.round(v * 100) / 100;
  out.json(`${DIR}/layout.json`, {
    texelsPerUnit: 2,
    ...LAYOUT,
    eyeFrames: EYE_FRAMES,
    eyeCell: EYE_CELL,
    eyes: thing.eyes.map((e) => ({x: round(e.x), y: round(e.y), w: round(e.w), rot: round(e.rot), light: round(e.light)})),
    parasites: thing.parasites.map((p) => ({x: round(p.x), y: round(p.y), r: round(p.r)})),
  });
}
