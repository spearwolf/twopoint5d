import {describe, expect, test, vi} from 'vitest';
import {createTypedArray, typedArrayOf} from './createTypedArray.js';
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

  test('an unknown data type throws, naming it in double quotes', () => {
    expect(() => createTypedArray('nope' as VertexAttributeDataType, 1)).toThrow('typedArrayOf: unknown data type "nope"');
  });

  test('typedArrayOf() answers the class of every data type, with its name and its bytes per element', () => {
    const cases: [VertexAttributeDataType, unknown, string, number][] = [
      ['float64', Float64Array, 'Float64Array', 8],
      ['float32', Float32Array, 'Float32Array', 4],
      ['float16', Float16Array, 'Float16Array', 2],
      ['uint32', Uint32Array, 'Uint32Array', 4],
      ['int32', Int32Array, 'Int32Array', 4],
      ['uint16', Uint16Array, 'Uint16Array', 2],
      ['int16', Int16Array, 'Int16Array', 2],
      ['uint8clamped', Uint8ClampedArray, 'Uint8ClampedArray', 1],
      ['uint8', Uint8Array, 'Uint8Array', 1],
      ['int8', Int8Array, 'Int8Array', 1],
    ];
    for (const [dataType, ctor, name, bytes] of cases) {
      const typedArrayClass = typedArrayOf(dataType);
      expect(typedArrayClass, dataType).toBe(ctor);
      expect(typedArrayClass.name).toBe(name);
      expect(typedArrayClass.BYTES_PER_ELEMENT).toBe(bytes);
    }
  });

  test('typedArrayOf() finds no class for a name of Object.prototype', () => {
    for (const name of ['constructor', 'toString']) {
      expect(() => typedArrayOf(name as VertexAttributeDataType), name).toThrow('unknown data type');
    }
  });

  test('the module loads without Float16Array, and only float16 is refused', async () => {
    vi.resetModules();
    vi.stubGlobal('Float16Array', undefined);
    try {
      const {typedArrayOf: withoutFloat16} = await import('./createTypedArray.js');
      expect(() => withoutFloat16('float16')).toThrow('typedArrayOf: this runtime has no Float16Array for data type "float16"');
      expect(withoutFloat16('float32')).toBe(Float32Array);
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});
