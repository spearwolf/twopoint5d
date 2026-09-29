import {isFiniteNumber} from '../utils/isFiniteNumber.js';

/** `[left, top, right, bottom]`, the margins of {@link frameTrimMargins}. */
export type FrameTrimMargins = [left: number, top: number, right: number, bottom: number];

// a guard, and not an object pattern with defaults: setFrame() calls this on the hot path, and a
// call allocates nothing
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * The margins a packer cut off a sprite when it trimmed the frame out of it, `[left, top, right, bottom]`:
 * what was cut off at each side, as a fraction of the untrimmed sprite — `left` and `right` of its width,
 * `top` and `bottom` of its height, `top` counted from the top like `spriteSourceSize.y`. An untrimmed
 * frame has 0 at every side.
 *
 * They come from `spriteSourceSize` (`x`, `y`, `w`, `h`) and `sourceSize` (`w`, `h`) of the frame data,
 * as TexturePacker writes them for every frame; `trimmed` is not read, the two rectangles already say
 * it. A frame without both rectangles, with a value in them that is no finite number, or with a
 * `sourceSize` whose width or height is not above 0 gets four zeros.
 *
 * The margins hold for the upright sprite, the way TexturePacker writes `spriteSourceSize`: the flip bits
 * of a frame the packer turned only turn it back, and a flip set on the `TextureCoords` by hand mirrors
 * the lookup inside the trimmed area, not where that area lies.
 *
 * `data` is the `data` of an atlas frame, of whatever type its atlas names it: only `spriteSourceSize`
 * and `sourceSize` are read, and a value without them — or one that is no object — gets four zeros.
 *
 * Writes into `target` and answers it; with a `target` of its own the call allocates nothing.
 */
export function frameTrimMargins(data: unknown, target: FrameTrimMargins = [0, 0, 0, 0]): FrameTrimMargins {
  const spriteSourceSize = isObject(data) ? data['spriteSourceSize'] : undefined;
  const sourceSize = isObject(data) ? data['sourceSize'] : undefined;

  const x = isObject(spriteSourceSize) ? spriteSourceSize['x'] : undefined;
  const y = isObject(spriteSourceSize) ? spriteSourceSize['y'] : undefined;
  const w = isObject(spriteSourceSize) ? spriteSourceSize['w'] : undefined;
  const h = isObject(spriteSourceSize) ? spriteSourceSize['h'] : undefined;
  const W = isObject(sourceSize) ? sourceSize['w'] : undefined;
  const H = isObject(sourceSize) ? sourceSize['h'] : undefined;

  if (
    isFiniteNumber(x) &&
    isFiniteNumber(y) &&
    isFiniteNumber(w) &&
    isFiniteNumber(h) &&
    isFiniteNumber(W) &&
    isFiniteNumber(H) &&
    W > 0 &&
    H > 0
  ) {
    target[0] = x / W;
    target[1] = y / H;
    target[2] = (W - x - w) / W;
    target[3] = (H - y - h) / H;
  } else {
    target[0] = 0;
    target[1] = 0;
    target[2] = 0;
    target[3] = 0;
  }

  return target;
}
