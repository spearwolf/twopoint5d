# Art layers on a stage

Painted scenes, a kitchen out of an Aseprite file, a title screen out of the layers of a paint
tool: each layer of the artwork becomes a quad in the plane of a stage, at the pixel position it
was painted at, and moves, turns, fades and changes its frame by a pose. This guide starts with
what you want to do, goes on to a cheat sheet of the fields and options, and ends with the
reference.

Contents:

- [Scenarios](#scenarios)
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
| the point a layer turns about | the pivot of a slice named like the layer, else the middle of its box |
| the depth of a layer | `depth=600` in the user data of the layer, or of its group |
| the tags | `meta.frameTags`, for every layer, with their direction and the durations of their frames |

The art lies in the plane of the projection of the stage, the canvas origin — its middle by
default — on the origin of the art. One artwork pixel is one unit of the stage; `pxPerUnit: 2`
draws two artwork pixels per unit.

A layer is hidden until its picture is there: no grey quad flashes up while the sheet loads. A
`{store, id}` source and a promise of one know their layers only once they have loaded — until
then `art.names` is empty and `art.layer()` throws. Name the layers in `only`, and they are there at
once: you can pose them right away, and a pose set before the picture arrives shows when it does.
What the art cannot read — a name in `only` the sheet
lacks, a depth that is no number, a pivot slice that names no layer, a sheet exported without
`{layer}#{frame}` names — is no error: it hides that one layer, goes into `art.problems` and is
said once on the console.

### A scene out of layer PNGs

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

A packer writes its frames in the order it packed them, not in the order of the paint file, so a
packed atlas names its stacking order with `only`, bottom first:

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
a pose to start in. An override beats the file.

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

`pivot` is in pixels of the first frame, its middle without one; `at` is where it stands at rest,
in artwork pixels of a canvas without a picture, whose origin `[0, 0]` lies on the origin of the
art. A `RegExp` takes the frames it matches in the natural order of their names, `steam#10` after
`steam#9`. The list is the stacking order, bottom first; `only` and `layers` do not go with it.

### Moving a layer

A pose is in the units of the paint tool: `x` and `y` are where the pivot stands, in artwork pixels
of the canvas, `deg` turns clockwise about the pivot, `frame` picks a picture of the layer. A pose
writes the fields it is given and keeps the rest.

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

Call `art.update()` once per frame before the render: it puts the layers back to front where a
depth or an `order` changed, and uploads what was written. The poses you set are checked as the
library checks input: a field that is no finite number, an `opacity` outside 0 … 1, a `frame` that
is no index into the frames of the layer, an `order` outside −1024 … 1023 and a key that is no
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

What a track does with its keys:

- A key holds what it leaves out. `{at: 0.6, deg: 35}` turns the carafe and keeps it where it
  stands. A field the first key leaves out is not part of the track — a later key that sets one is refused —, and `sample()` leaves it
  alone on the pose, so two tracks that write different fields — one moves, one fades — run on one
  pose.
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

For a value that eases once and needs no track, `rampAt(seconds, start, duration, ease?)` answers
the share of a ramp, from 0 to 1:

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

`artTrack()` and `rampAt()` refuse what cannot be used and name the field: keys that are no list
or empty, an `at` that is not a finite number of 0 or more or is smaller than the one before, a
field that a later key sets and the first leaves out, a field outside what a pose takes (an
`opacity` of 1.5, a `frame` of 0.5, an `order` of 1024), a key that is no field of a pose
(`rotation` for `deg`), an `ease` that is none, a `playback` other than `'once'`, `'loop'` and
`'pingpong'`, and a `duration` of 0 for `rampAt()`.

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
have throws and lists the tags it has.

### A painted scene made deep

### Art on a `top-left` stage

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
let pouredAt = Number.NEGATIVE_INFINITY;
document.querySelector('canvas')!.addEventListener('click', () => {
  pouredAt = display.now;
});

const frames = new FramePacer(display);
const steam = {frame: 0};
frames.onFrame(({now}) => {
  art.apply('carafe5', pour, Math.max(0, now - pouredAt));
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

`takeChanged()` answers `true` when a shown layer changed a field of its pose to another value,
turned from shown to hidden or back — by `visible`, by an `opacity` from or to 0, by its picture
arriving — or changed its place in the stack. A value set again, a frame a strip keeps and a hidden
layer that moves answer `false`. A write through `layer.sprite` goes past the art; report it to the
pacer yourself (`frames.report(true)`).

### A click on a layer

## Cheat sheet

### The fields of a pose

Every field is optional; a pose writes what it is given. The rest is the pose of the layout.

| field | unit | at rest | takes |
| --- | --- | --- | --- |
| `x`, `y` | artwork pixels: where the pivot stands, `y` down | where the pivot was painted | any finite number |
| `depth` | artwork pixels behind the plane; below 0 in front of it | the file's, else 0 | any finite number |
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
| `focus` | `origin` | the point of the canvas the camera looks at in its rest |
| `projection` | — | `stage.projection`: the art lies in its plane |
| `plane` | `'xy|bottom-left'` | the plane where the projection has none, or without one |
| `compensateDepth` | `true` | whether layers at a depth are drawn as painted at the rest of a parallax camera |
| `only` | every layer, in the order of the source | the layers to take, bottom first |
| `layers` | — | by name: `pivot`, `depth`, `order`, `frames`, `rest` |
| `material` | `transparent: true`, `depthWrite: false` | the material parameters of the mesh: `depthTest`, `alphaTest`, … |

A source is `{store, id}` — an atlas item of a `TextureStore` —, `{atlas, texture}`, either with
`layers` for [loose props](#loose-props), or a promise of one.

## Reference

### `StageArt`

`new StageArt(source, options?)` is a `Group`: add it to the scene of a stage, move, turn or scale
it as any object. It holds one `FeatureSprites`, `art.mesh`, the layers drawn in one draw call.

| member | |
| --- | --- |
| `mesh` | the `FeatureSprites` of the layers; the art owns it. Hand it to a `SpritePicker` |
| `names` | the layers, bottom first; empty until a source without `only` has loaded |
| `canvas` | `{width, height}` of the canvas in artwork pixels; `undefined` for loose layers and before the load |
| `loaded` | resolves once every picture loaded or failed — at once for `{atlas, texture}`; never rejects |
| `problems` | what the art could not load or read |
| `projection`, `plane` | the projection handed in, and the plane the art lies in |
| `layer(name)` | the handle of a layer; throws for a name it does not know, listing the names |
| `layerOf(sprite)` | the layer of a sprite of the mesh, `undefined` for another |
| `set(name, pose)`, `apply(name, track, seconds)`, `reset()` | pose a layer, sample a track into it, every layer back to its rest |
| `takeChanged()` | whether the picture changed since the last call |
| `update()` | once per frame before the render: the stack, then the upload |
| `dispose()`, `isDisposed` | releases the mesh and the lease on a store item |

`art.layer(name)` answers an `ArtLayer`, the same object for the life of the art: `name`,
`set(pose)`, `apply(track, seconds)`, `reset()`, `frameAt(tag, seconds)`, and what the source says
about the layer — `rest`, `box` (where its picture lies on the canvas), `pivot`, `frameCount`,
`tags` and `loaded`; until the load `rest`, `box` and `pivot` are `undefined`. `layer.sprite` is its
sprite in the mesh: a write through it goes past the art, and the next pose overwrites what the two
share.

The plane is fixed when the art is made: that of the projection, else `plane`, else
`'xy|bottom-left'`. An art handed a projection with a plane and a `plane` lies in the plane of the
projection and says so once on the console.

### Sources

| source | the art |
| --- | --- |
| `{store, id}` | holds the atlas and the texture of the item through `store.acquireAsync(id, ['atlas', 'texture'])` until it is disposed: `clearUnused()` leaves the item standing while an art draws it. Two arts on one item hold one lease each |
| `{atlas, texture}` | reads the atlas at once; both stay yours |
| either with `layers: [...]` | reads loose layers: each `{name, frames?, pivot?, at?, depth?, order?, rest?, pxPerUnit?}` |
| a promise of one | waits for it; a promise that rejects is a problem of the source |

An atlas is read as an Aseprite sheet where the store's `'aseprite'` adapter built it, and as a
trimmed atlas named after [the rules above](#a-scene-out-of-a-packed-atlas) otherwise. The canvas
is the `sourceSize` of the frames; the box of a frame is its `spriteSourceSize`. An art holds at
most 8192 layers.

The art draws the trimmed box of a layer as its quad, never the canvas: a scene of thirty layers on
a canvas of 1920 × 1080 does not shade thirty full screens.

### Setting a pose

`set()` checks every field before it writes one, and refuses what it cannot use with the layer and
the field in the message (`ArtLayer "carafe5": opacity must be a number from 0 to 1, got 1.5`); the
layer keeps what it had. Before the frames are known, a `frame` is checked as a whole number of 0
or more; a frame beyond the frames of the layer at the load becomes a problem, and the layer shows
frame 0.

`set()`, `apply()`, `takeChanged()`, `update()` without a change of the stack and `layer.frameAt()`
allocate nothing. Two costs are the caller's: a pose object built per call (`{x, y}` in the frame
loop — keep one and write it again), and a fraction read out of a pose by an art that is handed
poses of many shapes, which V8 reads as a heap number of its own. `apply()` reads the fields of a
track out of a pose of the art's own and allocates nothing either way; a `layer(name)` look-up is a
`Map` hit, and a hot loop keeps the handle.

### Tracks

### Frames at a time

`layer.frameAt(tag, seconds)` is `animationFrameAt()` over a tag of the layer: the frame the tag
shows `seconds` into it — `'loop'` wraps, `'once'` holds the last frame, `'pingpong'` turns at both
ends —, as an index into the frames of the layer. It throws for a tag the layer does not have,
listing its tags. Only an Aseprite sheet brings tags.

### Drawing on demand: `takeChanged()`

`takeChanged()` answers whether anything the art shows changed since its last call, and starts
over. It answers `true` when, since the last call,

- a shown layer changed a field of its pose to another value;
- a layer turned from shown to hidden or back: through `visible`, an `opacity` from or to 0, an
  empty cel as its frame, or its picture arriving;
- a shown layer changed its `depth` or `order`.

A layer is shown while it is `visible`, its picture is there, its `opacity` is above 0 and its frame
is no empty cel. A camera that moves is the business of its rig; the parallax of the layers needs
no report of the art. After `dispose()` it answers `false`.

### Picking and more features

### `loaded` and `problems`

A layer is drawn hidden until its picture is there. `loaded` resolves once every picture loaded or
failed; it never rejects. What failed is in `problems`, each `{layer, reason}` — `layer` is
`undefined` for the source as a whole —, and on the console once per art, after the load, naming the
art and the count:

| problem | the art |
| --- | --- |
| the source fails — the store item does not load, the promise rejects | every layer hidden; `names` empty unless `only` named them |
| a name in `only` the source lacks | the layer hidden, its poses kept |
| an override for a layer the source lacks | the override unused |
| a layer without any picture | the layer hidden |
| a depth in the file that is no number | the layer on the plane |
| a pivot slice or a `.pivot` marker that names no layer | the marker unused |
| an Aseprite sheet without `{layer}#{frame}` names | no layers, one problem of the source |
| a frame set before the load beyond the frames of the layer | frame 0 shown |

What the art cannot load or read out of a file is no error; what code hands in wrong is. After
`dispose()` — which leaves the parent, disposes the mesh and lets go of a store lease — `set()`,
`apply()`, `reset()` and `update()` write nothing — `set()` and `apply()` still refuse what they
cannot use —, `layer()` throws, `layerOf()` answers `undefined`,
and a load still on its way is dropped when it lands.
