import {measureAllocatedBytes} from './measureAllocatedBytes.js';

const settleRounds = 200;
const attempts = 3;

// long enough for a compile job that waited for a free core to finish
const compilerPause = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

/**
 * {@link measureAllocatedBytes} for a round that runs through the upload path of a geometry, which
 * the optimizing compiler takes over later than a single accessor, and where the objects of a
 * previous test cost the optimized code its place.
 *
 * What the setup of a test and the tests before it left behind is collected first, and the round
 * warms up afterwards: the optimized code holds the maps of those objects weakly, and a collection
 * that finds them dead only at the start of the measurement throws that code away — the
 * measurement would time the recompilation instead of the steady state of a frame loop. The
 * compiler runs beside the specs, and while every core runs a spec file a compile job waits, so
 * the answer is the lowest of three measurements with a pause before each. What a round allocates
 * in the steady state shows up in every one of them.
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
