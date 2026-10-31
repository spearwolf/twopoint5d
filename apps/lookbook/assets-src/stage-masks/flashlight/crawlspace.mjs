// stage-masks/flashlight: "The Crawlspace", the art of the demo stage-masks-flashlight — the
// crawlspace under an old house in three painted layers at three depths (the back wall, the middle
// with the girder and the pipes, the layer the player crawls in), the sprites in one atlas, and
// `layout.json`, which tells the demo where everything lies. README.md documents every file.
import sharp from 'sharp';
import {texturePackerHash} from '../../lib/formats.mjs';
import {check} from '../../lib/output.mjs';
import {renderBack} from './back.mjs';
import {
  CAMERA_DISTANCE,
  CAMERA_RANGE,
  DRAIN,
  DRAWINGS,
  EYES,
  FLOOR_Y,
  LAYERS,
  NEAR,
  PLAYER_RANGE,
  POSTS,
  VENT,
} from './layout.mjs';
import {renderMid} from './mid.mjs';
import {renderPlay} from './play.mjs';
import {LENS, renderSprites} from './sprites.mjs';

/** @typedef {import('../../lib/output.mjs').Output} Output */

const DIR = 'flashlight';

/** @param {Output} out */
export async function generate(out) {
  /** @type {Record<string, string[]>} */
  const tiles = {};
  for (const [name, render] of /** @type {const} */ ([
    ['back', renderBack],
    ['mid', renderMid],
    ['play', renderPlay],
  ])) {
    const images = await render();
    tiles[name] = images.map((bytes, i) => {
      const file = `${name}-${i}.webp`;
      out.bytes(`${DIR}/${file}`, bytes);
      return file;
    });
  }
  const {sheet, frames, units} = await renderSprites();
  check(sheet.width <= 2048 && sheet.height <= 2560, `the sprite atlas fits 2048 × 2560, got ${sheet.width} × ${sheet.height}`);
  sheet.clearTransparent();
  out.bytes(
    `${DIR}/sprites.webp`,
    await sharp(Buffer.from(sheet.data.buffer, sheet.data.byteOffset, sheet.data.length), {
      raw: {width: sheet.width, height: sheet.height, channels: 4},
    })
      .webp({quality: 90, alphaQuality: 100, effort: 6})
      .toBuffer(),
  );
  out.json(`${DIR}/sprites.json`, texturePackerHash(frames, {image: 'sprites.webp', width: sheet.width, height: sheet.height}));
  out.json(`${DIR}/layout.json`, {
    cameraDistance: CAMERA_DISTANCE,
    floorY: FLOOR_Y,
    playerRange: PLAYER_RANGE,
    cameraRange: CAMERA_RANGE,
    layers: Object.fromEntries(Object.entries(LAYERS).map(([name, frame]) => [name, {...frame, images: tiles[name]}])),
    vent: VENT,
    posts: POSTS,
    drain: DRAIN,
    drawings: DRAWINGS,
    near: NEAR,
    eyes: EYES,
    lens: LENS,
    frames: units,
  });
}
