# Stage layer cheat-sheet

Quick reference for `Display` + `Stage2D` + `StageRenderer` and the optional
`RenderPipeline` integration. Use this page when you want to ship something
fast and need the canonical idioms — for a deeper dive into the design
rationale see [`Backlog-StageRenderer.md`](../../../../Backlog-StageRenderer.md).

---

## Architecture at a glance

```
┌─────────────────────────────────────────────┐
│ Display                                     │   owns canvas + WebGPURenderer
│   – frame loop (OnDisplayRenderFrame)       │   drives the per-frame tick
│   – resize  (OnDisplayResize)               │
└──────────────────┬──────────────────────────┘
                   │ host: IStageRendererHost
                   ▼
┌─────────────────────────────────────────────┐
│ StageRenderer (root)                        │   container + render policy
│   – stages: IStage[]   renderOrder: string  │
│   – clear / clearColor / clearAlpha         │   §3.2
│   – pipeline?            §6.2 / §6.4        │   optional post-processing
│   – outputRenderTarget?  §6.4               │
│   – buildOutputNode?     §6.2               │
└──────────────────┬──────────────────────────┘
                   │ holds list of
                   ▼
┌─────────────────────────────────────────────┐
│ IStage  + IRenderable  + IPassProvider      │   per-stage contract
│ ┌──────────────┐  ┌──────────────────────┐  │
│ │ Stage2D      │  │ StageRenderer (nest) │  │
│ │ scene+camera │  │ children…            │  │
│ │ projection   │  │ own pipeline?        │  │
│ └──────────────┘  └──────────────────────┘  │
│  ClearStage   /   custom user stages        │
└─────────────────────────────────────────────┘
```

### Class roles

| Class | Role |
|---|---|
| `Display` | Owns the canvas + `WebGPURenderer`, drives the frame loop, emits resize/render events. Source of truth for size + time. |
| `Stage2D` | Holds a `THREE.Scene` and a camera derived from an `IProjection`. Implements `IStage + IRenderable + IPassProvider`. |
| `StageRenderer` | Container for stages. Implements `IStage + IRenderable + IPassProvider` so it can be nested. Optional clearing policy and `RenderPipeline` post-processing. |
| `Canvas2DStage` | Wraps an `HTMLCanvasElement` 2D-context drawing as a textured sprite inside a `Stage2D`. |
| `ClearStage` | Marker stage that emits `renderer.clear(...)` between siblings (depth-only by default). |
| `RootRenderPipeline` | `RenderPipeline` subclass with a built-in additive composition (`p0.add(p1).add(p2)…`). Assign as `StageRenderer.pipeline` to skip `buildOutputNode` for the common "compose every stage" case. |

### Interfaces

| Name | Shape | Purpose |
|---|---|---|
| `IStage` | `{name, resize, updateFrame}` | Lifecycle contract: a sized object with a per-frame tick. |
| `IRenderable` | `{renderTo(renderer)}` | "Draw yourself into this renderer." |
| `IPassProvider` | `{asPassNode(renderer) → Node}` | TSL contribution: returns a node usable inside a parent's `RenderPipeline`. |
| `IStageRendererHost` | `{onResize, onRenderFrame}` | What a `StageRenderer` needs from its frame-loop host. `Display` satisfies this structurally. |

---

## Hello world (auto-driven)

The minimal idiomatic setup. `StageRenderer(display)` hooks the renderer
into the display's frame loop — you don't write your own `OnDisplayRenderFrame`
handler.

```ts
import {Display, ParallaxProjection, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';
import {Color} from 'three/webgpu';

const display = new Display(document.getElementById('canvas')!);
const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain'}));

new StageRenderer(display)
  .setClearColor(new Color('#90b0d0'))
  .add(stage);

stage.scene.add(/* meshes, sprites, … */);

display.start();
```

`setClearColor` / `add` / `remove` / `attach` / `detach` all return `this` —
chain them.

---

## Manual frame loop

Use when you need to interleave with custom per-frame logic (animation,
physics, input) or render to a target the auto-driven path doesn't know
about. The renderer **does not** hook into the display in this mode.

