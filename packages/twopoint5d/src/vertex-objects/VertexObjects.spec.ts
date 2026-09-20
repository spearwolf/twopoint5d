import {createSandbox} from 'sinon';
import {BufferGeometry} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';
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

  test('update() reaches a geometry that is assigned after the mesh was built', () => {
    const mesh = new VertexObjects();
    const geometry = new VertexObjectGeometry(description, 4);
    const update = sandbox.spy(geometry, 'update');

    mesh.geometry = geometry;
    mesh.update();

    expect(update.callCount).toBe(1);
  });
});
