// Packing images into one sheet, and trimming them first when asked.
import {Img} from './image.mjs';

/**
 * @typedef {object} PackInput
 * @property {string} name
 * @property {Img} img the full (untrimmed) frame
 * @property {boolean} [trim] cut away the transparent margin before packing
 */

/**
 * @typedef {object} PackedFrame
 * @property {string} name
 * @property {number} x position in the sheet
 * @property {number} y
 * @property {number} w size in the sheet
 * @property {number} h
 * @property {boolean} trimmed whether the stored rect is smaller than the source frame
 * @property {{x: number, y: number, w: number, h: number}} spriteSourceSize the stored rect inside the source frame
 * @property {{w: number, h: number}} sourceSize the size of the source frame
 */

/** @param {number} n */
const nextPow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

/**
 * Shelf packing: the frames sorted by height (then by name), laid out in rows of a sheet `width`
 * pixels wide, `padding` pixels apart and from the edges. Without `width` the sheet takes the
 * smallest power of two that keeps it roughly square. The height is rounded up to a power of two
 * with `powerOfTwo`.
 *
 * @param {PackInput[]} inputs
 * @param {{padding?: number, width?: number, powerOfTwo?: boolean, keepOrder?: boolean}} [opts]
 * @returns {{sheet: Img, frames: PackedFrame[]}} frames in the order of `inputs`
 */
export function pack(inputs, opts = {}) {
  const {padding = 2, powerOfTwo = true, keepOrder = false} = opts;
  const items = inputs.map((input, index) => {
    const full = input.img;
    const box = input.trim ? (full.opaqueBounds() ?? {x: 0, y: 0, w: 1, h: 1}) : {x: 0, y: 0, w: full.width, h: full.height};
    return {index, input, box};
  });
  const order = keepOrder
    ? items
    : [...items].sort((a, b) => b.box.h - a.box.h || b.box.w - a.box.w || a.input.name.localeCompare(b.input.name));

  const area = items.reduce((sum, it) => sum + (it.box.w + padding) * (it.box.h + padding), 0);
  const widest = Math.max(...items.map((it) => it.box.w)) + 2 * padding;
  const width = opts.width ?? Math.max(nextPow2(widest), nextPow2(Math.sqrt(area)));
  if (widest > width) throw new Error(`pack: a frame ${widest - 2 * padding} px wide does not fit a sheet ${width} px wide`);

  /** @type {Map<number, {x: number, y: number}>} */
  const places = new Map();
  let x = padding;
  let y = padding;
  let shelf = 0;
  for (const it of order) {
    if (x + it.box.w + padding > width) {
      x = padding;
      y += shelf + padding;
      shelf = 0;
    }
    places.set(it.index, {x, y});
    x += it.box.w + padding;
    shelf = Math.max(shelf, it.box.h);
  }
  const used = y + shelf + padding;
  const height = powerOfTwo ? nextPow2(used) : used;

  const sheet = new Img(width, height);
  const frames = items.map((it) => {
    const place = /** @type {{x: number, y: number}} */ (places.get(it.index));
    sheet.blit(it.input.img, place.x, place.y, {mode: 'copy', sx: it.box.x, sy: it.box.y, w: it.box.w, h: it.box.h});
    const full = it.input.img;
    return {
      name: it.input.name,
      x: place.x,
      y: place.y,
      w: it.box.w,
      h: it.box.h,
      trimmed: it.box.w !== full.width || it.box.h !== full.height,
      spriteSourceSize: {x: it.box.x, y: it.box.y, w: it.box.w, h: it.box.h},
      sourceSize: {w: full.width, h: full.height},
    };
  });
  return {sheet, frames};
}
