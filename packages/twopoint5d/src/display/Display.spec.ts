import {on, once} from '@spearwolf/eventize';
import type {WebGPURenderer} from 'three/webgpu';
import {afterEach, beforeEach, describe, expect, it, type Mock, vi} from 'vitest';
import {
  OnDisplayError,
  OnDisplayInit,
  OnDisplayPause,
  OnDisplayRenderFrame,
  OnDisplayRestart,
  OnDisplayStart,
} from '../events.js';
import {Display} from './Display.js';
import type {DisplayParameters} from './types.js';

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
    getBoundingClientRect: () => ({width: 320, height: 200}),
  };
}

/**
 * A display on an adopted renderer stub. A frame is a call of the callback the frame loop handed
 * to `setAnimationLoop()` last, with a timestamp in ms; while that callback is `null`, a frame
 * reaches nobody. Every call builds its own renderer: the rAF driver hangs off the renderer in a
 * WeakMap, so no two tests share one.
 */
function makeDisplay(options?: DisplayParameters, init: () => Promise<unknown> = () => Promise.resolve()) {
  const canvas = makeCanvas();
  let loop: ((now: number) => unknown) | null = null;
  const renderer = {
    isWebGPURenderer: true,
    domElement: canvas,
    init: vi.fn(init),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    setAnimationLoop: vi.fn((callback: ((now: number) => unknown) | null) => {
      loop = callback;
    }),
    dispose: vi.fn(),
  };

  const display = new Display(renderer as unknown as WebGPURenderer, options);
  displays.push(display);

  const events: string[] = [];
  for (const name of LIFECYCLE_EVENTS) {
    on(display, name, () => {
      events.push(name);
    });
  }

  const frame = (now: number) => {
    loop?.(now);
  };

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

    it('resizePollIntervalMs skips the measurement of a resize() within the interval', () => {
      const now = vi.spyOn(performance, 'now').mockReturnValue(5000);
      const {display} = makeDisplay();
      display.resizePollIntervalMs = 100;

      display.resize();
      const measured = getComputedStyleStub.mock.calls.length;

      display.resize();

      expect(getComputedStyleStub.mock.calls.length, 'within the interval').toBe(measured);

      now.mockReturnValue(5100);
      display.resize();

      expect(getComputedStyleStub.mock.calls.length, 'once the interval is over').toBeGreaterThan(measured);
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
