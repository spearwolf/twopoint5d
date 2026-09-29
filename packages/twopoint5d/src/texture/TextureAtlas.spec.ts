import {afterEach, describe, expect, expectTypeOf, test, vi} from 'vitest';
import {FrameBasedAnimations} from './FrameBasedAnimations.js';
import {TextureAtlas, type TextureAtlasFrame} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import type {TexturePackerFrameData} from './TexturePackerJson.js';
import {TileSet} from './TileSet.js';

const Bar = Symbol('bar');
const NO_LONGER_BE_A_COINCIDENCE = 23;

describe('TextureAtlas', () => {
  test('construction', () => {
    const atlas = new TextureAtlas();
    expect(atlas).toBeDefined();
    expect(atlas.size).toBe(0);
  });
  describe('add', () => {
    test('with coords', () => {
      const atlas = new TextureAtlas();
      const texCoords = new TextureCoords();

      const frameId = atlas.add(texCoords);

      expect(frameId).toBeGreaterThanOrEqual(0);
      expect(atlas.get(frameId)!.coords).toBe(texCoords);
      expect(atlas.size).toBe(1);
    });
    test('with coords + data', () => {
      const atlas = new TextureAtlas<{foo?: number; bar?: number; abc?: string}>();
      const texCoords = new TextureCoords();

      const frameId = atlas.add(texCoords, {foo: 123, abc: 'xyz'});

      expect(frameId).toBeGreaterThanOrEqual(0);
      expect(atlas.get(frameId)).toMatchObject({
        coords: texCoords,
        data: {foo: 123, abc: 'xyz'},
      });
      expect(atlas.size).toBe(1);
    });
    test('with name + coords', () => {
      const atlas = new TextureAtlas();
      const texCoords0 = new TextureCoords();
      const texCoords1 = new TextureCoords();

      const frameId0 = atlas.add('foo', texCoords0);
      const frameId1 = atlas.add(Bar, texCoords1);

      expect(frameId0).toBeGreaterThanOrEqual(0);
      expect(frameId1).toBeGreaterThan(frameId0);

      expect(atlas.size).toBe(2);

      expect(atlas.get(frameId0)!.coords).toBe(texCoords0);
      expect(atlas.frame('foo')!.coords).toBe(texCoords0);
      expect(atlas.frameId('foo')).toBe(frameId0);

      expect(atlas.get(frameId0)!.coords).toBe(texCoords0);
      expect(atlas.frame(Bar)!.coords).toBe(texCoords1);
      expect(atlas.frameId(Bar)).toBe(frameId1);
    });
    test('with name + coords + data', () => {
      const atlas = new TextureAtlas<{foo?: number; bar?: number; abc?: string}>();
      const texCoords0 = new TextureCoords();
      const texCoords1 = new TextureCoords();

      const frameId0 = atlas.add('foo', texCoords0, {foo: 123});
      const frameId1 = atlas.add(Bar, texCoords1, {bar: 456});

      expect(frameId0).toBeGreaterThanOrEqual(0);
      expect(frameId1).toBeGreaterThan(frameId0);

      expect(atlas.size).toBe(2);

      expect(atlas.get(frameId0)).toMatchObject({
        coords: texCoords0,
        data: {foo: 123},
      });
      expect(atlas.frame('foo')).toMatchObject({
        coords: texCoords0,
        data: {foo: 123},
      });
      expect(atlas.frameId('foo')).toBe(frameId0);

      expect(atlas.get(frameId1)).toMatchObject({
        coords: texCoords1,
        data: {bar: 456},
      });
      expect(atlas.frame(Bar)).toMatchObject({
        coords: texCoords1,
        data: {bar: 456},
      });
      expect(atlas.frameId(Bar)).toBe(frameId1);
    });
    test('a name that is already taken is refused', () => {
      const atlas = new TextureAtlas();
      const texCoords0 = new TextureCoords();
      const texCoords1 = new TextureCoords();

      atlas.add('foo', texCoords0);

      expect(() => {
        atlas.add('foo', texCoords1);
      }).toThrow(/foo/);

      expect(atlas.size).toBe(1);
      expect(atlas.frame('foo')!.coords).toBe(texCoords0);
    });
  });
  describe('frameNames', () => {
    test('with regexp', () => {
      const atlas = new TextureAtlas();

      atlas.add('foo', new TextureCoords());
      atlas.add(Bar, new TextureCoords());
      atlas.add('img_001', new TextureCoords());
      atlas.add('img_002', new TextureCoords());

      const names = atlas.frameNames(/img_\d+/);

      expect(Array.isArray(names)).toBeTruthy();
      expect(names).toEqual(['img_001', 'img_002']);
    });
    test('with string', () => {
      const atlas = new TextureAtlas();

      atlas.add('foo', new TextureCoords());
      atlas.add(Bar, new TextureCoords());
      atlas.add('img_001', new TextureCoords());
      atlas.add('img_002', new TextureCoords());

      const names = atlas.frameNames('img.*');

      expect(Array.isArray(names)).toBeTruthy();
      expect(names).toEqual(['img_001', 'img_002']);

      expect(atlas.frameNames('foo')).toMatchObject(['foo']);
      expect(atlas.frameNames('f..')).toMatchObject(['foo']);
      expect(atlas.frameNames('img_002')).toMatchObject(['img_002']);
      expect(atlas.frameNames('xxx')).toMatchObject([]);
    });
    test('will not find symbols', () => {
      const atlas = new TextureAtlas();

      atlas.add('foo', new TextureCoords());
      atlas.add(Bar, new TextureCoords());
      atlas.add('img_001', new TextureCoords());
      atlas.add('img_002', new TextureCoords());

      const names = atlas.frameNames(Bar.toString());

      expect(Array.isArray(names)).toBeTruthy();
      expect(names).toHaveLength(0);
    });
    test('without argument', () => {
      const atlas = new TextureAtlas();

      atlas.add('foo', new TextureCoords());
      atlas.add(Bar, new TextureCoords());
      atlas.add('img_001', new TextureCoords());
      atlas.add('img_002', new TextureCoords());

      const names = atlas.frameNames();

      expect(Array.isArray(names)).toBeTruthy();
      expect(names).toEqual(['foo', Bar, 'img_001', 'img_002']);
    });
    describe('a RegExp with the g or the y flag', () => {
      const walkAtlas = () => {
        const atlas = new TextureAtlas();
        for (const name of ['walk.1', 'walk.2', 'walk.3', 'walk.4']) atlas.add(name, new TextureCoords());
        return atlas;
      };

      test('with g, every name is tested from its start', () => {
        const atlas = walkAtlas();
        const regex = /walk/g;

        expect(atlas.frameNames(regex)).toEqual(['walk.1', 'walk.2', 'walk.3', 'walk.4']);
        // the same RegExp object a second time
        expect(atlas.frameNames(regex)).toEqual(['walk.1', 'walk.2', 'walk.3', 'walk.4']);
      });

      test('the RegExp handed in keeps its lastIndex', () => {
        const atlas = walkAtlas();
        const regex = /walk/g;
        regex.lastIndex = 3;

        atlas.frameNames(regex);

        expect(regex.lastIndex).toBe(3);
      });

      test('with y, a name matches only where the match begins at its start', () => {
        const atlas = new TextureAtlas();
        atlas.add('walk.1', new TextureCoords());
        atlas.add('mywalk.1', new TextureCoords());
        atlas.add('walk.2', new TextureCoords());

        expect(atlas.frameNames(/walk/y)).toEqual(['walk.1', 'walk.2']);
      });
    });
  });
  test('randomFrameId', () => {
    const atlas = new TextureAtlas();

    const frameIds = [
      atlas.add('foo', new TextureCoords()),
      atlas.add(Bar, new TextureCoords()),
      atlas.add('img_001', new TextureCoords()),
      atlas.add('img_002', new TextureCoords()),
    ];

    for (let i = 0; i < NO_LONGER_BE_A_COINCIDENCE; i++) {
      expect(frameIds.includes(atlas.randomFrameId())).toBeTruthy();
    }
  });
  test('randomFrame', () => {
    const atlas = new TextureAtlas();

    atlas.add('foo', new TextureCoords());
    atlas.add(Bar, new TextureCoords());
    atlas.add('img_001', new TextureCoords());
    atlas.add('img_002', new TextureCoords());

    for (let i = 0; i < NO_LONGER_BE_A_COINCIDENCE; i++) {
      expect(atlas.randomFrame()).toHaveProperty('coords');
    }
  });
  test('randomFrameName', () => {
    const atlas = new TextureAtlas();

    atlas.add('foo', new TextureCoords());
    atlas.add(Bar, new TextureCoords());
    atlas.add('img_001', new TextureCoords());
    atlas.add('img_002', new TextureCoords());

    for (let i = 0; i < NO_LONGER_BE_A_COINCIDENCE; i++) {
      expect(atlas.frameNames().includes(atlas.randomFrameName()!)).toBeTruthy();
    }
  });
  test('randomFrameIds', () => {
    const atlas = new TextureAtlas();

    atlas.add(new TextureCoords());
    atlas.add(new TextureCoords());
    atlas.add(new TextureCoords());

    const frameIds = atlas.randomFrameIds(20);

    expect(frameIds).toHaveLength(20);
    expect(typeof frameIds[0] === 'number').toBeTruthy();
  });
  test('randomFrames', () => {
    const atlas = new TextureAtlas();

    atlas.add(new TextureCoords());
    atlas.add(new TextureCoords());
    atlas.add(new TextureCoords());

    const frames = atlas.randomFrames(20);

    expect(frames).toHaveLength(20);
    expect(frames[0]!.coords).toBeInstanceOf(TextureCoords);
  });
  test('randomFrameNames', () => {
    const atlas = new TextureAtlas();

    atlas.add('foo', new TextureCoords());
    atlas.add('bar', new TextureCoords());
    atlas.add('img_001', new TextureCoords());
    atlas.add('img_002', new TextureCoords());

    const names = atlas.randomFrameNames(20);

    expect(names).toHaveLength(20);
    expect(typeof names[0] === 'string').toBeTruthy();
  });

  describe('index boundaries', () => {
    test('get(), frame() and frameId() at and past the edges', () => {
      const atlas = new TextureAtlas();
      atlas.add('first', new TextureCoords());
      atlas.add(new TextureCoords());
      const lastFrameId = atlas.add('last', new TextureCoords());

      expect(atlas.size).toBe(3);

      expect(atlas.get(-1)).toBeUndefined();
      expect(atlas.get(0)!.coords).toBeInstanceOf(TextureCoords);
      expect(atlas.get(lastFrameId)!.coords).toBeInstanceOf(TextureCoords);
      expect(atlas.get(3)).toBeUndefined();

      expect(atlas.frameId('first')).toBe(0);
      expect(atlas.frameId('not-assigned')).toBeUndefined();
      expect(atlas.frame('not-assigned')).toBeUndefined();
    });
  });

  describe('randomFrameName() draws a name by its index', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('the name at the index the draw lands on, in the order the names were added', () => {
      const atlas = new TextureAtlas();
      atlas.add('foo', new TextureCoords());
      atlas.add(new TextureCoords());
      atlas.add(Bar, new TextureCoords());
      atlas.add('img_001', new TextureCoords());

      const random = vi.spyOn(Math, 'random');

      // three names, so a draw of 0.4 lands on index 1 and one of 0.9 on index 2
      random.mockReturnValue(0);
      expect(atlas.randomFrameName()).toBe('foo');
      random.mockReturnValue(0.4);
      expect(atlas.randomFrameName()).toBe(Bar);
      random.mockReturnValue(0.9);
      expect(atlas.randomFrameName()).toBe('img_001');
    });

    test('an atlas without named frames has no name to draw', () => {
      const atlas = new TextureAtlas();
      atlas.add(new TextureCoords());

      expect(atlas.randomFrameName()).toBeUndefined();
    });

    test('a change to the array frameNames() answers leaves the atlas alone', () => {
      const atlas = new TextureAtlas();
      atlas.add('foo', new TextureCoords());
      atlas.add('bar', new TextureCoords());

      const names = atlas.frameNames();
      names.length = 0;
      names.push('baz');

      expect(atlas.frameNames()).toEqual(['foo', 'bar']);
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(atlas.randomFrameName()).toBe('foo');
    });
  });

  describe('the type of the frame data', () => {
    test('an atlas that names no type carries the entry of a TexturePacker json', () => {
      const atlas = new TextureAtlas();

      expectTypeOf(atlas.get(0)).toEqualTypeOf<TextureAtlasFrame<TexturePackerFrameData> | undefined>();
      // @ts-expect-error — data of another shape needs an atlas that names its type
      atlas.add('a', new TextureCoords(), {foo: 1});
    });

    test('an atlas that names a type of its own carries that type', () => {
      const atlas = new TextureAtlas<{foo: number}>();
      atlas.add('a', new TextureCoords(0, 0, 4, 4), {foo: 1});

      expectTypeOf(atlas.get(0)?.data).toEqualTypeOf<{foo: number} | undefined>();
      expect(atlas.get(0)?.data).toEqual({foo: 1});

      const tileSet = new TileSet(atlas, new TextureCoords(0, 0, 4, 4), {tileWidth: 1, tileHeight: 1});
      expectTypeOf(tileSet.frame(1).data).toEqualTypeOf<{foo: number} | undefined>();
    });

    test('an atlas that names a type of its own goes into FrameBasedAnimations#add()', () => {
      const atlas = new TextureAtlas<{foo: number}>();
      atlas.add('walk.1', new TextureCoords(0, 0, 4, 4), {foo: 1});

      expect(new FrameBasedAnimations().add('walk', 1, atlas, 'walk')).toBe(0);
    });
  });

  describe('empty atlas', () => {
    test('has no frames and no random frame', () => {
      const atlas = new TextureAtlas();

      expect(atlas.size).toBe(0);
      expect(atlas.get(0)).toBeUndefined();
      expect(atlas.randomFrame()).toBeUndefined();
      expect(atlas.randomFrameName()).toBeUndefined();
      expect(atlas.randomFrames(2)).toEqual([undefined, undefined]);
      expect(atlas.randomFrameNames(2)).toEqual([undefined, undefined]);
    });
  });
});
