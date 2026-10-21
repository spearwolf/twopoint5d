import {describe, expect, it} from 'vitest';
import {
  type DrawingBuffer,
  type DrawingBufferParams,
  pixelRatioFor,
  resolveDrawingBuffer as resolveInto,
} from './resolveDrawingBuffer.js';

// the values of a display that is built with no option: 320 × 200, a ratio of 1 bounded at 2
function params(overrides: Partial<DrawingBufferParams> = {}): DrawingBufferParams {
  const contentWidth = overrides.contentWidth ?? 320;
  const contentHeight = overrides.contentHeight ?? 200;
  return {
    contentWidth,
    contentHeight,
    cssWidth: contentWidth,
    cssHeight: contentHeight,
    devicePixelRatio: 1,
    maxPixelRatio: 2,
    maxPixels: 0,
    resolutionScale: 1,
    pixelZoom: 0,
    maxResolution: 8192,
    ...overrides,
  };
}

// every case resolves into an object of its own, as a display hands in the one it keeps
function resolveDrawingBuffer(drawingBufferParams: DrawingBufferParams): DrawingBuffer {
  return resolveInto(drawingBufferParams, {
    width: 0,
    height: 0,
    cssWidth: 0,
    cssHeight: 0,
    pixelRatio: 0,
    pixelZoom: 0,
    devicePixelZoom: 0,
    requestedWidth: 0,
    requestedHeight: 0,
  });
}

