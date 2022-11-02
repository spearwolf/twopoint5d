import {VertexObjects} from '../../vertexObjects';
import {TileSpritesGeometry} from './TileSpritesGeometry';
import {TileSpritesMaterial} from './TileSpritesMaterial';

export class TileSprites extends VertexObjects {
  declare geometry: TileSpritesGeometry | undefined;
  declare material: TileSpritesMaterial | undefined;

  constructor(geometry?: TileSpritesGeometry, material?: TileSpritesMaterial) {
    super(geometry, material);

    this.name = 'twopoint5d.TileSprites';

    this.frustumCulled = false;
  }
}
