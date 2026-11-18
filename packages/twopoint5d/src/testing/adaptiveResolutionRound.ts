import {eventize} from '@spearwolf/eventize';
import {expect} from 'vitest';

import {AdaptiveResolution} from '../display/AdaptiveResolution.js';
import type {Display} from '../display/Display.js';
import type {DisplayEventProps} from '../display/types.js';

export const CALLS = 1000;

// a whole number: a round hands its calls no fraction it works out (AGENTS.md)
export const GPU_MS = 10;
// answers synchronously, so the measurement and the window it fills fall inside the round; the
// controller only calls then() on what resolveTimestampsAsync() answers
// biome-ignore lint/suspicious/noThenProperty: a stand-in for the promise resolveTimestampsAsync() answers
export const measurement = {then: (onFulfilled: (ms: number) => void) => onFulfilled(GPU_MS)};
// a renderer that measures nothing: three resolves no time for a frame that drew nothing
// biome-ignore lint/suspicious/noThenProperty: a stand-in for the promise resolveTimestampsAsync() answers
export const noMeasurement = {then: (onFulfilled: (ms: number | undefined) => void) => onFulfilled(undefined)};

/**
 * A controller on a display double that answers what the controller reads in a frame, and a
 * round of {@link CALLS} frames of the frame loop: every frame a new one, at the pace of 60 frames
 * per second.
 *
 * The spec catches the listener of `OnDisplayRenderFrame` through a `vi.mock` of
 * `@spearwolf/eventize` of its own, which pushes it onto `frameListeners`; the round calls the
 * last of them directly.
 */
export const makeAdaptiveResolutionRound = (
  frameListeners: readonly ((props: DisplayEventProps) => void)[],
  timestamps: boolean,
  answer: typeof measurement | typeof noMeasurement = measurement,
) => {
  const frameLoop = {frameNo: 0, longestRafInterval: 1000 / 60};
  const display = eventize({
    renderer: {
      backend: {trackTimestamp: timestamps, hasTimestamp: timestamps},
      resolveTimestampsAsync: () => answer,
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
