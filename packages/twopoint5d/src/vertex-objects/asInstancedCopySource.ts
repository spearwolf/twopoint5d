import type {BufferGeometry, InstancedBufferGeometry} from 'three/webgpu';

/**
 * Hands a plain `BufferGeometry` to `InstancedBufferGeometry#copy()`.
 *
 * three narrows `copy()` to its own class, but the body reads what every
 * `BufferGeometry` carries plus `instanceCount` — which a plain geometry does not have,
 * so the copy leaves it `undefined`. The constructor of `InstancedVOBufferGeometry` sets
 * `instanceCount` to 0 after the `copy()`, and `update()` takes it from the instanced pool.
 * `InstancedBufferGeometry#copy()` in three; `threeVertexLayout.spec.ts` holds it.
 */
export function asInstancedCopySource(geometry: BufferGeometry): InstancedBufferGeometry {
  return geometry as InstancedBufferGeometry;
}
