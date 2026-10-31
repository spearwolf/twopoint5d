// stage-masks: the art of the stage-masks demos, one directory per demo (or `shared/` for what
// several use) under `public/assets/stage-masks/`. `pnpm lookbook:assets --only=stage-masks`
// regenerates all of them; README.md documents every output.
import {generate as foundFootage} from './found-footage/footage.mjs';
import {generate as frozen} from './frozen/frozen.mjs';
import {generate as heatHaze} from './heat-haze/heat-haze.mjs';
import {generate as matteInk} from './matte-ink/matte-ink.mjs';
import {generate as matteThreshold} from './matte-threshold/matte-threshold.mjs';
import {generate as rift} from './rift/rift.mjs';
import {generate as spotlight} from './spotlight/spotlight.mjs';
import {generate as withoutDirector} from './without-director/wallpaper.mjs';

/** @typedef {import('../lib/output.mjs').Output} Output */

/** @param {Output} out */
export async function generate(out) {
  await withoutDirector(out);
  await spotlight(out);
  await rift(out);
  await foundFootage(out);
  await frozen(out);
  await matteInk(out);
  await matteThreshold(out);
  await heatHaze(out);
}
