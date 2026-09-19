import {describe, expect, test} from 'vitest';
import {createIndicesArray} from './createIndicesArray.js';

describe('createIndicesArray()', () => {
  test('steps every object by the stride, even when its indices leave a vertex unused', () => {
    // prettier-ignore
    expect(Array.from(createIndicesArray([0, 1, 2], 3, 4))).toEqual([
      0, 1, 2,
      4, 5, 6,
      8, 9, 10,
    ]);
  });

  test('repeats the indices of a quad once per object', () => {
    // prettier-ignore
    expect(Array.from(createIndicesArray([0, 2, 1, 0, 3, 2], 2, 4))).toEqual([
      0, 2, 1, 0, 3, 2,
      4, 6, 5, 4, 7, 6,
    ]);
  });
});
