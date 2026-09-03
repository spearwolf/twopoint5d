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
  const selected: BufferLike[] = [];
  for (const bufferName of attrs) {
    const buffer = buffers.get(bufferName);
    // a geometry that has given up its route to this pool carries no buffer for the name any more
    if (buffer != null) {
      selected.push(buffer);
    }
  }
  return selected;
}
