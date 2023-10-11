import {InstancedVertexObjectGeometry} from '../vertexObjects/InstancedVertexObjectGeometry.js';
import {AnimatedSprite, AnimatedSpriteDescriptor} from './AnimatedSprite.js';
import {BaseSprite, BaseSpriteDescriptor} from './BaseSprite.js';

export class AnimatedSpritesGeometry extends InstancedVertexObjectGeometry<AnimatedSprite, BaseSprite> {
  constructor(
    capacity = 100,
    makeBaseSpriteArgs: [width: number, height: number] | [width: number, height: number, xOffset: number, yOffset: number] = [
      0.5, 0.5,
    ],
  ) {
    super(AnimatedSpriteDescriptor, capacity, BaseSpriteDescriptor);

    this.name = 'twopoint5d.AnimatedSpritesGeometry';

    this.basePool.createVO().make(...makeBaseSpriteArgs);
  }
}
