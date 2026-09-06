import type {Vector3} from 'three/webgpu';
import {Object3D} from 'three/webgpu';
import type {IMap2DTileCoords, IMap2DTileRenderer, IMapTileFactory} from './types.js';

export class Map2DTileRenderer implements IMap2DTileRenderer {
  readonly #tiles = new Map<string, unknown>();

  #dataSerial = 0;
  #updateDataSerial = -1;

  readonly node = new Object3D();

  /**
   * `null` once `dispose()` has run; the renderer is spent from then on. The constructor fills
   * the field and `dispose()` is the only place that empties it again.
   *
   * Each of the six update-cycle methods — {@link beginUpdatingTiles}, {@link addTile},
   * {@link reuseTile}, {@link removeTile}, {@link clearTiles} and {@link endUpdatingTiles} —
   * does nothing while the field is `null`.
   */
  tileFactory: IMapTileFactory | null;

  constructor(tileFactory: IMapTileFactory) {
    this.tileFactory = tileFactory;
    this.node.name = 'twopoint5d.Map2DTileRenderer';
    tileFactory.addToNode(this.node);
  }

  beginUpdatingTiles(position: Vector3): void {
    // this one never reaches the factory, but moving the node of a spent renderer is a
    // mutation all the same
    if (this.tileFactory === null) return;

    this.node.position.copy(position);
  }

  addTile(tileCoords: IMap2DTileCoords): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    const tile = tileFactory.createTile(tileCoords);
    if (tile == null) return;

    this.#tiles.set(tileCoords.id, tile);

    ++this.#dataSerial;
  }

  reuseTile(tileCoords: IMap2DTileCoords): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    const tile = this.#tiles.get(tileCoords.id);
    if (tile) {
      tileFactory.updateTile(tile, tileCoords);
      ++this.#dataSerial;
    } else {
      this.addTile(tileCoords);
    }
  }

  removeTile(tileCoords: IMap2DTileCoords): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    const tile = this.#tiles.get(tileCoords.id);
    if (tile) {
      this.#tiles.delete(tileCoords.id);
      tileFactory.destroyTile(tile);
      ++this.#dataSerial;
    }
  }

  clearTiles(): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    for (const tile of this.#tiles.values()) {
      tileFactory.destroyTile(tile);
    }
    this.#tiles.clear();
    ++this.#dataSerial;
  }

  endUpdatingTiles(): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    if (this.#updateDataSerial >= this.#dataSerial) return;
    this.#updateDataSerial = this.#dataSerial;
    tileFactory.update();
  }

  /**
   * Gives every tile this renderer still holds back to the factory with
   * {@link IMapTileFactory.destroyTile}, takes the factory content out of {@link node} and
   * gives the factory up: {@link tileFactory} answers `null` afterwards.
   *
   * Releases nothing of its own — the factory is handed to the constructor and belongs to the
   * caller, and `IMapTileFactory` has no `dispose()` to call. A tile is not owned either, it is
   * borrowed: with `TileSpritesFactory` it is a slot in the `instancedPool` of the geometry, and
   * a factory that goes on to serve a second renderer gets every one of them back. {@link node}
   * keeps its `Object3D`; the factory has taken its content out of it. A second call does
   * nothing.
   */
  dispose(): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    // a tile is a slot the factory handed out through createTile(); giving it back is the
    // other half of that call, and clearTiles() is the one place in this class that does it
    this.clearTiles();

    tileFactory.removeFromNode(this.node);
    this.tileFactory = null;
    this.#dataSerial = 0;
    this.#updateDataSerial = -1;
  }
}
