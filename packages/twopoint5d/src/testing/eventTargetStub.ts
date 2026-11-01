import {type Mock, vi} from 'vitest';

/** A listener as the stub takes it: called with what {@link EventTargetStub.dispatch} is given. */
export type EventTargetListener = (event?: unknown) => void;

/**
 * An `EventTarget` for the specs: it holds the listeners added to it, and `dispatch()` calls those
 * alone, as the browser does — a listener that was removed hears nothing. `addEventListener` and
 * `removeEventListener` are mocks, so a spec can still read what was added and with which options.
 *
 * The options and the capture flag are recorded, not evaluated: a listener is known by its type and
 * its function alone. That holds for the code under test, which adds and removes every listener
 * with the same capture flag — the tap of `DisplayFullscreen` with `{capture: true}`, its
 * `fullscreenchange` and `keydown` without; the `visibilitychange` of `Display` with `false`, its
 * `fullscreenchange` without.
 */
export interface EventTargetStub {
  addEventListener: Mock<(type: string, listener: EventTargetListener, options?: unknown) => void>;
  removeEventListener: Mock<(type: string, listener: EventTargetListener, options?: unknown) => void>;
  /** Calls every listener the stub holds for `type`, in the order they were added. */
  dispatch(type: string, event?: unknown): void;
  listenerCount(type: string): number;
}

export function makeEventTarget(): EventTargetStub {
  const listeners = new Map<string, Set<EventTargetListener>>();
  return {
    addEventListener: vi.fn((type: string, listener: EventTargetListener) => {
      let set = listeners.get(type);
      if (set == null) {
        set = new Set();
        listeners.set(type, set);
      }
      // a listener added twice stays one entry, as in the DOM
      set.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventTargetListener) => {
      listeners.get(type)?.delete(listener);
    }),
    dispatch(type: string, event?: unknown) {
      const set = listeners.get(type);
      if (set == null) return;
      // over a snapshot: a listener added during the dispatch hears the next one. And only while the
      // set still holds it: the DOM calls no listener an earlier one of the same dispatch has removed
      for (const listener of [...set]) {
        if (set.has(listener)) listener(event);
      }
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}
