import {describe, expect, test} from 'vitest';
import {assertFinite} from './assertFinite.js';

describe('assertFinite', () => {
  test('a string is quoted in the message', () => {
    const check = () => assertFinite('abc', 'Subject', 'x');

    expect(check).toThrow(RangeError);
    expect(check).toThrow('Subject: x must be a finite number, got "abc"');
  });

  test.each([
    [NaN, 'NaN'],
    [Infinity, 'Infinity'],
    [-Infinity, '-Infinity'],
  ])('a number that is not finite is refused: %s', (value, written) => {
    expect(() => assertFinite(value, 'Subject', 'x')).toThrow(`Subject: x must be a finite number, got ${written}`);
  });

  test.each([0, -1, 0.5])('a finite number of any sign passes and comes back: %s', (value) => {
    expect(assertFinite(value, 'Subject', 'x')).toBe(value);
  });
});
