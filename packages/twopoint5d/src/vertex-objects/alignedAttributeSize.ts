import type {VertexAttributeDataType} from './types.js';

const BYTES_PER_ELEMENT: Record<VertexAttributeDataType, number> = {
  float64: 8,
  float32: 4,
  float16: 2,
  uint32: 4,
  int32: 4,
  uint16: 2,
  int16: 2,
  uint8clamped: 1,
  uint8: 1,
  int8: 1,
};

/**
 * The elements an attribute of `size` values takes per vertex in a buffer of `dataType`: its size,
 * rounded up to a whole number of 4 bytes. WebGPU takes a vertex buffer only when every attribute
 * starts on a multiple of 4 bytes (for a format of 4 bytes or more) and its `arrayStride` is a
 * multiple of 4 bytes, and three 0.186.1 gives every attribute of more than one value a format
 * rounded up to whole 4 bytes (`unorm8x4` for three bytes, `WebGPUAttributeUtils.js:529–539`).
 */
export function alignedAttributeSize(size: number, dataType: VertexAttributeDataType): number {
  const bytes = BYTES_PER_ELEMENT[dataType];
  return (Math.ceil((size * bytes) / 4) * 4) / bytes;
}
