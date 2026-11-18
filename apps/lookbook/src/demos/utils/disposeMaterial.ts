import {Material} from 'three/webgpu';

/**
 * Disposes the material of a mesh as three.js types it — one material, a list of them, or
 * none —, for a mesh whose material the code that disposes it did not build or cannot name.
 */
export function disposeMaterial(material: Material | readonly Material[] | null | undefined): void {
  if (!material) return;
  // instanceof, not Array.isArray(): the latter leaves a readonly array in the other branch as well
  if (material instanceof Material) {
    material.dispose();
  } else {
    for (const each of material) each.dispose();
  }
}
