import {describe, expect, test} from 'vitest';

import {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {TileSet} from './TileSet.js';

describe('TileSet', () => {
  test('single tile', () => {
    const tiles = new TileSet(new TextureCoords(0, 0, 128, 256));
    expect(tiles.atlas).toBeInstanceOf(TextureAtlas);
    expect(tiles).toMatchObject({
      tileWidth: 128,
      tileHeight: 256,
      tileCount: 1,
      firstId: 1,
      firstFrameId: 0,
    });
    expect(tiles.frameId(1)).toBe(0);
  });
  test('tiles with margin + padding', () => {
    const tiles = new TileSet(new TextureCoords(0, 0, 128, 256), {
      margin: 1,
      padding: 1,
      tileWidth: 55,
      tileHeight: 61,
      tileCount: 6,
      firstId: 4,
    });
    expect(tiles).toMatchObject({
      tileWidth: 55,
      tileHeight: 61,
      tileCount: 6,
      firstId: 4,
      lastId: 9,
      firstFrameId: 0,
      lastFrameId: 5,
    });
    expect(tiles.frame(4)).toMatchObject({
      coords: {
        x: 2,
        y: 2,
        width: 55,
        height: 61,
      },
    });
    expect(tiles.frame(5)).toMatchObject({
      coords: {
        x: 59,
        y: 2,
        width: 55,
        height: 61,
      },
    });
    expect(tiles.frame(8)).toMatchObject({
      coords: {
        x: 2,
        y: 128,
        width: 55,
        height: 61,
      },
    });
  });
});
