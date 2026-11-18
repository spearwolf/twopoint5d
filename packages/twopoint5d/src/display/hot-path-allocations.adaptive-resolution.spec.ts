import type {UnsubscribeFunc} from '@spearwolf/eventize';
import {describe, expect, test, vi} from 'vitest';

import {CALLS, GPU_MS, makeAdaptiveResolutionRound, noMeasurement} from '../testing/adaptiveResolutionRound.js';
import {measureSettledBytes} from '../testing/measureSettledBytes.js';
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

describe('AdaptiveResolution on the hot path', () => {
  test('a frame under gpu-time allocates nothing, the frames that judge a window included', async () => {
    const {adaptive, round} = makeAdaptiveResolutionRound(frameListeners, true);

    const bytesPerCall = (await measureSettledBytes(round)) / CALLS;

    expect(adaptive.method).toBe('gpu-time');
    expect(adaptive.gpuTime, 'a window was judged').toBe(GPU_MS);
    // 10 ms lie below the budget of 13.3 ms, and nothing goes beyond maxScale
    expect(adaptive.scale).toBe(1);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    adaptive.dispose();
  });

  test('a frame under frame-pacing allocates nothing, the frames that judge a window included', async () => {
    const {adaptive, round} = makeAdaptiveResolutionRound(frameListeners, false);

    const bytesPerCall = (await measureSettledBytes(round)) / CALLS;

    expect(adaptive.method).toBe('frame-pacing');
    // clean frames: the tries up find no step beyond maxScale
    expect(adaptive.scale).toBe(1);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    adaptive.dispose();
  });

  test('a frame under frame-pacing that still asks for GPU time allocates nothing', async () => {
    const {adaptive, round} = makeAdaptiveResolutionRound(frameListeners, true, noMeasurement);
    // the frames that settle, and the 60 without a measurement after which the controller goes
    // over to frame-pacing, and asks on for the GPU time from then on
    round();
    expect(adaptive.method, 'before the round').toBe('frame-pacing');

    const bytesPerCall = (await measureSettledBytes(round)) / CALLS;

    expect(adaptive.method).toBe('frame-pacing');
    expect(adaptive.scale).toBe(1);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    adaptive.dispose();
  });
});
