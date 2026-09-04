import type {BufferLike} from './types.js';
import type {VOBufferPool} from './VOBufferPool.js';

export function updateUpdateRange(pool: VOBufferPool | undefined, buffers: Map<string, BufferLike> | undefined) {
  if (pool && buffers) {
    const {vertexCount} = pool.descriptor;
    for (const [name, {itemSize}] of pool.buffer.buffers) {
      const bufAttr = buffers.get(name);
      // a geometry that has given up its route to this pool carries no buffer for it any more
      if (bufAttr == null) continue;

      // every object in use occupies vertexCount vertices, each of itemSize elements
      const count = itemSize * vertexCount * pool.usedCount;
      if (count !== bufAttr.updateRanges[0]?.count) {
        bufAttr.clearUpdateRanges();
        bufAttr.addUpdateRange(0, count);
      }
    }
  }
}
