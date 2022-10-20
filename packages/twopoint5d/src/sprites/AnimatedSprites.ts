import {VertexObjects} from '@spearwolf/vertex-objects';
import {Material} from 'three';
import {AnimatedSpritesGeometry} from './AnimatedSpritesGeometry';

export class AnimatedSprites extends VertexObjects {
  constructor(geometry?: AnimatedSpritesGeometry, material?: Material) {
    super(geometry, material);

    this.name = '@spearwolf/textured-sprites:AnimatedSprites';

    this.frustumCulled = false;
  }
}
