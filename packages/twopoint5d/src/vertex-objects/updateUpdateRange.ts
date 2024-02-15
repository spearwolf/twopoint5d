import type {BufferLike} from './types.js';
import type {VOBufferPool} from './VOBufferPool.js';

export function updateUpdateRange(pool: VOBufferPool, buffers: Map<string, BufferLike>) {
  if (pool && buffers) {
    for (const [name, {itemSize}] of pool.buffer.buffers) {
      const bufAttr = buffers.get(name);
      const count = itemSize * pool.usedCount;
      if (count !== bufAttr.updateRanges[0]?.count) {
        bufAttr.clearUpdateRanges();
        bufAttr.addUpdateRange(0, itemSize * pool.usedCount);
      }
    }
  }
}
