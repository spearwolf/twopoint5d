import {describe, expect, test} from 'vitest';
import {TileSlotTable, type TileSlotTableEntry} from './TileSlotTable.js';

interface Entry extends TileSlotTableEntry<Entry> {
  name: string;
}

const entry = (x: number, y: number): Entry => ({x, y, nextInBucket: undefined, name: `${x},${y}`});

describe('TileSlotTable', () => {
  test('get() finds what add() put in', () => {
    const table = new TileSlotTable<Entry>();
    const a = entry(3, 4);

    table.add(a);

    expect(table.get(3, 4)).toBe(a);
    expect(table.size).toBe(1);
  });

  test('get() answers undefined for a coordinate that is not in it', () => {
    const table = new TileSlotTable<Entry>();
    table.add(entry(3, 4));

    expect(table.get(4, 3)).toBeUndefined();
    expect(table.get(0, 0)).toBeUndefined();
  });

  test('a rectangle of 64 × 64 entries, every third one taken out again', () => {
    // far more entries than buckets to start with: the chains fill up and the table grows
    // several times over
    const table = new TileSlotTable<Entry>(4);
    const entries: Entry[] = [];
    for (let y = -32; y < 32; ++y) {
      for (let x = -32; x < 32; ++x) {
        const e = entry(x, y);
        entries.push(e);
        table.add(e);
      }
    }
    expect(table.size).toBe(64 * 64);

    const removed = entries.filter((_, i) => i % 3 === 0);
    const kept = entries.filter((_, i) => i % 3 !== 0);
    for (const e of removed) table.remove(e);

    expect(table.size).toBe(kept.length);
    for (const e of kept) {
      expect(table.get(e.x, e.y), `entry ${e.name}`).toBe(e);
    }
    for (const e of removed) {
      expect(table.get(e.x, e.y), `removed entry ${e.name}`).toBeUndefined();
    }
  });

  test('tells the coordinates apart: negative ones, swapped ones and the ends of the packed range', () => {
    const table = new TileSlotTable<Entry>();
    const coordinates: [number, number][] = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [3, 7],
      [7, 3],
      [33554431, 33554431],
      [-33554431, -33554431],
      [33554431, -33554431],
      [-33554431, 33554431],
      [0, 33554431],
      [33554431, 0],
    ];
    const entries = coordinates.map(([x, y]) => entry(x, y));
    for (const e of entries) table.add(e);

    for (const e of entries) {
      expect(table.get(e.x, e.y), `entry ${e.name}`).toBe(e);
    }
    expect(table.get(0, 0)).toBeUndefined();
    expect(table.get(-33554431, 0)).toBeUndefined();
  });

  test('remove() of an entry that is not in it changes nothing', () => {
    const table = new TileSlotTable<Entry>();
    const a = entry(1, 2);
    const b = entry(2, 1);
    table.add(a);
    table.add(b);

    // an entry of the same coordinate that the table does not hold, and one of another
    table.remove(entry(1, 2));
    table.remove(entry(5, 5));

    expect(table.size).toBe(2);
    expect(table.get(1, 2)).toBe(a);
    expect(table.get(2, 1)).toBe(b);
  });
});
