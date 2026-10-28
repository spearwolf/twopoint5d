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
  // the point in the world, on the projection plane
  const point = projection.projectionPlane!.getPoint(x, y);
  // a camera moved along the plane moves the point with it
  point.add(stage.camera!.position).sub(projection.projectionPlane!.getPointByDistance(100));
});

display.start();
```

`getPointByDistance(100)` is where the projection put the camera — `100` is the default
distance of an `OrthographicProjection`. Under a `ParallaxProjection` the result is the point on
the projection plane under the pointer; a layer in front of or behind it lies elsewhere.

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
renderers included: `resize(width, height, pixelRatio)`. A stage that refuses the size — whose
`resize()` throws — is not added, and the renderer and the stage stay as they were.

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
