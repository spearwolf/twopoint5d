# Art layers on a stage

Painted scenes, a kitchen out of an Aseprite file, a machine packed from the layers of a paint tool:
each layer of the artwork becomes a quad in the plane of a stage, at the pixel position it was
painted at, and moves, turns, fades and changes its frame by a pose. All the layers of one art are
one `FeatureSprites`, drawn in one draw call. This guide starts with what you want to do, goes on
to a cheat sheet of the sources, the fields and the options, and ends with the reference.

- [Scenarios](#scenarios)
  - [A scene out of an Aseprite file](#a-scene-out-of-an-aseprite-file)
  - [A scene out of layer PNGs](#a-scene-out-of-layer-pngs)
  - [A scene out of a packed atlas](#a-scene-out-of-a-packed-atlas)
  - [Loose props](#loose-props)
  - [Moving a layer](#moving-a-layer)
  - [A timeline with a scrubber](#a-timeline-with-a-scrubber)
  - [A strip of steam](#a-strip-of-steam)
  - [A painted scene made deep](#a-painted-scene-made-deep)
  - [Art on a `top-left` stage](#art-on-a-top-left-stage)
  - [Drawing on demand](#drawing-on-demand)
  - [A click on a layer](#a-click-on-a-layer)
  - [A pestle in a circle](#a-pestle-in-a-circle)
  - [Reloading a sheet while the page runs](#reloading-a-sheet-while-the-page-runs)
- [Cheat sheet](#cheat-sheet)
- [Reference](#reference)

## Scenarios

### A scene out of an Aseprite file

Paint the scene in Aseprite with one layer per moving part, and export it as one sheet split by
layers:

```sh
aseprite -b --split-layers --trim --ignore-empty kitchen.aseprite \
  --sheet kitchen.png --data kitchen.json --format json-array \
  --filename-format '{layer}#{frame}' --list-layers --list-tags --list-slices
```

`--split-layers` stands **before** the file: Aseprite applies it to the files it opens after it,
and written after `kitchen.aseprite` it splits nothing. `--ignore-empty` leaves the cels without a
pixel out of the sheet, and `--filename-format '{layer}#{frame}'` names every picture after its
layer and frame — the names the art reads. Then name the sheet in the catalog of a
`TextureStore` and hand the item to the art:

```ts check
import {OrthographicProjection, Stage2D, StageArt, TextureStore} from '@spearwolf/twopoint5d';
import {WebGPURenderer} from 'three/webgpu';

const renderer = new WebGPURenderer();
await renderer.init();

const store = new TextureStore(renderer);
store.parse({items: {kitchen: {atlasUrl: '/assets/kitchen.json', atlasAdapter: 'aseprite'}}});

const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 320, height: 180}));
const art = new StageArt({store, id: 'kitchen'}, {name: 'kitchen', projection: stage.projection});
stage.scene.add(art); // at once: the layers show as their pictures arrive

await art.loaded;
art.names; // ['wall', 'window', 'table', 'carafe5', 'ladle', 'steam'], bottom first

export {art};
```

The file is the layout. No code describes a layer:

| the art reads | from |
| --- | --- |
| the layers and their stacking order, bottom first | `meta.layers`; a layer in a group by its plain name, a group is no layer |
| where each layer lies on the canvas | the trim of its cels; a layer whose cels differ in size takes the box around all of them |
| the frames of a layer | the cels `{layer}#{n}`, frame `n` of the sprite; an empty cel shows nothing |
| the point a layer turns about | the pivot of a slice named like the layer — the bottom left corner of the pixel it marks —, else the middle of its box |
| the depth of a layer | `depth=600` in the user data of the layer, else of the nearest group around it that has one |
| the tags | `meta.frameTags`, for every layer, with their direction and the durations of their frames |

The art lies in the plane of the projection of the stage, the middle of the canvas on the origin of
the art. One artwork pixel is one unit of the stage; `pxPerUnit: 2` draws two artwork pixels per
unit ([from artwork pixels to units](#from-artwork-pixels-to-units)).

A layer is hidden until its picture is there: no grey quad flashes up while the sheet loads. A
`{store, id}` source and a promise of one know their layers only once they have loaded — until
then `art.names` is empty and `art.layer()` throws. Name the layers in `only`, and they are there at
once: you can pose them right away, and a pose set before the picture arrives shows when it does.
What the art cannot read — a name in `only` the sheet lacks, a depth that is no number, a pivot
slice that names no layer, a sheet exported without `{layer}#{frame}` names or with
`--split-layers` after the file — is no error: it hides that one layer or leaves that one thing
out, goes into `art.problems` and is said once on the console ([the list](#loaded-and-problems)).

The lookbook demo *stage art: one Aseprite file* is a vending machine of 26 layers read this way,
with no layer named in its code.

### A scene out of layer PNGs

Photoshop ("Export Layers to Files"), Krita ("Export Layers"), GIMP, Affinity and Procreate export
each layer as one PNG of the whole canvas, transparent around its picture. That is the layout
already; hand the art the list of the files, bottom first:

```ts check
import {OrthographicProjection, Stage2D, StageArt} from '@spearwolf/twopoint5d';
import {WebGPURenderer} from 'three/webgpu';

const renderer = new WebGPURenderer();
await renderer.init();

const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 320, height: 180}));
const art = new StageArt(
  {
    baseUrl: '/assets/kitchen/',
    files: ['window@600.png', 'table.png', 'carafe5.png', 'carafe5.pivot.png', 'carafe5-empty.png', 'steam.png'],
  },
  {name: 'kitchen', projection: stage.projection, renderer},
);
stage.scene.add(art);

art.names; // ['window', 'table', 'carafe5', 'steam'] — at once, out of the list
art.set('carafe5', {deg: -8}); // posed before its picture is there; it shows so once it is

await art.loaded;
art.layer('carafe5').box; // {x, y, w, h}: where its picture lies on the canvas

export {art};
```

The order of the list is the stacking order — the one thing a folder of PNGs does not keep. A layer
is named after its file without the extension, and the rest of the name says what the file is:

| file | is |
| --- | --- |
| `table.png`, `carafe5.png` | a layer of that name |
| `carafe5-empty.png` | another frame of `carafe5`, listed after `carafe5.png`: the file of the layer is frame 0, its `-suffix` files follow in the order of the list. Listed before it, `carafe5-empty.png` is a layer of its own |
| `steam#0.png` … `steam#7.png` | the frames of `steam`, by number. The `#` goes out as `%23`, which not every server maps back — the Vite dev server answers 404 —: name such a strip `steam.png`, `steam-1.png` … `steam-7.png` in this order, or serve it from a server that decodes `%23` |
| `window@600.png`, `wall@-40.png` | the layer `window` at a depth of 600, `wall` 40 in front of the plane |
| `carafe5.pivot.png` | no picture: one dot on a layer of its own, exported with the others — the middle of the dot is the pivot of `carafe5` |

A pivot painted into the picture moves with the picture: shift the carafe in the paint tool, export
again, and it still turns about the same point of its glass. A layer renamed in the paint tool keeps
its depth with its name.

The art fetches every file at once, one request each, decodes it and trims it to the box of its
pixels with an alpha above 0 — the place of that box on the canvas is the place of the layer. It
packs the boxes into an atlas of its own, the next power of two that holds them with room for linear
filtering, up to the largest texture the device of `renderer` allows; without a `renderer` the atlas
goes up to 4096 × 4096. The canvas is the size of the files. The layers know their names at once,
from the list, and show their pictures once every file has arrived or failed.

A file that does not load, is no image or has a size other than the first file that loaded leaves
its layer without that picture — a layer of that file alone stays hidden, one of more frames shows
the others — and goes into `art.problems` with its `url`; the rest of the scene goes on. Pictures
that do not fit into the largest atlas allowed are one problem of the source that names the size:
split the files between two arts, each with a `renderOrder` of its own (`docs/sprites.md`, "Across
meshes"). `only` and `layers` work on the layers of the files as on those of an atlas, and a
`frames` override names files by their names without the extension.

### A scene out of a packed atlas

A paint tool exports one PNG of the whole canvas per layer; a packer with trimming — TexturePacker,
free-tex-packer — puts them into one sheet and keeps where each picture lay on the canvas. The art
reads that as it reads an Aseprite sheet, by the names of the pictures:

| file name | is |
| --- | --- |
| `table`, `carafe5` | a layer of that name |
| `carafe5-empty` | another frame of `carafe5`, after it |
| `steam#0` … `steam#7` | the frames of `steam`, by number |
| `window@600`, `wall@-40` | the layer `window` at a depth of 600, `wall` 40 in front of the plane |
| `carafe5.pivot` | no picture: the middle of its dot is the pivot of `carafe5` |

A packer writes its frames in the order it packed them, not in the order of the paint file. Without
`only` the layers stack in the order of their first frames in the json, so a packed atlas names its
stacking order with `only`, bottom first:

```ts check
import {StageArt, TextureStore} from '@spearwolf/twopoint5d';

declare const store: TextureStore; // with the renderer, as above

store.parse({items: {kitchen: {atlasUrl: '/assets/kitchen-packed.json'}}});

const art = new StageArt(
  {store, id: 'kitchen'},
  {
    only: ['wall', 'window', 'table', 'carafe5', 'ladle', 'steam'], // these layers, bottom first
    layers: {carafe5: {pivot: [109, 122]}}, // what the picture cannot say, in artwork pixels
  },
);

export {art};
```

A name in `only` that the atlas does not have stays in the art as a hidden layer — it can be posed
like any other — and in `art.problems`, so a layer renamed in the paint tool shows up instead of
going missing. `layers` holds what code says about a layer the picture cannot: `pivot`, `depth`,
`order`, `frames` (a list of frame names, or a `RegExp`, for an atlas named otherwise) and `rest`,
a pose to start in. An override beats the file ([the options of a
layer](#the-options-of-a-layer)).

The lookbook demo *stage art: the listening machine* is a brass machine rendered part by part and
packed by free-tex-packer, its stack named in `only` and its pivots in `.pivot` frames.

### Loose props

Props that were never painted together — a carafe, a ladle, a strip of steam out of an atlas of
the game — take a short list instead of a canvas: the frames of each layer, the pixel of its first
frame it turns about, and where that pixel stands.

```ts check
import {StageArt, type TextureAtlas} from '@spearwolf/twopoint5d';
import type {Texture} from 'three/webgpu';

declare const atlas: TextureAtlas; // the atlas of the props, loaded
declare const texture: Texture; // and its texture

const props = new StageArt(
  {
    atlas,
    texture,
    layers: [
      {name: 'carafe5', frames: ['carafe5', 'carafe5-empty'], pivot: [17, 51], at: [120, -40]},
      {name: 'steam', frames: /^steam#/, at: [124, -96], order: 1},
    ],
  },
  {pxPerUnit: 2},
);

export {props};
```

`pivot` is in pixels of the first frame as it was before the packer trimmed it, its middle without
one; `at` is where it stands at rest, in artwork pixels of a canvas without a picture, whose origin
`[0, 0]` lies on the origin of the art. A layer without `frames` takes the frame of its name. A
`RegExp` takes the frames it matches in the natural order of their names, `steam#10` after
`steam#9`. The list is the stacking order, bottom first; `only` and `layers` do not go with it. A
store item takes a list as well: `{store, id, layers: [...]}`.

### Moving a layer

A pose is in the units of the paint tool: `x` and `y` are where the pivot stands, in artwork pixels
of the canvas, `deg` turns clockwise about the pivot, `frame` picks a picture of the layer. A pose
writes the fields it is given and keeps the rest.

![Two panels of the same layer. Left, the canvas of 320 × 180 artwork pixels, the origin (0, 0) at
the top left, x to the right and y down, the origin of the art in its middle at (160, 90); the
layer's pivot at (220, 60), the layer turned 30 degrees clockwise. Right, the art frame in units
at pxPerUnit 2, x to the right and y up, +z towards the camera; the pivot at (30, 15), the turn
−π/6 about +z. Below, the formulas of the mapping](images/stage-art/stage-art-mapping.svg)

```ts check
import {type ArtPose, StageArt} from '@spearwolf/twopoint5d';

declare const art: StageArt;

const carafe = art.layer('carafe5'); // the handle: keep it, a hot loop needs no look-up
carafe.set({x: 412, y: 380, deg: 35, frame: 1});
art.set('steam', {opacity: 0.5}); // the same, by name

// in a frame loop, one pose of your own, written again: no object per frame
const pose: ArtPose = {x: 0};
function follow(pointerX: number): void {
  pose.x = Math.round(pointerX);
  carafe.set(pose);
}

carafe.reset(); // back to the pose of the layout — carafe.rest holds it
art.reset(); // every layer

export {follow};
```

Call `art.update()` once per frame, after the stage's `updateFrame()` and before the render: it
puts the layers back to front where a depth or an `order` changed, and uploads what was written
([why after the stage's frame](#depth-under-a-parallax-camera)). The poses you set are checked as
the library checks input: a field that is no finite number, an `opacity` outside 0 … 1, a `frame`
that is no index into the frames of the layer, an `order` outside −1024 … 1023 and a key that is no
field of a pose (`rotation` for `deg`) throw and name the layer and the field, and the layer keeps
what it had.

A track does the same along time — `art.apply(name, track, seconds)` samples it into the layer, see
[a timeline with a scrubber](#a-timeline-with-a-scrubber).

**The stack.** Layers are drawn back to front: the deepest first, then by `order` among layers of
one depth, then as painted. `order: 1` puts a layer above the others of its depth. A layer painted
above another but given a greater `depth` goes under it, and the art says so on the console once
per layer, since the picture at rest then differs from the painting.

### A timeline with a scrubber

A track is a timeline of poses: `artTrack(keys, options?)` takes keys with an `at` in seconds and
any fields of a pose, and `sample(seconds, pose)` writes the pose the track shows at that time.
It depends on the time alone, so a slider, a replay and a test show the same picture for the same
time.

```ts check
import {type ArtPose, artTrack} from '@spearwolf/twopoint5d';

const tilt = artTrack(
  [
    {at: 0, x: 412, y: 380, deg: 0, frame: 0},
    {at: 0.6, deg: 35, ease: 'ease-out'}, // x and y hold
    {at: 1.4, deg: 95, frame: 1}, // the carafe empties as it pours
    {at: 2.2, deg: 0, frame: 1},
  ],
  {ease: 'ease-in-out'}, // the ease of every key without one of its own
);

// a scrubber from 0 to 1 drives the time; the pose is one object, written again on every move
const pose: ArtPose = {};

function onScrub(value: number): ArtPose {
  return tilt.sample(value * tilt.duration, pose);
}

onScrub(0); // {x: 412, y: 380, deg: 0, frame: 0 ...}: the first key, as before it
onScrub(0.5); // between the second and the third key
onScrub(1); // the last key, and so for any time after it

export {onScrub};
```

A key holds what it leaves out: `{at: 0.6, deg: 35}` turns the carafe and keeps it where it
stands. A field the first key leaves out is not part of the track, and `sample()` leaves it alone
on the pose — so two tracks that write different fields, one moves, one fades, run on one layer.
`x`, `y`, `depth`, `deg`, the scales and `opacity` blend; `frame`, `visible` and `order` change at
their key. A track `'once'` holds its last key; `playback: 'loop'` and `'pingpong'` run on.
[Tracks](#tracks) in the reference has every rule and what `artTrack()` refuses.

To play a track from a click, keep the time of the click and hand the art the time since:
`art.apply('carafe5', tilt, now - clickedAt)`. A second click overtakes the first by setting
`clickedAt` anew; nothing is cancelled. For a value that eases once and needs no track,
`rampAt(seconds, start, duration, ease?)` answers the share of a ramp, from 0 to 1:

```ts check
import {rampAt} from '@spearwolf/twopoint5d';

// a panel fades in over 0.4 seconds after the click at `clickedAt`
function opacityAt(now: number, clickedAt: number): number {
  return rampAt(now, clickedAt, 0.4, 'ease-out');
}

opacityAt(10, 10); // 0
opacityAt(10.2, 10); // between 0 and 1
opacityAt(11, 10); // 1

export {opacityAt};
```

The lookbook demo *stage art: the listening machine* runs four tracks and a ramp on one timeline,
with a slider that runs the machine backwards.

### A strip of steam

A tag of the sheet — Aseprite's `puff`, with its direction and the duration of each frame — plays
on a layer through `layer.frameAt(tag, seconds)`: the frame the tag shows that many seconds into
it, ready for `set({frame})`.

```ts check
import {type ArtPose, StageArt} from '@spearwolf/twopoint5d';

declare const art: StageArt;

const steam = art.layer('steam');
steam.tags; // ['puff']

const pose: ArtPose = {frame: 0};
function animateSteam(now: number): boolean {
  pose.frame = steam.frameAt('puff', now);
  steam.set(pose);
  return art.takeChanged(); // true only in the frames the picture of the steam changed
}

export {animateSteam};
```

A frame the layer shows already is no change: a strip at 8 frames a second keeps its frame for seven
of every eight frames at 60, and `takeChanged()` answers `false` for them. A tag the layer does not
have throws and lists the tags it has. A strip out of a packed atlas, which carries no tags, steps
through its frames with `animationFrameAt()`, the same function over a timing of your own
([frames at a time](#frames-at-a-time)).

### A painted scene made deep

Give the layers of a scene depths, put it on a stage with a `ParallaxProjection`, and the art turns
it into a multiplane camera: at its rest the camera sees the scene exactly as painted, and once it
moves the layers part — the far ones drift slowly, the near ones pass fast in front.

```ts check
import {on} from '@spearwolf/eventize';
import {
  CameraRig,
  Display,
  OnStageUpdateFrame,
  ParallaxProjection,
  Stage2D,
  StageArt,
  StageRenderer,
  TextureStore,
} from '@spearwolf/twopoint5d';

const canvas = document.querySelector('canvas')!;
const display = new Display(canvas);
const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640, height: 360}));
const store = new TextureStore(display.renderer);
store.parse({items: {kitchen: {atlasUrl: '/assets/kitchen.json', atlasAdapter: 'aseprite'}}});
const art = new StageArt(
  {store, id: 'kitchen'},
  {
    projection: stage.projection,
    only: ['wall', 'window', 'table', 'carafe5', 'ladle', 'steam'],
    // far behind the plane, still where it was painted at rest; the table stays on the plane
    layers: {wall: {depth: 900}, window: {depth: 600}},
  },
);
stage.scene.add(art);
art.set('steam', {depth: -80}); // in front of the plane

const rig = new CameraRig(stage);
display.onRenderFrame(({deltaTime}) => rig.step(deltaTime));
// in the frame of the stage, after its projection placed the camera and before the draw: reads
// the distance of the camera, then sorts and uploads
on(stage, OnStageUpdateFrame, () => art.update());
new StageRenderer(display).add(stage);

// the camera walks along the plane: the wall drifts, the steam passes in front
canvas.addEventListener('click', () => void rig.moveTo({position: [120, 0]}, 1.5));

display.start();
```

`depth` is in artwork pixels behind the plane, below 0 in front of it — `depth=600` in the user
data of an Aseprite layer, `@600` in the frame name of a packed atlas, `layers: {window: {depth:
600}}` in code, or `set({depth})` at any time. The art draws a layer at its depth and enlarges it
about the **focus** — the point the camera looks at in its rest, the origin of the art by default —
by exactly what the perspective takes away: with `D` the distance of the camera to the plane and `δ`
the depth in units, by `k = (D + δ) / D`. A layer at a depth of `D` behind the plane is drawn twice
as large and seen at its painted size; a layer in front of the plane is drawn smaller.

![A side view: the camera at rest on the left, the plane at the distance D = 250, its focus on the
axis of the camera. A layer at a depth of 125 behind the plane is drawn 1.5 times as large and as
far from the focus, so the rays from the camera through its ends pass through the ends of the
layer as painted on the plane; the same layer uncompensated keeps its painted size and is seen
smaller and nearer the focus. A layer at a depth of −100 is drawn at 0.6 of its size. A depth at or
behind the camera is refused](images/stage-art/stage-art-depth-compensation.svg)

`update()` reads `D` from the projection, so it runs after the stage's frame, in which the projection
works the distance out, and before the draw: in a listener of `OnStageUpdateFrame` where a
`StageRenderer` runs on the display, as above, or after `sr.updateFrame()` in a frame loop of your
own. A move, a look and a zoom of a `CameraRig` leave `D` alone: they take the camera away from the
rest the scene was composed for, and that is what parts the layers.

To change `D` while the scene runs, write it into the specs of the projection and let the stage
take it in its next frame — `projection.viewSpecs.distanceToProjectionPlane = 900` and
`stage.needsUpdate = true` (and a `frames.invalidate()` under a `FramePacer`). At rest the picture
stays the painting; once the camera moves, the planes part more for a camera close to the plane and
less for one far from it. [Depth under a parallax camera](#depth-under-a-parallax-camera) has the
focus, the projections that draw depth uncompensated and the limit of a depth in front of the
plane.

The lookbook demo *stage art: the drowned platform* is a flooded station painted in planes: the
pointer moves the camera through a `CameraRig`, a train's light is dollied through `depth` on a
track, and toggles turn the compensation off, swap in an `OrthographicProjection` and change `D`.

### Art on a `top-left` stage

A stage of canvas coordinates — `'xy|top-left'`, `y` down as in the paint tool — takes a painted
scene as it is. The art turns its mesh into the plane of the projection, so the scene shows upright
and unmirrored, turns clockwise for a positive `deg` and faces the camera without `Flip` or
`side: DoubleSide`:

```ts check
import {on} from '@spearwolf/eventize';
import {
  Display,
  OnStageUpdateFrame,
  OrthographicProjection,
  Stage2D,
  StageArt,
  StageRenderer,
  TextureStore,
} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('canvas')!);
const projection = new OrthographicProjection('xy|top-left', {fit: 'contain', width: 320, height: 180});
const stage = new Stage2D(projection);
new StageRenderer(display).add(stage);

const store = new TextureStore(display.renderer);
store.parse({items: {kitchen: {atlasUrl: '/assets/kitchen.json', atlasAdapter: 'aseprite'}}});
const art = new StageArt({store, id: 'kitchen'}, {projection});
stage.scene.add(art);
art.plane === projection.projectionPlane; // true: the art lies in the plane of its projection

on(stage, OnStageUpdateFrame, () => art.update()); // after the stage's frame, before the draw
display.start();
```

Poses stay in artwork pixels on every plane: `x` and `y` are where the pivot stands on the canvas,
`y` down, and `depth` points away from the camera. The plane changes nothing of them, only where
the art lies in the world. The `xz` planes and a `ProjectionPlane` of your own work the same way
([the plane](#the-plane)). Move, turn or scale the art itself as any object: the turn of the mesh
inside it is the art's own.

### Drawing on demand

`art.takeChanged()` answers whether the picture of the art changed since its last call, and is the
frame step of a [`FramePacer`](display.md#drawing-on-demand) as it stands: the step poses the
layers and answers.

```ts check
import {
  artTrack,
  Display,
  FramePacer,
  OrthographicProjection,
  Stage2D,
  StageArt,
  StageRenderer,
  TextureStore,
} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('canvas')!);
const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 320, height: 180}));
const sr = new StageRenderer().add(stage); // no host

const store = new TextureStore(display.renderer);
store.parse({items: {kitchen: {atlasUrl: '/assets/kitchen.json', atlasAdapter: 'aseprite'}}});
const art = new StageArt({store, id: 'kitchen'}, {projection: stage.projection});
stage.scene.add(art);

const pour = artTrack([
  {at: 0, deg: 0},
  {at: 1.2, deg: 95, ease: 'ease-out'},
]);
let pouredAt: number | undefined; // no pour before the first click
document.querySelector('canvas')!.addEventListener('click', () => {
  pouredAt = display.now;
});

const frames = new FramePacer(display);
const steam = {frame: 0};
frames.onFrame(({now}) => {
  // a track takes a finite time: 0, the first key, until the click
  art.apply('carafe5', pour, pouredAt === undefined ? 0 : now - pouredAt);
  steam.frame = art.layer('steam').frameAt('puff', now);
  art.set('steam', steam);
  return art.takeChanged();
}, stage);

display.onRenderFrame((frame) => {
  sr.resize(frame.width, frame.height, frame.pixelRatio);
  sr.updateFrame(frame.now, frame.deltaTime, frame.frameNo);
  if (frames.shouldDraw(frame)) {
    art.update();
    sr.renderTo(frame.renderer);
  }
});

display.start();

export {frames};
```

A value set again, a frame a strip keeps and a hidden layer that moves answer `false`: a still
scene costs no draw, and a strip of steam at 8 frames a second draws 8 frames a second. The step
writes and answers in one, so the pacer hears of every pose the step sets. A write through
`layer.sprite` goes past the art; report it to the pacer yourself (`frames.report(true)`). A camera
that moves is the business of its rig, whose `step()` answers for it. [`takeChanged()` in the
reference](#drawing-on-demand-takechanged) lists every change it answers `true` for.

### A click on a layer

`art.mesh` is a `FeatureSprites`, so a [`SpritePicker`](sprites.md#picking-which-sprite-is-under-the-pointer)
takes it as it is, and `art.layerOf(hit.sprite)` turns the sprite of the answer into the layer. The pick
is pixel-exact: a click into the transparent part of a carafe lands on the table behind it, and a
layer that is hidden or faded out to `opacity: 0` is never hit. Of layers at different depths the
nearest wins, as on the screen.

A feature the art does not bring itself goes in through `features`: `Flash` lights the layer under
the pointer. Its values are written through `layer.sprite`, whose type carries the api of the
features you handed in: `layer.sprite.setFlash(1, 1, 1, 0.6)` needs no cast.

```ts check
import {
  type ArtLayer,
  Flash,
  type FlashApi,
  type FramePacer,
  SpritePicker,
  StageArt,
  type TextureStore,
} from '@spearwolf/twopoint5d';
import type {Camera, WebGPURenderer} from 'three/webgpu';

declare const renderer: WebGPURenderer;
declare const camera: Camera;
declare const store: TextureStore;
declare const frames: FramePacer;

const art = new StageArt({store, id: 'kitchen'}, {features: [Flash]});
const picker = new SpritePicker(renderer);

let glowing: ArtLayer<FlashApi>['sprite'] | undefined;

// the pointer in normalized device coordinates of the view of the camera: x and y from -1 to 1, y up
async function hover(pointer: {x: number; y: number}): Promise<string | undefined> {
  const hit = await picker.pick(camera, pointer, [art.mesh]);
  const layer = hit && art.layerOf(hit.sprite); // the layer, or undefined: nothing under the pointer
  const sprite = layer?.sprite; // typed by the features of the art: setFlash() is there
  if (sprite !== glowing) {
    glowing?.setFlash(1, 1, 1, 0);
    sprite?.setFlash(1, 1, 1, 0.6);
    glowing = sprite;
    frames.report(true); // a write through layer.sprite goes past the art: tell the pacer
  }
  return layer?.name; // 'carafe5', say
}

export {hover};
```

A `pick()` answers asynchronously, from the gpu, so it is a tool for a click or a hover, not for
every layer in every frame. The lookbook demo *stage art: one Aseprite file* lights the layer under
the pointer this way and starts a wobble track on the one clicked, where it has a pivot slice.

### A pestle in a circle

A layer that goes round in a circle needs no helper of the library: three lines of trigonometry feed
`x` and `y` of a pose, and the pose is one you keep, so the frame loop allocates nothing. `y` counts
down in artwork pixels, so a sine that grows goes down the screen and the circle runs clockwise.

```ts check
import {type ArtPose, StageArt} from '@spearwolf/twopoint5d';

declare const art: StageArt;

const pestle = art.layer('pestle');
const center = {x: 410, y: 300}; // the middle of the bowl, artwork pixels
const radius = 24;

const pose: ArtPose = {};
function stir(seconds: number): void {
  const angle = seconds * Math.PI * 2; // one turn per second
  pose.x = center.x + radius * Math.cos(angle);
  pose.y = center.y + radius * Math.sin(angle);
  pestle.set(pose);
}

export {stir};
```

Another field of the same layer — `deg` to tilt the pestle with its stroke — goes into the same
pose. A track of `art.apply()` writes the fields it keys, and a `set()` after it writes the ones it
names over them, so the circle and a track of `opacity` run side by side.

### Reloading a sheet while the page runs

An art of a `{store, id}` source follows its store item: parse the item again with a sheet the
artist has just exported, and the running art takes it — no new art, no lost pose. A catalog parsed
again with the same urls changes nothing, so give the new export urls of its own, the json and the
image both:

```ts check
import {StageArt, TextureStore} from '@spearwolf/twopoint5d';

declare const store: TextureStore; // with the renderer, as above

const item = (version: number) => ({
  atlasUrl: `/assets/kitchen.json?v=${version}`,
  overrideImageUrl: `/assets/kitchen.png?v=${version}`,
  atlasAdapter: 'aseprite',
});

store.parse({items: {kitchen: item(1)}});
const art = new StageArt({store, id: 'kitchen'}, {name: 'kitchen'});

// the artist saved and exported the sheet again: a watcher of the dev server calls this
export function reloadKitchen(version: number) {
  store.parse({items: {kitchen: item(version)}});
}

export {art};
```

The sheet is read again with the options the art was made with — `only`, `layers` —, and the
layers take what it says:

- **A layer the new sheet has** gets its new frames, box, pivot, tags and rest — an override of
  `layers` still beats the file. It keeps its handle, its sprite and every field of its pose you set
  off its rest: a carafe you poured stays poured. A field at its rest takes the new rest, so a lamp
  the artist moved in the file moves on the page. A `frame` beyond its new frames is a problem, and
  the layer shows frame 0.
- **A layer the new sheet lacks** stays in the art, posed and hidden, with a problem; an export that
  brings it back shows it again at its pose.
- **A layer new in the sheet** does not join the running art: the layers stay those of the first
  load, and one problem names the new layer. A new `StageArt` takes it.

`art.problems` is then the list of the reload — a list you read before stays as it was —, and a
reload with problems says them once on the console. An image of its own swaps the texture of the
mesh. `takeChanged()` answers `true` once for the swap, so a [`FramePacer`](#drawing-on-demand)
draws it. `loaded` has resolved with the first load and stays so. `dispose()` ends the following.

## Cheat sheet

### Which source

| the artist delivers | the source | code writes |
| --- | --- | --- |
| one Aseprite file, exported split by layers | `{store, id}` of an item with `atlasAdapter: 'aseprite'` | nothing |
| the layers of any paint tool, one full-canvas PNG each | `{files, baseUrl}` | the file names, bottom first |
| the layers of any paint tool, packed into a trimmed atlas | `{store, id}` | the stacking order in `only` |
| props out of any atlas, never painted together | `{store, id, layers: [...]}` or `{atlas, texture, layers: [...]}` | a pivot and a place per layer |
| an atlas you loaded yourself | `{atlas, texture}`, read as one of the above | as above |
| any of these, not at hand yet | a promise of one | as above |

### The fields of a pose

Every field is optional; a pose writes what it is given. The rest is the pose of the layout.

| field | unit | at rest | takes |
| --- | --- | --- | --- |
| `x`, `y` | artwork pixels: where the pivot stands, `y` down | where the pivot was painted | any finite number |
| `depth` | artwork pixels behind the plane; below 0 in front of it | the file's, else 0 | a finite number in front of the camera of a `ParallaxProjection` |
| `deg` | degrees, clockwise about the pivot | 0 | any finite number |
| `scaleX`, `scaleY` | about the pivot, 1 the size of the box | 1 | any finite number |
| `opacity` | 0 … 1; 0 hides the layer | 1 | 0 … 1 |
| `frame` | an index into the frames of the layer | 0 | a whole number below `layer.frameCount` |
| `visible` | shown or hidden | `true` | `true`, `false` |
| `order` | the place among layers of one depth, higher above | 0 | a whole number, −1024 … 1023 |

### The options

| option | default | what it does |
| --- | --- | --- |
| `name` | — | the name messages give the art: `StageArt "kitchen": …` |
| `pxPerUnit` | `1` | artwork pixels per unit of the stage |
| `origin` | the middle of the canvas; `[0, 0]` for loose layers | the point of the canvas on the origin of the art |
| `focus` | `origin` | the point of the canvas the camera looks at in its rest; counts only for the depth under a `ParallaxProjection` |
| `projection` | — | `stage.projection`: the art lies in its plane, and a `ParallaxProjection` compensates depth |
| `plane` | `'xy|bottom-left'` | the plane where the projection has none, or without one; beside a projection with a plane it is ignored, with a warning |
| `compensateDepth` | `true` | whether layers at a depth are drawn as painted at the rest of a parallax camera; `false` for far layers drawn small |
| `only` | every layer, in the order of the source | the layers to take, bottom first; a name the source lacks is a hidden layer. Not with loose layers |
| `layers` | — | by name: what the picture cannot say ([the options of a layer](#the-options-of-a-layer)). Not with loose layers |
| `features` | — | further sprite features for the kind: `Flash`, `Tint`, … — written through `layer.sprite` |
| `material` | `transparent: true`, `depthWrite: false` | the material parameters of the mesh: `depthTest`, `alphaTest`, … |
| `renderer` | — | the renderer of the stage: a `files` source packs its pictures up to the largest texture its device allows, 4096 × 4096 without one |

### The options of a layer

The values of `layers: {name: {…}}` beside an atlas, and the fields of each entry of a list of loose
layers beside its `name`:

| option | what it says | goes |
| --- | --- | --- |
| `pivot` | the point the layer turns about: artwork pixels on the canvas; for a loose layer, pixels of its first frame | always |
| `depth` | artwork pixels behind the plane; beats the file | always |
| `order` | the place among layers of one depth, −1024 … 1023 | always |
| `frames` | frame names or a `RegExp` over the names of the atlas; beside an atlas, a name the source lacks becomes a layer of these frames | always |
| `rest` | a pose the layer starts in, and goes back to on `reset()`, instead of the layout | always |
| `at` | where the pivot stands at rest, artwork pixels of the art; `[0, 0]` by default | loose layers only |
| `pxPerUnit` | artwork pixels per unit for the frames of this layer — its size; its `at` stays in the pixels of the art | loose layers only |

### A frame, in order

1. Pose the layers: `layer.set()`, `layer.apply(track, seconds)`, `set({frame: layer.frameAt(tag,
   seconds)})` — at any time of the frame, as often as you like.
2. `art.update()` after the stage's `updateFrame()` and before the render: the plane, the distance
   of a parallax camera, the stack, the upload.
3. The render. Under a `FramePacer` the poses of step 1 are a frame step that answers
   `art.takeChanged()`, and steps 2 and 3 belong to the frames it draws.

## Reference

### `StageArt`

`new StageArt(source, options?)` is a `Group`: add it to the scene of a stage, move, turn or scale
it as any object. It holds one `FeatureSprites`, `art.mesh`, the layers drawn in one draw call.

| member | |
| --- | --- |
| `mesh` | the `FeatureSprites` of the layers; the art owns it. Hand it to a `SpritePicker` |
| `names` | the layers, bottom first; a list of files names them at once, another source without `only` once it has loaded |
| `canvas` | `{width, height}` of the canvas in artwork pixels; `undefined` for loose layers and before the load |
| `loaded` | resolves once every picture loaded or failed — at once for `{atlas, texture}` —, or the art is disposed; never rejects |
| `problems` | what the art could not load or read; after a reload of a store item, what the reload could not |
| `projection`, `plane` | the projection, and the plane the art lies in; both can be set, and take effect in the next `update()` |
| `layer(name)` | the handle of a layer; throws for a name it does not know, listing the names |
| `layerOf(sprite)` | the layer of a sprite of the mesh, `undefined` for another |
| `set(name, pose)`, `apply(name, track, seconds)`, `reset()` | pose a layer, sample a track into it, every layer back to its rest |
| `takeChanged()` | whether the picture changed since the last call |
| `update()` | once per frame, after the stage's `updateFrame()` and before the render: the plane, the distance of a parallax camera, the stack, then the upload |
| `dispose()`, `isDisposed` | releases the mesh and the atlas the art packed layer files into, and ends the following of a store item, which lets go of it |

`art.layer(name)` answers an `ArtLayer`, the same object for the life of the art: `name`,
`set(pose)`, `apply(track, seconds)`, `reset()`, `frameAt(tag, seconds)`, and what the source says
about the layer — `rest`, `box` (where its picture lies on the canvas, the box around all its
frames), `pivot`, `frameCount` (an empty cel counts), `tags` and `loaded`; until the load `rest`,
`box` and `pivot` are `undefined`, `frameCount` is 0 and `tags` is empty. A reload of a store item
answers them anew. `layer.sprite` is its
sprite in the mesh: a write through it goes past the art, and the next pose overwrites what the two
share.

`new StageArt()` refuses, naming the art once `name` gives it one: a source of none of the shapes,
options that are no object or have a key no option has, a `pxPerUnit` that is no finite number above
0, an `origin` or a `focus` that is no pair of finite numbers, a `compensateDepth` that is no
boolean, a `projection` or a `plane` of the wrong kind, `only` naming a layer twice or more than
8192 layers, a list of files naming more than 8192, options of a layer they cannot take — `at` or
`pxPerUnit` beside an atlas among them —, `only` or `layers` beside loose layers, a `features` entry
that is no feature or takes a slot the art fills, a `material` that sets what is the art's own
(`capacity`, `geometry`, `passes`, the textures, …), and a `renderer` that is no renderer.

### From artwork pixels to units

The art maps the canvas onto the frame of its mesh — `x` to the right and `y` up on the screen,
`+z` towards the camera — by `pxPerUnit` and `origin`, as the [figure in moving a
layer](#moving-a-layer) shows:

```text
unit x   = (px − origin x) / pxPerUnit
unit y   = (origin y − py) / pxPerUnit      y turns from down to up
unit z   = −depth / pxPerUnit               a depth above 0 lies behind the plane
rotation = −deg · π / 180                   clockwise on the screen is negative about +z
size     = box px · scale / pxPerUnit
```

Under a `ParallaxProjection` the [depth compensation](#depth-under-a-parallax-camera) scales the
place and the size of a layer at a depth about the focus on top of this. The pivot of a layer is
its anchor in its box, so a turn and a scale act about it.

### Sources

| source | the art |
| --- | --- |
| `{store, id}` | loads the atlas and the texture of the item through `store.acquireAsync(id, ['atlas', 'texture'])`, then follows the item with `store.on()` until it is disposed: a sheet parsed again under the id reaches the running art ([reloading a sheet](#reloading-a-sheet-while-the-page-runs)), and `clearUnused()` leaves the item standing while an art draws it. Two arts on one item hold it once each |
| `{atlas, texture}` | reads the atlas at once; both stay yours |
| either with `layers: [...]` | reads loose layers: each `{name, frames?, pivot?, at?, depth?, order?, rest?, pxPerUnit?}` |
| `{files, baseUrl?}` | fetches each file under `baseUrl` — a `#` in its name sent as `%23`, which a server has to decode: the Vite dev server answers such a name with 404, so name a strip `steam.png`, `steam-1.png`, … there —, trims it and packs it into a `DynamicAtlas` of its own, with padding 2 and extrude 1, which it owns and disposes |
| a promise of one | waits for it; a promise that rejects is a problem of the source |

An atlas that `AsepriteJson.parse()` filled — the store's `'aseprite'` adapter calls it — is read as
an Aseprite sheet, after [the rules of its scenario](#a-scene-out-of-an-aseprite-file); any other as
a trimmed atlas named after [the rules of a packed atlas](#a-scene-out-of-a-packed-atlas). The
canvas is the `sourceSize` of the frames; the box of a frame is its `spriteSourceSize`, and a frame
larger than that in the sheet — an export with `--inner-padding` — is drawn from its picture alone,
which a padding of one whole number of texels on every side tells; any other is a problem of its
layer. In a packed atlas a name `<layer>-<suffix>` is a frame of the longest layer name before a
hyphen, wherever the packer wrote it — the order of a packed atlas is the packer's —, and a layer
whose frames are numbered takes the numbered ones alone. A list of files is read by [the rules of
layer PNGs](#a-scene-out-of-layer-pngs): the same names, in the order of the list, and a `-suffix`
file is a frame only after the file of its layer — before it, a layer of its own; the canvas is the
size of the first file that loaded, and the box of a file the box of its pixels with an alpha
above 0. An art holds at most 8192 layers.

The art draws the trimmed box of a layer as its quad, never the canvas: a scene of thirty layers on
a canvas of 1920 × 1080 does not shade thirty full screens.

### Setting a pose

`set()` checks every field before it writes one, and refuses what it cannot use with the layer and
the field in the message (`ArtLayer "carafe5": opacity must be a number from 0 to 1, got 1.5`); the
layer keeps what it had. Before the frames are known, a `frame` is checked as a whole number of 0
or more; a frame beyond the frames of the layer at the load becomes a problem, and the layer shows
frame 0. A `depth` at or behind the camera of a `ParallaxProjection` whose distance is known throws
as well, from `set()` and from `apply()` alike; a layer at a depth is written with the `k` of the
distance of the last `update()`, so a move of a far layer needs no second pass.

`reset()` puts a layer back to its `rest`; before the load it forgets the fields set so far.

`set()`, `apply()`, `takeChanged()`, `update()` without a sort, a turn or a new distance, and
`layer.frameAt()` allocate nothing. Two costs are the caller's: a pose object built per call
(`{x, y}` in the frame loop — keep one and write it again), and a fraction read out of a pose by an
art that is handed poses of many shapes, which V8 reads as a heap number of its own. `apply()` reads
the fields of a track out of a pose of the art's own and allocates nothing either way; a
`layer(name)` look-up is a `Map` hit, and a hot loop keeps the handle.

### Tracks

`artTrack(keys, options?)` builds an `ArtTrack`: `duration`, the `at` of the last key;
`sample(seconds, target)`, which writes the fields the track has into `target` and answers it; and
`isMoving(seconds)`. `art.apply(name, track, seconds)` samples it into a layer through a pose of the
art's own.

- A key holds what it leaves out. A field the first key leaves out is not part of the track — a
  later key that sets one is refused —, and `sample()` leaves it alone on the target, so two tracks
  that write different fields run on one pose.
- `x`, `y`, `depth`, `deg`, `scaleX`, `scaleY` and `opacity` blend between two keys at the eased
  share of the stretch that arrives at the key; `ease` of a key beats the `ease` of the track
  (`'linear'` by default). `deg` blends as written: 0 to 350 turns 350 degrees, and −10 is the
  short way.
- `frame`, `visible` and `order` change at the key that sets them.
- Two keys at the same `at` make a cut: from that time on the later key shows.
- Before the first key the track shows the first, after the last the last. `playback: 'loop'` and
  `'pingpong'` run on over the duration, the playbacks of the atlas animations.
- `isMoving(seconds)` tells whether the pose is still on its way: within the keys, and always for
  a loop and a pingpong with a duration above 0; a track of duration 0 never changes.
- `sample()` and `isMoving()` take any finite time and allocate nothing.

`artTrack()` refuses, before it builds anything and naming the field: keys that are no list or
empty, an `at` that is not a finite number of 0 or more or is smaller than the one before, a field
that a later key sets and the first leaves out, a field outside what a pose takes (an `opacity` of
1.5, a `frame` of 0.5, an `order` of 1024), a key that is no field of a pose (`rotation` for `deg`),
an `ease` that is none, and a `playback` other than `'once'`, `'loop'` and `'pingpong'`. The depth
limit needs a camera and is checked by `apply()`. `rampAt(seconds, start, duration, ease?)` refuses
a `seconds` or a `start` that is no finite number and a `duration` that is no finite number above 0.

### Frames at a time

`layer.frameAt(tag, seconds)` is `animationFrameAt()` over a tag of the layer: the frame the tag
shows `seconds` into it — `'loop'` wraps, `'once'` holds the last frame, `'pingpong'` turns at both
ends —, as an index into the frames of the layer. It throws for a tag the layer does not have,
listing its tags, and before the load. Only an Aseprite sheet brings tags.

`animationFrameAt(timing, seconds)` answers the same for any `AnimationTiming` — `frameCount`,
`duration`, `durations` and `playback`, which a `FrameBasedAnimationInfo` has —, for a strip without
a tag and for any sprite animated on the CPU ([animated frames](sprites.md#animated-frames)).

### Depth under a parallax camera

Under a `ParallaxProjection` as `projection`, and with `compensateDepth` (`true` by default), a
layer at a depth `δ` (`depth / pxPerUnit`) is drawn at `z = −δ` and scaled by `k = (D + δ) / D`
about the focus: its place `focus + (p − focus) · k`, its size `size · k`. `D` is
`projection.distanceToProjectionPlane`, the distance of the camera to the plane at rest, in units.

- **The focus** is the point of the canvas the camera looks at in its rest, by default the origin of
  the art: an art at the origin of the plane, under a camera that rests on the axis of the plane.
  Move the art elsewhere on the plane, or let the stage rest its camera elsewhere, and name the point
  in `focus`, in artwork pixels of the canvas.
- **The distance in force** is the one of the last `art.update()`: a resize or a change of the specs
  that changes `D` lays the layers at a depth out anew there, and `takeChanged()` answers `true` for
  it. An `update()` in a handler of the display that runs before the stage's frame lays a new `D`
  out a frame late — and under a `FramePacer`, at the draw after that. Before the projection has
  given its first view, `D` is `NaN` and the layers are drawn uncompensated; the first `update()`
  after the view lays them out.
- **Uncompensated.** Under an `OrthographicProjection` a depth changes the stacking order and, under
  a camera that turns, the place of a layer in space — never its size. A `CameraProjection`, a
  projection of your own and an art without one draw depth as it is, and so does
  `compensateDepth: false`, for a scene that wants its far layers small.
- **Behind the camera.** A depth at or in front of the camera — `depth ≤ −D · pxPerUnit` — cannot
  be drawn: `set()` and `apply()` refuse it where `D` is known, with `compensateDepth: false` as
  well, since the camera of the `ParallaxProjection` stands there either way
  (`ArtLayer "steam": depth must be a number above -300 — the camera stands 300 artwork pixels in
  front of the plane —, got -320`), and the layer keeps its pose. A layer that a new `D` leaves
  there — a smaller view, a camera brought closer — is hidden, and said once on the console where it
  would be shown — a layer you have hidden yourself is said when you show it —, until its depth or
  the distance brings it in front of the camera again.
- **Pixels.** Only the plane is pixel-exact under `pixelSnap`; a layer at a depth is scaled by `k`
  and lands between the pixels.
- **A new projection.** A projection the stage swaps is not followed by the art, which does not know
  the stage: hand it the new one — `art.projection = stage.projection` —, after a
  `rig.moveTo(projection, …)` once the move has arrived. It takes effect in the next `update()`; a
  `set()` before that checks a depth against the `D` of the last `update()`.

### The plane

The art lies in the plane of its projection; without a projection, or under one without a plane —
a `CameraProjection` —, in `plane`, `'xy|bottom-left'` by default. An art handed both a projection
with a plane and a `plane` lies in the plane of the projection and says so once on the console. The
art turns its mesh so that `+z` of the art faces the camera and `y` is up on the screen:

| plane | `+z` of the art | up on the screen |
| --- | --- | --- |
| `'xy|bottom-left'` | world `+z` | world `+y` |
| `'xy|top-left'` | world `−z` | world `−y` |
| `'xz|bottom-left'` | world `−y` | world `+z` |
| `'xz|top-left'` | world `+y` | world `−z` |
| a `ProjectionPlane` of your own | its normal | its `up` |

`art.projection = …` and `art.plane = …` swap them; the mesh turns to another plane in the next
`update()`, which writes no sprite — the layers keep their places in the art — and answers
`takeChanged()` with `true` where a layer is shown; a plane equal to the one the mesh faces changes
nothing. Under a new `ParallaxProjection` the layers at a depth are laid out for its distance in
that `update()`. A value that is no `IProjection`, or neither a `ProjectionPlane` nor one of its four
descriptions, throws a `TypeError`, and the art keeps what it held.

### Drawing on demand: `takeChanged()`

`takeChanged()` answers whether anything the art shows changed since its last call, and starts
over. It answers `true` when, since the last call,

- a shown layer changed a field of its pose to another value;
- a layer turned from shown to hidden or back: through `visible`, an `opacity` from or to 0, an
  empty cel as its frame, its picture arriving or going with a reload, or a camera distance that
  leaves it behind the camera or brings it back;
- a shown layer changed its `depth` or `order`;
- `update()` turned the mesh to another plane, or laid the layers at a depth out for a new distance
  of the camera;
- a store item the art follows brought a new atlas or texture while a layer is shown.

A layer is shown while it is `visible`, its picture is there, its `opacity` is above 0 and its frame
is no empty cel. A camera that moves is the business of its rig; the parallax of the layers needs
no report of the art. A write through `layer.sprite` goes past it. After `dispose()` it answers
`false`.

### Picking and more features

`art.layerOf(sprite)` answers the `ArtLayer` of a sprite of `art.mesh` — the `sprite` a `SpritePicker`
answers, or the `sprite` of a layer —, and `undefined` for a sprite of another mesh, for anything that
is no sprite of the art, and once the art is disposed. The handle of a sprite stays right through the
sorts of the stack.

`features` is a list of sprite features — `Flash`, `Tint`, `PaletteSwap`, a feature of your own — that
join the kind of the art after the features it brings itself. Their values are written through
`layer.sprite`, which `StageArt` types by the features you hand in: `new StageArt(source,
{features: [Flash]})` is a `StageArt<typeof Flash>`, its layers an `ArtLayer<FlashApi>`. The type follows
the element type of the list, so a list that may be empty types an api a sprite may lack. Such a
write goes past the change detection of the art: `takeChanged()` does not see it, and the next pose of
a layer overwrites what it shares with it. A feature that takes a slot the art already fills — a
second frame source such as `AtlasFrame`, another placement — is refused by `new StageArt()` naming
the feature, and so is an entry that is no feature. The kind is built once per list of feature
objects and kept as long as every one of them lives: arts with the same feature objects share it,
and a factory called anew for each art — `paletteSwap({…})` inline — builds a kind each time, so call
it once and hand the feature in.

### `loaded` and `problems`

A layer is drawn hidden until its picture is there. `loaded` resolves once every picture loaded or
failed; it never rejects. What failed is in `problems`, each `{layer, reason}` — `layer` is
`undefined` for the source as a whole, and a file that failed adds its `url` —, and on the console
once per art, after the load, naming the art and the count. A reload of a store item puts its own
list in the place of `problems` and says it once on the console:

| problem | the art |
| --- | --- |
| the source fails — the store item does not load, the promise rejects | every layer hidden; `names` empty unless `only` named them |
| an Aseprite sheet without `{layer}#{frame}` names | no layers, one problem of the source |
| a name in `only` the source lacks | the layer hidden, its poses kept |
| an override without `frames` for a layer the source lacks | the override unused |
| a frame an override or a loose layer names that the atlas lacks | the frame left out |
| two layers of one name | the first taken |
| a layer without any picture | the layer hidden |
| a depth in the file that is no number | the layer on the plane |
| two depths in the frame names of one layer | the first taken |
| frames of one layer on canvases of different sizes | the problem said, the frames placed as they are |
| a frame larger in the atlas than its `spriteSourceSize`, but not by one whole number of texels on every side — an export with `--inner-padding` gone wrong | the frame drawn shrunk; export without `--inner-padding`, or with a padding of whole texels |
| a packed layer of numbered frames and named ones | the numbered ones taken |
| a pivot slice or a `.pivot` marker that names no layer | the marker unused |
| a tag that runs past the frames of the sprite or steps through a frame no layer has a picture of | the tag left out |
| a tag that steps through a frame the `frames` of an override leave out | the tag left out for that layer |
| a frame of a `rest`, or set before the load, beyond the frames of the layer | frame 0 |
| more than 8192 layers in the source | the first 8192 taken |
| a layer a reloaded sheet lacks | the layer hidden, its poses kept |
| a layer new in a reloaded sheet | the layer left out of the running art |
| a frame shown before a reload beyond the frames of the reloaded layer | frame 0 |
| a file that does not load, is no image or is not of the size of the first file that loaded | its layer without that picture; the problem carries the `url` |
| a file without a pixel with an alpha above 0 | an empty frame; a layer of such files alone, or such a pivot marker, a problem |
| pictures of files too large for one atlas of the largest size allowed | every layer hidden, one problem of the source naming the size |

What the art cannot load or read out of a file is no error; what code hands in wrong is. After
`dispose()` — which leaves the parent, disposes the mesh and the atlas of layer files and ends the
following of a store item, which lets go of it — `set()`, `apply()`, `reset()` and `update()` write
nothing — `set()` and `apply()` still refuse what they cannot use —, `layer()` throws, `layerOf()`
answers `undefined`, and a load still on its way is dropped when it lands: the requests of layer
files are aborted, and every decoded picture is closed.
