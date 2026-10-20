import {add, attribute, vec2, vec4} from 'three/tsl';
import {type Node, Texture} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {attributeNamesOf, evaluateNode, graphSignature, nodesOf, samplesTexture} from '../../testing/spriteGraph.js';
import {defineSprite, type SpriteKind} from '../defineSprite.js';
import {AtlasFrame} from '../features/AtlasFrame.js';
import {FlatPlacement} from '../features/FlatPlacement.js';
import {InstancePosition} from '../features/InstancePosition.js';
import {TextureColor} from '../features/TextureColor.js';
import {frameUv} from '../frameUv.js';
import {definePass, type SpritePass} from '../passes/definePass.js';
import {ReflectionPass, ShadowPass} from '../passes/passPresets.js';
import {AnimatedSpriteKind, TexturedSpriteKind} from '../presets.js';
import {QuadBase} from '../SpriteBase.js';
import {defineFeature, type SpriteFeature, type SpriteFrameNodes} from '../SpriteFeature.js';
import {FeatureSpritesMaterial} from './FeatureSpritesMaterial.js';

const withImage = (width = 4, height = 4) => {
  const texture = new Texture();
  texture.image = {width, height} as unknown as HTMLImageElement;
  return texture;
};

// TextureColor as it was before the uv stages: it sampled at the base uv attribute
const LegacyTextureColor = defineFeature({
  name: 'textureColor',
  textures: {colorMap: {}},
  colorSource: (frame, {attribute, sample}) =>
    sample('colorMap', frameUv(frame.texCoords, attribute<'vec2'>('uv'), frame.flipDiagonal)),
});

const withLegacyColor = (kind: SpriteKind): SpriteKind =>
  defineSprite({
    base: kind.base,
    features: kind.features.map((feature) => (feature === TextureColor ? LegacyTextureColor : feature)),
  });

describe('the pipeline stages', () => {
  describe('the kinds of today build the graphs they built before', () => {
    const cases: [string, SpriteKind, Record<string, Texture>][] = [
      ['TexturedSpriteKind', TexturedSpriteKind, {colorMap: new Texture()}],
      ['AnimatedSpriteKind without an animsMap', AnimatedSpriteKind, {colorMap: new Texture()}],
      ['AnimatedSpriteKind', AnimatedSpriteKind, {colorMap: new Texture(), animsMap: withImage()}],
    ];
    const passes: [string, SpritePass | undefined][] = [
      ['the sprites', undefined],
      ['ShadowPass', ShadowPass],
      ['ReflectionPass', ReflectionPass],
    ];

    for (const [kindName, kind, textures] of cases) {
      for (const [passName, pass] of passes) {
        test(`${kindName}, ${passName}: the color graph samples at the base uv`, () => {
          const material = new FeatureSpritesMaterial(kind, pass == null ? {textures} : {textures, pass});
          const legacy = new FeatureSpritesMaterial(withLegacyColor(kind), pass == null ? {textures} : {textures, pass});

          expect(graphSignature(material.colorNode!)).toBe(graphSignature(legacy.colorNode!));
          expect(graphSignature(material.positionNode!)).toBe(graphSignature(legacy.positionNode!));
          material.dispose();
          legacy.dispose();
        });
      }
    }
  });
});

const calls: string[] = [];
afterEach(() => {
  calls.length = 0;
});

const vec4Of = (...values: [number, number, number, number]) => vec4(...values) as unknown as Node<'vec4'>;

// a frame stage that records its call and adds `delta` to the tex coords it is handed
const shifting = (name: string, order: number, delta: number, extra: Partial<SpriteFeature> = {}): SpriteFeature =>
  defineFeature({
    name,
    ...extra,
    frameStage: {
      order,
      transform: (frame) => {
        calls.push(name);
        return {...frame, texCoords: add(frame.texCoords, delta) as unknown as Node<'vec4'>};
      },
    },
  });

