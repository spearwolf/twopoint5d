import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import type {VertexObjectBuffersData, VertexObjectDescription} from './types.js';

// one message for every method that refuses to work once the pool is gone, so the class, the
// method and the state are always in the text a caller reads out of a foreign stack
function disposedError(method: string): Error {
  return new Error(`VOBufferPool#${method} is not available: this pool has been disposed`);
}

export class VOBufferPool {
  /** What this pool is built from; it goes on saying so once {@link dispose} has run. */
  readonly descriptor: VertexObjectDescriptor;

  /** How many vertex objects this pool was sized for; it goes on saying so once {@link dispose} has run. */
  readonly capacity: number;

  /**
   * The buffer every vertex object of this pool reads and writes through.
   *
   * The same {@link VertexObjectBuffer} once {@link dispose} has run, but one without data: it
   * holds no `typedArray` and no entry in `buffers` any more, and every method of it that would
   * read or write through an array throws.
   */
  buffer: VertexObjectBuffer;

  #usedCount = 0;
  #disposed = false;
  #geometryAttachments = 0;

  constructor(descriptor: VertexObjectDescriptor | VertexObjectDescription, capacityOrData: number | VertexObjectBuffersData) {
    this.descriptor = descriptor instanceof VertexObjectDescriptor ? descriptor : new VertexObjectDescriptor(descriptor);
    if (typeof capacityOrData === 'number') {
      const capacity = capacityOrData;
      this.capacity = capacity;
      this.buffer = new VertexObjectBuffer(this.descriptor, capacity);
    } else {
      const buffersData = capacityOrData;
      this.capacity = buffersData.capacity;
      // the buffer is built from the given data rather than sized from a capacity
      this.buffer = new VertexObjectBuffer(this.descriptor, buffersData);
      this.usedCount = buffersData.usedCount;
    }
  }

  /** How many slots of this pool are taken; `0` once {@link dispose} has run, which resets the count itself. */
  get usedCount(): number {
    return this.#usedCount;
  }

  /**
   * Takes every value, on a disposed pool as well — {@link dispose} writes through this setter
   * itself. A value written there buys nothing: the pool has no buffers left, and
   * {@link VertexObjectPool#createVO} and {@link VertexObjectPool#getVO} answer `undefined`
   * whatever it says.
   */
  set usedCount(value: number) {
    this.#usedCount = Math.max(0, Math.min(value, this.capacity));
  }

  /**
   * How many vertex objects this pool can still hand out.
   *
   * `0` once {@link dispose} has run: a disposed pool has no slot left to give, and
   * {@link VertexObjectPool#createVO} answers `undefined` for every one of them.
   */
  get availableCount(): number {
    return this.#disposed ? 0 : this.capacity - this.#usedCount;
  }

  /** `true` once {@link dispose} has run; a pool never comes back to life. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * True while at least one geometry has built `THREE.BufferAttribute`s on top of this
   * pool's buffers. While this holds, {@link VertexObjectPool#resize} refuses every change
   * of capacity; only a `resize()` to the capacity the pool already has still goes through,
   * because it leaves the buffers alone.
   *
   * `false` once {@link dispose} has run: a disposed pool has no buffers left for a geometry
   * to read, whether or not one still holds it. The bookkeeping underneath is left as it is,
   * so a geometry that gives the pool up afterwards still counts down correctly.
   */
  get isAttachedToGeometry(): boolean {
    return !this.#disposed && this.#geometryAttachments > 0;
  }

  /** @internal */
  attachGeometry(): void {
    this.#geometryAttachments++;
  }

  /** @internal */
  detachGeometry(): void {
    if (this.#geometryAttachments > 0) {
      this.#geometryAttachments--;
    }
  }

  /**
   * Resets `usedCount` to `0` and releases nothing. On a disposed pool it is a no-op without
   * effect — the count is already `0` and stays there.
   */
  clear(): void {
    this.usedCount = 0;
  }

