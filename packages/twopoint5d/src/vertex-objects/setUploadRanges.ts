import type {BufferLike} from './types.js';
import {insertRange, UPLOAD_RANGES_ARRAY_LENGTH} from './uploadRanges.js';

// read once into a constant of this module, so the loops below never touch an imported binding: a
// module runner that rewrites imports, as the one Vitest runs specs and benches in does, turns every
// read of one into a property read on a module object
const insert: typeof insertRange = insertRange;

// the element ranges one call works on; the calls come one after the other, so one list serves all
const scratch = new Int32Array(UPLOAD_RANGES_ARRAY_LENGTH);

// the standing ranges as pairs [start, count], read once. The result never holds more pairs than
// fit here, so a list that holds more than that cannot be the result anyway
const standingScratch = new Int32Array(UPLOAD_RANGES_ARRAY_LENGTH);
const standingCapacity = UPLOAD_RANGES_ARRAY_LENGTH / 2;

/**
 * Give `bufAttr` the upload ranges that carry the objects of the first `rangeCount` pairs
 * `[from, to]` in `ranges`: each object occupies `vertexCount` vertices of `itemSize` elements.
 * No range names zero elements, and with nothing to carry the attribute is left as it is.
 *
 * The ranges still standing on the attribute are taken into the new ones rather than replaced —
 * the attribute carries the union of both. three takes the ranges of a buffer up as it uploads it
 * and leaves none behind, so whatever is still there has not reached the gpu — while the serial
 * behind it already counts as seen, and nothing would name those objects a second time. Two
 * `update()` calls without a render in between therefore carry what both of them named; the
 * upload that follows empties the list, and the next ranges are as narrow as what was written.
 */
export function setUploadRanges(
  bufAttr: BufferLike,
  ranges: Int32Array,
  rangeCount: number,
  vertexCount: number,
  itemSize: number,
): void {
  const stride = vertexCount * itemSize;
  const standing = bufAttr.updateRanges;
  const standingCount = standing.length;

  // every standing range is read once, and each value goes through `| 0`: three builds its update
  // ranges and the draw range of a geometry from the same object literal `{start, count}`, and the
  // draw range starts with a count of Infinity. `count` is therefore a field of doubles, and every
  // read of it the optimizing compiler has not taken over puts a fresh number on the heap
  let count = 0;
  for (let i = 0; i < standingCount; i++) {
    const range = standing[i]!;
    const start = range.start | 0;
    const elements = range.count | 0;
    if (i < standingCapacity) {
      standingScratch[2 * i] = start;
      standingScratch[2 * i + 1] = elements;
    }
    // a range of no elements names no object and carries nothing
    if (elements > 0) {
      count = insert(scratch, count, start, start + elements - 1);
    }
  }
  for (let k = 0; k < rangeCount; k++) {
    count = insert(scratch, count, ranges[2 * k]! * stride, (ranges[2 * k + 1]! + 1) * stride - 1);
  }

  if (count === 0) return;

  if (count === standingCount) {
    let same = true;
    for (let k = 0; k < count; k++) {
      if (standingScratch[2 * k] !== scratch[2 * k] || standingScratch[2 * k + 1] !== scratch[2 * k + 1]! - scratch[2 * k]! + 1) {
        same = false;
        break;
      }
    }
    if (same) return;
  }

  bufAttr.clearUpdateRanges();
  for (let k = 0; k < count; k++) {
    bufAttr.addUpdateRange(scratch[2 * k]!, scratch[2 * k + 1]! - scratch[2 * k]! + 1);
  }
}
