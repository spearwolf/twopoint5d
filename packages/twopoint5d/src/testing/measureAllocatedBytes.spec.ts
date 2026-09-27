import {GCProfiler} from 'node:v8';
import {describe, expect, test} from 'vitest';

import {measureAllocatedBytes} from './measureAllocatedBytes.js';

describe('measureAllocatedBytes()', () => {
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
});
