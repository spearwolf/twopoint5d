import {eventize, Eventize} from '@spearwolf/eventize';
import {Vector2, Vector3} from 'three';
import type {TileSprite} from '../sprites/TileSprites/descriptors.js';
import {TileSprites} from '../sprites/TileSprites/TileSprites.js';
import {TileSet} from '../texture/TileSet.js';
import {VertexObjectPool} from '../vertex-objects/VertexObjectPool.js';
import type {IMap2DTileDataProvider} from './IMap2DTileDataProvider.js';
import type {IMap2DTileRenderer} from './IMap2DTileRenderer.js';
import {Map2DTile} from './Map2DTile.js';

export interface Map2DTileSprites extends Eventize {}

export class Map2DTileSprites extends TileSprites implements IMap2DTileRenderer {
  #tileData?: IMap2DTileDataProvider;

  #tiles = new Map<string, TileSprite>();

  #deferredTiles = new Set<Map2DTile>();

  #curUpdateSerial = 0;

  #isReady = false;

  #tileSet?: TileSet;

  #nextUpdateShouldResetTiles = false;

  constructor() {
    super();
    eventize(this);

    this.name = 'twopoint5d.Map2DTileSprites';

    this.on('ready', () => this.#addDeferredTiles());
  }

  get tileData(): IMap2DTileDataProvider | undefined {
    return this.#tileData;
  }

  set tileData(tileData: IMap2DTileDataProvider | undefined) {
    const previousTileData = this.#tileData;
    this.#tileData = tileData;

    this.#checkReady();

    if (previousTileData !== tileData) {
      this.emit('tileDataChanged', tileData, previousTileData);
    }
  }

  get tileSet(): TileSet | undefined {
    return this.#tileSet;
  }

  set tileSet(tileSet: TileSet | undefined) {
    const previousTileSet = this.#tileSet;
    this.#tileSet = tileSet;

    this.#checkReady();

    if (previousTileSet !== tileSet) {
      this.emit('tileSetChanged', tileSet, previousTileSet);
    }
  }

  get tilesPool(): VertexObjectPool<TileSprite> | undefined {
    return this.geometry?.instancedPool;
  }

  #updateReadyState(): boolean {
    this.#isReady = this.tilesPool != null && this.tileData != null && this.tileSet != null;
    return this.#isReady;
  }

  #checkReady(): void {
    if (!this.#isReady && this.#updateReadyState()) {
      this.emit('ready');
    }
  }

  override onBeforeRender = (): void => {
    this.#checkReady();

    if (typeof this.geometry?.update === 'function') {
      this.geometry.update();
    }
  };

  beginUpdate(offset: Vector2, translate: Vector3): void {
    this.position.set(offset.x + translate.x, translate.y, offset.y + translate.z);

    this.#checkReady();
    this.#curUpdateSerial = 0;

    if (this.#nextUpdateShouldResetTiles) {
      this.#resetTiles();
    }
  }

  addTile(tile: Map2DTile): void {
    if (!this.#isReady) {
      this.#deferredTiles.add(tile);
      return;
    }

    const tileDataId = this.tileData.getTileIdAt(tile.x, tile.y);

    if (tileDataId === 0) {
      return;
    }

    const sprite = this.tilesPool.createVO();

    sprite.setQuadSize([tile.view.width, tile.view.height]);
    sprite.setInstancePosition([tile.view.left, 0, tile.view.top]);

    const frameId = this.tileSet.frameId(tileDataId);
    const texCoords = this.tileSet.atlas.get(frameId).coords;

    sprite.setTexCoords([texCoords.s, texCoords.t, texCoords.u, texCoords.v]);

    this.#tiles.set(tile.id, sprite);

    ++this.#curUpdateSerial;
  }

  #addDeferredTiles = (): void => {
    const {size: deferredCount} = this.#deferredTiles;

    if (deferredCount > 0) {
      this.#deferredTiles.forEach((tile) => {
        this.addTile(tile);
      });
      this.#deferredTiles.clear();

      this.#syncGeometryBuffers();
    }
  };

  reuseTile(tile: Map2DTile): void {
    if (!this.#isReady) return;

    const sprite = this.#tiles.get(tile.id);
    if (sprite) {
      sprite.setInstancePosition([tile.view.left, 0, tile.view.top]);
      ++this.#curUpdateSerial;
    } else {
      this.addTile(tile);
    }
  }

  removeTile(tile: Map2DTile): void {
    if (!this.#isReady) {
      this.#deferredTiles.delete(tile);
      return;
    }

    const sprite = this.#tiles.get(tile.id);

    if (sprite) {
      this.#tiles.delete(tile.id);
      this.tilesPool.freeVO(sprite);
      ++this.#curUpdateSerial;
    }
  }

  resetTiles(): void {
    this.#nextUpdateShouldResetTiles = true;
  }

  #resetTiles(): void {
    if (!this.#isReady) return;

    for (const sprite of this.#tiles.values()) {
      this.tilesPool.freeVO(sprite);
    }

    this.#tiles.clear();
    ++this.#curUpdateSerial;

    this.#nextUpdateShouldResetTiles = false;
  }

  endUpdate(): void {
    if (!this.#isReady) return;

    if (this.#curUpdateSerial) {
      this.#syncGeometryBuffers();
    }
  }

  #syncGeometryBuffers(): void {
    this.geometry.touch('quadSize', 'texCoords', 'instancePosition');
  }

  dispose(): void {
    // eslint-disable-next-line no-console
    console.warn('Map2DTileSpritesRenderer3D.dispose() is not implemented');
  }
}
