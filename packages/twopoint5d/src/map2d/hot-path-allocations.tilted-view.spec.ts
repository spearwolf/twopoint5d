import {Matrix4, PerspectiveCamera} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

import {measureAllocatedBytes} from '../testing/measureAllocatedBytes.js';
import {CameraBasedVisibility} from './CameraBasedVisibility.js';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';

// Vitest runs every spec file in a process of its own, so the recomputations measured here start
// from a compiler that has seen nothing of their path — as they do in an application that starts
// with a tilted view. What the path allocates before the compiler has taken it over is accounted
// for in `measurePerTile()`, not left to the tests that happen to run before.

// a tile that allocates anything costs 16 B at least: one such allocation in every 16 tiles reads
// 1 B per tile, the limit, and one of 32 B — a small object — in every 16 tiles reads 2 B. When
// this limit was set, both tests measured 0.00 B per tile — alone, in either order, with the order
// of a group turned around and with V8 coverage
const BYTES_PER_CALL_LIMIT = 1;

const RECOMPUTATIONS_PER_ROUND = 4;
// the rounds of both views before the first measurement — 3 200 recomputations, see `measurePerTile()`
const SETTLE_ROUNDS = 400;
// the rounds a view runs before each of its measurements, and the rounds measured: short, so that
// five groups keep a test under three seconds with V8 coverage
const WARM_UP_ROUNDS = 5;
const MEASURED_ROUNDS = 10;
const GROUPS = 5;
// how far the two measurements of one view in a group may lie apart for the group to count as one
// in which nothing moved: half the smallest heap object, per recomputation
const STILL_BYTES = 8;

// long enough for a compile job that waited for a free core to finish, as in `measureSettledBytes()`
const compilerPause = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

const makeCenter = (): [number, number] => [3.25, -1.5];
const makeMatrixWorld = () => new Matrix4().makeTranslation(0.25, 0, 0.75);
// the second position: a change the gate sees, and the same tiles
const makeOtherMatrixWorld = () => new Matrix4().makeTranslation(0.25, 0, 0.7501);

// 208 tiles under the tilted camera
const makeGrid = () => new Map2DTileCoordsUtil(400, 400, 0.25, -0.5);
// 108 tiles under the tilted camera — any edge from 540 to 600 gives that many
const makeCoarserGrid = () => new Map2DTileCoordsUtil(566, 566, 0.25, -0.5);

function makeTiltedCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(75, 1.6, 0.1, 4000);
  camera.position.set(0, 350, 500);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

/** Recomputes the view of `visibility` on `grid` four times per call, between two positions. */
function makeRound(visibility: CameraBasedVisibility, grid: Map2DTileCoordsUtil): () => void {
  const center = makeCenter();
  const matrixWorlds = [makeMatrixWorld(), makeOtherMatrixWorld()] as const;

  let previous = visibility.computeVisibleTiles([], center, grid, matrixWorlds[0])!.tiles;
  let flip = 0;
  return () => {
    for (let i = 0; i < RECOMPUTATIONS_PER_ROUND; i++) {
      flip ^= 1;
      previous = visibility.computeVisibleTiles(previous, center, grid, matrixWorlds[flip]!)!.tiles;
    }
  };
}

interface PerTile {
  bytesPerTile: number;
  message: string;
}