describe('pixelRatioFor()', () => {
  it('leaves a devicePixelRatio below maxPixelRatio as it is', () => {
    expect(pixelRatioFor(params({devicePixelRatio: 1.25}))).toBe(1.25);
  });

  it('bounds the devicePixelRatio by maxPixelRatio', () => {
    expect(pixelRatioFor(params({devicePixelRatio: 3, maxPixelRatio: 1.5}))).toBe(1.5);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('takes a maxPixelRatio of %s as no bound', (maxPixelRatio) => {
    expect(pixelRatioFor(params({devicePixelRatio: 3, maxPixelRatio}))).toBe(3);
  });

  it('bounds the ratio by a budget of pixels, rounded down to an eighth', () => {
    // sqrt(3 000 000 / 8 294 400) is 0.601
    expect(pixelRatioFor(params({contentWidth: 3840, contentHeight: 2160, devicePixelRatio: 2, maxPixels: 3_000_000}))).toBe(0.5);
    // sqrt(1 000 000 / 2 073 600) is 0.694
    expect(pixelRatioFor(params({contentWidth: 1920, contentHeight: 1080, maxPixels: 1_000_000}))).toBe(0.625);
  });

  it('leaves the ratio exactly as it is where the budget is not what bounds it', () => {
    expect(pixelRatioFor(params({devicePixelRatio: 2.625, maxPixelRatio: 0, maxPixels: 3_000_000}))).toBe(2.625);
  });

  it('spreads no budget over an area of 0', () => {
    expect(pixelRatioFor(params({contentWidth: 0, devicePixelRatio: 2, maxPixels: 1000}))).toBe(2);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('takes a maxPixels of %s as no budget', (maxPixels) => {
    expect(pixelRatioFor(params({contentWidth: 3840, contentHeight: 2160, devicePixelRatio: 2, maxPixels}))).toBe(2);
  });

  it('multiplies the ratio by resolutionScale, rounded down to an eighth, at least an eighth', () => {
    expect(pixelRatioFor(params({devicePixelRatio: 2, resolutionScale: 0.75}))).toBe(1.5);
    expect(pixelRatioFor(params({devicePixelRatio: 2, resolutionScale: 0.8})), '1.6 rounded down').toBe(1.5);
    expect(pixelRatioFor(params({devicePixelRatio: 2, resolutionScale: 0.01})), 'at least an eighth').toBe(0.125);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('takes a resolutionScale of %s as 1', (resolutionScale) => {
    expect(pixelRatioFor(params({devicePixelRatio: 2.625, maxPixelRatio: 0, resolutionScale}))).toBe(2.625);
  });

  it('scales the ratio the budget leaves', () => {
    // 0.601 × 0.5 is 0.300
    expect(
      pixelRatioFor(
        params({contentWidth: 3840, contentHeight: 2160, devicePixelRatio: 2, maxPixels: 3_000_000, resolutionScale: 0.5}),
      ),
    ).toBe(0.25);
  });

  it('holds the budget after a resolutionScale above 1', () => {
    // 0.601 × 2 is 1.202, and the budget holds it to 0.601
    expect(
      pixelRatioFor(
        params({contentWidth: 3840, contentHeight: 2160, devicePixelRatio: 2, maxPixels: 3_000_000, resolutionScale: 2}),
      ),
    ).toBe(0.5);
  });

  it('draws beyond maxPixelRatio with a resolutionScale above 1', () => {
    expect(pixelRatioFor(params({devicePixelRatio: 2, maxPixelRatio: 2, resolutionScale: 1.5}))).toBe(3);
  });

  it('is 1 under a pixelZoom, whatever bounds it otherwise', () => {
    expect(
      pixelRatioFor(params({devicePixelRatio: 3, maxPixelRatio: 1.5, maxPixels: 1000, resolutionScale: 0.5, pixelZoom: 2})),
    ).toBe(1);
  });

  it('takes a pixelZoom of Infinity as no zoom', () => {
    expect(pixelRatioFor(params({devicePixelRatio: 2, pixelZoom: Number.POSITIVE_INFINITY}))).toBe(2);
  });
});

describe('resolveDrawingBuffer()', () => {
  describe('without a pixelZoom', () => {
    it('rounds the size down and hands the CSS size through', () => {
      const buffer = resolveDrawingBuffer(params({contentWidth: 320.6, contentHeight: 200.4, cssWidth: 330, cssHeight: 210}));

      expect(buffer).toEqual({
        width: 320,
        height: 200,
        cssWidth: 330,
        cssHeight: 210,
        pixelRatio: 1,
        pixelZoom: 0,
        devicePixelZoom: 0,
        requestedWidth: 0,
        requestedHeight: 0,
      });
    });

    it('clamps the buffer to maxResolution in device pixels, and names the size that was asked for', () => {
      const buffer = resolveDrawingBuffer(params({contentWidth: 5000, contentHeight: 100, devicePixelRatio: 2}));

      expect(buffer.width).toBe(4096);
      expect(buffer.height).toBe(100);
      expect(buffer.pixelRatio).toBe(2);
      expect([buffer.requestedWidth, buffer.requestedHeight]).toEqual([10000, 200]);
    });

    it('rounds a clamped size down, so the buffer stays within maxResolution at a fractional ratio', () => {
      const buffer = resolveDrawingBuffer(params({contentWidth: 5000, contentHeight: 50, devicePixelRatio: 3, maxPixelRatio: 0}));

      // Math.floor(2730 * 3) is 8190
      expect(buffer.width).toBe(2730);
      expect(buffer.height).toBe(50);
    });
  });

  describe('with a pixelZoom', () => {
    it('draws every pixel of the buffer a whole number of device pixels large, and the canvas just as large as those pixels', () => {
      const buffer = resolveDrawingBuffer(params({contentWidth: 412, contentHeight: 915, devicePixelRatio: 2.625, pixelZoom: 2}));

      // 2 × 2.625 is 5.25 device pixels, rounded down
      expect(buffer.devicePixelZoom).toBe(5);
      expect(buffer.width).toBe(216);
      expect(buffer.height).toBe(480);
      expect(buffer.pixelRatio).toBe(1);
      expect(buffer.pixelZoom).toBe(2);
      expect(buffer.cssWidth).toBeCloseTo((216 * 5) / 2.625);
      expect(buffer.cssHeight).toBeCloseTo((480 * 5) / 2.625);
      expect([buffer.requestedWidth, buffer.requestedHeight]).toEqual([0, 0]);
    });

    it('rounds the zoom in device pixels down, at least to 1', () => {
      expect(resolveDrawingBuffer(params({devicePixelRatio: 1.25, pixelZoom: 2})).devicePixelZoom).toBe(2);
      expect(
        resolveDrawingBuffer(params({devicePixelRatio: 2.625, pixelZoom: 4 / 2.625})).devicePixelZoom,
        'with the leeway',
      ).toBe(4);
      expect(resolveDrawingBuffer(params({devicePixelRatio: 2, pixelZoom: 0.25})).devicePixelZoom).toBe(1);
    });

    it('raises the whole zoom until the buffer stays within the budget', () => {
      const buffer = resolveDrawingBuffer(
        params({contentWidth: 1000, contentHeight: 500, devicePixelRatio: 2, maxPixels: 100_000, pixelZoom: 1}),
      );

      // 2000 × 1000 device pixels, and sqrt(2 000 000 / 100 000) is 4.47
      expect(buffer.devicePixelZoom).toBe(5);
      expect(buffer.width).toBe(400);
      expect(buffer.height).toBe(200);
    });

    it('leaves the zoom alone where the budget holds it already', () => {
      const buffer = resolveDrawingBuffer(
        params({contentWidth: 1000, contentHeight: 500, devicePixelRatio: 2, maxPixels: 100_000, pixelZoom: 4}),
      );

      expect(buffer.devicePixelZoom).toBe(8);
    });

    it('holds the buffer itself to maxResolution, and names the size that was asked for', () => {
      const buffer = resolveDrawingBuffer(params({contentWidth: 20000, contentHeight: 100, pixelZoom: 2}));

      // 10000 pixels of the buffer would fit, and the canvas takes the size of the 8192 it gets
      expect(buffer.width).toBe(8192);
      expect(buffer.height).toBe(50);
      expect(buffer.cssWidth).toBe(16384);
      expect([buffer.requestedWidth, buffer.requestedHeight]).toEqual([10000, 50]);
    });

    it.each([Number.NaN, -1, Number.POSITIVE_INFINITY])('takes a pixelZoom of %s as 0', (pixelZoom) => {
      const buffer = resolveDrawingBuffer(params({devicePixelRatio: 2, pixelZoom}));

      expect(buffer.pixelZoom).toBe(0);
      expect(buffer.devicePixelZoom).toBe(0);
      expect(buffer.pixelRatio).toBe(2);
      expect(buffer.width).toBe(320);
      expect(Number.isFinite(buffer.cssWidth), 'a finite CSS width').toBe(true);
      expect(buffer).toEqual(resolveDrawingBuffer(params({devicePixelRatio: 2})));
    });

    it('keeps the padding and border the CSS size carries beyond the size', () => {
      const buffer = resolveDrawingBuffer(params({cssWidth: 330, devicePixelRatio: 2.625, pixelZoom: 2}));

      expect(buffer.cssWidth).toBeCloseTo(10 + (buffer.width * buffer.devicePixelZoom) / 2.625);
    });
  });

  it('fills and returns the object it is handed, every field of it', () => {
    const out: DrawingBuffer = {
      width: -1,
      height: -1,
      cssWidth: -1,
      cssHeight: -1,
      pixelRatio: -1,
      pixelZoom: -1,
      devicePixelZoom: -1,
      requestedWidth: -1,
      requestedHeight: -1,
    };

    expect(resolveInto(params({devicePixelRatio: 2}), out)).toBe(out);
    expect(out).toEqual(resolveDrawingBuffer(params({devicePixelRatio: 2})));

    resolveInto(params({contentWidth: 5000, contentHeight: 100, devicePixelRatio: 2}), out);
    expect([out.requestedWidth, out.requestedHeight], 'beyond maxResolution').toEqual([10000, 200]);
    resolveInto(params({contentWidth: 412, contentHeight: 915, devicePixelRatio: 2.625, pixelZoom: 2}), out);
    expect(out, 'under a pixelZoom, within maxResolution again').toEqual(
      resolveDrawingBuffer(params({contentWidth: 412, contentHeight: 915, devicePixelRatio: 2.625, pixelZoom: 2})),
    );
    expect([out.requestedWidth, out.requestedHeight]).toEqual([0, 0]);
  });
});
