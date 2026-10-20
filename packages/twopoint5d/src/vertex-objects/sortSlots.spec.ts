import {describe, expect, test} from 'vitest';

import {sortSlots} from './sortSlots.js';

// the order a stable sort gives: by key, ties in slot order
const expectedOrder = (keys: ArrayLike<number>, n: number): number[] =>
  Array.from({length: n}, (_, i) => i).sort((a, b) => keys[a]! - keys[b]! || a - b);

const run = (keys: number[]): number[] => {
  const n = keys.length;
  const order = Uint32Array.from({length: n}, (_, i) => i);
  const result = sortSlots(Float64Array.from(keys), order, new Uint32Array(n), n);
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

  test('sorts the first n entries of the order handed in and leaves the rest alone', () => {
    const keys = Float64Array.from([2, 1, 0, -100, -200]);
    const order = Uint32Array.from([0, 1, 2, 3, 4]);
    const scratch = new Uint32Array(5).fill(9);
    const result = sortSlots(keys, order, scratch, 3);
    expect(Array.from(result.subarray(0, 3))).toEqual([2, 1, 0]);
    expect(Array.from(order.subarray(3)), 'the order beyond n').toEqual([3, 4]);
    expect(Array.from(scratch.subarray(3)), 'the scratch beyond n').toEqual([9, 9]);
  });

  test('keeps the order handed in for equal keys, whatever the slot numbers say', () => {
    const keys = Float64Array.from([1, 1, 1, 0]);
    const order = Uint32Array.from([2, 0, 3, 1]);
    const result = sortSlots(keys, order, new Uint32Array(4), 4);
    expect(Array.from(result)).toEqual([3, 2, 0, 1]);
  });

  test('sorts a long order handed in out of slot order as a stable sort of that order does', () => {
    const random = lcg(7);
    const n = 300;
    const keys = Float64Array.from({length: n}, () => Math.floor(random() * 5));
    const given = Array.from({length: n}, (_, i) => (i * 7) % n);
    const expected = [...given].sort((a, b) => keys[a]! - keys[b]!);
    const result = sortSlots(keys, Uint32Array.from(given), new Uint32Array(n), n);
    expect(Array.from(result)).toEqual(expected);
  });
});
