import type {InterleavedBuffer, InterleavedBufferAttribute} from 'three/webgpu';
import {afterEach, describe, expect, test, vi} from 'vitest';
import {defineSprite, type SpriteKind} from '../sprites/defineSprite.js';
import {Anchor} from '../sprites/features/Anchor.js';
import {AnimatedFrames} from '../sprites/features/AnimatedFrames.js';
import {AtlasFrame} from '../sprites/features/AtlasFrame.js';
import {FlatPlacement} from '../sprites/features/FlatPlacement.js';
import {InstancePosition} from '../sprites/features/InstancePosition.js';
import {QuadSize} from '../sprites/features/QuadSize.js';
import {TextureColor} from '../sprites/features/TextureColor.js';
import {FeatureSprites, type FeatureSpritesOptions} from '../sprites/FeatureSprites/FeatureSprites.js';
import {AnimatedSpriteKind, TexturedSpriteKind} from '../sprites/presets.js';
import {QuadBase} from '../sprites/SpriteBase.js';
import {tinyFontData} from '../testing/bitmapFonts.js';
import {VertexObjectPool} from '../vertex-objects/VertexObjectPool.js';
import {VOUtils} from '../vertex-objects/VOUtils.js';
import {BitmapFont} from './BitmapFont.js';
import {rewriteText, writeText} from './writeText.js';

const font = new BitmapFont(tinyFontData());

const position = (sprite: {x: number; y: number; z: number}) => [sprite.x, sprite.y, sprite.z];
const size = (sprite: {width: number; height: number}) => [sprite.width, sprite.height];
const frame = (sprite: {s: number; t: number; u: number; v: number}) => [sprite.s, sprite.t, sprite.u, sprite.v];

/**
 * Calls `fn` once and answers what it threw, `undefined` when it returned. A test that counts the
 * slots of the pool after a throw calls through this, since every `toThrow()` would call again.
 */
const catchError = (fn: () => void): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
};

const bufferOf = <Api extends object>(sprites: FeatureSprites<Api>, attrName: string): InterleavedBuffer =>
  (sprites.geometry!.getAttribute(attrName) as InterleavedBufferAttribute).data;

/** Whether the upload of `buffer` covers all elements of `slot` — no range at all means the whole array. */
const uploadsSlot = (buffer: InterleavedBuffer, slot: number) =>
  buffer.updateRanges.length === 0 ||
  buffer.updateRanges.some(({start, count}) => start <= slot * buffer.stride && start + count >= (slot + 1) * buffer.stride);

