import {InstancedVertexObjectGeometry} from '@spearwolf/vertex-objects';

import {BaseSprite, BaseSpriteDescriptor} from './BaseSprite';
import {TexturedInstancedSprite, TexturedInstancedSpriteDescriptor} from './TexturedInstancedSprite';

export class TexturedSpritesGeometry extends InstancedVertexObjectGeometry<TexturedInstancedSprite, BaseSprite> {
  constructor(
    capacity = 100,
    makeBaseSpriteArgs: [width: number, height: number] | [width: number, height: number, xOffset: number, yOffset: number] = [
      0.5, 0.5,
    ],
  ) {
    super(TexturedInstancedSpriteDescriptor, capacity, BaseSpriteDescriptor);

    this.name = '@spearwolf/three-textured-sprites:TexturedSpritesGeometry';

    this.basePool.createVO().make(...makeBaseSpriteArgs);
  }
}
