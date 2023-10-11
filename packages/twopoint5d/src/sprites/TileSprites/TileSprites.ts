import {VertexObjects} from '../../vertexObjects/VertexObjects.js';
import {TileSpritesGeometry} from './TileSpritesGeometry.js';
import {TileSpritesMaterial} from './TileSpritesMaterial.js';

export class TileSprites extends VertexObjects {
  declare geometry: TileSpritesGeometry | undefined;
  declare material: TileSpritesMaterial | undefined;

  constructor(geometry?: TileSpritesGeometry, material?: TileSpritesMaterial) {
    super(geometry, material);

    this.name = 'twopoint5d.TileSprites';

    this.frustumCulled = false;
  }
}