// a uv stage that records its call and adds `delta` to the uv it is handed
const uvShifting = (name: string, order: number, delta: number, extra: Partial<SpriteFeature> = {}): SpriteFeature =>
  defineFeature({
    name,
    ...extra,
    uv: {
      order,
      transform: (uv) => {
        calls.push(name);
        return add(uv, delta) as unknown as Node<'vec2'>;
      },
    },
  });

const kindOf = (...features: SpriteFeature[]) =>
  defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, ...features]});

describe('frame stages', () => {
  test('run after the frame slot, by order and then by the feature list', () => {
    const frameSlot = defineFeature({
      name: 'slot',
      frame: () => {
        calls.push('slot');
        return {texCoords: vec4Of(1, 2, 3, 4)};
      },
    });
    const material = new FeatureSpritesMaterial(
      kindOf(frameSlot, shifting('late', 200, 100), shifting('early', 100, 10), shifting('tie', 100, 1)),
    );

    expect(calls).toEqual(['slot', 'early', 'tie', 'late']);
    material.dispose();
  });

  test('run on the defaults when the kind has no frame feature', () => {
    let seen: SpriteFrameNodes | undefined;
    const probe = defineFeature({
      name: 'probe',
      frameStage: {
        order: 0,
        transform: (frame) => {
          seen = frame;
          return frame;
        },
      },
    });
    const material = new FeatureSpritesMaterial(kindOf(probe));

    expect(evaluateNode(seen!.texCoords)).toEqual([0, 0, 1, 1]);
    material.dispose();
  });

  test('hand their result to the trim shift and to the color source', () => {
    const texCoords = vec4Of(0.25, 0, 0.5, 1);
    const trim = vec4Of(0.1, 0, 0, 0);
    const replacing = defineFeature({name: 'replacing', frameStage: {order: 0, transform: () => ({texCoords, trim})}});
    const material = new FeatureSpritesMaterial(kindOf(AtlasFrame, replacing, TextureColor), {
      textures: {colorMap: new Texture()},
    });

    expect(nodesOf(material.positionNode!).has(trim)).toBe(true);
    expect(nodesOf(material.colorNode!).has(texCoords)).toBe(true);
    expect(attributeNamesOf(material.colorNode!)).not.toContain('texCoords');
    material.dispose();
  });

  test('leave the frame a color source gets as the frame slot answered it, without a frame stage', () => {
    const answered: SpriteFrameNodes = {texCoords: vec4Of(0, 0, 1, 1)};
    let got: SpriteFrameNodes | undefined;
    const slot = defineFeature({name: 'slot', frame: () => answered});
    const source = defineFeature({
      name: 'source',
      colorSource: (frame) => {
        got = frame;
        return frame.texCoords;
      },
    });
    const material = new FeatureSpritesMaterial(kindOf(slot, source));

    expect(got).toBe(answered);
    material.dispose();
  });

  test('a frame stage whose texture is unset drops out until it is set', () => {
    const waiting = shifting('waiting', 0, 1, {textures: {flipMap: {}}});
    const material = new FeatureSpritesMaterial(kindOf(waiting));

    expect(calls).toEqual([]);
    material.setTexture('flipMap', new Texture());
    expect(calls).toEqual(['waiting']);
    material.dispose();
  });

  test('its lookups take a new texture of the same kind without a rebuild', () => {
    const sampling = defineFeature({
      name: 'sampling',
      textures: {flipMap: {}},
      frameStage: {order: 0, transform: (frame, {sample}) => ({...frame, trim: sample('flipMap', vec2(0, 0) as never)})},
    });
    const first = new Texture();
    const second = new Texture();
    const material = new FeatureSpritesMaterial(kindOf(sampling), {textures: {flipMap: first}});
    const positionNode = material.positionNode;

    material.setTexture('flipMap', second);

    expect(material.positionNode).toBe(positionNode);
    expect(samplesTexture(material.positionNode!, second)).toBe(true);
    material.dispose();
  });

  test('a pass brings a frame stage of its own', () => {
    const material = new FeatureSpritesMaterial(TexturedSpriteKind, {
      pass: definePass({name: 'p', features: [shifting('passStage', 0, 1)]}),
    });

    expect(calls).toEqual(['passStage']);
    material.dispose();
  });
});

