import {BufferLike} from './types';
import {VertexObjectPool} from './VertexObjectPool';

export function updateUpdateRange(pool: VertexObjectPool<any>, buffers: Map<string, BufferLike>) {
  if (pool && buffers) {
    for (const [name, {itemSize}] of pool.buffer.buffers) {
      buffers.get(name).updateRange.count = itemSize * pool.usedCount;
    }
  }
}
