import {describe, expect, test} from 'vitest';

import {TextureCoords} from '../../texture/TextureCoords.js';
import {TileSet} from '../../texture/TileSet.js';
import {Map2DTileCoords} from '../Map2DTileCoords.js';
import {RepeatingTilesProvider} from '../RepeatingTilesProvider.js';
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
  });
});
