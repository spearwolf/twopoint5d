import {describe, expect, it} from 'vitest';
import {findNextPowerOf2} from './findNextPowerOf2.js';

describe('findNextPowerOf2', () => {
  it('should work as expected', () => {
    expect(findNextPowerOf2(0)).toBe(1);
    expect(findNextPowerOf2(1)).toBe(1);
    expect(findNextPowerOf2(2)).toBe(2);
    expect(findNextPowerOf2(3)).toBe(4);
    expect(findNextPowerOf2(9)).toBe(16);
    expect(findNextPowerOf2(666)).toBe(1024);
    expect(findNextPowerOf2(4096)).toBe(4096);
  });

  it('beyond 32 bits', () => {
    expect(findNextPowerOf2(2 ** 30 + 1)).toBe(2 ** 31);
    expect(findNextPowerOf2(2 ** 31)).toBe(2 ** 31);
    expect(findNextPowerOf2(2 ** 32 + 1)).toBe(2 ** 33);
    expect(findNextPowerOf2(2 ** 50 + 1)).toBe(2 ** 51);
    expect(findNextPowerOf2(2 ** 1023)).toBe(2 ** 1023);
  });

  it('a number no finite power of two reaches answers Infinity', () => {
    expect(findNextPowerOf2(2 ** 1023 + 2 ** 971)).toBe(Infinity);
    expect(findNextPowerOf2(Number.MAX_VALUE)).toBe(Infinity);
    expect(findNextPowerOf2(Infinity)).toBe(Infinity);
  });

  it('everything up to 1 answers 1, NaN answers NaN', () => {
    expect(findNextPowerOf2(0.5)).toBe(1);
    expect(findNextPowerOf2(-5)).toBe(1);
    expect(findNextPowerOf2(-Infinity)).toBe(1);
    expect(findNextPowerOf2(1.5)).toBe(2);
    expect(findNextPowerOf2(NaN)).toBeNaN();
  });
});
