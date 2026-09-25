import type {Matrix4, Object3D, Vector2, Vector3} from 'three/webgpu';
import type {AABB2} from './AABB2.js';
import type {noTileCapacity} from './constants.js';
import type {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';

export interface IMap2DRenderableArea {
  aabb: AABB2;
}

/**
 * The source of truth of the tile IDs.
 *
 * For simplicity, it is assumed that the tiles are located in a 2D coordinate system.
 *
 * Please bear in mind that all coordinates are given in _tile space_ therefore only integers should be used here!
 */
export interface IMap2DTileDataProvider {
  getTileIdAt(col: number, row: number): number;
  getTileIdsWithin(left: number, top: number, width: number, height: number, target?: Uint32Array): Uint32Array;
}

/**
 * The `IMap2DTileCoords` interface addresses a single tile in a tile grid.
 *
 * Has `x` and `y` coordinates (as _tile space_) and an `id`, as well as an {@link AABB2} (as view coordinates).
 */
export interface IMap2DTileCoords {
  id: string;
  x: number;
  y: number;
  view: AABB2;
}

export interface IMapTileFactory<T = unknown> {
  addToNode(node: Object3D): void;
  removeFromNode(node: Object3D): void;

  /**
   * Builds the tile for a coordinate and answers one of three things:
   *
   * - the tile, which the caller holds until it hands it back through {@link destroyTile}
   * - `undefined`: there is no tile at this coordinate. `Map2DTileRenderer` takes that as the
   *   answer for the coordinate and asks again only after the coordinate has gone through
   *   `removeTile()` or the renderer through `clearTiles()`
   * - {@link noTileCapacity}: the factory has no room for another tile right now. Nothing was
   *   built and nothing has to be given back; `Map2DTileRenderer` asks again in its next
   *   update cycle
   */
  createTile(tileCoords: IMap2DTileCoords): T | undefined | typeof noTileCapacity;
  updateTile(tile: T, tileCoords: IMap2DTileCoords): void;
  destroyTile(tile: T): void;

  /**
   * It is called at the end of a _renderer update cycle_ when tiles have been created, modified, or deleted.
   * This gives the factory the ability to synchronize any internal state or GPU data.
   */
  update(): void;
}

export interface IMap2DTileRenderer {
  node: Object3D;

  /**
   * Start the update cycle for the tiles.
   *
   * `position` is in the local space of the map node, the parent of {@link node}. It is read
   * during the call and not kept by the caller's side of the contract: the streamer hands over
   * an instance it reuses, so a renderer that wants the value afterwards copies it.
   *
   * `tilesChanged` says whether a tile the renderer already holds can come with other view
   * coordinates than it was last written with — after a change of the tile grid. While the grid
   * stands, a moving view keeps the view coordinates of every tile and moves only `position`.
   * On `false` a renderer may leave the data of a tile it already holds untouched. It
   * still has to take on a tile it does not know yet, and it says nothing about the tiles
   * that arrive through {@link addTile} and {@link removeTile}. Left out, it counts as `true`.
   */
  beginUpdatingTiles(position: Vector3, tilesChanged?: boolean): void;

  /**
   * Add a tile to the renderer.
   *
   * A coordinate the renderer already holds a tile for gets no second one: the tile it holds is
   * written on with the new coordinates, whatever `tilesChanged` said in
   * {@link beginUpdatingTiles}.
   *
   * Is called during the update cycle.
   */
  addTile(tileCoords: IMap2DTileCoords): void;

  /**
   * Carry a tile over into the current update cycle.
   *
   * Reuse is what the caller sees: the tile was part of the previous cycle as well. It is no
   * promise that the renderer still holds it — {@link clearTiles} empties a renderer without
   * the caller giving up its own tile list. A tile that is unknown here is therefore taken on
   * as {@link addTile} would take it on, and only a tile the renderer already holds falls under
   * the `tilesChanged` rule of {@link beginUpdatingTiles}.
   *
   * Is called during the update cycle.
   */
  reuseTile(tileCoords: IMap2DTileCoords): void;

  /**
   * Remove a tile from the renderer.
   * Is called during the update cycle.
   */
  removeTile(tileCoords: IMap2DTileCoords): void;

  /**
   * End the update cycle for the tiles.
   */
  endUpdatingTiles(): void;

  /**
   * Clear all tiles from the renderer.
   * It will be called independently of the update cycle.
   * `Map2DTileStreamer` calls it when it takes the renderer off, and before it lays out a whole
   * new tile set.
   */
  clearTiles(): void;

  dispose(): void;
}

/**
 * The tiles a visibilitor has found, together with the placement of the tile grid they belong to.
 *
 * The result is valid until the next {@link IMap2DVisibilitor.computeVisibleTiles} of the same
 * visibilitor. After that call every field may carry other values, and the object handed back
 * may be this very one.
 */
export interface IMap2DVisibleTiles {
  /**
   * Every tile visible now — the tile set of this result, and the list a caller hands back as
   * `previousTiles` in its next call.
   */
  tiles: IMap2DTileCoords[];

  /**
   * Where the origin of the tile grid lies in the local space of the map node, on its XZ plane:
   * `x` along X, `y` along Z. `Map2DTileStreamer` places the tile renderer nodes there.
   *
   * An instance the visibilitor reuses. Whoever needs the value beyond the call copies or
   * clones it; whoever keeps the instance keeps a value that moves underneath them.
   */
  offset?: Vector2;

  /**
   * The world position of the map node, the translation of the `matrixWorld` the visibilitor
   * was given. It is informational: the tile renderer nodes are children of the map node and
   * take on its whole transform, so nothing adds it to their position.
   *
   * An instance the visibilitor reuses. Whoever needs the value beyond the call copies or
   * clones it; whoever keeps the instance keeps a value that moves underneath them.
   */
  translate?: Vector3;

  /** The tiles of `previousTiles` that are not visible any more, or all of them on a new tile grid. */
  removeTiles?: IMap2DTileCoords[];

  /**
   * The tiles of `previousTiles` that stay visible; the caller holds them already. Together with
   * {@link createTiles} they hold the same tiles as {@link tiles}, not necessarily in its order.
   */
  reuseTiles?: IMap2DTileCoords[];

  /** The visible tiles that `previousTiles` did not hold. */
  createTiles?: IMap2DTileCoords[];

  /**
   * Whether a tile in `reuseTiles` can carry other view coordinates than it carried in the
   * previous result. `true` after a change of the tile grid, and on the first result a
   * visibilitor computes, which has no grid before it to hold the tiles of `previousTiles`
   * against. A view that moves while the grid stands leaves the view coordinates of every tile
   * as they were — the move goes into `offset` — and the result says `false`; the tiles that come
   * and go are in `createTiles` and `removeTiles` either way. A consumer may leave the data of a
   * tile it already holds alone while this is `false`. Left out, it counts as `true`.
   */
  changed?: boolean;
}

/**
 * The visibilitor decides which tiles are visible.
 *
 * An instance keeps the state of its last call and therefore serves exactly one
 * `Map2DTileStreamer`.
 */
export interface IMap2DVisibilitor {
  /**
   * Returns the tiles that cover the visible area around `centerPoint` on the `tileCoords` grid,
   * held against `previousTiles` and split into the tiles to create and to reuse, with the tiles
   * of `previousTiles` that fall out as `removeTiles`.
   * `undefined` says the visibilitor has no answer for this call and leaves the caller with what
   * it holds.
   *
   * A tile of `previousTiles` comes back for reuse only while the grid stands: its indices belong
   * to the grid it was computed on, and another grid cannot place them. So on a `tileCoords` grid
   * other than the one of the previous call, an implementation puts those tiles into
   * `removeTiles`. A first call has no earlier grid to hold against and takes `previousTiles` as
   * belonging to the grid it is given.
   *
   * `centerPoint` is read during the call: `Map2DTileStreamer` hands over a tuple it reuses, so a
   * visibilitor that wants the values afterwards copies them.
   */
  computeVisibleTiles(
    previousTiles: IMap2DTileCoords[],
    centerPoint: [number, number],
    tileCoords: Map2DTileCoordsUtil,
    matrixWorld: Matrix4,
  ): IMap2DVisibleTiles | undefined;
}

/**
 * The debug helpers of a visibilitor: nodes that show what the visibilitor computed, put into
 * a scene of the caller's choosing.
 */
export interface IMap2DVisibilitorHelpers {
  /** Names the scene the helper nodes go into. */
  add(scene: Object3D): void;

  /**
   * Takes the helper nodes out of the scene they were put into. The scene to hand over is the
   * one {@link add} was given; only for that one is the set guaranteed to come down whole.
   *
   * Any other scene is the caller's mistake and an implementation answers it as it sees fit —
   * it may leave everything standing, and it may take its set down out of the scene it was
   * actually given, whole or in part. Whoever holds a reference to a helper node therefore
   * keeps track of which scene the set was handed to.
   */
  remove(scene: Object3D): void;

  /** Brings the helper nodes up to the state the visibilitor currently describes. */
  update(): void;

  /**
   * Takes the helper nodes down for good and releases what they hold. The nodes of a helper
   * set are geometry and material on the gpu, and they hang on nothing but this instance —
   * whoever drops it without this call leaves them behind.
   *
   * It may be called any number of times. Afterwards the set stays down: a write to
   * `show`, {@link add}, {@link remove} and {@link update} build nothing and put nothing
   * into a scene. What `show` answers from then on is up to the implementation: one that
   * builds no nodes has nothing to keep down, fulfils all of this with an empty body, and
   * may let `show` answer what the caller writes.
   *
   * The interface does not say whether a set has been disposed. After `dispose()` every
   * member is a silent no-op, so a caller that holds a set has nothing to branch on; the
   * implementations in this package carry an `isDisposed` of their own.
   *
   * Whatever was handed in — the scene of {@link add} and the visibilitor the set reads — is
   * the caller's and is left as it is.
   */
  dispose(): void;

  /** Whether the helper nodes are built at all. */
  show: boolean;
}
