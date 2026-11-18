import {BufferGeometry} from 'three/webgpu';
import {expectDefined} from '../utils/expectDefined.js';
import {InstancedVOBufferGeometry} from './InstancedVOBufferGeometry.js';
import type {VertexObjectDescription, VO} from './types.js';
import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectPool} from './VertexObjectPool.js';
import {checkPoolCapacity} from './checkPoolCapacity.js';

const asPool = <T>(
  pool: VertexObjectPool<T> | VertexObjectDescriptor | VertexObjectDescription,
  capacity = 1,
): VertexObjectPool<T> => (pool instanceof VertexObjectPool ? pool : new VertexObjectPool<T>(pool, capacity));

/**
 * An {@link InstancedVOBufferGeometry} over two typed pools: `VOBaseType` objects make up the base
 * geometry, `VOInstancedType` objects the instances. The typed layer on top of the geometry that
 * works on buffer indices alone.
 */
export class InstancedVertexObjectGeometry<VOInstancedType extends VO, VOBaseType extends VO> extends InstancedVOBufferGeometry {
  declare readonly basePool?: VertexObjectPool<VOBaseType>;
  declare readonly instancedPool: VertexObjectPool<VOInstancedType>;

  /**
   * Builds the instanced pool and the base from a pool, a descriptor or a description each, or
   * takes the base from a `BufferGeometry`, as {@link InstancedVOBufferGeometry} does.
   *
   * @throws a `RangeError` when the instanced source is a pool and the capacity is not its
   *   capacity, and when the base source is a pool and a base capacity follows that is not its
   *   capacity: a geometry takes its sizes from the pools it is handed, so the caller hands in
   *   `pool.capacity`, or leaves the base capacity out. The check comes before anything else, and
   *   the pools are left as they were.
   * @throws what the constructor of {@link InstancedVOBufferGeometry} throws. Whatever this
   *   constructor throws, a pool it built from a descriptor or description is disposed, and a
   *   pool handed in is left as it was.
   */
  constructor(
    ...args:
      | [VertexObjectPool<VOInstancedType> | VertexObjectDescriptor | VertexObjectDescription, number, BufferGeometry]
      | [
          VertexObjectPool<VOInstancedType> | VertexObjectDescriptor | VertexObjectDescription,
          number,
          VertexObjectPool<VOBaseType> | VertexObjectDescriptor | VertexObjectDescription,
          number?,
        ]
  ) {
    if (args[0] instanceof VertexObjectPool) {
      checkPoolCapacity('new InstancedVertexObjectGeometry()', 'capacity', 'the instanced pool', args[0], args[1]);
    }
    if (args[2] instanceof VertexObjectPool && args[3] !== undefined) {
      checkPoolCapacity('new InstancedVertexObjectGeometry()', 'the base capacity', 'the base pool', args[2], args[3]);
    }

    const instancedPool = asPool<VOInstancedType>(args[0], args[1]);
    const buildsInstanced = !(args[0] instanceof VertexObjectPool);
    const buildsBase = !(args[2] instanceof BufferGeometry) && !(args[2] instanceof VertexObjectPool);
    let basePool: VertexObjectPool<VOBaseType> | undefined;
    try {
      if (args[2] instanceof BufferGeometry) {
        super(instancedPool, args[1], args[2]);
      } else {
        basePool = asPool<VOBaseType>(args[2], args[3] ?? 1);
        super(instancedPool, args[1], basePool, args[3]);
      }
    } catch (error) {
      // a constructor that throws leaves nothing behind: super() only ever sees pools and cannot
      // tell which of them were built here, so the pools built above go here
      if (buildsInstanced) instancedPool.dispose();
      if (buildsBase) basePool?.dispose();
      throw error;
    }

    this.name = 'InstancedVertexObjectGeometry';

    // the pools built above belong to this geometry; super() only ever sees pools and cannot tell
    if (buildsInstanced) {
      this.declareOwnedPool(this.instancedPool);
    }
    if (buildsBase) {
      this.declareOwnedPool(expectDefined(this.basePool, 'the base pool'));
    }
  }
}
