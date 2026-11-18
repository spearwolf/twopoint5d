import {type BufferGeometry, type Object3D, Sphere, Vector2} from 'three/webgpu';

// what Frustum#intersectsObject() and Frustum#intersectsSprite() read of an object: a sphere of
// its own (an InstancedMesh, a BatchedMesh) where the field is defined, otherwise the one of its
// geometry; a sprite has its center instead
interface Culled extends Object3D {
  isSprite?: boolean;
  center?: Vector2;
  isMesh?: boolean;
  isLine?: boolean;
  isPoints?: boolean;
  boundingSphere?: Sphere | null;
  computeBoundingSphere?: () => void;
  geometry?: BufferGeometry;
}

const sphere = new Sphere();
const SPRITE_CENTER = new Vector2(0.5, 0.5);

/**
 * The sphere around what three.js culls by its frustum in `root`, in world coordinates, into `out`:
 * the union of the spheres `Frustum#intersectsObject()` tests, of every visible mesh, line, points
 * object and sprite whose `frustumCulled` is `true`; a sprite counts with the sphere
 * `Frustum#intersectsSprite()` tests. A sphere that is `null` is computed, as three.js computes it
 * for its first draw. Answers `out`, empty where nothing is culled.
 * @internal
 */
export function cullingSphereOf(root: Object3D, out: Sphere): Sphere {
  out.makeEmpty();
  root.updateMatrixWorld();
  root.traverseVisible((object: Culled) => {
    if (
      object.frustumCulled !== true ||
      !(object.isMesh === true || object.isLine === true || object.isPoints === true || object.isSprite === true)
    ) {
      return;
    }
    if (object.isSprite === true) {
      // Frustum#intersectsSprite(): a sphere of radius √½ about the origin of the sprite, grown by
      // how far its center lies from the middle of the quad
      sphere.center.set(0, 0, 0);
      sphere.radius = Math.SQRT1_2 + SPRITE_CENTER.distanceTo(object.center!);
    } else if (object.boundingSphere !== undefined) {
      if (object.boundingSphere === null) object.computeBoundingSphere?.();
      if (object.boundingSphere == null) return;
      sphere.copy(object.boundingSphere);
    } else {
      const geometry = object.geometry;
      if (geometry === undefined) return;
      if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
      if (geometry.boundingSphere == null) return;
      sphere.copy(geometry.boundingSphere);
    }
    sphere.applyMatrix4(object.matrixWorld);
    if (!sphere.isEmpty()) out.union(sphere);
  });
  return out;
}
