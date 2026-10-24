import {describe, expect, expectTypeOf, test} from 'vitest';
import {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {type TexturePackerFrameData, TexturePackerJson, type TexturePackerJsonData} from './TexturePackerJson.js';

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

  describe('a trimmed frame carries its entry of the json as data, spriteSourceSize and sourceSize among it', () => {
    const trimmed = {
      frame: {x: 4, y: 2, w: 6, h: 7},
      rotated: false,
      trimmed: true,
      spriteSourceSize: {x: 1, y: 3, w: 6, h: 7},
      sourceSize: {w: 8, h: 12},
    };
    const meta = {image: 'a.png', size: {w: 16, h: 16}};

    test('JSON Hash', () => {
      const [atlas] = TexturePackerJson.parse({frames: {walk: trimmed}, meta});

      const {data, coords} = atlas.frame('walk')!;

      expect(data).toBe(trimmed);
      expect(data).toMatchObject({trimmed: true, spriteSourceSize: {x: 1, y: 3, w: 6, h: 7}, sourceSize: {w: 8, h: 12}});
      expect(coords).toMatchObject({x: 4, y: 2, width: 6, height: 7});
    });

    test('JSON Array', () => {
      const entry = {...trimmed, filename: 'walk.png'};

      const [atlas] = TexturePackerJson.parse({frames: [entry], meta});

      const {data} = atlas.frame('walk.png')!;

      expect(data).toBe(entry);
      expect(data).toMatchObject({
        filename: 'walk.png',
        trimmed: true,
        spriteSourceSize: {x: 1, y: 3, w: 6, h: 7},
        sourceSize: {w: 8, h: 12},
      });
    });
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

  test('refuses a "JSON Array" frame without a filename, naming its index, and leaves the target as it was', () => {
    const target = new TextureAtlas();
    target.add('x', new TextureCoords(0, 0, 4, 4));
    const data = {
      frames: [{filename: 'a.png', frame: {x: 0, y: 0, w: 8, h: 8}}, {frame: {x: 8, y: 0, w: 8, h: 8}}],
      meta: {image: 'a.png', size: {w: 16, h: 16}},
    } as unknown as TexturePackerJsonData;

    expect(() => TexturePackerJson.parse(data, undefined, target)).toThrow(
      new TypeError(
        'TexturePackerJson: the frame 1 of the "JSON Array" frames has a filename of undefined — a frame of that format is named by its filename, a string',
      ),
    );
    expect(target.frameNames()).toEqual(['x']);
  });

  test('takes an empty filename as a name, as an empty key of the "JSON Hash" format', () => {
    const [atlas] = TexturePackerJson.parse({
      frames: [{filename: '', frame: {x: 0, y: 0, w: 8, h: 8}}],
      meta: {image: 'a.png', size: {w: 16, h: 16}},
    });

    expect(atlas.frameNames()).toEqual(['']);
  });

  test('refuses a frame without its area with a TypeError naming it, and leaves the target as it was', () => {
    const target = new TextureAtlas();
    target.add('x', new TextureCoords(0, 0, 4, 4));
    const data = {
      frames: {a: {frame: {x: 0, y: 0, w: 8, h: 8}}, b: {}},
      meta: {image: 'a.png', size: {w: 16, h: 16}},
    } as unknown as TexturePackerJsonData;

    expect(() => TexturePackerJson.parse(data, undefined, target)).toThrow(
      new TypeError(
        'TexturePackerJson: the frame "b" has a frame of undefined — its area in the image is an object {x, y, w, h}',
      ),
    );
    expect(target.frameNames()).toEqual(['x']);
  });

  test.each([
    ['x', NaN, 'TexturePackerJson: the x of the frame "b" must be a finite number, got NaN'],
    ['w', -1, 'TexturePackerJson: the w of the frame "b" must be a finite number of 0 or more, got -1'],
    ['h', Infinity, 'TexturePackerJson: the h of the frame "b" must be a finite number, got Infinity'],
    ['y', '4', 'TexturePackerJson: the y of the frame "b" must be a finite number, got "4"'],
  ])(
    'refuses a measure of a frame that is no finite number of 0 or more with a RangeError naming the frame and the field (%s: %s)',
    (key, value, message) => {
      const target = new TextureAtlas();
      const data = {
        frames: {a: {frame: {x: 0, y: 0, w: 8, h: 8}}, b: {frame: {x: 8, y: 0, w: 8, h: 8, [key]: value}}},
        meta: {image: 'a.png', size: {w: 16, h: 16}},
      } as unknown as TexturePackerJsonData;

      expect(() => TexturePackerJson.parse(data, undefined, target)).toThrow(new RangeError(message));
      expect(target.frameNames()).toEqual([]);
    },
  );

  test('refuses an entry that is no object', () => {
    const hash = {frames: {a: null}, meta: {image: 'a.png', size: {w: 16, h: 16}}} as unknown as TexturePackerJsonData;
    const array = {frames: [null], meta: {image: 'a.png', size: {w: 16, h: 16}}} as unknown as TexturePackerJsonData;

    expect(() => TexturePackerJson.parse(hash)).toThrow(
      new TypeError('TexturePackerJson: the frame "a" is null — a frame of the json is an object'),
    );
    expect(() => TexturePackerJson.parse(array)).toThrow(
      new TypeError('TexturePackerJson: the frame 0 of the "JSON Array" frames is null — a frame of the json is an object'),
    );
  });

  test('without parentCoords, refuses a meta.size without an area above 0', () => {
    const withMeta = (meta: unknown) =>
      ({frames: {a: {frame: {x: 0, y: 0, w: 8, h: 8}}}, meta}) as unknown as TexturePackerJsonData;

    expect(() => TexturePackerJson.parse(withMeta({image: 'a.png', size: {w: 0, h: 16}}))).toThrow(
      new RangeError('TexturePackerJson: the w of meta.size must be a finite number above 0, got 0'),
    );
    expect(() => TexturePackerJson.parse(withMeta({image: 'a.png', size: {w: NaN, h: 16}}))).toThrow(
      new RangeError('TexturePackerJson: the w of meta.size must be a finite number above 0, got NaN'),
    );
    expect(() => TexturePackerJson.parse(withMeta({image: 'a.png'}))).toThrow(
      new TypeError(
        'TexturePackerJson: the json has a meta.size of undefined — without parentCoords the frames are laid out in meta.size, an object {w, h}',
      ),
    );
  });

  test('takes a frame of no area', () => {
    const [atlas] = TexturePackerJson.parse({
      frames: {empty: {frame: {x: 4, y: 4, w: 0, h: 8}}},
      meta: {image: 'a.png', size: {w: 16, h: 16}},
    });

    expect(atlas.frame('empty')!.coords).toMatchObject({x: 4, y: 4, width: 0, height: 8});
  });

  test.each([undefined, null, 'x', 3])('refuses a json that is %j with a TypeError', (data) => {
    const target = new TextureAtlas();
    expect(() => TexturePackerJson.parse(data as never, new TextureCoords(0, 0, 8, 8), target)).toThrow(
      new TypeError(
        `TexturePackerJson: the json is ${data === undefined ? 'undefined' : JSON.stringify(data)} — a texture atlas json is an object {frames, meta}`,
      ),
    );
    expect(target.size).toBe(0);
  });

  test.each([undefined, null, 'x', 3])('refuses frames that are %j with a TypeError', (frames) => {
    const data = {frames, meta: {image: 'a.png', size: {w: 16, h: 16}}} as never;
    expect(() => TexturePackerJson.parse(data)).toThrow(
      new TypeError(
        `TexturePackerJson: the json has frames of ${frames === undefined ? 'undefined' : JSON.stringify(frames)} — the frames are an object ("JSON Hash") or a list ("JSON Array")`,
      ),
    );
  });

  test('takes a meta.size it does not read when parentCoords are given', () => {
    const data = {
      frames: {a: {frame: {x: 0, y: 0, w: 8, h: 8}}},
      meta: {image: 'a.png', size: {w: 0, h: NaN}},
    } as unknown as TexturePackerJsonData;

    const [atlas] = TexturePackerJson.parse(data, new TextureCoords(0, 0, 32, 32));

    expect(atlas.frameNames()).toEqual(['a']);
  });
});

describe('the type of the frame data', () => {
  test('a TexturePacker json answers an atlas of TexturePackerFrameData', () => {
    expectTypeOf(TexturePackerJson.parse(makeData())[0]).toEqualTypeOf<TextureAtlas<TexturePackerFrameData>>();
  });

  test('frames that carry more than TexturePacker writes keep their type in the atlas and the target', () => {
    type TimedFrameData = TexturePackerFrameData & {duration: number};
    const frames: Record<string, TimedFrameData> = {a: {frame: {x: 0, y: 0, w: 8, h: 8}, duration: 120}};

    const [atlas] = TexturePackerJson.parse(
      {frames, meta: {image: 'a.png', size: {w: 16, h: 16}}},
      undefined,
      new TextureAtlas<TimedFrameData>(),
    );

    expectTypeOf(atlas).toEqualTypeOf<TextureAtlas<TimedFrameData>>();
    expect(atlas.frame('a')!.data!.duration).toBe(120);
  });
});
