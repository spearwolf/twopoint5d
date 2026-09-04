import {describe, expect, test} from 'vitest';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';

describe('Map2DTileCoordsUtil', () => {
  describe('new', () => {
    test('only with tileWidth and tileHeight', () => {
      const view = new Map2DTileCoordsUtil(16, 32);
      expect(view).toBeDefined();
      expect(view.tileWidth).toBe(16);
      expect(view.tileHeight).toBe(32);
      expect(view.xOffset).toBe(0);
      expect(view.yOffset).toBe(0);
    });
    test('with xOffset and yOffset', () => {
      const view = new Map2DTileCoordsUtil(16, 16, 4, 8);
      expect(view).toBeDefined();
      expect(view.xOffset).toBe(4);
      expect(view.yOffset).toBe(8);
    });
  });
  describe('getTileCoords()', () => {
    test('without offset', () => {
      expect(new Map2DTileCoordsUtil(32, 16).getTileCoords(4, 17, 70, 20)).toEqual([0, 1, 3, 2]);
      expect(new Map2DTileCoordsUtil(32, 16).getTileCoords(-32, -1, 32, 32)).toEqual([-1, -1, 1, 3]);
      expect(new Map2DTileCoordsUtil(16, 16).getTileCoords(8, 8, 16, 16)).toEqual([0, 0, 2, 2]);
    });
    test('with offset', () => {
      expect(new Map2DTileCoordsUtil(16, 16, 20, 20).getTileCoords(8, 8, 17, 17)).toEqual([-1, -1, 2, 2]);
    });
    test('320x240 example', () => {
      expect(new Map2DTileCoordsUtil(300, 200).getTileCoords(-320, -240, 640, 480)).toEqual([-2, -2, 4, 4]);
    });
  });
  describe('getTileCoords() boundary matrix', () => {
    // top is fixed at 0 and height at 16, so tileTop is always 0 and rows always 1 —
    // only tileLeft and columns are asserted here.
    test.each([
      [-17, 0, -2, 1],
      [-17, 1, -2, 1],
      [-17, 15, -2, 2],
      [-17, 16, -2, 2],
      [-17, 17, -2, 2],
      [-17, 32, -2, 3],
      [-16, 0, -1, 0],
      [-16, 1, -1, 1],
      [-16, 15, -1, 1],
      [-16, 16, -1, 1],
      [-16, 17, -1, 2],
      [-16, 32, -1, 2],
      [-1, 0, -1, 1],
      [-1, 1, -1, 1],
      [-1, 15, -1, 2],
      [-1, 16, -1, 2],
      [-1, 17, -1, 2],
      [-1, 32, -1, 3],
      [0, 0, 0, 0],
      [0, 1, 0, 1],
      [0, 15, 0, 1],
      [0, 16, 0, 1],
      [0, 17, 0, 2],
      [0, 32, 0, 2],
      [1, 0, 0, 1],
      [1, 1, 0, 1],
      [1, 15, 0, 1],
      [1, 16, 0, 2],
      [1, 17, 0, 2],
      [1, 32, 0, 3],
      [15, 0, 0, 1],
      [15, 1, 0, 1],
      [15, 15, 0, 2],
      [15, 16, 0, 2],
      [15, 17, 0, 2],
      [15, 32, 0, 3],
      [16, 0, 1, 0],
      [16, 1, 1, 1],
      [16, 15, 1, 1],
      [16, 16, 1, 1],
      [16, 17, 1, 2],
      [16, 32, 1, 2],
      [17, 0, 1, 1],
      [17, 1, 1, 1],
      [17, 15, 1, 1],
      [17, 16, 1, 2],
      [17, 17, 1, 2],
      [17, 32, 1, 3],
    ])('left=%i, width=%i -> tileLeft=%i, columns=%i', (left, width, expectedTileLeft, expectedColumns) => {
      const [tileLeft, , columns] = new Map2DTileCoordsUtil(16, 16).getTileCoords(left, 0, width, 16);
      expect(tileLeft).toBe(expectedTileLeft);
      expect(columns).toBe(expectedColumns);
    });

    // a zero-width selection resolves to columns === 0 only when left sits exactly on a
    // tile boundary (e.g. left=-16, width=0); any other left within the same tile yields
    // columns === 1. This degenerate case is not a defect, but it is the number that
    // would silently flip on the next refactor without this table.
    test.each([
      [3, 1, -1, 1],
      [3, 16, -1, 2],
      [3, 17, -1, 2],
      [4, 1, 0, 1],
      [4, 16, 0, 1],
      [4, 17, 0, 2],
      [5, 1, 0, 1],
      [5, 16, 0, 2],
      [5, 17, 0, 2],
      [19, 1, 0, 1],
      [19, 16, 0, 2],
      [19, 17, 0, 2],
      [20, 1, 1, 1],
      [20, 16, 1, 1],
      [20, 17, 1, 2],
      [21, 1, 1, 1],
      [21, 16, 1, 2],
      [21, 17, 1, 2],
    ])('with offset: left=%i, width=%i -> tileLeft=%i, columns=%i', (left, width, expectedTileLeft, expectedColumns) => {
      const [tileLeft, , columns] = new Map2DTileCoordsUtil(16, 16, 4, 0).getTileCoords(left, 0, width, 16);
      expect(tileLeft).toBe(expectedTileLeft);
      expect(columns).toBe(expectedColumns);
    });
  });

  describe('computeTilesWithinCoords()', () => {
    test('with offset', () => {
      expect(new Map2DTileCoordsUtil(16, 16, 20, 20).computeTilesWithinCoords(8, 8, 17, 17)).toMatchObject({
        top: -16,
        left: -16,
        width: 32,
        height: 32,
        tileTop: -1,
        tileLeft: -1,
        tileWidth: 16,
        tileHeight: 16,
        columns: 2,
        rows: 2,
      });
    });
  });
});
