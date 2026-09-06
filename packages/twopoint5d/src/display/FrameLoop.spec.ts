import {afterEach, describe, expect, it, vi} from 'vitest';
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
    expect(Number.isNaN(events[0]!.deltaTime)).toBe(false);
    expect(events[0]!.deltaTime).toBe(0);
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
    expect(events[0]!.now).toBe(1);
    expect(events[0]!.lastNow).toBe(1);

    // second frame: lastNow is the first frame's now
    expect(events[1]!.now).toBeCloseTo(1.016);
    expect(events[1]!.lastNow).toBe(1);
    expect(events[1]!.deltaTime).toBeCloseTo(0.016);
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
    expect(events[30]!.measuredFps).toBe(60);
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
      expect(events[i]!.deltaTime).toBeGreaterThan(targetDelta * 0.95);
      expect(events[i]!.deltaTime).toBeLessThan(targetDelta * 1.1);
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

  describe('resetRAF()', () => {
    afterEach(() => {
      // the module state must not travel from one case into the next; the globals go last,
      // because the reset above still cancels through them
      FrameLoop.resetRAF();
      vi.unstubAllGlobals();
    });

    it('gives the same renderer a fresh driver', () => {
      const renderer = makeFakeRenderer();

      const first = new FrameLoop(0, renderer);
      expect(first.subscriptionCount, 'a fresh loop has no subscribers').toBe(0);
      first.start({[FrameLoop.OnFrame]() {}});
      const firstCallback = renderer.callback;
      expect(firstCallback, 'the driver installs itself on the renderer').not.toBeNull();

      const second = new FrameLoop(0, renderer);
      expect(second.subscriptionCount).toBe(0);
      second.start({[FrameLoop.OnFrame]() {}});
      expect(renderer.callback, 'a second loop shares the driver of the first').toBe(firstCallback);

      FrameLoop.resetRAF();

      const third = new FrameLoop(0, renderer);
      expect(third.subscriptionCount).toBe(0);
      third.start({[FrameLoop.OnFrame]() {}});
      expect(renderer.callback, 'after the reset the renderer drives a new driver').not.toBe(firstCallback);
    });

    it('stops the driver that runs without a renderer', () => {
      // requestAnimationFrame and cancelAnimationFrame do not exist under node at all,
      // so there is nothing to spy on — they have to be put there
      const rafIDs: number[] = [];
      const cancelled: number[] = [];
      let nextRafID = 100;

      vi.stubGlobal('requestAnimationFrame', () => {
        nextRafID += 1;
        rafIDs.push(nextRafID);
        return nextRafID;
      });
      vi.stubGlobal('cancelAnimationFrame', (id: number) => {
        cancelled.push(id);
      });

      const first = new FrameLoop(0);
      expect(first.subscriptionCount, 'a fresh loop has no subscribers').toBe(0);
      first.start({[FrameLoop.OnFrame]() {}});
      expect(rafIDs, 'the driver has asked for a frame').toHaveLength(1);

      FrameLoop.resetRAF();

      expect(cancelled, 'the pending frame request is cancelled').toEqual([rafIDs[0]]);

      const second = new FrameLoop(0);
      expect(second.subscriptionCount).toBe(0);
      second.start({[FrameLoop.OnFrame]() {}});
      expect(rafIDs, 'the next loop builds a new driver').toHaveLength(2);
    });

    it('does nothing when no driver ever ran without a renderer', () => {
      // no stubs here on purpose: this runs under bare node, where requestAnimationFrame
      // is missing — and that is exactly the environment a test suite calls the reset from
      expect(() => FrameLoop.resetRAF()).not.toThrow();
    });
  });

  describe('the shared rAF driver', () => {
    afterEach(() => {
      // the module state must not travel from one case into the next; the globals go last,
      // because the reset above still cancels through them
      FrameLoop.resetRAF();
      vi.unstubAllGlobals();
    });

    /** requestAnimationFrame and cancelAnimationFrame do not exist under node — they have to be put there */
    function stubAnimationFrame() {
      const rafIDs: number[] = [];
      const cancelled: number[] = [];
      let nextRafID = 100;

      vi.stubGlobal('requestAnimationFrame', () => {
        nextRafID += 1;
        rafIDs.push(nextRafID);
        return nextRafID;
      });
      vi.stubGlobal('cancelAnimationFrame', (id: number) => {
        cancelled.push(id);
      });

      return {rafIDs, cancelled};
    }

    it('stops when the last loop lets go of it', () => {
      const {rafIDs, cancelled} = stubAnimationFrame();

      const loop = new FrameLoop(0);
      const target = {[FrameLoop.OnFrame]() {}};

      loop.start(target);
      expect(rafIDs, 'the driver has asked for a frame').toHaveLength(1);

      loop.stop(target);

      expect(cancelled, 'the pending frame request is cancelled').toEqual([rafIDs[0]]);
    });

    it('starts again when a loop comes back', () => {
      const {rafIDs} = stubAnimationFrame();

      const loop = new FrameLoop(0);
      const target = {[FrameLoop.OnFrame]() {}};

      loop.start(target);
      loop.stop(target);

      expect(rafIDs, 'the driver has asked for a frame').toHaveLength(1);

      loop.start(target);

      expect(rafIDs, 'the returning loop puts the driver back to work').toHaveLength(2);
    });

    it('is taken off the renderer when the last loop lets go', () => {
      const renderer = makeFakeRenderer();
      const loop = new FrameLoop(0, renderer);
      const target = {[FrameLoop.OnFrame]() {}};

      loop.start(target);
      expect(renderer.callback, 'the driver drives the renderer').not.toBeNull();

      loop.stop(target);

      expect(renderer.callback, 'the renderer is left alone').toBeNull();
    });

    it('keeps running while another loop still holds it', () => {
      const renderer = makeFakeRenderer();
      const first = new FrameLoop(0, renderer);
      const second = new FrameLoop(0, renderer);

      const firstTarget = {[FrameLoop.OnFrame]() {}};
      const secondTarget = {[FrameLoop.OnFrame]() {}};

      first.start(firstTarget);
      second.start(secondTarget);

      first.stop(firstTarget);

      expect(renderer.callback, 'the second loop still wants frames').not.toBeNull();

      second.stop(secondTarget);

      expect(renderer.callback, 'nobody wants frames any more').toBeNull();
    });

    it('re-anchors its fps window after a pause', () => {
      const VSYNC = 1000 / 60;
      const renderer = makeFakeRenderer();
      const loop = new FrameLoop(0, renderer);
      const {events, target} = subscribe(loop);

      // the first window: an anchoring tick plus 30 at exactly 60Hz
      for (let i = 0; i < 31; i++) {
        renderer.tick(1000 + i * VSYNC);
      }

      expect(events, 'the first window').toHaveLength(31);
      expect(events[30]!.measuredFps, 'the first sample').toBe(60);

      loop.stop(target);

      // five seconds in which nobody asks for a frame
      const resumeAt = 1000 + 30 * VSYNC + 5000;

      loop.start(target);

      for (let i = 1; i <= 31; i++) {
        renderer.tick(resumeAt + i * VSYNC);
      }

      expect(events, 'the second window').toHaveLength(62);
      expect(events[61]!.measuredFps, 'the sample after the pause').toBe(60);
    });
  });
});
