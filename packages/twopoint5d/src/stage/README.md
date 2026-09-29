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
│   – stages: ReadonlyArray<StageItem>        │
│   – renderOrder: string                     │
│   – clear / clearColor / clearAlpha         │   clear policy
│   – pipeline?            Mode C / Mode D    │   optional post-processing
│   – outputRenderTarget?  Mode C             │
│   – internalTargetPool?  Mode C             │
│   – buildOutputNode?     Mode D             │
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
| `Canvas2DStage` | Wraps an `HTMLCanvasElement` 2D-context drawing as a textured sprite inside a `Stage2D`. Call `render(now, deltaTime, frameNo)` from your own frame loop; the stage has a camera as soon as `setContainerSize()` has given it a size. What its `dispose()` releases is in [Resource lifecycle](#resource-lifecycle). |
| `ClearStage` | Marker stage that emits `renderer.clear(...)` between siblings (depth-only by default). |
| `RootRenderPipeline` | `RenderPipeline` subclass with a built-in additive composition (`p0.add(p1).add(p2)…`). Assign as `StageRenderer.pipeline` to skip `buildOutputNode` for the common "compose every stage" case. |
| `StageRenderTargetPool` | Lends the internal target of Mode C to the `StageRenderer`s it is set on, one draw at a time, so renderers of the same size share one target. Built, handed in and disposed by the caller. |
| `createBloomOutputNodeBuilder()` | Returns a ready-made `buildOutputNode`: every pass composed additively, the bloom of the composition on top. Releases the bloom it built when it builds the next one and on `dispose()`. Built, assigned and disposed by the caller, one per `StageRenderer`. |

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

`root.add(hud)` and `new StageRenderer(root)` are the same move: either way
`hud.parent` is `root` afterwards. A renderer has one holder — an `add()` to
another renderer, or an `attach(host)`, takes it out of the first.

When the parent has a `pipeline` + `buildOutputNode`, the child renderer's
`asPassNode()` returns a `texture(...)` node — see "Mode D" and "Mode E"
below.

---

## Clear policy in one table

| `clear` | `clearColor` | `clearAlpha` | Effect |
|---|---|---|---|
| `false` (default) | — | — | Nothing clears, not even the renderer's `autoClear`: it is `false` while the stages draw and restored afterwards. Frames accumulate unless something else clears. |
| `true` | `Color` | n | Clear color + alpha; restores previous renderer state after. |
| `true` | `null` | n | Clear with the renderer's current color, alpha = n. |

Setting `clearColor` to a non-null `Color` (via setter or assignment) flips
`clear` to `true` as a convenience. To turn clearing off, set `clear = false`
explicitly.

Buffer-level control: `clearColorBuffer`, `clearDepthBuffer`,
`clearStencilBuffer` — all `true` by default. They map 1:1 to the three
arguments of `WebGPURenderer.clear()`.

When the renderer has a `pipeline` without `buildOutputNode` that is not a
`RootRenderPipeline` (Mode C), the **internal target** is cleared in full to transparent black every frame,
color and depth, so frame content does not accumulate. With `clear = true`
your own clear applies after that; one that covers color and depth
(`clearColorBuffer` and `clearDepthBuffer` both `true`) replaces the black
clear. A target borrowed from an `internalTargetPool` is cleared the same way,
so nothing of the renderer that borrowed it before stays in it.

The **pass-target of a nested `StageRenderer`** — the one its parent samples
through `asPassNode()` — is cleared by the parent every frame to transparent
black, color and depth. A child with `clear = true` then clears it once more
with its own color. A child whose own clear covers color and depth, and
reaches the target in that frame, clears it alone: the parent leaves out the
black clear. A composing child without an area or with a `Stage2D` that has
no camera yet returns before its own clear, and gets the black one.

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

Without a pipeline, the stages draw into the target linear in the working
color space and without tone mapping, as three.js draws into every
`RenderTarget`. With a pipeline, its output transform applies — tone mapping
and the encoding to `renderer.outputColorSpace`, as long as
`pipeline.outputColorTransform` is `true` — just as on the canvas. A renderer
that a parent draws into a target of the parent's own pipeline writes linear
in both cases; the outermost pipeline applies the transform. Under a Mode C
parent (a `pipeline` without `buildOutputNode` that is not a
`RootRenderPipeline`), a child writes linear into
its own `outputRenderTarget` as well: the parent switches to linear output for
all of its stage draws, whichever target they write to.

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
runtime are visible to the static type. An example that writes its own callback casts
for both, and the comment next to the cast names the reason the pass is there at all.

### Mode C — pipeline samples an internal RT

Mode C applies to a `pipeline` without `buildOutputNode` that is not a
`RootRenderPipeline`; a `RootRenderPipeline` composes as Mode D does (see
[Shortcut: `RootRenderPipeline`](#shortcut-rootrenderpipeline--additive-composition-out-of-the-box)).

The simplest path: render the stages into an internally managed
`RenderTarget`, then run the pipeline with `outputNode = texture(rt.texture)`.
No TSL knowledge required.

```ts
import {RenderPipeline} from 'three/webgpu';

const sr = new StageRenderer(display).setClearColor(new Color('#000')).add(stage);
sr.pipeline = new RenderPipeline(display.renderer!);
// nothing else — the renderer wires a texture() node of its internal target into `pipeline.outputNode`
```

The pipeline writes to `outputRenderTarget` if set, otherwise the canvas.

The output node is rebuilt only for a new `pipeline` or after
`invalidateOutputNode()`; stages, `renderOrder`, stage names, scenes and
cameras leave it standing. The internal target has the type and the samples of the
renderer (`renderer.getOutputBufferType()`, `renderer.samples`), the values
three.js' `PassNode` gives the pass targets of Mode D.

#### Sharing the internal target: `StageRenderTargetPool`

Several renderers of the same size in Mode C — children with a pipeline of
their own under a composing root, say — each hold an internal target of their
own. A `StageRenderTargetPool` set as `internalTargetPool` on each of them lets
them share one. Without a pool nothing changes.

A renderer borrows the target at the start of its Mode C draw and gives it back
once its pipeline has run, in the same call — also when a stage or the pipeline
throws. Siblings that draw one after another therefore draw through the same
target, frame after frame; a child with a pipeline of its own under a Mode C
renderer draws while its parent still holds the borrowed target, and gets a
target of its own from the pool. The pass-target a composing parent samples
through `asPassNode()` is never pooled: the parent samples the pass-targets of
all its children in one run of its pipeline.

The pool lends a target only for the exact width, height, `type` and `samples`
it was built with, and releases every free target before it builds a new one.
Renderers of different sizes on one pool build a new target on every switch
between them — give each size a pool of its own. The pool belongs to whoever
built it: `StageRenderer#dispose()` leaves it alone.

```ts check
import {Display, OrthographicProjection, RootRenderPipeline, Stage2D, StageRenderer, StageRenderTargetPool} from '@spearwolf/twopoint5d';
import {RenderPipeline} from 'three/webgpu';

const display = new Display(document.getElementById('canvas')!);
const renderer = display.renderer!;

const root = new StageRenderer(display);
root.pipeline = new RootRenderPipeline(renderer);

// the children have the size of the root and draw one after another: one internal target serves all of them
const pool = new StageRenderTargetPool();

for (const name of ['back', 'front']) {
  const child = new StageRenderer(root).add(new Stage2D(new OrthographicProjection('xy|bottom-left')));
  child.name = name;
  child.pipeline = new RenderPipeline(renderer);
  child.internalTargetPool = pool;
}

// the pool is yours: dispose it once the renderers are done with it
```

### Mode D — compose a TSL graph from per-stage pass nodes

When you want a real effect (bloom, blur, FXAA, etc.), provide
`buildOutputNode(stagePasses)`. It receives the list of nodes returned by
each stage's `asPassNode()` and returns the composed TSL graph.

For the stack that comes up again and again — every pass composed additively,
the bloom of that composition on top — `createBloomOutputNodeBuilder()` hands you
a ready-made `buildOutputNode`:

```ts
import {createBloomOutputNodeBuilder} from '@spearwolf/twopoint5d';

const sr = new StageRenderer(display).setClearColor(new Color('#000')).add(stage);
const pipeline = new RenderPipeline(display.renderer!);
const withBloom = createBloomOutputNodeBuilder({strength: 1.2, radius: 0.6});
sr.pipeline = pipeline;
sr.buildOutputNode = withBloom;

// teardown: the renderer lets go first, then the builder and the pipeline go
sr.dispose();
withBloom.dispose();
pipeline.dispose();
```

- `Stage2D.asPassNode()` returns `pass(scene, camera)` — handled per frame by
  the pipeline.
- A nested `StageRenderer.asPassNode()` returns a `texture()` node sampling
  the child's own pass-target (not the internal target of Mode C); before the
  pipeline runs, the parent clears that target and renders the child into it.

`buildOutputNode` runs again on the next render after the stages,
`renderOrder`, a stage name, `pipeline` or `buildOutputNode` itself changed,
after a stage announced a new camera or a new scene through
`OnStageAfterCameraChanged` or `OnStageAfterSceneChanged` (every `Stage2D`
does), or after `invalidateOutputNode()`. While the renderer
has no area, or while a `Stage2D` it composes has no camera yet, the composed
mode draws nothing.

#### Writing your own `buildOutputNode`

Neither the renderer nor three's `RenderPipeline` releases the `outputNode` a
rebuild replaces. An effect node your callback builds with render targets of
its own — `bloom()` has them — is yours to release, or every rebuild leaves one
behind. Release the one of the previous call once the next one stands, and the
last one when you are done, as `createBloomOutputNodeBuilder()` does:

```ts
import {bloom} from 'three/examples/jsm/tsl/display/BloomNode.js';
import type {Node} from 'three/webgpu';

let lastGlow: {dispose(): void} | undefined;
sr.buildOutputNode = ([scenePass]) => {
  // `sr` was given exactly one stage above, so the pass list has its first entry,
  // and `.add()` lives on the ShaderNodeProxy rather than on `Node`
  const pass = scenePass as Node<'vec4'> & {add(other: Node): Node};
  const glow = bloom(pass, 1.2, 0.6);
  lastGlow?.dispose();
  lastGlow = glow;
  return pass.add(glow);
};
```

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
when you want more than the additive composition, such as the bloom on top
of it that `createBloomOutputNodeBuilder()` adds.

### Mode E — nested renderers, each with its own post-effect

Combine the above: a child `StageRenderer` with its own pipeline produces
its bloomed/blurred output into a texture, and the parent samples it as
one node in its own pipeline composition.

```ts
const root = new StageRenderer(display).setClearColor(new Color('#000'));

// World layer with its own bloom (Mode D — a ready-made composition)
const worldRenderer = new StageRenderer(root).add(worldStage);
const worldBloom = createBloomOutputNodeBuilder({strength: 1.5, radius: 0.5});
worldRenderer.pipeline = new RenderPipeline(display.renderer!);
worldRenderer.buildOutputNode = worldBloom;

// UI layer plain
root.add(uiStage);

// Root pipeline composes every child additively — no buildOutputNode needed
root.pipeline = new RootRenderPipeline(display.renderer!);
```

`worldRenderer.asPassNode()` returns a `texture()` node sampling the
renderer's own pass-target; the root clears that target and pre-renders the
child into it before its own pipeline runs.

The child's pipeline writes linear: for the pre-render, the root sets
`renderer.toneMapping` to `NoToneMapping` and `renderer.outputColorSpace` to
the working color space, and restores both before its own pipeline runs. Tone
mapping and the output encoding apply once, in the outermost pipeline. The
same holds for a child with a pipeline under a Mode C renderer.

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
  #disposed = false;

  asPassNode(renderer: WebGPURenderer) {
    // like Stage2D, a disposed stage builds no further node: its render target would hang on a
    // node that nobody releases any more
    if (this.#disposed) throw new Error('MyStage#asPassNode() is not available: this stage has been disposed');
    return (this.#passNode ??= pass(myScene, myCamera));
  }

  dispose() {
    this.#disposed = true;
    this.#passNode?.dispose();
    this.#passNode = undefined;
  }
}
```

A `StageRenderer` takes a stage out by itself when the stage announces its
end: an eventized stage (`eventize(this)` from `@spearwolf/eventize`) that
emits `dispose` in its `dispose()`, as `Stage2D` does. Take any other stage
out of every renderer that holds it — `remove(stage)` — before you call its
`dispose()`. A stage whose `isDisposed` is `true` is refused by `add()`.

---

## Events you can subscribe to

On `StageRenderer`:

- `OnStageAdded` / `OnStageRemoved` — emitted at the **parent** with `{stage, renderer}`.
- `OnAddToParent` / `OnRemoveFromParent` — emitted at the **child** when its `parent` changes.
- `dispose` — once, from `dispose()`, before the renderer stops listening.

On `Stage2D`:

- `OnStageResize`, `OnStageFirstFrame`, `OnStageUpdateFrame`. `OnStageUpdateFrame` hands every
  frame the same props object, rewritten — copy the values you need after the call.
  `OnStageFirstFrame` is kept for late subscribers and carries an object of its own.
- `OnStageAfterCameraChanged` — emitted on every camera change with the replaced camera; a
  `StageRenderer` listens to it on each stage it holds.
- `OnStageAfterSceneChanged` — emitted on every change of `scene` with the replaced scene; a
  `StageRenderer` listens to it on each stage it holds as well.

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
  in `resize(width, height)`. They have the type and the samples of the
  renderer (`getOutputBufferType()`, `samples`); a changed `samples` reaches
  them on the next frame, as the same target objects.
- Leaving Mode C — `pipeline = undefined`, a `buildOutputNode`, a
  `RootRenderPipeline` — releases the GPU memory of the internal target,
  and `remove(child)` releases that of the pass-target of a removed child
  `StageRenderer`. The target objects stay, so every `texture()` node on them
  stays valid; three.js allocates the memory again on the next draw.
- `StageRenderer.dispose()` releases the render targets it built for itself — a target
  borrowed from an `internalTargetPool` is back in the pool by then, and the pool is not
  disposed. It also detaches from its host or from the parent `StageRenderer` that holds
  it, and drops its stages through `remove()`, so a disposed renderer is no longer driven
  by any frame loop, and a nested `StageRenderer` among its stages releases the GPU memory
  of its pass-target — the child itself is not disposed. A `dispose` event goes out
  before the renderer stops listening.
- A `StageRenderTargetPool` set as `internalTargetPool` lends the internal target for one
  draw at a time; while it is set the renderer builds no internal target of its own, and
  assigning it releases the one it had. The pool belongs to the caller: `pool.dispose()`
  releases every target that is back in the pool at once and every lent one as it comes
  back; a disposed pool lends nothing — `acquire()` throws, and a `StageRenderer` refuses it.
- A disposed `StageRenderer` builds no further `RenderTarget`: `asPassNode()` throws,
  `renderTo()` does nothing — it neither draws nor clears the caller's target — and a
  write to `pipeline`, `buildOutputNode` or `internalTargetPool` falls through.
- A builder from `createBloomOutputNodeBuilder()` belongs to the caller. Each call releases
  the bloom node the call before built, once the new output node stands — neither the
  renderer nor three's `RenderPipeline` releases an `outputNode` a rebuild replaces —, and
  `dispose()` releases the last one; the pass nodes it composes belong to the stages and
  stay. `StageRenderer#dispose()` lets go of the builder and leaves it alone. Give every
  renderer a builder of its own: one that two renderers share releases the bloom of one of
  them whenever the other rebuilds. A disposed builder throws when it is called, and a
  `StageRenderer` refuses it; take the builder off the renderer — `buildOutputNode =
  undefined`, or dispose the renderer — before you dispose it.
- `add(stage)` sets both sides of the relation: an added child `StageRenderer` answers
  the renderer as its `parent` and gets its `OnAddToParent`; it has one holder, and
  leaves the host or the renderer that held it. `remove(stage)` clears both sides: a
  removed child `StageRenderer` answers `undefined` as its `parent` and gets its
  `OnRemoveFromParent`.
- `Stage2D#asPassNode()` hands the same node back for as long as `scene` and `camera` stay what
  they were, and releases the node built for the pair before it on the next `asPassNode()` after
  either of them has changed; a composing `StageRenderer` asks again on its next render after
  each of the two changes.
  `Stage2D.dispose()` releases that node and the render target behind it, and nothing else: the
  scene, the camera and the projection were handed in and stay the caller's. Afterwards
  `asPassNode()` throws, and `renderTo()`, `updateFrame()`, `resize()`, `updateProjection()` and a
  write to `projection` or `camera` do nothing. Every `StageRenderer` that holds the stage takes
  it out on its `dispose` event, even behind a listener of that event that throws.
- `Canvas2DStage.dispose()` releases the sprite material, the blank texture the material starts
  out with and the texture the stage built last from the canvas — each earlier one was released
  when its successor took its place —, its `StageRenderer` and the `Stage2D` its constructor built, and leaves the `WebGPURenderer` and a
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
  them back to 0 until the new projection gives a view. The camera the previous
  projection created goes with them; a camera you assigned to `stage.camera`
  stays, and the new projection places it once it gives a view.
- **Non-unique stage names + `renderOrder`**: stages sharing a name that
  `renderOrder` lists render at that name's position in the order they were
  added. The renderer warns about such a name on `add()` and on every write
  to `renderOrder`; give your stages unique names when the order between
  them matters.
- **Mid-frame state on the WebGPU renderer**: `StageRenderer.renderTo()`
  sets `autoClear` to `false` for the stage draws and always restores it.
  Clear color and clear alpha change only for a clear and are restored right
  after it. While the renderer draws into a target its own pipeline samples,
  `toneMapping` and `outputColorSpace` are `NoToneMapping` and the working
  color space, and are restored afterwards — also when a stage throws.
- **`buildOutputNode` + non-pass stages**: every stage in the list must
  implement `asPassNode()`. `ClearStage` doesn't — keep it for non-pipeline
  layering only. The renderer throws with a clear message in that case.
- **Pipeline lifecycle**: a `pipeline` and an `outputRenderTarget` belong to
  whoever assigned them. Dispose the previous instance yourself when you replace
  one, and dispose the current one when you dispose the renderer; the renderer
  only releases what it owns — its internal RTs.
- **Disposing a custom stage a renderer still holds**: take a custom stage that
  emits no `dispose` event out of every `StageRenderer` that has it —
  `remove(stage)` — before you call its `dispose()`. A renderer that still lists
  a disposed stage keeps its released pass node in the composed output node, and
  the backend silently allocates a render target for it again on the next frame;
  the next rebuild of that node — `add()`, `remove()`, a `renderOrder` write,
  `invalidateOutputNode()` — asks the stage for a node again and gets the throw,
  in the middle of the frame loop. A `Stage2D` announces its end through that
  event, and the renderer lets go of it by itself; a child `StageRenderer`
  leaves its parent in its own `dispose()`.
- **Mixed pipeline / plain writers to the canvas**: don't mix a
  `pipeline.render()` and a plain `renderer.render(scene, camera)` on the
  same canvas in the same frame. Compose everything via one outer pipeline
  with `buildOutputNode` (see "Mode E" above). The three.js
  `RenderPipeline` assumes it owns the final canvas draw.
