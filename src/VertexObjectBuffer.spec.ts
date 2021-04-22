import {VertexObjectBuffer} from './VertexObjectBuffer';
import {VertexObjectDescriptor} from './VertexObjectDescriptor';

describe('VertexObjectBuffer', () => {
  test('construct with descriptor', () => {
    const descriptor = new VertexObjectDescriptor({
      vertexCount: 4,
      indices: [0, 1, 2, 0, 2, 3],

      attributes: {
        foo: {
          components: ['x', 'y'],
          type: 'float32',
          usage: 'dynamic',
        },
        bar: {
          size: 1,
          type: 'float32',
          usage: 'static',
        },
        plah: {
          components: ['a', 'b', 'c'],
          type: 'float32',
          usage: 'static',
        },
        zack: {
          components: ['zick'],
          type: 'float32',
          usage: 'static',
        },
      },
    });
    const vob = new VertexObjectBuffer(descriptor, 1);

    expect(vob).toBeDefined();
    expect(vob.descriptor).toBe(descriptor);
    expect(vob.capacity).toBe(1);
    expect(vob.attributeNames).toEqual(['bar', 'foo', 'plah', 'zack']);

    expect(vob.buffers.get('static_float32')).toMatchObject({
      bufferName: 'static_float32',
      itemSize: 5,
      dataType: 'float32',
      usageType: 'static',
    });
    expect(vob.buffers.get('static_float32').typedArray).toBeInstanceOf(
      Float32Array,
    );
    expect(vob.buffers.get('static_float32').typedArray.length).toBe(20);

    expect(vob.buffers.get('dynamic_float32')).toMatchObject({
      bufferName: 'dynamic_float32',
      itemSize: 2,
      dataType: 'float32',
      usageType: 'dynamic',
    });
    expect(vob.buffers.get('dynamic_float32').typedArray).toBeInstanceOf(
      Float32Array,
    );
    expect(vob.buffers.get('dynamic_float32').typedArray.length).toBe(8);

    expect(vob.bufferAttributes.get('foo')).toEqual({
      attributeName: 'foo',
      bufferName: 'dynamic_float32',
      offset: 0,
    });
    expect(vob.bufferAttributes.get('bar')).toEqual({
      attributeName: 'bar',
      bufferName: 'static_float32',
      offset: 0,
    });
    expect(vob.bufferAttributes.get('plah')).toEqual({
      attributeName: 'plah',
      bufferName: 'static_float32',
      offset: 1,
    });
    expect(vob.bufferAttributes.get('zack')).toEqual({
      attributeName: 'zack',
      bufferName: 'static_float32',
      offset: 4,
    });
  });

  test('construct with vertex-object-descriptor', () => {
    const descriptor = new VertexObjectDescriptor({
      vertexCount: 4,
      indices: [0, 1, 2, 0, 2, 3],

      attributes: {
        foo: {
          components: ['x', 'y'],
          type: 'float32',
          usage: 'dynamic',
        },
        bar: {
          size: 1,
          type: 'float32',
          usage: 'static',
        },
        plah: {
          components: ['a', 'b', 'c'],
          type: 'float32',
          usage: 'static',
        },
        zack: {
          components: ['zick'],
          type: 'float32',
          usage: 'static',
        },
      },
    });
    const vob0 = new VertexObjectBuffer(descriptor, 1);
    const vob = new VertexObjectBuffer(vob0, 2);

    expect(vob).toBeDefined();
    expect(vob.descriptor).toBe(descriptor);
    expect(vob.capacity).toBe(2);
    expect(vob.attributeNames).toBe(vob0.attributeNames);
    expect(vob.bufferAttributes).toBe(vob0.bufferAttributes);

    expect(vob.buffers.get('static_float32')).not.toBe(
      vob0.buffers.get('static_float32'),
    );
    expect(vob.buffers.get('dynamic_float32')).not.toBe(
      vob0.buffers.get('dynamic_float32'),
    );

    expect(vob.buffers.get('static_float32')).toMatchObject({
      bufferName: 'static_float32',
      itemSize: 5,
      dataType: 'float32',
      usageType: 'static',
    });
    expect(vob.buffers.get('static_float32').typedArray).toBeInstanceOf(
      Float32Array,
    );
    expect(vob.buffers.get('static_float32').typedArray.length).toBe(40);

    expect(vob.buffers.get('dynamic_float32')).toMatchObject({
      bufferName: 'dynamic_float32',
      itemSize: 2,
      dataType: 'float32',
      usageType: 'dynamic',
    });
    expect(vob.buffers.get('dynamic_float32').typedArray).toBeInstanceOf(
      Float32Array,
    );
    expect(vob.buffers.get('dynamic_float32').typedArray.length).toBe(16);
  });

  test('copyAttributes', () => {
    const descriptor = new VertexObjectDescriptor({
      vertexCount: 4,

      attributes: {
        foo: {
          components: ['x', 'y'],
        },
        bar: {
          size: 1,
          usage: 'dynamic',
        },
        plah: {
          components: ['a', 'b', 'c'],
        },
      },
    });
    const vob = new VertexObjectBuffer(descriptor, 2);

    expect(vob.buffers.get('static_float32')).toMatchObject({
      itemSize: 5,
    });

    // prettier-ignore
    vob.copyAttributes({
      foo: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
      bar: [100, 101, 102, 103],
    });

    // prettier-ignore
    expect(Array.from(vob.buffers.get('static_float32').typedArray)).toEqual([
      1, 2, 0, 0, 0, 3, 4, 0, 0, 0, 5, 6, 0, 0, 0, 7, 8, 0, 0, 0,
      9, 10, 0, 0, 0, 11, 12, 0, 0, 0, 13, 14, 0, 0, 0, 15, 16, 0, 0, 0,
    ]);

    // prettier-ignore
    expect(Array.from(vob.buffers.get('dynamic_float32').typedArray)).toEqual([
      100, 101, 102, 103,
      0, 0, 0, 0,
    ]);
  });

  test('copyWithin', () => {
    const descriptor = new VertexObjectDescriptor({
      vertexCount: 4,

      attributes: {
        foo: {
          components: ['x', 'y'],
        },
        bar: {
          size: 1,
          usage: 'dynamic',
        },
        plah: {
          components: ['a', 'b', 'c'],
        },
      },
    });
    const vob = new VertexObjectBuffer(descriptor, 2);

    vob.copyAttributes({
      foo: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
      bar: [100, 101, 102, 103],
    });

    vob.copyWithin(1, 0, 1);

    // prettier-ignore
    expect(Array.from(vob.buffers.get('static_float32').typedArray)).toEqual([
      1, 2, 0, 0, 0, 3, 4, 0, 0, 0, 5, 6, 0, 0, 0, 7, 8, 0, 0, 0,
      1, 2, 0, 0, 0, 3, 4, 0, 0, 0, 5, 6, 0, 0, 0, 7, 8, 0, 0, 0,
    ]);

    // prettier-ignore
    expect(Array.from(vob.buffers.get('dynamic_float32').typedArray)).toEqual([100, 101, 102, 103, 100, 101, 102, 103]);
  });

  test('clone', () => {
    const descriptor = new VertexObjectDescriptor({
      vertexCount: 4,

      attributes: {
        foo: {
          components: ['x', 'y'],
        },
        bar: {
          size: 1,
          usage: 'dynamic',
        },
        plah: {
          components: ['a', 'b', 'c'],
        },
      },
    });
    const vob = new VertexObjectBuffer(descriptor, 2);

    vob.copyAttributes({
      foo: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
      bar: [100, 101, 102, 103],
    });

    vob.copyWithin(1, 0, 1);

    const vob1 = vob.clone();

    // prettier-ignore
    expect(Array.from(vob1.buffers.get('static_float32').typedArray)).toEqual([
      1, 2, 0, 0, 0, 3, 4, 0, 0, 0, 5, 6, 0, 0, 0, 7, 8, 0, 0, 0, 
      1, 2, 0, 0, 0, 3, 4, 0, 0, 0, 5, 6, 0, 0, 0, 7, 8, 0, 0, 0,
    ]);

    // prettier-ignore
    expect(Array.from(vob1.buffers.get('dynamic_float32').typedArray)).toEqual([
      100, 101, 102, 103,
      100, 101, 102, 103,
    ]);
  });

  test('toAttributeArrays', () => {
    const vob = new VertexObjectBuffer(
      new VertexObjectDescriptor({
        vertexCount: 4,

        attributes: {
          foo: {
            components: ['x', 'y'],
          },
          bar: {
            size: 1,
            usage: 'dynamic',
          },
          plah: {
            components: ['a', 'b', 'c'],
          },
        },
      }),
      2,
    );

    // prettier-ignore
    vob.copyAttributes({
      foo: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
      bar: [100, 101, 102, 103],
    });

    // prettier-ignore
    // @ts-ignore
    expect(Array.from(vob.toAttributeArrays(['foo'], 1).foo)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);

    // prettier-ignore
    // @ts-ignore
    expect(Array.from(vob.toAttributeArrays(['bar'], 0, 1).bar)).toEqual([100, 101, 102, 103]);
  });
});
