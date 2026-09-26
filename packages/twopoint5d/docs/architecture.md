# Library architecture: `@spearwolf/twopoint5d`

How the library is put together, which layer may know about which, and where the
non-obvious mechanics sit. Read this before adding a feature or moving code between
modules. Day-to-day commands and repo rules are in the root `AGENTS.md`.

Two companion docs carry the rules this one only points at:
[**resource-lifecycle.md**](./resource-lifecycle.md) — binding for anything with a
`dispose()`, see section 3 — and the
[**stage layer cheat-sheet**](../src/stage/README.md) for `Display` + `Stage2D` +
`StageRenderer` idioms.

## 1. The public surface

`src/index.ts` re-exports one `public-api.ts` per module, plus `src/events.ts`. That
set of `public-api.ts` files _is_ the package's API contract:

- Anything not re-exported through a `public-api.ts` is internal. Consumers get no
  deep imports, so internal files can be renamed and reshaped freely.
- A new public symbol is not published until it is added to its module's
  `public-api.ts`. `pnpm checkNameableTypes` fails the build when a published
  declaration references a type that consumers cannot name — usually the symptom of a
  type that was forgotten here.
- Type-only exports go through `export type` — `export type * from './types.js'`, or a
  named `export type {…}` list in a module that names its exports one by one, as
  `display/` does — matching `@typescript-eslint/consistent-type-imports` on the import
  side.

## 2. Layers

The stack is strictly bottom-up. A lower layer never imports from a higher one.

```
controls/  utils/          (input, helpers — no rendering state)
        map2d/            Tiled-style streaming maps
        sprites/          ready-made sprite meshes
        stage/            scenes, projections, render pipeline
        display/          canvas, renderer, frame loop
        texture/          atlases, tile sets, resource cache
        vertex-objects/   the buffer core everything else stands on
```

### `vertex-objects/` — the performance core

Everything else exists to make this layer usable. The idea:

1. A _vertex object description_ (`VertexObjectDescriptor`,
   `VertexAttributeDescriptor`) declares per-object attributes — how many vertices and
   indices an object has, which attributes it carries, their type and size.
2. `VertexObjectBuffer` / `VOBufferPool` / `VertexObjectPool` allocate one set of typed
   arrays for the whole pool and hand out JS objects whose generated getters and
   setters write straight into slices of those arrays.
3. `VOBufferGeometry`, `VertexObjectGeometry` and the `Instanced*` variants expose
   those arrays to three.js as a single `BufferGeometry`, so the whole pool draws in
   one call — usually via instanced rendering.

The class names in this module carry the layer they belong to. These rules are binding for
every class that is added here:

1. `VO` is the abbreviation of "vertex object" throughout the module: the `VO` type in
   `types.ts`, the `voBuffer` and `voIndex` symbols, `VOAttrSetter` and `VOAttrGetter`.
2. The layer boundary runs along one question: does the class know the type of the object it
   hands out? `VOBufferPool`, `VOBufferGeometry` and `InstancedVOBufferGeometry` do not; they
   work with buffer indices. `VertexObjectPool<VOType>`, `VertexObjectGeometry<VOType>` and
   `InstancedVertexObjectGeometry<VOInstancedType, VOBaseType>` extend them and hand out typed
   objects with generated accessors.
3. A new class is named `VO*` if it works without an object type and `VertexObject*` if it
   carries one.
4. Four classes stand across this line, and it is not a second rule: `VertexObjectBuffer`,
   `VertexObjectDescriptor` and `VertexAttributeDescriptor` sit below the line — both layers
   use them — and in `VOUtils` the `VO` is the type name from rule 1, not the layer prefix.

The consequence that matters when editing higher layers: what looks like thousands of
independent objects is one shared buffer. Reordering, freeing or copying an object
touches other objects' memory. Buffer updates are flagged for upload rather than
applied immediately — dropping a dirty flag silently renders stale data.

### `texture/`

