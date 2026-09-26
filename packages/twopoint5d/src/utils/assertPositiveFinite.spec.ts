import {describe, expect, test} from 'vitest';
import {assertPositiveFinite} from './assertPositiveFinite.js';

describe('assertPositiveFinite', () => {
  test('a string is quoted in the message', () => {
    const check = () => assertPositiveFinite('abc', 'Subject', 'size');

    expect(check).toThrow(RangeError);
    expect(check).toThrow('[Subject] size must be a finite number above 0, got "abc"');
  });

  test.each([
    [0, '0'],
    [NaN, 'NaN'],
    [-1, '-1'],
  ])('a number is written as it is: %s', (value, written) => {
    expect(() => assertPositiveFinite(value, 'Subject', 'size')).toThrow(
      `[Subject] size must be a finite number above 0, got ${written}`,
    );
  });

  test.each([1, 0.5])('a finite number above 0 passes: %s', (value) => {
    expect(() => assertPositiveFinite(value, 'Subject', 'size')).not.toThrow();
  });
});
