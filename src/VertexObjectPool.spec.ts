import {VertexObjectPool} from './VertexObjectPool';
import {voBuffer} from './constants';
import {VOAttrSetter, VOAttrGetter, VertexObjectDescription} from './types';

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
      const pool = new VertexObjectPool<MyInstancedVertexObject>(
        {meshCount: 1, attributes: descriptor.attributes},
        100,
      );

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

      expect(
        Array.from(
          vo[voBuffer].buffers.get('dynamic_float32').typedArray,
        ).slice(0, 3),
      ).toEqual([3, -2, 10]);

      vo.bar = 77;
      vo.a = 99;
      vo.b = 88;
      vo.c = 66;

      expect(
        Array.from(vo[voBuffer].buffers.get('static_float32').typedArray).slice(
          0,
          4,
        ),
      ).toEqual([77, 99, 88, 66]);
    });
  });
});
