import type {VertexObjectBuffer} from './VertexObjectBuffer.js';
import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {voBuffer, voIndex} from './constants.js';
import type {voInitialize} from './constants.js';
import type {VO} from './types.js';

// what createVertexObject() hands the pool: the accessors VOType names, the slot the vertex
// object occupies, and the voInitialize hook its basePrototype may carry
type NewVertexObject<VOType> = VOType & VO & {[voInitialize]?: () => unknown};

export const createVertexObject = <VOType>(
  descriptor: VertexObjectDescriptor,
  buffer: VertexObjectBuffer,
  objectIndex: number,
): NewVertexObject<VOType> =>
  // Object.create() answers any: the accessors come from the prototype the descriptor built out of
  // its description, and VOType is the pool's word for what that description generates
  Object.create(descriptor.voPrototype, {
    [voBuffer]: {value: buffer, writable: true},
    [voIndex]: {value: objectIndex, writable: true},
  }) as NewVertexObject<VOType>;
