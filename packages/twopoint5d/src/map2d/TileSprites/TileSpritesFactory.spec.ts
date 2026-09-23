import {Vector3} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

import {TextureCoords} from '../../texture/TextureCoords.js';
import {TileSet} from '../../texture/TileSet.js';
import type {VOAttrGetter} from '../../vertex-objects/types.js';
import {AABB2} from '../AABB2.js';
import {Map2DTileCoords} from '../Map2DTileCoords.js';
import {Map2DTileRenderer} from '../Map2DTileRenderer.js';
import {RepeatingTilesProvider} from '../RepeatingTilesProvider.js';
import {noTileCapacity} from '../constants.js';
import type {TileSprite} from './descriptors.js';
import {TileSprites} from './TileSprites.js';
import {TileSpritesFactory} from './TileSpritesFactory.js';
import {TileSpritesGeometry} from './TileSpritesGeometry.js';

describe('TileSpritesFactory', () => {
  describe('createTile()', () => {
    test('a factory without a tile set leaves the instanced pool as it found it', () => {
      const tileSprites = new TileSprites(new TileSpritesGeometry(4));
      const factory = new TileSpritesFactory(tileSprites, undefined, new RepeatingTilesProvider(1));
      const pool = tileSprites.geometry!.instancedPool;

      expect(() => factory.createTile(new Map2DTileCoords(0, 0))).toThrow();
      expect(pool.usedCount, 'usedCount after a throw').toBe(0);
    });

    test('a tile the factory can build takes a slot out of the instanced pool', () => {
      const tileSprites = new TileSprites(new TileSpritesGeometry(4));
      const tileSet = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});
      const factory = new TileSpritesFactory(tileSprites, tileSet, new RepeatingTilesProvider(1));
      const pool = tileSprites.geometry!.instancedPool;

      expect(factory.createTile(new Map2DTileCoords(0, 0))).toBeDefined();
      expect(pool.usedCount, 'usedCount after a tile was built').toBe(1);
    });

    test('a full instanced pool answers noTileCapacity', () => {
      const tileSprites = new TileSprites(new TileSpritesGeometry(1));
      const tileSet = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});
      const factory = new TileSpritesFactory(tileSprites, tileSet, new RepeatingTilesProvider(1));
      const pool = tileSprites.geometry!.instancedPool;

      const first = factory.createTile(new Map2DTileCoords(0, 0));
      expect(first, 'the tile that takes the one slot').toBeDefined();
      expect(first, 'the tile that takes the one slot').not.toBe(noTileCapacity);
      expect(factory.createTile(new Map2DTileCoords(1, 0)), 'the tile beyond the capacity').toBe(noTileCapacity);
      expect(pool.usedCount, 'usedCount after the pool refused').toBe(1);
    });

    test('a coordinate without a tile answers undefined even when the pool is full', () => {
      const tileSprites = new TileSprites(new TileSpritesGeometry(1));
      const tileSet = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});
      // column 0 holds tile id 1, column 1 tile id 0
      const factory = new TileSpritesFactory(tileSprites, tileSet, new RepeatingTilesProvider([[1, 0]]));

      factory.createTile(new Map2DTileCoords(0, 0));

      expect(factory.createTile(new Map2DTileCoords(1, 0))).toBeUndefined();
    });

    test('a TileSprites without a geometry answers noTileCapacity', () => {
      const tileSet = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});
      const factory = new TileSpritesFactory(new TileSprites(), tileSet, new RepeatingTilesProvider(1));

      expect(factory.createTile(new Map2DTileCoords(0, 0))).toBe(noTileCapacity);
    });

    test('a tile carries the size, position and tex coords of its coordinate', () => {
      const tileSprites = new TileSprites(new TileSpritesGeometry(4));
      const tileSet = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});
      const factory = new TileSpritesFactory(tileSprites, tileSet, new RepeatingTilesProvider(1));

      const tile = factory.createTile(new Map2DTileCoords(0, 0, new AABB2(64, 32, 128, 96))) as TileSprite;

      expect(tile.width).toBe(128);
      expect(tile.height).toBe(96);
      expect(tile.x).toBe(64);
      expect(tile.y).toBe(0);
      expect(tile.z).toBe(32);

      const c = tileSet.atlas.get(tileSet.frameId(1))!.coords;
      expect(Array.from((tile as TileSprite & {getTexCoords: VOAttrGetter}).getTexCoords())).toEqual(
        Array.from(new Float32Array([c.s, c.t, c.u, c.v])),
      );

      factory.updateTile(tile, new Map2DTileCoords(0, 0, new AABB2(8, 16, 128, 96)));

      expect(tile.x).toBe(8);
      expect(tile.z).toBe(16);
    });
  });

  describe('with a Map2DTileRenderer', () => {
    test('a TileSprites without a geometry goes through a whole cycle and answers noTileCapacity', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const tileSet = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});
        const factory = new TileSpritesFactory(new TileSprites(), tileSet, new RepeatingTilesProvider(1));
        const renderer = new Map2DTileRenderer(factory);
        const createTile = vi.spyOn(factory, 'createTile');

        expect(() => {
          renderer.beginUpdatingTiles(new Vector3(), true);
          renderer.addTile(new Map2DTileCoords(0, 0));
          renderer.endUpdatingTiles();
        }).not.toThrow();
        expect(createTile.mock.results[0]!.value).toBe(noTileCapacity);
      } finally {
        warn.mockRestore();
      }
    });

    test('a tile the full pool could not take is built once a tile leaves the view', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const tileSprites = new TileSprites(new TileSpritesGeometry(2));
        const tileSet = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});
        const factory = new TileSpritesFactory(tileSprites, tileSet, new RepeatingTilesProvider(1));
        const pool = tileSprites.geometry!.instancedPool;
        const renderer = new Map2DTileRenderer(factory);
        const createTile = vi.spyOn(factory, 'createTile');

        renderer.beginUpdatingTiles(new Vector3(), true);
        renderer.addTile(new Map2DTileCoords(0, 0));
        renderer.addTile(new Map2DTileCoords(1, 0));
        renderer.addTile(new Map2DTileCoords(2, 0));
        renderer.endUpdatingTiles();

        expect(pool.usedCount, 'usedCount after the first cycle').toBe(2);
        expect(createTile.mock.results[2]!.value, 'the tile beyond the capacity').toBe(noTileCapacity);

        renderer.beginUpdatingTiles(new Vector3(), true);
        renderer.removeTile(new Map2DTileCoords(0, 0));
        renderer.reuseTile(new Map2DTileCoords(1, 0));
        renderer.reuseTile(new Map2DTileCoords(2, 0));
        renderer.endUpdatingTiles();

        expect(pool.usedCount, 'usedCount after the second cycle').toBe(2);
        expect(createTile, 'createTile()').toHaveBeenCalledTimes(4);
        const tileAt2 = createTile.mock.results[3]!.value;
        expect(tileAt2, 'the tile at (2, 0) in the second cycle').toBeDefined();
        expect(tileAt2, 'the tile at (2, 0) in the second cycle').not.toBe(noTileCapacity);
        expect(pool.containsVO(tileAt2), 'the tile at (2, 0) sits in the pool').toBe(true);
      } finally {
        warn.mockRestore();
      }
    });
  });
});
