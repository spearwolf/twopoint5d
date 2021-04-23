import {VertexObjectBuffer} from './VertexObjectBuffer';
import {voBuffer, voIndex} from './constants';
import {createTypedArray} from './createTypedArray';
import {VO} from './types';

const toPascalCase = (str: string) =>
  str.replace(/(^|_)([a-z])/g, (_match: string, _m0: string, m1: string) =>
    m1.toUpperCase(),
  );

const makeAttributeGetter = (
  bufferName: string,
  bufferItemSize: number,
  vertexCount: number,
  attrOffset: number,
  attrSize: number,
) => {
  // TODO only for attrSize > 1:
  return function getAttributeValues(this: VO) {
    const idx = this[voIndex] * vertexCount * bufferItemSize + attrOffset;
    const buf = this[voBuffer].buffers.get(bufferName);
    const source = buf.typedArray;
    const target = createTypedArray(buf.dataType, vertexCount * attrSize);
    for (let i = 0; i < vertexCount; i++) {
      target.set(
        source.subarray(
          idx + i * bufferItemSize,
          idx + i * bufferItemSize + attrSize,
        ),
        i * attrSize,
      );
    }
    return target;
  };
};

const makeAttributeSetter = (
  bufferName: string,
  bufferItemSize: number,
  vertexCount: number,
  attrOffset: number,
  attrSize: number,
) => {
  // TODO only for attrSize > 1:
  return function setAttributeValues(
    this: VO,
    ...values: number[] | [ArrayLike<number>]
  ) {
    const source =
      values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
    const idx = this[voIndex] * vertexCount * bufferItemSize + attrOffset;
    const target = this[voBuffer].buffers.get(bufferName).typedArray;
    for (let i = 0; i < vertexCount; i++) {
      target.set(
        Array.prototype.slice.call(
          source,
          i * attrSize,
          i * attrSize + attrSize,
        ),
        idx + i * bufferItemSize,
      );
    }
  };
};

export function createVertexObjectPrototype(
  voBuffer: VertexObjectBuffer,
  basePrototype: Object | null | undefined,
): Object {
  const {descriptor} = voBuffer;
  const props = Object.fromEntries(
    descriptor.attributeNames.flatMap((attrName) => {
      const attr = descriptor.getAttribute(attrName);
      const bufAttr = voBuffer.bufferAttributes.get(attrName);
      const buf = voBuffer.buffers.get(bufAttr.bufferName);
      const AttrName = toPascalCase(attrName);

      const methods = [
        [
          `get${AttrName}`,
          {
            enumerable: true,
            value: makeAttributeGetter(
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
            value: makeAttributeSetter(
              bufAttr.bufferName,
              buf.itemSize,
              descriptor.vertexCount,
              bufAttr.offset,
              attr.size,
            ),
          },
        ],
      ];
      if (attr.hasComponents) {
        methods.push(
          // @ts-ignore
          ...attr.components.map((component) => [
            component,
            {
              enumerable: true,
              // TODO make getter & setter
              get: () => 23,
            },
          ]),
        );
      }
      return methods;
    }),
  );
  return Object.create(
    basePrototype !== undefined ? basePrototype : Object.prototype,
    props,
  );
}
