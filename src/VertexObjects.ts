import {Material, Mesh} from 'three';

import {VertexObjectGeometry} from './VertexObjectGeometry';

export interface VertexObjects {
  geometry: VertexObjectGeometry;
}

export class VertexObjects extends Mesh {
  constructor(
    geometry?: VertexObjectGeometry,
    material?: Material | Material[],
  ) {
    super(geometry, material);
    this.name = 'VertexObjects';
    this.geometry?.update();
  }

  onBeforeRender = (): void => {
    this.geometry?.update();
  };
}
