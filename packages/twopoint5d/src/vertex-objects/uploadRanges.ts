/**
 * The most ranges a buffer carries to the gpu per frame. Every range is a `writeBuffer()` or
 * `bufferSubData()` call of its own, per buffer and frame; eight hold an object freed in the middle
 * of a pool together with a spawn and a handful of `touchVO()` targets, without leaving the number
 * of calls a frame makes open-ended.
 */
export const MAX_UPLOAD_RANGES = 8;

/** The length of a range list: room for one pair beyond the limit, before two of them are joined. */
export const UPLOAD_RANGES_ARRAY_LENGTH = 2 * (MAX_UPLOAD_RANGES + 1);

/**
 * Put the range `from` … `to` into the list `ranges` and answer how many pairs the list holds
 * afterwards, never more than {@link MAX_UPLOAD_RANGES}.
 *
 * `ranges` holds `count` pairs `[from, to]`, both ends inclusive, at the places `2k` and `2k + 1`:
 * sorted upwards, apart from each other and not touching (`next.from > prev.to + 1`). The caller
 * guarantees `from <= to`. The new range merges with every pair it overlaps or touches, so the list
 * keeps that shape. When that leaves one pair too many, the two neighbours with the smallest gap
 * between them (`next.from - prev.to - 1`) become one — on equal gaps the lowest two.
 *
 * The same list serves object indices and element offsets alike. Allocates nothing; `ranges` is
 * at least {@link UPLOAD_RANGES_ARRAY_LENGTH} long.
 */
export function insertRange(ranges: Int32Array, count: number, from: number, to: number): number {
  // the first pair that neither lies below the new range nor ends right before it
  let first = 0;
  while (first < count && ranges[2 * first + 1]! + 1 < from) first++;

  // every pair from there on that starts no later than right after the new range merges with it
  let end = first;
  while (end < count && ranges[2 * end]! <= to + 1) end++;

  if (end > first) {
    from = Math.min(from, ranges[2 * first]!);
    to = Math.max(to, ranges[2 * (end - 1) + 1]!);
  }

  // the merged pairs give way to the one that takes their place, and the pairs above follow it.
  // Moved by hand: a list this short is done before a call into the copyWithin() builtin returns
  const shift = first + 1 - end;
  if (shift > 0) {
    for (let k = 2 * count - 1; k >= 2 * end; k--) ranges[k + 2 * shift] = ranges[k]!;
  } else if (shift < 0) {
    for (let k = 2 * end; k < 2 * count; k++) ranges[k + 2 * shift] = ranges[k]!;
  }
  ranges[2 * first] = from;
  ranges[2 * first + 1] = to;

  let newCount = count - (end - first) + 1;

  if (newCount > MAX_UPLOAD_RANGES) {
    let join = 0;
    let smallestGap = Infinity;
    for (let k = 0; k < newCount - 1; k++) {
      const gap = ranges[2 * (k + 1)]! - ranges[2 * k + 1]! - 1;
      if (gap < smallestGap) {
        smallestGap = gap;
        join = k;
      }
    }
    ranges[2 * join + 1] = ranges[2 * (join + 1) + 1]!;
    for (let k = 2 * (join + 2); k < 2 * newCount; k++) ranges[k - 2] = ranges[k]!;
    newCount--;
  }

  return newCount;
}
