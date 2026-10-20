// the runs the merge starts from: below this length an insertion sort beats the merge levels it saves
const RUN = 32;

/**
 * Orders the first `n` entries of `order` — slot numbers, each an index into `keys` — by their keys,
 * the lowest key first, and answers the array that holds the result: `order` or `scratch`, both at
 * least `n` long, whichever the last merge level wrote. Neither array is touched beyond `n`. Stable:
 * entries of equal keys keep the order they were handed in. The keys are compared with `<=` and
 * `>`, so the caller hands in no slot whose key is `NaN`.
 *
 * A bottom-up merge sort: runs of {@link RUN} slots sorted by insertion, then merged pairwise, a
 * merge skipped where the last key of the left run is no greater than the first of the right one. A
 * sorted or nearly sorted order — the common case of a sort every frame — costs one pass of
 * comparisons and the copies of the merge levels. Allocates nothing.
 */
export function sortSlots(keys: Float64Array, order: Uint32Array, scratch: Uint32Array, n: number): Uint32Array {
  for (let lo = 0; lo < n; lo += RUN) {
    const hi = Math.min(lo + RUN, n);
    for (let i = lo + 1; i < hi; i++) {
      const slot = order[i]!;
      const key = keys[slot]!;
      let j = i;
      // `>` and not `>=`: an equal key stays behind the slot before it
      while (j > lo && keys[order[j - 1]!]! > key) {
        order[j] = order[j - 1]!;
        j--;
      }
      order[j] = slot;
    }
  }

  let source = order;
  let target = scratch;
  for (let width = RUN; width < n; width *= 2) {
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width, n);
      const hi = Math.min(lo + 2 * width, n);
      if (mid >= hi || keys[source[mid - 1]!]! <= keys[source[mid]!]!) {
        for (let i = lo; i < hi; i++) target[i] = source[i]!;
        continue;
      }
      let left = lo;
      let right = mid;
      let out = lo;
      while (left < mid && right < hi) {
        // the left run wins a tie, which keeps the sort stable
        if (keys[source[right]!]! < keys[source[left]!]!) {
          target[out++] = source[right++]!;
        } else {
          target[out++] = source[left++]!;
        }
      }
      while (left < mid) target[out++] = source[left++]!;
      while (right < hi) target[out++] = source[right++]!;
    }
    const swap = source;
    source = target;
    target = swap;
  }

  return source;
}
