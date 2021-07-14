import {VertexObjectBuffer} from './VertexObjectBuffer';
import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {bIndex, voBuffer, voIndex} from './constants';
import {VertexObjectDescription, VO} from './types';

const createVertexObject = (
  descriptor: VertexObjectDescriptor,
  buffer: VertexObjectBuffer,
  bufferIndex: number,
  getVoIndex: () => number,
) =>
  Object.create(descriptor.voPrototype, {
    [voBuffer]: {
      value: buffer,
      writable: true,
    },
    [bIndex]: {
      value: bufferIndex,
      writable: true,
    },
    [voIndex]: {
      get: getVoIndex,
    },
    // TODO voBatch?
  });

export class VertexObjectPool<VOType = VO> {
  readonly descriptor: VertexObjectDescriptor;
  readonly capacity: number;

  buffer: VertexObjectBuffer;

  usedCount: number;

  readonly #bufferIndices: Uint32Array;
  readonly #nextFreeIndex: number[];

  constructor(
    descriptor: VertexObjectDescriptor | VertexObjectDescription,
    capacity: number,
  ) {
    this.descriptor =
      descriptor instanceof VertexObjectDescriptor
        ? descriptor
        : new VertexObjectDescriptor(descriptor);

    this.capacity = capacity;
    this.usedCount = 0;

    this.buffer = new VertexObjectBuffer(this.descriptor, capacity);
    this.#bufferIndices = new Uint32Array(capacity);
    this.#nextFreeIndex = [];
  }

  get availableCount(): number {
    return this.capacity - this.usedCount;
  }

  clear(): void {
    this.usedCount = 0;
  }

  // TODO optional target:VO parameter?
  createVO(): VOType & VO {
    if (this.usedCount < this.capacity) {
      const voIndex = this.usedCount++;
      const bufferIndex = this.#nextFreeIndex.shift() ?? voIndex;
      this.#bufferIndices[bufferIndex] = voIndex;
      return createVertexObject(
        this.descriptor,
        this.buffer,
        bufferIndex,
        () => this.#bufferIndices[bufferIndex],
      ) as VOType & VO;
    }
  }

  /**
   * The fastest variant is when the VO was the last one created,
   * otherwise the underlying buffer(s) have to be recopied internally.
   */
  freeVO(vo: VO): void {
    if (vo[voBuffer] === this.buffer) {
      const idx = vo[voIndex];
      if (idx >= 0) {
        const lastUsedIdx = this.usedCount - 1;
        if (idx !== lastUsedIdx) {
          this.buffer.copyWithin(idx, lastUsedIdx, lastUsedIdx + 1);
          this.#bufferIndices[lastUsedIdx] = idx;
          this.#nextFreeIndex.push(vo[bIndex]);
        }
        this.usedCount--;
        vo[voBuffer] = undefined;
      }
    }
  }

  // TODO createBatchVO()
  // TODO freeBatchVO()
}
