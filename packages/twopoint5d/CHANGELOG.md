# CHANGELOG

All notable changes to [@spearwolf/twopoint5d](https://github.com/spearwolf/twopoint5d/tree/main/packages/twopoint5d) will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- add `IRenderable` interface (`renderTo(renderer: WebGPURenderer): void`) — implemented by `Stage2D` and `StageRenderer`
- add `IStageRendererHost` interface (`onResize`, `onRenderFrame`) — the parent type a `StageRenderer` needs from a frame-loop host; `Display` satisfies it structurally
- add `StageRenderer#clear: boolean` flag — explicit opt-in for clearing the render target before drawing the stages (default `false`)
- add `OnAddToParent` event on `StageRenderer` (symmetric to `OnRemoveFromParent`)
- add `Stage2D#renderTo(renderer)` — renders `scene` with `camera`; no-op until both exist
- add fluent return (`this`) on `StageRenderer#add()`, `#remove()`, `#setClearColor()`, `#attach()`, `#detach()`
- add JSDoc on `StageRenderer` covering the two frame-loop modes (auto via `parent`, manual via direct `updateFrame()` + `renderTo()`), the clear policy, and the `name` / `renderOrder` uniqueness requirement
- add `StageRenderer.spec.ts` (21 cases) covering clear policy, rendering order, fluent API, name-collision warning, host wiring, parent/child nesting and `OnAddToParent`/`OnRemoveFromParent` symmetry
- add Stage2D `renderTo()` unit tests and an assertion that the removed clear-properties are no longer exposed
- add browser test `stage-renderer.test.js` in `@spearwolf/twopoint5d-testing` covering Display-driven rendering, additive multi-stage rendering, nested renderers, and `detach()`-unhook

### Changed

- change `StageRenderer#renderFrame(renderer)` → `StageRenderer#renderTo(renderer)` (renamed for `IRenderable` consistency)
- change `StageRenderer#add(stage)` parameter type from `IStage` to `IStage & IRenderable`
- change `StageRenderer.parent` type from `Display | StageRenderer` to `IStageRendererHost | StageRenderer` — any frame-loop host is now accepted
- change `StageRenderer#setClearColor(color, alpha?)` signature: `color: Color | null` (was `Color | null | undefined`); now sets `clear = true` and returns `this`
- change `StageRenderer.renderTo()` clear-state restore: `setClearAlpha` is only called when a clear actually happened — previously the renderer's alpha was overwritten on every frame
- change `StageRenderer` warns via `console.warn` when a stage is added whose `name` is already in use **and** `renderOrder` is non-default (otherwise the sort is ambiguous)
- change `IStage`: drop optional `scene?` / `camera?` (they were unused by the renderer pipeline); `Stage2D` still exposes them as its own properties

### Removed

- remove `Stage2D#clearColor`, `Stage2D#clearAlpha`, `Stage2D#autoClear` — never honored by `StageRenderer`. Use `Scene#background` for per-scene backgrounds or `StageRenderer#setClearColor()` for the renderer-level clear

### Migration Guide

#### `StageRenderer#renderFrame()` renamed to `renderTo()`

`StageRenderer` now implements `IRenderable` along with `IStage`. The render method follows the `IRenderable` contract.

**Before**

```ts
stageRenderer.renderFrame(renderer);
```

**After**

```ts
stageRenderer.renderTo(renderer);
```

#### `StageRenderer` no longer clears when only `clearAlpha = 0` is set

Previously, assigning `clearAlpha = 0` without a `clearColor` implicitly enabled clearing (with the renderer's current color, transparent). With the new explicit `clear` flag this no longer happens — you must opt in.

**Before**

```ts
stageRenderer.clearAlpha = 0; // implicitly cleared with alpha=0
```

**After**

```ts
stageRenderer.setClearColor(null, 0); // explicit transparent clear
// or:
stageRenderer.clear = true;
stageRenderer.clearAlpha = 0;
```

#### `Stage2D` clear properties removed

`Stage2D#clearColor`, `Stage2D#clearAlpha`, and `Stage2D#autoClear` were never read by the renderer pipeline.

**Before**

```ts
const stage = new Stage2D(projection);
stage.clearColor = new Color('#222');
stage.clearAlpha = 1;
stage.autoClear = true;
```

**After (per-stage background)**

```ts
import {Color} from 'three/webgpu';
const stage = new Stage2D(projection);
stage.scene.background = new Color('#222');
```

**After (renderer-level clear, e.g. for the root renderer of a stack)**

```ts
new StageRenderer(display).setClearColor(new Color('#222'), 1).add(stage);
```

#### `StageRenderer#add()` requires `IRenderable`

Any custom stage must now also implement `renderTo(renderer)`. Stages that previously relied on the implicit `scene && camera` path inside `renderStage()` need to expose a `renderTo()` instead:

**Before**

```ts
class MyStage implements IStage {
  name = 'my';
  scene = new Scene();
  camera = new PerspectiveCamera();
  resize() {/* … */}
  updateFrame() {/* … */}
}
```

**After**

```ts
class MyStage implements IStage, IRenderable {
  name = 'my';
  scene = new Scene();
  camera = new PerspectiveCamera();
  resize() {/* … */}
  updateFrame() {/* … */}
  renderTo(renderer: WebGPURenderer) {
    renderer.render(this.scene, this.camera);
  }
}
```

`Stage2D` users do not need to change anything — `Stage2D` ships with `renderTo()`.

#### Driving a `StageRenderer` from `Display`

If you constructed `StageRenderer(display)` **and** subscribed to `OnDisplayRenderFrame` yourself to call `stageRenderer.renderFrame(...)`, you were rendering every frame twice. Pick **one** of the two modes:

**Before (double-driving)**

```ts
const sr = new StageRenderer(display);
on(display, OnDisplayRenderFrame, ({renderer, now, deltaTime, frameNo}) => {
  sr.updateFrame(now, deltaTime, frameNo);
  sr.renderFrame(renderer);
});
```

**After (auto-driven — recommended)**

```ts
const sr = new StageRenderer(display); // updateFrame + renderTo run automatically
```

**After (manual — no `parent`)**

```ts
const sr = new StageRenderer();
on(display, OnDisplayRenderFrame, ({renderer, now, deltaTime, frameNo}) => {
  sr.updateFrame(now, deltaTime, frameNo);
  sr.renderTo(renderer);
});
```

## [0.20.0] - 2026-05-10

### Added

- add `ChunkQuadTreeNode#clear()`: reset a node back to a fresh empty leaf, dropping every child reference so the subtree becomes GC-eligible — useful for re-builds in tile-streaming scenarios
- add `isDisposed` getter on `VOBufferPool`
- add `dispose()` method to `VOBufferPool` (and the `VertexObjectPool` subclass)
  - releases the underlying typed-array memory eagerly by dropping every reference held in `pool.buffer.buffers` so the `ArrayBuffer`s can be reclaimed by the garbage collector even if downstream `THREE.BufferAttribute`s still hold a transient copy of the array reference — useful for long-running sessions with dynamic pool creation/teardown (e.g. tile streaming)
  - `usedCount` is reset to `0` and `isDisposed` flips to `true`; subsequent `dispose()` calls are no-ops (idempotent)
  - the `VertexObjectPool` override additionally invokes `onDestroyVO` for every still-alive vertex object, unlinks the buffer reference from each tracked VO and drops the internal VO index — VOs that survived earlier `freeVO()` swaps are unlinked too
- add `options.autoDispose` parameter to `InstancedVOBufferGeometry#attachInstancedPool(name, pool, options?)`
  - defaults to `true` — the attached pool is cleared together with the geometry on `dispose()`
  - set to `false` for pools that are shared with other geometries or otherwise managed by the caller
- add JSDoc for the `Display` resize model and the resize-related public API
- add `Display` resize browser tests in `@spearwolf/twopoint5d-testing`
- add ~40 unit tests for `ChunkQuadTreeNode` covering `clear()`, `findChunksAt()` happy paths + missing-quadrant tolerance, the `findChunks(aabb, out)` signature, axis-straddler routing, idempotency of `subdivide()`, the no-axis-splittable bail-out, and a 1k-chunk subdivide stress smoke
- add `AABB2#isInsideAABB` regression tests for asymmetric containers (x/y-swap reproducer)
- add unit-test suite `CameraBasedVisibility.spec.ts` covering visibility classification (create / reuse / remove), dependency-based caching, parallel-camera edge cases, distance-sorted `visibles`, helper contract (`frustumBox` / `box` / `centerWorld` / `map2dTile`), `offset` / `translate` outputs, and a low-GC regression check that the pooled `TileBox` instances are reused across non-cached calls
- add unit tests covering `dispose()` for both `VOBufferPool` and `VertexObjectPool`: idempotency, typed-array release, used-count reset, `onDestroyVO` fan-out (incl. interaction with `freeVO()`), buffer-reference unlinking, and the no-VOs-alive case
- add unit tests for `AnimatedSpritesMaterial` covering construction and the full `dispose()` contract (texture release, no-op on missing `animsMap`, ordering vs. `NodeMaterial#dispose`, signal/effect leak check, idempotent double-dispose)

### Changed

- simplify `AABB2#isNorthWest()` / `isNorthEast()` / `isSouthEast()` / `isSouthWest()` — drop redundant OR clauses, semantics unchanged (all 52 existing quadrant assertions still pass)
- perf `ChunkQuadTreeNode#subdivide()`: O(n²) → O(n × unique-origins) per level — single-pass min instead of `map`/`filter`/`sort`, dedup adjacent origin candidates, eliminate the per-call `Function.prototype.bind`, partition straight into four bucket arrays + straddler list (one pass over chunks, no transient `appendChunk()` round-trip), child nodes take ownership of their bucket arrays without a copy
- perf `ChunkQuadTreeNode#findChunks(aabb, out?)`: optional caller-supplied output array — avoids the per-recursion `Array#concat` allocation chain in hot paths (per-frame visibility queries); chunks are pushed in place
- typecheck `ChunkQuadTreeNode`: `originX`/`originY` and `nodes.{north,south}{East,West}` now correctly typed as `number | null` / `ChunkQuadTreeNode | null` (previously `@ts-ignore`'d to `number` / non-null) — V8 hidden-class stays stable from construction
- perf `CameraBasedVisibility#computeVisibleTiles()`: reduce per-frame GC pressure
  - pool `TileBox` slots (and their `Box3` / `Vector3` / `Map2DTileCoords` shells) by tile id, mutate them in place across frames
  - replace the per-frame `previousTiles.slice(0)` + linear `findIndex` / `splice` (O(n²)) with an id-keyed `Map` lookup (O(n))
  - reuse the `visitedIds` `Set`, the BFS stack, and the `Vector3` / `Vector2` / `Line3` scratch instances instead of reallocating each frame
  - hoist the 8-neighbour offsets to a module constant and walk them with a `for` loop (no per-tile `forEach` callbacks)
  - sort `visibles` once with `Array.sort` instead of a quadratic sorted-insert loop
- upgrade dependencies
  - `@spearwolf/eventize@4.3.1`
  - `@spearwolf/signalize@0.28.0`

### Removed

- remove dummy `number-or-the-beast.test.js` from `@spearwolf/twopoint5d-testing`

### Fixed

- fix `AABB2#isInsideAABB()`: corner-coordinate test no longer swaps x/y — previously an inner aabb whose `top` exceeded the container's width (or whose `left` exceeded the container's height) was reported as outside even when fully contained
- fix `ChunkQuadTreeNode#findChunksAt()`: leaf-guard added — previously every call against a subdivided tree (or a non-subdivided leaf) crashed with a null deref as soon as the recursion descended into a child leaf
- fix `ChunkQuadTreeNode` axis heuristic (`scoreAxis`/`findAxis`): drop the bogus per-call `beforeChunks`/`intersectChunks`/`afterChunks` arrays (chunks were pushed but the entries were the outer chunk argument, not the iterated chunk — the lists were never read but were a latent bug); replace with three integer counters
- fix `Display`: `OnDisplayResize` now fires exactly once per frame (previously double-emitted on the first frame when the constructor measurement and the first-frame measurement differed)
- fix `InstancedVOBufferGeometry#dispose()`: extra instanced pools attached via `attachInstancedPool()` are now actually cleared, and the `extraInstancedBuffers` / `extraInstancedBufferSerials` bookkeeping maps are emptied
- fix `AnimatedSpritesMaterial#dispose()` order: the `animsMap` texture is now released, reset and its signal handle destroyed _before_ `super.dispose()` tears down the `SignalGroup` attached to the material — previously the cleanup relied on signalize's "destroyed signal still returns last value" lenience

### Migration Guide

#### `InstancedVOBufferGeometry#attachInstancedPool()` now disposes attached pools by default

Pools attached via `attachInstancedPool()` are now cleared together with the geometry when `dispose()` is called (previously they leaked — see the `### Fixed` entry above). If a pool is shared with other geometries or otherwise managed by the caller, opt out via `autoDispose: false`.

**Before**

```ts
geom.attachInstancedPool('foo', sharedPool);
geom.dispose(); // sharedPool was leaked
```

**After**

```ts
// shared pool — keep it alive past geom.dispose()
geom.attachInstancedPool('foo', sharedPool, {autoDispose: false});

// owned pool — dispose() will clear it (new default)
geom.attachInstancedPool('bar', ownedPool);
```

## [0.19.0] - 2026-02-27

- upgrade dependencies to `three@0.183.1`

## [0.18.5] - 2026-01-12

- delegate renderer to texture ressources in `TextureStore` on change

## [0.18.4] - 2026-01-08

- refactor TextureStore#dispose() to use SignalGroup#clear() and clear renderer reference

## [0.18.3] - 2026-01-08

- revert back to `three@0.181.2` due to _undefined_ `GPUShaderStage` issues with `three/webgpu` in `0.182.0`
  - see https://github.com/mrdoob/three.js/issues/32529

## [0.18.2] - 2026-01-06

- fix `TextureStore` type mappings for tuple destructuring in `.on()` and `.get()` methods
  - tuple types are now properly preserved instead of being flattened to union types
  - callbacks with destructured parameters now receive correctly typed values
  - added `MapTuple` helper type for recursive tuple mapping
  - applied `const` type parameter modifier to prevent array literal widening

## [0.18.1] - 2026-01-05

- fix import `Camera` as _type_ issue in `Stage2D`

## [0.18.0] - 2026-01-05

- improve type safety in `TextureStore`
  - replace `any` type with mapped types in `.on()` and `.get()` methods
  - add `TextureResourceSubTypeMap` type mapping each `TextureResourceSubType` to its corresponding TypeScript type
  - callbacks now receive properly typed values based on the requested resource type
- fix initial geometry update issue (`instanceCount` is _Infinity_ error) for `TileSprites` managed by a `TileSpritesFactory`
- upgrade dependencies
  - three@0.182.0
  - @spearwolf/signalize@0.25.0

## [0.17.0] - 2025-11-25

- add `frameRate` (fps) option as alternative to `duration` in `FrameBasedAnimations`
  - the `add()` method now accepts either a `duration` number or an `AnimationTimingOptions` object with `frameRate` or `duration`
  - when using `frameRate`, the duration is automatically calculated as `frameCount / frameRate`
  - added validation to ensure `frameRate` is greater than 0
  - updated `TextureResource` to support `frameRate` in declarative animation configuration
- add `anchorPosition` support to `fitIntoRectangle`
  - new types: `AnchorPosition`, `AnchorPositionX`, `AnchorPositionY`
  - new function: `parseAnchorPosition()` - parses anchor position strings into [y, x] components
  - new function: `calculateAnchorOffset()` - computes view offset based on container/view size difference and anchor position
  - updated `FitIntoRectangleSpecs` type to include optional `anchorPosition` property

## [0.16.0] - 2025-11-24

- add `resize(capacity: number): void` method to `VertexObjectPool`
  - enables dynamic capacity adjustment while preserving existing vertex objects
  - validates input: rejects negative or non-integer capacities
  - updates internal buffer references in existing vertex objects
  - adjusts `usedCount` to not exceed the new capacity
- improve `TextureSprites`and `AnimatedSprites`
  - enhance typscript definitions for better type safety and developer experience
  - add `.dispose()` method to free up resources when no longer needed
- enhance `TextureStore` error handling
  - improve error messages for better debugging and user feedback

## [0.15.0] - 2025-11-21

- improve `TextureStore`
  - load and create _frameBasedAnimations_ from _json_
  - The _textureStore_ now also supports the _atlas_ type when creating a _tileSet_.
  - The `textureStore.get()` method has been renamed to `.on()` and a new implementation of `.get()` (which replaces the old one) has been added. The new `.get()` method behaves exactly like `.on()` but returns a promise once.
  - add `.dispose()` method
  - fix an issue that prevented the _textureFactory_ from being created when the _renderer_ property was set very early on
- clean up _events.js_
  - remove obsolete `StageRenderFrameProps` interface

## [0.14.0] - 2025-11-19

- refactor all 'three' imports: use only 'three/webgpu'
- remove obsolete classes:
  - `CustomChunksShaderMaterial`
  - `ShaderLib`
  - `ShaderTool`

## [0.13.0] - 2025-11-18

> [!CAUTION]
> This version breaks with many things and clearly moves towards the use of WebGL2 and WebGPU!
>
> This follows the three.js library, which currently comes in two variants:
> `import THREE from 'three'` _vs._ `import THREE from 'three/webgpu'`
>
> Starting with version `0.13`, `twopoint5d` is freeing itself from legacy issues and moving completely to the `three/webgpu` side!
>
> The new _node materials_ and the _three shader language_ are exactly what was envisioned when `@spearwolf/twopoint5d` was created.
> Instead of getting lost in custom workarounds that use the old materials and shaders, we have now switched exclusively and consistently to _tsl_.

- only use the `three/webgpu` package as import
- upgrade to three.js r181
- refactor `Display` &rarr; `resize`, `renderFrame` events
  - add types, constants and interfaces for `OnDisplayResize` and `OnDisplayRenderFrame`
  - _MIGRATION NOTE:_ the `frame` event has been renamed to `renderFrame`
  - add new helpers:
    - `display.onResize(callback)`
    - `display.onRenderFrame(callback)`
    - `display.onInit(callback)`
    - `display.onStart(callback)`
    - `display.onPause(callback)`
    - `display.onRestart(callback)`
    - `display.onDispose(callback)`
- the types and constants from `/events.js` are now included in the main module
  - _MIGRATION NOTE:_ the import of `@spearwolf/twopoint5d/events.js` is no longer supported. just use `@spearwolf/twopoint5d` instead.
- _MIGRATION NOTE:_ renamed `DisplayEventArgs` to `DisplayEventProps`
- _MIGRATION NOTE:_ dropped `OnResizeProps` and `OnRenderFrameProps`. the only truth is `DisplayEventProps`
- add new constants and types: `OnDisplayInit`, `OnDisplayStart`, `OntDisplayRestart`, `OnDisplayPause` and `OnDisplayDispose`
- The `VertexObjects` mesh is calling `.update()` in the constructor now
  - To avoid disappointment if the vertex object geometry was not manually updated initially.


## [0.12.0] - 2025-05-10

- refactor `IStage`, `PostProcessingRenderer`, add `Stage2DRenderPass`

&mldr;

## [0.11.0] - 2025-04-26

- remove auto creation of `WebGPURenderer` in `Display` when using `webgpu: true`
  - to avoid confusion with `three`and `three/webgpu` imports when using resolve aliases
  - you can still pass `renderer: new WebGPURenderer()` to the `Display` constructor (no need to pass `webgpu: true` in this case)
- convert last `three/examples/jsm` import to `three/addons`
- deactivate some hook tests in twopoint5d-r3f
  - time to ditch react-three-fiber support
    - the maintainance cost is too high

## [0.9.3] - 2025-03-26

- upgrade to `@spearwolf/signalize@0.20.1`

## [0.9.2] - 2025-03-26

- fix `PostProcessingRenderer` resize issues

## [0.9.1] - 2025-03-25

- fix _renderOrder_ '*' behavior

## [0.9.0] - 2025-03-25

- add _renderOrder_ feature to `StageRenderer` and `PostProcessingRenderer`
- the `IStage` interface have a _name_ property now

## [0.7.0] - 2024-01-09

### Added

- The `Display` class now supports the _optional_ `webgpu: true` parameter
  - If enabled, the new `WebGPURenderer` from `three/gpu` is used
  - The default is still the good old `THREE.WebGLRenderer`


## [0.6.0] - 2024-01-08

### Changed

- Use default dependencies instead of peer dependencies


## [0.5.0] - 2024-01-08

### Changed

- Upgrade dependencies
  - three@0.172.0
  - @spearwolf/eventize@4.0.1
  - @spearwolf/signalize@0.18.1
