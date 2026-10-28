# Library architecture: `@spearwolf/twopoint5d`

How the library is put together, which layer may know about which, and where the
non-obvious mechanics sit. Read this before adding a feature or moving code between
modules. Day-to-day commands and repo rules are in the root `AGENTS.md`.

Two companion docs carry the rules this one only points at:
[**resource-lifecycle.md**](./resource-lifecycle.md) — binding for anything with a
`dispose()`, see section 3 — and the [**stages guide**](./stages.md) for `Display` + `Stage2D` + `StageRenderer`,
projections and post-processing.

## 1. The public surface

`src/index.ts` re-exports one `public-api.ts` per module, plus `src/events.ts`. That set
of `public-api.ts` files _is_ the package's API contract:

- Anything not re-exported through a `public-api.ts` is internal. Consumers get no deep
  imports, so internal files can be renamed and reshaped freely.
- `display/`, `texture/`, `map2d/` (with `chunk-quad-tree/`) and `sprites/` name their
  exports one by one, because their files export for their neighbours as well: a new
  export of such a file stays internal until it is listed. A helper listed only because
  an earlier release published it carries `@deprecated`.
- A new public symbol is not published until it is added to its module's
  `public-api.ts`. `pnpm checkNameableTypes` fails the build when a published
  declaration references a type that consumers cannot name — usually the symptom of a
  type that was forgotten here.
- Type-only exports go through `export type` — `export type * from './types.js'`, or a
  named `export type {…}` list in a module that names its exports one by one, as the
  four modules above do — matching Biome's `useImportType` on the import side.

## 2. Layers

The stack is strictly bottom-up. A lower layer never imports from a higher one.

```
controls/         input: the pan control
map2d/            Tiled-style streaming maps
text/             bitmap fonts, text laid out into sprites
sprites/          sprite kinds built from features
stage/            scenes, projections, render pipeline
display/          canvas, renderer, frame loop
texture/          atlases, tile sets, resource cache
vertex-objects/   the buffer core everything else stands on
utils/            helpers without rendering state
```

`utils/` lies under every other layer: any of them may take its helpers from there, and
it imports no other module of the library. `src/events.ts` stands beside the stack: it
names the events of `display/`, `stage/` and `controls/` and types their payloads
against those modules through `import type` alone.

### `vertex-objects/` — the performance core

Everything else exists to make this layer usable. The idea:

1. A _vertex object description_ (`VertexObjectDescriptor`, `VertexAttributeDescriptor`)
   declares per-object attributes — how many vertices and indices an object has, which
   attributes it carries, their type and size.
2. `VertexObjectBuffer` / `VOBufferPool` / `VertexObjectPool` allocate one set of typed
   arrays for the whole pool and hand out JS objects whose generated getters and setters
   write straight into slices of those arrays.
3. `VOBufferGeometry`, `VertexObjectGeometry` and the `Instanced*` variants expose those
   arrays to three.js as a single `BufferGeometry`, so the whole pool draws in one call
   — usually via instanced rendering.

The class names in this module carry the layer they belong to. These rules are binding
for every class that is added here:

1. `VO` is the abbreviation of "vertex object" throughout the module: the `VO` type in
   `types.ts`, the `voBuffer` and `voIndex` symbols, `VOAttrSetter` and `VOAttrGetter`.
2. The layer boundary runs along one question: does the class know the type of the
   object it hands out? `VOBufferPool`, `VOBufferGeometry` and
   `InstancedVOBufferGeometry` do not; they work with buffer indices.
   `VertexObjectPool<VOType>`, `VertexObjectGeometry<VOType>` and
   `InstancedVertexObjectGeometry<VOInstancedType, VOBaseType>` extend them and hand out
   typed objects with generated accessors.
3. A new class is named `VO*` if it works without an object type and `VertexObject*` if
   it carries one.
4. Four classes stand across this line, and it is not a second rule:
   `VertexObjectBuffer`, `VertexObjectDescriptor` and `VertexAttributeDescriptor` sit
   below the line — both layers use them — and in `VOUtils` the `VO` is the type name
   from rule 1, not the layer prefix.

The consequence that matters when editing higher layers: what looks like thousands of
independent objects is one shared buffer. Reordering, freeing or copying an object
touches other objects' memory. Buffer updates are flagged for upload rather than applied
immediately — dropping a dirty flag silently renders stale data.

