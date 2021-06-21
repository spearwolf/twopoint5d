
## Tiled Maps

All tiles are generally determined by a numerical (`uint32`) ID.
For simplicity, it is assumed that the tiles are located in a 2D coordinate system.

![the tile coordinates system](./tile-coordinates.svg)

### The Source of the Tile IDs

The tile IDs are read out via the [IMap2dTileDataProvider](IMap2dTileDataProvider.ts) interface.

Tile IDs start at `1` and are unsigned integers, where `0` means there is no tile there.

#### RepeatingTilesProvider

The [RepeatingTilesProvider](./RepeatingTilesProvider.ts) is an easy to use tile data provider which repeats a 2D pattern of tile IDs endlessly.
Very handy when you just want a constantly repeating background.

If you want you can limit the repeat to only horizontal or only vertical.

![repeating-tiles-provider cheat-sheet](./RepeatingTilesProvider.svg)

### From Tile to 2D Coordinates

The [Map2dTileCoordsUtil](./Map2dTileCoordsUtil.ts) does the mapping from 2D coordinates to _tile_ coordinates.

the origin of the 2D coordinate system is assumed to be in the upper left corner (with the y-axis pointing down).

![map2d-tile-coords-util cheat-sheet](./Map2dTileCoordsUtil.svg)

### Map2DLayer

In a [Map2dLayer](a./../Map2dLayer.ts), the world is divided into a static grid with [tiles](./Map2dAreaTile.ts) of equal size.
Which tiles are displayed is determined by the _view area_ (which is an [AABB2](./AABB2.ts)) of the layer.

![Map2dLayer class diagram](./Map2dLayer.svg)

The layer does not render the tiles itself, it only manages which tiles are visible, which are created and which can be removed (because they are outside the view area).

![Map2dLayer update](./Map2dLayer-renderViewArea.svg)

Every time the _view area_ is updated (by calling `map2dLayer.update()` in combination with changes to the map2d layer properties), the [IMap2dLayerTilesRenderer](./IMap2dLayerTilesRenderer.ts) is informed about it using callbacks - these callbacks are always called in the same order:

![Map2dLayer update view area](./Map2dLayer-update-view-area.svg)

The [IMap2dLayerTilesRenderer](./IMap2dLayerTilesRenderer.ts) is responsible for the display of the tiles.
