import type {BufferGeometry, InstancedBufferGeometry} from 'three/webgpu';

/**
 * Hands a plain `BufferGeometry` to `InstancedBufferGeometry#copy()`.
 *
 * three narrows `copy()` to its own class, but the body reads what every
 * `BufferGeometry` carries plus `instanceCount` — which a plain geometry does not have,
 * so the copy leaves it `undefined`. `InstancedVOBufferGeometry#update()` writes its own
 * `instanceCount` from the instanced pool before the first frame is drawn.
 * Checked against three 0.183.1, `src/core/InstancedBufferGeometry.js:36-44`.
 */
export function asInstancedCopySource(geometry: BufferGeometry): InstancedBufferGeometry {
  return geometry as InstancedBufferGeometry;
}
