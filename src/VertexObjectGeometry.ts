import {BufferAttribute, BufferGeometry} from 'three';

import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {VertexObjectPool} from './VertexObjectPool';
import {VertexObjectDescription} from './types';

function createIndicesArray(indices: number[], count: number): Uint32Array {
  const itemCount = indices.length;
  const arr = new Uint32Array(count * itemCount);
  const stride = Math.max(...indices) + 1;

  for (let i = 0; i < count; i++) {
    for (let j = 0; j < itemCount; j++) {
      arr[i * itemCount + j] = indices[j] + i * stride;
    }
  }

  return arr;
}

export class VertexObjectGeometry extends BufferGeometry {
  readonly pool: VertexObjectPool;

  private attributesInitialized = false;

  constructor(
    source: VertexObjectPool | VertexObjectDescriptor | VertexObjectDescription,
    capacity: number,
  ) {
    super();
    this.pool =
      source instanceof VertexObjectPool
        ? source
        : new VertexObjectPool(source, capacity);
  }

  update(): void {
    if (!this.attributesInitialized) {
      this.initializeAttributes();
    }
    // TODO update buffers
  }

  private initializeAttributes() {
    const {descriptor, capacity} = this.pool;
    if (descriptor.hasIndices) {
      const {indices} = descriptor;
      this.setIndex(
        new BufferAttribute(
          createIndicesArray(indices, capacity),
          indices.length,
        ),
      );
    }
    // TODO set attributes...
    this.attributesInitialized = true;
  }
}
