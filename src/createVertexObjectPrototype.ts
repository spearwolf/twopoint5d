import {VertexObjectBuffer} from './VertexObjectBuffer';
import {voBuffer, voIndex} from './constants';
import {VertexObject} from './types';

const makeSetAttributeValues = (
  bufferName: string,
  bufferItemSize: number,
  vertexCount: number,
  attrOffset: number,
  attrSize: number,
) => {
  return function setAttributeValues(this: VertexObject, numbers: number[]) {
    const idx = this[voIndex] * vertexCount * bufferItemSize + attrOffset;
    for (let i = 0; i < vertexCount; i++) {
      this[voBuffer].buffers
        .get(bufferName)
        .typedArray.set(
          numbers.slice(i * attrSize, i * attrSize + attrSize),
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
      // const attrSize = attr.size;
      const bufAttr = voBuffer.bufferAttributes.get(attrName);
      const buf = voBuffer.buffers.get(bufAttr.bufferName);

      const methods = [
        [
          attrName,
          {
            get: () => 42,
            set: makeSetAttributeValues(
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
