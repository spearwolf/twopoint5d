import type {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {voBuffer, voIndex} from './constants.js';
import {createTypedArray} from './createTypedArray.js';
import type {TypedArray, VO} from './types.js';

const makeAttributeGetter = (bufferName: string, instanceOffset: number, attrOffset: number) => {
  return function getAttribute(this: VO) {
    // a vertex object alive in its pool has its buffer, that buffer holds its typed array and
    // carries every attribute of its descriptor; these accessors run per sprite and per frame,
    // so they assert that rather than pay for a check on every value
    const idx = this[voIndex] * instanceOffset + attrOffset;
    const buf = this[voBuffer]!.buffers.get(bufferName)!;
    return buf.typedArray![idx];
  };
};

const makeAttributeSetter = (bufferName: string, instanceOffset: number, attrOffset: number) => {
  return function setAttribute(this: VO, value: number) {
    // a vertex object alive in its pool has its buffer, that buffer holds its typed array and
    // carries every attribute of its descriptor; these accessors run per sprite and per frame,
    // so they assert that rather than pay for a check on every value
    const idx = this[voIndex] * instanceOffset + attrOffset;
    const buf = this[voBuffer]!.buffers.get(bufferName)!;
    buf.typedArray![idx] = value;
  };
};

const makeAttributeValuesGetter = (
  bufferName: string,
  bufferItemSize: number,
  vertexCount: number,
  attrOffset: number,
  attrSize: number,
  attrName: string,
  getterName: string,
) => {
  const count = vertexCount * attrSize;
  return function getAttributeValues(this: VO, target?: TypedArray | number[]) {
    // a vertex object alive in its pool has its buffer, that buffer holds its typed array and
    // carries every attribute of its descriptor; these accessors run per sprite and per frame,
    // so they assert that rather than pay for a check on every value
    const idx = this[voIndex] * vertexCount * bufferItemSize + attrOffset;
    const buf = this[voBuffer]!.buffers.get(bufferName)!;
    const source = buf.typedArray!;
    if (target != null && target.length < count) {
      throw new RangeError(`${getterName}(): the target holds ${target.length} values, attribute "${attrName}" has ${count}`);
    }
    const out = target ?? createTypedArray(buf.dataType, count);
    // element by element, not subarray(): subarray() allocates a new view per vertex, which is
    // exactly the per-frame allocation this accessor is meant to avoid
    for (let i = 0; i < vertexCount; i++) {
      for (let j = 0; j < attrSize; j++) {
        out[i * attrSize + j] = source[idx + i * bufferItemSize + j]!;
      }
    }
    return out;
  };
};

const writeValues = (
  target: TypedArray,
  idx: number,
  source: ArrayLike<number>,
  vertexCount: number,
  bufferItemSize: number,
  attrSize: number,
): void => {
  const {length} = source;
  for (let i = 0, from = 0; i < vertexCount; i++, from += attrSize) {
    const to = idx + i * bufferItemSize;
    for (let j = 0; j < attrSize && from + j < length; j++) {
      // the loop's own bound keeps from + j inside source, so undefined here is an element the
      // caller handed in as undefined: it leaves the value as it was
      const value = source[from + j];
      if (value !== undefined) target[to + j] = value;
    }
  }
};

const makeAttributeValueSetter = (
  bufferName: string,
  bufferItemSize: number,
  vertexCount: number,
  attrOffset: number,
  attrSize: number,
) => {
  return function setAttributeValues(this: VO, ...values: number[] | [ArrayLike<number>]) {
    // a vertex object alive in its pool has its buffer, that buffer holds its typed array and
    // carries every attribute of its descriptor; these accessors run per sprite and per frame,
    // so they assert that rather than pay for a check on every value
    const first = values[0];
    const source: ArrayLike<number> = values.length === 1 && typeof first !== 'number' ? first : (values as number[]);
    const idx = this[voIndex] * vertexCount * bufferItemSize + attrOffset;
    const target = this[voBuffer]!.buffers.get(bufferName)!.typedArray!;
    writeValues(target, idx, source, vertexCount, bufferItemSize, attrSize);
  };
};

const makeFixedAttributeValueSetter = (
  bufferName: string,
  bufferItemSize: number,
  vertexCount: number,
  attrOffset: number,
  attrSize: number,
) => {
  const count = vertexCount * attrSize;
  const offsetOf = (k: number) => Math.floor(k / attrSize) * bufferItemSize + (k % attrSize);
  const o0 = offsetOf(0);
  const o1 = offsetOf(1);
  const o2 = offsetOf(2);
  const o3 = offsetOf(3);
  // declared one by one, not as a rest parameter: a rest parameter allocates a fresh array on
  // every call, and these setters run per sprite and per frame
  return function setAttributeValues(this: VO, v0?: number | ArrayLike<number>, v1?: number, v2?: number, v3?: number) {
    // a vertex object alive in its pool has its buffer, that buffer holds its typed array and
    // carries every attribute of its descriptor; these accessors run per sprite and per frame,
    // so they assert that rather than pay for a check on every value
    const idx = this[voIndex] * vertexCount * bufferItemSize + attrOffset;
    const target = this[voBuffer]!.buffers.get(bufferName)!.typedArray!;
    if (typeof v0 === 'object' && v0 !== null) {
      writeValues(target, idx, v0, vertexCount, bufferItemSize, attrSize);
      return;
    }
    if (v0 !== undefined) target[idx + o0] = v0;
    if (count > 1 && v1 !== undefined) target[idx + o1] = v1;
    if (count > 2 && v2 !== undefined) target[idx + o2] = v2;
    if (count > 3 && v3 !== undefined) target[idx + o3] = v3;
  };
};

export function createVertexObjectPrototype(voBuffer: VertexObjectBuffer): object {
  const {descriptor} = voBuffer;
  const {methods} = descriptor;

  const entries = descriptor.attributeNames.flatMap((attrName) => {
    const attr = descriptor.getAttribute(attrName)!;
    const bufAttr = voBuffer.bufferAttributes.get(attrName)!;
    const buf = voBuffer.buffers.get(bufAttr.bufferName)!;

    const attrEntries: [string, PropertyDescriptor][] = [];

    if (descriptor.vertexCount === 1 && attr.size === 1) {
      attrEntries.push([
        attrName,
        {
          enumerable: true,
          get: makeAttributeGetter(bufAttr.bufferName, buf.itemSize, bufAttr.offset),
          set: makeAttributeSetter(bufAttr.bufferName, buf.itemSize, bufAttr.offset),
        },
      ]);
    } else {
      // `getter: false` / `setter: false` leave the name undefined: the attribute gets no accessor
      if (attr.getterName != null) {
        attrEntries.push([
          attr.getterName,
          {
            enumerable: true,
            value: makeAttributeValuesGetter(
              bufAttr.bufferName,
              buf.itemSize,
              descriptor.vertexCount,
              bufAttr.offset,
              attr.size,
              attr.name,
              attr.getterName,
            ),
          },
        ]);
      }
      if (attr.setterName != null) {
        const count = descriptor.vertexCount * attr.size;
        attrEntries.push([
          attr.setterName,
          {
            enumerable: true,
            value:
              count <= 4
                ? makeFixedAttributeValueSetter(
                    bufAttr.bufferName,
                    buf.itemSize,
                    descriptor.vertexCount,
                    bufAttr.offset,
                    attr.size,
                  )
                : makeAttributeValueSetter(bufAttr.bufferName, buf.itemSize, descriptor.vertexCount, bufAttr.offset, attr.size),
          },
        ]);
      }
    }

    if (attr.hasComponents) {
      attr.components.forEach((component, componentIndex) => {
        for (let vertexIndex = 0; vertexIndex < descriptor.vertexCount; vertexIndex++) {
          const instanceOffset = descriptor.vertexCount * buf.itemSize;
          const attrOffset = vertexIndex * buf.itemSize + bufAttr.offset + componentIndex;
          // a component is skipped only where it coincides with the attribute accessor above: one
          // vertex, size 1 and the same name address the very same slot
          if (descriptor.vertexCount > 1 || attr.size > 1 || component !== attr.name) {
            attrEntries.push([
              `${component}${descriptor.vertexCount === 1 ? '' : vertexIndex}`,
              {
                enumerable: true,
                get: makeAttributeGetter(bufAttr.bufferName, instanceOffset, attrOffset),
                set: makeAttributeSetter(bufAttr.bufferName, instanceOffset, attrOffset),
              },
            ]);
          }
        }
      });
    }
    return attrEntries;
  });

  if (methods) {
    entries.push(
      ...Object.entries(methods)
        .filter(([, val]) => typeof val === 'function')
        .map(([key, value]): [string, PropertyDescriptor] => [key, {value}]),
    );
  }

  const props = Object.fromEntries(entries);

  return Object.create(descriptor.basePrototype ?? Object.prototype, props);
}
