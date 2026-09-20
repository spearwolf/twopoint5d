import {checkBufferArray} from './checkBufferArray.js';
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
  /** The lowest object index written since `dirtySince`; `-1` while nothing is recorded. */
  dirtyFrom: number;
  /** The highest object index written since `dirtySince`; `-1` while nothing is recorded. */
  dirtyTo: number;
  /**
   * The serial this buffer carried when the current range started to collect. A consumer that
   * last saw this serial or a later one has everything from before the range on the gpu already.
   */
  dirtySince: number;
  /**
   * The highest serial a consumer has taken a range for. Once it has caught up with `serial`,
   * the next write starts a fresh range instead of widening the one that is there — which is how
   * the range gets narrow again without anyone clearing it.
   */
  pickedUpSerial: number;
}

// one message for every method that refuses to work once the pool behind this buffer has
// given up its typed arrays, so the class, the method and the state are always in the text
// a caller reads out of a foreign stack
function releasedError(method: string): Error {
  return new Error(`VertexObjectBuffer#${method} is not available: the pool behind this buffer has been disposed`);
}

/**
 * The typed arrays themselves, together with the layout that maps an attribute to its slice of
 * them. It belongs to the side without an object type although its name carries the long prefix:
 * a {@link VOBufferPool} holds one just as a {@link VertexObjectPool} does.
 */
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
   * The capacity, given as a number or as `buffersData.capacity`, has to be an integer of 0 or
   * more; beyond that this constructor checks it against nothing. A
   * `VOBufferPool` carries its own `capacity`, fixed at construction, which does not follow
   * whatever buffer is later assigned to `pool.buffer` — assigning a buffer built here with a
   * differing `buffersData.capacity` leaves pool and buffer disagreeing about size, silently.
   * Use `VOBufferPool#fromBuffersData()` to restore a pool from `toBuffersData()` output: it
   * reconciles the two and throws on a capacity mismatch instead of leaving one.
   *
   * Every array in `buffersData` has to be the typed array of its buffer's data type and hold
   * exactly `capacity × vertexCount × itemSize` elements; otherwise the constructor throws a
   * `TypeError` or a `RangeError` that names the buffer.
   *
   * @throws when `source` is the buffer of a disposed pool, which has no data to build a second
   * buffer from
   * @throws a `RangeError` that names the value when the capacity, given as a number or as
   * `buffersData.capacity`, is no integer of 0 or more
   */
  constructor(source: VertexObjectDescriptor | VertexObjectBuffer, capacityOrBuffersData: number | VertexObjectBuffersData) {
    if (source instanceof VertexObjectBuffer && source.#released) {
      throw new Error(
        'VertexObjectBuffer: the source buffer holds no typed array any more — the pool behind it has been disposed. ' +
          'Copy the buffer before the pool is disposed, or build a new one from the descriptor.',
      );
    }

    const capacity = typeof capacityOrBuffersData === 'number' ? capacityOrBuffersData : capacityOrBuffersData.capacity;

    // the rule the pools measure a capacity by: a fraction or NaN would yield typed arrays of a
    // truncated or empty length, and `capacity` would then state something no array holds
    if (capacity < 0 || !Number.isInteger(capacity)) {
      const name = typeof capacityOrBuffersData === 'number' ? 'capacity' : 'buffersData.capacity';
      throw new RangeError(`VertexObjectBuffer: ${name} must be a non-negative integer, got ${String(capacity)}`);
    }

    this.capacity = capacity;
    const buffersData = typeof capacityOrBuffersData === 'number' ? undefined : capacityOrBuffersData;

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
          typedArray: this.#takeOrCreateArray(buffersData, bufferName, buffer.dataType, buffer.itemSize),
          serial: 0,
          dirtyFrom: -1,
          dirtyTo: -1,
          dirtySince: 0,
          pickedUpSerial: 0,
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
            dirtyFrom: -1,
            dirtyTo: -1,
            dirtySince: 0,
            pickedUpSerial: 0,
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
          typedArray: this.#takeOrCreateArray(buffersData, buffer.bufferName, buffer.dataType, buffer.itemSize),
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
   * Book the objects `fromIdx` … `toIdx` of `buf` as written: the range they fall into grows to
   * hold them, and the serial says that something happened.
   *
   * The serial rises even when the range comes out empty — a write outside the slots this buffer
   * has is still a write. The range then stays the one that was already there, and only a
   * consumer that meets no range at all falls back to everything in use.
   */
  #markDirty(buf: AttributeBuffer, fromIdx: number, toIdx: number): void {
    const from = Math.max(0, fromIdx);
    const to = Math.min(this.capacity - 1, toIdx);
    if (from <= to) {
      // everyone who ever asked has taken the range that is there, so it has done its work and
      // the objects written now are a range of their own
      if (buf.pickedUpSerial === buf.serial || buf.dirtyFrom < 0) {
        buf.dirtySince = buf.serial;
        buf.dirtyFrom = from;
        buf.dirtyTo = to;
      } else {
        buf.dirtyFrom = Math.min(buf.dirtyFrom, from);
        buf.dirtyTo = Math.max(buf.dirtyTo, to);
      }
    }
    buf.serial++;
  }

  /**
   * What a consumer that last saw `seenSerial` has left to upload of `bufferName`: the objects
   * `from` … `to`, capped at the slots in use, or `null` when the buffer has not moved on since.
   *
   * A consumer further behind than the current range reaches gets every object in use — what
   * happened before the range began is recorded nowhere. Taking a range up counts as having
   * caught up, so the next write can start a range of its own.
   */
  pickUpDirtyRange(bufferName: string, seenSerial: number | undefined, usedCount: number): {from: number; to: number} | null {
    // the pool behind this buffer has let go, so there is nothing left to upload from it
    const buf = this.buffers.get(bufferName);
    if (buf == null) return null;

    if (seenSerial === buf.serial) return null;

    buf.pickedUpSerial = buf.serial;

    if (seenSerial === undefined || seenSerial < buf.dirtySince || buf.dirtyFrom < 0) {
      return {from: 0, to: usedCount - 1};
    }

    const from = buf.dirtyFrom;
    const to = Math.min(buf.dirtyTo, usedCount - 1);
    // what was written lies beyond the slots in use, so there is a write but nothing to carry
    return from > to ? {from: 0, to: -1} : {from, to};
  }

  // an array from buffersData is taken over by reference, so it has to fit the layout exactly
  #takeOrCreateArray(
    buffersData: VertexObjectBuffersData | undefined,
    bufferName: string,
    dataType: VertexAttributeDataType,
    itemSize: number,
  ): TypedArray {
    const length = this.capacity * this.descriptor.vertexCount * itemSize;
    const array = buffersData?.buffers[bufferName];
    if (array == null) {
      return createTypedArray(dataType, length);
    }
    checkBufferArray('VertexObjectBuffer', bufferName, array, dataType, length, 'exact');
    return array;
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
      this.#markDirty(buf, targetObjectOffset, targetObjectOffset + other.capacity - 1);
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
    // as many objects as the source fills, rounded up: a source that ends inside an object still
    // wrote into that object
    const objCount = Math.ceil(source.length / (this.descriptor.vertexCount * buf.itemSize));
    this.#markDirty(buf, targetObjectOffset, targetObjectOffset + objCount - 1);
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
      this.#markDirty(buf, targetIndex, targetIndex + (endIndex - startIndex) - 1);
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
        // an attribute that filled no object wrote nothing, and a buffer nothing was written to
        // has not moved on
        if (attrObjCount > 0) {
          this.#markDirty(buffer, targetObjectOffset, targetObjectOffset + attrObjCount - 1);
        }
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

  /**
   * Mark the objects `fromIdx` … `toIdx` as written in every buffer. Without arguments every
   * object of this buffer counts as written — what a caller that cannot say more has to state.
   *
   * Does nothing on the buffer of a disposed pool, which has no buffer left to mark.
   */
  touch(fromIdx = 0, toIdx = this.capacity - 1): void {
    for (const buffer of this.buffers.values()) {
      this.#markDirty(buffer, fromIdx, toIdx);
    }
  }

  /**
   * Mark the objects `fromIdx` … `toIdx` as written in the one buffer `bufferName`, for a caller
   * that knows which of them it wrote to. A name this buffer does not know marks nothing.
   *
   * Does nothing on the buffer of a disposed pool, which has no buffer left to mark.
   */
  touchBuffer(bufferName: string, fromIdx = 0, toIdx = this.capacity - 1): void {
    const buffer = this.buffers.get(bufferName);
    if (buffer != null) {
      this.#markDirty(buffer, fromIdx, toIdx);
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
