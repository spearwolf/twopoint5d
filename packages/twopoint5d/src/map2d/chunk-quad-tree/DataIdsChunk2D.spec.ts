import {describe, expect, test, vi} from 'vitest';

import {DataIdsChunk2D} from './DataIdsChunk2D.js';

describe('DataIdsChunk2D', () => {
  // a 4x3 chunk whose upper left corner sits at (10, 20), every cell carrying its own value:
  //   1  2  3  4
  //   5  6  7  8
  //   9 10 11 12
  const makeChunk = () =>
    new DataIdsChunk2D({
      x: 10,
      y: 20,
      width: 4,
      height: 3,
      uint32Arr: new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    });

  test('reads nothing from the row next door', () => {
    const chunk = makeChunk();

    expect(chunk.readDataIdAt(9, 21)).toBeUndefined();
    expect(chunk.readDataIdAt(14, 20)).toBeUndefined();
    expect(chunk.readDataIdAt(15, 19)).toBeUndefined();

    expect(chunk.readDataIdAt(12, 21)).toBe(7);
  });

  test('names the compression it cannot handle and reports it by throwing alone', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const chunk = new DataIdsChunk2D({x: 0, y: 0, width: 2, height: 2, data: 'AAAAAA==', compression: 'gzip'});

    expect(() => chunk.readDataIdAt(0, 0)).toThrow(/gzip/);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
