import {createTypedArray} from './createTypedArray.js';
import {createVertexObjectPrototype} from './createVertexObjectPrototype.js';
import type {TypedArray, VertexAttributeDataType, VertexAttributeUsageType, VertexObjectBuffersData} from './types.js';
import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';

export interface AttributeBufferLayout {
  bufferName: string;
  attributeName: string;
  offset: number;
}

export interface AttributeBuffer {
  bufferName: string;
  itemSize: number;
  dataType: VertexAttributeDataType;
  usageType: VertexAttributeUsageType;
  /**
   * Empty only for a buffer that someone grabbed a reference to before `VOBufferPool#dispose()`:
   * dispose takes every buffer its array and clears the same map in the same breath, so a buffer
   * still reachable through a living pool always holds its array.
   */
  typedArray: TypedArray | undefined;
  serial: number;
}

// one message for every method that refuses to work once the pool behind this buffer has
// given up its typed arrays, so the class, the method and the state are always in the text
// a caller reads out of a foreign stack
function releasedError(method: string): Error {
  return new Error(`VertexObjectBuffer#${method} is not available: the pool behind this buffer has been disposed`);
}

export class VertexObjectBuffer {
  /** The description this buffer was built from; it stays what it is once the pool behind this buffer is disposed. */
  readonly descriptor: VertexObjectDescriptor;

  /** How many vertex objects this buffer was sized for; it stays what it is once the pool behind this buffer is disposed. */
  readonly capacity: number;

  /**
   * the names are always sorted the same way; they stay what they are once the pool behind
   * this buffer is disposed
   */
  readonly attributeNames: readonly string[];

  /** Empty once the pool behind this buffer is disposed — the data is gone, the description of it is not. */
  readonly buffers: Map<string, AttributeBuffer>;

  /**
   * map attribute name to buffer-attribute info; it stays what it is once the pool behind this
   * buffer is disposed
   */
  readonly bufferAttributes: Map<string, AttributeBufferLayout>;

  /**
   * buffer name -> list of buffer attributes; it stays what it is once the pool behind this
   * buffer is disposed
   */
  readonly bufferNameAttributes: Map<string, AttributeBufferLayout[]>;

  #released = false;

