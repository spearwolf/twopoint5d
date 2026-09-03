import type {InstancedBufferAttribute, InterleavedBufferAttribute} from 'three/webgpu';
import {BufferAttribute, BufferGeometry} from 'three/webgpu';
import {describe, expect, test} from 'vitest';
import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
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

    // prettier-ignore
    setPosition(values: [
      number, number, number,
      number, number, number,
      number, number, number,
      number, number, number,
    ]): void;
  }

  const extraDesc = new VertexObjectDescriptor({
    meshCount: 1,

    attributes: {
      quux: {
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

      const base = geometry.basePool.createVO();
      // prettier-ignore
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

        const static_float32 = geometry.baseBuffers.get('positions').array;
        const positionAttribute = geometry.getAttribute('position')! as BufferAttribute;

        expect(positionAttribute.isBufferAttribute).toBe(true);
        expect(positionAttribute.array).toBe(static_float32);
        expect(static_float32).toBe(geometry.basePool.buffer.buffers.get('positions').typedArray);
      });

      test('color', () => {
        const [geometry] = makeInstancedGeometry();

        expect(geometry.instancedBuffers.get('static_uint8').array).toBe(
          geometry.instancedPool.buffer.buffers.get('static_uint8').typedArray,
        );

        const colorAttribute = geometry.getAttribute('color')! as InstancedBufferAttribute;
        expect(colorAttribute.isInstancedBufferAttribute).toBe(true);
        expect(colorAttribute.array).toBe(geometry.instancedPool.buffer.buffers.get('static_uint8').typedArray);
      });

      test('foo, bar', () => {
        const [geometry] = makeInstancedGeometry();

        expect(geometry.instancedBuffers.get('static_float32').array).toBe(
          geometry.instancedPool.buffer.buffers.get('static_float32').typedArray,
        );

        const fooAttribute = geometry.getAttribute('foo')! as InterleavedBufferAttribute;
        expect(fooAttribute.isInterleavedBufferAttribute).toBe(true);
        expect(fooAttribute.array).toBe(geometry.instancedPool.buffer.buffers.get('static_float32').typedArray);

        const barAttribute = geometry.getAttribute('bar')! as InterleavedBufferAttribute;
        expect(barAttribute.isInterleavedBufferAttribute).toBe(true);
        expect(barAttribute.array).toBe(geometry.instancedPool.buffer.buffers.get('static_float32').typedArray);
      });

      test('impact', () => {
        const [geometry] = makeInstancedGeometry();
        expect(geometry.instancedBuffers.get('dynamic_uint32').array).toBe(
          geometry.instancedPool.buffer.buffers.get('dynamic_uint32').typedArray,
        );

        const impactAttribute = geometry.getAttribute('impact')! as InstancedBufferAttribute;
        expect(impactAttribute.isInstancedBufferAttribute).toBe(true);
        expect(impactAttribute.array).toBe(geometry.instancedPool.buffer.buffers.get('dynamic_uint32').typedArray);
      });
    });

    describe('fromBuffersData', () => {
      test('position: zero-copy', () => {
        const [geometry, , , , , base] = makeInstancedGeometry();

        const buffer = geometry.basePool.buffer.buffers.get('positions');
        const initialPositions = buffer.typedArray;
        const positionAttribute = geometry.getAttribute('position')! as BufferAttribute;

        expect(positionAttribute.array).toBe(initialPositions);
        expect(geometry.basePool.capacity).toBe(1);

        expect(base.x0).toBe(0);
        expect(base.y0).toBe(1);
        expect(base.z0).toBe(2);
        expect(base.x3).toBe(9);
        expect(base.y3).toBe(10);
        expect(base.z3).toBe(11);

        // prettier-ignore
        const positions = new Float32Array([
          100, 101, 102,
          103, 104, 105,
          106, 107, 108,
          109, 110, 111,
        ]);

        geometry.basePool.fromBuffersData({
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

        const buffer = geometry.baseBuffers.get('positions');
        const initialPositions = buffer.array;
        const positionAttribute = geometry.getAttribute('position')! as BufferAttribute;

        expect(positionAttribute.array).toBe(initialPositions);
        expect(geometry.basePool.capacity).toBe(1);

        expect(base.x0).toBe(0);
        expect(base.y0).toBe(1);
        expect(base.z0).toBe(2);
        expect(base.x3).toBe(9);
        expect(base.y3).toBe(10);
        expect(base.z3).toBe(11);

        // prettier-ignore
        const positions = new Float32Array([
          100, 101, 102,
          103, 104, 105,
          106, 107, 108,
          109, 110, 111,
        ]);

        geometry.basePool.fromBuffersData(
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

        const buffer = geometry.baseBuffers.get('positions');
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

        // prettier-ignore
        const positions = new Float32Array([
          100, 101, 102,
          103, 104, 105,
        ]);

        geometry.basePool.fromBuffersData({
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

        const buffer = geometry.instancedBuffers.get('static_float32');
        const initialDataArray = buffer.array;
        const fooAttribute = geometry.getAttribute('foo')! as InterleavedBufferAttribute;

        expect(fooAttribute.data.array).toBe(initialDataArray);
        expect(geometry.instancedPool.capacity).toBe(10);

        expect(vo0.foo).toBe(100);
        expect(vo1.foo).toBe(103);
        expect(vo2.foo).toBe(106);

        // prettier-ignore
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
      expect((geometry.getAttribute('color') as BufferAttribute).version, 'color').toBe(0);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBe(0);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBe(0);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBe(0);

      expect(geometry.drawRange).toEqual({start: 0, count: Infinity});

      geometry.update();

      expect((geometry.getAttribute('position') as BufferAttribute).version, 'position').toBeGreaterThan(0);
      expect((geometry.getAttribute('color') as BufferAttribute).version, 'color').toBeGreaterThan(0);
      expect((geometry.getAttribute('impact') as BufferAttribute).version, 'impact').toBeGreaterThan(0);
      expect((geometry.getAttribute('foo') as InterleavedBufferAttribute).data.version, 'foo').toBeGreaterThan(0);
      expect((geometry.getAttribute('bar') as InterleavedBufferAttribute).data.version, 'bar').toBeGreaterThan(0);

      expect(geometry.instanceCount).toEqual(3);
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

      expect(geometry.instanceCount).toEqual(4);
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

      expect(geometry.instanceCount).toEqual(2);
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

      expect(geometry.instanceCount).toEqual(2);
    });
  });

  describe('update ranges', () => {
    test('the base pool of an instanced geometry uploads every vertex of a used object', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      geometry.basePool.createVO();
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
  });

  describe('constructed with a BufferGeometry', () => {
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
    test('a pool handed in from outside stays untouched', () => {
      const instancedPool = new VertexObjectPool<MyInstancedVO>(instancedDesc, 10);
      instancedPool.createVO();

      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedPool, 10, baseDesc, 1);
      geometry.dispose();

      expect(instancedPool.usedCount).toBe(1);
      expect(instancedPool.isDisposed).toBe(false);
    });

    test('a pool the geometry built itself is released', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const {instancedPool, basePool} = geometry;

      geometry.dispose();

      expect(instancedPool.isDisposed).toBe(true);
      expect(basePool.isDisposed).toBe(true);
    });

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
      const second = geometry.attachInstancedPool('extra', extraDesc);

      expect(first.isDisposed).toBe(true);
      expect(second.isDisposed).toBe(false);
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

    test('a pool the geometry built stays its own when it is attached under a second name', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const pool = geometry.attachInstancedPool('extra', extraDesc);

      geometry.attachInstancedPool('sameAgain', pool);
      geometry.detachInstancedPool('extra');

      expect(pool.isDisposed).toBe(false);

      geometry.dispose();

      expect(pool.isDisposed).toBe(true);
    });

    test('a pool that outlives its detach stops belonging to the geometry', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const pool = geometry.attachInstancedPool('extra', extraDesc, {autoDispose: false});

      geometry.detachInstancedPool('extra');

      expect(pool.isDisposed).toBe(false);

      // no route of this geometry reaches the pool any more, so attaching it again is attaching
      // a pool from outside
      geometry.attachInstancedPool('extra', pool);
      geometry.dispose();

      expect(pool.isDisposed).toBe(false);
    });

    test('every pool of an attach/detach cycle under one name is released', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      const pools = [];
      for (let i = 0; i < 3; i++) {
        pools.push(geometry.attachInstancedPool('extra', extraDesc));
        geometry.detachInstancedPool('extra');
      }

      geometry.dispose();

      expect(pools.map((pool) => pool.isDisposed)).toEqual([true, true, true]);
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

    test('detachInstancedPool() keeps a pool that another route still reads', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      const pool = geometry.attachInstancedPool('extra', extraDesc);
      geometry.attachInstancedPool('sameAgain', pool);

      geometry.detachInstancedPool('extra');

      expect(pool.isDisposed).toBe(false);
    });
  });

  describe('attachInstancedPool()', () => {
    const dynamicExtraDesc = new VertexObjectDescriptor({
      meshCount: 1,
      attributes: {
        quux: {
          size: 1,
          type: 'float32',
          usage: 'dynamic',
        },
      },
    });

    test('a descriptor is wrapped in a pool with the capacity of the instancedPool', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      const pool = geometry.attachInstancedPool('extra', extraDesc);

      expect(pool.capacity).toBe(geometry.instancedPool.capacity);
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
      const buffer = bufferInSlot(geometry, 'quux');
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

      const buffer = bufferInSlot(geometry, 'quux');
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
      expect(basePool.isDisposed).toBe(true);
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

      const buffer = bufferInSlot(geometry, 'impact');
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

      const buffer = bufferInSlot(geometry, 'position');
      geometry.dispose();
      const versionAfterDispose = buffer.version;

      geometry.update();

      expect(buffer.version).toBe(versionAfterDispose);
      expect(handedIn.isDisposed).toBe(false);
    });
  });

  describe('attribute slots', () => {
    // declares the attribute name of `extraDesc` a second time, with its own typed arrays
    const otherQuuxDesc = new VertexObjectDescriptor({
      meshCount: 1,

      attributes: {
        quux: {
          size: 2,
          type: 'float32',
        },
      },
    });

    // declares an attribute name of `instancedDesc`
    const fooDesc = new VertexObjectDescriptor({
      meshCount: 1,

      attributes: {
        foo: {
          size: 1,
          type: 'float32',
        },
      },
    });

    const bufferNameOf = (pool: VertexObjectPool<VO>, attrName: string) => pool.buffer.bufferAttributes.get(attrName).bufferName;

    test('a route that gives up a shared pool hands the slot back to the route that keeps it', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const shared = new VertexObjectPool<VO>(extraDesc, 10);

      geometry.attachInstancedPool('one', shared);
      geometry.attachInstancedPool('two', shared);
      geometry.detachInstancedPool('two');

      // the slot belongs to the route that is still there, so touching the attribute reaches it
      const buffer = bufferInSlot(geometry, 'quux');
      expect(buffer).toBe(geometry.extraInstancedBuffers.get('one').get(bufferNameOf(shared, 'quux')));

      const version = buffer.version;
      geometry.touchAttributes('quux');

      expect(bufferInSlot(geometry, 'quux').version).toBeGreaterThan(version);
    });

    test('a route that shares its typed arrays with another pool gives up only its own slots', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      const a = new VertexObjectPool<VO>(extraDesc, 10);
      // by default the typed arrays are shared instead of copied, so both pools read the same memory
      const b = new VertexObjectPool<VO>(extraDesc, a.toBuffersData());

      geometry.attachInstancedPool('a', a);
      geometry.attachInstancedPool('b', b);
      geometry.detachInstancedPool('b');

      // detached, so it may resize — and that gives it typed arrays of its own
      b.resize(20);
      geometry.update();

      const bufferName = bufferNameOf(a, 'quux');
      expect(bufferInSlot(geometry, 'quux')).toBe(geometry.extraInstancedBuffers.get('a').get(bufferName));
      expect((geometry.getAttribute('quux') as BufferAttribute).array).toBe(a.buffer.buffers.get(bufferName).typedArray);
    });

    test('two pools declaring the same attribute name keep the slot with the surviving route', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);

      const a = new VertexObjectPool<VO>(extraDesc, 10);
      const b = new VertexObjectPool<VO>(otherQuuxDesc, 10);

      geometry.attachInstancedPool('a', a);
      geometry.attachInstancedPool('b', b);
      geometry.detachInstancedPool('b');

      const bufferName = bufferNameOf(a, 'quux');
      expect(bufferInSlot(geometry, 'quux')).toBe(geometry.extraInstancedBuffers.get('a').get(bufferName));
      expect((geometry.getAttribute('quux') as BufferAttribute).array).toBe(a.buffer.buffers.get(bufferName).typedArray);
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

    test('an extra pool that declares an attribute name of the instanced pool feeds the slot it took', () => {
      const geometry = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, baseDesc, 1);
      const extraPool = new VertexObjectPool<VO>(fooDesc, 10);

      geometry.attachInstancedPool('extra', extraPool);
      geometry.update();

      const bufferName = bufferNameOf(extraPool, 'foo');
      expect((geometry.getAttribute('foo') as BufferAttribute).array).toBe(extraPool.buffer.buffers.get(bufferName).typedArray);
    });
  });
});
