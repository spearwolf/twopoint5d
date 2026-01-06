import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {voBuffer} from './constants.js';
import type {VO} from './types.js';

export function getDescriptorOf(vo: VO): VertexObjectDescriptor {
  return vo[voBuffer]?.descriptor;
}
