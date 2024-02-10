import type {BufferLike} from './types.js';
import type {VOBufferPool} from './VOBufferPool.js';

export function updateUpdateRange(pool: VOBufferPool, buffers: Map<string, BufferLike>) {
  if (pool && buffers) {
    for (const [name, {itemSize}] of pool.buffer.buffers) {
      buffers.get(name).updateRange.count = itemSize * pool.usedCount;
    }
  }
}
