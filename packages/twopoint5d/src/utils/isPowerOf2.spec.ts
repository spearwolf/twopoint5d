import {describe, expect, it} from 'vitest';
import {isPowerOf2} from './isPowerOf2.js';

describe('isPowerOf2', () => {
  it('power of 2 value', () => {
    expect(isPowerOf2(1)).toBe(true);
    expect(isPowerOf2(2)).toBe(true);
    expect(isPowerOf2(4)).toBe(true);
    expect(isPowerOf2(512)).toBe(true);
    expect(isPowerOf2(4096)).toBe(true);
  });
  it('not power of 2 value', () => {
    expect(isPowerOf2(0)).toBe(false);
    expect(isPowerOf2(63)).toBe(false);
    expect(isPowerOf2(11)).toBe(false);
    expect(isPowerOf2(2047)).toBe(false);
  });

  it('the powers of two a double holds beyond 32 bits', () => {
    expect(isPowerOf2(2 ** 31)).toBe(true);
    expect(isPowerOf2(2 ** 32)).toBe(true);
    expect(isPowerOf2(2 ** 53)).toBe(true);
    expect(isPowerOf2(2 ** 1023)).toBe(true);
  });

  it('no other number beyond 32 bits', () => {
    expect(isPowerOf2(2 ** 32 + 1)).toBe(false);
    expect(isPowerOf2(3 * 2 ** 32)).toBe(false);
    expect(isPowerOf2(2 ** 50 + 2)).toBe(false);
  });

  it('no fraction, no negative number and nothing that is not finite', () => {
    expect(isPowerOf2(2.5)).toBe(false);
    expect(isPowerOf2(0.5)).toBe(false);
    expect(isPowerOf2(-2)).toBe(false);
    expect(isPowerOf2(-(2 ** 31))).toBe(false);
    expect(isPowerOf2(Infinity)).toBe(false);
    expect(isPowerOf2(NaN)).toBe(false);
  });
});
