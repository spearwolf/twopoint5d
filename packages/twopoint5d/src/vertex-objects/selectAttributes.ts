import type {VOBufferPool} from './VOBufferPool.js';
import type {BufferLike} from './types.js';

export function selectAttributes(pool: VOBufferPool, buffers: Map<string, BufferLike>, attrNames: string[]): BufferLike[] {
  const attrs = new Set<string>();
  for (const name of attrNames) {
    const bufAttr = pool.buffer.bufferAttributes.get(name);
    if (bufAttr) {
      attrs.add(bufAttr.bufferName);
    }
  }
  return Array.from(attrs.values()).map((bufferName) => buffers.get(bufferName));
}
