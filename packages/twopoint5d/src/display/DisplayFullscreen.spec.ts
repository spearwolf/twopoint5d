import {afterEach, beforeEach, describe, expect, it, type Mock, vi} from 'vitest';
import type {Display} from './Display.js';
import {DisplayFullscreen, type DisplayFullscreenHost, resetFullscreenWarnings} from './DisplayFullscreen.js';
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
}

interface TargetStub extends EventTargetStub {
  name: string;
  classList: {add: Mock; remove: Mock};
  getRootNode: () => {fullscreenElement: unknown};
  requestFullscreen: Mock<(options?: unknown) => Promise<void>>;
}

let doc: DocStub;
let host: DisplayFullscreenHost;
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
    host = {
      doc: doc as unknown as Document,
      view: {} as Window & typeof globalThis,
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
});