The generated accessors of every descriptor come from the same few factory functions in
`createVertexObjectPrototype.ts`, and V8 gives all closures of one function literal one
set of inline caches: the caches inside the accessors see the vertex objects of every
descriptor in the application. Where it counts, that costs nothing measurable. A loop
over the vertex objects of one pool sees one prototype, V8 inlines the accessors into
its optimized code and knows the shape of the object already — in
`src/vertex-objects/hot-path.bench.ts`, six pools on six descriptors, each written by a
loop of its own, run within a few percent of six pools on one descriptor. What costs is
a call site that sees the vertex objects of more than four prototypes: one loop for all
six pools takes about eighteen times as long per object there. Pools built from the same
description object share one descriptor and with it one prototype: the first of them
builds the descriptor, and every later one takes it over as long as the description
still describes what it did then — a description changed in the meantime gets a
descriptor of its own, and the pools built before keep theirs. A pool that takes over an
existing descriptor, or is handed one, checks its `basePrototype` against the names of
the vertex object again, as a new descriptor would. `new VertexObjectDescriptor()`
always builds a new one, and pools handed the same descriptor share it. The sprite and
tile geometries build their pools from the description constants of their modules, so
one loop over the sprites of several geometries of one type sees one prototype — in the
bench, one writer for six pools of one description runs as fast as a writer per pool. A
`FeatureSpritesGeometry` built with `attributeUsage` copies the description of its sprite
kind and shares its prototype with no other geometry. An accessor call that V8 does not inline
pays for the shared caches, about twice the time per call across six descriptors.
Accessors generated per descriptor with `new Function` would help only there, and they
would need `unsafe-eval` in the Content Security Policy of every application that turns
them on, so the factories are shared on purpose.

Methods on the hot path that take any number of values read them through `arguments`,
never through a rest parameter: `touch()` and `touchAttributes()` of both geometries,
`VertexObjectPool#touchVO()` and the generated `set…()` of an attribute of more than
sixteen values. Once the method of a second geometry class has run, V8 builds the rest
array on every call — 56 B with a single argument, measured on Node 24 —, while
`arguments` stays off the heap as long as the method itself reads only its `length` and
its elements; handing it to another function makes V8 build the object. Read with many
separate values it costs as well (112 B with twelve values), which is why the generated
setters of up to sixteen values declare their parameters one by one.
`src/vertex-objects/hot-path-allocations.spec.ts` measures `touch()`, `touchVO()` and the
setter of more than sixteen values.

### `texture/`

`TextureAtlas` and `TileSet` describe where a frame lives inside an image;
`TextureCoords` is the value type they hand out. `TextureFactory` builds three.js
textures with a given set of options.

`TextureStore` with its `TextureResource`s is the way to load textures, atlases and tile
sets: a catalog names the resources, every image is fetched once however many resources
name it, every resource counts the subscriptions that hold it, and `getAsync()` and
`on()` hand out what it builds; `acquireAsync()` does as `getAsync()` and holds the resource
until its lease is released. A resource is an `ImageTextureResource`, a `TileSetTextureResource`
or an `AtlasTextureResource` by its shape, each with the inputs of that shape alone, on the base
`TextureResource`; the store hands out their union, `AnyTextureResource`, which `type` narrows.
`TexturePackerJson` reads the TexturePacker formats, JSON Hash and JSON Array, rotated frames
included. The four `*Loader` classes are the older way and deprecated; they pad an image to
power-of-two sides, hand out its coordinates as a child of the padded canvas and start from the
texture class `nearest`, where the store loads the image as it is, with its coordinates at the root,
and starts from no texture class. `FrameBasedAnimations` turns a sequence of atlas frames into the
timing data the `AnimatedFrames` sprite feature reads. `AtlasFrameTable` lays frames of an atlas
into a uniform array, and `sampleAtlasFrame()` samples one of them per fragment in a `NodeMaterial`
of one's own — a repeated frame on a mesh — the first TSL of this layer. `DynamicAtlas` packs frames
drawn at run time onto the shelves of a canvas and hands out a `CanvasTexture` of it and an ordinary
`TextureAtlas` of its frames.

### `display/`

