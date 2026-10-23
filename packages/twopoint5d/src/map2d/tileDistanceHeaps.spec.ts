import {describe, expect, test} from 'vitest';
import {KeptTiles, NearestFirstHeap} from './tileDistanceHeaps.js';

interface Entry {
  name: string;
  distanceToCamera: number;
}

const entries = (...distances: number[]): Entry[] =>
  distances.map((distanceToCamera, i) => ({name: `${String.fromCharCode(97 + i)}${distanceToCamera}`, distanceToCamera}));

const names = (list: readonly Entry[]): string[] => list.map((entry) => entry.name);

function listOf(kept: KeptTiles<Entry>): Entry[] {
  const list: Entry[] = [];
  for (let i = 0; i < kept.length; ++i) list.push(kept.at(i));
  return list;
}

describe('NearestFirstHeap', () => {
  test('hands out a mixed set nearest first, equal distances included', () => {
    const heap = new NearestFirstHeap<Entry>();
    const mixed = entries(5, 1, 4, 1, 9, 2, 6, 5, 3, 5);

    for (const [i, entry] of mixed.entries()) {
      heap.push(entry);
      expect(heap.length, 'the length follows every push').toBe(i + 1);
    }
    expect(heap.peek().distanceToCamera).toBe(1);

    const out: number[] = [];
    while (heap.length > 0) out.push(heap.pop().distanceToCamera);

    expect(out).toEqual([1, 1, 2, 3, 4, 5, 5, 5, 6, 9]);
  });

  test('clear() empties the heap for the next pass', () => {
    const heap = new NearestFirstHeap<Entry>();
    for (const entry of entries(3, 2, 1)) heap.push(entry);

    heap.clear();

    expect(heap.length).toBe(0);
    for (const entry of entries(7, 4)) heap.push(entry);
    expect(heap.pop().distanceToCamera).toBe(4);
    expect(heap.pop().distanceToCamera).toBe(7);
    expect(heap.length).toBe(0);
  });
});

describe('KeptTiles', () => {
  test('before heapify(), at() answers in the order the entries came', () => {
    const kept = new KeptTiles<Entry>();
    const added = entries(4, 2, 8);
    for (const entry of added) kept.add(entry);

    expect(kept.length).toBe(3);
    expect(names(listOf(kept))).toEqual(names(added));
  });

  test('sortNearestFirst() without a heap keeps equal distances in the order they came', () => {
    const kept = new KeptTiles<Entry>();
    const added = entries(1, 3, 2, 3, 2, 4);
    for (const entry of added) kept.add(entry);

    kept.sortNearestFirst();

    expect(names(listOf(kept))).toEqual(['a1', 'c2', 'e2', 'b3', 'd3', 'f4']);
  });

  test('after heapify(), furthest is the entry furthest out, and a nearer one takes its place', () => {
    const kept = new KeptTiles<Entry>();
    for (const entry of entries(4, 9, 2, 7, 5)) kept.add(entry);

    kept.heapify();
    expect(kept.furthest.distanceToCamera).toBe(9);

    kept.replaceFurthest({name: 'nearer', distanceToCamera: 3});
    expect(kept.length, 'one entry in, one out').toBe(5);
    expect(kept.furthest.distanceToCamera, 'the furthest of the rest').toBe(7);

    kept.replaceFurthest({name: 'nearest', distanceToCamera: 1});
    expect(kept.furthest.distanceToCamera).toBe(5);

    kept.sortNearestFirst();
    expect(listOf(kept).map((entry) => entry.distanceToCamera)).toEqual([1, 2, 3, 4, 5]);
  });

  test('after clear(), a new pass sorts as a list again', () => {
    const kept = new KeptTiles<Entry>();
    for (const entry of entries(6, 1, 6)) kept.add(entry);
    kept.heapify();

    kept.clear();
    expect(kept.length).toBe(0);

    // a list taken for a heap comes out of the heapsort out of order
    const added = entries(2, 5, 5, 1, 5);
    for (const entry of added) kept.add(entry);
    kept.sortNearestFirst();

    expect(names(listOf(kept))).toEqual(['d1', 'a2', 'b5', 'c5', 'e5']);
  });
});
