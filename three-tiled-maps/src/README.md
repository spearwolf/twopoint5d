
## Tiled Maps

All tiles are generally determined by a numerical (`uint32`) ID.
For simplicity, it is assumed that the tiles are located in a 2D coordinate system.

![the tile coordinates system](./tile-coordinates.svg)

### The Source of the Tile IDs

The tile IDs are read out via the [IMap2dTileDataProvider](IMap2dTileDataProvider.ts) interface.

Tile IDs start at 1 and are unsigned integers, where `0` means there is no tile there.

#### RepeatingTilesProvider

The [RepeatingTilesProvider](./RepeatingTilesProvider.ts) is an easy to use tile data provider which repeats a 2D pattern of tile IDs endlessly.
Very helpful when you just need a constantly repeating background.

If you want you can limit the repeat to only horizontal or only vertical.

![repeating-tiles-provider cheat-sheet](./RepeatingTilesProvider.svg)
