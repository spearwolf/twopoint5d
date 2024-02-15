import {Material, Mesh} from 'three';

import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import type {VOBufferGeometry} from './VOBufferGeometry.js';

export class VertexObjects<GeoType extends VOBufferGeometry | InstancedVertexObjectGeometry<any, any>> extends Mesh {
  declare geometry: GeoType;

  constructor(geometry?: GeoType, material?: Material | Material[]) {
    super(geometry, material);

    this.name = 'VertexObjects';

    this.frustumCulled = false;
  }

  // XXX onBeforeRender is too late for updating the geometry (array buffers)
  // override onBeforeRender = (): void => {
  update(): void {
    if (typeof this.geometry?.update === 'function') {
      this.geometry.update();
    }
  }
}
