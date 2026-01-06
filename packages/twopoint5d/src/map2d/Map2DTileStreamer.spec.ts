import type { Vector3} from 'three/webgpu';
import {Object3D} from 'three/webgpu';
import {describe, expect, test} from 'vitest';
import {Map2DTileStreamer} from './Map2DTileStreamer.js';
import type {IMap2DTileCoords, IMap2DTileRenderer} from './types.js';

describe('Map2DTileStreamer', () => {
  describe('new', () => {
    test('tileWidth, tileHeight', () => {
      const layer = new Map2DTileStreamer(8, 16);
      expect(layer.tileWidth).toEqual(8);
      expect(layer.tileHeight).toEqual(16);
      layer.tileWidth = 77;
      layer.tileHeight = 99;
      expect(layer.tileWidth).toEqual(77);
      expect(layer.tileHeight).toEqual(99);
    });
    test('xOffset, yOffset', () => {
      let layer = new Map2DTileStreamer(1, 1);
      expect(layer.xOffset).toEqual(0);
      expect(layer.yOffset).toEqual(0);
      layer = new Map2DTileStreamer(1, 1, 10, 20);
      expect(layer.xOffset).toEqual(10);
      expect(layer.yOffset).toEqual(20);
      layer.xOffset = 77;
      layer.yOffset = 99;
      expect(layer.xOffset).toEqual(77);
      expect(layer.yOffset).toEqual(99);
    });
    test('tiles', () => {
      const layer = new Map2DTileStreamer(1, 1);
      expect(Array.isArray(layer.tiles)).toBeTruthy();
      expect(layer.tiles).toHaveLength(0);
    });
    test('tilesRenderer', () => {
      const layer = new Map2DTileStreamer(1, 1);
      expect(layer.renderers.size).toBe(0);
      const renderer: IMap2DTileRenderer = {
        node: new Object3D(),
        beginUpdatingTiles(_pos: Vector3) {},
        addTile(_coords: IMap2DTileCoords) {},
        reuseTile(_coords: IMap2DTileCoords) {},
        removeTile(_coords: IMap2DTileCoords) {},
        clearTiles() {},
        endUpdatingTiles() {},
        dispose() {},
      };
      layer.addTileRenderer(renderer);
      expect(layer.renderers.has(renderer)).toBeTruthy();
    });
  });
});