```ts
import {on} from '@spearwolf/eventize';
import {Display, OnDisplayRenderFrame, Stage2D, StageRenderer, ParallaxProjection} from '@spearwolf/twopoint5d';
import {Color} from 'three/webgpu';

const display = new Display(canvas);
const stage = new Stage2D(new ParallaxProjection('xy|bottom-left'));
const sr = new StageRenderer().setClearColor(new Color('#000')).add(stage); // no parent → manual

on(display, OnDisplayRenderFrame, ({renderer, width, height, now, deltaTime, frameNo}) => {
  sr.resize(width, height);
  // … your per-frame logic here …
  sr.updateFrame(now, deltaTime, frameNo);
  sr.renderTo(renderer);
});

display.start();
```

> **Do not mix the two modes.** If you passed `display` to the constructor
> *and* call `renderTo` yourself, every frame renders twice.

---

## Layering: multiple stages, one target

The renderer forces `autoClear = false` between sibling stages, so stages
are drawn **additively** into the same render target.

```ts
const root = new StageRenderer(display)
  .setClearColor(new Color('#000000'))   // one clear, once per frame
  .add(background)                        // bottom
  .add(world)
  .add(ui);                               // top
```

### Intermediate clear with `ClearStage`

To clear specific buffers between siblings — e.g. drop the depth buffer
before UI so it sits on top regardless of world depth — insert a `ClearStage`:

```ts
import {ClearStage} from '@spearwolf/twopoint5d';

root.add(world);
root.add(new ClearStage({depth: true}));   // default options also clear depth-only
root.add(ui);
```

Options: `{color?: boolean; depth?: boolean; stencil?: boolean}`, all default
`false` except `depth`.

### Render order

`renderOrder` is a comma-separated list of stage names. `*` is the wildcard
for "everything not listed":

```ts
root.renderOrder = 'background,world,*,ui';
```

If multiple stages share a `name` and `renderOrder` is non-default, `add()`
emits a `console.warn` — give your stages unique names when sorting matters.

---

## Nested `StageRenderer`

A `StageRenderer` is itself an `IStage + IRenderable + IPassProvider`, so
you can drop one inside another. The inner renderer's clearing / ordering /
pipeline policy applies to its own children only.

```ts
const root = new StageRenderer(display).setClearColor(new Color('#000'));

const hud = new StageRenderer(root);   // ← parent is the outer renderer
hud.add(hudBackground).add(hudOverlay);

root.add(world);
// `hud` is already added to `root` via its constructor.
```

When the parent has a `pipeline` + `buildOutputNode`, the child renderer's
`asPassNode()` returns a `texture(...)` node — see "Composing post-effects"
below.

---

## Clear policy in one table

| `clear` | `clearColor` | `clearAlpha` | Effect |
|---|---|---|---|
| `false` (default) | — | — | No clear. Renderer state untouched. |
| `true` | `Color` | n | Clear color + alpha; restores previous renderer state after. |
| `true` | `null` | n | Clear with the renderer's current color, alpha = n. |

Setting `clearColor` to a non-null `Color` (via setter or assignment) flips
`clear` to `true` as a convenience. To turn clearing off, set `clear = false`
explicitly.

Buffer-level control: `clearColorBuffer`, `clearDepthBuffer`,
`clearStencilBuffer` — all `true` by default. They map 1:1 to the three
arguments of `WebGPURenderer.clear()`.

When the renderer has a `pipeline`, the **internal pass-target** is always
cleared each frame (using your `clear`-color when `clear=true`, transparent
black otherwise) so frame content does not accumulate.

---

## Off-screen rendering: `outputRenderTarget`

Set `outputRenderTarget` to redirect the renderer's final output into a
`RenderTarget` instead of the canvas. Useful for picking, screenshots, or
feeding a downstream pass.

```ts
import {RenderTarget} from 'three/webgpu';

const offscreen = new RenderTarget(1024, 768);
const sr = new StageRenderer(display).add(stage);
sr.outputRenderTarget = offscreen;

// Each frame, the renderer paints into `offscreen` and restores the prior
// target afterwards. Use `offscreen.texture` somewhere else in the scene.
```

