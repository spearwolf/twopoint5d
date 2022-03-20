import {VertexObjects} from '@spearwolf/vertex-objects';
import {Material} from 'three';

import {TexturedSpritesGeometry} from './TexturedSpritesGeometry';

export class TexturedSprites extends VertexObjects {
  constructor(geometry?: TexturedSpritesGeometry, material?: Material) {
    super(geometry, material);

    this.name = '@spearwolf/textured-sprites';
    this.frustumCulled = false;
  }
}
