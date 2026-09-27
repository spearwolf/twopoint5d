import {test} from 'vitest';

import {TextureCoords} from '../../texture/TextureCoords.js';
import {TileSet} from '../../texture/TileSet.js';
import {AABB2} from '../AABB2.js';
import {Map2DTileCoords} from '../Map2DTileCoords.js';
import {RepeatingTilesProvider} from '../RepeatingTilesProvider.js';
import type {TileSprite} from './descriptors.js';
import {TileSprites} from './TileSprites.js';
import {TileSpritesFactory} from './TileSpritesFactory.js';
import {TileSpritesGeometry} from './TileSpritesGeometry.js';

const options = {time: 500, warmupTime: 200};

const makeTileSet = () => new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});

test('scrolling 1000 tile sprites', async ({bench}) => {
  const geometry = new TileSpritesGeometry(1100);
  const tileSprites = new TileSprites(geometry);
  const factory = new TileSpritesFactory(tileSprites, makeTileSet(), new RepeatingTilesProvider(1));
  const coords = Array.from(
    {length: 1000},
    (_, i) => new Map2DTileCoords(i % 40, Math.floor(i / 40), new AABB2(i * 10, 0, 10, 10)),
  );
  const tiles = coords.map((c) => factory.createTile(c) as TileSprite);

  await bench.compare(
    bench('updateTile() for every tile, then update()', () => {
      for (let i = 0; i < tiles.length; i++) factory.updateTile(tiles[i]!, coords[i]!);
      factory.update();
    }),
    bench('destroyTile() and createTile() for 100 tiles, then update()', () => {
      for (let i = 0; i < 100; i++) {
        factory.destroyTile(tiles[i]!);
        tiles[i] = factory.createTile(coords[i]!) as TileSprite;
      }
      factory.update();
    }),
    options,
  );

  geometry.dispose();
  tileSprites.material?.dispose();
});
