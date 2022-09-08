/* eslint-disable import/order */

import {TileSet, VertexObjectPool} from '@spearwolf/vertex-objects';
import {Object3D} from 'three';

import {AABB2} from '../AABB2';
import {IMap2DTileDataProvider} from '../IMap2DTileDataProvider';
import {IMap2DTileRenderer} from '../IMap2DTileRenderer';
import {Map2DLayer} from '../Map2DLayer';
import {Map2DTile} from '../Map2DTile';
import {TileSprite} from './descriptors';
import {TileSprites} from './TileSprites';
import {TileSpritesGeometry} from './TileSpritesGeometry';
import {TileSpritesMaterial} from './TileSpritesMaterial';

export class Map2DTileSpritesRenderer implements IMap2DTileRenderer {
  tileData?: IMap2DTileDataProvider;
  tileSet?: TileSet;

  readonly #obj3d: Object3D = new Object3D();

  get name(): string {
    return this.#obj3d.name;
  }

  set name(name: string) {
    this.#obj3d.name = name;
  }

  readonly tilesMesh: TileSprites = new TileSprites();

  get geometry(): TileSpritesGeometry | undefined {
    return this.tilesMesh.geometry as unknown as TileSpritesGeometry | undefined;
  }

  set geometry(geometry: TileSpritesGeometry | undefined) {
    this.tilesMesh.geometry = geometry;
  }

  get material(): TileSpritesMaterial | undefined {
    return this.tilesMesh.material as unknown as TileSpritesMaterial | undefined;
  }

  set material(material: TileSpritesMaterial | undefined) {
    this.tilesMesh.material = material;
  }

  get tilesPool(): VertexObjectPool<TileSprite> | undefined {
    return this.geometry?.instancedPool;
  }

  constructor() {
    this.#obj3d.add(this.tilesMesh);
  }

  #tiles = new Map<string, TileSprite>();

  #curUpdateSerial = 0;
  #isReady = false;

  beginUpdate(layer: Map2DLayer, offsetX: number, offsetY: number, viewArea: AABB2): void {
    this.#isReady = this.tilesPool != null && this.tileData != null && this.tileSet != null;
    this.#curUpdateSerial = 0;

    // eslint-disable-next-line no-console
    console.log('beginUpdate', {layer, offsetX, offsetY, viewArea, isReady: this.#isReady});

    this.tilesMesh.position.set(offsetX, 0, offsetY);
  }

  private getTileId(x: number, y: number): number {
    return this.tileData.getTileIdAt(x, y);
  }

  addTile(tile: Map2DTile): void {
    if (!this.#isReady) return;

    const tileId = this.getTileId(tile.x, tile.y);

    if (tileId === 0) {
      return;
    }

    const sprite = this.tilesPool.createVO();

    sprite.setQuadSize([tile.view.width, tile.view.height]);
    sprite.setInstancePosition([tile.view.left, 0, tile.view.top]);

    const frameId = this.tileSet.frameId(tileId);
    const texCoords = this.tileSet.atlas.get(frameId).coords;

    sprite.setTexCoords([texCoords.s, texCoords.t, texCoords.u, texCoords.v]);

    this.#tiles.set(tile.id, sprite);

    ++this.#curUpdateSerial;

    // eslint-disable-next-line no-console
    console.log('addTile', tile, sprite);
  }

  reuseTile(tile: Map2DTile): void {
    if (!this.#isReady) return;

    // eslint-disable-next-line no-console
    console.log('reuseTile', tile);

    if (!this.#tiles.has(tile.id)) {
      this.addTile(tile);
    }
  }

  removeTile(tile: Map2DTile): void {
    if (!this.#isReady) return;

    // eslint-disable-next-line no-console
    console.log('removeTile', tile);

    const sprite = this.#tiles.get(tile.id);
    if (sprite) {
      this.#tiles.delete(tile.id);
      this.tilesPool.freeVO(sprite);
      ++this.#curUpdateSerial;
    }
  }

  endUpdate(): void {
    // eslint-disable-next-line no-console
    console.log('endUpdate, serial=', this.#curUpdateSerial);

    if (!this.#isReady) return;

    if (this.#curUpdateSerial) {
      this.geometry.touch('quadSize', 'texCoords', 'instancePosition');
    }
  }

  getObject3D(): Object3D {
    return this.#obj3d;
  }

  dispose(): void {
    // eslint-disable-next-line no-console
    console.warn('Map2DTileSpritesRenderer.dispose() is not implemented');
  }
}
