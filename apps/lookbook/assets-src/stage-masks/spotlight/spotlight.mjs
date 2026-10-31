// stage-masks/spotlight: "Ward C, 3:07 a.m." — two levels in one frame (the flooded corridor of an
// asylum and an all-night laundromat) and the atlas of their sprites. README.md documents every file.
import {texturePackerHash} from '../../lib/formats.mjs';
import {check} from '../../lib/output.mjs';
import {renderLaundromat} from './laundromat.mjs';
import {renderSprites} from './sprites.mjs';
import {encodeWebp, IMG_H, IMG_W} from './svg.mjs';
import {renderWardC} from './ward-c.mjs';

/** @typedef {import('../../lib/output.mjs').Output} Output */

const DIR = 'spotlight';

/** @param {Output} out */
export async function generate(out) {
  out.bytes(`${DIR}/ward-c.webp`, await encodeWebp(await renderWardC(), IMG_W, IMG_H));
  out.bytes(`${DIR}/laundromat.webp`, await encodeWebp(await renderLaundromat(), IMG_W, IMG_H));
  const {sheet, frames} = await renderSprites();
  check(sheet.width <= 1024 && sheet.height <= 1024, `the sprite atlas fits 1024 × 1024, got ${sheet.width} × ${sheet.height}`);
  out.png(`${DIR}/sprites.png`, sheet);
  out.json(`${DIR}/sprites.json`, texturePackerHash(frames, {image: 'sprites.png', width: sheet.width, height: sheet.height}));
}
