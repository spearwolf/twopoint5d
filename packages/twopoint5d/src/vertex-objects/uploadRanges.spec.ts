import {describe, expect, test} from 'vitest';
import {insertRange, MAX_UPLOAD_RANGES, UPLOAD_RANGES_ARRAY_LENGTH} from './uploadRanges.js';

/** A range list of `pairs`, laid out the way `insertRange()` expects it. */
function rangesOf(pairs: Array<[number, number]>): [Int32Array, number] {
  const ranges = new Int32Array(UPLOAD_RANGES_ARRAY_LENGTH);
  pairs.forEach(([from, to], k) => {
    ranges[2 * k] = from;
    ranges[2 * k + 1] = to;
  });
  return [ranges, pairs.length];
}

/** The pairs `ranges` holds in its first `count` places. */
function pairsOf(ranges: Int32Array, count: number): Array<[number, number]> {
  return Array.from({length: count}, (_, k): [number, number] => [ranges[2 * k]!, ranges[2 * k + 1]!]);
}

/** Insert `[from, to]` into a list of `pairs` and answer the pairs that come out. */
function insert(pairs: Array<[number, number]>, from: number, to: number): Array<[number, number]> {
  const [ranges, count] = rangesOf(pairs);
  return pairsOf(ranges, insertRange(ranges, count, from, to));
}

describe('insertRange()', () => {
  test('into an empty list', () => {
    expect(insert([], 3, 5)).toEqual([[3, 5]]);
  });

  test('a range that overlaps one that is there merges with it', () => {
    expect(insert([[2, 6]], 4, 9)).toEqual([[2, 9]]);
    expect(insert([[2, 6]], 3, 4)).toEqual([[2, 6]]);
  });

  test('a range that ends right below one that is there merges with it', () => {
    expect(insert([[5, 7]], 2, 4)).toEqual([[2, 7]]);
  });

  test('a range that starts right above one that is there merges with it', () => {
    expect(insert([[5, 7]], 8, 9)).toEqual([[5, 9]]);
  });

  test('a range between two pairs is sorted in between them', () => {
    expect(
      insert(
        [
          [0, 1],
          [10, 12],
        ],
        5,
        6,
      ),
    ).toEqual([
      [0, 1],
      [5, 6],
      [10, 12],
    ]);
  });

  test('a range that bridges two pairs merges all three', () => {
    expect(
      insert(
        [
          [0, 2],
          [8, 9],
          [20, 21],
        ],
        1,
        8,
      ),
    ).toEqual([
      [0, 9],
      [20, 21],
    ]);
    // touching on both sides bridges as well
    expect(
      insert(
        [
          [0, 1],
          [5, 6],
        ],
        2,
        4,
      ),
    ).toEqual([[0, 6]]);
  });

  test('the ninth range joins the two neighbours with the smallest gap between them', () => {
    // gaps of 3 everywhere but between 20 and 22, where the gap is 1
    const eight: Array<[number, number]> = [
      [0, 0],
      [4, 4],
      [8, 8],
      [12, 12],
      [16, 16],
      [20, 20],
      [22, 22],
      [26, 26],
    ];
    expect(eight).toHaveLength(MAX_UPLOAD_RANGES);

    expect(insert(eight, 30, 30)).toEqual([
      [0, 0],
      [4, 4],
      [8, 8],
      [12, 12],
      [16, 16],
      [20, 22],
      [26, 26],
      [30, 30],
    ]);
  });

  test('with equal gaps the lowest pair is joined', () => {
    const eight: Array<[number, number]> = Array.from({length: MAX_UPLOAD_RANGES}, (_, k): [number, number] => [4 * k, 4 * k]);

    expect(insert(eight, 32, 32)).toEqual([
      [0, 4],
      [8, 8],
      [12, 12],
      [16, 16],
      [20, 20],
      [24, 24],
      [28, 28],
      [32, 32],
    ]);
  });
});
