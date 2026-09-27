import type {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {voBuffer, voIndex} from './constants.js';
import {createTypedArray} from './createTypedArray.js';
import type {TypedArray, VO} from './types.js';

// read once into constants of this module, so the accessors below never touch an imported binding:
// a module runner that rewrites imports, as the one Vitest runs specs and benches in does, turns
// every read of one into a property read on a module object — two per value in each accessor, and
// the benches would time the runner instead of the accessors
const bufferKey: typeof voBuffer = voBuffer;
const indexKey: typeof voIndex = voIndex;

// every descriptor builds its accessors from the factories below, and V8 gives all closures of one
// function literal one set of inline caches. A loop over the vertex objects of one pool inlines the
// accessor and knows the prototype already, so that costs nothing measurable; docs/architecture.md
// (the section on vertex-objects/) has the numbers and says why the accessors are not generated per
// descriptor
const makeAttributeGetter = (bufferIndex: number, instanceOffset: number, attrOffset: number) => {
  return function getAttribute(this: VO) {
    // a vertex object alive in its pool has its buffer, that buffer holds its typed array and
    // lists the record of every buffer of its descriptor at the position this accessor was built
    // with; these accessors run per sprite and per frame, so they assert that rather than pay for
    // a check on every value
    const idx = this[indexKey] * instanceOffset + attrOffset;
    const buf = this[bufferKey]!.bufferList[bufferIndex]!;
    return buf.typedArray![idx];
  };
};

const makeAttributeSetter = (bufferIndex: number, instanceOffset: number, attrOffset: number) => {
  return function setAttribute(this: VO, value: number) {
    // a vertex object alive in its pool has its buffer, that buffer holds its typed array and
    // lists the record of every buffer of its descriptor at the position this accessor was built
    // with; these accessors run per sprite and per frame, so they assert that rather than pay for
    // a check on every value
    const idx = this[indexKey] * instanceOffset + attrOffset;
    const buf = this[bufferKey]!.bufferList[bufferIndex]!;
    buf.typedArray![idx] = value;
  };
};

const makeAttributeValuesGetter = (
  bufferIndex: number,
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
    // lists the record of every buffer of its descriptor at the position this accessor was built
    // with; these accessors run per sprite and per frame, so they assert that rather than pay for
    // a check on every value
    const idx = this[indexKey] * vertexCount * bufferItemSize + attrOffset;
    const buf = this[bufferKey]!.bufferList[bufferIndex]!;
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

const makeFixedAttributeValueSetter = (
  bufferIndex: number,
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
    // lists the record of every buffer of its descriptor at the position this accessor was built
    // with; these accessors run per sprite and per frame, so they assert that rather than pay for
    // a check on every value
    const idx = this[indexKey] * vertexCount * bufferItemSize + attrOffset;
    const target = this[bufferKey]!.bufferList[bufferIndex]!.typedArray!;
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

// sixteen values cover a quad of four vertices with four values each — a vec4 attribute. The
// parameters are declared one by one: a rest parameter, and `arguments` read with many separate
// values, make V8 build an object on every call, and these setters may run per object and per frame
const makeWideAttributeValueSetter = (
  bufferIndex: number,
  bufferItemSize: number,
  vertexCount: number,
  attrOffset: number,
  attrSize: number,
) => {
  const count = vertexCount * attrSize;
  // the same formula as offsetOf() of the fixed setter above
  const offsets = Array.from({length: count}, (_, k) => Math.floor(k / attrSize) * bufferItemSize + (k % attrSize));
  return function setAttributeValues(
    this: VO,
    v0?: number | ArrayLike<number>,
    v1?: number,
    v2?: number,
    v3?: number,
    v4?: number,
    v5?: number,
    v6?: number,
    v7?: number,
    v8?: number,
    v9?: number,
    v10?: number,
    v11?: number,
    v12?: number,
    v13?: number,
    v14?: number,
    v15?: number,
  ) {
    // a vertex object alive in its pool has its buffer, that buffer holds its typed array and
    // lists the record of every buffer of its descriptor at the position this accessor was built
    // with; these accessors run per sprite and per frame, so they assert that rather than pay for
    // a check on every value
    const idx = this[indexKey] * vertexCount * bufferItemSize + attrOffset;
    const target = this[bufferKey]!.bufferList[bufferIndex]!.typedArray!;
    if (typeof v0 === 'object' && v0 !== null) {
      writeValues(target, idx, v0, vertexCount, bufferItemSize, attrSize);
      return;
    }
    // v0 needs no check against count, which is five at least
    if (v0 !== undefined) target[idx + offsets[0]!] = v0;
    if (count > 1 && v1 !== undefined) target[idx + offsets[1]!] = v1;
    if (count > 2 && v2 !== undefined) target[idx + offsets[2]!] = v2;
    if (count > 3 && v3 !== undefined) target[idx + offsets[3]!] = v3;
    if (count > 4 && v4 !== undefined) target[idx + offsets[4]!] = v4;
    if (count > 5 && v5 !== undefined) target[idx + offsets[5]!] = v5;
    if (count > 6 && v6 !== undefined) target[idx + offsets[6]!] = v6;
    if (count > 7 && v7 !== undefined) target[idx + offsets[7]!] = v7;
    if (count > 8 && v8 !== undefined) target[idx + offsets[8]!] = v8;
    if (count > 9 && v9 !== undefined) target[idx + offsets[9]!] = v9;
    if (count > 10 && v10 !== undefined) target[idx + offsets[10]!] = v10;
    if (count > 11 && v11 !== undefined) target[idx + offsets[11]!] = v11;
    if (count > 12 && v12 !== undefined) target[idx + offsets[12]!] = v12;
    if (count > 13 && v13 !== undefined) target[idx + offsets[13]!] = v13;
    if (count > 14 && v14 !== undefined) target[idx + offsets[14]!] = v14;
    if (count > 15 && v15 !== undefined) target[idx + offsets[15]!] = v15;
  };
};

// read through `arguments` rather than a rest parameter: a rest parameter builds an array on every
// call, 56 B even around a single array-like. `arguments` stays free with an array-like, while
// separate values make V8 build the object on every call (112 B with twelve values, measured on
// Node 24) — which is why the setters of up to sixteen values declare their parameters
const makeAttributeValueSetter = (
  bufferIndex: number,
  bufferItemSize: number,
  vertexCount: number,
  attrOffset: number,
  attrSize: number,
) => {
  const count = vertexCount * attrSize;
  return function setAttributeValues(this: VO) {
    // a vertex object alive in its pool has its buffer, that buffer holds its typed array and
    // lists the record of every buffer of its descriptor at the position this accessor was built
    // with; these accessors run per sprite and per frame, so they assert that rather than pay for
    // a check on every value
    const idx = this[indexKey] * vertexCount * bufferItemSize + attrOffset;
    const target = this[bufferKey]!.bufferList[bufferIndex]!.typedArray!;
    // eslint-disable-next-line prefer-rest-params -- see the comment above the factory
    const first: unknown = arguments[0];
    if (typeof first === 'object' && first !== null) {
      writeValues(target, idx, first as ArrayLike<number>, vertexCount, bufferItemSize, attrSize);
      return;
    }
    // the loop stays in here: handing `arguments` to a function would make V8 build the object
    const n = Math.min(arguments.length, count);
    for (let k = 0; k < n; k++) {
      // eslint-disable-next-line prefer-rest-params -- see the comment above the factory
      const value: unknown = arguments[k];
      if (value !== undefined) target[idx + Math.floor(k / attrSize) * bufferItemSize + (k % attrSize)] = value as number;
    }
  };
};

// the generated set…() of an attribute takes up to FIXED_SETTER_VALUES values in the setter the
// sprites call per frame, whose small bytecode keeps it inlinable, up to WIDE_SETTER_VALUES in one
// with as many declared parameters, and more through `arguments`
const FIXED_SETTER_VALUES = 4;
const WIDE_SETTER_VALUES = 16;

export function createVertexObjectPrototype(voBuffer: VertexObjectBuffer): object {
  const {descriptor} = voBuffer;
  const {methods} = descriptor;

  const entries = descriptor.attributeNames.flatMap((attrName) => {
    const attr = descriptor.getAttribute(attrName)!;
    const bufAttr = voBuffer.bufferAttributes.get(attrName)!;
    const buf = voBuffer.buffers.get(bufAttr.bufferName)!;
    const bufferIndex = voBuffer.bufferList.indexOf(buf);

    const attrEntries: [string, PropertyDescriptor][] = [];

    if (descriptor.vertexCount === 1 && attr.size === 1) {
      attrEntries.push([
        attrName,
        {
          enumerable: true,
          get: makeAttributeGetter(bufferIndex, buf.itemSize, bufAttr.offset),
          set: makeAttributeSetter(bufferIndex, buf.itemSize, bufAttr.offset),
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
              bufferIndex,
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
              count <= FIXED_SETTER_VALUES
                ? makeFixedAttributeValueSetter(bufferIndex, buf.itemSize, descriptor.vertexCount, bufAttr.offset, attr.size)
                : count <= WIDE_SETTER_VALUES
                  ? makeWideAttributeValueSetter(bufferIndex, buf.itemSize, descriptor.vertexCount, bufAttr.offset, attr.size)
                  : makeAttributeValueSetter(bufferIndex, buf.itemSize, descriptor.vertexCount, bufAttr.offset, attr.size),
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
                get: makeAttributeGetter(bufferIndex, instanceOffset, attrOffset),
                set: makeAttributeSetter(bufferIndex, instanceOffset, attrOffset),
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
