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
      const second = area.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;
      const third = area.computeVisibleTiles(second.tiles, [400, 0], tileCoords, matrixWorld)!;

      expect(third).not.toBe(first);
      expect(third.changed).toBe(true);
      expect(ids(third.tiles)).not.toEqual(ids(first.tiles));
    });

    test('a changed width recomputes', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;

      area.width = 640;
      const second = area.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(second).not.toBe(first);
      expect(second.changed).toBe(true);
      expect(second.tiles.length).toBeGreaterThan(first.tiles.length);
    });

    test('needsUpdate forces exactly one recompute', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const second = area.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(second, 'nothing moved').toBe(first);

      area.needsUpdate = true;
      const third = area.computeVisibleTiles(second.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(third, 'the forced recompute').not.toBe(first);
      expect(area.needsUpdate, 'the flag is spent').toBe(false);

      const fourth = area.computeVisibleTiles(third.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(fourth, 'cached again').toBe(third);
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
  });
});
