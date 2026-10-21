import {emit, eventize} from '@spearwolf/eventize';
import {describe, expect, it, vi} from 'vitest';
import {OnDisplayDispose, OnDisplayRenderFrame, OnDisplayResize, OnDisplayRestart} from '../events.js';
import {AdaptiveResolution} from './AdaptiveResolution.js';
import type {Display} from './Display.js';

const FRAME_MS = 1000 / 60;

/**
 * A display stub with what the controller reads: the renderer and its backend, resolutionScale
 * and pixelZoom, and the events. `frame()` runs a frame as the display does — a changed scale is
 * measured first and emits a resize — and lets the measurement of the GPU time come in.
 * `timestamps` makes the backend measure GPU time; `gpuMs` is what it measures.
 */
function makeDisplay({timestamps = false, resolutionScale = 1} = {}) {
  const gpu = {ms: 0};
  const renderer = {
    backend: {trackTimestamp: timestamps, hasTimestamp: timestamps},
    resolveTimestampsAsync: vi.fn(() => Promise.resolve(gpu.ms)),
  };
  const display = eventize({renderer, resolutionScale, pixelZoom: 0}) as unknown as Display;

  let measuredScale = resolutionScale;
  const frame = async (deltaMs = FRAME_MS) => {
    if (display.resolutionScale !== measuredScale) {
      measuredScale = display.resolutionScale;
      emit(display, OnDisplayResize, {});
    }
    emit(display, OnDisplayRenderFrame, {rawDeltaTime: deltaMs / 1000});
    // the measurement resolves in a microtask
    await Promise.resolve();
    await Promise.resolve();
  };
  const frames = async (count: number, deltaMs = FRAME_MS) => {
    for (let i = 0; i < count; i++) await frame(deltaMs);
  };

  return {display, renderer, gpu, frame, frames};
}

// the frames after a start, a restart and every resize that count for nothing
const SETTLE = 30;

