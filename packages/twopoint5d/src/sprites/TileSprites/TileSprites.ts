import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import {TileSpritesGeometry} from './TileSpritesGeometry.js';
import {TileSpritesMaterial} from './TileSpritesMaterial.js';

export class TileSprites extends VertexObjects<TileSpritesGeometry> {
  declare geometry: TileSpritesGeometry | undefined;
  declare material: TileSpritesMaterial | undefined;

  constructor(geometry?: TileSpritesGeometry, material?: TileSpritesMaterial) {
    super(geometry, material);

    this.name = 'twopoint5d.TileSprites';
  }
}
