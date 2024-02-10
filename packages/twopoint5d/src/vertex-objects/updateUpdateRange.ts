import type {BufferLike} from './types.js';
import type {VertexBufferPool} from './VertexBufferPool.js';

export function updateUpdateRange(pool: VertexBufferPool, buffers: Map<string, BufferLike>) {
  if (pool && buffers) {
    for (const [name, {itemSize}] of pool.buffer.buffers) {
      buffers.get(name).updateRange.count = itemSize * pool.usedCount;
    }
  }
}
