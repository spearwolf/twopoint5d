import {describe, expect, test, vi} from 'vitest';
import {expectDefined} from '../utils/expectDefined.js';
import type * as ExpectDefinedModule from '../utils/expectDefined.js';
import {createIndicesArray} from './createIndicesArray.js';

// a spy on the original: the tests below run against it as ever, and one counts its calls
vi.mock('../utils/expectDefined.js', async (importOriginal) => {
  const original = await importOriginal<typeof ExpectDefinedModule>();
  return {expectDefined: vi.fn(original.expectDefined)};
});

describe('createIndicesArray()', () => {
  test('steps every object by the stride, even when its indices leave a vertex unused', () => {
    // biome-ignore format: the line breaks lay the numbers out row by row
    expect(Array.from(createIndicesArray([0, 1, 2], 3, 4))).toEqual([
      0, 1, 2,
      4, 5, 6,
      8, 9, 10,
    ]);
  });

  test('repeats the indices of a quad once per object', () => {
    // biome-ignore format: the line breaks lay the numbers out row by row
    expect(Array.from(createIndicesArray([0, 2, 1, 0, 3, 2], 2, 4))).toEqual([
      0, 2, 1, 0, 3, 2,
      4, 6, 5, 4, 7, 6,
    ]);
  });

  test('answers a Uint16Array up to 65535 vertices and a Uint32Array beyond', () => {
    // 13107 objects of 5 vertices are 65535 vertices
    const short = createIndicesArray([0, 1, 2, 3, 4], 13107, 5);
    expect(short).toBeInstanceOf(Uint16Array);
    expect(Array.from(short).reduce((a, b) => Math.max(a, b))).toBe(65534);
    expect(Array.from(short.subarray(-5))).toEqual([65530, 65531, 65532, 65533, 65534]);

    // 16384 objects of 4 vertices are 65536 vertices
    const long = createIndicesArray([0, 2, 1, 0, 3, 2], 16384, 4);
    expect(long).toBeInstanceOf(Uint32Array);
    expect(Array.from(long).reduce((a, b) => Math.max(a, b))).toBe(65535);
    expect(Array.from(long.subarray(-6))).toEqual([65532, 65534, 65533, 65532, 65535, 65534]);
  });

  test('checks each index once, not once per object', () => {
    // restoreMocks takes back spies, not this mock, so its count is cleared by hand
    vi.mocked(expectDefined).mockClear();

    createIndicesArray([0, 2, 1, 0, 3, 2], 1000, 4);

    expect(vi.mocked(expectDefined)).toHaveBeenCalledTimes(6);
  });

  test('names the index an array of indices does not hold', () => {
    expect(() => createIndicesArray([0, undefined, 2] as unknown as number[], 2, 3)).toThrow('expected index 1 to be defined');
  });
});
