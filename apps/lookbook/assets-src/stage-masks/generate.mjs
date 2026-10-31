// stage-masks: the art of the stage-masks demos, one directory per demo (or `shared/` for what
// several use) under `public/assets/stage-masks/`. `pnpm lookbook:assets --only=stage-masks`
// regenerates all of them; README.md documents every output.
import {generate as flashlight} from './flashlight/crawlspace.mjs';
import {generate as foundFootage} from './found-footage/footage.mjs';
import {generate as frozen} from './frozen/frozen.mjs';
import {generate as heatHaze} from './heat-haze/heat-haze.mjs';
import {generate as matte3d} from './matte-3d/matte-3d.mjs';
import {generate as matteInk} from './matte-ink/matte-ink.mjs';
import {generate as matteThreshold} from './matte-threshold/matte-threshold.mjs';
import {generate as rift} from './rift/rift.mjs';
import {generate as spotlight} from './spotlight/spotlight.mjs';
import {generate as withoutDirector} from './without-director/wallpaper.mjs';

/** @typedef {import('../lib/output.mjs').Output} Output */

/**
 * @param {Output} out
 * @param {{skipRender?: boolean}} [opts] `--skip-render` reuses Blender's render cache
 */
export async function generate(out, opts = {}) {
  await withoutDirector(out);
  await spotlight(out);
  await rift(out);
  await foundFootage(out);
  await frozen(out);
  await matteInk(out);
  await matteThreshold(out);
  await heatHaze(out);
  await matte3d(out, opts);
  await flashlight(out);
}
