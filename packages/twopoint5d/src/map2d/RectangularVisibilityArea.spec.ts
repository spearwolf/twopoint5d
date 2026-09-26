import {Matrix4} from 'three/webgpu';
import {beforeEach, describe, expect, test} from 'vitest';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';
import {RectangularVisibilityArea} from './RectangularVisibilityArea.js';
import type {IMap2DTileCoords} from './types.js';

function ids(tiles: IMap2DTileCoords[] | undefined): string[] {
  return (tiles ?? []).map((t) => t.id).sort();
}

describe('RectangularVisibilityArea', () => {
  describe('computeVisibleTiles()', () => {
    let tileCoords: Map2DTileCoordsUtil;
    let matrixWorld: Matrix4;

    beforeEach(() => {
      tileCoords = new Map2DTileCoordsUtil(100, 100);
      matrixWorld = new Matrix4();
    });

    test('returns undefined while one of its sides is zero', () => {
      expect(new RectangularVisibilityArea(0, 240).computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)).toBeUndefined();
      expect(new RectangularVisibilityArea(320, 0).computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)).toBeUndefined();
    });

    test('classifies every tile as created on the first call and says so', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const result = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;

      expect(result.tiles.length).toBeGreaterThan(0);
      expect(result.createTiles).toHaveLength(result.tiles.length);
      expect(result.reuseTiles).toHaveLength(0);
      expect(result.removeTiles).toHaveLength(0);
      expect(result.changed).toBe(true);
    });

    test('hands back the same result, marked unchanged, while nothing moves', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const tilesRef = first.tiles;

      const second = area.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(second).toBe(first);
      expect(second.tiles).toBe(tilesRef);
      expect(second.reuseTiles).toBe(tilesRef);
      expect(second.createTiles).toBeUndefined();
      expect(second.removeTiles).toBeUndefined();
      expect(second.changed).toBe(false);
    });

    test('a moved center recomputes', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const firstIds = ids(first.tiles);
      const second = area.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;
      const third = area.computeVisibleTiles(second.tiles, [400, 0], tileCoords, matrixWorld)!;

      // the cache path answers without them
      expect(third.createTiles, 'createTiles of a recomputation').toBeDefined();
      expect(third.removeTiles, 'removeTiles of a recomputation').toBeDefined();
      expect(third.changed, 'the tile grid stands').toBe(false);
      expect(ids(third.tiles)).not.toEqual(firstIds);
    });

    test('a changed width recomputes', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;

      const firstLength = first.tiles.length;

      area.width = 640;
      const second = area.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

      // the cache path answers without them
      expect(second.createTiles, 'createTiles of a recomputation').toBeDefined();
      expect(second.removeTiles, 'removeTiles of a recomputation').toBeDefined();
      expect(second.changed, 'the tile grid stands').toBe(false);
      expect(second.tiles.length).toBeGreaterThan(firstLength);
    });

    test('needsUpdate forces exactly one recompute', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const second = area.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(second, 'nothing moved').toBe(first);

      area.needsUpdate = true;
      const third = area.computeVisibleTiles(second.tiles, [0, 0], tileCoords, matrixWorld)!;

      // the cache path answers without them
      expect(third.createTiles, 'the forced recompute').toBeDefined();
      expect(third.removeTiles, 'the forced recompute').toBeDefined();
      expect(area.needsUpdate, 'the flag is spent').toBe(false);

      const fourth = area.computeVisibleTiles(third.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(fourth, 'cached again').toBe(third);
      expect(fourth.createTiles, 'cached again').toBeUndefined();
    });

    test('offset and translate are the same instances across calls', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const offsetRef = first.offset;
      const translateRef = first.translate;

      const second = area.computeVisibleTiles(first.tiles, [400, 0], tileCoords, matrixWorld)!;

      expect(second.offset).toBe(offsetRef);
      expect(second.translate).toBe(translateRef);
    });

    test('a recomputation handed the tiles of its own last result classifies against what they were', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const before = ids(first.tiles);
      const second = area.computeVisibleTiles(first.tiles, [400, 0], tileCoords, matrixWorld)!;

      expect(ids([...(second.reuseTiles ?? []), ...(second.removeTiles ?? [])])).toEqual(before);
      expect(new Set(second.tiles).size, 'no tile twice').toBe(second.tiles.length);
    });

    test('hands back the same result object and lists on every recomputation', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const firstTiles = first.tiles;
      const second = area.computeVisibleTiles(first.tiles, [200, 0], tileCoords, matrixWorld)!;

      expect(second).toBe(first);
      expect(second.tiles).toBe(firstTiles);
    });

    test('a tile that leaves the view is removed and one that stays is reused', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const firstIds = ids(first.tiles);

      // two tile widths to the right: the view keeps a part of its columns and gains new ones
      const second = area.computeVisibleTiles(first.tiles, [200, 0], tileCoords, matrixWorld)!;

      expect(second.removeTiles!.length, 'removed').toBeGreaterThan(0);
      expect(second.reuseTiles!.length, 'reused').toBeGreaterThan(0);
      expect(second.createTiles!.length, 'created').toBeGreaterThan(0);

      for (const id of ids(second.removeTiles)) {
        expect(firstIds, `removed tile ${id} was there before`).toContain(id);
      }
      for (const id of ids(second.reuseTiles)) {
        expect(firstIds, `reused tile ${id} was there before`).toContain(id);
      }

      expect(ids(second.tiles)).toEqual(ids(second.reuseTiles!.concat(second.createTiles!)));
    });

    test('a tile of another grid is removed instead of reused', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      expect(first.tiles.length).toBeGreaterThan(0);
      // the result is written again by the next call
      const firstIds = ids(first.tiles);

      const otherGrid = new Map2DTileCoordsUtil(50, 50);
      const second = area.computeVisibleTiles(first.tiles, [0, 0], otherGrid, matrixWorld)!;

      expect(second.reuseTiles, 'nothing of the old grid is kept').toHaveLength(0);
      expect(ids(second.removeTiles), 'every tile of the old grid goes').toEqual(firstIds);
      expect(ids(second.tiles), 'the new grid is covered once').toEqual([...new Set(ids(second.tiles))]);
    });
  });

  describe('width and height', () => {
    test.each([-1, NaN, Infinity, -Infinity])('the constructor refuses a width of %s', (v) => {
      const create = () => new RectangularVisibilityArea(v, 240);

      expect(create).toThrow(RangeError);
      expect(create).toThrow(`[RectangularVisibilityArea] width must be 0 or a finite number above 0, got ${v}`);
    });

    test.each([-1, NaN, Infinity, -Infinity])('the constructor refuses a height of %s', (v) => {
      const create = () => new RectangularVisibilityArea(320, v);

      expect(create).toThrow(RangeError);
      expect(create).toThrow(`[RectangularVisibilityArea] height must be 0 or a finite number above 0, got ${v}`);
    });

    test('a width that is a string is quoted in the message', () => {
      const create = () => new RectangularVisibilityArea('5' as unknown as number, 240);

      expect(create).toThrow(RangeError);
      expect(create).toThrow('[RectangularVisibilityArea] width must be 0 or a finite number above 0, got "5"');
    });

    test('a refused width leaves the width as it was', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const write = () => (area.width = -1);

      expect(write).toThrow(RangeError);
      expect(write).toThrow('[RectangularVisibilityArea] width must be 0 or a finite number above 0, got -1');
      expect(area.width).toBe(320);
    });

    test('a refused height leaves the height as it was', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const write = () => (area.height = -1);

      expect(write).toThrow(RangeError);
      expect(write).toThrow('[RectangularVisibilityArea] height must be 0 or a finite number above 0, got -1');
      expect(area.height).toBe(240);
    });

    test('0 switches the area off and a size above 0 switches it on again', () => {
      const tileCoords = new Map2DTileCoordsUtil(100, 100);
      const matrixWorld = new Matrix4();
      const area = new RectangularVisibilityArea(320, 240);

      expect(() => (area.width = 0)).not.toThrow();
      expect(area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)).toBeUndefined();

      area.width = 320;
      expect(area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)).toBeDefined();
    });
  });
});
