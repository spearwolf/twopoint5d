import {describe, expect, test} from 'vitest';
import {AABB2} from './AABB2.js';
import {Map2DTileCoords} from './Map2DTileCoords.js';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';
import {packTileCoords} from './packedTileKey.js';
import {TileSlotPool} from './TileSlotPool.js';

describe('TileSlotPool', () => {
  test('acquire() hands out one slot per tile coordinate, written for the grid', () => {
    const grid = new Map2DTileCoordsUtil(16, 8);
    const pool = new TileSlotPool(grid);

    const slot = pool.acquire(3, -2);

    expect(pool.acquire(3, -2), 'the same coordinate, the same slot').toBe(slot);
    expect(pool.get(3, -2)).toBe(slot);
    expect(pool.get(2, -2), 'no slot for another coordinate').toBeUndefined();
    expect(slot.packedKey).toBe(packTileCoords(3, -2));
    expect([slot.x, slot.y]).toEqual([3, -2]);
    expect(slot.map2dTile).toBeUndefined();
    expect(slot.coords).toEqual({
      tileLeft: 3,
      tileTop: -2,
      left: 3 * 16,
      top: -2 * 8,
      width: 16,
      height: 8,
      tileWidth: 16,
      tileHeight: 8,
      columns: 1,
      rows: 1,
    });
  });

  test('evict() keeps the slots of the stamp and hands the others to the next tiles, the first taken first', () => {
    const pool = new TileSlotPool(new Map2DTileCoordsUtil(10, 10));
    const first = pool.acquire(0, 0);
    const second = pool.acquire(1, 0);
    const staying = pool.acquire(2, 0);
    // two slots stay, so the free list keeps both evicted ones
    const alsoStaying = pool.acquire(3, 0);
    first.visitedStamp = 1;
    second.visitedStamp = 1;
    staying.visitedStamp = 2;
    alsoStaying.visitedStamp = 2;
    first.map2dTile = new Map2DTileCoords(0, 0, new AABB2(0, 0, 10, 10));

    pool.evict(2);

    expect(pool.get(2, 0), 'the slot of the stamp stays').toBe(staying);
    expect(pool.get(3, 0)).toBe(alsoStaying);
    expect(pool.get(0, 0)).toBeUndefined();
    expect(pool.get(1, 0)).toBeUndefined();

    const entering = pool.acquire(7, 5);
    expect(entering, 'the slot taken first goes out first').toBe(first);
    expect(entering.map2dTile, 'the shell stays with the caller').toBeUndefined();
    expect(entering.packedKey).toBe(packTileCoords(7, 5));
    expect([entering.coords.tileLeft, entering.coords.tileTop, entering.coords.left, entering.coords.top]).toEqual([
      7, 5, 70, 50,
    ]);
    expect(pool.acquire(8, 5)).toBe(second);
  });

  test('rewriteForGrid() writes every slot again for the grid as it stands and lets go of each shell', () => {
    const grid = new Map2DTileCoordsUtil(10, 10);
    const pool = new TileSlotPool(grid);
    const slots = [pool.acquire(0, 0), pool.acquire(1, 2)];
    for (const slot of slots) slot.map2dTile = new Map2DTileCoords(slot.x, slot.y, new AABB2());

    grid.tileWidth = 25;
    pool.rewriteForGrid();

    for (const slot of slots) {
      const where = `slot ${slot.x},${slot.y}`;
      expect(slot.coords.left, where).toBe(slot.x * 25);
      expect(slot.coords.width, where).toBe(25);
      expect(slot.coords.tileWidth, where).toBe(25);
      expect(slot.coords.top, where).toBe(slot.y * 10);
      expect(slot.map2dTile, where).toBeUndefined();
    }
  });

  test('the free list holds at most as many slots as stay', () => {
    const pool = new TileSlotPool(new Map2DTileCoordsUtil());
    const evicted = [0, 1, 2, 3, 4].map((x) => pool.acquire(x, 0));
    for (const slot of evicted) slot.visitedStamp = 1;
    const staying = [pool.acquire(0, 1), pool.acquire(1, 1)];
    for (const slot of staying) slot.visitedStamp = 2;

    pool.evict(2);

    // two slots stay, so two of the five evicted ones wait for the next tiles
    const next = [pool.acquire(10, 10), pool.acquire(11, 10), pool.acquire(12, 10)];
    expect(evicted).toContain(next[0]);
    expect(evicted).toContain(next[1]);
    expect(evicted, 'a new slot once the free list is empty').not.toContain(next[2]);
    expect(staying).not.toContain(next[2]);
  });
});
