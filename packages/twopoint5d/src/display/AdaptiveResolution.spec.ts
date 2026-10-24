import {emit, eventize, getSubscriptionCount} from '@spearwolf/eventize';
import {describe, expect, it, vi} from 'vitest';
import {OnDisplayDispose, OnDisplayRenderFrame, OnDisplayResize, OnDisplayRestart} from '../events.js';
import {AdaptiveResolution} from './AdaptiveResolution.js';
import type {Display} from './Display.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import {pixelRatioFor} from './resolveDrawingBuffer.js';

const FRAME_MS = 1000 / 60;

interface DoubleOptions {
  timestamps?: boolean;
  resolutionScale?: number;
  devicePixelRatio?: number;
  maxPixelRatio?: number;
  maxPixels?: number;
  width?: number;
  height?: number;
}

interface FrameOptions {
  /** the rawDeltaTime of the frame, in milliseconds */
  deltaMs?: number;
  /** the longest interval between the animation frames of the page before the frame */
  rafMs?: number;
  /** a frame of the frame loop of the display, not a renderFrame() of one's own */
  fromLoop?: boolean;
}

/**
 * A display double that holds to the contract of a display: what the controller reads off it —
 * the renderer and its backend, resolutionScale, pixelZoom, the bounds of the ratio, the frame
 * loop — and `pixelRatioAt()` through the very function a display resolves its ratio with.
 *
 * `frame()` runs a frame as the display does: it measures first, and emits a resize only where
 * the ratio or the zoom has changed since the last measurement; then the frame, and two
 * microtasks for a measurement to come in. `timestamps` makes the backend measure GPU time:
 * `gpu.ms` is what it measures, or `gpu.msAt(ratio)` from the ratio the frame was drawn at. With
 * `gpu.manual` every measurement stays open until `gpu.resolveNext(ms)` — frames later, if need
 * be.
 */
function makeDisplay({
  timestamps = false,
  resolutionScale = 1,
  devicePixelRatio = 1,
  maxPixelRatio = 0,
  maxPixels = 0,
  width = 320,
  height = 200,
}: DoubleOptions = {}) {
  const pending: ((ms: number) => void)[] = [];
  const gpu = {
    ms: 0,
    msAt: undefined as ((ratio: number) => number) | undefined,
    manual: false,
    resolveNext(ms: number) {
      pending.shift()!(ms);
    },
  };

  // the ratio and the zoom of the last measurement
  const measured = {ratio: 0, pixelZoom: 0, resizes: 0};

  const renderer = {
    backend: {trackTimestamp: timestamps, hasTimestamp: timestamps},
    resolveTimestampsAsync: vi.fn(
      (): Promise<number> =>
        gpu.manual
          ? new Promise<number>((resolve) => pending.push(resolve))
          : Promise.resolve(gpu.msAt?.(measured.ratio) ?? gpu.ms),
    ),
  };
  const frameLoop = {frameNo: 0, longestRafInterval: 0};
  const display = eventize({
    renderer,
    resolutionScale,
    pixelZoom: 0,
    isDisposed: false,
    isRunning: true,
    devicePixelRatio,
    maxPixelRatio,
    maxPixels,
    frameLoop,
    pixelRatioAt(scale: number): number {
      return pixelRatioFor({
        contentWidth: width,
        contentHeight: height,
        devicePixelRatio: this.devicePixelRatio,
        maxPixelRatio: this.maxPixelRatio,
        maxPixels: this.maxPixels,
        resolutionScale: scale,
        pixelZoom: this.pixelZoom,
      });
    },
  }) as unknown as Display;

  // the constructor of a display measures, and emits nothing for it
  measured.ratio = display.pixelRatioAt(display.resolutionScale);

  const frame = async ({deltaMs = FRAME_MS, rafMs = deltaMs, fromLoop = true}: FrameOptions = {}) => {
    const ratio = display.pixelRatioAt(display.resolutionScale);
    const pixelZoom = isPositiveFinite(display.pixelZoom) ? display.pixelZoom : 0;
    if (ratio !== measured.ratio || pixelZoom !== measured.pixelZoom) {
      measured.ratio = ratio;
      measured.pixelZoom = pixelZoom;
      measured.resizes += 1;
      emit(display, OnDisplayResize, {});
    }
    if (fromLoop) {
      frameLoop.frameNo += 1;
      frameLoop.longestRafInterval = rafMs;
    }
    emit(display, OnDisplayRenderFrame, {rawDeltaTime: deltaMs / 1000});
    // the measurement resolves in a microtask
    await Promise.resolve();
    await Promise.resolve();
  };
  const frames = async (count: number, options?: FrameOptions) => {
    for (let i = 0; i < count; i++) await frame(options);
  };

  return {display, renderer, gpu, frame, frames, measured};
}

