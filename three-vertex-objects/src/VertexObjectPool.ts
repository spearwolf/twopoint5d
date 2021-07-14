import {VertexObjectBuffer} from './VertexObjectBuffer';
import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {voIndex0, voBuffer, voIndex, voBatchSize} from './constants';
import {VertexObjectDescription, VO} from './types';

const createVertexObject = (
  descriptor: VertexObjectDescriptor,
  buffer: VertexObjectBuffer,
  bufferIndex: number,
  batchSize: number,
  getVoIndex: () => number,
) =>
  Object.create(descriptor.voPrototype, {
    [voBuffer]: {
      value: buffer,
      writable: true,
    },
    [voIndex0]: {
      value: bufferIndex,
      writable: true,
    },
    [voBatchSize]: {
      value: batchSize,
      writable: true,
    },
    [voIndex]: {
      get: getVoIndex,
    },
  });

type FreeIndexType = [index: number, size: number];

export class VertexObjectPool<VOType = VO> {
  readonly descriptor: VertexObjectDescriptor;
  readonly capacity: number;

  buffer: VertexObjectBuffer;

  usedCount: number;

  readonly #bufferIndices: Uint32Array;

  readonly #nextFreeIndex: FreeIndexType[];
  #nextFreeIndexCount: number;

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
    this.#nextFreeIndexCount = 0;
  }

  // TODO resize!

  get availableCount(): number {
    return this.capacity - this.usedCount;
  }

  clear(): void {
    this.usedCount = 0;
    this.#nextFreeIndex.length = 0;
    this.#nextFreeIndexCount = 0;
  }

  createVO(): VOType & VO {
    if (this.usedCount < this.capacity) {
      const voIndex = this.usedCount++;
      const bufferIndex =
        this.findNextFreeIndex(1) ?? voIndex + this.#nextFreeIndexCount;
      if (bufferIndex < this.capacity) {
        return this.makeVertexObject(bufferIndex, voIndex, 1);
      }
      // TODO else: time to defrag buffer!?
    }
  }

  createBatchVO(batchSize: number): (VOType & VO)[] {
    if (this.usedCount + batchSize <= this.capacity) {
      const voIndex = this.usedCount++;
      const bufferIndex =
        this.findNextFreeIndex(batchSize) ?? voIndex + this.#nextFreeIndexCount;
      if (bufferIndex + batchSize < this.capacity) {
        const vos: (VOType & VO)[] = [];
        for (let i = 0; i < batchSize; i++) {
          vos.push(
            this.makeVertexObject(bufferIndex + i, voIndex + i, batchSize),
          );
        }
        return vos;
      }
      // TODO else: time to defrag buffer!?
    }
  }

  /**
   * The fastest variant is when the VO was the last one created,
   * otherwise the underlying buffer(s) have to be recopied internally.
   */
  freeVO(vo: VO): void {
    if (vo[voBuffer] === this.buffer && vo[voBatchSize] === 1) {
      const idx = vo[voIndex];
      if (idx >= 0) {
        const lastUsedIdx = this.usedCount - 1;
        if (idx !== lastUsedIdx) {
          this.buffer.copyWithin(idx, lastUsedIdx, lastUsedIdx + 1);
          this.#bufferIndices[lastUsedIdx] = idx;
          this.addFreeIndex(vo[voIndex0], 1);
        }
        this.usedCount--;
        vo[voBuffer] = undefined;
      }
    }
  }

  // TODO freeBatchVO()

  private makeVertexObject(
    bufferIndex: number,
    voIndex: number,
    batchSize: number,
  ): VOType & VO {
    this.#bufferIndices[bufferIndex] = voIndex;
    return createVertexObject(
      this.descriptor,
      this.buffer,
      bufferIndex,
      batchSize,
      () => this.#bufferIndices[bufferIndex],
    ) as VOType & VO;
  }

  private findNextFreeIndex(batchSize: number) {
    for (let i = 0, len = this.#nextFreeIndex.length; i < len; i++) {
      const freeIndex = this.#nextFreeIndex[i];
      if (freeIndex[1] === batchSize) {
        this.#nextFreeIndex.splice(i, 1);
        this.#nextFreeIndexCount -= batchSize;
        return freeIndex[0];
      }
    }
    return undefined;
  }

  private addFreeIndex(index: number, batchSize: number) {
    this.#nextFreeIndex.push([index, batchSize]);
    this.#nextFreeIndexCount += batchSize;
  }
}
