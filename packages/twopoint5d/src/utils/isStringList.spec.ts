import {describe, expect, it} from 'vitest';
import {isStringList} from './isStringList.js';

describe('isStringList', () => {
  it('takes an array of strings and an empty array', () => {
    expect(isStringList(['a', 'b'])).toBe(true);
    expect(isStringList([''])).toBe(true);
    expect(isStringList([])).toBe(true);
  });

  it('refuses an array with an entry that is no string', () => {
    expect(isStringList(['a', 1])).toBe(false);
    expect(isStringList([undefined])).toBe(false);
    expect(isStringList(['a', null])).toBe(false);
  });

  it('refuses what is no array', () => {
    expect(isStringList('a')).toBe(false);
    expect(isStringList({0: 'a', length: 1})).toBe(false);
    expect(isStringList(new Set(['a']))).toBe(false);
    expect(isStringList(null)).toBe(false);
    expect(isStringList(undefined)).toBe(false);
  });
});
