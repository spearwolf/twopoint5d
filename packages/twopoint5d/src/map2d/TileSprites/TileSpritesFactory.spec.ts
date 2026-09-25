import type {InterleavedBuffer, InterleavedBufferAttribute} from 'three/webgpu';
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

const makeTileSet = () => new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});

const bufferOf = (geometry: TileSpritesGeometry, attrName: string): InterleavedBuffer =>
  (geometry.getAttribute(attrName) as InterleavedBufferAttribute).data;

/** The state a delivered upload leaves a buffer in: without a renderer, ranges would stay and widen. */
const uploaded = (buffer: InterleavedBuffer) => buffer.clearUpdateRanges();

/** Whether the upload of `buffer` covers all elements of `slot` — no range at all means the whole array. */
const uploadsSlot = (buffer: InterleavedBuffer, slot: number) =>
  buffer.updateRanges.length === 0 ||
  buffer.updateRanges.some(({start, count}) => start <= slot * buffer.stride && start + count >= (slot + 1) * buffer.stride);

/** The four texture coordinates of the atlas frame of a tile id, as Float32 like the buffer holds them. */
const texCoordsOfTile = (tileSet: TileSet, tileId: number): number[] => {
  const c = tileSet.atlas.get(tileSet.frameId(tileId))!.coords;
  return Array.from(new Float32Array([c.s, c.t, c.u, c.v]));
};