describe('writeText()', () => {
  const built: {dispose(): void}[] = [];
  const spritesOf = <Api extends object>(kind: SpriteKind<Api>, options: FeatureSpritesOptions<Api>) => {
    const sprites = new FeatureSprites(kind, options);
    built.push(sprites);
    return sprites;
  };

  afterEach(() => {
    for (const sprites of built.splice(0)) sprites.dispose();
  });

  test('creates one sprite per visible glyph, in reading order, sized by its box and showing its frame', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 8});
    const glyphs = writeText(sprites, font, 'A V\n-');

    expect(glyphs).toHaveLength(3);
    expect(sprites.spritePool?.usedCount).toBe(3);
    expect(glyphs.map(size)).toEqual([
      [3, 4],
      [3, 4],
      [2, 1],
    ]);
    const frameOf = (char: string) => font.glyph(char)!.frame.coords.getTexCoords();
    expect([glyphs[0]!.s, glyphs[0]!.t, glyphs[0]!.u, glyphs[0]!.v]).toEqual(frameOf('A'));
    expect([glyphs[1]!.s, glyphs[1]!.t, glyphs[1]!.u, glyphs[1]!.v]).toEqual(frameOf('V'));
    expect([glyphs[2]!.s, glyphs[2]!.t, glyphs[2]!.u, glyphs[2]!.v]).toEqual(frameOf('-'));
    expect([glyphs[0]!.trimLeft, glyphs[0]!.trimTop, glyphs[0]!.trimRight, glyphs[0]!.trimBottom]).toEqual([0, 0, 0, 0]);
  });

  test('under QuadBase with its default base the position is the middle of the glyph box', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 8});
    const glyphs = writeText(sprites, font, 'AV', {x: 10, y: 20, z: -3});
    // A: box (10, 19) 3 × 4; V: box (12, 19)
    expect(glyphs.map(position)).toEqual([
      [11.5, 17, -3],
      [13.5, 17, -3],
    ]);
  });

  test('a kind with Anchor takes the text where a kind without it does: the glyphs keep the anchor of a new sprite', () => {
    const kind = defineSprite({
      base: QuadBase,
      features: [InstancePosition, FlatPlacement, QuadSize, Anchor, AtlasFrame, TextureColor],
    });
    const glyphs = writeText(spritesOf(kind, {capacity: 8}), font, 'AV', {x: 10, y: 20});

    expect(glyphs.map(position)).toEqual([
      [11.5, 17, 0],
      [13.5, 17, 0],
    ]);
    expect(glyphs.map(({anchorX, anchorY}) => [anchorX, anchorY])).toEqual([
      [0.5, 0.5],
      [0.5, 0.5],
    ]);
  });

  test('with baseArgs that put the top left corner on the position, the position is the corner of the box', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 8, baseArgs: [0.5, 0.5, 0.5, -0.5]});
    const glyphs = writeText(sprites, font, 'AV\n-', {x: 10, y: 20});
    expect(glyphs.map(position)).toEqual([
      [10, 19, 0],
      [12, 19, 0],
      [11, 11, 0],
    ]);
  });

  test('takes the layout options: align, scale, letterSpacing, maxWidth', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 8, baseArgs: [0.5, 0.5, 0.5, -0.5]});
    const glyphs = writeText(sprites, font, 'AV AV', {align: 'right', scale: 2, maxWidth: 20});
    expect(glyphs.map(position)).toEqual([
      [-14, -2, 0],
      [-10, -2, 0],
      [-14, -14, 0],
      [-10, -14, 0],
    ]);
    expect(glyphs.map(size)[0]).toEqual([6, 8]);
  });

  test('writes nothing else: a new sprite keeps its tint and rotation', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 2});
    const [glyph] = writeText(sprites, font, 'A');
    expect([glyph!.r, glyph!.g, glyph!.b, glyph!.a]).toEqual([1, 1, 1, 1]);
    expect(glyph!.rotation).toBe(0);
  });

  test('the caller frees the sprites again', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 8});
    const other = sprites.createSprite()!;
    const glyphs = writeText(sprites, font, 'AV-');
    for (const glyph of glyphs) sprites.freeSprite(glyph);
    expect(sprites.spritePool?.usedCount).toBe(1);
    expect(sprites.spritePool?.containsVO(other)).toBe(true);
  });

  test('a text of no visible glyph creates no sprite', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 2});
    expect(writeText(sprites, font, '  \n ')).toEqual([]);
    expect(sprites.spritePool?.usedCount).toBe(0);
  });

  describe('refusals', () => {
    test('sprites whose kind lacks a feature it writes, naming every one missing', () => {
      const Bare = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, TextureColor]});
      const sprites = spritesOf(Bare, {capacity: 4});
      expect(() => writeText(sprites as never, font, 'A')).toThrow(
        new TypeError(
          'writeText: the sprites lack the features QuadSize, AtlasFrame — writeText() writes the position, the size and the frame of every glyph; build the kind with InstancePosition, QuadSize and AtlasFrame, as TexturedSpriteKind does',
        ),
      );
      expect(sprites.spritePool?.usedCount).toBe(0);
    });

    test('animated sprites, which read their frame out of an animsMap', () => {
      expect(AnimatedSpriteKind.features).toContain(AnimatedFrames);
      const sprites = spritesOf(AnimatedSpriteKind, {capacity: 4});
      expect(() => writeText(sprites as never, font, 'A')).toThrow('writeText: the sprites lack the feature AtlasFrame —');
    });

    test('a pool that runs full: the sprites created so far are freed, and the count is named', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sprites = spritesOf(TexturedSpriteKind, {capacity: 3});
      const other = sprites.createSprite()!;
      expect(() => writeText(sprites, font, 'AV AV')).toThrow(
        new RangeError(
          'writeText: "AV AV" needs 4 sprites, and the pool ran full after 2 — give the sprites a larger capacity; no sprite was written',
        ),
      );
      expect(sprites.spritePool?.usedCount).toBe(1);
      expect(sprites.spritePool?.containsVO(other)).toBe(true);
      expect(warn).toHaveBeenCalledOnce();
    });

    test('a long text is cut short in the message', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sprites = spritesOf(TexturedSpriteKind, {capacity: 1});
      expect(() => writeText(sprites, font, 'AVAVAVAVAVAVAVAVAVAV')).toThrow('writeText: "AVAVAVAVAVAVAVA…" needs 20 sprites');
    });

    test('options it refuses are named as options of writeText', () => {
      const sprites = spritesOf(TexturedSpriteKind, {capacity: 2});
      expect(() => writeText(sprites, font, 'A', {scale: -1})).toThrow(
        'writeText: scale must be a finite number above 0, got -1',
      );
      expect(() => writeText(sprites, font, 'A', {z: Number.NaN})).toThrow('writeText: z must be a finite number, got NaN');
      expect(sprites.spritePool?.usedCount).toBe(0);
    });

    test('a throw of createSprite() frees the sprites created so far and goes on', () => {
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const sprites = spritesOf(TexturedSpriteKind, {capacity: 2, grow: true});
      const extra = new VertexObjectPool({attributes: {extra: {size: 1}}}, 2);
      built.push(extra);
      sprites.geometry!.attachInstancedPool('extra', extra);
      const other = sprites.createSprite()!;

      const error = catchError(() => writeText(sprites, font, 'AVAV'));

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('FeatureSprites#createSprite(): the pool is full and cannot grow');
      expect((error as Error).message).toContain('has pools attached');
      expect(sprites.spritePool?.usedCount).toBe(1);
      expect(sprites.spritePool?.containsVO(other)).toBe(true);
    });
  });

  test('disposed sprites write nothing', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 2});
    sprites.dispose();
    expect(writeText(sprites, font, 'AV')).toEqual([]);
  });
});

