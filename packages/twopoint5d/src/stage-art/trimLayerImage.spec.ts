import {afterEach, describe, expect, test, vi} from 'vitest';

import {FakeCanvas} from '../testing/fakeCanvas.js';
import type {LayerBox} from './artLayout.js';
import {trimLayerImage} from './trimLayerImage.js';

// the pixels of a canvas of `width` × `height`, clear but for the boxes given, each at `alpha`
const pixelsOf = (width: number, height: number, ...boxes: (LayerBox & {alpha?: number})[]) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const {x, y, w, h, alpha = 255} of boxes) {
    for (let row = y; row < y + h; row++) {
      for (let column = x; column < x + w; column++) {
        const at = (row * width + column) * 4;
        data[at] = 200;
        data[at + 3] = alpha;
      }
    }
  }
  return {width, height, data};
};

describe('trimLayerImage()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('answers the box of the pixels with an alpha above 0, in pixels of the canvas', () => {
    expect(trimLayerImage(pixelsOf(16, 12, {x: 3, y: 2, w: 5, h: 4}))).toEqual({x: 3, y: 2, w: 5, h: 4});
  });

  test('the box holds every picture of the file, the gaps between them included', () => {
    expect(trimLayerImage(pixelsOf(16, 12, {x: 1, y: 8, w: 2, h: 1}, {x: 12, y: 3, w: 1, h: 2}))).toEqual({
      x: 1,
      y: 3,
      w: 12,
      h: 6,
    });
  });

  test('an alpha of 1 counts, colour without alpha does not', () => {
    const image = pixelsOf(8, 8, {x: 5, y: 6, w: 1, h: 1, alpha: 1});
    // colour on a clear pixel: a paint tool leaves it there under a transparent eraser
    image.data[(0 * 8 + 0) * 4] = 255;
    expect(trimLayerImage(image)).toEqual({x: 5, y: 6, w: 1, h: 1});
  });

  test('a picture over the whole canvas is the canvas, a pixel in a corner one pixel', () => {
    expect(trimLayerImage(pixelsOf(4, 3, {x: 0, y: 0, w: 4, h: 3}))).toEqual({x: 0, y: 0, w: 4, h: 3});
    expect(trimLayerImage(pixelsOf(4, 3, {x: 3, y: 2, w: 1, h: 1}))).toEqual({x: 3, y: 2, w: 1, h: 1});
  });

  test('an empty image answers undefined', () => {
    expect(trimLayerImage(pixelsOf(16, 12))).toBeUndefined();
  });

  test('a decoded bitmap is drawn into a canvas of its size and read back there', () => {
    const image = pixelsOf(16, 12, {x: 3, y: 2, w: 5, h: 4});
    const canvases: FakeCanvas[] = [];
    const getImageData = vi.fn((_x: number, _y: number, _w: number, _h: number) => ({data: image.data}));
    vi.stubGlobal(
      'OffscreenCanvas',
      class extends FakeCanvas {
        constructor(width: number, height: number) {
          super(width, height);
          canvases.push(this);
          Object.assign(this.context, {getImageData});
        }
      },
    );
    const bitmap = {width: 16, height: 12, close: vi.fn()} as unknown as ImageBitmap;

    expect(trimLayerImage(bitmap)).toEqual({x: 3, y: 2, w: 5, h: 4});
    expect(canvases).toHaveLength(1);
    const [drawn] = canvases[0]!.context.callsOf('drawImage');
    expect(drawn!.args).toEqual([bitmap, 0, 0]);
    expect(getImageData).toHaveBeenCalledExactlyOnceWith(0, 0, 16, 12);
    // the canvas lets go of its pixels at once; the bitmap stays the caller's
    expect([canvases[0]!.width, canvases[0]!.height]).toEqual([0, 0]);
    expect(bitmap.close).not.toHaveBeenCalled();
  });
});
