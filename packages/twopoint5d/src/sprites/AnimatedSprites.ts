import {Material} from 'three';

import {VertexObjects} from '../vertexObjects';
import {AnimatedSpritesGeometry} from './AnimatedSpritesGeometry';

export class AnimatedSprites extends VertexObjects {
  constructor(geometry?: AnimatedSpritesGeometry, material?: Material) {
    super(geometry, material);

    this.name = 'twopoint5d.AnimatedSprites';

    this.frustumCulled = false;
  }
}
