import {Material} from 'three';

import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import type {BaseSprite} from '../BaseSprite.js';
import type {TexturedSprite} from './TexturedSprite.js';
import {TexturedSpritesGeometry} from './TexturedSpritesGeometry.js';

export class TexturedSprites extends VertexObjects<BaseSprite, TexturedSprite> {
  declare geometry: TexturedSpritesGeometry;

  constructor(geometry?: TexturedSpritesGeometry, material?: Material) {
    super(geometry, material);

    this.name = 'twopoint5d.TexturedSprites';

    this.frustumCulled = false;
  }
}
