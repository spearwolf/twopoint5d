import {expectDefined} from '../../utils/expectDefined.js';
import {InstancedVertexObjectGeometry} from '../../vertex-objects/InstancedVertexObjectGeometry.js';
import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import type {TileBaseSprite} from './descriptors.js';
import {TileBaseSpriteDescriptor, TileSpriteDescriptor, type TileSprite} from './descriptors.js';

/**
 * The instanced geometry of the tile sprites of a map: one base quad, and one instance per tile.
 *
 * `capacity` is how many tiles it holds at once, and a pool that backs a geometry refuses a
 * `resize()`, so the number is fixed with the geometry. When the view shows more tiles than
 * that, `TileSpritesFactory#createTile()` answers `noTileCapacity` for the ones beyond: they
 * stay empty until tiles that leave the view give their slots back, and `Map2DTileRenderer`
 * warns once. Size it for the most tiles the view can show at once.
 */
export class TileSpritesGeometry extends InstancedVertexObjectGeometry<TileSprite, TileBaseSprite> {
  // the constructor hands super() a base descriptor, never a BufferGeometry, so the base pool is always there
  declare readonly basePool: VertexObjectPool<TileBaseSprite>;
  declare readonly instancedPool: VertexObjectPool<TileSprite>;

  constructor(capacity = 100) {
    super(TileSpriteDescriptor, capacity, TileBaseSpriteDescriptor);

    this.name = 'twopoint5d.TileSpritesGeometry';

    expectDefined(this.basePool.createVO(), 'the base sprite of this geometry').make();
  }
}
