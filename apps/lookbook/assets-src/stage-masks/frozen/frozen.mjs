// stage-masks/frozen: "The Moth Chapel", the art of the demo stage-masks-frozen — a rose window of
// 253 panes (the glass, the ids of its panes and their list), the stone and the lead around them,
// the séance the window looks down into, and the sprites: four faces for the sitters' heads, the
// planchette, two moths. README.md documents every file.
import sharp from 'sharp';
import {texturePackerHash} from '../../lib/formats.mjs';
import {check} from '../../lib/output.mjs';
import {encodePng} from '../../lib/png.mjs';
import {encodeWebpRGB} from '../rift/kit.mjs';
import {GLASS_EXTENT, PX, renderFrame, renderRose, STONE_R} from './rose.mjs';
import {renderRoom} from './room.mjs';
import {FACE_H, FACE_W, FACE_WRAP, renderSprites} from './sprites.mjs';

/** @typedef {import('../../lib/output.mjs').Output} Output */

const DIR = 'frozen';

/** @param {Output} out */
export async function generate(out) {
  const rose = await renderRose();
  out.bytes(`${DIR}/glass.webp`, rose.glass);
  out.bytes(`${DIR}/panes.png`, encodePng(rose.size, rose.size, rose.idBytes));
  out.json(`${DIR}/window.json`, {
    texelsPerUnit: PX,
    extent: GLASS_EXTENT,
    stoneRadius: STONE_R,
    panes: rose.panes,
  });

  const frame = await renderFrame(rose.regions);
  const bytes = new Uint8Array(frame.size * frame.size * 4);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(Math.min(1, Math.max(0, frame.rgba[i])) * 255);
  for (let i = 0; i < bytes.length; i += 4) if (bytes[i + 3] === 0) bytes[i] = bytes[i + 1] = bytes[i + 2] = 0;
  out.bytes(
    `${DIR}/frame.webp`,
    await sharp(Buffer.from(bytes.buffer), {raw: {width: frame.size, height: frame.size, channels: 4}})
      .webp({quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true})
      .toBuffer(),
  );

  const room = await renderRoom();
  out.bytes(`${DIR}/room.webp`, await encodeWebpRGB(room.rgba, room.size, room.size));
  out.json(`${DIR}/room.json`, room.layout);

  const {sheet, frames} = await renderSprites();
  check(sheet.width <= 2048 && sheet.height <= 2048, `the sprite atlas fits 2048 × 2048, got ${sheet.width} × ${sheet.height}`);
  sheet.clearTransparent();
  out.bytes(
    `${DIR}/sprites.webp`,
    await sharp(Buffer.from(sheet.data.buffer, sheet.data.byteOffset, sheet.data.length), {
      raw: {width: sheet.width, height: sheet.height, channels: 4},
    })
      .webp({quality: 92, alphaQuality: 100, effort: 6, smartSubsample: true})
      .toBuffer(),
  );
  const atlas = texturePackerHash(frames, {image: 'sprites.webp', width: sheet.width, height: sheet.height});
  out.json(`${DIR}/sprites.json`, {...atlas, faceMap: {width: FACE_W, height: FACE_H, wrap: FACE_WRAP}});
}
