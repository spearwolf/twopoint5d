import {createSandbox} from 'sinon';
import {afterEach, describe, expect, test} from 'vitest';

import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';

describe('InstancedVertexObjectGeometry', () => {
  const baseDescriptor = new VertexObjectDescriptor({
    vertexCount: 4,
    indices: [0, 1, 2, 0, 2, 3],

    attributes: {
      position: {
        components: ['x', 'y', 'z'],
        type: 'float32',
      },
    },
  });

  const instancedDescriptor = new VertexObjectDescriptor({
    meshCount: 1,

    attributes: {
      color: {
        components: ['r', 'g', 'b'],
        type: 'float32',
        usage: 'dynamic',
      },
      strength: {
        size: 1,
        type: 'float32',
        usage: 'static',
      },
      impact: {
        size: 1,
        type: 'uint32',
        usage: 'dynamic',
      },
    },
  });

  const extraInstancedDescriptor = new VertexObjectDescriptor({
    meshCount: 2,

    attributes: {
      extra: {
        size: 1,
        bufferName: 'extraBuffer',
      },
    },
  });

  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('construct with base and instanced descriptor', () => {
    const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);

    expect(geometry).toBeDefined();
    expect(geometry.baseBuffers).toBeDefined();
    expect(geometry.instancedBuffers).toBeDefined();

    expect(geometry.baseBuffers.get('static_float32').array).toBe(
      geometry.basePool.buffer.buffers.get('static_float32').typedArray,
    );
    expect(geometry.instancedBuffers.get('dynamic_float32').array).toBe(
      geometry.instancedPool.buffer.buffers.get('dynamic_float32').typedArray,
    );
    expect(geometry.instancedBuffers.get('static_float32').array).toBe(
      geometry.instancedPool.buffer.buffers.get('static_float32').typedArray,
    );
    expect(geometry.instancedBuffers.get('dynamic_uint32').array).toBe(
      geometry.instancedPool.buffer.buffers.get('dynamic_uint32').typedArray,
    );
  });

  test('construct with base, instanced and extra-instanced descriptors', () => {
    const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);

    const extraPool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor);

    expect(extraPool).toBeDefined();

    expect(geometry.extraInstancedBuffers.get('extraPool').get('extraBuffer').array).toBe(
      extraPool.buffer.buffers.get('extraBuffer').typedArray,
    );

    expect(geometry.getAttribute('extra')).toBeDefined();
  });

  test('index array buffer is created', () => {
    const capacity = 10;
    const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 1, baseDescriptor, capacity);

    expect(geometry.index).toBeDefined();
    expect(geometry.index.array.length).toBe(baseDescriptor.indices.length * capacity);

    // prettier-ignore
    expect(Array.from(geometry.index.array).slice(0, baseDescriptor.indices.length * 3)).toEqual([
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
    ]);
  });

  test('an explicit base capacity of 0 reaches the base pool', () => {
    const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 0);

    expect(geometry.basePool.capacity).toBe(0);
  });

  describe('dispose()', () => {
    test('disposes basePool and instancedPool it built itself', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);

      const baseDispose = sandbox.spy(geometry.basePool, 'dispose');
      const instancedDispose = sandbox.spy(geometry.instancedPool, 'dispose');

      geometry.dispose();

      expect(baseDispose.calledOnce).toBe(true);
      expect(instancedDispose.calledOnce).toBe(true);
    });

    test('disposes extra instanced pools it built itself', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      const extraPool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor);

      const extraDispose = sandbox.spy(extraPool, 'dispose');

      geometry.dispose();

      expect(extraDispose.calledOnce).toBe(true);
    });

    test('disposes extra instanced pools when autoDispose is explicitly true', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      const extraPool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor, {autoDispose: true});

      const extraDispose = sandbox.spy(extraPool, 'dispose');

      geometry.dispose();

      expect(extraDispose.calledOnce).toBe(true);
    });

    test('does NOT dispose extra instanced pools when autoDispose is false', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      const extraPool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor, {autoDispose: false});

      const extraDispose = sandbox.spy(extraPool, 'dispose');

      geometry.dispose();

      expect(extraDispose.called).toBe(false);
    });

    test('respects per-pool autoDispose flags independently', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);

      const ownedPool = geometry.attachInstancedPool('owned', extraInstancedDescriptor);
      const sharedPool = geometry.attachInstancedPool('shared', extraInstancedDescriptor, {autoDispose: false});

      const ownedDispose = sandbox.spy(ownedPool, 'dispose');
      const sharedDispose = sandbox.spy(sharedPool, 'dispose');

      geometry.dispose();

      expect(ownedDispose.calledOnce).toBe(true);
      expect(sharedDispose.called).toBe(false);
    });

    test('empties all extra-instanced bookkeeping maps', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      geometry.attachInstancedPool('a', extraInstancedDescriptor);
      geometry.attachInstancedPool('b', extraInstancedDescriptor, {autoDispose: false});

      expect(geometry.extraInstancedPools.size).toBe(2);
      expect(geometry.extraInstancedBuffers.size).toBe(2);
      expect(geometry.extraInstancedBufferSerials.size).toBe(2);

      geometry.dispose();

      expect(geometry.extraInstancedPools.size).toBe(0);
      expect(geometry.extraInstancedBuffers.size).toBe(0);
      expect(geometry.extraInstancedBufferSerials.size).toBe(0);
    });

    test('detachInstancedPool removes the autoDispose tracking entry', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      const extraPool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor);

      geometry.detachInstancedPool('extraPool');

      // the detach released it already — the geometry built this pool
      expect(extraPool.isDisposed).toBe(true);

      const extraDispose = sandbox.spy(extraPool, 'dispose');

      geometry.dispose();

      expect(extraDispose.called).toBe(false);
    });
  });

  test('touch() calls touchAttributes() and/or touchBuffers()', () => {
    const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 1, baseDescriptor);

    const touchAttributes = sandbox.spy(geometry, 'touchAttributes');
    const touchBuffers = sandbox.spy(geometry, 'touchBuffers');

    geometry.touch('strength', 'position', {instanced: {dynamic: true}});

    expect(touchAttributes.callCount).toBe(1);
    expect(touchAttributes.getCall(0).args).toHaveLength(2);
    expect(touchAttributes.getCall(0).args).toEqual(expect.arrayContaining(['position', 'strength']));

    expect(touchBuffers.callCount).toBe(1);
    expect(touchBuffers.getCall(0).args[0]).toMatchObject({
      instanced: {dynamic: true},
    });
    expect(touchBuffers.getCall(0).args[0]).not.toHaveProperty('static', true);
    expect(touchBuffers.getCall(0).args[0]).not.toHaveProperty('stream', true);
  });
});
