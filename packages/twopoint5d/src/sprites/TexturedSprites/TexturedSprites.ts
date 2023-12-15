import {Material} from 'three';

import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import {TexturedSpritesGeometry} from './TexturedSpritesGeometry.js';

export class TexturedSprites extends VertexObjects<TexturedSpritesGeometry> {
  declare geometry: TexturedSpritesGeometry;

  constructor(geometry?: TexturedSpritesGeometry, material?: Material) {
    super(geometry, material);

    this.name = 'twopoint5d.TexturedSprites';
  }
}
