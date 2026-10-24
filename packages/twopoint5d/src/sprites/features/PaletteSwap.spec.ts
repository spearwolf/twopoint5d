import {sRGBTransferOETF, uniform, vec2, vec4} from 'three/tsl';
import {type Node, SRGBColorSpace, Texture, Vector2, Vector4} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

import {
  attributeNamesOf,
  evaluateNode,
  nodesOf,
  samplesTexture,
  stubShaderContext,
  textureNodesOf,
} from '../../testing/spriteGraph.js';
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

// a spy that hands every call on to three: the stage calls sRGBTransferOETF() once per colour it
// encodes while it builds the colour graph, and the count says which branch it took. The spy wraps a
// call rather than the function: what Fn() answers is a proxy that reads every property off its
// FnNode, which has no `apply`, and vi.fn() calls an implementation through its `apply`
vi.mock('three/tsl', async (importOriginal) => {
  const tsl = await importOriginal<typeof import('three/tsl')>();
  const encode = tsl.sRGBTransferOETF;
  return {...tsl, sRGBTransferOETF: vi.fn((...args: Parameters<typeof encode>) => encode(...args))};
});

const lookupsOf = (root: Parameters<typeof textureNodesOf>[0], palette: Texture) =>
  new Set(textureNodesOf(root).filter((node) => node.value === palette)).size;

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

  test.each([
    [5, '5'],
    ['x', '"x"'],
    [null, 'null'],
  ])('refuses options of %o that are no object', (options, shown) => {
    expect(() => paletteSwap(options as never)).toThrow(TypeError);
    expect(() => paletteSwap(options as never)).toThrow(`paletteSwap: the options must be an object, {colors?}, got ${shown}`);
  });

  test('takes options that are undefined', () => {
    expect(() => paletteSwap(undefined)).not.toThrow();
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
    const encode = vi.mocked(sRGBTransferOETF);
    const srgb = makePalette();
    srgb.colorSpace = SRGBColorSpace;
    encode.mockClear();
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture(), palette: srgb}});

    // the colour of the color source once, and the sixteen entries it is compared with
    expect(material.colorNode).toBeDefined();
    expect(encode).toHaveBeenCalledTimes(1 + 16);
    encode.mockClear();
    material.setTexture('palette', makePalette());
    expect(material.colorNode).toBeDefined();
    expect(encode).toHaveBeenCalledTimes(0);
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

  test('rounds paletteRow half up: 1.5 and 2.5 draw the rows 2 and 3', () => {
    // the row of the replacement, the last lookup of the stage, in a palette of 16 × 8
    const rowDrawn = (paletteRow: number) => {
      const uvs: Node<'vec2'>[] = [];
      PaletteSwap.color!.transform(uniform(new Vector4(0.5, 0.5, 0.5, 1)) as unknown as Node<'vec4'>, {
        ...stubShaderContext(),
        attribute: <T extends string>(name: string) => uniform(name === 'paletteRow' ? paletteRow : 0) as unknown as Node<T>,
        uniform: <T extends string>(name: string) =>
          (name === 'paletteCycle' ? uniform(new Vector2(0, 0)) : uniform(0)) as unknown as Node<T>,
        sample: (_name, uv) => {
          uvs.push(uv);
          return vec4(0.5, 0.5, 0.5, 1) as unknown as Node<'vec4'>;
        },
        textureSize: () => vec2(16, 8) as unknown as Node<'vec2'>,
      });
      return (evaluateNode(uvs.at(-1)!) as number[])[1]! * 8 - 0.5;
    };

    expect(rowDrawn(2.5)).toBeCloseTo(3);
    expect(rowDrawn(1.5)).toBeCloseTo(2);
  });
});
