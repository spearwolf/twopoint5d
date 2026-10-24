import {cameraPosition, modelViewMatrix, modelWorldMatrixInverse, uniform, vec3} from 'three/tsl';
import {Euler, type Node, Quaternion, Vector3, Vector4} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

import {attributeNamesOf, evaluateNode, nodesOf, operatorOf, stubShaderContext} from '../../testing/spriteGraph.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {QuadBase} from '../SpriteBase.js';
import {AxisBillboardPlacement, axisBillboardPlacement} from './AxisBillboardPlacement.js';
import {axisBillboardVertex} from './axisBillboardVertex.js';
import {BillboardPlacement} from './BillboardPlacement.js';
import {FeatureSpritesGeometry} from '../FeatureSprites/FeatureSpritesGeometry.js';
import type {SpriteFeature} from '../SpriteFeature.js';
import {FlatPlacement, type FlatPlacementOptions, flatPlacement, GroundPlacement} from './FlatPlacement.js';
import {InstancePosition} from './InstancePosition.js';
import {Orientation} from './Orientation.js';
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
      if (typeof value === 'number') return uniform(value) as unknown as Node<T>;
      return (value.length === 4 ? uniform(new Vector4(...value)) : uniform(new Vector3(...value))) as unknown as Node<T>;
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
    expect(flatPlacement({orientation: 'quaternion'})).toBe(flatPlacement({plane: 'xy', orientation: 'quaternion'}));
    expect(flatPlacement({plane: 'xz', orientation: 'quaternion'})).not.toBe(flatPlacement({plane: 'xz', orientation: 'yaw'}));
    expect(Object.isFrozen(GroundPlacement)).toBe(true);
  });

  test.each([
    [{}, 'flatPlacement', ['instancePosition']],
    [{plane: 'xz'}, 'groundPlacement', ['instancePosition']],
    [{orientation: 'yaw'}, 'flatPlacement+yaw', ['instancePosition', 'yaw']],
    [{plane: 'xz', orientation: 'yaw'}, 'groundPlacement+yaw', ['instancePosition', 'yaw']],
    [{orientation: 'quaternion'}, 'flatPlacement+quaternion', ['instancePosition', 'orientation']],
    [{plane: 'xz', orientation: 'quaternion'}, 'groundPlacement+quaternion', ['instancePosition', 'orientation']],
  ] as [FlatPlacementOptions, string, string[]][])('%o is named %s and requires %o', (options, name, requires) => {
    const feature = flatPlacement(options);

    expect(feature.name).toBe(name);
    expect(feature.requires).toEqual(requires);
  });

  test.each([
    {},
    {plane: 'xz'},
    {orientation: 'yaw'},
    {plane: 'xz', orientation: 'yaw'},
    {orientation: 'quaternion'},
    {plane: 'xz', orientation: 'quaternion'},
  ] as FlatPlacementOptions[])(
    '%o brings nothing but its placement stage, so it can stand in for another placement',
    (options) => {
      const {name, requires, placement, ...rest} = flatPlacement(options);

      expect(Object.keys(rest)).toEqual([]);
      expect([typeof name, Array.isArray(requires), typeof placement]).toEqual(['string', true, 'function']);
    },
  );

  test.each([
    [5, '5'],
    ['x', '"x"'],
    [null, 'null'],
  ])('refuses options of %o that are no object', (options, shown) => {
    expect(() => flatPlacement(options as never)).toThrow(TypeError);
    expect(() => flatPlacement(options as never)).toThrow(
      `flatPlacement: the options must be an object, {plane?, orientation?}, got ${shown}`,
    );
  });

  test('takes options that are undefined', () => {
    expect(() => flatPlacement(undefined)).not.toThrow();
  });

  test('refuses a plane or an orientation it does not know', () => {
    expect(() => flatPlacement({plane: 'yz' as 'xy'})).toThrow(
      new TypeError(`flatPlacement: the plane "yz" is neither 'xy' nor 'xz'`),
    );
    expect(() => flatPlacement({orientation: 'roll' as 'yaw'})).toThrow(
      new TypeError(`flatPlacement: the orientation "roll" is neither 'yaw' nor 'quaternion'`),
    );
    expect(() => flatPlacement({plane: NaN as unknown as 'xy'})).toThrow(
      new TypeError(`flatPlacement: the plane NaN is neither 'xy' nor 'xz'`),
    );
    expect(() => flatPlacement({orientation: NaN as unknown as 'yaw'})).toThrow(
      new TypeError(`flatPlacement: the orientation NaN is neither 'yaw' nor 'quaternion'`),
    );
    // a BigInt, which JSON.stringify() cannot write, is shown with its n
    expect(() => flatPlacement({plane: 1n as unknown as 'xy'})).toThrow(
      new TypeError(`flatPlacement: the plane 1n is neither 'xy' nor 'xz'`),
    );
  });

  test('reads the yaw or the orientation attribute only with its orientation', () => {
    const local = vec3(1, 2, 3) as unknown as Node<'vec3'>;

    expect(attributeNamesOf(GroundPlacement.placement!(local, stubShaderContext()))).toEqual(['instancePosition']);
    expect(attributeNamesOf(flatPlacement({orientation: 'yaw'}).placement!(local, stubShaderContext()))).toEqual([
      'instancePosition',
      'yaw',
    ]);
    expect(attributeNamesOf(flatPlacement({orientation: 'quaternion'}).placement!(local, stubShaderContext()))).toEqual([
      'instancePosition',
      'orientation',
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

  test.each([
    ['a turn about one tilted axis', new Quaternion().setFromAxisAngle(new Vector3(1, 2, -0.5).normalize(), 1.1)],
    ['a tilt forward, then a yaw', new Quaternion().setFromEuler(new Euler(-0.6, 2.4, 0, 'YXZ'))],
    ['the identity', new Quaternion()],
  ])('%s turns as Object3D.quaternion turns', (_, quaternion) => {
    const instancePosition = [10, 20, 30] as const;
    const orientation = quaternion.toArray();
    const upright = new Vector3(1, 2, 3).applyQuaternion(quaternion).add(new Vector3(...instancePosition));
    const grounded = new Vector3(1, 2, 3)
      .applyEuler(new Euler(-Math.PI / 2, 0, 0))
      .applyQuaternion(quaternion)
      .add(new Vector3(...instancePosition));

    closeTo(placedAt(flatPlacement({orientation: 'quaternion'}), [1, 2, 3], {instancePosition, orientation}), upright);
    closeTo(
      placedAt(flatPlacement({plane: 'xz', orientation: 'quaternion'}), [1, 2, 3], {instancePosition, orientation}),
      grounded,
    );
  });

  test('the quaternion of a turn about +Y places as the yaw of that angle', () => {
    const yaw = -2.1;
    const orientation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw).toArray();

    closeTo(
      placedAt(flatPlacement({orientation: 'quaternion'}), [1, 2, 3], {instancePosition: [0, 0, 0], orientation}),
      new Vector3(...placedAt(flatPlacement({orientation: 'yaw'}), [1, 2, 3], {instancePosition: [0, 0, 0], yaw})),
    );
  });

  test.each([
    ['yaw', 'yaw'],
    ['quaternion', 'orientation'],
  ] as const)('a kind with the %s placement and without its feature is refused, naming both', (orientation, feature) => {
    expect(() => defineSprite({base: QuadBase, features: [InstancePosition, flatPlacement({orientation})]})).toThrow(
      `defineSprite: feature "flatPlacement+${orientation}" requires feature "${feature}", which this sprite kind does not hold`,
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

describe('Orientation', () => {
  const orientedKind = defineSprite({
    base: QuadBase,
    features: [InstancePosition, flatPlacement({orientation: 'quaternion'}), Orientation],
  });
  const makeOriented = () => {
    const pool = new VertexObjectPool<SpriteOf<typeof orientedKind>>(orientedKind.description, 1);
    return {pool, sprite: pool.createVO()!};
  };
  const orientationOf = (sprite: SpriteOf<typeof orientedKind>) => [sprite.qx, sprite.qy, sprite.qz, sprite.qw];

  test('declares the static orientation attribute and no stage', () => {
    const {name, attributes, methods, initialize, __api, ...rest} = Orientation;

    expect([name, attributes]).toEqual(['orientation', {orientation: {components: ['qx', 'qy', 'qz', 'qw']}}]);
    expect(Object.keys(methods!)).toEqual(['setQuaternion', 'getQuaternion', 'setYaw']);
    expect(typeof initialize).toBe('function');
    expect(Object.keys(rest)).toEqual([]);
  });

  test('a sprite starts unturned — the identity (0, 0, 0, 1) — whatever its slot held before', () => {
    const {pool, sprite} = makeOriented();
    sprite.setOrientation(0.5, 0.5, 0.5, 0.5);
    pool.freeVO(sprite);

    expect(orientationOf(pool.createVO()!)).toEqual([0, 0, 0, 1]);
    pool.dispose();
  });

  test('setQuaternion() writes x, y, z and w of the quaternion, and hands them on in one array', () => {
    const {pool, sprite} = makeOriented();
    const setOrientation = vi.spyOn(sprite, 'setOrientation');
    const quaternion = new Quaternion().setFromEuler(new Euler(0.3, -1.2, 0.8));

    sprite.setQuaternion(quaternion);

    expect(setOrientation.mock.calls).toHaveLength(1);
    expect(setOrientation.mock.calls[0]).toHaveLength(1);
    orientationOf(sprite).forEach((value, i) => expect(value).toBeCloseTo(quaternion.toArray()[i]!, 6));
    pool.dispose();
  });

  test('getQuaternion() answers the orientation in the target it is given', () => {
    const {pool, sprite} = makeOriented();
    const quaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.5);
    sprite.setQuaternion(quaternion);
    const target = new Quaternion();

    expect(sprite.getQuaternion(target)).toBe(target);
    expect(target.angleTo(quaternion)).toBeCloseTo(0, 6);
    expect(sprite.getQuaternion()).toBeInstanceOf(Quaternion);
    pool.dispose();
  });

  test.each([0.7, Math.PI / 2, -2.1])('setYaw(%d) writes the quaternion of that turn about +Y', (yaw) => {
    const {pool, sprite} = makeOriented();
    const setOrientation = vi.spyOn(sprite, 'setOrientation');
    const expected = new Quaternion().setFromEuler(new Euler(0, yaw, 0)).toArray();

    sprite.setYaw(yaw);

    expect(setOrientation.mock.calls).toHaveLength(1);
    expect(setOrientation.mock.calls[0]).toHaveLength(1);
    orientationOf(sprite).forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 6));
    pool.dispose();
  });

  test('takes the dynamic usage by its attribute name', () => {
    const geometry = new FeatureSpritesGeometry(orientedKind, {capacity: 1, attributeUsage: {dynamic: ['orientation']}});

    expect(geometry.instancedPool.descriptor.getAttribute('orientation')!.usageType).toBe('dynamic');
    geometry.dispose();
  });
});

describe('axisBillboardPlacement()', () => {
  test.each([
    [5, '5'],
    ['x', '"x"'],
    [null, 'null'],
  ])('refuses options of %o that are no object', (options, shown) => {
    expect(() => axisBillboardPlacement(options as never)).toThrow(TypeError);
    expect(() => axisBillboardPlacement(options as never)).toThrow(
      `axisBillboardPlacement: the options must be an object, {axis?}, got ${shown}`,
    );
  });

  test('takes options that are undefined', () => {
    expect(() => axisBillboardPlacement(undefined)).not.toThrow();
  });

  test('answers one feature per axis: AxisBillboardPlacement for the default', () => {
    expect(axisBillboardPlacement()).toBe(AxisBillboardPlacement);
    expect(axisBillboardPlacement({})).toBe(AxisBillboardPlacement);
    expect(axisBillboardPlacement({axis: 'y'})).toBe(AxisBillboardPlacement);
    expect(axisBillboardPlacement({axis: 'z'})).toBe(axisBillboardPlacement({axis: 'z'}));
    expect(axisBillboardPlacement({axis: 'z'})).not.toBe(AxisBillboardPlacement);
    expect(Object.isFrozen(AxisBillboardPlacement)).toBe(true);
  });

  test('names each form and requires the instance position alone', () => {
    expect(AxisBillboardPlacement.name).toBe('axisBillboardPlacement');
    expect(axisBillboardPlacement({axis: 'z'}).name).toBe('axisBillboardPlacement+z');
    expect(AxisBillboardPlacement.requires).toEqual(['instancePosition']);
  });

  test('refuses an axis it does not know, naming it', () => {
    expect(() => axisBillboardPlacement({axis: 'x' as 'y'})).toThrow(
      new TypeError(`axisBillboardPlacement: the axis "x" is neither 'y' nor 'z'`),
    );
    expect(() => axisBillboardPlacement({axis: NaN as unknown as 'y'})).toThrow(
      new TypeError(`axisBillboardPlacement: the axis NaN is neither 'y' nor 'z'`),
    );
  });

  test('brings nothing but its placement stage, so it can stand in for every other placement', () => {
    for (const feature of [AxisBillboardPlacement, axisBillboardPlacement({axis: 'z'})]) {
      const {name, requires, placement, ...rest} = feature;
      expect(Object.keys(rest)).toEqual([]);
      expect(typeof placement).toBe('function');
    }
  });

  test('reads the instance position, the camera position and the view of the camera, and never the quad size', () => {
    const local = vec3(1, 2, 0) as unknown as Node<'vec3'>;

    const placed = AxisBillboardPlacement.placement!(local, stubShaderContext());
    const nodes = nodesOf(placed);

    expect(attributeNamesOf(placed)).toEqual(['instancePosition']);
    expect(nodes.has(local)).toBe(true);
    expect([...nodes].some((node) => node === cameraPosition)).toBe(true);
    expect([...nodes].some((node) => node === modelViewMatrix)).toBe(true);
  });
});

describe('axisBillboardVertex()', () => {
  const vertexAt = (
    axis: 'y' | 'z',
    camera: readonly [number, number, number],
    cameraRight: readonly [number, number, number] = [1, 0, 0],
    local: readonly [number, number, number] = [1, 2, 0],
  ) =>
    evaluateNode(
      axisBillboardVertex({
        vertex: vec3(...local) as unknown as Node<'vec3'>,
        instancePosition: uniform(new Vector3(0, 0, 0)) as unknown as Node<'vec3'>,
        axis,
        cameraPosition: uniform(new Vector3(...camera)) as unknown as Node<'vec3'>,
        cameraRight: uniform(new Vector3(...cameraRight)) as unknown as Node<'vec3'>,
      }),
    ) as number[];

  test('level with the camera it faces the camera as a spherical billboard does', () => {
    closeTo(vertexAt('y', [0, 0, 10]), new Vector3(1, 2, 0));
    closeTo(vertexAt('y', [10, 0, 0], [0, 0, -1]), new Vector3(0, 2, -1));
  });

  test('under a camera above it turns about the axis and stays upright', () => {
    closeTo(vertexAt('y', [0, 8, 6]), new Vector3(1, 2, 0));
    closeTo(vertexAt('y', [6, 8, 0], [0, 0, -1]), new Vector3(0, 2, -1));
  });

  test('about +Z it stands along +Z and turns in the XY plane', () => {
    closeTo(vertexAt('z', [0, -10, 5]), new Vector3(1, 0, 2));
    closeTo(vertexAt('z', [10, 0, 5], [0, 1, 0]), new Vector3(0, 1, 2));
  });

  test('straight along the axis it takes the right of the camera, levelled', () => {
    closeTo(vertexAt('y', [0, 10, 0], [1, 0, 0]), new Vector3(1, 2, 0));
    closeTo(vertexAt('y', [0, 10, 0], [-1, 0.5, 0]), new Vector3(-1, 2, 0));
    closeTo(vertexAt('z', [0, 0, 10], [0, 1, 0]), new Vector3(0, 1, 2));
  });

  test('inside the cone round the axis a camera rolled against the facing does not cancel it', () => {
    // at a sine of 1/11 the facing across the axis and the weighted right of the camera have the
    // same length: a right of the camera that points the other way would cancel it without the turn
    const sine = 1 / 11;
    const camera = [10 * sine, 10 * Math.sqrt(1 - sine * sine), 0] as const;

    const placed = vertexAt('y', camera, [0, 0, 1], [1, 0, 0]);

    placed.forEach((value) => expect(Number.isFinite(value)).toBe(true));
    closeTo(placed, new Vector3(0, 0, -1));
  });
});
