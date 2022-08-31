import {InstancedVertexObjectGeometry, VertexObjectPool} from '@spearwolf/vertex-objects';

import {TileBaseSprite, TileBaseSpriteDescriptor, TileSprite, TileSpriteDescriptor} from './descriptors';

export interface TileSpritesGeometry {
  basePool: VertexObjectPool<TileBaseSprite>;
  instancedPool: VertexObjectPool<TileSprite>;
}

export class TileSpritesGeometry extends InstancedVertexObjectGeometry {
  constructor(capacity = 100) {
    super(TileSpriteDescriptor, capacity, TileBaseSpriteDescriptor);

    this.name = 'TileSpritesGeometry';

    this.basePool.createVO().make();
  }
}
