/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// eslint-disable-next-line import/no-unresolved
import {VertexObjects} from 'three-vertex-objects';

export class TexturedSprites extends VertexObjects {
  constructor(geometry, material) {
    super(geometry, material);
    this.name = 'TexturedSprites';
  }
}
