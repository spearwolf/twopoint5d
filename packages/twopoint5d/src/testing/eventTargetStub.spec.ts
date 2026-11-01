import {describe, expect, test, vi} from 'vitest';

import {makeEventTarget} from './eventTargetStub.js';

describe('makeEventTarget()', () => {
  test('calls no listener removed before the dispatch', () => {
    const target = makeEventTarget();
    const kept = vi.fn();
    const removed = vi.fn();
    target.addEventListener('change', kept);
    target.addEventListener('change', removed);

    target.removeEventListener('change', removed);
    target.dispatch('change', 'event');

    expect(kept).toHaveBeenCalledWith('event');
    expect(removed).not.toHaveBeenCalled();
    expect(target.listenerCount('change')).toBe(1);
  });

  test('calls no listener an earlier listener of the same dispatch removes', () => {
    const target = makeEventTarget();
    const later = vi.fn();
    const earlier = vi.fn(() => {
      target.removeEventListener('change', later);
    });
    target.addEventListener('change', earlier);
    target.addEventListener('change', later);

    target.dispatch('change');

    expect(earlier).toHaveBeenCalledTimes(1);
    expect(later).not.toHaveBeenCalled();
  });

  test('holds a listener added twice once', () => {
    const target = makeEventTarget();
    const listener = vi.fn();
    target.addEventListener('change', listener);
    target.addEventListener('change', listener);

    target.dispatch('change');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(target.listenerCount('change')).toBe(1);
  });
});
