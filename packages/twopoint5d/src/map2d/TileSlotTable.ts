/**
 * What an entry of a {@link TileSlotTable} carries: its tile coordinate, and the link to the
 * next entry of its bucket, which the table alone writes.
 */
export interface TileSlotTableEntry<T> {
  x: number;
  y: number;
  nextInBucket: T | undefined;
}

/**
 * The bucket of a tile coordinate among `mask + 1` of them. Int32 arithmetic throughout —
 * `Math.imul`, `^`, `>>>` —, so no value on the way is a double that would be boxed: the
 * coordinates are mixed with the golden ratio, then run through the finalizer of MurmurHash3.
 */
function bucketOf(x: number, y: number, mask: number): number {
  let h = Math.imul(x, 0x9e3779b1) ^ y;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h & mask;
}

/**
 * The entries of a frame loop, found by their tile coordinate — the tile slots of the camera
 * based visibility, the cells of `Map2DSpatialHashGrid`: a hash table whose chains run
 * through the entries themselves, along {@link TileSlotTableEntry.nextInBucket}. Adding and
 * removing an entry changes links and nothing else, so neither boxes a key nor builds a hash
 * table again the way a `Map` does once deletions and insertions have filled it.
 *
 * The hash is a bucket index and not a key: `get()` compares `x` and `y` exactly, so two
 * coordinates that share a bucket stay apart. The only allocation is the bucket list, which
 * doubles as soon as the table holds more entries than it has buckets.
 */
export class TileSlotTable<T extends TileSlotTableEntry<T>> {
  #buckets: (T | undefined)[];
  #size = 0;

  /**
   * @param capacity - the number of buckets to start with, a power of two
   */
  constructor(capacity = 64) {
    this.#buckets = new Array<T | undefined>(capacity).fill(undefined);
  }

  /** How many entries the table holds. */
  get size(): number {
    return this.#size;
  }

  /** The entry of the tile coordinate `(x, y)`, or `undefined` if the table holds none. */
  get(x: number, y: number): T | undefined {
    let entry = this.#buckets[bucketOf(x, y, this.#buckets.length - 1)];
    while (entry !== undefined) {
      if (entry.x === x && entry.y === y) return entry;
      entry = entry.nextInBucket;
    }
    return undefined;
  }

  /**
   * Puts `entry` in under its `x` and `y`. The caller makes sure that the table holds no entry
   * of the same coordinate yet; `get()` would find only one of the two.
   */
  add(entry: T): void {
    if (this.#size >= this.#buckets.length) this.grow();
    this.link(entry);
    this.#size += 1;
  }

  /**
   * Takes out exactly `entry`, found by identity along the chain of its coordinate. An entry the
   * table does not hold leaves it as it is — one of the same coordinate included.
   */
  remove(entry: T): void {
    const buckets = this.#buckets;
    const bucket = bucketOf(entry.x, entry.y, buckets.length - 1);
    let previous: T | undefined;
    let current = buckets[bucket];
    while (current !== undefined) {
      if (current === entry) {
        if (previous === undefined) {
          buckets[bucket] = entry.nextInBucket;
        } else {
          previous.nextInBucket = entry.nextInBucket;
        }
        entry.nextInBucket = undefined;
        this.#size -= 1;
        return;
      }
      previous = current;
      current = current.nextInBucket;
    }
  }

  private link(entry: T): void {
    const buckets = this.#buckets;
    const bucket = bucketOf(entry.x, entry.y, buckets.length - 1);
    entry.nextInBucket = buckets[bucket];
    buckets[bucket] = entry;
  }

  /** Doubles the buckets and hangs every entry in again. */
  private grow(): void {
    const previous = this.#buckets;
    this.#buckets = new Array<T | undefined>(previous.length * 2).fill(undefined);
    for (let i = 0; i < previous.length; ++i) {
      // The loop bound is the length of the bucket list before it grew.
      let entry = previous[i];
      while (entry !== undefined) {
        const next = entry.nextInBucket;
        this.link(entry);
        entry = next;
      }
    }
  }
}
