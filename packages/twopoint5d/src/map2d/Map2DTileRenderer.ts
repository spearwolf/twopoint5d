import type {Vector3} from 'three/webgpu';
import {Object3D} from 'three/webgpu';
import {expectDefined} from '../utils/expectDefined.js';
import type {IMap2DTileCoords, IMap2DTileRenderer, IMapTileFactory} from './types.js';

export class Map2DTileRenderer implements IMap2DTileRenderer {
  readonly #tiles = new Map<string, unknown>();

  #dataSerial = 0;
  #updateDataSerial = -1;

  readonly node = new Object3D();

  /**
   * `null` once `dispose()` has run; the renderer is spent from then on. The constructor fills
   * the field and `dispose()` is the only place that empties it again — that is what the reads
   * in the per-tile methods below rest on, and they do not repeat this note.
   */
  tileFactory: IMapTileFactory | null;

  // The checked way to the factory, for the calls that happen once per update cycle rather than
  // once per tile: a check per tile is measurable next to a map lookup and a position write.
  get #factory(): IMapTileFactory {
    return expectDefined(this.tileFactory, 'the tile factory of this renderer, which has been disposed');
  }

  constructor(tileFactory: IMapTileFactory) {
    this.tileFactory = tileFactory;
    this.node.name = 'twopoint5d.Map2DTileRenderer';
    tileFactory.addToNode(this.node);
  }

  beginUpdatingTiles(position: Vector3): void {
    this.node.position.copy(position);
  }

  addTile(tileCoords: IMap2DTileCoords): void {
    const tile = this.tileFactory!.createTile(tileCoords);
    if (tile == null) return;

    this.#tiles.set(tileCoords.id, tile);

    ++this.#dataSerial;
  }

  reuseTile(tileCoords: IMap2DTileCoords): void {
    const tile = this.#tiles.get(tileCoords.id);
    if (tile) {
      this.tileFactory!.updateTile(tile, tileCoords);
      ++this.#dataSerial;
    } else {
      this.addTile(tileCoords);
    }
  }

  removeTile(tileCoords: IMap2DTileCoords): void {
    const tile = this.#tiles.get(tileCoords.id);
    if (tile) {
      this.#tiles.delete(tileCoords.id);
      this.tileFactory!.destroyTile(tile);
      ++this.#dataSerial;
    }
  }

  clearTiles(): void {
    const tileFactory = this.tileFactory!;
    for (const tile of this.#tiles.values()) {
      tileFactory.destroyTile(tile);
    }
    this.#tiles.clear();
    ++this.#dataSerial;
  }

  endUpdatingTiles(): void {
    if (this.#updateDataSerial >= this.#dataSerial) return;
    this.#updateDataSerial = this.#dataSerial;
    this.#factory.update();
  }

  dispose(): void {
    this.#factory.removeFromNode(this.node);
    this.tileFactory = null;
    this.#tiles.clear();
    this.#dataSerial = 0;
    this.#updateDataSerial = -1;
  }
}
