import type {VOBufferPool} from './VOBufferPool.js';
import {expectDefined} from '../utils/expectDefined.js';

/**
 * The geometry attribute names a route to this pool puts into slots. Read from the same
 * two maps that {@link initializeAttributes} and {@link initializeInstancedAttributes}
 * walk, so the answer cannot drift from what they actually claim — a disposed pool has no
 * buffers left and therefore claims nothing.
 */
export function attributeNamesOf(pool: VOBufferPool): string[] {
  const attrNames: string[] = [];
  for (const buffer of pool.buffer.buffers.values()) {
    // both maps are filled from the same list of attribute names in VertexObjectBuffer, so a
    // buffer name that has a buffer has its attributes, and an attribute name has its descriptor
    const attributes = expectDefined(
      pool.buffer.bufferNameAttributes.get(buffer.bufferName),
      `the attributes of buffer "${buffer.bufferName}"`,
    );
    for (const bufAttr of attributes) {
      const attrDesc = expectDefined(
        pool.descriptor.attributes.get(bufAttr.attributeName),
        `the descriptor of attribute "${bufAttr.attributeName}"`,
      );
      attrNames.push(attrDesc.name);
    }
  }
  return attrNames;
}
