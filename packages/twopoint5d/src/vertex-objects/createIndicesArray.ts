import {expectDefined} from '../utils/expectDefined.js';

/**
 * Repeats `indices` once for each of `count` objects, the indices of object `i` shifted by
 * `i × stride`.
 *
 * `stride` is the number of vertices of one object — the distance between the vertices of one
 * object and those of the next in every attribute buffer. The descriptor makes sure every
 * index lies below it.
 */
export function createIndicesArray(indices: readonly number[], count: number, stride: number): Uint32Array {
  const itemCount = indices.length;
  const arr = new Uint32Array(count * itemCount);

  for (let i = 0; i < count; i++) {
    for (let j = 0; j < itemCount; j++) {
      arr[i * itemCount + j] = expectDefined(indices[j], `index ${j}`) + i * stride;
    }
  }

  return arr;
}
