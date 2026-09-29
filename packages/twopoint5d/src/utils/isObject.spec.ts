import {describe, expect, it} from 'vitest';
import {isObject} from './isObject.js';

describe('isObject', () => {
  it('takes a plain object, an array and an instance of a class', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(true);
    expect(isObject(new Map())).toBe(true);
  });

  it('refuses null, undefined, a primitive and a function', () => {
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject(0)).toBe(false);
    expect(isObject('object')).toBe(false);
    expect(isObject(Math.max)).toBe(false);
  });
});
