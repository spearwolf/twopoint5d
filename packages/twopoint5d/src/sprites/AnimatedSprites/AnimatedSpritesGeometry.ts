import {InstancedVertexObjectGeometry} from '../../vertex-objects/InstancedVertexObjectGeometry.js';
import type {BaseSprite} from '../BaseSprite.js';
import { BaseSpriteDescriptor} from '../BaseSprite.js';
import type {AnimatedSprite} from './AnimatedSprite.js';
import { AnimatedSpriteDescriptor} from './AnimatedSprite.js';

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
