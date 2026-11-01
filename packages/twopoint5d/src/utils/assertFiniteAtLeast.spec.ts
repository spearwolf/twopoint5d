import {describe, expect, test} from 'vitest';
import {assertFiniteAtLeast} from './assertFiniteAtLeast.js';

describe('assertFiniteAtLeast', () => {
  test.each([
    [1, 1],
    [1.5, 1],
    [100, 1],
    [0, 0],
    [-2, -3],
  ])('a finite number of min or more passes and comes back: %s (min %s)', (value, min) => {
    expect(assertFiniteAtLeast(value, 'Subject', 'x', min)).toBe(value);
  });

  test('-0 passes a min of 0', () => {
    expect(Object.is(assertFiniteAtLeast(-0, 'Subject', 'x', 0), -0)).toBe(true);
  });

  test.each([
    [0.5, 1, '0.5'],
    [-1, 0, '-1'],
    [-0.001, 0, '-0.001'],
    [NaN, 0, 'NaN'],
    [Infinity, 0, 'Infinity'],
    [-Infinity, 0, '-Infinity'],
    ['1', 0, '"1"'],
    [null, 0, 'null'],
    [undefined, 0, 'undefined'],
  ])('%s is refused for min %s', (value, min, written) => {
    expect(() => assertFiniteAtLeast(value, 'Subject', 'x', min)).toThrow(
      new RangeError(`Subject: x must be a finite number of ${min} or more, got ${written}`),
    );
  });
});
