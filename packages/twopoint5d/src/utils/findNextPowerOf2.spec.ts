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
});
