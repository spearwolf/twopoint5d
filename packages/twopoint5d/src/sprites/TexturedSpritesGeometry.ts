import {InstancedVertexObjectGeometry} from '@spearwolf/vertex-objects';
import {BaseSprite, BaseSpriteDescriptor} from './BaseSprite';
import {TexturedSprite, TexturedSpriteDescriptor} from './TexturedSprite';

export class TexturedSpritesGeometry extends InstancedVertexObjectGeometry<TexturedSprite, BaseSprite> {
  constructor(
    capacity = 100,
    makeBaseSpriteArgs: [width: number, height: number] | [width: number, height: number, xOffset: number, yOffset: number] = [
      0.5, 0.5,
    ],
  ) {
    super(TexturedSpriteDescriptor, capacity, BaseSpriteDescriptor);

    this.name = '@spearwolf/textured-sprites:TexturedSpritesGeometry';

    this.basePool.createVO().make(...makeBaseSpriteArgs);
  }
}
