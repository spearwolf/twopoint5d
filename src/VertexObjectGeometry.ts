import {
  BufferAttribute,
  BufferGeometry,
  InterleavedBuffer,
  InterleavedBufferAttribute,
} from 'three';

import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {VertexObjectPool} from './VertexObjectPool';
import {createIndicesArray} from './createIndicesArray';
import {selectAttributes} from './selectAttributes';
import {selectBuffers} from './selectBuffers';
import {toDrawUsage} from './toDrawUsage';
import {
  BufferLike,
  VertexAttributeUsageType,
  VertexObjectDescription,
} from './types';

export class VertexObjectGeometry extends BufferGeometry {
  readonly pool: VertexObjectPool;

  public buffers: Map<string, BufferLike>;

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

  touchAttributes(...attrNames: string[]): void {
    selectAttributes(this.pool, this.buffers, attrNames).forEach((buffer) => {
      buffer.needsUpdate = true;
    });
  }

  touchBuffers(
    bufferTypes: {[Type in VertexAttributeUsageType]: boolean},
  ): void {
    selectBuffers(this.buffers, bufferTypes).forEach((buffer) => {
      buffer.needsUpdate = true;
    });
  }

  update(): void {
    if (!this.attributesInitialized) {
      this.initializeAttributes();
    }
    // TODO autoTouch (<- attributes)
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
    for (const buffer of this.pool.buffer.buffers.values()) {
      const attributes = this.pool.buffer.bufferNameAttributes.get(
        buffer.bufferName,
      );
      if (attributes.length > 1) {
        const interleavedBuffer = new InterleavedBuffer(
          buffer.typedArray,
          buffer.itemSize,
        );
        interleavedBuffer.setUsage(toDrawUsage(buffer.usageType));
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
          attr.name = bufAttr.attributeName;
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
        attr.setUsage(toDrawUsage(buffer.usageType));
        attr.name = bufAttr.attributeName;
        this.buffers.set(buffer.bufferName, attr);
        this.setAttribute(attrDesc.name, attr);
      }
    }
  }
}
