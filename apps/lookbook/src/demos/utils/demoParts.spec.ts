import {describe, expect, it, vi} from 'vitest';
import {DemoParts} from './demoParts';

/** A display stand-in that keeps the listeners it is handed, and calls them as it is disposed. */
const standIn = (isDisposed = false) => {
  const listeners: (() => void)[] = [];
  return {
    display: {
      isDisposed,
      onDispose(release: () => void) {
        listeners.push(release);
      },
    },
    listeners,
    dispose() {
      for (const listener of listeners) listener();
    },
  };
};

describe('DemoParts', () => {
  it('lets go of nothing before the display is disposed, and of every part in the reverse order it kept them in after', () => {
    const {display, dispose} = standIn();
    const parts = new DemoParts(display);
    const order: string[] = [];
    parts.keep({dispose: () => order.push('a')});
    parts.keep({dispose: () => order.push('b')});
    parts.onDispose(() => order.push('listener'));
    parts.keep({dispose: () => order.push('c')});
    expect(order).toEqual([]);
    dispose();
    expect(order).toEqual(['c', 'listener', 'b', 'a']);
  });

  it('keep() answers the part it keeps', () => {
    const parts = new DemoParts(standIn().display);
    const part = {dispose: () => {}};
    expect(parts.keep(part)).toBe(part);
  });

  it('lets go of the parts kept before a part that throws as it is built', () => {
    const {display, dispose} = standIn();
    const parts = new DemoParts(display);
    const a = {dispose: vi.fn()};
    const build = (): {dispose(): void} => {
      throw new Error('the part cannot be built');
    };
    expect(() => {
      parts.keep(a);
      parts.keep(build());
    }).toThrow('the part cannot be built');
    dispose();
    expect(a.dispose).toHaveBeenCalledTimes(1);
  });

  it('releases every part behind one that throws, and throws that error once all have gone', () => {
    const {display, dispose} = standIn();
    const parts = new DemoParts(display);
    const error = new Error('release failed');
    const a = {dispose: vi.fn()};
    const c = {dispose: vi.fn()};
    parts.keep(a);
    parts.keep({
      dispose() {
        throw error;
      },
    });
    parts.keep(c);
    let caught: unknown;
    try {
      dispose();
    } catch (thrown) {
      caught = thrown;
    }
    expect(caught).toBe(error);
    expect(a.dispose).toHaveBeenCalledTimes(1);
    expect(c.dispose).toHaveBeenCalledTimes(1);
  });

  it('throws an AggregateError when more than one release throws', () => {
    const {display, dispose} = standIn();
    const parts = new DemoParts(display);
    const first = new Error('first');
    const second = new Error('second');
    parts.onDispose(() => {
      throw second;
    });
    parts.onDispose(() => {
      throw first;
    });
    let caught: unknown;
    try {
      dispose();
    } catch (thrown) {
      caught = thrown;
    }
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).message).toBe('DemoParts: 2 releases threw as the display was disposed');
    // the last kept goes first, so `first` is thrown first
    expect((caught as AggregateError).errors).toEqual([first, second]);
  });

  it('refuses a display that is disposed already, and subscribes nothing', () => {
    const {display, listeners} = standIn(true);
    expect(() => new DemoParts(display)).toThrow(
      new Error('new DemoParts(): the display is disposed already, and nothing kept would go with it'),
    );
    expect(listeners).toEqual([]);
  });
});