const measure = (round: () => void): number =>
  measureAllocatedBytes(round, {warmUpRounds: WARM_UP_ROUNDS, rounds: MEASURED_ROUNDS}) / RECOMPUTATIONS_PER_ROUND;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/**
 * The bytes a recomputation allocates per tile, as the difference of two views of the same camera
 * over the difference of their tiles: what a recomputation costs whatever the view holds drops out.
 *
 * That fixed amount lies in three.js. A recomputation calls `Frustum#setFromProjectionMatrix()`,
 * `Plane#normalize()`, `Matrix4#makeTranslation()`, `Matrix4#decompose()` and
 * `Quaternion#setFromRotationMatrix()` once, whatever the view holds, and until the optimizing
 * compiler has taken them over they box their doubles; `computeVisibleTiles()` and
 * `dependenciesChanged()` run once per recomputation as well, and stand in Maglev as long, without
 * allocating. The amount does not stand still while the measurements run: it falls from some
 * 5 300 B a recomputation over the first 3 000 recomputations to some 350 B, and after that in steps
 * — some 60 B, then some 35 B — as those functions arrive one after another, until from some 14 000
 * recomputations on 3 B remain. A measurement a compile job lands in reads up to some 220 B more. So
 * a later measurement of the same view reads less than an earlier one, whatever its tiles.
 *
 * Hence the settle rounds, which leave the steep part behind, and the order of the measurements: in
 * groups of small, big, big, small, so that a step inside a group falls on both views alike. What
 * counts is the median of the groups in which the two measurements of each view agree — nothing
 * moved and no compile job landed there —, and the median of all five where none does.
 */
async function measurePerTile(
  small: CameraBasedVisibility,
  smallGrid: Map2DTileCoordsUtil,
  big: CameraBasedVisibility,
  bigGrid: Map2DTileCoordsUtil,
): Promise<PerTile> {
  const rounds = [makeRound(small, smallGrid), makeRound(big, bigGrid)] as const;

  for (let i = 0; i < SETTLE_ROUNDS; i++) {
    rounds[0]();
    rounds[1]();
  }
  (globalThis as {gc?: () => void}).gc?.();

  const differences: number[] = [];
  const stillDifferences: number[] = [];
  const groups: string[] = [];
  for (let i = 0; i < GROUPS; i++) {
    await compilerPause();
    const small1 = measure(rounds[0]);
    const big1 = measure(rounds[1]);
    const big2 = measure(rounds[1]);
    const small2 = measure(rounds[0]);
    const difference = (big1 + big2 - small1 - small2) / 2;
    differences.push(difference);
    if (Math.abs(big1 - big2) < STILL_BYTES && Math.abs(small1 - small2) < STILL_BYTES) stillDifferences.push(difference);
    groups.push(`${big1.toFixed(1)} ${big2.toFixed(1)} / ${small1.toFixed(1)} ${small2.toFixed(1)}`);
  }

  const smallTiles = small.visibles.length;
  const bigTiles = big.visibles.length;
  const counted = stillDifferences.length > 0 ? stillDifferences : differences;
  const bytesPerTile = median(counted) / (bigTiles - smallTiles);
  return {
    bytesPerTile,
    message: `${bytesPerTile.toFixed(2)} bytes per tile, the median of ${counted.length} of ${GROUPS} groups — per group, the bytes of a recomputation of ${bigTiles} tiles, twice, against one of ${smallTiles}: ${groups.join(', ')}`,
  };
}

describe('CameraBasedVisibility on the hot path of a tilted view', () => {
  test('a recomputation allocates nothing per tile, however many tiles the view holds', async () => {
    const small = new CameraBasedVisibility(makeTiltedCamera());
    const big = new CameraBasedVisibility(makeTiltedCamera());

    const {bytesPerTile, message} = await measurePerTile(small, makeCoarserGrid(), big, makeGrid());

    expect(big.visibles.length, 'a view of some hundred tiles').toBeGreaterThan(150);
    expect(small.visibles.length, 'about half as many tiles').toBeLessThan(big.visibles.length * 0.6);
    expect(Math.abs(bytesPerTile), message).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('a recomputation the limit cuts allocates nothing per tile', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const small = new CameraBasedVisibility(makeTiltedCamera());
      small.maxVisibleTiles = 50;
      const big = new CameraBasedVisibility(makeTiltedCamera());
      big.maxVisibleTiles = 150;

      const {bytesPerTile, message} = await measurePerTile(small, makeGrid(), big, makeGrid());

      expect(warn, 'the limit cut the view').toHaveBeenCalledWith(expect.stringContaining('more than 150 tiles'));
      expect(big.visibles).toHaveLength(150);
      expect(small.visibles).toHaveLength(50);
      expect(Math.abs(bytesPerTile), message).toBeLessThan(BYTES_PER_CALL_LIMIT);
    } finally {
      warn.mockRestore();
    }
  });
});
