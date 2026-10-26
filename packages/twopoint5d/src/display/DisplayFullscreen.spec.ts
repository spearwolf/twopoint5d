import {afterEach, beforeEach, describe, expect, it, type Mock, vi} from 'vitest';
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

type Listener = (event?: unknown) => void;

interface EventTargetStub {
  addEventListener: Mock<(type: string, listener: Listener, options?: unknown) => void>;
  removeEventListener: Mock<(type: string, listener: Listener, options?: unknown) => void>;
  dispatch(type: string, event?: unknown): void;
  listenerCount(type: string): number;
}

function makeEventTarget(): EventTargetStub {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addEventListener: vi.fn((type: string, listener: Listener) => {
      let set = listeners.get(type);
      if (set == null) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener);
    }),
    dispatch(type: string, event?: unknown) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

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
  return stub;
}

function make(options?: DisplayFullscreenOptions): DisplayFullscreen {
  const controller = new DisplayFullscreen(display, host, options);
  controllers.push(controller);
  return controller;
}

const asElement = (target: TargetStub) => target as unknown as HTMLElement;

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

    it('a toggle() while the request of the armed tap is pending returns that request', async () => {
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

      // entered by onLandscape: the turn back leaves it
      turn('portrait-primary');
      await flush();
      expect(fs.isActive).toBe(false);
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
      expect(String(warn.mock.calls[0]?.[0])).toContain("orientationLock 'portrait' and onLandscape cannot work together");

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
    });
  });
});