Combines with `pipeline` — the post-pass output also lands in the target.

---

## Post-processing: `pipeline` and `buildOutputNode`

`StageRenderer` integrates with `three.RenderPipeline` in two ways:

### Mode C (§6.4) — pipeline samples an internal RT

The simplest path: render the stages into an internally managed
`RenderTarget`, then run the pipeline with `outputNode = texture(rt.texture)`.
No TSL knowledge required.

```ts
import {RenderPipeline} from 'three/webgpu';

const sr = new StageRenderer(display).setClearColor(new Color('#000')).add(stage);
sr.pipeline = new RenderPipeline(display.renderer);
// nothing else — the renderer wires `texture(internalRT)` into `pipeline.outputNode`
```

The pipeline writes to `outputRenderTarget` if set, otherwise the canvas.

### Mode D (§6.2) — compose a TSL graph from per-stage pass nodes

When you want a real effect (bloom, blur, FXAA, etc.), provide
`buildOutputNode(stagePasses)`. It receives the list of nodes returned by
each stage's `asPassNode()` and returns the composed TSL graph.

```ts
import {bloom} from 'three/examples/jsm/tsl/display/BloomNode.js';

const sr = new StageRenderer(display).setClearColor(new Color('#000')).add(stage);
sr.pipeline = new RenderPipeline(display.renderer);
sr.buildOutputNode = ([scenePass]) => bloom(scenePass, 1.2, 0.6, 0.0);
```

- `Stage2D.asPassNode()` returns `pass(scene, camera)` — handled per frame by
  the pipeline.
- A nested `StageRenderer.asPassNode()` returns `texture(internalRT.texture)`;
  the parent automatically pre-renders the child into that RT before the
  pipeline runs.

`buildOutputNode` is only invoked when the stage list changes (or you call
`invalidateOutputNode()` explicitly).

### Shortcut: `RootRenderPipeline` — additive composition out of the box

When all you want is "combine every stage's pass into the pipeline output
additively" (the most common case for layering), assign a
`RootRenderPipeline` instead of a `RenderPipeline`. The renderer detects
the subclass and uses its static composer as the default — no
`buildOutputNode` boilerplate.

```ts
import {RootRenderPipeline} from '@spearwolf/twopoint5d';

root.pipeline = new RootRenderPipeline(display.renderer);
// → pipeline.outputNode = pass0.add(pass1).add(pass2)…
```

Setting `stageRenderer.buildOutputNode` overrides the default — use it
when you want a non-additive composition (e.g. bloom wrapping a single
pass).

### Mode E (§6.3) — nested renderers, each with its own post-effect

Combine the above: a child `StageRenderer` with its own pipeline produces
its bloomed/blurred output into a texture, and the parent samples it as
one node in its own pipeline composition.

```ts
const root = new StageRenderer(display).setClearColor(new Color('#000'));

// World layer with its own bloom (Mode D — custom composition)
const worldRenderer = new StageRenderer(root).add(worldStage);
worldRenderer.pipeline = new RenderPipeline(display.renderer);
worldRenderer.buildOutputNode = ([scene]) => scene.add(bloom(scene, 1.5, 0.5));

// UI layer plain
root.add(uiStage);

// Root pipeline composes every child additively — no buildOutputNode needed
root.pipeline = new RootRenderPipeline(display.renderer);
```

`worldRenderer.asPassNode()` returns a `texture()` node sampling the
renderer's `asPassNodeRT`; the root pre-renders the child into that RT
before its own pipeline runs.

> **Important — only one writer to the canvas per frame.**
> The three.js `RenderPipeline.render()` call expects to own the final
> draw to its render target. Mixing a `pipeline.render()` with a separate
> `renderer.render(scene, camera)` to the **same canvas** within one frame
> leads to one of them being discarded (the canvas backbuffer is a fresh
> swap-chain image per draw in the WebGPU model, and the WebGL2 fallback
> behaves the same way).
>
> Two stable patterns:
>
> 1. **Single pipeline at the top.** When you want post-processing
>    *plus* plain stages on the same canvas, put a pipeline on the
>    outermost renderer and compose every child via `buildOutputNode`
>    (Mode D / Mode E). Each child contributes a pass node and the
>    outer pipeline does the single canvas draw.
> 2. **No mixed canvas writers.** A non-pipelined root with mixed
>    children (one `StageRenderer` with a pipeline, others plain) writing
>    directly to the canvas is *not* supported.

