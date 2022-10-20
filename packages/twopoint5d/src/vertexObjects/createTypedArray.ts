import {TypedArray, VertexAttributeDataType} from './types';

export function createTypedArray(dataType: VertexAttributeDataType, size: number): TypedArray {
  switch (dataType) {
    case 'float64':
      return new Float64Array(size);
    case 'float32':
      return new Float32Array(size);
    case 'float16':
      return new Uint16Array(size);
    case 'uint32':
      return new Uint32Array(size);
    case 'int32':
      return new Int32Array(size);
    case 'uint16':
      return new Uint16Array(size);
    case 'int16':
      return new Int16Array(size);
    case 'uint8':
      return new Uint8Array(size);
    case 'uint8clamped':
      return new Uint8ClampedArray(size);
    case 'int8':
      return new Int8Array(size);
    default:
      throw new Error(`unknown typed-array data-type: '${dataType}'`);
  }
}
