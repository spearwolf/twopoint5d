import {VertexObjects} from '@spearwolf/vertex-objects';

import {TileSpritesGeometry} from './TileSpritesGeometry';
import {TileSpritesMaterial} from './TileSpritesMaterial';

export class TileSprites extends VertexObjects {
  constructor(geometry?: TileSpritesGeometry, material?: TileSpritesMaterial) {
    super(geometry, material);
    this.name = 'TileSprites';
    this.frustumCulled = false;
  }
}
