import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {voBuffer} from './constants.js';
import type {VO} from './types.js';

/** The descriptor of the vertex object, or `undefined` once its pool has let it go. */
export function getDescriptorOf(vo: VO): VertexObjectDescriptor | undefined {
  return vo[voBuffer]?.descriptor;
}
