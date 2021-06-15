/**
 * The source of the tile IDs.
 *
 * For simplicity, it is assumed that the tiles are located in a 2d coordinate system.
 *
 * Please bear in mind that all coordinates are given in _tile space_
 * - therefore only integer numbers should be used here
 */
export interface IMap2dTileDataProvider {
  getTileIdAt(col: number, row: number): number;

  getTileIdsWithin(
    left: number,
    top: number,
    width: number,
    height: number,
    target?: Uint32Array,
  ): Uint32Array;
}
