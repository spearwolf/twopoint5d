import {describe, expect, test} from 'vitest';
import {AABB2} from './AABB2.js';
import type {IMap2DRenderableArea} from './types.js';
import {Map2DSpatialHashGrid} from './Map2DSpatialHashGrid.js';

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
    expect(create).toThrow('[Map2DSpatialHashGrid] tileWidth must be a finite number above 0, got 0');
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

  test('findWithin fills the set it is handed and hands it back', () => {
    const grid = new Map2DSpatialHashGrid(20, 20);
    const a: IMap2DRenderableArea = {aabb: new AABB2(-60, -60, 100, 80)};
    const b: IMap2DRenderableArea = {aabb: new AABB2(30, 10, 80, 70)};
    const c: IMap2DRenderableArea = {aabb: new AABB2(-90, 50, 50, 50)};
    grid.add(a, b, c);

    const stranger: IMap2DRenderableArea = {aabb: new AABB2(0, 0, 1, 1)};
    const out = new Set<IMap2DRenderableArea>([stranger]);

    const tileset = grid.findWithin(new AABB2(-50, -50, 100, 90), out);

    expect(tileset).toBe(out);
    expect([...out]).toEqual(expect.arrayContaining([a, b]));
    expect(out.size, 'the hits and nothing else').toBe(2);
  });

  test('findWithin hands back the empty set it is handed when nothing lies within', () => {
    const grid = new Map2DSpatialHashGrid(20, 20);
    grid.add({aabb: new AABB2(-60, -60, 100, 80)});

    const out = new Set<IMap2DRenderableArea>([{aabb: new AABB2(0, 0, 1, 1)}]);

    const tileset = grid.findWithin(new AABB2(200, 200, 50, 50), out);

    expect(tileset).toBe(out);
    expect(out.size).toBe(0);
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
});
