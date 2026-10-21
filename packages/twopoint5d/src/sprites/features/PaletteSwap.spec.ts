import {type Node, SRGBColorSpace, Texture} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {attributeNamesOf, nodesOf, samplesTexture, textureNodesOf} from '../../testing/spriteGraph.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {FeatureSpritesMaterial} from '../FeatureSprites/FeatureSpritesMaterial.js';
import {QuadBase} from '../SpriteBase.js';
import {ColorOrder} from '../SpriteFeature.js';
import {FlatPlacement} from './FlatPlacement.js';
import {InstancePosition} from './InstancePosition.js';
import {PaletteSwap, paletteSwap} from './PaletteSwap.js';
import {QuadSize} from './QuadSize.js';
import {TextureColor} from './TextureColor.js';
import {Tint} from './Tint.js';

const kind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, TextureColor, Tint, PaletteSwap],
});

const makePalette = (width = 16, height = 4) => {
  const texture = new Texture();
  texture.image = {width, height} as unknown as HTMLImageElement;
  return texture;
};

const lookupsOf = (root: Parameters<typeof textureNodesOf>[0], palette: Texture) =>
  new Set(textureNodesOf(root).filter((node) => node.value === palette)).size;

// the calls of sRGBTransferOETF() in the graph below `root`, known by the layout of the function they call
const encodingsOf = (root: Node) =>
  [...nodesOf(root)].filter(
    (node) => (node as unknown as {shaderNode?: {layout?: {name?: string}}}).shaderNode?.layout?.name === 'sRGBTransferOETF',
  ).length;

describe('paletteSwap()', () => {
  test('answers one frozen feature per set of options', () => {
    expect(paletteSwap()).toBe(PaletteSwap);
    expect(paletteSwap({colors: 16})).toBe(PaletteSwap);
    expect(paletteSwap({colors: 32})).toBe(paletteSwap({colors: 32}));
    expect(paletteSwap({colors: 32})).not.toBe(PaletteSwap);
    expect(Object.isFrozen(PaletteSwap)).toBe(true);
  });

  test('is named by its colours', () => {
    expect(PaletteSwap.name).toBe('paletteSwap');
    expect(paletteSwap({colors: 32}).name).toBe('paletteSwap+32');
  });

  test('declares paletteRow, the palette, the cycling uniforms and the colorMap it reads texel for texel', () => {
    expect(PaletteSwap.attributes).toEqual({paletteRow: {size: 1}});
    expect(PaletteSwap.textures).toEqual({palette: {}});
    expect(PaletteSwap.uniforms).toEqual({paletteShift: 0, paletteCycle: [0, 0]});
    expect(PaletteSwap.nearestTextures).toEqual(['colorMap']);
    expect(PaletteSwap.color?.order).toBe(ColorOrder.Palette);
    expect(ColorOrder.Palette).toBeLessThan(ColorOrder.Tint);
  });

  test.each([
    [0, '0'],
    [65, '65'],
    [2.5, '2.5'],
    ['16', '"16"'],
    [Number.NaN, 'NaN'],
    [-Infinity, '-Infinity'],
  ])('refuses colors of %o', (colors, shown) => {
    expect(() => paletteSwap({colors: colors as number})).toThrow(TypeError);
    expect(() => paletteSwap({colors: colors as number})).toThrow(
      `paletteSwap: colors must be a whole number from 1 to 64, got ${shown}`,
    );
  });

  test('a sprite starts in row 0, whatever its slot held before', () => {
    const pool = new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 1);
    const sprite = pool.createVO()!;
    sprite.paletteRow = 3;
    pool.freeVO(sprite);
    expect(pool.createVO()!.paletteRow).toBe(0);
    pool.dispose();
  });

  test('drops out of the graph while there is no palette', () => {
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture()}});
    expect(attributeNamesOf(material.colorNode!)).not.toContain('paletteRow');
    material.dispose();
  });

  test('compares every colour of the palette and reads one replacement, in the color graph alone', () => {
    const palette = makePalette();
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture(), palette}});

    // sixteen comparisons, one replacement, and the texture node textureSize() reads the measures of
    expect(lookupsOf(material.colorNode!, palette)).toBe(16 + 1 + 1);
    expect(samplesTexture(material.positionNode!, palette)).toBe(false);
    expect(attributeNamesOf(material.colorNode!)).toContain('paletteRow');
    const {paletteShift, paletteCycle} = material.uniforms;
    expect([nodesOf(material.colorNode!).has(paletteShift!), nodesOf(material.colorNode!).has(paletteCycle!)]).toEqual([
      true,
      true,
    ]);
    material.dispose();
  });

  test('encodes the colour and every entry back to sRGB under an srgb palette, and nothing under another', () => {
    const srgb = makePalette();
    srgb.colorSpace = SRGBColorSpace;
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture(), palette: srgb}});

    // the colour of the color source once, and the sixteen entries it is compared with
    expect(encodingsOf(material.colorNode!)).toBe(1 + 16);
    material.setTexture('palette', makePalette());
    expect(encodingsOf(material.colorNode!)).toBe(0);
    material.dispose();
  });

  test('compares as many colours as it is built for', () => {
    const four = defineSprite({
      base: QuadBase,
      features: [InstancePosition, FlatPlacement, QuadSize, TextureColor, paletteSwap({colors: 4})],
    });
    const palette = makePalette(4, 2);
    const material = new FeatureSpritesMaterial(four, {textures: {colorMap: new Texture(), palette}});
    expect(lookupsOf(material.colorNode!, palette)).toBe(4 + 1 + 1);
    material.dispose();
  });

  test('a palette of the same kind takes the place of the one set without a rebuild, and a shift builds no node', () => {
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture(), palette: makePalette()}});
    const {colorNode, version} = material;
    const other = makePalette(32, 8);

    material.setTexture('palette', other);
    material.setUniform('paletteShift', 3);
    material.setUniform('paletteCycle', 1, 15);

    expect([material.colorNode, material.version]).toEqual([colorNode, version]);
    expect(samplesTexture(material.colorNode!, other)).toBe(true);
    material.dispose();
  });
});
