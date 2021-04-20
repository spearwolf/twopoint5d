import {VertexAttributeDescriptor} from './VertexAttributeDescriptor';
import {VertexObjectDescriptor} from './VertexObjectDescriptor';

describe('VertexObjectDescriptor', () => {
  test('construct with indices', () => {
    const descriptor = new VertexObjectDescriptor({
      vertexCount: 4,
      indices: [0, 1, 2, 0, 2, 3],

      attributes: {
        foo: {
          components: ['x', 'y', 'z'],
          type: 'float32',
          usage: 'dynamic',
        },
        bar: {
          size: 1,
          type: 'float32',
          usage: 'static',
        },
        plah: {
          components: ['a', 'b'],
          type: 'float32',
          usage: 'static',
        },
      },
    });
    expect(descriptor).toBeDefined();
    expect(descriptor.vertexCount).toBe(4);
    expect(descriptor.hasIndices).toBeTruthy();
    expect(descriptor.indices).toEqual([0, 1, 2, 0, 2, 3]);
    expect(Array.from(descriptor.attributeNames.values()).sort()).toEqual(
      ['foo', 'bar', 'plah'].sort(),
    );
    expect(Array.from(descriptor.bufferNames.values()).sort()).toEqual(
      ['dynamic_float32', 'static_float32'].sort(),
    );
    expect(descriptor.getAttribute('foo')).toBeInstanceOf(
      VertexAttributeDescriptor,
    );
    expect(descriptor.getAttribute('bar').name).toBe('bar');
  });
});
