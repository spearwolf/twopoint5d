import {AABB2} from './AABB2';
import {IMap2dLayerTilesRenderer} from './IMap2dLayerTilesRenderer';
import {Map2dAreaTile} from './Map2dAreaTile';
import {Map2dLayer} from './Map2dLayer';

describe('Map2dLayer', () => {
  describe('new', () => {
    test('tileWidth, tileHeight', () => {
      const layer = new Map2dLayer(8, 16);
      expect(layer.tileWidth).toEqual(8);
      expect(layer.tileHeight).toEqual(16);
      layer.tileWidth = 77;
      layer.tileHeight = 99;
      expect(layer.tileWidth).toEqual(77);
      expect(layer.tileHeight).toEqual(99);
    });
    test('xOffset, yOffset', () => {
      let layer = new Map2dLayer(1, 1);
      expect(layer.xOffset).toEqual(0);
      expect(layer.yOffset).toEqual(0);
      layer = new Map2dLayer(1, 1, 10, 20);
      expect(layer.xOffset).toEqual(10);
      expect(layer.yOffset).toEqual(20);
      layer.xOffset = 77;
      layer.yOffset = 99;
      expect(layer.xOffset).toEqual(77);
      expect(layer.yOffset).toEqual(99);
    });
    test('tiles', () => {
      const layer = new Map2dLayer(1, 1);
      expect(Array.isArray(layer.tiles)).toBeTruthy();
      expect(layer.tiles).toHaveLength(0);
    });
    test('tilesRenderer', () => {
      const layer = new Map2dLayer(1, 1);
      expect(layer.renderers.size).toBe(0);
      const renderer: IMap2dLayerTilesRenderer = {
        beginUpdate(_layer: Map2dLayer, _xOffset: number, _yOffset: number, _fullViewArea: AABB2) {},
        addTile(_tile: Map2dAreaTile) {},
        reuseTile(_tile: Map2dAreaTile) {},
        removeTile(_tile: Map2dAreaTile) {},
        getObject3D() {
          return null;
        },
        endUpdate() {},
        dispose() {},
      };
      layer.addTilesRenderer(renderer);
      expect(layer.renderers.has(renderer)).toBeTruthy();
    });
    // TODO add renderViewArea() tests !!
  });
});
