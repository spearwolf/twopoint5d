import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import type {VertexObjectBuffersData, VertexObjectDescription} from './types.js';

// one message for every method that refuses to work once the pool is gone, so the class, the
// method and the state are always in the text a caller reads out of a foreign stack
function disposedError(method: string): Error {
  return new Error(`VOBufferPool#${method} is not available: this pool has been disposed`);
}

export class VOBufferPool {
  readonly descriptor: VertexObjectDescriptor;
  readonly capacity: number;

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

  get usedCount(): number {
    return this.#usedCount;
  }

  set usedCount(value: number) {
    this.#usedCount = Math.max(0, Math.min(value, this.capacity));
  }

  get availableCount(): number {
    return this.capacity - this.#usedCount;
  }

  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * True while at least one geometry has built `THREE.BufferAttribute`s on top of
   * this pool's buffers. While this holds, {@link VertexObjectPool#resize} refuses
   * every change of capacity; only a `resize()` to the capacity the pool already
   * has still goes through, because it leaves the buffers alone.
   */
  get isAttachedToGeometry(): boolean {
    return this.#geometryAttachments > 0;
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

  clear(): void {
    this.usedCount = 0;
  }

  /**
   * Releases the underlying typed-array memory of this pool eagerly.
   *
   * In contrast to {@link clear} (which only resets `usedCount` to `0`), this
   * method drops every reference to the typed-arrays held by `pool.buffer.buffers`
   * so the underlying `ArrayBuffer`s can be reclaimed by the garbage collector
   * even if downstream `THREE.BufferAttribute`s temporarily still hold a copy of
   * the array reference. After `dispose()` the pool is **dead**: any further
   * read/write operation on its vertex objects will fail, and
   * {@link toBuffersData} and {@link fromBuffersData} throw. The method is idempotent.
   *
   * NOTE: `dispose()` does **not** automatically dispose any `THREE.BufferAttribute`s
   * that were created on top of this pool — the geometry that owns those is
   * responsible for calling its own `dispose()` (see `VOBufferGeometry`).
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.usedCount = 0;
    for (const buffer of this.buffer.buffers.values()) {
      buffer.typedArray = undefined;
    }
    this.buffer.buffers.clear();
  }

  createFromAttributes(attributes: Record<string, ArrayLike<number>>): [objectCount: number, firstObjectIndex: number] {
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
