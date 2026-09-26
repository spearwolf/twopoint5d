import {describe, expect, test} from 'vitest';
import {FrameBasedAnimations} from './FrameBasedAnimations.js';
import {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
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

    test('a duration that is a string is quoted in the message', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      expect(() => animations.add('text', {duration: '1' as unknown as number}, frames)).toThrow(/got a duration of "1"/);
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

    test('throw error on duplicate name', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      animations.add('walk', 1.0, frames);

      expect(() => {
        animations.add('walk', 1.0, frames);
      }).toThrow("name='walk' must be unique!");
    });
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
    test('bake DataTexture without includeTextureSize option', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32), new TextureCoords(32, 0, 32, 32), new TextureCoords(64, 0, 32, 32)];

      animations.add('walk', 1.0, frames);

      const dataTexture = animations.bakeDataTexture();

      expect(dataTexture).toBeDefined();
      expect(dataTexture.image).toBeDefined();
      expect(dataTexture.image.data).toBeInstanceOf(Float32Array);
    });

    test('bake DataTexture with includeTextureSize option', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32), new TextureCoords(32, 0, 32, 32)];

      animations.add('walk', 1.0, frames);

      const dataTexture = animations.bakeDataTexture({includeTextureSize: true});

      expect(dataTexture).toBeDefined();
      expect(dataTexture.image).toBeDefined();
      expect(dataTexture.image.data).toBeInstanceOf(Float32Array);
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
        expect(() => animations.bakeDataTexture()).toThrow(/3 frame\(s\) in 1 animation\(s\).*4 texels.*maximum of 2/);
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
      ['16385', FrameBasedAnimations.MaxTextureSize + 1],
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
});
