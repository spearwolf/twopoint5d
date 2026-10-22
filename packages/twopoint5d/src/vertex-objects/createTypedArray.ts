import type {TypedArray, VertexAttributeDataType} from './types.js';

/** The class of one of the arrays of {@link TypedArray}, as {@link typedArrayOf} answers it. */
export interface TypedArrayClass {
  new (length: number): TypedArray;
  new (buffer: ArrayBuffer): TypedArray;
  readonly BYTES_PER_ELEMENT: number;
  readonly name: string;
}

// the one place that pairs a data type with its array class
const TYPED_ARRAY_OF: Readonly<Record<VertexAttributeDataType, TypedArrayClass | undefined>> = {
  float64: Float64Array,
  float32: Float32Array,
  // read through globalThis, so that a runtime without Float16Array still loads this module and only
  // a float16 buffer fails, with a message that says why
  float16: globalThis.Float16Array,
  uint32: Uint32Array,
  int32: Int32Array,
  uint16: Uint16Array,
  int16: Int16Array,
  uint8clamped: Uint8ClampedArray,
  uint8: Uint8Array,
  int8: Int8Array,
};

/**
 * The array class of a data type. Throws for a name that is no data type — one of `Object.prototype`
 * included — and for `float16` on a runtime that has no `Float16Array`.
 */
export function typedArrayOf(dataType: VertexAttributeDataType): TypedArrayClass {
  // own entries only: a name like 'constructor' or 'toString' must not find a constructor on Object.prototype
  if (!Object.hasOwn(TYPED_ARRAY_OF, dataType)) {
    throw new Error(`typedArrayOf: unknown data type '${String(dataType)}'`);
  }
  const typedArrayClass = TYPED_ARRAY_OF[dataType];
  if (typedArrayClass === undefined) {
    throw new Error(`typedArrayOf: this runtime has no Float16Array for data type '${dataType}'`);
  }
  return typedArrayClass;
}

export function createTypedArray(dataType: VertexAttributeDataType, size: number): TypedArray {
  return new (typedArrayOf(dataType))(size);
}
