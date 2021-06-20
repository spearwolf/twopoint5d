import {Map2dTileCoordsUtil} from './Map2dTileCoordsUtil';

describe('Map2dTileCoordsUtil', () => {
  describe('new', () => {
    test('only with tileWidth and tileHeight', () => {
      const view = new Map2dTileCoordsUtil(16, 32);
      expect(view).toBeDefined();
      expect(view.tileWidth).toBe(16);
      expect(view.tileHeight).toBe(32);
      expect(view.xOffset).toBe(0);
      expect(view.yOffset).toBe(0);
    });
    test('with xOffset and yOffset', () => {
      const view = new Map2dTileCoordsUtil(16, 16, 4, 8);
      expect(view).toBeDefined();
      expect(view.xOffset).toBe(4);
      expect(view.yOffset).toBe(8);
    });
  });
  describe('getTileCoords()', () => {
    test('without offset', () => {
      expect(new Map2dTileCoordsUtil(32, 16).getTileCoords(4, 17, 70, 20)).toEqual([0, 1, 3, 2]);
      expect(new Map2dTileCoordsUtil(32, 16).getTileCoords(-32, -1, 32, 32)).toEqual([
        -1, -1, 1, 3,
      ]);
      expect(new Map2dTileCoordsUtil(16, 16).getTileCoords(8, 8, 16, 16)).toEqual([0, 0, 2, 2]);
    });
    test('with offset', () => {
      expect(new Map2dTileCoordsUtil(16, 16, 20, 20).getTileCoords(8, 8, 17, 17)).toEqual([
        -1, -1, 2, 2,
      ]);
    });
    test('320x240 example', () => {
      expect(new Map2dTileCoordsUtil(300, 200).getTileCoords(-320, -240, 640, 480)).toEqual([
        -2, -2, 4, 4,
      ]);
    });
  });
  describe('computeTilesWithinCoords()', () => {
    test('with offset', () => {
      expect(
        new Map2dTileCoordsUtil(16, 16, 20, 20).computeTilesWithinCoords(8, 8, 17, 17),
      ).toMatchObject({
        top: 4,
        left: 4,
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
