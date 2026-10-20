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
import {BitmapFont} from './BitmapFont.js';
import {writeText} from './writeText.js';

const font = new BitmapFont(tinyFontData());

const position = (sprite: {x: number; y: number; z: number}) => [sprite.x, sprite.y, sprite.z];
const size = (sprite: {width: number; height: number}) => [sprite.width, sprite.height];

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
      expect(() => writeText(sprites as never, font, 'A')).toThrow(TypeError);
      expect(() => writeText(sprites as never, font, 'A')).toThrow(
        'writeText: the sprites lack the features QuadSize, AtlasFrame — writeText() writes the position, the size and the frame of every glyph; build the kind with InstancePosition, QuadSize and AtlasFrame, as TexturedSpriteKind does',
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
      expect(() => writeText(sprites, font, 'AV AV')).toThrow(RangeError);
      expect(() => writeText(sprites, font, 'AV AV')).toThrow(
        'writeText: "AV AV" needs 4 sprites, and the pool ran full after 2 — give the sprites a larger capacity; no sprite was written',
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
        'writeText: the scale must be a finite number above 0, got -1',
      );
      expect(() => writeText(sprites, font, 'A', {z: Number.NaN})).toThrow('writeText: the z must be a finite number, got NaN');
      expect(sprites.spritePool?.usedCount).toBe(0);
    });
  });

  test('disposed sprites write nothing', () => {
    const sprites = spritesOf(TexturedSpriteKind, {capacity: 2});
    sprites.dispose();
    expect(writeText(sprites, font, 'AV')).toEqual([]);
  });
});
