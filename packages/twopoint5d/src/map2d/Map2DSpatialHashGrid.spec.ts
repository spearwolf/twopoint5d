import {describe, expect, test, vi} from 'vitest';
import {AABB2} from './AABB2.js';
import type {IMap2DRenderableArea} from './types.js';
import {Map2DSpatialHashGrid} from './Map2DSpatialHashGrid.js';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';

describe('Map2DSpatialHashGrid', () => {
  test('construction', () => {
    const grid = new Map2DSpatialHashGrid(10, 100, -5, -50);
    expect(grid).toBeDefined();
  });

  test('without arguments it is a 1x1 grid', () => {
    const grid = new Map2DSpatialHashGrid();
    const r: IMap2DRenderableArea = {aabb: new AABB2(0, 0, 2, 2)};
    grid.add(r);

    // the right and the bottom edge of the aabb do not belong to it
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      expect(grid.getTile(x, y)?.has(r), `cell ${x},${y}`).toBe(true);
    }
    expect(grid.getTile(2, 0)).toBeUndefined();
    expect(grid.getTile(0, 2)).toBeUndefined();
    expect(grid.getTile(2, 2)).toBeUndefined();
  });

  test('a tile size that cannot be divided by is refused', () => {
    const create = () => new Map2DSpatialHashGrid(0, 100);

    expect(create).toThrow(RangeError);
    expect(create).toThrow('Map2DSpatialHashGrid: tileWidth must be a finite number above 0, got 0');
  });

  test('an offset that is not finite is refused', () => {
    const createX = () => new Map2DSpatialHashGrid(10, 10, NaN);
    const createY = () => new Map2DSpatialHashGrid(10, 10, 0, Infinity);

    expect(createX).toThrow(RangeError);
    expect(createX).toThrow('Map2DSpatialHashGrid: xOffset must be a finite number, got NaN');
    expect(createY).toThrow(RangeError);
    expect(createY).toThrow('Map2DSpatialHashGrid: yOffset must be a finite number, got Infinity');
  });

  test('add', () => {
    const grid = new Map2DSpatialHashGrid(100, 100);
    const a: IMap2DRenderableArea = {aabb: new AABB2(10, 20, 150, 150)};
    const b: IMap2DRenderableArea = {aabb: new AABB2(-50, -50, 50, 50)};

    expect(grid.add(a)).toBe(grid);
    expect(grid.add(b)).toBe(grid);

    let tileset = grid.getTiles(-1, -1, 2, 2)!;
    expect(tileset.size).toBe(2);
    expect(tileset.has(a)).toBeTruthy();
    expect(tileset.has(b)).toBeTruthy();

    tileset = grid.getTiles(0, 0, 1, 1)!;
    expect(tileset.size).toBe(1);
    expect(tileset.has(a)).toBeTruthy();
    expect(tileset.has(b)).toBeFalsy();

    expect(grid.getTiles(2, 2)).toBeUndefined();
  });

  test('remove', () => {
    const grid = new Map2DSpatialHashGrid(100, 100);
    const a: IMap2DRenderableArea = {aabb: new AABB2(10, 20, 150, 150)};
    const b: IMap2DRenderableArea = {aabb: new AABB2(-50, -50, 50, 50)};
    grid.add(a, b);

    let tileset = grid.getTiles(-1, -1, 2, 2)!;
    expect(tileset.size).toBe(2);
    expect(tileset.has(a)).toBeTruthy();
    expect(tileset.has(b)).toBeTruthy();

    expect(grid.remove(a)).toBe(grid);

    tileset = grid.getTiles(-1, -1, 2, 2)!;
    expect(tileset.size).toBe(1);
    expect(tileset.has(a)).toBeFalsy();
    expect(tileset.has(b)).toBeTruthy();

    expect(grid.remove(b)).toBe(grid);

    expect(grid.getTiles(-1, -1, 2, 2)).toBeUndefined();
  });

  test('findWithin', () => {
    const grid = new Map2DSpatialHashGrid(20, 20);
    const a: IMap2DRenderableArea = {aabb: new AABB2(-60, -60, 100, 80)};
    const b: IMap2DRenderableArea = {aabb: new AABB2(30, 10, 80, 70)};
    const c: IMap2DRenderableArea = {aabb: new AABB2(-90, 50, 50, 50)};
    grid.add(a, b, c);

    let tileset = grid.findWithin(new AABB2(-50, -50, 100, 110))!;
    expect(tileset.size).toBe(3);
    expect(tileset.has(a)).toBeTruthy();
    expect(tileset.has(b)).toBeTruthy();
    expect(tileset.has(c)).toBeTruthy();

    tileset = grid.findWithin(new AABB2(-50, -50, 100, 90))!;
    expect(tileset.size).toBe(2);
    expect(tileset.has(a)).toBeTruthy();
    expect(tileset.has(b)).toBeTruthy();
    expect(tileset.has(c)).toBeFalsy();

    tileset = grid.findWithin(new AABB2(0, 0, 30, 30))!;
    expect(tileset.size).toBe(2);
    expect(tileset.has(a)).toBeTruthy();
    expect(tileset.has(b)).toBeTruthy();
    expect(tileset.has(c)).toBeFalsy();

    tileset = grid.findWithin(new AABB2(-40, 20, 50, 50))!;
    expect(tileset).toBeUndefined();
  });

  test('findWithin fills the array it is handed with every renderable within once and hands it back', () => {
    const grid = new Map2DSpatialHashGrid(20, 20);
    const a: IMap2DRenderableArea = {aabb: new AABB2(-60, -60, 100, 80)};
    const b: IMap2DRenderableArea = {aabb: new AABB2(30, 10, 80, 70)};
    const c: IMap2DRenderableArea = {aabb: new AABB2(-90, 50, 50, 50)};
    grid.add(a, b, c);

    const stranger: IMap2DRenderableArea = {aabb: new AABB2(0, 0, 1, 1)};
    const out: IMap2DRenderableArea[] = [stranger];

    const query = new AABB2(-50, -50, 100, 90);
    // a and b reach into several of the 6 × 5 cells of the query each
    let cellsOfA = 0;
    let cellsOfB = 0;
    for (let y = -3; y < 2; y++) {
      for (let x = -3; x < 3; x++) {
        if (grid.getTile(x, y)?.has(a)) cellsOfA++;
        if (grid.getTile(x, y)?.has(b)) cellsOfB++;
      }
    }
    expect(cellsOfA).toBeGreaterThan(1);
    expect(cellsOfB).toBeGreaterThan(1);

    const found = grid.findWithin(query, out);

    expect(found).toBe(out);
    expect(out).toHaveLength(2);
    expect(out).toContain(a);
    expect(out).toContain(b);
    expect(out).not.toContain(stranger);
  });

  test('findWithin hands back the empty array it is handed when nothing lies within', () => {
    const grid = new Map2DSpatialHashGrid(20, 20);
    grid.add({aabb: new AABB2(-60, -60, 100, 80)});

    const out: IMap2DRenderableArea[] = [{aabb: new AABB2(0, 0, 1, 1)}];

    const found = grid.findWithin(new AABB2(200, 200, 50, 50), out);

    expect(found).toBe(out);
    expect(out).toHaveLength(0);
  });

  test('an out array handed to the next query holds what that query finds and nothing of the one before', () => {
    const grid = new Map2DSpatialHashGrid(10, 10);
    const a: IMap2DRenderableArea = {aabb: new AABB2(0, 0, 25, 25)};
    const b: IMap2DRenderableArea = {aabb: new AABB2(100, 100, 25, 25)};
    grid.add(a, b);

    const out: IMap2DRenderableArea[] = [];

    expect(grid.findWithin(new AABB2(0, 0, 30, 30), out)).toEqual([a]);
    expect(grid.findWithin(new AABB2(100, 100, 30, 30), out)).toEqual([b]);
    expect(grid.findWithin(new AABB2(0, 0, 130, 130), out)).toHaveLength(2);
    expect(grid.findWithin(new AABB2(0, 0, 30, 30), out)).toEqual([a]);
  });

  test('getTiles with an out array hands a renderable of several cells out once', () => {
    const grid = new Map2DSpatialHashGrid(10, 10);
    // reaches into the 3 × 3 cells from (0, 0) on
    const a: IMap2DRenderableArea = {aabb: new AABB2(5, 5, 20, 20)};
    const b: IMap2DRenderableArea = {aabb: new AABB2(12, 12, 2, 2)};
    grid.add(a, b);

    const out: IMap2DRenderableArea[] = [];

    expect(grid.getTiles(0, 0, 3, 3, out)).toBe(out);
    expect(out).toHaveLength(2);
    expect(out).toContain(a);
    expect(out).toContain(b);
  });

  test('a renderable of zero size on a cell border lies in the cell of its corner', () => {
    const grid = new Map2DSpatialHashGrid(100, 100);
    const p: IMap2DRenderableArea = {aabb: new AABB2(100, 100, 0, 0)};
    const l: IMap2DRenderableArea = {aabb: new AABB2(100, 0, 0, 50)};
    grid.add(p, l);

    expect(grid.getTile(1, 1)?.has(p)).toBe(true);
    expect(grid.findWithin(new AABB2(50, 50, 100, 100))?.has(p)).toBe(true);
    expect(grid.getTile(1, 0)?.has(l)).toBe(true);
  });

  test('remove() takes a renderable out of the cells it was added to after its aabb changed', () => {
    const grid = new Map2DSpatialHashGrid(100, 100);
    const a: IMap2DRenderableArea = {aabb: new AABB2(10, 20, 150, 150)};
    grid.add(a);

    a.aabb.set(310, 310, 10, 10);
    grid.remove(a);

    expect(grid.getTiles(-1, -1, 6, 6)).toBeUndefined();
  });

  test('adding a renderable again moves it to the cells of its aabb now', () => {
    const grid = new Map2DSpatialHashGrid(100, 100);
    const a: IMap2DRenderableArea = {aabb: new AABB2(10, 10, 10, 10)};
    grid.add(a);

    a.aabb.set(210, 210, 10, 10);
    grid.add(a);

    expect(grid.getTile(0, 0)).toBeUndefined();
    expect(grid.getTile(2, 2)?.has(a)).toBe(true);
  });

  test('findWithin() with an aabb of zero size looks into the cell its corner lies in', () => {
    const grid = new Map2DSpatialHashGrid(100, 100);
    const p: IMap2DRenderableArea = {aabb: new AABB2(100, 100, 0, 0)};
    grid.add(p);

    expect(grid.findWithin(new AABB2(100, 100, 0, 0))?.has(p)).toBe(true);
  });

  test('findWithin() and getTiles() over far more cells than the grid holds answer from the cells it holds', {
    timeout: 2000,
  }, () => {
    const grid = new Map2DSpatialHashGrid(1, 1);
    // four cells
    const a: IMap2DRenderableArea = {aabb: new AABB2(0, 0, 2, 2)};
    const b: IMap2DRenderableArea = {aabb: new AABB2(10, 10, 1, 1)};
    const c: IMap2DRenderableArea = {aabb: new AABB2(-5, 3, 1, 1)};
    grid.add(a, b, c);

    // 2e6 × 2e6 cells
    const everything = new AABB2(-1e6, -1e6, 2e6, 2e6);
    expect(grid.findWithin(everything), 'findWithin()').toEqual(new Set([a, b, c]));

    const out: IMap2DRenderableArea[] = [];
    grid.findWithin(everything, out);
    expect(out, 'findWithin() with out').toHaveLength(3);
    expect(new Set(out), 'findWithin() with out').toEqual(new Set([a, b, c]));

    expect(grid.getTiles(-1e6, -1e6, 2e6, 2e6), 'getTiles()').toEqual(new Set([a, b, c]));
    grid.getTiles(-1e6, -1e6, 2e6, 2e6, out);
    expect(out, 'getTiles() with out').toHaveLength(3);
    expect(new Set(out), 'getTiles() with out').toEqual(new Set([a, b, c]));

    // up to the cell (0, 0), which only a lies in
    expect(grid.findWithin(new AABB2(-1e6, -1e6, 1e6 + 0.5, 1e6 + 0.5)), 'up to (0, 0)').toEqual(new Set([a]));
  });

  test('the cells a renderable leaves come out of the query over the grid', () => {
    const grid = new Map2DSpatialHashGrid(1, 1);
    const a: IMap2DRenderableArea = {aabb: new AABB2(0, 0, 2, 2)};
    const b: IMap2DRenderableArea = {aabb: new AABB2(10, 10, 1, 1)};
    const c: IMap2DRenderableArea = {aabb: new AABB2(-5, 3, 1, 1)};
    const everything = new AABB2(-1e6, -1e6, 2e6, 2e6);
    const out: IMap2DRenderableArea[] = [];
    grid.add(a, b, c);

    grid.remove(b);
    expect(grid.findWithin(everything), 'b removed').toEqual(new Set([a, c]));

    grid.add(b);
    expect(grid.findWithin(everything), 'b added again').toEqual(new Set([a, b, c]));

    a.aabb = new AABB2(-20, -20, 3, 3);
    grid.add(a);
    grid.findWithin(everything, out);
    expect(
      out.filter((r) => r === a),
      'a, once',
    ).toHaveLength(1);
    expect(new Set(out), 'a moved').toEqual(new Set([a, b, c]));
  });

  test('add() works out the cells of each renderable once', () => {
    const grid = new Map2DSpatialHashGrid(10, 10);
    const a: IMap2DRenderableArea = {aabb: new AABB2(0, 0, 25, 5)};
    const b: IMap2DRenderableArea = {aabb: new AABB2(30, 30, 5, 25)};
    const computeTiles = vi.spyOn(Map2DTileCoordsUtil.prototype, 'computeTilesWithinArea');

    grid.add(a, b);

    expect(computeTiles).toHaveBeenCalledTimes(2);
    expect(grid.getTile(2, 0)?.has(a)).toBe(true);
    expect(grid.getTile(3, 5)?.has(b)).toBe(true);
  });

  describe('maxCellsPerRenderable', () => {
    test('add() refuses an aabb that reaches into more than maxCellsPerRenderable cells and adds none of the renderables', () => {
      const grid = new Map2DSpatialHashGrid(1, 1);
      const small: IMap2DRenderableArea = {aabb: new AABB2(0, 0, 1, 1)};
      const large: IMap2DRenderableArea = {aabb: new AABB2(0, 0, 300, 300)};
      const add = () => grid.add(small, large);

      expect(add).toThrow(RangeError);
      expect(add).toThrow(
        'Map2DSpatialHashGrid: the aabb of a renderable reaches into 90000 cells, more than maxCellsPerRenderable (65536) — give the grid larger cells or raise maxCellsPerRenderable',
      );
      expect(grid.getTile(0, 0), 'the cell of the small one').toBeUndefined();

      const nine: IMap2DRenderableArea = {aabb: new AABB2(0, 0, 3, 3)};
      grid.maxCellsPerRenderable = 4;
      expect(() => grid.add(nine), 'nine cells over 4').toThrow(RangeError);
      grid.maxCellsPerRenderable = 9;
      grid.add(nine);
      expect(grid.getTile(2, 2)?.has(nine), 'nine cells under 9').toBe(true);
    });

    test('defaults to 65 536', () => {
      expect(new Map2DSpatialHashGrid().maxCellsPerRenderable).toBe(65_536);
    });

    test.each([0, -1, 1.5, NaN])('the setter refuses %p and keeps the value it had', (value) => {
      const grid = new Map2DSpatialHashGrid();
      grid.maxCellsPerRenderable = 100;
      const write = () => (grid.maxCellsPerRenderable = value);

      expect(write).toThrow(RangeError);
      expect(write).toThrow(
        `Map2DSpatialHashGrid: maxCellsPerRenderable must be a whole number above 0 or Infinity, got ${value}`,
      );
      expect(grid.maxCellsPerRenderable).toBe(100);
    });

    test('the setter takes Infinity', () => {
      const grid = new Map2DSpatialHashGrid();
      grid.maxCellsPerRenderable = Infinity;

      expect(grid.maxCellsPerRenderable).toBe(Infinity);
    });
  });

  describe('an aabb that is not finite', () => {
    test('add() refuses an aabb with NaN in any of its four values', () => {
      for (const aabb of [
        new AABB2(NaN, 0, 10, 10),
        new AABB2(0, NaN, 10, 10),
        new AABB2(0, 0, NaN, 10),
        new AABB2(0, 0, 10, NaN),
      ]) {
        const grid = new Map2DSpatialHashGrid(10, 10);
        expect(() => grid.add({aabb}), `${aabb.left}, ${aabb.top}, ${aabb.width}, ${aabb.height}`).toThrow(RangeError);
      }

      expect(() => new Map2DSpatialHashGrid(10, 10).add({aabb: new AABB2(0, 0, NaN, 10)})).toThrow(
        'Map2DSpatialHashGrid: the aabb of a renderable must have a finite left, top, width and height, got left 0, top 0, width NaN, height 10',
      );
    });

    test('add() refuses an aabb with an infinite width or height', () => {
      for (const aabb of [new AABB2(0, 0, Infinity, 10), new AABB2(0, 0, 10, -Infinity)]) {
        const grid = new Map2DSpatialHashGrid(10, 10);
        expect(() => grid.add({aabb}), `${aabb.width}, ${aabb.height}`).toThrow(RangeError);
      }
    });

    test('add() leaves the grid as it was when one of the renderables it is handed is refused', () => {
      const grid = new Map2DSpatialHashGrid(10, 10);
      const held: IMap2DRenderableArea = {aabb: new AABB2(0, 0, 5, 5)};
      grid.add(held);

      held.aabb.set(50, 50, 5, 5);
      const refused: IMap2DRenderableArea = {aabb: new AABB2(0, NaN, 5, 5)};

      expect(() => grid.add(held, refused)).toThrow(RangeError);

      expect(grid.getTile(0, 0)?.has(held)).toBe(true);
      expect(grid.getTile(5, 5)).toBeUndefined();
      expect(grid.findWithin(new AABB2(-100, -100, 300, 300), [])).toEqual([held]);
    });

    test('findWithin() refuses an aabb that is not finite', () => {
      const grid = new Map2DSpatialHashGrid(10, 10);
      grid.add({aabb: new AABB2(0, 0, 5, 5)});

      for (const aabb of [
        new AABB2(NaN, 0, 10, 10),
        new AABB2(0, 0, 10, NaN),
        new AABB2(0, 0, Infinity, 10),
        new AABB2(-Infinity, 0, 10, 10),
      ]) {
        expect(() => grid.findWithin(aabb)).toThrow(RangeError);
        expect(() => grid.findWithin(aabb, [])).toThrow(RangeError);
      }
      expect(() => grid.findWithin(new AABB2(0, 0, NaN, 10))).toThrow(
        'Map2DSpatialHashGrid: the aabb of findWithin() must have a finite left, top, width and height, got left 0, top 0, width NaN, height 10',
      );
    });

    test('getTiles() refuses a width or height that is not finite', () => {
      const grid = new Map2DSpatialHashGrid(10, 10);
      grid.add({aabb: new AABB2(0, 0, 5, 5)});

      expect(() => grid.getTiles(0, 0, Infinity, 1)).toThrow(RangeError);
      expect(() => grid.getTiles(0, 0, 1, NaN, [])).toThrow(RangeError);
      expect(() => grid.getTiles(0, 0, 1, Infinity)).toThrow(
        'Map2DSpatialHashGrid: the width and height of getTiles() must be finite numbers, got width 1, height Infinity',
      );
    });
  });

  test('getTile() hands out the set of a cell read-only (a type-level check)', () => {
    // the @ts-expect-error line carries the claim: `pnpm typecheck` fails as soon as getTile()
    // hands out a set that can be written to; Vitest checks nothing here. The function is never called.
    const writeIntoCell = (grid: Map2DSpatialHashGrid<IMap2DRenderableArea>, renderable: IMap2DRenderableArea) => {
      // @ts-expect-error the grid alone writes the set of a cell
      return grid.getTile(0, 0)?.add(renderable);
    };
    void writeIntoCell;
  });
});
