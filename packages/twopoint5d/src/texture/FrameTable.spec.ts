import {FloatType, NearestFilter, RGBAFormat, type WebGPURenderer} from 'three/webgpu';
import {describe, expect, test} from 'vitest';
import {FrameTable, frameTable} from './FrameTable.js';
import {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {TexturePackerJson} from './TexturePackerJson.js';

const root = new TextureCoords(0, 0, 64, 32);

/** An atlas of `walk_0` … `walk_3` and `idle_0`, in that order, each 8 × 8 side by side. */
const makeAtlas = () => {
  const atlas = new TextureAtlas();
  ['walk_0', 'walk_1', 'walk_2', 'walk_3', 'idle_0'].forEach((name, i) => {
    atlas.add(name, new TextureCoords(root, i * 8, 0, 8, 8));
  });
  return atlas;
};

/** The texels of a bake, four floats each. */
const texelsOf = (table: FrameTable, options?: Parameters<FrameTable['bakeDataTexture']>[0]) => {
  const texture = table.bakeDataTexture(options);
  const data = texture.image.data as Float32Array;
  const texel = (index: number) => Array.from(data.subarray(index * 4, index * 4 + 4));
  return {texture, texel};
};

describe('FrameTable', () => {
  describe('the selection', () => {
    test('every frame of the atlas by id, without a selection', () => {
      const atlas = makeAtlas();
      atlas.add(new TextureCoords(root, 0, 8, 8, 8));
      const table = FrameTable.fromAtlas(atlas);
      expect(table.size).toBe(6);
      expect(table.indexOf('walk_2')).toBe(2);
      expect(table.indexOf('idle_0')).toBe(4);
    });

    test('the names a RegExp matches, in the order they were added', () => {
      const table = FrameTable.fromAtlas(makeAtlas(), /^walk_/);
      expect(table.size).toBe(4);
      expect(table.indexOf('walk_3')).toBe(3);
      expect(table.indexOf('idle_0')).toBe(-1);
    });

    test('a list of names in its order; a name listed twice keeps its first index', () => {
      const table = frameTable(makeAtlas(), ['idle_0', 'walk_1', 'idle_0']);
      expect(table.size).toBe(3);
      expect(table.indexOf('idle_0')).toBe(0);
      expect(table.indexOf('walk_1')).toBe(1);
    });

    test('follows the json order of a TexturePacker atlas', () => {
      const [atlas] = TexturePackerJson.parse({
        frames: {
          stalker_walk_0_0: {frame: {x: 0, y: 0, w: 4, h: 4}},
          stalker_walk_1_0: {frame: {x: 4, y: 0, w: 4, h: 4}},
          stalker_walk_0_1: {frame: {x: 8, y: 0, w: 4, h: 4}},
        },
        meta: {image: 'x.png', size: {w: 16, h: 4}},
      });
      const table = FrameTable.fromAtlas(atlas, /^stalker_walk_/);
      expect(['stalker_walk_0_0', 'stalker_walk_1_0', 'stalker_walk_0_1'].map((name) => table.indexOf(name))).toEqual([0, 1, 2]);
    });

    test('refuses a name the atlas lacks, and a selection of no frames', () => {
      expect(() => FrameTable.fromAtlas(makeAtlas(), ['run_0'])).toThrow('FrameTable: the atlas holds no frame "run_0"');
      expect(() => FrameTable.fromAtlas(makeAtlas(), /^run_/)).toThrow('FrameTable: a table of no frames');
      expect(() => new FrameTable([])).toThrow('FrameTable: a table of no frames');
    });

    test('a table of bare coords finds no name', () => {
      const table = new FrameTable([new TextureCoords(root, 0, 0, 8, 8)]);
      expect(table.size).toBe(1);
      expect(table.indexOf('walk_0')).toBe(-1);
    });
  });

  describe('bakeDataTexture()', () => {
    test('writes the header and three texels a frame: coords, measures and flip, trim', () => {
      const [atlas] = TexturePackerJson.parse({
        frames: {
          plain: {frame: {x: 0, y: 0, w: 8, h: 4}},
          turned: {frame: {x: 8, y: 0, w: 4, h: 8}, rotated: true},
          trimmed: {
            frame: {x: 16, y: 0, w: 4, h: 6},
            trimmed: true,
            spriteSourceSize: {x: 2, y: 1, w: 4, h: 6},
            sourceSize: {w: 8, h: 8},
          },
        },
        meta: {image: 'x.png', size: {w: 32, h: 16}},
      });
      const table = FrameTable.fromAtlas(atlas);
      const {texel} = texelsOf(table);

      expect(texel(0)).toEqual([3, 0, 0, 0]);
      for (const [index, name] of ['plain', 'turned', 'trimmed'].entries()) {
        const {coords} = atlas.frame(name)!;
        expect(texel(1 + 3 * index), name).toEqual(Array.from(new Float32Array(coords.getTexCoords())));
        expect(texel(2 + 3 * index), name).toEqual([coords.width, coords.height, coords.flipD ? 1 : 0, 0]);
      }
      expect(texel(5)[2]).toBe(1);
      expect(texel(9)).toEqual([2 / 8, 1 / 8, 2 / 8, 1 / 8]);
      expect(texel(3)).toEqual([0, 0, 0, 0]);
    });

    test('bare coords are untrimmed', () => {
      const {texel} = texelsOf(new FrameTable([new TextureCoords(root, 8, 8, 8, 8)]));
      expect(texel(1)).toEqual([8 / 64, 8 / 32, 8 / 64, 8 / 32]);
      expect(texel(3)).toEqual([0, 0, 0, 0]);
    });

    test('is a float texture read texel for texel, one row while the texels fit', () => {
      const {texture} = texelsOf(FrameTable.fromAtlas(makeAtlas()));
      expect([texture.image.width, texture.image.height]).toEqual([16, 1]);
      expect(texture.type).toBe(FloatType);
      expect(texture.format).toBe(RGBAFormat);
      expect([texture.magFilter, texture.minFilter]).toEqual([NearestFilter, NearestFilter]);
      expect(texture.generateMipmaps).toBe(false);
      expect(texture.flipY).toBe(false);
      expect(texture.version).toBeGreaterThan(0);
    });

    test('lays the texels row by row in a texture as wide as maxTextureSize', () => {
      const {texture, texel} = texelsOf(FrameTable.fromAtlas(makeAtlas()), {maxTextureSize: 4});
      // 1 + 3 · 5 = 16 texels, 4 a row
      expect([texture.image.width, texture.image.height]).toEqual([4, 4]);
      expect(texel(0)).toEqual([5, 0, 0, 0]);
      expect(texel(13)).toEqual(Array.from(new Float32Array([32 / 64, 0, 8 / 64, 8 / 32])));
    });

    test('takes the limit of the device of a renderer', () => {
      const renderer = {backend: {device: {limits: {maxTextureDimension2D: 8}}}} as unknown as WebGPURenderer;
      const {texture} = texelsOf(FrameTable.fromAtlas(makeAtlas()), {renderer});
      expect([texture.image.width, texture.image.height]).toEqual([8, 2]);
    });

    test('refuses a table that needs more rows than maxTextureSize', () => {
      expect(() => FrameTable.fromAtlas(makeAtlas()).bakeDataTexture({maxTextureSize: 3})).toThrow(
        'FrameTable: 5 frames take 16 texels, 6 rows of 3 — more than the maxTextureSize of 3',
      );
    });

    test('refuses a table of more texels than the shader addresses exactly in float, 2^24', () => {
      // floor((2^24 − 1) / 3) frames fit; one more does not
      const table = new FrameTable(new Array(5_592_406).fill(new TextureCoords(root, 0, 0, 8, 8)));
      expect(() => table.bakeDataTexture()).toThrow(RangeError);
      expect(() => table.bakeDataTexture()).toThrow(
        'FrameTable: 5592406 frames take 16777219 texels — the shader addresses 16777216 (2^24) texels exactly in float; split them into several tables',
      );
    });

    test('refuses a maxTextureSize that is no whole number of 1 or more', () => {
      expect(() => FrameTable.fromAtlas(makeAtlas()).bakeDataTexture({maxTextureSize: 0})).toThrow(RangeError);
      expect(() => FrameTable.fromAtlas(makeAtlas()).bakeDataTexture({maxTextureSize: 2.5})).toThrow(
        'FrameTable: bakeDataTexture() got a maxTextureSize of 2.5 — a maxTextureSize is a whole number of 1 or more',
      );
    });

    test('builds a new texture on every call, from the frames as they are then', () => {
      const coords = new TextureCoords(root, 0, 0, 8, 8);
      const table = new FrameTable([coords]);
      const first = table.bakeDataTexture();
      coords.x = 16;
      const second = table.bakeDataTexture();
      expect(second).not.toBe(first);
      expect((second.image.data as Float32Array)[4]).toBe(16 / 64);
      expect((first.image.data as Float32Array)[4]).toBe(0);
    });
  });
});
