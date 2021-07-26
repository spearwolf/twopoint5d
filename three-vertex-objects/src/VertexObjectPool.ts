import {VertexObjectBuffer} from './VertexObjectBuffer';
import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {voBuffer, voIndex} from './constants';
import {VO, VertexObjectDescription} from './types';

const createVertexObject = (
  descriptor: VertexObjectDescriptor,
  buffer: VertexObjectBuffer,
  objectIndex: number,
) =>
  Object.create(descriptor.voPrototype, {
    [voBuffer]: {
      value: buffer,
      writable: true,
    },
    [voIndex]: {
      value: objectIndex,
      writable: true,
    },
  });

export class VertexObjectPool<VOType = VO> {
  readonly descriptor: VertexObjectDescriptor;
  readonly capacity: number;

  buffer: VertexObjectBuffer;

  #index: Array<VOType & VO>;
  #usedCount = 0;

  constructor(
    descriptor: VertexObjectDescriptor | VertexObjectDescription,
    capacity: number,
  ) {
    this.descriptor =
      descriptor instanceof VertexObjectDescriptor
        ? descriptor
        : new VertexObjectDescriptor(descriptor);
    this.capacity = capacity;
    this.buffer = new VertexObjectBuffer(this.descriptor, capacity);
    this.usedCount = 0;
    this.#index = new Array(capacity);
  }

  get usedCount(): number {
    return this.#usedCount;
  }

  set usedCount(value: number) {
    // TODO test
    if (value < this.#usedCount) {
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
      const vo = createVertexObject(this.descriptor, this.buffer, idx);
      this.#index[idx] = vo;
      return vo;
    }
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
        this.#index[idx] = undefined;
      } else {
        this.buffer.copyWithin(idx, lastUsedIdx, lastUsedIdx + 1);
        const lastUsedVO = this.#index[lastUsedIdx];
        lastUsedVO[voIndex] = idx;
        this.#index[idx] = lastUsedVO;
      }
      this.usedCount--;
      vo[voBuffer] = undefined;
    }
  }

  /* TODO test & usage check
  getVO(idx: number): (VOType & VO) | undefined {
    if (idx < this.#usedCount) {
      let vo = this.#index[idx];
      if (vo == null) {
        vo = createVertexObject(this.descriptor, this.buffer, idx);
      }
      return vo;
    }
  }
  */
}
