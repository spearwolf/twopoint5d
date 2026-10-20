import {describe, expect, test} from 'vitest';

import {sortSlots} from './sortSlots.js';

// the order a stable sort gives: by key, ties in slot order
const expectedOrder = (keys: ArrayLike<number>, n: number): number[] =>
  Array.from({length: n}, (_, i) => i).sort((a, b) => keys[a]! - keys[b]! || a - b);

const run = (keys: number[]): number[] => {
  const n = keys.length;
  const result = sortSlots(Float64Array.from(keys), new Uint32Array(n), new Uint32Array(n), n);
  return Array.from(result.subarray(0, n));
};

// a small deterministic generator, so a failing case can be told again
const lcg = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

describe('sortSlots()', () => {
  test('answers no slot for none, and the one slot for one', () => {
    expect(run([])).toEqual([]);
    expect(run([5])).toEqual([0]);
  });

  test('orders the slots by their keys, the lowest first', () => {
    expect(run([3, 1, 2])).toEqual([1, 2, 0]);
  });

  test('keeps the slot order of equal keys', () => {
    expect(run([1, 0, 1, 0, 1])).toEqual([1, 3, 0, 2, 4]);
  });

  test.each([31, 32, 33, 64, 65, 1000, 4097])('orders %i random keys as a stable sort does', (n) => {
    const random = lcg(n);
    // few distinct values, so that ties cross the runs and the merges
    const keys = Array.from({length: n}, () => Math.floor(random() * 17));
    expect(run(keys)).toEqual(expectedOrder(keys, n));
  });

  test('leaves sorted keys in slot order and turns reversed ones around', () => {
    const n = 1000;
    const sorted = Array.from({length: n}, (_, i) => i);
    expect(run(sorted)).toEqual(sorted);
    expect(run(sorted.map((i) => -i))).toEqual(sorted.map((i) => n - 1 - i));
  });

  test('sorts the first n slots of longer arrays and reads nothing beyond them', () => {
    const keys = Float64Array.from([2, 1, 0, -100, -200]);
    const result = sortSlots(keys, new Uint32Array(5), new Uint32Array(5), 3);
    expect(Array.from(result.subarray(0, 3))).toEqual([2, 1, 0]);
  });
});
