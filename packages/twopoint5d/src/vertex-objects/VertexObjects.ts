import {Material, Mesh} from 'three';

import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import {VertexObjectGeometry} from './VertexObjectGeometry.js';

export class VertexObjects<GeoType extends VertexObjectGeometry<any> | InstancedVertexObjectGeometry<any, any>> extends Mesh {
  declare geometry: GeoType;

  constructor(geometry?: GeoType, material?: Material | Material[]) {
    super(geometry, material);
    this.name = 'VertexObjects';
  }

  override onBeforeRender = (): void => {
    if (typeof this.geometry?.update === 'function') {
      this.geometry.update();
    }
  };
}
