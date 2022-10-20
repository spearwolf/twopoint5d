import {TextureAtlas} from './TextureAtlas';
import {TextureCoords} from './TextureCoords';

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
      expect(atlas.get(frameId).coords).toBe(texCoords);
      expect(atlas.size).toBe(1);
    });
    test('with coords + data', () => {
      const atlas = new TextureAtlas();
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

      expect(atlas.get(frameId0).coords).toBe(texCoords0);
      expect(atlas.frame('foo').coords).toBe(texCoords0);
      expect(atlas.frameId('foo')).toBe(frameId0);

      expect(atlas.get(frameId0).coords).toBe(texCoords0);
      expect(atlas.frame(Bar).coords).toBe(texCoords1);
      expect(atlas.frameId(Bar)).toBe(frameId1);
    });
    test('with name + coords + data', () => {
      const atlas = new TextureAtlas();
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
      expect(names).toEqual(expect.arrayContaining(['img_001', 'img_002']));
      expect(names).toEqual(expect.not.arrayContaining(['foo', Bar]));
    });
    test('with string', () => {
      const atlas = new TextureAtlas();

      atlas.add('foo', new TextureCoords());
      atlas.add(Bar, new TextureCoords());
      atlas.add('img_001', new TextureCoords());
      atlas.add('img_002', new TextureCoords());

      const names = atlas.frameNames('img.*');

      expect(Array.isArray(names)).toBeTruthy();
      expect(names).toEqual(expect.arrayContaining(['img_001', 'img_002']));
      expect(names).toEqual(expect.not.arrayContaining(['foo', Bar]));

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
      expect(names).toEqual(expect.arrayContaining(['foo', Bar, 'img_001', 'img_002']));
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
      expect(atlas.frameNames().includes(atlas.randomFrameName())).toBeTruthy();
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
    expect(frames[0].coords).toBeInstanceOf(TextureCoords);
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
});
