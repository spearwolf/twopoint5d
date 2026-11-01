import {describe, expect, test} from 'vitest';
import {assertWholeNumber} from './assertWholeNumber.js';

describe('assertWholeNumber', () => {
  describe('with a min', () => {
    test.each([
      [1, 1],
      [7, 1],
      [0, 0],
    ])('a whole number of min or more passes and comes back: %s (min %s)', (value, min) => {
      expect(assertWholeNumber(value, 'Subject', 'x', min)).toBe(value);
    });

    test('-0 passes a min of 0', () => {
      expect(Object.is(assertWholeNumber(-0, 'Subject', 'x', 0), -0)).toBe(true);
    });

    test.each([
      [0, 1, '0'],
      [-1, 0, '-1'],
      [1.5, 0, '1.5'],
      [NaN, 0, 'NaN'],
      [Infinity, 0, 'Infinity'],
      [-Infinity, 0, '-Infinity'],
      ['1', 0, '"1"'],
      [null, 0, 'null'],
      [undefined, 0, 'undefined'],
    ])('%s is refused for min %s', (value, min, written) => {
      expect(() => assertWholeNumber(value, 'Subject', 'x', min)).toThrow(
        new RangeError(`Subject: x must be a whole number of ${min} or more, got ${written}`),
      );
    });
  });

  describe('without a min', () => {
    test.each([-3, 0, 5])('a whole number of any sign passes and comes back: %s', (value) => {
      expect(assertWholeNumber(value, 'Subject', 'x')).toBe(value);
    });

    test.each([
      [1.5, '1.5'],
      [NaN, 'NaN'],
      [Infinity, 'Infinity'],
      [-Infinity, '-Infinity'],
      ['1', '"1"'],
      [null, 'null'],
      [undefined, 'undefined'],
    ])('%s is refused', (value, written) => {
      expect(() => assertWholeNumber(value, 'Subject', 'x')).toThrow(
        new RangeError(`Subject: x must be a whole number, got ${written}`),
      );
    });
  });
});
