# Tile maps

A tile map is an endless 2D map on the XZ plane of a `Map2D` node, streamed in around the view:
only the tiles the view reaches exist, one sprite per cell of the grid, and the tiles that leave
the view give their sprite back for the ones that enter it. The module `map2d/` splits that work
into a handful of parts, and a map is built by plugging them together. Beside the streaming, it
holds two spatial indexes for the data of a map: a quad tree over chunks and a hash grid over
renderables.

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
| `ChunkQuadTreeNode` | a quad tree over the chunks of a map: `subdivide()` once after filling it, `findChunks()`/`findChunksAt()` per query |
| `DataIdsChunk2D`, `NumberDataChunk2D`, `StringDataChunk2D`, `DataChunk2D` | a rectangle of the map with its data: tile ids out of a `Uint32Array` or base64, a number, a string, nothing |
| `Map2DSpatialHashGrid` | a spatial index of renderables over a grid of cells: `add()`, `findWithin()`, `remove()`, `clear()` |
| `AABB2` | the rectangle all of them take: `left`, `top`, `width`, `height` |

## A map under a camera

The usual map: the ground under a perspective camera that looks down at it. A tile id comes from
the data provider, the frame of that id from the tile set, and the id `0` is a hole — no sprite.
`RepeatingTilesProvider` takes ids that are whole numbers from 0 to 4294967295 — the range of the
`Uint32Array` that `getTileIdsWithin()` writes — and refuses a pattern with any other value.
`getTileIdAt()` and `getTileIdsWithin()` take their coordinates and counts as whole numbers —
the width and the height 0 or more — and throw a `RangeError` for anything else.

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
A rectangle that covers more than `maxVisibleTiles` tiles of the grid, 10 000 unless set, throws a
`RangeError` on the next `update()` before it builds a tile: make the area smaller or the tiles
larger, or raise the limit.

## Chunks of a map, found by a quad tree

The tile layers of a large map come in chunks — an infinite layer of a Tiled map writes each as
`{x, y, width, height, data}`, the ids in base64. Each chunk becomes a `DataIdsChunk2D`, all of
them go into a `ChunkQuadTreeNode`, and one `subdivide()` builds the tree. A frame then asks for
the chunks its view reaches, and a point asks for the chunks that hold it.

```ts check
import {AABB2, ChunkQuadTreeNode, DataIdsChunk2D} from '@spearwolf/twopoint5d';

// a chunk of an infinite tile layer of a Tiled map, in tiles, the ids in base64 without compression
interface TiledChunk {
  x: number;
  y: number;
  width: number;
  height: number;
  data: string;
}

declare const layerChunks: TiledChunk[];
declare function drawChunk(chunk: DataIdsChunk2D): void;

const tree = new ChunkQuadTreeNode<DataIdsChunk2D>(layerChunks.map((chunk) => new DataIdsChunk2D(chunk)));
// once, after the tree is filled
tree.subdivide();

// kept across frames: a query empties and fills the array it is handed, and allocates nothing
const view = new AABB2();
const visibleChunks: DataIdsChunk2D[] = [];
const chunksAtPoint: DataIdsChunk2D[] = [];

export function frame(left: number, top: number, width: number, height: number) {
  view.set(left, top, width, height);
  for (const chunk of tree.findChunks(view, visibleChunks)) drawChunk(chunk);
}

// the tile id at a point of the map, undefined where no chunk lies
export function tileIdAt(x: number, y: number): number | undefined {
  return tree.findChunksAt(x, y, chunksAtPoint)[0]?.readDataIdAt(x, y);
}
```

A base64 string is decoded on the first read of its chunk: a string that does not hold
`width × height` ids throws a `RangeError` then, and data that names a `compression` throws an
`Error` — inflate a compressed layer before. `readDataIdAt()` takes coordinates of the map and
answers `undefined` outside the chunk; a fractional point gets the id of the cell it lies in.

A chunk that arrives later goes in through `appendChunk()`, followed by `subdivide()` on the root,
which splits the leaves filled since. `subdivide(maxChunkNodes)` leaves up to that many chunks in a
leaf, 2 unless given, and splits a row or a column of chunks as well as a block of them. `clear()`
empties the tree.

## Renderables in a spatial hash grid

`Map2DSpatialHashGrid` finds objects by where they are: anything with an `aabb`
(`IMap2DRenderableArea`) goes into the cells of a grid that its `aabb` reaches into, and a query
hands out what lies in the cells of a rectangle.

