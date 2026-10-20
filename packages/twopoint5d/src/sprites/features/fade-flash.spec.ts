import {uniform} from 'three/tsl';
import {type Node, Vector4} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {evaluateNode, stubShaderContext} from '../../testing/spriteGraph.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {FeatureSpritesGeometry} from '../FeatureSprites/FeatureSpritesGeometry.js';
import {passFeatures} from '../passes/passFeatures.js';
import {ReflectionPass, ShadowPass} from '../passes/passPresets.js';
import {QuadBase} from '../SpriteBase.js';
import {ColorOrder} from '../SpriteFeature.js';
import {buildSpritePipeline} from '../spritePipeline.js';
import {Fade} from './Fade.js';
import {FlatPlacement} from './FlatPlacement.js';
import {Flash} from './Flash.js';
import {InstancePosition} from './InstancePosition.js';
import {Tint} from './Tint.js';

const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, Tint, Fade, Flash]});
const makePool = () => new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 1);

// a context whose attributes are uniforms of the values given, so evaluateNode() works a stage out
const valuedContext = (values: Record<string, number | readonly [number, number, number, number]>) => ({
  ...stubShaderContext(),
  attribute: <T extends string>(name: string) => {
    const value = values[name]!;
    return (typeof value === 'number' ? uniform(value) : uniform(new Vector4(...value))) as unknown as Node<T>;
  },
});

const color = () => uniform(new Vector4(0.2, 0.4, 0.6, 0.8)) as unknown as Node<'vec4'>;

const closeTo = (actual: unknown, expected: number[]) => {
  expect(actual).toHaveLength(expected.length);
  (actual as number[]).forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 6));
};

describe('Fade', () => {
  test('declares a dynamic fade attribute and a color stage in the fade band', () => {
    expect(Fade.name).toBe('fade');
    expect(Fade.attributes).toEqual({fade: {size: 1, usage: 'dynamic'}});
    expect(Fade.color!.order).toBe(ColorOrder.Fade);
  });

  test('a sprite starts unfaded, whatever its slot held before', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;
    sprite.fade = 0.25;
    pool.freeVO(sprite);

    expect(pool.createVO()!.fade).toBe(1);
    pool.dispose();
  });

  test('multiplies the alpha by the fade and keeps the rgb', () => {
    closeTo(evaluateNode(Fade.color!.transform(color(), valuedContext({fade: 0.5}))), [0.2, 0.4, 0.6, 0.4]);
  });

  test('a geometry may take the fade as a static attribute', () => {
    const geometry = new FeatureSpritesGeometry(kind, {capacity: 1, attributeUsage: {static: ['fade']}});

    expect(geometry.instancedPool.descriptor.getAttribute('fade')!.usageType).toBe('static');
    geometry.dispose();
  });
});

describe('Flash', () => {
  test('declares a dynamic flash attribute of four values and a color stage in the flash band', () => {
    expect(Flash.name).toBe('flash');
    expect(Flash.attributes).toEqual({
      flash: {components: ['flashR', 'flashG', 'flashB', 'flashAmount'], usage: 'dynamic'},
    });
    expect(Flash.color!.order).toBe(ColorOrder.Flash);
  });

  test('a sprite starts with a white flash that is not mixed in, whatever its slot held before', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;
    sprite.setFlash(0.5, 0.25, 0, 1);
    pool.freeVO(sprite);

    const again = pool.createVO()!;

    expect([again.flashR, again.flashG, again.flashB, again.flashAmount]).toEqual([1, 1, 1, 0]);
    pool.dispose();
  });

  test('setFlash() writes the color and the amount; a tuple of three keeps the amount', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;

    sprite.setFlash(0.5, 0.25, 0.125, 0.75);
    expect([sprite.flashR, sprite.flashG, sprite.flashB, sprite.flashAmount]).toEqual([0.5, 0.25, 0.125, 0.75]);
    sprite.setFlash([1, 0, 0]);
    expect([sprite.flashR, sprite.flashG, sprite.flashB, sprite.flashAmount]).toEqual([1, 0, 0, 0.75]);
    pool.dispose();
  });

  test('mixes the rgb towards the flash color by the amount and keeps the alpha', () => {
    const ctx = (flash: [number, number, number, number]) => valuedContext({flash});

    closeTo(evaluateNode(Flash.color!.transform(color(), ctx([1, 1, 1, 0.5]))), [0.6, 0.7, 0.8, 0.8]);
    closeTo(evaluateNode(Flash.color!.transform(color(), ctx([1, 0, 0, 0]))), [0.2, 0.4, 0.6, 0.8]);
    closeTo(evaluateNode(Flash.color!.transform(color(), ctx([4, 4, 4, 1]))), [4, 4, 4, 0.8]);
  });
});

describe('Fade and Flash under the passes', () => {
  test('the color stages of ShadowPass and ReflectionPass run after those of the kind', () => {
    for (const pass of [ShadowPass, ReflectionPass]) {
      const pipeline = buildSpritePipeline(passFeatures(kind, pass, 'spec'), 'spec');

      expect(pipeline.color.map(({name}) => name)).toEqual([
        'tint',
        'fade',
        'flash',
        pass === ShadowPass ? 'shadowMask' : 'darken',
      ]);
    }
  });
});
