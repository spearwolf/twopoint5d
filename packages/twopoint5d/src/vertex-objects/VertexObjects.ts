import {Material, Mesh} from 'three';

import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import type {VertexBufferGeometry} from './VertexBufferGeometry.js';

export class VertexObjects<GeoType extends VertexBufferGeometry | InstancedVertexObjectGeometry<any, any>> extends Mesh {
  declare geometry: GeoType;

  constructor(geometry?: GeoType, material?: Material | Material[]) {
    super(geometry, material);

    this.name = 'VertexObjects';

    this.frustumCulled = false;
  }

  override onBeforeRender = (): void => {
    if (typeof this.geometry?.update === 'function') {
      this.geometry.update();
    }
  };
}
