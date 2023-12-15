import type {BufferLike} from './types.js';
import {VertexObjectPool} from './VertexObjectPool.js';

export function updateUpdateRange(pool: VertexObjectPool<any>, buffers: Map<string, BufferLike>) {
  if (pool && buffers) {
    for (const [name, {itemSize}] of pool.buffer.buffers) {
      buffers.get(name).updateRange.count = itemSize * pool.usedCount;
    }
  }
}
