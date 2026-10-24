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

  // The `contentSerial` of the factory the tiles this renderer holds were built with; a factory
  // that answers another one has every tile built again in the next update cycle.
  #builtContentSerial: number | undefined;

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
   * factory whose `update()` throws is asked again in the next one. `true` as well while the
   * {@link IMapTileFactory.contentSerial} of the factory differs from the one the tiles were built
   * with. See {@link IMap2DTileRenderer.hasPendingTiles}. `false` once {@link dispose} has run.
   */
  get hasPendingTiles(): boolean {
    const tileFactory = this.tileFactory;
    return (
      tileFactory !== null &&
      (this.#cleared ||
        this.#tilesPending ||
        this.#changedOutsideCycle ||
        this.#updating ||
        tileFactory.contentSerial !== this.#builtContentSerial)
    );
  }

  constructor(tileFactory: IMapTileFactory) {
    this.tileFactory = tileFactory;
    this.#builtContentSerial = tileFactory.contentSerial;
    this.node.name = 'twopoint5d.Map2DTileRenderer';
    tileFactory.addToNode(this.node);
  }

  beginUpdatingTiles(position: Vector3, tilesChanged = true): void {
    // this one never reaches the factory, but moving the node of a spent renderer is a
    // mutation all the same
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    // the factory builds something else for a coordinate now: every tile goes back, every hole is
    // asked about again, and the tiles handed in for reuse are built anew; the endUpdatingTiles()
    // of this cycle uploads what the clear gave back. The serial is taken over only once the tiles
    // are given back, so that a clear that throws is tried again
    const contentSerial = tileFactory.contentSerial;
    if (contentSerial !== this.#builtContentSerial) {
      this.#giveBackTiles(tileFactory);
      this.#builtContentSerial = contentSerial;
    }

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
      // updateTile() writes the position into the attribute buffer, and without the serial
      // endUpdatingTiles() leaves it on the CPU side — the same bookkeeping reuseTile() does.
      // Counted before the call: a factory that throws may have written or freed a slot already,
      // and that upload must not get lost; a call that wrote nothing costs at most one upload
      ++this.#dataSerial;
      tileFactory.updateTile(existing, tileCoords);
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
    // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
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

      // counted before the call, see addTile()
      ++this.#dataSerial;
      tileFactory.updateTile(tile, tileCoords);
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
      // counted before the call, see addTile()
      ++this.#dataSerial;
      tileFactory.destroyTile(tile);
    }
  }

  /**
   * Gives every tile this renderer holds back to the factory through
   * {@link IMapTileFactory.destroyTile}, forgets the coordinates the factory answered `undefined`
   * for, and brings the factory up to date through {@link IMapTileFactory.update} when it gave a
   * tile back or a write still waits for its upload: outside an update cycle no
   * {@link endUpdatingTiles} follows that would, and the tiles given back would go on being drawn.
   * {@link hasPendingTiles} stays `true` up to the end of the next update cycle. When
   * `destroyTile()` or `update()` throws, the error goes on; a second call gives back the tiles
   * that remain and uploads.
   */
  clearTiles(): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    this.#giveBackTiles(tileFactory);
    // outside an update cycle no endUpdatingTiles() follows that would upload the slots given
    // back — without the upload the tiles go on being drawn
    this.#uploadWrites(tileFactory);
  }

  #giveBackTiles(tileFactory: IMapTileFactory): void {
    this.#cleared = true;
    this.#declined.clear();

    // the serial gate in #uploadWrites() exists to keep the attribute buffers off the bus when
    // nothing was written — and a clear that finds nothing writes nothing. The emptied
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

  #uploadWrites(tileFactory: IMapTileFactory): void {
    const dataSerial = this.#dataSerial;
    if (this.#updateDataSerial < dataSerial) {
      tileFactory.update();
      // only once update() has come back: one that throws leaves the upload to the next call
      this.#updateDataSerial = dataSerial;
    }
  }

  endUpdatingTiles(): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    this.#uploadWrites(tileFactory);
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
    // other half of that call, and #giveBackTiles() is the one place in this class that does it —
    // here without the upload: the content of the factory leaves `node` right after, and whoever
    // serves the factory next uploads with its first cycle
    this.#giveBackTiles(tileFactory);

    tileFactory.removeFromNode(this.node);
    this.tileFactory = null;
    this.#builtContentSerial = undefined;
    this.#dataSerial = 0;
    this.#updateDataSerial = -1;
    this.#tilesChanged = true;
    this.#tilesPending = false;
    this.#cleared = false;
    this.#changedOutsideCycle = false;
    this.#updating = false;
  }
}
