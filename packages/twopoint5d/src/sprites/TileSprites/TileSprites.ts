import {VertexObjects} from '@spearwolf/vertex-objects';

import {TileSpritesGeometry} from './TileSpritesGeometry';
import {TileSpritesMaterial} from './TileSpritesMaterial';

export class TileSprites extends VertexObjects {
  geometry: TileSpritesGeometry | undefined;
  material: TileSpritesMaterial | undefined;

  constructor(geometry?: TileSpritesGeometry, material?: TileSpritesMaterial) {
    super(geometry, material);

    this.name = '@spearwolf/tiled-maps:TileSprites';

    this.frustumCulled = false;
  }
}
