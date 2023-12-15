import {VertexObjects} from '../../vertex-objects/VertexObjects.js';
import {TileSpritesGeometry} from './TileSpritesGeometry.js';
import {TileSpritesMaterial} from './TileSpritesMaterial.js';
import type {TileBaseSprite, TileSprite} from './descriptors.js';

export class TileSprites extends VertexObjects<TileBaseSprite, TileSprite> {
  declare geometry: TileSpritesGeometry | undefined;
  declare material: TileSpritesMaterial | undefined;

  constructor(geometry?: TileSpritesGeometry, material?: TileSpritesMaterial) {
    super(geometry, material);

    this.name = 'twopoint5d.TileSprites';

    this.frustumCulled = false;
  }
}
