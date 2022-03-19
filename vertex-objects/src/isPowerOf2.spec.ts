import {isPowerOf2} from './isPowerOf2';

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
});
