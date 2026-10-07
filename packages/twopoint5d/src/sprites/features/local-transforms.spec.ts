import {vec3} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

import {attributeNamesOf, nodesOf, operatorOf, stubShaderContext} from '../../testing/spriteGraph.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {QuadBase} from '../SpriteBase.js';
import {LocalOrder} from '../SpriteFeature.js';
import {FlatPlacement} from './FlatPlacement.js';
import {InstancePosition} from './InstancePosition.js';
import {QuadSize} from './QuadSize.js';
import {Rotation} from './Rotation.js';
import {Shear} from './Shear.js';

const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, Rotation, Shear]});
const makePool = () => new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 2);
const local = () => vec3(1, 2, 3) as unknown as Node<'vec3'>;

describe('QuadSize', () => {
  test('declares the static quadSize attribute, the usage word size and the scale band', () => {
    expect(QuadSize.attributes).toEqual({quadSize: {components: ['width', 'height']}});
    expect(QuadSize.usageAliases).toEqual({size: ['quadSize']});
    expect(QuadSize.local!.order).toBe(LocalOrder.Scale);
  });

  test('setSize() writes width and height, in one array', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;
    const setQuadSize = vi.spyOn(sprite, 'setQuadSize');

    sprite.setSize(0.25, 0.75);

    expect([sprite.width, sprite.height]).toEqual([0.25, 0.75]);
    expect(setQuadSize.mock.calls).toEqual([[[0.25, 0.75]]]);
    pool.dispose();
  });

  test('scales the local vertex by the size, z by 1', () => {
    const input = local();

    const scaled = operatorOf(QuadSize.local!.transform(input, stubShaderContext()));

    expect(scaled.op).toBe('*');
    expect(scaled.aNode).toBe(input);
    expect(attributeNamesOf(scaled.bNode as Node)).toEqual(['quadSize']);
  });
});

describe('Rotation', () => {
  test('declares the dynamic rotation attribute and the rotate band', () => {
    expect(Rotation.attributes).toEqual({rotation: {size: 1, usage: 'dynamic'}});
    expect(Rotation.local!.order).toBe(LocalOrder.Rotate);
  });

  test('turns the local vertex about z by the rotation', () => {
    const input = local();

    const turned = Rotation.local!.transform(input, stubShaderContext());

    expect(nodesOf(turned).has(input)).toBe(true);
    expect(attributeNamesOf(turned)).toEqual(['rotation']);
  });
});

describe('Shear', () => {
  test('declares the dynamic shear attribute and the shear band', () => {
    expect(Shear.attributes).toEqual({shear: {components: ['shearX', 'shearY'], usage: 'dynamic'}});
    expect(Shear.local!.order).toBe(LocalOrder.Shear);
  });

  test('setShear() writes both values', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;

    sprite.setShear(0.5, -0.25);

    expect([sprite.shearX, sprite.shearY]).toEqual([0.5, -0.25]);
    pool.dispose();
  });

  test('shears x by y and y by x, keeps z', () => {
    const input = local();

    const sheared = Shear.local!.transform(input, stubShaderContext());

    expect(nodesOf(sheared).has(input)).toBe(true);
    expect(attributeNamesOf(sheared)).toEqual(['shear']);
  });
});

describe('a sprite out of a pool of the three features', () => {
  test('starts with size, rotation and shear at 0, whatever its slot held before', () => {
    const pool = makePool();
    const sprite = pool.createVO()!;
    sprite.setSize(4, 5);
    sprite.rotation = 1;
    sprite.setShear(0.5, 0.5);
    pool.freeVO(sprite);

    const again = pool.createVO()!;

    expect([again.width, again.height, again.rotation, again.shearX, again.shearY]).toEqual([0, 0, 0, 0, 0]);
    pool.dispose();
  });
});
