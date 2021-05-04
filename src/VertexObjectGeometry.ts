import {
  BufferAttribute,
  BufferGeometry,
  InterleavedBuffer,
  InterleavedBufferAttribute,
} from 'three';

import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {VertexObjectPool} from './VertexObjectPool';
import {createIndicesArray} from './createIndicesArray';
import {VertexObjectDescription} from './types';

export class VertexObjectGeometry extends BufferGeometry {
  readonly pool: VertexObjectPool;

  public buffers: Map<string, InterleavedBuffer | BufferAttribute>;

  constructor(
    source: VertexObjectPool | VertexObjectDescriptor | VertexObjectDescription,
    capacity: number,
  ) {
    super();
    this.pool =
      source instanceof VertexObjectPool
        ? source
        : new VertexObjectPool(source, capacity);
  }

  get attributesInitialized(): boolean {
    return this.buffers != null;
  }

  update(): void {
    if (!this.attributesInitialized) {
      this.initializeAttributes();
    }
    // TODO select buffers
    // TODO touch/update buffers
  }

  protected initializeAttributes(): void {
    this.buffers = new Map();
    const {descriptor, capacity} = this.pool;
    if (descriptor.hasIndices) {
      const {indices} = descriptor;
      this.setIndex(
        new BufferAttribute(
          createIndicesArray(indices, capacity),
          indices.length,
        ),
      );
    }
    // TODO set attributes...
    for (const buffer of this.pool.buffer.buffers.values()) {
      const attributes = this.pool.buffer.bufferNameAttributes.get(
        buffer.bufferName,
      );
      if (attributes.length > 1) {
        const interleavedBuffer = new InterleavedBuffer(
          buffer.typedArray,
          buffer.itemSize,
        );
        this.buffers.set(buffer.bufferName, interleavedBuffer);
        for (const bufAttr of attributes) {
          const attrDesc = this.pool.descriptor.attributes.get(
            bufAttr.attributeName,
          );
          const attr = new InterleavedBufferAttribute(
            interleavedBuffer,
            attrDesc.size,
            bufAttr.offset,
            attrDesc.normalizedData,
          );
          this.setAttribute(attrDesc.name, attr);
        }
      } else {
        const bufAttr = attributes[0];
        const attrDesc = this.pool.descriptor.attributes.get(
          bufAttr.attributeName,
        );
        const attr = new BufferAttribute(
          buffer.typedArray,
          buffer.itemSize,
          attrDesc.normalizedData,
        );
        this.buffers.set(buffer.bufferName, attr);
        this.setAttribute(attrDesc.name, attr);
      }
    }
  }
}
