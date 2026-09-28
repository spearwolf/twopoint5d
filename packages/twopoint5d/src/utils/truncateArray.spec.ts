import {describe, expect, test} from 'vitest';
import {truncateArray} from './truncateArray.js';

describe('truncateArray', () => {
  test('empties the list without a length', () => {
    const list = [1, 2, 3];

    truncateArray(list);

    expect(list).toEqual([]);
  });

  test('cuts the list to the length and leaves the first entries standing', () => {
    const a = {};
    const b = {};
    const list = [a, b, {}, {}];

    truncateArray(list, 2);

    expect(list).toHaveLength(2);
    expect(list[0]).toBe(a);
    expect(list[1]).toBe(b);
  });

  test('leaves a list that is no longer than the length as it is', () => {
    const list = [1, 2];

    truncateArray(list, 5);

    expect(list).toEqual([1, 2]);
  });
});
