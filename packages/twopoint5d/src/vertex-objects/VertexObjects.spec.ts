import {createSandbox} from 'sinon';
import {BufferGeometry} from 'three/webgpu';
import {afterEach, describe, expect, expectTypeOf, test} from 'vitest';
import {InstancedVOBufferGeometry} from './InstancedVOBufferGeometry.js';
import {VertexObjectGeometry} from './VertexObjectGeometry.js';
import {VertexObjects} from './VertexObjects.js';
import type {VertexObjectDescription} from './types.js';

describe('VertexObjects', () => {
  const description: VertexObjectDescription = {
    vertexCount: 4,
    attributes: {
      position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'},
    },
  };

  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('is named after the class and never frustum-culled', () => {
    const mesh = new VertexObjects();

    expect(mesh.name).toBe('VertexObjects');
    expect(mesh.frustumCulled).toBe(false);
  });

  test('update() passes on to the geometry exactly once', () => {
    const geometry = new VertexObjectGeometry(description, 4);
    const mesh = new VertexObjects(geometry);
    const update = sandbox.spy(geometry, 'update');

    mesh.update();

    expect(update.callCount).toBe(1);
  });

  test('update() does nothing, and does not throw, once the geometry is gone', () => {
    const mesh = new VertexObjects(new VertexObjectGeometry(description, 4));
    mesh.geometry = undefined;

    expect(() => mesh.update()).not.toThrow();
  });

  test('update() does nothing, and does not throw, for a geometry that has no update()', () => {
    // the geometry THREE.Mesh falls back to when none is given
    const mesh = new VertexObjects();

    expect(mesh.geometry).toBeInstanceOf(BufferGeometry);
    expect(() => mesh.update()).not.toThrow();
  });

  test('update() passes on to an InstancedVOBufferGeometry', () => {
    const geometry = new InstancedVOBufferGeometry(description, 4, description, 1);
    const mesh = new VertexObjects(geometry);
    const update = sandbox.spy(geometry, 'update');

    mesh.update();

    expect(update.callCount).toBe(1);
  });

  test('a mesh built without a geometry is typed with the BufferGeometry THREE.Mesh puts there', () => {
    const mesh = new VertexObjects();

    expectTypeOf(mesh.geometry).toEqualTypeOf<BufferGeometry | undefined>();
    expect(mesh.geometry).toBeInstanceOf(BufferGeometry);
  });

  test('a mesh built with a geometry is typed with that geometry', () => {
    const geometry = new VertexObjectGeometry(description, 4);
    const mesh = new VertexObjects(geometry);

    expectTypeOf(mesh.geometry).toEqualTypeOf<typeof geometry | undefined>();
  });

  test('update() reaches a geometry that is assigned after the mesh was built', () => {
    const mesh = new VertexObjects();
    const geometry = new VertexObjectGeometry(description, 4);
    const update = sandbox.spy(geometry, 'update');

    mesh.geometry = geometry;
    mesh.update();

    expect(update.callCount).toBe(1);
  });
});
