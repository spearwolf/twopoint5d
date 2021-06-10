import {Map2dTileDataView} from './Map2dTileDataView';
import {RepeatingTilesProvider} from './RepeatingTilesProvider';

describe('Map2dDataView', () => {
  describe('new', () => {
    test('only with tileWidth and tileHeight', () => {
      const view = new Map2dTileDataView(16, 32);
      expect(view).toBeDefined();
      expect(view.provider).toBeDefined();
      expect(view.tileWidth).toBe(16);
      expect(view.tileHeight).toBe(32);
      expect(view.xOffset).toBe(0);
      expect(view.yOffset).toBe(0);
    });
    test('with provider', () => {
      const provider = new RepeatingTilesProvider(1);
      const view = new Map2dTileDataView(16, 16, provider);
      expect(view).toBeDefined();
      expect(view.provider).toBe(provider);
    });
    test('with xOffset and yOffset', () => {
      const view = new Map2dTileDataView(16, 16, undefined, 4, 8);
      expect(view).toBeDefined();
      expect(view.provider).toBeDefined();
      expect(view.xOffset).toBe(4);
      expect(view.yOffset).toBe(8);
    });
  });
  describe('getTileCoords()', () => {
    test('without offset', () => {
      expect(
        new Map2dTileDataView(32, 16).getTileCoords(4, 17, 70, 20),
      ).toEqual([0, 1, 3, 2]);
      expect(
        new Map2dTileDataView(32, 16).getTileCoords(-32, -1, 32, 32),
      ).toEqual([-1, -1, 1, 2]);
      expect(new Map2dTileDataView(16, 16).getTileCoords(8, 8, 16, 16)).toEqual(
        [0, 0, 1, 1],
      );
    });
    test('with offset', () => {
      expect(
        new Map2dTileDataView(16, 16, undefined, 20, 20).getTileCoords(
          8,
          8,
          17,
          17,
        ),
      ).toEqual([-1, -1, 2, 2]);
    });
  });
});
