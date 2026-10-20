import {attribute, float, texture, uniform, vec2, vec4} from 'three/tsl';
import {
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  NearestMipmapNearestFilter,
  type Node,
  Texture,
  type TextureFilter,
  type TextureNode,
  Vector2,
} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {attributeNamesOf, nodesOf, samplesTexture, stubShaderContext, textureNodesOf} from '../../testing/spriteGraph.js';
import {defineSprite} from '../defineSprite.js';
import {FeatureSpritesMaterial} from '../FeatureSprites/FeatureSpritesMaterial.js';
import {QuadBase} from '../SpriteBase.js';
import type {SpriteFrameNodes} from '../SpriteFeature.js';
import {AtlasFrame} from './AtlasFrame.js';
import {InstancePosition} from './InstancePosition.js';
import {QuadSize} from './QuadSize.js';
import {RepeatingTextureColor} from './RepeatingTextureColor.js';
import {SegmentEnd} from './SegmentEnd.js';
import {SegmentPlacement} from './SegmentPlacement.js';
import {TextureColor} from './TextureColor.js';

const frameOf = (flip?: number): SpriteFrameNodes => ({
  texCoords: vec4(0, 0, 0.5, 0.25) as unknown as Node<'vec4'>,
  ...(flip != null && {flipDiagonal: float(flip) as unknown as Node<'float'>}),
});

/** A stub context whose samples read `map`. */
const contextSampling = (map: Texture, frame: SpriteFrameNodes) => {
  const sampled: Node[] = [];
  return {
    sampled,
    ctx: {
      ...stubShaderContext(frame),
      sample: (_name: string, uv: Node<'vec2'>) => {
        const node = texture(map, uv) as unknown as Node<'vec4'>;
        sampled.push(node);
        return node;
      },
      textureSize: () => uniform(new Vector2(64, 16)) as unknown as Node<'vec2'>,
    },
  };
};

const filtered = (minFilter: TextureFilter, magFilter: TextureFilter) => {
  const map = new Texture();
  map.minFilter = minFilter as Texture['minFilter'];
  map.magFilter = magFilter as Texture['magFilter'];
  return map;
};

const kind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, SegmentEnd, SegmentPlacement, QuadSize, AtlasFrame, RepeatingTextureColor],
});

describe('RepeatingTextureColor', () => {
  test('declares the colorMap it samples and requires the two ends and the size of the segment', () => {
    const {name, textures, requires, colorSource, ...rest} = RepeatingTextureColor;

    expect(name).toBe('repeatingTextureColor');
    expect(textures).toEqual({colorMap: {}});
    expect(requires).toEqual(['instancePosition', 'segmentEnd', 'quadSize']);
    expect(typeof colorSource).toBe('function');
    expect(Object.keys(rest)).toEqual([]);
  });

  test('samples through the context, at the uv of the context, by the size of the colorMap and the length of the segment', () => {
    const map = new Texture();
    const {ctx, sampled} = contextSampling(map, frameOf(1));

    const color = RepeatingTextureColor.colorSource!(ctx.frame, ctx);

    expect(sampled).toHaveLength(1);
    expect(samplesTexture(color, map)).toBe(true);
    expect(attributeNamesOf(color)).toEqual(expect.arrayContaining(['instancePosition', 'quadSize', 'segmentEnd', 'uv']));
  });

  test('builds without a diagonal flip in the frame — the defaults of a kind without a frame feature', () => {
    const {ctx} = contextSampling(new Texture(), frameOf());

    expect(RepeatingTextureColor.colorSource!(ctx.frame, ctx)).toBeDefined();
  });

  test('takes explicit gradients unless both filters are nearest, so a mipmapped frame shows no seam at its wraps', () => {
    const cases: [TextureFilter, TextureFilter, boolean][] = [
      [LinearMipmapLinearFilter, LinearFilter, true],
      [NearestMipmapNearestFilter, NearestFilter, true],
      [LinearFilter, LinearFilter, true],
      [NearestFilter, LinearFilter, true],
      [NearestFilter, NearestFilter, false],
    ];
    for (const [minFilter, magFilter, gradients] of cases) {
      const map = filtered(minFilter, magFilter);
      const {ctx} = contextSampling(map, frameOf(0));

      const color = RepeatingTextureColor.colorSource!(ctx.frame, ctx);
      const samples = textureNodesOf(color).filter((node) => node.value === map);

      expect(
        samples.some((node) => node.gradNode != null),
        `minFilter ${minFilter}, magFilter ${magFilter}`,
      ).toBe(gradients);
    }
  });

  test('repeats along the segment from the uv read in the fragment graph, not through a varying of a frame lookup', () => {
    const {ctx} = contextSampling(new Texture(), frameOf(0));

    const color = RepeatingTextureColor.colorSource!(ctx.frame, ctx);

    expect([...nodesOf(color)].some((node) => (node as unknown as {method?: string}).method === 'fract')).toBe(true);
    expect([...nodesOf(color)].some((node) => node === (ctx.uv as unknown as Node))).toBe(true);
  });

  test('draws flat grey until a colorMap is set, then samples it; a texture of the same kind swaps in', () => {
    const material = new FeatureSpritesMaterial(kind);
    expect(textureNodesOf(material.colorNode!)).toHaveLength(0);

    const first = filtered(NearestFilter, NearestFilter);
    material.setTexture('colorMap', first);
    const colorNode = material.colorNode!;
    expect(samplesTexture(colorNode, first)).toBe(true);

    const second = filtered(NearestFilter, NearestFilter);
    material.setTexture('colorMap', second);
    expect(material.colorNode).toBe(colorNode);
    expect(samplesTexture(colorNode, second)).toBe(true);
    material.dispose();
  });

  test('a mipmapped colorMap of a material is sampled with gradients that refer to the registered lookup', () => {
    const map = filtered(LinearMipmapLinearFilter, LinearFilter);
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: map}});

    const graded = textureNodesOf(material.colorNode!).find((node) => node.gradNode != null) as TextureNode;
    const swapped = filtered(LinearMipmapLinearFilter, LinearFilter);
    material.setTexture('colorMap', swapped);

    expect(graded.value).toBe(swapped);
    material.dispose();
  });

  test('is refused next to TextureColor', () => {
    expect(() =>
      defineSprite({
        base: QuadBase,
        features: [InstancePosition, SegmentEnd, SegmentPlacement, QuadSize, AtlasFrame, TextureColor, RepeatingTextureColor],
      }),
    ).toThrow(/features "textureColor" and "repeatingTextureColor" each contribute a colorSource stage/);
  });

  test('is refused without the end of a segment', () => {
    expect(() =>
      defineSprite({base: QuadBase, features: [InstancePosition, SegmentPlacement, QuadSize, RepeatingTextureColor]}),
    ).toThrow(/requires feature "segmentEnd"/);
  });

  test('reads the base uv of a vertex as the context hands it', () => {
    // a uv the context hands out stands for every uv stage a kind may bring
    const {ctx} = contextSampling(new Texture(), frameOf(0));
    const staged = {...ctx, uv: vec2(attribute<'float'>('u'), 0.5) as unknown as Node<'vec2'>};

    const color = RepeatingTextureColor.colorSource!(staged.frame, staged);

    expect(attributeNamesOf(color)).toContain('u');
  });
});
