import {measureAllocatedBytes} from './measureAllocatedBytes.js';

const settleRounds = 200;
const attempts = 3;

// long enough for a compile job that waited for a free core to finish
const compilerPause = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

/**
 * The heap bytes one call of `round` puts on the V8 heap once a frame loop has settled — the
 * measurement every `hot-path-allocations.spec.ts` goes through, on top of
 * {@link measureAllocatedBytes}.
 *
 * What the setup of a test and the tests before it left behind is collected first, and the round
 * warms up afterwards: the optimized code holds the maps of those objects weakly, and a collection
 * that finds them dead only at the start of the measurement throws that code away — the
 * measurement would time the recompilation instead of the steady state of a frame loop. The
 * compiler runs beside the specs, and while every core runs a spec file a compile job waits, so
 * the answer is the lowest of three measurements with a pause before each. What a round allocates
 * in the steady state shows up in every one of them.
 *
 * On Node 24.21, over 50 runs of the suite in parallel workers — with V8 coverage, beside eight
 * busy cores and in shuffled order — the allocation-free rounds of the specs measured 0.22 B per
 * call at most and a vertex object 56.2 B at most.
 */
export async function measureSettledBytes(round: () => void): Promise<number> {
  for (let i = 0; i < settleRounds; i++) round();
  (globalThis as {gc?: () => void}).gc?.();

  let lowest = Infinity;
  for (let i = 0; i < attempts; i++) {
    await compilerPause();
    lowest = Math.min(lowest, measureAllocatedBytes(round));
  }
  return lowest;
}