  /**
   * Builds a buffer from a vertex-object description, or from another buffer whose layout it
   * takes over. `buffersData`, when given, is taken over and not copied — whoever keeps the
   * reference keeps writing into this buffer. A buffer name `buffersData` does not mention gets
   * a fresh, zeroed array sized for the given capacity and layout. The capacity then comes from
   * `buffersData.capacity`; `usedCount` belongs to the pool, not the buffer.
   *
   * This constructor takes `buffersData.capacity` as given and checks it against nothing. A
   * `VOBufferPool` carries its own `capacity`, fixed at construction, which does not follow
   * whatever buffer is later assigned to `pool.buffer` — assigning a buffer built here with a
   * differing `buffersData.capacity` leaves pool and buffer disagreeing about size, silently.
   * Use `VOBufferPool#fromBuffersData()` to restore a pool from `toBuffersData()` output: it
   * reconciles the two and throws on a capacity mismatch instead of leaving one.
   *
   * @throws when `source` is the buffer of a disposed pool, which has no data to build a second
   * buffer from
   */
  constructor(source: VertexObjectDescriptor | VertexObjectBuffer, capacityOrBuffersData: number | VertexObjectBuffersData) {
    if (source instanceof VertexObjectBuffer && source.#released) {
      throw new Error(
        'VertexObjectBuffer: the source buffer holds no typed array any more — the pool behind it has been disposed. ' +
          'Copy the buffer before the pool is disposed, or build a new one from the descriptor.',
      );
    }

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
          typedArray:
            buffersData?.buffers[bufferName] ??
            createTypedArray(buffer.dataType, this.capacity * this.descriptor.vertexCount * buffer.itemSize),
          serial: 0,
        });
      }
    } else {
      this.descriptor = source;
      this.bufferAttributes = new Map();
      this.attributeNames = Object.freeze(Array.from(this.descriptor.attributeNames).sort());

      // a buffer can only be sized once every attribute has contributed its share to itemSize,
      // so the typed arrays come after this loop and the records carry none until then
      const forming = new Map<string, Omit<AttributeBuffer, 'typedArray'>>();

      for (const attributeName of this.attributeNames) {
        const attribute = this.descriptor.getAttribute(attributeName)!;
        const {bufferName} = attribute;
        let offset = 0;
        const buffer = forming.get(bufferName);
        if (buffer) {
          offset = buffer.itemSize;
          buffer.itemSize += attribute.size;
        } else {
          forming.set(bufferName, {
            bufferName,
            itemSize: attribute.size,
            dataType: attribute.dataType,
            usageType: attribute.usageType,
            serial: 0,
          });
        }
        this.bufferAttributes.set(attributeName, {
          bufferName,
          attributeName,
          offset,
        });
      }

      this.buffers = new Map();

      for (const buffer of forming.values()) {
        this.buffers.set(buffer.bufferName, {
          ...buffer,
          typedArray:
            buffersData?.buffers[buffer.bufferName] ??
            createTypedArray(buffer.dataType, this.capacity * this.descriptor.vertexCount * buffer.itemSize),
        });
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
   *
   * Throws when `other` is the buffer of a disposed pool, which has no data to read, and for a
   * buffer of this one that `other` does not have. Copying into the buffer of a disposed pool
   * does nothing — there is nothing left to write to.
   */
  copy(other: VertexObjectBuffer, targetObjectOffset = 0): VertexObjectBuffer {
    for (const buf of this.buffers.values()) {
      const source = other.buffers.get(buf.bufferName);
      if (source == null) {
        // a name without a buffer means two different things, and a caller whose two buffers
        // were built from different descriptions should not be sent looking for a dispose()
        throw other.#released
          ? releasedError('copy()')
          : new Error(
              `VertexObjectBuffer#copy() finds no buffer named "${buf.bufferName}" in the source: ` +
                'both buffers have to be built from the same vertex object description',
            );
      }
      buf.typedArray!.set(source.typedArray!, targetObjectOffset * this.descriptor.vertexCount * buf.itemSize);
      buf.serial++;
    }
    return this;
  }

  /**
   * Throws on the buffer of a disposed pool: the copy goes through the constructor, which has
   * no data to build a second buffer from.
   */
  clone(): VertexObjectBuffer {
    return new VertexObjectBuffer(this, this.capacity).copy(this);
  }

  /**
   * Throws on the buffer of a disposed pool, which has no array to write into, and for a
   * buffer name this buffer does not know.
   */
  copyArray(source: TypedArray, bufferName: string, targetObjectOffset = 0): void {
    const buf = this.buffers.get(bufferName);
    if (buf == null) {
      // a name without a buffer means two different things, and a caller who mistyped one
      // should not be sent looking for a dispose() that never happened
      throw this.#released
        ? releasedError('copyArray()')
        : new Error(`VertexObjectBuffer#copyArray() does not know a buffer named "${bufferName}"`);
    }
    buf.typedArray!.set(source, targetObjectOffset * this.descriptor.vertexCount * buf.itemSize);
    buf.serial++;
  }

  /** Does nothing on the buffer of a disposed pool, which has no array left to move data within. */
  copyWithin(targetIndex: number, startIndex: number, endIndex = this.capacity): void {
    const {vertexCount} = this.descriptor;
    for (const buf of this.buffers.values()) {
      buf.typedArray!.copyWithin(
        targetIndex * vertexCount * buf.itemSize,
        startIndex * vertexCount * buf.itemSize,
        endIndex * vertexCount * buf.itemSize,
      );
      buf.serial++;
    }
  }

  /** Throws on the buffer of a disposed pool, which has no array to write into. */
  copyAttributes(attributes: Record<string, ArrayLike<number>>, targetObjectOffset = 0): number {
    let copiedObjCount = 0;
    for (const [attrName, data] of Object.entries(attributes)) {
      const attr = this.bufferAttributes.get(attrName);
      if (attr) {
        let attrObjCount = 0;
        // the attribute has a layout but its buffer is gone: the pool behind this buffer let go
        const buffer = this.buffers.get(attr.bufferName);
        if (buffer == null) {
          throw releasedError('copyAttributes()');
        }
        const typedArray = buffer.typedArray!;
        const {vertexCount} = this.descriptor;
        const attrSize = this.descriptor.getAttribute(attrName)!.size;
        let idx = 0;
        let bufIdx = targetObjectOffset * vertexCount * buffer.itemSize;
        while (idx < data.length && attrObjCount + targetObjectOffset < this.capacity) {
          for (let i = 0; i < vertexCount; i++) {
            const to = bufIdx + attr.offset;
            for (let k = 0; k < attrSize && idx + k < data.length; k++) {
              // the loop's own bound keeps `idx + k` below the length of data
              typedArray[to + k] = data[idx + k]!;
            }
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

  /** Throws on the buffer of a disposed pool, which has no array to read from. */
  toAttributeArrays(attributeNames: string[], startIndex = 0, endIndex = this.capacity): Record<string, TypedArray | undefined> {
    return Object.fromEntries(
      // the explicit tuple type picks the typed `Object.fromEntries()` overload; without it
      // the result is `any` and no caller of this method gets its lookups checked
      attributeNames.map((attrName): [string, TypedArray | undefined] => {
        const attr = this.bufferAttributes.get(attrName);
        if (attr) {
          // the attribute has a layout but its buffer is gone: the pool behind this buffer let go
          const buffer = this.buffers.get(attr.bufferName);
          if (buffer == null) {
            throw releasedError('toAttributeArrays()');
          }
          const typedArray = buffer.typedArray!;
          const {vertexCount} = this.descriptor;
          const attrSize = this.descriptor.getAttribute(attrName)!.size;

          const targetArray = createTypedArray(buffer.dataType, (endIndex - startIndex) * vertexCount * attrSize);

          let targetIdx = 0;
          let bufferIdx = startIndex * vertexCount * buffer.itemSize + attr.offset;

          for (let objIdx = startIndex; objIdx < endIndex; objIdx++) {
            for (let i = 0; i < vertexCount; i++) {
              targetArray.set(typedArray.subarray(bufferIdx, bufferIdx + attrSize), targetIdx);
              targetIdx += attrSize;
              bufferIdx += buffer.itemSize;
            }
          }
          return [attrName, targetArray];
        }
        return [attrName, undefined];
      }),
    );
  }

  /** Does nothing on the buffer of a disposed pool, which has no buffer left to mark. */
  touch(): void {
    for (const buffer of this.buffers.values()) {
      buffer.serial++;
    }
  }

  /**
   * Give up the typed array of every buffer and empty the buffer map.
   *
   * Called by the pool that owns this buffer as part of its `dispose()`. Afterwards the
   * buffer keeps saying what it was — `descriptor`, `capacity`, `attributeNames`,
   * `bufferAttributes` and `bufferNameAttributes` are untouched — but it holds no data:
   * every method that would read or write through a typed array refuses, and the two that
   * have nothing left to do go on doing nothing.
   *
   * @internal
   */
  release(): void {
    for (const buffer of this.buffers.values()) {
      buffer.typedArray = undefined;
    }
    this.buffers.clear();
    this.#released = true;
  }
}
