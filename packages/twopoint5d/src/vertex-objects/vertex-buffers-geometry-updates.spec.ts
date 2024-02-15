import {describe, expect, test} from 'vitest';

import type {BufferAttribute, InstancedBufferAttribute, InterleavedBufferAttribute} from 'three';
import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import type {VO} from './types.js';

describe('vertex-buffers-geometry-updates', () => {
  describe('InstancedVertexObjectGeometry', () => {
    const baseDesc = new VertexObjectDescriptor({
      vertexCount: 4,
      indices: [0, 1, 2, 0, 2, 3],

      attributes: {
        position: {
          components: ['x', 'y', 'z'],
          type: 'float32',
        },
      },
    });

    const instancedDesc = new VertexObjectDescriptor({
      meshCount: 1,

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

    const makeInstancedGeometry = () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, VO>(instancedDesc, 10, baseDesc, 1);
      const pool = geometry.instancedPool;

      const vo0 = pool.createVO();
      vo0.setColor([1, 2, 3, 4]);
      vo0.foo = 100;
      vo0.setBar([101, 102]);
      vo0.impact = 1000;

      const vo1 = pool.createVO();
      vo1.setColor([5, 6, 7, 8]);
      vo1.foo = 103;
      vo1.setBar([104, 105]);
      vo1.impact = 1001;

      const vo2 = pool.createVO();
      vo2.setColor([9, 10, 11, 12]);
      vo2.foo = 106;
      vo2.setBar([107, 108]);
      vo2.impact = 1002;

      return [geometry, pool, vo0, vo1, vo2] as const;
    };

    describe('create buffers and arrays', () => {
      test('position', () => {
        const [geometry] = makeInstancedGeometry();

        const static_float32 = geometry.baseBuffers.get('static_float32').array;
        const positionAttribute = geometry.getAttribute('position')! as BufferAttribute;

        // @ts-ignore
        expect(positionAttribute.isBufferAttribute).toBe(true);
        expect(positionAttribute.array).toBe(static_float32);
        expect(static_float32).toBe(geometry.basePool.buffer.buffers.get('static_float32').typedArray);
      });

      test('color', () => {
        const [geometry] = makeInstancedGeometry();

        expect(geometry.instancedBuffers.get('static_uint8').array).toBe(
          geometry.instancedPool.buffer.buffers.get('static_uint8').typedArray,
        );

        const colorAttribute = geometry.getAttribute('color')! as InstancedBufferAttribute;
        // @ts-ignore
        expect(colorAttribute.isInstancedBufferAttribute).toBe(true);
        expect(colorAttribute.array).toBe(geometry.instancedPool.buffer.buffers.get('static_uint8').typedArray);
      });

      test('foo, bar', () => {
        const [geometry] = makeInstancedGeometry();

        expect(geometry.instancedBuffers.get('static_float32').array).toBe(
          geometry.instancedPool.buffer.buffers.get('static_float32').typedArray,
        );

        const fooAttribute = geometry.getAttribute('foo')! as InterleavedBufferAttribute;
        // @ts-ignore
        expect(fooAttribute.isInterleavedBufferAttribute).toBe(true);
        expect(fooAttribute.array).toBe(geometry.instancedPool.buffer.buffers.get('static_float32').typedArray);

        const barAttribute = geometry.getAttribute('bar')! as InterleavedBufferAttribute;
        // @ts-ignore
        expect(barAttribute.isInterleavedBufferAttribute).toBe(true);
        expect(barAttribute.array).toBe(geometry.instancedPool.buffer.buffers.get('static_float32').typedArray);
      });

      test('impact', () => {
        const [geometry] = makeInstancedGeometry();
        expect(geometry.instancedBuffers.get('dynamic_uint32').array).toBe(
          geometry.instancedPool.buffer.buffers.get('dynamic_uint32').typedArray,
        );

        const impactAttribute = geometry.getAttribute('impact')! as InstancedBufferAttribute;
        // @ts-ignore
        expect(impactAttribute.isInstancedBufferAttribute).toBe(true);
        expect(impactAttribute.array).toBe(geometry.instancedPool.buffer.buffers.get('dynamic_uint32').typedArray);
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
      expect((geometry.getAttribute('color') as BufferAttribute).version, 'color').toBe(0);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBe(0);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBe(0);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBe(0);

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBeGreaterThan(0);
      expect((geometry.getAttribute('color') as BufferAttribute).version, 'color').toBeGreaterThan(0);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(0);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBeGreaterThan(0);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBeGreaterThan(0);
    });

    test('dynamic auto update', () => {
      const [geometry] = makeInstancedGeometry();

      geometry.update();

      const position_serial = (geometry.getAttribute('position') as BufferAttribute).version;
      const color_serial = (geometry.getAttribute('color') as BufferAttribute).version;
      const impact_serial = (geometry.getAttribute('impact') as BufferAttribute).version;
      const foo_serial = (geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version;
      const bar_serial = (geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version;

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBe(position_serial);
      expect((geometry.getAttribute('color') as BufferAttribute).version, 'color').toBe(color_serial);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(impact_serial);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBe(foo_serial);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBe(bar_serial);
    });

    test('touch color', () => {
      const [geometry] = makeInstancedGeometry();

      geometry.update();

      const position_serial = (geometry.getAttribute('position') as BufferAttribute).version;
      const color_serial = (geometry.getAttribute('color') as BufferAttribute).version;
      const impact_serial = (geometry.getAttribute('impact') as BufferAttribute).version;
      const foo_serial = (geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version;
      const bar_serial = (geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version;

      geometry.touch('color');

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBe(position_serial);
      expect((geometry.getAttribute('color') as BufferAttribute).version, 'color').toBeGreaterThan(color_serial);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(impact_serial);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBe(foo_serial);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBe(bar_serial);
    });

    test('touch foo:interleaved', () => {
      const [geometry] = makeInstancedGeometry();

      geometry.update();

      const position_serial = (geometry.getAttribute('position') as BufferAttribute).version;
      const color_serial = (geometry.getAttribute('color') as BufferAttribute).version;
      const impact_serial = (geometry.getAttribute('impact') as BufferAttribute).version;
      const foo_serial = (geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version;
      const bar_serial = (geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version;

      geometry.touch('foo');

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBe(position_serial);
      expect((geometry.getAttribute('color') as BufferAttribute).version, 'color').toBe(color_serial);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(impact_serial);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBeGreaterThan(foo_serial);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBeGreaterThan(bar_serial);
    });

    test('createVO', () => {
      const [geometry, pool] = makeInstancedGeometry();

      geometry.update();

      const position_serial = (geometry.getAttribute('position') as BufferAttribute).version;
      const color_serial = (geometry.getAttribute('color') as BufferAttribute).version;
      const impact_serial = (geometry.getAttribute('impact') as BufferAttribute).version;
      const foo_serial = (geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version;
      const bar_serial = (geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version;

      pool.createVO();

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBe(position_serial);
      expect((geometry.getAttribute('color') as BufferAttribute).version, 'color').toBeGreaterThan(color_serial);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(impact_serial);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBeGreaterThan(foo_serial);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBeGreaterThan(bar_serial);
    });

    test('freeVO:last', () => {
      const [geometry, pool, , , vo2] = makeInstancedGeometry();

      geometry.update();

      const position_serial = (geometry.getAttribute('position') as BufferAttribute).version;
      const color_serial = (geometry.getAttribute('color') as BufferAttribute).version;
      const impact_serial = (geometry.getAttribute('impact') as BufferAttribute).version;
      const foo_serial = (geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version;
      const bar_serial = (geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version;

      pool.freeVO(vo2);

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBe(position_serial);
      expect((geometry.getAttribute('color') as BufferAttribute).version, 'color').toBe(color_serial);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(impact_serial);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBe(foo_serial);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBe(bar_serial);

      expect(pool.buffer.toAttributeArrays(['color', 'foo', 'bar', 'impact'], 0, pool.usedCount)).toEqual({
        color: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
        foo: new Float32Array([100, 103]),
        bar: new Float32Array([101, 102, 104, 105]),
        impact: new Uint32Array([1000, 1001]),
      });
    });

    test('freeVO:not(last)', () => {
      const [geometry, pool, , vo1] = makeInstancedGeometry();

      geometry.update();

      const position_serial = (geometry.getAttribute('position') as BufferAttribute).version;
      const color_serial = (geometry.getAttribute('color') as BufferAttribute).version;
      const impact_serial = (geometry.getAttribute('impact') as BufferAttribute).version;
      const foo_serial = (geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version;
      const bar_serial = (geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version;

      pool.freeVO(vo1);

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBe(position_serial);
      expect((geometry.getAttribute('color') as BufferAttribute).version, 'color').toBeGreaterThan(color_serial);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(impact_serial);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBeGreaterThan(foo_serial);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBeGreaterThan(bar_serial);

      expect(pool.buffer.toAttributeArrays(['color', 'foo', 'bar', 'impact'], 0, pool.usedCount)).toEqual({
        color: new Uint8Array([1, 2, 3, 4, 9, 10, 11, 12]),
        foo: new Float32Array([100, 106]),
        bar: new Float32Array([101, 102, 107, 108]),
        impact: new Uint32Array([1000, 1002]),
      });
    });
  });
});
