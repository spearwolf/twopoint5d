# CHANGELOG

All notable changes to [@spearwolf/twopoint5d](https://github.com/spearwolf/twopoint5d/tree/main/packages/twopoint5d) will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- add `FixedFrameLoop` — opt-in helper that wraps a `Display` and emits `OnTick` events at a fixed rate (default 60 fps) plus an `OnRender` event per render frame carrying an `alpha` interpolation factor in `[0, 1)`. Decouples simulation cadence from render cadence so per-frame JS-cost variance (physics, animation curves, IK) no longer produces visible micro-stutter even on high-refresh-rate displays. Spiral-of-death guard via `maxStepsPerFrame` (default 5). Auto-disposes when `Display` disposes
- add `Display#maxDeltaTime` getter/setter — proxy for the internal `Chronometer#maxDeltaTime`; default is `1 / 30` (~33ms) so individual frame outliers are capped instead of producing spikes. Set to `0` to disable
- add `Display#resizePollIntervalMs` — optional throttle (in milliseconds) for the per-frame DOM measurements inside `Display#resize()`. Default `0` keeps the legacy "measure every frame" behavior; on high-refresh-rate displays setting it to e.g. `1000 / 60` caps `getComputedStyle()` / `getBoundingClientRect()` calls and reclaims a significant slice of the frame budget
- add `Chronometer#reset(time?)` — return the chronometer to its initial state without allocating a new instance; `maxDeltaTime` is preserved
- add `Chronometer#maxDeltaTime` (also exposed as the second constructor argument) — optional upper bound for the per-`update()` delta; overflow is folded into `lostTime` so `time` stays continuous (covers rAF throttling in background tabs, long GC pauses, breakpoints). Default `0` means "disabled"
- add optional `time?` argument to `Chronometer#stop()` and `Chronometer#start()` — lets callers pin pause/resume to an explicit wall-clock so `lostTime` is tracked correctly even when no `update()` runs during the pause
- add `FixedFrameLoop.spec.ts` — 13 vitest cases covering tick cadence, accumulator drain, alpha monotonicity, multi-tick frames, spiral-of-death guard, prop forwarding, runtime `fps` updates, `reset()`, `dispose()` and `OnDisplayDispose` auto-cleanup
- add `FrameLoop.spec.ts` — vitest coverage for the first-frame `deltaTime`, `lastNow` emission, `measuredFps` warm-up, `maxFps` throttling (including grid-stability over many frames, jitter tolerance, long-pause snap-forward and `setFps()` reset), and `subscriptionCount` idempotency
- add `Chronometer.spec.ts` cases for: pause-without-update jump regression, hybrid pause (updates + idle wall-clock), `stop()`/`start()` idempotency, `maxDeltaTime` clamping, `reset()`
- add `IRenderable` interface (`renderTo(renderer: WebGPURenderer): void`) — implemented by `Stage2D` and `StageRenderer`
- add `IPassProvider` interface (`asPassNode(renderer): Node`) — TSL contribution of a stage; implemented by `Stage2D` (returns `pass(scene, camera)`) and `StageRenderer` (returns `texture(internalRT.texture)`)
- add `IStageRendererHost` interface (`onResize`, `onRenderFrame`) — the parent type a `StageRenderer` needs from a frame-loop host; `Display` satisfies it structurally
- add `ClearStage` — marker stage that emits `renderer.clear(...)` between siblings; depth-only by default, configurable via `{color, depth, stencil}` (use case: drop the depth buffer before drawing UI on top of the world)
- add `RootRenderPipeline` — `RenderPipeline` subclass with a built-in additive `buildOutputNode` (`p0.add(p1).add(p2)…`); assign as `StageRenderer.pipeline` to skip the `buildOutputNode` boilerplate for the common "compose every stage" case. User-set `buildOutputNode` still overrides the default
- add `StageRenderer#clear: boolean` flag — explicit opt-in for clearing the render target before drawing the stages (default `false`)
- add `StageRenderer#pipeline?: RenderPipeline` — optional `three.RenderPipeline` integration; without `buildOutputNode` (Mode C / §6.4) the stages render into an internal `RenderTarget` whose texture is sampled as `pipeline.outputNode`; with `buildOutputNode` (Mode D / §6.2) the user composes a TSL graph from per-stage pass nodes
- add `StageRenderer#outputRenderTarget?: RenderTarget` — redirect the renderer's final output into a `RenderTarget` instead of the canvas; useful for picking, screenshots or downstream passes; combines with `pipeline`
- add `StageRenderer#buildOutputNode?: (passes: Node[]) => Node` — TSL-composition hook used together with `pipeline`; called when the stage list changes; returns the node used as `pipeline.outputNode`
- add `StageRenderer#invalidateOutputNode()` — explicit "rebuild on next render" for the pipeline's `outputNode`
- add `StageRenderer#dispose()` — releases internal `RenderTarget`s and `this.pipeline`
- add `StageRenderer#asPassNode(renderer)` — returns a `texture()` node sampling this renderer's pass-target, for use inside a parent's `buildOutputNode`; the parent automatically pre-renders nested `StageRenderer` children into their pass-target before its own pipeline runs (§6.3)
- add `Stage2D#asPassNode(renderer)` — returns `pass(scene, camera)`; throws when camera is not ready (assign `projection` or call `resize()` first)
- add `OnAddToParent` event on `StageRenderer` (symmetric to `OnRemoveFromParent`)
- add `Stage2D#renderTo(renderer)` — renders `scene` with `camera`; no-op until both exist
- add fluent return (`this`) on `StageRenderer#add()`, `#remove()`, `#setClearColor()`, `#attach()`, `#detach()` — enables the three-line "Display + Stage2D + StageRenderer" idiom
- add JSDoc on `StageRenderer` covering the two frame-loop modes (auto via `parent`, manual via direct `updateFrame()` + `renderTo()`), the clear policy, and the `name` / `renderOrder` uniqueness requirement
- add `packages/twopoint5d/src/stage/README.md` cheat-sheet documenting roles, hello-world, manual vs. auto-driven mode, layering, `ClearStage`, nesting, clear policy table, custom stages, events, custom hosts and common pitfalls
- add `StageRenderer.spec.ts` (21 cases) covering clear policy, rendering order, fluent API, name-collision warning, host wiring, parent/child nesting and `OnAddToParent`/`OnRemoveFromParent` symmetry
- add `ClearStage.spec.ts` (5 cases) covering default flags, explicit options, naming, no-op lifecycle methods and runtime flag changes
- add Stage2D `renderTo()` unit tests and an assertion that the removed clear-properties are no longer exposed
- add browser test `stage-renderer.test.js` in `@spearwolf/twopoint5d-testing` covering Display-driven rendering, additive multi-stage rendering, nested renderers, and `detach()`-unhook
- add browser test `stage-pipeline.test.js` in `@spearwolf/twopoint5d-testing` covering Mode C internal-RT sampling, Mode D `buildOutputNode` invocation, and `dispose()` lifecycle
- add `RootRenderPipeline.spec.ts` (9 cases) covering the static additive composer (single / multi / empty), user-`buildOutputNode` precedence, `renderOrder` integration and outputNode rebuild on stage-list change — explicit verification that the composer receives ALL pass nodes
- add lookbook demo `stage-postprocessing.astro` — `Stage2D` with `bloom()` via `buildOutputNode`
- add lookbook demo `stage-nested-pipelines.astro` — outer `RootRenderPipeline` automatically composes a bloom-post-processed world layer (nested `StageRenderer` with its own pipeline) and a plain UI pass without an explicit `buildOutputNode`
- document the "one canvas writer per frame" constraint in `packages/twopoint5d/src/stage/README.md` (Mode E section + Common pitfalls): a `RenderPipeline.render()` and a plain `renderer.render(scene, camera)` cannot share the canvas within one frame — compose mixed stages via an outer pipeline instead

### Changed

- change `Chronometer#stop()` now captures the wall-clock timestamp; `Chronometer#start()` closes the pause-gap in `lostTime` and resets `#currentTime` + `deltaTime` to `0`, so the next `update()` produces a normal small delta even when no `update()` ran during the pause
- change `Chronometer#getCurrentTime` uses `Number.isNaN` instead of the global `isNaN`
- change `Display` constructs its internal `Chronometer` without the `0` seed (`new Chronometer()`), so `timeStart` is anchored to the wall-clock and the new `stop()`/`start()` gap-tracking takes effect
- change `DisplayStateMachine` Start/Pause handlers now pass an explicit `performance.now() / 1000` timestamp to `Chronometer#start()` / `stop()` / `update()` — guarantees a single coherent timestamp per transition
- change `Display[FrameLoop.OnFrame]` forwards the rAF timestamp from `FrameLoop` to `renderFrame()` instead of reading `performance.now()` again
- change `FrameLoop` `maxFps` throttle uses a rastered emit-schedule instead of the previous `now - lastNow >= 0.98 * interval` check — emissions stay on a fixed grid, vsync jitter is tolerated within 2% of the target interval, and long pauses (tab hidden, GC) snap the schedule forward instead of producing a catch-up burst on resume. Fixes the perceptible stutter on 120Hz/240Hz displays when a non-zero `maxFps` is configured
- change `StageRenderer.renderTo()` in pipeline mode always clears the internal pass-target each frame (transparent black, or the user's `clear`-color/alpha when `clear=true`) to avoid frame-content accumulation
- change `StageRenderer#renderFrame(renderer)` → `StageRenderer#renderTo(renderer)` (renamed for `IRenderable` consistency)
- change `StageRenderer#add(stage)` parameter type from `IStage` to `IStage & IRenderable`
- change `StageRenderer.parent` type from `Display | StageRenderer` to `IStageRendererHost | StageRenderer` — any frame-loop host is now accepted
- change `StageRenderer#setClearColor(color, alpha?)` signature: `color: Color | null` (was `Color | null | undefined`); now sets `clear = true` and returns `this`
- change `StageRenderer.renderTo()` clear-state restore: `setClearAlpha` is only called when a clear actually happened — previously the renderer's alpha was overwritten on every frame
- change `StageRenderer` warns via `console.warn` when a stage is added whose `name` is already in use **and** `renderOrder` is non-default (otherwise the sort is ambiguous)
- change `IStage`: drop optional `scene?` / `camera?` (they were unused by the renderer pipeline); `Stage2D` still exposes them as its own properties

### Removed

- remove `Stage2D#clearColor`, `Stage2D#clearAlpha`, `Stage2D#autoClear` — never honored by `StageRenderer`. Use `Scene#background` for per-scene backgrounds or `StageRenderer#setClearColor()` for the renderer-level clear

### Fixed

- fix `Chronometer`: a `stop()` → (no `update()`s during the pause) → `start()` cycle no longer attributes the pause duration to the next `update()` as a giant frame delta — the wall-clock gap is folded into `lostTime` instead, so `time` and `deltaTime` stay continuous across pauses. This was the root cause of "subjective jumps" after `Display.pause = false` and after every `document.visibilitychange` resume
- fix `Display.now` starts at `0` and remains continuous after `start()` — previously it jumped to `performance.now() / 1000` (≈ seconds since page load) on the first `OnDisplayStart` because the internal `Chronometer` was seeded with `0` and the wall-clock gap between construction and start was not tracked
- fix `Display#deltaTime` on `OnDisplayStart` after a `visibilitychange` resume is now `0` (was: the entire hidden-tab duration as a single frame delta)
- fix `FrameLoop`: first emitted `OnFrame` has `deltaTime: 0` instead of `NaN` (the previous conditional `this.#lastNow != null && this.frameNo === 1` was inverted and always fell through to `now - undefined` on the first tick)
- fix `FrameLoop`: `lastNow` in the emitted `OnFrame` props now reflects the previous frame's timestamp instead of being identical to `now` (the `#lastNow = now` assignment used to happen before the `emit()`)
- fix `FrameLoop#measureFps`: the first measurement window is now anchored to the first rAF timestamp instead of using `0` as `measureTimeBegin`, eliminating the bogus ~6 FPS phantom sample that polluted `measuredFps` until the first real 30-frame window completed

### Migration Guide

#### `Chronometer#stop()` / `start()` now track the wall-clock pause-gap

If you were calling `chronometer.stop()` and `chronometer.start()` without `update()` calls during the pause, your `time` and `deltaTime` used to jump on the next `update()` after `start()` (the entire pause was attributed to a single frame). After the fix, the pause-gap is folded into `lostTime` and the next `update()` produces a normal small delta.

For most callers this is purely a bugfix and no code change is needed. If you relied on the old jumping behavior (e.g. for an "elapsed-real-time" counter), use `performance.now()` directly instead.

If you want pause/resume to be anchored to a specific timestamp (for tests, replay, or to stay in lockstep with another clock), pass an explicit `time` argument:

**Before**

```ts
chronometer.stop();  // pausedAt was untracked
chronometer.start(); // pause duration was silently lost
```

**After**

```ts
chronometer.stop(t);   // pausedAt = t
chronometer.start(t2); // lostTime += (t2 - t)
```

#### `Chronometer#start()` resets `deltaTime` to `0`

Previously `start()` left `deltaTime` at its pre-pause value. Now it is `0` until the next `update()` — semantically there has been no active phase since the resume. If you query `chronometer.deltaTime` between `start()` and the next `update()`, you'll now see `0` (was: the last pre-pause delta).

#### `Display.now` no longer jumps on the first frame

`Display.now` (and the `now` field in `OnDisplayRenderFrame` / `OnDisplayStart` event props) now starts at `0` and stays small. Previously it jumped to `performance.now() / 1000` (≈ seconds since page load) on the first frame after `display.start()`. Code that was working around this — e.g. by subtracting the first `now` value to "rebase" the clock — can drop that workaround.

**Before (workaround)**

```ts
let t0: number | null = null;
display.onRenderFrame(({now}) => {
  if (t0 == null) t0 = now;
  const elapsed = now - t0; // rebase against first-frame jump
  // ...
});
```

**After**

```ts
display.onRenderFrame(({now}) => {
  const elapsed = now; // already starts at 0
  // ...
});
```

#### Optional `maxDeltaTime` to clamp frame-spike outliers

New in `Chronometer`. The bare class still defaults to `0` (disabled) so existing direct uses of `Chronometer` are preserved. Set it (in the same unit as your time source — seconds by default) to cap individual `deltaTime` values and fold the overflow into `lostTime`. Useful as a defensive guard against rAF throttling, GC pauses, or debugger breakpoints.

```ts
const c = new Chronometer(undefined, 1 / 30); // cap frame-delta at ~33ms
// or later:
c.maxDeltaTime = 1 / 30;
```

#### `Display` now caps `deltaTime` at `1 / 30` by default

`Display` seeds its internal `Chronometer` with `maxDeltaTime = 1 / 30` (~33ms). Subscribers will no longer see `deltaTime` values larger than that on a single frame — anything beyond is treated as lost time so `display.now` stays continuous. This is the right default for games / animations / physics and matches what most engines do, but it changes observable behavior for callers that consumed the raw "real wall-clock since last frame" value.

**Before**

```ts
display.onRenderFrame(({deltaTime}) => {
  // After a hidden-tab resume or a long GC pause, deltaTime could be
  // several seconds — and your integrator had to deal with it.
});
```

**After (default)**

```ts
display.onRenderFrame(({deltaTime}) => {
  // deltaTime ≤ 1/30; outliers are absorbed by the lost-time accumulator.
});
```

**Opt out (preserve old behavior)**

```ts
display.maxDeltaTime = 0;
```

#### `Display#resizePollIntervalMs` for high-refresh displays

`Display#resize()` runs every frame and forces a layout via `getComputedStyle()` + `getBoundingClientRect()`. On 240Hz monitors that is 240 forced reflows per second and can dominate the frame budget. Default remains `0` (legacy "every frame" behavior); opt in to throttle:

```ts
const display = new Display(canvas);
display.resizePollIntervalMs = 1000 / 60; // measure layout at most ~60Hz
```

The cheap hash-based no-op short-circuit inside `resize()` still applies on every poll, so this only affects the cost of the DOM reads — the renderer is still re-evaluated whenever the size actually changes.

#### Adopting `FixedFrameLoop` for smooth motion on high-refresh displays

Purely additive — existing `display.onRenderFrame(...)` code keeps working unchanged. The opt-in pattern decouples the simulation step (position/physics/animation update) from the render step (interpolation + draw), so the on-screen motion stays smooth even when frame timing varies.

**Before (delta-driven, susceptible to per-frame JS jitter)**

```ts
let x = 0;
display.onRenderFrame(({deltaTime, renderer}) => {
  x += velocity * deltaTime;            // integrated against variable dt
  mesh.position.x = x;
  renderer.render(scene, camera);
});
```

**After (fixed step + interpolation)**

```ts
import {FixedFrameLoop} from '@spearwolf/twopoint5d';

const sim = new FixedFrameLoop(display, {fps: 60});

let prevX = 0;
let currX = 0;

sim.onTick(({fixedDelta}) => {
  prevX = currX;
  currX += velocity * fixedDelta;       // deterministic, fixed step
});

sim.onRender(({alpha, renderer}) => {
  mesh.position.x = prevX + (currX - prevX) * alpha;
  renderer.render(scene, camera);
});
```

The loop subscribes to `Display`'s `OnDisplayRenderFrame` automatically and disposes itself when `Display` disposes. To tear it down earlier (e.g. switching scenes), call `sim.dispose()`.

#### `FrameLoop` `maxFps` cadence is now grid-stable

If you were using `new Display(canvas, {maxFps: N})` with `N` set (e.g. for power-saving on a 60Hz monitor) the emit cadence used to drift slightly with vsync jitter and could miss frames on 120Hz/240Hz monitors. The new rastered schedule keeps emissions on a fixed grid with a 2% jitter tolerance. No code change is required — but if you'd previously dialed `maxFps` to a non-divisor of your refresh rate to dodge the drift, you can now use the natural divisor (e.g. `maxFps: 60` on a 240Hz monitor).

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

#### Recommended idiom: fluent setup

Not a breaking change (the property-write style still works), but the fluent API documents intent more clearly and reads as one statement.

**Before**

```ts
const sr = new StageRenderer(display);
sr.clearColor = new Color('#90b0d0');
sr.add(stage);
```

**After**

```ts
new StageRenderer(display).setClearColor(new Color('#90b0d0')).add(stage);
```

#### Adopting the new `pipeline` integration

The new `pipeline` integration is purely additive; existing code paths continue to work unchanged. If you were running your own post-pass against the renderer manually, you can fold it into the `StageRenderer`:

**Before (manual pass + render)**

```ts
const sr = new StageRenderer(display).add(stage);
const renderTarget = new RenderTarget(width, height);
const scenePass = pass(stage.scene, stage.camera!);
const pipeline = new RenderPipeline(display.renderer);
pipeline.outputNode = bloom(scenePass);

on(display, OnDisplayRenderFrame, ({renderer}) => {
  renderer.setRenderTarget(renderTarget);
  sr.renderTo(renderer);
  renderer.setRenderTarget(null);
  pipeline.render();
});
```

**After (Mode D via `buildOutputNode`)**

```ts
const sr = new StageRenderer(display).add(stage);
sr.pipeline = new RenderPipeline(display.renderer);
sr.buildOutputNode = ([scenePass]) => bloom(scenePass); // pass is pulled from stage.asPassNode()
```

The renderer manages its own internal `RenderTarget`, sizes it on `resize()` and disposes it with `dispose()`.

#### Intermediate clears between layered stages

If you previously inserted custom rendering steps to clear the depth buffer between world and UI, use `ClearStage` instead.

**Before**

```ts
class _ClearDepth { name = 'cd'; resize(){} updateFrame(){} renderTo(r){ r.clear(false, true, false); } }
root.add(world).add(new _ClearDepth()).add(ui);
```

**After**

```ts
import {ClearStage} from '@spearwolf/twopoint5d';
root.add(world).add(new ClearStage({depth: true})).add(ui); // depth-only is the default
```

See `packages/twopoint5d/src/stage/README.md` for the full layering cheat-sheet.

#### `RootRenderPipeline` shortcut for additive composition

For the most common case — "compose every stage's pass additively as the pipeline output" — use `RootRenderPipeline` instead of `RenderPipeline` and skip `buildOutputNode` entirely.

**Before**

```ts
import {RenderPipeline} from 'three/webgpu';
root.pipeline = new RenderPipeline(display.renderer);
root.buildOutputNode = ([a, b, c]) => a.add(b).add(c); // boilerplate
```

**After**

```ts
import {RootRenderPipeline} from '@spearwolf/twopoint5d';
root.pipeline = new RootRenderPipeline(display.renderer); // additive composition built-in
```

Setting `stageRenderer.buildOutputNode` still overrides the default — use the explicit form when you need a non-additive composition (e.g. `bloom(scenePass)` wrapping a single pass).

#### Composing nested renderers with their own pipeline

Each `StageRenderer` can carry its own pipeline. The outer composition picks them up automatically.

**Before (separate, manually composed)**

```ts
const worldRT = new RenderTarget(w, h);
const worldPipeline = new RenderPipeline(renderer);
worldPipeline.outputNode = bloom(pass(worldScene, worldCamera));
on(display, OnDisplayRenderFrame, ({renderer}) => {
  renderer.setRenderTarget(worldRT);
  worldPipeline.render();
  renderer.setRenderTarget(null);
  // … now blit worldRT.texture as a quad, then render UI on top …
});
```

**After (nested renderers)**

```ts
const root = new StageRenderer(display).setClearColor(new Color('#000'));

const worldRenderer = new StageRenderer(root).add(worldStage);
worldRenderer.pipeline = new RenderPipeline(display.renderer);
worldRenderer.buildOutputNode = ([scene]) => bloom(scene);

root.add(uiStage); // plain on top
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
