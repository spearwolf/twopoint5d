import {voBuffer, voIndex} from './constants.js';
import {createVertexObject} from './createVertexObject.js';
import type {VertexObjectBuffersData, VertexObjectDescription, VO} from './types.js';
import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';

export class VertexObjectPool<VOType> {
  static setIndex(vo: VO, idx: number): VO {
    vo[voIndex] = idx;
    return vo;
  }

  readonly descriptor: VertexObjectDescriptor;
  readonly capacity: number;

  buffer: VertexObjectBuffer;

  #index: Array<VOType & VO>;
  #usedCount = 0;

  onCreateVO?: (vo: VOType & VO) => (VOType & VO) | void;

  constructor(descriptor: VertexObjectDescriptor | VertexObjectDescription, capacityOrData: number | VertexObjectBuffersData) {
    this.descriptor = descriptor instanceof VertexObjectDescriptor ? descriptor : new VertexObjectDescriptor(descriptor);
    if (typeof capacityOrData === 'number') {
      const capacity = capacityOrData;
      this.capacity = capacity;
      this.buffer = new VertexObjectBuffer(this.descriptor, capacity);
    } else {
      const buffersData = capacityOrData;
      this.capacity = buffersData.capacity;
      this.#usedCount = buffersData.usedCount;
      this.buffer = new VertexObjectBuffer(this.descriptor, buffersData);
    }
    this.#index = new Array(this.capacity);
  }

  get usedCount(): number {
    return this.#usedCount;
  }

  set usedCount(value: number) {
    // TODO write test
    if (value < this.#usedCount) {
      // @ts-ignore
      this.#index.fill(undefined, value, this.#usedCount);
    }
    this.#usedCount = value < this.capacity ? value : this.capacity;
  }

  get availableCount(): number {
    return this.capacity - this.#usedCount;
  }

  clear(): void {
    this.usedCount = 0;
  }

  createVO(): VOType & VO {
    if (this.#usedCount < this.capacity) {
      const idx = this.usedCount++;
      const vo = this.#createVertexObject(idx);
      this.#index[idx] = vo;
      return vo;
    }
    // @ts-ignore
    return undefined;
  }

  createFromAttributes(attributes: Record<string, ArrayLike<number>>): [objectCount: number, firstObjectIdx: number] {
    const firstObjectIdx = this.#usedCount;
    const objectCount = this.buffer.copyAttributes(attributes, firstObjectIdx);
    this.#usedCount += objectCount;
    return [objectCount, firstObjectIdx];
  }

  /**
   * The fastest variant is when the VO was the last one created,
   * otherwise the underlying buffer(s) have to be recopied internally.
   */
  freeVO(vo: VO): void {
    if (vo[voBuffer] === this.buffer) {
      const idx = vo[voIndex];
      const lastUsedIdx = this.#usedCount - 1;
      if (idx === lastUsedIdx) {
        // @ts-ignore
        this.#index[idx] = undefined;
      } else {
        this.buffer.copyWithin(idx, lastUsedIdx, lastUsedIdx + 1);
        const lastUsedVO = this.#index[lastUsedIdx];
        lastUsedVO[voIndex] = idx;
        this.#index[idx] = lastUsedVO;
      }
      this.usedCount--;
      // @ts-ignore
      vo[voBuffer] = undefined;
    }
  }

  getVO(idx: number): (VOType & VO) | undefined {
    let vo = this.#index[idx];
    if (vo == null && idx < this.#usedCount) {
      vo = this.#createVertexObject(idx);
      this.#index[idx] = vo;
    }
    return vo;
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

  #createVertexObject(idx: number) {
    const vo = createVertexObject(this.descriptor, this.buffer, idx);
    if (this.onCreateVO != null) {
      return this.onCreateVO(vo) ?? vo;
    }
    return vo;
  }
}