---

## Custom stages

Anything that implements `IStage & IRenderable` can be added:

```ts
import type {IStage, IRenderable} from '@spearwolf/twopoint5d';
import type {WebGPURenderer} from 'three/webgpu';

class MyStage implements IStage, IRenderable {
  name = 'my';
  resize(w: number, h: number) { /* … */ }
  updateFrame(now: number, dt: number, frameNo: number) { /* … */ }
  renderTo(renderer: WebGPURenderer) { /* renderer.render(myScene, myCamera) … */ }
}
```

To make it work inside a parent pipeline's `buildOutputNode`, also implement
`IPassProvider`:

```ts
import {pass} from 'three/tsl';

class MyStage implements IStage, IRenderable, IPassProvider {
  // … as above …
  asPassNode(renderer: WebGPURenderer) { return pass(myScene, myCamera); }
}
```

---

## Events you can subscribe to

On `StageRenderer`:

- `OnStageAdded` / `OnStageRemoved` — emitted at the **parent** with `{stage, renderer}`.
- `OnAddToParent` / `OnRemoveFromParent` — emitted at the **child** when its `parent` changes.

On `Stage2D`:

- `OnStageResize`, `OnStageFirstFrame`, `OnStageUpdateFrame`, `OnStageAfterCameraChanged`.

All event names are exported from `@spearwolf/twopoint5d`.

---

## Custom host

Any object with the same shape as `Display.onResize` / `onRenderFrame` can
host a `StageRenderer`. Useful when integrating with an existing app frame
loop you don't own.

```ts
import type {IStageRendererHost} from '@spearwolf/twopoint5d';

const host: IStageRendererHost = {
  onResize: (handler) => myApp.subscribe('resize', handler),
  onRenderFrame: (handler) => myApp.subscribe('frame', handler),
};

new StageRenderer(host).add(stage);
```

---

## Resource lifecycle

- Internal `RenderTarget`s are created lazily on first render and resized
  in `resize(width, height)`.
- `StageRenderer.dispose()` releases both internal RTs and `this.pipeline`.
- `Display.dispose()` releases the renderer + canvas.
- Stages added via `add()` are not auto-disposed — the caller owns them.

---

## Common pitfalls

- **Double frame loop**: passing `display` to the constructor *and* calling
  `renderTo` from your own handler renders every frame twice. Pick one.
- **Stage with no camera yet**: `Stage2D#renderTo` is a no-op until the
  first `resize()` triggers camera creation (or you assign your own).
  `Stage2D#asPassNode` throws in that state.
- **Non-unique stage names + `renderOrder`**: the sort is ambiguous. The
  renderer warns once on `add()`; rename your stages.
- **Mid-frame state on the WebGPU renderer**: `StageRenderer.renderTo()`
  restores `autoClear`, clear color and clear alpha to what it found
  on entry — but only if it actually performed a clear.
- **`buildOutputNode` + non-pass stages**: every stage in the list must
  implement `asPassNode()`. `ClearStage` doesn't — keep it for non-pipeline
  layering only. The renderer throws with a clear message in that case.
- **Pipeline lifecycle**: when you replace a renderer's `pipeline` or
  `outputRenderTarget`, dispose the previous instance yourself if you no
  longer need it; the renderer only disposes what it owns (its internal
  RTs and the assigned `pipeline` on `StageRenderer.dispose()`).
- **Mixed pipeline / plain writers to the canvas**: don't mix a
  `pipeline.render()` and a plain `renderer.render(scene, camera)` on the
  same canvas in the same frame. Compose everything via one outer pipeline
  with `buildOutputNode` (see "Mode E" above). The three.js
  `RenderPipeline` assumes it owns the final canvas draw.
