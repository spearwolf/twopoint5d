import {describe, expect, test} from 'vitest';
import {AABB2} from './AABB2.js';
import type {IMap2DRenderableArea} from './types.js';
import {Map2DSpatialHashGrid} from './Map2DSpatialHashGrid.js';

describe('Map2DSpatialHashGrid', () => {
  test('construction', () => {
    const grid = new Map2DSpatialHashGrid(10, 100, -5, -50);
    expect(grid).toBeDefined();
  });

  test('add', () => {
    const grid = new Map2DSpatialHashGrid(100, 100);
    const a: IMap2DRenderableArea = {aabb: new AABB2(10, 20, 150, 150)};
    const b: IMap2DRenderableArea = {aabb: new AABB2(-50, -50, 50, 50)};

    expect(grid.add(a)).toBe(grid);
    expect(grid.add(b)).toBe(grid);

    let tileset = grid.getTiles(-1, -1, 2, 2);
    expect(tileset.size).toBe(2);
    expect(tileset.has(a)).toBeTruthy();
    expect(tileset.has(b)).toBeTruthy();

    tileset = grid.getTiles(0, 0, 1, 1);
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

    let tileset = grid.getTiles(-1, -1, 2, 2);
    expect(tileset.size).toBe(2);
    expect(tileset.has(a)).toBeTruthy();
    expect(tileset.has(b)).toBeTruthy();

    expect(grid.remove(a)).toBe(grid);

    tileset = grid.getTiles(-1, -1, 2, 2);
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

    let tileset = grid.findWithin(new AABB2(-50, -50, 100, 110));
    expect(tileset.size).toBe(3);
    expect(tileset.has(a)).toBeTruthy();
    expect(tileset.has(b)).toBeTruthy();
    expect(tileset.has(c)).toBeTruthy();

    tileset = grid.findWithin(new AABB2(-50, -50, 100, 90));
    expect(tileset.size).toBe(2);
    expect(tileset.has(a)).toBeTruthy();
    expect(tileset.has(b)).toBeTruthy();
    expect(tileset.has(c)).toBeFalsy();

    tileset = grid.findWithin(new AABB2(0, 0, 30, 30));
    expect(tileset.size).toBe(2);
    expect(tileset.has(a)).toBeTruthy();
    expect(tileset.has(b)).toBeTruthy();
    expect(tileset.has(c)).toBeFalsy();

    tileset = grid.findWithin(new AABB2(-40, 20, 50, 50));
    expect(tileset).toBeUndefined();
  });
});
