import {Object3D, Vector3} from 'three/webgpu';
import type {IMap2DTileCoords, IMap2DTileRenderer, IMapTileFactory} from './types.js';

export class Map2DTileRenderer implements IMap2DTileRenderer {
  readonly #tiles = new Map<string, unknown>();

  #dataSerial = 0;
  #updateDataSerial = -1;

  readonly node = new Object3D();

  constructor(public tileFactory: IMapTileFactory) {
    this.node.name = 'twopoint5d.Map2DTileRenderer';
    this.tileFactory.addToNode(this.node);
  }

  beginUpdatingTiles(position: Vector3): void {
    this.node.position.copy(position);
  }

  addTile(tileCoords: IMap2DTileCoords): void {
    const tile = this.tileFactory.createTile(tileCoords);
    if (tile == null) return;

    this.#tiles.set(tileCoords.id, tile);

    ++this.#dataSerial;
  }

  reuseTile(tileCoords: IMap2DTileCoords): void {
    const tile = this.#tiles.get(tileCoords.id);
    if (tile) {
      this.tileFactory.updateTile(tile, tileCoords);
      ++this.#dataSerial;
    } else {
      this.addTile(tileCoords);
    }
  }

  removeTile(tileCoords: IMap2DTileCoords): void {
    const tile = this.#tiles.get(tileCoords.id);
    if (tile) {
      this.#tiles.delete(tileCoords.id);
      this.tileFactory.destroyTile(tile);
      ++this.#dataSerial;
    }
  }

  clearTiles(): void {
    for (const tile of this.#tiles.values()) {
      this.tileFactory.destroyTile(tile);
    }
    this.#tiles.clear();
    ++this.#dataSerial;
  }

  endUpdatingTiles(): void {
    if (this.#updateDataSerial >= this.#dataSerial) return;
    this.#updateDataSerial = this.#dataSerial;
    this.tileFactory.update();
  }

  dispose(): void {
    this.tileFactory.removeFromNode(this.node);
    this.tileFactory = null;
    this.#tiles.clear();
    this.#dataSerial = 0;
    this.#updateDataSerial = -1;
  }
}
