import type {Vector3} from 'three/webgpu';
import {Object3D} from 'three/webgpu';
import type {IMap2DTileCoords, IMap2DTileRenderer, IMapTileFactory} from './types.js';

export class Map2DTileRenderer implements IMap2DTileRenderer {
  readonly #tiles = new Map<string, unknown>();

  // The tile coordinates the factory answered `createTile()` with nothing for. Its answer for a
  // coordinate stands until `removeTile()` takes that coordinate out or `clearTiles()` empties
  // the renderer — those two are what puts the question back; asking again in between costs the
  // tile data provider one lookup per frame and per hole in the map.
  readonly #declined = new Set<string>();

  #dataSerial = 0;
  #updateDataSerial = -1;

  /**
   * What the current update cycle was told about its tiles. `true` until a
   * {@link beginUpdatingTiles} says otherwise, so a `reuseTile()` outside a cycle writes.
   */
  #tilesChanged = true;

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

  beginUpdatingTiles(position: Vector3, tilesChanged = true): void {
    // this one never reaches the factory, but moving the node of a spent renderer is a
    // mutation all the same
    if (this.tileFactory === null) return;

    this.#tilesChanged = tilesChanged;
    this.node.position.copy(position);
  }

  addTile(tileCoords: IMap2DTileCoords): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    const tile = tileFactory.createTile(tileCoords);
    if (tile == null) {
      this.#declined.add(tileCoords.id);
      return;
    }

    this.#tiles.set(tileCoords.id, tile);

    ++this.#dataSerial;
  }

  reuseTile(tileCoords: IMap2DTileCoords): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    const tile = this.#tiles.get(tileCoords.id);
    if (tile) {
      // same tiles as last cycle: what updateTile() would write is already in the buffer, and
      // raising the serial for it costs a full attribute upload in endUpdatingTiles()
      if (!this.#tilesChanged) return;

      tileFactory.updateTile(tile, tileCoords);
      ++this.#dataSerial;
    } else if (!this.#declined.has(tileCoords.id)) {
      this.addTile(tileCoords);
    }
  }

  removeTile(tileCoords: IMap2DTileCoords): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    // whoever takes a tile out asks about it afresh next time: without this the set grows with
    // every coordinate ever refused and binds memory to the size of the map instead of the view
    this.#declined.delete(tileCoords.id);

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

    const hadTiles = this.#tiles.size > 0;

    for (const tile of this.#tiles.values()) {
      tileFactory.destroyTile(tile);
    }
    this.#tiles.clear();
    this.#declined.clear();

    // the serial gate in endUpdatingTiles() exists to keep the attribute buffers off the bus
    // when nothing was written — and a clear that found nothing wrote nothing. The emptied
    // `#declined` alone is no reason either: a refused tile never sat in a buffer.
    if (hadTiles) ++this.#dataSerial;
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
    this.#tilesChanged = true;
  }
}
