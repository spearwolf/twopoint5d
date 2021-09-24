import {VertexObjectBuffer} from './VertexObjectBuffer';
import {voBuffer, voIndex} from './constants';
import {createTypedArray} from './createTypedArray';
import {VO} from './types';

const toPascalCase = (str: string) => str.replace(/(^|_)([a-z])/g, (_match: string, _m0: string, m1: string) => m1.toUpperCase());

const makeAttributeGetter = (bufferName: string, instanceOffset: number, attrOffset: number) => {
  return function getAttribute(this: VO) {
    const idx = this[voIndex] * instanceOffset + attrOffset;
    const buf = this[voBuffer].buffers.get(bufferName);
    return buf.typedArray[idx];
  };
};

const makeAttributeSetter = (bufferName: string, instanceOffset: number, attrOffset: number) => {
  return function setAttribute(this: VO, value: number) {
    const idx = this[voIndex] * instanceOffset + attrOffset;
    const buf = this[voBuffer].buffers.get(bufferName);
    buf.typedArray[idx] = value;
  };
};

const makeAttributeValuesGetter = (
  bufferName: string,
  bufferItemSize: number,
  vertexCount: number,
  attrOffset: number,
  attrSize: number,
) => {
  return function getAttributeValues(this: VO) {
    const idx = this[voIndex] * vertexCount * bufferItemSize + attrOffset;
    const buf = this[voBuffer].buffers.get(bufferName);
    const source = buf.typedArray;
    const target = createTypedArray(buf.dataType, vertexCount * attrSize);
    for (let i = 0; i < vertexCount; i++) {
      if (attrSize === 1) {
        target[i] = source[idx + i * bufferItemSize];
      } else {
        target.set(source.subarray(idx + i * bufferItemSize, idx + i * bufferItemSize + attrSize), i * attrSize);
      }
    }
    return target;
  };
};

const makeAttributeValueSetter = (
  bufferName: string,
  bufferItemSize: number,
  vertexCount: number,
  attrOffset: number,
  attrSize: number,
) => {
  return function setAttributeValues(this: VO, ...values: number[] | [ArrayLike<number>]) {
    const source = values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
    const idx = this[voIndex] * vertexCount * bufferItemSize + attrOffset;
    const target = this[voBuffer].buffers.get(bufferName).typedArray;
    for (let i = 0; i < vertexCount; i++) {
      if (attrSize === 1) {
        target[idx + i * bufferItemSize] = source[i];
      } else {
        target.set(Array.prototype.slice.call(source, i * attrSize, i * attrSize + attrSize), idx + i * bufferItemSize);
      }
    }
  };
};

export function createVertexObjectPrototype(voBuffer: VertexObjectBuffer, basePrototype: Object | null | undefined): Object {
  const {descriptor} = voBuffer;
  const props = Object.fromEntries(
    descriptor.attributeNames.flatMap((attrName) => {
      const attr = descriptor.getAttribute(attrName);
      const bufAttr = voBuffer.bufferAttributes.get(attrName);
      const buf = voBuffer.buffers.get(bufAttr.bufferName);
      const AttrName = toPascalCase(attrName);

      const methods: any[] = [];
      if (descriptor.vertexCount === 1 && attr.size === 1) {
        methods.push([
          attrName,
          {
            enumerable: true,
            get: makeAttributeGetter(bufAttr.bufferName, buf.itemSize, bufAttr.offset),
            set: makeAttributeSetter(bufAttr.bufferName, buf.itemSize, bufAttr.offset),
          },
        ]);
      } else {
        methods.push(
          [
            `get${AttrName}`,
            {
              enumerable: true,
              value: makeAttributeValuesGetter(
                bufAttr.bufferName,
                buf.itemSize,
                descriptor.vertexCount,
                bufAttr.offset,
                attr.size,
              ),
            },
          ],
          [
            `set${AttrName}`,
            {
              enumerable: true,
              value: makeAttributeValueSetter(
                bufAttr.bufferName,
                buf.itemSize,
                descriptor.vertexCount,
                bufAttr.offset,
                attr.size,
              ),
            },
          ],
        );
      }
      if (attr.hasComponents) {
        attr.components.forEach((component, componentIndex) => {
          for (let vertexIndex = 0; vertexIndex < descriptor.vertexCount; vertexIndex++) {
            const instanceOffset = descriptor.vertexCount * buf.itemSize;
            const attrOffset = vertexIndex * buf.itemSize + bufAttr.offset + componentIndex;
            if (descriptor.vertexCount > 1 || component !== attr.name) {
              methods.push([
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
      return methods;
    }),
  );
  return Object.create(basePrototype !== undefined ? basePrototype : Object.prototype, props);
}
