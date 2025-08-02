import type {Object3D} from 'three';
import {TileSet} from '../../texture/TileSet.js';
import type {IMap2DTileCoords, IMap2DTileDataProvider, IMapTileFactory} from '../types.js';
import type {TileSprite} from './descriptors.js';
import {TileSprites} from './TileSprites.js';

export class TileSpritesFactory implements IMapTileFactory<TileSprite> {
  readonly tileSprites: TileSprites;

  tileSet?: TileSet;

  tileDataProvider?: IMap2DTileDataProvider;

  constructor(tileSprites: TileSprites, tileSet?: TileSet, tileDataProvider?: IMap2DTileDataProvider) {
    this.tileSprites = tileSprites;
    this.tileSet = tileSet;
    this.tileDataProvider = tileDataProvider;
  }

  addToNode(node: Object3D): void {
    node.add(this.tileSprites);
  }

  removeFromNode(node: Object3D): void {
    node.remove(this.tileSprites);
  }

  freeTileSprite(sprite: TileSprite): void {
    this.tileSprites.geometry?.instancedPool.freeVO(sprite);
  }

  createTile(tileCoords: IMap2DTileCoords): TileSprite | undefined {
    const tileDataId = this.tileDataProvider.getTileIdAt(tileCoords.x, tileCoords.y);

    if (tileDataId === 0) return;

    const sprite = this.createTileSprite();

    if (sprite == null) return;

    sprite.setQuadSize([tileCoords.view.width, tileCoords.view.height]);
    sprite.setInstancePosition([tileCoords.view.left, 0, tileCoords.view.top]);

    const frameId = this.tileSet.frameId(tileDataId);
    const texCoords = this.tileSet.atlas.get(frameId).coords;

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
