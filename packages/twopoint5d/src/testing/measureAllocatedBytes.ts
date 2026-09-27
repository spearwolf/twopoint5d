import {GCProfiler, getHeapStatistics} from 'node:v8';

export interface MeasureAllocatedBytesOptions {
  /** Rounds run before the measurement, default 200. */
  warmUpRounds?: number;
  /** Rounds measured, default 50. */
  rounds?: number;
}

/**
 * The bytes one call of `round` puts on the V8 heap, averaged over `rounds` calls — a single
 * measurement. The allocation specs measure through `measureSettledBytes()` next to it, which
 * first collects what the setup of a test and the tests before it left behind and answers the
 * lowest of three of these measurements.
 *
 * What a garbage collection takes back while the rounds run is added back in through the
 * `GCProfiler`, so the number stays put even when a scavenge falls into the middle of the
 * measurement. The warm-up rounds let the optimizing compiler settle on the shape a long frame
 * loop runs: what is measured is the code an application executes after a few seconds, not the
 * interpreter. The backing stores of typed arrays live outside the heap and do not count.
 *
 * @throws when the process runs without `--expose-gc`, which the Vitest config of
 * `packages/twopoint5d` starts its workers with
 */
export function measureAllocatedBytes(round: () => void, options: MeasureAllocatedBytesOptions = {}): number {
  const {warmUpRounds = 200, rounds = 50} = options;

  const {gc} = globalThis;
  if (typeof gc !== 'function') {
    throw new Error(
      'measureAllocatedBytes() needs --expose-gc: run the spec through the Vitest config of packages/twopoint5d, which starts its workers with it',
    );
  }

  for (let i = 0; i < warmUpRounds; i++) round();

  // an empty young generation, so that what a scavenge frees during the rounds was allocated
  // during them — a minor collection, because a full one right here throws optimized code of the
  // round away, and the rounds would time its recompilation
  gc({type: 'minor'});

  const profiler = new GCProfiler();
  profiler.start();
  const start = getHeapStatistics().used_heap_size;

  for (let i = 0; i < rounds; i++) round();

  const end = getHeapStatistics().used_heap_size;
  const result = profiler.stop();

  // what a collection freed during the rounds was allocated during them, too
  let collected = 0;
  for (const {beforeGC, afterGC} of result.statistics) {
    collected += beforeGC.heapStatistics.usedHeapSize - afterGC.heapStatistics.usedHeapSize;
  }

  return (end - start + collected) / rounds;
}
