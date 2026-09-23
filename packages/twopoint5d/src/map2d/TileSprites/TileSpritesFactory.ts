import type {Object3D} from 'three/webgpu';
import type {TileSet} from '../../texture/TileSet.js';
import {expectDefined} from '../../utils/expectDefined.js';
import {noTileCapacity} from '../constants.js';
import type {IMap2DTileCoords, IMap2DTileDataProvider, IMapTileFactory} from '../types.js';
import type {TileSprite} from './descriptors.js';
import type {TileSprites} from './TileSprites.js';
import {TileSpritesGeometry} from './TileSpritesGeometry.js';

export class TileSpritesFactory implements IMapTileFactory<TileSprite> {
  readonly tileSprites: TileSprites;

  tileSet?: TileSet;

  tileDataProvider?: IMap2DTileDataProvider;

  constructor(tileSprites: TileSprites, tileSet?: TileSet, tileDataProvider?: IMap2DTileDataProvider) {
    this.tileSprites = tileSprites;
    this.tileSprites.update();
    this.tileSet = tileSet;
    this.tileDataProvider = tileDataProvider;
  }

  addToNode(node: Object3D): void {
    node.add(this.tileSprites);
  }

  removeFromNode(node: Object3D): void {
    node.remove(this.tileSprites);
  }

  /**
   * Builds the tile sprite for a coordinate. Answers `undefined` for a coordinate the tile
   * data provider gives the tile id `0`, and {@link noTileCapacity} when the instanced pool of the
   * geometry has no slot left — or when `tileSprites` has no geometry, and so no pool.
   *
   * @throws when the factory has no tile data provider, no tile set, or the atlas of the tile
   * set has no frame for the tile id; nothing is taken out of the pool then
   */
  createTile(tileCoords: IMap2DTileCoords): TileSprite | undefined | typeof noTileCapacity {
    const tileDataProvider = expectDefined(this.tileDataProvider, 'the tile data provider of this factory');
    const tileDataId = tileDataProvider.getTileIdAt(tileCoords.x, tileCoords.y);

    if (tileDataId === 0) return;

    const tileSet = expectDefined(this.tileSet, 'the tile set of this factory');
    const frameId = tileSet.frameId(tileDataId);
    const texCoords = expectDefined(tileSet.atlas.get(frameId), `the atlas frame of tile ${tileDataId}`).coords;

    // everything that can throw has thrown by now: the slot below comes out of the instanced
    // pool, and the `freeVO()` that would book it back is out of reach on this path — whoever
    // gives a tile back is the renderer, and it never sees one this call threw over
    const sprite = this.createTileSprite();

    // a full instanced pool, or a TileSprites without a geometry and so without a pool, has no
    // slot for this tile; the renderer asks for it again once one may have come free
    if (sprite == null) return noTileCapacity;

    sprite.setQuadSize(tileCoords.view.width, tileCoords.view.height);
    sprite.setInstancePosition(tileCoords.view.left, 0, tileCoords.view.top);
    sprite.setTexCoords(texCoords.s, texCoords.t, texCoords.u, texCoords.v);

    return sprite;
  }

  updateTile(tile: TileSprite, tileCoords: IMap2DTileCoords): void {
    tile.setInstancePosition(tileCoords.view.left, 0, tileCoords.view.top);
  }

  // `THREE.Mesh` gives a TileSprites built without a geometry a plain `BufferGeometry`, which
  // has neither an instanced pool to take a slot from nor a `touch()`; every method of this
  // factory that reaches for the geometry goes through here
  #tileSpritesGeometry(): TileSpritesGeometry | undefined {
    const geometry = this.tileSprites.geometry;
    return geometry instanceof TileSpritesGeometry ? geometry : undefined;
  }

  private createTileSprite(): TileSprite | undefined {
    return this.#tileSpritesGeometry()?.instancedPool.createVO();
  }

  destroyTile(tile: TileSprite): void {
    this.#tileSpritesGeometry()?.instancedPool.freeVO(tile);
  }

  update(): void {
    const geometry = this.#tileSpritesGeometry();
    if (geometry) {
      geometry.touch('quadSize', 'texCoords', 'instancePosition');
      this.tileSprites.update();
    }
  }
}
