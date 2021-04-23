import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {VertexObjectPool} from './VertexObjectPool';
import {voBuffer} from './constants';
import {VOAttrSetter, VOAttrGetter} from './types';

interface MyVertexObject {
  setFoo: VOAttrSetter;
  getFoo: VOAttrGetter;
  setBar: VOAttrSetter;
  getBar: VOAttrGetter;
}

describe('VertexObjectPool', () => {
  let descriptor: VertexObjectDescriptor;

  beforeEach(() => {
    descriptor = new VertexObjectDescriptor({
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
          components: ['zick'],
          type: 'float32',
          usage: 'dynamic',
        },
      },
    });
  });

  test('construct', () => {
    const pool = new VertexObjectPool(descriptor, 100);

    expect(pool).toBeDefined();
    expect(pool.capacity).toBe(100);
    expect(pool.usedCount).toBe(0);
    expect(pool.availableCount).toBe(100);
  });

  test('createVO', () => {
    const pool = new VertexObjectPool<MyVertexObject>(descriptor, 100);

    const vo = pool.createVO();
    vo.setFoo(3, 2, 1, 0, 4, 5, 6, 7);
    vo.setBar([100, 101, 102, 103]);

    expect(vo).toBeDefined();
    expect(vo[voBuffer]).toBe(pool.buffer);
    expect(Array.from(vo.getFoo())).toEqual([3, 2, 1, 0, 4, 5, 6, 7]);
    expect(Array.from(vo.getBar())).toEqual([100, 101, 102, 103]);
  });
});