  /**
   * Releases the underlying typed-array memory of this pool eagerly.
   *
   * In contrast to {@link clear} (which only resets `usedCount` to `0`), this
   * method has `pool.buffer` give up every typed array it holds and empty its buffer map,
   * so the underlying `ArrayBuffer`s can be reclaimed by the garbage collector
   * even if downstream `THREE.BufferAttribute`s temporarily still hold a copy of
   * the array reference. After `dispose()` the pool is **dead**: any further
   * read/write operation on its vertex objects will fail, {@link createFromAttributes},
   * {@link toBuffersData} and {@link fromBuffersData} throw, {@link availableCount} is `0`,
   * and on a {@link VertexObjectPool} `createVO()` answers `undefined` while `resize()`
   * throws. The method is idempotent.
   *
   * NOTE: `dispose()` does **not** automatically dispose any `THREE.BufferAttribute`s
   * that were created on top of this pool — the geometry that owns those is
   * responsible for calling its own `dispose()` (see `VOBufferGeometry`).
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.usedCount = 0;
    this.buffer.release();
  }

  /**
   * Fills the next free slots of this pool from the given attribute arrays and answers how
   * many vertex objects were written and where the first of them sits. An attribute name the
   * descriptor does not know is skipped, and the copy stops at the capacity of the pool.
   *
   * Throws on a disposed pool, which has no slot to write into: an object count of `0` is
   * what a live pool answers when it is full or when it was handed nothing, so a caller
   * could not tell a spent pool from either of them.
   */
  createFromAttributes(attributes: Record<string, ArrayLike<number>>): [objectCount: number, firstObjectIndex: number] {
    if (this.#disposed) {
      throw disposedError('createFromAttributes()');
    }
    const firstObjectIndex = this.#usedCount;
    const objectCount = this.buffer.copyAttributes(attributes, firstObjectIndex);
    this.usedCount += objectCount;
    return [objectCount, firstObjectIndex];
  }

  /**
   * Snapshot of the buffers this pool holds, for transfer or for handing to a second pool.
   *
   * Throws on a disposed pool: the return type promises the buffers of a live pool, and an
   * empty snapshot would read like an untouched pool rather than a spent one.
   */
  toBuffersData(): VertexObjectBuffersData {
    if (this.#disposed) {
      throw disposedError('toBuffersData()');
    }
    return {
      capacity: this.capacity,
      usedCount: this.usedCount,
      buffers: Object.fromEntries(
        // a buffer still in this map holds its array; `dispose()` empties the map in the same breath
        Array.from(this.buffer.buffers.values()).map((buffer) => [buffer.bufferName, buffer.typedArray!]),
      ),
    };
  }

  /**
   * NOTE: The capacity should be the same as the original pool.
   *
   * Throws on a disposed pool, which has no capacity left to serve: the method turns away a
   * mismatched capacity as it is, and a silent no-op here would let a caller believe the data
   * arrived.
   *
   * @param copyTypedArrays By default, the typed-array references are simply shared (zero-copy) if possible.
   *                        But if `copyTypedArrays` is set to `true` or the typed-array from the input is smaller
   *                        than the current array from the buffer then the data is copied.
   */
  fromBuffersData(buffersData: VertexObjectBuffersData, copyTypedArrays = false): void {
    if (this.#disposed) {
      throw disposedError('fromBuffersData()');
    }
    if (buffersData.capacity !== this.capacity) {
      throw new Error('Invalid buffersData capacity');
    }
    this.usedCount = buffersData.usedCount;
    for (const [bufferName, typedArray] of Object.entries(buffersData.buffers)) {
      const buffer = this.buffer.buffers.get(bufferName);
      if (buffer) {
        if (copyTypedArrays || typedArray.length < buffer.typedArray!.length) {
          buffer.typedArray!.set(typedArray);
        } else {
          buffer.typedArray = typedArray;
        }
        buffer.serial++;
      }
    }
  }
}
