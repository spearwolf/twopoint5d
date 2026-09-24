# Stage layer cheat-sheet

Quick reference for `Display` + `Stage2D` + `StageRenderer` and the optional
`RenderPipeline` integration. Use this page when you want to ship something
fast and need the canonical idioms.

---

## Architecture at a glance

```
┌─────────────────────────────────────────────┐
│ Display                                     │   owns WebGPURenderer + its canvas
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
| `Display` | Owns the `WebGPURenderer` and its canvas (a canvas handed to the constructor stays the caller's), drives the frame loop, emits resize/render events. Source of truth for size + time. |
| `Stage2D` | Holds a `THREE.Scene` and a camera derived from an `IProjection`. Implements `IStage + IRenderable + IPassProvider`. |
| `StageRenderer` | Container for stages. Implements `IStage + IRenderable + IPassProvider` so it can be nested. Optional clearing policy and `RenderPipeline` post-processing. |
| `Canvas2DStage` | Wraps an `HTMLCanvasElement` 2D-context drawing as a textured sprite inside a `Stage2D`. What its `dispose()` releases is in [Resource lifecycle](#resource-lifecycle). |
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

```ts check
import {Display, ParallaxProjection, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';
import {Color} from 'three/webgpu';

const display = new Display(document.getElementById('canvas')!);
const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 800, height: 600}));

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

Stages sharing a listed name render together at that position, in the order
they were added, and `add()` and every write to `renderOrder` emit a
`console.warn` about that name — give your stages unique names when sorting
matters. A shared name that `renderOrder` does not list draws no warning. A
name or `*` listed twice counts at its first position. A stage renamed after
`add()` is sorted under its new name from the next frame on.

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

`StageRenderer` integrates with `three.RenderPipeline` in two ways — Mode C lets the
pipeline sample an internal render target, Mode D composes the pass nodes into a TSL
graph yourself.

Two notes on the types in the examples below. `Display.renderer` is
`WebGPURenderer | undefined` — `dispose()` takes it away again — so a display
that is up and running asserts it with `!`. And `buildOutputNode` hands you its
passes as plain `Node`s: neither the concrete `Node<'vec4'>` that `bloom()` asks
for nor the arithmetic operators that TSL attaches through the ShaderNodeProxy at
runtime are visible to the static type. Each example casts for what it needs —
`Node<'vec4'>` alone where it only feeds the pass onward, plus `.add()` where it
composes — and the comment next to the cast names the reason the pass is there at all.

### Mode C (§6.4) — pipeline samples an internal RT

The simplest path: render the stages into an internally managed
`RenderTarget`, then run the pipeline with `outputNode = texture(rt.texture)`.
No TSL knowledge required.

```ts
import {RenderPipeline} from 'three/webgpu';

const sr = new StageRenderer(display).setClearColor(new Color('#000')).add(stage);
sr.pipeline = new RenderPipeline(display.renderer!);
// nothing else — the renderer wires `texture(internalRT)` into `pipeline.outputNode`
```

The pipeline writes to `outputRenderTarget` if set, otherwise the canvas.

### Mode D (§6.2) — compose a TSL graph from per-stage pass nodes

When you want a real effect (bloom, blur, FXAA, etc.), provide
`buildOutputNode(stagePasses)`. It receives the list of nodes returned by
each stage's `asPassNode()` and returns the composed TSL graph.

```ts
import {bloom} from 'three/examples/jsm/tsl/display/BloomNode.js';
import type {Node} from 'three/webgpu';

const sr = new StageRenderer(display).setClearColor(new Color('#000')).add(stage);
sr.pipeline = new RenderPipeline(display.renderer!);
sr.buildOutputNode = ([scenePass]) => {
  // `sr` was given exactly one stage above, so the pass list has its first entry
  const pass = scenePass as Node<'vec4'>;
  return bloom(pass, 1.2, 0.6, 0.0);
};
```

- `Stage2D.asPassNode()` returns `pass(scene, camera)` — handled per frame by
  the pipeline.
- A nested `StageRenderer.asPassNode()` returns `texture(internalRT.texture)`;
  the parent automatically pre-renders the child into that RT before the
  pipeline runs.

