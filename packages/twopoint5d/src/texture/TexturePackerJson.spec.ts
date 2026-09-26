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
});
