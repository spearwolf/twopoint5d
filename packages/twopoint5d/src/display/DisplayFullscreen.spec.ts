import {afterEach, beforeEach, describe, expect, it, type Mock, vi} from 'vitest';
import {type EventTargetStub, makeEventTarget} from '../testing/eventTargetStub.js';
import type {Display} from './Display.js';
import {DisplayFullscreen, type DisplayFullscreenHost, resetFullscreenWarnings} from './DisplayFullscreen.js';
import {Stylesheets} from './Stylesheets.js';
import type {DisplayFullscreenChangeProps, DisplayFullscreenOptions} from './types.js';

// Stylesheets writes into a real CSSStyleSheet, and there is no document here to hold one
vi.mock('./Stylesheets.js', () => ({
  Stylesheets: {
    retainRule: vi.fn((name: string) => name),
    releaseRule: vi.fn(),
  },
}));

interface DocStub extends EventTargetStub {
  fullscreenEnabled: boolean;
  fullscreenElement: unknown;
  exitFullscreen: Mock<() => Promise<void>>;
  head: object;
  documentElement: {classList: {add: Mock; remove: Mock}};
}

interface TargetStub extends EventTargetStub {
  name: string;
  classList: {add: Mock; remove: Mock};
  getRootNode: () => {fullscreenElement: unknown};
  requestFullscreen: Mock<(options?: unknown) => Promise<void>>;
  // what a fullscreen stacked on the target is read by: `:fullscreen` and the element on top inside it
  matches: Mock<(selector: string) => boolean>;
  contains: Mock<(other: unknown) => boolean>;
}

let doc: DocStub;
let host: DisplayFullscreenHost;
// the window of the host; a test gives it a screen and a matchMedia where it needs them
let view: {screen?: unknown; matchMedia?: unknown};
let defaultTarget: TargetStub;
let emitted: DisplayFullscreenChangeProps[];
let warn: Mock;
const display = {} as Display;
const controllers: DisplayFullscreen[] = [];

// as the browser does it: the element becomes the fullscreen element of its root, then the
// document hears fullscreenchange
function fireFullscreenChange(element: unknown) {
  doc.fullscreenElement = element;
  doc.dispatch('fullscreenchange');
}

function makeDoc(): DocStub {
  const stub = makeEventTarget() as DocStub;
  stub.fullscreenEnabled = true;
  stub.fullscreenElement = null;
  stub.head = {};
  stub.documentElement = {classList: {add: vi.fn(), remove: vi.fn()}};
  stub.exitFullscreen = vi.fn(() => {
    fireFullscreenChange(null);
    return Promise.resolve();
  });
  return stub;
}

function makeTarget(name: string, root: {fullscreenElement: unknown} = doc): TargetStub {
  const stub = makeEventTarget() as TargetStub;
  stub.name = name;
  stub.classList = {add: vi.fn(), remove: vi.fn()};
  stub.getRootNode = () => root;
  // a request the browser grants
  stub.requestFullscreen = vi.fn(() => {
    fireFullscreenChange(stub);
    return Promise.resolve();
  });
  stub.matches = vi.fn(() => false);
  stub.contains = vi.fn(() => false);
  return stub;
}

/**
 * A request of `target` the browser answers when the test says so: `grant()` makes the target the
 * fullscreen element, fires fullscreenchange and resolves; `refuse()` rejects. With `fire: false`
 * the grant fires nothing, as a browser that fires the event only in a later rendering update.
 */
function answerLater(target: TargetStub, {fire = true}: {fire?: boolean} = {}) {
  const answer = {grant: () => {}, refuse: () => {}};
  target.requestFullscreen.mockImplementationOnce(
    () =>
      new Promise<void>((resolve, reject) => {
        answer.grant = () => {
          if (fire) fireFullscreenChange(target);
          else doc.fullscreenElement = target;
          resolve();
        };
        answer.refuse = () => reject(new TypeError('no gesture'));
      }),
  );
  return answer;
}

/** An exit the browser finishes when the test says so: `finish()` leaves and resolves. */
function exitLater() {
  const exit = {finish: () => {}};
  doc.exitFullscreen.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        exit.finish = () => {
          fireFullscreenChange(null);
          resolve();
        };
      }),
  );
  return exit;
}

/**
 * An element inside `target` goes fullscreen, a video or a dialog of the app: it lies on top, and
 * the target stays in the fullscreen stack below it.
 */
function stackOn(target: TargetStub): TargetStub {
  const child = makeTarget('child');
  target.matches.mockImplementation((selector) => selector === ':fullscreen');
  target.contains.mockImplementation((other) => other === child);
  fireFullscreenChange(child);
  return child;
}

/**
 * Another element goes fullscreen while the target is not in the fullscreen stack: a video or a
 * dialog of the app that goes fullscreen on its own — inside the target, or anywhere else on the
 * page. With `fire: false` the browser has made it the fullscreen element and fires the event only
 * in a later rendering update.
 */
function otherGoesFullscreen(
  target: TargetStub,
  {inside = false, fire = true}: {inside?: boolean; fire?: boolean} = {},
): TargetStub {
  const other = makeTarget(inside ? 'video inside the target' : 'video');
  if (inside) target.contains.mockImplementation((element) => element === other);
  if (fire) fireFullscreenChange(other);
  else doc.fullscreenElement = other;
  return other;
}

function make(options?: DisplayFullscreenOptions): DisplayFullscreen {
  const controller = new DisplayFullscreen(display, host, options);
  controllers.push(controller);
  return controller;
}

const asElement = (target: TargetStub) => target as unknown as HTMLElement;

// lets every reaction to a settled answer of the browser run: they are microtasks
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** What a promise has come to by the next task: its value, `'rejected'`, or `'unsettled'`. */
function outcomeOf(promise: Promise<boolean>): Promise<boolean | 'rejected' | 'unsettled'> {
  return Promise.race([
    promise.then(
      (value) => value,
      () => 'rejected' as const,
    ),
    nextTask().then(() => 'unsettled' as const),
  ]);
}

