import {VOBufferPool} from './VOBufferPool.js';
import {VOUtils} from './VOUtils.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {createVertexObject} from './createVertexObject.js';
import type {VO, VertexObjectBuffersData, VertexObjectDescription} from './types.js';

export class VertexObjectPool<VOType> extends VOBufferPool {
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
    if (this.onCreateVO != null) {
      return this.onCreateVO(vo) ?? vo;
    }
    return vo;
  }
}
