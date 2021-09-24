import {InstancedVertexObjectGeometry, VertexObjectPool, VO} from '@spearwolf/three-vertex-objects';

import {TileBaseSprite, TileBaseSpriteDescriptor, TileSpriteDescriptor} from './descriptors';

export interface TileSpritesGeometry {
  basePool: VertexObjectPool<VO & TileBaseSprite>;
}

export class TileSpritesGeometry extends InstancedVertexObjectGeometry {
  constructor(capacity = 100) {
    super(TileSpriteDescriptor, capacity, TileBaseSpriteDescriptor);
    this.name = 'TileSpritesGeometry';
    this.basePool.createVO().make();
  }
}
