import {VertexObjects} from 'three-vertex-objects';

import {TileSpritesGeometry} from './TileSpritesGeometry';
import {TileSpritesMaterial} from './TileSpritesMaterial';

export class TileSprites extends VertexObjects {
  constructor(geometry: TileSpritesGeometry, material: TileSpritesMaterial) {
    super(geometry, material);
    this.name = 'TileSprites';
  }
}