`buildOutputNode` runs again on the next render after the stages,
`renderOrder`, a stage name, `pipeline` or `buildOutputNode` itself changed,
after a stage announced a new camera through `OnStageAfterCameraChanged`
(every `Stage2D` does), or after `invalidateOutputNode()`. While the renderer
has no area, or while a `Stage2D` it composes has no camera yet, the composed
mode draws nothing.

### Shortcut: `RootRenderPipeline` — additive composition out of the box

When all you want is "combine every stage's pass into the pipeline output
additively" (the most common case for layering), assign a
`RootRenderPipeline` instead of a `RenderPipeline`. The renderer detects
the subclass and uses its static composer as the default — no
`buildOutputNode` boilerplate.

```ts
import {RootRenderPipeline} from '@spearwolf/twopoint5d';

root.pipeline = new RootRenderPipeline(display.renderer!);
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
worldRenderer.pipeline = new RenderPipeline(display.renderer!);
worldRenderer.buildOutputNode = ([scenePass]) => {
  // `worldRenderer` was given exactly one stage above, so the pass list has its
  // first entry, and `.add()` lives on the ShaderNodeProxy rather than on `Node`
  const pass = scenePass as Node<'vec4'> & {add(other: Node): Node};
  return pass.add(bloom(pass, 1.5, 0.5));
};

// UI layer plain
root.add(uiStage);

// Root pipeline composes every child additively — no buildOutputNode needed
root.pipeline = new RootRenderPipeline(display.renderer!);
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

```ts check
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
import type {IPassProvider} from '@spearwolf/twopoint5d';
import {pass} from 'three/tsl';
import type {PassNode} from 'three/webgpu';

class MyStage implements IStage, IRenderable, IPassProvider {
  name = 'my';
  resize(w: number, h: number) { /* … as above … */ }
  updateFrame(now: number, dt: number, frameNo: number) { /* … as above … */ }
  renderTo(renderer: WebGPURenderer) { /* … as above … */ }

  // the node owns a render target: build it once and keep it, as long as scene and camera stand
  #passNode?: PassNode;

