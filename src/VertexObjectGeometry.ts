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

type TouchBuffersType = {[Type in VertexAttributeUsageType]?: boolean};

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
    this.name = 'VertexObjectGeometry';
  }

  get attributesInitialized(): boolean {
    return this.buffers != null;
  }

  touchAttributes(...attrNames: string[]): void {
    selectAttributes(this.pool, this.buffers, attrNames).forEach((buffer) => {
      buffer.needsUpdate = true;
    });
  }

  touchBuffers(bufferTypes: TouchBuffersType): void {
    selectBuffers(this.buffers, bufferTypes).forEach((buffer) => {
      buffer.needsUpdate = true;
    });
  }

  touch(...args: Array<string | TouchBuffersType>): void {
    const attrNames: string[] = [];
    let buffers: TouchBuffersType;
    args.forEach((arg) => {
      if (typeof arg === 'string') {
        attrNames.push(arg);
      } else {
        buffers = {...buffers, ...arg};
      }
    });
    if (attrNames.length) {
      this.touchAttributes(...attrNames);
    }
    if (buffers) {
      this.touchBuffers(buffers);
    }
  }

  update(): void {
    if (!this.attributesInitialized) {
      this.initializeAttributes();
    }

    const autoTouchAttrs = Array.from(this.pool.descriptor.attributes.values())
      .filter((attr) => attr.autoTouch)
      .map((attr) => attr.name);
    // TODO cache autoTouch attribute names !
    this.touchAttributes(...autoTouchAttrs);

    this.setDrawRange(
      0,
      this.pool.descriptor.hasIndices
        ? this.pool.usedCount * this.pool.descriptor.indices.length
        : this.pool.usedCount * this.pool.descriptor.vertexCount,
    );
  }

  protected initializeAttributes(): void {
    this.buffers = new Map();
    const {descriptor, capacity} = this.pool;
    if (descriptor.hasIndices) {
      const {indices} = descriptor;
      const bufAttr = new BufferAttribute(
        createIndicesArray(indices, capacity),
        3,
      );
      bufAttr.count = capacity * indices.length;
      this.setIndex(bufAttr);
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
