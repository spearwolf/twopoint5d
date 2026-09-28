import type {TilesWithinCoords} from './Map2DTileCoordsUtil.js';

/**
 * A `TilesWithinCoords` with every field in place, all 0, in the order `Map2DTileCoordsUtil`
 * writes them — the one shape its answers and the scratch objects of the visibilities share.
 */
export const createTilesWithinCoords = (): TilesWithinCoords => ({
  tileTop: 0,
  tileLeft: 0,
  top: 0,
  left: 0,
  height: 0,
  width: 0,
  tileHeight: 0,
  tileWidth: 0,
  rows: 0,
  columns: 0,
});
