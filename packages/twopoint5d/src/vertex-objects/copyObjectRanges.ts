import type {TypedArray as ThreeTypedArray} from 'three/webgpu';
import type {TypedArray} from './types.js';

/**
 * Copy the objects of the first `rangeCount` pairs `[from, to]` in `ranges` from `source` into
 * `target`, each object `stride` elements long, and nothing between them.
 *
 * Element by element rather than through `subarray()` and `set()`: the path runs on every frame and
 * allocates nothing. Each assignment converts the value into the element type of `target`, so an
 * `Int8Array` value of `-5` lands as `-5` in an `Int32Array`.
 */
export function copyObjectRanges(
  source: TypedArray,
  target: ThreeTypedArray,
  ranges: Int32Array,
  rangeCount: number,
  stride: number,
): void {
  for (let k = 0; k < rangeCount; k++) {
    const end = (ranges[2 * k + 1]! + 1) * stride;
    for (let e = ranges[2 * k]! * stride; e < end; e++) {
      target[e] = source[e]!;
    }
  }
}
