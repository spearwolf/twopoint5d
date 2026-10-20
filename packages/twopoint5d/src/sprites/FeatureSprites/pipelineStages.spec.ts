import {Texture} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {graphSignature} from '../../testing/spriteGraph.js';
import {defineSprite, type SpriteKind} from '../defineSprite.js';
import {TextureColor} from '../features/TextureColor.js';
import {frameUv} from '../frameUv.js';
import type {SpritePass} from '../passes/definePass.js';
import {ReflectionPass, ShadowPass} from '../passes/passPresets.js';
import {AnimatedSpriteKind, TexturedSpriteKind} from '../presets.js';
import {defineFeature} from '../SpriteFeature.js';
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
