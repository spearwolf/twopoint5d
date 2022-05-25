# tiled-maps

is a typescript library for rendering (game level) maps composed of 2D tiles with [three.js](https://threejs.org/) *\#gamedev* *\#pixelart* *\#creative-coding*

it's based on the [vertex-objects](../vertex-objects) library

examples can be found here:
- [tiled-maps-basic-layer-tiles-renderer](../../examples/vanilla/tiled-maps-basic-layer-tiles-renderer.html)

## A Grid of Tiles

### Tiled Maps

All tiles are generally determined by a numerical (`uint32`) ID.
For simplicity, it is assumed that the tiles are located in a 2D coordinate system.

![the tile coordinates system](src/tile-coordinates.svg)

#### The Source of the Tile IDs

The tile IDs are read out via the [IMap2dTileDataProvider](src/IMap2dTileDataProvider.ts) interface.

Tile IDs start at `1` and are unsigned integers, where `0` means there is no tile there.

##### RepeatingTilesProvider

The [RepeatingTilesProvider](src/RepeatingTilesProvider.ts) is an easy to use tile data provider which repeats a 2D pattern of tile IDs endlessly.
Very handy when you just want a constantly repeating background.

If you want you can limit the repeat to only horizontal or only vertical.

![repeating-tiles-provider cheat-sheet](src/RepeatingTilesProvider.svg)

#### From Tile to 2D Coordinates

The [Map2dTileCoordsUtil](src/Map2dTileCoordsUtil.ts) does the mapping from 2D _world_ coordinates to _tile_ coordinates.

the origin of the 2D coordinate system is assumed to be in the upper left corner (with the y-axis pointing down).

![map2d-tile-coords-util cheat-sheet](src/Map2dTileCoordsUtil.svg)

#### Map2DLayer

In a [Map2dLayer](src/Map2dLayer.ts), the world is divided into a static grid with [tiles](src/Map2dAreaTile.ts) of equal size.
Which tiles are displayed is determined by the _view area_ (which is an [AABB2](src/AABB2.ts)) of the layer.

![Map2dLayer class diagram](src/Map2dLayer.svg)

The layer does not render the tiles itself, it only manages which tiles are visible, which are created and which can be removed (because they are outside the view area).

![Map2dLayer update](src/Map2dLayer-renderViewArea.svg)

Every time the _view area_ is updated (by calling `map2dLayer.update()` in combination with changes to the map2d layer properties), the [IMap2dLayerTilesRenderer](src/IMap2dLayerTilesRenderer.ts) is informed about it using callbacks - these callbacks are always called in the same order:

![Map2dLayer update view area](src/Map2dLayer-update-view-area.svg)

The [IMap2dLayerTilesRenderer](src/IMap2dLayerTilesRenderer.ts) is responsible for the display of the tiles.
