import {getSubscriptionCount, on, once} from '@spearwolf/eventize';
import type {WebGPURenderer} from 'three/webgpu';
import {afterEach, beforeEach, describe, expect, it, type Mock, vi} from 'vitest';
import {
  OnDisplayDispose,
  OnDisplayError,
  OnDisplayInit,
  OnDisplayPause,
  OnDisplayRenderFrame,
  OnDisplayRestart,
  OnDisplayStart,
} from '../events.js';
import {Display} from './Display.js';
import {FixedFrameLoop} from './FixedFrameLoop.js';
import {FrameLoop} from './FrameLoop.js';
import type {DisplayEventProps, DisplayParameters} from './types.js';

// Stylesheets writes into a real CSSStyleSheet, and there is no document here to hold one
vi.mock('./Stylesheets.js', () => ({
  Stylesheets: {addRule: vi.fn(() => 'twopoint5d-canvas'), installRule: vi.fn(() => 'twopoint5d-canvas--fullscreen')},
}));

const LIFECYCLE_EVENTS = [OnDisplayInit, OnDisplayStart, OnDisplayPause, OnDisplayRestart];

type DocumentListenerStub = Mock<(type: string, listener: () => void, capture?: boolean) => void>;

interface DocumentStub {
  hidden: boolean;
  head: object;
  addEventListener: DocumentListenerStub;
  removeEventListener: DocumentListenerStub;
}

let doc: DocumentStub;
let getComputedStyleStub: ReturnType<typeof vi.fn>;

const displays: Display[] = [];

function makeCanvas() {
  return {
    classList: {add: vi.fn(), remove: vi.fn()},
    style: {},
    setAttribute: vi.fn(),
    hasAttribute: () => false,
    getAttribute: () => null,
    // a mock, so the measurements of the display can be counted
    getBoundingClientRect: vi.fn(() => ({width: 320, height: 200})),
  };
}

/**
 * A renderer stub with what the display calls on it. `backend` stands in for `renderer.backend`.
 * `frame` calls the callback handed to `setAnimationLoop()` last, with a timestamp in ms; while
 * that callback is `null`, a frame reaches nobody. `getAnimationLoop()` answers that callback.
 */
function makeRenderer(init: () => Promise<unknown> = () => Promise.resolve(), backend?: object) {
  const canvas = makeCanvas();
  let loop: ((now: number) => unknown) | null = null;
  const renderer = {
    isWebGPURenderer: true,
    domElement: canvas,
    backend,
    init: vi.fn(init),
    setDrawingBufferSize: vi.fn(),
    setAnimationLoop: vi.fn((callback: ((now: number) => unknown) | null) => {
      loop = callback;
    }),
    getAnimationLoop: vi.fn(() => loop),
    dispose: vi.fn(),
  };

  const frame = (now: number) => {
    loop?.(now);
  };

  return {renderer, canvas, frame};
}

/**
 * A display on an adopted renderer stub, see {@link makeRenderer}. Every call builds its own
 * renderer: the rAF driver hangs off the renderer in a WeakMap, so no two tests share one.
 */
function makeDisplay(options?: DisplayParameters, init?: () => Promise<unknown>, backend?: object) {
  return makeDisplayOn(makeRenderer(init, backend), options);
}

/**
 * {@link makeDisplay} on a canvas stub that carries `canvasProps` as well — an `ownerDocument`,
 * say, or a `getAttribute()` that answers `resize-to`.
 */
function makeDisplayOnCanvas(canvasProps: object, options?: DisplayParameters) {
  const made = makeRenderer();
  Object.assign(made.canvas, canvasProps);
  return makeDisplayOn(made, options);
}

function makeDisplayOn({renderer, canvas, frame}: ReturnType<typeof makeRenderer>, options?: DisplayParameters) {
  const display = new Display(renderer as unknown as WebGPURenderer, options);
  displays.push(display);

  const events: string[] = [];
  for (const name of LIFECYCLE_EVENTS) {
    on(display, name, () => {
      events.push(name);
    });
  }

  return {display, renderer, canvas, events, frame};
}

