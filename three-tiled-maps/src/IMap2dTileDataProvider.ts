/**
 * The source of the tile IDs.
 *
 * For simplicity, it is assumed that the tiles are located in a 2d coordinate system.
 */
export interface IMap2dTileDataProvider {
  getTileIdsWithin(
    left: number,
    top: number,
    width: number,
    height: number,
    target?: Uint32Array
  ): Uint32Array;
}
