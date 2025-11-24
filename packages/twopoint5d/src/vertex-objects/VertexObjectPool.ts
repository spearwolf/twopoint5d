import {VOBufferPool} from './VOBufferPool.js';
import {VOUtils} from './VOUtils.js';
import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {createVertexObject} from './createVertexObject.js';
import {voBuffer} from './constants.js';
import type {VO, VertexObjectBuffersData, VertexObjectDescription} from './types.js';

export class VertexObjectPool<VOType> extends VOBufferPool {
  #voIndex: Array<VOType & VO>;

  onCreateVO?: (vo: VOType & VO) => (VOType & VO) | void;
  onDestroyVO?: (vo: VOType & VO) => void;

  constructor(descriptor: VertexObjectDescriptor | VertexObjectDescription, capacityOrData: number | VertexObjectBuffersData) {
    super(descriptor, capacityOrData);
    this.#voIndex = new Array(this.capacity);
  }

  /**
   * Resizes the pool to a new capacity.
   * If the new capacity is larger, the pool will be able to hold more vertex objects.
   * If the new capacity is smaller, existing vertex objects beyond the new capacity will be lost.
   * The usedCount will be adjusted to not exceed the new capacity.
   */
  resize(capacity: number): void {
    if (capacity < 0 || !Number.isInteger(capacity)) {
      throw new Error('Capacity must be a non-negative integer');
    }

    if (capacity === this.capacity) return;

    // Create a new buffer with the new capacity
    const newBuffer = new VertexObjectBuffer(this.descriptor, capacity);

    // Copy existing data up to the minimum of old and new capacity
    const copyCount = Math.min(this.usedCount, capacity);
    if (copyCount > 0) {
      // Manually copy data for each buffer to handle different capacities
      const {vertexCount} = this.descriptor;
      for (const [bufferName, oldBuf] of this.buffer.buffers) {
        const newBuf = newBuffer.buffers.get(bufferName)!;
        const copyLength = copyCount * vertexCount * oldBuf.itemSize;
        newBuf.typedArray.set(oldBuf.typedArray.subarray(0, copyLength));
        newBuf.serial++;
      }
    }

    // Update the buffer reference
    this.buffer = newBuffer;

    // Resize the voIndex array and update buffer references in existing VOs
    const newVoIndex: Array<VOType & VO> = new Array(capacity);
    for (let i = 0; i < copyCount; i++) {
      const vo = this.#voIndex[i];
      if (vo != null) {
        // Update the VO's internal buffer reference to point to the new buffer
        vo[voBuffer] = newBuffer;
        newVoIndex[i] = vo;
      }
    }
    this.#voIndex = newVoIndex;

    // Update capacity (readonly field needs to be redefined)
    Object.defineProperty(this, 'capacity', {
      value: capacity,
      writable: false,
      enumerable: true,
      configurable: true,
    });

    // Adjust usedCount if necessary
    this.usedCount = Math.min(this.usedCount, capacity);
  }

  createVO(): VOType & VO {
    if (this.usedCount < this.capacity) {
      const idx = this.usedCount++;
      const vo = this.#createVO(idx);
      this.#voIndex[idx] = vo;
      return vo;
    }
    // @ts-ignore
    return undefined;
  }

  containsVO(vo: VO): boolean {
    return VOUtils.isBuffer(vo, this.buffer);
  }

  /**
   * The fastest variant is when the VO was the last one created,
   * otherwise the underlying buffer(s) have to be recopied internally.
   */
  freeVO(vo: VO): void {
    if (!this.containsVO(vo)) return;

    const idx = VOUtils.getIndex(vo);
    const lastUsedIdx = this.usedCount - 1;

    if (idx === lastUsedIdx) {
      this.#destroyVO(idx);
    } else {
      this.buffer.copyWithin(idx, lastUsedIdx, lastUsedIdx + 1);
      const lastUsedVO = this.#voIndex[lastUsedIdx];
      VOUtils.setIndex(lastUsedVO, idx);
      this.#voIndex[idx] = lastUsedVO;
    }

    this.usedCount--;

    VOUtils.clearBuffer(vo);
  }

  getVO(idx: number): (VOType & VO) | undefined {
    let vo = this.#voIndex[idx];
    if (vo == null && idx < this.usedCount) {
      vo = this.#createVO(idx);
      this.#voIndex[idx] = vo;
    }
    return vo;
  }

  #destroyVO(idx: number) {
    const vo = this.#voIndex[idx];
    if (vo != null && this.onDestroyVO != null) {
      this.onDestroyVO(vo);
    }
    this.#voIndex[idx] = undefined;
  }

  #createVO(idx: number) {
    const vo = createVertexObject(this.descriptor, this.buffer, idx);
    this.buffer.touch();
    if (this.onCreateVO != null) {
      return this.onCreateVO(vo) ?? vo;
    }
    return vo;
  }
}
