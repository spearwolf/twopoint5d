import {describe, expect, test} from 'vitest';

import {copyObjectRanges} from './copyObjectRanges.js';

describe('copyObjectRanges()', () => {
  test('copies the elements of each object range and nothing between them', () => {
    const source = new Uint8Array(Array.from({length: 12}, (_, i) => i + 1));
    const target = new Uint32Array(12);

    // objects of two elements: object 0, and objects 3 … 4
    copyObjectRanges(source, target, new Int32Array([0, 0, 3, 4, 5, 5]), 2, 2);

    expect(Array.from(target)).toEqual([1, 2, 0, 0, 0, 0, 7, 8, 9, 10, 0, 0]);
  });

  test('converts each value into the element type of the target', () => {
    const source = new Int8Array([-5, -128]);
    const target = new Int32Array(2);

    copyObjectRanges(source, target, new Int32Array([0, 1]), 1, 1);

    expect(Array.from(target)).toEqual([-5, -128]);
  });
});
