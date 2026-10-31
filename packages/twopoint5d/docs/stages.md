# Stages: projections, layers and post-processing

A stage is a scene with a camera that knows how to fit itself into a canvas. The stage layer
turns the size of a canvas into a view in world units, draws several stages into one frame in an
order you choose, and runs the result through three.js post-processing when you want a bloom or
any other effect on top.

Three classes carry it:

```text
┌───────────────────────────────────────────────┐
│ Display                                       │  owns the WebGPURenderer and its canvas,
│   OnDisplayResize · OnDisplayRenderFrame      │  drives the frame loop
└───────────────────────┬───────────────────────┘
                        │ host
                        ▼
┌───────────────────────────────────────────────┐
│ StageRenderer                                 │  a list of stages, their order,
│   stages · renderOrder · clear …              │  the clear, and an optional
│   pipeline? · buildOutputNode?                │  post-processing pipeline
└───────────────────────┬───────────────────────┘
                        │ holds
                        ▼
┌───────────────────────────────────────────────┐
│ Stage2D            │ StageRenderer (nested)   │  a scene + a projection, or
│   scene · camera   │   stages of its own,     │  a renderer of its own;
│   projection       │   pipeline of its own?   │  ClearStage and stages of
│                    │                          │  your own beside them
└───────────────────────────────────────────────┘
```

- the `Display` measures the canvas and ticks the frame loop — [display](display.md) has
  everything about its resolution, frame rate and fullscreen;
- the `StageRenderer` hands the size of the display on to its stages and draws them, one after
  another, into the canvas — or into a pipeline that composes them;
- the `Stage2D` holds a `THREE.Scene` and builds its camera from a **projection**:
  `OrthographicProjection` or `ParallaxProjection`.

Contents:

