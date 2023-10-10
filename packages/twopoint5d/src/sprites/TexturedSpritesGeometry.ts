import {InstancedVertexObjectGeometry} from '../vertexObjects/InstancedVertexObjectGeometry.js';
import {BaseSprite, BaseSpriteDescriptor} from './BaseSprite.js';
import {TexturedSprite, TexturedSpriteDescriptor} from './TexturedSprite.js';

export class TexturedSpritesGeometry extends InstancedVertexObjectGeometry<TexturedSprite, BaseSprite> {
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
