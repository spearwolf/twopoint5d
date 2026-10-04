import {type BufferGeometry, type Material, Mesh} from 'three/webgpu';

// VOBufferGeometry and InstancedVOBufferGeometry bring an update(); the plain BufferGeometry
// THREE.Mesh puts in for a mesh built without a geometry does not
const hasUpdate = (geometry: BufferGeometry): geometry is BufferGeometry & {update(): void} =>
  typeof (geometry as {update?: unknown}).update === 'function';

/**
 * The `THREE.Mesh` that draws a `VOBufferGeometry` or an `InstancedVOBufferGeometry`,
 * and every typed subclass of either — `VertexObjectGeometry` and `InstancedVertexObjectGeometry`
 * included: the class that puts either layer into a scene.
 *
 * `THREE.Mesh` types both slots as always filled, so neither of its type parameters can carry
 * the `undefined` the two declarations below need; the slots are opened here and closed again
 * by those declarations, which are the types this class and its subclasses actually show.
 *
 * `GeoType` is the geometry the mesh holds. Built without one, the mesh holds the plain
 * `BufferGeometry` that `THREE.Mesh` puts in its place, and `GeoType` is `BufferGeometry` — the
 * default the compiler picks when no geometry is passed. A type argument named explicitly while
 * the geometry is left out states a geometry the mesh does not hold.
 */
// three's Mesh types `geometry` and `material` as always present; the `declare` fields
// below add `undefined`, the state of a mesh that gave both up, and only `any` as the
// type arguments of Mesh leaves room for that
// biome-ignore lint/suspicious/noExplicitAny: the fields below widen them
export class VertexObjects<GeoType extends BufferGeometry = BufferGeometry> extends Mesh<any, any> {
  // undefined only once a caller writes it or a subclass that disposes gives both up; a mesh
  // built without either holds what THREE.Mesh puts in their place
  declare geometry: GeoType | undefined;
  declare material: Material | Material[] | undefined;

  constructor(geometry?: GeoType, material?: Material | Material[]) {
    super(geometry, material);

    this.name = 'VertexObjects';

    this.frustumCulled = false;
  }

  /**
   * Uploads what the pools of the geometry have marked for upload and syncs the draw range and the
   * instance count with them; call it once per frame, before rendering.
   *
   * An attribute with `autoTouch` — every usage but `static` — is marked by every call. A static
   * attribute goes up whole with the first call that finds an object in use; after that it is marked
   * by `VertexObjectPool#createVO()` for the slot it hands out, by the `touch()` of the geometry and
   * by `VertexObjectPool#touchVO()`, and a write to it that none of them follows does not reach the
   * gpu.
   *
   * The caller makes this call itself because `Object3D#onBeforeRender` comes too late for it:
   * by then the renderer has read the attribute data arrays and the draw range of the geometry,
   * and whatever this method would have written reaches the gpu a frame late.
   */
  update(): void {
    const {geometry} = this;
    if (geometry != null && hasUpdate(geometry)) {
      geometry.update();
    }
  }
}
