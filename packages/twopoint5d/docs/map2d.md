# Tile maps

A tile map is an endless 2D map on the XZ plane of a `Map2D` node, streamed in around the view:
only the tiles the view reaches exist, one sprite per cell of the grid, and the tiles that leave
the view give their sprite back for the ones that enter it. The module `map2d/` splits that work
into a handful of parts, and a map is built by plugging them together.

| part | its role |
| --- | --- |
| `Map2D` | the node in the scene; holds the streamer and the tile renderers, `update()` once per frame |
| `Map2DTileStreamer` | the grid (`tileWidth`, `tileHeight`, `xOffset`, `yOffset`) and the view center; asks the visibilitor and hands the tiles to the renderers |
| `CameraBasedVisibility` | a visibilitor: the tiles the view frustum of a camera reaches, nearest first |
| `RectangularVisibilityArea` | a visibilitor: the tiles a rectangle around the view center covers |
| `Map2DTileRenderer` | holds the tiles of one factory; asks again for the tiles it could not build |
| `TileSpritesFactory` | builds a sprite per coordinate out of an `IMap2DTileDataProvider` and a `TileSet` |
| `TileSprites` with `TileSpritesGeometry` and `TileSpritesMaterial` | the instanced mesh the sprites live in |
| `RepeatingTilesProvider` | an `IMap2DTileDataProvider` that repeats a pattern of tile ids |
| `CameraBasedVisibilityHelpers`, `RectangularVisibilityAreaHelpers` | a debug view of what the visibilitor decided |

## A map under a camera

The usual map: the ground under a perspective camera that looks down at it. A tile id comes from
the data provider, the frame of that id from the tile set, and the id `0` is a hole — no sprite.

```ts check
import {
  CameraBasedVisibility,
  Map2D,
  Map2DTileRenderer,
  RepeatingTilesProvider,
  TileSprites,
  TileSpritesFactory,
  TileSpritesGeometry,
  TileSpritesMaterial,
  type TileSet,
} from '@spearwolf/twopoint5d';
import {PerspectiveCamera, Scene, type Texture} from 'three/webgpu';

declare const tileSet: TileSet<unknown>; // the tiles of the map, out of a TextureStore
declare const texture: Texture; // the image of that tile set

const scene = new Scene();
const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 4000);
camera.position.set(0, 350, 500);
camera.lookAt(0, 0, 0);

const map2d = new Map2D();
// tiles of 256 × 256, the grid centred on the origin of the map node
map2d.tileWidth = 256;
map2d.tileHeight = 256;
map2d.xOffset = -128;
map2d.yOffset = -128;
map2d.visibilitor = new CameraBasedVisibility(camera);

// repeated in both directions from (0, 0) on; the 0 in the middle is a hole
const tileData = new RepeatingTilesProvider([
  [1, 2, 1],
  [2, 0, 2],
  [1, 2, 1],
]);

// room for the most tiles the view shows at once
const tileSprites = new TileSprites(new TileSpritesGeometry(2000), new TileSpritesMaterial({colorMap: texture}));
const tileRenderer = new Map2DTileRenderer(new TileSpritesFactory(tileSprites, tileSet, tileData));
map2d.addTileRenderer(tileRenderer);

scene.add(map2d);

export function frame() {
  map2d.update();
  // … and render the scene with the camera
}

export {tileRenderer, tileSprites};
```

`Map2D#update()` runs once per frame, before the scene is drawn: it asks the visibilitor and lays
the tiles out. A view that stands still costs no pass over the tiles. The visibility brings the
world matrix of the camera and its parents up to date by itself, but not its projection: whoever
changes `fov`, `aspect`, `near`, `far` or `zoom` calls `camera.updateProjectionMatrix()` before the
next `update()`.

## A map in a rectangle

`RectangularVisibilityArea` needs no camera: it lays out the tiles a rectangle of `width` ×
`height` covers, in world units. The rectangle appears around the origin of the map node,
and `centerX`/`centerY` of the map name the point of the map shown there — scroll the map by
moving them.

```ts check
import {Map2D, RectangularVisibilityArea} from '@spearwolf/twopoint5d';

const map2d = new Map2D();
map2d.tileWidth = 256;
map2d.tileHeight = 256;

const area = new RectangularVisibilityArea(640, 480);
map2d.visibilitor = area;

// the map point (1000, 500) appears at the origin of the map node
map2d.centerX = 1000;
map2d.centerY = 500;
map2d.update();

// switched off: the next update() gives every tile back and lays out none
area.width = 0;
map2d.update();

// switched on: the next update() lays out the whole set again
area.width = 640;
map2d.update();
```

A width or a height of `0` switches the area off and takes its tiles down on the next `update()`.

## Defaults and how they play together

Every default works on its own; a few of them have to fit one another.

