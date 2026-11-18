import {type BufferGeometry, type Object3D, Sphere} from 'three/webgpu';

// what Frustum#intersectsObject() reads of an object: a sphere of its own (an InstancedMesh, a
// BatchedMesh) where the field is defined, otherwise the one of its geometry
interface Culled extends Object3D {
  isMesh?: boolean;
  isLine?: boolean;
  isPoints?: boolean;
  boundingSphere?: Sphere | null;
  computeBoundingSphere?: () => void;
  geometry?: BufferGeometry;
}

const sphere = new Sphere();

/**
 * The sphere around what three.js culls by its frustum in `root`, in world coordinates, into `out`:
 * the union of the spheres `Frustum#intersectsObject()` tests, of every visible mesh, line and points
 * object whose `frustumCulled` is `true`. A sphere that is `null` is computed, as three.js computes it
 * for its first draw. Answers `out`, empty where nothing is culled.
 * @internal
 */
export function cullingSphereOf(root: Object3D, out: Sphere): Sphere {
  out.makeEmpty();
  root.updateMatrixWorld();
  root.traverseVisible((object: Culled) => {
    if (object.frustumCulled !== true || !(object.isMesh === true || object.isLine === true || object.isPoints === true)) {
      return;
    }
    if (object.boundingSphere !== undefined) {
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
