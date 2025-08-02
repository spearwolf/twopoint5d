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
   */
  beginUpdatingTiles(position: Vector3): void;

  /**
   * Add a tile to the renderer.
   * Is called during the update cycle.
   */
  addTile(tileCoords: IMap2DTileCoords): void;

  /**
   * Reuse means that the tile has already been added to the renderer.
   * During the current update cycle, the tile is reused.
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

export interface IMap2DVisibleTiles {
  tiles: IMap2DTileCoords[];

  offset?: Vector2;
  translate?: Vector3;

  removeTiles?: IMap2DTileCoords[];
  reuseTiles?: IMap2DTileCoords[];
  createTiles?: IMap2DTileCoords[];
}

/**
 * The visibilitor decides which tiles are visible.
 */
export interface IMap2DVisibilitor {
  computeVisibleTiles(
    previousTiles: IMap2DTileCoords[],
    centerPoint: [number, number],
    tileCoords: Map2DTileCoordsUtil,
    matrixWorld: Matrix4,
  ): IMap2DVisibleTiles | undefined;
}

export interface IMap2DVisibilitorHelpers {
  add(scene: Object3D): void;
  remove(scene: Object3D): void;
  update(): void;
  show: boolean;
}
