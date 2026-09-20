import {type Material, Mesh} from 'three/webgpu';
import type {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import type {VOBufferGeometry} from './VOBufferGeometry.js';

/**
 * The `THREE.Mesh` that draws a {@link VOBufferGeometry} or an {@link InstancedVertexObjectGeometry}:
 * the class that puts either layer into a scene.
 *
 * `THREE.Mesh` types both slots as always filled, so neither of its type parameters can carry
 * the `undefined` the two declarations below need; the slots are opened here and closed again
 * by those declarations, which are the types this class and its subclasses actually show.
 */
export class VertexObjects<GeoType extends VOBufferGeometry | InstancedVertexObjectGeometry<any, any>> extends Mesh<any, any> {
  // a mesh can be built without either, and a subclass that disposes gives both up again
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
    if (typeof this.geometry?.update === 'function') {
      this.geometry.update();
    }
  }
}
