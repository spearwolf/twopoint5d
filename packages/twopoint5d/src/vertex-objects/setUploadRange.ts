import type {BufferLike} from './types.js';

/**
 * Give `bufAttr` the upload range that carries the objects `fromIdx` … `toIdx`: each of them
 * occupies `vertexCount` vertices of `itemSize` elements. A range that names no object leaves
 * the attribute with a count of 0.
 *
 * A range still standing on the attribute is taken into the new one rather than replaced. three
 * takes the ranges of a buffer up as it uploads it and leaves none behind, so whatever is still
 * there has not reached the gpu — while the serial behind it already counts as seen, and nothing
 * would name those objects a second time. Two `update()` calls without a render in between
 * therefore widen the range once; the upload that follows empties it, and the next range is as
 * narrow as what was written.
 */
export function setUploadRange(bufAttr: BufferLike, fromIdx: number, toIdx: number, vertexCount: number, itemSize: number): void {
  let start = fromIdx * vertexCount * itemSize;
  let count = Math.max(0, toIdx - fromIdx + 1) * vertexCount * itemSize;

  for (const pending of bufAttr.updateRanges) {
    // a range of no elements names no object and widens nothing
    if (pending.count === 0) continue;

    if (count === 0) {
      start = pending.start;
      count = pending.count;
    } else {
      const end = Math.max(start + count, pending.start + pending.count);
      start = Math.min(start, pending.start);
      count = end - start;
    }
  }

  const current = bufAttr.updateRanges[0];
  if (bufAttr.updateRanges.length !== 1 || current?.start !== start || current?.count !== count) {
    bufAttr.clearUpdateRanges();
    bufAttr.addUpdateRange(start, count);
  }
}
