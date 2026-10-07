import {cameraPosition, modelWorldMatrixInverse, vec3} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

import {attributeNamesOf, nodesOf, operatorOf, stubShaderContext} from '../../testing/spriteGraph.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {QuadBase} from '../SpriteBase.js';
import {BillboardPlacement} from './BillboardPlacement.js';
import {FlatPlacement} from './FlatPlacement.js';
import {InstancePosition} from './InstancePosition.js';

const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement]});
const makeSprite = () => {
  const pool = new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 1);
  return {pool, sprite: pool.createVO()!};
};

describe('InstancePosition', () => {
  test('declares the dynamic instancePosition attribute and the usage word position', () => {
    expect(InstancePosition.name).toBe('instancePosition');
    expect(InstancePosition.attributes).toEqual({instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'}});
    expect(InstancePosition.usageAliases).toEqual({position: ['instancePosition']});
  });

  test('setPosition() writes every value it is given', () => {
    const {pool, sprite} = makeSprite();

    sprite.setPosition(1, 2, 3);

    expect([sprite.x, sprite.y, sprite.z]).toEqual([1, 2, 3]);
    pool.dispose();
  });

  test('setPosition(x, y) keeps the z the sprite has', () => {
    const {pool, sprite} = makeSprite();
    sprite.setPosition(1, 2, 3);

    sprite.setPosition(4, 5);

    expect([sprite.x, sprite.y, sprite.z]).toEqual([4, 5, 3]);
    pool.dispose();
  });

  test('a sprite starts at the origin, whatever its slot held before', () => {
    const {pool, sprite} = makeSprite();
    sprite.setPosition(1, 2, 3);
    pool.freeVO(sprite);

    const again = pool.createVO()!;

    expect([again.x, again.y, again.z]).toEqual([0, 0, 0]);
    pool.dispose();
  });

  test('setPosition() hands its values on in one array', () => {
    const {pool, sprite} = makeSprite();
    const setInstancePosition = vi.spyOn(sprite, 'setInstancePosition');

    sprite.setPosition(0.25, 1.5, 2.5);
    expect(setInstancePosition.mock.calls).toEqual([[[0.25, 1.5, 2.5]]]);
    setInstancePosition.mockClear();
    sprite.setPosition(0.75, 1.25);
    expect(setInstancePosition.mock.calls).toEqual([[[0.75, 1.25]]]);

    pool.dispose();
  });
});

describe('FlatPlacement', () => {
  test('adds the instance position to the local vertex, last', () => {
    const local = vec3(1, 2, 3) as unknown as Node<'vec3'>;

    const placed = operatorOf(FlatPlacement.placement!(local, stubShaderContext()));

    expect(placed.op).toBe('+');
    expect(placed.aNode).toBe(local);
    expect(attributeNamesOf(placed.bNode as Node)).toEqual(['instancePosition']);
    expect(FlatPlacement.requires).toEqual(['instancePosition']);
  });
});

describe('BillboardPlacement', () => {
  test('turns the local vertex about the instance position to the camera, at a scale of 1', () => {
    const local = vec3(1, 2, 0) as unknown as Node<'vec3'>;

    const placed = BillboardPlacement.placement!(local, stubShaderContext());
    const nodes = nodesOf(placed);

    expect(operatorOf(placed).op).toBe('+');
    expect(attributeNamesOf(operatorOf(placed).aNode as Node)).toEqual(['instancePosition']);
    expect(nodes.has(local)).toBe(true);
    expect([...nodes].some((node) => node === cameraPosition)).toBe(true);
    expect([...nodes].some((node) => node === modelWorldMatrixInverse)).toBe(true);
    // the quad arrives scaled already: the graph never reads the quadSize attribute
    expect(attributeNamesOf(placed)).not.toContain('quadSize');
    expect(BillboardPlacement.requires).toEqual(['instancePosition']);
  });

  test('brings nothing but its placement stage, so it can stand in for FlatPlacement', () => {
    const {name, requires, placement, ...rest} = BillboardPlacement;

    expect(Object.keys(rest)).toEqual([]);
    expect([name, requires, typeof placement]).toEqual(['billboardPlacement', ['instancePosition'], 'function']);
  });
});
