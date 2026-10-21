import {GCProfiler} from 'node:v8';
import {afterEach, describe, expect, test, vi} from 'vitest';

import {measureAllocatedBytes} from './measureAllocatedBytes.js';

describe('measureAllocatedBytes()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('collects only the young generation right before its rounds', () => {
    const profiler = new GCProfiler();
    profiler.start();
    measureAllocatedBytes(() => {}, {warmUpRounds: 0, rounds: 1});
    const gcTypes = profiler.stop().statistics.map(({gcType}) => gcType);

    // a full collection right before the rounds throws optimized code of the round away, and
    // the rounds would time its recompilation instead of the steady state of a frame loop
    expect(gcTypes.length).toBeGreaterThan(0);
    expect(gcTypes).not.toContain('MarkSweepCompact');
  });

  test('stops its GC profiler when a round throws, and rethrows', () => {
    const start = vi.spyOn(GCProfiler.prototype, 'start');
    const stop = vi.spyOn(GCProfiler.prototype, 'stop');

    expect(() =>
      measureAllocatedBytes(
        () => {
          throw new Error('round failed');
        },
        {warmUpRounds: 0, rounds: 1},
      ),
    ).toThrow('round failed');

    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(start.mock.calls.length);
  });
});
