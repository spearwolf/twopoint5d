import {InstancedVertexObjectGeometry} from '../../vertex-objects/InstancedVertexObjectGeometry.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {TileBaseSprite, TileBaseSpriteDescriptor, TileSpriteDescriptor, type TileSprite} from './descriptors.js';

export interface TileSpritesGeometry {
  basePool: VertexObjectPool<TileBaseSprite>;
  instancedPool: VertexObjectPool<TileSprite>;
}

export class TileSpritesGeometry extends InstancedVertexObjectGeometry {
  constructor(capacity = 100) {
    super(TileSpriteDescriptor, capacity, TileBaseSpriteDescriptor);

    this.name = 'twopoint5d.TileSpritesGeometry';

    this.basePool.createVO().make();
  }
}
