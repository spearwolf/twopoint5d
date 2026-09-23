/**
 * What `IMapTileFactory#createTile()` answers when the factory has no room for another tile
 * right now: its pool is full. It is not a tile, and it is not the answer `undefined` gives,
 * which says that there is no tile at the coordinate. Nothing was built, so nothing has to be
 * given back through `destroyTile()`.
 *
 * `Map2DTileRenderer` asks for such a coordinate again in its next update cycle, once a tile
 * that left the view may have given its slot back, and warns once per renderer that the
 * factory ran out of room.
 *
 * A registered symbol, so that two copies of this library in one page answer with the same one.
 */
export const noTileCapacity: unique symbol = Symbol.for('twopoint5d:IMapTileFactory.noTileCapacity');
