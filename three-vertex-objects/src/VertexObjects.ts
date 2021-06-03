import {Material, Mesh} from 'three';

import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry';

import {VertexObjectGeometry} from './VertexObjectGeometry';

export interface VertexObjects {
  geometry: VertexObjectGeometry | InstancedVertexObjectGeometry;
}

export class VertexObjects extends Mesh {
  constructor(
    geometry?: VertexObjectGeometry | InstancedVertexObjectGeometry,
    material?: Material | Material[],
  ) {
    super(geometry, material);
    this.name = 'VertexObjects';
  }

  onBeforeRender = (): void => {
    this.geometry?.update();
  };
}
