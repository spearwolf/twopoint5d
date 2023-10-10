import {VertexAttributeDescriptor} from './VertexAttributeDescriptor.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';

describe('VertexObjectDescriptor', () => {
  test('construct with vertexCount and indices', () => {
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
    expect(descriptor.getInstanceCount(3)).toBe(3);
    expect(descriptor.hasIndices).toBeTruthy();
    expect(descriptor.indices).toEqual([0, 1, 2, 0, 2, 3]);
    expect(Array.from(descriptor.attributeNames.values())).toEqual(expect.arrayContaining(['foo', 'bar', 'plah']));
    expect(Array.from(descriptor.bufferNames.values())).toEqual(expect.arrayContaining(['dynamic_float32', 'static_float32']));
    expect(descriptor.getAttribute('foo')).toBeInstanceOf(VertexAttributeDescriptor);
    expect(descriptor.getAttribute('bar').name).toBe('bar');
  });

  test('construct with meshCount', () => {
    const descriptor = new VertexObjectDescriptor({
      meshCount: 2,

      attributes: {
        foo: {
          components: ['x', 'y'],
          type: 'float32',
          usage: 'static',
        },
        bar: {
          size: 2,
          type: 'float32',
          usage: 'static',
        },
      },
    });
    expect(descriptor).toBeDefined();
    expect(descriptor.vertexCount).toBe(1);
    expect(descriptor.getInstanceCount(3)).toBe(2);
    expect(descriptor.hasIndices).toBeFalsy();
    expect(descriptor.indices).toEqual([]);
    expect(Array.from(descriptor.attributeNames.values())).toEqual(expect.arrayContaining(['foo', 'bar']));
    expect(Array.from(descriptor.bufferNames.values())).toMatchObject(['static_float32']);
    expect(descriptor.getAttribute('foo')).toBeInstanceOf(VertexAttributeDescriptor);
    expect(descriptor.getAttribute('bar').name).toBe('bar');
  });

  test('construct with attributes only', () => {
    const descriptor = new VertexObjectDescriptor({
      attributes: {
        foo: {
          components: ['f'],
          type: 'float32',
          usage: 'static',
        },
        bar: {
          size: 2,
          type: 'float32',
          usage: 'dynamic',
        },
      },
    });
    expect(descriptor).toBeDefined();
    expect(descriptor.vertexCount).toBe(1);
    expect(descriptor.hasIndices).toBeFalsy();
    expect(descriptor.indices).toEqual([]);
    expect(Array.from(descriptor.attributeNames.values())).toEqual(expect.arrayContaining(['foo', 'bar']));
    expect(Array.from(descriptor.bufferNames.values())).toEqual(expect.arrayContaining(['dynamic_float32', 'static_float32']));
    expect(descriptor.getAttribute('foo')).toBeInstanceOf(VertexAttributeDescriptor);
    expect(descriptor.getAttribute('bar').name).toBe('bar');
  });
});
