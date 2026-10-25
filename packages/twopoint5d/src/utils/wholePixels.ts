// A zoom of 5 / 2.625 CSS pixels, times 2.625, is 4.999… device pixels in floating point: the
// whole pixels of a zoom are counted with this much leeway before they are rounded
const WHOLE_PIXEL_EPSILON = 1e-6;

/** The whole pixels in `pixels`, rounded down, with a leeway of `1e-6` for floating point. */
export function floorWholePixels(pixels: number): number {
  return Math.floor(pixels + WHOLE_PIXEL_EPSILON);
}

/** The whole pixels in `pixels`, rounded up, with a leeway of `1e-6` for floating point. */
export function ceilWholePixels(pixels: number): number {
  return Math.ceil(pixels - WHOLE_PIXEL_EPSILON);
}
