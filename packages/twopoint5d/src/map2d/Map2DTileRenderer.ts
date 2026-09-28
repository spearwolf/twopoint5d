import type {Vector3} from 'three/webgpu';
import {Object3D} from 'three/webgpu';
import {noTileCapacity} from './constants.js';
import type {IMap2DTileCoords, IMap2DTileRenderer, IMapTileFactory} from './types.js';

export class Map2DTileRenderer implements IMap2DTileRenderer {
  readonly #tiles = new Map<string, unknown>();

  // The tile coordinates the factory answered createTile() with `undefined` for: there is no
  // tile there. Its answer for a coordinate stands until removeTile() takes that coordinate out
  // or clearTiles() empties the renderer — those two are what puts the question back; asking
  // again in between costs the tile data provider one lookup per frame and per hole in the map.
  // A factory that answers `noTileCapacity` has said nothing about the coordinate, and it does
  // not land here.
  readonly #declined = new Set<string>();

  #warnedNoTileCapacity = false;

  // The factory answered `noTileCapacity` at least once in the current update cycle: a tile of
  // this cycle is missing, and the next cycle has to ask for it again.
  #tilesPending = false;

  // clearTiles() ran since the last beginUpdatingTiles(): every tile of the last cycle is gone.
  #cleared = false;

  // beginUpdatingTiles() has opened a cycle that endUpdatingTiles() has not closed yet — also one
  // a throw broke off, before or within endUpdatingTiles().
  #updating = false;

  // addTile(), reuseTile() or removeTile() ran outside an update cycle since the last
  // beginUpdatingTiles(): a tile of the last cycle may be gone, a coordinate may wait to be asked
  // about again, and a write waits for the endUpdatingTiles() that uploads it.
  #changedOutsideCycle = false;

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

  /**
   * `true` from the call that leaves the renderer short of its last update cycle up to the
   * {@link endUpdatingTiles} of the next cycle: a cycle in which the factory answered
   * {@link noTileCapacity} for a tile, a {@link clearTiles}, and an {@link addTile},
   * {@link reuseTile} or {@link removeTile} outside an update cycle. `true` as well while an update
   * cycle is open, and so after a cycle a throw broke off, in {@link endUpdatingTiles} as well: a
   * factory whose `update()` throws is asked again in the next one. See
   * {@link IMap2DTileRenderer.hasPendingTiles}. `false` once {@link dispose} has run.
   */
  get hasPendingTiles(): boolean {
    return this.tileFactory !== null && (this.#cleared || this.#tilesPending || this.#changedOutsideCycle || this.#updating);
  }

  constructor(tileFactory: IMapTileFactory) {
    this.tileFactory = tileFactory;
    this.node.name = 'twopoint5d.Map2DTileRenderer';
    tileFactory.addToNode(this.node);
  }

  beginUpdatingTiles(position: Vector3, tilesChanged = true): void {
    // this one never reaches the factory, but moving the node of a spent renderer is a
    // mutation all the same
    if (this.tileFactory === null) return;

    this.#tilesPending = false;
    this.#cleared = false;
    this.#changedOutsideCycle = false;
    this.#updating = true;
    this.#tilesChanged = tilesChanged;
    this.node.position.copy(position);
  }

  addTile(tileCoords: IMap2DTileCoords): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    if (!this.#updating) this.#changedOutsideCycle = true;

    // a tile this renderer already holds for the id is a slot it owes the factory — overwriting
    // the entry would lose the slot, which goes on drawing with nobody left to give it back
    const existing = this.#tiles.get(tileCoords.id);
    if (existing !== undefined) {
      tileFactory.updateTile(existing, tileCoords);
      // updateTile() writes the position into the attribute buffer, and without the serial
      // endUpdatingTiles() leaves it on the CPU side — the same bookkeeping reuseTile() does
      ++this.#dataSerial;
      return;
    }

    const tile = tileFactory.createTile(tileCoords);
    if (tile === noTileCapacity) {
      // not an answer about the coordinate: the factory is full right now. The coordinate stays
      // out of `#declined`, so reuseTile() asks for it again in the next cycle, once a tile that
      // left the view may have given its slot back. Nothing was written, so the serial stays.
      this.#tilesPending = true;
      this.#warnNoTileCapacity(tileCoords);
      return;
    }
    if (tile == null) {
      this.#declined.add(tileCoords.id);
      return;
    }

    this.#tiles.set(tileCoords.id, tile);

    ++this.#dataSerial;
  }

  #warnNoTileCapacity(tileCoords: IMap2DTileCoords): void {
    if (this.#warnedNoTileCapacity) return;
    this.#warnedNoTileCapacity = true;
    // eslint-disable-next-line no-console
    console.warn(
      `Map2DTileRenderer: the tile factory has no room for another tile, so the tile at (${tileCoords.x}, ${tileCoords.y}) stays empty until a tile that leaves the view gives its slot back. With a TileSpritesFactory, build its TileSpritesGeometry with a capacity for the most tiles the view shows at once. This warning is shown once per renderer.`,
    );
  }

  reuseTile(tileCoords: IMap2DTileCoords): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    if (!this.#updating) this.#changedOutsideCycle = true;

    const tile = this.#tiles.get(tileCoords.id);
    if (tile !== undefined) {
      // the grid stands, so the tile keeps its view coordinates: what updateTile() would write
      // is already in the buffer, and the call would mark the slot for an upload for nothing
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

    if (!this.#updating) this.#changedOutsideCycle = true;

    // whoever takes a tile out asks about it afresh next time: without this the set grows with
    // every coordinate ever refused and binds memory to the size of the map instead of the view
    this.#declined.delete(tileCoords.id);

    const tile = this.#tiles.get(tileCoords.id);
    if (tile !== undefined) {
      this.#tiles.delete(tileCoords.id);
      tileFactory.destroyTile(tile);
      ++this.#dataSerial;
    }
  }

  clearTiles(): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    this.#cleared = true;
    this.#declined.clear();

    // the serial gate in endUpdatingTiles() exists to keep the attribute buffers off the bus
    // when nothing was written — and a clear that finds nothing writes nothing. The emptied
    // `#declined` alone is no reason either: a refused tile never sat in a buffer. Counted before
    // the loop: a destroyTile() that throws has freed the slots before it already, and their
    // upload must not get lost.
    if (this.#tiles.size > 0) ++this.#dataSerial;

    // a tile goes back exactly once: it leaves `#tiles` before its destroyTile(), so when one
    // throws, only the tiles not yet given back remain for the next call
    for (const [id, tile] of this.#tiles) {
      this.#tiles.delete(id);
      tileFactory.destroyTile(tile);
    }
  }

  endUpdatingTiles(): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    const dataSerial = this.#dataSerial;
    if (this.#updateDataSerial < dataSerial) {
      tileFactory.update();
      // only once update() has come back: one that throws leaves the upload to the next cycle
      this.#updateDataSerial = dataSerial;
    }
    // closed only now: a throw in update() leaves the cycle open, and hasPendingTiles says so
    this.#updating = false;
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
    this.#tilesPending = false;
    this.#cleared = false;
    this.#changedOutsideCycle = false;
    this.#updating = false;
  }
}
