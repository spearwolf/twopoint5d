import {Material, Mesh} from 'three';

import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import {VertexObjectGeometry} from './VertexObjectGeometry.js';
import type {VO} from './types.js';

export class VertexObjects<VOType extends VO, VOInstancedType extends VO = VO> extends Mesh {
  declare geometry: VertexObjectGeometry<VOType> | InstancedVertexObjectGeometry<VOInstancedType, VOType>;

  constructor(
    geometry?: VertexObjectGeometry<VOType> | InstancedVertexObjectGeometry<VOInstancedType, VOType>,
    material?: Material | Material[],
  ) {
    super(geometry, material);
    this.name = 'VertexObjects';
  }

  override onBeforeRender = (): void => {
    if (typeof this.geometry?.update === 'function') {
      this.geometry.update();
    }
  };
}
