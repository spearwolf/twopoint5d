import {InstancedVertexObjectGeometry} from '../../vertex-objects/InstancedVertexObjectGeometry.js';
import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import type {TileBaseSprite} from './descriptors.js';
import { TileBaseSpriteDescriptor, TileSpriteDescriptor, type TileSprite} from './descriptors.js';

export interface TileSpritesGeometry {
  basePool: VertexObjectPool<TileBaseSprite>;
  instancedPool: VertexObjectPool<TileSprite>;
}

export class TileSpritesGeometry extends InstancedVertexObjectGeometry<TileSprite, TileBaseSprite> {
  constructor(capacity = 100) {
    super(TileSpriteDescriptor, capacity, TileBaseSpriteDescriptor);

    this.name = 'twopoint5d.TileSpritesGeometry';

    this.basePool.createVO().make();
  }
}
