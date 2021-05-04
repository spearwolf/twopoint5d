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

  test('construct with descriptor', () => {
    const geometry = new VertexObjectGeometry(descriptor, 10);

    expect(geometry).toBeDefined();
    expect(geometry.attributesInitialized).toBeFalsy();
  });

  test('update() initializes the attributes', () => {
    const geometry = new VertexObjectGeometry(descriptor, 10);

    geometry.update();

    expect(geometry.attributesInitialized).toBeTruthy();

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

  test('update() initializes the indices', () => {
    const capacity = 10;
    const geometry = new VertexObjectGeometry(descriptor, capacity);

    geometry.update();

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
});
