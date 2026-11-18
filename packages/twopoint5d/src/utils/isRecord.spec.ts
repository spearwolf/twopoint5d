import {describe, expect, it} from 'vitest';
import {isRecord} from './isRecord.js';

describe('isRecord', () => {
  it('takes a plain object and an instance of a class', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({a: 1})).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
    expect(isRecord(new Map())).toBe(true);
  });

  it('refuses an array, null, undefined, a function and a primitive', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord(['a'])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord(Math.max)).toBe(false);
    expect(isRecord(0)).toBe(false);
    expect(isRecord('record')).toBe(false);
    expect(isRecord(true)).toBe(false);
  });
});
