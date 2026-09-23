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
   * Update the mesh. Must be called after any changes to the vertex-objects,
   * or in the update loop if you are constantly changing the geometry data.
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
