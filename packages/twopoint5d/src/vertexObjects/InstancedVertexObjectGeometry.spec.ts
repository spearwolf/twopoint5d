import {createSandbox} from 'sinon';

import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry';
import {VertexObjectDescriptor} from './VertexObjectDescriptor';

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
