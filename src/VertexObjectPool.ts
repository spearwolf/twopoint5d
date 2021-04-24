import {VertexObjectBuffer} from './VertexObjectBuffer';
import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {voBuffer, voIndex} from './constants';
import {VO, VertexObjectDescription} from './types';

function createVertexObject(
  descriptor: VertexObjectDescriptor,
  buffer: VertexObjectBuffer,
  objectIndex: number,
) {
  const vo = Object.create(descriptor.voPrototype, {
    [voBuffer]: {
      value: buffer,
      writable: true,
    },
    [voIndex]: {
      value: objectIndex,
      writable: true,
    },
  });
  return vo;
}

export class VertexObjectPool<VOType = VO> {
  readonly descriptor: VertexObjectDescriptor;
  readonly capacity: number;
  readonly index: Array<VOType & VO>;

  buffer: VertexObjectBuffer;
  usedCount: number;

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
    this.index = new Array(capacity);
  }

  get availableCount(): number {
    return this.capacity - this.usedCount;
  }

  createVO(): VOType & VO {
    if (this.usedCount < this.capacity) {
      const idx = this.usedCount++;
      const vo = createVertexObject(this.descriptor, this.buffer, idx);
      this.index[idx] = vo;
      return vo;
    }
  }

  freeVO(vo: VO): void {
    const idx = vo[voIndex];
    this.index[idx] = undefined;
    // TODO relink!!! usedCount--
  }

  // TODO createBatchVO()
  // TODO freeVO()
  // TODO freeBatchVO()
}
