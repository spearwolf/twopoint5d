import {describe, expect, test} from 'vitest';

import {alignedAttributeSize} from './alignedAttributeSize.js';

describe('alignedAttributeSize()', () => {
  test('an attribute of 32 or 64 bits takes its own size', () => {
    expect(alignedAttributeSize(3, 'float64')).toBe(3);
    expect(alignedAttributeSize(3, 'float32')).toBe(3);
    expect(alignedAttributeSize(1, 'int32')).toBe(1);
    expect(alignedAttributeSize(5, 'uint32')).toBe(5);
  });

  test('a 16-bit attribute rounds up to an even number of elements', () => {
    expect(alignedAttributeSize(1, 'float16')).toBe(2);
    expect(alignedAttributeSize(3, 'float16')).toBe(4);
    expect(alignedAttributeSize(2, 'uint16')).toBe(2);
    expect(alignedAttributeSize(3, 'int16')).toBe(4);
  });

  test('an 8-bit attribute rounds up to a multiple of four elements', () => {
    expect(alignedAttributeSize(1, 'uint8')).toBe(4);
    expect(alignedAttributeSize(3, 'uint8')).toBe(4);
    expect(alignedAttributeSize(4, 'uint8')).toBe(4);
    expect(alignedAttributeSize(5, 'int8')).toBe(8);
    expect(alignedAttributeSize(2, 'uint8clamped')).toBe(4);
  });
});
