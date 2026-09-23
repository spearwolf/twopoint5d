import vm from 'node:vm';
import {describe, expect, expectTypeOf, test} from 'vitest';
import type {AttributeBufferLayout} from './VertexObjectBuffer.js';
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

  describe('a copy that does not fit the target buffer', () => {
    const makeDescriptor = () =>
      new VertexObjectDescriptor({
        vertexCount: 2,
        attributes: {
          pos: {components: ['x', 'y'], type: 'float32', usage: 'dynamic'},
          id: {size: 1, type: 'float32', usage: 'static'},
        },
      });

    /** Writes `value` into the last element of every buffer — the one a copy past the end reaches first. */
    const markLastElement = (buffer: VertexObjectBuffer, value: number): void => {
      for (const buf of buffer.buffers.values()) {
        buf.typedArray![buf.typedArray!.length - 1] = value;
      }
    };

    const lastElements = (buffer: VertexObjectBuffer): number[] =>
      Array.from(buffer.buffers.values(), (buf) => buf.typedArray![buf.typedArray!.length - 1]!);

    /** Every buffer element by element — what a write lands in shows up wherever it lands. */
    const contentsOf = (buffer: VertexObjectBuffer): number[][] =>
      Array.from(buffer.buffers.values(), (buf) => Array.from(buf.typedArray!));

    const fillAll = (buffer: VertexObjectBuffer, value: number): void => {
      for (const buf of buffer.buffers.values()) {
        buf.typedArray!.fill(value);
      }
    };

    test('copy() names itself when the source has more objects than fit', () => {
      const target = new VertexObjectBuffer(makeDescriptor(), 4);
      const source = new VertexObjectBuffer(makeDescriptor(), 3);

      markLastElement(target, 7);

      const run = () => target.copy(source, 2);

      expect(run).toThrow(RangeError);
      expect(run, 'the message names the class and the method').toThrow(/VertexObjectBuffer#copy\(\)/);
      expect(lastElements(target), 'a refused call leaves the target as it was').toEqual([7, 7]);
    });

    test('copyArray() names itself and the buffer when the source reaches past the last object', () => {
      const buffer = new VertexObjectBuffer(makeDescriptor(), 2);
      const {itemSize, typedArray} = buffer.buffers.get('dynamic_float32')!;

      markLastElement(buffer, 7);

      // one object more than the buffer has room for
      const source = new Float32Array(typedArray!.length + 2 * itemSize);
      const run = () => buffer.copyArray(source, 'dynamic_float32');

      expect(run).toThrow(RangeError);
      expect(run, 'the message names the class, the method and the buffer').toThrow(
        /VertexObjectBuffer#copyArray\(\).*"dynamic_float32"/,
      );
      expect(lastElements(buffer), 'a refused call leaves the buffer as it was').toEqual([7, 7]);
    });

    test('copy() refuses a target offset that names no object', () => {
      const target = new VertexObjectBuffer(makeDescriptor(), 4);
      const source = new VertexObjectBuffer(makeDescriptor(), 1);

      fillAll(target, 7);

      const before = contentsOf(target);
      const run = () => target.copy(source, 0.5);

      expect(run).toThrow(RangeError);
      expect(run, 'the message names the class, the method and the value').toThrow(/VertexObjectBuffer#copy\(\).*0\.5/);
      // half an object is a whole number of elements wherever itemSize is even, so the write
      // would land inside object 0 and shift every value against the layout
      expect(contentsOf(target), 'no element of any buffer was written').toEqual(before);
    });

    test('copyArray() refuses a target offset that names no object', () => {
      const buffer = new VertexObjectBuffer(makeDescriptor(), 4);

      fillAll(buffer, 7);

      const before = contentsOf(buffer);
      const run = () => buffer.copyArray(new Float32Array(4), 'dynamic_float32', 0.5);

      expect(run).toThrow(RangeError);
      expect(run, 'the message names the class, the method and the value').toThrow(/VertexObjectBuffer#copyArray\(\).*0\.5/);
      expect(contentsOf(buffer), 'no element of any buffer was written').toEqual(before);
    });

    test.each([-1, -0.5])('copy() refuses a target offset of %s', (offset) => {
      const target = new VertexObjectBuffer(makeDescriptor(), 4);
      const source = new VertexObjectBuffer(makeDescriptor(), 1);

      expect(() => target.copy(source, offset)).toThrow(RangeError);
      expect(() => target.copy(source, offset)).toThrow(`got ${offset}`);
    });
  });

  describe('a copy the target cannot take buffer for buffer', () => {
    /**
     * Two buffers, `first` and `second`, with `second` sized by `tagSize`. Two descriptors built
     * with different sizes agree on the buffer names and disagree on how wide `second` is.
     */
    const makeDescriptor = (tagSize: number) =>
      new VertexObjectDescriptor({
        vertexCount: 1,
        attributes: {
          // `pos` sorts before `tag`, so `first` is the buffer a copy would write before it reaches `second`
          pos: {size: 2, type: 'float32', bufferName: 'first'},
          tag: {size: tagSize, type: 'float32', bufferName: 'second'},
        },
      });

    const contentsOfFirst = (buffer: VertexObjectBuffer): number[] => Array.from(buffer.buffers.get('first')!.typedArray!);

    test('a source buffer wider than its target leaves no buffer of the target written', () => {
      const target = new VertexObjectBuffer(makeDescriptor(1), 4);
      const source = new VertexObjectBuffer(makeDescriptor(4), 4);

      target.buffers.get('first')!.typedArray!.fill(7);

      const run = () => target.copy(source);

      expect(run).toThrow(RangeError);
      expect(run, 'the message names the class, the method and the buffer').toThrow(/VertexObjectBuffer#copy\(\).*"second"/);
      // as many objects as the target holds, so the object count alone lets this copy through
      expect(contentsOfFirst(target), 'the buffer that would have fit is untouched').toEqual(new Array(8).fill(7));
    });

    test('a source missing one of the buffers leaves no buffer of the target written', () => {
      const target = new VertexObjectBuffer(makeDescriptor(1), 4);
      const source = new VertexObjectBuffer(
        new VertexObjectDescriptor({vertexCount: 1, attributes: {pos: {size: 2, type: 'float32', bufferName: 'first'}}}),
        4,
      );

      target.buffers.get('first')!.typedArray!.fill(7);

      const run = () => target.copy(source);

      expect(run, 'the message names the class, the method and the buffer').toThrow(
        /VertexObjectBuffer#copy\(\) finds no buffer named "second"/,
      );
      expect(contentsOfFirst(target), 'the buffer the source does have is untouched').toEqual(new Array(8).fill(7));
    });

    test('a source buffer narrower than its target leaves no buffer of the target written', () => {
      const target = new VertexObjectBuffer(makeDescriptor(4), 4);
      const source = new VertexObjectBuffer(makeDescriptor(2), 4);

      target.buffers.get('first')!.typedArray!.fill(7);

      const run = () => target.copy(source);

      expect(run).toThrow(RangeError);
      expect(run, 'the message names the class, the method and the buffer').toThrow(/VertexObjectBuffer#copy\(\).*"second"/);
      // the narrower source fits into the target element for element, so a length alone lets this
      // copy through — and every value of it would land at the stride of the wider layout
      expect(contentsOfFirst(target), 'the buffer that would have fit is untouched').toEqual(new Array(8).fill(7));
    });

    test('a source of another data type leaves no buffer of the target written', () => {
      const makeTypedDescriptor = (tagType: 'float32' | 'uint32') =>
        new VertexObjectDescriptor({
          vertexCount: 1,
          attributes: {
            pos: {size: 2, type: 'float32', bufferName: 'first'},
            tag: {size: 1, type: tagType, bufferName: 'second'},
          },
        });

      const target = new VertexObjectBuffer(makeTypedDescriptor('float32'), 4);
      const source = new VertexObjectBuffer(makeTypedDescriptor('uint32'), 4);

      target.buffers.get('first')!.typedArray!.fill(7);

      const run = () => target.copy(source);

      expect(run).toThrow(TypeError);
      expect(run, 'the message names the class, the method and the buffer').toThrow(/VertexObjectBuffer#copy\(\).*"second"/);
      expect(contentsOfFirst(target), 'the buffer of the matching type is untouched').toEqual(new Array(8).fill(7));
    });

    test('a source describing another vertex count leaves no buffer of the target written', () => {
      const makeCountedDescriptor = (vertexCount: number) =>
        new VertexObjectDescriptor({
          vertexCount,
          attributes: {pos: {size: 2, type: 'float32', bufferName: 'first'}},
        });

      const target = new VertexObjectBuffer(makeCountedDescriptor(4), 4);
      const source = new VertexObjectBuffer(makeCountedDescriptor(1), 4);

      target.buffers.get('first')!.typedArray!.fill(7);

      const run = () => target.copy(source);

      expect(run).toThrow(RangeError);
      expect(run, 'the message names the class, the method and both vertex counts').toThrow(
        /VertexObjectBuffer#copy\(\): the source has a vertexCount of 1, this buffer one of 4:/,
      );
      expect(contentsOfFirst(target), 'the only buffer of the target is untouched').toEqual(new Array(32).fill(7));
    });
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

  test('the layout maps are typed read-only', () => {
    const vob = new VertexObjectBuffer(new VertexObjectDescriptor({vertexCount: 1, attributes: {v: {size: 1}}}), 1);

    expectTypeOf(vob.bufferAttributes).toEqualTypeOf<ReadonlyMap<string, Readonly<AttributeBufferLayout>>>();
    expectTypeOf(vob.bufferNameAttributes).toEqualTypeOf<ReadonlyMap<string, readonly Readonly<AttributeBufferLayout>[]>>();
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

  describe('object index checks', () => {
    const makeBuffer = () =>
      new VertexObjectBuffer(
        new VertexObjectDescriptor({
          vertexCount: 1,
          attributes: {
            v: {size: 2, type: 'float32'},
          },
        }),
        4,
      );

    test('toAttributeArrays() turns away an end beyond the capacity', () => {
      const vob = makeBuffer();

      const run = () => vob.toAttributeArrays(['v'], 2, 6);

      expect(run).toThrow(RangeError);
      expect(run, 'the message names the class and the method').toThrow(/VertexObjectBuffer#toAttributeArrays\(\)/);
    });

    test('toAttributeArrays() turns away a negative start', () => {
      const vob = makeBuffer();

      const run = () => vob.toAttributeArrays(['v'], -1, 1);

      expect(run).toThrow(RangeError);
    });

    test('toAttributeArrays() turns away a start after the end', () => {
      const vob = makeBuffer();

      const run = () => vob.toAttributeArrays(['v'], 3, 1);

      expect(run).toThrow(RangeError);
    });

    test('toAttributeArrays() turns away a fraction', () => {
      const vob = makeBuffer();

      const run = () => vob.toAttributeArrays(['v'], 0.5, 2);

      expect(run).toThrow(RangeError);
    });

    test('copyWithin() turns away a negative index', () => {
      const vob = makeBuffer();

      expect(() => vob.copyWithin(-1, 0, 1)).toThrow(RangeError);
      expect(() => vob.copyWithin(0, -1, 1)).toThrow(RangeError);
    });

    test('copyWithin() turns away a range that reaches past the capacity', () => {
      const vob = makeBuffer();

      expect(() => vob.copyWithin(3, 0, 2)).toThrow(RangeError);
    });

    test('copyWithin() that is turned away writes nothing', () => {
      const vob = makeBuffer();
      vob.copyAttributes({v: [1, 2, 3, 4, 5, 6, 7, 8]});

      const before = Array.from(vob.buffers.values(), (buf) => [Array.from(buf.typedArray!), buf.serial]);

      expect(() => vob.copyWithin(3, 0, 2)).toThrow(RangeError);

      const after = Array.from(vob.buffers.values(), (buf) => [Array.from(buf.typedArray!), buf.serial]);
      expect(after).toEqual(before);
    });

    test('copyWithin() on the buffer of a disposed pool checks nothing', () => {
      const pool = new VertexObjectPool<VO>(
        new VertexObjectDescriptor({vertexCount: 1, attributes: {v: {size: 2, type: 'float32'}}}),
        4,
      );
      const {buffer} = pool;
      pool.dispose();

      expect(() => buffer.copyWithin(-1, 0, 1)).not.toThrow();
    });
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

    test('copy() into a released buffer does nothing, whatever the source brings', () => {
      const target = releasedBuffer();
      // more objects than the target ever had room for, and a fractional offset besides
      const source = new VertexObjectBuffer(makeDescriptor(), 10);

      expect(target.capacity, 'a released buffer goes on saying what it was sized for').toBe(2);
      expect(() => target.copy(source)).not.toThrow();
      expect(() => target.copy(source, 0.5)).not.toThrow();
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

  describe('a buffer over a description without attributes', () => {
    test('copy() does nothing, whatever the source brings', () => {
      const target = new VertexObjectBuffer(new VertexObjectDescriptor({vertexCount: 2, attributes: {}}), 2);
      // more objects than the target has room for, a negative and a fractional offset besides
      const source = new VertexObjectBuffer(
        new VertexObjectDescriptor({
          vertexCount: 4,
          attributes: {
            foo: {components: ['x', 'y'], type: 'float32'},
            bar: {size: 1, type: 'float32', usage: 'dynamic'},
          },
        }),
        10,
      );

      expect(target.buffers.size, 'there is nothing to write into').toBe(0);
      expect(target.copy(source), 'the buffer itself comes back').toBe(target);
      expect(target.copy(source, 0.5)).toBe(target);
      expect(target.copy(source, -1)).toBe(target);
    });
  });

  describe('buffers data that does not fit the layout', () => {
    // two buffers of different element types: float32 with an item size of 2, uint32 with 1
    const makeDescriptor = () =>
      new VertexObjectDescriptor({
        vertexCount: 2,
        attributes: {
          pos: {components: ['x', 'y'], type: 'float32'},
          id: {size: 1, type: 'uint32'},
        },
      });

    const capacity = 3;
    const floatLength = capacity * 2 * 2;
    const uintLength = capacity * 2 * 1;

    const buffersData = (buffers: Record<string, unknown>) => ({capacity, usedCount: 0, buffers}) as never;

    const branches = [
      ['from a descriptor', () => makeDescriptor()],
      ['from a source buffer', () => new VertexObjectBuffer(makeDescriptor(), capacity)],
    ] as const;

    for (const [branch, makeSource] of branches) {
      describe(branch, () => {
        test('refuses an array of another type', () => {
          const build = () => new VertexObjectBuffer(makeSource(), buffersData({static_float32: new Uint32Array(floatLength)}));

          expect(build).toThrow(TypeError);
          expect(build).toThrow(
            /VertexObjectBuffer: buffer "static_float32" holds float32 data and takes a Float32Array, got Uint32Array/,
          );
          expect(() => new VertexObjectBuffer(makeSource(), buffersData({static_uint32: [1, 2, 3, 4, 5, 6]}))).toThrow(
            /takes a Uint32Array, got Array/,
          );
        });

        test('refuses an array shorter than the layout', () => {
          const build = () => new VertexObjectBuffer(makeSource(), buffersData({static_uint32: new Uint32Array(uintLength - 1)}));

          expect(build).toThrow(RangeError);
          expect(build).toThrow(/buffer "static_uint32" takes exactly 6 elements .*, got 5/);
        });

        test('refuses an array longer than the layout', () => {
          const build = () =>
            new VertexObjectBuffer(makeSource(), buffersData({static_float32: new Float32Array(floatLength + 1)}));

          expect(build).toThrow(RangeError);
          expect(build).toThrow(/buffer "static_float32" takes exactly 12 elements/);
        });

        test('takes a typed array from another realm', () => {
          const foreign = vm.runInNewContext(`new Float32Array(${floatLength})`) as Float32Array;
          expect(foreign instanceof Float32Array, 'the array really comes from another realm').toBe(false);

          const buffer = new VertexObjectBuffer(makeSource(), buffersData({static_float32: foreign}));

          expect(buffer.buffers.get('static_float32')!.typedArray).toBe(foreign);
          expect(buffer.buffers.get('static_uint32')!.typedArray, 'a buffer not named gets a fresh array').toHaveLength(
            uintLength,
          );
        });
      });
    }
  });

  describe('a capacity that is no integer of 0 or more', () => {
    const makeDescriptor = () =>
      new VertexObjectDescriptor({
        vertexCount: 2,
        attributes: {
          pos: {components: ['x', 'y'], type: 'float32'},
          id: {size: 1, type: 'uint32'},
        },
      });

    const branches = [
      ['from a descriptor', () => makeDescriptor()],
      ['from a source buffer', () => new VertexObjectBuffer(makeDescriptor(), 3)],
    ] as const;

    for (const [branch, makeSource] of branches) {
      describe(branch, () => {
        test.each([1.5, NaN, -1, Infinity, -Infinity])('refuses a capacity of %s and names it', (capacity) => {
          const build = () => new VertexObjectBuffer(makeSource(), capacity);

          expect(build).toThrow(RangeError);
          // a string, not a RegExp: the text of 1.5 holds a dot
          expect(build).toThrow(`VertexObjectBuffer: capacity must be a non-negative integer, got ${capacity}`);
        });

        test.each([1.5, NaN, -1, undefined])('refuses a buffersData.capacity of %s and names it', (capacity) => {
          const build = () => new VertexObjectBuffer(makeSource(), {capacity, usedCount: 0, buffers: {}} as never);

          expect(build).toThrow(RangeError);
          expect(build).toThrow(
            `VertexObjectBuffer: buffersData.capacity must be a non-negative integer, got ${String(capacity)}`,
          );
        });

        test('takes a capacity of 0', () => {
          const buffer = new VertexObjectBuffer(makeSource(), 0);

          expect(buffer.capacity).toBe(0);
          expect(buffer.buffers.size).toBeGreaterThan(0);
          for (const {typedArray} of buffer.buffers.values()) {
            expect(typedArray).toHaveLength(0);
          }
        });
      });
    }
  });
});
