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
      const frames = [
        new TextureCoords(0, 0, 32, 32),
        new TextureCoords(32, 0, 32, 32),
        new TextureCoords(64, 0, 32, 32),
      ];

      const id = animations.add('walk', 1.0, frames);

      expect(id).toBe(0);
      expect(animations.animId('walk')).toBe(0);
    });

    test('add animation without name (using Symbol)', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32), new TextureCoords(32, 0, 32, 32)];

      const id = animations.add(undefined, 0.5, frames);

      expect(id).toBe(0);
      expect(typeof id).toBe('number');
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
      const id1 = animations.add('walk', 0.5, [
        new TextureCoords(32, 0, 32, 32),
        new TextureCoords(64, 0, 32, 32),
      ]);
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
  });

  describe('bakeDataTexture', () => {
    test('bake DataTexture without includeTextureSize option', () => {
      const animations = new FrameBasedAnimations();
      const frames = [
        new TextureCoords(0, 0, 32, 32),
        new TextureCoords(32, 0, 32, 32),
        new TextureCoords(64, 0, 32, 32),
      ];

      animations.add('walk', 1.0, frames);

      const dataTexture = animations.bakeDataTexture();

      expect(dataTexture).toBeDefined();
      expect(dataTexture.image).toBeDefined();
      expect(dataTexture.image.data).toBeInstanceOf(Float32Array);
    });

    test('bake DataTexture with includeTextureSize option', () => {
      const animations = new FrameBasedAnimations();
      const frames = [
        new TextureCoords(0, 0, 32, 32),
        new TextureCoords(32, 0, 32, 32),
      ];

      animations.add('walk', 1.0, frames);

      const dataTexture = animations.bakeDataTexture({includeTextureSize: true});

      expect(dataTexture).toBeDefined();
      expect(dataTexture.image).toBeDefined();
      expect(dataTexture.image.data).toBeInstanceOf(Float32Array);
    });

    test('bake DataTexture with multiple animations', () => {
      const animations = new FrameBasedAnimations();

      animations.add('idle', 1.0, [new TextureCoords(0, 0, 32, 32)]);
      animations.add('walk', 0.5, [
        new TextureCoords(32, 0, 32, 32),
        new TextureCoords(64, 0, 32, 32),
      ]);
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
      expect(buffer[6]).toBeGreaterThan(buffer[2]); // offset > previous offset

      // Third animation: run (3 frames)
      expect(buffer[8]).toBe(3); // frames.length
      expect(buffer[9]).toBeCloseTo(0.3, 5); // duration (use toBeCloseTo for float comparison)
      expect(buffer[10]).toBeGreaterThan(buffer[6]); // offset > previous offset
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
});