const attrAt = (geometry: TileSpritesGeometry, attrName: string, slot: number, size: number): number[] => {
  const attr = geometry.getAttribute(attrName) as InterleavedBufferAttribute;
  return [attr.getX(slot), attr.getY(slot), attr.getZ(slot), attr.getW(slot)].slice(0, size);
};

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

    test('a coordinate without a tile takes no slot', () => {
      const tileSprites = new TileSprites(new TileSpritesGeometry(4));
      const factory = new TileSpritesFactory(tileSprites, makeTileSet(), new RepeatingTilesProvider([[1, 0]]));
      const pool = tileSprites.geometry!.instancedPool;

      expect(factory.createTile(new Map2DTileCoords(1, 0))).toBeUndefined();
      expect(pool.usedCount).toBe(0);
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

  describe('destroyTile()', () => {
    test('gives the slot of a tile back to the instanced pool', () => {
      const tileSprites = new TileSprites(new TileSpritesGeometry(4));
      const factory = new TileSpritesFactory(tileSprites, makeTileSet(), new RepeatingTilesProvider(1));
      const pool = tileSprites.geometry!.instancedPool;

      const first = factory.createTile(new Map2DTileCoords(0, 0)) as TileSprite;
      const second = factory.createTile(new Map2DTileCoords(1, 0)) as TileSprite;
      expect(pool.usedCount, 'usedCount after two tiles were built').toBe(2);

      factory.destroyTile(first);
      expect(pool.usedCount, 'usedCount after the first was given back').toBe(1);
      expect(pool.containsVO(first), 'the first tile sits in the pool').toBe(false);
      expect(pool.containsVO(second), 'the second tile sits in the pool').toBe(true);

      factory.destroyTile(second);
      expect(pool.usedCount, 'usedCount after both were given back').toBe(0);
    });
  });

  describe('update()', () => {
    test('sets the instance count of the geometry to the tiles in use', () => {
      const geometry = new TileSpritesGeometry(4);
      const factory = new TileSpritesFactory(new TileSprites(geometry), makeTileSet(), new RepeatingTilesProvider(1));

      const first = factory.createTile(new Map2DTileCoords(0, 0)) as TileSprite;
      factory.createTile(new Map2DTileCoords(1, 0));
      factory.update();
      expect(geometry.instanceCount, 'instanceCount with two tiles').toBe(2);

      factory.destroyTile(first);
      factory.update();
      expect(geometry.instanceCount, 'instanceCount with one tile').toBe(1);
    });

    test('a tile it builds reaches the buffer that goes to the gpu', () => {
      const geometry = new TileSpritesGeometry(4);
      const tileSet = makeTileSet();
      const factory = new TileSpritesFactory(new TileSprites(geometry), tileSet, new RepeatingTilesProvider(1));
      const buffer = bufferOf(geometry, 'instancePosition');
      const version = buffer.version;

      factory.createTile(new Map2DTileCoords(0, 0, new AABB2(64, 32, 128, 96)));
      factory.update();

      expect(buffer.version, 'version of the buffer').toBeGreaterThan(version);
      expect(attrAt(geometry, 'instancePosition', 0, 3), 'instancePosition').toEqual([64, 0, 32]);
      expect(attrAt(geometry, 'quadSize', 0, 2), 'quadSize').toEqual([128, 96]);
      expect(attrAt(geometry, 'texCoords', 0, 4), 'texCoords').toEqual(texCoordsOfTile(tileSet, 1));
    });

    test('a tile it moves reaches the buffer that goes to the gpu', () => {
      const geometry = new TileSpritesGeometry(4);
      const factory = new TileSpritesFactory(new TileSprites(geometry), makeTileSet(), new RepeatingTilesProvider(1));
      const buffer = bufferOf(geometry, 'instancePosition');

      const tile = factory.createTile(new Map2DTileCoords(0, 0, new AABB2(64, 32, 128, 96))) as TileSprite;
      factory.update();
      uploaded(buffer);
      const version = buffer.version;

      factory.updateTile(tile, new Map2DTileCoords(0, 0, new AABB2(8, 16, 128, 96)));
      factory.update();

      expect(buffer.version, 'version of the buffer').toBeGreaterThan(version);
      expect(uploadsSlot(buffer, 0), 'the upload covers slot 0').toBe(true);
      expect(attrAt(geometry, 'instancePosition', 0, 3), 'instancePosition').toEqual([8, 0, 16]);
    });

    test('the tile that moves into a freed slot reaches the buffer that goes to the gpu with all of its attributes', () => {
      const geometry = new TileSpritesGeometry(4);
      const tileSet = makeTileSet();
      const factory = new TileSpritesFactory(new TileSprites(geometry), tileSet, new RepeatingTilesProvider([[1, 2]]));
      const buffer = bufferOf(geometry, 'instancePosition');

      const a = factory.createTile(new Map2DTileCoords(0, 0)) as TileSprite;
      factory.createTile(new Map2DTileCoords(1, 0, new AABB2(300, 400, 64, 48)));
      factory.update();
      uploaded(buffer);
      const version = buffer.version;

      // the pool copies the last slot into the one that became free
      factory.destroyTile(a);
      factory.update();

      expect(buffer.version, 'version of the buffer').toBeGreaterThan(version);
      expect(geometry.instanceCount, 'instanceCount').toBe(1);
      expect(uploadsSlot(buffer, 0), 'the upload covers slot 0').toBe(true);
      expect(attrAt(geometry, 'instancePosition', 0, 3), 'instancePosition').toEqual([300, 0, 400]);
      expect(attrAt(geometry, 'quadSize', 0, 2), 'quadSize').toEqual([64, 48]);
      expect(attrAt(geometry, 'texCoords', 0, 4), 'texCoords').toEqual(texCoordsOfTile(tileSet, 2));
    });

    test('a frame that moves one tile uploads the slot of that tile and no other', () => {
      const geometry = new TileSpritesGeometry(4);
      const factory = new TileSpritesFactory(new TileSprites(geometry), makeTileSet(), new RepeatingTilesProvider(1));
      const buffer = bufferOf(geometry, 'instancePosition');

      factory.createTile(new Map2DTileCoords(0, 0, new AABB2(0, 0, 128, 128)));
      factory.createTile(new Map2DTileCoords(1, 0, new AABB2(128, 0, 128, 128)));
      const third = factory.createTile(new Map2DTileCoords(2, 0, new AABB2(256, 0, 128, 128))) as TileSprite;
      factory.update();
      uploaded(buffer);

      factory.updateTile(third, new Map2DTileCoords(2, 0, new AABB2(512, 64, 128, 128)));
      factory.update();

      // no range at all would upload the whole array
      expect(buffer.updateRanges.length, 'the upload names a range').toBeGreaterThan(0);
      expect(uploadsSlot(buffer, 2), 'the upload covers slot 2').toBe(true);
      expect(
        buffer.updateRanges.every(({start}) => start >= 2 * buffer.stride),
        'the upload leaves the slots before it alone',
      ).toBe(true);
    });

    test('update() with nothing written sends nothing to the gpu', () => {
      const geometry = new TileSpritesGeometry(4);
      const factory = new TileSpritesFactory(new TileSprites(geometry), makeTileSet(), new RepeatingTilesProvider(1));
      const buffer = bufferOf(geometry, 'instancePosition');

      factory.createTile(new Map2DTileCoords(0, 0));
      factory.update();
      uploaded(buffer);
      const version = buffer.version;

      factory.update();

      expect(buffer.version, 'version of the buffer').toBe(version);
    });

    test('leaves a TileSprites without a TileSpritesGeometry alone', () => {
      const factory = new TileSpritesFactory(new TileSprites(), makeTileSet(), new RepeatingTilesProvider(1));

      expect(() => factory.update()).not.toThrow();
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
