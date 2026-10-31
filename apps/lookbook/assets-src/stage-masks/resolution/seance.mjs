// stage-masks/resolution: "Séance Photographs", the art of the demo stage-masks-resolution — three
// framed spirit photographs on the wall of a dim parlour. One photograph, twice: the living plate
// (a widow in mourning, sepia) and the spirit plate (the same studio gone cold, a veiled figure
// behind her chair). The demo shows the spirit plate where a fog mask covers. README.md documents
// every file.
import {MAT, FRAME, PANELS, PHOTO, PLAQUE, PX, WALL} from './layout.mjs';
import {renderPhotographs} from './photograph.mjs';
import {renderWall} from './wall.mjs';

/** @typedef {import('../../lib/output.mjs').Output} Output */

const DIR = 'resolution';

/** @param {Output} out */
export async function generate(out) {
  out.bytes(`${DIR}/wall.webp`, await renderWall());
  const {living, spirit} = await renderPhotographs();
  out.bytes(`${DIR}/living.webp`, living);
  out.bytes(`${DIR}/spirit.webp`, spirit);
  out.json(`${DIR}/layout.json`, {
    texelsPerUnit: PX,
    wall: WALL,
    photo: PHOTO,
    panels: PANELS,
    mat: MAT,
    frame: FRAME,
    plaque: PLAQUE,
  });
}
