// stage-masks/rift: "Deep Listening" — the control room of a radio-telescope station at night, the
// same room drowned on the far side of the signal, what lies behind the window of each, and the
// atlas of their sprites. README.md documents every file.
import {texturePackerHash} from '../../lib/formats.mjs';
import {check} from '../../lib/output.mjs';
import {BACKDROP_H, BACKDROP_W, renderDeep, renderSky} from './backdrops.mjs';
import {encodeWebpRGB, encodeWebpRGBA, IMG_H, IMG_W} from './kit.mjs';
import {renderRoom} from './room.mjs';
import {renderSprites} from './sprites.mjs';

/** @typedef {import('../../lib/output.mjs').Output} Output */

const DIR = 'rift';

/** @param {Output} out */
export async function generate(out) {
  out.bytes(`${DIR}/room-night.webp`, await encodeWebpRGBA(await renderRoom(false), IMG_W, IMG_H));
  out.bytes(`${DIR}/room-drowned.webp`, await encodeWebpRGBA(await renderRoom(true), IMG_W, IMG_H));
  out.bytes(`${DIR}/sky.webp`, await encodeWebpRGB(await renderSky(), BACKDROP_W, BACKDROP_H));
  out.bytes(`${DIR}/deep.webp`, await encodeWebpRGB(await renderDeep(), BACKDROP_W, BACKDROP_H));
  const {sheet, frames} = await renderSprites();
  check(sheet.width <= 2048 && sheet.height <= 2048, `the sprite atlas fits 2048 × 2048, got ${sheet.width} × ${sheet.height}`);
  out.png(`${DIR}/sprites.png`, sheet);
  out.json(`${DIR}/sprites.json`, texturePackerHash(frames, {image: 'sprites.png', width: sheet.width, height: sheet.height}));
}
