import {Material} from 'three';
import {VertexObjects} from 'three-vertex-objects';

import {TexturedSpritesGeometry} from './TexturedSpritesGeometry';

export class TexturedSprites extends VertexObjects {
  constructor(geometry?: TexturedSpritesGeometry, material?: Material) {
    super(geometry, material);

    this.name = '@spearwolf/three-textured-sprites';
  }
}
