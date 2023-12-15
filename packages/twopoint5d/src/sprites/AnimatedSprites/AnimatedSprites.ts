import {Material} from 'three';

import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import {AnimatedSpritesGeometry} from './AnimatedSpritesGeometry.js';

export class AnimatedSprites extends VertexObjects<AnimatedSpritesGeometry> {
  constructor(geometry?: AnimatedSpritesGeometry, material?: Material) {
    super(geometry, material);

    this.name = 'twopoint5d.AnimatedSprites';

    this.frustumCulled = false;
  }
}
