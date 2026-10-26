import {uniform, vec3} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {evaluateNode, stubShaderContext} from '../../testing/spriteGraph.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {FeatureSpritesGeometry} from '../FeatureSprites/FeatureSpritesGeometry.js';
import {MirrorAtPlane} from '../passes/MirrorAtPlane.js';
import {passFeatures} from '../passes/passFeatures.js';
import {ReflectionPass, ShadowPass} from '../passes/passPresets.js';
import {PlanarShadow} from '../passes/PlanarShadow.js';
import {QuadBase} from '../SpriteBase.js';
import {MeshOrder} from '../SpriteFeature.js';
import {buildSpritePipeline} from '../spritePipeline.js';
import {FlatPlacement} from './FlatPlacement.js';
import {InstancePosition} from './InstancePosition.js';
import {QuadSize} from './QuadSize.js';
import {Visible} from './Visible.js';
import {wave} from './Wave.js';

const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, Visible]});
const makePool = () => new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 1);

// a context whose visible attribute is a uniform of the value given, so evaluateNode() works the stage out
const visibleContext = (visible: number) => ({
  ...stubShaderContext(),
  attribute: <T extends string>() => uniform(visible) as unknown as Node<T>,
});

// + 0 turns the -0 of a negative coordinate times 0 into 0
const collapse = (visible: number) =>
  (evaluateNode(Visible.mesh!.transform(vec3(1, -2, 3) as unknown as Node<'vec3'>, visibleContext(visible))) as number[]).map(
    (value) => value + 0,
  );

describe('Visible', () => {
  test('declares a static visible attribute and a mesh stage in the hide band', () => {
    expect(Visible.name).toBe('visible');
    expect(Visible.attributes).toEqual({visible: {size: 1}});
    expect(Visible.mesh!.order).toBe(MeshOrder.Hide);
  });

  test('a sprite starts visible, whatever its slot held before', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;
    sprite.visible = 0;
    pool.freeVO(sprite);

    expect(pool.createVO()!.visible).toBe(1);
    pool.dispose();
  });

  test('hiding a sprite leaves its other values as they are', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;
    sprite.setSize(4, 2);
    sprite.visible = 0;

    expect([sprite.width, sprite.height]).toEqual([4, 2]);
    pool.dispose();
  });

  test('keeps the vertex where it is from 0.5 up and moves it to the origin below', () => {
    expect(collapse(1)).toEqual([1, -2, 3]);
    expect(collapse(0.5)).toEqual([1, -2, 3]);
    expect(collapse(0.49)).toEqual([0, 0, 0]);
    expect(collapse(0)).toEqual([0, 0, 0]);
  });

  test('a geometry may take visible as a dynamic attribute', () => {
    const geometry = new FeatureSpritesGeometry(kind, {capacity: 1, attributeUsage: {dynamic: ['visible']}});

    expect(geometry.instancedPool.descriptor.getAttribute('visible')!.usageType).toBe('dynamic');
    geometry.dispose();
  });

  test('runs after every other mesh stage of the kind, listed first or last', () => {
    for (const features of [
      [Visible, InstancePosition, FlatPlacement, wave({weight: 'uniform'})],
      [InstancePosition, FlatPlacement, wave({weight: 'uniform'}), Visible],
    ]) {
      const pipeline = defineSprite({base: QuadBase, features}).pipeline;

      expect(pipeline.mesh.map(({name}) => name)).toEqual(['wave', 'visible']);
    }
  });

  test('runs after the projection of ShadowPass and the mirror of ReflectionPass', () => {
    for (const [pass, stage] of [
      [ShadowPass, PlanarShadow],
      [ReflectionPass, MirrorAtPlane],
    ] as const) {
      const pipeline = buildSpritePipeline(passFeatures(kind, pass, 'spec'), 'spec');

      expect(pipeline.mesh.map(({name}) => name)).toEqual([stage.name, 'visible']);
    }
  });
});
