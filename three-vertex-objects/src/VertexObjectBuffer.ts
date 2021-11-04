import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {createTypedArray} from './createTypedArray';
import {createVertexObjectPrototype} from './createVertexObjectPrototype';
import {TypedArray, VertexAttributeDataType, VertexAttributeUsageType} from './types';

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
  // serial?
  // needsUpdate?
  // autoTouch
  // THREE->bufferAttribute?
}

/**
 * @category Vertex Objects
 */
export class VertexObjectBuffer {
  readonly descriptor: VertexObjectDescriptor;

  /** the names are always sorted the same way */
  readonly attributeNames: readonly string[];

  readonly buffers: Map<string, Buffer>;
  readonly bufferAttributes: Map<string, BufferAttribute>;

  /** buffer name -> list of buffer attributes */
  readonly bufferNameAttributes: Map<string, BufferAttribute[]>;

  constructor(source: VertexObjectDescriptor | VertexObjectBuffer, public readonly capacity: number) {
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
        });
      }
    } else {
      this.descriptor = source;
      this.buffers = new Map();
      this.bufferAttributes = new Map();
      this.attributeNames = Object.freeze(Array.from(this.descriptor.attributeNames).sort());

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
            typedArray: undefined,
          });
        }
        this.bufferAttributes.set(attributeName, {
          bufferName,
          attributeName,
          offset,
        });
      }
      for (const buffer of this.buffers.values()) {
        buffer.typedArray = createTypedArray(buffer.dataType, this.capacity * this.descriptor.vertexCount * buffer.itemSize);
      }
      this.bufferNameAttributes = new Map();
      for (const bufAttr of this.bufferAttributes.values()) {
        const {bufferName} = bufAttr;
        if (this.bufferNameAttributes.has(bufferName)) {
          this.bufferNameAttributes.get(bufferName).push(bufAttr);
        } else {
          this.bufferNameAttributes.set(bufferName, [bufAttr]);
        }
      }
    }
    if (!this.descriptor.voPrototype) {
      this.descriptor.voPrototype = createVertexObjectPrototype(this, this.descriptor.basePrototype);
    }
  }

  copy(otherVob: VertexObjectBuffer, objectOffset = 0): void {
    const {vertexCount} = this.descriptor;
    for (const {bufferName, typedArray, itemSize} of this.buffers.values()) {
      typedArray.set(otherVob.buffers.get(bufferName).typedArray, objectOffset * vertexCount * itemSize);
    }
  }

  clone(): VertexObjectBuffer {
    const clone = new VertexObjectBuffer(this, this.capacity);
    clone.copy(this);
    return clone;
  }

  copyWithin(target: number, start: number, end = this.capacity): void {
    const {vertexCount} = this.descriptor;
    for (const {typedArray, itemSize} of this.buffers.values()) {
      typedArray.copyWithin(target * vertexCount * itemSize, start * vertexCount * itemSize, end * vertexCount * itemSize);
    }
  }

  copyAttributes(attributes: Record<string, ArrayLike<number>>, objectOffset = 0): number {
    let copiedObjCount = 0;
    for (const [attrName, data] of Object.entries(attributes)) {
      const attr = this.bufferAttributes.get(attrName);
      if (attr) {
        let attrObjCount = 0;
        const buffer = this.buffers.get(attr.bufferName);
        const {vertexCount} = this.descriptor;
        const attrSize = this.descriptor.getAttribute(attrName).size;
        let idx = 0;
        let bufIdx = objectOffset * vertexCount * buffer.itemSize;
        while (idx < data.length && attrObjCount + objectOffset < this.capacity) {
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
      }
    }
    return copiedObjCount;
  }

  toAttributeArrays(attributeNames: string[], start = 0, end = this.capacity): Record<string, TypedArray> {
    return Object.fromEntries(
      attributeNames.map((attrName) => {
        const attr = this.bufferAttributes.get(attrName);
        if (attr) {
          const buffer = this.buffers.get(attr.bufferName);
          const {vertexCount} = this.descriptor;
          const attrSize = this.descriptor.getAttribute(attrName).size;

          const targetArray = createTypedArray(buffer.dataType, (end - start) * vertexCount * attrSize);

          let targetIdx = 0;
          let bufferIdx = start * vertexCount * buffer.itemSize + attr.offset;

          for (let objIdx = start; objIdx < end; objIdx++) {
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
}
