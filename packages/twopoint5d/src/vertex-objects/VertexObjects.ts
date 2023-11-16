import {Material, Mesh} from 'three';

import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import {VertexObjectGeometry} from './VertexObjectGeometry.js';

export interface VertexObjects {
  geometry: VertexObjectGeometry | InstancedVertexObjectGeometry;
}

export class VertexObjects extends Mesh {
  constructor(geometry?: VertexObjectGeometry | InstancedVertexObjectGeometry, material?: Material | Material[]) {
    super(geometry, material);
    this.name = 'VertexObjects';
  }

  override onBeforeRender = (): void => {
    if (typeof this.geometry?.update === 'function') {
      this.geometry.update();
    }
  };
}
