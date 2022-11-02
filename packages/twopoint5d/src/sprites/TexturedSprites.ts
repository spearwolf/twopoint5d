import {Material} from 'three';

import {VertexObjects} from '../vertexObjects';
import {TexturedSpritesGeometry} from './TexturedSpritesGeometry';

export class TexturedSprites extends VertexObjects {
  constructor(geometry?: TexturedSpritesGeometry, material?: Material) {
    super(geometry, material);

    this.name = 'twopoint5d.TexturedSprites';

    this.frustumCulled = false;
  }
}