describe('DisplayFullscreen', () => {
  beforeEach(() => {
    resetFullscreenWarnings();
    doc = makeDoc();
    defaultTarget = makeTarget('default');
    emitted = [];
    view = {};
    host = {
      doc: doc as unknown as Document,
      view: view as unknown as Window & typeof globalThis,
      defaultElement: () => asElement(defaultTarget),
      emit: (props) => {
        emitted.push(props);
      },
      pseudoTargetChanged: vi.fn(),
      styleSheetRoot: () => doc.head as HTMLElement,
    };
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) as unknown as Mock;
  });

  afterEach(() => {
    for (const controller of controllers.splice(0)) controller.dispose();
  });

  describe('request()', () => {
    it('calls requestFullscreen with navigationUI "hide" before its first await', () => {
      const fs = make();
      void fs.request();
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledWith({navigationUI: 'hide'});
    });

    it('passes the navigationUI of the options', () => {
      const fs = make({navigationUI: 'show'});
      void fs.request();
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledWith({navigationUI: 'show'});
    });

    it('resolves true once the browser has granted it', async () => {
      const fs = make();
      await expect(fs.request()).resolves.toBe(true);
      expect(fs.isActive).toBe(true);
      expect(fs.mode).toBe('native');
    });

    it('a refused request resolves false, emits nothing and warns once per page', async () => {
      defaultTarget.requestFullscreen.mockImplementation(() => Promise.reject(new TypeError('Permissions check failed')));
      const fs = make();

      await expect(fs.request()).resolves.toBe(false);
      await expect(fs.request()).resolves.toBe(false);

      expect(emitted).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('user gesture');
    });

    it('a fullscreenerror the browser fires beside the refusal of a request is not heard as a second refusal: the request resolves false, emits nothing and warns once', async () => {
      // the stub lets nothing bubble up, so the event goes to the target and to the document
      defaultTarget.requestFullscreen.mockImplementation(() => {
        defaultTarget.dispatch('fullscreenerror');
        doc.dispatch('fullscreenerror');
        return Promise.reject(new TypeError('Permissions check failed'));
      });
      const fs = make();

      await expect(fs.request()).resolves.toBe(false);

      expect(emitted).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('a fullscreenerror of another element changes nothing: no event, no warning', async () => {
      const fs = make();
      await fs.request();
      const count = emitted.length;

      doc.dispatch('fullscreenerror');
      await Promise.resolve();
      await Promise.resolve();

      expect(fs.isActive).toBe(true);
      expect(emitted).toHaveLength(count);
      expect(warn).not.toHaveBeenCalled();
    });

    it('a request that throws synchronously resolves false as well', async () => {
      defaultTarget.requestFullscreen.mockImplementation(() => {
        throw new TypeError('not allowed');
      });
      const fs = make();

      await expect(fs.request()).resolves.toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('a request without native support and without fallback resolves false and warns once', async () => {
      doc.fullscreenEnabled = false;
      const fs = make();

      expect(fs.isSupported).toBe(false);
      expect(fs.isAvailable).toBe(false);
      await expect(fs.request()).resolves.toBe(false);
      await expect(fs.request()).resolves.toBe(false);

      expect(defaultTarget.requestFullscreen).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('allow="fullscreen"');
      expect(String(warn.mock.calls[0]?.[0])).toContain("fallback = 'pseudo'");
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('unprefixed Fullscreen API'));
    });

    it('two request() calls while the browser has not answered share one request', async () => {
      const answer = answerLater(defaultTarget);
      const fs = make();

      const first = fs.request();
      const second = fs.request();
      answer.grant();

      expect(second).toBe(first);
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      await expect(first).resolves.toBe(true);
      await expect(second).resolves.toBe(true);
    });

    it('a request while active resolves true and calls nothing', async () => {
      const fs = make();
      await fs.request();
      defaultTarget.requestFullscreen.mockClear();

      await expect(fs.request()).resolves.toBe(true);
      expect(defaultTarget.requestFullscreen).not.toHaveBeenCalled();
    });

    it('the default target is read from the host at each request while no element is set', async () => {
      const fs = make();
      const later = makeTarget('later');
      defaultTarget = later;

      await fs.request();

      expect(later.requestFullscreen).toHaveBeenCalled();
      expect(fs.element).toBe(asElement(later));
    });

    it('an element of the options is the target', async () => {
      const own = makeTarget('own');
      const fs = make({element: asElement(own)});

      await fs.request();

      expect(own.requestFullscreen).toHaveBeenCalled();
      expect(defaultTarget.requestFullscreen).not.toHaveBeenCalled();
    });
  });

  describe('toggle()', () => {
    it('reaches requestFullscreen synchronously while not active', () => {
      const fs = make();
      void fs.toggle();
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('leaves while active and resolves with the state afterwards', async () => {
      const fs = make();
      await expect(fs.toggle()).resolves.toBe(true);
      await expect(fs.toggle()).resolves.toBe(false);
      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
    });

    it('a listener of the change a granted request causes finds the request settled: its toggle() leaves', async () => {
      // the browser fires fullscreenchange after the promise: the change goes out from the answer
      const answer = answerLater(defaultTarget, {fire: false});
      const fs = make();
      let toggled: Promise<boolean> | undefined;
      host.emit = (props) => {
        emitted.push(props);
        if (props.isActive && toggled == null) toggled = fs.toggle();
      };

      const requested = fs.request();
      answer.grant();

      await expect(requested).resolves.toBe(false);
      await expect(toggled).resolves.toBe(false);
      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
    });
  });

  describe('state', () => {
    it('isActive follows fullscreenchange, also for an exit the controller did not start', () => {
      const fs = make();

      fireFullscreenChange(defaultTarget);
      expect(fs.isActive).toBe(true);
      expect(fs.mode).toBe('native');

      fireFullscreenChange(null);
      expect(fs.isActive).toBe(false);
      expect(fs.mode).toBeUndefined();
    });

    it('isActive asks the root node of the target', () => {
      const shadowRoot = {fullscreenElement: null as unknown};
      const inShadow = makeTarget('in-shadow', shadowRoot);
      const fs = make({element: asElement(inShadow)});

      // the document names the shadow host, the shadow root names the element
      shadowRoot.fullscreenElement = inShadow;
      fireFullscreenChange({name: 'shadow-host'});

      expect(fs.isActive).toBe(true);
    });

    it('emits OnDisplayFullscreenChange once per change of isActive or mode, with the props of §3.3', () => {
      make();

      fireFullscreenChange(defaultTarget);
      fireFullscreenChange(defaultTarget);

      expect(emitted).toEqual([{display, isActive: true, mode: 'native', isArmed: false, element: asElement(defaultTarget)}]);

      fireFullscreenChange(null);
      expect(emitted).toHaveLength(2);
      expect(emitted[1]).toMatchObject({isActive: false, mode: undefined});
    });

    it('a new element while a request is pending: isActive follows the element requested', async () => {
      let grant: () => void = () => {};
      defaultTarget.requestFullscreen.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            grant = () => {
              fireFullscreenChange(defaultTarget);
              resolve();
            };
          }),
      );
      const fs = make();
      const requested = fs.request();
      fs.element = asElement(makeTarget('next'));

      grant();

      await expect(requested).resolves.toBe(true);
      expect(fs.isActive).toBe(true);
    });

    it('a new element takes effect with the next request; isActive stays on the element it entered with', async () => {
      const fs = make();
      await fs.request();

      const next = makeTarget('next');
      fs.element = asElement(next);
      expect(fs.isActive).toBe(true);

      await expect(fs.exit()).resolves.toBe(false);
      await fs.request();

      expect(next.requestFullscreen).toHaveBeenCalledTimes(1);
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it("a fullscreen stacked on the target: isActive is false while it holds, and the target is the controller's own again once it is left", async () => {
      const orientation = {type: 'portrait-primary', lock: vi.fn(() => Promise.resolve()), unlock: vi.fn()};
      view.screen = {orientation};
      const fs = make({orientationLock: 'landscape'});
      await fs.request();
      await Promise.resolve();
      expect(orientation.lock).toHaveBeenCalledTimes(1);

      stackOn(defaultTarget);

      expect(fs.isActive).toBe(false);
      expect(emitted.at(-1)).toMatchObject({isActive: false});
      expect(orientation.unlock).not.toHaveBeenCalled();

      fireFullscreenChange(defaultTarget);
      expect(fs.isActive).toBe(true);

      fs.dispose();
      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
      expect(orientation.unlock).toHaveBeenCalledTimes(1);
    });

    it('a lock still pending when a fullscreen stacks on the target holds once the browser grants it', async () => {
      let grantLock: () => void = () => {};
      const orientation = {
        type: 'portrait-primary',
        lock: vi.fn(() => new Promise<void>((resolve) => (grantLock = resolve))),
        unlock: vi.fn(),
      };
      view.screen = {orientation};
      const fs = make({orientationLock: 'landscape'});
      await fs.request();

      stackOn(defaultTarget);
      grantLock();
      await Promise.resolve();

      expect(orientation.unlock).not.toHaveBeenCalled();
      expect(fs.exitOnPortrait, 'the lock holds').toBe(false);

      fireFullscreenChange(defaultTarget);
      fs.dispose();
      expect(orientation.unlock).toHaveBeenCalledTimes(1);
    });
  });

  describe('exit()', () => {
    it('calls exitFullscreen only while the target is the fullscreen element of its root', async () => {
      const fs = make();

      fireFullscreenChange(makeTarget('someone-else'));

      await expect(fs.exit()).resolves.toBe(false);
      expect(doc.exitFullscreen).not.toHaveBeenCalled();
    });

    it('resolves false once left', async () => {
      const fs = make();
      await fs.request();

      await expect(fs.exit()).resolves.toBe(false);
      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isActive).toBe(false);
    });

    it('request() while an exit is under way asks the browser again once the exit is through', async () => {
      const fs = make();
      await fs.request();
      const exit = exitLater();

      const exited = fs.exit();
      const requested = fs.request();
      await Promise.resolve();
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);

      exit.finish();

      // both calls resolve with the end the last one asked for
      await expect(exited).resolves.toBe(true);
      await expect(requested).resolves.toBe(true);
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
      expect(fs.isActive).toBe(true);
    });

    it('exit() while a request is pending leaves once the browser has granted it', async () => {
      const answer = answerLater(defaultTarget);
      const fs = make();

      const requested = fs.request();
      const exited = fs.exit();
      await Promise.resolve();
      expect(doc.exitFullscreen).not.toHaveBeenCalled();

      answer.grant();

      await expect(exited).resolves.toBe(false);
      await expect(requested).resolves.toBe(false);
      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isActive).toBe(false);
    });

    it('toggle() and exit() while an exit is under way answer with that exit', async () => {
      const fs = make();
      await fs.request();
      const exit = exitLater();

      const first = fs.exit();
      const toggled = fs.toggle();
      const second = fs.exit();
      exit.finish();

      await expect(first).resolves.toBe(false);
      await expect(toggled).resolves.toBe(false);
      await expect(second).resolves.toBe(false);
      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
    });
  });

  describe('overlapping calls: the last call of the page wins', () => {
    type Call = 'request' | 'exit' | 'toggle';
    type Start = 'a request is open' | 'an exit is under way';
    const CALLS: Call[] = ['request', 'exit', 'toggle'];
    // every follow-up of up to two calls; after an exit, one that starts with request() is held
    // back behind the exit
    const FOLLOW_UPS: Call[][] = [
      [],
      ...CALLS.map((call) => [call]),
      ...CALLS.flatMap((first) => CALLS.map((second) => [first, second])),
    ];

    // The rule the rows are made of. While the browser is still answering, a toggle() goes by the
    // state the page was last told — not active while a request is open, active while an exit is
    // under way —, and the last call says where the fullscreen ends, as far as the browser grants it.
    // Every promise resolves once, with isActive at that end
    function endsIn(start: Start, calls: Call[]): boolean {
      const last = calls.at(-1);
      return last === 'request' || (last === 'toggle' && start === 'a request is open');
    }

    interface Row {
      name: string;
      start: Start;
      calls: Call[];
      grants: boolean;
      active: boolean;
      requests: number;
      exits: number;
    }

    const rows: Row[] = (['a request is open', 'an exit is under way'] as Start[]).flatMap((start) =>
      FOLLOW_UPS.flatMap((followUps) =>
        [true, false].map((grants): Row => {
          const calls: Call[] = [start === 'a request is open' ? 'request' : 'exit', ...followUps];
          const enters = endsIn(start, calls);
          const active = enters && grants;
          // an exit under way follows a granted request(); one held back behind it asks the browser again
          const requests = start === 'a request is open' ? 1 : enters ? 2 : 1;
          const exits = start === 'a request is open' ? (grants && !enters ? 1 : 0) : 1;
          const answer =
            start === 'a request is open'
              ? grants
                ? 'grants it'
                : 'refuses it'
              : grants
                ? 'grants a request'
                : 'refuses a request';
          return {
            name: `${start}: ${calls.map((call) => `${call}()`).join(' → ')}, the browser ${answer} → ${active ? 'active' : 'not active'}`,
            start,
            calls,
            grants,
            active,
            requests,
            exits,
          };
        }),
      ),
    );

    // a loop rather than it.each: it.each cuts an interpolated name at 40 characters
    for (const {name, start, calls, grants, active, requests, exits} of rows)
      it(name, async () => {
        const fs = make();
        let answer: ReturnType<typeof answerLater> | undefined;
        let exit: ReturnType<typeof exitLater> | undefined;
        if (start === 'a request is open') {
          answer = answerLater(defaultTarget);
        } else {
          await fs.request();
          exit = exitLater();
          if (!grants) defaultTarget.requestFullscreen.mockImplementationOnce(() => Promise.reject(new TypeError('no gesture')));
        }

        const promises = calls.map((call) => fs[call]());
        if (answer != null) {
          if (grants) answer.grant();
          else answer.refuse();
        }
        exit?.finish();
        await nextTask();

        expect(await Promise.all(promises.map(outcomeOf))).toEqual(calls.map(() => active));
        expect(fs.isActive).toBe(active);
        expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(requests);
        expect(doc.exitFullscreen).toHaveBeenCalledTimes(exits);
        expect(emitted.at(-1)?.isActive ?? false).toBe(active);
      });

    it('a listener of the event during requestFullscreen() was told active: its toggle() leaves once the browser has granted', async () => {
      // a browser that fires fullscreenchange before the promise of requestFullscreen() settles
      let resolveRequest: () => void = () => {};
      defaultTarget.requestFullscreen.mockImplementationOnce(() => {
        fireFullscreenChange(defaultTarget);
        return new Promise<void>((resolve) => (resolveRequest = resolve));
      });
      const fs = make();
      let toggled: Promise<boolean> | undefined;
      host.emit = (props) => {
        emitted.push(props);
        if (props.isActive && toggled == null) toggled = fs.toggle();
      };

      const requested = fs.request();
      expect(toggled).toBeDefined();
      resolveRequest();
      await nextTask();

      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
      await expect(requested).resolves.toBe(false);
      await expect(toggled).resolves.toBe(false);
      expect(fs.isActive).toBe(false);
    });
  });

  describe('dispose()', () => {
    it('leaves a fullscreen this controller entered', async () => {
      const fs = make();
      await fs.request();

      fs.dispose();

      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
    });

    it('leaves a fullscreen it did not enter alone', () => {
      const fs = make();
      fireFullscreenChange(defaultTarget);

      fs.dispose();

      expect(doc.exitFullscreen).not.toHaveBeenCalled();
    });

    it('takes its fullscreenchange listener off the document', () => {
      const fs = make();
      expect(doc.listenerCount('fullscreenchange')).toBe(1);

      fs.dispose();

      expect(doc.listenerCount('fullscreenchange')).toBe(0);
    });

    it('a request after dispose() resolves false and calls nothing', async () => {
      const fs = make();
      fs.dispose();

      await expect(fs.request()).resolves.toBe(false);
      expect(defaultTarget.requestFullscreen).not.toHaveBeenCalled();
    });

    it('dispose() takes everything down before its one event: a host whose emit throws finds the pseudo mode left and no listener left', async () => {
      doc.fullscreenEnabled = false;
      const fs = make({fallback: 'pseudo'});
      await fs.request();
      const error = new Error('emit fails on purpose');
      host.emit = () => {
        throw error;
      };

      expect(() => fs.dispose()).toThrow(error);

      expect(doc.listenerCount('keydown')).toBe(0);
      expect(doc.listenerCount('fullscreenchange')).toBe(0);
      expect(fs.mode).toBeUndefined();
      expect(fs.isDisposed).toBe(true);
      expect(() => fs.dispose()).not.toThrow();
    });

    it('dispose() while a request is pending: the controller leaves the fullscreen the browser grants afterwards, and the request resolves false', async () => {
      const orientation = {type: 'portrait-primary', lock: vi.fn(() => Promise.resolve()), unlock: vi.fn()};
      view.screen = {orientation};
      const answer = answerLater(defaultTarget);
      const fs = make({orientationLock: 'landscape'});

      const requested = fs.request();
      fs.dispose();
      answer.grant();

      await expect(requested).resolves.toBe(false);
      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
      expect(orientation.lock).not.toHaveBeenCalled();
    });

    it('dispose() while a lock is pending: the lock is undone once the browser grants it', async () => {
      let grantLock: () => void = () => {};
      const orientation = {
        type: 'portrait-primary',
        lock: vi.fn(() => new Promise<void>((resolve) => (grantLock = resolve))),
        unlock: vi.fn(),
      };
      view.screen = {orientation};
      const fs = make({orientationLock: 'landscape'});
      await fs.request();
      expect(orientation.lock).toHaveBeenCalledTimes(1);

      fs.dispose();
      grantLock();
      await Promise.resolve();

      expect(orientation.unlock).toHaveBeenCalledTimes(1);
      expect(fs.exitOnPortrait).toBe(true);
    });

    it('dispose() while an exit is under way leaves nothing a second time', async () => {
      const fs = make();
      await fs.request();
      const exit = exitLater();

      const exited = fs.exit();
      fs.dispose();
      exit.finish();

      await expect(exited).resolves.toBe(false);
      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
    });

    it('isDisposed is false until dispose() and true after', () => {
      const fs = make();
      expect(fs.isDisposed).toBe(false);

      fs.dispose();

      expect(fs.isDisposed).toBe(true);
    });

    it('isAvailable answers false after dispose()', () => {
      const fs = make({fallback: 'pseudo'});
      expect(fs.isAvailable).toBe(true);

      fs.dispose();

      expect(fs.isAvailable).toBe(false);
      expect(fs.isSupported).toBe(true);
    });

    it('exit() and toggle() after dispose() resolve false and call nothing', async () => {
      const fs = make();
      fireFullscreenChange(defaultTarget);
      fs.dispose();

      await expect(fs.exit()).resolves.toBe(false);
      await expect(fs.toggle()).resolves.toBe(false);
      expect(doc.exitFullscreen).not.toHaveBeenCalled();
      expect(fs.isActive).toBe(true);
    });
  });
  describe('orientationLock', () => {
    interface OrientationStub extends EventTargetStub {
      type: string;
      lock: Mock<(type: string) => Promise<void>>;
      unlock: Mock<() => void>;
    }

    let orientation: OrientationStub;

    beforeEach(() => {
      orientation = makeEventTarget() as OrientationStub;
      orientation.type = 'portrait-primary';
      orientation.lock = vi.fn(() => Promise.resolve());
      orientation.unlock = vi.fn();
      view.screen = {orientation};
    });

    it('locks the screen after native fullscreen is entered', async () => {
      const fs = make({orientationLock: 'landscape'});
      expect(fs.orientationLock).toBe('landscape');

      await fs.request();

      expect(orientation.lock).toHaveBeenCalledWith('landscape');
    });

    it('does not lock without orientationLock', async () => {
      const fs = make();
      await fs.request();
      expect(orientation.lock).not.toHaveBeenCalled();
    });

    it('unlocks after leaving', async () => {
      const fs = make({orientationLock: 'landscape'});
      await fs.request();
      await Promise.resolve();

      await fs.exit();

      expect(orientation.unlock).toHaveBeenCalledTimes(1);
    });

    it('unlocks only where it locked', async () => {
      orientation.lock.mockImplementation(() => Promise.reject(new DOMException('no', 'NotSupportedError')));
      const fs = make({orientationLock: 'landscape'});
      await fs.request();
      await Promise.resolve();

      await fs.exit();

      expect(orientation.unlock).not.toHaveBeenCalled();
    });

    it('swallows a refused lock without a warning', async () => {
      orientation.lock.mockImplementation(() => Promise.reject(new DOMException('no', 'NotSupportedError')));
      const fs = make({orientationLock: 'landscape'});

      await expect(fs.request()).resolves.toBe(true);
      await Promise.resolve();

      expect(warn).not.toHaveBeenCalled();
    });

    it('a window without screen.orientation.lock enters fullscreen all the same', async () => {
      view.screen = {orientation: {type: 'portrait-primary'}};
      const fs = make({orientationLock: 'landscape'});

      await expect(fs.request()).resolves.toBe(true);
    });

    it('dispose() undoes a lock it set', async () => {
      const fs = make({orientationLock: 'landscape'});
      await fs.request();
      await Promise.resolve();

      fs.dispose();

      expect(orientation.unlock).toHaveBeenCalledTimes(1);
    });
  });
  describe('onLandscape', () => {
    interface OrientationStub extends EventTargetStub {
      type: string;
      lock: Mock<(type: string) => Promise<void>>;
      unlock: Mock<() => void>;
    }
    interface QueryStub extends EventTargetStub {
      matches: boolean;
    }

    let orientation: OrientationStub;
    let coarse: QueryStub;
    let landscapeQuery: QueryStub;

    function makeQuery(matches: boolean): QueryStub {
      const query = makeEventTarget() as QueryStub;
      query.matches = matches;
      return query;
    }

    // the screen turns, and screen.orientation reports it
    function turn(type: string) {
      orientation.type = type;
      orientation.dispatch('change');
    }

    // lets the reactions to the settled request of a turn run
    const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    const tap = (pointerType = 'touch') => defaultTarget.dispatch('pointerup', {type: 'pointerup', pointerType});

    beforeEach(() => {
      orientation = makeEventTarget() as OrientationStub;
      orientation.type = 'portrait-primary';
      orientation.lock = vi.fn(() => Promise.resolve());
      orientation.unlock = vi.fn();
      coarse = makeQuery(true);
      landscapeQuery = makeQuery(false);
      view.screen = {orientation};
      view.matchMedia = vi.fn((query: string) => (query === '(orientation: landscape)' ? landscapeQuery : coarse));
    });

    it('a turn to landscape requests fullscreen at once', async () => {
      const fs = make({onLandscape: true});

      turn('landscape-primary');

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      await flush();
      expect(fs.isActive).toBe(true);
    });

    it('a refused turn arms; the next pointerup of a touch on the target requests and disarms', async () => {
      defaultTarget.requestFullscreen.mockImplementationOnce(() => Promise.reject(new TypeError('no gesture')));
      const fs = make({onLandscape: true});

      turn('landscape-primary');
      await flush();

      expect(fs.isArmed).toBe(true);
      expect(emitted.at(-1)).toMatchObject({isActive: false, isArmed: true});

      tap('mouse');
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);

      tap('touch');
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
      expect(fs.isArmed).toBe(false);
      await flush();
      expect(fs.isActive).toBe(true);
    });

    it('a click on the target requests as well while armed', async () => {
      defaultTarget.requestFullscreen.mockImplementationOnce(() => Promise.reject(new TypeError('no gesture')));
      make({onLandscape: true});
      turn('landscape-primary');
      await flush();

      defaultTarget.dispatch('click', {type: 'click'});

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
    });

    it('the armed listeners are capture, passive, and do not prevent the default', async () => {
      orientation.type = 'landscape-primary';
      make({onLandscape: true});

      const options = defaultTarget.addEventListener.mock.calls.filter(([type]) => type === 'pointerup').map(([, , o]) => o);
      expect(options).toEqual([{capture: true, passive: true}]);

      const preventDefault = vi.fn();
      defaultTarget.dispatch('pointerup', {type: 'pointerup', pointerType: 'touch', preventDefault});
      expect(preventDefault).not.toHaveBeenCalled();
    });

    it('a turn to portrait disarms', async () => {
      orientation.type = 'landscape-primary';
      const fs = make({onLandscape: true});
      expect(fs.isArmed).toBe(true);

      turn('portrait-primary');

      expect(fs.isArmed).toBe(false);
      expect(defaultTarget.listenerCount('pointerup')).toBe(0);
    });

    it('a turn to portrait leaves a fullscreen that onLandscape entered', async () => {
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();

      turn('portrait-primary');
      await flush();

      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isActive).toBe(false);
    });

    it('a turn to portrait leaves a fullscreen that request() entered alone', async () => {
      const fs = make({onLandscape: true});
      await fs.request();

      turn('landscape-primary');
      turn('portrait-primary');
      await flush();

      expect(doc.exitFullscreen).not.toHaveBeenCalled();
      expect(fs.isActive).toBe(true);
    });

    it('exitOnPortrait false keeps the fullscreen on the turn back', async () => {
      const fs = make({onLandscape: true, exitOnPortrait: false});
      turn('landscape-primary');
      await flush();

      turn('portrait-primary');
      await flush();

      expect(doc.exitFullscreen).not.toHaveBeenCalled();
      expect(fs.isActive).toBe(true);
    });

    it('the user leaving in landscape holds off a half turn to the other landscape', async () => {
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();

      // Escape, the back gesture: the browser leaves, the controller did not ask
      fireFullscreenChange(null);
      turn('landscape-secondary');
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isArmed).toBe(false);
    });

    it('the user leaving in landscape a fullscreen the page entered holds off a half turn until portrait and back', async () => {
      orientation.type = 'landscape-primary';
      const fs = make({onLandscape: true});
      await fs.request();

      // Escape, the back gesture: the browser leaves, the controller did not ask
      fireFullscreenChange(null);
      turn('landscape-secondary');
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isArmed).toBe(false);

      turn('portrait-primary');
      turn('landscape-primary');
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
    });

    it('the user leaving in landscape a fullscreen someone else entered on the target holds off a half turn', async () => {
      orientation.type = 'landscape-primary';
      make({onLandscape: true});
      fireFullscreenChange(defaultTarget);

      fireFullscreenChange(null);
      turn('landscape-secondary');
      await flush();

      expect(defaultTarget.requestFullscreen).not.toHaveBeenCalled();

      turn('portrait-primary');
      turn('landscape-primary');
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('an exit() of the page in landscape on a fullscreen the page entered holds off the arming', async () => {
      orientation.type = 'landscape-primary';
      const fs = make({onLandscape: true});
      await fs.request();

      await fs.exit();
      turn('landscape-secondary');
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isArmed).toBe(false);
    });

    it.each([{grants: true}, {grants: false}])(
      'an exit() of the page in landscape while its own request() is pending holds off the arming and disarms, however the browser answers (the browser grants: $grants)',
      async ({grants}) => {
        orientation.type = 'landscape-primary';
        const fs = make({onLandscape: true});
        expect(fs.isArmed).toBe(true);
        const answer = answerLater(defaultTarget);

        const requested = fs.request();
        const exited = fs.exit();
        if (grants) answer.grant();
        else answer.refuse();
        await flush();

        expect(await outcomeOf(requested)).toBe(false);
        expect(await outcomeOf(exited)).toBe(false);
        expect(fs.isActive).toBe(false);
        expect(fs.isArmed).toBe(false);
        expect(defaultTarget.listenerCount('pointerup')).toBe(0);

        turn('landscape-secondary');
        await flush();

        expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      },
    );

    it('the user leaving a fullscreen the armed tap entered holds off as well', async () => {
      defaultTarget.requestFullscreen.mockImplementationOnce(() => Promise.reject(new TypeError('no gesture')));
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();
      tap();
      await flush();
      expect(fs.isActive).toBe(true);

      fireFullscreenChange(null);
      turn('landscape-secondary');
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
      expect(fs.isArmed).toBe(false);
    });

    it("a toggle() while the request of the armed tap is pending joins that request, and the fullscreen is the page's own", async () => {
      defaultTarget.requestFullscreen.mockImplementationOnce(() => Promise.reject(new TypeError('no gesture')));
      let grant: () => void = () => {};
      defaultTarget.requestFullscreen.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            grant = () => {
              fireFullscreenChange(defaultTarget);
              resolve();
            };
          }),
      );
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();

      // the tap on a button inside the target: the armed listener first, the button's click after
      tap();
      const toggled = fs.toggle();
      grant();

      await expect(toggled).resolves.toBe(true);
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);

      // the button of the page carries the request: the fullscreen is the page's own, and the turn
      // back leaves it standing, as it would without the armed tap
      turn('portrait-primary');
      await flush();
      expect(doc.exitFullscreen).not.toHaveBeenCalled();
      expect(fs.isActive).toBe(true);
    });

    it('the user leaving in landscape holds off arming until portrait and back', async () => {
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();

      // Escape, the back gesture: the browser leaves, the controller did not ask
      fireFullscreenChange(null);
      tap();

      expect(fs.isArmed).toBe(false);
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);

      turn('portrait-primary');
      turn('landscape-primary');

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
    });

    it('a fine pointer keeps onLandscape out', async () => {
      coarse.matches = false;
      const fs = make({onLandscape: true});

      turn('landscape-primary');
      await flush();

      expect(defaultTarget.requestFullscreen).not.toHaveBeenCalled();
      expect(fs.isArmed).toBe(false);
    });

    it('a page that loads in landscape arms and does not request', () => {
      orientation.type = 'landscape-secondary';
      const fs = make({onLandscape: true});

      expect(fs.isArmed).toBe(true);
      expect(defaultTarget.requestFullscreen).not.toHaveBeenCalled();
    });

    it('without screen.orientation the media query decides', () => {
      view.screen = {};
      make({onLandscape: true});

      landscapeQuery.matches = true;
      landscapeQuery.dispatch('change');

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('onLandscape = false disarms and takes the listeners down', () => {
      orientation.type = 'landscape-primary';
      const fs = make({onLandscape: true});
      expect(orientation.listenerCount('change')).toBe(1);

      fs.onLandscape = false;

      expect(fs.isArmed).toBe(false);
      expect(orientation.listenerCount('change')).toBe(0);
      expect(defaultTarget.listenerCount('pointerup')).toBe(0);
      expect(defaultTarget.listenerCount('click')).toBe(0);
    });

    it('onLandscape = false leaves a fullscreen in progress alone', async () => {
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();

      fs.onLandscape = false;

      expect(fs.isActive).toBe(true);
      expect(doc.exitFullscreen).not.toHaveBeenCalled();
    });

    it('onLandscape = true at runtime arms a page that is in landscape', () => {
      orientation.type = 'landscape-primary';
      const fs = make();

      fs.onLandscape = true;

      expect(fs.isArmed).toBe(true);
    });

    it('a request() of the page on an armed display disarms once the target is in fullscreen, and leaving it in landscape arms nothing', async () => {
      orientation.type = 'landscape-primary';
      const fs = make({onLandscape: true});
      expect(fs.isArmed).toBe(true);

      await fs.request();

      expect(fs.isActive).toBe(true);
      expect(fs.isArmed).toBe(false);
      expect(emitted.at(-1)).toMatchObject({isActive: true, isArmed: false});
      expect(emitted.some((props) => props.isActive && props.isArmed)).toBe(false);
      expect(defaultTarget.listenerCount('pointerup')).toBe(0);
      expect(defaultTarget.listenerCount('click')).toBe(0);

      // Escape while the screen is still landscape
      fireFullscreenChange(null);
      expect(fs.isArmed).toBe(false);
      tap('touch');
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('a fullscreen someone else enters on the target disarms', () => {
      orientation.type = 'landscape-primary';
      const fs = make({onLandscape: true});

      fireFullscreenChange(defaultTarget);

      expect(fs.isActive).toBe(true);
      expect(fs.isArmed).toBe(false);
      expect(emitted.at(-1)).toMatchObject({isActive: true, isArmed: false});
    });

    it('a half turn of an armed display asks again, and the fullscreen the browser grants is not armed', async () => {
      orientation.type = 'landscape-primary';
      const fs = make({onLandscape: true});
      expect(fs.isArmed).toBe(true);

      turn('landscape-secondary');
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isActive).toBe(true);
      expect(fs.isArmed).toBe(false);
    });

    it('onLandscape = true beside a request() the browser has not answered arms nothing, and nothing once the browser grants it', async () => {
      orientation.type = 'landscape-primary';
      const answer = answerLater(defaultTarget);
      const fs = make();
      const requested = fs.request();

      fs.onLandscape = true;
      expect(fs.isArmed).toBe(false);

      answer.grant();
      await expect(requested).resolves.toBe(true);
      await flush();

      expect(fs.isArmed).toBe(false);
      expect(emitted.some((props) => props.isArmed)).toBe(false);
    });

    it('onLandscape = true beside a request() the browser refuses arms once the refusal is in', async () => {
      orientation.type = 'landscape-primary';
      const answer = answerLater(defaultTarget);
      const fs = make();
      const requested = fs.request();

      fs.onLandscape = true;

      answer.refuse();
      await expect(requested).resolves.toBe(false);
      await flush();

      expect(fs.isArmed).toBe(true);
      expect(emitted.at(-1)).toMatchObject({isActive: false, isArmed: true});
    });

    it.each(['grants', 'refuses'] as const)(
      'onLandscape = true beside a request() the browser refuses arms nothing while a request() the page calls on that refusal is under way, and the answer of that request decides (the browser %s it)',
      async (answer) => {
        orientation.type = 'landscape-primary';
        const first = answerLater(defaultTarget);
        const second = answerLater(defaultTarget);
        const fs = make();
        let again: Promise<boolean> | undefined;
        // attached before the setter attaches its arming: it runs first once the refusal is in
        const requested = fs.request().then((active) => {
          if (!active) again = fs.request();
          return active;
        });
        fs.onLandscape = true;

        first.refuse();
        await expect(requested).resolves.toBe(false);
        await flush();
        // the deferred arming found the page's request under way and left it to its answer
        expect(fs.isArmed).toBe(false);
        expect(defaultTarget.listenerCount('pointerup')).toBe(0);
        expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);

        if (answer === 'grants') second.grant();
        else second.refuse();
        await expect(again).resolves.toBe(answer === 'grants');
        await flush();
        expect(fs.isArmed).toBe(false);
        expect(emitted.some((props) => props.isArmed)).toBe(false);
      },
    );

    it('onLandscape = true while an exit() is under way arms once the exit is through', async () => {
      orientation.type = 'landscape-primary';
      const fs = make();
      await fs.request();

      const exit = exitLater();
      const left = fs.exit();
      fs.onLandscape = true;
      expect(fs.isArmed).toBe(false);

      exit.finish();
      await expect(left).resolves.toBe(false);
      await flush();

      expect(fs.isArmed).toBe(true);
    });

    it('onLandscape = true beside a request() arms nothing once dispose() has run before the answer', async () => {
      orientation.type = 'landscape-primary';
      const answer = answerLater(defaultTarget);
      const fs = make();
      void fs.request();
      fs.onLandscape = true;

      fs.dispose();
      answer.refuse();
      await flush();

      expect(fs.isArmed).toBe(false);
      expect(defaultTarget.listenerCount('pointerup')).toBe(0);
    });

    it('a landscape lock that holds turns the default exitOnPortrait off without a warning', async () => {
      const fs = make({onLandscape: true, orientationLock: 'landscape'});
      expect(fs.exitOnPortrait, 'before any lock').toBe(true);

      turn('landscape-primary');
      await flush();
      expect(orientation.lock).toHaveBeenCalledWith('landscape');
      expect(fs.exitOnPortrait, 'while the lock holds').toBe(false);
      expect(warn).not.toHaveBeenCalled();

      turn('portrait-primary');
      await flush();

      expect(doc.exitFullscreen).not.toHaveBeenCalled();
    });

    it('a landscape lock the browser refuses leaves exitOnPortrait on: the turn back leaves', async () => {
      orientation.lock.mockImplementation(() => Promise.reject(new DOMException('no', 'NotSupportedError')));
      const fs = make({onLandscape: true, orientationLock: 'landscape'});

      turn('landscape-primary');
      await flush();
      expect(fs.exitOnPortrait).toBe(true);

      turn('portrait-primary');
      await flush();

      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isActive).toBe(false);
    });

    it('an explicit exitOnPortrait true beside a landscape lock warns once and stays out of effect while the lock holds', async () => {
      const fs = make({onLandscape: true, orientationLock: 'landscape-primary', exitOnPortrait: true});
      make({onLandscape: true, orientationLock: 'landscape-primary', exitOnPortrait: true});

      turn('landscape-primary');
      await flush();
      expect(fs.exitOnPortrait).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('exitOnPortrait has no effect');
    });

    it('a portrait lock beside onLandscape warns once and does not lock', async () => {
      const fs = make({onLandscape: true, orientationLock: 'portrait'});

      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('orientationLock "portrait" and onLandscape cannot work together');

      await fs.request();
      await flush();

      expect(orientation.lock).not.toHaveBeenCalled();
    });

    it('a refused try at once warns nothing; a refused armed tap warns', async () => {
      defaultTarget.requestFullscreen.mockImplementation(() => Promise.reject(new TypeError('no gesture')));
      make({onLandscape: true});

      turn('landscape-primary');
      await flush();
      expect(warn).not.toHaveBeenCalled();

      tap();
      await flush();
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('dispose() takes down the orientation, query and tap listeners', () => {
      orientation.type = 'landscape-primary';
      const fs = make({onLandscape: true});

      fs.dispose();

      expect(orientation.listenerCount('change')).toBe(0);
      expect(defaultTarget.listenerCount('pointerup')).toBe(0);
      expect(defaultTarget.listenerCount('click')).toBe(0);
    });

    it('dispose() takes down the media query listener where there is no screen.orientation', () => {
      view.screen = {};
      const fs = make({onLandscape: true});
      expect(landscapeQuery.listenerCount('change')).toBe(1);

      fs.dispose();

      expect(landscapeQuery.listenerCount('change')).toBe(0);
    });

    it('dispose() of an armed controller takes the orientation and tap listeners down before its one event', () => {
      orientation.type = 'landscape-primary';
      const fs = make({onLandscape: true});
      expect(fs.isArmed).toBe(true);
      const error = new Error('emit fails on purpose');
      host.emit = () => {
        throw error;
      };

      expect(() => fs.dispose()).toThrow(error);

      expect(orientation.listenerCount('change')).toBe(0);
      expect(defaultTarget.listenerCount('pointerup')).toBe(0);
      expect(defaultTarget.listenerCount('click')).toBe(0);
      expect(doc.listenerCount('fullscreenchange')).toBe(0);
      expect(fs.isDisposed).toBe(true);
    });

    it('a turn to portrait while the request of a turn is pending leaves once the browser grants it', async () => {
      const answer = answerLater(defaultTarget);
      const fs = make({onLandscape: true});

      turn('landscape-primary');
      turn('portrait-primary');
      expect(doc.exitFullscreen).not.toHaveBeenCalled();
      answer.grant();
      await flush();

      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isActive).toBe(false);
      expect(fs.isArmed).toBe(false);
    });

    it('a turn back to landscape while the exit of the turn to portrait is under way enters again once the exit is through', async () => {
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();
      expect(fs.isActive).toBe(true);
      const exit = exitLater();

      turn('portrait-primary');
      turn('landscape-primary');
      exit.finish();
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
      expect(fs.isActive).toBe(true);
    });

    it('a turn back to landscape while the exit of the turn to portrait is under way arms where the browser refuses the turn', async () => {
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();
      const exit = exitLater();
      defaultTarget.requestFullscreen.mockImplementationOnce(() => Promise.reject(new TypeError('no gesture')));

      turn('portrait-primary');
      turn('landscape-primary');
      exit.finish();
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
      expect(fs.isActive).toBe(false);
      expect(fs.isArmed).toBe(true);
    });

    it('an exit() of the page while the exit of the turn to portrait is under way leaves for good: no new request, no arming', async () => {
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();
      const exit = exitLater();
      // a request after the exit stays unanswered, as one a browser has not granted yet
      answerLater(defaultTarget);

      turn('portrait-primary');
      turn('landscape-primary');
      // the exit button of the page, before the browser is through with the exit of the turn
      const exited = fs.exit();
      exit.finish();
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      await expect(exited).resolves.toBe(false);
      expect(fs.isActive).toBe(false);
      expect(fs.isArmed).toBe(false);

      // the user has left in landscape: the other landscape asks nothing either
      turn('landscape-secondary');
      await flush();
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isArmed).toBe(false);
    });

    it('an exit() of the page in landscape still holds off the arming', async () => {
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();

      // the exit button of the page
      await fs.exit();
      turn('landscape-secondary');
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isArmed).toBe(false);
    });

    describe('whether an exit() of the page is a refusal is decided where the screen is at the call', () => {
      const refuseNext = () =>
        defaultTarget.requestFullscreen.mockImplementationOnce(() => Promise.reject(new TypeError('no gesture')));

      it.each([
        {grants: true, active: true, armed: false},
        {grants: false, active: false, armed: true},
      ])(
        'in portrait during the exit of the turn to portrait, and a quick turn back: no refusal, the turn back asks again once the exit is through (the browser grants: $grants)',
        async ({grants, active, armed}) => {
          const fs = make({onLandscape: true});
          turn('landscape-primary');
          await flush();
          const exit = exitLater();
          if (!grants) refuseNext();

          turn('portrait-primary');
          const exited = fs.exit();
          turn('landscape-primary');
          exit.finish();
          await flush();

          await expect(exited).resolves.toBe(false);
          expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
          expect(fs.isActive).toBe(active);
          expect(fs.isArmed).toBe(armed);
        },
      );

      it.each([{grants: true}, {grants: false}])(
        'in portrait while the request of a turn is pending, and a quick turn back: no refusal, the display arms once the browser has answered (the browser grants: $grants)',
        async ({grants}) => {
          const answer = answerLater(defaultTarget);
          const fs = make({onLandscape: true});

          turn('landscape-primary');
          turn('portrait-primary');
          const exited = fs.exit();
          turn('landscape-primary');
          if (grants) answer.grant();
          else answer.refuse();
          await flush();

          await expect(exited).resolves.toBe(false);
          expect(doc.exitFullscreen).toHaveBeenCalledTimes(grants ? 1 : 0);
          expect(fs.isActive).toBe(false);
          expect(fs.isArmed).toBe(true);
        },
      );

      it.each([{grants: true}, {grants: false}])(
        'in landscape while the request of a turn is pending: a refusal, however the browser answers (the browser grants: $grants)',
        async ({grants}) => {
          const answer = answerLater(defaultTarget);
          const fs = make({onLandscape: true});

          turn('landscape-primary');
          const exited = fs.exit();
          if (grants) answer.grant();
          else answer.refuse();
          await flush();
          turn('landscape-secondary');
          await flush();

          await expect(exited).resolves.toBe(false);
          expect(fs.isActive).toBe(false);
          expect(fs.isArmed).toBe(false);
          expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
        },
      );

      it('in landscape during the exit of the turn to portrait, after the turn back: a refusal', async () => {
        const fs = make({onLandscape: true});
        turn('landscape-primary');
        await flush();
        const exit = exitLater();

        turn('portrait-primary');
        turn('landscape-primary');
        const exited = fs.exit();
        exit.finish();
        await flush();
        turn('landscape-secondary');
        await flush();

        await expect(exited).resolves.toBe(false);
        expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
        expect(fs.isActive).toBe(false);
        expect(fs.isArmed).toBe(false);
      });
    });

    describe('the refusal an exit() of the page sets in landscape belongs to that call: the last call wins', () => {
      type Step = 'exit' | 'request' | 'portrait and back';
      const refuseNext = () =>
        defaultTarget.requestFullscreen.mockImplementationOnce(() => Promise.reject(new TypeError('no gesture')));
      type Branch = 'the request of a turn is pending' | 'the exit of a fullscreen the turn entered is under way';

      interface Row {
        branch: Branch;
        steps: Step[];
        grants: boolean;
        active: boolean;
        armed: boolean;
        // what the calls of the page resolve with, where it is not the end: a turn evaluated anew once
        // the exit is through is a turn of its own, after the calls of the page
        resolves?: boolean;
        // the probe leaves in landscape the fullscreen the steps leave behind, then turns the phone
        // half round: does the half turn ask the browser again? Every such leave holds off the arming,
        // whoever entered the fullscreen, so on a row that ends active the probe shows the refusal of
        // that leave; the rows that do not end active show the request() taking back the exit().
        // Not asked of a fullscreen of onLandscape that stays
        halfTurnAsks?: boolean;
      }

      const PENDING: Branch = 'the request of a turn is pending';
      const EXITING: Branch = 'the exit of a fullscreen the turn entered is under way';
      const rows: Row[] = [
        // the last call is the exit(): the refusal stands, granted or not
        {branch: PENDING, steps: ['exit'], grants: true, active: false, armed: false, halfTurnAsks: false},
        {branch: PENDING, steps: ['exit'], grants: false, active: false, armed: false, halfTurnAsks: false},
        {branch: EXITING, steps: ['exit'], grants: true, active: false, armed: false, halfTurnAsks: false},
        {branch: EXITING, steps: ['exit'], grants: false, active: false, armed: false, halfTurnAsks: false},
        // a request() after it takes the refusal back with the exit
        {branch: PENDING, steps: ['exit', 'request'], grants: true, active: true, armed: false, halfTurnAsks: false},
        {branch: PENDING, steps: ['exit', 'request'], grants: false, active: false, armed: true, halfTurnAsks: true},
        {branch: EXITING, steps: ['exit', 'request'], grants: true, active: true, armed: false, halfTurnAsks: false},
        {branch: EXITING, steps: ['exit', 'request'], grants: false, active: false, armed: false, halfTurnAsks: true},
        // a turn to portrait and back before the browser answers lifts it, as it would after the answer
        {branch: PENDING, steps: ['exit', 'portrait and back'], grants: true, active: false, armed: true, halfTurnAsks: true},
        {branch: PENDING, steps: ['exit', 'portrait and back'], grants: false, active: false, armed: true, halfTurnAsks: true},
        {branch: EXITING, steps: ['exit', 'portrait and back'], grants: true, active: true, armed: false, resolves: false},
        {branch: EXITING, steps: ['exit', 'portrait and back'], grants: false, active: false, armed: true, halfTurnAsks: true},
      ];

      for (const {branch, steps, grants, active, armed, resolves = active, halfTurnAsks} of rows) {
        const answered =
          branch === PENDING ? (grants ? 'grants it' : 'refuses it') : grants ? 'grants a request' : 'refuses a request';
        const name = `${branch}: ${steps.join(' → ')} in landscape, the browser ${answered} → ${active ? 'active' : 'not active'}, ${armed ? 'armed' : 'not armed'}${halfTurnAsks == null ? '' : halfTurnAsks ? ', a half turn asks again' : ', a half turn asks nothing'}`;
        it(name, async () => {
          let answer: ReturnType<typeof answerLater> | undefined;
          let exit: ReturnType<typeof exitLater> | undefined;
          if (branch === PENDING) answer = answerLater(defaultTarget);
          const fs = make({onLandscape: true});
          turn('landscape-primary');
          if (branch === EXITING) {
            await flush();
            expect(fs.isActive).toBe(true);
            exit = exitLater();
            if (!grants) refuseNext();
          }

          const promises: Promise<boolean>[] = [];
          for (const step of steps) {
            if (step === 'exit') promises.push(fs.exit());
            else if (step === 'request') promises.push(fs.request());
            else {
              turn('portrait-primary');
              turn('landscape-primary');
            }
          }
          if (answer != null) {
            if (grants) answer.grant();
            else answer.refuse();
          }
          exit?.finish();
          await flush();

          expect(await Promise.all(promises.map(outcomeOf))).toEqual(promises.map(() => resolves));
          expect(fs.isActive).toBe(active);
          expect(fs.isArmed).toBe(armed);

          if (halfTurnAsks == null) return;
          // the user leaves in landscape — a refusal, whoever entered the fullscreen —, then turns the
          // phone half round
          if (fs.isActive) fireFullscreenChange(null);
          const asked = defaultTarget.requestFullscreen.mock.calls.length;
          turn('landscape-secondary');
          await flush();
          expect(defaultTarget.requestFullscreen.mock.calls.length > asked).toBe(halfTurnAsks);
        });
      }
    });

    describe('a fullscreen a request() of the page carries is the page’s own', () => {
      it('a request() during the exit of the turn to portrait, and a quick turn back: the turn shares the request, and the next turn to portrait leaves nothing', async () => {
        const fs = make({onLandscape: true});
        turn('landscape-primary');
        await flush();
        const exit = exitLater();

        turn('portrait-primary');
        const requested = fs.request();
        turn('landscape-primary');
        exit.finish();
        await flush();

        await expect(requested).resolves.toBe(true);
        expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
        expect(fs.isActive).toBe(true);

        turn('portrait-primary');
        await flush();
        expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
        expect(fs.isActive).toBe(true);
      });

      it('a request() while the request of a turn is pending: the next turn to portrait leaves nothing', async () => {
        const answer = answerLater(defaultTarget);
        const fs = make({onLandscape: true});

        turn('landscape-primary');
        const requested = fs.request();
        answer.grant();
        await flush();
        expect(fs.isActive).toBe(true);

        turn('portrait-primary');
        await flush();

        await expect(requested).resolves.toBe(true);
        expect(doc.exitFullscreen).not.toHaveBeenCalled();
        expect(fs.isActive).toBe(true);
      });

      it('a request() on a fullscreen onLandscape has entered makes it the page’s own: the next turn to portrait leaves nothing', async () => {
        const fs = make({onLandscape: true});
        turn('landscape-primary');
        await flush();
        expect(fs.isActive).toBe(true);

        await expect(fs.request()).resolves.toBe(true);
        turn('portrait-primary');
        await flush();

        expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
        expect(doc.exitFullscreen).not.toHaveBeenCalled();
        expect(fs.isActive).toBe(true);
      });

      it('a request() on a fullscreen onLandscape has entered while an element of the app lies on top of it makes it the page’s own: the next turn to portrait leaves nothing', async () => {
        const fs = make({onLandscape: true});
        turn('landscape-primary');
        await flush();
        stackOn(defaultTarget);
        expect(fs.isActive).toBe(false);

        await expect(fs.request()).resolves.toBe(true);
        turn('portrait-primary');
        await flush();

        expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
        expect(doc.exitFullscreen).not.toHaveBeenCalled();
        expect(fs.isActive).toBe(true);
      });

      it('a request() on a fullscreen onLandscape has entered while an element of the app lies on top of it is the page’s own before the browser answers: a turn to portrait meanwhile leaves nothing', async () => {
        const fs = make({onLandscape: true});
        turn('landscape-primary');
        await flush();
        stackOn(defaultTarget);
        const answer = answerLater(defaultTarget);

        const requested = fs.request();
        turn('portrait-primary');
        answer.grant();
        await flush();

        await expect(requested).resolves.toBe(true);
        expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
        expect(doc.exitFullscreen).not.toHaveBeenCalled();
        expect(fs.isActive).toBe(true);
      });

      it('a request() after a turn to portrait while the request of a turn is pending keeps what the browser grants', async () => {
        const answer = answerLater(defaultTarget);
        const fs = make({onLandscape: true});

        turn('landscape-primary');
        turn('portrait-primary');
        const requested = fs.request();
        answer.grant();
        await flush();

        await expect(requested).resolves.toBe(true);
        expect(doc.exitFullscreen).not.toHaveBeenCalled();
        expect(fs.isActive).toBe(true);
      });
    });

    it('an armed tap the browser refuses arms again', async () => {
      defaultTarget.requestFullscreen.mockImplementation(() => Promise.reject(new TypeError('no gesture')));
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();
      expect(fs.isArmed).toBe(true);

      tap();
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
      expect(fs.isArmed).toBe(true);
      expect(emitted.at(-1)).toMatchObject({isActive: false, isArmed: true});
    });

    it('a refusal that arrives after dispose() arms nothing', async () => {
      const answer = answerLater(defaultTarget);
      const fs = make({onLandscape: true});
      turn('landscape-primary');

      fs.dispose();
      answer.refuse();
      await flush();

      expect(defaultTarget.listenerCount('pointerup')).toBe(0);
      expect(defaultTarget.listenerCount('click')).toBe(0);
      expect(fs.isArmed).toBe(false);
    });

    it('the armed tap asks the browser before it emits', async () => {
      defaultTarget.requestFullscreen.mockImplementationOnce(() => Promise.reject(new TypeError('no gesture')));
      make({onLandscape: true});
      turn('landscape-primary');
      await flush();
      // the request of the tap stays unanswered: the event of the disarming is the one the tap emits
      answerLater(defaultTarget);
      const emitOfHost = host.emit;
      host.emit = () => {
        throw new Error('emit fails on purpose');
      };

      try {
        tap();
      } catch {
        // the throw of the host, which only a stub can make
      }
      host.emit = emitOfHost;

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
    });

    it('a fullscreen stacked on one onLandscape entered: the turn to portrait leaves it once the stack is down', async () => {
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();

      stackOn(defaultTarget);
      expect(fs.isActive).toBe(false);
      fireFullscreenChange(defaultTarget);

      turn('portrait-primary');
      await flush();

      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isActive).toBe(false);
    });

    it('a turn to landscape while a fullscreen is stacked on the target asks nothing and arms nothing', async () => {
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();
      stackOn(defaultTarget);
      defaultTarget.requestFullscreen.mockImplementation(() => Promise.reject(new TypeError('no gesture')));

      turn('portrait-primary');
      turn('landscape-primary');
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isArmed).toBe(false);
      expect(defaultTarget.listenerCount('pointerup')).toBe(0);
    });

    it('onLandscape = true while a fullscreen is stacked on the target arms nothing', async () => {
      orientation.type = 'landscape-primary';
      const fs = make();
      await fs.request();
      stackOn(defaultTarget);

      fs.onLandscape = true;

      expect(fs.isArmed).toBe(false);
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    describe('a fullscreen of another element: onLandscape takes nothing from it', () => {
      it.each([{inside: true}, {inside: false}])(
        'a turn to landscape while another element is in fullscreen asks nothing and arms nothing (inside the target: $inside)',
        async ({inside}) => {
          const fs = make({onLandscape: true});
          otherGoesFullscreen(defaultTarget, {inside});

          turn('landscape-primary');
          await flush();

          expect(defaultTarget.requestFullscreen).not.toHaveBeenCalled();
          expect(fs.isArmed).toBe(false);
          expect(defaultTarget.listenerCount('pointerup')).toBe(0);
        },
      );

      it.each([{inside: true}, {inside: false}])(
        'onLandscape = true in landscape while another element is in fullscreen arms nothing (inside the target: $inside)',
        ({inside}) => {
          orientation.type = 'landscape-primary';
          const fs = make();
          otherGoesFullscreen(defaultTarget, {inside});

          fs.onLandscape = true;

          expect(fs.isArmed).toBe(false);
          expect(emitted.some((props) => props.isArmed)).toBe(false);
          expect(defaultTarget.requestFullscreen).not.toHaveBeenCalled();
        },
      );

      it('a display built in landscape while another element is in fullscreen arms nothing, and once that fullscreen is left in landscape a half turn asks nothing until portrait and back', async () => {
        orientation.type = 'landscape-primary';
        otherGoesFullscreen(defaultTarget);
        const fs = make({onLandscape: true});

        expect(fs.isArmed).toBe(false);

        fireFullscreenChange(null);
        turn('landscape-secondary');
        await flush();

        expect(defaultTarget.requestFullscreen).not.toHaveBeenCalled();

        turn('portrait-primary');
        turn('landscape-primary');
        await flush();

        expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      });

      it.each([{inside: true}, {inside: false}])(
        'a fullscreen another element enters disarms an armed display, and a tap asks nothing (inside the target: $inside)',
        ({inside}) => {
          orientation.type = 'landscape-primary';
          const fs = make({onLandscape: true});
          expect(fs.isArmed).toBe(true);

          otherGoesFullscreen(defaultTarget, {inside});
          tap();

          expect(fs.isArmed).toBe(false);
          expect(emitted.at(-1)).toMatchObject({isActive: false, isArmed: false});
          expect(defaultTarget.listenerCount('pointerup')).toBe(0);
          expect(defaultTarget.listenerCount('click')).toBe(0);
          expect(defaultTarget.requestFullscreen).not.toHaveBeenCalled();
        },
      );

      it('the armed tap asks nothing while another element is in fullscreen, also before the browser has fired its event', () => {
        orientation.type = 'landscape-primary';
        const fs = make({onLandscape: true});
        expect(fs.isArmed).toBe(true);

        otherGoesFullscreen(defaultTarget, {fire: false});
        tap();

        expect(defaultTarget.requestFullscreen).not.toHaveBeenCalled();
        expect(fs.isArmed).toBe(false);
        expect(emitted.at(-1)).toMatchObject({isArmed: false});
      });

      it.each([{inside: true}, {inside: false}])(
        'a refused request of a turn arms nothing once another element has gone fullscreen meanwhile (inside the target: $inside)',
        async ({inside}) => {
          const answer = answerLater(defaultTarget);
          const fs = make({onLandscape: true});
          turn('landscape-primary');

          otherGoesFullscreen(defaultTarget, {inside});
          answer.refuse();
          await flush();

          expect(fs.isArmed).toBe(false);
        },
      );

      it('a target in a shadow root: a fullscreen of an element outside it holds onLandscape off as well', async () => {
        const target = makeTarget('in a shadow root', {fullscreenElement: null});
        const fs = make({onLandscape: true, element: asElement(target)});
        // the document names the element outside; the shadow root of the target names none
        fireFullscreenChange(makeTarget('video'));

        turn('landscape-primary');
        await flush();

        expect(target.requestFullscreen).not.toHaveBeenCalled();
        expect(fs.isArmed).toBe(false);
      });

      it.each([{inside: true}, {inside: false}])(
        'leaving the fullscreen of another element in landscape holds off the arming until portrait and back (inside the target: $inside)',
        async ({inside}) => {
          orientation.type = 'landscape-primary';
          const fs = make({onLandscape: true});
          otherGoesFullscreen(defaultTarget, {inside});

          fireFullscreenChange(null);
          expect(fs.isArmed).toBe(false);
          turn('landscape-secondary');
          await flush();

          expect(defaultTarget.requestFullscreen).not.toHaveBeenCalled();

          turn('portrait-primary');
          turn('landscape-primary');
          await flush();

          expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
        },
      );

      it('once another element has left its fullscreen in portrait, the next turn to landscape asks again', async () => {
        make({onLandscape: true});
        otherGoesFullscreen(defaultTarget);
        fireFullscreenChange(null);

        turn('landscape-primary');
        await flush();

        expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      });

      it('a request() of the page while another element is in fullscreen still asks the browser', async () => {
        const fs = make({onLandscape: true});
        otherGoesFullscreen(defaultTarget);

        await fs.request();

        expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
        expect(fs.isActive).toBe(true);
      });
    });

    it('a turn to portrait and back while the request of a turn is pending keeps what the browser grants', async () => {
      const answer = answerLater(defaultTarget);
      const fs = make({onLandscape: true});

      turn('landscape-primary');
      turn('portrait-primary');
      turn('landscape-primary');
      answer.grant();
      await flush();

      expect(doc.exitFullscreen).not.toHaveBeenCalled();
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isActive).toBe(true);
      expect(fs.isArmed).toBe(false);
    });

    it('an exit() while a request is pending survives a turn to portrait and back, which lifts its refusal', async () => {
      const answer = answerLater(defaultTarget);
      const fs = make({onLandscape: true});

      turn('landscape-primary');
      // the exit button of the page, before the browser has answered the request of the turn
      const exited = fs.exit();
      turn('portrait-primary');
      turn('landscape-primary');
      answer.grant();
      await flush();

      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
      await expect(exited).resolves.toBe(false);
      expect(fs.isActive).toBe(false);
      // the turn to portrait and back after the exit() has lifted its refusal, as it would after the
      // answer: the turn back arms
      expect(fs.isArmed).toBe(true);
    });

    it('an exit() while the request of a turn is pending holds off the arming when the browser refuses the request', async () => {
      const answer = answerLater(defaultTarget);
      const fs = make({onLandscape: true});

      turn('landscape-primary');
      // the exit button of the page, before the browser has answered the request of the turn
      const exited = fs.exit();
      answer.refuse();
      await flush();

      await expect(exited).resolves.toBe(false);
      expect(fs.isArmed).toBe(false);
      expect(defaultTarget.listenerCount('pointerup')).toBe(0);
    });

    it('an exit() while the request of the armed tap is pending holds off the arming when the browser refuses the tap', async () => {
      defaultTarget.requestFullscreen.mockImplementationOnce(() => Promise.reject(new TypeError('no gesture')));
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();
      expect(fs.isArmed).toBe(true);
      const answer = answerLater(defaultTarget);

      tap();
      const exited = fs.exit();
      answer.refuse();
      await flush();

      await expect(exited).resolves.toBe(false);
      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
      expect(fs.isArmed).toBe(false);
    });

    it('the late answer of an earlier request arms nothing beside a newer request', async () => {
      const first = answerLater(defaultTarget);
      const second = answerLater(defaultTarget);
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      turn('portrait-primary');
      const exit = exitLater();
      first.grant();
      await flush();
      expect(doc.exitFullscreen, 'the turn to portrait leaves what the first request got').toHaveBeenCalledTimes(1);

      // back to landscape while that exit is under way: once it is through, the second request goes out
      turn('landscape-primary');
      exit.finish();
      await flush();

      expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
      expect(fs.isArmed).toBe(false);

      second.grant();
      await flush();

      expect(fs.isActive).toBe(true);
      expect(fs.isArmed).toBe(false);
      expect(emitted.at(-1)).toMatchObject({isActive: true, isArmed: false});
    });

    it('an exitFullscreen() that throws at once on the turn to portrait leaves the controller standing', async () => {
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();
      doc.exitFullscreen.mockImplementation(() => {
        throw new TypeError('not now');
      });

      expect(() => turn('portrait-primary')).not.toThrow();
      await flush();

      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isActive).toBe(true);
    });

    it('an exitFullscreen() the browser refuses on the turn to portrait is asked once', async () => {
      const fs = make({onLandscape: true});
      turn('landscape-primary');
      await flush();
      doc.exitFullscreen.mockImplementation(() => Promise.reject(new TypeError('not now')));

      turn('portrait-primary');
      await flush();

      expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
      expect(fs.isActive).toBe(true);
    });

    it('after dispose() orientationLock and exitOnPortrait take values and warn nothing', () => {
      const fs = make({onLandscape: true});
      fs.dispose();

      fs.exitOnPortrait = true;
      fs.orientationLock = 'landscape';
      fs.orientationLock = 'portrait';

      expect(fs.exitOnPortrait).toBe(true);
      expect(fs.orientationLock).toBe('portrait');
      expect(warn).not.toHaveBeenCalled();
    });

    it('after dispose() a write to onLandscape changes nothing', () => {
      orientation.type = 'landscape-primary';
      const fs = make();
      fs.dispose();

      fs.onLandscape = true;

      expect(fs.onLandscape).toBe(false);
      expect(fs.isArmed).toBe(false);
      expect(orientation.listenerCount('change')).toBe(0);
    });
  });
  describe('pseudo fullscreen', () => {
    const PSEUDO_CSS =
      'position:fixed!important;inset:0!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;box-sizing:border-box!important;transform:none!important;z-index:2147483647!important;object-fit:contain;';

    const pressEscape = () => doc.dispatch('keydown', {key: 'Escape'});

    beforeEach(() => {
      doc.fullscreenEnabled = false;
      vi.mocked(Stylesheets.retainRule).mockClear();
      vi.mocked(Stylesheets.releaseRule).mockClear();
    });

    it('fallback "pseudo" makes isAvailable true where isSupported is false', () => {
      const fs = make({fallback: 'pseudo'});
      expect(fs.fallback).toBe('pseudo');
      expect(fs.isSupported).toBe(false);
      expect(fs.isAvailable).toBe(true);
    });

    it('request() enters the pseudo mode', async () => {
      const fs = make({fallback: 'pseudo'});

      await expect(fs.request()).resolves.toBe(true);

      expect(fs.isActive).toBe(true);
      expect(fs.mode).toBe('pseudo');
      expect(Stylesheets.retainRule).toHaveBeenCalledWith(DisplayFullscreen.CssRulesPrefixPseudo, PSEUDO_CSS, doc.head);
      expect(Stylesheets.retainRule).toHaveBeenCalledWith(
        DisplayFullscreen.CssRulesPrefixPseudoRoot,
        'overflow:hidden;',
        doc.documentElement,
      );
      expect(defaultTarget.classList.add).toHaveBeenCalledWith(DisplayFullscreen.CssRulesPrefixPseudo);
      expect(doc.documentElement.classList.add).toHaveBeenCalledWith(DisplayFullscreen.CssRulesPrefixPseudoRoot);
      expect(host.pseudoTargetChanged).toHaveBeenLastCalledWith(defaultTarget);
      expect(emitted.at(-1)).toMatchObject({isActive: true, mode: 'pseudo', element: defaultTarget});
      expect(warn).not.toHaveBeenCalled();
    });

    it('a browser with native support never uses the pseudo mode, also when it refuses', async () => {
      doc.fullscreenEnabled = true;
      defaultTarget.requestFullscreen.mockImplementation(() => Promise.reject(new TypeError('no gesture')));
      const fs = make({fallback: 'pseudo'});

      await expect(fs.request()).resolves.toBe(false);

      expect(fs.mode).toBeUndefined();
      expect(Stylesheets.retainRule).not.toHaveBeenCalled();
    });

    it('exit() leaves the pseudo mode and releases both rules', async () => {
      const fs = make({fallback: 'pseudo'});
      await fs.request();

      await expect(fs.exit()).resolves.toBe(false);

      expect(fs.isActive).toBe(false);
      expect(defaultTarget.classList.remove).toHaveBeenCalledWith(DisplayFullscreen.CssRulesPrefixPseudo);
      expect(doc.documentElement.classList.remove).toHaveBeenCalledWith(DisplayFullscreen.CssRulesPrefixPseudoRoot);
      expect(Stylesheets.releaseRule).toHaveBeenCalledWith(DisplayFullscreen.CssRulesPrefixPseudo, doc.head);
      expect(Stylesheets.releaseRule).toHaveBeenCalledWith(DisplayFullscreen.CssRulesPrefixPseudoRoot, doc.documentElement);
      expect(host.pseudoTargetChanged).toHaveBeenLastCalledWith(undefined);
      expect(emitted.at(-1)).toMatchObject({isActive: false, mode: undefined});
    });

    it('toggle() enters and leaves the pseudo mode', async () => {
      const fs = make({fallback: 'pseudo'});
      await expect(fs.toggle()).resolves.toBe(true);
      await expect(fs.toggle()).resolves.toBe(false);
    });

    it('Escape leaves the pseudo mode, and is listened for only while it holds', async () => {
      const fs = make({fallback: 'pseudo'});
      expect(doc.listenerCount('keydown')).toBe(0);

      await fs.request();
      expect(doc.listenerCount('keydown')).toBe(1);

      doc.dispatch('keydown', {key: 'a'});
      expect(fs.isActive).toBe(true);

      pressEscape();
      expect(fs.isActive).toBe(false);
      expect(doc.listenerCount('keydown')).toBe(0);
    });

    it('dispose() leaves the pseudo mode it entered and takes the Escape listener off', async () => {
      const fs = make({fallback: 'pseudo'});
      await fs.request();

      fs.dispose();

      expect(defaultTarget.classList.remove).toHaveBeenCalledWith(DisplayFullscreen.CssRulesPrefixPseudo);
      expect(Stylesheets.releaseRule).toHaveBeenCalledTimes(2);
      expect(doc.listenerCount('keydown')).toBe(0);
    });

    it('installRules() moves the rules of an active pseudo mode to the new root', async () => {
      const fs = make({fallback: 'pseudo'});
      await fs.request();
      // an identity of its own: an empty object would deep-equal the head stub
      const shadowRoot = {name: 'shadow-root'} as unknown as ShadowRoot;

      fs.installRules(shadowRoot);

      expect(Stylesheets.retainRule).toHaveBeenLastCalledWith(DisplayFullscreen.CssRulesPrefixPseudo, PSEUDO_CSS, shadowRoot);
      expect(Stylesheets.releaseRule).toHaveBeenCalledWith(DisplayFullscreen.CssRulesPrefixPseudo, doc.head);

      await fs.exit();
      expect(Stylesheets.releaseRule).toHaveBeenLastCalledWith(DisplayFullscreen.CssRulesPrefixPseudoRoot, doc.documentElement);
      expect(Stylesheets.releaseRule).toHaveBeenCalledWith(DisplayFullscreen.CssRulesPrefixPseudo, shadowRoot);
    });

    it('installRules() without the pseudo mode installs nothing', () => {
      const fs = make({fallback: 'pseudo'});
      fs.installRules({name: 'shadow-root'} as unknown as ShadowRoot);
      expect(Stylesheets.retainRule).not.toHaveBeenCalled();
    });

    describe('with onLandscape', () => {
      let orientation: EventTargetStub & {type: string};

      const turn = (type: string) => {
        orientation.type = type;
        orientation.dispatch('change');
      };

      beforeEach(() => {
        orientation = Object.assign(makeEventTarget(), {type: 'portrait-primary'});
        view.screen = {orientation};
        view.matchMedia = vi.fn(() => ({matches: true}));
      });

      it('a turn to landscape enters the pseudo mode at once and never arms', () => {
        const fs = make({fallback: 'pseudo', onLandscape: true});

        turn('landscape-primary');

        expect(fs.mode).toBe('pseudo');
        expect(fs.isArmed).toBe(false);
      });

      it('a page that loads in landscape enters the pseudo mode at once', () => {
        orientation.type = 'landscape-primary';
        const fs = make({fallback: 'pseudo', onLandscape: true});

        expect(fs.mode).toBe('pseudo');
        expect(fs.isArmed).toBe(false);
      });

      it('the turn back leaves it', () => {
        const fs = make({fallback: 'pseudo', onLandscape: true});
        turn('landscape-primary');

        turn('portrait-primary');

        expect(fs.isActive).toBe(false);
      });

      it('a request() on the pseudo mode onLandscape has entered makes it the page’s own: the turn back leaves nothing', async () => {
        const fs = make({fallback: 'pseudo', onLandscape: true});
        turn('landscape-primary');
        expect(fs.mode).toBe('pseudo');

        await expect(fs.request()).resolves.toBe(true);
        turn('portrait-primary');

        expect(fs.mode).toBe('pseudo');
      });

      it('Escape in landscape holds off re-entering until portrait and back', () => {
        const fs = make({fallback: 'pseudo', onLandscape: true});
        turn('landscape-primary');

        pressEscape();
        turn('landscape-primary');
        expect(fs.isActive).toBe(false);

        turn('portrait-primary');
        turn('landscape-primary');
        expect(fs.mode).toBe('pseudo');
      });

      it('Escape in landscape on a pseudo mode the page entered holds off re-entering until portrait and back', async () => {
        const fs = make({fallback: 'pseudo', onLandscape: true});
        await fs.request();
        turn('landscape-primary');

        pressEscape();
        turn('landscape-secondary');
        expect(fs.isActive).toBe(false);

        turn('portrait-primary');
        turn('landscape-primary');
        expect(fs.mode).toBe('pseudo');
      });

      it('a pseudo mode entered while armed disarms', async () => {
        doc.fullscreenEnabled = true;
        orientation.type = 'landscape-primary';
        const fs = make({fallback: 'pseudo', onLandscape: true});
        expect(fs.isArmed).toBe(true);

        // isSupported is read anew at every request
        doc.fullscreenEnabled = false;
        await fs.request();

        expect(fs.mode).toBe('pseudo');
        expect(fs.isArmed).toBe(false);
        expect(defaultTarget.listenerCount('pointerup')).toBe(0);
      });
    });
  });
});
