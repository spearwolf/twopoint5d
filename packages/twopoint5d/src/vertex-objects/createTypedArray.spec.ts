import {describe, expect, test} from 'vitest';
import {createTypedArray} from './createTypedArray.js';
import type {VertexAttributeDataType} from './types.js';

describe('createTypedArray', () => {
  test('float16 answers a Float16Array', () => {
    expect(createTypedArray('float16', 3)).toBeInstanceOf(Float16Array);
  });

  test('every data type answers its own array class', () => {
    const cases: [VertexAttributeDataType, unknown][] = [
      ['float64', Float64Array],
      ['float32', Float32Array],
      ['float16', Float16Array],
      ['uint32', Uint32Array],
      ['int32', Int32Array],
      ['uint16', Uint16Array],
      ['int16', Int16Array],
      ['uint8clamped', Uint8ClampedArray],
      ['uint8', Uint8Array],
      ['int8', Int8Array],
    ];
    for (const [dataType, ctor] of cases) {
      expect(createTypedArray(dataType, 2)).toBeInstanceOf(ctor as new (size: number) => unknown);
    }
  });

  test('an unknown data type throws', () => {
    expect(() => createTypedArray('nope' as VertexAttributeDataType, 1)).toThrow();
  });
});
