import {InstancedVertexObjectGeometry} from '../../vertex-objects/InstancedVertexObjectGeometry.js';
import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import type {BaseSprite} from '../BaseSprite.js';
import {BaseSpriteDescriptor} from '../BaseSprite.js';
import type {AnimatedSprite} from './AnimatedSprite.js';
import {AnimatedSpriteDescriptor} from './AnimatedSprite.js';

export class AnimatedSpritesGeometry extends InstancedVertexObjectGeometry<AnimatedSprite, BaseSprite> {
  // the constructor hands super() a base descriptor, never a BufferGeometry, so the base pool is always there
  declare readonly basePool: VertexObjectPool<BaseSprite>;

  /**
   * @param makeBaseSpriteArgs the half width, the half height and the offset of the base quad every
   *   sprite is drawn from; the default `[0.5, 0.5]` is the unit quad. The trim margins of a frame move
   *   the corners by the measure of the unit quad, also on a base quad of another side length.
   */
  constructor(
    capacity = 100,
    makeBaseSpriteArgs:
      [halfWidth: number, halfHeight: number] | [halfWidth: number, halfHeight: number, xOffset: number, yOffset: number] = [
      0.5, 0.5,
    ],
  ) {
    super(AnimatedSpriteDescriptor, capacity, BaseSpriteDescriptor);

    this.name = 'twopoint5d.AnimatedSpritesGeometry';

    const baseSprite = this.basePool.createVO();
    if (baseSprite == null) {
      throw new Error('AnimatedSpritesGeometry: the base pool has no room for the base sprite');
    }
    baseSprite.make(...makeBaseSpriteArgs);
  }
}
