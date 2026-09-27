import {expectDefined} from '../utils/expectDefined.js';

/**
 * Repeats `indices` once for each of `count` objects, the indices of object `i` shifted by
 * `i × stride`.
 *
 * `stride` is the number of vertices of one object — the distance between the vertices of one
 * object and those of the next in every attribute buffer. The descriptor makes sure every
 * index lies below it.
 *
 * An array of indices with a hole throws, naming the index it misses, before the first element
 * is written.
 */
export function createIndicesArray(indices: readonly number[], count: number, stride: number): Uint32Array {
  // each index is checked once here rather than once per object in the loop below
  const local = Uint32Array.from(indices, (index, j) => expectDefined(index, `index ${j}`));
  const itemCount = local.length;
  const arr = new Uint32Array(count * itemCount);

  for (let i = 0; i < count; i++) {
    for (let j = 0; j < itemCount; j++) {
      // j runs below itemCount, the length of local
      arr[i * itemCount + j] = local[j]! + i * stride;
    }
  }

  return arr;
}
