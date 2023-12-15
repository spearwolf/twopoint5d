import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {voBuffer, voIndex, voInitialize} from './constants.js';

export const createVertexObject = (descriptor: VertexObjectDescriptor, buffer: VertexObjectBuffer, objectIndex: number) => {
  const vo = Object.create(descriptor.voPrototype, {
    [voBuffer]: {
      value: buffer,
      writable: true,
    },
    [voIndex]: {
      value: objectIndex,
      writable: true,
    },
  });

  vo[voInitialize]?.();

  return vo;
};
