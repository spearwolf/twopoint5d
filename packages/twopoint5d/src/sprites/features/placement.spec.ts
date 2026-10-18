import {cameraPosition, modelWorldMatrixInverse, uniform, vec3} from 'three/tsl';
import {Euler, type Node, Vector3} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

import {attributeNamesOf, evaluateNode, nodesOf, operatorOf, stubShaderContext} from '../../testing/spriteGraph.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {QuadBase} from '../SpriteBase.js';
import {BillboardPlacement} from './BillboardPlacement.js';
import {FeatureSpritesGeometry} from '../FeatureSprites/FeatureSpritesGeometry.js';
import type {SpriteFeature} from '../SpriteFeature.js';
import {FlatPlacement, type FlatPlacementOptions, flatPlacement, GroundPlacement} from './FlatPlacement.js';
import {InstancePosition} from './InstancePosition.js';
import {Yaw} from './Yaw.js';

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

// a context whose attributes are uniforms of the values given, so evaluateNode() works the graph out
const valuedContext = (values: Record<string, number | readonly number[]>) => {
  const context = stubShaderContext();
  return {
    ...context,
    attribute: <T extends string>(name: string) => {
      const value = values[name];
      if (value == null) throw new Error(`no value for the attribute "${name}"`);
      return (typeof value === 'number' ? uniform(value) : uniform(new Vector3(...value))) as unknown as Node<T>;
    },
  };
};

const placedAt = (feature: SpriteFeature, local: readonly number[], values: Record<string, number | readonly number[]>) =>
  evaluateNode(feature.placement!(vec3(...local) as unknown as Node<'vec3'>, valuedContext(values))) as number[];

const closeTo = (actual: number[], expected: Vector3) => {
  expect(actual).toHaveLength(3);
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected.getComponent(i), 6));
};

