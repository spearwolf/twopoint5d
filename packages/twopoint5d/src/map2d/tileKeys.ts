/**
 * The textual key of a tile coordinate. It is the one format the map2d module builds for a
 * tile: the `id` of a `Map2DTileCoords`, the bucket keys of `Map2DSpatialHashGrid`, and
 * whatever a caller assembles to look a tile up in either of them. It reads in the order of
 * the arguments and needs no special case for a negative coordinate.
 */
export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

// A biased pair of 26-bit numbers: the packed value stays below 2^52, which a double carries
// exactly. The bias lifts a negative coordinate into the positive range instead of masking it
// away, and that is what makes the packing collision-free rather than merely fast.
const TILE_KEY_BIAS = 0x2000000; // 2^25
const TILE_KEY_SPAN = 0x4000000; // 2^26

/**
 * Packs a tile coordinate into a single number, for a hot path that keys a `Map` or a `Set`
 * by a tile and would otherwise build a string per lookup.
 *
 * The result is exact and free of collisions for every coordinate in `[-33554432, 33554431]`.
 * Outside that range the packed value is the one of some other coordinate; a tile grid would
 * have to span 67 million tiles in one direction to reach it.
 */
export function packTileCoords(x: number, y: number): number {
  return (y + TILE_KEY_BIAS) * TILE_KEY_SPAN + (x + TILE_KEY_BIAS);
}
