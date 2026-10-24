import {truncateArray} from '../utils/truncateArray.js';

// The two heaps of the search of `CameraBasedVisibility`, ordered by the distance of a tile to the
// camera. A distance is a double, and it never crosses a call here: each heap reads it off the
// entry itself — see the note on doubles at the top of `CameraBasedVisibility.ts`.

/** What the heaps order by: the distance of an entry to the camera. */
export interface DistanceToCameraEntry {
  readonly distanceToCamera: number;
}

/**
 * A binary min-heap over `distanceToCamera`, the nearest entry on top: the frontier of the search,
 * which so runs from the camera outwards. Its list is kept across calls and emptied with
 * `truncateArray()`, so that every recomputation fills the backing store of the one before.
 */
export class NearestFirstHeap<T extends DistanceToCameraEntry> {
  readonly #heap: T[] = [];

  get length(): number {
    return this.#heap.length;
  }

  /** The nearest entry. The caller has checked that the heap is not empty. */
  peek(): T {
    return this.#heap[0]!;
  }

  /** Sift-up: the parent of the entry at `i` sits at `(i - 1) >> 1`. */
  push(entry: T): void {
    const heap = this.#heap;
    const distance = entry.distanceToCamera;
    let i = heap.length;
    heap.push(entry);
    while (i > 0) {
      const parentIndex = (i - 1) >> 1;
      // A heap of this length has an entry at every index below it.
      const parent = heap[parentIndex]!;
      if (parent.distanceToCamera <= distance) break;
      heap[i] = parent;
      i = parentIndex;
    }
    heap[i] = entry;
  }

  /** Takes the nearest entry off the heap, which the caller checked to be non-empty. */
  pop(): T {
    const heap = this.#heap;
    const nearest = heap[0]!;
    const last = heap.pop()!;
    const length = heap.length;
    if (length === 0) return nearest;

    // sift-down: the last entry drops from the top until neither child lies nearer
    const distance = last.distanceToCamera;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      if (left >= length) break;
      const right = left + 1;
      // Both indices are checked against the length of the heap.
      let child = heap[left]!;
      let childIndex = left;
      if (right < length && heap[right]!.distanceToCamera < child.distanceToCamera) {
        child = heap[right]!;
        childIndex = right;
      }
      if (child.distanceToCamera >= distance) break;
      heap[i] = child;
      i = childIndex;
    }
    heap[i] = last;
    return nearest;
  }

  /** Empties the heap and keeps its backing store. */
  clear(): void {
    truncateArray(this.#heap);
  }
}

/**
 * The entries the search keeps: in the order they came until {@link heapify}, from then on a
 * binary max-heap over `distanceToCamera`, the furthest entry on top, where a nearer one takes its
 * place. Its list is kept across calls and emptied with `truncateArray()`.
 */
export class KeptTiles<T extends DistanceToCameraEntry> {
  readonly #entries: T[] = [];
  #isHeap = false;

  get length(): number {
    return this.#entries.length;
  }

  /** The entry at `index`, which lies below {@link length}. */
  at(index: number): T {
    return this.#entries[index]!;
  }

  /** The furthest entry, the top of the heap; only after {@link heapify}, on a list of one at least. */
  get furthest(): T {
    return this.#entries[0]!;
  }

  /** Puts `entry` at the end of the list; only before {@link heapify}. */
  add(entry: T): void {
    this.#entries.push(entry);
  }

  /** Makes the list a max-heap, bottom-up. */
  heapify(): void {
    const entries = this.#entries;
    for (let i = (entries.length >> 1) - 1; i >= 0; --i) {
      // The index runs down from the last entry that has a child.
      this.#siftDown(i, entries[i]!, entries.length);
    }
    this.#isHeap = true;
  }

  /** Puts `entry` in the place of the furthest entry of the heap, which it drops. */
  replaceFurthest(entry: T): void {
    this.#siftDown(0, entry, this.#entries.length);
  }

  /**
   * Puts the entries in order of their distance, nearest first, without a comparator:
   * `Array#sort()` calls one per comparison, boxes each answer, and builds a working array.
   * Afterwards the list is no heap.
   */
  sortNearestFirst(): void {
    const entries = this.#entries;

    if (!this.#isHeap) {
      // Never made a heap: the list holds the tiles in the order the search took them, which is
      // by distance, but for a tile a neighbour reached late — at most a tile diagonal nearer than
      // the tile it was found from. Nearly sorted, so an insertion sort runs in close to linear
      // time; it moves a tile only past one further out, and keeps equal distances in the order
      // they came.
      for (let i = 1; i < entries.length; ++i) {
        // The loop bound is `entries.length`, and `j - 1` stays at 0 or above.
        const entry = entries[i]!;
        const distance = entry.distanceToCamera;
        let j = i;
        while (j > 0 && entries[j - 1]!.distanceToCamera > distance) {
          entries[j] = entries[j - 1]!;
          --j;
        }
        entries[j] = entry;
      }
      return;
    }

    // A max-heap since `heapify()`: heapsort in place, the furthest of the heap to the back of it,
    // one after the other.
    for (let end = entries.length - 1; end > 0; --end) {
      // The index runs down from the last entry.
      const last = entries[end]!;
      entries[end] = entries[0]!;
      this.#siftDown(0, last, end);
    }
    this.#isHeap = false;
  }

  /** Empties the list and keeps its backing store; the next pass starts as a list again. */
  clear(): void {
    truncateArray(this.#entries);
    this.#isHeap = false;
  }

  /**
   * Puts `entry` at `start` of the heap and lets it drop until neither child lies further out. The
   * heap is the first `length` entries of the list — all of them, but for the heapsort.
   */
  #siftDown(start: number, entry: T, length: number): void {
    const entries = this.#entries;
    const distance = entry.distanceToCamera;
    let i = start;
    for (;;) {
      const left = 2 * i + 1;
      if (left >= length) break;
      const right = left + 1;
      // Both indices are checked against the length of the heap.
      let child = entries[left]!;
      let childIndex = left;
      if (right < length && entries[right]!.distanceToCamera > child.distanceToCamera) {
        child = entries[right]!;
        childIndex = right;
      }
      if (child.distanceToCamera <= distance) break;
      entries[i] = child;
      i = childIndex;
    }
    entries[i] = entry;
  }
}
