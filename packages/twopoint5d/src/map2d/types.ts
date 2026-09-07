import type {Matrix4, Object3D, Vector2, Vector3} from 'three/webgpu';
import type {AABB2} from './AABB2.js';
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

  createTile(tileCoords: IMap2DTileCoords): T | undefined;
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
   * `position` is read during the call and not kept by the caller's side of the contract:
   * the streamer hands over an instance it reuses, so a renderer that wants the value
   * afterwards copies it.
   *
   * `tilesChanged` says whether the tile coordinates of this cycle can differ from the last
   * one's. On `false` a renderer may leave the data of a tile it already holds untouched. It
   * still has to take on a tile it does not know yet, and it says nothing about the tiles
   * that arrive through {@link addTile} and {@link removeTile}. Left out, it counts as `true`.
   */
  beginUpdatingTiles(position: Vector3, tilesChanged?: boolean): void;

  /**
   * Add a tile to the renderer.
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
  tiles: IMap2DTileCoords[];

  /**
   * An instance the visibilitor reuses. Whoever needs the value beyond the call copies or
   * clones it; whoever keeps the instance keeps a value that moves underneath them.
   */
  offset?: Vector2;

  /**
   * An instance the visibilitor reuses. Whoever needs the value beyond the call copies or
   * clones it; whoever keeps the instance keeps a value that moves underneath them.
   */
  translate?: Vector3;

  removeTiles?: IMap2DTileCoords[];
  reuseTiles?: IMap2DTileCoords[];
  createTiles?: IMap2DTileCoords[];

  /**
   * `false` says that this result carries the same tiles, in the same order, with the same
   * view coordinates as the result of the previous call. A consumer may then leave the data
   * of a tile it already holds alone. Left out, it counts as `true`.
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

  /** Whether the helper nodes are built at all. */
  show: boolean;
}
