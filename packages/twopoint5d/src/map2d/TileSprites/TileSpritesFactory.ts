import type {Object3D} from 'three/webgpu';
import type {TileSet} from '../../texture/TileSet.js';
import {expectDefined} from '../../utils/expectDefined.js';
import {VOUtils} from '../../vertex-objects/VOUtils.js';
import {noTileCapacity} from '../constants.js';
import type {IMap2DTileCoords, IMap2DTileDataProvider, IMapTileFactory} from '../types.js';
import type {TileSprite} from './descriptors.js';
import type {TileSprites} from './TileSprites.js';
import {TileSpritesGeometry} from './TileSpritesGeometry.js';

// setTexCoords() copies the four values into the buffer of the sprite, so one tuple serves every call
const texCoordsScratch: [s: number, t: number, u: number, v: number] = [0, 0, 0, 0];

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
    sprite.setTexCoords(texCoords.getTexCoords(texCoordsScratch));
    // written for an upright frame too: a slot that comes back out of the pool still holds the
    // value of the tile before it
    sprite.texFlipDiagonal = texCoords.flipD ? 1 : 0;

    return sprite;
  }

  updateTile(tile: TileSprite, tileCoords: IMap2DTileCoords): void {
    tile.setInstancePosition(tileCoords.view.left, 0, tileCoords.view.top);

    // the instance attributes carry no `autoTouch`, so the factory says itself which slot it
    // wrote, and update() uploads that slot and no other; createVO() and freeVO() mark theirs
    const pool = this.#tileSpritesGeometry()?.instancedPool;
    if (pool?.containsVO(tile)) {
      const idx = VOUtils.getIndex(tile);
      pool.buffer.touch(idx, idx);
    }
  }

  // `THREE.Mesh` gives a TileSprites built without a geometry a plain `BufferGeometry`, which
  // has no instanced pool to take a slot from or to mark a slot in; every method of this factory
  // that reaches for the geometry goes through here
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
      this.tileSprites.update();
    }
  }
}
