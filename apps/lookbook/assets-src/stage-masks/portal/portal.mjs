// stage-masks/portal: "The Painting in the Hallway" — the hallway of a manor at night (a strip of
// its wall, a strip of its floor, two doors, the gilt frame of the portrait at its end) and the
// sprites of the hallway and of the moor inside the painting. The sky, the hills, the ground and the
// mist of the moor are the demo's, worked out per pixel at run time. README.md documents every file.
import {texturePackerHash} from '../../lib/formats.mjs';
import {check} from '../../lib/output.mjs';
import {renderDoors, renderFloor, renderFrame, renderWall} from './hall.mjs';
import {DOOR, encodeWebpRGB, encodeWebpRGBA, FLOOR_PERIOD, FRAME, HALL, RUNNER, TX, WALL, WALL_PERIOD} from './kit.mjs';
import {renderSprites} from './sprites.mjs';

/** @typedef {import('../../lib/output.mjs').Output} Output */

const DIR = 'portal';

/** @param {Output} out */
export async function generate(out) {
  const wall = await renderWall();
  out.bytes(`${DIR}/wall.webp`, await encodeWebpRGB(wall.img, wall.w, wall.h));
  const floor = renderFloor();
  out.bytes(`${DIR}/floor.webp`, await encodeWebpRGB(floor.img, floor.w, floor.h));
  const doors = await renderDoors();
  out.bytes(`${DIR}/doors.webp`, await encodeWebpRGBA(doors.img, doors.w, doors.h));
  const frame = renderFrame();
  out.bytes(`${DIR}/frame.webp`, await encodeWebpRGBA(frame.img, frame.w, frame.h));
  const {sheet, frames, units} = await renderSprites();
  check(sheet.width <= 2048 && sheet.height <= 2048, `the sprite atlas fits 2048 × 2048, got ${sheet.width} × ${sheet.height}`);
  out.png(`${DIR}/sprites.png`, sheet);
  out.json(`${DIR}/sprites.json`, texturePackerHash(frames, {image: 'sprites.png', width: sheet.width, height: sheet.height}));
  out.json(`${DIR}/layout.json`, {
    hall: HALL,
    wall: {...WALL, period: WALL_PERIOD},
    floor: {period: FLOOR_PERIOD, runner: RUNNER},
    door: {...DOOR, frames: doors.frames},
    frame: FRAME,
    texelsPerUnit: TX,
    sprites: units,
  });
}
