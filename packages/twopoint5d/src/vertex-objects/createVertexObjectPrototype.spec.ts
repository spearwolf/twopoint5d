import {describe, expect, expectTypeOf, test, vi} from 'vitest';
import {createTypedArray} from './createTypedArray.js';
import type {VertexObjectDescription, VOAttrGetter, VOAttrSetter} from './types.js';
import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
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
    // biome-ignore format: the line breaks lay the numbers out row by row
    expect(Array.from(pool.buffer.buffers.get('static_float32')!.typedArray!)).toEqual([
      0, 0, 0, 7, 8,
      0, 0, 0, 9, 10,
    ]);
  });

  test('a float16 attribute keeps the fraction of a half float', () => {
    const pool = new VertexObjectPool<{v: number; w: number}>(
      {vertexCount: 1, attributes: {half: {components: ['v', 'w'], type: 'float16'}}},
      1,
    );
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
    // biome-ignore format: the line breaks lay the numbers out row by row
    expect(Array.from(pool.buffer.buffers.get('static_float32')!.typedArray!)).toEqual([
      0, 0, 0, 7, 8,
      0, 0, 0, 9, 10,
    ]);
  });

  test('a setter of five to sixteen values declares sixteen parameters', () => {
    const pool = new VertexObjectPool<{setFoo: VOAttrSetter}>(
      {vertexCount: 4, attributes: {foo: {components: ['x', 'y', 'z']}, bar: {size: 3}}},
      1,
    );
    const vo = pool.createVO()!;
    expect(vo.setFoo.length).toBe(16);
  });

  test('a setter of five to sixteen values leaves the values it was not given', () => {
    const pool = new VertexObjectPool<{
      setFoo: VOAttrSetter;
      getFoo: VOAttrGetter;
    }>({vertexCount: 4, attributes: {foo: {components: ['x', 'y', 'z']}, bar: {size: 3}}}, 1);
    const vo = pool.createVO()!;
    vo.setFoo(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
    vo.setFoo(9);
    expect(Array.from(vo.getFoo())).toEqual([9, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test('a setter of five to sixteen values ignores values beyond the attribute', () => {
    const pool = new VertexObjectPool<{
      setFoo: VOAttrSetter;
      getFoo: VOAttrGetter;
    }>({vertexCount: 4, attributes: {foo: {components: ['x', 'y', 'z']}, bar: {size: 3}}}, 2);
    const a = pool.createVO()!;
    const b = pool.createVO()!;
    b.setFoo(7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7);
    // a thirteenth value lies where the first value of the next object starts
    a.setFoo(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);
    expect(Array.from(a.getFoo())).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(Array.from(b.getFoo())).toEqual([7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7]);
  });

  test('a setter of five to sixteen values writes separate values across every vertex of an interleaved buffer', () => {
    const pool = new VertexObjectPool<{
      setFoo: VOAttrSetter;
      getFoo: VOAttrGetter;
    }>(
      {
        vertexCount: 4,
        attributes: {
          foo: {components: ['x', 'y', 'z']},
          bar: {size: 3},
        },
      },
      1,
    );
    const vo = pool.createVO()!;
    vo.setFoo(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
    // biome-ignore format: the line breaks lay the numbers out row by row
    expect(Array.from(pool.buffer.buffers.get('static_float32')!.typedArray!)).toEqual([
      0, 0, 0, 1, 2, 3,
      0, 0, 0, 4, 5, 6,
      0, 0, 0, 7, 8, 9,
      0, 0, 0, 10, 11, 12,
    ]);
  });

  test('a setter of more than sixteen values reads separate values and an array-like alike', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 6, attributes: {pos: {size: 3}}}, 2);
    const a = pool.createVO()!;
    const b = pool.createVO()!;
    const values = Array.from({length: 18}, (_, k) => k + 1);
    a.setPos(...values);
    b.setPos(Float32Array.from({length: 18}, (_, k) => k + 1));
    expect(Array.from(a.getPos())).toEqual(values);
    expect(Array.from(b.getPos())).toEqual(values);

    a.setPos(9);
    expect(Array.from(a.getPos())).toEqual([9, ...values.slice(1)]);
  });

  test('a setter of more than sixteen values ignores values beyond the attribute', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 6, attributes: {pos: {size: 3}}}, 2);
    const a = pool.createVO()!;
    const b = pool.createVO()!;
    const sevens = Array.from({length: 18}, () => 7);
    b.setPos(...sevens);
    // a nineteenth value lies where the first value of the next object starts
    a.setPos(...Array.from({length: 19}, (_, k) => k + 1));
    expect(Array.from(a.getPos())).toEqual(Array.from({length: 18}, (_, k) => k + 1));
    expect(Array.from(b.getPos())).toEqual(sevens);
  });

  test('a setter of more than sixteen values writes separate values across every vertex of an interleaved buffer', () => {
    const pool = new VertexObjectPool<{
      setFoo: VOAttrSetter;
      getFoo: VOAttrGetter;
    }>(
      {
        vertexCount: 6,
        attributes: {
          foo: {components: ['x', 'y', 'z']},
          bar: {size: 3},
        },
      },
      1,
    );
    const vo = pool.createVO()!;
    vo.setFoo(...Array.from({length: 18}, (_, k) => k + 1));
    // biome-ignore format: the line breaks lay the numbers out row by row
    expect(Array.from(pool.buffer.buffers.get('static_float32')!.typedArray!)).toEqual([
      0, 0, 0, 1, 2, 3,
      0, 0, 0, 4, 5, 6,
      0, 0, 0, 7, 8, 9,
      0, 0, 0, 10, 11, 12,
      0, 0, 0, 13, 14, 15,
      0, 0, 0, 16, 17, 18,
    ]);
  });

  test('a setter of more than sixteen values handed a single undefined writes nothing', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 6, attributes: {pos: {size: 3}}}, 1);
    const vo = pool.createVO()!;
    const values = Array.from({length: 18}, (_, k) => k + 1);
    vo.setPos(...values);
    expect(() => vo.setPos(undefined as unknown as number)).not.toThrow();
    expect(Array.from(vo.getPos())).toEqual(values);
  });

  test('a setter of up to four values leaves a value it is handed null for as it was', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 1);
    const vo = pool.createVO()!;
    vo.setPos(1, 2, 3);
    vo.setPos(4, null as unknown as number, 6);
    expect(Array.from(vo.getPos())).toEqual([4, 2, 6]);
    vo.setPos(null as unknown as number);
    expect(Array.from(vo.getPos())).toEqual([4, 2, 6]);
  });

  test('a setter of five to sixteen values leaves a value it is handed null for as it was', () => {
    const pool = new VertexObjectPool<{
      setFoo: VOAttrSetter;
      getFoo: VOAttrGetter;
    }>({vertexCount: 4, attributes: {foo: {components: ['x', 'y', 'z']}, bar: {size: 3}}}, 1);
    const vo = pool.createVO()!;
    vo.setFoo(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
    vo.setFoo(9, null as unknown as number, 9);
    expect(Array.from(vo.getFoo())).toEqual([9, 2, 9, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    vo.setFoo(null as unknown as number);
    expect(Array.from(vo.getFoo())).toEqual([9, 2, 9, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test('a setter of more than sixteen values handed a single null writes nothing', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 6, attributes: {pos: {size: 3}}}, 1);
    const vo = pool.createVO()!;
    const values = Array.from({length: 18}, (_, k) => k + 1);
    vo.setPos(...values);
    expect(() => vo.setPos(null as unknown as number)).not.toThrow();
    expect(Array.from(vo.getPos())).toEqual(values);
  });

  test('a setter leaves an element of an array-like it is handed null for as it was', () => {
    const pool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}, 1);
    const vo = pool.createVO()!;
    vo.setPos(1, 2, 3);
    vo.setPos([9, null as unknown as number, 9]);
    expect(Array.from(vo.getPos())).toEqual([9, 2, 9]);

    const restPool = new VertexObjectPool<{
      setPos: VOAttrSetter;
      getPos: VOAttrGetter;
    }>({vertexCount: 2, attributes: {pos: {size: 3}}}, 1);
    const restVo = restPool.createVO()!;
    restVo.setPos([1, 2, 3, 4, 5, 6]);
    restVo.setPos([9, null as unknown as number, 9, 9, 9, 9]);
    expect(Array.from(restVo.getPos())).toEqual([9, 2, 9, 9, 9, 9]);
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

describe('how the generated accessors reach their buffer', () => {
  interface SpriteVO {
    x: number;
    y: number;
    z: number;
    rotation: number;
    setPosition(x: number, y: number, z: number): void;
    getPosition(target?: Float32Array): Float32Array;
  }

  interface QuadVO {
    x0: number;
    setPosition(values: ArrayLike<number>): void;
  }

  const spriteDescription: VertexObjectDescription = {
    vertexCount: 1,
    attributes: {
      position: {components: ['x', 'y', 'z'], usage: 'dynamic'},
      color: {components: ['r', 'g', 'b', 'a']},
      rotation: {size: 1, usage: 'dynamic'},
    },
  };

  const quadDescription: VertexObjectDescription = {
    vertexCount: 4,
    attributes: {position: {components: ['x', 'y', 'z']}},
    indices: [0, 1, 2, 0, 2, 3],
  };

  test('the generated accessors reach their typed array without the buffers getter', () => {
    const pool = new VertexObjectPool<SpriteVO>(spriteDescription, 2);
    const vo = pool.createVO()!;
    const quadPool = new VertexObjectPool<QuadVO>(quadDescription, 2);
    const quad = quadPool.createVO()!;
    const target = new Float32Array(3);

    const buffersGetter = vi.spyOn(VertexObjectBuffer.prototype, 'buffers', 'get');

    vo.x = 1;
    expect(vo.x).toBe(1);
    vo.setPosition(1, 2, 3);
    vo.getPosition(target);
    expect(Array.from(vo.getPosition())).toEqual([1, 2, 3]);
    quad.x0 = 4;
    quad.setPosition(new Float32Array(12));

    expect(buffersGetter).not.toHaveBeenCalled();
    expect(Array.from(target)).toEqual([1, 2, 3]);

    pool.dispose();
    quadPool.dispose();
  });

  test('a typed array put in through setTypedArray() is the one the accessors read and write', () => {
    const pool = new VertexObjectPool<SpriteVO>(spriteDescription, 2);
    const vo = pool.createVO()!;
    const {bufferName} = pool.buffer.bufferAttributes.get('position')!;
    const {dataType, typedArray} = pool.buffer.buffers.get(bufferName)!;
    const next = createTypedArray(dataType, typedArray!.length);
    const {offset} = pool.buffer.bufferAttributes.get('position')!;
    next[offset] = 5;

    pool.buffer.setTypedArray(bufferName, next);

    expect(vo.x).toBe(5);
    vo.x = 7;
    expect(next[offset]).toBe(7);

    pool.dispose();
  });

  test('every buffer built from one descriptor lists its records in the same order', () => {
    const descriptor = new VertexObjectDescriptor(spriteDescription);
    const first = new VertexObjectBuffer(descriptor, 2);
    const clone = first.clone();
    const wider = new VertexObjectBuffer(descriptor, 5);

    for (const buffer of [first, clone, wider]) {
      expect(buffer.bufferList.map((b) => b.bufferName)).toEqual([...buffer.buffers.keys()]);
      expect(buffer.bufferList.map((b) => b.bufferName)).toEqual(first.bufferList.map((b) => b.bufferName));
    }

    const pool = new VertexObjectPool<SpriteVO>(descriptor, 2);
    const vo = pool.createVO()!;
    vo.setPosition(1, 2, 3);
    vo.rotation = 4;

    pool.resize(8);

    expect(Array.from(vo.getPosition())).toEqual([1, 2, 3]);
    expect(vo.rotation).toBe(4);
    vo.x = 9;
    vo.rotation = 10;
    const {bufferName, offset} = pool.buffer.bufferAttributes.get('position')!;
    expect(pool.buffer.buffers.get(bufferName)!.typedArray![offset]).toBe(9);
    const rotation = pool.buffer.bufferAttributes.get('rotation')!;
    expect(pool.buffer.buffers.get(rotation.bufferName)!.typedArray![rotation.offset]).toBe(10);

    pool.dispose();
  });

  test('a released buffer lists no records', () => {
    const pool = new VertexObjectPool<SpriteVO>(spriteDescription, 2);
    const {buffer} = pool;

    pool.dispose();

    expect(buffer.bufferList.length).toBe(0);
  });
});
