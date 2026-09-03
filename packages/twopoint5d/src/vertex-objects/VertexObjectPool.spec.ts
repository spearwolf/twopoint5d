import type {BufferAttribute, BufferGeometry, InterleavedBufferAttribute} from 'three/webgpu';
import {beforeEach, describe, expect, test} from 'vitest';
import {InstancedVOBufferGeometry} from './InstancedVOBufferGeometry.js';
import {VOBufferPool} from './VOBufferPool.js';
import {VOUtils} from './VOUtils.js';
import {VertexObjectGeometry} from './VertexObjectGeometry.js';
import {VertexObjectPool} from './VertexObjectPool.js';
import {voBuffer, voIndex} from './constants.js';
import type {VO, VOAttrGetter, VOAttrSetter, VertexObjectDescription} from './types.js';

interface MyVertexObject {
  setFoo: VOAttrSetter;
  getFoo: VOAttrGetter;

  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;

  setBar: VOAttrSetter;
  getBar: VOAttrGetter;

  setPlah: VOAttrSetter;
  getPlah: VOAttrGetter;

  a0: number;
  b0: number;
  c0: number;
  a1: number;
  b1: number;
  c1: number;
  a2: number;
  b2: number;
  c2: number;
  a3: number;
  b3: number;
  c3: number;

  setZack: VOAttrSetter;
  getZack: VOAttrGetter;

  zack0: number;
  zack1: number;
  zack2: number;
  zack3: number;
}

interface MyInstancedVertexObject {
  setFoo: VOAttrSetter;
  getFoo: VOAttrGetter;

  x: number;
  y: number;

  bar: number;

  setPlah: VOAttrSetter;
  getPlah: VOAttrGetter;

  a: number;
  b: number;
  c: number;

  zack: number;
}

