import {InstancedVertexObjectGeometry} from '../../vertex-objects/InstancedVertexObjectGeometry.js';
import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {BaseSprite, BaseSpriteDescriptor} from '../BaseSprite.js';
import {TexturedSprite, TexturedSpriteDescriptor} from './TexturedSprite.js';

export type TexturedSpritesBasePool = VertexObjectPool<BaseSprite>;
export type TexturedSpritePool = VertexObjectPool<TexturedSprite>;

export class TexturedSpritesGeometry extends InstancedVertexObjectGeometry<TexturedSprite, BaseSprite> {
  declare basePool: TexturedSpritesBasePool;
  declare instancedPool: TexturedSpritePool;

  constructor(
    capacity = 100,
    makeBaseSpriteArgs: [width: number, height: number] | [width: number, height: number, xOffset: number, yOffset: number] = [
      0.5, 0.5,
    ],
  ) {
    super(TexturedSpriteDescriptor, capacity, BaseSpriteDescriptor);

    this.name = 'twopoint5d.TexturedSpritesGeometry';

    this.basePool!.createVO().make(...makeBaseSpriteArgs);
  }
}
