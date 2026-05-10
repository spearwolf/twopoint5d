import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import type {TypedArray, VertexObjectBuffersData, VertexObjectDescription} from './types.js';

export class VOBufferPool {
  readonly descriptor: VertexObjectDescriptor;
  readonly capacity: number;

  buffer: VertexObjectBuffer;

  #usedCount = 0;
  #disposed = false;

  constructor(descriptor: VertexObjectDescriptor | VertexObjectDescription, capacityOrData: number | VertexObjectBuffersData) {
    this.descriptor = descriptor instanceof VertexObjectDescriptor ? descriptor : new VertexObjectDescriptor(descriptor);
    if (typeof capacityOrData === 'number') {
      const capacity = capacityOrData;
      this.capacity = capacity;
      this.buffer = new VertexObjectBuffer(this.descriptor, capacity);
    } else {
      const buffersData = capacityOrData;
      this.capacity = buffersData.capacity;
      this.fromBuffersData(buffersData);
    }
  }

  get usedCount(): number {
    return this.#usedCount;
  }

  set usedCount(value: number) {
    this.#usedCount = value < this.capacity ? value : this.capacity;
  }

  get availableCount(): number {
    return this.capacity - this.#usedCount;
  }

  get isDisposed(): boolean {
    return this.#disposed;
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
   * read/write operation on its vertex objects will fail. The method is idempotent.
   *
   * NOTE: `dispose()` does **not** automatically dispose any `THREE.BufferAttribute`s
   * that were created on top of this pool — the geometry that owns those is
   * responsible for calling its own `dispose()` (see `VOBufferGeometry`).
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#usedCount = 0;
    if (this.buffer != null) {
      for (const buffer of this.buffer.buffers.values()) {
        buffer.typedArray = undefined as unknown as TypedArray;
      }
      this.buffer.buffers.clear();
    }
  }

  createFromAttributes(attributes: Record<string, ArrayLike<number>>): [objectCount: number, firstObjectIndex: number] {
    const firstObjectIndex = this.#usedCount;
    const objectCount = this.buffer.copyAttributes(attributes, firstObjectIndex);
    this.#usedCount += objectCount;
    return [objectCount, firstObjectIndex];
  }

  toBuffersData(): VertexObjectBuffersData {
    return {
      capacity: this.capacity,
      usedCount: this.usedCount,
      buffers: Object.fromEntries(
        Array.from(this.buffer.buffers.values()).map((buffer) => [buffer.bufferName, buffer.typedArray]),
      ),
    };
  }

  /**
   * NOTE: The capacity should be the same as the original pool.
   *
   * @param copyTypedArrays By default, the typed-array references are simply shared (zero-copy) if possible.
   *                        But if `copyTypedArrays` is set to `true` or the typed-array from the input is smaller
   *                        than the current array from the buffer then the data is copied.
   */
  fromBuffersData(buffersData: VertexObjectBuffersData, copyTypedArrays = false): void {
    if (buffersData.capacity !== this.capacity) {
      throw new Error('Invalid buffersData capacity');
    }
    this.#usedCount = buffersData.usedCount;
    if (this.buffer == null) {
      this.buffer = new VertexObjectBuffer(this.descriptor, buffersData);
    } else {
      for (const [bufferName, typedArray] of Object.entries(buffersData.buffers)) {
        const buffer = this.buffer.buffers.get(bufferName)!;
        if (buffer) {
          if (copyTypedArrays || typedArray.length < buffer.typedArray.length) {
            buffer.typedArray.set(typedArray);
          } else {
            buffer.typedArray = typedArray;
          }
          buffer.serial++;
        }
      }
    }
  }
}
