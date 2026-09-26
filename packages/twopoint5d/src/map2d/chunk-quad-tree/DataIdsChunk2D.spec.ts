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

  test('refuses a uint32Arr that does not hold width × height ids', () => {
    const tooShort = () => new DataIdsChunk2D({x: 0, y: 0, width: 2, height: 2, uint32Arr: new Uint32Array(3)});
    const tooLong = () => new DataIdsChunk2D({x: 0, y: 0, width: 2, height: 2, uint32Arr: new Uint32Array(5)});

    expect(tooShort).toThrow(RangeError);
    expect(tooShort).toThrow('DataIdsChunk2D: a chunk of 2x2 takes 4 ids, got 3');
    expect(tooLong).toThrow(RangeError);
    expect(tooLong).toThrow('DataIdsChunk2D: a chunk of 2x2 takes 4 ids, got 5');
  });

  test('refuses base64 data that does not hold width × height ids on the first read', () => {
    // three ids: 1, 2, 3, little-endian
    const chunk = new DataIdsChunk2D({x: 0, y: 0, width: 2, height: 2, data: 'AQAAAAIAAAADAAAA'});

    const read = () => chunk.readDataIdAt(0, 0);

    expect(read).toThrow(RangeError);
    expect(read).toThrow('DataIdsChunk2D: a chunk of 2x2 takes 4 ids, got 3');
    // the refusal is not cached: the next read throws again
    expect(read).toThrow(RangeError);
    expect(read).toThrow('DataIdsChunk2D: a chunk of 2x2 takes 4 ids, got 3');
  });

  test('reads the ids of base64 data row by row', () => {
    // the ids 1, 2, 3, 4, little-endian
    const chunk = new DataIdsChunk2D({x: 10, y: 20, width: 2, height: 2, data: 'AQAAAAIAAAADAAAABAAAAA=='});

    expect(chunk.readDataIdAt(11, 21)).toBe(4);
    expect(chunk.readDataIdAt(10, 21)).toBe(3);
  });

  test('refuses data that names a compression, as a layer read from a map file can', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // not a fresh object literal, so it passes without the excess property check — like parsed JSON
    const fromMapFile = {x: 0, y: 0, width: 2, height: 2, data: 'AAAAAA==', compression: 'gzip'};
    const chunk = new DataIdsChunk2D(fromMapFile);

    // 'AAAAAA==' holds one id, not four: the compression is refused before the length is looked at
    expect(() => chunk.readDataIdAt(0, 0)).toThrow(/gzip/);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  test('takes an empty compression for no compression', () => {
    const fromMapFile = {x: 0, y: 0, width: 2, height: 2, data: 'AQAAAAIAAAADAAAABAAAAA==', compression: ''};

    expect(new DataIdsChunk2D(fromMapFile).readDataIdAt(0, 0)).toBe(1);
  });

  test('does not take a compression in its params', () => {
    const chunk = new DataIdsChunk2D({
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      data: 'AAAAAA==',
      // @ts-expect-error compression is not part of the params
      compression: 'gzip',
    });

    expect(() => chunk.readDataIdAt(0, 0)).toThrow(/gzip/);
  });
});
