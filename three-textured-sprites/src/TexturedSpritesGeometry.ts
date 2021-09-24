import {InstancedVertexObjectGeometry} from 'three-vertex-objects';

import {BaseSprite, BaseSpriteDescriptor} from './BaseSprite';
import {InstancedSprite, InstancedSpriteDescriptor} from './InstancedSprite';

export class TexturedSpritesGeometry extends InstancedVertexObjectGeometry<InstancedSprite, BaseSprite> {
  constructor(
    capacity = 100,
    makeBaseSpriteArgs: [width: number, height: number] | [width: number, height: number, xOffset: number, yOffset: number] = [
      0.5, 0.5,
    ],
  ) {
    super(InstancedSpriteDescriptor, capacity, BaseSpriteDescriptor);

    this.name = '@spearwolf/three-textured-sprites:TexturedSpritesGeometry';

    this.basePool.createVO().make(...makeBaseSpriteArgs);
  }
}
