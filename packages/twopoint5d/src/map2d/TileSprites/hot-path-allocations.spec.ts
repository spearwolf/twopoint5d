import {afterEach, beforeEach, describe, expect, test} from 'vitest';

import {measureAllocatedBytes} from '../../testing/measureAllocatedBytes.js';
import {TextureCoords} from '../../texture/TextureCoords.js';
import {TileSet} from '../../texture/TileSet.js';
import {AABB2} from '../AABB2.js';
import {Map2DTileCoords} from '../Map2DTileCoords.js';
import {RepeatingTilesProvider} from '../RepeatingTilesProvider.js';
import {noTileCapacity} from '../constants.js';
import type {TileSprite} from './descriptors.js';
import {TileSprites} from './TileSprites.js';
import {TileSpritesFactory} from './TileSpritesFactory.js';
import {TileSpritesGeometry} from './TileSpritesGeometry.js';

// a call that allocates anything costs 16 B at least; the allocation-free paths measured below
// 0.4 B per call when these limits were set — updateTile() at 0.36 B, the noise of a few hundred
// bytes per round, spread over a thousand calls
const BYTES_PER_CALL_LIMIT = 1;

// a vertex object from Object.create(proto) with two fields measured 56 B when this limit was set,
// one built with property descriptors 552 B
const BYTES_PER_VERTEX_OBJECT_LIMIT = 128;

const makeTileSet = () => new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});

describe('tile sprites on the hot path', () => {
  let geometry: TileSpritesGeometry;
  let tileSprites: TileSprites<TileSpritesGeometry>;
  let factory: TileSpritesFactory;
  let coords: Map2DTileCoords[];
  let tiles: TileSprite[];

  beforeEach(() => {
    geometry = new TileSpritesGeometry(1100);
    tileSprites = new TileSprites(geometry);
    factory = new TileSpritesFactory(tileSprites, makeTileSet(), new RepeatingTilesProvider(1));
    coords = Array.from({length: 1000}, (_, i) => new Map2DTileCoords(i % 40, Math.floor(i / 40), new AABB2(i * 10, 0, 10, 10)));
    tiles = coords.map((c) => factory.createTile(c) as TileSprite);
  });

  afterEach(() => {
    geometry.dispose();
    tileSprites.material?.dispose();
  });

  test('updateTile() allocates nothing per tile', () => {
    const bytesPerRound = measureAllocatedBytes(() => {
      for (let i = 0; i < tiles.length; i++) {
        factory.updateTile(tiles[i]!, coords[i]!);
      }
    });
    const bytesPerCall = bytesPerRound / tiles.length;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('createTile() and destroyTile() allocate the tile sprite and nothing else', () => {
    const probe = factory.createTile(coords[0]!);
    expect(probe).not.toBeUndefined();
    expect(probe).not.toBe(noTileCapacity);
    factory.destroyTile(probe as TileSprite);

    // created at the end and freed as the last slot, so the pool stays at 1000 tiles in use
    // after the default warm-up an occasional run measured three times the bytes of the others;
    // after 1000 rounds the value holds from run to run
    const bytesPerRound = measureAllocatedBytes(
      () => {
        for (let i = 0; i < 100; i++) {
          const tile = factory.createTile(coords[i]!);
          factory.destroyTile(tile as TileSprite);
        }
      },
      {warmUpRounds: 1000},
    );
    const bytesPerTile = bytesPerRound / 100;

    expect(bytesPerTile, `${bytesPerTile.toFixed(2)} bytes per tile`).toBeLessThan(BYTES_PER_VERTEX_OBJECT_LIMIT);
  });
});
