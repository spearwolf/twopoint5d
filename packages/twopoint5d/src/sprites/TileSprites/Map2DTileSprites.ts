import eventize, {Eventize} from '@spearwolf/eventize';

import {IMap2DTileDataProvider} from '../../tiledMaps/IMap2DTileDataProvider';
import {IMap2DTileRenderer} from '../../tiledMaps/IMap2DTileRenderer';
import {Map2DTile} from '../../tiledMaps/Map2DTile';
import {TileSet, VertexObjectPool} from '../../vertexObjects';
import {TileSprite} from './descriptors';
import {TileSprites} from './TileSprites';

export interface Map2DTileSprites extends Eventize {}

export class Map2DTileSprites extends TileSprites implements IMap2DTileRenderer {
  debug = false;

  #tileData?: IMap2DTileDataProvider;

  get tileData(): IMap2DTileDataProvider | undefined {
    return this.#tileData;
  }

  set tileData(tileData: IMap2DTileDataProvider | undefined) {
    this.#tileData = tileData;
    this.#checkReady();
  }

  #tileSet?: TileSet;

  get tileSet(): TileSet | undefined {
    return this.#tileSet;
  }

  set tileSet(tileSet: TileSet | undefined) {
    this.#tileSet = tileSet;
    this.#checkReady();
  }

  get tilesPool(): VertexObjectPool<TileSprite> | undefined {
    return this.geometry?.instancedPool;
  }

  constructor() {
    super();
    eventize(this);

    this.name = 'twopoint5d.Map2DTileSprites';

    this.on('ready', () => this.#addDeferredTiles());
  }

  #tiles = new Map<string, TileSprite>();

  #deferredTiles = new Set<Map2DTile>();

  #curUpdateSerial = 0;

  #isReady = false;

  #updateReadyState = (): boolean => {
    this.#isReady = this.tilesPool != null && this.tileData != null && this.tileSet != null;
    return this.#isReady;
  };

  #checkReady = (): void => {
    if (!this.#isReady && this.#updateReadyState()) {
      this.emit('ready');
    }
  };

  onBeforeRender = (): void => {
    this.#checkReady();

    if (typeof this.geometry?.update === 'function') {
      this.geometry.update();
    }
  };

  beginUpdate(offsetX: number, offsetY: number): void {
    this.position.set(offsetX, 0, offsetY);

    this.#checkReady();
    this.#curUpdateSerial = 0;

    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('beginUpdate', {
        offsetX,
        offsetY,
        isReady: this.#isReady,
        tilesPool: this.tilesPool,
        tileData: this.tileData,
        tileSet: this.tileSet,
      });
    }
  }

  addTile(tile: Map2DTile): void {
    if (!this.#isReady) {
      this.#deferredTiles.add(tile);
      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log('addTile as deferred', {tile, tileSpritesRenderer: this});
      }
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

    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('addTile', {tile, sprite, tileSpritesRenderer: this});
    }
  }

  #addDeferredTiles = (): void => {
    const {size: deferredCount} = this.#deferredTiles;

    if (deferredCount > 0) {
      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log('addDeferredTiles count=', deferredCount);
      }

      this.#deferredTiles.forEach((tile) => {
        this.addTile(tile);
      });
      this.#deferredTiles.clear();

      this.#syncGeometryBuffers();
    }
  };

  reuseTile(tile: Map2DTile): void {
    if (!this.#isReady) return;

    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('reuseTile', {tile});
    }

    if (!this.#tiles.has(tile.id)) {
      this.addTile(tile);
    }
  }

  removeTile(tile: Map2DTile): void {
    if (!this.#isReady) {
      this.#deferredTiles.delete(tile);
      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log('removeTile from deferred', {tile, tileSpritesRenderer: this});
      }
      return;
    }

    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('removeTile', {tile, tileSpritesRenderer: this});
    }

    const sprite = this.#tiles.get(tile.id);

    if (sprite) {
      this.#tiles.delete(tile.id);
      this.tilesPool.freeVO(sprite);
      ++this.#curUpdateSerial;
    }
  }

  endUpdate(): void {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('endUpdate, serial=', this.#curUpdateSerial);
    }

    if (!this.#isReady) return;

    if (this.#curUpdateSerial) {
      this.#syncGeometryBuffers();
    }
  }

  #syncGeometryBuffers = (): void => {
    this.geometry.touch('quadSize', 'texCoords', 'instancePosition');
  };

  dispose(): void {
    // eslint-disable-next-line no-console
    console.warn('Map2DTileSpritesRenderer3D.dispose() is not implemented');
  }
}
