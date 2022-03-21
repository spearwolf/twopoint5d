/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// eslint-disable-next-line import/no-unresolved
import {VertexObjects} from '@spearwolf/vertex-objects';

export class AnimatedSprites extends VertexObjects {
  constructor(geometry, material) {
    super(geometry, material);
    this.name = 'AnimatedSprites';
  }
}
