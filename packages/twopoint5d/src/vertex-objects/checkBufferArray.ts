import {typedArrayOf} from './createTypedArray.js';
import type {VertexAttributeDataType} from './types.js';

function describeArray(array: unknown): string {
  if (ArrayBuffer.isView(array)) {
    return Object.prototype.toString.call(array).slice(8, -1);
  }
  if (Array.isArray(array)) return 'Array';
  return array === null ? 'null' : typeof array;
}

/**
 * Checks an array handed in as buffers data against the buffer it is meant for.
 *
 * The array has to be the typed array of the buffer's data type — a `Float32Array` for a
 * `float32` buffer, and so on — or a `TypeError` is thrown. Its length is held against
 * `layoutLength` (capacity × vertexCount × itemSize): `'exact'` asks for that length and no
 * other, `'at-most'` takes any array that is not longer. A length outside the rule throws a
 * `RangeError`. Both messages name `owner`, the buffer and what was received.
 */
export function checkBufferArray(
  owner: string,
  bufferName: string,
  array: unknown,
  dataType: VertexAttributeDataType,
  layoutLength: number,
  lengthRule: 'exact' | 'at-most',
): void {
  const expected = typedArrayOf(dataType).name;
  // compared by name, not by instanceof: an array that comes from a worker or another realm is
  // built by a constructor of its own and would fail an instanceof against this one
  const actual = describeArray(array);
  if (actual !== expected) {
    throw new TypeError(`${owner}: buffer "${bufferName}" holds ${dataType} data and takes a ${expected}, got ${actual}`);
  }

  const {length} = array as ArrayLike<number>;
  if (lengthRule === 'exact' ? length !== layoutLength : length > layoutLength) {
    throw new RangeError(
      `${owner}: buffer "${bufferName}" takes ${lengthRule === 'exact' ? 'exactly' : 'at most'} ${layoutLength} elements (capacity × vertexCount × itemSize), got ${length}`,
    );
  }
}
