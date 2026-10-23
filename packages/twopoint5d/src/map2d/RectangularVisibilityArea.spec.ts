import {Matrix4} from 'three/webgpu';
import {beforeEach, describe, expect, test} from 'vitest';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';
import {RectangularVisibilityArea} from './RectangularVisibilityArea.js';
import type {IMap2DTileCoords} from './types.js';

function ids(tiles: IMap2DTileCoords[] | undefined): string[] {
  return (tiles ?? []).map((t) => t.id).sort();
}

function views(tiles: IMap2DTileCoords[] | undefined): string[] {
  return (tiles ?? []).map((t) => `${t.id} ${t.view.left} ${t.view.top} ${t.view.width} ${t.view.height}`).sort();
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

    test('the serial of the result moves with every recomputation and stands while the result is handed back', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const serials: (number | undefined)[] = [];
      let previous: IMap2DTileCoords[] = [];
      const call = (center: [number, number], grid = tileCoords) => {
        const result = area.computeVisibleTiles(previous, center, grid, matrixWorld)!;
        previous = result.tiles;
        serials.push(result.serial);
      };

      call([0, 0]);
      call([0, 0]); // unchanged
      call([50, 0]); // center moved
      call([50, 0]); // unchanged
      area.needsUpdate = true;
      call([50, 0]); // needsUpdate
      call([50, 0], new Map2DTileCoordsUtil(50, 50)); // another grid

      const [first] = serials;
      expect(first, 'the first result names a recomputation').toBeTypeOf('number');
      expect(serials).toEqual([first, first, first! + 1, first! + 1, first! + 2, first! + 3]);
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

    test('a grid of 0.1 scrolled tile by tile keeps the tile set a fresh area computes', () => {
      const grid = new Map2DTileCoordsUtil(0.1, 0.1);

      // summed up step by step, so the center carries the rounding of every step before it
      for (const axis of [0, 1] as const) {
        const area = new RectangularVisibilityArea(0.7, 0.3);
        const center: [number, number] = [0, 0];
        let previous: IMap2DTileCoords[] = [];

        for (let i = 0; i < 40; i++) {
          center[axis] -= 0.1;
          // `previous` can be the `tiles` of the last result, which the call writes again
          const before = ids(previous);
          const result = area.computeVisibleTiles(previous, [center[0], center[1]], grid, matrixWorld)!;
          previous = result.tiles;
          const fresh = new RectangularVisibilityArea(0.7, 0.3).computeVisibleTiles(
            [],
            [center[0], center[1]],
            grid,
            matrixWorld,
          )!;

          expect(ids(result.tiles), `axis ${axis}, step ${i}`).toEqual(ids(fresh.tiles));
          expect(ids([...(result.reuseTiles ?? []), ...(result.removeTiles ?? [])]), `axis ${axis}, step ${i}`).toEqual(before);
          expect(new Set(ids(result.tiles)).size, `axis ${axis}, step ${i}: no tile twice`).toBe(result.tiles.length);
        }
      }
    });

    test('refuses a center point that is no pair of finite numbers before anything changes', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const firstTiles = [...first.tiles];
      expect(firstTiles.length).toBeGreaterThan(0);

      for (const [centerPoint, quoted] of [
        [[NaN, 0], '[NaN, 0]'],
        [[0, Infinity], '[0, Infinity]'],
        [[-Infinity, 0], '[-Infinity, 0]'],
      ] as const) {
        const compute = () => area.computeVisibleTiles(first.tiles, [centerPoint[0], centerPoint[1]], tileCoords, matrixWorld);

        expect(compute).toThrow(RangeError);
        expect(compute).toThrow(
          `RectangularVisibilityArea: the center point of computeVisibleTiles() must be two finite numbers, got ${quoted}`,
        );
      }

      const after = area.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(after.tiles, 'the tiles of the call before').toEqual(firstTiles);
      expect(after.reuseTiles, 'the tiles handed back for reuse').toBe(after.tiles);
      expect(after.createTiles).toBeUndefined();
    });
  });

  describe('maxVisibleTiles', () => {
    let tileCoords: Map2DTileCoordsUtil;
    let matrixWorld: Matrix4;

    beforeEach(() => {
      tileCoords = new Map2DTileCoordsUtil(100, 100);
      matrixWorld = new Matrix4();
    });

    test('defaults to 10 000', () => {
      expect(new RectangularVisibilityArea().maxVisibleTiles).toBe(10_000);
    });

    test('the default area on the default grid covers more and throws', () => {
      // 320 × 240 tiles of 1
      const compute = () =>
        new RectangularVisibilityArea().computeVisibleTiles([], [0, 0], new Map2DTileCoordsUtil(1, 1), matrixWorld);

      expect(compute).toThrow(RangeError);
      expect(compute).toThrow(
        'RectangularVisibilityArea: the area covers 76800 tiles of the grid, more than maxVisibleTiles (10000) — make the area smaller or the tiles larger, or raise maxVisibleTiles',
      );
    });

    test('a refused call is refused again, and a raised limit answers the tiles', () => {
      const area = new RectangularVisibilityArea(320, 240);
      area.maxVisibleTiles = 4;
      const compute = () => area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld);

      expect(compute, 'the first call').toThrow(RangeError);
      expect(compute, 'the same call again, which no cached result answers').toThrow(RangeError);

      area.maxVisibleTiles = 100;
      const result = compute();
      const fresh = new RectangularVisibilityArea(320, 240).computeVisibleTiles([], [0, 0], tileCoords, matrixWorld);

      expect(ids(result?.tiles)).toEqual(ids(fresh?.tiles));
      expect(result?.tiles.length).toBeGreaterThan(0);
    });

    test('a moved center that covers more tiles is refused, and refused again', () => {
      const area = new RectangularVisibilityArea(320, 240);
      area.maxVisibleTiles = 16;

      // around [0, 0] the area spans -160 … 160 and -120 … 120: columns -2 … 1 and rows -2 … 1,
      // 4 × 4 tiles
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld);
      expect(first?.tiles, 'the tiles around [0, 0]').toHaveLength(16);

      // around [50, 0] it spans -110 … 210: columns -2 … 2, 5 × 4 tiles
      const moved = () => area.computeVisibleTiles([], [50, 0], tileCoords, matrixWorld);
      expect(moved, 'the call around [50, 0]').toThrow('the area covers 20 tiles of the grid, more than maxVisibleTiles (16)');
      expect(moved, 'the same call again, instead of the result around [0, 0]').toThrow(RangeError);
    });

    test('a grid change a refused call saw reaches the next call that computes', () => {
      const area = new RectangularVisibilityArea(320, 240);
      // 4 × 4 tiles of 100 on grid A, ids -2 … 1 on both axes
      const gridA = new Map2DTileCoordsUtil(100, 100);
      // 8 × 6 tiles of 50 on grid B, whose ids cover those of grid A
      const gridB = new Map2DTileCoordsUtil(50, 50);
      area.maxVisibleTiles = 16;

      // copied: the list of the result is written again by the next call that computes
      const previousTiles = [...area.computeVisibleTiles([], [0, 0], gridA, matrixWorld)!.tiles];
      const previousIds = ids(previousTiles);
      expect(previousTiles, 'the tiles on grid A').toHaveLength(16);

      expect(() => area.computeVisibleTiles(previousTiles, [0, 0], gridB, matrixWorld), 'the call on grid B').toThrow(RangeError);

      area.maxVisibleTiles = 100;
      const result = area.computeVisibleTiles(previousTiles, [0, 0], gridB, matrixWorld)!;
      // given no tiles: a fresh area has no grid before it to tell the tiles of grid A apart
      const fresh = new RectangularVisibilityArea(320, 240).computeVisibleTiles([], [0, 0], gridB, matrixWorld)!;

      expect(result.reuseTiles, 'no tile of grid A is reused on grid B').toHaveLength(0);
      expect(ids(result.removeTiles)).toEqual(previousIds);
      expect(result.changed).toBe(true);
      // by id and by view: the ids of grid A recur on grid B, the views of its tiles do not
      expect(views(result.tiles)).toEqual(views(fresh.tiles));
    });

    test.each([0, -1, 1.5, NaN, '5'])('the setter refuses %p and keeps the value it had', (value) => {
      const area = new RectangularVisibilityArea();
      area.maxVisibleTiles = 50;
      const write = () => {
        area.maxVisibleTiles = value as number;
      };

      expect(write).toThrow(RangeError);
      expect(write).toThrow('RectangularVisibilityArea: maxVisibleTiles must be a whole number above 0 or Infinity, got');
      expect(area.maxVisibleTiles).toBe(50);
    });

    test('the setter takes Infinity', () => {
      const area = new RectangularVisibilityArea();
      area.maxVisibleTiles = Infinity;

      expect(area.maxVisibleTiles).toBe(Infinity);
    });
  });

  describe('switched off', () => {
    let tileCoords: Map2DTileCoordsUtil;
    let matrixWorld: Matrix4;

    beforeEach(() => {
      tileCoords = new Map2DTileCoordsUtil(100, 100);
      matrixWorld = new Matrix4();
    });

    for (const side of ['width', 'height'] as const) {
      test(`${side} 0 hands every tile back in removeTiles and lays out none`, () => {
        const area = new RectangularVisibilityArea(320, 240);
        const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
        const previousIds = ids(first.tiles);
        // read now: the next call writes the same result object again
        const firstSerial = first.serial!;
        expect(previousIds.length).toBeGreaterThan(0);

        area[side] = 0;
        const result = area.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld);

        expect(result).toBeDefined();
        expect(result!.tiles).toHaveLength(0);
        expect(ids(result!.removeTiles)).toEqual(previousIds);
        expect(result!.createTiles).toBeUndefined();
        expect(result!.reuseTiles).toBeUndefined();
        expect(result!.serial).toBeGreaterThan(firstSerial);

        expect(area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld), 'nothing left to take down').toBeUndefined();
      });
    }

    test('a size after 0 lays out the whole set again', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const firstIds = ids(first.tiles);

      area.width = 0;
      const off = area.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

      area.width = 320;
      const on = area.computeVisibleTiles(off.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(ids(on.createTiles)).toEqual(firstIds);
      expect(on.reuseTiles).toHaveLength(0);
    });
  });

  describe('width and height', () => {
    test.each([-1, NaN, Infinity, -Infinity])('the constructor refuses a width of %s', (v) => {
      const create = () => new RectangularVisibilityArea(v, 240);

      expect(create).toThrow(RangeError);
      expect(create).toThrow(`RectangularVisibilityArea: width must be 0 or a finite number above 0, got ${v}`);
    });

    test.each([-1, NaN, Infinity, -Infinity])('the constructor refuses a height of %s', (v) => {
      const create = () => new RectangularVisibilityArea(320, v);

      expect(create).toThrow(RangeError);
      expect(create).toThrow(`RectangularVisibilityArea: height must be 0 or a finite number above 0, got ${v}`);
    });

    test('a width that is a string is quoted in the message', () => {
      const create = () => new RectangularVisibilityArea('5' as unknown as number, 240);

      expect(create).toThrow(RangeError);
      expect(create).toThrow('RectangularVisibilityArea: width must be 0 or a finite number above 0, got "5"');
    });

    test('a refused width leaves the width as it was', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const write = () => (area.width = -1);

      expect(write).toThrow(RangeError);
      expect(write).toThrow('RectangularVisibilityArea: width must be 0 or a finite number above 0, got -1');
      expect(area.width).toBe(320);
    });

    test('a refused height leaves the height as it was', () => {
      const area = new RectangularVisibilityArea(320, 240);
      const write = () => (area.height = -1);

      expect(write).toThrow(RangeError);
      expect(write).toThrow('RectangularVisibilityArea: height must be 0 or a finite number above 0, got -1');
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
