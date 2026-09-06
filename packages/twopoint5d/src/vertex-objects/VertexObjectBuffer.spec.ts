import {describe, expect, test} from 'vitest';
import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectPool} from './VertexObjectPool.js';
import type {VO} from './types.js';

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
    expect(vob.buffers.get('static_float32')!.typedArray).toBeInstanceOf(Float32Array);
    expect(vob.buffers.get('static_float32')!.typedArray!.length).toBe(20);

    expect(vob.buffers.get('dynamic_float32')).toMatchObject({
      bufferName: 'dynamic_float32',
      itemSize: 2,
      dataType: 'float32',
      usageType: 'dynamic',
    });
    expect(vob.buffers.get('dynamic_float32')!.typedArray).toBeInstanceOf(Float32Array);
    expect(vob.buffers.get('dynamic_float32')!.typedArray!.length).toBe(8);

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

    expect(
      vob.bufferNameAttributes
        .get('dynamic_float32')!
        .map((bufAttr) => bufAttr.attributeName)
        .sort(),
    ).toEqual(['foo']);
    expect(
      vob.bufferNameAttributes
        .get('static_float32')!
        .map((bufAttr) => bufAttr.attributeName)
        .sort(),
    ).toEqual(['bar', 'plah', 'zack']);
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

    expect(vob.buffers.get('static_float32')).not.toBe(vob0.buffers.get('static_float32'));
    expect(vob.buffers.get('dynamic_float32')).not.toBe(vob0.buffers.get('dynamic_float32'));

    expect(vob.buffers.get('static_float32')).toMatchObject({
      bufferName: 'static_float32',
      itemSize: 5,
      dataType: 'float32',
      usageType: 'static',
    });
    expect(vob.buffers.get('static_float32')!.typedArray).toBeInstanceOf(Float32Array);
    expect(vob.buffers.get('static_float32')!.typedArray!.length).toBe(40);

    expect(vob.buffers.get('dynamic_float32')).toMatchObject({
      bufferName: 'dynamic_float32',
      itemSize: 2,
      dataType: 'float32',
      usageType: 'dynamic',
    });
    expect(vob.buffers.get('dynamic_float32')!.typedArray).toBeInstanceOf(Float32Array);
    expect(vob.buffers.get('dynamic_float32')!.typedArray!.length).toBe(16);

    expect(
      vob.bufferNameAttributes
        .get('dynamic_float32')!
        .map((bufAttr) => bufAttr.attributeName)
        .sort(),
    ).toEqual(['foo']);
    expect(
      vob.bufferNameAttributes
        .get('static_float32')!
        .map((bufAttr) => bufAttr.attributeName)
        .sort(),
    ).toEqual(['bar', 'plah', 'zack']);
  });

  test('a buffer source takes the typed arrays of the buffers data it is handed', () => {
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
    const source = new VertexObjectBuffer(descriptor, 1);
    const buffersData = {
      capacity: 2,
      usedCount: 1,
      buffers: {
        static_float32: new Float32Array(40).fill(7),
        dynamic_float32: new Float32Array(16).fill(9),
      },
    };
    const vob = new VertexObjectBuffer(source, buffersData);

    expect(vob.capacity).toBe(2);
    expect(vob.buffers.get('static_float32')!.typedArray).toBe(buffersData.buffers.static_float32);
    expect(vob.buffers.get('dynamic_float32')!.typedArray).toBe(buffersData.buffers.dynamic_float32);
  });

  test('a buffer name the buffers data does not mention gets a fresh zeroed array', () => {
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
    const source = new VertexObjectBuffer(descriptor, 1);
    const buffersData = {
      capacity: 2,
      usedCount: 1,
      buffers: {
        dynamic_float32: new Float32Array(16).fill(9),
      },
    };
    const vob = new VertexObjectBuffer(source, buffersData);

    expect(vob.buffers.get('dynamic_float32')!.typedArray).toBe(buffersData.buffers.dynamic_float32);
    expect(vob.buffers.get('static_float32')!.typedArray).toBeInstanceOf(Float32Array);
    expect(vob.buffers.get('static_float32')!.typedArray!.length).toBe(40);
    expect(Array.from(vob.buffers.get('static_float32')!.typedArray!)).toEqual(new Array(40).fill(0));
  });

  test('first vertex-object-buffer initializes the descriptor.voPrototype', () => {
    class VOBase {
      moinMoin() {
        return 23;
      }
    }

    function fooBarPlah() {
      return 42;
    }

    const descriptor = new VertexObjectDescriptor({
      vertexCount: 4,
      indices: [0, 1, 2, 0, 2, 3],

      attributes: {
        foo: {
          components: ['x', 'y'],
          type: 'float32',
          usage: 'dynamic',
        },
      },

      basePrototype: VOBase.prototype,

      methods: {
        fooBarPlah,
      },
    });

    // first buffer initializes the prototype ---------------
    expect(descriptor.voPrototype).toBeUndefined();

    const vob = new VertexObjectBuffer(descriptor, 1);

    expect(vob).toBeDefined();
    expect(vob.descriptor).toBe(descriptor);
    expect(descriptor.voPrototype).toBeDefined();
    // ------------------------------------------------------

    // vertex-object-pool uses the voPrototype prop from descriptor ---------------
    const pool = new VertexObjectPool<VO & {moinMoin(): number; fooBarPlah(): number}>(descriptor, 1);
    const vo = pool.createVO()!;

    expect(vo).toBeDefined();
    expect(Object.getPrototypeOf(vo)).toBe(descriptor.voPrototype);
    // ----------------------------------------------------------------------------

    const voBaseProto = Object.getPrototypeOf(Object.getPrototypeOf(vo));
    expect(voBaseProto).toHaveProperty('moinMoin');
    expect(voBaseProto).not.toHaveProperty('fooBarPlah');

    expect(Object.getPrototypeOf(vo)).toHaveProperty('fooBarPlah');
    expect(Object.getPrototypeOf(vo)).toHaveProperty('moinMoin'); // ;)

    // ----------------------------------------------------------------------------

    expect(vo.fooBarPlah()).toBe(42);
    expect(vo.moinMoin()).toBe(23);
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

    expect(
      vob.copyAttributes({
        // prettier-ignore
        foo: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
        bar: [100, 101, 102, 103],
      }),
    ).toEqual(2);

    // prettier-ignore
    expect(Array.from(vob.buffers.get('static_float32')!.typedArray!)).toEqual([
      1, 2, 0, 0, 0, 3, 4, 0, 0, 0, 5, 6, 0, 0, 0, 7, 8, 0, 0, 0,
      9, 10, 0, 0, 0, 11, 12, 0, 0, 0, 13, 14, 0, 0, 0, 15, 16, 0, 0, 0,
    ]);

    // prettier-ignore
    expect(Array.from(vob.buffers.get('dynamic_float32')!.typedArray!)).toEqual([
      100, 101, 102, 103,
      0, 0, 0, 0,
    ]);
  });

  test('copyArray', () => {
    const descriptor = new VertexObjectDescriptor({
      vertexCount: 4,

      attributes: {
        foo: {
          components: ['x', 'y'],
        },
        bar: {
          size: 1,
          usage: 'dynamic',
          bufferName: 'bar',
        },
        plah: {
          components: ['a', 'b', 'c'],
        },
      },
    });
    const vob = new VertexObjectBuffer(descriptor, 2);

    vob.copyArray(new Float32Array([100, 101, 102, 103]), 'bar');

    // prettier-ignore
    expect(Array.from(vob.buffers.get('bar')!.typedArray!)).toEqual([
      100, 101, 102, 103,
      0, 0, 0, 0,
    ]);

    vob.copyArray(new Float32Array([200, 201, 202, 203]), 'bar', 1);

    // prettier-ignore
    expect(Array.from(vob.buffers.get('bar')!.typedArray!)).toEqual([
      100, 101, 102, 103,
      200, 201, 202, 203,
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
    expect(Array.from(vob.buffers.get('static_float32')!.typedArray!)).toEqual([
      1, 2, 0, 0, 0, 3, 4, 0, 0, 0, 5, 6, 0, 0, 0, 7, 8, 0, 0, 0,
      1, 2, 0, 0, 0, 3, 4, 0, 0, 0, 5, 6, 0, 0, 0, 7, 8, 0, 0, 0,
    ]);

    // prettier-ignore
    expect(Array.from(vob.buffers.get('dynamic_float32')!.typedArray!)).toEqual([100, 101, 102, 103, 100, 101, 102, 103]);
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

    expect(
      vob.copyAttributes({
        foo: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        bar: [100, 101, 102, 103],
      }),
    ).toEqual(2);

    vob.copyWithin(1, 0, 1);

    const vob1 = vob.clone();

    // prettier-ignore
    expect(Array.from(vob1.buffers.get('static_float32')!.typedArray!)).toEqual([
      1, 2, 0, 0, 0, 3, 4, 0, 0, 0, 5, 6, 0, 0, 0, 7, 8, 0, 0, 0,
      1, 2, 0, 0, 0, 3, 4, 0, 0, 0, 5, 6, 0, 0, 0, 7, 8, 0, 0, 0,
    ]);

    // prettier-ignore
    expect(Array.from(vob1.buffers.get('dynamic_float32')!.typedArray!)).toEqual([
      100, 101, 102, 103,
      100, 101, 102, 103,
    ]);
  });

  test('copyAttributes() stops at the end of the source data', () => {
    const descriptor = new VertexObjectDescriptor({
      vertexCount: 4,

      attributes: {
        foo: {
          components: ['x', 'y'],
        },
      },
    });
    const vob = new VertexObjectBuffer(descriptor, 2);

    expect(
      vob.copyAttributes({
        // one component short of the last vertex of the first object
        foo: [1, 2, 3, 4, 5, 6, 7],
      }),
    ).toEqual(1);

    // prettier-ignore
    expect(Array.from(vob.buffers.get('static_float32')!.typedArray!)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
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
    expect(Array.from(vob.toAttributeArrays(['foo'], 1)['foo']!)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);

    // prettier-ignore
    expect(Array.from(vob.toAttributeArrays(['bar'], 0, 1)['bar']!)).toEqual([100, 101, 102, 103]);
  });

  describe('after the pool has been disposed', () => {
    const makeDescriptor = () =>
      new VertexObjectDescriptor({
        vertexCount: 4,

        attributes: {
          foo: {
            components: ['x', 'y'],
            type: 'float32',
          },
          bar: {
            size: 1,
            type: 'float32',
            usage: 'dynamic',
          },
        },
      });

    /** The buffer of a pool that has given up its typed arrays, still reachable through `pool.buffer`. */
    const releasedBuffer = (): VertexObjectBuffer => {
      const pool = new VertexObjectPool<VO>(makeDescriptor(), 2);
      const {buffer} = pool;
      pool.dispose();
      return buffer;
    };

    test('copy() from a released buffer throws', () => {
      const target = new VertexObjectBuffer(makeDescriptor(), 2);
      const source = releasedBuffer();

      const run = () => target.copy(source);
      expect(run, 'the message names the class and the method').toThrow(/VertexObjectBuffer#copy\(\)/);
      expect(run, 'the message names the state').toThrow(/disposed/);
    });

    test('copy() from a buffer of another description says so instead', () => {
      const target = new VertexObjectBuffer(makeDescriptor(), 2);
      const other = new VertexObjectBuffer(
        new VertexObjectDescriptor({vertexCount: 4, attributes: {elsewhere: {size: 1, bufferName: 'elsewhere'}}}),
        2,
      );

      const run = () => target.copy(other);
      expect(run, 'the message names the class, the method and the buffer').toThrow(
        /VertexObjectBuffer#copy\(\) finds no buffer named "\w+"/,
      );
      expect(run, 'two descriptions that drifted apart are not the released state').not.toThrow(/disposed/);
    });

    test('copyArray() throws', () => {
      const buffer = releasedBuffer();

      const run = () => buffer.copyArray(new Float32Array(8), 'dynamic_float32');
      expect(run, 'the message names the class and the method').toThrow(/VertexObjectBuffer#copyArray\(\)/);
      expect(run, 'the message names the state').toThrow(/disposed/);
    });

    test('copyArray() with an unknown buffer name says so instead', () => {
      const buffer = new VertexObjectBuffer(makeDescriptor(), 2);

      const run = () => buffer.copyArray(new Float32Array(8), 'nowhere');
      expect(run, 'the message names the class, the method and the buffer').toThrow(
        /VertexObjectBuffer#copyArray\(\).*"nowhere"/,
      );
      expect(run, 'a typo is not the released state').not.toThrow(/disposed/);
    });

    test('copyAttributes() throws', () => {
      const buffer = releasedBuffer();

      const run = () => buffer.copyAttributes({bar: [1, 2, 3, 4]});
      expect(run, 'the message names the class and the method').toThrow(/VertexObjectBuffer#copyAttributes\(\)/);
      expect(run, 'the message names the state').toThrow(/disposed/);
    });

    test('toAttributeArrays() throws', () => {
      const buffer = releasedBuffer();

      const run = () => buffer.toAttributeArrays(['bar']);
      expect(run, 'the message names the class and the method').toThrow(/VertexObjectBuffer#toAttributeArrays\(\)/);
      expect(run, 'the message names the state').toThrow(/disposed/);
    });

    test('the constructor refuses a released buffer as its source', () => {
      const source = releasedBuffer();

      const run = () => new VertexObjectBuffer(source, 2);
      expect(run, 'the message names the class').toThrow(/VertexObjectBuffer/);
      expect(run, 'the message names the state').toThrow(/disposed/);
    });

    test('clone() throws', () => {
      const buffer = releasedBuffer();

      const run = () => buffer.clone();
      expect(run, 'the message names the class').toThrow(/VertexObjectBuffer/);
      expect(run, 'the message names the state').toThrow(/disposed/);
    });

    test('copyWithin() and touch() do nothing', () => {
      const buffer = releasedBuffer();

      expect(() => buffer.copyWithin(0, 1, 2)).not.toThrow();
      expect(() => buffer.touch()).not.toThrow();
    });

    test('the read-only fields go on saying what this buffer was', () => {
      const pool = new VertexObjectPool<VO>(makeDescriptor(), 2);
      const {buffer} = pool;

      const {descriptor, capacity, attributeNames} = buffer;
      const bufferAttributeNames = Array.from(buffer.bufferAttributes.keys()).sort();
      const bufferNames = Array.from(buffer.bufferNameAttributes.keys()).sort();

      pool.dispose();

      expect(buffer.descriptor).toBe(descriptor);
      expect(buffer.capacity).toBe(capacity);
      expect(buffer.attributeNames).toEqual(attributeNames);
      expect(Array.from(buffer.bufferAttributes.keys()).sort()).toEqual(bufferAttributeNames);
      expect(Array.from(buffer.bufferNameAttributes.keys()).sort()).toEqual(bufferNames);
      expect(buffer.buffers.size, 'the data is gone, the description of it is not').toBe(0);
    });
  });
});
