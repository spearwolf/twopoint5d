import {VOBufferPool} from './VOBufferPool.js';
import {VOUtils} from './VOUtils.js';
import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {createVertexObject} from './createVertexObject.js';
import {voBuffer} from './constants.js';
import type {VO, VertexObjectBuffersData, VertexObjectDescription} from './types.js';

export class VertexObjectPool<VOType> extends VOBufferPool {
  #voIndex: Array<VOType & VO>;

  onCreateVO?: (vo: VOType & VO) => (VOType & VO) | void;

  constructor(descriptor: VertexObjectDescriptor | VertexObjectDescription, capacityOrData: number | VertexObjectBuffersData) {
    super(descriptor, capacityOrData);
    this.#voIndex = new Array(this.capacity);
  }

  /**
   * Resizes the pool to a new capacity.
   *
   * Only allowed as long as the pool does not back a geometry: the `THREE.BufferAttribute`s
   * and their GPU buffers take their size from the pool capacity exactly once, so a live
   * geometry cannot follow along. While {@link VOBufferPool#isAttachedToGeometry} holds, the
   * method throws for every capacity but the one the pool already has — resizing to the
   * current capacity leaves the buffers alone and is therefore allowed.
   *
   * If the new capacity is larger, the pool will be able to hold more vertex objects.
   * If it is smaller, every vertex object from the new capacity onwards is unlinked from its
   * buffer — any further read or write on such a vertex object fails. The `usedCount` is
   * capped at the new capacity.
   */
  resize(capacity: number): void {
    if (capacity < 0 || !Number.isInteger(capacity)) {
      throw new Error('Capacity must be a non-negative integer');
    }

    if (capacity === this.capacity) return;

    if (this.isAttachedToGeometry) {
      throw new Error(
        'resize() is only allowed before the pool is attached to a geometry: the three.js attributes and their GPU buffers are sized once from the pool capacity and cannot be grown or shrunk afterwards',
      );
    }

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

    // vertex objects beyond the new capacity have no slot any more; unlinking
    // them makes a later write fail loudly instead of landing in the detached buffer
    for (let i = copyCount; i < this.#voIndex.length; i++) {
      const vo = this.#voIndex[i];
      if (vo != null) {
        VOUtils.clearBuffer(vo);
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

  createVO(): (VOType & VO) | undefined {
    if (this.usedCount < this.capacity) {
      const idx = this.usedCount++;
      const vo = this.#createVO(idx);
      this.#voIndex[idx] = vo;
      return vo;
    }
    return undefined;
  }

  containsVO(vo: VO): boolean {
    return VOUtils.isBuffer(vo, this.buffer);
  }

  /**
   * In addition to {@link VOBufferPool#dispose}, this also unlinks the buffer
   * reference from every still-tracked vertex object and drops the internal
   * VO index.
   */
  override dispose(): void {
    if (this.isDisposed) return;
    for (let i = 0; i < this.#voIndex.length; i++) {
      const vo = this.#voIndex[i];
      if (vo != null) {
        VOUtils.clearBuffer(vo);
      }
    }
    this.#voIndex.length = 0;
    super.dispose();
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
      this.#voIndex[idx] = undefined;
    } else {
      this.buffer.copyWithin(idx, lastUsedIdx, lastUsedIdx + 1);
      const lastUsedVO = this.#voIndex[lastUsedIdx];
      // createFromAttributes() raises usedCount without materializing a VO,
      // so the slot that is swapped down can legitimately be empty
      if (lastUsedVO != null) {
        VOUtils.setIndex(lastUsedVO, idx);
      }
      this.#voIndex[idx] = lastUsedVO;
      this.#voIndex[lastUsedIdx] = undefined;
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

  #createVO(idx: number) {
    const vo = createVertexObject(this.descriptor, this.buffer, idx);
    this.buffer.touch();
    if (this.onCreateVO != null) {
      return this.onCreateVO(vo) ?? vo;
    }
    return vo;
  }
}
