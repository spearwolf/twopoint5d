import type {InstancedBufferAttribute, InterleavedBufferAttribute} from 'three/webgpu';
import {BufferAttribute, BufferGeometry, InstancedInterleavedBuffer} from 'three/webgpu';
import {describe, expect, test} from 'vitest';
import {InstancedVOBufferGeometry} from './InstancedVOBufferGeometry.js';
import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import type {VOBufferGeometry} from './VOBufferGeometry.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectGeometry} from './VertexObjectGeometry.js';
import {VertexObjectPool} from './VertexObjectPool.js';
import type {BufferLike, VO} from './types.js';

describe('vertex-buffers-geometry-updates', () => {
  /** The buffer behind the attribute that currently sits in the slot `attrName`, or `undefined` if the slot is empty. */
  const bufferInSlot = (geometry: BufferGeometry, attrName: string): BufferLike | undefined => {
    const attr = geometry.getAttribute(attrName);
    if (attr == null) return undefined;
    return (attr as InterleavedBufferAttribute).isInterleavedBufferAttribute
      ? (attr as InterleavedBufferAttribute).data
      : (attr as BufferAttribute);
  };

  /** The update ranges the gpu upload of `attrName` will use, read from the buffer behind the attribute. */
  const updateRangesOf = (geometry: BufferGeometry, attrName: string) => bufferInSlot(geometry, attrName)?.updateRanges;

  /**
   * Put the buffer of `attrName` into the state a delivered upload leaves it in: three takes the
   * ranges of a buffer up as it uploads them and leaves none behind. Without a renderer in this
   * suite, the tests that care whether a range was delivered say so here.
   *
   * It is the shorter promise of the two. three keeps that bargain from the second upload of an
   * attribute on — the first builds the gpu buffer out of the whole array and lets the range
   * stand — and it uploads only what `needsUpdate` marks on a mesh that is actually drawn. This
   * asks after none of the three and empties the ranges either way.
   */
  const uploaded = (geometry: BufferGeometry, attrName: string) => bufferInSlot(geometry, attrName)?.clearUpdateRanges();

  const baseDesc = new VertexObjectDescriptor({
    vertexCount: 4,
    indices: [0, 1, 2, 0, 2, 3],

    attributes: {
      position: {
        components: ['x', 'y', 'z'],
        type: 'float32',
        bufferName: 'positions',
      },
    },
  });

  const instancedDesc = new VertexObjectDescriptor({
    attributes: {
      color: {
        components: ['r', 'g', 'b', 'a'],
        type: 'uint8',
      },
      foo: {
        size: 1,
        type: 'float32',
      },
      bar: {
        size: 2,
        type: 'float32',
      },
      impact: {
        size: 1,
        type: 'uint32',
        usage: 'dynamic',
      },
    },
  });

  interface MyBaseVO extends VO {
    x0: number;
    y0: number;
    z0: number;
    x1: number;
    y1: number;
    z1: number;
    x2: number;
    y2: number;
    z2: number;
    x3: number;
    y3: number;
    z3: number;

    // biome-ignore format: the line breaks lay the numbers out row by row
    setPosition(values: [
      number, number, number,
      number, number, number,
      number, number, number,
      number, number, number,
    ]): void;
  }

  const extraDesc = new VertexObjectDescriptor({
    attributes: {
      quux: {
        size: 1,
        type: 'float32',
      },
    },
  });

  // shares no attribute name with any other descriptor here
  const otherExtraDesc = new VertexObjectDescriptor({
    attributes: {
      plah: {
        size: 1,
        type: 'float32',
      },
    },
  });

  // declares an attribute name of `instancedDesc`
  const fooDesc = new VertexObjectDescriptor({
    attributes: {
      foo: {
        size: 1,
        type: 'float32',
      },
    },
  });

  interface MyInstancedVO extends VO {
    r: number;
    g: number;
    b: number;
    a: number;

    setColor(color: [number, number, number, number]): void;

    foo: number;

    setBar(bar: [number, number]): void;

    impact: number;
  }

  describe('InstancedVertexObjectGeometry', () => {
    const makeInstancedGeometry = () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const pool = geometry.instancedPool;

      const vo0 = pool.createVO()!;
      vo0.setColor([1, 2, 3, 4]);
      vo0.foo = 100;
      vo0.setBar([101, 102]);
      vo0.impact = 1000;

      const vo1 = pool.createVO()!;
      vo1.setColor([5, 6, 7, 8]);
      vo1.foo = 103;
      vo1.setBar([104, 105]);
      vo1.impact = 1001;

      const vo2 = pool.createVO()!;
      vo2.setColor([9, 10, 11, 12]);
      vo2.foo = 106;
      vo2.setBar([107, 108]);
      vo2.impact = 1002;

      const base = geometry.basePool!.createVO()!;
      // biome-ignore format: the line breaks lay the numbers out row by row
      base.setPosition([
        0, 1, 2,
        3, 4, 5,
        6, 7, 8,
        9, 10, 11,
      ]);

      return [geometry, pool, vo0, vo1, vo2, base] as const;
    };

    describe('create buffers and arrays', () => {
      test('position', () => {
        const [geometry] = makeInstancedGeometry();

        const static_float32 = geometry.baseBuffers!.get('positions')!.array;
        const positionAttribute = geometry.getAttribute('position')! as BufferAttribute;

        expect(positionAttribute.isBufferAttribute).toBe(true);
        expect(positionAttribute.array).toBe(static_float32);
        expect(static_float32).toBe(geometry.basePool!.buffer.buffers.get('positions')!.typedArray);
      });

      test('color', () => {
        const [geometry] = makeInstancedGeometry();

        expect(geometry.instancedBuffers.get('static_uint8')!.array).toBe(
          geometry.instancedPool.buffer.buffers.get('static_uint8')!.typedArray,
        );

        // four bytes without normalized: an InterleavedBuffer, which three uploads as it is
        const colorAttribute = geometry.getAttribute('color')! as InterleavedBufferAttribute;
        expect(colorAttribute.isInterleavedBufferAttribute).toBe(true);
        expect(colorAttribute.data).toBeInstanceOf(InstancedInterleavedBuffer);
        expect(colorAttribute.data.array).toBe(geometry.instancedPool.buffer.buffers.get('static_uint8')!.typedArray);
      });

      test('foo, bar', () => {
        const [geometry] = makeInstancedGeometry();

        expect(geometry.instancedBuffers.get('static_float32')!.array).toBe(
          geometry.instancedPool.buffer.buffers.get('static_float32')!.typedArray,
        );

        const fooAttribute = geometry.getAttribute('foo')! as InterleavedBufferAttribute;
        expect(fooAttribute.isInterleavedBufferAttribute).toBe(true);
        expect(fooAttribute.array).toBe(geometry.instancedPool.buffer.buffers.get('static_float32')!.typedArray);

        const barAttribute = geometry.getAttribute('bar')! as InterleavedBufferAttribute;
        expect(barAttribute.isInterleavedBufferAttribute).toBe(true);
        expect(barAttribute.array).toBe(geometry.instancedPool.buffer.buffers.get('static_float32')!.typedArray);
      });

      test('impact', () => {
        const [geometry] = makeInstancedGeometry();
        expect(geometry.instancedBuffers.get('dynamic_uint32')!.array).toBe(
          geometry.instancedPool.buffer.buffers.get('dynamic_uint32')!.typedArray,
        );

        const impactAttribute = geometry.getAttribute('impact')! as InstancedBufferAttribute;
        expect(impactAttribute.isInstancedBufferAttribute).toBe(true);
        expect(impactAttribute.array).toBe(geometry.instancedPool.buffer.buffers.get('dynamic_uint32')!.typedArray);
      });
    });

    describe('fromBuffersData', () => {
      test('position: zero-copy', () => {
        const [geometry, , , , , base] = makeInstancedGeometry();

        const buffer = geometry.basePool!.buffer.buffers.get('positions')!;
        const initialPositions = buffer.typedArray;
        const positionAttribute = geometry.getAttribute('position')! as BufferAttribute;

        expect(positionAttribute.array).toBe(initialPositions);
        expect(geometry.basePool!.capacity).toBe(1);

        expect(base.x0).toBe(0);
        expect(base.y0).toBe(1);
        expect(base.z0).toBe(2);
        expect(base.x3).toBe(9);
        expect(base.y3).toBe(10);
        expect(base.z3).toBe(11);

        // biome-ignore format: the line breaks lay the numbers out row by row
        const positions = new Float32Array([
          100, 101, 102,
          103, 104, 105,
          106, 107, 108,
          109, 110, 111,
        ]);

        geometry.basePool!.fromBuffersData({
          capacity: 1,
          usedCount: 1,
          buffers: {
            positions,
          },
        });

        expect(base.x0).toBe(100);
        expect(base.y0).toBe(101);
        expect(base.z0).toBe(102);
        expect(base.x3).toBe(109);
        expect(base.y3).toBe(110);
        expect(base.z3).toBe(111);

        expect(buffer.typedArray).not.toBe(initialPositions);
        expect(buffer.typedArray).toBe(positions);
        expect(positionAttribute.array).toBe(initialPositions);

        geometry.update();

        expect(positionAttribute.array).toBe(positions);
        expect(positionAttribute.array).not.toBe(initialPositions);
      });

      test('position: copy', () => {
        const [geometry, , , , , base] = makeInstancedGeometry();

        const buffer = geometry.baseBuffers!.get('positions')!;
        const initialPositions = buffer.array;
        const positionAttribute = geometry.getAttribute('position')! as BufferAttribute;

        expect(positionAttribute.array).toBe(initialPositions);
        expect(geometry.basePool!.capacity).toBe(1);

        expect(base.x0).toBe(0);
        expect(base.y0).toBe(1);
        expect(base.z0).toBe(2);
        expect(base.x3).toBe(9);
        expect(base.y3).toBe(10);
        expect(base.z3).toBe(11);

        // biome-ignore format: the line breaks lay the numbers out row by row
        const positions = new Float32Array([
          100, 101, 102,
          103, 104, 105,
          106, 107, 108,
          109, 110, 111,
        ]);

        geometry.basePool!.fromBuffersData(
          {
            capacity: 1,
            usedCount: 1,
            buffers: {
              positions,
            },
          },
          true,
        );

        expect(base.x0).toBe(100);
        expect(base.y0).toBe(101);
        expect(base.z0).toBe(102);
        expect(base.x3).toBe(109);
        expect(base.y3).toBe(110);
        expect(base.z3).toBe(111);

        geometry.update();

        expect(positionAttribute.array).not.toBe(positions);
        expect(positionAttribute.array).toBe(initialPositions);
      });

      test('position: copy (because of smaller array)', () => {
        const [geometry, , , , , base] = makeInstancedGeometry();

        const buffer = geometry.baseBuffers!.get('positions')!;
        const initialPositions = buffer.array;
        const positionAttribute = geometry.getAttribute('position')! as BufferAttribute;

        expect(base.x0).toBe(0);
        expect(base.y0).toBe(1);
        expect(base.z0).toBe(2);
        expect(base.x1).toBe(3);
        expect(base.y1).toBe(4);
        expect(base.z1).toBe(5);
        expect(base.x2).toBe(6);
        expect(base.y2).toBe(7);
        expect(base.z2).toBe(8);
        expect(base.x3).toBe(9);
        expect(base.y3).toBe(10);
        expect(base.z3).toBe(11);

        // biome-ignore format: the line breaks lay the numbers out row by row
        const positions = new Float32Array([
          100, 101, 102,
          103, 104, 105,
        ]);

        geometry.basePool!.fromBuffersData({
          capacity: 1,
          usedCount: 1,
          buffers: {
            positions,
          },
        });

        expect(base.x0).toBe(100);
        expect(base.y0).toBe(101);
        expect(base.z0).toBe(102);
        expect(base.x1).toBe(103);
        expect(base.y1).toBe(104);
        expect(base.z1).toBe(105);
        expect(base.x2).toBe(6);
        expect(base.y2).toBe(7);
        expect(base.z2).toBe(8);
        expect(base.x3).toBe(9);
        expect(base.y3).toBe(10);
        expect(base.z3).toBe(11);

        geometry.update();

        expect(positionAttribute.array).not.toBe(positions);
        expect(positionAttribute.array).toBe(initialPositions);
      });

      test('foo: zero-copy', () => {
        const [geometry, , vo0, vo1, vo2] = makeInstancedGeometry();

        const buffer = geometry.instancedBuffers.get('static_float32')!;
        const initialDataArray = buffer.array;
        const fooAttribute = geometry.getAttribute('foo')! as InterleavedBufferAttribute;

        expect(fooAttribute.data.array).toBe(initialDataArray);
        expect(geometry.instancedPool.capacity).toBe(10);

        expect(vo0.foo).toBe(100);
        expect(vo1.foo).toBe(103);
        expect(vo2.foo).toBe(106);

        // biome-ignore format: the line breaks lay the numbers out row by row
        const dataArray = new Float32Array([
          // mh.. here we don't know if foo or bar[2] is first, so we need to set all to same value
          500, 500, 500,
          503, 503, 503,
          506, 506, 506,
          0, 0, 0,
          0, 0, 0,
          0, 0, 0,
          0, 0, 0,
          0, 0, 0,
          0, 0, 0,
          0, 0, 0,
        ]);

        geometry.instancedPool.fromBuffersData({
          capacity: 10,
          usedCount: 3,
          buffers: {
            static_float32: dataArray,
          },
        });

        expect(vo0.foo).toBe(500);
        expect(vo1.foo).toBe(503);
        expect(vo2.foo).toBe(506);

        geometry.update();

        expect(fooAttribute.array).toBe(dataArray);
        expect(fooAttribute.array).not.toBe(initialDataArray);
      });
    });

    test('first (initial) update', () => {
      const [geometry, pool] = makeInstancedGeometry();

      expect(pool.usedCount).toBe(3);

      expect(pool.buffer.toAttributeArrays(['color', 'foo', 'bar', 'impact'], 0, pool.usedCount)).toEqual({
        color: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
        foo: new Float32Array([100, 103, 106]),
        bar: new Float32Array([101, 102, 104, 105, 107, 108]),
        impact: new Uint32Array([1000, 1001, 1002]),
      });

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBe(0);
      expect((geometry.getAttribute('color') as InterleavedBufferAttribute).data.version, 'color').toBe(0);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBe(0);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBe(0);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBe(0);

      expect(geometry.drawRange).toEqual({start: 0, count: Infinity});

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBeGreaterThan(0);
      expect((geometry.getAttribute('color') as InterleavedBufferAttribute).data.version, 'color').toBeGreaterThan(0);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(0);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBeGreaterThan(0);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBeGreaterThan(0);

      expect(geometry.instanceCount).toEqual(3);
    });

    test('dynamic auto update', () => {
      const [geometry] = makeInstancedGeometry();

      geometry.update();

      const position_serial = (geometry.getAttribute('position') as BufferAttribute).version;
      const color_serial = (geometry.getAttribute('color') as InterleavedBufferAttribute).data.version;
      const impact_serial = (geometry.getAttribute('impact') as BufferAttribute).version;
      const foo_serial = (geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version;
      const bar_serial = (geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version;

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBe(position_serial);
      expect((geometry.getAttribute('color') as InterleavedBufferAttribute).data.version, 'color').toBe(color_serial);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(impact_serial);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBe(foo_serial);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBe(bar_serial);
    });

    test('touch color', () => {
      const [geometry] = makeInstancedGeometry();

      geometry.update();

      const position_serial = (geometry.getAttribute('position') as BufferAttribute).version;
      const color_serial = (geometry.getAttribute('color') as InterleavedBufferAttribute).data.version;
      const impact_serial = (geometry.getAttribute('impact') as BufferAttribute).version;
      const foo_serial = (geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version;
      const bar_serial = (geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version;

      geometry.touch('color');

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBe(position_serial);
      expect((geometry.getAttribute('color') as InterleavedBufferAttribute).data.version, 'color').toBeGreaterThan(color_serial);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(impact_serial);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBe(foo_serial);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBe(bar_serial);
    });

    test('touch foo:interleaved', () => {
      const [geometry] = makeInstancedGeometry();

      geometry.update();

      const position_serial = (geometry.getAttribute('position') as BufferAttribute).version;
      const color_serial = (geometry.getAttribute('color') as InterleavedBufferAttribute).data.version;
      const impact_serial = (geometry.getAttribute('impact') as BufferAttribute).version;
      const foo_serial = (geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version;
      const bar_serial = (geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version;

      geometry.touch('foo');

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBe(position_serial);
      expect((geometry.getAttribute('color') as InterleavedBufferAttribute).data.version, 'color').toBe(color_serial);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(impact_serial);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBeGreaterThan(foo_serial);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBeGreaterThan(bar_serial);
    });

    test('createVO', () => {
      const [geometry, pool] = makeInstancedGeometry();

      geometry.update();

      const position_serial = (geometry.getAttribute('position') as BufferAttribute).version;
      const color_serial = (geometry.getAttribute('color') as InterleavedBufferAttribute).data.version;
      const impact_serial = (geometry.getAttribute('impact') as BufferAttribute).version;
      const foo_serial = (geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version;
      const bar_serial = (geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version;

      pool.createVO();

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBe(position_serial);
      expect((geometry.getAttribute('color') as InterleavedBufferAttribute).data.version, 'color').toBeGreaterThan(color_serial);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(impact_serial);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBeGreaterThan(foo_serial);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBeGreaterThan(bar_serial);

      expect(geometry.instanceCount).toEqual(4);
    });

    test('freeVO:last', () => {
      const [geometry, pool, , , vo2] = makeInstancedGeometry();

      geometry.update();

      const position_serial = (geometry.getAttribute('position') as BufferAttribute).version;
      const color_serial = (geometry.getAttribute('color') as InterleavedBufferAttribute).data.version;
      const impact_serial = (geometry.getAttribute('impact') as BufferAttribute).version;
      const foo_serial = (geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version;
      const bar_serial = (geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version;

      pool.freeVO(vo2);

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBe(position_serial);
      expect((geometry.getAttribute('color') as InterleavedBufferAttribute).data.version, 'color').toBe(color_serial);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(impact_serial);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBe(foo_serial);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBe(bar_serial);

      expect(pool.buffer.toAttributeArrays(['color', 'foo', 'bar', 'impact'], 0, pool.usedCount)).toEqual({
        color: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
        foo: new Float32Array([100, 103]),
        bar: new Float32Array([101, 102, 104, 105]),
        impact: new Uint32Array([1000, 1001]),
      });

      expect(geometry.instanceCount).toEqual(2);
    });

    test('freeVO:not(last)', () => {
      const [geometry, pool, , vo1] = makeInstancedGeometry();

      geometry.update();

      const position_serial = (geometry.getAttribute('position') as BufferAttribute).version;
      const color_serial = (geometry.getAttribute('color') as InterleavedBufferAttribute).data.version;
      const impact_serial = (geometry.getAttribute('impact') as BufferAttribute).version;
      const foo_serial = (geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version;
      const bar_serial = (geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version;

      pool.freeVO(vo1);

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBe(position_serial);
      expect((geometry.getAttribute('color') as InterleavedBufferAttribute).data.version, 'color').toBeGreaterThan(color_serial);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(impact_serial);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBeGreaterThan(foo_serial);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBeGreaterThan(bar_serial);

      expect(pool.buffer.toAttributeArrays(['color', 'foo', 'bar', 'impact'], 0, pool.usedCount)).toEqual({
        color: new Uint8Array([1, 2, 3, 4, 9, 10, 11, 12]),
        foo: new Float32Array([100, 106]),
        bar: new Float32Array([101, 102, 107, 108]),
        impact: new Uint32Array([1000, 1002]),
      });

      expect(geometry.instanceCount).toEqual(2);
    });
  });

  describe('update ranges', () => {
    // `position` carries no usage and is therefore static and without autoTouch: what reaches the
    // gpu here is what the pool wrote, which is what these tests are about
    const staticQuadDesc = new VertexObjectDescriptor({
      vertexCount: 4,

      attributes: {
        position: {
          components: ['x', 'y', 'z'],
          type: 'float32',
          bufferName: 'positions',
        },
      },
    });

    /**
     * A geometry over `staticQuadDesc` holding `count` objects, wound forward to the state it
     * settles into: its first `update()` is behind it — that round spends the auto-touch which
     * uploads a static buffer once in full — and the range of that round counts as delivered,
     * which a first render would not manage on its own. Only the next `update()` measures what
     * a single write costs.
     */
    const settledQuadGeometry = (count: number) => {
      const geometry = new VertexObjectGeometry<MyBaseVO>(staticQuadDesc, 10);
      const objects = Array.from({length: count}, () => geometry.pool.createVO()!);
      geometry.update();
      uploaded(geometry, 'position');
      return [geometry, objects] as const;
    };

    test('two updates without a render in between upload both objects that were written', () => {
      const [geometry] = settledQuadGeometry(5);

      geometry.pool.createVO();
      geometry.update();
      // no upload follows: the range of this pass still stands on the buffer, and the serial
      // behind it is already booked as seen

      geometry.pool.createVO();
      geometry.update();

      expect(updateRangesOf(geometry, 'position')).toEqual([{start: 5 * 4 * 3, count: 2 * 4 * 3}]);
    });

    test('a spawn uploads the object that was created, not the whole pool', () => {
      const [geometry] = settledQuadGeometry(5);

      geometry.pool.createVO();
      geometry.update();

      // 3 components per vertex, 4 vertices per object — the sixth object and nothing else
      expect(updateRangesOf(geometry, 'position')).toEqual([{start: 5 * 4 * 3, count: 4 * 3}]);
    });

    test('a frame in which nothing is written leaves the next spawn its own narrow range', () => {
      const [geometry] = settledQuadGeometry(5);

      // no buffer of the pool moved on and nothing asked for an upload, so this pass has no range
      // to name — and one it named anyway would still be standing when the spawn below names its
      // own, which is the case a mostly static pool is in for most of its frames
      geometry.update();

      geometry.pool.createVO();
      geometry.update();

      expect(updateRangesOf(geometry, 'position')).toEqual([{start: 5 * 4 * 3, count: 4 * 3}]);
    });

    test('freeing an object in the middle uploads the slot that took its place', () => {
      const [geometry, objects] = settledQuadGeometry(5);

      // the swap fetches the object out of slot 4 and puts it into slot 1
      geometry.pool.freeVO(objects[1]!);
      geometry.update();

      expect(updateRangesOf(geometry, 'position')).toEqual([{start: 1 * 4 * 3, count: 4 * 3}]);
    });

    test('a touch leaves no narrow range standing for a render that beats the next update', () => {
      const [geometry] = settledQuadGeometry(5);

      geometry.pool.createVO();
      geometry.update();

      expect(updateRangesOf(geometry, 'position'), 'the spawn names its own object').toEqual([{start: 5 * 4 * 3, count: 4 * 3}]);

      geometry.touch('position');

      // a render before the next update() finds no range and uploads the whole array, rather
      // than the one object the spawn named
      expect(updateRangesOf(geometry, 'position')).toEqual([]);
    });

    test('an attribute that was touched uploads every object in use', () => {
      const [geometry] = settledQuadGeometry(5);

      // the spawn records a range of one object, and a touch says that values were written
      // somewhere — nobody knows where, so the whole area in use goes up rather than that object
      geometry.pool.createVO();
      geometry.touch('position');
      geometry.update();

      expect(updateRangesOf(geometry, 'position')).toEqual([{start: 0, count: 6 * 4 * 3}]);
    });

    test('an attribute that uploads on every frame carries every object in use', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      for (let i = 0; i < 3; i++) {
        geometry.instancedPool.createVO();
      }
      geometry.update();
      uploaded(geometry, 'impact');

      // `impact` is dynamic and therefore carries autoTouch. The spawn records a range of one
      // object, and a generated setter says nothing about what it wrote, so the whole area in
      // use goes up rather than that object
      geometry.instancedPool.createVO();
      geometry.update();

      expect(updateRangesOf(geometry, 'impact')).toEqual([{start: 0, count: 4}]);
    });

    test('a geometry that missed the frames in between uploads everything', () => {
      const pool = new VertexObjectPool<MyBaseVO>(staticQuadDesc, 10);
      const keepingUp = new VertexObjectGeometry<MyBaseVO>(pool, 10);
      const fallingBehind = new VertexObjectGeometry<MyBaseVO>(pool, 10);

      pool.createVO();
      keepingUp.update();
      uploaded(keepingUp, 'position');
      fallingBehind.update();
      uploaded(fallingBehind, 'position');

      pool.createVO();
      keepingUp.update();
      uploaded(keepingUp, 'position');

      pool.createVO();
      keepingUp.update();

      fallingBehind.update();

      expect(updateRangesOf(keepingUp, 'position'), 'the geometry that saw every frame').toEqual([
        {start: 2 * 4 * 3, count: 4 * 3},
      ]);
      expect(updateRangesOf(fallingBehind, 'position'), 'the geometry that sat out two frames').toEqual([
        {start: 0, count: 3 * 4 * 3},
      ]);
    });

    /**
     * Two geometries over one pool of `count` objects, both wound forward past their first
     * `update()` the way `settledQuadGeometry()` winds one. `write(idx)` writes the object in slot
     * `idx` and names it to the pool: a generated setter records nothing, so the caller that knows
     * which object it wrote says so.
     */
    const twoSettledQuadGeometries = (count: number) => {
      const pool = new VertexObjectPool<MyBaseVO>(staticQuadDesc, 10);
      const first = new VertexObjectGeometry<MyBaseVO>(pool, 10);
      const second = new VertexObjectGeometry<MyBaseVO>(pool, 10);
      const objects = Array.from({length: count}, () => pool.createVO()!);
      for (const geometry of [first, second]) {
        geometry.update();
        uploaded(geometry, 'position');
      }
      const write = (idx: number) => {
        objects[idx]!.setPosition([idx, 0, 0, idx, 0, 0, idx, 0, 0, idx, 0, 0]);
        pool.buffer.touchBuffer('positions', idx, idx);
      };
      return {first, second, write};
    };

    test('two geometries that update in the same frame both upload the object that was written', () => {
      const {first, second, write} = twoSettledQuadGeometries(6);

      write(1);
      first.update();
      second.update();

      expect(updateRangesOf(first, 'position'), 'first').toEqual([{start: 1 * 4 * 3, count: 4 * 3}]);
      expect(updateRangesOf(second, 'position'), 'second').toEqual([{start: 1 * 4 * 3, count: 4 * 3}]);

      uploaded(first, 'position');
      uploaded(second, 'position');

      write(4);
      first.update();
      second.update();

      expect(updateRangesOf(first, 'position'), 'first, second write').toEqual([{start: 4 * 4 * 3, count: 4 * 3}]);
      expect(updateRangesOf(second, 'position'), 'second, second write').toEqual([{start: 4 * 4 * 3, count: 4 * 3}]);
    });

    test('a write between the updates of two geometries sends the second one every object in use', () => {
      const {first, second, write} = twoSettledQuadGeometries(6);

      write(1);
      first.update();
      write(4);
      second.update();

      // the range over object 1 was picked up by first, a new one has started with object 4, and
      // second stood before its own beginning — it takes every object in use
      expect(updateRangesOf(first, 'position'), 'first').toEqual([{start: 1 * 4 * 3, count: 4 * 3}]);
      expect(updateRangesOf(second, 'position'), 'second').toEqual([{start: 0, count: 6 * 4 * 3}]);

      uploaded(first, 'position');
      uploaded(second, 'position');

      first.update();
      second.update();

      // second already took the write to 4 along with everything else and names no range
      expect(updateRangesOf(first, 'position'), 'first, next frame').toEqual([{start: 4 * 4 * 3, count: 4 * 3}]);
      expect(updateRangesOf(second, 'position'), 'second, next frame').toEqual([]);
    });

    test('a range still standing on one geometry is joined there by the next write, and nowhere else', () => {
      const {first, second, write} = twoSettledQuadGeometries(6);

      write(1);
      first.update();
      second.update();
      uploaded(second, 'position');
      // first's range over object 1 is left standing

      write(4);
      first.update();
      second.update();

      // objects 1 and 4 — the range that was never delivered stays and the new one joins it,
      // while the objects between them go nowhere
      expect(updateRangesOf(first, 'position'), 'first').toEqual([
        {start: 1 * 4 * 3, count: 4 * 3},
        {start: 4 * 4 * 3, count: 4 * 3},
      ]);
      expect(updateRangesOf(second, 'position'), 'second').toEqual([{start: 4 * 4 * 3, count: 4 * 3}]);
    });

    test('freeing an object in the middle and spawning one uploads both slots and nothing between them', () => {
      const [geometry, objects] = settledQuadGeometry(10);

      // the swap fetches the object out of slot 9 and puts it into slot 2, and the spawn takes
      // slot 9 again
      geometry.pool.freeVO(objects[2]!);
      geometry.pool.createVO();
      geometry.update();

      expect(updateRangesOf(geometry, 'position')).toEqual([
        {start: 2 * 4 * 3, count: 4 * 3},
        {start: 9 * 4 * 3, count: 4 * 3},
      ]);
    });

    test('more disjoint writes than ranges join where the gap between them is smallest', () => {
      const geometry = new VertexObjectGeometry<MyBaseVO>(staticQuadDesc, 20);
      for (let i = 0; i < 20; i++) geometry.pool.createVO();
      geometry.update();
      uploaded(geometry, 'position');

      // ten objects with a gap of one between each two: the gaps are all equal, so the lowest
      // pairs are joined until eight ranges are left
      for (let i = 0; i < 20; i += 2) {
        geometry.pool.buffer.touchBuffer('positions', i, i);
      }
      geometry.update();

      expect(updateRangesOf(geometry, 'position')).toEqual([
        {start: 0, count: 60},
        {start: 72, count: 12},
        {start: 96, count: 12},
        {start: 120, count: 12},
        {start: 144, count: 12},
        {start: 168, count: 12},
        {start: 192, count: 12},
        {start: 216, count: 12},
      ]);
    });

    test('writes that all lie beyond the objects in use upload nothing and leave no empty range', () => {
      const [geometry, objects] = settledQuadGeometry(5);
      const buffer = bufferInSlot(geometry, 'position')!;
      const version = buffer.version;

      // the first free swaps slot 4 into slot 1 and marks it; the others take the pool down to
      // no object at all
      geometry.pool.freeVO(objects[1]!);
      for (const idx of [0, 2, 3, 4]) {
        geometry.pool.freeVO(objects[idx]!);
      }
      geometry.update();

      expect(updateRangesOf(geometry, 'position')).toEqual([]);
      expect(buffer.version).toBe(version);
    });

    test('a touch on a geometry without an object in use uploads nothing', () => {
      const [geometry, objects] = settledQuadGeometry(1);
      geometry.pool.freeVO(objects[0]!);
      const buffer = bufferInSlot(geometry, 'position')!;
      const version = buffer.version;

      geometry.touch('position');
      geometry.update();

      expect(updateRangesOf(geometry, 'position')).toEqual([]);
      expect(buffer.version).toBe(version);
    });

    test('an attached pool without an object in use hands three no range', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      geometry.basePool!.createVO();
      for (let i = 0; i < 3; i++) geometry.instancedPool.createVO();
      geometry.attachInstancedPool(
        'extra',
        new VertexObjectDescriptor({attributes: {extraImpact: {size: 1, type: 'float32', usage: 'dynamic'}}}),
      );

      geometry.update();
      const buffer = bufferInSlot(geometry, 'extraImpact')!;
      const version = buffer.version;
      geometry.update();

      expect(updateRangesOf(geometry, 'extraImpact')).toEqual([]);
      expect(buffer.version).toBe(version);
    });

    test('touch() marks for the next update() and not before', () => {
      const [geometry] = settledQuadGeometry(5);
      const buffer = bufferInSlot(geometry, 'position')!;
      const version = buffer.version;

      geometry.touch('position');

      expect(buffer.version, 'touch() alone').toBe(version);
      expect(updateRangesOf(geometry, 'position'), 'touch() alone').toEqual([]);

      geometry.update();

      expect(buffer.version).toBeGreaterThan(version);
      expect(updateRangesOf(geometry, 'position')).toEqual([{start: 0, count: 5 * 4 * 3}]);
    });

    test('touchVO() uploads the slot of that vertex object and nothing else', () => {
      const [geometry, objects] = settledQuadGeometry(5);

      geometry.pool.touchVO(objects[3]!);
      geometry.update();

      expect(updateRangesOf(geometry, 'position')).toEqual([{start: 3 * 4 * 3, count: 4 * 3}]);
    });

    test('touchVO() with attribute names marks the buffers of those attributes alone', () => {
      const texturedQuadDesc = new VertexObjectDescriptor({
        vertexCount: 4,
        attributes: {
          position: {components: ['x', 'y', 'z'], type: 'float32', bufferName: 'positions'},
          uv: {size: 2, type: 'float32', bufferName: 'uvs'},
        },
      });
      const geometry = new VertexObjectGeometry<MyBaseVO>(texturedQuadDesc, 10);
      const objects = Array.from({length: 5}, () => geometry.pool.createVO()!);
      geometry.update();
      uploaded(geometry, 'position');
      uploaded(geometry, 'uv');
      const positions = bufferInSlot(geometry, 'position')!;
      const version = positions.version;

      geometry.pool.touchVO(objects[2]!, 'uv');
      geometry.update();

      // 2 components per vertex, 4 vertices per object
      expect(updateRangesOf(geometry, 'uv'), 'uv').toEqual([{start: 2 * 4 * 2, count: 4 * 2}]);
      expect(updateRangesOf(geometry, 'position'), 'position').toEqual([]);
      expect(positions.version, 'position').toBe(version);
    });

    test('the base pool of an instanced geometry uploads every vertex of a used object', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      geometry.basePool!.createVO();
      geometry.update();

      // 3 components per vertex, 4 vertices per object, 1 object in use
      expect(updateRangesOf(geometry, 'position')).toEqual([{start: 0, count: 12}]);
    });

    test('a non-instanced geometry uploads every vertex of every used object', () => {
      const quadDesc = new VertexObjectDescriptor({
        vertexCount: 4,

        attributes: {
          position: {
            components: ['x', 'y', 'z'],
            type: 'float32',
            bufferName: 'positions',
          },
        },
      });

      const geometry = new VertexObjectGeometry<MyBaseVO>(quadDesc, 10);

      for (let i = 0; i < 5; i++) {
        geometry.pool.createVO();
      }

      geometry.update();

      expect(updateRangesOf(geometry, 'position')).toEqual([{start: 0, count: 3 * 4 * 5}]);
    });

    test('the upload range of a buffer with padding spans its whole stride', () => {
      const geometry = new VertexObjectGeometry(
        {
          vertexCount: 4,
          attributes: {color: {size: 3, type: 'uint8', normalized: true, usage: 'dynamic'}},
        },
        10,
      );

      geometry.pool.createVO();
      geometry.pool.createVO();
      geometry.update();

      // 3 bytes and 1 of padding per vertex, 4 vertices per object, 2 objects in use
      expect(updateRangesOf(geometry, 'color')).toEqual([{start: 0, count: 2 * 4 * 4}]);
    });
  });

  describe('constructed with a BufferGeometry', () => {
    // the base class, not InstancedVertexObjectGeometry: that one names itself after its super() call
    test('keeps the name of its class when it is built from a BufferGeometry', () => {
      const base = new BufferGeometry();
      base.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));

      const geometry = new InstancedVOBufferGeometry(instancedDesc, 10, base);

      expect(geometry.name).toBe('InstancedVOBufferGeometry');
    });

    test('takes no name from the geometry it is built from', () => {
      const base = new BufferGeometry();
      base.name = 'a geometry of the caller';
      base.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));

      const geometry = new InstancedVOBufferGeometry(instancedDesc, 10, base);

      expect(geometry.name).toBe('InstancedVOBufferGeometry');
    });

    test('update() leaves the attributes copied from that geometry alone', () => {
      const base = new BufferGeometry();
      base.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));

      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, base);
      geometry.instancedPool.createVO();

      const copiedArray = (geometry.getAttribute('position') as BufferAttribute).array;

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).array).toBe(copiedArray);
    });

    test('dispose() leaves the attributes copied from that geometry alone', () => {
      const base = new BufferGeometry();
      base.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));

      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, base);
      const copiedArray = (geometry.getAttribute('position') as BufferAttribute).array;

      geometry.dispose();

      expect(Object.keys(geometry.attributes)).toEqual(['position']);
      expect((geometry.getAttribute('position') as BufferAttribute).array).toBe(copiedArray);
    });
  });

  describe('dispose', () => {
    // (b) a resource handed in belongs to the caller and is not touched
    test('a pool handed in from outside stays untouched', () => {
      const instancedPool = new VertexObjectPool<MyInstancedVO>(instancedDesc, 10);
      instancedPool.createVO();

      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedPool, 10, baseDesc, 1);
      geometry.dispose();

      expect(instancedPool.usedCount).toBe(1);
      expect(instancedPool.isDisposed).toBe(false);
    });

    // (a) a resource the instance built itself is released exactly once
    test('a pool the geometry built itself is released', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const {instancedPool, basePool} = geometry;

      geometry.dispose();

      expect(instancedPool.isDisposed).toBe(true);
      expect(basePool!.isDisposed).toBe(true);
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    test('the attributes of every released route leave the geometry', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      expect(Object.keys(geometry.attributes).sort()).toEqual(['bar', 'color', 'foo', 'impact', 'position']);
      expect(geometry.index).not.toBeNull();

      geometry.dispose();

      expect(Object.keys(geometry.attributes)).toEqual([]);
      expect(geometry.index).toBeNull();
    });

    test('an attached pool is released only when the geometry owns it', () => {
      const keptPool = new VertexObjectPool<VO>(extraDesc, 10);
      keptPool.createVO();

      const withKeptPool = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      withKeptPool.attachInstancedPool('extra', keptPool);
      withKeptPool.dispose();

      expect(keptPool.isDisposed).toBe(false);
      expect(keptPool.usedCount).toBe(1);

      const releasedPool = new VertexObjectPool<VO>(extraDesc, 10);

      const withReleasedPool = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      withReleasedPool.attachInstancedPool('extra', releasedPool, {autoDispose: true});
      withReleasedPool.dispose();

      expect(releasedPool.isDisposed).toBe(true);

      const withOwnPool = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const ownPool = withOwnPool.attachInstancedPool('extra', extraDesc);
      withOwnPool.dispose();

      expect(ownPool.isDisposed).toBe(true);
    });

    test('a pool handed in from outside stays untouched on a non-instanced geometry', () => {
      const pool = new VertexObjectPool<MyBaseVO>(baseDesc, 10);
      pool.createVO();

      const geometry = new VertexObjectGeometry<MyBaseVO>(pool, 10);
      geometry.dispose();

      expect(pool.usedCount).toBe(1);
      expect(pool.isDisposed).toBe(false);
    });

    test('a pool a non-instanced geometry built itself is released', () => {
      const geometry = new VertexObjectGeometry<MyBaseVO>(baseDesc, 10);
      const {pool} = geometry;

      geometry.dispose();

      expect(pool.isDisposed).toBe(true);
    });

    test('the attributes of a non-instanced geometry leave it', () => {
      const geometry = new VertexObjectGeometry<MyBaseVO>(baseDesc, 10);

      expect(Object.keys(geometry.attributes)).toEqual(['position']);
      expect(geometry.index).not.toBeNull();

      geometry.dispose();

      expect(Object.keys(geometry.attributes)).toEqual([]);
      expect(geometry.index).toBeNull();
    });

    test('detachInstancedPool() releases a pool the geometry built itself', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const ownPool = geometry.attachInstancedPool('extra', extraDesc);

      expect(geometry.detachInstancedPool('extra')).toBe(ownPool);
      expect(ownPool.isDisposed).toBe(true);
    });

    test('detachInstancedPool() leaves a pool handed in from outside alone', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const keptPool = new VertexObjectPool<VO>(extraDesc, 10);
      geometry.attachInstancedPool('extra', keptPool);

      geometry.detachInstancedPool('extra');

      expect(keptPool.isDisposed).toBe(false);
    });

    test('attaching over a name that is already taken disposes the geometry-built pool it replaces', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      const first = geometry.attachInstancedPool('extra', extraDesc);
      const second = geometry.attachInstancedPool('extra', otherExtraDesc);

      expect(first.isDisposed).toBe(true);
      expect(second.isDisposed).toBe(false);
    });

    test('a refused attach leaves the pool that holds the slot alone', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const first = geometry.attachInstancedPool('extra', extraDesc);

      expect(() => geometry.attachInstancedPool('extra', extraDesc)).toThrow();

      expect(first.isDisposed).toBe(false);
      expect(geometry.extraInstancedPools.get('extra')).toBe(first);
    });

    test('attaching the same pool again under its own name keeps it alive', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const pool = geometry.attachInstancedPool('extra', extraDesc);

      geometry.attachInstancedPool('extra', pool);

      expect(pool.isDisposed).toBe(false);
      expect(geometry.extraInstancedPools.get('extra')).toBe(pool);
      expect(geometry.getAttribute('quux')).toBeDefined();
    });

    test('a pool the geometry built stays its own when it is attached again under the same name', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const pool = geometry.attachInstancedPool('extra', extraDesc);

      geometry.attachInstancedPool('extra', pool);
      geometry.dispose();

      expect(pool.isDisposed).toBe(true);
    });

    test('a pool the geometry built stays its own when a second name for it is refused', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const pool = geometry.attachInstancedPool('extra', extraDesc);

      expect(() => geometry.attachInstancedPool('sameAgain', pool)).toThrow();

      expect(geometry.extraInstancedPools.has('sameAgain')).toBe(false);
      expect(pool.isDisposed).toBe(false);

      geometry.dispose();

      expect(pool.isDisposed).toBe(true);
    });

    test('a pool that outlives its detach stops belonging to the geometry that built it', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const pool = geometry.attachInstancedPool('extra', extraDesc, {autoDispose: false});

      geometry.detachInstancedPool('extra');

      expect(pool.isDisposed).toBe(false);

      // no route of the geometry that built the pool reaches it any more, so the geometry it
      // goes to next takes a pool from outside
      const next = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      next.attachInstancedPool('extra', pool);

      next.dispose();
      geometry.dispose();

      expect(pool.isDisposed).toBe(false);
    });

    test('the pool of an attach/detach cycle is released, and the name it had stays taken', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      const pool = geometry.attachInstancedPool('extra', extraDesc);
      geometry.detachInstancedPool('extra');

      expect(pool.isDisposed).toBe(true);
      expect(() => geometry.attachInstancedPool('extra', extraDesc)).toThrow();
    });

    test('an explicit autoDispose decides over a pool the geometry built', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const pool = geometry.attachInstancedPool('extra', extraDesc, {autoDispose: false});

      geometry.dispose();

      expect(pool.isDisposed).toBe(false);
    });

    test('the geometry that built a pool releases it even while a second geometry reads it', () => {
      const owner = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const borrower = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      const shared = owner.attachInstancedPool('extra', extraDesc);
      borrower.attachInstancedPool('borrowed', shared);

      expect(borrower.extraInstancedPools.get('borrowed')).toBe(shared);

      owner.dispose();

      // passing a pool on to a second geometry does not move its lifetime there
      expect(shared.isDisposed).toBe(true);
    });

    test('the non-instanced geometry that built a pool releases it even while a second geometry reads it', () => {
      const owner = new VertexObjectGeometry<MyBaseVO>(baseDesc, 1);
      const borrower = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, owner.pool);

      expect(borrower.basePool).toBe(owner.pool);

      owner.dispose();

      expect(owner.pool.isDisposed).toBe(true);
    });

    // (d) the second call throws nothing and releases nothing a second time
    test('a second dispose() throws nothing and leaves a pool from outside alone', () => {
      const handedIn = new VertexObjectPool<MyInstancedVO>(instancedDesc, 10);
      handedIn.createVO();

      const instanced = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(handedIn, 10, baseDesc, 1);
      const {basePool} = instanced;

      expect(() => {
        instanced.dispose();
        instanced.dispose();
      }).not.toThrow();

      expect(handedIn.isDisposed).toBe(false);
      expect(handedIn.usedCount).toBe(1);
      expect(basePool!.isDisposed).toBe(true);

      const plain = new VertexObjectGeometry<MyBaseVO>(baseDesc, 10);
      const {pool} = plain;

      expect(() => {
        plain.dispose();
        plain.dispose();
      }).not.toThrow();

      expect(pool.isDisposed).toBe(true);
    });

    // (e) has no subject here: nothing in vertex-objects creates a signal or an effect.

    // Assertion (f) of the dispose test pattern in docs/resource-lifecycle.md — "gives every
    // slot it took back" — has no subject here: an InstancedVertexObjectGeometry never calls
    // createVO(). The slots elsewhere in this file are three.js attribute slots, which a
    // route claims on the geometry, not slots lent out by a pool.
  });

  describe('attachInstancedPool()', () => {
    const dynamicExtraDesc = new VertexObjectDescriptor({
      attributes: {
        quux: {
          size: 1,
          type: 'float32',
          usage: 'dynamic',
        },
      },
    });

    test('a route that would take an attribute slot of the instanced pool is refused', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      expect(() => geometry.attachInstancedPool('extra', new VertexObjectPool<VO>(fooDesc, 10))).toThrow();
    });

    test('an attribute name that a detached route had stays taken', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      geometry.attachInstancedPool('extra', extraDesc);
      geometry.detachInstancedPool('extra');

      expect(() => geometry.attachInstancedPool('extra', extraDesc)).toThrow();
    });

    test('the same pool under a second name is refused', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const pool = geometry.attachInstancedPool('extra', extraDesc);

      expect(() => geometry.attachInstancedPool('sameAgain', pool)).toThrow();
    });

    test('the refusal names the class, the call and the slots it is about', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      geometry.attachInstancedPool('first', extraDesc);

      expect(() => geometry.attachInstancedPool('extra', extraDesc)).toThrow(
        /InstancedVOBufferGeometry#attachInstancedPool\("extra"\)/,
      );
      expect(() => geometry.attachInstancedPool('extra', extraDesc)).toThrow(/"quux"/);
    });

    test('the same pool under the same name again leaves the attributes it built where they are', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const pool = geometry.attachInstancedPool('extra', extraDesc);
      const attr = geometry.getAttribute('quux');

      geometry.attachInstancedPool('extra', pool);

      expect(geometry.getAttribute('quux')).toBe(attr);
    });

    test('the same pool under the same name again takes an autoDispose handed in with it', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const pool = geometry.attachInstancedPool('extra', extraDesc);

      geometry.attachInstancedPool('extra', pool, {autoDispose: false});
      geometry.dispose();

      expect(pool.isDisposed).toBe(false);
    });

    test('a descriptor is wrapped in a pool with the capacity of the instancedPool', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      const pool = geometry.attachInstancedPool('extra', extraDesc);

      expect(pool.capacity).toBe(geometry.instancedPool.capacity);
    });

    test('a touch resolved before a pool was attached reaches the buffers of that pool afterwards', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      geometry.instancedPool.createVO();

      // resolves the name while no route carries it
      geometry.touch('quux');
      geometry.update();

      const pool = geometry.attachInstancedPool('extra', extraDesc);
      pool.createVO();
      geometry.update();
      uploaded(geometry, 'quux');
      const buffer = bufferInSlot(geometry, 'quux')!;
      const version = buffer.version;

      geometry.touch('quux');
      geometry.update();

      expect(buffer.version).toBeGreaterThan(version);
      expect(updateRangesOf(geometry, 'quux')).toEqual([{start: 0, count: 1}]);
    });

    test('an attached route without an object in use keeps its first upload until it has objects', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      geometry.instancedPool.createVO();
      const pool = geometry.attachInstancedPool('extra', extraDesc);

      // `quux` is static: nothing but the first upload of the route carries it to the gpu
      geometry.update();
      const buffer = bufferInSlot(geometry, 'quux')!;
      const version = buffer.version;

      // written straight into the array and counted in through the setter, which marks nothing:
      // the only thing left to carry these values is the first upload the route still owes
      const {bufferName} = pool.buffer.bufferAttributes.get('quux')!;
      pool.buffer.buffers.get(bufferName)!.typedArray!.set([1, 2, 3]);
      pool.usedCount = 3;
      geometry.update();

      expect(buffer.version).toBeGreaterThan(version);
      expect(updateRangesOf(geometry, 'quux')).toEqual([{start: 0, count: 3}]);
    });

    test('a touch resolved while a pool was attached no longer reaches it after the detach', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      geometry.instancedPool.createVO();
      const pool = geometry.attachInstancedPool('extra', extraDesc, {autoDispose: false});
      pool.createVO();
      geometry.update();

      // resolves the name while the route carries it
      geometry.touch('quux');
      geometry.update();
      const buffer = bufferInSlot(geometry, 'quux')!;
      const version = buffer.version;

      geometry.detachInstancedPool('extra');
      // a range standing on the buffer of the route that left: a touch that still reached the
      // buffer would take it off, while update() does not reach the buffer either way
      buffer.clearUpdateRanges();
      buffer.addUpdateRange(0, 1);
      geometry.touch('quux');

      expect(buffer.updateRanges, 'the touch passed the buffer by').toEqual([{start: 0, count: 1}]);
      expect(() => geometry.update()).not.toThrow();
      expect(buffer.version).toBe(version);
    });

    // guards the auto-touch buffer cache: it is resolved once and must be invalidated whenever a
    // route is added, or a route attached after the cache was first primed would never get touched
    test('a route attached after the auto-touch cache was primed is still touched on later updates', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      geometry.instancedPool.createVO();
      geometry.update(); // primes the cache while the extra route does not exist yet

      const pool = geometry.attachInstancedPool('extra', dynamicExtraDesc);
      pool.createVO();

      // this first post-attach update() also sees the buffer's serial for the first time, which
      // touches it regardless of the auto-touch cache - it is not yet the measurement
      geometry.update();
      const buffer = bufferInSlot(geometry, 'quux')!;
      const versionAfterFirstUpdate = buffer.version;

      // the serial is stable by now, so only a correctly invalidated auto-touch cache touches
      // the buffer again
      geometry.update();

      expect(buffer.version).toBeGreaterThan(versionAfterFirstUpdate);
    });

    // guards the same cache on the way out: a route that gave up its pool must not keep getting
    // touched through a stale entry in the resolved buffer list
    test('a released route is no longer touched, and update() does not throw', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      geometry.instancedPool.createVO();

      const pool = geometry.attachInstancedPool('extra', dynamicExtraDesc);
      pool.createVO();
      geometry.update(); // primes the cache with the extra route included

      const buffer = bufferInSlot(geometry, 'quux')!;
      const versionBeforeDetach = buffer.version;

      geometry.detachInstancedPool('extra');

      expect(() => geometry.update()).not.toThrow();
      expect(buffer.version).toBe(versionBeforeDetach);
    });
  });

  describe('update() on a released pool', () => {
    test('an instanced geometry reading a pool that its builder released does not throw', () => {
      const owner = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const reader = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      const shared = owner.attachInstancedPool('extra', extraDesc);
      reader.attachInstancedPool('borrowed', shared);

      owner.dispose();

      expect(shared.isDisposed).toBe(true);
      expect(() => reader.update()).not.toThrow();
    });

    test('a non-instanced geometry reading a pool that its builder released does not throw', () => {
      const owner = new VertexObjectGeometry<MyBaseVO>(baseDesc, 1);
      const reader = new VertexObjectGeometry<MyBaseVO>(owner.pool, 1);

      owner.dispose();

      expect(owner.pool.isDisposed).toBe(true);
      expect(() => reader.update()).not.toThrow();
    });
  });

  describe('update() after dispose()', () => {
    test('stays a no-op on an instanced geometry, whoever owns the pools', () => {
      const handedIn = new VertexObjectPool<MyInstancedVO>(instancedDesc, 10);
      handedIn.createVO();

      const withHandedInPool = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(handedIn, 10, baseDesc, 1);
      withHandedInPool.update();
      withHandedInPool.dispose();

      expect(() => withHandedInPool.update()).not.toThrow();

      // no attribute comes back, so there is nothing left to upload, and the pool of the caller
      // is as untouched by the second update() as it was by dispose()
      expect(Object.keys(withHandedInPool.attributes)).toEqual([]);
      expect(withHandedInPool.index).toBeNull();
      expect(handedIn.isDisposed).toBe(false);
      expect(handedIn.usedCount).toBe(1);

      const withOwnPools = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const {instancedPool, basePool} = withOwnPools;
      withOwnPools.instancedPool.createVO();
      withOwnPools.update();
      withOwnPools.dispose();

      expect(() => withOwnPools.update()).not.toThrow();

      expect(Object.keys(withOwnPools.attributes)).toEqual([]);
      expect(withOwnPools.index).toBeNull();
      expect(instancedPool.isDisposed).toBe(true);
      expect(basePool!.isDisposed).toBe(true);
    });

    test('stays a no-op on a non-instanced geometry, whoever owns the pool', () => {
      // a dynamic attribute, so that the auto-touch path is walked as well
      const dynamicQuadDesc = new VertexObjectDescriptor({
        vertexCount: 4,
        indices: [0, 1, 2, 0, 2, 3],

        attributes: {
          position: {
            components: ['x', 'y', 'z'],
            type: 'float32',
            usage: 'dynamic',
          },
        },
      });

      const handedIn = new VertexObjectPool<MyBaseVO>(dynamicQuadDesc, 10);
      handedIn.createVO();

      const withHandedInPool = new VertexObjectGeometry<MyBaseVO>(handedIn, 10);
      withHandedInPool.update();
      withHandedInPool.dispose();

      expect(() => withHandedInPool.update()).not.toThrow();

      // no attribute comes back, so there is nothing left to upload, and the pool of the caller
      // is as untouched by the second update() as it was by dispose()
      expect(Object.keys(withHandedInPool.attributes)).toEqual([]);
      expect(withHandedInPool.index).toBeNull();
      expect(handedIn.isDisposed).toBe(false);
      expect(handedIn.usedCount).toBe(1);

      const withOwnPool = new VertexObjectGeometry<MyBaseVO>(dynamicQuadDesc, 10);
      const {pool} = withOwnPool;
      withOwnPool.pool.createVO();
      withOwnPool.update();
      withOwnPool.dispose();

      expect(() => withOwnPool.update()).not.toThrow();

      expect(Object.keys(withOwnPool.attributes)).toEqual([]);
      expect(withOwnPool.index).toBeNull();
      expect(pool.isDisposed).toBe(true);
    });

    // guards the auto-touch buffer cache: a pool handed in from outside survives dispose() with
    // `usedCount > 0`, and a stale cache entry would keep touching its buffer through a geometry
    // that no longer holds any route to it
    test('does not touch an autoTouch buffer of a handed-in pool on an instanced geometry', () => {
      const handedIn = new VertexObjectPool<MyInstancedVO>(instancedDesc, 10);
      handedIn.createVO();

      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(handedIn, 10, baseDesc, 1);
      geometry.update(); // primes the cache with the handed-in pool's autoTouch buffer (`impact`)

      const buffer = bufferInSlot(geometry, 'impact')!;
      geometry.dispose();
      const versionAfterDispose = buffer.version;

      geometry.update();

      expect(buffer.version).toBe(versionAfterDispose);
      expect(handedIn.isDisposed).toBe(false);
    });

    // same guard, for the non-instanced geometry
    test('does not touch an autoTouch buffer of a handed-in pool on a non-instanced geometry', () => {
      const dynamicQuadDesc = new VertexObjectDescriptor({
        vertexCount: 4,
        indices: [0, 1, 2, 0, 2, 3],

        attributes: {
          position: {
            components: ['x', 'y', 'z'],
            type: 'float32',
            usage: 'dynamic',
          },
        },
      });

      const handedIn = new VertexObjectPool<MyBaseVO>(dynamicQuadDesc, 10);
      handedIn.createVO();

      const geometry = new VertexObjectGeometry<MyBaseVO>(handedIn, 10);
      geometry.update(); // primes the cache with the handed-in pool's autoTouch buffer (`position`)

      const buffer = bufferInSlot(geometry, 'position')!;
      geometry.dispose();
      const versionAfterDispose = buffer.version;

      geometry.update();

      expect(buffer.version).toBe(versionAfterDispose);
      expect(handedIn.isDisposed).toBe(false);
    });

    test('leaves the draw range and the instance count as dispose() left them', () => {
      const handedIn = new VertexObjectPool<MyInstancedVO>(instancedDesc, 10);
      handedIn.createVO();

      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(handedIn, 10, baseDesc, 1);
      geometry.update();
      geometry.dispose();

      const drawRangeAfterDispose = {...geometry.drawRange};
      const instanceCountAfterDispose = geometry.instanceCount;

      handedIn.createVO();
      geometry.update();

      expect(geometry.drawRange).toEqual(drawRangeAfterDispose);
      expect(geometry.instanceCount).toBe(instanceCountAfterDispose);
    });

    test('leaves the draw range as dispose() left them', () => {
      const handedIn = new VertexObjectPool<MyBaseVO>(baseDesc, 10);
      handedIn.createVO();

      const geometry = new VertexObjectGeometry<MyBaseVO>(handedIn, 10);
      geometry.update();
      geometry.dispose();

      const drawRangeAfterDispose = {...geometry.drawRange};

      handedIn.createVO();
      geometry.update();

      expect(geometry.drawRange).toEqual(drawRangeAfterDispose);
    });
  });

  describe('attribute slots', () => {
    // declares the attribute name of `extraDesc` a second time, with its own typed arrays
    const otherQuuxDesc = new VertexObjectDescriptor({
      attributes: {
        quux: {
          size: 2,
          type: 'float32',
        },
      },
    });

    const bufferNameOf = (pool: VertexObjectPool<VO>, attrName: string) => pool.buffer.bufferAttributes.get(attrName)!.bufferName;

    test('a pool that reads the typed arrays of the route in the slot is refused all the same', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      const a = new VertexObjectPool<VO>(extraDesc, 10);
      // by default the typed arrays are shared instead of copied, so both pools read the same memory
      const b = new VertexObjectPool<VO>(extraDesc, a.toBuffersData());

      geometry.attachInstancedPool('a', a);

      expect(() => geometry.attachInstancedPool('b', b)).toThrow();
    });

    test('a second pool declaring the attribute name of a route is refused', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      const a = new VertexObjectPool<VO>(extraDesc, 10);
      const b = new VertexObjectPool<VO>(otherQuuxDesc, 10);

      geometry.attachInstancedPool('a', a);

      expect(() => geometry.attachInstancedPool('b', b)).toThrow();

      // the route that has the slot still feeds it
      const bufferName = bufferNameOf(a, 'quux');
      expect(bufferInSlot(geometry, 'quux')).toBe(geometry.extraInstancedBuffers.get('a')!.get(bufferName));
      expect((geometry.getAttribute('quux') as BufferAttribute).array).toBe(a.buffer.buffers.get(bufferName)!.typedArray);
    });

    test('dispose() gives a slot back to the attribute of the geometry handed in', () => {
      const base = new BufferGeometry();
      base.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
      // the same attribute name the instanced pool declares
      base.setAttribute('foo', new BufferAttribute(new Float32Array([1, 2, 3, 4]), 1));

      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, base);

      geometry.dispose();

      expect(Object.keys(geometry.attributes).sort()).toEqual(['foo', 'position']);
      expect(Array.from((geometry.getAttribute('foo') as BufferAttribute).array)).toEqual([1, 2, 3, 4]);
    });
  });

  // The gpu reads the arrays of the pool as the descriptor lays them out: nothing is copied or
  // widened on the way. three 0.186.1 widens the array of an 8- or 16-bit integer BufferAttribute
  // without `normalized` to 32 bits as it builds its gpu buffer (`WebGPUAttributeUtils.js:82–107`)
  // and leaves an InterleavedBuffer as it is, so such a buffer always reaches three as one; an
  // attribute of one value of these types is laid out as a 32-bit integer by the descriptor
  describe('the arrays three gets are the arrays of the pool', () => {
    interface OffsetVO extends VO {
      dx: number;
      dy: number;
    }

    interface LevelVO extends VO {
      level: number;
    }

    interface RgbaVO extends VO {
      setRgba(...values: number[]): void;
    }

    const arrayOf = (geometry: BufferGeometry, attrName: string) => bufferInSlot(geometry, attrName)!.array;
    const poolArrayOf = (geometry: VOBufferGeometry, bufferName: string) =>
      geometry.pool.buffer.buffers.get(bufferName)!.typedArray;

    test('two int8 attributes of one value share a buffer of 32-bit integers', () => {
      const geometry = new VertexObjectGeometry<OffsetVO>(
        {
          attributes: {
            dx: {size: 1, type: 'int8', bufferName: 'offsets'},
            dy: {size: 1, type: 'int8', bufferName: 'offsets'},
          },
        },
        4,
      );
      const vo = geometry.pool.createVO()!;
      vo.dx = -5;
      vo.dy = -128;
      geometry.update();

      const dx = geometry.getAttribute('dx') as InterleavedBufferAttribute;
      expect(dx.data).toBe((geometry.getAttribute('dy') as InterleavedBufferAttribute).data);
      expect(dx.data.stride).toBe(2);
      expect(dx.data.array).toBeInstanceOf(Int32Array);
      expect(dx.data.array).toBe(poolArrayOf(geometry, 'offsets'));
      expect(Array.from(dx.data.array.subarray(0, 2))).toEqual([-5, -128]);
    });

    test('a uint16 attribute of one value alone in its buffer is a plain attribute of 32-bit integers', () => {
      const geometry = new VertexObjectGeometry<LevelVO>({attributes: {level: {size: 1, type: 'uint16'}}}, 4);
      geometry.pool.createVO()!.level = 70000;
      geometry.update();

      const level = geometry.getAttribute('level') as BufferAttribute;
      expect(level.isBufferAttribute).toBe(true);
      expect(level.itemSize).toBe(1);
      expect(level.array).toBeInstanceOf(Uint32Array);
      expect(level.array).toBe(poolArrayOf(geometry, 'static_uint32'));
      // the layout holds what was written: there is no 16-bit array anywhere to wrap it
      expect(level.array[0]).toBe(70000);
    });

    test('an integer attribute of two values without normalized reaches three as an interleaved buffer of its own type', () => {
      const geometry = new VertexObjectGeometry<VO>(
        {attributes: {level: {components: ['a', 'b'], type: 'uint16', usage: 'dynamic'}}},
        4,
      );

      const level = geometry.getAttribute('level') as InterleavedBufferAttribute;
      expect(level.isInterleavedBufferAttribute).toBe(true);
      expect(level.data.stride).toBe(2);
      expect(level.data.array).toBeInstanceOf(Uint16Array);
      expect(level.data.array).toBe(poolArrayOf(geometry, 'dynamic_uint16'));
    });

    test('four bytes without normalized reach three as an interleaved buffer of bytes', () => {
      const geometry = new VertexObjectGeometry<RgbaVO>(
        {attributes: {rgba: {components: ['r', 'g', 'b', 'a'], type: 'uint8'}}},
        4,
      );
      const vo = geometry.pool.createVO()!;
      vo.setRgba(1, 2, 3, 4);
      geometry.update();

      const rgba = geometry.getAttribute('rgba') as InterleavedBufferAttribute;
      expect(rgba.isInterleavedBufferAttribute).toBe(true);
      expect(rgba.data.array).toBe(poolArrayOf(geometry, 'static_uint8'));
      expect(Array.from(rgba.data.array.subarray(0, 4))).toEqual([1, 2, 3, 4]);
    });

    test('four normalized bytes stay a plain attribute of bytes', () => {
      const geometry = new VertexObjectGeometry<RgbaVO>(
        {attributes: {rgba: {components: ['r', 'g', 'b', 'a'], type: 'uint8', normalized: true}}},
        4,
      );

      const rgba = geometry.getAttribute('rgba') as BufferAttribute;
      expect(rgba.isBufferAttribute).toBe(true);
      expect(rgba.array).toBe(poolArrayOf(geometry, 'static_uint8N'));
    });

    test('an instanced integer attribute without normalized reaches three as an interleaved buffer of its own type', () => {
      const geometry = new InstancedVertexObjectGeometry<VO, VO>(
        {attributes: {level: {components: ['a', 'b'], type: 'int16'}}},
        4,
        {vertexCount: 4, attributes: {position: {components: ['x', 'y', 'z'], type: 'float32'}}},
      );

      const level = geometry.getAttribute('level') as InterleavedBufferAttribute;
      expect(level.isInterleavedBufferAttribute).toBe(true);
      expect(level.data.array).toBe(geometry.instancedPool.buffer.buffers.get('static_int16')!.typedArray);
    });

    test('an array that comes back in as a whole is the array three gets', () => {
      const description = {attributes: {rgba: {components: ['r', 'g', 'b', 'a'], type: 'uint8' as const}}};
      const geometry = new VertexObjectGeometry<RgbaVO>(description, 4);
      geometry.pool.createVO()!.setRgba(1, 2, 3, 4);
      geometry.update();

      const other = new VertexObjectPool<RgbaVO>(description, 4);
      other.createVO()!.setRgba(5, 6, 7, 8);
      geometry.pool.fromBuffersData(other.toBuffersData());
      geometry.update();

      expect(arrayOf(geometry, 'rgba')).toBe(poolArrayOf(geometry, 'static_uint8'));
      expect(arrayOf(geometry, 'rgba')).toBe(other.buffer.buffers.get('static_uint8')!.typedArray);
    });
  });
});