describe('AdaptiveResolution', () => {
  describe('options', () => {
    it('holds 60 frames per second between a scale of 0.5 and 1 by default', () => {
      const adaptive = new AdaptiveResolution(makeDisplay().display);

      expect(adaptive.targetFps).toBe(60);
      expect(adaptive.minScale).toBe(0.5);
      expect(adaptive.maxScale).toBe(1);
      expect(adaptive.scale).toBe(1);
    });

    it('rounds the scales to steps of an eighth, minScale up and maxScale down', () => {
      const adaptive = new AdaptiveResolution(makeDisplay().display, {minScale: 0.3, maxScale: 0.9});

      expect(adaptive.minScale).toBe(0.375);
      expect(adaptive.maxScale).toBe(0.875);
    });

    it('holds minScale at maxScale where it lies above it', () => {
      const adaptive = new AdaptiveResolution(makeDisplay().display, {minScale: 0.9, maxScale: 0.5});

      expect(adaptive.minScale).toBe(0.5);
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('takes %s as the default of every option', (value) => {
      const adaptive = new AdaptiveResolution(makeDisplay().display, {targetFps: value, minScale: value, maxScale: value});

      expect([adaptive.targetFps, adaptive.minScale, adaptive.maxScale]).toEqual([60, 0.5, 1]);
    });

    it('takes over at the highest step at or below the scale the display has', () => {
      const {display} = makeDisplay({resolutionScale: 0.8});
      const adaptive = new AdaptiveResolution(display);

      expect(adaptive.scale).toBe(0.75);
      expect(display.resolutionScale).toBe(0.75);
    });
  });

  describe('method', () => {
    it('is undefined until the first frame', () => {
      expect(new AdaptiveResolution(makeDisplay({timestamps: true}).display).method).toBeUndefined();
    });

    it('reads the GPU time where the backend tracks timestamps', async () => {
      const {display, frame} = makeDisplay({timestamps: true});
      const adaptive = new AdaptiveResolution(display);
      await frame();

      expect(adaptive.method).toBe('gpu-time');
    });

    it('reads the pace of the frames where the backend tracks no timestamps', async () => {
      const {display, renderer, frames} = makeDisplay();
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 40);

      expect(adaptive.method).toBe('frame-pacing');
      expect(renderer.resolveTimestampsAsync).not.toHaveBeenCalled();
    });

    it('goes over to the pace of the frames where the GPU time stays out', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true});
      gpu.ms = 0;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 61);

      expect(adaptive.method).toBe('frame-pacing');
      expect(adaptive.gpuTime).toBeUndefined();
    });
  });

  describe('gpu-time', () => {
    it('lets the first frames pass unmeasured', async () => {
      const {display, renderer, frames} = makeDisplay({timestamps: true});
      new AdaptiveResolution(display);
      await frames(SETTLE);

      expect(renderer.resolveTimestampsAsync).not.toHaveBeenCalled();
    });

    it('goes down a step where the GPU time lies above 80 % of the frame interval', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true});
      gpu.ms = 15;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 12);

      expect(adaptive.gpuTime).toBe(15);
      expect(adaptive.scale).toBe(0.875);
      expect(display.resolutionScale).toBe(0.875);
    });

    it('goes down two steps where the GPU time lies far above the budget', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true});
      gpu.ms = 25;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 12);

      expect(adaptive.scale).toBe(0.75);
    });

    it('takes the median of a window, so a single spike moves nothing', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true});
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE);
      gpu.ms = 10;
      await frames(11);
      gpu.ms = 100;
      await frames(1);

      expect(adaptive.gpuTime).toBe(10);
      expect(adaptive.scale).toBe(1);
    });

    it('lets every resize pass before it judges again', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true});
      gpu.ms = 15;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 12);
      expect(adaptive.scale).toBe(0.875);

      // the step was a resize: the next 30 frames count for nothing, the window after it is judged
      await frames(SETTLE + 11);
      expect(adaptive.scale).toBe(0.875);
      await frames(1);
      expect(adaptive.scale).toBe(0.75);
    });

    it('goes up a step after three windows in which the pixels of that step fit into 90 % of the budget', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true, resolutionScale: 0.75});
      // 5 ms × (0.875 / 0.75)² is 6.8 ms, below 90 % of 13.3 ms
      gpu.ms = 5;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 35);
      expect(adaptive.scale).toBe(0.75);

      await frames(1);
      expect(adaptive.scale).toBe(0.875);
    });

    it('stays where the pixels of the next step would not fit', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true, resolutionScale: 0.875});
      // 10 ms × (1 / 0.875)² is 13.1 ms, above 90 % of 13.3 ms
      gpu.ms = 10;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 12 * 5);

      expect(adaptive.scale).toBe(0.875);
    });

    it('goes no lower than minScale and no higher than maxScale', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true});
      const adaptive = new AdaptiveResolution(display, {minScale: 0.75});
      gpu.ms = 50;
      await frames((SETTLE + 12) * 4);
      expect(adaptive.scale).toBe(0.75);

      gpu.ms = 1;
      await frames((SETTLE + 12 * 3) * 4);
      expect(adaptive.scale).toBe(1);
    });

    it('drops a measurement that started before a resize', async () => {
      const {display, renderer, frames, frame} = makeDisplay({timestamps: true});
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE);
      let answer: (ms: number) => void = () => {};
      renderer.resolveTimestampsAsync.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
      await frame();

      emit(display, OnDisplayResize, {});
      answer(50);
      await Promise.resolve();
      await Promise.resolve();

      expect(adaptive.gpuTime).toBeUndefined();
    });
  });

  describe('frame-pacing', () => {
    it('goes down a step where 3 of 30 frames come later than 1.5 frame intervals', async () => {
      const {display, frames} = makeDisplay();
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 27);
      await frames(2, 40);
      expect(adaptive.scale).toBe(1);

      await frames(1, 40);
      expect(adaptive.scale).toBe(0.875);
    });

    it('tries a step up after 180 clean frames, and keeps it where the next two windows stay clean', async () => {
      const {display, frames} = makeDisplay({resolutionScale: 0.75});
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 179);
      expect(adaptive.scale).toBe(0.75);

      await frames(1);
      expect(adaptive.scale).toBe(0.875);

      await frames(SETTLE + 60);
      expect(adaptive.scale).toBe(0.875);
    });

    it('goes back where the try fails, and waits twice as long before the next one', async () => {
      const {display, frames} = makeDisplay({resolutionScale: 0.75});
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 180);
      expect(adaptive.scale).toBe(0.875);

      await frames(SETTLE);
      await frames(30, 40);
      expect(adaptive.scale, 'the failed try').toBe(0.75);

      await frames(SETTLE + 359);
      expect(adaptive.scale, 'not yet').toBe(0.75);
      await frames(1);
      expect(adaptive.scale, 'the next try').toBe(0.875);
    });

    it('measures the frame interval against a lower targetFps', async () => {
      const {display, frames} = makeDisplay();
      const adaptive = new AdaptiveResolution(display, {targetFps: 30});
      // 40 ms lies below 1.5 × 33.3 ms
      await frames(SETTLE + 60, 40);

      expect(adaptive.scale).toBe(1);
    });
  });

  describe('holding still and letting go', () => {
    it('holds still while the display has a pixelZoom', async () => {
      const {display, gpu, renderer, frames} = makeDisplay({timestamps: true});
      display.pixelZoom = 2;
      gpu.ms = 50;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 60);

      expect(adaptive.scale).toBe(1);
      expect(renderer.resolveTimestampsAsync).not.toHaveBeenCalled();
    });

    it('lets the frames after a restart pass', async () => {
      const {display, renderer, frames} = makeDisplay({timestamps: true});
      new AdaptiveResolution(display);
      await frames(SETTLE + 5);
      renderer.resolveTimestampsAsync.mockClear();

      emit(display, OnDisplayRestart, {});
      await frames(SETTLE);

      expect(renderer.resolveTimestampsAsync).not.toHaveBeenCalled();
    });

    it('gives the display its scale back when disabled, and takes over again when enabled', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true, resolutionScale: 0.9});
      gpu.ms = 15;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 12);
      expect(adaptive.scale).toBe(0.75);

      adaptive.enabled = false;
      expect(display.resolutionScale).toBe(0.9);
      await frames(SETTLE + 24);
      expect(display.resolutionScale, 'held still').toBe(0.9);

      adaptive.enabled = true;
      expect(display.resolutionScale).toBe(0.875);
    });

    it('lets go and gives the display its scale back with dispose()', async () => {
      const {display, gpu, renderer, frames} = makeDisplay({timestamps: true});
      gpu.ms = 15;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 12);
      expect(display.resolutionScale).toBe(0.875);

      adaptive.dispose();
      adaptive.dispose();
      renderer.resolveTimestampsAsync.mockClear();
      await frames(SETTLE + 24);

      expect(display.resolutionScale).toBe(1);
      expect(renderer.resolveTimestampsAsync).not.toHaveBeenCalled();
    });

    it('lets go of a display that is disposed', async () => {
      const {display, renderer, frames} = makeDisplay({timestamps: true});
      const adaptive = new AdaptiveResolution(display);
      emit(display, OnDisplayDispose, display);
      await frames(SETTLE + 24);

      expect(renderer.resolveTimestampsAsync).not.toHaveBeenCalled();
      adaptive.enabled = false;
      expect(adaptive.enabled, 'a disposed controller stays as it is').toBe(true);
    });
  });
});
