import {describe, expect, expectTypeOf, test} from 'vitest';
import type {VOAttrGetter, VOAttrSetter} from './types.js';
import {VertexObjectPool} from './VertexObjectPool.js';

describe('the generated attribute accessors', () => {
  test('an attribute declared without a getter gets none', () => {
    const pool = new VertexObjectPool({vertexCount: 1, attributes: {color: {components: ['r', 'g'], getter: false}}}, 1);
    const names = Object.getOwnPropertyNames(pool.descriptor.voPrototype);

    expect(names).not.toContain('undefined');
    expect(names).not.toContain('getColor');
    expect(names).toEqual(expect.arrayContaining(['setColor', 'r', 'g']));
  });

  test('a component named like its attribute gets its accessor', () => {
    const pool = new VertexObjectPool<{foo: number; getFoo: () => ArrayLike<number>}>(
      {vertexCount: 1, attributes: {foo: {components: ['foo', 'bar']}}},
      1,
    );
    const vo = pool.createVO()!;

    vo.foo = 3;

    expect(vo.getFoo()[0]).toBe(3);
  });

  test('a multi-component setter takes a typed array', () => {
    const pool = new VertexObjectPool<{
      setPos: (...args: number[] | [ArrayLike<number>]) => void;
      getPos: () => ArrayLike<number>;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 1);
    const vo = pool.createVO()!;
    vo.setPos(1, 2, 3);
    vo.setPos(new Float32Array([4, 5, 6]));
    expect(Array.from(vo.getPos())).toEqual([4, 5, 6]);
  });

  test('a multi-component setter takes a typed array across every vertex', () => {
    const pool = new VertexObjectPool<{
      setPos: (...args: number[] | [ArrayLike<number>]) => void;
      getPos: () => ArrayLike<number>;
    }>({vertexCount: 2, attributes: {pos: {components: ['x', 'y']}}}, 1);
    const vo = pool.createVO()!;
    vo.setPos([1, 2, 3, 4]);
    vo.setPos(new Float32Array([9, 8, 7, 6]));
    expect(Array.from(vo.getPos())).toEqual([9, 8, 7, 6]);
  });

  test('a single-component setter takes a typed array', () => {
    const pool = new VertexObjectPool<{
      setBar: (...args: number[] | [ArrayLike<number>]) => void;
      getBar: () => ArrayLike<number>;
    }>({vertexCount: 3, attributes: {bar: {size: 1}}}, 1);
    const vo = pool.createVO()!;
    vo.setBar(new Float32Array([5, 6, 7]));
    expect(Array.from(vo.getBar())).toEqual([5, 6, 7]);
  });

  test('a setter takes the array a getter answers with', () => {
    const pool = new VertexObjectPool<{
      setPos: (...args: number[] | [ArrayLike<number>]) => void;
      getPos: () => ArrayLike<number>;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 2);
    const a = pool.createVO()!;
    const b = pool.createVO()!;
    a.setPos(1, 2, 3);
    b.setPos(a.getPos());
    expect(Array.from(b.getPos())).toEqual([1, 2, 3]);
  });

  test('a setter leaves the components it was not given', () => {
    const pool = new VertexObjectPool<{
      setPos: (...args: number[] | [ArrayLike<number>]) => void;
      getPos: () => ArrayLike<number>;
    }>({vertexCount: 2, attributes: {pos: {components: ['x', 'y']}}}, 1);
    const vo = pool.createVO()!;
    vo.setPos([1, 2, 3, 4]);
    vo.setPos([5, 4]);
    expect(Array.from(vo.getPos())).toEqual([5, 4, 3, 4]);
  });

  test('a single-component setter leaves the vertices it was not given', () => {
    const pool = new VertexObjectPool<{
      setBar: (...args: number[] | [ArrayLike<number>]) => void;
      getBar: () => ArrayLike<number>;
    }>({vertexCount: 3, attributes: {bar: {size: 1}}}, 1);
    const vo = pool.createVO()!;
    vo.setBar([1, 2, 3]);
    vo.setBar([9]);
    expect(Array.from(vo.getBar())).toEqual([9, 2, 3]);
  });

  test('a setter still takes its values as separate arguments', () => {
    const pool = new VertexObjectPool<{
      setPos: (...args: number[] | [ArrayLike<number>]) => void;
      getPos: () => ArrayLike<number>;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 1);
    const vo = pool.createVO()!;
    vo.setPos(1, 2, 3);
    expect(Array.from(vo.getPos())).toEqual([1, 2, 3]);
  });

  test('a setter still takes its values as a plain array', () => {
    const pool = new VertexObjectPool<{
      setPos: (...args: number[] | [ArrayLike<number>]) => void;
      getPos: () => ArrayLike<number>;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 1);
    const vo = pool.createVO()!;
    vo.setPos([1, 2, 3]);
    expect(Array.from(vo.getPos())).toEqual([1, 2, 3]);
  });

  test('a setter writes into an interleaved buffer at the attribute offset', () => {
    const pool = new VertexObjectPool<{
      setFoo: (...args: number[] | [ArrayLike<number>]) => void;
      getFoo: () => ArrayLike<number>;
    }>(
      {
        vertexCount: 2,
        attributes: {
          foo: {components: ['x', 'y']},
          bar: {size: 3},
        },
      },
      1,
    );
    const vo = pool.createVO()!;
    vo.setFoo(new Float32Array([7, 8, 9, 10]));
    // prettier-ignore
    expect(Array.from(pool.buffer.buffers.get('static_float32')!.typedArray!)).toEqual([
      0, 0, 0, 7, 8,
      0, 0, 0, 9, 10,
    ]);
  });

  test('a float16 attribute keeps the fraction of a half float', () => {
    const pool = new VertexObjectPool<{v: number}>({vertexCount: 1, attributes: {v: {size: 1, type: 'float16'}}}, 1);
    const vo = pool.createVO()!;
    vo.v = 0.1;
    expect(vo.v).toBe(0.0999755859375);
    vo.v = 1.5;
    expect(vo.v).toBe(1.5);
  });

  test('a getter writes into the target it is handed and answers with that target', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 1);
    const vo = pool.createVO()!;
    vo.setPos(1, 2, 3);
    const target = new Float32Array(3);
    expect(vo.getPos(target)).toBe(target);
    expect(Array.from(target)).toEqual([1, 2, 3]);
  });

  test('a getter takes a plain array as its target', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 1);
    const vo = pool.createVO()!;
    vo.setPos(1, 2, 3);
    const target = [0, 0, 0];
    expect(vo.getPos(target)).toBe(target);
    expect(Array.from(target)).toEqual([1, 2, 3]);
  });

  test('a getter writes every vertex into its target, across an interleaved buffer', () => {
    const pool = new VertexObjectPool<{
      setFoo: VOAttrSetter;
      getFoo: VOAttrGetter;
    }>(
      {
        vertexCount: 2,
        attributes: {
          foo: {components: ['x', 'y']},
          bar: {size: 3},
        },
      },
      1,
    );
    const vo = pool.createVO()!;
    vo.setFoo(new Float32Array([7, 8, 9, 10]));
    const target = new Float32Array(4);
    expect(Array.from(vo.getFoo(target))).toEqual([7, 8, 9, 10]);
  });

  test('a getter refuses a target shorter than the attribute and leaves it as it was', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 1);
    const vo = pool.createVO()!;
    const target = new Float32Array([5, 5]);
    expect(() => vo.getPos(target)).toThrow(/^getPos\(\): the target holds 2 values, attribute "pos" has 3$/);
    expect(Array.from(target)).toEqual([5, 5]);
  });

  test('a getter without a target answers a new array on every call', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 1);
    const vo = pool.createVO()!;
    vo.setPos(1, 2, 3);
    const a = vo.getPos();
    const b = vo.getPos();
    expect(a).not.toBe(b);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  test('a getter is typed to answer the target it is handed', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 1);
    const vo = pool.createVO()!;

    const target = new Float32Array(3);
    expectTypeOf(vo.getPos(target)).toEqualTypeOf(target);

    const list = [0, 0, 0];
    expectTypeOf(vo.getPos(list)).toEqualTypeOf<number[]>();
  });

  test('a setter of up to four values declares them one by one', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 1);
    const vo = pool.createVO()!;
    expect(vo.setPos.length).toBe(4);
  });

  test('a setter of up to four values leaves the values it was not given', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 1);
    const vo = pool.createVO()!;
    vo.setPos(1, 2, 3);
    vo.setPos(9);
    expect(Array.from(vo.getPos())).toEqual([9, 2, 3]);
  });

  test('a setter of up to four values ignores values beyond the attribute', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 2);
    const a = pool.createVO()!;
    const b = pool.createVO()!;
    b.setPos(7, 7, 7);
    a.setPos(1, 2, 3, 4);
    expect(Array.from(a.getPos())).toEqual([1, 2, 3]);
    expect(Array.from(b.getPos())).toEqual([7, 7, 7]);
  });

  test('a setter of up to four values writes separate values across every vertex of an interleaved buffer', () => {
    const pool = new VertexObjectPool<{
      setFoo: VOAttrSetter;
      getFoo: VOAttrGetter;
    }>(
      {
        vertexCount: 2,
        attributes: {
          foo: {components: ['x', 'y']},
          bar: {size: 3},
        },
      },
      1,
    );
    const vo = pool.createVO()!;
    vo.setFoo(7, 8, 9, 10);
    // prettier-ignore
    expect(Array.from(pool.buffer.buffers.get('static_float32')!.typedArray!)).toEqual([
      0, 0, 0, 7, 8,
      0, 0, 0, 9, 10,
    ]);
  });

  test('a setter leaves an element it is handed undefined for as it was', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 1);
    const vo = pool.createVO()!;
    vo.setPos(1, 2, 3);
    vo.setPos(4, undefined as unknown as number, 6);
    expect(Array.from(vo.getPos())).toEqual([4, 2, 6]);

    const restPool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 2, attributes: {pos: {size: 3}}}, 1);
    const restVo = restPool.createVO()!;
    restVo.setPos([1, 2, 3, 4, 5, 6]);
    restVo.setPos([9, undefined as unknown as number, 9, 9, 9, 9]);
    expect(Array.from(restVo.getPos())).toEqual([9, 2, 9, 9, 9, 9]);
  });
});
