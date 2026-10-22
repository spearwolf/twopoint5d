import type {WebGPURenderer} from 'three/webgpu';
import {describe, expect, test} from 'vitest';
import {FrameBasedAnimations} from './FrameBasedAnimations.js';
import {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {TexturePackerJson} from './TexturePackerJson.js';
import {TileSet} from './TileSet.js';

const AnimSymbol = Symbol('anim');

describe('FrameBasedAnimations', () => {
  describe('construction', () => {
    test('create instance', () => {
      const animations = new FrameBasedAnimations();
      expect(animations).toBeDefined();
      expect(animations).toBeInstanceOf(FrameBasedAnimations);
    });
  });

  describe('add with TextureCoords array', () => {
    test('add animation with name and TextureCoords array', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32), new TextureCoords(32, 0, 32, 32), new TextureCoords(64, 0, 32, 32)];

      const id = animations.add('walk', 1.0, frames);

      expect(id).toBe(0);
      expect(animations.animId('walk')).toBe(0);
    });

    test('an animation added without a name gets one it can be found under', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32), new TextureCoords(32, 0, 32, 32)];

      const id = animations.add(undefined, 0.5, frames);

      expect(id).toBe(0);
      expect(animations.hasAnimation('anim_0')).toBe(true);
      expect(animations.animId('anim_0')).toBe(0);
    });

    test('an animation added with the empty string as its name gets a name of the counter', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32), new TextureCoords(32, 0, 32, 32)];

      const id = animations.add('', 0.5, frames);

      expect(animations.hasAnimation('anim_0')).toBe(true);
      expect(animations.animId('anim_0')).toBe(id);
      expect(animations.hasAnimation('')).toBe(false);
    });

    test('a refusal of an animation with the empty string as its name calls it (no name)', () => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.add('', 1, [])).toThrow('`(no name)`');
    });

    test('a second animation without a name gets the next name of the counter', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      animations.add(undefined, 1.0, frames);
      const id = animations.add(undefined, 1.0, frames);

      expect(id).toBe(1);
      expect(animations.animId('anim_0')).toBe(0);
      expect(animations.animId('anim_1')).toBe(1);
    });

    test('a name the caller already took is stepped over, not overwritten', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      const taken = animations.add('anim_0', 1.0, frames);
      const auto = animations.add(undefined, 1.0, frames);

      expect(animations.animId('anim_0')).toBe(taken);
      expect(animations.animId('anim_1')).toBe(auto);
    });

    test('an add that throws spends no name of the counter', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      expect(() => animations.add(undefined, {frameRate: 0}, frames)).toThrow(
        /got a frameRate of 0 for the animation `\(no name\)`/,
      );

      const id = animations.add(undefined, 1.0, frames);

      expect(id).toBe(0);
      expect(animations.animId('anim_0')).toBe(id);
    });

    test('an empty frame list is refused', () => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.add('empty', 1.0, [])).toThrow(/no frames/);
      expect(animations.hasAnimation('empty')).toBe(false);
    });

    test('a duration that is negative or no finite number is refused', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      expect(() => animations.add('negative', -1, frames), 'a negative duration').toThrow(/-1/);
      expect(() => animations.add('not-a-number', {frameRate: NaN}, frames), 'a frameRate of NaN').toThrow(
        /got a frameRate of NaN for the animation `not-a-number`/,
      );
      expect(() => animations.add('endless', Infinity, frames), 'a duration of Infinity').toThrow(/Infinity/);

      expect(animations.hasAnimation('negative')).toBe(false);
      expect(animations.hasAnimation('not-a-number')).toBe(false);
      expect(animations.hasAnimation('endless')).toBe(false);
    });

    test.each([
      ['duration', {duration: '1'}, /got a duration of "1" for the animation `text`/],
      ['frameRate', {frameRate: '4'}, /got a frameRate of "4" for the animation `text`/],
    ] as const)('a %s that is a string is quoted in the message', (_field, timing, message) => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      expect(() => animations.add('text', timing as never, frames)).toThrow(message);
      expect(animations.hasAnimation('text')).toBe(false);
    });

    test('timing without a duration and without a frameRate names the animation', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      expect(() => animations.add('bare', {} as never, frames)).toThrow(
        /got neither a duration nor a frameRate for the animation `bare`/,
      );
    });

    test('an add refused for its frames spends no name of the counter', () => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.add(undefined, 1.0, [])).toThrow(/no frames/);

      const id = animations.add(undefined, 1.0, [new TextureCoords(0, 0, 32, 32)]);

      expect(id).toBe(0);
      expect(animations.animId('anim_0')).toBe(id);
    });

    test('add animation with symbol name', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      const id = animations.add(AnimSymbol, 2.0, frames);

      expect(id).toBe(0);
      expect(animations.animId(AnimSymbol)).toBe(0);
    });

    test('add multiple animations', () => {
      const animations = new FrameBasedAnimations();

      const id0 = animations.add('idle', 1.0, [new TextureCoords(0, 0, 32, 32)]);
      const id1 = animations.add('walk', 0.5, [new TextureCoords(32, 0, 32, 32), new TextureCoords(64, 0, 32, 32)]);
      const id2 = animations.add('run', 0.3, [
        new TextureCoords(0, 32, 32, 32),
        new TextureCoords(32, 32, 32, 32),
        new TextureCoords(64, 32, 32, 32),
      ]);

      expect(id0).toBe(0);
      expect(id1).toBe(1);
      expect(id2).toBe(2);
      expect(animations.animId('idle')).toBe(0);
      expect(animations.animId('walk')).toBe(1);
      expect(animations.animId('run')).toBe(2);
    });

    test('a name that another animation already carries is refused with the name', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      animations.add('walk', 1.0, frames);

      expect(() => {
        animations.add('walk', 1.0, frames);
      }).toThrow(
        'FrameBasedAnimations: add() got the name `walk`, which another animation already carries — an animation name must be unique',
      );
    });

    test('an array of frames is copied: emptying it after add() leaves the animation its frames', () => {
      const animations = new FrameBasedAnimations();
      const first = new TextureCoords(0, 0, 32, 32);
      const second = new TextureCoords(32, 0, 32, 32);
      const frames = [first, second];

      animations.add('walk', 1, frames);
      frames.length = 0;

      const buffer = animations.bakeDataTexture().image.data as Float32Array;
      const texelAt = (index: number) => Array.from(buffer.subarray(index * 4, index * 4 + 4));

      expect(texelAt(0), 'the header: frame count, duration, first frame texel, texels per frame').toEqual([2, 1, 1, 1]);
      expect(texelAt(1), 'the first frame').toEqual(Array.from(new Float32Array(first.getTexCoords())));
      expect(texelAt(2), 'the second frame').toEqual(Array.from(new Float32Array(second.getTexCoords())));
    });

    test.each([
      [5, '5'],
      ['frames', '"frames"'],
      [{}, '{}'],
    ] as const)(
      'a third argument of %s that is no TextureAtlas, no TileSet and no array is refused with the value and the animation',
      (value, described) => {
        const animations = new FrameBasedAnimations();

        expect(() => {
          animations.add('odd', 1, value as never);
        }).toThrow(
          `FrameBasedAnimations: add() got a third argument of ${described} for the animation \`odd\` — the third argument is a TextureAtlas, a TileSet or an array of frames`,
        );
        expect(animations.hasAnimation('odd')).toBe(false);
      },
    );
  });

  describe('add with TextureAtlas', () => {
    test('add animation from TextureAtlas with frameNameQuery', () => {
      const animations = new FrameBasedAnimations();
      const atlas = new TextureAtlas();

      atlas.add('sprite_001', new TextureCoords(0, 0, 32, 32));
      atlas.add('sprite_002', new TextureCoords(32, 0, 32, 32));
      atlas.add('sprite_003', new TextureCoords(64, 0, 32, 32));
      atlas.add('other_001', new TextureCoords(0, 32, 32, 32));

      const id = animations.add('walk', 1.0, atlas, 'sprite_.*');

      expect(id).toBe(0);
      expect(animations.animId('walk')).toBe(0);
    });

    test('add animation from TextureAtlas without frameNameQuery', () => {
      const animations = new FrameBasedAnimations();
      const atlas = new TextureAtlas();

      atlas.add('frame_001', new TextureCoords(0, 0, 32, 32));
      atlas.add('frame_002', new TextureCoords(32, 0, 32, 32));

      const id = animations.add('all', 1.0, atlas);

      expect(id).toBe(0);
      expect(animations.animId('all')).toBe(0);
    });

    test('a frame registered under a symbol stays out of the animation', () => {
      const animations = new FrameBasedAnimations();
      const atlas = new TextureAtlas();

      atlas.add('frame_001', new TextureCoords(0, 0, 32, 32));
      atlas.add(AnimSymbol, new TextureCoords(32, 0, 32, 32));
      atlas.add('frame_002', new TextureCoords(64, 0, 32, 32));

      const id = animations.add('all', 1.0, atlas);

      expect(id).toBe(0);

      const buffer = animations.bakeDataTexture().image.data as Float32Array;
      expect(buffer[0]).toBe(2); // frames.length
    });

    test('frame names carrying a number are ordered by that number', () => {
      const animations = new FrameBasedAnimations();
      const atlas = new TextureAtlas();

      // a parent is what gives the three frames distinguishable texture coordinates: without
      // one, `s` is measured against nothing and every frame answers 0
      const sheet = new TextureCoords(0, 0, 128, 32);
      const first = new TextureCoords(sheet, 0, 0, 32, 32);
      const second = new TextureCoords(sheet, 32, 0, 32, 32);
      const tenth = new TextureCoords(sheet, 64, 0, 32, 32);

      // added out of order, so a comparator that keeps the insertion order cannot pass
      atlas.add('walk.10', tenth);
      atlas.add('walk.1', first);
      atlas.add('walk.2', second);

      animations.add('walk', 1.0, atlas, 'walk\\..*');

      const buffer = animations.bakeDataTexture().image.data as Float32Array;
      const frameOffset = buffer[2]! * 4;
      const xOf = (frameIdx: number) => buffer[frameOffset + frameIdx * 4]!;

      expect(buffer[0]).toBe(3); // frames.length
      expect([xOf(0), xOf(1), xOf(2)]).toEqual([first.s, second.s, tenth.s]);
    });

    test('a frame name query narrows the animation as a RegExp just as it does as a string', () => {
      const animations = new FrameBasedAnimations();
      const atlas = new TextureAtlas();

      atlas.add('walk_1', new TextureCoords(0, 0, 32, 32));
      atlas.add('walk_2', new TextureCoords(32, 0, 32, 32));
      atlas.add('idle_1', new TextureCoords(64, 0, 32, 32));

      animations.add('walk', 1.0, atlas, /walk_/);

      const buffer = animations.bakeDataTexture().image.data as Float32Array;
      expect(buffer[0]).toBe(2); // frames.length
    });

    test('a RegExp query with the g flag takes every frame it matches', () => {
      const animations = new FrameBasedAnimations();
      const atlas = new TextureAtlas();
      const frames = [0, 1, 2, 3].map((i) => new TextureCoords(i * 8, 0, 8, 8));
      frames.forEach((coords, i) => atlas.add(`walk.${i + 1}`, coords));

      animations.add('walk', 1, atlas, /walk/g);

      const texture = animations.bakeDataTexture();
      const data = texture.image.data as Float32Array;
      // header: [frameCount, duration, first frame texel, texelsPerFrame]
      expect(Array.from(data.subarray(0, 4))).toEqual([4, 1, 1, 1]);
      texture.dispose();
    });

    test('an atlas query that matches no frame is refused', () => {
      const animations = new FrameBasedAnimations();
      const atlas = new TextureAtlas();

      atlas.add('walk_1', new TextureCoords(0, 0, 32, 32));

      expect(() => animations.add('jump', 1.0, atlas, 'jump_.*')).toThrow(/no frames/);
      expect(animations.hasAnimation('jump')).toBe(false);
    });
  });

  describe('add with TileSet', () => {
    test('add animation from TileSet with firstTileId and tileCount', () => {
      const animations = new FrameBasedAnimations();
      const baseCoords = new TextureCoords(0, 0, 128, 64);
      const tileSet = new TileSet(baseCoords, {
        tileWidth: 32,
        tileHeight: 32,
        firstId: 1,
      });

      const id = animations.add('walk', 1.0, tileSet, 1, 3);

      expect(id).toBe(0);
      expect(animations.animId('walk')).toBe(0);
    });

    test('add animation from TileSet with default firstTileId and tileCount', () => {
      const animations = new FrameBasedAnimations();
      const baseCoords = new TextureCoords(0, 0, 128, 32);
      const tileSet = new TileSet(baseCoords, {
        tileWidth: 32,
        tileHeight: 32,
        firstId: 5,
        tileCount: 4,
      });

      const id = animations.add('idle', 0.8, tileSet);

      expect(id).toBe(0);
      expect(animations.animId('idle')).toBe(0);
    });

    test('add animation from TileSet with tileIds array', () => {
      const animations = new FrameBasedAnimations();
      const baseCoords = new TextureCoords(0, 0, 128, 64);
      const tileSet = new TileSet(baseCoords, {
        tileWidth: 32,
        tileHeight: 32,
        firstId: 1,
      });

      const id = animations.add('custom', 1.5, tileSet, [1, 3, 2, 4]);

      expect(id).toBe(0);
      expect(animations.animId('custom')).toBe(0);
    });
  });

  describe('animId', () => {
    test('get animation id by name', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      animations.add('walk', 1.0, frames);
      animations.add('run', 0.5, frames);

      expect(animations.animId('walk')).toBe(0);
      expect(animations.animId('run')).toBe(1);
    });

    test('get animation id by symbol', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      animations.add(AnimSymbol, 1.0, frames);

      expect(animations.animId(AnimSymbol)).toBe(0);
    });

    test('a name that was never registered is an error naming that name', () => {
      const animations = new FrameBasedAnimations();

      animations.add('walk', 1.0, [new TextureCoords(0, 0, 32, 32)]);

      expect(() => animations.animId('nope')).toThrow(/nope/);
      expect(animations.hasAnimation('nope')).toBe(false);
      expect(animations.hasAnimation('walk')).toBe(true);
    });
  });

  describe('bakeDataTexture', () => {
    // the texel at `index` of a baked animsMap: four floats, red, green, blue, alpha
    const texelAt = (buffer: Float32Array, index: number): number[] => Array.from(buffer.subarray(index * 4, index * 4 + 4));

    const turned = (coords: TextureCoords): TextureCoords => {
      coords.flip = TextureCoords.FLIP_DIAGONAL | TextureCoords.FLIP_VERTICAL;
      return coords;
    };

    test('without an option and without a turned frame a frame takes one texel, [s, t, u, v]', () => {
      const animations = new FrameBasedAnimations();
      const sheet = new TextureCoords(0, 0, 128, 32);
      const frames = [
        new TextureCoords(sheet, 0, 0, 32, 32),
        new TextureCoords(sheet, 32, 0, 32, 32),
        new TextureCoords(sheet, 64, 0, 32, 32),
      ];

      animations.add('walk', 1.0, frames);

      const buffer = animations.bakeDataTexture().image.data as Float32Array;

      expect(texelAt(buffer, 0), 'the header: frame count, duration, first frame texel, texels per frame').toEqual([3, 1, 1, 1]);
      expect(texelAt(buffer, 1), 'the first frame').toEqual(Array.from(new Float32Array(frames[0]!.getTexCoords())));
      expect(texelAt(buffer, 2), 'the second frame').toEqual(Array.from(new Float32Array(frames[1]!.getTexCoords())));
      expect(texelAt(buffer, 3), 'the third frame').toEqual(Array.from(new Float32Array(frames[2]!.getTexCoords())));
    });

    test('with includeTextureSize a frame takes two texels, the second [width, height, 0, 0] for an upright frame', () => {
      const animations = new FrameBasedAnimations();
      const sheet = new TextureCoords(0, 0, 128, 32);
      const frames = [new TextureCoords(sheet, 0, 0, 32, 16), new TextureCoords(sheet, 32, 0, 24, 32)];

      animations.add('walk', 1.0, frames);

      const buffer = animations.bakeDataTexture({includeTextureSize: true}).image.data as Float32Array;

      expect(texelAt(buffer, 0), 'the header').toEqual([2, 1, 1, 2]);
      expect(texelAt(buffer, 1), 'the tex coords of the first frame').toEqual(
        Array.from(new Float32Array(frames[0]!.getTexCoords())),
      );
      expect(texelAt(buffer, 2), 'the size of the first frame').toEqual([32, 16, 0, 0]);
      expect(texelAt(buffer, 3), 'the tex coords of the second frame').toEqual(
        Array.from(new Float32Array(frames[1]!.getTexCoords())),
      );
      expect(texelAt(buffer, 4), 'the size of the second frame').toEqual([24, 32, 0, 0]);
    });

    test('a frame with FLIP_DIAGONAL gives every frame of the bake a second texel, [width, height, 1, 0] for the turned one', () => {
      const animations = new FrameBasedAnimations();
      const sheet = new TextureCoords(0, 0, 128, 32);
      const upright = new TextureCoords(sheet, 0, 0, 32, 16);
      const turnedFrame = turned(new TextureCoords(sheet, 32, 0, 16, 32));

      animations.add('idle', 1.0, [upright]);
      animations.add('spin', 0.5, [upright, turnedFrame]);

      const buffer = animations.bakeDataTexture().image.data as Float32Array;

      // two headers, then two texels for each of the three frames and a second header behind the
      // frames of each animation
      expect(texelAt(buffer, 0), 'the header of idle').toEqual([1, 1, 2, 2]);
      expect(texelAt(buffer, 1), 'the header of spin').toEqual([2, 0.5, 5, 2]);
      expect(texelAt(buffer, 3), 'the second texel of the frame of idle').toEqual([32, 16, 0, 0]);
      expect(texelAt(buffer, 5), 'the tex coords of the first frame of spin').toEqual(
        Array.from(new Float32Array(upright.getTexCoords())),
      );
      expect(texelAt(buffer, 6), 'the second texel of the first frame of spin').toEqual([32, 16, 0, 0]);
      expect(texelAt(buffer, 7), 'the tex coords of the turned frame').toEqual(
        Array.from(new Float32Array(turnedFrame.getTexCoords())),
      );
      expect(texelAt(buffer, 8), 'the second texel of the turned frame').toEqual([16, 32, 1, 0]);
    });

    test('the headers count two texels for each frame of an animation before them, and one for its second header', () => {
      const animations = new FrameBasedAnimations();

      animations.add('idle', 1.0, [new TextureCoords(0, 0, 32, 32)]);
      animations.add('walk', 0.5, [new TextureCoords(32, 0, 32, 32), new TextureCoords(64, 0, 32, 32)]);
      animations.add('run', 0.25, [new TextureCoords(0, 32, 32, 32)]);

      const buffer = animations.bakeDataTexture({includeTextureSize: true}).image.data as Float32Array;

      expect(texelAt(buffer, 0), 'the header of idle').toEqual([1, 1, 3, 2]);
      expect(texelAt(buffer, 1), 'the header of walk').toEqual([2, 0.5, 6, 2]);
      expect(texelAt(buffer, 2), 'the header of run').toEqual([1, 0.25, 11, 2]);
      // 3 headers, 4 frames of two texels and 3 second headers: 14 texels, and the next power of 2 is 16
      expect(buffer.length).toBe(16 * 4);
    });

    describe('trimmed frames', () => {
      // a sprite of 5 × 4 trimmed to 2 × 1 at (1, 2): its margins are 1/5, 2/4, 2/5 and 1/4 — four
      // different values, so that a mix-up of two sides shows
      const trim = {trimmed: true, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}};
      // an untrimmed frame as TexturePacker writes it: the first rectangle fills the second
      const noTrim = {trimmed: false, spriteSourceSize: {x: 0, y: 0, w: 5, h: 4}, sourceSize: {w: 5, h: 4}};

      const expectCloseTo = (actual: number[], expected: number[], label: string) => {
        expect(actual, label).toHaveLength(expected.length);
        expected.forEach((value, i) => expect(actual[i], `${label}, value ${i}`).toBeCloseTo(value, 6));
      };

      test('a trimmed frame gives every frame three texels, the third its margins and four zeros for an untrimmed one', () => {
        const [atlas] = TexturePackerJson.parse({
          frames: {
            still: {frame: {x: 0, y: 0, w: 5, h: 4}, ...noTrim},
            'trimmed.1': {frame: {x: 5, y: 0, w: 2, h: 1}, ...trim},
            'trimmed.2': {frame: {x: 8, y: 0, w: 5, h: 4}, ...noTrim},
          },
          meta: {image: 'sheet.png', size: {w: 16, h: 4}},
        });
        const animations = new FrameBasedAnimations();

        animations.add('still', 1.0, atlas, '^still$');
        animations.add('trimmed', 0.5, atlas, '^trimmed');

        const buffer = animations.bakeDataTexture().image.data as Float32Array;

        expect(texelAt(buffer, 0), 'the header of still').toEqual([1, 1, 2, 3]);
        expect(texelAt(buffer, 1), 'the header of trimmed').toEqual([2, 0.5, 6, 3]);

        expect(texelAt(buffer, 2), 'the tex coords of the frame of still').toEqual(
          Array.from(new Float32Array(atlas.frame('still')!.coords.getTexCoords())),
        );
        expect(texelAt(buffer, 3), 'the second texel of the frame of still').toEqual([5, 4, 0, 0]);
        expect(texelAt(buffer, 4), 'the margins of the frame of still').toEqual([0, 0, 0, 0]);

        expect(texelAt(buffer, 6), 'the tex coords of the trimmed frame').toEqual(
          Array.from(new Float32Array(atlas.frame('trimmed.1')!.coords.getTexCoords())),
        );
        expect(texelAt(buffer, 7), 'the second texel of the trimmed frame').toEqual([2, 1, 0, 0]);
        expectCloseTo(texelAt(buffer, 8), [0.2, 0.5, 0.4, 0.25], 'the margins of the trimmed frame');

        expect(texelAt(buffer, 11), 'the margins of the untrimmed frame of trimmed').toEqual([0, 0, 0, 0]);

        // 2 headers, 3 frames of three texels and 2 second headers: 13 texels, and the next power of 2 is 16
        expect(buffer.length).toBe(16 * 4);
      });

      test('a trimmed frame the packer turned carries its diagonal flip in the second texel and its margins in the third', () => {
        const [atlas] = TexturePackerJson.parse({
          frames: {'trimmed-turned': {frame: {x: 0, y: 0, w: 2, h: 1}, rotated: true, ...trim}},
          meta: {image: 'sheet.png', size: {w: 4, h: 4}},
        });
        const animations = new FrameBasedAnimations();

        animations.add('turned', 1.0, atlas);

        const buffer = animations.bakeDataTexture().image.data as Float32Array;

        expect(texelAt(buffer, 0), 'the header').toEqual([1, 1, 1, 3]);
        expect(texelAt(buffer, 2), 'the second texel: the area in the sheet, turned').toEqual([1, 2, 1, 0]);
        expectCloseTo(texelAt(buffer, 3), [0.2, 0.5, 0.4, 0.25], 'the margins');
      });

      test('a bake of atlas frames without a trimmed one keeps one texel per frame, and two with FLIP_DIAGONAL', () => {
        const [atlas] = TexturePackerJson.parse({
          frames: {
            still: {frame: {x: 0, y: 0, w: 5, h: 4}, ...noTrim},
            turned: {frame: {x: 5, y: 0, w: 5, h: 4}, rotated: true, ...noTrim},
          },
          meta: {image: 'sheet.png', size: {w: 16, h: 8}},
        });

        const upright = new FrameBasedAnimations();
        upright.add('still', 1.0, atlas, '^still$');
        expect(texelAt(upright.bakeDataTexture().image.data as Float32Array, 0), 'the header of the upright bake').toEqual([
          1, 1, 1, 1,
        ]);

        const withTurned = new FrameBasedAnimations();
        withTurned.add('all', 1.0, atlas);
        expect(
          texelAt(withTurned.bakeDataTexture().image.data as Float32Array, 0),
          'the header of the bake with a turned frame',
        ).toEqual([2, 1, 1, 2]);
      });

      test('the frames out of a list of TextureCoords and out of a TileSet are untrimmed', () => {
        const animations = new FrameBasedAnimations();
        animations.add('list', 1.0, [new TextureCoords(0, 0, 32, 32)]);
        animations.add('tiles', 1.0, new TileSet(new TextureCoords(0, 0, 64, 32), {tileWidth: 32, tileHeight: 32}));

        const buffer = animations.bakeDataTexture().image.data as Float32Array;

        expect(texelAt(buffer, 0), 'the header of list').toEqual([1, 1, 2, 1]);
        expect(texelAt(buffer, 1), 'the header of tiles').toEqual([2, 1, 4, 1]);
      });
    });

    test('bake DataTexture with multiple animations', () => {
      const animations = new FrameBasedAnimations();

      animations.add('idle', 1.0, [new TextureCoords(0, 0, 32, 32)]);
      animations.add('walk', 0.5, [new TextureCoords(32, 0, 32, 32), new TextureCoords(64, 0, 32, 32)]);
      animations.add('run', 0.3, [
        new TextureCoords(0, 32, 32, 32),
        new TextureCoords(32, 32, 32, 32),
        new TextureCoords(64, 32, 32, 32),
      ]);

      const dataTexture = animations.bakeDataTexture();

      expect(dataTexture).toBeDefined();
      expect(dataTexture.image.data).toBeInstanceOf(Float32Array);

      // Verify buffer structure
      const buffer = dataTexture.image.data as Float32Array;
      expect(buffer.length).toBeGreaterThan(0);

      // First animation: idle (1 frame)
      expect(buffer[0]).toBe(1); // frames.length
      expect(buffer[1]).toBe(1.0); // duration
      expect(buffer[2]).toBeGreaterThanOrEqual(0); // offset

      // Second animation: walk (2 frames)
      expect(buffer[4]).toBe(2); // frames.length
      expect(buffer[5]).toBe(0.5); // duration
      expect(buffer[6]).toBeGreaterThan(buffer[2]!); // offset > previous offset

      // Third animation: run (3 frames)
      expect(buffer[8]).toBe(3); // frames.length
      expect(buffer[9]).toBeCloseTo(0.3, 5); // duration (use toBeCloseTo for float comparison)
      expect(buffer[10]).toBeGreaterThan(buffer[6]!); // offset > previous offset
    });

    describe('the second header texel and the end times', () => {
      const frames = (count: number): TextureCoords[] =>
        Array.from({length: count}, (_, i) => new TextureCoords(new TextureCoords(0, 0, 64, 16), i * 16, 0, 16, 16));

      test('sits behind the frames of its animation: [playback, hasDurations, cycleDuration, -2]', () => {
        const animations = new FrameBasedAnimations();
        animations.add('loop', 1, frames(2));
        animations.add('once', {duration: 0.5, playback: 'once'}, frames(1));
        animations.add('pingpong', {duration: 2, playback: 'pingpong'}, frames(4));

        const buffer = animations.bakeDataTexture().image.data as Float32Array;

        // 3 headers; loop at 3 and 4, its second header at 5; once at 6, at 7; pingpong at 8 to 11, at 12
        expect([texelAt(buffer, 0)[2], texelAt(buffer, 1)[2], texelAt(buffer, 2)[2]], 'the first frame texels').toEqual([
          3, 6, 8,
        ]);
        expect(texelAt(buffer, 5), 'the second header of loop').toEqual([0, 0, 1, -2]);
        expect(texelAt(buffer, 7), 'the second header of once').toEqual([1, 0, 0.5, -2]);
        expect(texelAt(buffer, 12), 'the second header of pingpong: 6 frames of 0.5 s a turn').toEqual([2, 0, 3, -2]);
      });

      test('an animation with durations brings a second texel per frame, its fourth component the end time of the frame', () => {
        const animations = new FrameBasedAnimations();
        animations.add('still', 1, frames(1));
        animations.add('attack', {durations: [0.25, 0.25, 1, 0.5]}, frames(4));

        const buffer = animations.bakeDataTexture().image.data as Float32Array;

        expect(texelAt(buffer, 0), 'the header of still').toEqual([1, 1, 2, 2]);
        expect(texelAt(buffer, 1), 'the header of attack').toEqual([4, 2, 5, 2]);
        expect(texelAt(buffer, 3)[3], 'the frame of an animation without durations ends at 0').toBe(0);
        expect(
          [6, 8, 10, 12].map((index) => texelAt(buffer, index)[3]),
          'the end times of attack',
        ).toEqual([0.25, 0.5, 1.5, 2]);
        expect(texelAt(buffer, 13), 'the second header of attack').toEqual([0, 1, 2, -2]);
      });

      test('the second header of a ping-pong with durations counts each end frame once', () => {
        const animations = new FrameBasedAnimations();
        animations.add('idle', {durations: [0.25, 0.5, 0.75, 1], playback: 'pingpong'}, frames(4));

        const buffer = animations.bakeDataTexture().image.data as Float32Array;

        expect(texelAt(buffer, 1 + 4 * 2), 'the second header').toEqual([2, 1, 2 * 2.5 - 0.25 - 1, -2]);
      });

      test('the bake of no animation stays empty', () => {
        const buffer = new FrameBasedAnimations().bakeDataTexture().image.data as Float32Array;

        expect(Array.from(buffer).every((value) => value === 0)).toBe(true);
      });
    });

    test('bake empty DataTexture', () => {
      const animations = new FrameBasedAnimations();

      const dataTexture = animations.bakeDataTexture();

      expect(dataTexture).toBeDefined();
      expect(dataTexture.image.data).toBeInstanceOf(Float32Array);
    });
  });

  describe('edge cases', () => {
    test('add animation with single frame', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      const id = animations.add('single', 1.0, frames);

      expect(id).toBe(0);
      expect(animations.animId('single')).toBe(0);
    });

    test('add animation with zero duration', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      const id = animations.add('zero', 0, frames);

      expect(id).toBe(0);
      expect(animations.animId('zero')).toBe(0);
    });

    test('add animation with very long duration', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      const id = animations.add('long', 999.99, frames);

      expect(id).toBe(0);
      expect(animations.animId('long')).toBe(0);
    });

    test('sequential animation ids', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      const ids = [];
      for (let i = 0; i < 10; i++) {
        ids.push(animations.add(`anim_${i}`, 1.0, frames));
      }

      expect(ids).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe('buffer size calculation', () => {
    test('a data texture over the maximum is refused with the numbers that were asked for', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32), new TextureCoords(32, 0, 32, 32), new TextureCoords(64, 0, 32, 32)];

      animations.add('walk', 1.0, frames);

      const maxBefore = FrameBasedAnimations.MaxTextureSize;
      FrameBasedAnimations.MaxTextureSize = 2;
      try {
        expect(() => animations.bakeDataTexture()).toThrow(/3 frame\(s\) in 1 animation\(s\).*8 texels.*maximum of 2/);
      } finally {
        FrameBasedAnimations.MaxTextureSize = maxBefore;
      }
    });

    test('should handle reasonable number of animations', () => {
      const animations = new FrameBasedAnimations();

      // Add 100 animations with 10 frames each
      for (let i = 0; i < 100; i++) {
        const animFrames = [];
        for (let j = 0; j < 10; j++) {
          animFrames.push(new TextureCoords(j * 32, i * 32, 32, 32));
        }
        animations.add(`anim_${i}`, 1.0, animFrames);
      }

      const dataTexture = animations.bakeDataTexture();
      expect(dataTexture).toBeDefined();
      expect(dataTexture.image.data).toBeInstanceOf(Float32Array);
    });

    test('should handle animations with many frames', () => {
      const animations = new FrameBasedAnimations();
      const frames = [];

      // Create animation with 100 frames
      for (let i = 0; i < 100; i++) {
        frames.push(new TextureCoords(i * 32, 0, 32, 32));
      }

      animations.add('long_anim', 10.0, frames);

      const dataTexture = animations.bakeDataTexture();
      expect(dataTexture).toBeDefined();
      expect(dataTexture.image.data).toBeInstanceOf(Float32Array);
    });
  });

  describe('the widest data texture a bake may build', () => {
    // one animation of `frameCount` frames at one texel each, one header texel before them and its
    // second header behind them
    const animationsOf = (frameCount: number) => {
      const animations = new FrameBasedAnimations();
      animations.add(
        'walk',
        1,
        Array.from({length: frameCount}, () => new TextureCoords(0, 0, 8, 8)),
      );
      return animations;
    };
    const refusal = (texels: number, maximum: number) =>
      new RegExp(`a data texture of ${texels} texels, over the maximum of ${maximum}$`);

    // stubs of the one thing the bake asks a renderer for, the limit of its device
    const webgpuRenderer = (maxTextureDimension2D: number) =>
      ({backend: {device: {limits: {maxTextureDimension2D}}}}) as unknown as WebGPURenderer;
    const webglRenderer = (maxTextureSize: number) =>
      ({
        backend: {gl: {MAX_TEXTURE_SIZE: 0x0d33, getParameter: (p: number) => (p === 0x0d33 ? maxTextureSize : 0)}},
      }) as unknown as WebGPURenderer;
    const rendererWithoutDevice = () => ({backend: {}}) as unknown as WebGPURenderer;
    const rendererThatThrows = () =>
      ({
        get backend() {
          throw new Error('no backend');
        },
      }) as unknown as WebGPURenderer;

    test('MaxTextureSize is 8192 texels, the maxTextureDimension2D every WebGPU device offers', () => {
      expect(FrameBasedAnimations.MaxTextureSize).toBe(8192);
    });

    test('without a limit named a bake of 16384 texels is refused, naming 8192', () => {
      // 1 header texel, 8192 frame texels and the second header ask for 16384
      expect(() => animationsOf(8192).bakeDataTexture()).toThrow(refusal(16384, 8192));
    });

    test('a maxTextureSize of 4 refuses a bake of 8 texels, naming 4', () => {
      expect(() => animationsOf(4).bakeDataTexture({maxTextureSize: 4})).toThrow(refusal(8, 4));
    });

    test('the limit of a WebGPU device refuses a bake over it, naming it', () => {
      expect(() => animationsOf(4).bakeDataTexture({renderer: webgpuRenderer(4)})).toThrow(refusal(8, 4));
    });

    test('the MAX_TEXTURE_SIZE of a WebGL2 context refuses a bake over it, naming it', () => {
      expect(() => animationsOf(4).bakeDataTexture({renderer: webglRenderer(4)})).toThrow(refusal(8, 4));
    });

    test.each([
      ['a renderer without a device', rendererWithoutDevice],
      ['a renderer whose backend throws', rendererThatThrows],
    ])('%s falls back to MaxTextureSize', (_, renderer) => {
      const texture = animationsOf(4).bakeDataTexture({renderer: renderer()});
      expect(texture.image.width).toBe(8);
      texture.dispose();

      expect(() => animationsOf(8192).bakeDataTexture({renderer: renderer()})).toThrow(refusal(16384, 8192));
    });

    test('a maxTextureSize takes the place of the limit of the renderer', () => {
      const texture = animationsOf(4).bakeDataTexture({maxTextureSize: 8, renderer: webgpuRenderer(4)});
      expect(texture.image.width).toBe(8);
      texture.dispose();

      expect(() => animationsOf(4).bakeDataTexture({maxTextureSize: 4, renderer: webgpuRenderer(16)})).toThrow(refusal(8, 4));
    });

    test.each([
      ['0', 0],
      ['1.5', 1.5],
      ['NaN', NaN],
      ['"8"', '8' as unknown as number],
    ])('a maxTextureSize of %s is refused', (described, maxTextureSize) => {
      expect(() => animationsOf(1).bakeDataTexture({maxTextureSize})).toThrow(
        new RangeError(
          `FrameBasedAnimations: bakeDataTexture() got a maxTextureSize of ${described} — a maxTextureSize is a whole number of 1 or more`,
        ),
      );
    });

    test('a bake names a maxTextureSize without includeTextureSize', () => {
      // a header, the frame and the second header: 3 texels, and the next power of 2 is 4
      const texture = animationsOf(1).bakeDataTexture({maxTextureSize: 4096});
      expect(texture.image.width).toBe(4);
      texture.dispose();
    });
  });

  describe('frameRate support', () => {
    test('add animation with frameRate option', () => {
      const animations = new FrameBasedAnimations();
      const frames = [
        new TextureCoords(0, 0, 32, 32),
        new TextureCoords(32, 0, 32, 32),
        new TextureCoords(64, 0, 32, 32),
        new TextureCoords(96, 0, 32, 32),
      ];

      // 4 frames at 4 fps = 1 second duration
      const id = animations.add('walk', {frameRate: 4}, frames);

      expect(id).toBe(0);
      expect(animations.animId('walk')).toBe(0);
    });

    test('frameRate correctly calculates duration in baked texture', () => {
      const animations = new FrameBasedAnimations();
      const frames = [
        new TextureCoords(0, 0, 32, 32),
        new TextureCoords(32, 0, 32, 32),
        new TextureCoords(64, 0, 32, 32),
        new TextureCoords(96, 0, 32, 32),
        new TextureCoords(128, 0, 32, 32),
      ];

      // 5 frames at 10 fps = 0.5 second duration
      animations.add('run', {frameRate: 10}, frames);

      const dataTexture = animations.bakeDataTexture();
      const buffer = dataTexture.image.data as Float32Array;

      expect(buffer[0]).toBe(5); // frames.length
      expect(buffer[1]).toBeCloseTo(0.5, 5); // duration = 5 / 10 = 0.5
    });

    test('add animation with duration option object', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32), new TextureCoords(32, 0, 32, 32)];

      const id = animations.add('idle', {duration: 2.5}, frames);

      expect(id).toBe(0);

      const dataTexture = animations.bakeDataTexture();
      const buffer = dataTexture.image.data as Float32Array;

      expect(buffer[1]).toBeCloseTo(2.5, 5); // duration
    });

    test('mix duration number and frameRate options', () => {
      const animations = new FrameBasedAnimations();
      const frames2 = [new TextureCoords(0, 0, 32, 32), new TextureCoords(32, 0, 32, 32)];
      const frames4 = [
        new TextureCoords(0, 0, 32, 32),
        new TextureCoords(32, 0, 32, 32),
        new TextureCoords(64, 0, 32, 32),
        new TextureCoords(96, 0, 32, 32),
      ];

      // Duration number (backward compatibility)
      animations.add('idle', 1.0, frames2);

      // frameRate option: 4 frames at 8 fps = 0.5 seconds
      animations.add('walk', {frameRate: 8}, frames4);

      // duration option object
      animations.add('run', {duration: 0.25}, frames2);

      const dataTexture = animations.bakeDataTexture();
      const buffer = dataTexture.image.data as Float32Array;

      // idle: 2 frames, 1.0 duration
      expect(buffer[0]).toBe(2);
      expect(buffer[1]).toBeCloseTo(1.0, 5);

      // walk: 4 frames, 0.5 duration (4 / 8)
      expect(buffer[4]).toBe(4);
      expect(buffer[5]).toBeCloseTo(0.5, 5);

      // run: 2 frames, 0.25 duration
      expect(buffer[8]).toBe(2);
      expect(buffer[9]).toBeCloseTo(0.25, 5);
    });

    test('frameRate with TextureAtlas', () => {
      const animations = new FrameBasedAnimations();
      const atlas = new TextureAtlas();

      atlas.add('sprite_001', new TextureCoords(0, 0, 32, 32));
      atlas.add('sprite_002', new TextureCoords(32, 0, 32, 32));
      atlas.add('sprite_003', new TextureCoords(64, 0, 32, 32));

      // 3 frames at 6 fps = 0.5 seconds
      const id = animations.add('walk', {frameRate: 6}, atlas, 'sprite_.*');

      expect(id).toBe(0);

      const dataTexture = animations.bakeDataTexture();
      const buffer = dataTexture.image.data as Float32Array;

      expect(buffer[0]).toBe(3);
      expect(buffer[1]).toBeCloseTo(0.5, 5);
    });

    test('frameRate with TileSet', () => {
      const animations = new FrameBasedAnimations();
      const baseCoords = new TextureCoords(0, 0, 128, 64);
      const tileSet = new TileSet(baseCoords, {
        tileWidth: 32,
        tileHeight: 32,
        firstId: 1,
      });

      // 4 tiles at 12 fps = 1/3 seconds
      const id = animations.add('walk', {frameRate: 12}, tileSet, 1, 4);

      expect(id).toBe(0);

      const dataTexture = animations.bakeDataTexture();
      const buffer = dataTexture.image.data as Float32Array;

      expect(buffer[0]).toBe(4);
      expect(buffer[1]).toBeCloseTo(1 / 3, 5);
    });

    test('frameRate with TileSet using tileIds array', () => {
      const animations = new FrameBasedAnimations();
      const baseCoords = new TextureCoords(0, 0, 128, 64);
      const tileSet = new TileSet(baseCoords, {
        tileWidth: 32,
        tileHeight: 32,
        firstId: 1,
      });

      // 4 tiles at 20 fps = 0.2 seconds
      const id = animations.add('custom', {frameRate: 20}, tileSet, [1, 3, 2, 4]);

      expect(id).toBe(0);

      const dataTexture = animations.bakeDataTexture();
      const buffer = dataTexture.image.data as Float32Array;

      expect(buffer[0]).toBe(4);
      expect(buffer[1]).toBeCloseTo(0.2, 5);
    });

    test('throw error for zero frameRate', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32), new TextureCoords(32, 0, 32, 32)];

      expect(() => {
        animations.add('invalid', {frameRate: 0}, frames);
      }).toThrow(/got a frameRate of 0 for the animation `invalid`/);
    });

    test('throw error for negative frameRate', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32), new TextureCoords(32, 0, 32, 32)];

      expect(() => {
        animations.add('invalid', {frameRate: -5}, frames);
      }).toThrow(/got a frameRate of -5 for the animation `invalid`/);
    });
  });

  describe('add() refuses tile ids, a first tile id, a tile count and a frame name query that cannot pick frames', () => {
    // 4 x 4 tiles of 16 x 16
    const makeTileSet = () => new TileSet(new TextureCoords(0, 0, 64, 64), {tileWidth: 16, tileHeight: 16});

    // the catalog json carries what it carries, so the values below are cast past the types
    test.each([
      ['"5"', '5' as unknown as number],
      ['2.5', 2.5],
      ['NaN', NaN],
      [String(FrameBasedAnimations.MaxTextureSize + 1), FrameBasedAnimations.MaxTextureSize + 1],
      // the tileCount message, not the one about an animation without frames
      ['0', 0],
    ])('a tileCount of %s is refused', (described, tileCount) => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.add('walk', 1, makeTileSet(), 1, tileCount)).toThrow(
        `FrameBasedAnimations: add() got a tileCount of ${described} for the animation \`walk\` — a tileCount is a whole number from 1 to ${FrameBasedAnimations.MaxTextureSize}`,
      );
    });

    test.each([
      ['"1"', '1' as unknown as number],
      ['1.5', 1.5],
    ])('a firstTileId of %s is refused', (described, firstTileId) => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.add('walk', 1, makeTileSet(), firstTileId, 2)).toThrow(
        `FrameBasedAnimations: add() got a firstTileId of ${described} for the animation \`walk\` — a firstTileId is a whole number`,
      );
    });

    test.each([
      ['"2"', '2' as unknown as number],
      ['1.5', 1.5],
    ])('a tile id of %s is refused, naming its index', (described, tileId) => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.add('walk', 1, makeTileSet(), [1, tileId, 3])).toThrow(
        `FrameBasedAnimations: add() got a tileId of ${described} at index 1 for the animation \`walk\` — a tileId is a whole number`,
      );
    });

    test('a negative firstTileId and a negative tile id are accepted, the tile set wraps them', () => {
      const animations = new FrameBasedAnimations();
      const tileSet = makeTileSet();

      expect(animations.add('range', 1, tileSet, -3, 2)).toBe(0);
      expect(animations.add('ids', 1, tileSet, [-1, -2])).toBe(1);
    });

    test('a tile set of more tiles than MaxTextureSize is accepted without a tileCount', () => {
      const animations = new FrameBasedAnimations();
      // 200 x 100 tiles of 1 x 1
      const tileSet = new TileSet(new TextureCoords(0, 0, 200, 100), {tileWidth: 1, tileHeight: 1});
      expect(tileSet.tileCount).toBeGreaterThan(FrameBasedAnimations.MaxTextureSize);

      expect(() => animations.add('all', 1, tileSet)).not.toThrow();
    });

    test('a frameNameQuery of 5 is refused instead of taking every frame of the atlas', () => {
      const animations = new FrameBasedAnimations();
      const atlas = new TextureAtlas();
      atlas.add('walk.1', new TextureCoords(0, 0, 8, 8));
      atlas.add('idle.1', new TextureCoords(8, 0, 8, 8));

      expect(() => animations.add('walk', 1, atlas, 5 as unknown as string)).toThrow(
        'FrameBasedAnimations: add() got a frameNameQuery of 5 for the animation `walk` — a frameNameQuery is a string or a RegExp',
      );
    });
  });

  describe('playback and per-frame durations', () => {
    const frames = (count: number): TextureCoords[] =>
      Array.from({length: count}, (_, i) => new TextureCoords(new TextureCoords(0, 0, 64, 16), i * 16, 0, 16, 16));

    test('an animation loops unless it is told otherwise, a number as timing included', () => {
      const animations = new FrameBasedAnimations();
      animations.add('number', 1, frames(2));
      animations.add('object', {duration: 1}, frames(2));
      animations.add('rate', {frameRate: 4}, frames(2));

      expect(['number', 'object', 'rate'].map((name) => animations.animation(name).playback)).toEqual(['loop', 'loop', 'loop']);
    });

    test.each(['loop', 'once', 'pingpong'] as const)('takes the playback %s', (playback) => {
      const animations = new FrameBasedAnimations();
      animations.add('a', {duration: 1, playback}, frames(3));

      expect(animations.animation('a').playback).toBe(playback);
    });

    test.each([['bounce'], [''], [1], [null]])('refuses a playback of %j, naming the three', (playback) => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.add('a', {duration: 1, playback: playback as never}, frames(2))).toThrow(
        "for the animation `a` — a playback is 'loop', 'once' or 'pingpong'",
      );
    });

    test('per-frame durations make the duration their sum and are kept per frame', () => {
      const animations = new FrameBasedAnimations();
      animations.add('attack', {durations: [0.05, 0.05, 0.3, 0.1]}, frames(4));

      const info = animations.animation('attack');

      expect(info.duration).toBeCloseTo(0.5, 10);
      expect(info.durations).toEqual([0.05, 0.05, 0.3, 0.1]);
      expect(info.frameCount).toBe(4);
    });

    test('the durations handed in are copied', () => {
      const animations = new FrameBasedAnimations();
      const durations = [0.1, 0.2];
      animations.add('a', {durations}, frames(2));

      durations[0] = 5;

      expect(animations.animation('a').durations).toEqual([0.1, 0.2]);
    });

    test('an animation of one duration has no durations', () => {
      const animations = new FrameBasedAnimations();
      animations.add('a', 1, frames(2));

      expect(animations.animation('a').durations).toBeUndefined();
    });

    test.each([[{durations: [0.1, 0.1], duration: 1}], [{durations: [0.1, 0.1], frameRate: 10}]])(
      'refuses durations beside a duration or a frameRate: %j',
      (timing) => {
        const animations = new FrameBasedAnimations();

        expect(() => animations.add('a', timing as never, frames(2))).toThrow(
          'for the animation `a` — give one of duration, frameRate and durations',
        );
      },
    );

    test.each([['0.1'], [{}], [5]])('refuses durations of %j that are no array', (durations) => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.add('a', {durations: durations as never}, frames(2))).toThrow(
        'for the animation `a` — durations is an array of seconds, one per frame',
      );
    });

    test('refuses a count of durations other than the count of frames', () => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.add('a', {durations: [0.1, 0.1, 0.1]}, frames(4))).toThrow(
        'FrameBasedAnimations: add() got 3 durations for the 4 frames of the animation `a` — give one duration per frame',
      );
    });

    test.each([[0], [-0.1], [Number.NaN], [Number.POSITIVE_INFINITY], ['0.1']])(
      'refuses a frame duration of %j, naming its index',
      (value) => {
        const animations = new FrameBasedAnimations();

        expect(() => animations.add('a', {durations: [0.1, 0.1, value as never]}, frames(3))).toThrow(
          'at index 2 for the animation `a` — a frame duration is a finite number of seconds above zero',
        );
      },
    );

    test('MaxFramesWithDurations is 8191, the frames a search of 13 steps covers', () => {
      expect(FrameBasedAnimations.MaxFramesWithDurations).toBe(8191);
    });

    test('refuses an animation of more than 8191 frames with durations', () => {
      const animations = new FrameBasedAnimations();
      const many = Array.from({length: 8192}, () => new TextureCoords(0, 0, 1, 1));

      expect(() => animations.add('a', {durations: many.map(() => 0.01)}, many)).toThrow(
        'FrameBasedAnimations: add() got 8192 frames with durations for the animation `a` — an animation with per-frame durations holds at most 8191 frames; split it',
      );
    });

    test('a refused playback or durations spends no name of the counter', () => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.add(undefined, {durations: [0.1]}, frames(2))).toThrow();
      expect(() => animations.add(undefined, {duration: 1, playback: 'x' as never}, frames(2))).toThrow();
      animations.add(undefined, 1, frames(1));

      expect(animations.hasAnimation('anim_0')).toBe(true);
    });
  });

  describe('add with a list of frame names', () => {
    const makeAtlas = () =>
      TexturePackerJson.parse({
        frames: {
          'kick 0': {frame: {x: 0, y: 0, w: 4, h: 4}},
          'kick 1': {frame: {x: 4, y: 0, w: 2, h: 1}, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 4, h: 4}},
          'kick 2': {frame: {x: 8, y: 0, w: 4, h: 4}},
        },
        meta: {image: 'sheet.png', size: {w: 16, h: 4}},
      })[0];

    test('takes the frames in the order of the list, a name as often as it is named', () => {
      const atlas = makeAtlas();
      const animations = new FrameBasedAnimations();

      animations.add('kick', 1, atlas, ['kick 2', 'kick 0', 'kick 2']);

      const buffer = animations.bakeDataTexture().image.data as Float32Array;
      const sOf = (index: number) => buffer[index * 4];
      expect(animations.animation('kick').frameCount).toBe(3);
      expect([sOf(1), sOf(2), sOf(3)]).toEqual([atlas.frame('kick 2')!.coords.s, 0, atlas.frame('kick 2')!.coords.s]);
    });

    test('the frames of the list bring their trim margins', () => {
      const atlas = makeAtlas();
      const animations = new FrameBasedAnimations();

      animations.add('kick', 1, atlas, ['kick 1']);

      const buffer = animations.bakeDataTexture().image.data as Float32Array;
      expect(buffer[3], 'three texels per frame').toBe(3);
      expect(Array.from(buffer.subarray(12, 16))).toEqual([0.25, 0.5, 0.25, 0.25]);
    });

    test('refuses a name the atlas does not carry, naming its index', () => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.add('kick', 1, makeAtlas(), ['kick 0', 'kick 9'])).toThrow(
        'FrameBasedAnimations: add() got the frame name "kick 9" at index 1 for the animation `kick`, which the atlas does not carry',
      );
    });

    test('refuses an entry that is no string, naming its index', () => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.add('kick', 1, makeAtlas(), ['kick 0', 5 as never])).toThrow(
        'FrameBasedAnimations: add() got a frame name of 5 at index 1 for the animation `kick` — a frame name is a string',
      );
    });

    test('an empty list registers nothing', () => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.add('kick', 1, makeAtlas(), [])).toThrow('got no frames for the animation `kick`');
    });

    test('the list handed in is not kept: a change after add() leaves the animation as it was', () => {
      const animations = new FrameBasedAnimations();
      const names = ['kick 0', 'kick 2'];
      animations.add('kick', 1, makeAtlas(), names);

      names.length = 0;

      expect(animations.animation('kick').frameCount).toBe(2);
    });
  });

  describe('animation()', () => {
    const frames = (count: number): TextureCoords[] => Array.from({length: count}, () => new TextureCoords(0, 0, 1, 1));

    test('answers an animation by its name and by its id', () => {
      const animations = new FrameBasedAnimations();
      animations.add('idle', 1, frames(2));
      const walk = animations.add('walk', {duration: 0.8, playback: 'once'}, frames(4));

      expect(animations.animation('walk')).toEqual({
        id: walk,
        name: 'walk',
        frameCount: 4,
        duration: 0.8,
        playback: 'once',
        durations: undefined,
        cycleDuration: 0.8,
      });
      expect(animations.animation(walk)).toEqual(animations.animation('walk'));
    });

    test('the answer is frozen', () => {
      const animations = new FrameBasedAnimations();
      animations.add('a', {durations: [0.1, 0.2]}, frames(2));

      const info = animations.animation('a');

      expect(Object.isFrozen(info)).toBe(true);
      expect(Object.isFrozen(info.durations)).toBe(true);
    });

    test.each([
      ['loop', 4, 1, 1],
      ['once', 4, 1, 1],
      ['pingpong', 4, 1, 1.5],
      ['pingpong', 2, 1, 1],
      ['pingpong', 1, 1, 1],
    ] as const)('the cycle of a %s over %i frames of %f s lasts %f s', (playback, count, duration, cycle) => {
      const animations = new FrameBasedAnimations();
      animations.add('a', {duration, playback}, frames(count));

      expect(animations.animation('a').cycleDuration).toBeCloseTo(cycle, 10);
    });

    test('the cycle of a ping-pong with durations shows each end once: 2 · duration − first − last', () => {
      const animations = new FrameBasedAnimations();
      animations.add('a', {durations: [0.1, 0.2, 0.3, 0.4], playback: 'pingpong'}, frames(4));

      expect(animations.animation('a').cycleDuration).toBeCloseTo(2 * 1 - 0.1 - 0.4, 10);
    });

    test('an animation that was never registered is an error, as for animId()', () => {
      const animations = new FrameBasedAnimations();

      expect(() => animations.animation('nope')).toThrow('FrameBasedAnimations: there is no animation named "nope"');
      expect(() => animations.animation(3)).toThrow('FrameBasedAnimations: there is no animation of the id 3');
    });
  });

  describe('clone()', () => {
    const frames = (count: number): TextureCoords[] => Array.from({length: count}, () => new TextureCoords(0, 0, 1, 1));

    test('answers a copy with the same animations under the same names and ids', () => {
      const animations = new FrameBasedAnimations();
      animations.add('idle', {duration: 1, playback: 'pingpong'}, frames(3));
      animations.add(AnimSymbol, {durations: [0.1, 0.2]}, frames(2));

      const copy = animations.clone();

      expect(copy).not.toBe(animations);
      expect(copy.animation('idle')).toEqual(animations.animation('idle'));
      expect(copy.animId(AnimSymbol)).toBe(1);
      expect(Array.from(copy.bakeDataTexture().image.data as Float32Array)).toEqual(
        Array.from(animations.bakeDataTexture().image.data as Float32Array),
      );
    });

    test('an animation added to the copy leaves the original alone, and the other way round', () => {
      const animations = new FrameBasedAnimations();
      animations.add('idle', 1, frames(1));
      const copy = animations.clone();

      copy.add('walk', 1, frames(2));
      animations.add('run', 1, frames(2));

      expect([copy.hasAnimation('walk'), copy.hasAnimation('run')]).toEqual([true, false]);
      expect([animations.hasAnimation('walk'), animations.hasAnimation('run')]).toEqual([false, true]);
      expect(copy.animId('walk')).toBe(1);
    });

    test('the copy goes on with the counter of anonymous names where the original stood', () => {
      const animations = new FrameBasedAnimations();
      animations.add(undefined, 1, frames(1));
      const copy = animations.clone();

      copy.add(undefined, 1, frames(1));

      expect(copy.hasAnimation('anim_1')).toBe(true);
    });
  });
});
