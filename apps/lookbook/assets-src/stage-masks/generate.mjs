// stage-masks: the art of the stage-masks demos, one directory per demo (or `shared/` for what
// several use) under `public/assets/stage-masks/`. `pnpm lookbook:assets --only=stage-masks`
// regenerates all of them; README.md documents every output.
import {generate as withoutDirector} from './without-director/wallpaper.mjs';

/** @typedef {import('../lib/output.mjs').Output} Output */

/** @param {Output} out */
export async function generate(out) {
  await withoutDirector(out);
}
