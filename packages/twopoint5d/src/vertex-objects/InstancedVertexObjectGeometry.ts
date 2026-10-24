import {BufferGeometry} from 'three/webgpu';
import {expectDefined} from '../utils/expectDefined.js';
import {InstancedVOBufferGeometry} from './InstancedVOBufferGeometry.js';
import type {VertexObjectDescription, VO} from './types.js';
import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectPool} from './VertexObjectPool.js';

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
