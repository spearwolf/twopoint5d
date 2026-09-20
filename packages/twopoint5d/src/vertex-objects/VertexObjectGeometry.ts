import type {VertexObjectDescription, VO} from './types.js';
import {VOBufferGeometry} from './VOBufferGeometry.js';
import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectPool} from './VertexObjectPool.js';

/**
 * A {@link VOBufferGeometry} over a {@link VertexObjectPool}`<VOType>`: the typed layer on top of
 * the geometry that works on buffer indices alone.
 */
export class VertexObjectGeometry<VOType extends VO> extends VOBufferGeometry {
  declare readonly pool: VertexObjectPool<VOType>;

  constructor(source: VertexObjectPool<VOType> | VertexObjectDescriptor | VertexObjectDescription, capacity: number) {
    super(source instanceof VertexObjectPool ? source : new VertexObjectPool(source, capacity), capacity);
    this.name = 'VertexObjectGeometry';

    // the pool built above belongs to this geometry; super() only ever sees a pool and cannot tell
    if (!(source instanceof VertexObjectPool)) {
      this.declareOwnedPool(this.pool);
    }
  }
}
