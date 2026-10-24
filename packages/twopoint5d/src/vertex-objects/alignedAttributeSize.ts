import {typedArrayOf} from './createTypedArray.js';
import type {VertexAttributeDataType} from './types.js';

/**
 * The elements an attribute of `size` values takes per vertex in a buffer of `dataType`: its size,
 * rounded up to a whole number of 4 bytes. WebGPU takes a vertex buffer only when every attribute
 * starts on a multiple of 4 bytes (for a format of 4 bytes or more) and its `arrayStride` is a
 * multiple of 4 bytes, and three gives every attribute of more than one value a format rounded up
 * to whole 4 bytes (`unorm8x4` for three bytes, `WebGPUAttributeUtils#_getVertexFormat()`, held by
 * `threeVertexLayout.spec.ts`).
 */
export function alignedAttributeSize(size: number, dataType: VertexAttributeDataType): number {
  const bytes = typedArrayOf(dataType).BYTES_PER_ELEMENT;
  return (Math.ceil((size * bytes) / 4) * 4) / bytes;
}