| value | default | how it plays with the others |
| --- | --- | --- |
| `TileSpritesGeometry` `capacity` | `100` | fixed with the geometry, and far below the `maxVisibleTiles` a camera may reach. A view that shows more tiles leaves holes, and the renderer warns once: build the geometry for the most tiles the view shows at once |
| `CameraBasedVisibility#maxVisibleTiles` | `10 000` | the most tiles one recomputation takes, the nearest to the camera; the first cut warns once |
| `CameraBasedVisibility#depth` | `100` | the height of the box of a tile, in the units of the map. A box much higher than the tiles are wide passes the frustum test beyond the edge of a tilted view, and its tile counts as visible; as high as what stands on the map |
| `CameraBasedVisibility#frustumBoxScale` | `1.1` | how much larger than its tile the box is that the frustum is tested against: a margin before a tile that leaves the view is dropped. At least `1` |
| `CameraBasedVisibility#lookAtCenter` | `false` | with `false`, `centerX`/`centerY` shift the map under the camera: leave them at `0` for a map fixed in the world under a moving camera. With `true` they name the map point where the camera looks |
| `Map2D#tileWidth`, `#tileHeight` | `1` | the size of a cell of the grid, in the units of the map |
| `Map2D#xOffset`, `#yOffset` | `0` | where the grid starts. The grid is anchored at the corner of a tile: tile `(0, 0)` spans `[xOffset, xOffset + tileWidth)`, and `-tileWidth / 2` centres the grid on the origin |
| camera `far` | the camera's own | bounds how far out the ground is searched; tilted towards the horizon, the ground in view grows with `far²` |
| `RectangularVisibilityArea` | `320 × 240` | the size of the rectangle, in world units |

What `centerX`/`centerY` mean depends on the visibilitor; the TSDoc of `Map2D#centerX` lists each.

## Changing a map while it runs

Every change below is picked up by the next `update()`; none of them needs a call of its own
unless it says so.

- **The grid.** A new `tileWidth`, `tileHeight`, `xOffset` or `yOffset` clears the tiles, and the
  next `update()` lays out the whole set in the new grid.
- **The visibilitor.** Another visibilitor clears the tiles as well, and so does `undefined`: the
  next `update()` empties every tile renderer and, with a visibilitor in place, lays out the set it
  finds.
- **The tile set and the data provider.** Another `tileSet` or another `tileDataProvider` on the
  `TileSpritesFactory` has its renderers build every tile again on the next `update()`, the holes
  of the provider before included.
- **What is inside them.** A change within a provider or a tile set is not seen by the factory —
  a new pattern assigned to `RepeatingTilesProvider#tileIds` among them. After one, call
  `map2d.clearTiles()`:

```ts check
import type {Map2D, RepeatingTilesProvider} from '@spearwolf/twopoint5d';

declare const map2d: Map2D;
declare const tileData: RepeatingTilesProvider;

// the provider keeps a frozen copy: a new pattern is assigned, never written into
tileData.tileIds = [
  [3, 4],
  [4, 3],
];
map2d.clearTiles();
```

## Seeing what the visibility decided

`CameraBasedVisibilityHelpers` draws what a `CameraBasedVisibility` computed: the box of each
visible tile, the map plane, the points where the rays of the view frustum met it and some of the
boxes the frustum was tested against.

```ts check
import {CameraBasedVisibility, CameraBasedVisibilityHelpers, Map2D} from '@spearwolf/twopoint5d';
import type {PerspectiveCamera} from 'three/webgpu';

declare const camera: PerspectiveCamera;

const map2d = new Map2D();
const visibility = new CameraBasedVisibility(camera);
map2d.visibilitor = visibility;

const helpers = new CameraBasedVisibilityHelpers(visibility);
helpers.add(map2d);
helpers.show = true;

export function frame() {
  map2d.update();
  // after the map: the helpers draw the recomputation that update() ran
  helpers.update();
}

export function teardown() {
  helpers.dispose();
}
```

The tile boxes go into the map node, in whose space they are computed. The plane, the points and
the frustum boxes are in world space and go into the root of the scene graph above the map, as that
root is at each `helpers.update()`: a map added to the scene after the helpers were switched on, or
moved into another scene graph, takes them along. `RectangularVisibilityAreaHelpers` does the same
for the rectangle of a `RectangularVisibilityArea`.

## Who disposes what

Nothing of a map releases what it was handed. The order matters: the renderer gives its tiles back
to the factory while the geometry behind them still stands.

```ts check
import type {Map2D, Map2DTileRenderer, TileSprites, TileSpritesGeometry} from '@spearwolf/twopoint5d';

declare const map2d: Map2D;
declare const tileRenderer: Map2DTileRenderer;
declare const tileSprites: TileSprites<TileSpritesGeometry>;

// gives every tile slot back to the factory
tileRenderer.dispose();
// leaves the scene graph and lets the renderers go; releases nothing
map2d.dispose();
// the mesh is the caller's: its geometry and its material
tileSprites.geometry?.dispose();
tileSprites.material?.dispose();
// the texture of the tile set belongs to whoever loaded it, a TextureStore for one
```

The helpers release their nodes in their own `dispose()`. The rules behind all of this stand in
[the resource lifecycle](resource-lifecycle.md).
