import {Material} from 'three';

import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import type {BaseSprite} from '../BaseSprite.js';
import type {AnimatedSprite} from './AnimatedSprite.js';
import {AnimatedSpritesGeometry} from './AnimatedSpritesGeometry.js';

export class AnimatedSprites extends VertexObjects<BaseSprite, AnimatedSprite> {
  constructor(geometry?: AnimatedSpritesGeometry, material?: Material) {
    super(geometry, material);

    this.name = 'twopoint5d.AnimatedSprites';

    this.frustumCulled = false;
  }
}