- [A first stage](#a-first-stage)
- [Projections](#projections)
- [Several stages in one frame](#several-stages-in-one-frame)
- [Clearing](#clearing)
- [Off-screen: `outputRenderTarget`](#off-screen-outputrendertarget)
- [Post-processing](#post-processing)
- [Stage transitions](#stage-transitions)
- [A 2D canvas as a stage: `Canvas2DStage`](#a-2d-canvas-as-a-stage-canvas2dstage)
- [Stages of your own](#stages-of-your-own)
- [Driving the frame loop yourself](#driving-the-frame-loop-yourself)
- [Events](#events)
- [Who disposes what](#who-disposes-what)
- [Pitfalls](#pitfalls)
- [Cheat sheet](#cheat-sheet)

## A first stage

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

`new StageRenderer(display)` hooks the renderer into the frame loop of the display: every
resize reaches the stage, every frame updates and draws it. There is no frame handler to write.
`setClearColor()`, `add()`, `remove()`, `attach()` and `detach()` return the renderer, so they
chain.

The view of this stage shows at least 800 × 600 units around the origin of the xy plane, with
`y` pointing up; a wider canvas shows more to the left and the right, a taller one more above and
below. The next section is about how that view comes about.

## Projections

A projection answers one question: a container of `width` × `height` — the canvas, in CSS
pixels — shows how many units of the world, and from where? It works out the view, builds the
camera of the stage and places it again whenever the container changes.

```ts
new OrthographicProjection(plane, specs);
new ParallaxProjection(plane, specs);
```

- `plane` — the plane the camera looks at, see [the projection plane](#the-projection-plane);
- `specs` — how the view fits into the container, see [fitting the view](#fitting-the-view),
  plus where the camera sits: `distanceToProjectionPlane`, `near` and `far`.

### Orthographic or parallax

| | `OrthographicProjection` | `ParallaxProjection` |
| --- | --- | --- |
| camera | `OrthographicCamera` | `PerspectiveCamera` |
| something in front of or behind the plane | as large as on the plane, moves as fast | larger in front, smaller behind; moves faster in front, slower behind |
| `getScaleFactor(d)` | always `1` | `distanceToProjectionPlane / d` |
| `getParallaxFactor(d)` | — | `1 - d / distanceToProjectionPlane` |
| default `distanceToProjectionPlane` | `100` | `300` |
| `distanceToProjectionPlane`, `near` | any finite number, `0` and below included | a finite number above `0` |
| default `near`, `far` | `0.1`, `100000` | `0.1`, `100000` |
| for | UI, tile maps, pixel art, everything flat | layered backgrounds, depth, billboards in 3D |

Both show the projection plane at the same size: one unit on the plane covers the same number
of pixels under either projection. A `ParallaxProjection` derives its field of view from the
distance — the plane at `distanceToProjectionPlane` shows exactly the height of the view —, so a
larger distance flattens the depth effect and a smaller one deepens it, while the plane itself
stays the same size.

A value of `distanceToProjectionPlane`, `near` or `far` that no camera can be built from counts
as not given and takes its default; a `far` that is not above `near` sends both back to their
defaults. An orthographic camera also sees what lies behind its position, which is why its
`near` may be `0` or negative: with the defaults it clips everything closer to the camera than
`0.1`, so a layer at `z` above `distanceToProjectionPlane - near` disappears. The lookbook demo
*stage projections* puts the orthographic camera at `300` for that reason, behind a layer at
`z = 150`.

The view is centred on the origin of the plane: with `{fit: 'fill'}` on a canvas of
800 × 600, the visible range of an `'xy|bottom-left'` plane runs from `x = -400` to `400` and
from `y = -300` to `300`. Move the camera, or the scene, to show another part of the world — see
[a camera that follows](#a-camera-that-follows).

### The projection plane

| description | the plane | the camera sits at | on the screen |
| --- | --- | --- | --- |
| `'xy\|bottom-left'` | xy | `+z`, looking down `-z` | `x` to the right, `y` up |
| `'xy\|top-left'` | xy | `-z`, looking down `+z` | `x` to the right, `y` down |
| `'xz\|bottom-left'` | xz | `-y`, looking up | `x` to the right, `z` up |
| `'xz\|top-left'` | xz | `+y`, looking down | `x` to the right, `z` down |

`'xy|bottom-left'` is the plane of a side view, with the axes of a math book. `'xy|top-left'` has
the axes of the screen and of a 2D canvas, `y` growing downwards. The two `xz` planes look at the
floor of a 3D world from above or below — a top-down view on a world whose `y` is up.

A plane of your own is a `ProjectionPlane` of a `THREE.Plane` and the up vector of the camera;
the up vector is mandatory there:

```ts check
import {OrthographicProjection, ProjectionPlane} from '@spearwolf/twopoint5d';
import {Plane, Vector3} from 'three/webgpu';

// the plane x = 0, looked at from +x, with z up on the screen
const plane = new ProjectionPlane(new Plane(new Vector3(1, 0, 0)), new Vector3(0, 0, 1));
const projection = new OrthographicProjection(plane, {fit: 'fill'});
```

A `ProjectionPlane` also answers where a point of the view lies in the world:
`plane.getPoint(x, y)` takes `x` to the right and `y` up on the screen and gives the point on
the plane, `getOrigin()`, `getRight()` and `getForward()` give the origin and the directions.
A projection without a plane builds no camera — `createCamera()` and `updateCamera()` throw an
error that says which field to set.

### Fitting the view

`OrthographicProjection` and `ParallaxProjection` take the same fit. The examples assume a
canvas of 1600 × 900 CSS pixels:

| spec | the view | on 1600 × 900 |
| --- | --- | --- |
| `{fit: 'fill'}` — the default | one unit per CSS pixel | 1600 × 900 |
| `{pixelZoom: 2}` | `2` CSS pixels per unit | 800 × 450 |
| `{fit: 'contain', width: 800, height: 600}` | at least 800 × 600, the canvas shows more along one axis | 1066.7 × 600 |
| `{fit: 'cover', width: 800, height: 600}` | the canvas covered, at most 800 × 600 visible | 800 × 450 |
| `{fit: 'contain', width: 800}` | exactly 800 units wide, the height follows the canvas | 800 × 450 |
| `{fit: 'cover', height: 180}` | exactly 180 units high, the width follows the canvas | 320 × 180 |
| `minPixelZoom`, `maxPixelZoom` beside `contain` or `cover` | bounds of the zoom, in CSS pixels per unit | — |
| `pixelSnap: true` beside `pixelZoom`, `contain` or `cover` | a zoom of whole pixels of the drawing buffer, the edges of the view on whole units | — |

With `contain` or `cover` and only one side, the other side follows the shape of the canvas, so
`contain` and `cover` give the same view. The zoom is the container width divided by the view
width; `minPixelZoom` and `maxPixelZoom` hold it in a range — `{fit: 'contain', width: 800,
height: 600, maxPixelZoom: 1}` never draws a unit larger than a CSS pixel, and on a large canvas
shows more than 800 × 600 instead. A `pixelZoom`, `minPixelZoom` or `maxPixelZoom` that is not a
finite number above `0` has no effect — a `pixelZoom` like that zooms by `1`.

Under a display `pixelZoom` the container counts pixels of the art instead of CSS pixels, and
every row of the table above counts in them as well. `pixelSnap` keeps pixel art crisp at a
fractional `devicePixelRatio`; how it rounds and where it does not go together with other
settings is in [display: pixel art through a projection](display.md#pixel-art-through-a-projection-pixelsnap).

The read-outs:

- `stage.width`, `stage.height` — the view, in units; `0` until the projection has given one;
- `stage.containerWidth`, `stage.containerHeight`, `stage.containerPixelRatio` — what the last
  `resize()` handed in;
- `projection.getViewRect()` — the view in units, `pixelRatioX` and `pixelRatioY` (container
  pixels per unit), and `offsetX` and `offsetY`, the shift of the middle of the view under
  `pixelSnap` (`0` without). Every call returns a new object.

### Changing the fit while it runs

A projection keeps the specs object it was given, and reads it whenever it computes the view
anew. A stage computes it anew on its own when the container changes; after a write to the specs,
tell it with `needsUpdate`:

```ts check
import {Display, OrthographicProjection, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('canvas')!);

const specs = {pixelZoom: 2};
const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', specs));
new StageRenderer(display).add(stage);

// zoom in: the next frame computes view and camera anew
const zoomIn = () => {
  specs.pixelZoom += 1;
  stage.needsUpdate = true;
};

display.start();

export {zoomIn};
```

`stage.updateProjection(true)` does the same at once instead of in the next frame. One specs
object can serve several projections — the lookbook demo *stage projections* switches the fit of
an orthographic and a parallax stage with one write.

A new projection goes in by assignment: `stage.projection = new ParallaxProjection(…)`. The
stage drops the size and the camera of the previous projection, and the new one builds its own
camera right away if the container already has a size.

### A camera that follows

The projection gives the camera its position whenever it computes the view — on a resize, after
`needsUpdate`, on a new projection. A camera that follows a player or scrolls a level is moved
after that, in every frame. `OnStageUpdateFrame` is the place: a stage emits it after the
projection has done its work and before the frame is drawn.

```ts check
import {on} from '@spearwolf/eventize';
import {Display, OnStageUpdateFrame, OrthographicProjection, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('canvas')!);
const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {fit: 'cover', height: 360}));
new StageRenderer(display).add(stage);

const player = {x: 0, y: 0};

on(stage, OnStageUpdateFrame, () => {
  // the projection set the camera on the axis of the plane, the frame moves it along the plane
  stage.camera!.position.x = player.x;
  stage.camera!.position.y = player.y;
});

display.start();
```

The camera keeps its distance and direction; only the coordinates along the plane change. For
the `xz` planes these are `x` and `z`. Under `pixelSnap`, move it by whole units to keep the
texels whole — the lookbook *platformer* rounds its camera to whole pixels of the art.

### Depth under a parallax projection

Under a `ParallaxProjection` everything that is not on the projection plane appears scaled and
moves at another speed. For an `'xy|bottom-left'` plane the camera sits at
`z = distanceToProjectionPlane`, so something at `z` is `distanceToProjectionPlane - z` in front
of the camera — call it `d`:

- `projection.getScaleFactor(d)` — how many times larger it appears than on the plane:
  `distanceToProjectionPlane / d`. With the default distance of `300`, a layer at `z = 150` appears
  twice as large, a layer at `z = -150` two thirds as large. Scale a sprite by
  `1 / getScaleFactor(d)` to give it the size on the screen it would have on the plane.
- `projection.getParallaxFactor(d)` — `1 - d / distanceToProjectionPlane`: `1` at the camera,
  `0` on the plane, negative behind it. A layer at that distance that you move by this share of a
  camera movement scrolls exactly as fast as the plane.

The view, its fit and `pixelSnap` all refer to the projection plane: only the plane is drawn at
the zoom the specs ask for. `getScaleFactor()` answers `NaN` until the projection has given its
first view, since it reads the distance from the specs there.

### From the pointer to the plane

The view is centred on the point the camera looks at. A pointer position on the canvas maps
into it independently of CSS pixels, buffer pixels and zoom:

```ts check
import {Display, OrthographicProjection, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';
import {Vector3} from 'three/webgpu';

const canvas = document.querySelector('canvas')!;
const display = new Display(canvas);
const projection = new OrthographicProjection('xy|top-left', {fit: 'contain', width: 640, height: 360});
const stage = new Stage2D(projection);
new StageRenderer(display).add(stage);

canvas.addEventListener('pointerdown', (event) => {
  const view = projection.getViewRect();
  // units of the view, measured from the point the camera looks at: x right, y up on the screen
  const x = (event.offsetX / canvas.clientWidth - 0.5) * view.width + view.offsetX;
  const y = (0.5 - event.offsetY / canvas.clientHeight) * view.height + view.offsetY;
  // the point the camera looks at: its foot on the plane, wherever the camera was moved along it
  const plane = projection.projectionPlane!;
  const lookAt = plane.plane.projectPoint(stage.camera!.position, new Vector3());
  // the point in the world, on the projection plane
  const point = plane.getPoint(x, y).sub(plane.getOrigin()).add(lookAt);
});

display.start();
```

The point the camera looks at comes from the camera itself, so the recipe holds for any
`distanceToProjectionPlane` and for a camera moved along the plane. It works the same under a
`ParallaxProjection`, with one limit: the result is the point on the projection plane under the
pointer, and a layer in front of or behind the plane lies elsewhere.

### A camera of your own

`stage.camera = myCamera` replaces the camera the projection built. The projection keeps placing
it — frustum or field of view, `near`, `far`, direction and distance — every time it computes
the view, so it has to be of the kind the projection builds: an `OrthographicCamera` for an
`OrthographicProjection`, a `PerspectiveCamera` for a `ParallaxProjection`; any other kind is
refused with a `TypeError` at the next placement. `stage.camera = undefined` hands back to the
camera of the projection.

A camera you place entirely yourself goes on a stage without a projection: `new Stage2D()`,
then `stage.camera = myCamera`. Such a stage keeps `width` and `height` at `0`.

### When the stage draws nothing

A `Stage2D` has no camera until the first `resize()` with a width and a height that are finite
numbers above `0`, for which the specs give a view with an area. Until then `renderTo()` draws
nothing, `asPassNode()` throws, and after 100 frames without a camera the stage warns once on the
console. Under a `StageRenderer` hosted by a running `Display` this resolves itself with the first
frame; a stage driven by hand needs its `resize()` — see
[driving the frame loop yourself](#driving-the-frame-loop-yourself).

A resize to a size without an area — a hidden canvas, a width of `0` — keeps the view and the
camera the stage had, and so do specs that give no view at all, such as `{fit: 'contain'}` without
a side.

## Several stages in one frame

### Layers

A `StageRenderer` draws its stages one after another into the same target. Its clear runs once,
before the first stage; between the stages nothing is cleared, so every stage draws over the ones
before it:

```ts
const root = new StageRenderer(display)
  .setClearColor(new Color('#000000')) // one clear, once per frame
  .add(background) // drawn first
  .add(world)
  .add(ui); // drawn last, on top
```

The stages share the depth buffer: a stage drawn later still loses against the depth of an
earlier one wherever its objects lie behind it. A `ClearStage` between two stages clears what you
name:

```ts
import {ClearStage} from '@spearwolf/twopoint5d';

root.add(world);
root.add(new ClearStage()); // the depth buffer: the UI lies on top of the world, whatever its depth
root.add(ui);
```

`new ClearStage({color, depth, stencil}, name)` — `depth` is `true` by default, `color` and
`stencil` `false`; the name is `'clear'` unless you give one. A `ClearStage` works without a
pipeline and under a [pipeline that samples one target](#a-pipeline-on-the-whole-picture); a
composing pipeline refuses it, since there every stage has a depth buffer of its own anyway.

### Render order

Without anything else, stages draw in the order they were added. `renderOrder` sorts them by
name — a comma-separated list, where `*` stands for every stage the list does not name:

```ts
root.renderOrder = 'background,world,*,ui';
```

A stage's name is `stage.name`; for a `Stage2D` it is the name of its scene, `'Stage2D'` by
default, for a `StageRenderer` `'StageRenderer'`, for a `ClearStage` `'clear'`. Give stages names
of their own when the order between them matters: stages that share a listed name draw together
at its position, in the order they were added, and `add()` and every write to `renderOrder` warn
about such a name on the console. A name, or `*`, listed twice counts at its first position. A
stage renamed after `add()` is sorted under its new name from the next frame on.

`root.stages` lists every stage in the order of `add()`, `root.orderedStages` in the order they
update and draw. A stage `renderOrder` places nowhere — the list names neither it nor `*` — is in
the first list and not in the second: it is resized, but neither updated nor drawn.
`root.hasStage(stage)` asks whether a stage is in.

### Nested renderers

A `StageRenderer` is a stage itself, so one renderer goes into another. The inner renderer has its
own stages, its own order, its own clear and its own pipeline, and they apply to its children
alone:

```ts
const root = new StageRenderer(display).setClearColor(new Color('#000'));

const hud = new StageRenderer(root); // the parent is the outer renderer
hud.add(hudBackground).add(hudOverlay);

root.add(world);
// hud is in root already, through its constructor
```

`new StageRenderer(root)`, `root.add(hud)` and `hud.parent = root` are the same move. A renderer
has one holder, a host such as a `Display` or a parent renderer: `add()` to another renderer, or
`attach(host)`, takes it out of the one it was in; `detach()` lets go of the holder. A renderer
takes neither itself nor a renderer that holds it — `add()` and `parent` throw there, before
anything has moved.

A `StageRenderer` hands its size and the pixel ratio of its host on to every stage, nested
renderers included: `resize(width, height, pixelRatio)`. A stage refuses the size when its
`resize()` throws:

- in `add()`, the size comes first: a stage that refuses it is not added, and neither the
  renderer nor the previous holder of a child renderer has changed;
- in `resize()`, every stage is asked, also behind one that refuses. The renderer keeps the size
  it had, and so does its record of the refusing stage, so the next `resize()` with that size asks
  that stage again; the stages that took the size keep it.

What the stage itself keeps depends on where the throw comes from. A `Stage2D` whose projection
throws keeps its previous container, view and camera. A `Stage2D` whose projection took the size
and only a listener of `OnStageResize` or `OnStageAfterCameraChanged` threw keeps the new view and
camera — refused as far as the renderer is concerned, and still showing the new size.

## Clearing

| `clear` | `clearColor` | `clearAlpha` | the effect |
| --- | --- | --- | --- |
| `false`, the default | — | — | nothing clears the target; frames accumulate unless something else clears |
| `true` | a `Color` | `a` | clears to that color and alpha |
| `true` | `null` | `a` | clears to the renderer's current clear color with alpha `a` |

- `setClearColor(color, alpha = 1)` sets all three at once and turns `clear` on, also for a
  `null` color.
- An assignment of a `Color` to `clearColor` turns `clear` on as well; to turn it off, set
  `clear = false`.
- `clearColorBuffer`, `clearDepthBuffer` and `clearStencilBuffer`, all `true` by default, choose
  the buffers — the three arguments of `renderer.clear()`.
- `setClearColor(null, 0)` gives a transparent clear, for a canvas that lies over the page.

The own clear of a renderer is its only clear. While it draws its stages, `renderer.autoClear`
is `false`, whatever you set; the renderer restores it afterwards, as it restores the clear color
and alpha right after its clear.

The `stencil` of a `ClearStage` takes effect only on a display whose renderer has a stencil buffer
(`rendererOptions: {stencil: true}`), only in the modes that draw into one target, and only in a
renderer that draws to the canvas or to an `outputRenderTarget` with a stencil buffer — not in the
pass target a composing parent draws it into.

The targets a renderer builds for itself start every frame empty: the internal target of
[a pipeline on the whole picture](#a-pipeline-on-the-whole-picture) and the target of a
[nested renderer](#nested-pipelines-an-effect-per-layer) its parent composes are cleared to
transparent black, color and depth; an own `clear = true` then applies on top of that.

## Off-screen: `outputRenderTarget`

`outputRenderTarget` sends the picture of a renderer into a `RenderTarget` instead of the canvas
— for a screenshot, a minimap, a texture on a mesh of another stage:

```ts
import {RenderTarget} from 'three/webgpu';

const offscreen = new RenderTarget(1024, 768);
const minimap = new StageRenderer(display).add(stage);
minimap.outputRenderTarget = offscreen;

// every frame draws into `offscreen`, and the renderer restores the target it found afterwards:
// use `offscreen.texture` anywhere else
```

It works with a pipeline as well: the output of the pipeline goes into the target.

Without a pipeline the stages draw into the target linear in the working color space and without
tone mapping, as three.js draws into every `RenderTarget`. With a pipeline its output transform
applies — tone mapping and the encoding to `renderer.outputColorSpace` while
`pipeline.outputColorTransform` is `true` —, just as on the canvas. A renderer that sits under a
parent with a pipeline writes linear in both cases: the outermost pipeline applies the transform,
once.

## Post-processing

A `StageRenderer` takes a three.js `RenderPipeline` as `pipeline`. What the pipeline gets to work
on depends on what else is set:

| `pipeline` | `buildOutputNode` | what happens |
| --- | --- | --- |
| none | — | the stages draw straight into the canvas or `outputRenderTarget` |
| a `RenderPipeline` | none | **whole picture** — the stages draw into one internal target, and the pipeline works on that one picture |
| a `RenderPipeline` | a callback | **composed** — every stage is a pass node of its own, and the callback composes them into a TSL graph |
| a `RootRenderPipeline` | none, or a callback | **composed**, with the passes added up as the default composition |

Renderers with a pipeline each, nested under a composing parent, are **nested pipelines**: an
effect per layer, composed once at the top. Under a composing pipeline — the composed mode and
nested pipelines — every stage has to provide a pass node.

Two notes on the types in the examples. `Display.renderer` is `WebGPURenderer | undefined` —
`dispose()` takes it away — so a display that is up asserts it with `!`. And `buildOutputNode`
receives its passes as plain `Node`s: neither the `Node<'vec4'>` that `bloom()` asks for nor the
arithmetic operators TSL attaches at run time are visible to the static type, so a callback of
your own casts for both.

### A pipeline on the whole picture

The whole-picture mode needs no TSL at all: the stages draw into an internal target, and the renderer sets
`pipeline.outputNode` to a `texture()` node of it.

```ts
import {RenderPipeline} from 'three/webgpu';

const sr = new StageRenderer(display).setClearColor(new Color('#000')).add(stage);
sr.pipeline = new RenderPipeline(display.renderer!);
```

The pipeline writes to `outputRenderTarget` if one is set, to the canvas otherwise. The internal
target has the size of the renderer, the output buffer type of the WebGPU renderer and its
`samples`, and starts every frame cleared. The output node is built once for a pipeline; after
a change you make to the pipeline yourself, `invalidateOutputNode()` has it built again on the
next frame.

#### Sharing the internal target: `StageRenderTargetPool`

Each renderer in the whole-picture mode holds an internal target of its own. Several of them of the same size —
children with a pipeline each under a composing root, say — can share one through a
`StageRenderTargetPool` set as `internalTargetPool`:

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

A renderer borrows the target for its draw and gives it back once its pipeline has run — also
when a stage or the pipeline throws. Renderers that draw one after another share one target; a
renderer that draws while another one holds the target, such as a child inside a parent that is
in the whole-picture mode as well, gets a second one from the pool. The pool lends targets of
exactly the size asked for: give renderers of different sizes a pool each, or the pool resizes its
target at every switch between
them and allocates new GPU memory each time. Without a pool nothing changes.

### Composed: one pass per stage, `buildOutputNode`

For a real effect, `buildOutputNode(stagePasses)` receives the pass node of every stage, in the
render order, and returns the output node of the pipeline. The bloom over everything comes ready
made from `createBloomOutputNodeBuilder()`:

```ts
import {createBloomOutputNodeBuilder} from '@spearwolf/twopoint5d';
import {RenderPipeline} from 'three/webgpu';

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

`createBloomOutputNodeBuilder({strength = 1, radius = 0, threshold = 0})` adds the passes up and
lays the bloom of the sum on top. The options go to three's `bloom()` unchanged and are read once.
Give every renderer a builder of its own: a builder shared by two renderers releases the bloom of
one whenever the other rebuilds.

What the passes are:

- a `Stage2D` gives `pass(scene, camera)`, one node for as long as scene and camera stay the same;
- a nested `StageRenderer` gives a `texture()` node of a target of its own, which the parent
  clears and draws the child into before its pipeline runs.

`buildOutputNode` runs again on the next frame after a stage was added or removed, after a change
of `renderOrder` or of a stage name, after a new `pipeline` or `buildOutputNode`, after a stage
got a new camera or a new scene, and after `invalidateOutputNode()`. While the renderer has no
size, or a `Stage2D` it composes has no camera yet, it draws nothing. Without any stage it draws
its own clear and calls neither the callback nor the pipeline.

#### A builder of your own

Neither the renderer nor three's `RenderPipeline` releases an output node a rebuild replaces. An
effect node that owns render targets — `bloom()` does — is the callback's to release: the one of
the previous call once the new one stands, the last one when you are done.

```ts
import {bloom} from 'three/examples/jsm/tsl/display/BloomNode.js';
import type {Node} from 'three/webgpu';

const sr = new StageRenderer(display).setClearColor(new Color('#000')).add(stage);
const pipeline = new RenderPipeline(display.renderer!);
sr.pipeline = pipeline;

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

// teardown: the renderer lets go first, then the glow of the last call and the pipeline go
sr.dispose();
lastGlow?.dispose();
pipeline.dispose();
```

#### Adding up layers: `RootRenderPipeline`

When all you want is every stage on top of the other, a `RootRenderPipeline` instead of a
`RenderPipeline` composes them additively — `p0.add(p1).add(p2)…` — without a callback:

```ts
import {RootRenderPipeline} from '@spearwolf/twopoint5d';

root.pipeline = new RootRenderPipeline(display.renderer!);
```

A `buildOutputNode` you set still wins over the additive default; the composition itself is
`RootRenderPipeline.buildOutputNode(passes)`, for a callback of your own to build on.

### Nested pipelines: an effect per layer

Nested pipelines put the pieces together: a child renderer with a pipeline of its own renders its layer
with its effect into a texture, and the parent composes that texture with the other layers in its
own pipeline.

```ts
const root = new StageRenderer(display).setClearColor(new Color('#000'));

// the world with a bloom of its own
const worldRenderer = new StageRenderer(root).add(worldStage);
const worldBloom = createBloomOutputNodeBuilder({strength: 1.5, radius: 0.5});
worldRenderer.pipeline = new RenderPipeline(display.renderer!);
worldRenderer.buildOutputNode = worldBloom;

// the UI without
root.add(uiStage);

// the root adds up every child and makes the one draw to the canvas
root.pipeline = new RootRenderPipeline(display.renderer!);
```

The child's pipeline writes linear: while the root draws its children, `renderer.toneMapping` is
`NoToneMapping` and `renderer.outputColorSpace` the working color space, restored before its own
pipeline runs. Tone mapping and the output encoding apply once, in the outermost pipeline. The
same holds for a child with a pipeline under a renderer in the whole-picture mode. The lookbook demo *stage nested
pipelines* runs this setup.

### One writer per canvas

A `RenderPipeline` expects to make the last draw to its target. A `pipeline.render()` and a plain
`renderer.render(scene, camera)` on the same canvas in one frame do not go together — one of the
two is lost, under WebGPU and under WebGL 2 alike. Two patterns are stable:

1. **One pipeline at the top.** Post-processing beside plain stages on one canvas: the outermost
   renderer gets the pipeline and composes every child — the composed mode, or nested pipelines.
   The outer pipeline makes the one draw to the canvas.
2. **No mixed writers.** A root without a pipeline whose children write to the canvas, some through
   a pipeline and some plain, is not supported.

### What a pipeline costs

Every render target of a pipeline — a pass per stage, the half and smaller targets of a bloom —
has the size of the drawing buffer, so the resolution of the display counts for all of them; see
[display: pipelines](display.md#pipelines). A renderer leaves its own clear of the canvas out
where the draw of the pipeline covers it anyway, since on the canvas that clear would cost a
full-screen draw of its own.

## Stage transitions

A game is rarely one stage: a title menu turns into a level, a pause menu lies over the frozen
level, the level goes back to the title through black. A `StageDirector` holds a **stack of
layers** and changes it through **transitions** — each with an effect, a duration and an easing.

### From the menu into the game

```ts check
import {Display, OrthographicProjection, Stage2D, StageDirector, StageRenderer, dissolve} from '@spearwolf/twopoint5d';
import {Color} from 'three/webgpu';

const display = new Display(document.querySelector('canvas')!);
const view = {width: 640, height: 360, fit: 'contain'} as const;

const stars = new Stage2D(new OrthographicProjection('xy|bottom-left', view));
const title = new Stage2D(new OrthographicProjection('xy|bottom-left', view));
// a level of two stages, the world and its HUD — one layer for the director
const level = new StageRenderer()
  .add(new Stage2D(new OrthographicProjection('xy|bottom-left', view)))
  .add(new Stage2D(new OrthographicProjection('xy|bottom-left', view)));

// the director is the renderer of the display: it composes the stack in one pipeline
const director = new StageDirector(display).setClearColor(new Color('#05060d'));
director.setStack([stars, title]); // bottom to top

// made once and reused: the director keeps one graph per effect
const effect = dissolve({scale: 4});

window.addEventListener('keydown', async (event) => {
  if (event.code !== 'Enter' || !director.has(title)) return;
  // only the slot of the title changes: the stars below stay as they are
  const transition = director.replace(title, level, {effect, duration: 0.8, easing: 'ease-in-out'});
  await transition.finished; // the stack is [stars, level]
});

display.start();
```

The stars sit in the bottom slot from the first frame to the last; every transition runs above
them. The level is a `StageRenderer` of its own, so it may carry a pipeline of its own — a bloom
of the world alone, a palette effect —, and the director composes its output like any other layer.

### A pause menu over the frozen game

```ts
// the level keeps its last picture under the menu: neither updated nor drawn
director.push(pauseMenu, {effect: fade(), duration: 0.2, below: 'freeze'});

// back to the game, which runs on from the frame it stopped at
director.pop({effect: fade(), duration: 0.2});

// or back to the title, through black
director.hide(pauseMenu);
director.replace(level, title, {effect: dipToColor({color: new Color('#000')}), duration: 1});
```

### A loading screen that follows the loader

```ts
const transition = director.replace(loadingScreen, level, {effect: lumaMask({mask}), manual: true});
loader.onProgress = (fraction) => (transition.progress = fraction);
loader.onDone = () => transition.complete();
```

With `manual: true` the director does not advance the transition: the caller writes `progress`,
clamped to `[0, 1]`, and ends it with `complete()` or `cancel()`. `duration` and `easing` do not
apply.

### No hitch on the first transition

The first time the stack takes a shape — the title dissolving into the level, the pause menu
fading in over it — the director builds a shader for it, in the frame the player pressed Start.
Name the shapes ahead and they compile at start, while the title runs:

```ts
const dissolveIn = dissolve({scale: 4});
const fadeIn = fade();

await director.precompile(
  display.renderer!,
  [
    ['layer', 'layer'], // the stars below the title
    ['layer', dissolveIn], // the stars below the title dissolving into the level
    ['layer', 'layer', fadeIn], // the pause menu fading in over the frozen level
  ],
  // drawn once off screen: their sprites and the bloom of the level build now
  {layers: [level, pauseMenu]},
);
```

A shape lists the slots of the stack bottom to top: `'layer'` for a slot that shows a layer, the
effect for a slot in a transition — the same effect object the transition will take, since the
director tells shapes apart by their effect objects —, and `{effect?, mask}` for a slot with a
[mask](#no-hitch-precompile-with-masks). A shape drawn or compiled before is skipped.

The shapes cover the composition of the director. A layer builds its own materials and pipelines
on its first draw; the stages in `layers` draw once, off screen, as the director draws a layer, and
their first frame in the stack builds nothing. A stage that is not in the stack yet takes the size
of the director for that draw, so call `precompile()` once the display runs, and outside of a
frame.

### One scene into another, as a whole

A transition changes one slot. To fade the whole picture of one scene — stars, level and HUD —
into the whole picture of another, give each scene a director of its own and let an outer
director change between them:

```ts
const game = new StageDirector().setStack([stars, level, hud]);
const gameOver = new StageDirector().setStack([backdrop, scoreBoard]);

const screen = new StageDirector(display).setStack([game]);
const sceneChange = dissolve();
screen.replace(game, gameOver, {effect: sceneChange, duration: 1.2});
```

The outer director sees each inner one as one layer with one picture, so the effect runs over the
composed scene, not slot by slot.

An inner director draws into a target of the outer one, not onto the canvas, and its
`precompile()` compiles for that place once it is a layer. For a scene that waits for its turn,
say so ahead:

```ts
await gameOver.precompile(display.renderer!, [['layer', 'layer']], {nested: true});
await screen.precompile(display.renderer!, [[sceneChange]], {layers: [gameOver]});
```

### The stack and its slots

The stack is a list of **slots**, bottom to top. A slot shows one layer, or a transition between
two sources — a layer and a layer, a layer and nothing, nothing and a layer. The director composes
the slots bottom to top with premultiplied alpha, over its own clear color: a layer that clears
itself to an opaque color hides everything below it, a layer that clears nothing lets the slots
below show through wherever it draws nothing.

| method | the stack before → after | what transitions |
| --- | --- | --- |
| `show(stage, opts?)` | `[a]` → `[a, stage]`, or at `opts.at` | `stage` from nothing |
| `hide(stage, opts?)` | `[a, stage]` → `[a]` | `stage` into nothing |
| `replace(from, to, opts?)` | `[a, from]` → `[a, to]` | `from` into `to`, in the slot of `from` |
| `push(stage, opts?)` | `[a]` → `[a, stage]` | as `show()`; `opts.below` decides what `a` does under it |
| `pop(opts?)` | `[a, b]` → `[a]` | the top layer into nothing; the layer below runs again |
| `setStack(stages)` | anything → `stages` | nothing: an instant cut; running transitions end as cancelled, and every [mask](#masks-on-a-slot) is dropped |

- Without an `effect`, a `duration` above 0 or `manual`, a change lands at once — the stack
  changes in the call, and the next frame draws it.
- `director.stack` is the stack as it stands once every running transition has ended;
  `director.transitions` lists the transitions that run, `director.has(stage)` asks for one stage.
- `add(stage)` shows a stage on top at once — `new StageRenderer(director)` and
  `child.parent = director` do the same —, `remove(stage)` takes it out at once, wherever it is.
- A method refuses, with an error that names the call and the stage and before anything has
  changed: `show()` or `push()` of a stage in the stack, `hide()` or `replace()` of a stage that is
  not in it, `replace()` to a stage in the stack, `pop()` of an empty stack, a disposed stage, a
  `ClearStage`, the director itself or a renderer that holds it, and options it cannot take — a
  negative `duration` or `delay`, an easing it does not know, an `at` outside the stack.
- A change of a slot that is in a transition finishes that transition first: its end state lands
  and its events go out. So does a transition that takes a stage out of the stack, when `show()`,
  `push()` or `replace()` brings that stage back.
- `pipeline`, `buildOutputNode` and `renderOrder` are the director's own; a write to any of them
  throws. The director draws only its clear while the stack is empty.

### Layers

A layer is any stage. A `StageRenderer` is the layer itself: its stages, its clear, its order and
its pipeline apply as under every composing parent, and it may be a `StageDirector` too. Any other
stage — a `Stage2D`, a stage of your own — goes into a `StageRenderer` the director builds for it
and disposes when the stage leaves the stack. Every layer draws into a target of its own that the
director clears to transparent black every frame.

A layer leaves the director's stages as it leaves the stack and joins them again, at the size of
the director, when it comes back; a layer that leaves releases the GPU memory of its target.

### Run and freeze

Every layer in a slot updates and draws every frame, unless it is **frozen**: then it is neither
updated nor drawn, and the composition samples the last picture it drew. Freezing costs nothing —
no draw, no copy. A frozen layer whose size changes draws once at the new size, without an update.

| where | option | `'run'` | `'freeze'` |
| --- | --- | --- | --- |
| under a `push()` | `below` | the default: the layer below plays on | it stops until `pop()` |
| the layer a transition leaves | `outgoing` | the default | its last picture goes |
| the layer a transition brings | `incoming` | the default | its first picture comes; it runs from the end on |

`push()` with `below: 'freeze'` freezes the layer that stays below the new slot: a pause menu
pushed back while its `pop()` still fades it out comes back over a frozen level.

`director.freeze(stage)` and `director.run(stage)` set it by hand; `director.isFrozen(stage)` asks.

### The transition

Every method but `setStack()` answers a `StageTransition`, the instant ones included:

| member | |
| --- | --- |
| `from`, `to` | the stages, `undefined` for nothing |
| `effect`, `duration`, `delay`, `manual` | as handed in |
| `state` | `'pending'` until its first frame, `'running'`, then `'finished'` or `'cancelled'` |
| `elapsed`, `progress` | seconds since its start; the eased progress, `0`…`1` — writable while `manual` |
| `finished` | resolves with the transition once it ended, also when it was cancelled; it never rejects |
| `complete()` | ends it now, with `to` in the slot |
| `cancel(jumpTo?)` | ends it now as cancelled: `'start'`, the default, leaves `from`, `'end'` leaves `to` |
| `reverse()` | runs it back from where it is; back at the start it ends as cancelled |

The options of every change:

| option | default | |
| --- | --- | --- |
| `effect` | `crossfade()` | |
| `duration` | `0.5` with an `effect`, `0` without | seconds |
| `easing` | `'ease-in-out'` | `'linear'`, `'ease-in'`, `'ease-out'`, `'ease-in-out'` — cubic — or a function of your own |
| `delay` | `0` | seconds before it starts |
| `manual` | `false` | |
| `outgoing`, `incoming` | `'run'` | see [run and freeze](#run-and-freeze) |
| `at` | the top | `show()` and `push()`: the position in the stack |
| `below` | `'run'` | `push()` |

**Time.** A transition runs on the `updateFrame()` of the director, by its `deltaTime`: a paused
display pauses it, a slowed one slows it. The frame after the call is its first one, at progress
0 — a transition started in a click handler has drawn its first picture in the frame after the
click —, and the frame in which `elapsed` reaches `duration` shows `to` alone. A named easing costs
no allocation per frame; a function of your own is called once per frame.

**Events.** `OnStageTransitionStart` goes out on the director in the first frame of a transition,
after its delay; `OnStageTransitionEnd` in the frame or the call that ends it. Both carry
`{director, transition}`; a change without a transition emits both at once. A listener that throws
keeps neither the other listeners, the layers nor the change of the stack from happening; its
error comes out of the call afterwards.

### Effects

| effect | options | what it does |
| --- | --- | --- |
| `crossfade()` | — | a mix of the two |
| `fade()` | — | `crossfade()` under the name that reads right for a layer that comes from or goes into nothing |
| `dipToColor({color})` | black | `from` into the color, the color into `to` |
| `wipe({direction, softness})` | `'left'`, `0.02` | a moving edge with `to` behind it; `'left'` starts at the right side; an angle in radians, counter-clockwise from the right, for any other |
| `slide({direction, mode})` | `'left'`, `'push'` | `'push'`: both move; `'cover'`: `to` moves in over `from`; `'reveal'`: `from` moves off `to` |
| `iris({center, softness})` | the middle, `0.02` | a circle opens on `to`; `center` in uv from the top left |
| `dissolve({scale, softness})` | `1`, `0.05` | a noise per cell of `scale` pixels decides when it switches; at `1` a pixel dissolve |
| `lumaMask({mask, softness, invert})` | —, `0.05`, `false` | the luminance of a gray texture says when each pixel switches, dark ones first; the mask covers the picture as a texture covers a mesh and stays yours |
| `pixelate({maxBlockSize})` | `32` | both sampled at blocks that grow to the middle and shrink again |
| `matte({mask, mode, softness})` | —, `'coverage'`, `0.05` | a [stage that lives](#a-transition-through-a-living-matte) decides how much of `to` shows: its coverage is the share of `to`, or the point at which each pixel switches |

Every effect works in both directions and with nothing on either side: `fade()` from nothing is an
opacity fade, `wipe()` from nothing a reveal. An effect is a description — its options are read
when you make it —, so one effect serves every director and every transition at once. Make it once
and reuse it: the director keeps one graph per shape of its stack, and a second transition with
the same effect object in the same slot swaps textures instead of building a shader. A new effect
object, even with the same options, builds a shader on its first use.

### An effect of your own

An effect is one function from two sources and a progress to a premultiplied color, in TSL. It
answers `from` at progress 0 and `to` at progress 1, and anything between:

```ts check
import type {StageTransitionEffect} from '@spearwolf/twopoint5d';
import {float, mix, sin, vec2} from 'three/tsl';

export const wobble = (amplitude = 0.03): StageTransitionEffect => ({
  name: 'wobble',
  build: ({from, to, progress, uv}) => {
    const strength = sin(progress.mul(Math.PI)).mul(amplitude);
    const shifted = uv.add(vec2(sin(uv.y.mul(40)).mul(strength), float(0)));
    return mix(from.sample(shifted), to.sample(shifted), progress);
  },
});
```

`build({from, to, progress, uv, resolution})` gets the sources as `sample(uv)` — transparent black
outside `[0, 1]` —, the eased progress as a float node, the uv of the pixel with its origin at the
top left of the picture, and the size of the picture in pixels of the drawing buffer. An effect
whose nodes own GPU memory releases it in an optional `dispose(node)`, which the director calls
in its own `dispose()`.

### Without a director

`createTransitionNode(effect, from, to, progress?)` builds the node of an effect for a
`buildOutputNode` of your own. A source is a `TextureNode` — what a nested `StageRenderer` hands
in —, the `PassNode` of a `Stage2D`, or `null` for nothing. Without a `progress` node it makes a
float uniform at 0 and answers it with the node:

```ts
const {node, progress} = createTransitionNode(crossfade(), null, null);
sr.buildOutputNode = ([a, b]) => createTransitionNode(crossfade(), a, b, progress).node;
// the caller drives progress.value
```

### What a transition costs

Every layer in the stack has a target the size of the drawing buffer, as a nested renderer does
(see [what a pipeline costs](#what-a-pipeline-costs)). A frozen layer keeps its target and draws
nothing. A transition costs its two sources — both draw while it runs, unless one is frozen — and
no draw of its own: it is a part of the one quad of the director's pipeline.

A shape the stack has not had before builds a shader on its first frame; every later visit to it
swaps textures and builds nothing. [`precompile()`](#no-hitch-on-the-first-transition) moves that
build to the start.

## Stage masks

A mask says how much of a picture shows: where it covers 1, the picture stays as it is, where it
covers 0, nothing is left of it, and in between it fades. A `StageMask` makes a stage the mask. The
stage draws as any stage does — sprites, meshes, a `Canvas2DStage` — and the coverage is read from
its picture, so a fog of war is a stage that draws soft white blobs around the player and around
every torch.

A `StageDirector` puts a mask on a **slot** of its stack: the slot shows its layer only where the
mask stage draws. The mask costs a texture fetch and a multiplication in the one quad of the
director, no pass target for the masked layer and no extra full-screen draw — and one mask serves
as many slots as you like.

### A fog of war over a level

The level is a layer. The fog is a second stage that draws a soft white blob around the player and
around every torch, and nothing else. The level, masked by the fog, shows inside the blobs; outside
of them the director's own clear color shows — the dark of the unexplored.

```ts check
import {on} from '@spearwolf/eventize';
import {
  Display,
  OnStageUpdateFrame,
  OrthographicProjection,
  Stage2D,
  StageDirector,
  StageMask,
} from '@spearwolf/twopoint5d';
import {CanvasTexture, Color, Mesh, MeshBasicMaterial, PlaneGeometry} from 'three/webgpu';

const display = new Display(document.querySelector('canvas')!);
const view = {width: 640, height: 360, fit: 'contain'} as const;

const level = new Stage2D(new OrthographicProjection('xy|bottom-left', view));
// ... the sprites and tiles of the level go into level.scene

// white in the middle, transparent at the rim: a soft blob of coverage
const blobTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(canvas);
})();

const blob = (radius: number) =>
  new Mesh(
    new PlaneGeometry(radius * 2, radius * 2),
    new MeshBasicMaterial({map: blobTexture, transparent: true}),
  );

// the fog stage clears nothing: it draws its blobs onto transparent black
const fogStage = new Stage2D(new OrthographicProjection('xy|bottom-left', view));
const aroundPlayer = blob(90);
fogStage.scene.add(aroundPlayer);

const player = {x: 320, y: 180};
on(fogStage, OnStageUpdateFrame, () => {
  aroundPlayer.position.set(player.x, player.y, 0);
});

const director = new StageDirector(display).setClearColor(new Color('#05060d'));
director.setStack([level]);
director.setMask(level, new StageMask(fogStage, {source: 'alpha'}));

display.start();
```

The fog stage is never in the stack: the director draws it as the mask and updates it after the
layers, every frame. The coverage is the alpha of what the stage draws, so a mesh or a sprite with
a soft edge gives a soft edge of the light. `director.setMask(level, undefined)` shows the whole
level again, and a layer that comes below the level — `director.show(stars, {at: 0})` — shows
through the dark where the fog covers 0 instead of the clear color.

### A rift into a second world

Two layers and one mask cross a world into another: the world lies in the bottom slot, the rift in
the slot above it, and the mask belongs to the slot of the rift. Where the mask is 0 the world
shows, where it is 1 the rift, between them a mix of both.

```ts check
import {on} from '@spearwolf/eventize';
import {
  Display,
  OnStageUpdateFrame,
  OrthographicProjection,
  Stage2D,
  StageDirector,
  StageMask,
} from '@spearwolf/twopoint5d';
import {CircleGeometry, Mesh, MeshBasicMaterial} from 'three/webgpu';

const display = new Display(document.querySelector('canvas')!);
const view = {width: 640, height: 360, fit: 'contain'} as const;

const world = new Stage2D(new OrthographicProjection('xy|bottom-left', view));
// ... the first world goes into world.scene
const rift = new Stage2D(new OrthographicProjection('xy|bottom-left', view));
// ... the second world goes into rift.scene

// the opening of the rift: a white disc on transparent black that grows
const riftStage = new Stage2D(new OrthographicProjection('xy|bottom-left', view));
const opening = new Mesh(new CircleGeometry(1, 48), new MeshBasicMaterial({transparent: true}));
opening.position.set(320, 180, 0);
riftStage.scene.add(opening);

let radius = 1;
on(riftStage, OnStageUpdateFrame, ({deltaTime}) => {
  radius = Math.min(radius + deltaTime * 120, 260);
  opening.scale.setScalar(radius);
});

const director = new StageDirector(display);
director.setStack([world, rift]);
director.setMask(rift, new StageMask(riftStage));

display.start();
```

The world is not hidden by anything: it runs under the rift, and the rift runs inside the disc.
With `invert: true` on the mask of the rift the picture turns around: the rift shows everywhere but
inside the disc, where the world below shows. To cut a hole into the world itself, for a layer
below it to show through, put a second `StageMask` on the same stage with `invert: true` on the
slot of the world.

### One mask on two slots

A mask lies on as many slots as you like. Its stage draws once per frame, and every masked slot
samples the same picture — a torch that lights the hills and the ruins at once:

```ts
const torchLight = new StageMask(torchStage);

director.setStack([sky, hills, ruins]);
director.setMask(hills, torchLight);
director.setMask(ruins, torchLight); // no second draw of torchStage
```

The sky below stays unmasked and shows around the lit parts. Two `StageMask` objects on one stage
count as one mask stage that draws once — a second one with `invert: true` cuts out where the first
reveals.

### A frozen mask

A mask that never changes — a vignette, a porthole, the outline of a painted screen — need not
draw again and again. Freeze its stage and the director samples the last picture:

```ts
director.setMask(level, new StageMask(vignetteStage));
director.freeze(vignetteStage); // drawn once, then sampled: a texture fetch per pixel and nothing else

director.run(vignetteStage); // alive again
```

`freeze()` and `run()` work for the stage of a mask as they work for a layer. A frozen mask redraws
once after the size of the director changes. A freeze does not outlive the mask stage's stay in the
director: once nothing masks with the stage any more, it leaves, and a later `setMask()` finds it
running.

### A transition through a living matte

`lumaMask()` switches by a still texture. When the matte itself should move — ink that spreads, a
hand that wipes, flames that eat the picture — the matte is a stage, and `matte()` makes the
transition of it. The stage draws the blots, and the transition shows `to` where it draws:

```ts check
import {on} from '@spearwolf/eventize';
import {
  Display,
  matte,
  OnStageUpdateFrame,
  OrthographicProjection,
  Stage2D,
  StageDirector,
  StageMask,
} from '@spearwolf/twopoint5d';
import {CircleGeometry, Mesh, MeshBasicMaterial} from 'three/webgpu';

const display = new Display(document.querySelector('canvas')!);
const view = {width: 640, height: 360, fit: 'contain'} as const;

const title = new Stage2D(new OrthographicProjection('xy|bottom-left', view));
// ... the title screen goes into title.scene
const level = new Stage2D(new OrthographicProjection('xy|bottom-left', view));
// ... the level goes into level.scene

// the ink: white discs on transparent black, each with a size of its own
const inkStage = new Stage2D(new OrthographicProjection('xy|bottom-left', view));
const blots = Array.from({length: 24}, () => {
  const mesh = new Mesh(new CircleGeometry(1, 32), new MeshBasicMaterial({transparent: true}));
  mesh.position.set(Math.random() * 640, Math.random() * 360, 0);
  inkStage.scene.add(mesh);
  return {mesh, seed: 1 + Math.random() * 0.5};
});

const ink = new StageMask(inkStage);
const inkIn = matte({mask: ink}); // made once and reused, as every effect

// the blots grow with the transition, whatever its duration or its easing
on(inkStage, OnStageUpdateFrame, () => {
  for (const blot of blots) blot.mesh.scale.setScalar(blot.seed * ink.progress ** 2 * 800);
});

const director = new StageDirector(display);
director.setStack([title]);
director.replace(title, level, {effect: inkIn, duration: 1.2});

display.start();
```

At progress 0 the title shows alone, with the blots at size 0; at 1 the level shows alone. Between
them every pixel shows the share of the level that the ink covers there — a pixel inside a blot the
level, outside it the title, the edge of a soft blot a mix of both. The mask stage is never in the
stack: the director draws it while the transition runs and lets it go when the transition ends, so a
matte costs nothing before and after.

**Progress, not the clock.** A matte that grows with the clock of the display would end early under a
slowed transition, late under a fast one and never under a `manual: true` one. `ink.progress` is the
eased progress of the transition; the stage reads it in its `OnStageUpdateFrame`, and the blots
follow the transition at any duration and easing, also when it is [driven by hand](#a-loading-screen-that-follows-the-loader).
More in [the progress of a mask](#the-progress-of-a-mask).

**`mode`.** The default is `'coverage'`: the stage is the transition, and its coverage is the
share of `to`. With `'threshold'` the coverage says **when** a pixel switches — a pixel of
coverage 0.3 switches at progress 0.3, as the luminance of a gray texture does in `lumaMask()`:
what is dark switches first. That is `lumaMask()` with a
mask that lives: a noise that boils while the progress sweeps through it.

```ts check
import {
  Display,
  matte,
  OrthographicProjection,
  Stage2D,
  StageDirector,
  StageMask,
} from '@spearwolf/twopoint5d';
import {DataTexture, Mesh, MeshBasicMaterial, PlaneGeometry, RGBAFormat} from 'three/webgpu';

const display = new Display(document.querySelector('canvas')!);
const view = {width: 640, height: 360, fit: 'contain'} as const;
const title = new Stage2D(new OrthographicProjection('xy|bottom-left', view));
const level = new Stage2D(new OrthographicProjection('xy|bottom-left', view));

// a gray noise of 64 × 36 texels over the whole picture, drawn again every tenth of a second
const noise = new DataTexture(new Uint8Array(64 * 36 * 4), 64, 36, RGBAFormat);
const boil = () => {
  const texels = noise.image.data as Uint8Array;
  for (let i = 0; i < texels.length; i += 4) {
    texels[i] = texels[i + 1] = texels[i + 2] = Math.random() * 255;
    texels[i + 3] = 255;
  }
  noise.needsUpdate = true;
};
boil();
setInterval(boil, 100);

const noiseStage = new Stage2D(new OrthographicProjection('xy|bottom-left', view));
const plane = new Mesh(new PlaneGeometry(640, 360), new MeshBasicMaterial({map: noise}));
plane.position.set(320, 180, 0);
noiseStage.scene.add(plane);

const boiling = matte({
  mask: new StageMask(noiseStage, {source: 'luminance'}),
  mode: 'threshold',
  softness: 0.1,
});

const director = new StageDirector(display);
director.setStack([title]);
director.replace(title, level, {effect: boiling, duration: 1.5});

display.start();
```

`softness` belongs to `'threshold'` alone: how far a pixel blends around its switching point, in the
range of the coverage (default `0.05`). Both ends hold by the switching function — at progress 0
every pixel shows `from`, at progress 1 every pixel shows `to` — whatever the noise draws.

**The ends.** An effect answers `from` at progress 0 and `to` at progress 1, but a living stage
promises neither. In `'coverage'` mode `matte()` holds the ends itself: the share is 0 at progress 0
and 1 at progress 1, whatever the stage drew. Between them it is the stage alone — and a mask stage
that does not cover the picture by the end **jumps** there: in the last frame the transition shows
`to` in full, also at the pixels the stage never reached. The blots of the recipe grow with the
square of the progress to a size that covers the picture, so they have covered it before the jump. A stage
whose picture is not 1 everywhere at progress 1 shows the jump as a flash of `to` over what was left of `from`.

An effect with a mask holds a stage, so it is no description any more: it serves **one director** at
a time, and a second transition with an effect that names a busy mask is refused — see
[the progress of a mask](#the-progress-of-a-mask).

### An effect that reads a mask

`matte()` is one effect of the contract that is open to every effect. An effect names the masks it
samples in `masks`, and `build()` gets their pictures through `input.mask()`:

```ts check
import type {StageMask, StageTransitionEffect} from '@spearwolf/twopoint5d';
import {float, mix, select} from 'three/tsl';

/** `to` grows out of the lit spots of a mask; a pixel without light keeps `from` until the very end. */
export const throughTheLight = (light: StageMask): StageTransitionEffect => ({
  name: 'through-the-light',
  masks: [light],
  build: ({from, to, progress, uv, mask}) => {
    const lit = mask(light).coverage(uv);
    // from at progress 0 and to at progress 1, whatever the mask draws
    const share = select(progress.greaterThanEqual(1), float(1), lit.mul(progress));
    return mix(from.sample(uv), to.sample(uv), share);
  },
});
```

- `masks` is a list of `StageMask` objects, read when a transition with the effect begins. The
  director draws their stages while the transition runs and lets them go afterwards. A list changed
  later changes no transition that runs.
- `input.mask(mask)` answers a `StageMaskSource` for one of the masks the effect named. It is the
  `StageTransitionSource` of the stage, `sample(uv)` — the premultiplied picture, transparent black
  outside `[0, 1]` — with one member more: `coverage(uv)`, the coverage by the `source` and the `invert` of
  the mask, from 0 to 1 and 0 outside `[0, 1]`. A mask the effect did not name throws, also another `StageMask` on the same stage.
- The mask is sampled at the `uv` of the effect, as the layers are: a mask stage is a picture of
  the screen, not a texture of a mesh. A mask stage that draws into its top half is the top half of
  the picture.
- The contract stays: `from` at progress 0, `to` at progress 1. A mask that lives has to be held
  to the ends by the effect, as `matte()` does.
- An effect with `masks` is compiled once per effect object, like any other.

### The mask

```ts
import {StageMask} from '@spearwolf/twopoint5d';

const fog = new StageMask(fogStage, {source: 'alpha'});
```

`new StageMask(stage, options?)` takes any stage a `StageDirector` takes as a layer: it has
`renderTo()`, it is no `ClearStage`, and it is not disposed. Anything else is refused with an
error that names the stage.

| option | default | |
| --- | --- | --- |
| `source` | `'alpha'` | what of the picture is the coverage: `'alpha'`, `'luminance'`, `'red'`, `'green'`, `'blue'` |
| `invert` | `false` | `1 - coverage`: the mask cuts out where its stage draws |

The options are read once, when the mask is made. `'alpha'` is the default because a mask stage
clears nothing and draws its shapes onto transparent black. `'luminance'` suits a gray picture, a
painting or a canvas, and is read in the linear working space. Every source reads the picture
premultiplied: the luminance of a half-transparent gray is its luminance times its alpha, so the
transparent black around the shapes of a mask stage covers 0 under every source.

`mask.stage`, `mask.source` and `mask.invert` read back what you handed in. A `StageMask` holds its
stage but does not own it: `mask.dispose()` lets go of it and leaves the stage undisposed, which
stays yours to dispose.

The mask stage is any stage a director takes as a layer: a `Stage2D`, a `StageRenderer` with stages
and a pipeline of its own, a stage of your own. A stage serves **one director** at a time as a mask,
and it is a layer or a mask, never both: a second director refuses every mask on such a stage with
an error that names the mask stage, and so does a director that has the stage as a layer. Within
one director a stage may lie under several masks and several slots.

### Masks on a slot

The mask belongs to the **slot**, not to the layer: `replace(level, nextLevel)` keeps the mask and
changes the view behind it, and a transition in that slot runs inside the mask.

| call | |
| --- | --- |
| `director.setMask(stage, mask)` | masks the slot whose end state holds `stage`; lands at once, the next frame draws it |
| `director.setMask(stage, undefined)` | takes the mask off |
| `director.maskOf(stage)` | the mask of the slot that holds `stage`, or `undefined` |
| `director.show(stage, {mask})`, `director.push(stage, {mask})` | the new slot is a masked one from its first frame |

The composition gets one factor per masked slot: the premultiplied picture of the slot times the
coverage, all four channels. Coverage 0 removes the slot, 1 keeps it, anything between scales it —
soft edges, anti-aliased silhouettes and half-transparent blobs of the mask stage come through as
they are.

- A mask that comes and goes softly is the job of the mask stage itself: it is alive, after all —
  let its shapes grow or fade. `setMask()` itself is an instant change.
- `setStack()` makes new slots and drops every mask, also those of the stages that stay in the
  stack. Set the masks again after the call.
- `hide()`, `pop()` and `remove()` of a layer take the mask off the slot that goes with it.
- `remove(maskStage)` and the `dispose()` of a mask stage take the mask off every slot it lies on.
  `remove()` of a stage that is neither a layer nor a mask does what it does without masks.
- Every refusal comes before anything changes. `setMask()` refuses a `stage` that is not in the
  stack, a `mask` that is not a `StageMask`, a disposed mask or mask stage, a mask whose stage is a
  layer of the stack, is the director or holds it, and a mask stage that another director draws
  as a mask or as a layer. `show()` and `push()` refuse a `mask` the same way. The other way round,
  `show()`, `push()`, `replace()`, `setStack()` and `add()` refuse a stage that is a mask stage of
  the director as a layer.
- The mask stages are updated and drawn after every layer, in the order of the slots they lie on,
  bottom to top. A mask that follows something in the world of a layer reads the camera that moved
  in this frame.

### Run and freeze

A mask stage updates and draws every frame for as long as a slot references it, and leaves the
stages of the director as a layer does when nothing references it any more: the GPU memory of its
pass target goes, and a `StageRenderer` the director built around a `Stage2D` is disposed.

`freeze(stage)`, `run(stage)` and `isFrozen(stage)` take the stage of a mask as they take a layer; a
stage that is neither a layer nor a mask of this director is refused with "no layer or mask of this
director". A frozen mask keeps its last picture and costs a texture fetch per pixel; `run()` sets it
going again.

### The progress of a mask

A mask that a transition uses carries the progress of that transition to its stage:

| member | |
| --- | --- |
| `mask.progress` | the eased progress of the transition, `0`…`1`, read-only |
| `mask.progressNode` | a float uniform with the same value, for a mask stage whose materials animate on the GPU — a noise threshold in a sprite material, a dissolve of its own inside the mask |

- **When it is written.** In `updateFrame()` of the director, after it advanced its transitions and
  before it updates the mask stage: an `OnStageUpdateFrame` listener of the stage reads the value of
  this very frame. A transition with `manual: true` may be set after `updateFrame()` and before the
  draw; `progressNode` is written again in the draw, so the GPU never draws a stale value, while
  `mask.progress` for the CPU side is the value of `updateFrame()`.
- **Between transitions.** The mask holds the last value: 1 after a transition that finished, the value
  of the cancel after one that was cancelled. A new transition starts it at 0.
- **One transition at a time.** A mask drives one transition; a second one whose effect names a mask that
  is busy is refused, with an error that names the mask stage. A mask is busy only after the runs that
  the call ends anyway have ended: `replace()` ends the run in its own slot first, so
  `director.replace(a, b, {effect: inkIn})` in the slot whose `inkIn` run is still going is allowed —
  the old run ends, and the mask starts again at progress 0, with the same mask and the same stage.
- **Without a transition.** A change that happens at once, without an effect, drives no mask and
  leaves `progress` as it was.
- **The reverse.** `reverse()` runs the transition back, and the mask follows it back with it.

```ts
// two slots, one ink: the second must wait for the first
const first = director.replace(title, level, {effect: inkIn});
director.replace(hud, minimap, {effect: inkIn}); // throws: the mask drives a transition already

// the slot of a running matte may start again with it
director.replace(level, nextLevel, {effect: inkIn}); // allowed: the run in this slot ends first
```

### Orientation

A mask is sampled at the same uv as the layers, the origin at the top left of the picture, under
WebGPU and under WebGL 2. A mask stage that draws into its top half masks the top half of the slot.

### No hitch: `precompile()` with masks

A masked slot builds its shader on the first frame as any new shape of the stack does, and
`precompile()` moves that build to the start. A slot of a shape is `'layer'`, an effect, or
`{effect?, mask}` for a masked slot:

```ts
await director.precompile(
  display.renderer!,
  [
    ['layer', {mask: fog}], // the stars below the level under its fog
    ['layer', {effect: dissolveIn, mask: fog}], // a dissolve inside the masked slot
  ],
  {layers: [level, fogStage]}, // the mask stages draw once ahead, as the layers do
);
```

An effect that names masks goes into the shape as any effect does, by its object — and the stages
of its masks go into `layers`, so that they draw once ahead:

```ts
const inkIn = matte({mask: ink});

await director.precompile(
  display.renderer!,
  [['layer', inkIn]], // the stars below the title taking the level in through the ink
  {layers: [title, level, inkStage]},
);
```

The shader holds what a mask reads: its `source`, its `invert`, and which of the slots share a mask
stage. Another `StageMask` finds the shape compiled when the same slots share a mask stage and the
source and the `invert` are the same — a mask, unlike an effect, goes by its options, not by its object.

### What a mask costs

| | full-screen draws | targets of the size of the drawing buffer |
| --- | --- | --- |
| a mask that runs | the draws of its stage | 1 pass target |
| a frozen mask | none | 1 pass target, kept |
| a masked slot | none of its own: one texture fetch and one multiplication in the quad | none of its own |
| a transition through `matte()` | its two sources and the mask stage, for the length of the transition | 1 pass target, for the length of the transition |

Against a nested pipeline that masks a layer in a pass of its own, a masked slot saves a pass
target with its depth buffer — about 100 MB at 3840 × 2160 — and a full-screen quad per masked
layer, and one mask serves several slots.

### Without a director

`createMaskNode(content, mask, options?)` builds the node of a masked picture for a
`buildOutputNode` of your own: `content` times the coverage of `mask`, all four channels,
premultiplied. A source is a `TextureNode` or the `PassNode` of a `Stage2D`, as for
`createTransitionNode()`; the options are those of the table above. The mask stage is one of the
stages of the renderer and is drawn like every other stage.

```ts check
import {
  createMaskNode,
  Display,
  OrthographicProjection,
  Stage2D,
  StageRenderer,
} from '@spearwolf/twopoint5d';
import {RenderPipeline} from 'three/webgpu';

const display = new Display(document.querySelector('canvas')!);
const sr = new StageRenderer(display);

const projection = () => new OrthographicProjection('xy|bottom-left', {fit: 'fill'});
const scene = new Stage2D(projection());
scene.name = 'scene';
const fog = new Stage2D(projection());
fog.name = 'fog';
sr.add(scene).add(fog);

// the scene shows where the fog stage draws
sr.pipeline = new RenderPipeline(display.renderer!);
sr.buildOutputNode = ([sceneNode, fogNode]) => createMaskNode(sceneNode, fogNode, {source: 'alpha'});
```

## A 2D canvas as a stage: `Canvas2DStage`

A `Canvas2DStage` shows a 2D canvas on a sprite, fitted into the container — debug overlays,
charts, anything drawn with the Canvas 2D API:

```ts check
import {on} from '@spearwolf/eventize';
import {Canvas2DStage, Display, OnCanvas2DStageRender} from '@spearwolf/twopoint5d';
import {Color} from 'three/webgpu';

const display = new Display(document.querySelector('canvas')!);
const overlay = new Canvas2DStage(display.renderer!, 320, 200, 'contain');
overlay.stageRenderer.setClearColor(new Color('#000'));

const ctx = overlay.canvas.getContext('2d')!;

on(overlay, OnCanvas2DStageRender, () => {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.fillStyle = '#ffd166';
  ctx.fillText(new Date().toLocaleTimeString(), 10, 20);
  overlay.needsUpdate = true;
});

// the stage drives its own StageRenderer: hand it the size and call render() once per frame
display.onResize(({width, height}) => overlay.setContainerSize(width, height));
display.onRenderFrame(({now, deltaTime, frameNo}) => overlay.render(now, deltaTime, frameNo));

display.start();
```

- `new Canvas2DStage(renderer, width, height, fit?)` builds a canvas of its own;
  `new Canvas2DStage(renderer, canvas, fit?)` shows a canvas you hand in, which stays yours. `fit`
  is `'contain'` (the default) or `'cover'`, and can be changed later through `overlay.fit`.
- Draw in `OnCanvas2DStageRender` and set `needsUpdate`: only then is the canvas uploaded. It
  starts out `true`, so the first frame shows what the canvas already carries.
- `setCanvasSize(width, height)` resizes the canvas — which clears it, as every write to
  `canvas.width` does — and brings sprite and view along. `OnCanvas2DStageResize` announces a new
  size with the next `render()`, also one written straight to the canvas.
- `render()` updates and draws the stage; without arguments it counts time and frames itself.
  It draws nothing before `setContainerSize()` has given the stage a size.
- The canvas is uploaded with `nearest` filtering: one pixel of the canvas stays one sharp pixel.
- `overlay.stage`, `overlay.stageRenderer`, `overlay.projection` (an `OrthographicProjection` on
  `'xy|bottom-left'`), `overlay.sprite` and `overlay.texture` are open for anything else — another
  clear, a pipeline on its renderer.

Do not hang `overlay.stageRenderer` on a host as well: `render()` drives it, and a host would
update and draw it a second time in every frame.

## Stages of your own

Anything that implements `IStage` and `IRenderable` goes into a `StageRenderer`:

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

- `name` — the key of `renderOrder`;
- `resize(width, height, pixelRatio?)` — the size of the container and the pixels of the drawing
  buffer per unit of it, whenever either changes;
- `updateFrame(now, deltaTime, frameNo)` — once per frame, before any stage draws;
- `renderTo(renderer)` — draw yourself into the current target of the renderer.

To work under a composing pipeline, a stage also implements `IPassProvider`: `asPassNode(renderer)`
returns the node that stands for it in the composition. The node belongs to the stage — build it
once, keep it as long as it stays valid, and release it in the stage's `dispose()`:

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

A `StageRenderer` refuses a stage without `asPassNode()` under a composing pipeline with a
`TypeError` that names it: in `add()`, and in a write to `pipeline` or `buildOutputNode` that would
make the renderer compose. A stage whose `isDisposed` is `true` is refused by `add()`.

A stage that ends announces it: an eventized stage (`eventize(this)` from `@spearwolf/eventize`)
that emits `OnStageDispose` in its `dispose()`, as `Stage2D` does, is taken out of every renderer
that holds it. Take any other stage out with `remove(stage)` before you dispose it — see
[pitfalls](#pitfalls).

## Driving the frame loop yourself

Without a host, a `StageRenderer` does nothing on its own; your frame handler resizes, updates and
draws it. That is the way to interleave per-frame logic of your own — input, physics — or to draw
into a target the display does not know:

```ts
import {on} from '@spearwolf/eventize';
import {Display, OnDisplayRenderFrame, ParallaxProjection, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';
import {Color} from 'three/webgpu';

const display = new Display(canvas);
const stage = new Stage2D(new ParallaxProjection('xy|bottom-left'));
const sr = new StageRenderer().setClearColor(new Color('#000')).add(stage); // no host

on(display, OnDisplayRenderFrame, ({renderer, width, height, pixelRatio, now, deltaTime, frameNo}) => {
  // the pixel ratio reaches the projections, which read it for pixelSnap
  sr.resize(width, height, pixelRatio);
  // … your per-frame logic here …
  sr.updateFrame(now, deltaTime, frameNo);
  sr.renderTo(renderer);
});

display.start();
```

Pick one of the two ways: a renderer with a host that you also draw from a frame handler draws
every frame twice.

### A host of your own

A host is anything with the `onResize` and `onRenderFrame` of a `Display` — the frame loop of an
app you do not own, for example:

```ts
import type {IStageRendererHost} from '@spearwolf/twopoint5d';

const host: IStageRendererHost = {
  onResize: (handler) => myApp.subscribe('resize', handler),
  onRenderFrame: (handler) => myApp.subscribe('frame', handler),
};

new StageRenderer(host).add(stage);
```

Each of the two subscribes a handler that receives `DisplayEventProps` and returns its
unsubscribe; the renderer calls each unsubscribe once, when it leaves the host. A host may answer
`isDisposed`; one that answers `true` is refused by `new StageRenderer(host)`, `attach(host)` and
a write to `parent`. A host that throws while the renderer subscribes holds nothing of it: the
renderer gives back what it got and joins no holder.

## Events

All event names are exported from `@spearwolf/twopoint5d`; subscribe with `on()` from
`@spearwolf/eventize`.

| emitter | event | when, and what it carries |
| --- | --- | --- |
| `StageRenderer` | `OnStageAdded`, `OnStageRemoved` | at the parent, with `{stage, renderer}` |
| `StageRenderer` | `OnAddToParent`, `OnRemoveFromParent` | at the child, when its `parent` changes |
| `StageRenderer`, `Stage2D` | `OnStageDispose` | once, from `dispose()` |
| `Stage2D` | `OnStageResize` | a new view: `{stage, width, height}` |
| `Stage2D` | `OnStageFirstFrame` | the first frame with a camera; kept for late subscribers |
| `Stage2D` | `OnStageUpdateFrame` | every frame with a camera: `{stage, now, deltaTime, frameNo}` |
| `Stage2D` | `OnStageAfterCameraChanged` | a new camera, with the stage and the camera it replaced |
| `Stage2D` | `OnStageAfterSceneChanged` | a new `scene`, with the stage and the scene it replaced |
| `Canvas2DStage` | `OnCanvas2DStageResize` | from `render()`, when the canvas has a new size, the first `render()` included |
| `Canvas2DStage` | `OnCanvas2DStageRender` | from every `render()`, before the upload: draw here |
| `Canvas2DStage` | `OnCanvas2DStageDispose` | once, from `dispose()` |

`OnStageUpdateFrame` hands every frame the same props object, rewritten: copy what you need to
keep.

A listener that throws:

- in `OnStageUpdateFrame` or `OnCanvas2DStageRender` ends the frame for the listeners behind it;
  a throw in `OnCanvas2DStageRender` also keeps the canvas from being uploaded and drawn;
- in every other event, does not cut the call short: every listener hears the event, the call
  that sent it runs to its end — the stage has its new camera, scene or size, the renderer its
  new stage or holder — and the error reaches the caller afterwards, one unchanged, several as an
  `AggregateError`.

One exception to the second rule: a `Stage2D` applies a pending `needsUpdate` at the start of its
`updateFrame()`, and a listener of `OnStageAfterCameraChanged` or `OnStageResize` that throws
there ends the frame. The new camera and size stand and every listener has heard of them, but
neither `OnStageFirstFrame` nor `OnStageUpdateFrame` goes out in that frame, and the error comes
out of `updateFrame()`. A `StageRenderer` on a host then updates none of the stages behind it and
draws nothing in that frame; the first frame comes with the next call.

## Who disposes what

What you build and hand in stays yours; what a class builds for itself, its `dispose()`
releases. The general rules are in [resource lifecycle](resource-lifecycle.md).

| | releases in `dispose()` | leaves to you |
| --- | --- | --- |
| `Stage2D` | its pass node and the render target behind it | the scene, the camera, the projection |
| `StageRenderer` | the render targets it built for itself; it leaves its holder and drops its stages | the stages, `pipeline`, `outputRenderTarget`, `internalTargetPool`, a builder in `buildOutputNode` |
| `Canvas2DStage` | the sprite material and textures it built, its `StageRenderer` and its `Stage2D` | the `WebGPURenderer`, a canvas handed in, a material you set on the sprite |
| `StageRenderTargetPool` | every target back in the pool, every lent one as it comes back | — |
| a builder of `createBloomOutputNodeBuilder()` | the bloom node it built last | the pass nodes, which belong to the stages |
| `StageDirector` | as a `StageRenderer`, and the pipelines it built, the renderers it wrapped stages in, the nodes of its effects and the texture nodes of its masks; it ends every running transition as cancelled | the stages, the effects, a mask of `lumaMask()`, the mask stages, the `StageMask` objects an effect names |
| `StageMask` | lets go of its stage | the stage, which stays undisposed |
| `Display` | its `WebGPURenderer` | a canvas handed in |

The order of a teardown: the renderer first, then what it used.

```ts
sr.dispose(); // lets go of the stages, the pipeline and the builder
stage.dispose();
withBloom.dispose();
pipeline.dispose();
```

- A replaced `pipeline`, `outputRenderTarget`, `internalTargetPool` or builder is yours to
  dispose; so is the current one once no renderer uses it.
- Take a builder off its renderer — `buildOutputNode = undefined`, or dispose the renderer —
  before you dispose it: a renderer refuses a disposed builder and throws on its next rebuild with
  one it still holds. The same goes for a disposed pool.
- After `dispose()` a `StageRenderer` neither draws nor clears, `asPassNode()` throws, and a write
  to `pipeline`, `buildOutputNode` or `internalTargetPool` is ignored; another renderer refuses it
  as a child or a parent. A disposed `Stage2D` ignores `resize()`, `updateFrame()`, `renderTo()` and
  writes to `projection` and `camera`, and `asPassNode()` throws.
- A renderer that leaves the composed mode, or a stage that leaves a renderer, releases the GPU
  memory of the targets behind the pass nodes, but keeps the nodes: three.js allocates the memory
  again on the next draw that needs it.

## Pitfalls

- **Two frame loops.** A renderer with a host that you also call `renderTo()` on draws every frame
  twice.
- **A stage without a camera.** Nothing appears before the first `resize()` with an area — see
  [when the stage draws nothing](#when-the-stage-draws-nothing). A new projection drops the
  camera of the old one; a camera you assigned stays, and the new projection places it.
- **The camera jumps back.** The projection places the camera on every resize; moves of your own
  go into `OnStageUpdateFrame` — see [a camera that follows](#a-camera-that-follows).
- **Specs written, nothing happens.** A write to the specs needs `stage.needsUpdate = true`.
- **Clipped layers under an orthographic projection.** The camera sits `distanceToProjectionPlane`
  in front of the plane; a layer closer to it than `near` is not drawn.
- **Shared names in `renderOrder`.** Stages that share a listed name draw together at its
  position, and the renderer warns. Give them names of their own.
- **`ClearStage` under a composing pipeline.** Refused with a `TypeError`; it belongs to layers
  without a pipeline and to the whole-picture mode.
- **Mixed writers on the canvas.** One pipeline at the top composes everything — see
  [one writer per canvas](#one-writer-per-canvas).
- **Disposing a stage a renderer still holds.** A stage of your own without `OnStageDispose` goes
  out with `remove(stage)` first. A renderer that still lists it keeps its released pass node in
  the composition and throws on its next rebuild, in the middle of the frame loop. A `Stage2D`
  and a nested `StageRenderer` take care of this themselves.
- **One builder for two renderers.** Each rebuild of one releases the bloom of the other. One
  builder per renderer.
- **A layer that hides the stack below.** An effect that writes an alpha of 1 everywhere — the
  `bloom()` of three.js does — makes its layer opaque in a `StageDirector`. Keep the alpha of the
  layer and add the glow to its color: `vec4(composed.rgb.add(glow.rgb), composed.a)`.
- **A stage that is a layer and a mask.** A director refuses it either way round, and so does a
  second director for a mask stage; give the mask its own stage.
- **Masks after `setStack()`.** It makes new slots and drops every mask: set them again.
- **A new effect object per transition.** Each one builds a shader on its first use, and a shape
  compiled with one effect object does not match a transition with another. Make the effects once
  and reuse them — in `precompile()` and in the transitions.

## Cheat sheet

### The classes

| class | role |
| --- | --- |
| `Display` | owns the `WebGPURenderer` and its canvas, drives the frame loop, measures the size — [display](display.md) |
| `Stage2D` | a `THREE.Scene` and a camera built by a projection; `IStage + IRenderable + IPassProvider` |
| `StageRenderer` | a list of stages with order, clear and optional pipeline; a stage itself, so it nests |
| `OrthographicProjection` | a view without depth: everything as large as on the plane |
| `ParallaxProjection` | a view with depth: `getScaleFactor()`, `getParallaxFactor()` |
| `ProjectionPlane` | the plane a camera looks at, four descriptions or a plane of your own |
| `ClearStage` | clears depth (by default), color or stencil between two stages |
| `Canvas2DStage` | a 2D canvas on a sprite in a stage of its own |
| `RootRenderPipeline` | a `RenderPipeline` that adds up the passes of the stages |
| `StageRenderTargetPool` | one internal target for several renderers in the whole-picture mode |
| `createBloomOutputNodeBuilder()` | a ready-made `buildOutputNode`: the sum of the passes with a bloom on top |
| `StageDirector` | a stack of layers, changed through transitions — `show`, `hide`, `replace`, `push`, `pop`; `setMask()` masks a slot by a stage; `precompile()` builds the shaders of its shapes and draws layers once ahead |
| `StageTransition` | one change of the stack: `state`, `progress`, `finished`, `complete()`, `cancel()`, `reverse()` |
| `crossfade()`, `fade()`, `dipToColor()`, `wipe()`, `slide()`, `iris()`, `dissolve()`, `lumaMask()`, `pixelate()`, `matte()` | the transition effects; `matte()` is the one through a stage that lives |
| `createTransitionNode()` | the node of an effect, for a `buildOutputNode` of your own |
| `StageMask` | a stage bound as a mask: its picture says how much of a slot shows — `source`, `invert`; `setMask()`, `maskOf()` and the `mask` option of a `StageDirector`; `progress` and `progressNode` follow the transition whose effect names it (`masks`, `input.mask()`) |
| `createMaskNode()` | the node of a picture times the coverage of a mask, for a `buildOutputNode` of your own |
| `fitIntoRectangle()` | the arithmetic of the fit, for a layout of your own; `calculateAnchorOffset()` places the result in a container |

### The interfaces

| interface | members | for |
| --- | --- | --- |
| `IStage` | `name`, `resize(w, h, pixelRatio?)`, `updateFrame(now, dt, frameNo)` | anything a `StageRenderer` sizes and ticks |
| `IRenderable` | `renderTo(renderer)` | anything a `StageRenderer` draws |
| `IPassProvider` | `asPassNode(renderer)` | a stage under a composing pipeline |
| `IProjection` | `updateViewRect()`, `getViewRect()`, `projectionPlane`, `getScaleFactor()`, `createCamera()`, `updateCamera()` | a projection of your own for a `Stage2D` |
| `IStageRendererHost` | `onResize`, `onRenderFrame`, `isDisposed?` | the frame loop that drives a `StageRenderer` |

### The modes

| mode | set up as | the picture |
| --- | --- | --- |
| layers | no `pipeline` | every stage straight into the target, one over the other |
| whole picture | `pipeline` = a `RenderPipeline`, no `buildOutputNode` | all stages into one internal target, the pipeline on its texture |
| composed | `pipeline` + `buildOutputNode`, or a `RootRenderPipeline` | one pass per stage, composed in TSL |
| nested pipelines | nested renderers with a pipeline each, under a composing parent | an effect per layer, composed once at the top |
| a stack of layers | a `StageDirector` | every layer into a target of its own, the slots composed bottom to top with their transitions |

### The defaults

| setting | default |
| --- | --- |
| projection specs | `{fit: 'fill'}` |
| `distanceToProjectionPlane` | `100` orthographic, `300` parallax |
| `near`, `far` | `0.1`, `100000` |
| `StageRenderer#clear` | `false` |
| `StageRenderer#clearAlpha` | `1` |
| `clearColorBuffer`, `clearDepthBuffer`, `clearStencilBuffer` | `true` |
| `StageRenderer#renderOrder` | `'*'`: the order of `add()` |
| `ClearStage` | `{depth: true}`, name `'clear'` |
| `Canvas2DStage` fit | `'contain'` |
| `createBloomOutputNodeBuilder()` | `strength: 1`, `radius: 0`, `threshold: 0` |
| `StageMask` | `source: 'alpha'`, `invert: false` |
| `matte()` | `mode: 'coverage'`, `softness: 0.05` (`'threshold'` only) |
| a transition of `StageDirector` | `crossfade()`, `0.5` s with an effect and `0` without, `'ease-in-out'`, no delay |
| `outgoing`, `incoming`, `below` | `'run'` |
