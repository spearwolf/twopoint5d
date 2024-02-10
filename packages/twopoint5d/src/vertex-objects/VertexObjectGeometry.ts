import type {VertexObjectDescription, VO} from './types.js';
import {VOBufferGeometry} from './VOBufferGeometry.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectPool} from './VertexObjectPool.js';

export class VertexObjectGeometry<VOType extends VO> extends VOBufferGeometry {
  declare readonly pool: VertexObjectPool<VOType>;

  constructor(source: VertexObjectPool<VOType> | VertexObjectDescriptor | VertexObjectDescription, capacity: number) {
    super(source instanceof VertexObjectPool ? source : new VertexObjectPool(source, capacity), capacity);
    this.name = 'VertexObjectGeometry';
  }
}