  asPassNode(renderer: WebGPURenderer) {
    return (this.#passNode ??= pass(myScene, myCamera));
  }

  dispose() {
    this.#passNode?.dispose();
    this.#passNode = undefined;
  }
}
```

---

## Events you can subscribe to

On `StageRenderer`:

- `OnStageAdded` / `OnStageRemoved` — emitted at the **parent** with `{stage, renderer}`.
- `OnAddToParent` / `OnRemoveFromParent` — emitted at the **child** when its `parent` changes.

On `Stage2D`:

- `OnStageResize`, `OnStageFirstFrame`, `OnStageUpdateFrame`.
- `OnStageAfterCameraChanged` — emitted on every camera change with the replaced camera; a
  `StageRenderer` listens to it on each stage it holds.

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

What this layer does on top of the general rules in
[docs/resource-lifecycle.md](../../docs/resource-lifecycle.md):

- Internal `RenderTarget`s are created lazily on first render and resized
  in `resize(width, height)`.
- `StageRenderer.dispose()` releases both internal RTs, and nothing else. It also
  detaches from its host and drops its stages, so a disposed renderer is no longer
  driven by any frame loop.
- A disposed `StageRenderer` builds no further `RenderTarget`: `asPassNode()` throws,
  `renderTo()` does nothing — it neither draws nor clears the caller's target — and a
  write to `pipeline` falls through.
- `remove(stage)` clears both sides of the relation: a removed child `StageRenderer`
  answers `undefined` as its `parent` and gets its `OnRemoveFromParent`.
- `Stage2D#asPassNode()` hands the same node back for as long as `scene` and `camera` stay what
  they were, and releases the node built for the pair before it on the next `asPassNode()` after
  either of them has changed.
  `Stage2D.dispose()` releases that node and the render target behind it, and nothing else: the
  scene, the camera and the projection were handed in and stay the caller's. Afterwards
  `asPassNode()` throws, and `renderTo()`, `updateFrame()`, `resize()`, `updateProjection()` and a
  write to `projection` or `camera` do nothing. Take the stage out of every `StageRenderer` that
  holds it first — see the pitfall *Disposing a stage a renderer still holds* below.
- `Canvas2DStage.dispose()` releases the sprite material, both textures that ever sat behind it —
  a texture assigned to `texture` from outside as much as one the stage built — its
  `StageRenderer` and the `Stage2D` its constructor built, and leaves the `WebGPURenderer` and a
  canvas handed to the constructor alone. The sprite geometry is shared by every `THREE.Sprite`
  of the module and stays.
- `Display.dispose()` releases its `WebGPURenderer` — the one it built as well as one
  handed to its constructor — and gives up the field, so `Display#canvas` throws afterwards.
  The field is gone as soon as `dispose()` returns; the renderer itself is released once its
  init is through and the GPU has run the work submitted to it — two seconds at most, then
  with a warning — and, under WebGPU, once the page has drawn two more animation frames or two
  more seconds have passed without one. A renderer whose init failed has built nothing, and
  `renderer.dispose()` is not called on it. A canvas handed to the constructor stays the
  caller's and carries a new `Display` afterwards. Under WebGL its context stays lost until
  then; the next `Display` on it — built while the release is still running or any time later
  — waits for the release, restores the context and then starts its renderer. Only a `Display`
  restores it: a `WebGPURenderer` or a `getContext('webgl2')` of your own on that canvas gets
  the lost context.
- Stages added via `add()` are not auto-disposed — the caller owns them. Neither is a
  `pipeline` or an `outputRenderTarget` assigned from outside.

---

## Common pitfalls

- **Double frame loop**: passing `display` to the constructor *and* calling
  `renderTo` from your own handler renders every frame twice. Pick one.
- **Stage with no camera yet**: `Stage2D#renderTo` is a no-op until the
  first `resize()` with a width and a height that are finite numbers above
  0, for which the projection's specs give a view with an area, creates the
  camera (or you assign your own). `Stage2D#asPassNode` throws in that
  state, and a `StageRenderer` composing pass nodes draws nothing while it
  has no area or while one of its `Stage2D`s has no camera. Until then its `width` and
  `height` are 0, and assigning another `projection` — or `undefined` — puts
  them back to 0 with the camera until the new projection gives a view.
- **Non-unique stage names + `renderOrder`**: stages sharing a name that
  `renderOrder` lists render at that name's position in the order they were
  added. The renderer warns about such a name on `add()` and on every write
  to `renderOrder`; give your stages unique names when the order between
  them matters.
- **Mid-frame state on the WebGPU renderer**: `StageRenderer.renderTo()`
  restores `autoClear`, clear color and clear alpha to what it found
  on entry — but only if it actually performed a clear.
- **`buildOutputNode` + non-pass stages**: every stage in the list must
  implement `asPassNode()`. `ClearStage` doesn't — keep it for non-pipeline
  layering only. The renderer throws with a clear message in that case.
- **Pipeline lifecycle**: a `pipeline` and an `outputRenderTarget` belong to
  whoever assigned them. Dispose the previous instance yourself when you replace
  one, and dispose the current one when you dispose the renderer; the renderer
  only releases what it owns — its internal RTs.
- **Disposing a stage a renderer still holds**: take a `Stage2D` out of every
  `StageRenderer` that has it — `remove(stage)` — before you call
  `stage.dispose()`. A renderer that still lists a disposed stage keeps its
  released pass node in the composed output node, and the backend silently
  allocates a render target for it again on the next frame; the next rebuild of
  that node — `add()`, `remove()`, a `renderOrder` write,
  `invalidateOutputNode()` — asks the stage for a node again and gets the throw,
  in the middle of the frame loop. `StageRenderer.dispose()` removes every stage
  it holds, so disposing the renderer first is the shorter way there.
- **Mixed pipeline / plain writers to the canvas**: don't mix a
  `pipeline.render()` and a plain `renderer.render(scene, camera)` on the
  same canvas in the same frame. Compose everything via one outer pipeline
  with `buildOutputNode` (see "Mode E" above). The three.js
  `RenderPipeline` assumes it owns the final canvas draw.