describe('uv stages and ctx.uv', () => {
  test('run by order and then by the feature list, and the color source samples at their result', () => {
    const material = new FeatureSpritesMaterial(
      kindOf(AtlasFrame, uvShifting('late', 200, 100), uvShifting('early', 100, 10), uvShifting('tie', 100, 1), TextureColor),
      {textures: {colorMap: new Texture()}},
    );

    expect(calls).toEqual(['early', 'tie', 'late']);
    material.dispose();
  });

  test('ctx.uv is the base uv after the uv stages; in a uv stage it is the stage input', () => {
    let inStage: {input: Node; uv: Node} | undefined;
    let inSource: Node | undefined;
    const marker = vec2(7, 7) as unknown as Node<'vec2'>;
    const stage = defineFeature({
      name: 'stage',
      uv: {
        order: 0,
        transform: (input, ctx) => {
          inStage = {input, uv: ctx.uv};
          return marker;
        },
      },
    });
    const source = defineFeature({
      name: 'source',
      colorSource: (_frame, ctx) => {
        inSource = ctx.uv;
        return vec4Of(1, 1, 1, 1);
      },
    });
    const material = new FeatureSpritesMaterial(kindOf(stage, source));

    expect(inStage!.uv).toBe(inStage!.input);
    expect(attributeNamesOf(inStage!.input)).toEqual(['uv']);
    expect(inSource).toBe(marker);
    material.dispose();
  });

  test('is the base uv attribute without uv stages', () => {
    let uv: Node | undefined;
    const source = defineFeature({
      name: 'source',
      colorSource: (_frame, ctx) => {
        uv = ctx.uv;
        return vec4Of(1, 1, 1, 1);
      },
    });
    const material = new FeatureSpritesMaterial(kindOf(source));

    expect(graphSignature(uv!)).toBe(graphSignature(attribute('uv') as unknown as Node));
    material.dispose();
  });

  test('builds the uv stages once per graph that reads ctx.uv, and not for a graph that does not', () => {
    const twice = defineFeature({
      name: 'twice',
      colorSource: (_frame, ctx) => add(vec4(ctx.uv, 0, 0), vec4(ctx.uv, 0, 0)) as unknown as Node<'vec4'>,
    });
    const material = new FeatureSpritesMaterial(kindOf(uvShifting('stage', 0, 1), twice));

    expect(calls).toEqual(['stage']);
    material.dispose();
  });

  test('a stage of the position graph that reads ctx.uv builds the uv stages there as well', () => {
    const reader = defineFeature({
      name: 'reader',
      local: {order: 0, transform: (position, ctx) => add(position, vec4(ctx.uv, 0, 0).xyz) as unknown as Node<'vec3'>},
    });
    const material = new FeatureSpritesMaterial(kindOf(uvShifting('stage', 0, 1), reader));

    expect(calls).toEqual(['stage']);
    material.dispose();
  });

  test('a uv stage whose texture is unset drops out until it is set', () => {
    const material = new FeatureSpritesMaterial(kindOf(uvShifting('waiting', 0, 1, {textures: {warpMap: {}}}), TextureColor), {
      textures: {colorMap: new Texture()},
    });

    expect(calls).toEqual([]);
    material.setTexture('warpMap', new Texture());
    expect(calls).toEqual(['waiting']);
    material.dispose();
  });

  test('a pass brings a uv stage of its own', () => {
    const material = new FeatureSpritesMaterial(TexturedSpriteKind, {
      textures: {colorMap: new Texture()},
      pass: definePass({name: 'p', features: [uvShifting('passUv', 0, 1)]}),
    });

    expect(calls).toEqual(['passUv']);
    material.dispose();
  });
});
