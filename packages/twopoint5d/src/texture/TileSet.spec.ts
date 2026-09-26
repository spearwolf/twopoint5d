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

  test('a fractional padding steps each tile by twice the padding', () => {
    const tiles = new TileSet(new TextureCoords(0, 0, 26, 26), {tileWidth: 10, tileHeight: 10, padding: 1.5});

    expect(tiles.tileCount).toBe(4);
    expect(tiles.frame(1).coords).toMatchObject({x: 1.5, y: 1.5, width: 10, height: 10});
    expect(tiles.frame(2).coords).toMatchObject({x: 14.5, y: 1.5, width: 10, height: 10});
    expect(tiles.frame(3).coords).toMatchObject({x: 1.5, y: 14.5, width: 10, height: 10});
    expect(tiles.frame(4).coords).toMatchObject({x: 14.5, y: 14.5, width: 10, height: 10});
  });

  test('a fractional padding lays out as many tiles as fit', () => {
    const tiles = new TileSet(new TextureCoords(0, 0, 100, 10), {tileWidth: 10, tileHeight: 10, padding: 1.5});

    expect(tiles.tileCount).toBe(7);
    expect(tiles.frame(tiles.lastId).coords.x).toBe(79.5);
  });

  describe('degenerate options', () => {
    const base = new TextureCoords(0, 0, 64, 64);

    test.each([
      ['a tileWidth of 0', {tileWidth: 0, tileHeight: 16, tileCount: 8}, /tileWidth/],
      ['a negative tileWidth', {tileWidth: -16, tileHeight: 16, tileCount: 8}, /tileWidth/],
      ['a tileHeight of 0', {tileWidth: 16, tileHeight: 0, tileCount: 8}, /tileHeight/],
      ['a tileWidth of NaN', {tileWidth: NaN, tileHeight: 16, tileCount: 8}, /tileWidth/],
      // the catalog json carries what it carries: a string would be concatenated, not added
      ['a tileWidth that is a string', {tileWidth: '16' as unknown as number, tileHeight: 16, tileCount: 8}, /tileWidth.*"16"/],
      ['a negative margin', {tileWidth: 16, tileHeight: 16, margin: -1}, /margin/],
      ['a negative padding', {tileWidth: 16, tileHeight: 16, padding: -1}, /padding/],
      ['a negative spacing', {tileWidth: 16, tileHeight: 16, spacing: -1}, /spacing/],
      ['a tileCount of 0', {tileWidth: 16, tileHeight: 16, tileCount: 0}, /tileCount/],
      ['a tileCount that is no whole number', {tileWidth: 16, tileHeight: 16, tileCount: 2.5}, /tileCount/],
    ])('%s is refused', (_name, options, message) => {
      expect(() => new TileSet(base, options)).toThrow(RangeError);
      expect(() => new TileSet(base, options)).toThrow(message);
    });

    test('a baseCoords width that is not finite is refused', () => {
      const options = {tileWidth: 16, tileHeight: 16, tileCount: 4};

      expect(() => new TileSet(new TextureCoords(0, 0, NaN, 64), options)).toThrow(RangeError);
      expect(() => new TileSet(new TextureCoords(0, 0, NaN, 64), options)).toThrow(/baseCoords\.width/);
    });

    // without a tileCount the layout loop has nothing but the step to end it
    test('a tileWidth of 0 without a tileCount is refused', () => {
      expect(() => new TileSet(base, {tileWidth: 0, tileHeight: 16})).toThrow(RangeError);
      expect(() => new TileSet(base, {tileWidth: 0, tileHeight: 16})).toThrow(/tileWidth must be a finite number above 0, got 0/);
    });

    test('a tileHeight of 0 without a tileCount is refused', () => {
      expect(() => new TileSet(base, {tileWidth: 16, tileHeight: 0})).toThrow(RangeError);
      expect(() => new TileSet(base, {tileWidth: 16, tileHeight: 0})).toThrow(
        /tileHeight must be a finite number above 0, got 0/,
      );
    });

    test('a baseCoords of 0 x 0 without options is refused', () => {
      expect(() => new TileSet(new TextureCoords(0, 0, 0, 0))).toThrow(RangeError);
      expect(() => new TileSet(new TextureCoords(0, 0, 0, 0))).toThrow(/tileWidth must be a finite number above 0, got 0/);
    });

    test('a tile wider than the image still ends the layout', () => {
      const tiles = new TileSet(base, {tileWidth: 100, tileHeight: 16});

      expect(tiles.tileCount).toBe(4);
      expect(tiles.frame(1).coords).toMatchObject({x: 0, y: 0, width: 100, height: 16});
      expect(tiles.frame(4).coords.y).toBe(48);
    });

    // the shape of the tile set of the textured-sprites demo of the lookbook: the tile does
    // not fit inside the margin, yet the first tile is always laid
    test('a single tile that does not fit inside the margin is laid all the same', () => {
      const tiles = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 256, tileHeight: 256, margin: 1});

      expect(tiles.tileCount).toBe(1);
      expect(tiles.frame(1).coords).toMatchObject({x: 1, y: 1});
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

  describe('TileSet refuses a firstId that is no whole number and accepts a negative one', () => {
    const base = new TextureCoords(0, 0, 64, 64);

    test.each([
      // the catalog json carries what it carries: a string would be concatenated, not added
      ['a string', '1' as unknown as number, '[TileSet] firstId must be a whole number, got "1"'],
      ['a fraction', 1.5, '[TileSet] firstId must be a whole number, got 1.5'],
      ['NaN', NaN, '[TileSet] firstId must be a whole number, got NaN'],
    ])('%s is refused', (_name, firstId, message) => {
      expect(() => new TileSet(base, {tileWidth: 16, tileHeight: 16, firstId})).toThrow(RangeError);
      expect(() => new TileSet(base, {tileWidth: 16, tileHeight: 16, firstId})).toThrow(message);
    });

    test('a negative firstId is accepted', () => {
      const tiles = new TileSet(base, {tileWidth: 16, tileHeight: 16, firstId: -3});

      expect(tiles.firstId).toBe(-3);
      expect(tiles.frameId(-3)).toBe(tiles.firstFrameId);
    });
  });
});
