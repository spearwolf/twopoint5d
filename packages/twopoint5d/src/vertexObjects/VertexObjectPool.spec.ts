import {VertexObjectPool} from './VertexObjectPool.js';
import {voBuffer, voIndex} from './constants.js';
import type {VOAttrSetter, VOAttrGetter, VertexObjectDescription} from './types.js';

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
      VertexObjectPool.setIndex(vo, 1);

      vo.setBar([5, 6, 7, 8]);

      VertexObjectPool.setIndex(vo, 0);

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
  });
});
