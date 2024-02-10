import {BufferGeometry} from 'three';

import {InstancedVertexBufferGeometry} from './InstancedVertexBufferGeometry.js';
import type {VertexObjectDescription, VO} from './types.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectPool} from './VertexObjectPool.js';

const asPool = <T>(
  pool: VertexObjectPool<T> | VertexObjectDescriptor | VertexObjectDescription,
  capacity = 1,
): VertexObjectPool<T> => (pool instanceof VertexObjectPool ? pool : new VertexObjectPool<T>(pool, capacity));

export class InstancedVertexObjectGeometry<
  VOInstancedType extends VO,
  VOBaseType extends VO,
> extends InstancedVertexBufferGeometry {
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
    super(
      ...(args[2] instanceof BufferGeometry
        ? [asPool<VOInstancedType>(args[0], args[1]), args[1], args[2]]
        : [asPool<VOInstancedType>(args[0], args[1]), args[1], asPool<VOBaseType>(args[2], args[3] || 1), args[3]]),
    );

    this.name = 'InstancedVertexObjectGeometry';
  }
}
