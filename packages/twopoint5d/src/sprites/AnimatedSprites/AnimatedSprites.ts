import type {Material} from 'three/webgpu';

import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import {AnimatedSpritesGeometry} from './AnimatedSpritesGeometry.js';

export class AnimatedSprites extends VertexObjects<AnimatedSpritesGeometry> {
  constructor(geometry?: AnimatedSpritesGeometry, material?: Material) {
    super(geometry, material);

    this.name = 'twopoint5d.AnimatedSprites';
  }

  // TODO add dispose method to clean up resources (eg. animsMap from material and buffers from geometry)
}