`Display` owns the three.js `WebGPURenderer` and its canvas, unless the canvas was handed to the
constructor, and drives the frame loop. The renderer draws through WebGPU, or through its WebGL 2
fallback where the browser has no WebGPU — `Display#isWebGLBackend` tells which. A `WebGLRenderer`
handed to the constructor is refused with a `TypeError`; `isWebGLRenderer` and `isWebGPURenderer`
tell the two renderer classes apart. `Chronometer` is the time source; `FrameLoop` and
`FixedFrameLoop` are the two tick strategies. Everything above this layer receives time and frame
events from here instead of reading the clock itself. The display also decides how many pixels a
frame has: a bound on the pixel ratio, a budget of pixels, a zoom of pixel art in whole device
pixels, and `AdaptiveResolution`, which sets the resolution scale by what every frame costs the GPU
— see [the display guide](display.md). The policy — the bounds of the ratio, the budget, the scale,
the rounding to an eighth, the zoom in whole device pixels — is a pure function in
`src/display/resolveDrawingBuffer.ts`, which the display measures with and `AdaptiveResolution`
predicts its steps with. The handover of a canvas between two displays — waiting for the release
of the one before, keeping its WebGL context lost but restorable, giving a canvas that was handed
in back as the display found it — is an internal module, `src/display/canvasHandover.ts`, which
`Display` enters at two places: `waitForCanvas()` before the init of its renderer and
`releaseRenderer()` after `dispose()`.

### `stage/`

`Stage2D` is a scene plus a projection; `IProjection` implementations
(`OrthographicProjection`, `ParallaxProjection`, with `ProjectionPlane` and
`fitIntoRectangle` doing the geometry) decide how world units map to the viewport when
the canvas resizes. `StageRenderer` composes several stages into one frame, and
`RootRenderPipeline` / `IPassProvider` wire in post-processing passes. The guide of the
layer, including render-target ownership, is [`docs/stages.md`](./stages.md).

### `sprites/`

Sprites are defined as kinds made of features. `defineSprite()` merges a base — `QuadBase`,
the quad every built-in kind is drawn from, or `gridBase({columns, rows})`, the quad cut into
cells for stages that move grid lines or bend — and a list of features (`InstancePosition`,
`QuadSize`, `Rotation`, `AtlasFrame`, `Tint` and the others) into a sprite kind: one merged
instanced vertex-object description, so one pool and one sprite handle per kind, and the
pipeline the features' shader stages form — a frame slot and frame stages read by both sides,
the trim shift, local stages, exactly one placement and mesh stages on the vertex side, uv
stages, a color source and color stages on the fragment side, each slot sorted by `order`. A
feature may check the kind it is part of (`checkKind`), and features that declare a uniform
shared hold one. `FeatureSpritesGeometry` holds the sprites of a kind, `FeatureSpritesMaterial`
folds its pipeline into the `positionNode` and `colorNode` of a `NodeMaterial` built with TSL
(`three/tsl`), and `SpriteResources` holds the uniforms and textures the features declare, shareable
between materials. `FeatureSprites` is the mesh: it builds the geometry and the material it is not
handed, releases only that in `dispose()`, and offers `createSprite()`, `freeSprite()` and
`spritePool`. `TexturedSpriteKind` and `AnimatedSpriteKind` are the presets for static atlas frames
and frame-based animation. The mesh slot after the placement is where the stages of passes over a
kind — shadows, mirrors — go. The guide, with the rules of each feature field and the migration from
the earlier sprite classes, is [`docs/sprites.md`](./sprites.md).

The orientation of a frame reaches the shader in two parts: `s`, `t`, `u` and `v` of the
tex coords carry where the frame lies and its horizontal and vertical flip, and the diagonal
flip of a turned frame travels as `texFlipDiagonal` — an instance attribute of `AtlasFrame`
and of the `TileSprites` in `map2d/`, and the second texel of a frame in the `animsMap` that
`AnimatedFrames` reads. The lookup of `TextureColor`, like `colorFromTextureByTexCoords()`,
swaps its two components by that value.

Where a trimmed frame lies in its untrimmed sprite travels as `texTrim`, the margins the
packer cut off — an instance attribute of `AtlasFrame` and the third texel of a frame in the
`animsMap` that `AnimatedFrames` reads — and the sprite material moves the corners of the
quad by them before every local stage.