describe('rewriteText()', () => {
  const built: {dispose(): void}[] = [];
  const spritesOf = <Api extends object>(kind: SpriteKind<Api>, options: FeatureSpritesOptions<Api>) => {
    const sprites = new FeatureSprites(kind, options);
    built.push(sprites);
    return sprites;
  };

  afterEach(() => {
    for (const sprites of built.splice(0)) sprites.dispose();
    vi.restoreAllMocks();
  });

  test('reuses the glyphs in reading order and creates only the ones missing', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 8});
    const glyphs = writeText(sprites, font, 'AV', {x: 1});
    const [first, second] = glyphs;

    const answer = rewriteText(sprites, glyphs, font, 'AVA', {x: 10, y: 20, z: -3});

    expect(answer).toBe(glyphs);
    expect(glyphs).toHaveLength(3);
    expect(glyphs[0]).toBe(first);
    expect(glyphs[1]).toBe(second);
    expect(glyphs[2]).not.toBe(first);
    expect(glyphs[2]).not.toBe(second);
    expect(sprites.spritePool?.usedCount).toBe(3);

    const fresh = writeText(spritesOf(TexturedSpriteKind, {capacity: 8}), font, 'AVA', {x: 10, y: 20, z: -3});
    expect(glyphs.map(position)).toEqual(fresh.map(position));
    expect(glyphs.map(size)).toEqual(fresh.map(size));
    expect(glyphs.map(frame)).toEqual(fresh.map(frame));
  });

  test('a reused glyph keeps every value it does not write', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 8});
    const glyphs = writeText(sprites, font, 'A');
    glyphs[0]!.setColorValues(1, 0, 0, 1);
    rewriteText(sprites, glyphs, font, 'VA');
    expect([glyphs[0]!.r, glyphs[0]!.g, glyphs[0]!.b]).toEqual([1, 0, 0]);
    expect([glyphs[1]!.r, glyphs[1]!.g, glyphs[1]!.b]).toEqual([1, 1, 1]);
  });

  test('a shorter text frees the glyphs left over from the last one back, and no other sprite moves', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 8});
    const other = sprites.createSprite()!;
    const glyphs = writeText(sprites, font, 'AVAV');
    const [first, second] = glyphs;

    rewriteText(sprites, glyphs, font, 'AV');

    expect(glyphs).toEqual([first, second]);
    expect(sprites.spritePool?.usedCount).toBe(3);
    expect(VOUtils.getIndex(other)).toBe(0);
    expect(VOUtils.getIndex(first!)).toBe(1);
    expect(VOUtils.getIndex(second!)).toBe(2);
  });

  test('marks the slots of the glyphs it reuses for upload', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 8});
    sprites.createSprite();
    const glyphs = writeText(sprites, font, 'AV');
    sprites.geometry!.update();
    const quadSize = bufferOf(sprites, 'quadSize');
    const texCoords = bufferOf(sprites, 'texCoords');
    // the state an upload leaves, and a range of no elements: a buffer that update() leaves alone keeps
    // it and so is told apart from one that uploads the whole array
    for (const buffer of [quadSize, texCoords]) {
      buffer.clearUpdateRanges();
      buffer.addUpdateRange(0, 0);
    }
    sprites.geometry!.update();
    expect(uploadsSlot(quadSize, VOUtils.getIndex(glyphs[0]!)), 'no upload before rewriteText()').toBe(false);

    rewriteText(sprites, glyphs, font, 'VA');
    sprites.geometry!.update();

    for (const glyph of glyphs) {
      expect(uploadsSlot(quadSize, VOUtils.getIndex(glyph))).toBe(true);
      expect(uploadsSlot(texCoords, VOUtils.getIndex(glyph))).toBe(true);
    }
  });

  test('an empty text frees every glyph and empties the array', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 8});
    const other = sprites.createSprite()!;
    const glyphs = writeText(sprites, font, 'AVA');
    expect(rewriteText(sprites, glyphs, font, '')).toBe(glyphs);
    expect(glyphs).toEqual([]);
    expect(sprites.spritePool?.usedCount).toBe(1);
    expect(sprites.spritePool?.containsVO(other)).toBe(true);
  });

  test('an empty array takes the text as writeText() would', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 8});
    const glyphs = rewriteText(sprites, [], font, 'AV', {x: 10, y: 20});
    expect(glyphs.map(position)).toEqual([
      [11.5, 17, 0],
      [13.5, 17, 0],
    ]);
  });

  test('a pool that runs full leaves the glyphs with the text they had', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 4});
    const glyphs = writeText(sprites, font, 'AV', {x: 3});
    const before = [...glyphs];
    const positions = glyphs.map(position);

    const error = catchError(() => rewriteText(sprites, glyphs, font, 'AVAVAV'));

    expect(error).toBeInstanceOf(RangeError);
    expect((error as Error).message).toBe(
      'rewriteText: "AVAVAV" needs 6 sprites, 2 of them the glyphs handed in, and the pool ran full after 2 more — give the sprites a larger capacity; the glyphs keep the text they had',
    );
    expect(sprites.spritePool?.usedCount).toBe(2);
    expect(glyphs).toEqual(before);
    expect(glyphs.map(position)).toEqual(positions);
    expect(warn).toHaveBeenCalledOnce();
  });

  test('a throw of createSprite() leaves the glyphs and the pool as they were', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 3, grow: true});
    const extra = new VertexObjectPool({attributes: {extra: {size: 1}}}, 3);
    built.push(extra);
    sprites.geometry!.attachInstancedPool('extra', extra);
    const glyphs = writeText(sprites, font, 'AV');
    const before = [...glyphs];

    const error = catchError(() => rewriteText(sprites, glyphs, font, 'AVAV'));

    expect((error as Error).message).toContain('has pools attached');
    expect(sprites.spritePool?.usedCount).toBe(2);
    expect(glyphs).toEqual(before);
  });

  test('refuses a glyph of other sprites, naming its index, before anything changes', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 8});
    const others = spritesOf(TexturedSpriteKind, {capacity: 8});
    const glyphs = writeText(sprites, font, 'AV');
    glyphs.push(writeText(others, font, 'A')[0]!);
    const before = [...glyphs];

    const error = catchError(() => rewriteText(sprites, glyphs, font, 'A'));

    expect(error).toBeInstanceOf(TypeError);
    expect((error as Error).message).toBe(
      'rewriteText: glyph 2 is no sprite of these sprites — hand in the array writeText() or rewriteText() answered for them',
    );
    expect(glyphs).toEqual(before);
    expect(sprites.spritePool?.usedCount).toBe(2);
  });

  test('options it refuses are named as options of rewriteText', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 2});
    expect(() => rewriteText(sprites, [], font, 'A', {scale: -1})).toThrow(
      'rewriteText: scale must be a finite number above 0, got -1',
    );
    expect(() => rewriteText(sprites, [], font, 'A', {z: Number.NaN})).toThrow('rewriteText: z must be a finite number, got NaN');
    const Bare = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, TextureColor]});
    expect(() => rewriteText(spritesOf(Bare, {capacity: 2}) as never, [], font, 'A')).toThrow(
      'rewriteText: the sprites lack the features QuadSize, AtlasFrame — rewriteText() writes',
    );
  });

  test('disposed sprites empty the array and answer it', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 2});
    const glyphs = writeText(sprites, font, 'AV');
    sprites.dispose();
    expect(rewriteText(sprites, glyphs, font, 'A')).toBe(glyphs);
    expect(glyphs).toEqual([]);
  });
});
