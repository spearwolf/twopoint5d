import type {VertexObjectDescription, VO} from './types.js';
import {VOBufferGeometry} from './VOBufferGeometry.js';
import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectPool} from './VertexObjectPool.js';
import {checkPoolCapacity} from './checkPoolCapacity.js';

/**
 * A {@link VOBufferGeometry} over a {@link VertexObjectPool}`<VOType>`: the typed layer on top of
 * the geometry that works on buffer indices alone.
 */
export class VertexObjectGeometry<VOType extends VO> extends VOBufferGeometry {
  declare readonly pool: VertexObjectPool<VOType>;

  /**
   * Builds the pool from a pool, a descriptor or a description, as {@link VOBufferGeometry} does.
   *
   * @throws a `RangeError` when `source` is a pool and `capacity` is not its capacity: a geometry
   *   takes its size from the pool it is handed, so the caller hands in `pool.capacity`. The check
   *   comes before anything else, and the pool is left as it was.
   * @throws what the constructor of {@link VOBufferGeometry} throws. Whatever this constructor
   *   throws, a pool it built from a descriptor or description is disposed, and a pool handed in
   *   is left as it was.
   */
  constructor(source: VertexObjectPool<VOType> | VertexObjectDescriptor | VertexObjectDescription, capacity: number) {
    if (source instanceof VertexObjectPool) {
      checkPoolCapacity('new VertexObjectGeometry()', 'capacity', 'the pool', source, capacity);
    }

    const buildsPool = !(source instanceof VertexObjectPool);
    const pool = buildsPool ? new VertexObjectPool<VOType>(source, capacity) : source;
    try {
      super(pool, capacity);
    } catch (error) {
      // super() only ever sees a pool and cannot tell that it was built here, so the pool built
      // above is disposed here
      if (buildsPool) pool.dispose();
      throw error;
    }
    this.name = 'VertexObjectGeometry';

    // the pool built above belongs to this geometry
    if (buildsPool) {
      this.declareOwnedPool(this.pool);
    }
  }
}
