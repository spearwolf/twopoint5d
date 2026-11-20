# Proposal: art layers on a stage — `StageArt`, `artTrack()` and `animationFrameAt()`

Status: **specified** — agreed on, with the decisions of the design discussion in §2.6; the build
follows the phases of §10. From
[issue #57](https://github.com/spearwolf/twopoint5d/issues/57), which brings a reference
implementation out of a private point-and-click game (`stage-sprites.ts`, `stage-motion.ts`); this
proposal takes over its idea and its contract, builds it on what the library already has (§2.7),
and adds what makes it 2.5D: layers at a depth of their own under a `ParallaxProjection`, which
keep the painted composition at rest and come apart when the camera moves.

An illustrator delivers a scene as layers: a table, two carafes, a ladle, a strip of steam, each
with its place in the picture and a point it turns about. Today a user of the library turns that
into sprites by hand — a kind, an atlas, a size and an anchor per layer worked out from pixels, a
conversion into units, `touchVO()` for every static attribute, a sort for the stacking order, and a
flag of their own for drawing on demand. `StageArt` does that once: it reads the layers out of the
picture they were painted in, draws them as one `FeatureSprites` in one draw call, lies in the
projection plane of the stage, and takes a pose per layer in the units of the paint tool — pixels
of the artwork and degrees. `artTrack()` moves the layers as pure functions of time: no tween
state, a scrubbable timeline, the same picture for the same time.

## 1. Goal

| who | what they get | § | phase |
| --- | --- | --- | --- |
| an artist with a layered Aseprite file | the file is the layout: layers, stacking order, places, pivots, depths and animations read from its export, no code to describe them | 4.1 | A |
| an artist with a paint tool that exports layers as PNGs (Photoshop, Krita, GIMP, Affinity, Procreate) | a list of file names is the layout: each layer trimmed at load and placed where it was painted | 4.2 | B |
| an atlas packed offline with trimming (TexturePacker, free-tex-packer) | the same, packed: the place of each layer from its trim | 4.3 | A |
| a scene of loose props, not painted on one canvas | a short list of layers with a frame and a pivot each | 4.5 | A |
| a stage of any plane — `'xy|bottom-left'`, `'xy|top-left'`, the `xz` planes, a plane of one's own | the art lies in the plane and looks the same on the screen under each | 2.2, 5.6 | A |
| a painted scene that should feel deep | `depth` per layer: under a `ParallaxProjection` the layers stand apart, the picture at rest stays as painted, a camera move shows the parallax | 2.5, 5.7 | A |
| a cutscene, a puzzle, a UI flourish | `layer.set(pose)` in pixels and degrees; `artTrack(keys)` as keyframes without an animation system | 3.3, 3.4 | A |
| a strip of steam, a flicker, a blinking lamp | `animationFrameAt()` — the frame of an animation at a time, on the CPU, as the shader picks it | 3.5 | A |
| an app that draws on demand | `art.takeChanged()` answers a `Motion`: `true` only when the picture of a layer changed | 3.6 | A |
| a point-and-click game | `art.layerOf(sprite)` names the layer a `SpritePicker` hit, pixel-exact | 3.7 | A |
| production content | a layer whose picture is missing stays hidden and is listed in `problems`; the rest of the stage works | 3.8 | A, B |

## 2. Concepts

### 2.1 The canvas is the frame

Everything a user writes about art layers is in **artwork pixels**: the pixels of the canvas the
layers were painted on, `x` to the right, `y` down, the origin at the top left — the numbers the
status bar of the paint tool shows under the cursor. Angles are **degrees clockwise** on the
screen, as a paint tool and an asset manifest give them. Sizes, pivots, positions, depths and every
key of a track use them; no conversion into world units, no anchor math, no radians in user code.

`StageArt` maps the canvas onto the **art frame** — the local frame of its mesh, `x` to the right
and `y` up on the screen, `+z` towards the camera (§2.2) — by two options:

- `pxPerUnit` (default 1): artwork pixels per unit of the stage;
- `origin` (default the middle of the canvas, `[0, 0]` where no canvas is known, §4.5): the point
  of the canvas that lands on the origin of the art.

```text
unit x   = (px − origin x) / pxPerUnit
unit y   = (origin y − py) / pxPerUnit            y turns from down to up
unit z   = −depth / pxPerUnit                     a depth above 0 lies behind the plane (§2.5)
rotation = −deg · π / 180                         clockwise on the screen is negative about +z
size     = box px · scale / pxPerUnit
anchor   = (pivot px − box top left px) / box px  Anchor's fractions run from the top down already
```

Under a `ParallaxProjection` the depth compensation of §2.5 scales `x`, `y` and the size of a layer
at a depth on top of this.

**Why pixels and degrees, where the rest of the library speaks units and radians.** An art layer
is authored in a paint tool, and its numbers come from there; a conversion in user code is where
the off-by-half and the sign errors live. The mapping above is the one place the library converts,
and the guide shows it once.

### 2.2 The art lies in the projection plane

`StageArt` is a `Group` — `stage.scene.add(art)` — that holds its mesh, and the mesh is turned to
face the plane of the art: `ProjectionPlane#applyRotation()`, the turn a projection gives its
camera, applied to the mesh once. So the art frame looks the same from the camera of every plane:
`x` right and `y` up on the screen, `+z` towards the camera — and the mapping of §2.1 holds
unchanged under each of them.

| plane | `+z` of the art frame | `y` up on the screen is |
| --- | --- | --- |
| `'xy|bottom-left'` | world `+z` | world `+y` |
| `'xy|top-left'` | world `−z` | world `−y` |
| `'xz|bottom-left'` | world `−y` | world `+z` |
| `'xz|top-left'` | world `+y` | world `−z` |
| a `ProjectionPlane` of one's own | its normal | its `up` |

The plane comes from `projection` (§2.5), or from `plane`, or is `'xy|bottom-left'`. Under
`'xy|top-left'` a painted scene therefore shows upright and unmirrored, turns clockwise for a
positive `deg`, and needs neither `Flip` nor `side: DoubleSide`: its quads face the camera as they
do under `'xy|bottom-left'`. The art places the whole canvas through the group — move, turn or
scale `art` as any object; the turn of the mesh inside it is the art's own. The art keeps no
reference to the plane after the turn, save to turn the mesh anew when `plane` or `projection`
change (§3.1).

### 2.3 A layer, its box, its pivot, its frames

A **layer** has a name, a **box** — where its picture lies on the canvas, in artwork pixels —, a
**pivot** on the canvas it stands on and turns about, a **depth** behind the plane, and one or more
**frames**: the pictures it can show, all of the size of its box (a carafe full and empty, the eight
pictures of a steam strip). Its **rest** is the pose of the layout: the pivot where it was painted,
its depth from the file or the overrides, no turn, scale 1, opacity 1, frame 0, shown, its order in
the stack.

### 2.4 A pose

```ts
interface ArtPose {
  x?: number; // where the pivot stands, artwork pixels
  y?: number;
  depth?: number; // behind the plane, artwork pixels; below 0 in front of it (§2.5)
  deg?: number; // clockwise, about the pivot
  scaleX?: number; // about the pivot, 1 = the size of the box
  scaleY?: number;
  opacity?: number; // 0 … 1, through Fade
  frame?: number; // index into the frames of the layer, a whole number
  visible?: boolean; // through Visible
  order?: number; // the stacking order within one depth, a whole number (§5.2)
}
```

Every field is optional: `set()` writes what it is given and keeps the rest. A pose is the same
for a layer and for a key of a track (§3.4), so a track writes straight into a layer — a track on
`depth` dollies a layer through the scene.

### 2.5 Depth: a multiplane camera

A painted scene is composed as one picture. Put its layers at different distances under a
`ParallaxProjection` and they shrink towards the middle of the view — the composition is gone. The
art keeps it: a layer at a depth is pushed back and enlarged about the **focus** by exactly what
the perspective takes away, so the camera at its rest sees the picture as painted, pixel for pixel
up to the rounding. Once the camera moves — a pan, a look, a move of a `CameraRig` — the layers
part: the far ones drift slowly, the near ones fast, the foreground passes in front. The multiplane
camera of an animation studio, out of a flat painting.

- **`depth`** is in artwork pixels along the art frame's `−z`: 0 on the plane, above 0 behind it,
  below 0 in front of it. A pixel of depth is as long as a pixel of width on the plane.
- **The compensation.** With `D` the distance of the camera to the plane at rest, in units, and `δ`
  the depth of the layer in units, the layer is drawn at `z = −δ` and scaled by `k = (D + δ) / D`
  about the focus: its position `focus + (p − focus) · k`, its size `size · k`. At rest the camera
  sees it at `getScaleFactor(D + δ) = D / (D + δ)` of that — as painted.
- **`D`** is the distance the `ParallaxProjection` placed its camera at for the last view —
  `distanceToProjectionPlane` after its fallbacks, which a new public getter of the projection
  answers (§3.9). The art reads it in `update()`, so a change of the specs or a resize that changes
  it lays the depth layers out anew.
- **The focus** is the point of the art frame the camera looks at in its rest: the origin of the
  art, where the art stands at the origin of the plane — the default — and the camera rests on the
  plane's axis. An art moved away from the origin of the plane, or a stage whose rest looks
  elsewhere, names its `focus` in artwork pixels (§3.1).
- **Without compensation.** Under an `OrthographicProjection` `k` is 1: depth changes the
  stacking order and, under a camera that turns, the place of a layer in space, not its size. A
  `CameraProjection`, a projection of one's own and an art without `projection` have no `D` and
  draw depth as it is, uncompensated — as does `compensateDepth: false`, for a scene that wants
  its far layers small.
- **The stack.** Layers are drawn back to front: by depth first, the farthest first, and by `order`
  among layers of one depth (§5.2). A layer painted above another but put behind it goes under it;
  the art says so on the console once per layer, at the first `update()` that finds it so, since
  the picture at rest then differs from the painting.
- **Limits.** A depth at or in front of the camera (`δ ≤ −D`) cannot be drawn: `set()` refuses it
  where `D` is known, and a layer a later `D` leaves there is hidden and warned about once, until a
  depth or a `D` brings it back in front of the camera. Only the plane is pixel-exact under
  `pixelSnap`; a layer at a depth is scaled by `k` and lands between the pixels.

### 2.6 Settled in the discussion, and why

- **The default ease of a key is `'linear'`**, as for `CameraTrackKey`, with `ease` per track for a
  smooth default (§3.4): one field name, one meaning in the library.
- **The art reads a split-layer Aseprite json itself** (§4.1). `AsepriteJson.parse()` stays as it
  is: its atlas of such a sheet is right, and its tag animations, which would mix the layers, are
  not used by the art.
- **Every plane in phase A** (§2.2): one turn of the mesh serves all of them, `'xy|top-left'` — the
  plane of UI, of canvas coordinates — included.
- **Depth per layer in phase A** (§2.5): it is what makes art layers 2.5D rather than a sprite
  sheet with names.
- **`update()` by hand**, as for every `FeatureSprites`: the library has no mesh that updates
  itself, and the order of a frame — write, sort, update, render — stays visible.

### 2.7 What the library already has, and what changes against the reference

The reference draws one `Mesh` of a `PlaneGeometry` and a `MeshBasicMaterial` per layer and loads
each picture through a callback. Nearly every part of it has a counterpart in the library now:

| the reference | here | why |
| --- | --- | --- |
| a mesh per layer | one `FeatureSprites` of an internal kind: `InstancePosition`, `FlatPlacement`, `QuadSize`, `Anchor`, `Rotation`, `AtlasFrame`, `TextureColor`, `Fade`, `Visible` and an order attribute (§5.2) | one draw call; picking, passes and sorting come with it |
| meshes in the xy plane | the mesh turned into the plane of the stage (§2.2) | every plane the library knows |
| one plane | a depth per layer, compensated (§2.5) | the 2.5D of a painted scene |
| `loadTexture(url)`, `files` | frames of an atlas — a `TextureStore` item (§4.1, §4.3) or a `DynamicAtlas` the art packs its files into (§4.2) | the store owns, shares and reloads textures; one `colorMap` per mesh |
| `texture.repeat/offset` strips | atlas frames, an Aseprite tag or a list of names | a strip is an animation the atlas already knows |
| `sizePx`, `pivotPx` on every layer | read from the export where it carries them (§4) | the authoring without a schema the issue asks for |
| `pxPerUnit` per layer | per `StageArt`; a loose layer may override it (§4.5) | one canvas, one scale |
| milliseconds | seconds | `deltaTime`, `now`, transitions and animations count in seconds |
| `scale: [1, 1.2]` | `scaleX`, `scaleY` | an array per call allocates |
| `file: 0` and `frame: 4` | one `frame` | both pick a picture of the layer |
| `centreAround()` | gone | `Anchor` turns a layer about its pivot in the shader |
| `circlePoint()` | a recipe in the guide | three lines of trigonometry are no API |
| `stripFrame()` | `animationFrameAt()` (§3.5) | the timing of the atlas animations, with their playback and durations |
| `fadeAt()` | `rampAt()` (§3.4) | a ramp is useful beyond opacity |
| a key "smooth by default" | the `ease` of the arriving stretch, `'linear'` by default, a default per track (§3.4) | §2.6 |
| an array per layer to compare looks | fields compared in place (§5.3) | allocation-free `set()` and `takeChanged()` |

## 3. API

### 3.1 `StageArt`

```ts
class StageArt extends Group {
  constructor(source: StageArtSource | Promise<StageArtSource>, options?: StageArtOptions);

  readonly mesh: FeatureSprites<…>; // the art owns and disposes it; hand it to a SpritePicker
  readonly names: readonly string[]; // the layers, bottom first as painted
  readonly canvas: {width: number; height: number} | undefined;
  readonly loaded: Promise<void>; // every picture loaded or failed; never rejects
  readonly problems: readonly StageArtProblem[];

  projection: IProjection | undefined; // the plane and the D of §2.5; a swap takes effect in update()
  plane: ProjectionPlane | ProjectionPlaneDescription; // without a projection; default 'xy|bottom-left'

  layer(name: string): ArtLayer; // the handle; throws for a name it does not know, listing the names
  layerOf(sprite: object): ArtLayer | undefined; // the layer of a sprite a SpritePicker answered
  set(name: string, pose: ArtPose): void; // = layer(name).set(pose)
  apply(name: string, track: ArtTrack, seconds: number): void; // samples the track into the layer
  reset(): void; // every layer back to its rest

  takeChanged(): boolean; // did the picture change since the last call? (§3.6)
  update(): void; // once per frame before the render: depth layout, sort, mesh.update()
  dispose(): void;
}

interface StageArtOptions {
  name?: string; // in messages: StageArt "kitchen": …
  pxPerUnit?: number;
  origin?: readonly [number, number];
  projection?: IProjection; // stage.projection: the plane and the depth compensation
  plane?: ProjectionPlane | ProjectionPlaneDescription; // without a projection
  focus?: readonly [number, number]; // artwork pixels; default origin (§2.5)
  compensateDepth?: boolean; // default true
  layers?: Record<string, ArtLayerOptions>; // sparse overrides by name (§4.4)
  only?: readonly string[]; // the layers to take, in this stacking order (§4.4)
  features?: readonly SpriteFeature[]; // more features for the kind: Tint, Flash, … (§3.7)
  material?: …; // the material parameters of FeatureSprites: transparent, depthTest, …
}
```

`ArtLayer` is the handle a hot path keeps: `set(pose)`, `apply(track, seconds)`, `reset()`,
`frameAt(tag, seconds)` (§3.5), the read-only `name`, `rest`, `box`, `pivot`, `frameCount`,
`tags`, `loaded`, and `sprite` — the sprite handle of the mesh, for a feature handed in through
`features` (`layer.sprite.setFlash(1, 1, 1, 0.6)`). A write through `sprite` is the caller's: it
does not go through the change detection, and the caller reports it to a pacer (§3.6).

A pose for a layer whose picture has not arrived is kept and shown once the picture is there; a
pose for a layer that failed is kept as well, and nothing is drawn.

`projection` and `plane`: with a projection the art takes its plane and ignores `plane`; an art
handed both says so once on the console. A stage whose projection is swapped hands the new one to
the art (`art.projection = stage.projection`) — the art does not follow the stage, which it does
not know. A projection without a plane — a `CameraProjection` — leaves the plane at `plane` and
draws depth uncompensated (§2.5).

### 3.2 Sources

```ts
type StageArtSource =
  | {store: TextureStore; id: string} // an atlas item: Aseprite with split layers (§4.1) or a trimmed atlas (§4.3)
  | {atlas: TextureAtlas; texture: Texture} // the same, already loaded
  | {files: readonly string[]; baseUrl?: string} // full-canvas PNGs of a paint tool (§4.2) — phase B
  | {layers: readonly ArtLayerDef[]; atlas?: …} // loose layers (§4.5)
```

### 3.3 Setting a pose

```ts
const stage = new Stage2D(new ParallaxProjection('xy|top-left', {fit: 'contain', width: 960, height: 540}));
const art = new StageArt({store, id: 'kitchen'}, {name: 'kitchen', pxPerUnit: 2, projection: stage.projection});
stage.scene.add(art);
await art.loaded;

const carafe = art.layer('carafe5');
carafe.set({x: 412, y: 380, deg: 35, frame: 1});
art.set('window', {depth: 600}); // far behind, still where it was painted at rest
```

`set()` checks each field as the library checks input (`AGENTS.md`, "Invalid input is refused"):
a field that is no finite number, an `opacity` outside `0 … 1`, a `frame` that is no whole number
or outside the frames of the layer, an `order` that is no whole number from −1024 to 1023 (§5.2), a
`depth` at or in front of the camera where `D` is known (§2.5), and a key of the pose that is no
field of it — `rotation` for `deg` — throw, naming the layer and the field, and the layer keeps
what it held. On the hot path the checks stay inline (§5.4).

### 3.4 Tracks: `artTrack()` and `rampAt()`

```ts
const tilt = artTrack(
  [
    {at: 0, x: 412, y: 380, deg: 0},
    {at: 0.6, deg: 35, ease: 'ease-out'}, // x and y hold
    {at: 1.4, deg: 95, frame: 1}, // the carafe empties as it pours
    {at: 2.2, deg: 0, frame: 1},
  ],
  {ease: 'ease-in-out'}, // the default ease of every key without one
);

let started = 0;
pacer.onFrame(({now}) => {
  art.apply('carafe5', tilt, now - started); // a pure function of the time since the start
  art.set('steam', {frame: art.layer('steam').frameAt('puff', now)});
  return art.takeChanged();
}, stage);
```

```ts
function artTrack(keys: readonly ArtKey[], options?: ArtTrackOptions): ArtTrack;

interface ArtKey extends ArtPose {
  at: number; // seconds, ascending; equal times make a cut
  ease?: Easing; // the stretch that arrives at this key
}

interface ArtTrackOptions {
  ease?: Easing; // default 'linear'
  playback?: AnimationPlayback; // 'once' (default), 'loop', 'pingpong'
}

interface ArtTrack {
  readonly duration: number; // the time of the last key
  sample(seconds: number, target: ArtPose): ArtPose; // writes the fields the track has, answers target
  isMoving(seconds: number): boolean; // within its keys, or always for 'loop' and 'pingpong'
}

function rampAt(seconds: number, start: number, duration: number, ease?: Easing): number; // 0 … 1
```

- **A key holds what it leaves out.** `artTrack()` fills each key from the one before it, once, as
  it builds the track; a field the first key leaves out is not part of the track, and `sample()`
  leaves it alone on the target. So `{at: 0.6, deg: 35}` turns the carafe and keeps it where it
  stands, and two tracks that write different fields — one moves, one fades — run on one layer.
- **Continuous fields** (`x`, `y`, `depth`, `deg`, `scaleX`, `scaleY`, `opacity`) blend between two
  keys at the eased share of the stretch; `deg` blends as written, so 0 to 350 turns 350° — the
  animator writes −10 for the short way. **Discrete fields** (`frame`, `visible`, `order`) change
  at the key that sets them.
- **Before the first key** the track shows the first key, **after the last** the last — or runs
  on under `'loop'` and `'pingpong'`, the playback names of the atlas animations.
- **Pure.** `sample(t)` depends on `t` alone: a track overtaken by the next is left, not cancelled;
  a scrubber, a replay and a test get the same picture for the same time.
- **Refused** by `artTrack()`, before anything is built: keys that are no list or empty, an `at`
  that is no finite number of 0 or more or smaller than the one before, a field as `set()` refuses
  it — save the depth limit, which needs a camera —, an unknown key field, an `ease` that
  `easingOf()` refuses, a playback that is none of the three. `sample()` takes any finite time.
- The easing is the shared one of `src/utils/easing.ts` (`camera-rig.md` §4.9), evaluated through
  `applyEasingInPlace()`.

`apply(name, track, t)` is `set(name, track.sample(t, scratch))` on a scratch pose of the art, so a
caller needs no pose object of their own.

### 3.5 Frames at a time: `animationFrameAt()`

```ts
// texture module, beside FrameBasedAnimations
function animationFrameAt(animation: AnimationTiming, seconds: number): number;

interface AnimationTiming {
  readonly frameCount: number;
  readonly duration: number;
  readonly durations: readonly number[] | undefined;
  readonly playback: AnimationPlayback;
}
```

The index of the frame an animation shows at `seconds` after its start — the frame `AnimatedFrames`
picks in the shader for `time − animOffset = seconds`, with its playback and per-frame durations:
`'loop'` wraps, `'once'` holds the last frame, `'pingpong'` turns at both ends. A
`FrameBasedAnimationInfo` is an `AnimationTiming`, so the function serves every sprite animated on
the CPU, not only art layers. A spec holds it frame by frame against the shader's arithmetic (§11).

`layer.frameAt(tag, seconds)` is the same for a tag of the layer (§4.1): the index into the frames
of the layer, ready for `set({frame})`.

### 3.6 Drawing on demand: `takeChanged()`

`takeChanged()` answers whether anything the picture shows changed since its last call, and starts
over: the frame step of a `FramePacer` (`drawing-on-demand.md` §3.2), which names "a set of
animated layers" as one of the blocks it was written for. It answers `true` when, since the last
call,

- a shown layer changed a field of its pose to another value — `set({x: 412})` on a layer at 412
  is no change, and neither is a `frame` that a steam strip at 8 frames per second keeps for seven
  of every eight frames at 60;
- a layer turned from shown to hidden or back — through `visible`, through an `opacity` from or to
  0, through its picture arriving, through a `D` that leaves it behind the camera or brings it back;
- the order of the stack changed;
- `update()` laid the depth layers out anew for a new `D`, plane or projection.

A hidden layer that moves changes nothing on the screen and answers nothing. The art writes in the
step itself, so the step reports what it writes (`drawing-on-demand.md` §3.5). A write through
`layer.sprite` (§3.1) is outside the art; the caller reports it with `pacer.report()`. A camera
that moves is the business of its rig, whose `step()` answers for it — the parallax of the layers
needs no report of the art.

### 3.7 Picking and more features

`layerOf(sprite)` answers the layer of a sprite of the mesh — the `sprite` of a `SpritePicker`
answer — or `undefined` for one of another mesh. The pick is pixel-exact for free
(`docs/sprites.md`, "Picking"): a click into the transparent part of a carafe lands on the table
behind it, a hidden or faded-out layer is never hit, and of layers at different depths the nearest
wins, as on the screen.

```ts
const hit = await picker.pick(stage.camera, pointer, [art.mesh]);
const name = hit && art.layerOf(hit.sprite)?.name; // 'carafe5', or undefined
```

`features` adds features to the kind of the art — `Flash` for a hover glow, `Tint` for a night
version, `PaletteSwap` — whose values the caller writes through `layer.sprite`. A feature that
takes a slot the kind fills — a second frame source, another placement — is refused by
`defineSprite()`, and its message names the feature.

### 3.8 `loaded` and `problems`

```ts
interface StageArtProblem {
  layer: string | undefined; // undefined: the source as a whole
  reason: string; // in the words of the library's messages
  url?: string;
}
```

- **Hidden until loaded.** A layer is drawn hidden (`Visible`) until its frames are there: no grey
  or white quad flashes up while a picture loads.
- **A failure hides one layer.** A file that does not load (§4.2), a layer an override names that
  the source does not have, a pivot slice that names no layer, a depth in the file that is no
  number: the layer stays hidden — or, for a depth, stays on the plane —, its poses are kept, and
  the failure goes into `problems` — also on the console, once per art, through `console.warn`,
  naming the art and the count.
- **A source that fails as a whole** — the store item cannot load, the promise of the source
  rejects — leaves every layer hidden and one problem without a layer; `names` is then empty unless
  `only` named the layers.
- `loaded` resolves once every picture loaded or failed. It never rejects; `problems` says what
  failed.

### 3.9 `ParallaxProjection#distanceToProjectionPlane`

A read-only getter: the distance from the camera to the plane the projection placed its camera at
for the last view, after the fallbacks of its specs — `NaN` before the first view, as
`getScaleFactor()` answers. The art needs it for `D` (§2.5), and a user who works out a depth of
their own needs it too; today it is private, and only `getScaleFactor(d) = D / d` lets it out by a
detour. `docs/stages.md`, "Depth under a parallax projection", names it.

## 4. Authoring without a schema

The user of the library should fill no schema: the layout of a scene is in the picture it was
painted in, and every common export carries it. The art reads it from there and asks code only for
what the picture cannot say. Four ways in, from no code at all to a short list:

| the artist works in | exports | the art reads | code writes |
| --- | --- | --- | --- |
| Aseprite | a sheet with split layers, trimmed, with layers, tags and slices (§4.1) | names, stacking order, boxes, pivots, depths, frames, animations | nothing |
| any paint tool | one PNG of the full canvas per layer (§4.2) | boxes (trimmed at load), pivots from marker layers, depths from file names | the list of file names |
| any paint tool + a packer | a trimmed atlas over those PNGs (§4.3) | names, boxes, depths from frame names | the stacking order, where it is not the order of the atlas |
| loose props | an atlas or files | the frames | a pivot and a place per layer (§4.5) |

### 4.1 Aseprite: the file is the layout

```sh
aseprite -b kitchen.aseprite --split-layers --trim \
  --sheet kitchen.png --data kitchen.json --format json-array \
  --filename-format '{layer}#{frame}' --list-layers --list-tags --list-slices
```

```json
{"items": {"kitchen": {"atlasUrl": "kitchen.json", "atlasAdapter": "aseprite"}}}
```

```ts
const art = new StageArt({store, id: 'kitchen'}, {projection: stage.projection});
```

- **Names and order** come from `meta.layers`, bottom first, as Aseprite lists them; a layer in a
  group takes its plain name, and a name used twice is a problem of the source (§3.8).
- **The box** of a frame is its `spriteSourceSize` within its `sourceSize`, the canvas — the place
  Aseprite trimmed it from.
- **The frames** of a layer are the frames named `{layer}#{n}`, in the order of `n`; empty cels,
  which Aseprite leaves out of a trimmed sheet, show nothing. The box of a layer is the union of
  the boxes of its frames, so a layer whose cels differ in size keeps one quad.
- **The pivot** is the pivot of the slice named like the layer, read by the rule of
  `setAnchorFromPivot()` (`docs/sprites.md`, "Anchor") — the bottom left corner of the pixel the
  pivot marks; without such a slice, the middle of the box.
- **The depth** is read from the user data of the layer (Aseprite's "User Data" field, the `data`
  of `meta.layers`): a token `depth=600`, in artwork pixels. A layer without one takes the depth of
  its group, so a group is one plane of the multiplane and its layers move together; a layer with
  neither stands on the plane. The rest of the user data is left alone.
- **The tags** are the frame ranges of `meta.frameTags`, with their direction, repeat and the
  durations of their frames, per layer: `layer.frameAt('puff', t)`.
- Hidden layers are not exported by Aseprite unless the export names `--all-layers`; the art
  takes what the sheet holds.

The art reads this json itself, through the atlas the store's `'aseprite'` adapter builds and the
`meta` it keeps (§2.6). *To verify at the start of phase A, against the Aseprite CLI, with a fixture
committed beside the spec:* the exact fields of a split-layer export — `spriteSourceSize` per layer
cel, the names of layers in groups and how a group appears in `meta.layers`, whether the user data
of layers and groups is written there, and how `frameTags` count frames.

### 4.2 Layer PNGs of any paint tool (phase B)

Photoshop ("Export Layers to Files"), Krita ("Export Layers"), GIMP, Affinity and Procreate export
each layer as a PNG of the full canvas, transparent around its picture. That is the layout:

```ts
const art = new StageArt({
  baseUrl: '/assets/kitchen/',
  files: ['window@600.png', 'table.png', 'carafe5.png', 'carafe5.pivot.png', 'carafe5-empty.png', 'steam.png'],
});
```

- **The order of the list** is the stacking order, bottom first — the one thing a folder of PNGs
  does not keep. A layer is named after its file without the extension and without a depth.
- **Trimmed at load.** The art decodes each file (`createImageBitmap()`), finds the box of its
  pixels with an alpha above 0, and packs only that box into a `DynamicAtlas` of its own (§5.1);
  the place of the box on the canvas is the place of the layer. The canvas is the size of the
  files, which must agree; a file of another size is a problem of that layer.
- **Frames.** Files named `<layer>-<suffix>` after a file `<layer>` — `carafe5-empty.png` — are
  further frames of `carafe5`, in the order of the list: frame 1, 2, …; their boxes join the box of
  the layer. A numbered strip `steam#0.png` … `steam#7.png` is the same with numbers.
- **Depth in the name.** `<layer>@<depth>` — `window@600.png` — gives the layer a depth in artwork
  pixels; a negative one is written `@-120`. A layer renamed in the paint tool keeps its depth with
  its name.
- **Pivot markers.** A file `<layer>.pivot.png` — a layer of the paint file with one dot on it,
  exported with the others — is not drawn: the middle of its box is the pivot of `<layer>`. A pivot
  in the picture is moved with the picture; a pivot in code is not.
- One request per file; the browser fetches them side by side. A file that fails hides its layer
  (§3.8).

### 4.3 A trimmed atlas

The same PNGs packed offline — TexturePacker or free-tex-packer with trimming — carry the canvas
as `sourceSize` and the box as `spriteSourceSize` of each frame; the art reads them as in §4.1. Such
an atlas keeps no stacking order of the paint file: the order is `only`, or the order of the frames
in the json. Frame names follow §4.2 (`carafe5-empty`, `steam#3`, `carafe5.pivot`, `window@600`).

The art draws the trimmed box as its quad and writes no trim margins into the sprite: a layer
covers its picture, not the canvas, so a scene of thirty layers on a canvas of 1920 × 1080 does
not shade thirty full screens.

### 4.4 Code says only what the picture cannot

```ts
const art = new StageArt({store, id: 'kitchen'}, {
  pxPerUnit: 2,
  projection: stage.projection,
  only: ['window', 'table', 'carafe5', 'ladle', 'steam'], // these layers, in this order
  layers: {
    window: {depth: 600},
    carafe5: {pivot: [90, 400]}, // artwork pixels on the canvas
    steam: {order: 9, frames: /^steam#/}, // drawn above the rest of its depth
  },
});
```

`ArtLayerOptions` holds `pivot`, `depth`, `order`, `frames` (a list of frame names or a `RegExp`,
for an atlas that does not follow §4.2), `rest` (a pose the layer starts in instead of the layout)
and, for loose layers, `at` and `pxPerUnit`. An override beats what the file says. An override for
a layer the source does not have is a problem (§3.8), so a renamed layer in the paint file shows up
instead of silently losing its pivot.

### 4.5 Loose layers

Props that were never painted together — the issue's form, shortened to what is left:

```ts
const art = new StageArt({
  atlas,
  texture,
  layers: [
    {name: 'carafe5', frames: ['carafe5', 'carafe5-empty'], pivot: [90, 400], at: [120, -40]},
    {name: 'steam', frames: /^steam#/, pivot: [60, 230], at: [300, 0], depth: 40},
  ],
}, {pxPerUnit: 2});
```

`pivot` is in pixels of the frame; `at` is where the pivot stands at rest, in artwork pixels of a
canvas that has no picture — with `origin` `[0, 0]` by default. The box is the size of the first
frame.

## 5. How it works

### 5.1 The mesh and the textures

- One `FeatureSprites` per art, the only child of the art's `Group`, of a kind the art builds once
  per set of `features`, its capacity the number of layers — the layers are known before the first
  sprite is made, so the pool never grows. `transparent: true`, `depthWrite: false` by default:
  art layers are drawn back to front (§5.2), and a caller can hand other material parameters.
- One `colorMap`: the texture of the atlas item, or of the `DynamicAtlas` the files are packed into.
  The art sizes that atlas from the trimmed boxes — the next power of two that holds them with
  `padding: 2` and `extrude: 1`, up to the largest size `renderer.capabilities` allows, or 4096
  before a renderer is known — and refuses a set that does not fit, naming the size and the way
  out: two arts. Art that spans more than one texture is two `StageArt`s with a `renderOrder` each
  (`docs/sprites.md`, "Across meshes").
- Each frame is prepared once (`prepareSpriteFrame()`), so a frame change is
  `setPreparedFrame()` — nine numbers copied.

### 5.2 Attributes and the stack

| attribute | from | usage | written when |
| --- | --- | --- | --- |
| `instancePosition` | `x`, `y`, `depth`, `k` | dynamic | a shown layer moves, changes depth, or `D` changes |
| `rotation` | `deg` | dynamic | it turns |
| `fade` | `opacity` | dynamic | it fades |
| `quadSize` | box × scale × `k` | static, touched | it scales, its box changes, its `k` changes |
| `anchor` | pivot in the box | static, touched | the pivot or the box changes |
| `texCoords` … | `frame` | static, touched | the frame changes |
| `visible` | `visible`, loaded, opacity 0, in front of the camera | static, touched | it shows or hides |
| `artOrder` | `order`, the index of the layer | static | the order changes |

`artOrder` is an attribute of an internal feature with no shader stage, read straight from the
buffer by `sortBy()`. It holds `(order + 1024) · 8192 + index` — a whole number below 2²⁴, exact in
a float32 —, so `order` runs from −1024 to 1023 and an art holds at most 8192 layers.

The stack is sorted in two passes, both stable and both on attributes: `sortBy('artOrder')`, then
`sortBy('z')` — the depth, the farthest (the lowest `z` of the art frame) first. The second pass
keeps the order of the first among layers of one depth, so the stack is total: the same depths and
orders give the same stack whatever the history of the sort, and a scrubbed timeline shows the same
picture for the same time. Back to front along the art frame's `z` is right for every camera in
front of the plane, since all layers lie parallel to it. `update()` sorts only after an order or a
depth changed, and a sort that finds the stack as it is moves nothing.

### 5.3 Change detection

The art keeps the pose of every layer as written last, in one `Float64Array` (ten numbers a layer)
and a flag word. `set()` compares each field it is given with the stored one, writes the buffer
only where it differs, and sets the changed flag only where the layer is shown or turns shown or
hidden. `takeChanged()` answers the flag and clears it. Nothing is built per call.

### 5.4 The hot path

`set()`, `apply()`, `takeChanged()`, `update()` without a sort and without a new `D`,
`ArtTrack#sample()`, `rampAt()`, `animationFrameAt()` and `layer.frameAt()` allocate nothing. The
pose a caller hands in is read field by field; a literal `{x, y}` built per call is the caller's
allocation, which the guide names, and `apply()` is the way around it. A `layer(name)` look-up is a
`Map` hit; a hot loop keeps the handle. The checks of `set()` stay inline; their messages are built
in a function only a refusal calls, as `CameraRig#lerp()` does (`camera-rig.md` §4.6). Fractions
travel through fields and the art's `Float64Array`, never as answers of calls V8 may leave
un-inlined (`AGENTS.md`, "Two test surfaces").

### 5.5 Loading

A `{store, id}` source asks `store.getAsync(id, ['atlas', 'texture'])`; a source handed as a
promise is awaited. Until then the mesh exists, empty of pictures, every layer hidden — the art can
be added to the scene and posed at once. Phase C follows the store (`store.on()`) instead of asking
it once, so a re-exported sheet reaches a running page (§10).

### 5.6 The plane

The art turns its mesh with `ProjectionPlane.get(plane).applyRotation(mesh)` after resetting the
mesh's rotation, at construction and in the `update()` after `plane` or `projection` changed to
another plane (`ProjectionPlane#equals()`); the group stays the caller's to move. The positions of
the layers are in the art frame and do not change with the plane, so a swap of the plane writes no
sprite — only the quaternion of the mesh. `'xy|bottom-left'` turns nothing, and an art on it costs
what it costs without the feature.

### 5.7 Depth

- In `update()`: with a `ParallaxProjection` as `projection` and `compensateDepth`, the art reads
  `D` (§3.9). Where `D` differs from the one of the last layout — or a depth layer changed — it
  works out `k = (D + δ) / D` per layer of the changed set, in place, and writes position and size;
  layers on the plane (`δ = 0`, `k = 1`) are written by `set()` alone. A `D` of `NaN` — before the
  first view — lays depth layers out uncompensated, and the next `update()` after the view lays
  them out anew.
- `set()` writes `depth` like any field; for a layer at a depth the position and the size it writes
  already carry the `k` of the `D` in force, so a move of a far layer needs no second pass.
- Under an `OrthographicProjection`, without a projection and with `compensateDepth: false`, `k` is
  1 and depth is the `z` of §2.1 alone.
- The `focus` of §2.5 is a point of the art frame, worked out from the option once, as `origin` is.
- The check of `δ > −D` runs in `set()` where `D` is known, and in the layout for the layers a new
  `D` leaves behind the camera, which it hides through `visible` and lists for one warning each.

## 6. Module

A module of its own, `src/stage-art/`, beside `text/` — which is the same kind of thing: a facade
that writes into sprites of a kind. It imports `sprites`, `texture`, `utils`, and from `stage` the
`ProjectionPlane` and the projection types it reads; nothing in `stage` depends on it.
`animationFrameAt()` and `AnimationTiming` go into `texture/`, next to `FrameBasedAnimations`, since
any sprite animated on the CPU needs them; the getter of §3.9 goes into `ParallaxProjection`.

```text
src/stage-art/
  StageArt.ts            the class, the handles, set/apply/takeChanged/update
  stageArtKind.ts        the kind and the internal order feature
  artLayout.ts           the mapping of §2.1, the plane of §5.6, the depth of §5.7
  artSources.ts          reading the four sources into layers (§4)
  trimLayerImage.ts      the alpha box of a decoded file (phase B)
  artTrack.ts            artTrack(), rampAt()
  public-api.ts
```

## 7. Ownership and dispose

Following [the resource lifecycle rules](../resource-lifecycle.md): the art owns its mesh — the
geometry and material the mesh builds — and the `DynamicAtlas` it packs files into, with its
texture. A store, an atlas, a texture, a projection and a plane handed in stay the caller's; the
art holds the store's texture as long as it lives and lets go of it on `dispose()`. After
`dispose()` the art has left its parent, `set()`, `apply()`, `reset()` and `update()` do nothing,
`takeChanged()` answers `false`, `layer()` throws, `layerOf()` answers `undefined`, and a load
still in flight is dropped when it lands — its bitmap closed.

## 8. Refusals

All under the subject `StageArt` (or `StageArt "<name>"`), `new StageArt()`, `ArtLayer "<name>"` or
`artTrack`, through `describeValue()`; a projection or a plane of the wrong kind through
`describeThreeValue()` where it is a three.js object:

- a source that is none of the four shapes, options that are no object, a `pxPerUnit` that is no
  finite number above 0, an `origin` or a `focus` that is no pair of finite numbers, a
  `compensateDepth` that is no boolean;
- a `projection` that is no `IProjection`, a `plane` that is neither a `ProjectionPlane` nor one of
  its four descriptions — also through the setters, which keep what they held;
- `only` naming a layer twice; `layers` that is no object; a `depth` override that is no finite
  number;
- a `features` entry `defineSprite()` refuses, in its words;
- `layer()` and `set()` with a name the art does not know — the message lists the names;
- the fields of a pose as in §3.3;
- the keys of a track as in §3.4; `rampAt()` with a `duration` that is no finite number above 0;
- `animationFrameAt()` with a timing whose `frameCount` is no whole number of 1 or more.

What the art cannot load or read out of a file is no refusal: it is a problem (§3.8).

## 9. Lookbook demos

Every part of the feature has a demo, and every demo shows its authoring path. The art is made
reproducibly under `apps/lookbook/assets-src/<demo>/`, documented in its `README.md`, at a quality
that holds at `maxPixelZoom` 2 at most, away from classic fantasy.

| demo | page | shows |
| --- | --- | --- |
| *stage art: the listening machine* | `stage-art-machine.astro` | a brass contraption that listens to the fog — a lever, a flywheel, a needle on a dial, a punched strip, a lamp and steam — rendered in Blender, one render per part, packed into a trimmed atlas (§4.3). Four tracks: the lever (`'once'`, started by a click), the needle (`'pingpong'`), the flywheel (`'loop'`), the lamp through `rampAt()`; the steam through `animationFrameAt()`. A scrubber over the timeline shows that poses are functions of time — drag it back and the machine runs backwards, the steam included; a panel counts `frames` and `draws` of the `FramePacer` the art answers to, and a toggle draws the pivots |
| *stage art: one Aseprite file* | `stage-art-aseprite.astro` | a night-shift vending machine with odd goods, painted in Aseprite with layers, a pivot slice per moving part and a tag for each loop. The page has no layer list: a panel shows what the art read out of the sheet — names, order, boxes, pivots, tags (§4.1). A click picks a layer (`SpritePicker`, `layerOf()`) and starts a wobble track at the time of the click; a second click overtakes the first and the track starts from where the layer stands. `Flash` through `features` lights the layer under the pointer. A toggle switches the stage between `'xy|bottom-left'` and `'xy|top-left'` (§2.2): the picture, the turns and the picks stay the same |
| *stage art: the drowned platform* | `stage-art-depth.astro` | a flooded underground platform at night, painted in planes — the tunnel mouth far back, the pillars, the platform edge, a figure waiting, cables hanging in the foreground — each Aseprite group a plane with its `depth` in the user data (§4.1, §2.5). At rest the picture is the painting; the pointer moves the camera a little through a `CameraRig` (`look()` and a small `moveTo()`), and the planes part. A train's light sweeps the tunnel on a track that dollies a layer through `depth`; ripples on the water through `animationFrameAt()`. Toggles: compensation off (the far planes shrink to the middle), `OrthographicProjection` (the parallax is gone, the stack stays), and a slider for `distanceToProjectionPlane` that shows the layout follow `D` without a jump at rest |
| *stage art: layer files* | `stage-art-layer-files.astro` | a shelf of specimen jars exported as full-canvas PNGs, one per layer, with pivot marker layers and the back wall at `@depth` in its file name (§4.2). A *slow load* toggle holds each file back for a moment in the demo's own loader, so the layers appear one by one with nothing flashing up; a *break a file* toggle swaps one url for a missing one: the jar stays away, `problems` lists it, the shelf goes on swaying — phase B |

Each page gets its `_<name>.json` with the tags of the exports it uses (`StageArt`, `artTrack`,
`rampAt`, `animationFrameAt`, `ParallaxProjection`, `OrthographicProjection`, `ProjectionPlane`,
`CameraRig`, `FramePacer`, `SpritePicker`, `DynamicAtlas`, `TextureStore`), and its preview image.
A demo for phase C — a sheet that reloads while the page runs — is left to the build of that phase.

## 10. Phases

| phase | builds | demos |
| --- | --- | --- |
| A | `animationFrameAt()`; `artTrack()`, `rampAt()`; `ParallaxProjection#distanceToProjectionPlane`; `StageArt` on an atlas source — Aseprite with split layers (§4.1), a trimmed atlas (§4.3), loose layers (§4.5) — with poses, overrides, every plane (§5.6), depth and its compensation (§5.7), the stack, `takeChanged()`, `layerOf()`, `features`, hidden until loaded and `problems` for the layers of an atlas | the listening machine, one Aseprite file, the drowned platform |
| B | the files source (§4.2): decoding, trimming, the `DynamicAtlas`, pivot markers, depths in file names, a problem per file | layer files |
| C | following the store, so a re-exported sheet replaces the frames of a running art; a layer keeps its pose and its name | — |

## 11. Tests

### 11.1 Vitest

- `src/texture/animationFrameAt.spec.ts` — every playback, with one duration and with durations,
  at the edges of each frame, before 0 and far past the end; frame by frame against the arithmetic
  of the shader of `AnimatedFrames`, written out in JavaScript in the spec.
- `src/stage-art/artTrack.spec.ts` — before, between and after the keys; a cut; the ease per key
  and per track; held fields; discrete fields; `'loop'` and `'pingpong'`; fields the track leaves
  alone; `isMoving()`; every refusal; `rampAt()`.
- `src/stage-art/artLayout.spec.ts` — the mapping of §2.1 (a pivot at the canvas middle lands on
  the origin; 90° clockwise is −π/2); the turn of the mesh for each of the four planes, checked by
  where a point of the art frame lands in the world; the compensation: a layer at depth δ, projected
  through the rest camera of a `ParallaxProjection`, covers the box it covers at depth 0, for δ
  behind and in front of the plane and a focus off the origin; `k = 1` under an
  `OrthographicProjection` and with `compensateDepth: false`; a new `D` lays the layers out anew.
- `src/stage-art/StageArt.spec.ts` — partial `set()`, `reset()`, `apply()`; `takeChanged()` true
  only for a visible change — the same value twice, a hidden layer that moves and a frame index
  that stays answer `false`, a new `D` answers `true` —; the stack by depth, then order, total under
  any history; a layer behind the camera hidden and warned once; hidden until loaded; `problems` for
  a missing layer, an unknown override, a depth that is no number and a source that fails;
  `layerOf()`; the `projection` and `plane` setters; `dispose()`.
- `src/stage-art/artSources.spec.ts` — the reading of §4.1, §4.3 and §4.5 from json fixtures of a
  real Aseprite split-layer export (with groups and user data) and a free-tex-packer export,
  committed beside the spec.
- `src/stage/ParallaxProjection.spec.ts` — the getter: `NaN` before the first view, the distance of
  the specs, the default where the specs name none or one no camera can be built from.
- `src/stage-art/trimLayerImage.spec.ts` (phase B) — the alpha box of a bitmap, an empty one, one
  of another size; depths in file names.
- `src/stage-art/hot-path-allocations.stage-art.spec.ts` — `set()`, `apply()`, `takeChanged()`,
  `update()` without a sort and without a new `D`, `sample()`, `animationFrameAt()`,
  `layer.frameAt()` allocate nothing; `set()` of a depth layer under a `ParallaxProjection` too.

### 11.2 Browser (`packages/twopoint5d-testing/test/stage-art.test.js`)

Under WebGPU and WebGL 2:

- a layer turned 90° clockwise about an off-centre pivot lands on the expected pixels, under
  `'xy|bottom-left'` and under `'xy|top-left'` alike;
- two layers of one depth and order stack by the order of the layers and swap with their `order`;
  a layer put behind another by its depth goes under it;
- under a `ParallaxProjection` at rest, a scene of layers at three depths draws the pixels of the
  same scene with every depth 0, within one pixel at the edges; with the camera moved sideways the
  far layer has moved less on the screen than the near one;
- a layer whose picture is held back draws nothing — no pixel of the clear colour changes — until
  it arrives.

## 12. Docs and CHANGELOG

- A guide of its own, `packages/twopoint5d/docs/stage-art.md`, written user first: the scenarios
  — a scene out of Aseprite, out of layer PNGs, out of a packed atlas, loose props; moving a layer;
  a timeline with a scrubber; a strip of steam; a painted scene made deep; art on a `top-left`
  stage; drawing on demand; a click on a layer; the circle of a pestle as a recipe — then a cheat
  sheet of the options and the fields of a pose, then the reference. Figures under
  `docs/images/stage-art/`: the mapping of §2.1, and the compensation of §2.5 seen from the side.
- `docs/stages.md`, "Depth under a parallax projection": the getter of §3.9, and a pointer to the
  guide for painted scenes with depth.
- `docs/sprites.md`, "Animated frames": `animationFrameAt()` for a sprite animated on the CPU.
- `docs/display.md`, "Drawing on demand": `art.takeChanged()` as a frame step.
- `drawing-on-demand.md` §3.2: `StageArt` as the second block that answers a `Motion`.
- `AGENTS.md` and `docs/architecture.md`: the module and its guide.
- `CHANGELOG.md`, `## [Unreleased]`, "Added": `StageArt` and its types, `artTrack()`, `rampAt()`,
  `animationFrameAt()`, `ParallaxProjection#distanceToProjectionPlane`.

## 13. Left out

- Keyframes from the paint file: positions of a layer per Aseprite frame read as the keys of a
  track. A cel moved in Aseprite carries no turn and no pivot; the track in code is clearer.
- A timeline object with state — play, pause, seek, events at keys. Pure functions of a time the
  caller keeps cover it; a time with a pause is `now − started − paused`.
- Layers that do not lie parallel to the plane — a wall turned into the depth, a floor. They need
  a turn per layer (`Orientation`) and a sort by view depth, not by `z`; a kind of one's own does
  that today.
- Depth of field — the far planes blurred. A `postProcess` of the stage, or a second art on a stage
  of its own with a blur, as the guide of stages shows for layers.
- PSD and Krita files read directly. Their formats change, and every one of them exports PNGs.
- Mesh deformation of a layer (bones, a bending tail). A `gridBase()` kind of one's own, outside
  the art.
