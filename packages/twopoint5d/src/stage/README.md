# Stage layer cheat-sheet

Quick reference for `Display` + `Stage2D` + `StageRenderer`. Use this page
when you want to ship something fast and need the canonical idioms — for a
deeper dive into the design rationale see [`Backlog-StageRenderer.md`](../../../../Backlog-StageRenderer.md).

---

## The three roles

| Class | Role |
|---|---|
| `Display` | Owns the canvas + `WebGPURenderer`, drives the frame loop, emits resize/render events. Source of truth for size + time. |
| `Stage2D` | Holds a `THREE.Scene` and a camera derived from an `IProjection`. Implements `IStage` (lifecycle) and `IRenderable` (`renderTo`). |
| `StageRenderer` | Container for one or more stages. Implements `IStage + IRenderable` too — so renderers can be nested. Optional clearing policy. |

Other building blocks:

- `IStage` — `{ name, resize, updateFrame }`. The lifecycle contract.
- `IRenderable` — `{ renderTo(renderer) }`. The "draw yourself" contract.
- `IStageRendererHost` — `{ onResize, onRenderFrame }`. What a `StageRenderer` needs from its frame-loop host. `Display` satisfies this structurally.
- `Canvas2DStage` — convenience wrapper around an `HTMLCanvasElement` you draw to with the 2D Canvas API; it surfaces the canvas as a textured sprite inside a `Stage2D`.
- `ClearStage` — marker stage that emits `renderer.clear(...)` between siblings (depth-only by default).

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

A `StageRenderer` is itself an `IStage + IRenderable`, so you can drop one
inside another. The inner renderer's clearing/ordering policy applies to
its own children only.

```ts
const root = new StageRenderer(display).setClearColor(new Color('#000'));

const hud = new StageRenderer(root);   // ← parent is the outer renderer
hud.add(hudBackground).add(hudOverlay);

root.add(world);
// `hud` is already added to `root` via its constructor.
```

This is the pattern that will host `RenderPipeline` / post-pass per
renderer (still on the roadmap — see §6 in `Backlog-StageRenderer.md`).

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

## Common pitfalls

- **Double frame loop**: passing `display` to the constructor *and* calling
  `renderTo` from your own handler renders every frame twice. Pick one.
- **Stage with no camera yet**: `Stage2D#renderTo` is a no-op until the
  first `resize()` triggers camera creation (or you assign your own).
- **Non-unique stage names + `renderOrder`**: the sort is ambiguous. The
  renderer warns once on `add()`; rename your stages.
- **Mid-frame state on the WebGPU renderer**: `StageRenderer.renderTo()`
  restores `autoClear`, clear color and clear alpha to what it found
  on entry — but only if it actually performed a clear.