// the frames after a start, a restart and every resize that count for nothing
const SETTLE = 30;

// a 4K screen at a ratio of 2 on a budget of 3 million pixels: sqrt(3 000 000 / 8 294 400) is
// 0.601, so the scales 1 and 0.875 both draw at 0.5, 0.75 and 0.625 both at 0.375, 0.5 at 0.25
const BUDGET_4K = {devicePixelRatio: 2, width: 3840, height: 2160, maxPixels: 3_000_000};

/**
 * Runs frames of `ms` until the controller has come back to a scale of 1 after it went down, or
 * `limit` frames have run; answers the lowest scale it went to, whether it came back, and the
 * frames after which the scale lay below 1.
 */
async function descendAndReturn(
  adaptive: AdaptiveResolution,
  frame: (options?: FrameOptions) => Promise<void>,
  ms: number,
  limit = 2000,
) {
  let lowest = adaptive.scale;
  let framesBelow = 0;
  for (let i = 0; i < limit; i++) {
    await frame({deltaMs: ms});
    lowest = Math.min(lowest, adaptive.scale);
    if (adaptive.scale < 1) framesBelow += 1;
    if (lowest < 1 && adaptive.scale === 1) return {lowest, back: true, framesBelow};
  }
  return {lowest, back: false, framesBelow};
}

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

    it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -1])(
      'takes over a resolutionScale of %s as 1, and gives 1 back',
      (value) => {
        const {display} = makeDisplay({resolutionScale: value});
        // a step above 1 to land on: a scale of ∞ taken as it is would go there
        const adaptive = new AdaptiveResolution(display, {maxScale: 1.5});

        expect(adaptive.scale, 'the step it takes over at').toBe(1);
        expect(display.resolutionScale, 'the scale of the display').toBe(1);

        adaptive.enabled = false;
        expect(display.resolutionScale, 'the scale it gives back').toBe(1);
      },
    );
  });

  describe('method', () => {
    it('is undefined until the first frame', () => {
      expect(new AdaptiveResolution(makeDisplay({timestamps: true}).display).method).toBeUndefined();
    });

    it('is set in the first frame, while the frames after the start settle', async () => {
      const measuring = makeDisplay({timestamps: true});
      const gpu = new AdaptiveResolution(measuring.display);
      await measuring.frame();

      expect(gpu.method, 'with timestamps').toBe('gpu-time');
      expect(measuring.renderer.resolveTimestampsAsync, 'a frame that settles measures nothing').not.toHaveBeenCalled();

      const pacing = makeDisplay();
      const adaptive = new AdaptiveResolution(pacing.display);
      await pacing.frame();

      expect(adaptive.method, 'without timestamps').toBe('frame-pacing');
    });

    it('stays undefined through the frames it holds still in', async () => {
      const zoomed = makeDisplay({timestamps: true});
      zoomed.display.pixelZoom = 2;
      const underZoom = new AdaptiveResolution(zoomed.display);
      await zoomed.frames(5);

      expect(underZoom.method, 'under a pixelZoom').toBeUndefined();

      const held = makeDisplay({timestamps: true});
      const disabled = new AdaptiveResolution(held.display);
      disabled.enabled = false;
      await held.frames(5);

      expect(disabled.method, 'disabled').toBeUndefined();
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

    it('predicts a step up from the pixel ratio the display would draw at', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true, resolutionScale: 0.75, ...BUDGET_4K});
      // the next step, 0.875, draws at 0.5: 8 ms × (0.5 / 0.375)² is 14.2 ms, above 90 % of 13.3 ms
      gpu.ms = 8;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 12 * 6);

      expect(adaptive.scale).toBe(0.75);
    });

    it('skips a step down that leaves the pixel ratio as it is', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true, ...BUDGET_4K});
      gpu.ms = 15;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 12);

      expect(adaptive.scale).toBe(0.75);
      expect(display.pixelRatioAt(display.resolutionScale)).toBe(0.375);
    });

    it('holds a maxScale above 1 to the budget of the display', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true, ...BUDGET_4K});
      gpu.ms = 1;
      const adaptive = new AdaptiveResolution(display, {maxScale: 1.5});

      expect(display.pixelRatioAt(adaptive.scale)).toBe(0.5);
      await frames((SETTLE + 12 * 3) * 4);
      expect(display.pixelRatioAt(adaptive.scale), 'after windows with room to spare').toBe(0.5);
      expect(display.pixelRatioAt(adaptive.maxScale), 'at maxScale').toBe(0.5);
    });

    it('goes up to the highest scale of the next pixel ratio', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true, resolutionScale: 0.5, ...BUDGET_4K});
      gpu.ms = 1;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 12 * 3);
      expect(adaptive.scale, '0.625 and 0.75 both draw at 0.375').toBe(0.75);

      await frames(SETTLE + 12 * 3);
      expect(adaptive.scale, '0.875 and 1 both draw at 0.5').toBe(1);
    });

    it('waits twice as many windows for the next step up after one that did not hold', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true, resolutionScale: 0.875});
      // 6 ms × (1 / 0.875)² is 7.8 ms, below 90 % of 13.3 ms; the step up costs 14 ms all the same
      gpu.msAt = (ratio) => (ratio <= 0.875 ? 6 : 14);
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 12 * 3);
      expect(adaptive.scale, 'the step up').toBe(1);

      await frames(SETTLE + 12);
      expect(adaptive.scale, 'the step that did not hold').toBe(0.875);

      await frames(SETTLE + 12 * 3);
      expect(adaptive.scale, 'three good windows').toBe(0.875);
      await frames(12 * 2);
      expect(adaptive.scale, 'five good windows').toBe(0.875);
      await frames(12);
      expect(adaptive.scale, 'the sixth').toBe(1);
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
      await frames(2, {deltaMs: 40});
      expect(adaptive.scale).toBe(1);

      await frames(1, {deltaMs: 40});
      expect(adaptive.scale).toBe(0.875);
    });

    it('takes no pace from a frame of a paused display', async () => {
      const {display, frames} = makeDisplay();
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 27);
      Object.assign(display, {isRunning: false});
      await frames(5, {deltaMs: 0, fromLoop: false});
      Object.assign(display, {isRunning: true});
      await frames(3, {deltaMs: 40});

      // three late frames of 30
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
      await frames(30, {deltaMs: 40});
      expect(adaptive.scale, 'the failed try').toBe(0.75);

      await frames(SETTLE + 359);
      expect(adaptive.scale, 'not yet').toBe(0.75);
      await frames(1);
      expect(adaptive.scale, 'the next try').toBe(0.875);
    });

    it('tells the frames maxFps holds back from late ones by the animation frames of the page', async () => {
      const {display, frame} = makeDisplay();
      const adaptive = new AdaptiveResolution(display, {targetFps: 50});
      // maxFps 50 on 60 Hz: every fifth frame comes after two animation frames, none of them late
      for (let i = 0; i < SETTLE + 300; i++) {
        await frame({deltaMs: i % 5 === 0 ? 2 * FRAME_MS : FRAME_MS, rafMs: FRAME_MS});
      }

      expect(adaptive.scale).toBe(1);
    });

    it('measures against the pace the page reaches where fewer pixels bring the frames no sooner', async () => {
      const {display, frame, frames, measured} = makeDisplay();
      const adaptive = new AdaptiveResolution(display);
      // a requestAnimationFrame held to 30 Hz, whatever the scale
      const {lowest, back, framesBelow} = await descendAndReturn(adaptive, frame, 2 * FRAME_MS);
      expect(lowest, 'the lowest scale it tried').toBe(0.5);
      expect(back, 'back where it began').toBe(true);
      // four steps of 60 frames each: 30 that settle, and a window of 30
      expect(framesBelow, 'the frames at a lower resolution').toBe(240);

      const resizes = measured.resizes;
      await frames(600, {deltaMs: 2 * FRAME_MS});

      expect(adaptive.scale).toBe(1);
      // the resize of the return itself comes with the frame after it
      expect(measured.resizes, 'no resize since the return').toBe(resizes + 1);
    });

    it('keeps going down where fewer pixels bring the frames sooner', async () => {
      const {display, frame} = makeDisplay();
      const adaptive = new AdaptiveResolution(display);
      let arrived = false;
      let highestAfter = 0;
      for (let i = 0; i < 1500; i++) {
        const ms = display.pixelRatioAt(display.resolutionScale) >= 0.75 ? 2 * FRAME_MS : FRAME_MS;
        await frame({deltaMs: ms});
        if (adaptive.scale === 0.625) arrived = true;
        if (arrived) highestAfter = Math.max(highestAfter, adaptive.scale);
      }

      expect(arrived, 'down at 0.625').toBe(true);
      expect(highestAfter, 'a try up may visit 0.75').toBeLessThanOrEqual(0.75);
      expect(adaptive.scale).toBeLessThan(1);
    });

    it('measures against the target again once the frames come sooner', async () => {
      const {display, frame, frames} = makeDisplay();
      const adaptive = new AdaptiveResolution(display);
      const {back} = await descendAndReturn(adaptive, frame, 2 * FRAME_MS);
      expect(back, 'back where it began').toBe(true);
      // the return is a resize
      await frames(SETTLE, {deltaMs: 2 * FRAME_MS});

      await frames(30 * 4, {deltaMs: FRAME_MS});
      await frames(29, {deltaMs: 2 * FRAME_MS});
      expect(adaptive.scale).toBe(1);

      await frames(1, {deltaMs: 2 * FRAME_MS});
      expect(adaptive.scale, 'the first late window').toBe(0.875);
    });

    it('reads the pace of a frame the frame loop did not run from its rawDeltaTime', async () => {
      const {display, frames} = makeDisplay();
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 27, {fromLoop: false});
      await frames(2, {deltaMs: 40, fromLoop: false});
      expect(adaptive.scale).toBe(1);

      await frames(1, {deltaMs: 40, fromLoop: false});
      expect(adaptive.scale).toBe(0.875);
    });

    it('reads the pace of a renderFrame() of its own right after a settle from its rawDeltaTime', async () => {
      const {display, frame, frames} = makeDisplay();
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 30);
      emit(display, OnDisplayRestart, {});
      await frames(SETTLE - 1);
      // the last frame of the settle: late, and it counts for nothing
      await frame({deltaMs: 40, rafMs: 40});
      // the first frame judged: a renderFrame() of one's own, on time
      await frame({fromLoop: false});
      await frames(27);
      await frames(2, {deltaMs: 40});

      expect(adaptive.scale, 'two late frames of 30').toBe(1);
    });

    it('measures the frame interval against a lower targetFps', async () => {
      const {display, frames} = makeDisplay();
      const adaptive = new AdaptiveResolution(display, {targetFps: 30});
      // 40 ms lies below 1.5 × 33.3 ms
      await frames(SETTLE + 60, {deltaMs: 40});

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

    it('drops a measurement in flight when it is disabled', async () => {
      const {display, gpu, frame, frames} = makeDisplay({timestamps: true});
      gpu.ms = 15;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 11);
      gpu.manual = true;
      await frame();

      adaptive.enabled = false;
      gpu.resolveNext(15);
      await Promise.resolve();
      await Promise.resolve();

      expect(display.resolutionScale, 'the scale from before the takeover').toBe(1);
      expect(adaptive.gpuTime).toBeUndefined();
    });

    it('drops a measurement in flight when the display goes over to a pixelZoom', async () => {
      const {display, gpu, frame, frames} = makeDisplay({timestamps: true});
      gpu.ms = 15;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 11);
      gpu.manual = true;
      await frame();

      display.pixelZoom = 2;
      gpu.resolveNext(15);
      await Promise.resolve();
      await Promise.resolve();

      expect(adaptive.gpuTime, 'no window judged').toBeUndefined();
      expect(display.resolutionScale).toBe(1);
    });

    it('gives back the scale the display had when it took over last', () => {
      const {display} = makeDisplay();
      const adaptive = new AdaptiveResolution(display);

      adaptive.enabled = false;
      display.resolutionScale = 0.6;
      adaptive.enabled = true;
      expect(display.resolutionScale, 'the takeover').toBe(0.5);

      adaptive.enabled = false;
      expect(display.resolutionScale, 'set by hand').toBe(0.6);

      const untouched = makeDisplay({resolutionScale: 0.9});
      const other = new AdaptiveResolution(untouched.display);
      other.enabled = false;
      other.enabled = true;
      other.enabled = false;
      expect(untouched.display.resolutionScale, 'off, on and off again').toBe(0.9);
    });

    it('a takeover counts the good windows of gpu-time toward a step up from 0', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true, resolutionScale: 0.75});
      gpu.ms = 1;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 2 * 12);
      expect(adaptive.scale, 'two good windows are no step up yet').toBe(0.75);

      adaptive.enabled = false;
      adaptive.enabled = true;
      await frames(SETTLE + 12);
      expect(adaptive.scale, 'the first good window of the new takeover').toBe(0.75);

      await frames(2 * 12);
      expect(adaptive.scale, 'the third good window of the new takeover').toBe(0.875);
    });

    it('a takeover counts the clean frames of frame-pacing toward a try up from 0', async () => {
      const {display, frames} = makeDisplay({resolutionScale: 0.75});
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 150);
      expect(adaptive.scale, 'five clean windows are no try up yet').toBe(0.75);

      adaptive.enabled = false;
      adaptive.enabled = true;
      await frames(SETTLE + 30);
      expect(adaptive.scale, 'the first clean window of the new takeover').toBe(0.75);

      await frames(150);
      expect(adaptive.scale, 'the 180 clean frames of the new takeover').toBe(0.875);
    });

    it('a takeover ends a try up of frame-pacing that is still being judged', async () => {
      const {display, frames} = makeDisplay({resolutionScale: 0.75});
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 180);
      expect(adaptive.scale, 'the try up runs, two windows to judge it are open').toBe(0.875);

      adaptive.enabled = false;
      expect(display.resolutionScale).toBe(0.75);
      adaptive.enabled = true;
      expect(display.resolutionScale).toBe(0.75);
      await frames(SETTLE + 180);
      expect(adaptive.scale, 'the new takeover counts its own 180 clean frames').toBe(0.875);
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
      // a display says it is disposed before it emits the event
      (display as {isDisposed: boolean}).isDisposed = true;
      emit(display, OnDisplayDispose, display);
      await frames(SETTLE + 24);

      expect(renderer.resolveTimestampsAsync).not.toHaveBeenCalled();
      adaptive.enabled = false;
      expect(adaptive.enabled, 'a disposed controller stays as it is').toBe(true);
      expect(adaptive.isDisposed).toBe(true);
    });

    it('refuses a display that is disposed, and leaves its scale and its listeners as they are', () => {
      const {display} = makeDisplay({resolutionScale: 0.8});
      (display as {isDisposed: boolean}).isDisposed = true;

      expect(() => new AdaptiveResolution(display)).toThrow(
        'AdaptiveResolution: the display handed to the constructor has been disposed',
      );
      expect(display.resolutionScale, 'the scale of the display').toBe(0.8);
      expect(getSubscriptionCount(display), 'the listeners on the display').toBe(0);
    });

    it('refuses a second controller on a display another one holds, enabled or not', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true});
      gpu.ms = 15;
      const first = new AdaptiveResolution(display);
      const listeners = getSubscriptionCount(display);

      expect(() => new AdaptiveResolution(display), 'beside one enabled').toThrow('is held by another controller');
      first.enabled = false;
      display.resolutionScale = 0.6;
      expect(() => new AdaptiveResolution(display), 'beside one disabled').toThrow('is held by another controller');
      expect(display.resolutionScale, 'the scale a refused one leaves').toBe(0.6);
      expect(getSubscriptionCount(display), 'the listeners a refused one leaves').toBe(listeners);

      // the first goes on as it would alone
      display.resolutionScale = 1;
      first.enabled = true;
      await frames(SETTLE + 12);
      expect(display.resolutionScale).toBe(0.875);
    });

    it('takes a display whose controller has been disposed', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true});
      gpu.ms = 15;
      const first = new AdaptiveResolution(display);
      first.dispose();

      const second = new AdaptiveResolution(display);
      await frames(SETTLE + 12);

      expect(second.scale, 'the second').toBe(0.875);
      expect(display.resolutionScale).toBe(0.875);
      expect(first.scale, 'the first, as it left the display').toBe(1);
    });

    it('answers isDisposed: false until dispose(), and true after it and once the display is disposed', () => {
      const adaptive = new AdaptiveResolution(makeDisplay().display);
      expect(adaptive.isDisposed, 'before dispose()').toBe(false);
      adaptive.dispose();
      expect(adaptive.isDisposed, 'after dispose()').toBe(true);

      const {display} = makeDisplay();
      const other = new AdaptiveResolution(display);
      (display as {isDisposed: boolean}).isDisposed = true;
      emit(display, OnDisplayDispose, display);
      expect(other.isDisposed, 'once the display is disposed').toBe(true);
    });

    it('answers undefined for method and gpuTime after dispose(), and keeps the scale it set last', async () => {
      const {display, gpu, frames} = makeDisplay({timestamps: true});
      gpu.ms = 15;
      const adaptive = new AdaptiveResolution(display);
      await frames(SETTLE + 12);
      expect([adaptive.scale, adaptive.gpuTime, adaptive.method], 'before dispose()').toEqual([0.875, 15, 'gpu-time']);

      adaptive.dispose();

      expect(adaptive.method, 'method').toBeUndefined();
      expect(adaptive.gpuTime, 'gpuTime').toBeUndefined();
      expect(adaptive.scale, 'scale').toBe(0.875);
    });
  });
});
