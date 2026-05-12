import {describe, expect, it} from 'vitest';
import {FrameLoop} from './FrameLoop.js';

interface FrameProps {
  now: number;
  lastNow: number;
  frameNo: number;
  deltaTime: number;
  measuredFps: number;
}

/** Renderer stub that captures the rAF callback so the test can drive it. */
function makeFakeRenderer() {
  return {
    callback: null as ((now: number) => unknown) | null,
    setAnimationLoop(cb: ((now: number) => unknown) | null) {
      this.callback = cb;
    },
    tick(now: number) {
      this.callback!(now);
    },
  };
}

function subscribe(loop: FrameLoop) {
  const events: FrameProps[] = [];
  const target = {
    [FrameLoop.OnFrame](props: FrameProps) {
      events.push(props);
    },
  };
  loop.start(target);
  return {events, target};
}

describe('FrameLoop', () => {
  it('first emitted frame has deltaTime === 0, not NaN', () => {
    const renderer = makeFakeRenderer();
    const loop = new FrameLoop(0, renderer);
    const {events} = subscribe(loop);

    renderer.tick(1000);

    expect(events).toHaveLength(1);
    expect(Number.isNaN(events[0].deltaTime)).toBe(false);
    expect(events[0].deltaTime).toBe(0);
  });

  it('emits a single OnFrame per rAF tick with monotonically increasing frameNo', () => {
    const renderer = makeFakeRenderer();
    const loop = new FrameLoop(0, renderer);
    const {events} = subscribe(loop);

    renderer.tick(1000);
    renderer.tick(1016);
    renderer.tick(1032);

    expect(events.map((e) => e.frameNo)).toEqual([1, 2, 3]);
  });

  it('lastNow in emitted props reflects the previous frame timestamp (not the current one)', () => {
    const renderer = makeFakeRenderer();
    const loop = new FrameLoop(0, renderer);
    const {events} = subscribe(loop);

    renderer.tick(1000);
    renderer.tick(1016);

    // first frame: no previous timestamp — falls back to `now`
    expect(events[0].now).toBe(1);
    expect(events[0].lastNow).toBe(1);

    // second frame: lastNow is the first frame's now
    expect(events[1].now).toBeCloseTo(1.016);
    expect(events[1].lastNow).toBe(1);
    expect(events[1].deltaTime).toBeCloseTo(0.016);
  });

  it('measuredFps is 0 until the first measurement window completes', () => {
    const renderer = makeFakeRenderer();
    const loop = new FrameLoop(0, renderer);
    const {events} = subscribe(loop);

    // 10 frames is far short of MEASURE_FPS_AFTER_NTH_FRAME (= 30)
    for (let i = 0; i < 10; i++) {
      renderer.tick(1000 + i * 16);
    }

    for (const evt of events) {
      expect(evt.measuredFps).toBe(0);
    }
  });

  it('measuredFps produces a plausible value once the first window completes', () => {
    const renderer = makeFakeRenderer();
    const loop = new FrameLoop(0, renderer);
    const {events} = subscribe(loop);

    // 31 frames at exactly 60Hz: first sample arrives on frame 31.
    // The first frame anchors the window; frames 1..30 span 30 * 1000/60 ms.
    for (let i = 0; i < 31; i++) {
      renderer.tick(1000 + i * (1000 / 60));
    }

    expect(events).toHaveLength(31);
    expect(events[30].measuredFps).toBe(60);
  });

  it('maxFps throttles emissions to the target rate', () => {
    const renderer = makeFakeRenderer();
    const loop = new FrameLoop(30, renderer);
    const {events} = subscribe(loop);

    // 60Hz incoming stream; 30fps target (interval ≈ 33.33ms, tolerance ≈ 0.667ms)
    renderer.tick(0); //  emit (initial), nextEmitAt = 33.33
    renderer.tick(16); //  16  < 32.67 → throttled
    renderer.tick(33); //  33  ≥ 32.67 → emit, nextEmitAt = 66.67
    renderer.tick(50); //  50  < 66.00 → throttled
    renderer.tick(66); //  66  ≥ 66.00 → emit
    expect(events).toHaveLength(3);
  });

  it('maxFps grid stays stable across many frames (no drift)', () => {
    const renderer = makeFakeRenderer();
    const loop = new FrameLoop(60, renderer); // interval 16.67ms
    const {events} = subscribe(loop);

    // 240Hz stream → every 4th tick should emit
    const VSYNC = 1000 / 240;
    for (let i = 0; i < 41; i++) {
      renderer.tick(i * VSYNC);
    }

    // After 41 vsyncs at 240Hz: 41 * 4.17 ≈ 170.8ms
    // At 60fps target we expect ⌈170.8 / 16.67⌉ + 1 ≈ 11 emissions
    expect(events.length).toBeGreaterThanOrEqual(10);
    expect(events.length).toBeLessThanOrEqual(12);

    // The frame-to-frame deltas (in seconds) should cluster tightly around
    // the target interval; drift would show as a growing or shrinking spread.
    const targetDelta = 1 / 60; // seconds
    for (let i = 1; i < events.length; i++) {
      expect(events[i].deltaTime).toBeGreaterThan(targetDelta * 0.95);
      expect(events[i].deltaTime).toBeLessThan(targetDelta * 1.1);
    }
  });

  it('maxFps tolerates rAF ticks arriving slightly early (jitter tolerance)', () => {
    const renderer = makeFakeRenderer();
    const loop = new FrameLoop(60, renderer); // interval 16.67, tolerance ≈ 0.333
    const {events} = subscribe(loop);

    renderer.tick(0); //  emit, nextEmitAt = 16.67
    renderer.tick(16.5); //  16.5 ≥ 16.34 (within tolerance) → emit
    renderer.tick(33.0); //  33.0 ≥ 33.0 (16.67 + 16.67 - 0.33) → emit

    expect(events).toHaveLength(3);
  });

  it('after a long pause the schedule snaps forward — no catch-up burst', () => {
    const renderer = makeFakeRenderer();
    const loop = new FrameLoop(30, renderer); // interval 33.33
    const {events} = subscribe(loop);

    renderer.tick(0); //  emit
    renderer.tick(1000); //  1 second later (would be ~30 "missed" slots)
    expect(events).toHaveLength(2); //  exactly one extra emission, not 30

    // Schedule was snapped to now + interval. The next tick at 1001ms is too soon.
    renderer.tick(1001);
    expect(events).toHaveLength(2);

    // A tick around 1033ms (one interval after the snap) should emit again.
    renderer.tick(1034);
    expect(events).toHaveLength(3);
  });

  it('setFps() resets the schedule mid-loop', () => {
    const renderer = makeFakeRenderer();
    const loop = new FrameLoop(30, renderer);
    const {events} = subscribe(loop);

    renderer.tick(0);
    renderer.tick(33);
    expect(events).toHaveLength(2);

    loop.setFps(120); // interval 8.33ms; schedule reset
    renderer.tick(40); //  first emission after setFps, nextEmitAt = 48.33
    renderer.tick(45); //  too soon
    renderer.tick(49); //  emit (>= 48.0)

    expect(events).toHaveLength(4);
  });

  it('subscriptionCount tracks start()/stop() idempotently', () => {
    const renderer = makeFakeRenderer();
    const loop = new FrameLoop(0, renderer);

    const a = {[FrameLoop.OnFrame]() {}};
    const b = {[FrameLoop.OnFrame]() {}};

    expect(loop.subscriptionCount).toBe(0);

    loop.start(a);
    expect(loop.subscriptionCount).toBe(1);

    loop.start(a);
    expect(loop.subscriptionCount).toBe(1);

    loop.start(b);
    expect(loop.subscriptionCount).toBe(2);

    loop.stop(a);
    expect(loop.subscriptionCount).toBe(1);

    loop.stop(a);
    expect(loop.subscriptionCount).toBe(1);

    loop.stop(b);
    expect(loop.subscriptionCount).toBe(0);
  });

  it('start() returns an unsubscribe function', () => {
    const renderer = makeFakeRenderer();
    const loop = new FrameLoop(0, renderer);

    const target = {[FrameLoop.OnFrame]() {}};
    const unsubscribe = loop.start(target);

    expect(loop.subscriptionCount).toBe(1);
    expect(typeof unsubscribe).toBe('function');

    unsubscribe!();

    expect(loop.subscriptionCount).toBe(0);
  });

  it('clear() removes all subscribers', () => {
    const renderer = makeFakeRenderer();
    const loop = new FrameLoop(0, renderer);

    loop.start({[FrameLoop.OnFrame]() {}});
    loop.start({[FrameLoop.OnFrame]() {}});
    expect(loop.subscriptionCount).toBe(2);

    loop.clear();

    expect(loop.subscriptionCount).toBe(0);
  });
});
