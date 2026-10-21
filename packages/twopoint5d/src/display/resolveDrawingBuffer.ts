import {isPositiveFinite} from '../utils/isPositiveFinite.js';

// A zoom of 5 / 2.625 CSS pixels, times 2.625, is 4.999… device pixels in floating point: the
// whole device pixels of a zoom are counted with this much leeway before rounding down
const DEVICE_PIXEL_ZOOM_EPSILON = 1e-6;

// A pixel ratio that a budget of pixels or a resolution scale has made is rounded down to a step
// of an eighth: the size of the drawing buffer, and of every render target that follows it,
// changes in steps instead of with every pixel of a window drag
const PIXEL_RATIO_STEP = 1 / 8;

// The leeway, in device pixels, for the whole device pixels of a measured size. The layout of the
// browser holds a size to a grid — 1/64 CSS pixel in Chromium — so a canvas that measures itself
// reads back up to that much less than the size written into its style; without the leeway it
// would lose a pixel of the buffer with every measurement
const DEVICE_PIXEL_SIZE_TOLERANCE = 1 / 8;

/**
 * What the drawing buffer of a display is resolved from. Sizes in CSS pixels, none below 0.
 *
 * @internal
 */
export interface DrawingBufferParams {
  /** the size of the size source, its padding and border off: the area a budget of pixels is spread over */
  contentWidth: number;
  contentHeight: number;
  /** the CSS size of the canvas as its box-sizing leaves it, before a pixel zoom fits it to whole pixels */
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  maxPixelRatio: number;
  maxPixels: number;
  resolutionScale: number;
  pixelZoom: number;
  maxResolution: number;
}

/** @internal */
export type PixelRatioParams = Pick<
  DrawingBufferParams,
  'contentWidth' | 'contentHeight' | 'devicePixelRatio' | 'maxPixelRatio' | 'maxPixels' | 'resolutionScale' | 'pixelZoom'
>;

/**
 * What a measurement of a display applies to the renderer and the canvas.
 *
 * @internal
 */
export interface DrawingBuffer {
  /** Display#width / #height: CSS pixels, or pixels of the buffer under a pixel zoom */
  width: number;
  height: number;
  /** the inline width and height of the canvas */
  cssWidth: number;
  cssHeight: number;
  pixelRatio: number;
  /** the zoom, 0 where it is not above 0 */
  pixelZoom: number;
  devicePixelZoom: number;
  /** the size of the buffer the params asked for where it lies beyond maxResolution on an axis — the size the warning of the display names; undefined otherwise */
  requestedSize: [width: number, height: number] | undefined;
}

/**
 * The device pixels per CSS pixel a display draws at: `1` under a pixel zoom, otherwise the
 * `devicePixelRatio`, bounded by `maxPixelRatio` and `maxPixels`, times `resolutionScale` —
 * rounded down to a step of an eighth where the budget or the scale has made it.
 *
 * @internal
 */
export function pixelRatioFor(params: PixelRatioParams): number {
  if (params.pixelZoom > 0) {
    return 1.0;
  }
  const {devicePixelRatio, maxPixelRatio, maxPixels, resolutionScale} = params;

  let ratio = isPositiveFinite(maxPixelRatio) && maxPixelRatio < devicePixelRatio ? maxPixelRatio : devicePixelRatio;
  let stepped = false;

  const area = params.contentWidth * params.contentHeight;
  if (isPositiveFinite(maxPixels) && area > 0) {
    const budgetRatio = Math.sqrt(maxPixels / area);
    if (budgetRatio < ratio) {
      ratio = budgetRatio;
      stepped = true;
    }
  }

  if (isPositiveFinite(resolutionScale) && resolutionScale !== 1) {
    ratio *= resolutionScale;
    stepped = true;
  }

  // rounded down, so the buffer stays within the budget; the leeway keeps 0.75 × 2 at 1.5
  return stepped ? Math.max(PIXEL_RATIO_STEP, Math.floor(ratio / PIXEL_RATIO_STEP + 1e-9) * PIXEL_RATIO_STEP) : ratio;
}

/**
 * The size, the CSS size and the pixel ratio of the drawing buffer of a display, and the whole
 * device pixels of a pixel zoom: the resolution policy of a display, without a DOM.
 *
 * @internal
 */
export function resolveDrawingBuffer(params: DrawingBufferParams): DrawingBuffer {
  const {devicePixelRatio, maxPixels, maxResolution} = params;
  let wPx = params.contentWidth;
  let hPx = params.contentHeight;
  let cssWidth = params.cssWidth;
  let cssHeight = params.cssHeight;

  const pixelRatio = pixelRatioFor(params);
  // a zoom that is NaN or negative works as 0, and counts as 0 in the comparison of the display:
  // NaN would differ from itself and make every frame measure
  const pixelZoom = params.pixelZoom > 0 ? params.pixelZoom : 0;

  let width: number;
  let height: number;
  let devicePixelZoom = 0;
  let requestedSize: [number, number] | undefined;

  if (pixelZoom > 0) {
    // Every pixel of the buffer a whole number of device pixels large, so the pixelated upscale
    // draws all of them equally large: the zoom in device pixels rounded down, the whole pixels
    // of the buffer that fit into the device pixels of the source, and a canvas of just their
    // size — a fraction of a CSS pixel at times, always whole in device pixels
    const ratio = devicePixelRatio;
    devicePixelZoom = Math.max(1, Math.floor(pixelZoom * ratio + DEVICE_PIXEL_ZOOM_EPSILON));
    if (isPositiveFinite(maxPixels)) {
      // the smallest whole zoom at which the buffer stays within the budget
      const budgetZoom = Math.ceil(Math.sqrt((wPx * ratio * hPx * ratio) / maxPixels) - DEVICE_PIXEL_ZOOM_EPSILON);
      if (budgetZoom > devicePixelZoom) devicePixelZoom = budgetZoom;
    }
    width = Math.floor((wPx * ratio + DEVICE_PIXEL_SIZE_TOLERANCE) / devicePixelZoom);
    height = Math.floor((hPx * ratio + DEVICE_PIXEL_SIZE_TOLERANCE) / devicePixelZoom);

    if (width > maxResolution || height > maxResolution) {
      requestedSize = [width, height];
      width = Math.min(width, maxResolution);
      height = Math.min(height, maxResolution);
    }

    // the padding and border the CSS size carries beyond the size stay as they are
    const cssPerPixel = devicePixelZoom / ratio;
    cssWidth = Math.max(0, cssWidth - wPx + width * cssPerPixel);
    cssHeight = Math.max(0, cssHeight - hPx + height * cssPerPixel);
  } else {
    if (wPx * pixelRatio > maxResolution || hPx * pixelRatio > maxResolution) {
      // the size that was asked for, so it is taken before the clamp
      requestedSize = [Math.round(wPx * pixelRatio), Math.round(hPx * pixelRatio)];
      wPx = Math.min(wPx, maxResolution / pixelRatio);
      hPx = Math.min(hPx, maxResolution / pixelRatio);
    }

    // rounded down, so the drawing buffer — Math.floor(width * pixelRatio) — stays within
    // maxResolution at a fractional pixel ratio as well
    width = Math.floor(wPx);
    height = Math.floor(hPx);
  }

  return {width, height, cssWidth, cssHeight, pixelRatio, pixelZoom, devicePixelZoom, requestedSize};
}