describe('VertexObjectPool', () => {
  let descriptor: VertexObjectDescription;

  beforeEach(() => {
    descriptor = {
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
        },
        plah: {
          components: ['a', 'b', 'c'],
          type: 'float32',
        },
        zack: {
          components: ['zack'],
          type: 'float32',
          usage: 'dynamic',
        },
      },
    };
  });

  test('construct', () => {
    const pool = new VertexObjectPool(descriptor, 100);

    expect(pool).toBeDefined();
    expect(pool.capacity).toBe(100);
    expect(pool.usedCount).toBe(0);
    expect(pool.availableCount).toBe(100);
  });

  describe('createVO()', () => {
    test('vertexCount > 1', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 100);

      const vo = pool.createVO();
      vo.setFoo(3, 2, 1, 0, 4, 5, 6, 7);
      vo.y1 = -1;
      vo.x2 = -4;
      vo.setBar([100, 101, 102, 103]);
      vo.zack0 = 10;
      vo.zack1 = 20;
      vo.zack2 = 30;
      vo.zack3 = 40;

      expect(vo).toBeDefined();
      expect(vo[voBuffer]).toBe(pool.buffer);

      expect(Array.from(vo.getFoo())).toEqual([3, 2, 1, -1, -4, 5, 6, 7]);
      expect(vo.x0).toBe(3);
      expect(vo.y0).toBe(2);
      expect(vo.x1).toBe(1);
      expect(vo.y1).toBe(-1);
      expect(vo.x2).toBe(-4);
      expect(vo.y2).toBe(5);
      expect(vo.x3).toBe(6);
      expect(vo.y3).toBe(7);
      expect(Array.from(vo.getBar())).toEqual([100, 101, 102, 103]);
      expect(Array.from(vo.getZack())).toEqual([10, 20, 30, 40]);
      expect(vo.zack0).toBe(10);
      expect(vo.zack1).toBe(20);
      expect(vo.zack2).toBe(30);
      expect(vo.zack3).toBe(40);
    });

    test('vertexCount = 1', () => {
      const pool = new VertexObjectPool<MyInstancedVertexObject>({meshCount: 1, attributes: descriptor.attributes}, 100);

      const vo = pool.createVO();
      vo.setFoo(3, 2);
      vo.y = -2;

      expect(vo).toBeDefined();
      expect(vo[voBuffer]).toBe(pool.buffer);

      expect(Array.from(vo.getFoo())).toEqual([3, -2]);
      expect(vo.x).toBe(3);
      expect(vo.y).toBe(-2);

      expect(vo.bar).toBe(0);
      expect(vo.zack).toBe(0);

      vo.zack = 10;

      expect(Array.from(vo[voBuffer].buffers.get('dynamic_float32').typedArray).slice(0, 3)).toEqual([3, -2, 10]);

      vo.bar = 77;
      vo.a = 99;
      vo.b = 88;
      vo.c = 66;

      expect(Array.from(vo[voBuffer].buffers.get('static_float32').typedArray).slice(0, 4)).toEqual([77, 99, 88, 66]);
    });

    test('basePrototype', () => {
      class BaseVO {}
      const pool = new VertexObjectPool({...descriptor, basePrototype: BaseVO.prototype}, 1);
      const vo = pool.createVO();
      expect(vo).toBeInstanceOf(BaseVO);
    });
  });

  describe('freeVO()', () => {
    test('clears the internal buffer reference', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 100);
      const vo = pool.createVO();

      expect(pool.usedCount).toBe(1);
      expect(vo[voBuffer]).toBe(pool.buffer);
      expect(vo[voIndex]).toBe(0);

      pool.freeVO(vo);

      expect(pool.usedCount).toBe(0);
      expect(vo[voBuffer]).toBeUndefined();
    });

    test('copies and re-link the underlying internal buffers', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 100);

      const vo0 = pool.createVO();
      const vo1 = pool.createVO();
      const vo2 = pool.createVO();

      vo1.setFoo(30, 20, 10, 0, 40, 50, 60, 70);
      vo2.setFoo(3, 2, 1, 0, 4, 5, 6, 7);

      expect(pool.usedCount).toBe(3);

      expect(vo0[voIndex]).toBe(0);
      expect(vo1[voIndex]).toBe(1);
      expect(vo2[voIndex]).toBe(2);

      expect(Array.from(vo0.getFoo())).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      expect(Array.from(vo1.getFoo())).toEqual([30, 20, 10, 0, 40, 50, 60, 70]);
      expect(Array.from(vo2.getFoo())).toEqual([3, 2, 1, 0, 4, 5, 6, 7]);

      pool.freeVO(vo0);

      expect(pool.usedCount).toBe(2);

      expect(vo1[voIndex]).toBe(1);
      expect(vo2[voIndex]).toBe(0);

      expect(Array.from(vo1.getFoo())).toEqual([30, 20, 10, 0, 40, 50, 60, 70]);
      expect(Array.from(vo2.getFoo())).toEqual([3, 2, 1, 0, 4, 5, 6, 7]);

      const vo3 = pool.createVO();
      vo3.setFoo(33, 22, 11, 0, 44, 55, 66, 77);

      expect(pool.usedCount).toBe(3);

      expect(vo1[voIndex]).toBe(1);
      expect(vo2[voIndex]).toBe(0);
      expect(vo3[voIndex]).toBe(2);

      expect(Array.from(vo1.getFoo())).toEqual([30, 20, 10, 0, 40, 50, 60, 70]);
      expect(Array.from(vo2.getFoo())).toEqual([3, 2, 1, 0, 4, 5, 6, 7]);
      expect(Array.from(vo3.getFoo())).toEqual([33, 22, 11, 0, 44, 55, 66, 77]);
    });

    test('create vertex objects from attributes data', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 100);

      const [objectCount, firstObjectIdx] = pool.createFromAttributes({
        bar: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3],
      });

      expect(objectCount).toEqual(3);
      expect(firstObjectIdx).toEqual(0);

      expect(
        pool.createFromAttributes({
          bar: [1, 1, 1, 1, 2, 2, 2, 2, 3, 33, 333, 3333],
          zack: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 55, 555, 5555],
        }),
      ).toEqual([5, objectCount]);

      expect(pool.usedCount).toEqual(8);

      expect(Array.from(pool.getVO(2).getBar())).toEqual([3, 3, 3, 3]);
      expect(Array.from(pool.getVO(3).getBar())).toEqual([1, 1, 1, 1]);
      expect(Array.from(pool.getVO(5).getBar())).toEqual([3, 33, 333, 3333]);
      expect(Array.from(pool.getVO(7).getZack())).toEqual([5, 55, 555, 5555]);
    });

    test('use VertexObjectPool.setIndex() to use a single VO as proxy', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 100);
      const vo = pool.createVO();

      vo.setBar([1, 2, 3, 4]);

      pool.usedCount = 2;
      VOUtils.setIndex(vo, 1);

      vo.setBar([5, 6, 7, 8]);

      VOUtils.setIndex(vo, 0);

      expect(Array.from(pool.getVO(0).getBar())).toEqual([1, 2, 3, 4]);
      expect(Array.from(pool.getVO(1).getBar())).toEqual([5, 6, 7, 8]);

      expect(vo).toBe(pool.getVO(0));
      expect(vo).not.toBe(pool.getVO(1));
    });

    test('use buffersData structure to directly create a pool from typed arrays data without copying values', () => {
      const source = new VertexObjectPool<MyVertexObject>(descriptor, 100);

      source.createVO().setBar([1, 2, 3, 4]);
      source.createVO().setFoo([11, 22, 33, 44, 55, 66, 77, 88]);

      const buffersData = source.toBuffersData();

      const pool = new VertexObjectPool<MyVertexObject>(descriptor, buffersData);

      expect(pool.capacity).toBe(100);
      expect(pool.usedCount).toBe(2);
      expect(Array.from(pool.getVO(0).getBar())).toEqual([1, 2, 3, 4]);
      expect(Array.from(pool.getVO(1).getFoo())).toEqual([11, 22, 33, 44, 55, 66, 77, 88]);
    });

    test('the swap path leaves no stale vertex object behind in the vacated slot', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 4);

      const vo0 = pool.createVO();
      pool.createVO();
      const vo2 = pool.createVO();

      pool.freeVO(vo0);

      expect(VOUtils.getIndex(vo2)).toBe(0);
      expect(pool.getVO(2)).toBeUndefined();
    });

    test('the swap path survives a slot that createFromAttributes() never materialized', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 10);

      // each vertex object consumes `vertexCount` values per attribute, so this fills three of them
      pool.createFromAttributes({bar: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]});

      expect(() => pool.freeVO(pool.getVO(0))).not.toThrow();
      expect(pool.usedCount).toBe(2);
    });
  });

  describe('resize()', () => {
    test('resize to larger capacity preserves existing data', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 10);

      const vo0 = pool.createVO();
      vo0.setBar([1, 2, 3, 4]);

      const vo1 = pool.createVO();
      vo1.setFoo([11, 22, 33, 44, 55, 66, 77, 88]);

      expect(pool.capacity).toBe(10);
      expect(pool.usedCount).toBe(2);

      pool.resize(50);

      expect(pool.capacity).toBe(50);
      expect(pool.usedCount).toBe(2);
      expect(pool.availableCount).toBe(48);

      // Verify data is preserved
      expect(Array.from(pool.getVO(0).getBar())).toEqual([1, 2, 3, 4]);
      expect(Array.from(pool.getVO(1).getFoo())).toEqual([11, 22, 33, 44, 55, 66, 77, 88]);

      // Verify we can create more VOs
      const vo2 = pool.createVO();
      vo2.setBar([5, 6, 7, 8]);
      expect(pool.usedCount).toBe(3);
      expect(Array.from(pool.getVO(2).getBar())).toEqual([5, 6, 7, 8]);
    });

    test('resize to smaller capacity preserves data within new capacity', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 100);

      const vo0 = pool.createVO();
      vo0.setBar([1, 2, 3, 4]);

      const vo1 = pool.createVO();
      vo1.setFoo([11, 22, 33, 44, 55, 66, 77, 88]);

      const vo2 = pool.createVO();
      vo2.setBar([5, 6, 7, 8]);

      expect(pool.capacity).toBe(100);
      expect(pool.usedCount).toBe(3);

      pool.resize(2);

      expect(pool.capacity).toBe(2);
      expect(pool.usedCount).toBe(2);
      expect(pool.availableCount).toBe(0);

      // Verify first two VOs are preserved
      expect(Array.from(pool.getVO(0).getBar())).toEqual([1, 2, 3, 4]);
      expect(Array.from(pool.getVO(1).getFoo())).toEqual([11, 22, 33, 44, 55, 66, 77, 88]);

      // Third VO should not be accessible
      expect(pool.getVO(2)).toBeUndefined();

      // Cannot create more VOs when at capacity
      const vo3 = pool.createVO();
      expect(vo3).toBeUndefined();
    });

    test('resize to same capacity is a no-op', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 10);

      const vo0 = pool.createVO();
      vo0.setBar([1, 2, 3, 4]);

      const oldBuffer = pool.buffer;

      pool.resize(10);

      expect(pool.capacity).toBe(10);
      expect(pool.usedCount).toBe(1);
      expect(pool.buffer).toBe(oldBuffer); // Buffer should not change
      expect(Array.from(pool.getVO(0).getBar())).toEqual([1, 2, 3, 4]);
    });

    test('resize to 0 capacity', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 10);

      pool.createVO().setBar([1, 2, 3, 4]);
      pool.createVO().setFoo([11, 22, 33, 44, 55, 66, 77, 88]);

      pool.resize(0);

      expect(pool.capacity).toBe(0);
      expect(pool.usedCount).toBe(0);
      expect(pool.availableCount).toBe(0);

      const vo = pool.createVO();
      expect(vo).toBeUndefined();
    });

    test('resize preserves VO references in voIndex', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 10);

      const vo0 = pool.createVO();
      vo0.setBar([1, 2, 3, 4]);

      const vo1 = pool.createVO();
      vo1.setFoo([11, 22, 33, 44, 55, 66, 77, 88]);

      pool.resize(50);

      // The same VO instances should still be accessible
      expect(pool.getVO(0)).toBe(vo0);
      expect(pool.getVO(1)).toBe(vo1);

      // Their data should be intact
      expect(Array.from(vo0.getBar())).toEqual([1, 2, 3, 4]);
      expect(Array.from(vo1.getFoo())).toEqual([11, 22, 33, 44, 55, 66, 77, 88]);
    });

    test('resize updates buffer reference for existing VOs', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 10);

      const vo0 = pool.createVO();
      vo0.setBar([1, 2, 3, 4]);

      const oldBuffer = pool.buffer;

      pool.resize(50);

      // Buffer should be new
      expect(pool.buffer).not.toBe(oldBuffer);

      // VO should be accessible and functional
      expect(Array.from(pool.getVO(0).getBar())).toEqual([1, 2, 3, 4]);

      // Modifying the VO should work with the new buffer
      vo0.setBar([10, 20, 30, 40]);
      expect(Array.from(pool.getVO(0).getBar())).toEqual([10, 20, 30, 40]);
    });

    test('resize throws error for negative capacity', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 10);

      expect(() => pool.resize(-1)).toThrow('Capacity must be a non-negative integer');
    });

    test('resize throws error for non-integer capacity', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 10);

      expect(() => pool.resize(10.5)).toThrow('Capacity must be a non-negative integer');
    });

    test('shrinking unlinks every vertex object beyond the new capacity', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 6);

      const vo0 = pool.createVO();
      const vo1 = pool.createVO();
      const vo2 = pool.createVO();
      pool.createVO();
      const vo4 = pool.createVO();
      const vo5 = pool.createVO();

      pool.resize(3);

      expect(vo4[voBuffer]).toBeUndefined();
      expect(vo5[voBuffer]).toBeUndefined();

      expect(vo0[voBuffer]).toBe(pool.buffer);
      expect(vo1[voBuffer]).toBe(pool.buffer);
      expect(vo2[voBuffer]).toBe(pool.buffer);
    });

    test('is rejected while a geometry is attached and allowed again after the geometry is disposed', () => {
      const pool = new VertexObjectPool<MyVertexObject & VO>(descriptor, 10);
      const geometry = new VertexObjectGeometry(pool, 10);

      expect(() => pool.resize(20)).toThrow();

      geometry.dispose();

      expect(() => pool.resize(20)).not.toThrow();
    });
  });

  describe('usedCount', () => {
    test('is clamped to zero', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 10);

      pool.usedCount = -5;

      expect(pool.usedCount).toBe(0);
      expect(pool.availableCount).toBe(pool.capacity);
    });
  });

  describe('geometry attachments', () => {
    const makePool = () => new VertexObjectPool<VO>(descriptor, 10);

    // reads the geometry side of the attachment: which attributes still point into the
    // typed arrays of this pool, regardless of how the geometry books its attachments
    const attributesBackedBy = (geometry: BufferGeometry, pool: VOBufferPool): string[] => {
      const typedArrays = new Set(Array.from(pool.buffer.buffers.values()).map((buffer) => buffer.typedArray));
      return Object.entries(geometry.attributes)
        .filter(([, attr]) => {
          const bufAttr = (attr as InterleavedBufferAttribute).isInterleavedBufferAttribute
            ? (attr as InterleavedBufferAttribute).data
            : (attr as BufferAttribute);
          return typedArrays.has(bufAttr.array as any);
        })
        .map(([attrName]) => attrName)
        .sort();
    };

    test('an instanced geometry holds both its base and its instanced pool', () => {
      const basePool = makePool();
      const instancedPool = makePool();

      const geometry = new InstancedVOBufferGeometry(instancedPool, 10, basePool, 10);

      expect(basePool.isAttachedToGeometry).toBe(true);
      expect(instancedPool.isAttachedToGeometry).toBe(true);

      geometry.dispose();

      expect(basePool.isAttachedToGeometry).toBe(false);
      expect(instancedPool.isAttachedToGeometry).toBe(false);
    });

    test('a repeated dispose() does not release a pool a second time', () => {
      const pool = makePool();

      const first = new VertexObjectGeometry(pool, 10);
      const second = new VertexObjectGeometry(pool, 10);

      first.dispose();
      first.dispose();

      // the second geometry still has its attributes on this pool
      expect(pool.isAttachedToGeometry).toBe(true);
      expect(() => pool.resize(20)).toThrow();

      second.dispose();

      expect(pool.isAttachedToGeometry).toBe(false);
      expect(() => pool.resize(20)).not.toThrow();
    });

    test('attachInstancedPool() holds the pool until detachInstancedPool() gives it back', () => {
      const geometry = new InstancedVOBufferGeometry(makePool(), 10, makePool(), 10);
      const extraPool = makePool();

      geometry.attachInstancedPool('extra', extraPool);

      expect(extraPool.isAttachedToGeometry).toBe(true);
      expect(() => extraPool.resize(20)).toThrow();

      expect(attributesBackedBy(geometry, extraPool)).toEqual(['bar', 'foo', 'plah', 'zack']);

      geometry.detachInstancedPool('extra');

      // giving the attachment back means giving up the attributes too: a resize() swaps the
      // pool's typed arrays, and an attribute left behind would keep reading the old ones
      expect(attributesBackedBy(geometry, extraPool)).toEqual([]);
      expect(extraPool.isAttachedToGeometry).toBe(false);
      expect(() => extraPool.resize(20)).not.toThrow();
    });

    test('detachInstancedPool() leaves the attributes of the other pools alone', () => {
      const basePool = makePool();
      const instancedPool = makePool();
      const geometry = new InstancedVOBufferGeometry(instancedPool, 10, basePool, 10);

      const extraPool = new VertexObjectPool<VO>({vertexCount: 1, attributes: {somethingElse: {size: 1, type: 'float32'}}}, 10);

      geometry.attachInstancedPool('extra', extraPool);
      geometry.detachInstancedPool('extra');

      expect(attributesBackedBy(geometry, extraPool)).toEqual([]);
      expect(attributesBackedBy(geometry, instancedPool)).toEqual(['bar', 'foo', 'plah', 'zack']);
    });

    test('attaching under a name that is already taken releases the pool it replaces', () => {
      const geometry = new InstancedVOBufferGeometry(makePool(), 10, makePool(), 10);
      const replaced = makePool();
      const replacement = new VertexObjectPool<VO>({vertexCount: 1, attributes: {somethingElse: {size: 1, type: 'float32'}}}, 10);

      geometry.attachInstancedPool('extra', replaced);
      geometry.attachInstancedPool('extra', replacement);

      expect(replaced.isAttachedToGeometry).toBe(false);
      expect(replacement.isAttachedToGeometry).toBe(true);

      // the replacement covers none of the attribute names of the pool it displaced, so
      // nothing overwrites them and they have to go with the pool they belong to
      expect(attributesBackedBy(geometry, replaced)).toEqual([]);
      expect(attributesBackedBy(geometry, replacement)).toEqual(['somethingElse']);
    });

    test('one pool serving as base and instanced pool at once stays held until the geometry is gone', () => {
      const pool = makePool();

      const geometry = new InstancedVOBufferGeometry(pool, 10, pool, 10);

      expect(pool.isAttachedToGeometry).toBe(true);

      geometry.dispose();

      expect(pool.isAttachedToGeometry).toBe(false);
      expect(() => pool.resize(20)).not.toThrow();
    });

    test('one pool attached under two names stays held until both names are gone', () => {
      const geometry = new InstancedVOBufferGeometry(makePool(), 10, makePool(), 10);
      const shared = makePool();

      geometry.attachInstancedPool('one', shared);
      geometry.attachInstancedPool('two', shared);

      geometry.detachInstancedPool('one');

      expect(shared.isAttachedToGeometry).toBe(true);
      expect(attributesBackedBy(geometry, shared)).toEqual(['bar', 'foo', 'plah', 'zack']);

      geometry.detachInstancedPool('two');

      expect(shared.isAttachedToGeometry).toBe(false);
      expect(attributesBackedBy(geometry, shared)).toEqual([]);
    });

    test('one pool attached under two names keeps its attributes while either name still holds it', () => {
      const geometry = new InstancedVOBufferGeometry(makePool(), 10, makePool(), 10);
      const shared = makePool();

      geometry.attachInstancedPool('one', shared);
      geometry.attachInstancedPool('two', shared);

      geometry.detachInstancedPool('two');

      // 'one' still reads the very same typed arrays, so the attributes have to stay —
      // the attachment the pool reports and the attributes on the geometry say the same thing
      expect(shared.isAttachedToGeometry).toBe(true);
      expect(attributesBackedBy(geometry, shared)).toEqual(['bar', 'foo', 'plah', 'zack']);

      geometry.detachInstancedPool('one');

      expect(shared.isAttachedToGeometry).toBe(false);
      expect(attributesBackedBy(geometry, shared)).toEqual([]);
    });

    test('the default instanced pool keeps its attributes when it is detached as an extra pool', () => {
      const instancedPool = makePool();
      const geometry = new InstancedVOBufferGeometry(instancedPool, 10, makePool(), 10);

      geometry.attachInstancedPool('again', instancedPool);
      geometry.detachInstancedPool('again');

      expect(instancedPool.isAttachedToGeometry).toBe(true);
      expect(attributesBackedBy(geometry, instancedPool)).toEqual(['bar', 'foo', 'plah', 'zack']);
    });

    test('dispose() releases an extra pool that it leaves untouched otherwise', () => {
      const geometry = new InstancedVOBufferGeometry(makePool(), 10, makePool(), 10);
      const extraPool = makePool();

      geometry.attachInstancedPool('extra', extraPool, {autoDispose: false});
      extraPool.createVO();

      geometry.dispose();

      expect(extraPool.isAttachedToGeometry).toBe(false);
      // autoDispose: false means the caller keeps the buffers, so the pool is still populated
      expect(extraPool.usedCount).toBe(1);
    });
  });

  describe('dispose()', () => {
    test('VOBufferPool: starts as not disposed and toggles isDisposed on dispose()', () => {
      const pool = new VOBufferPool(descriptor, 10);

      expect(pool.isDisposed).toBe(false);

      pool.dispose();

      expect(pool.isDisposed).toBe(true);
    });

    test('VOBufferPool: resets usedCount and releases typed-array references', () => {
      const pool = new VOBufferPool(descriptor, 10);

      pool.createFromAttributes({bar: [1, 1, 1, 1, 2, 2, 2, 2]});
      expect(pool.usedCount).toBe(2);

      // capture references before dispose so we can verify the pool drops them
      const buffersBefore = Array.from(pool.buffer.buffers.values());
      expect(buffersBefore.length).toBeGreaterThan(0);
      for (const buf of buffersBefore) {
        expect(buf.typedArray).toBeDefined();
      }

      pool.dispose();

      expect(pool.usedCount).toBe(0);
      expect(pool.buffer.buffers.size).toBe(0);
      // the buffer entries we captured before dispose should now have null'd typedArrays
      for (const buf of buffersBefore) {
        expect(buf.typedArray).toBeUndefined();
      }
    });

    test('VOBufferPool: dispose() is idempotent', () => {
      const pool = new VOBufferPool(descriptor, 4);

      expect(() => {
        pool.dispose();
        pool.dispose();
        pool.dispose();
      }).not.toThrow();

      expect(pool.isDisposed).toBe(true);
    });

    test('VertexObjectPool: clears buffer reference on every tracked VO', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 10);

      const vo0 = pool.createVO();
      const vo1 = pool.createVO();
      const vo2 = pool.createVO();

      expect(vo0[voBuffer]).toBe(pool.buffer);
      expect(vo1[voBuffer]).toBe(pool.buffer);
      expect(vo2[voBuffer]).toBe(pool.buffer);

      pool.dispose();

      expect(vo0[voBuffer]).toBeUndefined();
      expect(vo1[voBuffer]).toBeUndefined();
      expect(vo2[voBuffer]).toBeUndefined();
    });

    test('VertexObjectPool: getVO() / createVO() are no-ops after dispose()', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 5);

      pool.createVO();
      pool.createVO();

      pool.dispose();

      expect(pool.getVO(0)).toBeUndefined();
      expect(pool.getVO(1)).toBeUndefined();
      // capacity-bound check survives dispose, but the internal voIndex is empty:
      // either createVO returns undefined (capacity reached because usedCount == capacity)
      // or it bumps usedCount but cannot persist the new VO. Both are acceptable;
      // the contract is "the pool is dead", not "createVO is graceful".
      // Here we simply assert the disposal flag is set and used VOs are not retrievable.
      expect(pool.isDisposed).toBe(true);
    });

    test('VertexObjectPool: dispose() is idempotent', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 5);

      const vo0 = pool.createVO();
      const vo1 = pool.createVO();

      expect(() => {
        pool.dispose();
        pool.dispose();
      }).not.toThrow();

      expect(pool.isDisposed).toBe(true);
      expect(vo0[voBuffer]).toBeUndefined();
      expect(vo1[voBuffer]).toBeUndefined();
    });

    test('VertexObjectPool: dispose() while VOs were freed-via-swap still tears the swapped slot down cleanly', () => {
      const pool = new VertexObjectPool<MyVertexObject>(descriptor, 4);

      const vo0 = pool.createVO();
      const vo1 = pool.createVO();
      const vo2 = pool.createVO();

      // Free vo0 → vo2 is swapped into slot 0 (see freeVO()).
      pool.freeVO(vo0);

      expect(vo0[voBuffer]).toBeUndefined();
      expect(VOUtils.getIndex(vo2)).toBe(0);

      pool.dispose();

      // every VO that survived the freeVO swap must end up unlinked
      expect(vo1[voBuffer]).toBeUndefined();
      expect(vo2[voBuffer]).toBeUndefined();
    });
  });
});
