import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import type {VertexObjectBuffersData, VertexObjectDescription} from './types.js';

export class VOBufferPool {
  readonly descriptor: VertexObjectDescriptor;
  readonly capacity: number;

  buffer: VertexObjectBuffer;

  #usedCount = 0;

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

  clear(): void {
    this.usedCount = 0;
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
   *                        But if `copyTypedArrays` is set to `true` or the typed-array from the input is smaller than
   *                        the current array from the buffer then the data is copied.
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
