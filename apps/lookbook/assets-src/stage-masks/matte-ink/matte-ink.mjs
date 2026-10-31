// stage-masks/matte-ink: "The Inkwell Séance", the art of the demo stage-masks-matte-ink — the title
// card of "The Drowned House" (a photograph of the house in the fog, the art-deco title, the
// prompt) and the level it turns into (the drowned hallway with its portraits and the eyeballs
// that look through them). README.md documents every file.
import {LIT_WINDOW, MOON, renderHouse, WATER_Y as MARSH_Y} from './house.mjs';
import {renderHall} from './hall.mjs';
import {PROMPT, renderTitle, TITLE} from './title.mjs';

/** @typedef {import('../../lib/output.mjs').Output} Output */

const DIR = 'matte-ink';

/** @param {Output} out */
export async function generate(out) {
  out.bytes(`${DIR}/house.webp`, await renderHouse());
  const {title, prompt} = await renderTitle();
  out.bytes(`${DIR}/title.webp`, title);
  out.bytes(`${DIR}/prompt.webp`, prompt);
  const hall = await renderHall();
  out.bytes(`${DIR}/hall.webp`, hall.hall);
  out.bytes(`${DIR}/eyes.png`, Buffer.from(hall.eyes));
  out.json(`${DIR}/layout.json`, {
    title: {marshY: MARSH_Y, moon: MOON, litWindow: LIT_WINDOW, titleSize: TITLE, promptSize: PROMPT},
    hall: hall.layout,
  });
}
