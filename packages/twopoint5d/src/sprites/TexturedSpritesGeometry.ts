import {InstancedVertexObjectGeometry} from '../vertexObjects';
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

    this.name = 'twopoint5d.TexturedSpritesGeometry';

    this.basePool.createVO().make(...makeBaseSpriteArgs);
  }
}
