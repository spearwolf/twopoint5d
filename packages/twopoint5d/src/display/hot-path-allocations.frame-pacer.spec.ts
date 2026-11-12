import {describe, expect, test} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import {FramePacer, type FrameStep, type Motion} from './FramePacer.js';
import type {DisplayEventProps} from './types.js';

// a call that allocates anything costs 16 B at least; the allocation-free paths below
// measure a small fraction of a byte per call, the noise of a round spread over its calls
const BYTES_PER_CALL_LIMIT = 1;
const CALLS = 1000;

// the props of a frame at 60 Hz, built once: a round hands its calls no fraction it works out
// (AGENTS.md), and the pacer reads the two deltas alone
const FRAME = {rawDeltaTime: 1 / 60, deltaTime: 1 / 60} as DisplayEventProps;

const ROOM = {name: 'room'};

/** A pacer on a source that keeps the frame listener, so that a round calls it as a display does. */
const makePacer = () => {
  let runSteps: (frame: DisplayEventProps) => unknown = () => {};
  const pacer = new FramePacer(
    {
      onRenderFrame: (listener) => {
        runSteps = listener;
        return () => {};
      },
    },
    {live: (stage) => stage === ROOM},
  );
  return {pacer, runSteps: (frame: DisplayEventProps) => runSteps(frame)};
};

const bytesPerCall = async (round: () => void) => (await measureSettledBytes(round)) / CALLS;

describe('FramePacer on the hot path', () => {
  test('shouldDraw() of a frame without a report allocates nothing', async () => {
    const {pacer} = makePacer();

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) pacer.shouldDraw(FRAME);
    });

    expect(pacer.draws, 'only the first frame drew').toBe(1);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('shouldDraw() under a steady report allocates nothing, the frames that draw included', async () => {
    const {pacer} = makePacer();

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        pacer.report('steady');
        pacer.shouldDraw(FRAME);
      }
    });

    // every 2. frame at 60 Hz
    expect(pacer.draws / pacer.frames).toBeCloseTo(0.5, 2);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('shouldDraw() of a busy frame allocates nothing', async () => {
    const {pacer} = makePacer();

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) pacer.shouldDraw(FRAME, true);
    });

    expect(pacer.draws).toBe(pacer.frames);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test.each<[string, Motion]>([
    ['nothing', undefined],
    ['true', true],
    ['steady', 'steady'],
  ])('a frame of steps that answer %s allocates nothing', async (_what, motion) => {
    const {pacer, runSteps} = makePacer();
    let calls = 0;
    const step: FrameStep = () => {
      calls += 1;
      return motion;
    };
    // one step without a stage, one of a live stage, one of a stage that is not
    pacer.onFrame(step);
    pacer.onFrame(step, ROOM);
    pacer.onFrame(step, {name: 'behind the overlay'});

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        runSteps(FRAME);
        pacer.shouldDraw(FRAME);
      }
    });

    expect(calls, 'every step ran in every frame').toBe(pacer.frames * 3);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });
});