// lets every reaction to an already settled promise run, the ones they queue in turn included
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('Display', () => {
  beforeEach(() => {
    doc = {hidden: false, head: {}, addEventListener: vi.fn(), removeEventListener: vi.fn()};
    getComputedStyleStub = vi.fn(() => ({
      getPropertyValue: (name: string) => (name === 'box-sizing' ? 'border-box' : ''),
    }));

    // the global performance, so a spy on performance.now() reaches renderFrame() as well
    vi.stubGlobal('window', {devicePixelRatio: 1, performance});
    vi.stubGlobal('getComputedStyle', getComputedStyleStub);
    vi.stubGlobal('document', doc);
  });

  afterEach(() => {
    for (const display of displays.splice(0)) {
      display.dispose();
    }
    // the configuration restores spies, not globals
    vi.unstubAllGlobals();
  });

  describe('start()', () => {
    it('emits init before start, both before its promise resolves, and replays them to a late listener in that order', async () => {
      const {display, events} = makeDisplay();

      await display.start().then(() => {
        events.push('resolved');
      });

      expect(events).toEqual([OnDisplayInit, OnDisplayStart, 'resolved']);

      // one subscription for both names: a replay batch goes out in the order the retained
      // values were written, which is the order the display emitted them in
      const late: string[] = [];
      on(display, {
        [OnDisplayInit]: () => {
          late.push(OnDisplayInit);
        },
        [OnDisplayStart]: () => {
          late.push(OnDisplayStart);
        },
      });

      expect(late).toEqual([OnDisplayInit, OnDisplayStart]);
    });

    it('pausing and un-pausing a running display emits pause, then restart and start, and no second init', async () => {
      const {display, events} = makeDisplay();
      await display.start();
      events.length = 0;

      display.pause = true;

      expect(events).toEqual([OnDisplayPause]);
      expect(display.pause).toBe(true);

      display.pause = false;

      expect(events).toEqual([OnDisplayPause, OnDisplayRestart, OnDisplayStart]);
      expect(display.isRunning).toBe(true);
    });

    it('a stop() while start() waits for the renderer keeps the display from starting', async () => {
      const {display, events} = makeDisplay();

      const started = display.start();
      display.stop();

      await expect(started).resolves.toBe(display);
      expect(events).toEqual([]);
      expect(display.isRunning).toBe(false);
      expect(display.frameLoop.subscriptionCount).toBe(0);
    });

    it('a pause = true while start() waits for the renderer keeps the display from starting', async () => {
      const {display, events} = makeDisplay();

      const started = display.start();
      display.pause = true;

      await expect(started).resolves.toBe(display);
      expect(events).toEqual([]);
      expect(display.isRunning).toBe(false);
      expect(display.frameLoop.subscriptionCount).toBe(0);
    });

    it('a pause = false after a pause = true while start() waits lets the display start', async () => {
      const {display, events} = makeDisplay();

      const started = display.start();
      display.pause = true;
      display.pause = false;

      await expect(started).resolves.toBe(display);
      expect(events).toEqual([OnDisplayInit, OnDisplayStart]);
      expect(display.isRunning).toBe(true);
    });

    it('a stop() inside beforeStartCallback keeps the display from starting', async () => {
      const {display, events} = makeDisplay();

      await display.start(() => {
        display.stop();
      });

      expect(events).toEqual([]);
      expect(display.isRunning).toBe(false);
      expect(display.frameLoop.subscriptionCount).toBe(0);
    });

    it('a stop() before start() does not keep start() from starting the display', async () => {
      const {display, events} = makeDisplay();

      display.stop();
      await display.start();

      expect(events).toEqual([OnDisplayInit, OnDisplayStart]);
      expect(display.isRunning).toBe(true);
    });

    it('a display stopped before its first start answers pause = true, and false after pause = false', () => {
      const {display} = makeDisplay();

      display.stop();

      expect(display.pause).toBe(true);

      display.pause = false;

      expect(display.pause).toBe(false);

      display.pause = true;

      expect(display.pause).toBe(true);
    });

    it('a stop() while start() waits keeps pause at true', async () => {
      const {display} = makeDisplay();

      const started = display.start();
      display.stop();
      await started;

      expect(display.pause).toBe(true);
      expect(display.isRunning).toBe(false);
    });

    it('a disposed display that never ran answers pause = true', () => {
      const {display} = makeDisplay();

      display.dispose();

      expect(display.pause).toBe(true);
    });

    it('a stop() inside an init listener holds the display in the pause', async () => {
      const {display, events} = makeDisplay();
      once(display, OnDisplayInit, () => {
        display.stop();
      });

      await display.start();

      expect(events).toEqual([OnDisplayInit, OnDisplayPause]);
      expect(display.isRunning).toBe(false);
      expect(display.pause).toBe(true);
      expect(display.frameLoop.subscriptionCount).toBe(0);

      display.pause = false;

      expect(events).toEqual([OnDisplayInit, OnDisplayPause, OnDisplayRestart, OnDisplayStart]);
      expect(display.isRunning).toBe(true);
    });

    it('a stop() inside a restart listener holds the display in the pause', async () => {
      const {display, events} = makeDisplay();
      await display.start();
      display.pause = true;
      events.length = 0;
      // once, or the display could never run again
      once(display, OnDisplayRestart, () => {
        display.stop();
      });

      display.pause = false;

      expect(events).toEqual([OnDisplayRestart, OnDisplayPause]);
      expect(display.isRunning).toBe(false);
      expect(display.pause).toBe(true);
      expect(display.frameLoop.subscriptionCount).toBe(0);

      display.pause = false;

      expect(events).toEqual([OnDisplayRestart, OnDisplayPause, OnDisplayRestart, OnDisplayStart]);
      expect(display.isRunning).toBe(true);
    });

    it('a pause = true and a pause = false inside a restart listener restart the display once', async () => {
      const {display, events} = makeDisplay();
      await display.start();
      display.pause = true;
      events.length = 0;
      once(display, OnDisplayRestart, () => {
        display.pause = true;
        display.pause = false;
      });

      display.pause = false;

      expect(events).toEqual([OnDisplayRestart, OnDisplayStart]);
      expect(display.isRunning).toBe(true);
    });

    it('an init listener that throws rejects start(), and the next start() emits init to every listener', async () => {
      const {display, events} = makeDisplay();

      const error = new Error('init listener');
      let fail = true;
      on(display, OnDisplayInit, () => {
        if (fail) throw error;
      });

      const after: string[] = [];
      on(display, OnDisplayInit, () => {
        after.push(OnDisplayInit);
      });

      await expect(display.start()).rejects.toBe(error);

      expect(events).toEqual([OnDisplayInit]);
      expect(after).toEqual([]);
      expect(display.isRunning).toBe(false);
      expect(display.frameLoop.subscriptionCount).toBe(0);

      fail = false;
      await display.start();

      expect(events).toEqual([OnDisplayInit, OnDisplayInit, OnDisplayStart]);
      expect(after).toEqual([OnDisplayInit]);
      expect(display.isRunning).toBe(true);

      // a start that went through leaves init retained for a listener attached afterwards
      const late: string[] = [];
      on(display, OnDisplayInit, () => {
        late.push(OnDisplayInit);
      });

      expect(late).toEqual([OnDisplayInit]);
    });

    it('a restart listener that throws rejects start(), and the next start() emits restart again', async () => {
      const {display, events} = makeDisplay();
      await display.start();
      display.pause = true;

      const error = new Error('restart listener');
      let fail = true;
      on(display, OnDisplayRestart, () => {
        if (fail) throw error;
      });
      events.length = 0;

      await expect(display.start()).rejects.toBe(error);

      expect(events).toEqual([OnDisplayRestart]);
      expect(display.isRunning).toBe(false);

      fail = false;
      await display.start();

      expect(events).toEqual([OnDisplayRestart, OnDisplayRestart, OnDisplayStart]);
      expect(display.isRunning).toBe(true);
    });

    it('a start listener that throws rejects start(), pauses the display, and every start listener hears start', async () => {
      const {display, events} = makeDisplay();

      const error = new Error('start listener');
      let fail = true;
      on(display, OnDisplayStart, () => {
        if (fail) throw error;
      });

      const after: string[] = [];
      on(display, OnDisplayStart, () => {
        after.push(OnDisplayStart);
      });

      await expect(display.start()).rejects.toBe(error);

      expect(events).toEqual([OnDisplayInit, OnDisplayStart, OnDisplayPause]);
      expect(after).toEqual([OnDisplayStart]);
      expect(display.isRunning).toBe(false);
      expect(display.pause).toBe(true);
      expect(display.frameLoop.subscriptionCount).toBe(0);

      // the display did not stay started, so a listener attached now hears no start
      const late: string[] = [];
      on(display, OnDisplayStart, () => {
        late.push(OnDisplayStart);
      });
      expect(late).toEqual([]);

      fail = false;
      events.length = 0;
      await display.start();

      expect(events).toEqual([OnDisplayRestart, OnDisplayStart]);
      expect(late).toEqual([OnDisplayStart]);
      expect(display.isRunning).toBe(true);
    });

    it('two start listeners that throw reject start() with an AggregateError of both errors', async () => {
      const {display} = makeDisplay();

      const first = new Error('first start listener');
      const second = new Error('second start listener');
      on(display, OnDisplayStart, () => {
        throw first;
      });
      on(display, OnDisplayStart, () => {
        throw second;
      });

      const rejection = await display.start().then(
        () => undefined,
        (error: unknown) => error,
      );

      expect(rejection).toBeInstanceOf(AggregateError);
      expect((rejection as AggregateError).errors).toEqual([first, second]);
      expect(display.isRunning).toBe(false);
      expect(display.pause).toBe(true);
    });

    it('a pause listener that throws: every pause listener hears pause, and pause = true throws its error', async () => {
      const {display} = makeDisplay();
      await display.start();

      const error = new Error('pause listener');
      on(display, OnDisplayPause, () => {
        throw error;
      });
      const after: string[] = [];
      on(display, OnDisplayPause, () => {
        after.push(OnDisplayPause);
      });

      expect(() => {
        display.pause = true;
      }).toThrow(error);
      expect(after).toEqual([OnDisplayPause]);
      expect(display.isRunning).toBe(false);
      expect(display.frameLoop.subscriptionCount).toBe(0);
    });

    it('two pause listeners that throw make pause = true throw an AggregateError of both errors', async () => {
      const {display} = makeDisplay();
      await display.start();

      const first = new Error('first pause listener');
      const second = new Error('second pause listener');
      on(display, OnDisplayPause, () => {
        throw first;
      });
      on(display, OnDisplayPause, () => {
        throw second;
      });

      let thrown: unknown;
      try {
        display.pause = true;
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AggregateError);
      expect((thrown as AggregateError).errors).toEqual([first, second]);
    });

    it('a start listener and a pause listener that throw reject start() with an AggregateError of both errors, and every pause listener hears pause', async () => {
      const {display, events} = makeDisplay();

      const startError = new Error('start listener');
      const pauseError = new Error('pause listener');
      let fail = true;
      on(display, OnDisplayStart, () => {
        if (fail) throw startError;
      });
      on(display, OnDisplayPause, () => {
        if (fail) throw pauseError;
      });
      const after: string[] = [];
      on(display, OnDisplayPause, () => {
        after.push(OnDisplayPause);
      });

      const rejection = await display.start().then(
        () => undefined,
        (error: unknown) => error,
      );

      expect(rejection).toBeInstanceOf(AggregateError);
      expect((rejection as AggregateError).errors).toEqual([startError, pauseError]);
      expect((rejection as AggregateError).cause).toBe(pauseError);
      expect(after).toEqual([OnDisplayPause]);
      expect(display.isRunning).toBe(false);
      expect(display.pause).toBe(true);
      expect(display.frameLoop.subscriptionCount).toBe(0);

      fail = false;
      events.length = 0;
      await display.start();

      expect(display.isRunning).toBe(true);
      expect(events).toEqual([OnDisplayRestart, OnDisplayStart]);
    });

    it('two start listeners and a pause listener that throw reject start() with an AggregateError of the start errors and the pause error', async () => {
      const {display} = makeDisplay();

      const first = new Error('first start listener');
      const second = new Error('second start listener');
      const pauseError = new Error('pause listener');
      on(display, OnDisplayStart, () => {
        throw first;
      });
      on(display, OnDisplayStart, () => {
        throw second;
      });
      on(display, OnDisplayPause, () => {
        throw pauseError;
      });

      const rejection = await display.start().then(
        () => undefined,
        (error: unknown) => error,
      );

      expect(rejection).toBeInstanceOf(AggregateError);
      const {errors} = rejection as AggregateError;
      expect(errors).toHaveLength(2);
      expect(errors[0]).toBeInstanceOf(AggregateError);
      expect((errors[0] as AggregateError).errors).toEqual([first, second]);
      expect(errors[1]).toBe(pauseError);
    });

    it('rejects with the error of an init that fails, and the error event carries the same error', async () => {
      const failure = new Error('no adapter');
      const {display, events} = makeDisplay(undefined, () => Promise.reject(failure));

      await expect(display.start()).rejects.toBe(failure);

      const errors: unknown[] = [];
      on(display, OnDisplayError, (error: unknown) => {
        errors.push(error);
      });

      expect(errors).toEqual([failure]);
      expect(events).toEqual([]);
    });
  });

  describe('frame loop', () => {
    it('keeps the display on its frame loop only while it runs', async () => {
      const {display, renderer} = makeDisplay();

      expect(display.frameLoop.subscriptionCount, 'after the constructor').toBe(0);

      await settle();

      expect(display.frameLoop.subscriptionCount, 'after the init, before start()').toBe(0);

      await display.start();

      expect(display.frameLoop.subscriptionCount, 'running').toBe(1);

      display.pause = true;

      expect(display.frameLoop.subscriptionCount, 'paused').toBe(0);
      expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);

      display.pause = false;

      expect(display.frameLoop.subscriptionCount, 'running again').toBe(1);

      display.dispose();

      expect(display.frameLoop.subscriptionCount, 'disposed').toBe(0);
    });

    it('stops the animation loop of three as the display goes into the pause, and starts it again once as it runs', async () => {
      const {display, renderer} = makeDisplay();
      const animation = {start: vi.fn(), stop: vi.fn()};
      Object.assign(renderer, {_animation: animation});

      await display.start();

      // three has started its loop in init() already
      expect(animation.start, 'after start()').not.toHaveBeenCalled();
      expect(animation.stop, 'after start()').not.toHaveBeenCalled();

      display.pause = true;

      expect(animation.stop, 'paused').toHaveBeenCalledTimes(1);

      display.pause = false;

      expect(animation.start, 'running again').toHaveBeenCalledTimes(1);
      // three runs the first tick of a loop it starts right away, and the display is not on its
      // frame loop yet then
      expect(animation.start.mock.invocationCallOrder[0]).toBeLessThan(
        renderer.setAnimationLoop.mock.invocationCallOrder.at(-1)!,
      );

      display.pause = false;

      expect(animation.start, 'a second pause = false').toHaveBeenCalledTimes(1);
      expect(animation.stop, 'a second pause = false').toHaveBeenCalledTimes(1);
    });

    it('leaves the animation loop of three running while another frame loop runs on the renderer', async () => {
      const {display, renderer} = makeDisplay();
      const animation = {start: vi.fn(), stop: vi.fn()};
      Object.assign(renderer, {_animation: animation});
      await display.start();

      const other = new FrameLoop(0, renderer);
      const target = {[FrameLoop.OnFrame]() {}};
      other.start(target);

      display.pause = true;

      expect(animation.stop).not.toHaveBeenCalled();

      display.pause = false;

      expect(animation.start).not.toHaveBeenCalled();

      other.stop(target);
    });

    it('stops the animation loop of three for a display that goes into the pause as it starts', async () => {
      // the constructor reads the visibility of the document
      doc.hidden = true;
      const {display, renderer, events} = makeDisplay();
      const animation = {start: vi.fn(), stop: vi.fn()};
      Object.assign(renderer, {_animation: animation});

      await display.start();

      expect(events).toEqual([OnDisplayPause]);
      expect(animation.stop).toHaveBeenCalledTimes(1);

      const [, listener] = doc.addEventListener.mock.calls.find(([type]) => type === 'visibilitychange')!;
      doc.hidden = false;
      listener();

      expect(animation.start).toHaveBeenCalledTimes(1);
      expect(display.isRunning).toBe(true);
    });

    it('a stop() before the first start() stops the animation loop of three once the renderer is up, and pause = false starts it again once', async () => {
      const animation = {start: vi.fn(), stop: vi.fn()};
      let finishInit!: () => void;
      const {display, renderer} = makeDisplay(
        undefined,
        () =>
          new Promise<void>((resolve) => {
            finishInit = resolve;
          }),
      );

      display.stop();

      // three builds its animation loop at the end of init() and starts it there
      Object.assign(renderer, {_animation: animation});
      finishInit();
      await settle();

      expect(display.pause).toBe(true);
      expect(animation.stop, 'once the renderer is up').toHaveBeenCalledTimes(1);

      display.pause = false;

      expect(animation.start, 'pause = false').toHaveBeenCalledTimes(1);

      display.pause = false;

      expect(animation.start, 'a second pause = false').toHaveBeenCalledTimes(1);
      expect(animation.stop, 'a second pause = false').toHaveBeenCalledTimes(1);
    });

    it('a pause = true before the first start() stops the animation loop of three right away, and start() starts it again once', async () => {
      const {display, renderer} = makeDisplay();
      const animation = {start: vi.fn(), stop: vi.fn()};
      Object.assign(renderer, {_animation: animation});
      await settle();

      display.pause = true;

      expect(animation.stop, 'pause = true').toHaveBeenCalledTimes(1);

      display.pause = true;

      expect(animation.stop, 'a second pause = true').toHaveBeenCalledTimes(1);

      await display.start();

      expect(display.isRunning).toBe(true);
      expect(animation.start).toHaveBeenCalledTimes(1);
      expect(animation.stop).toHaveBeenCalledTimes(1);
    });

    it('a stop() while the first start() waits stops the animation loop of three, and the next start() starts it again once', async () => {
      const animation = {start: vi.fn(), stop: vi.fn()};
      let finishInit!: () => void;
      const {display, renderer} = makeDisplay(
        undefined,
        () =>
          new Promise<void>((resolve) => {
            finishInit = resolve;
          }),
      );

      const started = display.start();
      display.stop();
      Object.assign(renderer, {_animation: animation});
      finishInit();
      await started;

      expect(display.isRunning).toBe(false);
      expect(display.pause).toBe(true);
      expect(animation.stop).toHaveBeenCalledTimes(1);
      expect(animation.start).not.toHaveBeenCalled();

      await display.start();

      expect(display.isRunning).toBe(true);
      expect(animation.start).toHaveBeenCalledTimes(1);
      expect(animation.stop).toHaveBeenCalledTimes(1);
    });

    it('an init listener that throws after a stop() before the first start() leaves the animation loop of three running, as pause answers false', async () => {
      const {display, renderer} = makeDisplay();
      const animation = {start: vi.fn(), stop: vi.fn()};
      Object.assign(renderer, {_animation: animation});
      const error = new Error('init listener');
      on(display, OnDisplayInit, () => {
        throw error;
      });

      display.stop();
      await settle();

      expect(animation.stop).toHaveBeenCalledTimes(1);

      await expect(display.start()).rejects.toBe(error);

      expect(display.isRunning).toBe(false);
      expect(display.pause).toBe(false);
      expect(animation.start).toHaveBeenCalledTimes(1);
    });

    it('dispose() of a display that has not started stops the animation loop of three, as it does for a running display', async () => {
      const {display, renderer} = makeDisplay();
      const animation = {start: vi.fn(), stop: vi.fn()};
      Object.assign(renderer, {_animation: animation});
      await settle();

      display.dispose();

      expect(display.pause).toBe(true);
      expect(animation.stop).toHaveBeenCalledTimes(1);
      expect(animation.start).not.toHaveBeenCalled();
    });

    it('lets no time pass for a frame whose timestamp lies before the start', async () => {
      // the chronometer reads its start time in a field initializer and in the constructor
      vi.spyOn(performance, 'now').mockReturnValue(1000);
      const {display, frame} = makeDisplay();
      await display.start();

      frame(990);

      expect(display.deltaTime).toBe(0);
      expect(display.now).toBe(0);

      frame(1010);

      expect(display.deltaTime).toBeCloseTo(0.01);
    });

    it('hands the render frame the delta before maxDeltaTime cuts it as rawDeltaTime', async () => {
      vi.spyOn(performance, 'now').mockReturnValue(1000);
      const {display, frame} = makeDisplay();
      await display.start();
      const props: DisplayEventProps[] = [];
      on(display, OnDisplayRenderFrame, (p: DisplayEventProps) => {
        props.push(p);
      });

      frame(1050);
      frame(1100);

      expect(props).toHaveLength(2);
      for (const p of props) {
        expect(p.deltaTime).toBeCloseTo(1 / 30);
        expect(p.rawDeltaTime).toBeCloseTo(0.05);
      }
    });

    it('lets a FixedFrameLoop keep up with the wall clock on a display at 20 fps', async () => {
      vi.spyOn(performance, 'now').mockReturnValue(1000);
      const {display, frame} = makeDisplay();
      const sim = new FixedFrameLoop(display);
      await display.start();

      for (let i = 1; i <= 20; i++) {
        frame(1000 + i * 50);
      }

      // one second of wall clock; maxDeltaTime cuts every frame of the display to 1/30
      expect(Math.abs(sim.tickTime - 1)).toBeLessThanOrEqual(sim.fixedDelta);
    });

    it('maxFps holds back the frames that come in faster than it allows', async () => {
      const frameInterval = 1000 / 60;

      const renderFrames = async (options?: DisplayParameters) => {
        const {display, frame} = makeDisplay(options);
        await display.start();
        let count = 0;
        on(display, OnDisplayRenderFrame, () => {
          count += 1;
        });
        for (let i = 0; i < 10; i++) {
          frame(1000 + i * frameInterval);
        }
        return count;
      };

      // the first tick lays the grid at 1000 + n * 1000/30, and a tick within 2% of an interval
      // before its slot counts as on time: every second tick of a 60 Hz stream lands on a slot
      expect(await renderFrames({maxFps: 30})).toBe(5);
      expect(await renderFrames()).toBe(10);
    });

    it('resizePollIntervalMs spaces out the measurements of the frames', async () => {
      const now = vi.spyOn(performance, 'now').mockReturnValue(5000);
      const {display, canvas, frame} = makeDisplay();
      display.resizePollIntervalMs = 100;
      await display.start();

      frame(5000);
      const measured = canvas.getBoundingClientRect.mock.calls.length;

      now.mockReturnValue(5050);
      frame(5050);

      expect(canvas.getBoundingClientRect.mock.calls.length, 'within the interval').toBe(measured);

      now.mockReturnValue(5100);
      frame(5100);

      expect(canvas.getBoundingClientRect.mock.calls.length, 'once the interval is over').toBe(measured + 1);
    });

    it('a resize() of your own measures within resizePollIntervalMs, and leaves the measurements of the frames where they were', async () => {
      const now = vi.spyOn(performance, 'now').mockReturnValue(5000);
      const {display, canvas, frame} = makeDisplay();
      display.resizePollIntervalMs = 1000;
      await display.start();

      frame(5000);

      expect(display.width).toBe(320);

      canvas.getBoundingClientRect.mockReturnValue({width: 640, height: 400});
      now.mockReturnValue(5500);
      display.resize();

      expect(display.width, 'right after resize()').toBe(640);

      canvas.getBoundingClientRect.mockReturnValue({width: 800, height: 400});
      now.mockReturnValue(6000);
      frame(6000);

      expect(display.width, 'the frame one interval after the last measurement of a frame').toBe(800);
    });
  });

  describe('resize()', () => {
    beforeEach(() => {
      // the warning about MaxResolution goes out once per module instance and is not what these
      // cases look at
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    // the constructor calls resize(), so the pixel ratio has to be in place before makeDisplay()
    const stubDevicePixelRatio = (devicePixelRatio: number) => {
      vi.stubGlobal('window', {devicePixelRatio, performance});
    };

    it('clamps the drawing buffer to MaxResolution in device pixels', () => {
      stubDevicePixelRatio(2);
      const {display, renderer} = makeDisplay({resizeTo: () => [5000, 100]});

      expect(renderer.setDrawingBufferSize).toHaveBeenLastCalledWith(4096, 100, 2);
      expect(display.width).toBe(4096);
      expect(display.height).toBe(100);
    });

    it('rounds a clamped size down, so the drawing buffer stays within MaxResolution at a fractional pixel ratio', () => {
      stubDevicePixelRatio(3);
      const {renderer} = makeDisplay({resizeTo: () => [5000, 50]});

      // Math.floor(2730 * 3) is 8190
      expect(renderer.setDrawingBufferSize).toHaveBeenLastCalledWith(2730, 50, 3);
    });

    it('holds the CSS size to MaxResolution while pixelZoom is above 0', () => {
      stubDevicePixelRatio(2);
      const {display, renderer} = makeDisplay({resizeTo: () => [10000, 100]});

      display.pixelZoom = 2;
      display.resize();

      expect(renderer.setDrawingBufferSize).toHaveBeenLastCalledWith(4096, 50, 1);
    });

    it('applies styleImageRendering without a size change, also within resizePollIntervalMs', async () => {
      vi.spyOn(performance, 'now').mockReturnValue(5000);
      const {display, renderer, canvas, frame} = makeDisplay();
      const style = canvas.style as {imageRendering?: string};

      expect(style.imageRendering).toBe('auto');

      display.resizePollIntervalMs = 1000;
      await display.start();
      // uses up the interval, so the next frame does not measure
      frame(5000);
      const drawingBufferSizeCalls = renderer.setDrawingBufferSize.mock.calls.length;
      const measured = canvas.getBoundingClientRect.mock.calls.length;

      display.styleImageRendering = 'pixelated';
      frame(5016);

      expect(style.imageRendering).toBe('pixelated');
      expect(canvas.getBoundingClientRect.mock.calls.length, 'measurements').toBe(measured);
      expect(renderer.setDrawingBufferSize.mock.calls.length).toBe(drawingBufferSizeCalls);
    });

    it('treats a resizeTo result without two finite numbers as no size', () => {
      const results: (() => [number, number] | undefined)[] = [() => [NaN, 100], () => [100, Infinity], () => undefined];

      for (const resizeTo of results) {
        const {display, renderer} = makeDisplay({resizeTo});

        expect(display.width, String(resizeTo)).toBe(300);
        expect(display.height, String(resizeTo)).toBe(150);
        for (const args of renderer.setDrawingBufferSize.mock.calls) {
          expect(
            args.every((value: unknown) => Number.isFinite(value)),
            String(resizeTo),
          ).toBe(true);
        }
      }
    });
  });

  describe('size watch', () => {
    type ListenerStub = Mock<(type: string, listener: () => void) => void>;

    interface MediaQueryListStub {
      media: string;
      addEventListener: ListenerStub;
      removeEventListener: ListenerStub;
    }

    let observers: ResizeObserverStub[];
    let queries: MediaQueryListStub[];
    // the Safari of today throws for a box it does not know
    let knowsDevicePixelContentBox: boolean;

    class ResizeObserverStub {
      readonly observe = vi.fn((_target: unknown, options?: {box?: string}) => {
        if (options?.box === 'device-pixel-content-box' && !knowsDevicePixelContentBox) {
          throw new TypeError(`the box ${options.box} is not supported`);
        }
      });
      readonly unobserve = vi.fn<(target: unknown) => void>();
      readonly disconnect = vi.fn<() => void>();

      constructor(readonly callback: () => void) {
        observers.push(this);
      }
    }

    let view: {
      devicePixelRatio: number;
      innerWidth: number;
      innerHeight: number;
      performance: Performance;
      ResizeObserver: typeof ResizeObserverStub;
      matchMedia: Mock<(media: string) => MediaQueryListStub>;
      addEventListener: ListenerStub;
      removeEventListener: ListenerStub;
    };

    const listenerOf = (target: {addEventListener: ListenerStub}, type: string): (() => void) => {
      const call = target.addEventListener.mock.calls.find(([name]) => name === type);
      expect(call, `a ${type} listener`).toBeDefined();
      return call![1];
    };

    const onWindow = {getAttribute: (name: string) => (name === 'resize-to' ? 'window' : null)};

    beforeEach(() => {
      observers = [];
      queries = [];
      knowsDevicePixelContentBox = true;
      view = {
        devicePixelRatio: 1,
        innerWidth: 1024,
        innerHeight: 768,
        performance,
        ResizeObserver: ResizeObserverStub,
        matchMedia: vi.fn((media: string) => {
          const query = {media, addEventListener: vi.fn(), removeEventListener: vi.fn()};
          queries.push(query);
          return query;
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      vi.stubGlobal('window', view);
    });

    it('measures nothing in the frames after the first as long as nothing reports a change', async () => {
      const {display, canvas, frame} = makeDisplay();
      await display.start();
      frame(1000);
      const measured = canvas.getBoundingClientRect.mock.calls.length;
      const styled = getComputedStyleStub.mock.calls.length;

      frame(1016);
      frame(1033);
      frame(1050);

      expect(canvas.getBoundingClientRect.mock.calls.length, 'getBoundingClientRect()').toBe(measured);
      expect(getComputedStyleStub.mock.calls.length, 'getComputedStyle()').toBe(styled);
    });

    it('measures in the first frame without a report', async () => {
      const {display, canvas, frame} = makeDisplay();
      await display.start();
      const measured = canvas.getBoundingClientRect.mock.calls.length;

      frame(1000);

      expect(canvas.getBoundingClientRect.mock.calls.length).toBe(measured + 1);
    });

    it('lets a report of the ResizeObserver make the next frame measure once', async () => {
      const {display, canvas, frame} = makeDisplay();
      await display.start();
      frame(1000);
      const measured = canvas.getBoundingClientRect.mock.calls.length;

      expect(observers).toHaveLength(1);
      expect(observers[0]!.observe).toHaveBeenLastCalledWith(canvas, {box: 'device-pixel-content-box'});

      canvas.getBoundingClientRect.mockReturnValue({width: 640, height: 400});
      observers[0]!.callback();
      frame(1016);

      expect(canvas.getBoundingClientRect.mock.calls.length, 'the frame after the report').toBe(measured + 1);
      expect(display.width).toBe(640);

      frame(1033);

      expect(canvas.getBoundingClientRect.mock.calls.length, 'the frame after that').toBe(measured + 1);
    });

    it('measures with the new pixel ratio once the media query on the old one reports a change', async () => {
      const {display, renderer, frame} = makeDisplay();
      await display.start();
      frame(1000);

      expect(view.matchMedia).toHaveBeenLastCalledWith('(resolution: 1dppx)');
      const first = queries.at(-1)!;
      const onChange = listenerOf(first, 'change');

      view.devicePixelRatio = 2;
      onChange();

      expect(view.matchMedia, 'the query on the new ratio').toHaveBeenLastCalledWith('(resolution: 2dppx)');
      expect(first.removeEventListener, 'the listener of the old query').toHaveBeenCalledWith('change', onChange);
      expect(queries.at(-1)!.addEventListener).toHaveBeenCalledWith('change', onChange);

      frame(1016);

      expect(renderer.setDrawingBufferSize).toHaveBeenLastCalledWith(320, 200, 2);
    });

    it('measures the window under resize-to="window" once the window reports a resize', async () => {
      const {display, frame} = makeDisplayOnCanvas(onWindow);
      await display.start();
      frame(1000);

      expect(display.width).toBe(1024);
      expect(display.height).toBe(768);

      view.innerWidth = 800;
      view.innerHeight = 600;
      listenerOf(view, 'resize')();
      frame(1016);

      expect(display.width).toBe(800);
      expect(display.height).toBe(600);
    });

    it('observes the new element once resizeToElement changes, and measures it in the next frame', async () => {
      const {display, canvas, frame} = makeDisplay();
      await display.start();
      frame(1000);
      const observer = observers[0]!;
      const host = {getBoundingClientRect: vi.fn(() => ({width: 500, height: 300}))};

      display.resizeToElement = host as unknown as HTMLElement;
      frame(1016);

      expect(observer.unobserve).toHaveBeenCalledWith(canvas);
      expect(observer.observe).toHaveBeenLastCalledWith(host, {box: 'device-pixel-content-box'});
      expect(host.getBoundingClientRect).toHaveBeenCalledTimes(1);
      expect(display.width).toBe(500);
      expect(display.height).toBe(300);
    });

    it('observes without options where the browser does not know the device-pixel-content-box', () => {
      knowsDevicePixelContentBox = false;
      const {canvas} = makeDisplay();

      expect(observers[0]!.observe.mock.calls).toEqual([[canvas, {box: 'device-pixel-content-box'}], [canvas]]);
    });

    it('measures in the next frame once pixelZoom changes', async () => {
      const {display, canvas, frame} = makeDisplay();
      await display.start();
      frame(1000);
      const measured = canvas.getBoundingClientRect.mock.calls.length;

      display.pixelZoom = 2;
      frame(1016);

      expect(canvas.getBoundingClientRect.mock.calls.length).toBe(measured + 1);
      expect(display.width).toBe(160);
    });

    it('asks a resizeTo callback in every frame, observer or not', async () => {
      const resizeTo = vi.fn((): [number, number] => [400, 300]);
      const {display, frame} = makeDisplay({resizeTo});
      await display.start();
      frame(1000);
      const asked = resizeTo.mock.calls.length;

      frame(1016);
      frame(1033);

      expect(resizeTo.mock.calls.length).toBe(asked + 2);
    });

    it('lets go of the observer, the media query and the resize listener on dispose()', () => {
      const {display} = makeDisplay();
      const observer = observers[0]!;
      const query = queries.at(-1)!;
      const onChange = listenerOf(query, 'change');
      const onResize = listenerOf(view, 'resize');

      display.dispose();

      expect(observer.disconnect).toHaveBeenCalledTimes(1);
      expect(query.removeEventListener).toHaveBeenCalledWith('change', onChange);
      expect(view.removeEventListener).toHaveBeenCalledWith('resize', onResize);
    });
  });

  describe('document and window of the canvas', () => {
    it('takes visibility, pixel ratio, window size and the default styleSheetRoot from the document of its canvas', async () => {
      const frameDoc = {
        hidden: false,
        head: {},
        addEventListener: vi.fn() as DocumentListenerStub,
        removeEventListener: vi.fn() as DocumentListenerStub,
        defaultView: {devicePixelRatio: 3, innerWidth: 640, innerHeight: 480, performance},
      };
      const {display, events} = makeDisplayOnCanvas({
        ownerDocument: frameDoc,
        getAttribute: (name: string) => (name === 'resize-to' ? 'window' : null),
      });

      expect(frameDoc.addEventListener, 'the document of the canvas').toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
        false,
      );
      expect(doc.addEventListener, 'the global document').not.toHaveBeenCalled();
      expect(display.devicePixelRatio).toBe(3);
      expect(display.width).toBe(640);
      expect(display.height).toBe(480);
      expect(display.styleSheetRoot).toBe(frameDoc.head);

      const listener = frameDoc.addEventListener.mock.calls.find(([type]) => type === 'visibilitychange')![1];
      await display.start();
      events.length = 0;

      frameDoc.hidden = true;
      listener();

      expect(events).toEqual([OnDisplayPause]);

      display.dispose();

      expect(frameDoc.removeEventListener).toHaveBeenCalledWith('visibilitychange', listener, false);
    });
  });

  describe('release', () => {
    // a device whose lost promise never settles, with a queue that answers as
    // `onSubmittedWorkDone` does
    const backendWith = (onSubmittedWorkDone: () => Promise<unknown>, lost: Promise<unknown> = new Promise(() => {})) => ({
      device: {queue: {onSubmittedWorkDone}, lost},
    });

    // the window of the page a canvas stub sits in, with animation frames driven by hand: frame()
    // runs the callbacks requested before it, as a browser runs those of one frame
    const pageWithFrames = () => {
      let requests = new Map<number, () => void>();
      let nextId = 1;
      const view = {
        requestAnimationFrame: vi.fn((callback: () => void) => {
          const id = nextId++;
          requests.set(id, callback);
          return id;
        }),
        cancelAnimationFrame: vi.fn((id: number) => {
          requests.delete(id);
        }),
      };
      const frame = () => {
        const due = requests;
        requests = new Map();
        for (const callback of due.values()) callback();
      };
      return {view, frame};
    };

    // pageWithFrames() with a document whose visibility is switched by hand: setHidden() fires
    // visibilitychange as a browser does
    const pageWithVisibility = (hidden: boolean) => {
      const {view, frame} = pageWithFrames();
      const listeners = new Set<() => void>();
      const document = {
        hidden,
        addEventListener: vi.fn((type: string, listener: () => void) => {
          if (type === 'visibilitychange') listeners.add(listener);
        }),
        removeEventListener: vi.fn((type: string, listener: () => void) => {
          if (type === 'visibilitychange') listeners.delete(listener);
        }),
      };
      const setHidden = (value: boolean) => {
        document.hidden = value;
        for (const listener of [...listeners]) listener();
      };
      return {view: Object.assign(view, {document}), frame, setHidden, listeners};
    };

    it('releases the renderer after a bounded wait when the queue never answers, with one warning', async () => {
      vi.useFakeTimers();
      try {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const {display, renderer} = makeDisplay(
          undefined,
          undefined,
          backendWith(() => new Promise(() => {})),
        );

        display.dispose();
        await vi.advanceTimersByTimeAsync(1999);

        expect(renderer.dispose, 'before the wait has run out').not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);

        expect(renderer.dispose, 'once the wait has run out').toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('releases the renderer once the device reports itself lost, without waiting for the queue', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const {display, renderer} = makeDisplay(
        undefined,
        undefined,
        backendWith(() => new Promise(() => {}), Promise.resolve({reason: 'unknown'})),
      );

      display.dispose();
      await settle();

      expect(renderer.dispose).toHaveBeenCalledTimes(1);
      expect(warn).not.toHaveBeenCalled();
    });

    it('leaves no timer behind once the queue has run dry', async () => {
      vi.useFakeTimers();
      try {
        const {display, renderer} = makeDisplay(
          undefined,
          undefined,
          backendWith(() => Promise.resolve()),
        );

        display.dispose();
        await vi.advanceTimersByTimeAsync(0);

        expect(renderer.dispose).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount(), 'timers left').toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('releases a WebGPU renderer once the page has drawn two animation frames after the queue has run dry', async () => {
      vi.useFakeTimers();
      try {
        const {display, renderer, canvas} = makeDisplay(
          undefined,
          undefined,
          backendWith(() => Promise.resolve()),
        );
        const {view, frame} = pageWithFrames();
        Object.assign(canvas, {ownerDocument: {defaultView: view}});

        display.dispose();
        await vi.advanceTimersByTimeAsync(0);

        expect(renderer.dispose, 'before the first frame').not.toHaveBeenCalled();

        frame();
        await vi.advanceTimersByTimeAsync(0);

        // two frames requested in the same tick would both have come with this one
        expect(renderer.dispose, 'after the first frame').not.toHaveBeenCalled();

        frame();
        await vi.advanceTimersByTimeAsync(0);

        expect(renderer.dispose, 'after the second frame').toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount(), 'timers left').toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('releases the renderer after a bounded wait when the page draws no frame, without a warning, and takes its frame request back', async () => {
      vi.useFakeTimers();
      try {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const {display, renderer, canvas} = makeDisplay(
          undefined,
          undefined,
          backendWith(() => Promise.resolve()),
        );
        const {view} = pageWithFrames();
        Object.assign(canvas, {ownerDocument: {defaultView: view}});

        display.dispose();
        await vi.advanceTimersByTimeAsync(1999);

        expect(renderer.dispose, 'before the wait has run out').not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);

        expect(renderer.dispose, 'once the wait has run out').toHaveBeenCalledTimes(1);
        expect(view.cancelAnimationFrame).toHaveBeenCalledWith(view.requestAnimationFrame.mock.results[0]!.value);
        expect(warn).not.toHaveBeenCalled();
        expect(vi.getTimerCount(), 'timers left').toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('holds the release of a WebGPU renderer while the page is hidden, and releases it once the page has drawn two frames after it is visible again', async () => {
      vi.useFakeTimers();
      try {
        const {display, renderer, canvas} = makeDisplay(
          undefined,
          undefined,
          backendWith(() => Promise.resolve()),
        );
        const {view, frame, setHidden, listeners} = pageWithVisibility(true);
        Object.assign(canvas, {ownerDocument: {defaultView: view}});

        display.dispose();
        await vi.advanceTimersByTimeAsync(10_000);

        // a hidden page presents the canvas once it is visible again, so the device has to live
        expect(renderer.dispose, 'while the page is hidden').not.toHaveBeenCalled();

        setHidden(false);
        await vi.advanceTimersByTimeAsync(0);
        frame();
        await vi.advanceTimersByTimeAsync(0);
        frame();
        await vi.advanceTimersByTimeAsync(0);

        expect(renderer.dispose, 'after two frames of the visible page').toHaveBeenCalledTimes(1);
        expect(listeners.size, 'visibilitychange listeners left').toBe(0);
        expect(vi.getTimerCount(), 'timers left').toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('holds the release of a WebGPU renderer when the page is hidden while the release waits for its frames', async () => {
      vi.useFakeTimers();
      try {
        const {display, renderer, canvas} = makeDisplay(
          undefined,
          undefined,
          backendWith(() => Promise.resolve()),
        );
        const {view, frame, setHidden, listeners} = pageWithVisibility(false);
        Object.assign(canvas, {ownerDocument: {defaultView: view}});

        display.dispose();
        await vi.advanceTimersByTimeAsync(0);
        setHidden(true);
        await vi.advanceTimersByTimeAsync(10_000);

        expect(renderer.dispose, 'while the page is hidden').not.toHaveBeenCalled();

        setHidden(false);
        await vi.advanceTimersByTimeAsync(0);
        frame();
        await vi.advanceTimersByTimeAsync(0);
        frame();
        await vi.advanceTimersByTimeAsync(0);

        expect(renderer.dispose, 'after two frames of the visible page').toHaveBeenCalledTimes(1);
        expect(listeners.size, 'visibilitychange listeners left').toBe(0);
        expect(vi.getTimerCount(), 'timers left').toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('waits for no animation frame under the WebGL backend', async () => {
      const {display, renderer, canvas} = makeDisplay();
      const {view} = pageWithFrames();
      Object.assign(canvas, {ownerDocument: {defaultView: view}});

      display.dispose();
      await settle();

      expect(renderer.dispose).toHaveBeenCalledTimes(1);
      expect(view.requestAnimationFrame).not.toHaveBeenCalled();
    });
  });

  describe('dispose()', () => {
    const catchError = (fn: () => void): unknown => {
      try {
        fn();
      } catch (error) {
        return error;
      }
      return undefined;
    };

    it('a pause listener that throws does not stop dispose(): the display is torn down, then dispose() throws its error', async () => {
      const {display, renderer} = makeDisplay();
      await display.start();

      const pauseError = new Error('pause listener fails on purpose');
      const heard: Display[] = [];
      on(display, OnDisplayPause, () => {
        throw pauseError;
      });
      on(display, OnDisplayDispose, (d: Display) => {
        heard.push(d);
      });
      const pending = display.nextFrame();

      expect(() => display.dispose()).toThrow(pauseError);

      expect(display.isDisposed).toBe(true);
      expect(display.renderer).toBeUndefined();
      expect(heard).toHaveLength(1);
      expect(display.frameLoop.subscriptionCount).toBe(0);
      expect(getSubscriptionCount(display)).toBe(0);
      expect(doc.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.anything(), expect.anything());
      await expect(pending).rejects.toThrow(/disposed/);

      await settle();
      expect(renderer.dispose).toHaveBeenCalledTimes(1);
      expect(() => display.dispose()).not.toThrow();
    });

    it('a dispose listener that throws: every dispose listener hears dispose, the display is torn down, then dispose() throws its error', async () => {
      const {display, renderer} = makeDisplay();
      await display.start();

      const disposeError = new Error('dispose listener fails on purpose');
      const heard: Display[] = [];
      on(display, OnDisplayDispose, () => {
        throw disposeError;
      });
      on(display, OnDisplayDispose, (d: Display) => {
        heard.push(d);
      });
      const pending = display.nextFrame();

      expect(() => display.dispose()).toThrow(disposeError);

      expect(heard).toHaveLength(1);
      await expect(pending).rejects.toThrow(/disposed/);
      expect(getSubscriptionCount(display)).toBe(0);

      await settle();
      expect(renderer.dispose).toHaveBeenCalledTimes(1);
    });

    it('two dispose listeners that throw make dispose() throw an AggregateError of both errors, after the teardown', async () => {
      const {display, renderer} = makeDisplay();
      await display.start();

      const first = new Error('first dispose listener');
      const second = new Error('second dispose listener');
      on(display, OnDisplayDispose, () => {
        throw first;
      });
      on(display, OnDisplayDispose, () => {
        throw second;
      });

      const thrown = catchError(() => display.dispose());

      expect(thrown).toBeInstanceOf(AggregateError);
      expect((thrown as AggregateError).errors).toEqual([first, second]);

      await settle();
      expect(renderer.dispose).toHaveBeenCalledTimes(1);
    });

    it('a pause listener and a dispose listener that throw make dispose() throw an AggregateError of both errors, after the teardown', async () => {
      const {display, renderer} = makeDisplay();
      await display.start();

      const pauseError = new Error('pause listener fails on purpose');
      const disposeError = new Error('dispose listener fails on purpose');
      on(display, OnDisplayPause, () => {
        throw pauseError;
      });
      on(display, OnDisplayDispose, () => {
        throw disposeError;
      });

      const thrown = catchError(() => display.dispose());

      expect(thrown).toBeInstanceOf(AggregateError);
      expect((thrown as AggregateError).errors).toEqual([pauseError, disposeError]);
      expect((thrown as AggregateError).cause).toBe(disposeError);
      expect((thrown as AggregateError).message).toContain('Display#dispose()');

      await settle();
      expect(renderer.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe('constructor', () => {
    it('releases a renderer it has taken over when the constructor fails after taking it', async () => {
      const failure = new Error('the resizeTo callback fails on purpose');
      const {renderer} = makeRenderer();

      expect(
        () =>
          new Display(renderer as unknown as WebGPURenderer, {
            resizeTo: () => {
              throw failure;
            },
          }),
      ).toThrow(failure);

      await settle();

      expect(renderer.dispose).toHaveBeenCalledTimes(1);
    });

    it('a constructor that fails, and a dispose listener that throws as it takes the display down, throw an AggregateError of both errors and release the renderer', async () => {
      const failure = new Error('the resizeTo callback fails on purpose');
      const disposeError = new Error('dispose listener fails on purpose');
      const {renderer} = makeRenderer();

      let thrown: unknown;
      try {
        new Display(renderer as unknown as WebGPURenderer, {
          resizeTo: (display) => {
            on(display, OnDisplayDispose, () => {
              throw disposeError;
            });
            throw failure;
          },
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AggregateError);
      expect((thrown as AggregateError).errors).toEqual([failure, disposeError]);
      expect((thrown as AggregateError).cause).toBe(disposeError);

      await settle();

      expect(renderer.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe('read-only state', () => {
    it('renderer, frameLoop and frameNo are accessors without a setter', () => {
      const {display} = makeDisplay();

      for (const name of ['renderer', 'frameLoop', 'frameNo']) {
        const descriptor = Object.getOwnPropertyDescriptor(Display.prototype, name);
        expect(descriptor?.get, `${name} has a getter`).toBeTypeOf('function');
        expect(descriptor?.set, `${name} has no setter`).toBeUndefined();

        const before = (display as unknown as Record<string, unknown>)[name];
        expect(() => {
          (display as unknown as Record<string, unknown>)[name] = {};
        }, `a write to ${name}`).toThrow(TypeError);
        expect((display as unknown as Record<string, unknown>)[name], `${name} after the write`).toBe(before);
      }
    });
  });

  describe('visibility', () => {
    it('pauses while the document is hidden, runs again once it is visible, and lets go of the listener on dispose()', async () => {
      const {display, events} = makeDisplay();
      const [, listener] = doc.addEventListener.mock.calls.find(([type]) => type === 'visibilitychange')!;
      await display.start();
      events.length = 0;

      doc.hidden = true;
      listener();

      expect(events).toEqual([OnDisplayPause]);
      expect(display.pause).toBe(true);

      doc.hidden = false;
      listener();

      expect(events).toEqual([OnDisplayPause, OnDisplayRestart, OnDisplayStart]);

      display.dispose();

      expect(doc.removeEventListener).toHaveBeenCalledWith('visibilitychange', listener, false);
    });

    describe('pauseOutsideViewport', () => {
      interface ObserverStub {
        callback: (entries: {isIntersecting: boolean}[]) => void;
        observed: unknown[];
        disconnect: Mock<() => void>;
      }

      let observers: ObserverStub[];

      beforeEach(() => {
        observers = [];
        vi.stubGlobal(
          'IntersectionObserver',
          class {
            readonly stub: ObserverStub;

            constructor(callback: ObserverStub['callback']) {
              this.stub = {callback, observed: [], disconnect: vi.fn()};
              observers.push(this.stub);
            }

            observe(element: unknown) {
              this.stub.observed.push(element);
            }

            disconnect() {
              this.stub.disconnect();
            }
          },
        );
      });

      it('builds no IntersectionObserver without the option', () => {
        makeDisplay();

        expect(observers).toHaveLength(0);
      });

      it('pauses while the canvas is outside the viewport and runs again once it is back', async () => {
        const {display, canvas, events} = makeDisplay({pauseOutsideViewport: true});

        expect(observers).toHaveLength(1);
        const observer = observers[0]!;
        expect(observer.observed).toEqual([canvas]);

        await display.start();
        events.length = 0;

        observer.callback([{isIntersecting: false}]);

        expect(events).toEqual([OnDisplayPause]);

        observer.callback([{isIntersecting: true}]);

        expect(events).toEqual([OnDisplayPause, OnDisplayRestart, OnDisplayStart]);

        display.dispose();

        expect(observer.disconnect).toHaveBeenCalled();
      });

      it('does nothing where IntersectionObserver does not exist', () => {
        vi.stubGlobal('IntersectionObserver', undefined);

        expect(() => makeDisplay({pauseOutsideViewport: true})).not.toThrow();
      });
    });
  });
});
