import {describe, expect, test} from 'vitest';
import {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {TexturePackerJson, type TexturePackerJsonData} from './TexturePackerJson.js';

const makeData = (): TexturePackerJsonData => ({
  frames: {a: {frame: {x: 0, y: 0, w: 8, h: 8}}, b: {frame: {x: 8, y: 0, w: 8, h: 16}}},
  meta: {image: 'a.png', size: {w: 16, h: 16}},
});

describe('TexturePackerJson.parse()', () => {
  test('every frame is registered under its name', () => {
    const [atlas] = TexturePackerJson.parse(makeData());

    expect(atlas.frameNames()).toEqual(['a', 'b']);
  });

  test('without parentCoords the frames lie inside the size the meta names', () => {
    const [atlas] = TexturePackerJson.parse(makeData());

    const coords = atlas.frame('b')!.coords;

    expect(coords).toMatchObject({x: 8, y: 0, width: 8, height: 16});
    expect(coords.parent).toMatchObject({width: 16, height: 16});
    expect(coords).toMatchObject({s: 0.5, t: 0, u: 0.5, v: 1});
  });

  test('with parentCoords the frames lie inside those coordinates', () => {
    const parentCoords = new TextureCoords(0, 0, 32, 32);

    const [atlas] = TexturePackerJson.parse(makeData(), parentCoords);

    const coords = atlas.frame('b')!.coords;

    expect(coords.parent).toBe(parentCoords);
    expect(coords.s).toBe(0.25);
    expect(coords.u).toBe(0.25);
    expect(coords.v).toBe(0.5);
  });

  test('a target atlas is filled and returned', () => {
    const target = new TextureAtlas();
    target.add('x', new TextureCoords(0, 0, 4, 4));

    const [atlas] = TexturePackerJson.parse(makeData(), undefined, target);

    expect(atlas).toBe(target);
    expect(atlas.frameNames()).toEqual(['x', 'a', 'b']);
  });

  test('the meta comes back as it was given', () => {
    const data = makeData();

    const [, meta] = TexturePackerJson.parse(data);

    expect(meta).toBe(data.meta);
  });
  test('a JSON Array registers every frame under its filename', () => {
    const [atlas] = TexturePackerJson.parse({
      frames: [
        {filename: 'walk_01.png', frame: {x: 0, y: 0, w: 8, h: 8}},
        {filename: 'walk_02.png', frame: {x: 8, y: 0, w: 8, h: 8}},
      ],
      meta: {image: 'a.png', size: {w: 16, h: 16}},
    });

    expect(atlas.frameNames()).toEqual(['walk_01.png', 'walk_02.png']);
  });

  describe('a rotated frame', () => {
    const makeRotated = (): TexturePackerJsonData => ({
      frames: {r: {frame: {x: 16, y: 32, w: 64, h: 32}, rotated: true}},
      meta: {image: 'a.png', size: {w: 128, h: 256}},
    });

    // the lookup of a shader: the quad position (a, b) reads (s + a·u, t + b·v), the two components swap under flipD
    const lookup = (coords: TextureCoords, a: number, b: number): [number, number] => {
      const p: [number, number] = [coords.s + a * coords.u, coords.t + b * coords.v];
      return coords.flipD ? [p[1], p[0]] : p;
    };

    test('a rotated frame spans the area it takes in the sheet and turns back by a diagonal and a vertical flip', () => {
      const [atlas] = TexturePackerJson.parse(makeRotated());

      const coords = atlas.frame('r')!.coords;

      expect(coords).toMatchObject({x: 16, y: 32, width: 32, height: 64});
      expect(coords.flip).toBe(TextureCoords.FLIP_DIAGONAL | TextureCoords.FLIP_VERTICAL);
      expect(coords.s).toBe(0.125);
      expect(coords.t).toBe(0.375);
      expect(coords.u).toBe(0.25);
      expect(coords.v).toBe(-0.25);
    });

    test('the corners of a rotated frame come out of the sheet turned back by 90°', () => {
      const [atlas] = TexturePackerJson.parse(makeRotated());

      const coords = atlas.frame('r')!.coords;

      expect(lookup(coords, 0, 0)).toEqual([0.375, 0.125]);
      expect(lookup(coords, 1, 0)).toEqual([0.375, 0.375]);
      expect(lookup(coords, 1, 1)).toEqual([0.125, 0.375]);
      expect(lookup(coords, 0, 1)).toEqual([0.125, 0.125]);
    });

    test('a frame with rotated false is laid as it stands', () => {
      const data = makeRotated();
      data.frames = {r: {frame: {x: 16, y: 32, w: 64, h: 32}, rotated: false}};

      const [atlas] = TexturePackerJson.parse(data);

      expect(atlas.frame('r')!.coords).toMatchObject({x: 16, y: 32, width: 64, height: 32, flip: 0});
    });
  });

  test('a json that names a frame twice is refused and leaves the target atlas as it was', () => {
    const target = new TextureAtlas();
    target.add('x', new TextureCoords(0, 0, 4, 4));
    const data: TexturePackerJsonData = {
      frames: [
        {filename: 'dup.png', frame: {x: 0, y: 0, w: 8, h: 8}},
        {filename: 'dup.png', frame: {x: 8, y: 0, w: 8, h: 8}},
      ],
      meta: {image: 'a.png', size: {w: 16, h: 16}},
    };

    expect(() => TexturePackerJson.parse(data, undefined, target)).toThrow(
      'TexturePackerJson: the frame name "dup.png" appears more than once in the json',
    );
    expect(target.frameNames()).toEqual(['x']);
  });

  test('a frame name the target atlas already holds is refused before any frame is added', () => {
    const target = new TextureAtlas();
    target.add('b', new TextureCoords(0, 0, 4, 4));

    expect(() => TexturePackerJson.parse(makeData(), undefined, target)).toThrow(
      'TexturePackerJson: the frame name "b" is already taken in the target atlas',
    );
    expect(target.frameNames()).toEqual(['b']);
  });
});
