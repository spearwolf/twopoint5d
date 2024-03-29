import {createTypedArray} from './createTypedArray.js';
import {createVertexObjectPrototype} from './createVertexObjectPrototype.js';
import type {TypedArray, VertexAttributeDataType, VertexAttributeUsageType, VertexObjectBuffersData} from './types.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';

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
  typedArray: TypedArray;
  serial: number;
}

export class VertexObjectBuffer {
  readonly descriptor: VertexObjectDescriptor;
  readonly capacity: number;

  /** the names are always sorted the same way */
  readonly attributeNames: readonly string[];

  readonly buffers: Map<string, Buffer>;

  /** map attribute name to buffer-attribute info */
  readonly bufferAttributes: Map<string, BufferAttribute>;

  /** buffer name -> list of buffer attributes */
  readonly bufferNameAttributes: Map<string, BufferAttribute[]>;

  constructor(source: VertexObjectDescriptor | VertexObjectBuffer, capacityOrBuffersData: number | VertexObjectBuffersData) {
    let buffersData: VertexObjectBuffersData | undefined;
    if (typeof capacityOrBuffersData === 'number') {
      this.capacity = capacityOrBuffersData;
    } else {
      buffersData = capacityOrBuffersData;
      this.capacity = buffersData.capacity;
    }

    if (source instanceof VertexObjectBuffer) {
      this.descriptor = source.descriptor;
      this.attributeNames = source.attributeNames;
      this.bufferAttributes = source.bufferAttributes;
      this.bufferNameAttributes = source.bufferNameAttributes;
      this.buffers = new Map();

      for (const [bufferName, buffer] of source.buffers) {
        this.buffers.set(bufferName, {
          bufferName,
          itemSize: buffer.itemSize,
          dataType: buffer.dataType,
          usageType: buffer.usageType,
          typedArray: createTypedArray(buffer.dataType, this.capacity * this.descriptor.vertexCount * buffer.itemSize),
          serial: 0,
        });
      }
    } else {
      this.descriptor = source;
      this.buffers = new Map();
      this.bufferAttributes = new Map();
      this.attributeNames = Object.freeze(Array.from(this.descriptor.attributeNames).sort());

      for (const attributeName of this.attributeNames) {
        const attribute = this.descriptor.getAttribute(attributeName)!;
        const {bufferName} = attribute;
        let offset = 0;
        if (this.buffers.has(bufferName)) {
          const buffer = this.buffers.get(bufferName)!;
          offset = buffer.itemSize;
          buffer.itemSize += attribute.size;
        } else {
          this.buffers.set(bufferName, {
            bufferName,
            itemSize: attribute.size,
            dataType: attribute.dataType,
            usageType: attribute.usageType,
            // @ts-ignore
            typedArray: undefined,
            serial: 0,
          });
        }
        this.bufferAttributes.set(attributeName, {
          bufferName,
          attributeName,
          offset,
        });
      }

      for (const buffer of this.buffers.values()) {
        buffer.typedArray =
          buffersData?.buffers[buffer.bufferName] ??
          createTypedArray(buffer.dataType, this.capacity * this.descriptor.vertexCount * buffer.itemSize);
      }

      this.bufferNameAttributes = new Map();

      for (const bufAttr of this.bufferAttributes.values()) {
        const {bufferName} = bufAttr;
        if (this.bufferNameAttributes.has(bufferName)) {
          this.bufferNameAttributes.get(bufferName)!.push(bufAttr);
        } else {
          this.bufferNameAttributes.set(bufferName, [bufAttr]);
        }
      }
    }

    if (!this.descriptor.voPrototype) {
      this.descriptor.voPrototype = createVertexObjectPrototype(this);
    }
  }

  /**
   * Both objects should use the same vertex-object-description
   */
  copy(other: VertexObjectBuffer, targetObjectOffset = 0): VertexObjectBuffer {
    for (const buf of this.buffers.values()) {
      buf.typedArray.set(
        other.buffers.get(buf.bufferName)!.typedArray,
        targetObjectOffset * this.descriptor.vertexCount * buf.itemSize,
      );
      buf.serial++;
    }
    return this;
  }

  clone(): VertexObjectBuffer {
    return new VertexObjectBuffer(this, this.capacity).copy(this);
  }

  copyArray(source: TypedArray, bufferName: string, targetObjectOffset = 0): void {
    const buf = this.buffers.get(bufferName)!;
    buf.typedArray.set(source, targetObjectOffset * this.descriptor.vertexCount * buf.itemSize);
    buf.serial++;
  }

  copyWithin(targetIndex: number, startIndex: number, endIndex = this.capacity): void {
    const {vertexCount} = this.descriptor;
    for (const buf of this.buffers.values()) {
      buf.typedArray.copyWithin(
        targetIndex * vertexCount * buf.itemSize,
        startIndex * vertexCount * buf.itemSize,
        endIndex * vertexCount * buf.itemSize,
      );
      buf.serial++;
    }
  }

  copyAttributes(attributes: Record<string, ArrayLike<number>>, targetObjectOffset = 0): number {
    let copiedObjCount = 0;
    for (const [attrName, data] of Object.entries(attributes)) {
      const attr = this.bufferAttributes.get(attrName);
      if (attr) {
        let attrObjCount = 0;
        const buffer = this.buffers.get(attr.bufferName)!;
        const {vertexCount} = this.descriptor;
        const attrSize = this.descriptor.getAttribute(attrName)!.size;
        let idx = 0;
        let bufIdx = targetObjectOffset * vertexCount * buffer.itemSize;
        while (idx < data.length && attrObjCount + targetObjectOffset < this.capacity) {
          for (let i = 0; i < vertexCount; i++) {
            buffer.typedArray.set(Array.prototype.slice.call(data, idx, idx + attrSize), bufIdx + attr.offset);
            idx += attrSize;
            bufIdx += buffer.itemSize;
          }
          ++attrObjCount;
        }
        if (attrObjCount > copiedObjCount) {
          copiedObjCount = attrObjCount;
        }
        buffer.serial++;
      }
    }
    return copiedObjCount;
  }

  toAttributeArrays(attributeNames: string[], startIndex = 0, endIndex = this.capacity): Record<string, TypedArray> {
    return Object.fromEntries(
      attributeNames.map((attrName) => {
        const attr = this.bufferAttributes.get(attrName);
        if (attr) {
          const buffer = this.buffers.get(attr.bufferName)!;
          const {vertexCount} = this.descriptor;
          const attrSize = this.descriptor.getAttribute(attrName)!.size;

          const targetArray = createTypedArray(buffer.dataType, (endIndex - startIndex) * vertexCount * attrSize);

          let targetIdx = 0;
          let bufferIdx = startIndex * vertexCount * buffer.itemSize + attr.offset;

          for (let objIdx = startIndex; objIdx < endIndex; objIdx++) {
            for (let i = 0; i < vertexCount; i++) {
              targetArray.set(buffer.typedArray.subarray(bufferIdx, bufferIdx + attrSize), targetIdx);
              targetIdx += attrSize;
              bufferIdx += buffer.itemSize;
            }
          }
          return [attrName, targetArray];
        }
        return [attrName];
      }),
    );
  }

  touch(): void {
    for (const buffer of this.buffers.values()) {
      buffer.serial++;
    }
  }
}
