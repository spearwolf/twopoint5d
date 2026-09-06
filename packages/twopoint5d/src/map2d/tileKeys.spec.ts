import {describe, expect, test} from 'vitest';
import {Map2DSpatialHashGrid} from './Map2DSpatialHashGrid.js';
import {Map2DTileCoords} from './Map2DTileCoords.js';
import {packTileCoords, tileKey} from './tileKeys.js';

describe('tile keys', () => {
  test('a tile key reads x before y, negative coordinates included', () => {
    expect(tileKey(0, 0)).toBe('0,0');
    expect(tileKey(1, 0)).toBe('1,0');
    expect(tileKey(3, -4)).toBe('3,-4');
    expect(tileKey(-3, 4)).toBe('-3,4');
  });

  test('the tile id and the hash grid key are the same key', () => {
    const coords: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [0, 1],
      [-3, 7],
      [12, -5],
    ];
    for (const [x, y] of coords) {
      const expected = tileKey(x, y);
      expect(new Map2DTileCoords(x, y).id, `tile id of ${expected}`).toBe(expected);
      expect(Map2DSpatialHashGrid.getKey(x, y), `hash grid key of ${expected}`).toBe(expected);
    }
  });

  test('the packed key of a coordinate belongs to that coordinate alone', () => {
    const LIMIT = 33_554_432;
    const coords: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [4711, -815],
      [-815, 4711],
      [LIMIT - 1, LIMIT - 1],
      [-LIMIT, -LIMIT],
      [LIMIT - 1, -LIMIT],
      [-LIMIT, LIMIT - 1],
    ];
    const seen = new Map<number, string>();
    for (const [x, y] of coords) {
      const key = packTileCoords(x, y);
      expect(Number.isSafeInteger(key), `${tileKey(x, y)} packs into a safe integer`).toBe(true);
      expect(seen.get(key), `${tileKey(x, y)} shares its key with ${seen.get(key)}`).toBeUndefined();
      seen.set(key, tileKey(x, y));
    }
  });
});
