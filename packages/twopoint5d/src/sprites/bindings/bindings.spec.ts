import {DirectionalLight, Matrix4, Mesh, Object3D, Plane, PlaneGeometry, PointLight, Vector3, Vector4} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {lightOf} from './lightOf.js';
import {planeOf} from './planeOf.js';
import type {SpriteUniformSource} from './SpriteUniformSource.js';

const IDENTITY = new Matrix4();

const written = (source: SpriteUniformSource, worldToSprites = IDENTITY): number[] => {
  const out = new Vector4();
  (source as Extract<SpriteUniformSource, {type: 'vec4'}>).write(out, worldToSprites);
  return out.toArray();
};

// a plane [n, d] up to the length of n, which the features do not need to be 1
const normalized = ([x, y, z, d]: number[]): number[] => {
  const size = Math.hypot(x!, y!, z!);
  return [x! / size, y! / size, z! / size, d! / size];
};

const expectNear = (actual: number[], expected: number[]) =>
  expected.forEach((value, i) => expect(actual[i], `component ${i} of ${actual}`).toBeCloseTo(value, 5));

describe('planeOf()', () => {
  test('takes the local XY plane of a node, turned and moved: a ground at y = 2', () => {
    const ground = new Mesh(new PlaneGeometry(4, 4));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 2;

    expect(planeOf(ground).type).toBe('vec4');
    expectNear(normalized(written(planeOf(ground))), [0, 1, 0, 2]);
  });

  test('keeps the plane of a node scaled unevenly', () => {
    const ground = new Object3D();
    ground.rotation.x = -Math.PI / 2;
    ground.rotation.z = 0.3;
    ground.scale.set(3, 1, 0.5);
    ground.position.y = 1;

    expectNear(normalized(written(planeOf(ground))), [0, 1, 0, 1]);
  });

  test('takes a plane of its own in the local space of the node', () => {
    const node = new Object3D();
    node.position.x = 5;

    // x = 1 in the node is x = 6 in the world
    expectNear(normalized(written(planeOf(node, {plane: new Plane(new Vector3(1, 0, 0), -1)}))), [1, 0, 0, 6]);
  });

  test('takes a fixed plane in world space, the sign of its constant turned: y = 2 is constant -2', () => {
    expectNear(normalized(written(planeOf(new Plane(new Vector3(0, 1, 0), -2)))), [0, 1, 0, 2]);
  });

  test('writes the plane in the local space of the sprites', () => {
    const sprites = new Object3D();
    sprites.position.y = 5;
    sprites.updateMatrixWorld();
    const worldToSprites = sprites.matrixWorld.clone().invert();

    // the world plane y = 0 lies at y = -5 for the sprites
    expectNear(normalized(written(planeOf(new Plane(new Vector3(0, 1, 0), 0)), worldToSprites)), [0, 1, 0, -5]);
  });

  test('reads a node moved since its last world matrix at its new place', () => {
    const parent = new Object3D();
    const ground = new Object3D();
    parent.add(ground);
    ground.rotation.x = -Math.PI / 2;
    parent.updateMatrixWorld();
    parent.position.y = 3;

    expectNear(normalized(written(planeOf(ground))), [0, 1, 0, 3]);
  });

  test('copies the plane of its options: a later change of it does not reach the source', () => {
    const plane = new Plane(new Vector3(0, 0, 1), 0);
    const source = planeOf(new Object3D(), {plane});
    plane.constant = -4;

    expectNear(normalized(written(source)), [0, 0, 1, 0]);
  });
});

describe('lightOf()', () => {
  test('writes the direction towards a directional light, from its target to it, with w = 0', () => {
    const sun = new DirectionalLight();
    sun.position.set(0, 10, 0);
    sun.target.position.set(0, 0, 5);

    const [x, y, z, w] = written(lightOf(sun));
    expect(w).toBe(0);
    expectNear(normalized([x!, y!, z!, 0]).slice(0, 3), normalized([0, 10, -5, 0]).slice(0, 3));
  });

  test('writes the position of any other node with w = 1, a point light', () => {
    const lamp = new PointLight();
    lamp.position.set(1, 8, -2);
    const marker = new Object3D();
    marker.position.set(-3, 4, 0);

    expectNear(written(lightOf(lamp)), [1, 8, -2, 1]);
    expectNear(written(lightOf(marker)), [-3, 4, 0, 1]);
  });

  test('writes the light in the local space of the sprites', () => {
    const sprites = new Object3D();
    sprites.position.set(0, 5, 0);
    sprites.rotation.y = Math.PI / 2;
    sprites.updateMatrixWorld();
    const worldToSprites = sprites.matrixWorld.clone().invert();
    const lamp = new Object3D();
    lamp.position.set(2, 5, 0);

    // 2 along world x is 2 along the sprites' z, after a quarter turn about y
    expectNear(written(lightOf(lamp), worldToSprites), [0, 0, 2, 1]);
  });
});
