import type {WebGPURenderer} from 'three/webgpu';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import {Display} from './Display.js';

// Stylesheets writes into a real CSSStyleSheet, and there is no document here to hold one
vi.mock('./Stylesheets.js', () => ({
  Stylesheets: {addRule: () => 'twopoint5d-canvas', installRule: () => 'twopoint5d-canvas--fullscreen'},
}));

// a call that allocates anything costs 16 B at least; the allocation-free paths below
// measure a small fraction of a byte per call, the noise of a round spread over its calls
const BYTES_PER_CALL_LIMIT = 1;
const CALLS = 1000;

// the size the resizeTo callback answers, built once: a 4K screen in CSS pixels
const SIZE: [number, number] = [3840, 2160];

// The measurement of resize() is the one a frame on the poll path runs — a resizeTo callback and
// no resizePollIntervalMs. renderFrame() is not measured: it builds the props of every event it
// emits anew, on purpose (getEventProps())
describe('Display on the hot path', () => {
  let display: Display;
  let view: {devicePixelRatio: number; performance: Performance};

  beforeEach(() => {
    // the DOM stubs of Display.spec.ts, without spies on the path a round runs through: a spy
    // records every call, and that allocates
    view = {devicePixelRatio: 2, performance};
    vi.stubGlobal('window', view);
    vi.stubGlobal('document', {hidden: false, head: {}, addEventListener() {}, removeEventListener() {}});
    const computedStyle = {getPropertyValue: (name: string) => (name === 'box-sizing' ? 'border-box' : '')};
    vi.stubGlobal('getComputedStyle', () => computedStyle);

    const canvas = {
      classList: {add() {}, remove() {}},
      style: {},
      setAttribute() {},
      hasAttribute: () => false,
      getAttribute: () => null,
      getBoundingClientRect: () => ({width: 320, height: 200}),
    };
    const renderer = {
      isWebGPURenderer: true,
      domElement: canvas,
      init: () => Promise.resolve(),
      setDrawingBufferSize() {},
      setAnimationLoop() {},
      getAnimationLoop: () => null,
      dispose() {},
    };
    display = new Display(renderer as unknown as WebGPURenderer, {resizeTo: () => SIZE});
  });

  afterEach(() => {
    display.dispose();
    // the config restores spies, not globals
    vi.unstubAllGlobals();
  });

  const bytesPerResize = async () => {
    // applies a change of the setup, so the round measures the size as it stays
    display.resize();

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) display.resize();
    });
    return bytesPerRound / CALLS;
  };

  test('resize() at an unchanged size allocates nothing per call', async () => {
    const bytesPerCall = await bytesPerResize();

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('resize() on a budget of pixels and a resolution scale allocates nothing per call', async () => {
    display.maxPixels = 3_000_000;
    display.resolutionScale = 0.75;
    const bytesPerCall = await bytesPerResize();

    expect(display.pixelRatio, 'a ratio stepped by the budget and the scale').toBe(0.375);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('resize() under a pixelZoom allocates nothing per call', async () => {
    display.pixelZoom = 2;
    const bytesPerCall = await bytesPerResize();

    expect(display.devicePixelZoom).toBe(4);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('resize() beyond MaxResolution allocates nothing per call', async () => {
    // 3840 × 2 device pixels, at the bound of 2, lie within 8192; at a ratio of 3 they do not
    display.maxPixelRatio = 3;
    view.devicePixelRatio = 3;
    // the warning about MaxResolution goes out once per module instance and is not what this
    // case looks at
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bytesPerCall = await bytesPerResize();

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });
});
