import {emit, eventize} from '@spearwolf/eventize';
import {beforeEach, describe, expect, it} from 'vitest';
import {OnDisplayDispose, OnDisplayRenderFrame} from '../events.js';
import {FixedFrameLoop, type FixedFrameLoopRenderProps, type FixedFrameLoopTickProps} from './FixedFrameLoop.js';
import type {Display} from './Display.js';
import type {DisplayEventProps} from './types.js';

function makeFakeDisplay(): Display {
  return eventize({}) as unknown as Display;
}

function makeFrame(deltaTime: number, extra?: Partial<DisplayEventProps>): DisplayEventProps {
  return {
    width: 100,
    height: 100,
    pixelRatio: 1,
    now: 0,
    deltaTime,
    frameNo: 1,
    display: null as unknown as Display,
    renderer: null as unknown as DisplayEventProps['renderer'],
    ...extra,
  };
}

describe('FixedFrameLoop', () => {
  let display: Display;
  let sim: FixedFrameLoop;
  let ticks: FixedFrameLoopTickProps[];
  let renders: FixedFrameLoopRenderProps[];

  beforeEach(() => {
    display = makeFakeDisplay();
    sim = new FixedFrameLoop(display, {fps: 60});
    ticks = [];
    renders = [];
    sim.onTick((p) => ticks.push(p));
    sim.onRender((p) => renders.push(p));
  });

  it('emits exactly one sim tick when deltaTime equals fixedDelta', () => {
    emit(display, OnDisplayRenderFrame, makeFrame(1 / 60));

    expect(ticks).toHaveLength(1);
    expect(ticks[0].tickNo).toBe(0);
    expect(ticks[0].tickTime).toBe(0);
    expect(ticks[0].fixedDelta).toBeCloseTo(1 / 60);

    expect(renders).toHaveLength(1);
    expect(renders[0].alpha).toBeCloseTo(0);
    expect(renders[0].tickTime).toBeCloseTo(1 / 60);
    expect(renders[0].tickNo).toBe(1);
  });

  it('emits no sim ticks when render frames are faster than the sim rate', () => {
    // 240Hz render frame vs 60Hz sim — accumulator below threshold
    emit(display, OnDisplayRenderFrame, makeFrame(1 / 240));

    expect(ticks).toHaveLength(0);
    expect(renders).toHaveLength(1);
    expect(renders[0].alpha).toBeCloseTo(0.25, 2);
  });

  it('accumulator drains over multiple short frames and produces one tick', () => {
    for (let i = 0; i < 4; i++) {
      emit(display, OnDisplayRenderFrame, makeFrame(1 / 240));
    }
    expect(ticks).toHaveLength(1);
    expect(renders).toHaveLength(4);
    // After the tick, alpha drops back near zero
    expect(renders[3].alpha).toBeLessThan(0.1);
  });

  it('alpha increases monotonically across render frames between sim ticks', () => {
    emit(display, OnDisplayRenderFrame, makeFrame(1 / 240));
    emit(display, OnDisplayRenderFrame, makeFrame(1 / 240));
    emit(display, OnDisplayRenderFrame, makeFrame(1 / 240));

    expect(renders[0].alpha).toBeLessThan(renders[1].alpha);
    expect(renders[1].alpha).toBeLessThan(renders[2].alpha);
    expect(renders[2].alpha).toBeLessThan(1);
  });

  it('emits multiple sim ticks when deltaTime is larger than fixedDelta', () => {
    // 50ms ≈ 3 * (1/60) + leftover
    emit(display, OnDisplayRenderFrame, makeFrame(0.05));

    expect(ticks).toHaveLength(3);
    expect(ticks.map((t) => t.tickNo)).toEqual([0, 1, 2]);
    expect(renders[0].tickNo).toBe(3);
    expect(renders[0].alpha).toBeGreaterThan(0);
    expect(renders[0].alpha).toBeLessThan(1);
  });

  it('spiral-of-death guard caps ticks per frame and discards the backlog', () => {
    sim.maxStepsPerFrame = 3;

    emit(display, OnDisplayRenderFrame, makeFrame(1.0)); // huge backlog

    expect(ticks).toHaveLength(3);
    expect(sim.tickTime).toBeCloseTo(3 / 60);

    // Next normal frame: accumulator was discarded, no immediate catch-up
    emit(display, OnDisplayRenderFrame, makeFrame(1 / 240));
    expect(ticks).toHaveLength(3);
  });

  it('forwards the original Display event props on OnRender', () => {
    emit(
      display,
      OnDisplayRenderFrame,
      makeFrame(1 / 60, {width: 1920, height: 1080, pixelRatio: 2, frameNo: 42, now: 123.45}),
    );

    expect(renders[0].width).toBe(1920);
    expect(renders[0].height).toBe(1080);
    expect(renders[0].pixelRatio).toBe(2);
    expect(renders[0].frameNo).toBe(42);
    expect(renders[0].now).toBe(123.45);
  });

  it('fps can be updated at runtime', () => {
    sim.fps = 120;
    expect(sim.fixedDelta).toBeCloseTo(1 / 120);

    emit(display, OnDisplayRenderFrame, makeFrame(1 / 120));
    expect(ticks).toHaveLength(1);
  });

  it('fps setter ignores non-positive and non-finite values', () => {
    sim.fps = -10;
    expect(sim.fps).toBe(60);
    sim.fps = 0;
    expect(sim.fps).toBe(60);
    sim.fps = NaN;
    expect(sim.fps).toBe(60);
    sim.fps = Infinity;
    expect(sim.fps).toBe(60);
  });

  it('reset() clears accumulator, tickTime, tickNo and alpha', () => {
    emit(display, OnDisplayRenderFrame, makeFrame(0.05));
    expect(sim.tickNo).toBe(3);
    expect(sim.tickTime).toBeGreaterThan(0);

    sim.reset();

    expect(sim.tickNo).toBe(0);
    expect(sim.tickTime).toBe(0);
    expect(sim.alpha).toBe(0);
  });

  it('dispose() unsubscribes from Display and ignores further frames', () => {
    sim.dispose();

    emit(display, OnDisplayRenderFrame, makeFrame(1 / 60));

    expect(ticks).toHaveLength(0);
    expect(renders).toHaveLength(0);
    expect(sim.isDisposed).toBe(true);
  });

  it('dispose() is idempotent', () => {
    sim.dispose();
    expect(() => sim.dispose()).not.toThrow();
    expect(sim.isDisposed).toBe(true);
  });

  it('disposes itself when Display fires OnDisplayDispose', () => {
    emit(display, OnDisplayDispose, display);
    expect(sim.isDisposed).toBe(true);
  });
});