describe('flatPlacement()', () => {
  test('answers one feature per set of options: FlatPlacement and GroundPlacement among them', () => {
    expect(flatPlacement()).toBe(FlatPlacement);
    expect(flatPlacement({})).toBe(FlatPlacement);
    expect(flatPlacement({plane: 'xy'})).toBe(FlatPlacement);
    expect(flatPlacement({plane: 'xz'})).toBe(GroundPlacement);
    expect(flatPlacement({orientation: 'yaw'})).toBe(flatPlacement({plane: 'xy', orientation: 'yaw'}));
    expect(flatPlacement({plane: 'xz', orientation: 'yaw'})).toBe(flatPlacement({orientation: 'yaw', plane: 'xz'}));
    expect(Object.isFrozen(GroundPlacement)).toBe(true);
  });

  test.each([
    [{}, 'flatPlacement', ['instancePosition']],
    [{plane: 'xz'}, 'groundPlacement', ['instancePosition']],
    [{orientation: 'yaw'}, 'flatPlacement+yaw', ['instancePosition', 'yaw']],
    [{plane: 'xz', orientation: 'yaw'}, 'groundPlacement+yaw', ['instancePosition', 'yaw']],
  ] as [FlatPlacementOptions, string, string[]][])('%o is named %s and requires %o', (options, name, requires) => {
    const feature = flatPlacement(options);

    expect(feature.name).toBe(name);
    expect(feature.requires).toEqual(requires);
  });

  test.each([{}, {plane: 'xz'}, {orientation: 'yaw'}, {plane: 'xz', orientation: 'yaw'}] as FlatPlacementOptions[])(
    '%o brings nothing but its placement stage, so it can stand in for another placement',
    (options) => {
      const {name, requires, placement, ...rest} = flatPlacement(options);

      expect(Object.keys(rest)).toEqual([]);
      expect([typeof name, Array.isArray(requires), typeof placement]).toEqual(['string', true, 'function']);
    },
  );

  test('refuses a plane or an orientation it does not know', () => {
    expect(() => flatPlacement({plane: 'yz' as 'xy'})).toThrow(
      new TypeError(`flatPlacement: the plane "yz" is neither 'xy' nor 'xz'`),
    );
    expect(() => flatPlacement({orientation: 'quaternion' as 'yaw'})).toThrow(
      new TypeError(`flatPlacement: the orientation "quaternion" is not 'yaw'`),
    );
  });

  test('reads the yaw attribute only with the yaw', () => {
    const local = vec3(1, 2, 3) as unknown as Node<'vec3'>;

    expect(attributeNamesOf(GroundPlacement.placement!(local, stubShaderContext()))).toEqual(['instancePosition']);
    expect(attributeNamesOf(flatPlacement({orientation: 'yaw'}).placement!(local, stubShaderContext()))).toEqual([
      'instancePosition',
      'yaw',
    ]);
  });

  test('on the ground: the local vertex turned as a mesh with rotation.x = -π/2 turns it, then moved', () => {
    const turned = new Vector3(1, 2, 3).applyEuler(new Euler(-Math.PI / 2, 0, 0)).add(new Vector3(10, 20, 30));

    closeTo(placedAt(GroundPlacement, [1, 2, 3], {instancePosition: [10, 20, 30]}), turned);
    // the top of the image, +y of the quad, points to -z
    closeTo(placedAt(GroundPlacement, [0, 1, 0], {instancePosition: [0, 0, 0]}), new Vector3(0, 0, -1));
  });

  test.each([0.7, Math.PI / 2, -2.1])('a yaw of %d turns as Object3D.rotation.y turns', (yaw) => {
    const instancePosition = [10, 20, 30] as const;
    const upright = new Vector3(1, 2, 3).applyEuler(new Euler(0, yaw, 0)).add(new Vector3(...instancePosition));
    const grounded = new Vector3(1, 2, 3)
      .applyEuler(new Euler(-Math.PI / 2, 0, 0))
      .applyEuler(new Euler(0, yaw, 0))
      .add(new Vector3(...instancePosition));

    closeTo(placedAt(flatPlacement({orientation: 'yaw'}), [1, 2, 3], {instancePosition, yaw}), upright);
    closeTo(placedAt(flatPlacement({plane: 'xz', orientation: 'yaw'}), [1, 2, 3], {instancePosition, yaw}), grounded);
  });

  test('a kind with the yaw placement and without Yaw is refused, naming both', () => {
    expect(() => defineSprite({base: QuadBase, features: [InstancePosition, flatPlacement({orientation: 'yaw'})]})).toThrow(
      'defineSprite: feature "flatPlacement+yaw" requires feature "yaw", which this sprite kind does not hold',
    );
  });
});

describe('Yaw', () => {
  const yawKind = defineSprite({base: QuadBase, features: [InstancePosition, flatPlacement({orientation: 'yaw'}), Yaw]});

  test('declares the static yaw attribute and no stage', () => {
    const {name, attributes, initialize, __api, ...rest} = Yaw;

    expect([name, attributes]).toEqual(['yaw', {yaw: {size: 1}}]);
    expect(typeof initialize).toBe('function');
    expect(Object.keys(rest)).toEqual([]);
  });

  test('a sprite starts with a yaw of 0, whatever its slot held before', () => {
    const pool = new VertexObjectPool<SpriteOf<typeof yawKind>>(yawKind.description, 1);
    const sprite = pool.createVO()!;
    sprite.yaw = 1.5;
    pool.freeVO(sprite);

    expect(pool.createVO()!.yaw).toBe(0);
    pool.dispose();
  });

  test('takes the dynamic usage by its attribute name', () => {
    const geometry = new FeatureSpritesGeometry(yawKind, {capacity: 1, attributeUsage: {dynamic: ['yaw']}});

    expect(geometry.instancedPool.descriptor.getAttribute('yaw')!.usageType).toBe('dynamic');
    geometry.dispose();
  });
});
