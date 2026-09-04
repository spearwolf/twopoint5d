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

  describe('frameId() wrap-around arithmetic', () => {
    const tiles = new TileSet(new TextureCoords(0, 0, 128, 256), {
      margin: 1,
      padding: 1,
      tileWidth: 55,
      tileHeight: 61,
      tileCount: 6,
      firstId: 4,
    });

    // frameId() computes ((((tileId - firstId) % tileCount) + tileCount) % tileCount) +
    // firstFrameId — the double modulo exists because `%` in JavaScript keeps the sign
    // of the dividend, which only the "darunter" (below firstId) rows below exercise.
    test.each([
      // within [firstId, lastId]
      [4, 0],
      [5, 1],
      [6, 2],
      [7, 3],
      [8, 4],
      [9, 5],
      // above lastId, wraps forward
      [10, 0],
      [11, 1],
      [15, 5],
      [16, 0],
      // below firstId, wraps backward
      [3, 5],
      [2, 4],
      [1, 3],
      [0, 2],
      [-1, 1],
      [-2, 0],
      [-3, 5],
    ])('frameId(%i) -> %i', (tileId, expectedFrameId) => {
      expect(tiles.frameId(tileId)).toBe(expectedFrameId);
    });
  });
});