`TextureAtlas` and `TileSet` describe where a frame lives inside an image;
`TextureCoords` is the value type they hand out. `TextureFactory` builds three.js
textures with a given set of options.

`TextureStore` with its `TextureResource`s is the way to load textures, atlases and tile
sets: a catalog names the resources, every image is fetched once however many resources
name it, every resource counts the subscriptions that hold it, and `getAsync()` and `on()`
hand out what it builds.
`TexturePackerJson` reads the TexturePacker formats, JSON Hash and JSON Array, rotated
frames included. The four `*Loader` classes are the older way and deprecated; they pad an
image to power-of-two sides, hand out its coordinates as a child of the padded canvas and
start from the texture class `nearest`, where the store loads the image as it is, with its
coordinates at the root, and starts from no texture class. `FrameBasedAnimations` turns a
sequence of atlas frames into the timing data the animated sprite shaders read.

### `display/`

`Display` owns the three.js renderer (WebGL or WebGPU —
`isWebGLRenderer` / `isWebGPURenderer` discriminate) and its canvas, unless the
canvas was handed to the constructor, and drives the frame loop.
`Chronometer` is the time source; `FrameLoop` and `FixedFrameLoop` are the two tick
strategies. Everything above this layer receives time and frame events from here
instead of reading the clock itself.

### `stage/`

`Stage2D` is a scene plus a projection; `IProjection` implementations
(`OrthographicProjection`, `ParallaxProjection`, with `ProjectionPlane` and
`fitIntoRectangle` doing the geometry) decide how world units map to the viewport when
the canvas resizes. `StageRenderer` composes several stages into one frame, and
`RootRenderPipeline` / `IPassProvider` wire in post-processing passes. The layer's own
cheat-sheet, including render-target ownership, is
[`src/stage/README.md`](../src/stage/README.md).

### `sprites/`

Ready-made vertex-object descriptions plus their geometry and `ShaderMaterial`:
`TexturedSprites` for static atlas frames, `AnimatedSprites` for frame-based
animation. Each comes as a triple — descriptor, `*Geometry`, `*Material` — and
`BaseSprite` holds what they share. New sprite types follow that same triple.
The orientation of a frame reaches the shader in two parts: `s`, `t`, `u` and `v` of the
tex coords carry where the frame lies and its horizontal and vertical flip, and the
diagonal flip of a turned frame travels as `texFlipDiagonal` — an instance attribute of
`TexturedSprites` and of the `TileSprites` in `map2d/`, and the second texel of a frame
in the `animsMap` of `AnimatedSprites`. `colorFromTextureByTexCoords()` swaps the two
components of its lookup by that value.

### `map2d/`

Tiled-map integration on top of the sprite layer. `Map2D` holds a
`Map2DTileStreamer` and its `Map2DTileRenderer`s. Visibility is pluggable:
`CameraBasedVisibility` culls tiles against the camera frustum,
`RectangularVisibilityArea` uses a plain rectangle, and both have `*Helpers` classes
that visualise what they decided. `Map2DTileCoords`, `Map2DTileCoordsUtil` and
`tileKeys` define the coordinate and key scheme — every tile coordinate has exactly one
key, and code that invents a second spelling reintroduces duplicate tiles.
`chunk-quad-tree/` and `Map2DSpatialHashGrid` are the spatial indexes tile providers
query.

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
manual subscription. When touching this code, the `using-eventize` and
`using-signalize` skills carry the semantics that differ from other libraries —
especially effect re-run conditions and cleanup.

## 5. Where tests live

- `*.spec.ts` next to the source, run by Vitest inside this package. Logic, coordinate
  math, buffer bookkeeping, descriptor parsing.
- `*.test.js` in `packages/twopoint5d-testing/test/`, run by `@web/test-runner` in real
  Chromium and Firefox. Anything that needs a GPU context: geometry uploads, shader
  compilation, visual results.

A change to rendering or GPU-buffer code needs both.
