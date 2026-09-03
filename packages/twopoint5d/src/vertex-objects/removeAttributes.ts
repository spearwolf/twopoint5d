import type {BufferAttribute, BufferGeometry, InterleavedBufferAttribute} from 'three/webgpu';
import type {BufferLike} from './types.js';

/**
 * Take every attribute off the geometry that no route of the geometry serves any more.
 *
 * The counterpart to {@link initializeAttributes} and {@link initializeInstancedAttributes}:
 * both hand out the buffers they built, and the typed array behind such a buffer is what
 * identifies an attribute as reading from one pool rather than another. Going by attribute
 * name would not do — names are unique per geometry, not per pool, so two pools that declare
 * the same attribute name land in the same slot and the one attached later wins.
 *
 * A geometry can reach the same typed arrays through more than one route: a pool attached
 * under two names, or the default instanced pool attached a second time as an extra pool.
 * Each route builds its own `THREE.BufferAttribute`s, so the attribute sitting in a slot may
 * well come from a different route than the one being given up. `keepBuffers` therefore
 * carries the buffers of every route that stays, and only the typed arrays that none of them
 * touches lose their attributes.
 *
 * @param geometry - the geometry to take the attributes off
 * @param buffers - the buffers of the route being given up
 * @param keepBuffers - the buffers of every route the geometry still reads through
 */
export function removeAttributes(
  geometry: BufferGeometry,
  buffers: Map<string, BufferLike>,
  keepBuffers: Iterable<Map<string, BufferLike>>,
): void {
  const releasedArrays = new Set<ArrayLike<number>>();

  for (const buffer of buffers.values()) {
    releasedArrays.add(buffer.array);
  }

  for (const stillServed of keepBuffers) {
    for (const buffer of stillServed.values()) {
      releasedArrays.delete(buffer.array);
    }
  }

  if (releasedArrays.size === 0) return;

  for (const [attrName, attr] of Object.entries(geometry.attributes)) {
    const bufferLike = (attr as InterleavedBufferAttribute).isInterleavedBufferAttribute
      ? (attr as InterleavedBufferAttribute).data
      : (attr as BufferAttribute);

    if (releasedArrays.has(bufferLike.array)) {
      geometry.deleteAttribute(attrName);
    }
  }
}
