import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {VertexAttributeDataType, VertexAttributeUsageType} from './types';

interface BufferAttribute {
  bufferName: string;
  attributeName: string;
  offset: number;
}

interface Buffer {
  bufferName: string;
  itemSize: number;
  dataType: VertexAttributeDataType;
  usageType: VertexAttributeUsageType;
  // typedArray
  // serial
  // needsUpdate
  // autoTouch
  // THREE->bufferAttribute?
}

export class VertexObjectBuffer {
  readonly descriptor: VertexObjectDescriptor;

  /** the names are always sorted the same way */
  readonly attributeNames: readonly string[];

  readonly buffers: Map<string, Buffer>;
  readonly bufferAttributes: Map<string, BufferAttribute>;

  // TODO static VertexObjectBuffer.fromData({ foo: [...], bar: [...] });
  // TODO static VertexObjectBuffer.copy(vob)
  // TODO static VertexObjectBuffer.clone(vob)
  // TODO new VertexObjectBuffer(descriptor, CAPACITY = 1)
  // TODO vob.capacity
  // TODO vob.copyData(fromIndex, toIndex)
  // TODO vob.swapData(fromIndex, toIndex)

  constructor(descriptor: VertexObjectDescriptor) {
    this.descriptor = descriptor;
    this.buffers = new Map();
    this.bufferAttributes = new Map();
    this.attributeNames = Object.freeze(
      Array.from(this.descriptor.attributeNames).sort(),
    );

    for (const attributeName of this.attributeNames) {
      const attribute = this.descriptor.getAttribute(attributeName);
      const {bufferName} = attribute;
      let offset = 0;
      if (this.buffers.has(bufferName)) {
        const buffer = this.buffers.get(bufferName);
        offset = buffer.itemSize;
        buffer.itemSize += attribute.size;
      } else {
        this.buffers.set(bufferName, {
          bufferName,
          itemSize: attribute.size,
          dataType: attribute.dataType,
          usageType: attribute.usageType,
        });
      }
      this.bufferAttributes.set(attributeName, {
        bufferName,
        attributeName,
        offset,
      });
    }
  }
}
