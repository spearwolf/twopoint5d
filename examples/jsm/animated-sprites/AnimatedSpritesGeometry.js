// eslint-disable-next-line import/no-unresolved
import {InstancedVertexObjectGeometry} from '@spearwolf/three-vertex-objects';

import {
  BaseSpriteDescriptor,
  InstancedSpriteDescriptor,
} from './descriptors.js';

export class AnimatedSpritesGeometry extends InstancedVertexObjectGeometry {
  constructor(capacity = 100) {
    super(InstancedSpriteDescriptor, capacity, BaseSpriteDescriptor);
    this.name = 'AnimatedSpritesGeometry';
    this.basePool.createVO().make();
  }
}
