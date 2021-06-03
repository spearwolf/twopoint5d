import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {voBuffer} from './constants';
import {VO} from './types';

export function getDescriptorOf(vo: VO): VertexObjectDescriptor {
  return vo[voBuffer].descriptor;
}
