import {describe, expect, it, vi} from 'vitest';
import {BufferAttribute, InterleavedBuffer} from 'three/webgpu';
import {setUploadRange} from './setUploadRange.js';

// 4 vertices per object, 3 elements per vertex — 12 elements per object
const VERTEX_COUNT = 4;
const ITEM_SIZE = 3;

function makeAttribute(standingRanges: Array<[number, number]> = []): BufferAttribute {
  const attr = new BufferAttribute(new Float32Array(10 * VERTEX_COUNT * ITEM_SIZE), ITEM_SIZE);
  for (const [start, count] of standingRanges) {
    attr.addUpdateRange(start, count);
  }
  return attr;
}

describe('setUploadRange', () => {
  it.each([
    ['no range standing, objects 2..4', [] as Array<[number, number]>, 2, 4, [{start: 24, count: 36}]],
    ['no range standing, one object', [] as Array<[number, number]>, 5, 5, [{start: 60, count: 12}]],
    ['toIdx below fromIdx names no object', [] as Array<[number, number]>, 3, 2, [{start: 36, count: 0}]],
    ['a range standing below', [[0, 12]] as Array<[number, number]>, 5, 5, [{start: 0, count: 72}]],
    ['a range standing above', [[60, 12]] as Array<[number, number]>, 1, 1, [{start: 12, count: 60}]],
    ['a range standing overlaps', [[12, 36]] as Array<[number, number]>, 3, 5, [{start: 12, count: 60}]],
    ['a range standing with count 0 does not count', [[36, 0]] as Array<[number, number]>, 1, 1, [{start: 12, count: 12}]],
    ['an empty new range takes over the range standing', [[24, 12]] as Array<[number, number]>, 3, 2, [{start: 24, count: 12}]],
    [
      'two ranges standing',
      [
        [0, 12],
        [48, 12],
      ] as Array<[number, number]>,
      2,
      2,
      [{start: 0, count: 60}],
    ],
  ])('%s', (_name, standingRanges, fromIdx, toIdx, expected) => {
    const attr = makeAttribute(standingRanges);
    setUploadRange(attr, fromIdx, toIdx, VERTEX_COUNT, ITEM_SIZE);
    expect(attr.updateRanges).toEqual(expected);
  });

  it.each([
    ['the range that would result is standing already', [[24, 12]] as Array<[number, number]>, 3, 2],
    ['the standing range already contains the object', [[0, 72]] as Array<[number, number]>, 2, 2],
  ])('%s leaves the standing range untouched', (_name, standingRanges, fromIdx, toIdx) => {
    const attr = makeAttribute(standingRanges);
    const clearSpy = vi.spyOn(attr, 'clearUpdateRanges');
    const before = attr.updateRanges[0];

    setUploadRange(attr, fromIdx, toIdx, VERTEX_COUNT, ITEM_SIZE);

    expect(clearSpy).not.toHaveBeenCalled();
    expect(attr.updateRanges[0]).toBe(before);
  });

  it('computes with the itemSize it is given, also for an interleaved buffer', () => {
    const buffer = new InterleavedBuffer(new Float32Array(10 * 4 * 5), 5);
    setUploadRange(buffer, 2, 3, 4, 5);
    expect(buffer.updateRanges).toEqual([{start: 40, count: 40}]);
  });
});
