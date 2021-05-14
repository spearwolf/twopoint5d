import sinon from 'sinon';

import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {VertexObjectGeometry} from './VertexObjectGeometry';

describe('VertexObjectGeometry', () => {
  const descriptor = new VertexObjectDescriptor({
    vertexCount: 4,
    indices: [0, 1, 2, 0, 2, 3],

    attributes: {
      position: {
        components: ['x', 'y', 'z'],
        type: 'float32',
        usage: 'dynamic',
      },
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

  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('construct with descriptor', () => {
    const geometry = new VertexObjectGeometry(descriptor, 10);

    expect(geometry).toBeDefined();
    expect(geometry.buffers).toBeDefined();

    expect(geometry.buffers.get('dynamic_float32').array).toBe(
      geometry.pool.buffer.buffers.get('dynamic_float32').typedArray,
    );
    expect(geometry.buffers.get('static_float32').array).toBe(
      geometry.pool.buffer.buffers.get('static_float32').typedArray,
    );
    expect(geometry.buffers.get('dynamic_uint32').array).toBe(
      geometry.pool.buffer.buffers.get('dynamic_uint32').typedArray,
    );
  });

  test('index array buffer is created', () => {
    const capacity = 10;
    const geometry = new VertexObjectGeometry(descriptor, capacity);

    expect(geometry.index).toBeDefined();
    expect(geometry.index.array.length).toBe(
      descriptor.indices.length * capacity,
    );

    // prettier-ignore
    expect(Array.from(geometry.index.array).slice(0, descriptor.indices.length * 3)).toEqual([
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
    ]);
  });

  test('touch() calls touchAttributes() and/or touchBuffers()', () => {
    const capacity = 10;
    const geometry = new VertexObjectGeometry(descriptor, capacity);

    const touchAttributes = sandbox.spy(geometry, 'touchAttributes');
    const touchBuffers = sandbox.spy(geometry, 'touchBuffers');

    geometry.touch('strength', 'position', {dynamic: true});

    expect(touchAttributes.callCount).toBe(1);
    expect(touchAttributes.getCall(0).args).toHaveLength(2);
    expect(touchAttributes.getCall(0).args).toEqual(
      expect.arrayContaining(['position', 'strength']),
    );

    expect(touchBuffers.callCount).toBe(1);
    expect(touchBuffers.getCall(0).args[0]).toMatchObject({dynamic: true});
    expect(touchBuffers.getCall(0).args[0]).not.toHaveProperty('static', true);
    expect(touchBuffers.getCall(0).args[0]).not.toHaveProperty('stream', true);
  });
});
