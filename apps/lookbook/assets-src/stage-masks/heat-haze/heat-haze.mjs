// stage-masks/heat-haze: "Crematorium Window", the art of the demo stage-masks-heat-haze — the view
// out of a crematorium window onto a cemetery, twice: after snowfall, and with the snow turned to
// ash and figures among the graves. Each picture is two images: the outside behind the glass, and
// the room around the window, see-through at the glass. README.md documents every file.
import {renderInterior} from './interior.mjs';
import {GLASS, LAMP, LANCET, OUTSIDE, REVEAL, ROUNDEL, VENT, WORLD} from './layout.mjs';
import {renderOutside} from './outside.mjs';

/** @typedef {import('../../lib/output.mjs').Output} Output */

const DIR = 'heat-haze';

/** @param {Output} out */
export async function generate(out) {
  for (const variant of /** @type {const} */ (['snow', 'ash'])) {
    out.bytes(`${DIR}/outside-${variant}.webp`, (await renderOutside(variant)).image);
    out.bytes(`${DIR}/room-${variant}.webp`, (await renderInterior(variant)).image);
  }
  out.json(`${DIR}/layout.json`, {
    texelsPerUnit: 2,
    world: WORLD,
    outside: OUTSIDE,
    glass: GLASS,
    reveal: REVEAL,
    lancet: LANCET,
    roundel: ROUNDEL,
    vent: VENT,
    lamp: LAMP,
  });
}
