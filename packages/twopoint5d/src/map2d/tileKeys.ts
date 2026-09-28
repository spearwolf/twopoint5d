/**
 * The textual key of a tile coordinate. It is the one format the map2d module builds for a
 * tile: the `id` of a `Map2DTileCoords`, the bucket keys of `Map2DSpatialHashGrid`, and
 * whatever a caller assembles to look a tile up in either of them. It reads in the order of
 * the arguments and needs no special case for a negative coordinate.
 */
export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

// the packing lives next to the writer the visibility uses on its hot path, see `packedTileKey.ts`
export {packTileCoords} from './packedTileKey.js';
