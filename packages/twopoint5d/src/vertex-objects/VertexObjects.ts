import {type Material, Mesh} from 'three/webgpu';
import type {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import type {VOBufferGeometry} from './VOBufferGeometry.js';

/**
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
   * XXX Object3D#onBeforeRender is too late for updating the geometry (attribute data arrays + draw range)
   */
  update(): void {
    if (typeof this.geometry?.update === 'function') {
      this.geometry.update();
    }
  }
}
