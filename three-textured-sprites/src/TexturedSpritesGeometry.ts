import {InstancedVertexObjectGeometry} from 'three-vertex-objects';

import {
  BaseSprite,
  BaseSpriteDescriptor,
  InstancedSprite,
  InstancedSpriteDescriptor,
} from './descriptors';

export class TexturedSpritesGeometry extends InstancedVertexObjectGeometry<
  InstancedSprite,
  BaseSprite
> {
  constructor(capacity = 100, makeBaseSpriteArgs = [0.5, 0.5]) {
    super(InstancedSpriteDescriptor, capacity, BaseSpriteDescriptor);

    this.name = '@spearwolf/three-textured-sprites:TexturedSpritesGeometry';

    this.basePool.createVO().make(...makeBaseSpriteArgs);
  }
}
