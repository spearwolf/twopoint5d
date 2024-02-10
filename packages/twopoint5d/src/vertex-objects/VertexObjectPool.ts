import {VertexBufferPool} from './VertexBufferPool.js';
import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {voBuffer, voIndex} from './constants.js';
import {createVertexObject} from './createVertexObject.js';
import type {VO, VertexObjectBuffersData, VertexObjectDescription} from './types.js';

export class VertexObjectPool<VOType> extends VertexBufferPool {
  static setIndex(vo: VO, idx: number): VO {
    vo[voIndex] = idx;
    return vo;
  }

  static getIndex(vo: VO): number {
    return vo[voIndex];
  }

  static getBuffer(vo: VO): VertexObjectBuffer | undefined {
    return vo[voBuffer];
  }

  static setBuffer(vo: VO, buffer: VertexObjectBuffer | undefined): void {
    vo[voBuffer] = buffer;
  }

  #voIndex: Array<VOType & VO>;

  onCreateVO?: (vo: VOType & VO) => (VOType & VO) | void;
  onDestroyVO?: (vo: VOType & VO) => void;

  constructor(descriptor: VertexObjectDescriptor | VertexObjectDescription, capacityOrData: number | VertexObjectBuffersData) {
    super(descriptor, capacityOrData);
    this.#voIndex = new Array(this.capacity);
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
    return VertexObjectPool.getBuffer(vo) === this.buffer;
  }

  /**
   * The fastest variant is when the VO was the last one created,
   * otherwise the underlying buffer(s) have to be recopied internally.
   */
  freeVO(vo: VO): void {
    if (!this.containsVO(vo)) return;

    const idx = VertexObjectPool.getIndex(vo);
    const lastUsedIdx = this.usedCount - 1;

    if (idx === lastUsedIdx) {
      this.#destroyVO(idx);
    } else {
      this.buffer.copyWithin(idx, lastUsedIdx, lastUsedIdx + 1);
      const lastUsedVO = this.#voIndex[lastUsedIdx];
      VertexObjectPool.setIndex(lastUsedVO, idx);
      this.#voIndex[idx] = lastUsedVO;
    }

    this.usedCount--;

    VertexObjectPool.setBuffer(vo, undefined);
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
    if (this.onCreateVO != null) {
      return this.onCreateVO(vo) ?? vo;
    }
    return vo;
  }
}
