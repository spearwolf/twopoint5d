import {type Material, Mesh} from 'three/webgpu';
import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import type {VOBufferGeometry} from './VOBufferGeometry.js';

export class VertexObjects<GeoType extends VOBufferGeometry | InstancedVertexObjectGeometry<any, any>> extends Mesh {
  declare geometry: GeoType;

  constructor(geometry?: GeoType, material?: Material | Material[]) {
    super(geometry, material);

    this.name = 'VertexObjects';

    this.frustumCulled = false;

    this.update();
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