### `text/`

Text out of bitmap fonts, as sprites of the layer below. `BitmapFont` reads the AngelCode
BMFont format — the text format, XML by a tokenizer of its own (no `DOMParser`, so it runs
in Node and in a worker) and the JSON of the common converters — into the metrics of its
lines, its glyphs and kerning pairs, and a `TextureAtlas` of its page with one untrimmed
frame per char. A font has one page. `layoutText()` lays a string out — boxes of the visible
glyphs, y up, the top of the first line at `y` — and `writeText()` writes such a layout into
sprites of any kind with `InstancePosition`, `QuadSize` and `AtlasFrame`: it creates them in the
`FeatureSprites` it is handed, places them by the extents of the base read off the geometry, and
hands them to the caller, who frees them. `rewriteText()` writes another text into the sprites of
one and reuses them, creating and freeing only the glyphs the new text has more or fewer. It is a
function over sprites, not a mesh of its own. The guide is [`docs/text.md`](./text.md).

### `map2d/`

Tiled-map integration on top of the sprite layer. `Map2D` holds a `Map2DTileStreamer`
and its `Map2DTileRenderer`s. Visibility is pluggable: `CameraBasedVisibility` culls
tiles against the camera frustum, nearest to the camera first and up to
`maxVisibleTiles` of them, `RectangularVisibilityArea` uses a plain rectangle of at most
`maxVisibleTiles` tiles, and both have `*Helpers` classes that visualise what they
decided. `CameraBasedVisibility` searches from the camera outwards over the two heaps of
`tileDistanceHeaps.ts` and keeps the slot of every tile in a `TileSlotPool`, which hands
the slot of a tile that leaves the view to one that enters it. Once a frame loop has
settled, neither visibility allocates anything in `computeVisibleTiles()` —
`src/map2d/hot-path-allocations.spec.ts` holds them to it —, and a tile that enters the
view costs its `Map2DTileCoords`. Both name each recomputation with the `serial` of its
result, and `Map2DTileStreamer` leaves a renderer out of `update()` while the result
carries the `serial` that renderer last laid out in a closed cycle and it reports no
`hasPendingTiles`: a standing view costs no pass over the tiles. `Map2DTileCoords`,
`Map2DTileCoordsUtil` and `tileKeys` define the coordinate and key scheme — every tile
coordinate has exactly one key, and code that invents a second spelling reintroduces
duplicate tiles. `chunk-quad-tree/` and `Map2DSpatialHashGrid` are the spatial indexes
tile providers query; both empty an `out` array before they fill it. The guide is
[`docs/map2d.md`](./map2d.md).

## 3. Resource lifecycle

**Writing or changing a `dispose()` means reading
[resource-lifecycle.md](./resource-lifecycle.md) first.** The rules there are binding —
a `dispose()` that breaks them is a bug, not a variation — and they answer:

- who owns what, and when a take-over is allowed at all (an instance releases what it
  created itself, nothing handed in, unless its own TSDoc promises otherwise);
- why a borrowed pool slot or factory tile still has to be given back;
- how to make `dispose()` idempotent, and how to prove it;
- what every public member does after `dispose()` — answer `undefined`, throw, or no-op,
  decided by its declared type;
- the teardown order for signals, eventize listeners, and `super.dispose()`;
- the checklist and the six test assertions to ship with a new `dispose()`.

## 4. Events and reactivity

The library leans on `@spearwolf/eventize` (synchronous event emitters) and
`@spearwolf/signalize` (signals, effects, memos, `SignalGroup`). Class hierarchies mix
in eventize; cross-object wiring is usually a signal link or an effect rather than a
manual subscription. When touching this code, the `using-eventize` and `using-signalize`
skills carry the semantics that differ from other libraries — especially effect re-run
conditions and cleanup.

## 5. Where tests live

- `*.spec.ts` next to the source, run by Vitest inside this package. Logic, coordinate
  math, buffer bookkeeping, descriptor parsing.
- `*.test.js` in `packages/twopoint5d-testing/test/`, run by `@web/test-runner` in real
  Chromium, Firefox and WebKit. Anything that needs a GPU context: geometry uploads, shader
  compilation, visual results.

A change to rendering or GPU-buffer code needs both.
