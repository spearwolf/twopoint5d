import {describe, expect, test} from 'vitest';
import {VertexObjectPool} from './VertexObjectPool.js';

describe('the generated attribute accessors', () => {
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
});
