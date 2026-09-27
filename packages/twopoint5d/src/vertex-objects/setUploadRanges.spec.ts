import {describe, expect, it, vi} from 'vitest';
import {BufferAttribute, InterleavedBuffer} from 'three/webgpu';
import {setUploadRanges} from './setUploadRanges.js';
import {UPLOAD_RANGES_ARRAY_LENGTH} from './uploadRanges.js';

// 4 vertices per object, 3 elements per vertex — 12 elements per object
const VERTEX_COUNT = 4;
const ITEM_SIZE = 3;

type Pairs = Array<[number, number]>;

function makeAttribute(standingRanges: Pairs = []): BufferAttribute {
  const attr = new BufferAttribute(new Float32Array(10 * VERTEX_COUNT * ITEM_SIZE), ITEM_SIZE);
  for (const [start, count] of standingRanges) {
    attr.addUpdateRange(start, count);
  }
  return attr;
}

/** The object ranges `[from, to]` as `setUploadRanges()` takes them. */
function objectRanges(pairs: Pairs): [Int32Array, number] {
  const ranges = new Int32Array(UPLOAD_RANGES_ARRAY_LENGTH);
  pairs.forEach(([from, to], k) => {
    ranges[2 * k] = from;
    ranges[2 * k + 1] = to;
  });
  return [ranges, pairs.length];
}

describe('setUploadRanges', () => {
  it.each([
    ['no range standing, objects 2..4', [] as Pairs, [[2, 4]] as Pairs, [{start: 24, count: 36}]],
    ['no range standing, one object', [] as Pairs, [[5, 5]] as Pairs, [{start: 60, count: 12}]],
    [
      'a range standing below and apart',
      [[0, 12]] as Pairs,
      [[5, 5]] as Pairs,
      [
        {start: 0, count: 12},
        {start: 60, count: 12},
      ],
    ],
    [
      'a range standing above and apart',
      [[60, 12]] as Pairs,
      [[1, 1]] as Pairs,
      [
        {start: 12, count: 12},
        {start: 60, count: 12},
      ],
    ],
    ['a range standing right below', [[48, 12]] as Pairs, [[5, 5]] as Pairs, [{start: 48, count: 24}]],
    ['a range standing overlaps', [[12, 36]] as Pairs, [[3, 5]] as Pairs, [{start: 12, count: 60}]],
    ['a range standing with count 0 does not count', [[36, 0]] as Pairs, [[1, 1]] as Pairs, [{start: 12, count: 12}]],
    [
      'two ranges standing, the object between them',
      [
        [0, 12],
        [48, 12],
      ] as Pairs,
      [[2, 2]] as Pairs,
      [
        {start: 0, count: 12},
        {start: 24, count: 12},
        {start: 48, count: 12},
      ],
    ],
    [
      'two new ranges apart, none standing',
      [] as Pairs,
      [
        [1, 1],
        [6, 7],
      ] as Pairs,
      [
        {start: 12, count: 12},
        {start: 72, count: 24},
      ],
    ],
  ])('%s', (_name, standingRanges, pairs, expected) => {
    const attr = makeAttribute(standingRanges);
    const [ranges, rangeCount] = objectRanges(pairs);
    setUploadRanges(attr, ranges, rangeCount, VERTEX_COUNT, ITEM_SIZE);
    expect(attr.updateRanges).toEqual(expected);
  });

  it.each([
    ['the ranges that would result are standing already', [[24, 12]] as Pairs, [[2, 2]] as Pairs],
    ['the standing range already contains the object', [[0, 72]] as Pairs, [[2, 2]] as Pairs],
    ['no new range at all', [[24, 12]] as Pairs, [] as Pairs],
  ])('%s leaves the standing ranges untouched', (_name, standingRanges, pairs) => {
    const attr = makeAttribute(standingRanges);
    const clearSpy = vi.spyOn(attr, 'clearUpdateRanges');
    const before = attr.updateRanges[0];
    const [ranges, rangeCount] = objectRanges(pairs);

    setUploadRanges(attr, ranges, rangeCount, VERTEX_COUNT, ITEM_SIZE);

    expect(clearSpy).not.toHaveBeenCalled();
    expect(attr.updateRanges).toHaveLength(1);
    expect(attr.updateRanges[0]).toBe(before);
  });

  it('names no range at all when there is nothing standing and nothing new', () => {
    const attr = makeAttribute();
    const addSpy = vi.spyOn(attr, 'addUpdateRange');

    setUploadRanges(attr, new Int32Array(UPLOAD_RANGES_ARRAY_LENGTH), 0, VERTEX_COUNT, ITEM_SIZE);

    expect(addSpy).not.toHaveBeenCalled();
    expect(attr.updateRanges).toEqual([]);
  });

  it('computes with the itemSize it is given, also for an interleaved buffer', () => {
    const buffer = new InterleavedBuffer(new Float32Array(10 * 4 * 5), 5);
    const [ranges, rangeCount] = objectRanges([[2, 3]]);
    setUploadRanges(buffer, ranges, rangeCount, 4, 5);
    expect(buffer.updateRanges).toEqual([{start: 40, count: 40}]);
  });
});
