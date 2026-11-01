import {describe, expect, test} from 'vitest';
import {assertWholeNumberOrInfinity} from './assertWholeNumberOrInfinity.js';

describe('assertWholeNumberOrInfinity', () => {
  test.each([
    [1, 1],
    [10_000, 1],
    [0, 0],
    [Infinity, 1],
    [Infinity, 0],
  ])('a whole number of min or more, or Infinity, passes and comes back: %s (min %s)', (value, min) => {
    expect(assertWholeNumberOrInfinity(value, 'Subject', 'x', min)).toBe(value);
  });

  test('-0 passes a min of 0', () => {
    expect(Object.is(assertWholeNumberOrInfinity(-0, 'Subject', 'x', 0), -0)).toBe(true);
  });

  test.each([
    [0, 1, '0'],
    [-1, 0, '-1'],
    [1.5, 1, '1.5'],
    [NaN, 1, 'NaN'],
    [-Infinity, 1, '-Infinity'],
    ['1', 1, '"1"'],
    [null, 1, 'null'],
    [undefined, 1, 'undefined'],
  ])('%s is refused for min %s', (value, min, written) => {
    expect(() => assertWholeNumberOrInfinity(value, 'Subject', 'x', min)).toThrow(
      new RangeError(`Subject: x must be a whole number of ${min} or more, or Infinity, got ${written}`),
    );
  });
});
