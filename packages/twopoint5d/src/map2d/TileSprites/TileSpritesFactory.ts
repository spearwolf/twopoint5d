import type {Object3D} from 'three/webgpu';
import type {TileSet} from '../../texture/TileSet.js';
import {expectDefined} from '../../utils/expectDefined.js';
import type {IMap2DTileCoords, IMap2DTileDataProvider, IMapTileFactory} from '../types.js';
import type {TileSprite} from './descriptors.js';
import type {TileSprites} from './TileSprites.js';

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

  createTile(tileCoords: IMap2DTileCoords): TileSprite | undefined {
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

    if (sprite == null) return;

    sprite.setQuadSize([tileCoords.view.width, tileCoords.view.height]);
    sprite.setInstancePosition([tileCoords.view.left, 0, tileCoords.view.top]);
    sprite.setTexCoords([texCoords.s, texCoords.t, texCoords.u, texCoords.v]);

    return sprite;
  }

  updateTile(tile: TileSprite, tileCoords: IMap2DTileCoords): void {
    tile.setInstancePosition([tileCoords.view.left, 0, tileCoords.view.top]);
  }

  private createTileSprite(): TileSprite | undefined {
    return this.tileSprites.geometry?.instancedPool.createVO();
  }

  destroyTile(tile: TileSprite): void {
    this.tileSprites.geometry?.instancedPool.freeVO(tile);
  }

  update(): void {
    if (this.tileSprites.geometry) {
      this.tileSprites.geometry.touch('quadSize', 'texCoords', 'instancePosition');
      this.tileSprites.update();
    }
  }
}