```ts check
import {AABB2, type IMap2DRenderableArea, Map2DSpatialHashGrid} from '@spearwolf/twopoint5d';

// anything with an aabb in the units of the map goes into the grid
interface Pickup extends IMap2DRenderableArea {
  kind: string;
}

declare function drawPickup(pickup: Pickup): void;

// cells of 64 × 64, the first one at (0, 0)
const grid = new Map2DSpatialHashGrid<Pickup>(64, 64, 0, 0);

const coin: Pickup = {kind: 'coin', aabb: new AABB2(100, 40, 16, 16)};
const key: Pickup = {kind: 'key', aabb: new AABB2(300, 200, 16, 16)};
grid.add(coin, key);

// kept across frames, as for the quad tree
const view = new AABB2();
const inView: Pickup[] = [];

export function frame(left: number, top: number, width: number, height: number) {
  view.set(left, top, width, height);
  for (const pickup of grid.findWithin(view, inView)) drawPickup(pickup);
}

export function moveCoin(x: number, y: number) {
  coin.aabb.set(x, y, 16, 16);
  // a second add() moves the coin into the cells of its aabb as it is now
  grid.add(coin);
}

export function collect(pickup: Pickup) {
  grid.remove(pickup);
}

// a new level: the grid lets go of every pickup, and size counts 0
export function nextLevel(): number {
  grid.clear();
  return grid.size;
}
```

The grid remembers the cells of a renderable when it is added: a changed `aabb` leaves the
renderable where it lies until it is added again. An `aabb` that reaches into more than
`maxCellsPerRenderable` cells — 65 536 unless set, and `Infinity` turns the limit off — throws a
`RangeError` in `add()`, and none of the renderables of that call goes in: give the grid larger
cells or raise the limit. A query costs the cells of its rectangle or the cells the grid holds,
whichever are fewer, and hands out each renderable once, in no fixed order. `getTile()` hands out
the set of the cell itself; whoever needs it past the next `add()`, `remove()` or `clear()` keeps a
copy.

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
| `Map2D#xOffset`, `#yOffset` | `0` | where the grid starts, a finite number. The grid is anchored at the corner of a tile: tile `(0, 0)` spans `[xOffset, xOffset + tileWidth)`, and `-tileWidth / 2` centres the grid on the origin |
| camera `far` | the camera's own | bounds how far out the ground is searched; tilted towards the horizon, the ground in view grows with `far²` |
| `RectangularVisibilityArea` | `320 × 240` | the size of the rectangle, in world units |
| `RectangularVisibilityArea#maxVisibleTiles` | `10 000` | the most tiles the rectangle may cover on the grid; a larger one throws a `RangeError` on the next `update()`. 320 × 240 on the default grid of 1 covers 76 800 — set the tile size or the area |
| `ChunkQuadTreeNode#subdivide()` `maxChunkNodes` | `2` | the most chunks a leaf keeps; a query tests every chunk of each node on its way down, so a higher value gives a flatter tree with longer lists |
| `Map2DSpatialHashGrid` cell size and offset | `1 × 1`, `(0, 0)` | the grid a renderable is placed on, in the units of its `aabb`; cells about the size of the renderables keep each of them in a few cells |
| `Map2DSpatialHashGrid#maxCellsPerRenderable` | `65 536` | the most cells one `aabb` may reach into; on the default cells of 1 × 1 that is a renderable of 256 × 256, and a larger one throws in `add()` — size the cells to the renderables |

What `centerX`/`centerY` mean depends on the visibilitor; the TSDoc of `Map2D#centerX` lists each.

## Changing a map while it runs

Every change below is picked up by the next `update()`; none of them needs a call of its own
unless it says so.

- **The grid.** A new `tileWidth`, `tileHeight`, `xOffset` or `yOffset` clears the tiles, and the
  next `update()` lays out the whole set in the new grid.
- **The visibilitor.** Another visibilitor clears the tiles as well, and so does `undefined`: the
  next `update()` empties every tile renderer — its tiles leave the screen with that update — and,
  with a visibilitor in place, lays out the set it finds.
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

The tile boxes go into the map node, in whose space they are computed. The plane, the points and the
frustum boxes are in world space and go into the root of the scene graph above the map, as that root
is at each `helpers.update()`: a map added to the scene after the helpers were switched on, or moved
into another scene graph, takes them along. `RectangularVisibilityAreaHelpers` keeps the rectangle
of a `RectangularVisibilityArea` in the node `add()` names: it goes into no root and follows none.

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

The helpers release their nodes in their own `dispose()`. The quad tree and the hash grid hold what
they are given and release none of it; their `clear()` lets go of everything. The rules behind all of this stand in
[the resource lifecycle](resource-lifecycle.md).
