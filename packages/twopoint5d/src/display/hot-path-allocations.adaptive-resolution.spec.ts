import {eventize, type UnsubscribeFunc} from '@spearwolf/eventize';
import {describe, expect, test, vi} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import {AdaptiveResolution} from './AdaptiveResolution.js';
import type {Display} from './Display.js';
import type {DisplayEventProps} from './types.js';

// The listener of OnDisplayRenderFrame the controller subscribes, caught as it subscribes: a round
// calls it directly, because emit() builds an array for the arguments of every event. The mock
// lives in a file of its own so that it touches no other measurement
const frameListeners = vi.hoisted(() => [] as ((props: DisplayEventProps) => void)[]);
vi.mock('@spearwolf/eventize', async (importOriginal) => {
  const original = await importOriginal<typeof import('@spearwolf/eventize')>();
  const {OnDisplayRenderFrame} = await import('../events.js');
  return {
    ...original,
    on: (...args: unknown[]) => {
      // the controller subscribes as on(display, OnDisplayRenderFrame, priority, listener)
      if (args[1] === OnDisplayRenderFrame) frameListeners.push(args.at(-1) as (props: DisplayEventProps) => void);
      return (original.on as (...args: unknown[]) => UnsubscribeFunc)(...args);
    },
  };
});

// a call that allocates anything costs 16 B at least; the allocation-free paths below
// measure a small fraction of a byte per call, the noise of a round spread over its calls
const BYTES_PER_CALL_LIMIT = 1;
const CALLS = 1000;

// a whole number: a round hands its calls no fraction it works out (AGENTS.md)
const GPU_MS = 10;
// answers synchronously, so the measurement and the window it fills fall inside the round; the
// controller only calls then() on what resolveTimestampsAsync() answers
// biome-ignore lint/suspicious/noThenProperty: a stand-in for the promise resolveTimestampsAsync() answers
const measurement = {then: (onFulfilled: (ms: number) => void) => onFulfilled(GPU_MS)};

/**
 * A controller on a display double that answers what the controller reads in a frame, and a
 * round of frames of the frame loop: every frame a new one, at the pace of 60 frames per second.
 */
const makeRound = (timestamps: boolean) => {
  const frameLoop = {frameNo: 0, longestRafInterval: 1000 / 60};
  const display = eventize({
    renderer: {
      backend: {trackTimestamp: timestamps, hasTimestamp: timestamps},
      resolveTimestampsAsync: () => measurement,
    },
    resolutionScale: 1,
    pixelZoom: 0,
    isDisposed: false,
    isRunning: true,
    frameLoop,
    pixelRatioAt: () => 1,
  }) as unknown as Display;
  const adaptive = new AdaptiveResolution(display);
  expect(frameListeners.at(-1), 'the listener of the frame').toBeTypeOf('function');
  const onFrame = frameListeners.at(-1)!;
  const props = {rawDeltaTime: 1 / 60} as DisplayEventProps;
  const round = () => {
    for (let i = 0; i < CALLS; i++) {
      frameLoop.frameNo += 1;
      onFrame(props);
    }
  };
  return {adaptive, round};
};

describe('AdaptiveResolution on the hot path', () => {
  test('a frame under gpu-time allocates nothing, the frames that judge a window included', async () => {
    const {adaptive, round} = makeRound(true);

    const bytesPerCall = (await measureSettledBytes(round)) / CALLS;

    expect(adaptive.method).toBe('gpu-time');
    expect(adaptive.gpuTime, 'a window was judged').toBe(GPU_MS);
    // 10 ms lie below the budget of 13.3 ms, and nothing goes beyond maxScale
    expect(adaptive.scale).toBe(1);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    adaptive.dispose();
  });

  test('a frame under frame-pacing allocates nothing, the frames that judge a window included', async () => {
    const {adaptive, round} = makeRound(false);

    const bytesPerCall = (await measureSettledBytes(round)) / CALLS;

    expect(adaptive.method).toBe('frame-pacing');
    // clean frames: the tries up find no step beyond maxScale
    expect(adaptive.scale).toBe(1);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    adaptive.dispose();
  });
});
