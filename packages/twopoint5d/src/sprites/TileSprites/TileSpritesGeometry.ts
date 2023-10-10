import {InstancedVertexObjectGeometry, VertexObjectPool} from '../../vertexObjects/index.js';
import {TileBaseSprite, TileBaseSpriteDescriptor, TileSprite, TileSpriteDescriptor} from './descriptors.js';

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
