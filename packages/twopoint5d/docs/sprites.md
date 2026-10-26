# Sprites

A sprite of `@spearwolf/twopoint5d` is one instance of an instanced quad: a few numbers per
sprite in a GPU buffer — where it stands, how large it is, which frame of a texture it shows —
and one draw call for all sprites of a mesh. What those numbers are, and what the shader does
with them, is assembled from **features**.

## Kinds, features and the base

A **sprite kind** is a base and a list of features, put together once with `defineSprite()`. A
**feature** is one composable part of a sprite. It may bring

- instance attributes — the numbers each sprite carries — and methods of the sprite handle that
  read and write them, plus an `initialize()` that gives a fresh sprite its neutral values
- uniforms and textures, which the material holds
- at most one shader stage per pipeline slot (see "The pipeline")

`defineFeature()` checks a feature on its own; `defineSprite()` checks every feature on its own as
well, and against the others of a kind. A kind is immutable: a sprite with one more feature is a
sprite of another kind.

The **base** is the geometry every sprite of a kind is drawn from. `QuadBase` is the quad of
four vertices the built-in kinds use: the unit quad `[-0.5, 0.5]²` on the XY plane, centred on the
pivot, its `uv` running from `(0, 0)` at the top left to `(1, 1)` at the bottom right.
`gridBase({columns, rows})` cuts that quad into a grid of cells, for a stage that moves grid lines
or bends the sprite (see "A grid base").

## The pipeline

Transformations do not commute — scale-then-rotate keeps a rectangle a rectangle,
rotate-then-scale turns it into a parallelogram — so the order of the stages belongs to the
model, not to the order of the feature list:

```
frame:    frame slot (or defaults) ─▶ frame stages ─▶ texCoords, flipDiagonal, trim — read by both pipelines
uv:       base.uv ─▶ uv stages ─▶ ctx.uv — built where a stage reads it, the color source among them
vertex:   base.position ─▶ trim shift ─▶ local stages ─▶ placement ─▶ mesh stages ─▶ positionNode
fragment: colorSource(frame, ctx.uv) ─▶ color stages ─▶ colorNode
```

| slot | per kind | built-in features |
| --- | --- | --- |
| `frame` | 0 or 1 | `AtlasFrame`, `AnimatedFrames`, `TableFrame`, `tableFrame()` |
| `frameStage` | any, by `order` | `Flip` |
| trim shift | built in, runs when the frame has trim margins | — |
| `local` | any, by `order` | `Anchor`, `NineSlice`, `QuadSize`, `Shear`, `Rotation` |
| `placement` | exactly 1 | `FlatPlacement`, `GroundPlacement`, `flatPlacement()`, `BillboardPlacement`, `AxisBillboardPlacement`, `axisBillboardPlacement()`, `SegmentPlacement`, `segmentPlacement()` |
| `mesh` | any, by `order` | `wave()`, `Visible`; `PlanarShadow`, `MirrorAtPlane` (passes) |
| `uv` | any, by `order` | `NineSlice` |
| `colorSource` | 0 or 1; without one the sprite is flat grey | `TextureColor`, `RepeatingTextureColor` |
| `color` | any, by `order` | `PaletteSwap`, `paletteSwap()`, `Tint`, `Fade`, `Flash`, `ShadowMask`, `Darken` (passes) |

The order bands `FrameOrder` (`Flip 100`), `LocalOrder`
(`Anchor 100, Flip 150, Slice 175, Scale 200, Shear 300, Rotate 400`), `MeshOrder`
(`Offset 100, Project 200, Mirror 300, Hide 1000`), `UvOrder` (`Slice 100`) and `ColorOrder`
(`Palette 50, Tint 100, Mask 150, Fade 200, Flash 300, Pass 1000`) leave room for stages of your
own. Two stages of one order run in the order of the feature list. No built-in feature sits in
`ColorOrder.Mask`. `ColorOrder.Pass` is the band of
the color stages a pass brings to recolor the sprite as a whole — `ShadowMask`, `Darken` — after
every color stage of the kind. `MeshOrder.Hide` is the last word on the position: `Visible` moves
every vertex of a hidden sprite onto one point there, so a mesh stage of your own after it has to
map one point to one point, or it spreads a hidden sprite apart again.

A **frame stage** changes the frame after the frame slot has answered it, and everything that
reads the frame — the trim shift, every stage, the color source — reads the changed one: a mirror
of the image (`FrameOrder.Flip`) swaps `s` with `s + u` and the trim margins left with right, for
every frame feature at once, and leaves the triangles as they are. `LocalOrder.Flip` is the band of
a local stage that mirrors the geometry itself, which turns its triangles over — such a sprite
needs `side: DoubleSide`.

A **uv stage** moves where a vertex samples. The color source reads `ctx.uv`, the base `uv` after
every uv stage; `TextureColor` hands it through a varying, so its uv stages run per vertex and
their result is interpolated across each triangle — exact for a stage that moves grid lines
(`UvOrder.Slice`), not for one that bends the uv within a triangle.

The **trim shift** is no feature. A frame a packer trimmed covers only part of the untrimmed
sprite; the shift moves each corner of the quad to its corner of that part, measured in the unit
quad, before every local stage — so it scales, shears and turns with the sprite.

## Defining a kind

```ts check
import {
  AtlasFrame,
  defineSprite,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  Rotation,
  Shear,
  type FeatureSpritesOf,
  type SpriteOf,
  TextureColor,
  Tint,
} from '@spearwolf/twopoint5d';

export const FancySprite = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Shear, Rotation, AtlasFrame, TextureColor, Tint],
});

export type Fancy = SpriteOf<typeof FancySprite>;
export type FancyMesh = FeatureSpritesOf<typeof FancySprite>;
```

Three types lead from a kind to what it makes: `SpriteOf<typeof Kind>` is its sprite handle,
`FeatureSpritesOf<typeof Kind>` the [`FeatureSprites`](#featuresprites) that draws it — the type of
a field or a parameter that holds the mesh — and `SpriteKindApiOf<typeof Kind>` the handle without
its `VO`, the type argument of `FeatureSprites`, `FeatureSpritesGeometry` and
`FeatureSpritesMaterial`. Each answers `never` for a type that is no kind.

`defineSprite()` merges the attributes and methods of all features into **one** instanced vertex
object description: one pool, one sprite handle carrying every accessor, one `freeVO()` that moves
every attribute of a freed sprite at once. It throws, naming the features, when two of them
declare the same attribute, uniform, texture, usage alias or sprite-handle property, when a
`requires` is not met, when a slot of one gets two, when no feature places the sprite, and when
the merged attributes cannot be laid out.

Every kind brings a prototype of its own. One loop over the sprites of more than four kinds is
megamorphic and runs about eighteen times slower per sprite (see `docs/architecture.md`, the
`vertex-objects/` section) — keep a hot loop to the sprites of one kind.

## A grid base

A quad cannot keep its corners when it is stretched, and it cannot bend: a stage moves four
vertices, and the image between them follows in a straight line. `gridBase({columns, rows})` is the
same quad cut into `columns × rows` cells — `(columns + 1) × (rows + 1)` vertices, two triangles
per cell, laid out by the same `make(halfWidth, halfHeight, xOffset, yOffset)` and the same
`baseArgs` — and a stage can move each grid line on its own: a banner that waves, grass that bends,
a nine-slice panel whose border keeps its size.

```ts check
import {
  AtlasFrame,
  defineFeature,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  gridBase,
  InstancePosition,
  MeshOrder,
  QuadSize,
  TextureColor,
} from '@spearwolf/twopoint5d';
import {add, mul, sin, vec3} from 'three/tsl';
import type {Node} from 'three/webgpu';

// bends the sprite along x: each column line moves up and down by the sine of where it lies
const Banner = defineFeature({
  name: 'banner',
  uniforms: {bend: 0.2},
  mesh: {
    order: MeshOrder.Offset,
    transform: (position, {attribute, uniform}) => {
      const across = attribute<'vec2'>('uv').x;
      return add(position, vec3(0, mul(sin(mul(across, Math.PI * 2)), uniform<'float'>('bend')), 0)) as unknown as Node<'vec3'>;
    },
  },
});

const Flag = defineSprite({
  base: gridBase({columns: 8, rows: 1}),
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, Banner],
});

const flags = new FeatureSprites(Flag, {capacity: 10});
flags.createSprite()?.setSize(4, 1);
flags.setUniform('bend', 0.3);
flags.dispose();
```

- **The layout.** Vertex `k = j · (columns + 1) + i` lies on the column line `i` and the row line
  `j`, row by row from the top: its `uv` is `(i / columns, j / rows)` and its position the point of
  the quad at that uv. The triangles have the winding and the diagonal of the quad's.
- **The grid line of a vertex** is exact in its uv: `round(uv.x · columns)` is its column line,
  `round(uv.y · rows)` its row line. A stage reads the base uv through `attribute('uv')` — in every
  slot, the uv stages' result `ctx.uv` aside.
- **One base per grid.** `gridBase({columns: 3, rows: 3})` answers the same frozen base every time,
  named `grid 3x3`, with its `columns` and `rows`: a feature that needs a grid recognizes it by
  identity in its `checkKind`. Every grid built stays for the life of the page, so `gridBase()` is
  meant for a few fixed grids, not for sizes derived from data. Columns and rows are whole numbers
  from 1 to 1024, and a grid holds at most 4096 cells (`columns · rows`); anything else is refused
  with a `TypeError`.
- **Everything else works on it unchanged**: the pool, every placement and pass, the trim shift —
  it moves every vertex by where it lies on the sprite — `AtlasFrame`, `AnimatedFrames` and
  `TextureColor`. `gridBase({columns: 1, rows: 1})` draws what `QuadBase` draws.
- **It costs vertices.** A 3 × 3 grid shades 16 vertices per sprite, an 8 × 1 strip 18, the quad 4.
  Take the quad unless a stage moves the inside of the sprite; a stage that only moves the whole
  sprite — or shears it, which keeps its edges straight — works on the quad.

## Built-in features

| feature | attributes (usage) | sprite handle | slot | a new sprite |
| --- | --- | --- | --- | --- |
| `InstancePosition` | `instancePosition` (dynamic), word `position` | `x`, `y`, `z`, `setInstancePosition()`, `setPosition(x, y, z?)` | — | at the origin |
| `FlatPlacement` | — | — | placement | — |
| `GroundPlacement` | — | — | placement | — |
| `flatPlacement(options)` | — | — | placement | — |
| `BillboardPlacement` | — | — | placement | — |
| `AxisBillboardPlacement`, `axisBillboardPlacement(options)` | — | — | placement | — |
| `SegmentEnd` | `segmentEnd` (dynamic) | `endX`, `endY`, `endZ`, `setSegmentEnd(x, y, z?)` | — | ends at the origin |
| `SegmentPlacement`, `segmentPlacement(options)` | — | — | placement | — |
| `Yaw` | `yaw` (static) | `yaw` | — | 0 |
| `Orientation` | `orientation` (static) | `qx`, `qy`, `qz`, `qw`, `setOrientation()`, `setQuaternion(q)`, `getQuaternion(target?)`, `setYaw(angle)` | — | unturned, `(0, 0, 0, 1)` |
| `Anchor` | `anchor` (static) | `anchorX`, `anchorY`, `setAnchor()`, `setAnchorFromPivot(frame, slice?)` | local, `Anchor` | the middle, 0.5, 0.5 |
| `NineSlice` | `sliceInsets`, `sliceScale` (static), `sliceInsets` part of the word `texCoords` | `insetLeft` … `insetBottom`, `setSliceInsets()`, `sliceScale`, `setSliceFrame(frame, slice?)` | local, `Slice`; uv, `Slice` | no border, scale 1 |
| `QuadSize` | `quadSize` (static), word `size` | `width`, `height`, `setQuadSize()`, `setSize(w, h)` | local, `Scale` | 0 × 0 |
| `Shear` | `shear` (dynamic) | `shearX`, `shearY`, `setShear()` | local, `Shear` | 0, 0 |
| `Rotation` | `rotation` (dynamic) | `rotation` | local, `Rotate` | 0 |
| `wave(options)` | — (uniforms `waveAmplitude`, `waveFrequency`, `waveSpeed`, `time` shared) | — | mesh, `Offset` | — |
| `AtlasFrame` | `texCoords`, `texFlipDiagonal`, `texTrim` (static), word `texCoords` for all three | `s`, `t`, `u`, `v`, `texFlipDiagonal`, `trimLeft` … `trimBottom`, `setTexCoords()`, `setTexTrim()`, `setFrame()`, `setPreparedFrame()` | frame | all 0 |
| `AnimatedFrames` | `anim` (static): `animId`, `animOffset`; uniform `time` (shared); texture `animsMap` | `animId`, `animOffset` | frame | 0, 0 |
| `TableFrame`, `tableFrame(options)` | `frameIndex` (static); texture `frameTable` | `frameIndex` | frame | 0 |
| `Flip` | `flip` (static) | `flipX`, `flipY`, `setFlip()` | frame stage, `Flip` | unflipped, 0, 0 |
| `TextureColor` | — (texture `colorMap`) | — | color source | — |
| `RepeatingTextureColor` | — (texture `colorMap`; requires `InstancePosition`, `SegmentEnd`, `QuadSize`) | — | color source | — |
| `PaletteSwap`, `paletteSwap(options)` | `paletteRow` (static); uniforms `paletteShift`, `paletteCycle`; texture `palette` | `paletteRow` | color, `Palette` | row 0 |
| `Tint` | `color` (static) | `r`, `g`, `b`, `a`, `setColorValues()`, `setColor(color, a?)`, `getColor(target?)` | color, `Tint` | white, alpha 1 |
| `Fade` | `fade` (dynamic) | `fade` | color, `Fade` | 1 |
| `Flash` | `flash` (dynamic) | `flashR`, `flashG`, `flashB`, `flashAmount`, `setFlash(r, g, b, amount)` | color, `Flash` | white, amount 0 |
| `Visible` | `visible` (static) | `visible` | mesh, `Hide` | shown, 1 |

`InstancePosition` is data alone. `FlatPlacement`, `GroundPlacement` and `BillboardPlacement` read
it and bring nothing but their placement stage, so one stands in for another on a live material
(see "Flat sprites and billboards"). `setPosition(x, y)` without a `z` keeps the `z` the sprite
has. `Yaw` and `Orientation` are data alone as well: only a placement of
`flatPlacement({orientation: 'yaw'})` reads the one, only one of `flatPlacement({orientation:
'quaternion'})` the other (see "Planes and turns").

`BillboardPlacement` maps the x and y of the local vertex — trimmed, scaled, sheared and turned
already — onto the camera's right and up vectors in the local space of the mesh, so a mesh or its
parents may be moved, turned and scaled evenly on all axes and its billboards still face the
camera. A scale that differs from axis to axis skews them.

`Tint` multiplies the **linear** color: the color map decoded from sRGB, before the renderer
encodes the result for the screen again. A dimming tint therefore looks brighter than its number —
`setColorValues(0.5, 0.5, 0.5)` halves the light, and the screen shows about 0.74 of the
brightness, not half of it. For a tint picked in sRGB, convert it: a `Color` from a hex or CSS
string (`new Color('#808080')`) or from `setRGB(r, g, b, SRGBColorSpace)` holds the linear values,
and `setColor(color)` writes them; `setColorValues()` writes its numbers as they are.

### Frames out of an atlas

A frame is three values: `texCoords` (`s, t, u, v`), `texFlipDiagonal` — a TexturePacker frame
turned by 90°, read with the two lookup components swapped — and `texTrim`, the margins a
packer cut off, as fractions of the untrimmed sprite. `setFrame(frame)` writes all three for a
frame of any atlas; the margins come from TexturePacker data, and are zero for every other and
for a frame whose `spriteSourceSize` does not lie within its `sourceSize`.
`frameTrimMargins(data, target?)` works them out by the same rule, for a feature or a material of
your own; with a `target` of its own the call allocates nothing.

```ts check
import {frameTrimMargins, type FrameTrimMargins, type TextureAtlasFrame} from '@spearwolf/twopoint5d';

declare const frame: TextureAtlasFrame<unknown>;

const margins: FrameTrimMargins = frameTrimMargins(frame.data);
```

`TexturePackerJson` reads the "JSON Hash" and "JSON Array" exports of TexturePacker and of
free-tex-packer alike, rotated and trimmed frames included. It refuses a frame that is no object
or has no `frame`, a number of `frame` that is no finite number of 0 or more (a `RangeError`), and
— without `parentCoords` — a `meta.size` without an area above 0, each naming the frame or the
field, before the first frame goes into the atlas: a refused json leaves the `target` as it was.

The quad of the sprite stands for the **untrimmed** sprite: size a sprite that shows trimmed
frames by the `sourceSize` of its frames, not by the measures of their `coords`.

`setFrame()` walks the coords up to their root texture on every call. A sprite that changes its
frame every frame takes `prepareSpriteFrame(frame)` once per atlas frame and
`setPreparedFrame(prepared)` per sprite: nine numbers copied, nothing worked out. A prepared frame
is a snapshot; prepare it again after its `coords` or `data` change.

The three attributes are static and take one usage together: `attributeUsage: {dynamic:
['texCoords']}` makes all three dynamic.

### Animated frames

`AnimatedFrames` takes the place of `AtlasFrame` when the frame is not stored per sprite but
read out of an `animsMap`, the data texture `FrameBasedAnimations#bakeDataTexture()` bakes. A
sprite holds only `animId` — the id `FrameBasedAnimations#add()` answers — and `animOffset`,
the seconds its animation runs ahead of the `time` uniform. The frame is picked in the shader,
so the whole animation costs no per-frame upload. `anim` is a static attribute: a later change
of `animId` or `animOffset` is marked with `spritePool.touchVO(sprite, 'anim')` or
`geometry.touch('anim')`.

The animsMap is one row of RGBA float texels. The first texels are the headers, one per
animation in the order of the ids: `[frameCount, duration, firstFrameTexel, texelsPerFrame]`.
The animations follow one after the other, each its frames — `texelsPerFrame` texels each, the
same number for the whole texture — and behind them its second header texel:

| texel | holds | present when |
| --- | --- | --- |
| 1 of a frame | `[s, t, u, v]`, the tex coords | always |
| 2 of a frame | `[width, height, flipDiagonal, endTime]` | `texelsPerFrame` is 2 or 3 |
| 3 of a frame | `[left, top, right, bottom]`, the trim margins | `texelsPerFrame` is 3 |
| second header, at `firstFrameTexel + frameCount · texelsPerFrame` | `[playback, hasDurations, cycleDuration, -2]` | always |

The bake writes 3 texels when any frame is trimmed, 2 when any frame is turned, an animation has
per-frame durations (or `includeTextureSize` is set), and 1 otherwise. A frame without a second
texel is never turned, one without a third is untrimmed. `playback` is `0` for `'loop'`, `1` for
`'once'`, `2` for `'pingpong'`; `endTime` is the end of the frame within its animation for an
animation with durations, `0` otherwise. The `-2` marks the second header — a fourth component
below `-1.5`, which no texel of a header or a frame reaches: the lowest is the `v` of a frame
flipped vertically, `-1` for one as high as its image. An animsMap built by hand without second
headers plays every animation as a loop at one duration. A reader of its own finds the
frames through `firstFrameTexel` — the frames of a later animation start one texel later per
animation before it.

**Playback.** `FrameBasedAnimations#add()` takes the playback with the timing, and the frame shown
follows `t = time + animOffset`:

- `'loop'` (the default): `floor((t / duration · frameCount) mod frameCount)`.
- `'once'`: the same count clamped to the frames — the first frame before the start, the last
  frame held after the end.
- `'pingpong'`: a triangle wave that shows each end frame once per turn, `0 1 2 3 2 1 0 1 …`; every
  frame lasts `duration / frameCount`, so a turn of `2 · frameCount − 2` frames lasts longer than
  `duration`.
- `durations`, seconds per frame in place of a `duration` or a `frameRate`, hold each frame for its
  own time in any of the three — the hold on the key frame of an attack. The shader finds the
  frame by a binary search of 13 lookups over the end times, for every animation of a material,
  and an animation with durations holds at most 8191 frames.

A `duration` of 0 is a still image and shows the first frame.

```ts check
import {FrameBasedAnimations, TextureCoords} from '@spearwolf/twopoint5d';

const sheet = new TextureCoords(0, 0, 256, 32);
const frames = [0, 1, 2, 3].map((i) => new TextureCoords(sheet, i * 32, 0, 32, 32));

const anims = new FrameBasedAnimations();
anims.add('explode', {frameRate: 24, playback: 'once'}, frames);
anims.add('idle', {duration: 1.2, playback: 'pingpong'}, frames);
const attack = anims.add('attack', {durations: [0.05, 0.05, 0.3, 0.1], playback: 'once'}, frames);

// 0.5: the seconds after which the one-shot holds its last frame
export const attackEnds = anims.animation(attack).cycleDuration;
```

**Start now.** A sprite starts its animation at `now` with `animOffset = -now`: `time + animOffset`
runs from 0 at that moment. With `'once'` that is the whole one-shot — set `animId` and
`animOffset`, mark `anim` with `spritePool.touchVO(sprite, 'anim')`, and
`anims.animation(id).cycleDuration` seconds later the sprite holds the last frame until the game
gives it another animation. `animation()` answers by name or by id; for a `'pingpong'`,
`cycleDuration` is one turn.

**The frames it shows.** `animation(id).frames` lists the frames in the order they are played, one
per frame of `frameCount`: out of an atlas the frame objects of that atlas — `coords` and `data`,
and a name listed twice stands there twice —, out of a `TileSet` the frame of each tile, out of a
list of `TextureCoords` `{coords}` without `data`. Code that needs the frame on screen — a hit box,
the key frame of a strike — reads it there instead of spelling out frame names. The array is frozen
and the same at every call. Its `data` is typed `unknown`, since one `FrameBasedAnimations` holds the
frames of any atlas; the data of an Aseprite frame is read through `isAsepriteFrameData()`, below.

`time` is a uniform: set it with `setUniform('time', seconds)` or the `uniforms` option, a write
builds nothing. The animsMap itself is a texture with `needsImage`: until it has an image the
sprite shows the whole `colorMap`, untrimmed. A `TextureLoader` or a `DataTexture` filled later
writes the image without an event, so call `touchTexture('animsMap')` once it is there. A baked
`DataTexture` already has its image. The animsMap stays the caller's; the material does not
dispose it.

### Aseprite sheets

`AsepriteJson.parse(json)` reads the json of Aseprite's "Export Sprite Sheet", in the layout
"Hash" or "Array", and answers the atlas of the frames, the `meta` and a `FrameBasedAnimations`
with one animation per frame tag:

| `direction` | frames | playback |
| --- | --- | --- |
| `forward` | `from` … `to` | `'loop'` |
| `reverse` | `to` … `from` | `'loop'` |
| `pingpong` | `from` … `to` | `'pingpong'` |
| `pingpong_reverse` | `to` … `from` | `'pingpong'` |

The frames keep their durations — as one `duration` when they are all alike, as `durations` when
they differ. Every frame carries its duration, and Aseprite writes one above 0 for each; a frame
without it, in a tag or not, is refused with a `RangeError` naming it, before the first frame goes
into the atlas. A tag with a `repeat` of `r` (Aseprite's "Repeat" field) is a `'once'` over its
frames played `r` times, a ping-pong counting each direction as one pass: a tag `kick` with repeat 1
is a one-shot. `parse(json, {playback: {kick: 'once'}})` names the playback of a tag from code
instead. It reads its own keys only — an inherited one such as `constructor` names no tag —, and a
value that is none of `'loop'`, `'once'` and `'pingpong'` is refused, naming the tag, before the
first frame goes into the atlas: a refused sheet leaves `options.target` as it was.

A json that Aseprite does not write that way — without `frames` or `meta`, a frame of the layout
"Array" without a `filename`, a tag or a slice without a `name`, slice keys, `bounds`, `center` or
`pivot` the parser cannot read, two slices of one name — is refused before the first frame goes into
the atlas, and the error names what is wrong.

```ts check
import {AnimatedSpriteKind, AsepriteJson, type AsepriteJsonData, FeatureSprites} from '@spearwolf/twopoint5d';
import type {Texture} from 'three/webgpu';

declare const json: AsepriteJsonData; // fighter.json, exported with the tags idle, walk and kick
declare const colorMap: Texture; // fighter.png, the sheet

const [, , animations] = AsepriteJson.parse(json, {playback: {kick: 'once'}});
const animsMap = animations.bakeDataTexture();

const fighters = new FeatureSprites(AnimatedSpriteKind, {capacity: 16, textures: {colorMap, animsMap}});
const fighter = fighters.createSprite()!;
fighter.setSize(64, 64);
fighter.animId = animations.animId('idle');

// on a key press: kick now, and back to idle once the kick has played
export function kick(now: number) {
  fighter.animId = animations.animId('kick');
  fighter.animOffset = -now;
  fighters.spritePool?.touchVO(fighter, 'anim');
  return now + animations.animation('kick').cycleDuration;
}
```

Export the sheet without "Split Layers" and "Split Tags": the frame indices of a tag are positions
in the frame list, one entry per frame of the sprite. Every frame's `data` keeps its json entry and
adds `index` and `slices` — the key of each slice in force at that frame, `{bounds, center?,
pivot?}` in pixels of the untrimmed frame, `center` and `pivot` relative to `bounds` as Aseprite
writes them.

`isAsepriteFrameData(data)` tells that data from any other and narrows it to `AsepriteFrameData`:
`true` for an object with a `frame` object, a `duration` above 0, a whole `index` of 0 or more and
`slices` that are an object. It is the way to read the slices of a frame whose type does not say
which packer wrote it — a frame of `FrameBasedAnimationInfo#frames`, or of the atlas a
`TextureStore` hands out, which is typed with TexturePacker data whatever adapter read it:

```ts check
import {type FrameBasedAnimations, isAsepriteFrameData} from '@spearwolf/twopoint5d';

declare const animations: FrameBasedAnimations; // the tags of fighter.json

// the held key frame of the kick: the frame of the longest duration
const kick = animations.animation('kick');
const durations = kick.durations ?? kick.frames.map(() => kick.duration / kick.frameCount);
const key = durations.indexOf(Math.max(...durations));

const {data} = kick.frames[key]!;
if (!isAsepriteFrameData(data)) throw new Error('fighter.json is no Aseprite sheet');

export const hitbox = data.slices['hitbox']?.bounds;
```

**In a `TextureStore` catalog** an item with an `atlasUrl` is read by an atlas adapter: the one it
names with `atlasAdapter`, else the one whose `app` matches `meta.app` of its json. An Aseprite
json says `"app": "https://www.aseprite.org/"`, so its tags become the `frameBasedAnimations` of the
item without a word of configuration; the item's own `frameBasedAnimations` entries are added
beside them. TexturePacker and free-tex-packer jsons go to `'texturepacker'`, which reads frames and
no animations. `playback` names the playback of a tag outright, as `parse(json, {playback})` does —
here for a sheet exported without Aseprite's "Repeat", whose kick would loop:

```ts check
import {TextureStore} from '@spearwolf/twopoint5d';

const store = new TextureStore();
store.parse({items: {fighter: {atlasUrl: 'fighter.json', playback: {kick: 'once'}}}});

export const animations = store.getAsync('fighter', 'frameBasedAnimations');
```

The store hands the `playback` of an item to its adapter. `'aseprite'` refuses a tag the sheet does
not carry, `'texturepacker'`, which reads no animations, refuses any; the refusal is an `error` of
the resource with `source: 'texture'`, and the item builds no atlas. An entry of the item's own
`frameBasedAnimations` carries a `playback` of its own and is not touched by it. `parse()` refuses
an item whose `playback` is no object or names a value other than `'loop'`, `'once'` and
`'pingpong'`; an image or a tile set item leaves `playback` out and reports it. An adapter of one's
own is a function `(json, parentCoords, options?) => {atlas, animations?}` — `options.playback` is
the `playback` of the item —, registered with `store.registerAtlasAdapter(name, adapter, {app})`
before the catalog is parsed.

The store above has no renderer, and the animations need none: without a renderer a `TextureStore`
loads the images and builds coordinates, atlases, tile sets and animations; only `texture` waits
until `store.renderer` is set. A `getAsync()` after a subtype its resource never builds — the
`atlas` of an image item, the `tileSet` of an atlas, the animations of an item that carries no
animation data and whose adapter reads none — rejects instead of waiting.

An item that names an adapter the store does not know builds no resource and is reported as an
`error` of the store; a field the type of an item does not read — an `imageUrl` beside an `atlasUrl`
— is left out and reported the same way. A tile set item without an `imageUrl` is reported too, and
built all the same, as a placeholder: a `getAsync()` of its texture or tile set waits until a later
`parse()` names an image for it or an `imageUrl` is written to its resource — the one
`whenResource(id)` hands out, of `type` `'tileset'`. An adapter reads the envelope the three packers share —
`frames`, `meta.size`, `meta.image` — since the resource reads the image out of the json before any
adapter runs; a packer of another format is converted to that envelope first.

### Atlases built at run time: `DynamicAtlas`

Labels, damage numbers, player names, an avatar from a url: images that exist only at run time.
`DynamicAtlas` packs them into one canvas, one `CanvasTexture` and one ordinary `TextureAtlas`, so
all of them are drawn by one `FeatureSprites` in one draw call, and `setFrame()`, `AtlasFrameTable`
and `sampleAtlasFrame()` read its frames as any other.

```ts check
import {DynamicAtlas, FeatureSprites, TexturedSpriteKind} from '@spearwolf/twopoint5d';
import type {WebGPURenderer} from 'three/webgpu';

declare const portrait: ImageBitmap; // 96 × 96, e.g. createImageBitmap(await (await fetch(url)).blob())

const ui = new DynamicAtlas({width: 1024, height: 1024, padding: 2});

// a label: measured with the atlas' own context, drawn by a callback into a frame of that size
const drawLabel = (text: string) => (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, _w: number, h: number) => {
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 0, h - 4);
};
ui.context.font = '16px sans-serif';
const label = ui.add('hp', drawLabel('HP 20/20'), {width: ui.context.measureText('HP 20/20').width, height: 20});

// an image at its own size
const face = ui.add('knight', portrait);

const panel = new FeatureSprites(TexturedSpriteKind, {capacity: 64, textures: {colorMap: ui.texture}, transparent: true});
const hp = panel.createSprite()!;
hp.setFrame(label);
hp.setSize(label.coords.width, label.coords.height);
panel.createSprite()?.setFrame(face);

// later, the counter changes: drawn anew in place, the sprite is not written to
export const onHit = (left: number) => ui.redraw('hp', drawLabel(`HP ${left}/20`));

// once per frame, before the render: from the first call on a change waits for it, which copies the changed cells alone
export const beforeRender = (renderer: WebGPURenderer) => ui.upload(renderer);
```

**Packing.** The frames lie on shelves: rows as high as the frame that opened them, a frame going
onto the lowest shelf it fits beside the others, else onto a new shelf below. `padding` (default 1)
clear texels lie between two frames and around the edge; `extrude` (default 0) repeats the edge of
every frame outwards by as many texels, so linear filtering at the edge reads the frame and not the
padding. A frame never moves. A cell that `remove()` gave back takes the next frame that fits into
it, a narrower one its left part. A frame that does not fit throws, naming the size of the atlas
and the fix — there is no silent growth, which would move every frame already written to a sprite.

**`add(name, source, size?)`** takes a draw callback `(context, width, height)` — run clipped to the
frame and moved to its top left, its cell cleared — and then needs the `size`, or an `ImageBitmap`,
an image element, a canvas or an `OffscreenCanvas`, drawn at its own size or scaled to `size`. A
size is rounded up to whole texels, so a width from `measureText()` goes in as it comes. A callback
that throws leaves the atlas as it was. The frame is untrimmed; its `data` is the rectangle in the
canvas, `{frame: {x, y, w, h}}` — a copy: the atlas keeps the cell of every frame itself, and a
change to `data` moves nothing. **`redraw(name, source)`** draws a frame anew at its size, in place:
a score, a health label. A redraw that throws leaves the frame as far as it got — its cell cleared,
perhaps drawn in part — and marked for upload like any change — the whole texture until the first
`upload()`, its cell for the next `upload()` from then on; the frame and its name stay, so the next
`redraw()` mends it. An image element that is still loading (`complete` still `false`), a closed
`ImageBitmap` and a canvas of no size are refused by `add()` — with or without a size — and by
`redraw()`, before anything is cleared. An image element that has loaded without a natural size, an
SVG without `width` and `height`, is drawn at the size `add()` is given and by `redraw()` at the
size of the frame; `add()` without a size refuses it. One that failed to load has no natural size
either: `add()` refuses it without a size and takes no cell for it, `drawImage()` throws for it with
one, and `redraw()` leaves the frame cleared. **`remove(name)`** clears the frame and lets go of its
name and its cell. The frame keeps its id, and `atlas.get(id)` still answers it — its coords show
the cell, cleared until another frame is packed into it, and that frame afterwards —, but it leaves
the random draws of the atlas (`randomFrame()` and its siblings) and a table of every frame
(`frameTable(atlas)`, `atlasFrameTable(atlas)`), and the message of a full atlas counts only the
frames it holds. **`clear()`** starts over with a new `atlas`, frame ids from 0.

The atlas draws, clears and extrudes in canvas pixels whatever the caller left on `context` — a
transform, a `globalAlpha`, a composite operation — and gives that state back afterwards, so the
`font` set for `measureText()` stays. A draw callback starts from that neutral state.

**The texture** is read upright (`flipY = false`, as every atlas of the library), in sRGB, with
straight alpha and without mipmaps; `filter: 'nearest'` for pixel art, `'linear'` by default.
`textureFor(filter)` answers the texture of the canvas with a filter: `texture` for the filter of
the atlas, else a second texture of the same canvas, the same in every setting but its filters —
smooth portraits beside pixel labels out of one atlas. A `FeatureSprites` reads one `colorMap`, so
the sprites of the other filter go into a mesh of their own:

```ts check
import {DynamicAtlas, FeatureSprites, TexturedSpriteKind} from '@spearwolf/twopoint5d';

declare const portrait: ImageBitmap; // painted, shown scaled

const ui = new DynamicAtlas({width: 512, height: 512, filter: 'nearest', extrude: 1});
const face = ui.add('portrait', portrait);

const labels = new FeatureSprites(TexturedSpriteKind, {capacity: 64, textures: {colorMap: ui.texture}});
const portraits = new FeatureSprites(TexturedSpriteKind, {capacity: 8, textures: {colorMap: ui.textureFor('linear')}});
portraits.createSprite()?.setFrame(face);
labels.createSprite();
```

The second texture is built at the first call and kept; every change reaches both, and `upload()`
copies each changed cell into both. It is a GPU texture of its own: the memory of the canvas once
more, and a whole upload goes up twice. Read linearly, a frame wants an `extrude`, so that the
filter at its edge reads the frame and not the padding. The canvas is an `OffscreenCanvas` where there is one, a canvas element otherwise, or the `canvas`
handed in, whose size the atlas takes; under Node there is neither, and the constructor says to
hand one in.

Without `upload()`, every change marks the texture, and the next render uploads the whole canvas
once — 16 MiB at 2048 × 2048, every frame for a label redrawn every frame. `upload(renderer)`,
called once per frame before the render — in the `OnStageUpdateFrame` of a `Stage2D`, which a
`StageRenderer` emits before it renders, with `display.renderer` — copies the changed cells alone
from its first call on: a change waits for the next call, which copies each cell through a small
staging texture and `renderer.copyTextureToTexture()`. Where the cells would cover half the atlas or
more, and at `clear()`, it marks the whole texture instead.

**Ownership.** The atlas owns its textures — the second one of `textureFor()` among them —, a
canvas it built, and the staging canvas and texture of `upload()`; `dispose()` releases them. A
canvas handed in stays the caller's. After `dispose()`, `texture`, `textureFor()`, `canvas`,
`context`, `add()` and `redraw()` throw, `remove()` answers `false`, and
`clear()` and `upload()` do nothing.

Text out of a bitmap font — one sprite per glyph, written into sprites of a kind such as
`TexturedSpriteKind` — is the module `text/`: `BitmapFont`, `writeText()`, `rewriteText()` and
`layoutText()`, see [the text guide](text.md).

### Frames out of a table: `tableFrame()`

Between the nine numbers of `AtlasFrame` and an animation of `AnimatedFrames` sits the sprite that
shows "frame 17 of this set": a tile, a card, a digit, a direction, a pose a game picks on the CPU.
`TableFrame` stores one number per sprite, `frameIndex`, and reads the frame out of a **frame
table** — a data texture `FrameTable#bakeDataTexture()` bakes, set as the texture `frameTable`.

```ts check
import {
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  FrameTable,
  InstancePosition,
  QuadBase,
  QuadSize,
  TableFrame,
  type TextureAtlas,
  TextureColor,
} from '@spearwolf/twopoint5d';
import type {Texture} from 'three/webgpu';

declare const atlas: TextureAtlas; // cards.json, frames card_0 … card_51
declare const colorMap: Texture; // cards.png

const Card = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, TableFrame, TextureColor]});

const deck = FrameTable.fromAtlas(atlas, /^card_/);
const frameTable = deck.bakeDataTexture(); // the caller's: dispose it with the sprites
const cards = new FeatureSprites(Card, {capacity: 52, textures: {colorMap, frameTable}});

const ace = cards.createSprite()!;
ace.setSize(64, 96);
ace.frameIndex = deck.indexOf('card_0');

// later: turn the card over — frameIndex is static, so the change is marked for upload
export function show(index: number) {
  ace.frameIndex = index;
  cards.spritePool?.touchVO(ace, 'frameIndex');
}
```

- **`FrameTable`** takes the frames of an atlas as `AtlasFrameTable` does — a list of names in its
  order, a `RegExp` (the names it matches, in the order of the json), or every frame by id, a frame
  `DynamicAtlas#remove()` let go of left out — or a list of frames and bare `TextureCoords`
  (`new FrameTable(frames)`); `indexOf(name)` answers the index. Its bake is a float `DataTexture`,
  three texels a frame row by row: up to 5 592 405 frames — 2^24 texels, a bound that keeps the
  frame index the shader reads as a float exact —, where `AtlasFrameTable`, the uniform array for a
  material of one's own, stops at 341 frames. Every bake is a new texture the caller owns; a frame
  changed afterwards reaches the sprites with the next bake.
- **The frame** is drawn as `AtlasFrame` draws it: a turned frame upright, a trimmed frame where the
  untrimmed sprite has it.
- **`frameIndex`** is rounded to the nearest frame, a half up; one before the first or past the last
  frame of the table shows the first or the last — the shader cannot throw. It is static; a sprite
  animated on the CPU, which writes it every frame, takes
  `attributeUsage: {dynamic: ['frameIndex']}`.
- Until the frame table has an image the sprite shows the whole `colorMap`.

**Directional frames.** The 8-direction sprites of every boomer shooter, the cheap impostor of a
tree: `tableFrame({views: n})` picks, in the frame `frameIndex`, the view the camera sees the sprite
from. It needs `Yaw`, the facing of the sprite, and `InstancePosition`:

```ts check
import {
  axisBillboardPlacement,
  defineSprite,
  FeatureSprites,
  FrameTable,
  InstancePosition,
  QuadBase,
  QuadSize,
  tableFrame,
  type TextureAtlas,
  TextureColor,
  Yaw,
} from '@spearwolf/twopoint5d';
import type {Texture} from 'three/webgpu';

declare const atlas: TextureAtlas; // stalker.json: stalker_<anim>_<view>_<frame>
declare const colorMap: Texture; // stalker.png, nearest

const Stalker = defineSprite({
  base: QuadBase,
  features: [InstancePosition, axisBillboardPlacement(), QuadSize, Yaw, tableFrame({views: 8}), TextureColor],
});

const walk = FrameTable.fromAtlas(atlas, /^stalker_walk_/);
const stalkers = new FeatureSprites(Stalker, {
  capacity: 16,
  textures: {colorMap, frameTable: walk.bakeDataTexture()},
  attributeUsage: {dynamic: ['frameIndex', 'yaw']},
});

const stalker = stalkers.createSprite()!;
stalker.setSize(2, 2);
stalker.yaw = Math.PI / 2; // facing +x

export function frame(time: number) {
  stalker.frameIndex = Math.floor(time / 0.15) % 4; // walk frame 0 … 3
  stalkers.update();
}
```

- **The views of a frame** — `n` is a whole number from 2 to 64 — are `n` consecutive entries of
  the table, view 0 first. `frameIndex` counts frames as it does without views, and the shader
  reads entry `floor(frameIndex + 0.5) · n + view`; a `frameIndex` past the last frame shows the
  matching view of the last frame, one before the first that of the first.
- **View `k`** is the camera `k · 360° / n` counter-clockwise, seen from above, from the front of
  the sprite: view 0 its front, for eight views view 2 its left side and view 6 its right. The front
  is where `Yaw` turns it, `(sin yaw, 0, cos yaw)` in the local space of the mesh —
  `Object3D.rotation.y` — and the angle of the camera is measured the same way:
  `view = round((atan2(toCamera.x, toCamera.z) − yaw) / (2π / n)) mod n`. The lookbook's `stalker`
  is rendered in that order and its json lists every frame's eight views in a row, so
  `FrameTable.fromAtlas(atlas, /^stalker_walk_/)` is the table as it is. A sheet that counts its
  views clockwise is reordered by its names, view `k` there being view `(n − k) mod n` here:
  `` [0, 7, 6, 5, 4, 3, 2, 1].map((v) => `imp_${frame}_${v}`) ``.
- The angle lies in the xz plane of the mesh, about +y: right for `axisBillboardPlacement()`,
  `BillboardPlacement` and `flatPlacement({orientation: 'yaw'})`. A mesh laid out in the xy plane
  under `axisBillboardPlacement({axis: 'z'})` gets its views about +y all the same; turn such a mesh
  instead. Straight above or below the sprite, where the angle is undefined, the camera sees view 0,
  the front view, whatever the yaw.
- The camera is the one that renders: a `ShadowPass` and a `ReflectionPass` show the view the camera
  sees, as the games of the genre do. A frame stage runs after the view is picked.

### Flip

`Flip` mirrors the image of a sprite — left for right with `flipX`, upside down with `flipY` — and
leaves its triangles as they are: a platformer's character faces left and stays visible under the
default `FrontSide`. A negative width would mirror it too, but turns the triangles over, and
`setTexCoords()` with a negative `u` breaks a trimmed frame and cannot reach `AnimatedFrames`.

```ts check
import {
  AnimatedFrames,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  Flip,
  InstancePosition,
  QuadBase,
  QuadSize,
  TextureColor,
} from '@spearwolf/twopoint5d';

const Fighter = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AnimatedFrames, TextureColor, Flip],
});
const fighters = new FeatureSprites(Fighter, {capacity: 8});
const hero = fighters.createSprite()!;
hero.setSize(64, 64);

export function walk(velocityX: number) {
  hero.flipX = velocityX < 0 ? 1 : 0; // the sheet faces right
  fighters.spritePool?.touchVO(hero, 'flip');
}
```

- **A frame stage** at `FrameOrder.Flip`: the frame's `s` and `s + u` swap places, and its trim
  margins left for right. The drawn x is the `s` axis for every frame, so it mirrors a frame of
  `AtlasFrame`, every frame `AnimatedFrames` picks — in every playback mode — and a frame the
  packer turned or trimmed alike; a trimmed frame stays where the flipped untrimmed sprite has it,
  on its foot. Without a frame feature it mirrors the whole texture.
- **0 or 1.** A value above 0.5 counts as 1, so a flag never draws a squeezed image. `flip` is
  static: mark a change with `touchVO(sprite, 'flip')`, or build a geometry with `attributeUsage:
  {dynamic: ['flip']}` for sprites that turn every few frames.
- **The frame records the mirror** in `mirror`, so `Anchor` mirrors the anchor and `NineSlice` the
  border along with the image.
- **Every base and every pass.** It works on the quad and on `gridBase()`, and `ShadowPass`,
  `ReflectionPass` and `BillboardReflectionPass` draw the flipped image.
- `LocalOrder.Flip` is a different thing: the band of a local stage of one's own that mirrors the
  geometry, whose sprites need `side: DoubleSide`.

### Anchor

`Anchor` says where the position of a sprite sits on its image — the middle, the foot, the top left
corner — per sprite, as fractions of the untrimmed sprite: `anchorX` from the left edge, `anchorY`
from the top down, `(0.5, 0.5)` the middle a new sprite starts with. A sprite turns about its
anchor, and a placement puts the anchor on the instance position.

```ts check
import {
  Anchor,
  AsepriteJson,
  type AsepriteJsonData,
  AtlasFrame,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  Flip,
  InstancePosition,
  QuadBase,
  QuadSize,
  TextureColor,
} from '@spearwolf/twopoint5d';

declare const json: AsepriteJsonData; // fighter.json: a 64 × 64 canvas, a slice "pivot" at the feet

const Fighter = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Anchor, AtlasFrame, TextureColor, Flip],
});
const [atlas] = AsepriteJson.parse(json);
const fighters = new FeatureSprites(Fighter, {capacity: 8});
const hero = fighters.createSprite()!;
const frame = atlas.frame('fighter 0.aseprite')!;
hero.setSize(64, 64);
hero.setFrame(frame);
hero.setAnchorFromPivot(frame); // pivot {x: 32, y: 63}: the anchor (0.5, 1), the feet
hero.setPosition(100, 0); // stands on y = 0
```

- **A local stage** at `LocalOrder.Anchor`: it moves the unit quad by `(0.5 − anchorX, anchorY −
  0.5)` before `QuadSize` scales it, so the anchor is a fraction of the sprite's size whatever the
  size, and of the untrimmed sprite — an animation through trimmed frames of different measures
  keeps its feet where they are. It works on the quad and on every grid.
- **It counts from where the base puts the position**: the middle, under the default `baseArgs`. A
  `baseArgs` offset moves the sprite as well, and the two add up — a kind with `Anchor` leaves
  `baseArgs` at its default.
- **`Flip`** mirrors the anchor with the image: a fighter whose pivot lies off its middle keeps its
  body on its position when it turns.
- **`setAnchorFromPivot(frame, sliceName?)`** reads the pivot of an Aseprite slice of the frame —
  the slices `AsepriteJson.parse()` writes into its data — and takes the **bottom left corner** of
  the pixel the pivot marks, as a fraction of the untrimmed frame: a figure whose pivot marks the
  pixel under its feet stands on its position. Without `sliceName` it takes the one slice that has
  a pivot. A frame without slices, a slice it does not carry or without a pivot, and several slices
  with a pivot and no name are refused, naming the fix. It allocates nothing.
- **Animations.** The anchor belongs to the sprite: a sprite of `AnimatedFrames` takes the pivot of
  one frame of its animation, when the animation starts — an Aseprite canvas keeps the ground where
  it is from frame to frame.
- `anchor` is static: mark a change with `touchVO(sprite, 'anchor')`. Under `ShadowPass` the shadow
  starts at the anchor; `writeText()` writes no anchor (see `docs/text.md`).

### Nine-slice panels

`NineSlice` keeps the border of a frame at its size in pixels and stretches the middle: one small
frame draws a panel, a dialog box, a button or a health bar of any size. It lives on
`gridBase({columns: 3, rows: 3})` and requires `QuadSize`; `setSize()` stretches the panel.

```ts check
import {
  Anchor,
  AsepriteJson,
  type AsepriteJsonData,
  AtlasFrame,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  gridBase,
  InstancePosition,
  NineSlice,
  QuadSize,
  TextureColor,
} from '@spearwolf/twopoint5d';
import type {Texture} from 'three/webgpu';

declare const json: AsepriteJsonData; // panels.aseprite.json: one canvas, a slice with a center per panel
declare const colorMap: Texture; // panels.png

const Panel = defineSprite({
  base: gridBase({columns: 3, rows: 3}),
  features: [InstancePosition, FlatPlacement, QuadSize, Anchor, NineSlice, AtlasFrame, TextureColor],
});
const [kit] = AsepriteJson.parse(json);
const panels = new FeatureSprites(Panel, {capacity: 32, textures: {colorMap}});

const dialog = panels.createSprite()!;
dialog.setSliceFrame(kit.frame('panels 0.aseprite')!, 'panel-stone'); // the frame and its 8-pixel border
dialog.sliceScale = 3; // a pixel of the border is 3 units: the pixel art drawn at 3 ×
dialog.setSize(320, 96);
dialog.setAnchor(0, 0); // placed by its top left corner
dialog.setPosition(16, 200);
```

- **The insets** are left, top, right and bottom of the upright frame, in its pixels:
  `setSliceInsets(8, 8, 8, 8)`, a new sprite has none. `sliceScale` — the units of the mesh a pixel
  of the border takes, 1 by default — sizes the border on screen: it is `inset · sliceScale` units
  wide whatever `setSize()` says.
- **How.** A local stage at `LocalOrder.Slice`, before `QuadSize` scales, moves the inner grid lines
  of the position to the border; a uv stage at `UvOrder.Slice` moves those of the uv to as many
  pixels of the frame, measured in the texels of the `colorMap` (`textureSize()`). A frame the
  packer turned slices as its upright copy.
- **`setSliceFrame(frame, slice?)`** writes the frame through `AtlasFrame` and its border at once:
  out of the `center` of an Aseprite slice — named, or the one slice of the frame that has a center
  — taking the part of the frame the slice's `bounds` cover, so a UI kit drawn on one canvas gives
  every panel by name; or with the insets handed in, `setSliceFrame(atlas.frame('panel-stone'),
  [8, 8, 8, 8])`, for a packer with an insets file of its own. It **refuses a trimmed frame** — a
  nine-slice frame is packed untrimmed, or the packer cuts into its border — and names the fix for a
  missing slice or center and for insets that are not four numbers of 0 or more. A frame written
  with `setFrame()` is not checked: a trimmed one draws its border cut where the packer cut it.
- **Uploads.** `sliceInsets` is part of the usage word `texCoords`: a geometry built with
  `attributeUsage: {dynamic: ['texCoords']}` uploads the insets with the frame on every `update()`.
  Otherwise mark a later `setSliceFrame()` with `spritePool.touchVO(panel, 'texCoords',
  'sliceInsets')` — under the default usage both sit in the one static buffer, and `'texCoords'`
  alone marks them as well.
- **Borders wider than the panel** shrink in proportion until they meet: the middle vanishes and
  no triangle turns over. Insets wider than the frame shrink in the uv alike.
- **With the others.** `Anchor` places a panel by any point — `(0, 0)` its top left corner; `Flip`
  mirrors the border with the image, its left border then the frame's right one; every pass draws
  the sliced panel. The measure is the unit quad of the default `baseArgs`, as for the trim shift.
- `checkKind` refuses a kind on any other base — `defineSprite: feature "nineSlice": needs the base
  gridBase({columns: 3, rows: 3}), not "quad" — …` —, one no feature of which declares the
  `colorMap`, and one with a form of `segmentPlacement()`: `"nineSlice" sets its border in the
  local quad, and a segment of "segmentPlacement" holds only its caps there — the border would land
  inside the segment. For a bar with fixed ends, lay a nine-slice panel with FlatPlacement, turn it
  with Rotation and stretch it with setSize(length, thickness), or draw the ends as sprites of their
  own at the ends of the segment`. The segment placement checks the same, so the refusal holds as
  well when a segment placement is to stand in for the placement of a live nine-slice material.
  A 3 × 3 grid shades 16 vertices per sprite.

### Waves: sway and scroller

`wave(options)` moves the placed vertex along an axis of the mesh by a sine of time and of the
instance position — one stage, two looks. `wave({weight: 'top'})` sways grass, trees, flags and
seaweed: the top moves, the foot stays. `wave({weight: 'uniform'})` moves the whole sprite: the
glyphs of a sine scroller, a bobbing row of coins.

```ts check
import {
  AtlasFrame,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  gridBase,
  InstancePosition,
  QuadBase,
  QuadSize,
  TextureColor,
  wave,
} from '@spearwolf/twopoint5d';

// grass that bends: four rows of cells, each row line moves on its own
const Grass = defineSprite({
  base: gridBase({columns: 1, rows: 4}),
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, wave({weight: 'top'})],
});

// coins that bob along a row, each whole
const Coin = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, wave({weight: 'uniform'})],
});

// the foot on the ground: the pivot at the bottom edge
const meadow = new FeatureSprites(Grass, {
  capacity: 500,
  baseArgs: [0.5, 0.5, 0, 0.5],
  // 6 units at the top, a wave every 40 units, a third of a wave per second
  uniforms: {waveAmplitude: 6, waveFrequency: 1 / 40, waveSpeed: 1 / 3},
});
for (let i = 0; i < 100; i++) {
  const blade = meadow.createSprite();
  blade?.setPosition(i * 4, 0, 0);
  blade?.setSize(8, 32);
}

const coins = new FeatureSprites(Coin, {capacity: 16, uniforms: {waveAmplitude: 2, waveFrequency: 1 / 64, waveSpeed: 0.5}});

export function frame(seconds: number) {
  meadow.setUniform('time', seconds);
  coins.setUniform('time', seconds);
  meadow.update();
  coins.update();
}
```

```text
phase  = 2π · (waveFrequency · (x + z of instancePosition) − waveSpeed · time)
weight = (1 − uv.y)²    for 'top', with uv the base uv: 1 at the top edge, 0 at the foot
       = 1              for 'uniform'
vertex = vertex + axis · waveAmplitude · weight · sin(phase)
```

- **Units.** `waveAmplitude` is in units of the mesh, `waveFrequency` in waves per unit of the mesh,
  `waveSpeed` in waves per second; the wave runs towards +x at `waveSpeed / waveFrequency` units per
  second, a negative speed the other way. The three uniforms belong to the kind and start at 1 —
  set them through `uniforms` or `setUniform()`; `bindUniform()` binds them like any other.
- **The phase** comes from `x + z` of the instance position, so a field does not sway in lockstep:
  a row in the XY plane takes it from x, a field on the ground in the XZ plane gets a diagonal
  front. There is no phase or amplitude per sprite; a kind that needs one writes a mesh stage of its
  own, as `Banner` under "A grid base" does.
- **The axis** is `'x'` for `'top'` and `'y'` for `'uniform'`; `wave({weight: 'top', axis: 'z'})`
  takes another. It is an axis of the mesh, after the placement: wind blows along X whichever way a
  billboard faces.
- **Quad or grid.** On the quad `'top'` is a shear — the two top corners move by the full amount,
  the bottom ones stay. On `gridBase({columns: 1, rows: n})` every row line moves by its own weight,
  halfway up a quarter of the top's amount: the sprite bends. `'uniform'` moves every vertex alike,
  so take the quad for it. The weight is the base uv's: a pivot moved by `baseArgs`, an `Anchor` and
  a trimmed frame weigh as the untrimmed sprite does. It is the top of the image that sways: under
  `Flip` with `flipY` the image hangs upside down and the bottom of the quad sways — a vine hanging
  from a ceiling.
- **`time` is shared** with `AnimatedFrames`: a kind with both holds one `time`, and one
  `setUniform('time', t)` plays the animation and moves the wave.
- **One wave per kind.** Every form is named `wave`, and `defineSprite()` refuses a second:
  `a kind takes one wave — pick one weight and one axis, or write a mesh stage of your own for a second motion`.
  `wave()` answers one frozen feature per set of options and refuses options without a `weight`, an
  unknown weight and an unknown axis with a `TypeError`.
- **Passes** draw the mesh stages of the kind, so a shadow or a reflection sways with its sprite; a
  pass that wants it still leaves the wave out, `without: ['wave']`.

### Fade and flash

`Fade` multiplies the alpha of a sprite by its `fade`: spawning, dying, fog of war. `Flash` mixes
its color towards a flash color by `flashAmount`, alpha kept: a hit flash, a freeze tint, a damage
blink — what `Tint` cannot do, since a tint only multiplies and so only darkens.

```ts check
import {
  AtlasFrame,
  defineSprite,
  Fade,
  FeatureSprites,
  FlatPlacement,
  Flash,
  InstancePosition,
  QuadBase,
  QuadSize,
  TextureColor,
  Tint,
} from '@spearwolf/twopoint5d';

const Enemy = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, Tint, Fade, Flash],
});

const enemies = new FeatureSprites(Enemy, {capacity: 100, transparent: true});
const enemy = enemies.createSprite();
if (enemy != null) {
  enemy.fade = 0.5; // alpha × 0.5
  enemy.setFlash(1, 1, 1, 0.8); // rgb mixed towards white by 0.8, alpha kept
  enemy.flashAmount = 0; // the flash is over
}
enemies.update();
enemies.dispose();
```

- Both attributes are **dynamic** — a fade and a flash change from frame to frame — and every
  `update()` uploads them. A kind whose sprites fade once takes `attributeUsage: {static:
  ['fade']}`.
- A fade between 0 and 1 blends only on a material with `transparent: true`, and the default alpha
  test drops a sprite faded to 0, as for the alpha of `Tint`.
- The fourth value of `flash` is a weight, not an alpha: `flashAmount` 0 leaves the sprite as it
  is, 1 draws it in the flash color. A flash color above 1 is brighter than white and glows under
  a bloom (see "Glow: emissive sprites with bloom").
- The passes leave both alone where they should: `ShadowMask` and `Darken` run after them, in
  `ColorOrder.Pass`, so a fading sprite throws a fading shadow, a flashing one a plain shadow, and
  its reflection flashes darkened.

### Showing and hiding sprites

A window of a game's UI closes, an inventory slot empties, a cursor leaves the screen, and a moment
later they are back. `Visible` hides a sprite and shows it again without freeing it and without
touching any other value of it: no size to zero and to remember, no alpha to restore.

```ts check
import {
  AtlasFrame,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  TextureColor,
  Visible,
} from '@spearwolf/twopoint5d';

const Window = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, Visible],
});

const windows = new FeatureSprites(Window, {capacity: 16});
const quest = windows.createSprite();
if (quest != null) {
  quest.setSize(120, 80);

  quest.visible = 0; // hidden: the size stays 120 × 80
  windows.spritePool?.touchVO(quest, 'visible');

  quest.visible = 1; // shown again, as it was
  windows.spritePool?.touchVO(quest, 'visible');
}
windows.update();
windows.dispose();
```

- `visible` is a number: 1, what every new sprite starts with, draws the sprite, 0 hides it; 0.5
  and above counts as 1.
- It is a **static** attribute: a change reaches the gpu once it is marked with `touchVO(sprite,
  'visible')`. A kind that shows and hides many sprites every frame takes `attributeUsage: {dynamic:
  ['visible']}` instead, and every `update()` uploads it.
- A hidden sprite is hidden **everywhere**: its shadow and its reflection go with it, and
  `SpritePicker` never picks it — a click lands on what lies behind. A pass of your own that should
  draw hidden sprites anyway leaves the stage out with `without: ['visible']`.
- It draws **no fragment at all**: unlike an alpha of 0, it writes no depth under any alpha test
  and blends nothing. It works for every placement — flat, billboard, segment — and every base,
  nine-slice panels included.
- Its vertices still run through the vertex shader. A sprite that stays hidden for good is freed
  instead.
- The presets `TexturedSpriteKind` and `AnimatedSpriteKind` do not hold it; add it to a kind of
  your own.

### Palette swap and colour cycling

Team colours, enemy variants — the red goblin and the blue goblin from one sheet — and the colour
cycling of Deluxe Paint waterfalls. `PaletteSwap` draws each sprite in a row of a **palette**: a
small image, row 0 the source colours, every row below a replacement set of the same length.
Ordinary RGBA images, no indexed PNG.

```ts check
import {
  AtlasFrame,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  PaletteSwap,
  QuadBase,
  QuadSize,
  TextureColor,
  TextureFactory,
} from '@spearwolf/twopoint5d';

// nearest, so every texel keeps its exact colour; upright, as every image of the library
const factory = new TextureFactory(0, ['nearest']);
const colorMap = await factory.loadAsync('platformer/goblin.png');
const palette = await factory.loadAsync('platformer/goblin-palette.png'); // 16 × 4: olive, red, blue, green

const Goblin = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, PaletteSwap],
});
const goblins = new FeatureSprites(Goblin, {capacity: 32, textures: {colorMap, palette}});

const red = goblins.createSprite()!;
red.paletteRow = 1;
const blue = goblins.createSprite()!;
blue.paletteRow = 2;

// colour cycling — the chrome font runs its entries 1 … 15 through the letters
export function cycle(time: number) {
  goblins.setUniform('paletteCycle', 1, 15);
  goblins.setUniform('paletteShift', time * 12);
}
```

- **The match.** A color stage in the band `ColorOrder.Palette` (50), before `Tint` — a tint, a fade
  and a flash act on the swapped colours — compares the colour of the color source with the first 16
  entries of row 0 (`paletteSwap({colors: n})` for 1 to 64) and draws it with that entry of the
  sprite's `paletteRow`, its alpha kept. The first entry it matches wins; a colour no entry holds
  stays as it is. `paletteRow` is rounded to the nearest row, a half up; a `paletteRow` past the
  last row draws the last.
- **Exact colours.** The comparison allows `1/512` per channel, the rounding of 8-bit texels and no
  more. So the `colorMap` is read with `NearestFilter` and no mipmaps — a linear filter blends
  neighbouring texels into colours of no palette —, has no premultiplied edges, and lies in the same
  colour space as the `palette` (both `srgb`, or both none). `PaletteSwap` names the `colorMap` in
  `nearestTextures`, so the sprites say once on the console when it is filtered otherwise.
- **Colour cycling.** `paletteCycle` `(first, count)` names the entries that cycle — `count` 0, the
  default, to the end of the palette — and `paletteShift` how far, in whole steps: a colour of entry
  `i` in the range is drawn with entry `first + ((i − first + floor(paletteShift)) mod count)` of
  its row. Both are uniforms, one value per mesh; sprites that cycle differently live in meshes of
  their own.
- **The cost.** Every fragment reads `colors + 1` texels of the palette: 17 for the default.
- The palette is read with `flipY = false`, row 0 at the top; it stays the caller's, as every
  texture.

## Uploads: static and dynamic attributes

`update()` of the mesh uploads what the sprite pool marked. Position, rotation, shear, `fade`,
`flash` and `segmentEnd` are **dynamic**: every `update()` uploads them. Everything else is
**static**: written before the first `update()` after `createSprite()` it reaches the gpu with that
sprite; a later change reaches the gpu only once it is marked —
`spritePool.touchVO(sprite, 'quadSize')` for one sprite, `geometry.touch('quadSize')` for every
sprite in use.

A value that changes every frame belongs in a geometry built with `attributeUsage`:

    new FeatureSprites(kind, {capacity: 1000, attributeUsage: {dynamic: ['size', 'texCoords']}})

It takes attribute names and the usage words of the features — `size` for `quadSize`, `position`
for `instancePosition`, `texCoords` for the three frame attributes — and throws for a word the
kind does not know. A geometry built with `attributeUsage` shares its prototype with no other.
`baseArgs` hands `make()` of the base other arguments: `[halfWidth, halfHeight, xOffset,
yOffset]` for `QuadBase`. The trim margins still move the corners by the measure of the unit quad.
The geometry takes only a kind out of `defineSprite()`, its parameters as a number or an object,
`baseArgs` as a list and `attributeUsage` as an object of name lists; anything else throws a
`TypeError` before anything is built.

## The material: textures, uniforms and rebuilds

`FeatureSpritesMaterial` folds the pipeline of a kind into `positionNode` and `colorNode`. It takes
the kind and, besides every three.js material parameter, its own options: `name`, `textures` and
`uniforms` to start with, and `resources` — the uniforms and textures of a `SpriteResources`
shared with other materials, which then stay the caller's. It takes only a kind out of
`defineSprite()`, its options as an object, `resources` as a `SpriteResources` and `textures` and
`uniforms` as objects by name, each start value of the type of its uniform — a finite number for a
`float`, 2 to 4 finite numbers for a `vec2` to `vec4`; anything else throws a `TypeError`. A start
value of `undefined` or `null` keeps the one the feature declares.

```ts check
import {
  AtlasFrame,
  defineSprite,
  FeatureSpritesMaterial,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  TextureColor,
  Tint,
} from '@spearwolf/twopoint5d';
import {Texture} from 'three/webgpu';

const kind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, Tint],
});

const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture()}, transparent: true});

// the next texture of the same kind costs no rebuild
material.setTexture('colorMap', new Texture());

material.dispose();
```

Without a frame feature the frame is the whole texture, untrimmed and unturned; without a color
source the sprite is flat grey, and the color stages — `Tint` among them — work on that grey. A
feature whose textures are not all set drops out of the graph until they are: a kind with
`TextureColor` draws its sprites flat grey, tinted, while no `colorMap` is set. A texture declared
with `needsImage` counts as set only once its image has measures.

`setTexture(name, texture)` and `getTexture(name)` take the names the features declare; a texture
stays the caller's, and `dispose()` does not release it. `TextureLoader` writes a loaded image into
the same texture without an event, so `touchTexture(name)` re-reads it once it has loaded.
`setTexture()` with the texture that is set already does nothing, and a change of its filters,
`colorSpace`, `type` or `format` can make it a texture of another kind — from `NearestFilter` to
`LinearFilter`, say: call `touchTexture(name)` after such a change, and the graphs that read it
are rebuilt as for another texture.

A texture of the same kind as the one set takes its place without a rebuild: the texture nodes
of the graphs get it as their value. Of the same kind means alike in `colorSpace`, `type` and
`format`, in the way three binds it, in whether both filters are `NearestFilter` and whether a
filter blends texels, in `compareFunction` and in the samples of its render target
(`textureShapeKey()`). A texture of another kind, and a change from no texture to one or back,
builds the graphs that read it anew and sets `needsUpdate` — once per graph, even when the frame
feature waits for the texture and both graphs read the frame. three then generates the shader
source again and takes program and pipeline out of its caches for a source it has built before.
Do not alternate such textures every frame.

`uniforms` holds the uniform nodes of the features by name, and `setUniform(name, x, y?, z?, w?)`
writes one: a number for a `float`, two to four for a `vec2` to `vec4`. A uniform is read at run
time, so a write builds nothing and allocates nothing — call it every frame.

Without an `alphaTest` or `alphaTestNode` the material drops every texel with an alpha of `0.001`
or less; either of the two takes the place of that default.

The graphs depend on the kind and on the kinds of the textures, not on the material. Two meshes
of one kind with textures of the same kind produce the same shader source, and the second comes
out of the renderer's caches.

## Flat sprites and billboards

A kind lists one placement: `FlatPlacement` puts the sprite into the plane of the mesh,
`BillboardPlacement` turns it about its instance position to face the camera. The placement of the
kind is the one a material starts with, and a swap on a live material is a plain write:

```ts check
import {
  BillboardPlacement,
  defineSprite,
  FeatureSpritesMaterial,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
} from '@spearwolf/twopoint5d';

const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize]});
const material = new FeatureSpritesMaterial(kind);

material.placement = BillboardPlacement;
material.placement = FlatPlacement;

material.dispose();
```

Another placement takes the place of the current one only when it contributes a placement stage and
nothing else — no attributes, methods, uniforms or textures, because the sprites and the material
were built without them — and the kind holds every feature it `requires`. It may bring a `checkKind`
of its own, which is shown the kind with it in place of the kind's placement. Anything else throws a
`TypeError` naming both features, a refusal of its `checkKind` an `Error` naming it. The placement
of the kind always comes back, whatever it brings. A write of the placement the material holds
builds nothing.

A change rebuilds the position graph and sets `needsUpdate`; three serves a shader source it has
built before from its caches, so the second swap back and forth is cheap. Do not swap every frame.

### Planes and turns

A flat sprite lies in a plane of its mesh, and may be turned one by one — about the up axis of the
mesh, or any way at all. `flatPlacement(options)` builds the placement for both:

```
placed = instancePosition + turn · plane · local
```

- **`plane`** — `'xy'`, the default, stands the quad up facing +Z. `'xz'` lays it on the ground
  facing +Y, the plane of `Map2D`, `TileSprites` and the `groundPlane` of `ShadowPass`.
- **`orientation: 'yaw'`** turns every sprite about +Y of the mesh by its `yaw` attribute, after
  the plane and before the instance position. The kind holds the `Yaw` feature, which brings the
  attribute; `defineSprite()` refuses the placement without it.
- **`orientation: 'quaternion'`** turns every sprite by the unit quaternion of its `orientation`
  attribute, at the same place in the chain: any tilt off the vertical — a banner on a ramp, a decal
  on a slope, a sign that leans. The kind holds the `Orientation` feature.

`flatPlacement()` returns one frozen feature per set of options — equal options give the same
feature, which the placement swap needs. `FlatPlacement` is `flatPlacement()`, `GroundPlacement` is
`flatPlacement({plane: 'xz'})`. The six forms are named `flatPlacement`, `groundPlacement`,
`flatPlacement+yaw`, `groundPlacement+yaw`, `flatPlacement+quaternion` and
`groundPlacement+quaternion`; a plane or an orientation it does not know, and options that are no
object, throw a `TypeError`.

```ts check
import {
  AtlasFrame,
  defineSprite,
  FeatureSprites,
  flatPlacement,
  GroundPlacement,
  InstancePosition,
  Orientation,
  QuadBase,
  QuadSize,
  Rotation,
  TextureColor,
  Yaw,
} from '@spearwolf/twopoint5d';
import {Euler, Quaternion} from 'three/webgpu';

// decals on the ground: world coordinates, the rotation turns them about +Y
const DecalKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, GroundPlacement, QuadSize, Rotation, AtlasFrame, TextureColor],
});

// signs that face every way, in one mesh and one draw call
const SignKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, flatPlacement({orientation: 'yaw'}), Yaw, QuadSize, AtlasFrame, TextureColor],
});

// banners that lean back off the vertical: a quaternion per sprite
const BannerKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, flatPlacement({orientation: 'quaternion'}), Orientation, QuadSize, AtlasFrame, TextureColor],
});

const decals = new FeatureSprites(DecalKind, {capacity: 100});
const decal = decals.createSprite();
if (decal != null) {
  decal.setPosition(4, 0.01, -2);
  decal.setSize(2, 1);
  decal.rotation = Math.PI / 4;
}

const signs = new FeatureSprites(SignKind, {capacity: 1000});
for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  const sign = signs.createSprite();
  if (sign == null) break;
  sign.setPosition(Math.sin(angle) * 10, 5, Math.cos(angle) * 10);
  sign.setSize(4, 2);
  // the angle a mesh would take as rotation.y: this sign faces away from the origin
  sign.yaw = angle;
}

// the yaw first, then the lean in the frame of the banner: Euler order 'YXZ'
const lean = new Euler(0, 0, 0, 'YXZ');
const turn = new Quaternion();
const banners = new FeatureSprites(BannerKind, {capacity: 100});
for (let i = 0; i < 8; i++) {
  const banner = banners.createSprite();
  if (banner == null) break;
  banner.setPosition(i * 3, 0, 0);
  banner.setSize(2, 3);
  banner.setQuaternion(turn.setFromEuler(lean.set(-0.3, i * 0.2, 0)));
}

decals.update();
signs.update();
banners.update();
decals.dispose();
signs.dispose();
banners.dispose();
```

The axes of the two planes:

| local axis of the quad | `'xy'` | `'xz'` |
| --- | --- | --- |
| x, the right of the image | +X | +X |
| y, the top of the image | +Y | −Z |
| z, the front of the quad | +Z | +Y |

`'xz'` is the turn a mesh takes with `rotation.x = -π/2`: a sprite of `GroundPlacement` in a mesh
at rest draws where a sprite of `FlatPlacement` at `(x, -z, y)` draws in a mesh turned that way,
and the mesh keeps its own transform free — it may carry the sprites on a moving platform. The top
of the image points to −Z, "north" on a map, as the top of a tile of `TileSprites` does. The front
faces +Y, so the default `FrontSide` draws the sprite seen from above.

The senses of the turns:

- **`Rotation`** turns the quad about its own z, counter-clockwise as seen from its front, as
  `Object3D.rotation.z` turns. On the ground that is counter-clockwise as seen from above.
- **`yaw`** turns about +Y of the mesh as `Object3D.rotation.y` turns, counter-clockwise as seen
  from above: a sprite with `yaw = angle` at a position in the mesh draws where a sprite of
  `FlatPlacement` draws in a mesh turned by `rotation.y = angle`, at that position turned back by
  the angle. A sprite with a yaw of 0 faces +Z, one with a yaw of π/2 faces +X.
- On the ground both turn about +Y in the same sense; a kind there needs one of them, and
  `Rotation` is the one every kind knows.
- **The quaternion** turns as `Object3D.quaternion` turns: a sprite with a quaternion `q` at a
  position in the mesh draws where a sprite of the same plane without a turn draws in a mesh
  turned by `q`, at that position turned back by the inverse of `q`. `setYaw(angle)` writes the
  quaternion of a turn about +Y, the same facing as a `yaw` of that angle.

`yaw` is a static attribute, as `quadSize` and `color` are: signs, fences and trees turn once. A
sprite that turns every frame belongs in a geometry built with `attributeUsage: {dynamic: ['yaw']}`.
It costs 4 bytes per sprite and a sine and a cosine per vertex; a kind without it builds the graph
it builds without it, and a plane costs nothing beyond a swizzle.

`orientation` is static as well, `attributeUsage: {dynamic: ['orientation']}` for a sprite that
turns every frame. It costs 16 bytes per sprite and two cross products per vertex, `v + 2 · q.xyz ×
(q.xyz × v + q.w · v)`. The placement does not normalize: a quaternion out of `Quaternion` is of
unit length, one of another length scales the sprite by the square of it. Take `Yaw` where a turn
about +Y is all a sprite needs — a quarter of the bytes and a number to write instead of four —
and `Orientation` where a sprite leaves the vertical.

A sprite whose yaw or quaternion turns its back to the camera is culled under `FrontSide` — for
signs on a facade that is what you want. A cut-out seen from both sides draws with
`side: DoubleSide` and shows its back mirrored; the color stage of a feature of your own can tell
the back by `frontFacing` of `three/tsl`.

`BillboardPlacement` stands in for every form of `flatPlacement()` and back; a sprite kind with
`Yaw` or `Orientation` keeps the attribute under a billboard and ignores it.
`flatPlacement({orientation: 'yaw'})` stands in only for a placement of a kind that holds `Yaw`,
`flatPlacement({orientation: 'quaternion'})` only for one of a kind that holds `Orientation`; a kind
that holds both swaps between the two.

### Axis billboards

`BillboardPlacement` is spherical: it lays the quad onto the camera's right and up. Under a 2.5D
camera that looks down at the scene, a spherical billboard leans back with the camera, and a
character that stands on the ground seems to float or sink at its feet. An **axis billboard** — a
cylindrical billboard — turns about an up axis of the mesh to face the camera and stays upright:
the look of sprites in a 3D world, of Doom, of Paper Mario.

```ts check
import {
  AnimatedFrames,
  AxisBillboardPlacement,
  axisBillboardPlacement,
  defineSprite,
  FeatureSprites,
  InstancePosition,
  QuadBase,
  QuadSize,
  TextureColor,
} from '@spearwolf/twopoint5d';

// upright along +Y of the mesh: the ground is the XZ plane
const Character = defineSprite({
  base: QuadBase,
  features: [InstancePosition, AxisBillboardPlacement, QuadSize, AnimatedFrames, TextureColor],
});

// upright along +Z: for a mesh laid out in the XY plane
const Marker = defineSprite({
  base: QuadBase,
  features: [InstancePosition, axisBillboardPlacement({axis: 'z'}), QuadSize, TextureColor],
});

// the quads stand on their feet: the pivot at the bottom edge
const characters = new FeatureSprites(Character, {capacity: 64, baseArgs: [0.5, 0.5, 0, 0.5]});
const markers = new FeatureSprites(Marker, {capacity: 16});
characters.dispose();
markers.dispose();
```

- The x of the local vertex — trimmed, scaled, sheared and turned already — goes onto the level
  direction across the axis and the direction towards the camera position, `normalize(cross(axis,
  camera − instancePosition))`; its y goes onto the axis. As for `BillboardPlacement`, the camera
  position is brought into the local space of the mesh, so a mesh may be moved, turned and scaled
  evenly; the sprites at the edge of the view turn towards the camera position, under a
  perspective and an orthographic camera alike.
- **Straight along the axis** the facing is undefined. Within a sine of 0.1 of the axis — about 6° —
  the right of the quad turns over to the right of the camera, as `LightFacingPlacement` turns over
  within a sine of 0.1 of the normal. A sprite seen exactly along its axis is a line either way.
- `axisBillboardPlacement()` returns one frozen feature per axis; `AxisBillboardPlacement` is
  `axisBillboardPlacement()`. The two forms are named `axisBillboardPlacement` and
  `axisBillboardPlacement+z`; an axis other than `'y'` and `'z'`, and options that are no object,
  throw a `TypeError`.
- It brings nothing but its placement stage, so it stands in for `FlatPlacement`, every
  `flatPlacement()` and `BillboardPlacement` on a live material, and they for it. A kind with `Yaw`
  or `Orientation` keeps the attribute under it and ignores it.
- Cost: no data, and per vertex about what `BillboardPlacement` costs — two normalizations, a
  length and a select.

### Segments: ropes, chains, lasers

A rope, a chain, a laser, a lightning bolt, a tracer, the edge of a graph: a quad stretched from one
point to another. `SegmentEnd` gives each sprite a second point, and `segmentPlacement()` lays the
quad from its `instancePosition` to its `segmentEnd` — no position, size or rotation worked out per
segment on the CPU, and one draw call for every rope of a scene. The physics stays in the game: the
sprites draw whatever a simulation writes.

```ts check
import {
  AtlasFrame,
  defineSprite,
  FeatureSprites,
  InstancePosition,
  QuadBase,
  QuadSize,
  SegmentEnd,
  SegmentPlacement,
  segmentPlacement,
  TextureColor,
  Tint,
} from '@spearwolf/twopoint5d';

// a rope in the XY plane: the 2D case
const Rope = defineSprite({
  base: QuadBase,
  features: [InstancePosition, SegmentEnd, SegmentPlacement, QuadSize, AtlasFrame, TextureColor],
});

// a laser in a 3D scene: turned about itself to face the camera
const Laser = defineSprite({
  base: QuadBase,
  features: [InstancePosition, SegmentEnd, segmentPlacement({facing: 'camera'}), QuadSize, AtlasFrame, TextureColor, Tint],
});

const points = Array.from({length: 9}, (_, i) => ({x: i * 16, y: -Math.sin((i / 8) * Math.PI) * 24}));
const ropes = new FeatureSprites(Rope, {capacity: 64});
const links = points.slice(1).map(() => {
  const link = ropes.createSprite()!;
  link.setSize(4, 4); // 4 thick, caps of 2 beyond each end, so that the links overlap at the joints
  return link;
});

const lasers = new FeatureSprites(Laser, {capacity: 16});
const beam = lasers.createSprite()!;
beam.setPosition(0, 1, 0);
beam.setSegmentEnd(0, 1, -40);
beam.setSize(0.5, 0.5); // round caps of a quarter unit, half a unit thick

export function frame() {
  // the simulation moved the points; each link runs from one to the next
  links.forEach((link, i) => {
    link.setPosition(points[i]!.x, points[i]!.y);
    link.setSegmentEnd(points[i + 1]!.x, points[i + 1]!.y);
  });
  ropes.update(); // both ends are dynamic attributes: every update() uploads them
  lasers.update();
}
```

- **`QuadSize` keeps its meaning.** `height` is the thickness. `width` is the extra length of the
  caps, half of it beyond each end: `setSize(thickness, thickness)` gives a round frame room to
  close the rope. Without `QuadSize` the local quad is the unit quad — one unit thick, caps of half
  a unit.
- **Where a vertex lies** along the segment is its base `uv.x`, 0 at the start and 1 at the end; its
  local x — after `QuadSize` — moves it on for the caps, its local y across for the thickness. With
  `baseArgs` of `[0.5, 0.5, 0.5, 0]` the local x runs from 0 to `width`, and the whole cap sits
  beyond the end. On `gridBase({columns: n, rows: 1})` every column line lies at its own point of
  the segment: a strip that a mesh stage of one's own can bend into a lightning bolt.
- **The facings.** `segmentPlacement()` — `SegmentPlacement` — lays the segment into the XY plane of
  the mesh, its thickness to the left of its direction: a segment from left to right shows its frame
  upright and faces +Z, as a flat sprite does. `segmentPlacement({plane: 'xz'})` lays it onto the
  ground: a segment along +X shows the top of its frame towards −Z and faces +Y, as
  `GroundPlacement` lays a sprite. `segmentPlacement({facing: 'camera'})` turns the quad about the
  segment until its face looks at the camera position, brought into the local space of the mesh as
  for the billboards — the 3D case, under a perspective and an orthographic camera alike.
- **`Anchor`** says where on the image the segment runs: `anchorY` across it — 0.5, the default, the
  middle of the thickness, 1 the foot of the image, so a plank lies on its rope — and `anchorX` how
  the caps split — 0 puts the whole of `width` beyond the end, 1 before the start. It mirrors with
  the image under `Flip`, as everywhere.
- **Degenerate segments draw something.** A segment shorter than `1e-6` — a new one, which starts
  and ends at the origin — draws its caps quad, `width × height`, along +X in the plane or along the
  right of the camera. A segment along the normal of its plane takes the plane's up as its across.
  A segment that points at the camera turns its across over to the camera's up within a sine of 0.1,
  as an axis billboard turns its right, and draws the line it is from there. Nothing is NaN.
- **No `Rotation`, no `Shear`.** A segment lies along its ends whatever its local quad does, so
  `defineSprite()` refuses either next to a segment placement — `a segment lies along its ends, so
  it cannot follow the local stage of "rotation" — move the ends instead, and take Rotation out of
  the kind`. `Yaw` and `Orientation` are data and are ignored, as under a billboard.
- **No `NineSlice`.** `NineSlice` sets its border in the local quad, and a segment holds only its
  caps there — the border would land inside the segment —, so `defineSprite()` refuses it next to a
  segment placement, and a segment placement cannot stand in on a live nine-slice material. For a
  bar with fixed ends, lay a nine-slice panel with `FlatPlacement`, turn it with `Rotation` and
  stretch it with `setSize(length, thickness)`, or draw the ends as sprites of their own at both
  ends of a segment, with `TextureColor` or `RepeatingTextureColor`.
- **Swaps.** The three forms — named `segmentPlacement`, `segmentPlacement+xz` and
  `segmentPlacement+camera` — bring nothing but their placement stage and their check, so they stand
  in for each other on a live material. A flat placement or a billboard may stand in for one too,
  and draws the quad of `QuadSize` at the start of each segment — rarely what a rope wants.
  `segmentPlacement()` refuses a facing or a plane it does not know, a `plane` next to
  `facing: 'camera'` and options that are no object with a `TypeError`.
- **The texture along the segment.** `TextureColor` stretches the frame from end to end.
  `RepeatingTextureColor` repeats it, its texels kept square: `(length / thickness) / aspect` times,
  with `length` the segment and its caps, `thickness` the `height` and `aspect` the width over the
  height of the frame as drawn. A 64 × 16 frame on a segment 8 long and 1 thick repeats twice. It
  takes the place of `TextureColor` (a kind holds one color source) and needs `QuadSize`:

  ```ts check
  import {
    AtlasFrame,
    defineSprite,
    FeatureSprites,
    InstancePosition,
    QuadBase,
    QuadSize,
    RepeatingTextureColor,
    SegmentEnd,
    SegmentPlacement,
    type TextureAtlas,
  } from '@spearwolf/twopoint5d';
  import type {Texture} from 'three/webgpu';

  declare const bridge: TextureAtlas;
  declare const bridgeTexture: Texture;

  const Chain = defineSprite({
    base: QuadBase,
    features: [InstancePosition, SegmentEnd, SegmentPlacement, QuadSize, AtlasFrame, RepeatingTextureColor],
  });

  const chains = new FeatureSprites(Chain, {capacity: 32, textures: {colorMap: bridgeTexture}});
  const chain = chains.createSprite()!;
  chain.setFrame(bridge.frame('chain')!); // 64 × 16 pixels: one repetition every 4 thicknesses
  chain.setPosition(0, 100);
  chain.setSegmentEnd(96, 40);
  chain.setSize(0, 8);
  chains.update();
  ```

  It works per fragment — the repeat wraps exactly, and a uv stage of the kind runs per fragment
  under it. Along the segment the frame repeats, across it is held at its edges, and the lookup
  keeps half a texel inside the frame, so a linear sample never reaches the neighbouring frame of an
  atlas. A mipmapped `colorMap` is sampled with explicit gradients — any `colorMap` whose filters
  are not both `NearestFilter` — so the repeat shows no seam of the smallest mip level at its wraps;
  the smaller mip levels of an atlas still mix neighbouring frames (see "Atlas frames on meshes of
  one's own"). Under `Flip` with `flipX` the segment shows the mirror image of the unflipped one:
  the frame mirrored, its repeat counted from the end, so a repeat that is no whole number ends
  where the unflipped one begins; `flipY` turns the frame upside down across the segment. The art
  repeats on a column boundary: a frame whose last column leads into its first, as the segment
  frames of the lookbook's rope bridge do. A trimmed frame is stretched over the quad — pack segment
  frames untrimmed. The math is the one of `sampleAtlasFrame()`, with `wrap: ['repeat', 'clamp']`,
  `trim: 'stretch'` and `inset: 0.5`.
- **Joins.** Two segments meet in a gap or an overlap on the outside of a bend. Caps of the
  thickness and a round frame hide it for ropes; a mitred ribbon is a mesh of its own.
- **Passes.** `ShadowPass` turns every sprite to the light about its instance position, and
  `BillboardReflectionPass` places it as a billboard there — of a segment, both would draw the quad
  of its caps at its start, so both refuse a kind of segments, and the sprites refuse a segment
  placement swapped in under them through `placement` or handed in as the option `placement` —
  each naming the pass to take.
  `SegmentShadowPass` projects each segment onto the ground as it lies: `ShadowPass` without the
  turn to the light, named `shadow` as well. `ReflectionPass` mirrors the placed vertex, which is
  the mirror image of a segment in a plane. A segment that faces the camera mirrors into a ribbon
  that faces the mirror image of the camera, as a mirrored billboard does: the camera sees it at
  twice its height angle above the mirror, thinner the higher the camera, edge on at 45° — no pass
  ships for that; draw the reflected ropes of a mirror in a plane.
- **Cost.** 12 bytes per sprite for the end, uploaded with every `update()`; per vertex two lengths
  and two divisions in the plane, a cross product and a dot product more facing the camera.

## FeatureSprites

`FeatureSprites` is the mesh of a kind: a `VertexObjects` that builds the `FeatureSpritesGeometry`
and the `FeatureSpritesMaterial` it is not handed, and hands out the sprites.

```ts check
import {
  AtlasFrame,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  Rotation,
  TextureColor,
  Tint,
} from '@spearwolf/twopoint5d';
import {Scene, Texture} from 'three/webgpu';

const FancySprite = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Rotation, AtlasFrame, TextureColor, Tint],
});

const colorMap = new Texture();
const sprites = new FeatureSprites(FancySprite, {capacity: 1000, textures: {colorMap}, transparent: true});

const scene = new Scene();
scene.add(sprites);

const sprite = sprites.createSprite();
if (sprite != null) {
  sprite.setPosition(10, 20, 0);
  sprite.setSize(32, 32);
  sprite.rotation = Math.PI / 4;
  sprite.setTexCoords(0, 0, 0.5, 0.5);
}

// once per frame, before rendering
sprites.update();

// later
if (sprite != null) sprites.freeSprite(sprite);
sprites.dispose();
colorMap.dispose();
```

The options are the ones of the geometry (`capacity`, `attributeUsage`, `baseArgs`) and of the
material (`textures`, `uniforms`, `placement` and every three.js material parameter) side by side,
and `passes` (see "Passes: shadows and reflections").
`createSprite()` answers `undefined` once the pool is full, and the first time it does it says so on
the console — once per mesh, naming the `name` of the mesh, its capacity and the fix: twice the
capacity for `new FeatureSprites(kind, {capacity})`, or for the `FeatureSpritesGeometry` in the
`geometry` slot — handed in or put there later.
`spritePool.createVO()` is the pool's own API and stays silent. `placement`, `uniforms`,
`setUniform()`, `getTexture()`, `setTexture()` and `touchTexture()` pass through to the material.

**Growing capacity.** Where the count is not known up front — bullets, sparks, vector balls —
`grow: true` lets a full pool grow instead of refusing:

```ts check
import {FeatureSprites, TexturedSpriteKind} from '@spearwolf/twopoint5d';
import {Texture} from 'three/webgpu';

const colorMap = new Texture();
const bullets = new FeatureSprites(TexturedSpriteKind, {capacity: 64, grow: true, textures: {colorMap}});

// the 65th createSprite() doubles the pool to 128, and never answers undefined for want of room
for (let i = 0; i < 100; i++) bullets.createSprite()?.setPosition(i, 0, 0);
bullets.update();
```

- **What a growth does.** The `createSprite()` that finds every slot in use builds a geometry of
  twice the capacity — at least 1 — on the same descriptor (`attributeUsage` stays) with the same
  base (`baseArgs` stay), moves every sprite over and answers a sprite of the new pool. Every handle
  stays the same object, in the same slot, with its values: a sorted mesh stays sorted. The mesh and
  every pass mesh draw the new geometry; materials, textures, uniforms and bindings never held the
  geometry and stay as they are. The old geometry is disposed — it was the mesh's own.
- **The price** is a frame hitch: every used slot of every attribute copied, new gpu buffers, and
  all of it uploaded on the next frame, the static attributes included. The doubling keeps the
  copies of n sprites at about 2n in all. The first growth says so on the console, once per mesh,
  through `console.info`, with the capacity to start with; the warning of a full pool never comes
  under `grow`. Where the count is known, a capacity that fits is still the cheaper way.
- **Read `geometry` and `spritePool` afresh.** Both are new objects after a growth, and the ones
  kept from before are disposed. Only `createSprite()` grows — `spritePool.createVO()` is the pool's
  own API and does not.
- **Refused**: `grow: true` next to a `geometry` handed in, which the mesh does not own and cannot
  replace (a `TypeError` that names the fix); a `grow` that is no boolean. A geometry with pools
  attached through `attachInstancedPool()` cannot grow, and the `createSprite()` that would grow it
  throws, naming both ways out. Nor does a geometry the caller put into the `geometry` slot: a
  growth replaces only the geometry the mesh built, and the `createSprite()` that would grow another
  throws, naming the ways out — the built one back into the slot, or a capacity that fits. The pool
  behind it is `VertexObjectPool#adoptVOs()` — see [the vertex
  objects](../src/vertex-objects/README.md#growing-a-pool).

**Ownership.** The mesh disposes the geometry and the material it built, and nothing else. A
`geometry` or a `material` handed in, and every texture, stays the caller's; `dispose()` leaves
them alone. A mesh built around a geometry handed in still disposes the material it built for it.
A material or a geometry the caller puts into the `material` or `geometry` slot of the mesh stays
the caller's as well: `dispose()` releases the ones the mesh built even then, and lets go of the
other. A geometry put into the `geometry` slot is the geometry of the sprites from then on: the mesh
and every pass mesh draw it, `createSprite()`, `freeSprite()`, `sortBy()`, `sortByViewDepth()` and
`spritePool` work on its pool, and a handle of the geometry before stays with that one. A material
put into the `material` slot changes only how the mesh draws. `placement`, `uniforms`,
`setUniform()`, `bindUniform()`, the textures and the passes stay with the material of the sprites —
the built one or the one handed in — whatever the slot holds; a material put into the slot that is
to draw with the uniforms and textures of the sprites is built on them before the swap,
`new FeatureSpritesMaterial(kind, {resources: sprites.material.resources})` — as `SpritePicker`
builds its pick material.

**Refusals.** A `TypeError` instead of a mismatch: a kind that did not come from `defineSprite()`;
options that are no object, `passes` that are no list, a `grow` that is neither `true` nor `false`;
a `geometry` or a `material` that is no `FeatureSpritesGeometry` or `FeatureSpritesMaterial`, or one
built for another sprite kind; `capacity`, `attributeUsage`, `baseArgs` or `grow: true` next to a
`geometry`; any material parameter next to a `material`. The geometry and the material the
constructor builds throw their own refusals in their own name — `baseArgs` that are no list —, and
the uniforms and textures in the name of the class that builds them: `FeatureSpritesMaterial`
without passes, `FeatureSprites` with them — `textures` that are no object. A material that cannot
be built (a `placement` that cannot stand in, a texture name no feature declares) throws as well,
and the geometry the constructor built for it is disposed first, so a refused constructor leaves
nothing behind.

**After `dispose()`.** The mesh leaves the scene graph and fires the `dispose` event of three.
`geometry`, `material`, `spritePool`, `placement` and `uniforms` answer `undefined`;
`createSprite()` and `getTexture()` answer `undefined`; `freeSprite()`, `setUniform()`,
`setTexture()`, `touchTexture()` and `update()` do nothing; `sortBy()` and `sortByViewDepth()`
answer `false`; `passes` is empty. `bindUniform()` binds nothing and the `placement` setter changes
nothing, and both go on refusing what they refuse otherwise: `bindUniform()` something that is no
source, the setter a malformed feature and one that cannot stand in for the placement of the kind.
A second `dispose()` does nothing.

## Draw order: sorting the sprites

The sprites of a mesh are drawn in the order of their slots in the pool, and nobody chose that
order: `createSprite()` appends, `freeSprite()` moves the last sprite into the freed slot. Opaque
sprites and sprites cut out by the alpha test do not care — the depth test sorts them per pixel.
Sprites that blend do:

- **top-down and isometric games**, where the sprite lower on the screen covers the one above it
  and soft edges rule out the alpha test — sort by `y`;
- **vector balls, particle and billboard clouds**, transparent and drawn back to front from
  wherever the camera stands — sort by the view depth;
- **UI sprites** in a layer order of their own — sort by a key of your own.

```ts check
import {
  BillboardPlacement,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  TextureColor,
} from '@spearwolf/twopoint5d';
import {PerspectiveCamera, Texture} from 'three/webgpu';

const colorMap = new Texture();

// a top-down scene in the xy plane, y up the screen: the lower sprite stands in front
const Actor = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, TextureColor]});
const actors = new FeatureSprites(Actor, {capacity: 200, textures: {colorMap}, transparent: true});

// a cloud of billboards, drawn back to front from wherever the camera stands
const Ball = defineSprite({base: QuadBase, features: [InstancePosition, BillboardPlacement, QuadSize, TextureColor]});
const balls = new FeatureSprites(Ball, {capacity: 500, textures: {colorMap}, transparent: true});
const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 1000);

// every frame: write the sprites, sort, update(), render
actors.sortBy('y', {descending: true});
actors.update();

balls.sortByViewDepth(camera);
balls.update();
```

- **`sortBy(key, {descending})`** takes the name of a number property of the sprite handle — `'y'`,
  `'z'`, `'rotation'`, `'width'` … — or a function of the sprite, `(sprite) => number`. A name is
  read straight from the buffer; a function is called once per sprite, and a fractional key it
  answers may cost a heap number of 16 B per sprite where V8 does not inline it. A name that is no
  value of the sprite is refused, with the list of the ones there are. Which way is in front depends
  on the scene: with y up the screen, `sortBy('y', {descending: true})`; with the sprites standing
  on the xz ground and the camera on the +z side, the nearer sprite has the larger z —
  `sortBy('z')`.
- **`sortByViewDepth(camera)`** sorts back to front as `camera` sees them, by the depth of the
  position of each sprite — the centre of its quad — in view space, through the world matrices of
  the mesh and the camera, which it refreshes. Perspective and orthographic cameras alike. A kind
  without `InstancePosition` has no position to measure and is refused, naming the fix; every
  built-in placement requires it, so only a placement of one's own meets that.
- **Stable.** Sprites of the same key keep their order, so a sort every frame never swaps two
  sprites on one row back and forth. A `NaN` key goes last, behind the infinities too.
- **The order of a frame**: write the sprites, sort, `update()`, render. A sort after `update()`
  reaches the gpu a frame late. Both answer whether a sprite moved.
- **The passes follow.** A pass draws the geometry of the sprites, so it draws the same order.
  The overlapping shadows of `ShadowPass`, one colour, look the same in any order. A mirror does
  not keep the order: `ReflectionPass` and `BillboardReflectionPass` reverse the depth along the
  mirror normal — above a floor, the sprite nearest a camera that looks down has the reflection
  farthest from it. The reflection of a cloud sorted back to front blends back to front where the
  camera looks along the mirror, and the steeper it looks onto the mirror, the more of it blends
  out of order. Where that shows, give the reflection a blend that needs no order —
  `definePass({...BillboardReflectionPass, material: {...BillboardReflectionPass.material,
  blending: AdditiveBlending}})`, a glowing reflection on a dark floor — or a darker
  `reflectionColor`, which hides the mistakes. A pass that wants an order of its own needs a mesh
  of its own.
- **The price.** The sort moves every attribute of the sprites that change their slot, so it marks
  them for upload — the static ones included, which otherwise go up only when they are touched. A
  mesh sorted every frame whose order changes uploads about everything every frame: 76 B a sprite
  for `TexturedSpriteKind`, 760 KB a frame for 10 000 of them, against the 160 KB its dynamic
  attributes upload anyway. A sort that finds the order as it is moves and uploads nothing. Sort
  every frame where the camera or the sprites move; sort once where neither does.
- A handle stays the same object and keeps its values through a sort; only its slot changes. The
  pool behind it is `VertexObjectPool#sortBy()` — see [the vertex
  objects](../src/vertex-objects/README.md#sorting-a-pool).

**Across meshes** the sort has no say: three.js draws every opaque mesh before every transparent
one, whatever their `renderOrder`. A 2D scene of several meshes in painter's order — a backdrop,
the actors, a UI layer — needs `transparent: true` on **every** mesh, the ones that look opaque
too, and a `renderOrder` per layer: three sorts the transparent meshes by `renderOrder`, then by
the depth of the origin of each mesh, back to front, then by the order they were created in. A
layer that has to cover what lies nearer to the camera — a UI over the scene — takes
`depthTest: false` and `depthWrite: false` as well.

## Picking: which sprite is under the pointer

`FeatureSprites` places its vertices in the shader, so three's raycaster finds nothing to hit, and
a hit test against positions and sizes is wrong for every sprite that is rotated, sheared, trimmed,
billboarded or animated. `SpritePicker` asks the gpu instead: it draws the meshes it is handed into
the one pixel under the pointer, each sprite through its own graph, and reads back which sprite
landed there.

```ts check
import {AxisBillboardPlacement, defineSprite, FeatureSprites, Flash, InstancePosition, QuadBase, QuadSize, SpritePicker, TextureColor} from '@spearwolf/twopoint5d';
import {PerspectiveCamera, Texture, WebGPURenderer} from 'three/webgpu';

const Enemy = defineSprite({base: QuadBase, features: [InstancePosition, AxisBillboardPlacement, QuadSize, TextureColor, Flash]});
const enemies = new FeatureSprites(Enemy, {capacity: 64, textures: {colorMap: new Texture()}});

const renderer = new WebGPURenderer();
const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 1000);
const picker = new SpritePicker(renderer);

renderer.domElement.addEventListener('pointerdown', async (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
  };
  const hit = await picker.pick(camera, pointer, [enemies]);
  hit?.sprite.setFlash(1, 1, 1, 1); // the enemy under the pointer, or nothing
});
```

- **The answer** is `{sprites, sprite, index}` — the mesh out of the list, the handle, the slot it
  was drawn from — or `undefined` where no sprite is under the pointer. The list may hold meshes of
  several kinds; the result is typed as the union of their picks. `pointer` is in normalized device
  coordinates of the view of `camera`, x and y from -1 to 1, y up, and is snapped to the centre of
  the pixel it lies in, so the pick lands where the screen draws that pixel.
- **Pixel-perfect for free.** The colour of every sprite runs through its own colour source and
  colour stages — `Tint`, `Fade` and the rest — and the alpha test of its material drops the same
  texels it drops on the screen: a click into the transparent corner of a frame picks what lies
  behind it, a sprite faded to 0 is not hit, and neither is one hidden by `Visible`. The id is written after all of it (three's
  `outputNode`), so no colour stage can change it.
- **The nearest sprite wins**, by the depth test, whatever the sprites blend or write. At one depth
  — a 2D scene on one plane — the sprite drawn later wins, as on the screen: the later slot of a
  mesh, the later mesh by `renderOrder`. Only the sprites are drawn, not their passes: a shadow or a
  reflection is nothing to hit. A mesh that is disposed, not visible, whose material is not visible,
  or empty is left out.
- **One frame of latency.** The answer comes once the gpu has drawn and the pixel is read back —
  fine for a click, and for hover every frame too. Pick after `update()`, as you render.
- **Sorted and growing meshes work.** The pick resolves a slot to its handle as the slots stood at
  the draw, so a `sortBy()`, a `sortByViewDepth()` or a growth before the read back changes nothing
  about the answer; a sprite freed in between answers `undefined`. The price is a copy of one
  reference per sprite of the listed meshes per pick. A sprite without a handle — written into the
  pool through `createFromAttributes()` — gets one when the pick hits it, and answers `undefined`
  when a sort, a free or a growth moved the slots before the read back.
- **The cost** of a pick is a draw of the listed meshes into one pixel — every vertex of every
  sprite, a fragment only under the pointer — and that copy. List the meshes that can be hit, not
  the whole scene.
- **The renderer** is left as the pick found it: render target, MRT, clear colour and the
  `autoClear` flags. The picker draws into a 1 × 1 float target — three's WebGL 2 backend reads no
  integer target back — with no blending, no tone mapping and no output colour space, so the id
  arrives exactly, up to 2²⁴ sprites per mesh; a mesh of more is refused with a `RangeError` before
  the draw rather than answered with the wrong sprite. A material's `side`, alpha test, opacity,
  `maskNode`, `alphaHash` and `alphaToCoverage` reach its pick as they reach the screen.
- **Ownership.** The renderer, the camera and the meshes stay the caller's. The camera takes the
  coordinate system of the renderer, as its next render would; its depth convention stays as it is —
  under a reversed depth buffer the pick turns its projection over itself. The pointer and the list
  are taken as they are at the call. The picker builds a pick mesh and a pick material per mesh on
  the geometry, the uniforms and the textures of that mesh — a `setUniform()` or `setTexture()`
  reaches the pick as it reaches the sprites —, follows a swapped placement, releases them when the
  mesh is disposed, and builds them anew after a growth or a geometry put into the slot. Until then
  the picker holds the mesh, listed again or not: a mesh taken out of the scene and never disposed
  lives as long as the picker — dispose it, or the picker. `dispose()`
  releases the target and every pick material and rejects every pick still in flight; a `pick()`
  after it answers `undefined`. A camera, a pointer or a list of the wrong shape is refused with a
  `TypeError` that names the fix.

## Presets

Two kinds ship ready-made, with the layout, the names and the start values of the textured and the
animated sprites of earlier versions: `TexturedSpriteKind` (`InstancePosition`, `FlatPlacement`,
`QuadSize`, `Rotation`, `AtlasFrame`, `TextureColor`, `Tint`) and `AnimatedSpriteKind`
(`InstancePosition`, `FlatPlacement`, `QuadSize`, `Rotation`, `AnimatedFrames`, `TextureColor` — no
tint). Both sit on `QuadBase`. A kind with one more feature is a `defineSprite()` away.
`TexturedSprite` and `AnimatedSprite` are their sprite handles,
`SpriteOf<typeof TexturedSpriteKind>` and `SpriteOf<typeof AnimatedSpriteKind>`: the type of a pool
or a function that takes their sprites, `VertexObjectPool<TexturedSprite>`.

```ts check
import {FeatureSprites, TexturedSpriteKind} from '@spearwolf/twopoint5d';
import {Color, Scene, Texture} from 'three/webgpu';

const colorMap = new Texture();
const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1000, textures: {colorMap}, transparent: true});

const scene = new Scene();
scene.add(sprites);

const sprite = sprites.createSprite();
if (sprite != null) {
  sprite.setPosition(10, 20, 0);
  sprite.setSize(32, 32);
  sprite.setTexCoords(0, 0, 0.5, 0.5);
  sprite.setColor(new Color(1, 0.5, 0.25), 0.8);
}

// once per frame, before rendering
sprites.update();

sprites.dispose();
colorMap.dispose();
```

The animated preset needs the `animsMap` of a `FrameBasedAnimations` next to the `colorMap`, and the
`time` uniform moves the animations. The `animsMap` holds the frames of every animation as float
data, which an 8-bit image cannot carry: it comes out of `bakeDataTexture()`, never out of an
image file.

```ts check
import {AnimatedSpriteKind, FeatureSprites, FrameBasedAnimations, TextureCoords} from '@spearwolf/twopoint5d';
import {Scene, Texture} from 'three/webgpu';

const colorMap = new Texture();

// four frames of 64 × 64 side by side on a sheet of 256 × 64, half a second for the round
const sheet = new TextureCoords(0, 0, 256, 64);
const anims = new FrameBasedAnimations();
const walk = anims.add(
  'walk',
  0.5,
  [0, 1, 2, 3].map((i) => new TextureCoords(sheet, i * 64, 0, 64, 64)),
);
const animsMap = anims.bakeDataTexture();

const sprites = new FeatureSprites(AnimatedSpriteKind, {
  capacity: 1000,
  textures: {colorMap, animsMap},
  uniforms: {time: 0},
  transparent: true,
});

const scene = new Scene();
scene.add(sprites);

const sprite = sprites.createSprite();
if (sprite != null) {
  sprite.setPosition(10, 20, 0);
  sprite.setSize(32, 32);
  sprite.animId = walk;
  sprite.animOffset = 0.25;
}

// once per frame
export function frame(now: number) {
  sprites.setUniform('time', now);
  sprites.update();
}
```

`AnimatedFrames` declares the `animsMap` with `needsImage`: the animation drops out of the graph
until the texture has an image with measures, which a baked texture has from the start. An
`animsMap` handed in before its image is there — its image written into the same texture later,
which three does without an event — takes `touchTexture('animsMap')` once the image is in place.

## Writing a feature

A feature is a plain object handed to `defineFeature()`, which checks every field of it and
freezes it, the records and lists inside included. This one turns a sprite grey — a statue of
stone, a frozen enemy, a locked item: an attribute of one value per sprite, `dynamic` because it
may change from frame to frame, a property `grayscale` on the handle, a start value of 0, and a
color stage that mixes the color towards its luminance. The stage runs at `ColorOrder.Tint - 25`,
in the gap between the palette swap and the tint, so a tint colors the grey — a statue in blue.

```ts check
import {
  AtlasFrame,
  ColorOrder,
  defineFeature,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  TextureColor,
  Tint,
} from '@spearwolf/twopoint5d';
import {luminance, mix, vec3, vec4} from 'three/tsl';
import type {Node} from 'three/webgpu';

export interface GrayscaleApi {
  /** 0 draws the sprite in its colors, 1 in grey. */
  grayscale: number;
}

export const Grayscale = defineFeature<GrayscaleApi>({
  name: 'grayscale',
  attributes: {grayscale: {size: 1, usage: 'dynamic'}},
  initialize() {
    this.grayscale = 0;
  },
  color: {
    order: ColorOrder.Tint - 25,
    transform: (color, {attribute}) =>
      vec4(mix(color.rgb, vec3(luminance(color.rgb)), attribute<'float'>('grayscale')), color.a) as unknown as Node<'vec4'>,
  },
});

const Statue = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, Grayscale, Tint],
});

const sprites = new FeatureSprites(Statue, {capacity: 100});
const sprite = sprites.createSprite();
if (sprite != null) {
  sprite.grayscale = 1;
  sprite.setColorValues(0.6, 0.7, 1, 1);
}
sprites.dispose();
```

`Fade` and `Flash` are built the same way, a dozen lines each.

The fields, and the rules `defineFeature()` and `defineSprite()` hold them to:

- **`name`** — required, unique within a kind; every error about the feature names it, and
  `requires` of other features refers to it.
- **`attributes`** — instance attributes in the form of a vertex object description (see [vertex
  objects](../src/vertex-objects/README.md)). They are merged into the one description of the kind,
  so an attribute name is unique across the features and must not be one of the base (`position`,
  `uv`); the merged layout has to fit into one sprite. An attribute is `static` unless it says
  otherwise: give one that changes every frame `usage: 'dynamic'`.
- **`usageAliases`** — words a caller of `attributeUsage` may use for attributes of this feature,
  `{size: ['quadSize']}`. A word names only attributes of its own feature and may be named like one
  of them (`texCoords` of `AtlasFrame`). A word is unique across the kind, with one exception: a
  word named after an attribute whose feature declares it is open to the other features, each adding
  attributes of its own — `NineSlice` adds `sliceInsets` to `texCoords`, so they travel with the
  frame `setSliceFrame()` writes them with. A word named after an attribute of a feature that does
  not declare it is refused.
- **`methods`** — methods of the sprite handle, `this` being the sprite. Every property the
  attributes generate and every method name is unique across the kind. A method that hands
  fractional values of its caller to a generated setter writes them into a tuple declared once at
  module level and hands that on, as `setSize()` of `QuadSize` does: separate arguments of a call
  V8 does not inline are boxed, 16 bytes each.
- **`initialize()`** — writes the neutral values into a slot `createSprite()` hands out: a freed
  slot comes back with the values of its last sprite, and without `initialize()` a new sprite
  keeps them. It runs for every sprite created, so it allocates nothing.
- **`uniforms`** — start values by name: a finite number for a `float`, 2 to 4 finite numbers for a
  `vec2` to `vec4`. A name is unique across the kind — unless it is declared shared, `{value: 0,
  shared: true}`: the features that declare a name shared, with the same type and start value, hold
  one uniform, and one `setUniform()` writes it for all of them. `AnimatedFrames` shares its `time`,
  so a wave, a bob or a particle reads the same clock. A shared and a plain declaration of one name,
  or two shared ones of another type or start value, are refused, naming the fix. Every stage of the
  kind reads every uniform, through `uniform(name)` of its context.
- **`textures`** — the textures the feature samples, by name, `{needsImage: true}` for one that
  counts as set only once its image has measures. A name is unique across the kind. The textures
  stay the caller's. Until all of them are set the feature drops out of the graph.
- **`nearestTextures`** — textures, by name, the feature reads texel for texel — its own or
  another feature's, as `PaletteSwap` names the `colorMap`. The sprites say once on the console,
  per mesh and texture, when one of them is set with an image and filtered with anything but
  `NearestFilter` for `magFilter` or `minFilter`; a texture whose image a loader fills in later is
  judged when `touchTexture()` re-reads it. A name no feature declares is passed over.
- **`frame`** — the frame slot, at most one feature per kind: answers `texCoords`, and optionally
  `flipDiagonal`, `trim` and `mirror`, read by both pipelines.
- **`frameStage`** — a stage `{order, transform(frame, ctx)}` on the frame, after the frame slot —
  or the defaults, without a frame feature — and before anything reads it. It answers a whole
  frame: one with no business with `flipDiagonal` or `trim` passes them on, `{...frame,
  texCoords}`. A stage that mirrors the drawn image says so in `mirror` — `vec2`, 1 along each axis
  it mirrored, as `Flip` writes it —, so that a stage which places something on the image mirrors
  it along. Its context is the one of the frame slot, without `frame` and `uv`. The lookup reads
  `(s + uv.x · u, t + uv.y · v)` before the diagonal swap, so the drawn x is the `s` axis for every
  frame, a turned atlas frame included, and `trim` holds the margins of the sprite as drawn.
- **`local`**, **`mesh`**, **`uv`**, **`color`** — a stage `{order, transform}` in its slot;
  `order` is a finite number, lower runs first, and a tie keeps the order of the feature list.
  `FrameOrder`, `LocalOrder`, `MeshOrder`, `UvOrder` and `ColorOrder` name the bands. A `uv` stage
  transforms the `vec2` the color source samples at. A `mesh` stage runs before `MeshOrder.Hide`, or
  maps one point to one point after it: `Visible` collapses a hidden sprite there.
- **`placement`** — maps the local vertex into the local space of the mesh: exactly one feature of
  a kind, and it declares no textures, since the placement runs always. A pass may bring one in
  place of the kind's — see "Passes: shadows and reflections".
- **`colorSource`** — the color before the color stages, at most one feature per kind.
- **`requires`** — names of other features that have to be part of the same kind; never the
  feature's own name.
- **`checkKind(kind)`** — checks the kind the feature is part of, shown `{base, features}`, and
  throws for one the feature cannot work in, with a message that names the fix: a stage that needs
  a grid base refuses the quad, a placement refuses a feature whose stage it cannot follow.
  `defineSprite()` runs it last, once every other check has passed, and refuses the kind as
  `defineSprite: feature "name": <message>` — the message of a thrown `Error`, a thrown string
  itself, any other thrown value quoted like a refused value (`{code: 1}`); a pass runs the checks
  of its features against the features it draws with, and a placement that stands in on a live
  material runs its own against the kind with itself in place of the kind's placement. Where two
  features of a kind share a name — two forms of one factory, as `wave()` gives every form the name
  `wave` — `defineSprite()` asks the `checkKind` of the first before every other check, so that it
  can say why a kind takes one; a check that lets it pass leaves the plain refusal, `two features
  are named "wave"`.

A field of the wrong type — a stage without a `transform`, a method that is no function, a texture
declared with anything but `{}` or `{needsImage: true}` — is refused with a `TypeError` naming the
feature and the field and quoting the value. `defineSprite()`, `definePass()` and the placement swap
hold a feature that never passed through `defineFeature()` to the same rules.

A stage reads through its context: `attribute(name)` for an attribute of the kind or the base,
`uniform(name)` for a uniform any feature of the kind declares, `sample(name, uv)` for a texture
the feature declares itself, and `textureSize(name)` and `colorSpace(name)` for a texture any
feature of the material declares. The material throws, naming the feature, for any other name.
`colorSpace(name)` answers the `colorSpace` of the texture as it is set — `undefined` while it is
unset, or for `needsImage` until its image has measures — and is a tracked read: a texture in
another colour space builds the graph anew, so a stage can work in the values of the texture data
(`PaletteSwap` encodes both colours back to sRGB for an `srgb` palette before it compares them).
`textureSize()` of a set texture is the size of the texture the shader binds, read on the gpu — it
follows an image that a loader fills in after `setTexture()`, and a texture of the same kind swapped
in without a rebuild; for a texture declared with `needsImage` it is a uniform, re-read by
`touchTexture(name)`. The size of a texture of another feature — the `colorMap` of the color source,
to know a frame in texels — is `(0, 0)` while that texture is unset, and the stage does not wait for
it: a stage that divides by it takes `max(size, 1)`. Every stage after the frame slot gets `frame`,
the frame after the frame stages, and `uv`, the uv after the uv stages — built the first time a
stage of a graph reads it, so a graph that never reads it builds no uv stage; in a uv stage `uv` is
the stage's own input. `attribute('uv')` stays the base uv, where the vertex lies on the base.

`sample()` builds its lookup when the graph is built, and the material keeps the node to hand it
a new texture of the same kind. A lookup made inside a TSL `Fn`, `If` or `Loop` callback, which
three runs while it compiles the shader, escapes it: build every lookup in the stage itself, and
unroll a loop over lookups in JavaScript, as `AnimatedFrames` unrolls its search.

A feature that brings nothing but a stage reads what other features hold, and says so with
`requires`: `defineSprite()` then refuses a kind without them, naming both features, instead of
the material failing on a missing attribute or uniform. This one lets sprites bob up and down,
reading the `instancePosition` of `InstancePosition`, and declares the `time` it reads shared: in a
kind with `AnimatedFrames` it reads the time of the animations, in a kind without it a time of its
own — either way one `setUniform('time', t)` drives it:

```ts check
import {defineFeature, MeshOrder} from '@spearwolf/twopoint5d';
import {add, sin, vec3} from 'three/tsl';
import type {Node} from 'three/webgpu';

export const Bob = defineFeature({
  name: 'bob',
  requires: ['instancePosition'],
  uniforms: {time: {value: 0, shared: true}},
  mesh: {
    order: MeshOrder.Offset,
    transform: (position, {attribute, uniform}) => {
      const phase = add(uniform<'float'>('time'), attribute<'vec3'>('instancePosition').x);
      return add(position, vec3(0, sin(phase), 0)) as unknown as Node<'vec3'>;
    },
  },
});
```

A frame stage and a uv stage, both worth a few lines. `StripStep` shows the frame `step` places to
the right of the sprite's own frame in a strip of frames of one size — a digit of a counter, a tile
of a row — by moving `s` by `step · u`, so it works on every frame feature. `Zoom` scales the uv
about the middle of the frame by `zoom`, a magnifier over the sprite's image — 0.5 shows the
middle half at twice its size; it is affine, so the per-vertex uv of `TextureColor` stays exact:

```ts check
import {defineFeature, FrameOrder, UvOrder} from '@spearwolf/twopoint5d';
import {add, mul, sub, vec4} from 'three/tsl';
import type {Node} from 'three/webgpu';

export const StripStep = defineFeature<{step: number}>({
  name: 'stripStep',
  attributes: {step: {size: 1}},
  initialize() {
    this.step = 0;
  },
  frameStage: {
    order: FrameOrder.Flip - 50,
    transform: (frame, {attribute}) => {
      const {texCoords} = frame;
      const s = add(texCoords.x, mul(attribute<'float'>('step'), texCoords.z));
      return {...frame, texCoords: vec4(s, texCoords.y, texCoords.z, texCoords.w) as unknown as Node<'vec4'>};
    },
  },
});

export const Zoom = defineFeature({
  name: 'zoom',
  uniforms: {zoom: 1},
  uv: {
    order: UvOrder.Slice + 100,
    transform: (uv, {uniform}) => add(0.5, mul(sub(uv, 0.5), uniform<'float'>('zoom'))) as unknown as Node<'vec2'>,
  },
});
```

## Passes: shadows and reflections

A sprite that throws a shadow onto the ground, or shows a reflection on it, is drawn twice: once
as itself, once as its shadow or mirror image. The second draw reads the same sprites — the same
positions, sizes, rotations and frames — and differs in its shader alone: the vertex lands
somewhere else, projected onto the ground or mirrored at it, and the color is something else, a
dark mask or a darker, fainter copy.

A **pass** is such another way to draw the sprites of a kind. `definePass()` takes a name, the
features whose stages the pass adds, the features of the kind whose stages it leaves out
(`without`), three.js material parameters, and a `renderOrder` — a pass with a lower one is drawn
before the sprites. `FeatureSprites` builds a child mesh for every pass in its `passes` option:
the same pool and the same geometry, a material of its own, built from the features of the kind
without those `without` names plus the features of the pass. The sprite data goes up to the gpu
once per frame, whatever the number of passes; each pass costs one draw call.

Projections and mirrors are `mesh` stages: they work on the placed vertex, after the placement. A
pass may bring a placement of its own, which takes the place of the placement of the sprites for
that pass alone: `ShadowPass` turns every sprite to face the light before it projects it, and
`BillboardReflectionPass` places every billboard so that its reflection faces the camera.

```ts check
import {FeatureSprites, ShadowPass, TexturedSpriteKind} from '@spearwolf/twopoint5d';
import {Scene, Texture} from 'three/webgpu';

const colorMap = new Texture();
const sprites = new FeatureSprites(TexturedSpriteKind, {
  capacity: 1000,
  textures: {colorMap},
  uniforms: {shadowColor: [0, 0, 0, 0.4]},
  passes: [ShadowPass],
});

// the light comes from above, a little from the left; it points towards the light.
// the ground is the XZ plane of the mesh
sprites.setUniform('shadowLight', -0.5, 1, -0.3, 0);
sprites.setUniform('groundPlane', 0, 1, 0, 0);

const scene = new Scene();
// the mesh of the shadow is a child of the sprites and comes along
scene.add(sprites);

const sprite = sprites.createSprite();
if (sprite != null) {
  sprite.setPosition(0, 16, 0);
  sprite.setSize(32, 32);
  sprite.setTexCoords(0, 0, 1, 1);
}

// once per frame, for the sprites and every pass
sprites.update();

// a FeatureSpritesPass over the geometry of the sprites, drawn before them
const shadow = sprites.passes['shadow'];

sprites.dispose();
colorMap.dispose();
```

The rules:

- **The shape.** `definePass()` refuses with a `TypeError` a pass that is no object, `features` that
  are no list, a `without` that is no list of names, and `uniformNames` or `material` that are no
  objects; a `renderOrder` that is no finite number throws a `RangeError`. The sprites check the
  same for a pass that never went through `definePass()`, in their own name.
- **No data.** A pass draws the data of the sprites. `definePass()` refuses a feature that brings
  attributes, methods, `initialize()` or usage aliases, and two features of one name. Everything a
  pass reads comes from a feature of the kind; a `requires` of a pass feature is met by the kind or
  by the pass, or the sprites refuse the pass.
- **`without`** leaves out the stages of features of the kind, by name; their data stays. The
  sprites refuse a name the kind does not hold and the placement — a pass draws with the
  placement of the sprites or brings one of its own. A `without` ties a pass to the kinds that
  hold what it names.
- **A placement of its own.** At most one feature of a pass brings a `placement`; `definePass()`
  refuses a second. The pass draws with it in place of the placement of the kind, whose feature
  stays with its data and loses its placement stage for this pass alone. Like every placement it
  reads the local vertex — trimmed, scaled, sheared and turned already — and maps it into the
  local space of the mesh; the mesh stages of the pass follow.
- **Shared uniforms and textures.** The material of the sprites and every pass material share
  one set of uniforms and textures, which `textures` and `uniforms` start: `setUniform()` and
  `setTexture()` of the sprites reach every pass, and the shadow of an animated sprite shows the
  frame the sprite shows, since `time` is one uniform for all of them. Two features — of the kind
  or of any pass — that declare the same name are refused, and so are two passes of one name.
- **Renamed uniforms.** `uniformNames` maps names the features of the pass declare to names of
  the pass; the pass draws with copies of its features that declare and read those names, at the
  start values of the feature. Only the features of the pass are renamed, never those of the kind
  (`time` stays one uniform), and textures are not renamed. `definePass()` refuses a name no
  feature of the pass declares — a member of `Object.prototype` such as `toString` included — a
  target that is no string or the empty string, two names with one target and a target that a
  feature of the pass declares under its own name (the identity `{a: 'a'}` is fine); a target that
  collides with a uniform of the kind or of another pass is refused as "both declare the uniform",
  and so is one target that two renamed copies of one pass give to two different uniforms —
  `{shadowLight: 'x'}` in one copy of `ShadowPass` and `{groundPlane: 'x'}` in another.
- **A copy shares.** `definePass({...ShadowPass, name: 'twin'})` without `uniformNames` reads the
  uniforms of `ShadowPass` and draws the same shadow a second time. This is not refused, since two
  passes may share a uniform on purpose — one `reflectionColor` for two reflections.
- **Placement.** A placement swap on the sprites reaches every pass material that draws with the
  placement of the sprites; a pass that brings its own keeps it. A placement a pass cannot draw next
  to is refused before any material takes it, and a placement the material of the sprites refuses
  reaches no pass.
- **`update()` once.** The pass meshes have no `update()` of their own; `update()` of the sprites
  uploads the geometry once for all of them. It also judges the `visible` hooks of the passes.
- **Ownership.** The pass meshes are children of the sprites: they move with them and leave the
  scene graph with them. `passes` answers them by pass name, `FeatureSpritesPass` meshes whose
  `material` is the material of the pass. `dispose()` releases the pass meshes, their materials
  and the shared uniforms and textures, and `passes` is empty afterwards; a geometry handed in
  and every texture stay the caller's. The pass meshes draw the geometry in the `geometry` slot of
  the sprites and follow a geometry put there, as they follow a growth. Passes need a material the
  sprites build, so they are refused next to a `material` handed in.

Four passes ship ready-made. All are `transparent`, write no depth, draw both sides of a triangle
(`side: DoubleSide`) and take a `renderOrder` of -1; `ShadowPass` takes a polygon offset as well
(`polygonOffset`, with a factor and units of -1), and so does `SegmentShadowPass`. A plane is
`[n.x, n.y, n.z, d]`, the plane `dot(n, p) = d` in the local space of the mesh; `n` need not be a
unit vector, so `[0, 2, 0, 4]` is the plane `y = 2`. A ground or a light in the scene graph need not
be worked out by hand — see "Binding uniforms to the scene graph" below:

| pass | features | uniforms (start value) | what it draws |
| --- | --- | --- | --- |
| `ShadowPass` | `LightFacingPlacement`, `PlanarShadow`, `ShadowMask` | `shadowLight` (`[-0.4, 1, -0.3, 0]`), `groundPlane` (`[0, 1, 0, 0]`), `shadowColor` (`[0, 0, 0, 0.5]`) | the sprite turned to face the light, projected from `shadowLight` onto `groundPlane` — along a direction towards the light (`w = 0`) or from a point light (`w = 1`) — in `shadowColor`, its alpha multiplied by the alpha of the sprite |
| `ReflectionPass` | `MirrorAtPlane`, `Darken` | `mirrorPlane` (`[0, 1, 0, 0]`), `reflectionColor` (`[0.5, 0.5, 0.5, 0.5]`) | the sprite mirrored at `mirrorPlane`, `p − 2 · (dot(n, p) − d) · n / dot(n, n)`, its color multiplied by `reflectionColor`, alpha included — the reflection of a flat sprite |
| `BillboardReflectionPass` | `MirroredBillboardPlacement`, `MirrorAtPlane`, `Darken` | as `ReflectionPass` | the reflection of a billboard: facing the camera, as large as the sprite on screen, flipped across the mirror — in `reflectionColor` |
| `SegmentShadowPass` | `PlanarShadow`, `ShadowMask` | as `ShadowPass` | the sprite projected as it lies, not turned to the light — the shadow of a segment sprite, or of a decal; named `shadow` |

Which pass suits which placement:

| placement | shadow | reflection |
| --- | --- | --- |
| `FlatPlacement`, `flatPlacement()` | `ShadowPass` — turned to the light; for decals `SegmentShadowPass`, projected as they lie | `ReflectionPass` |
| `BillboardPlacement` | `ShadowPass` | `BillboardReflectionPass` |
| `AxisBillboardPlacement`, `axisBillboardPlacement()` | `ShadowPass` | `ReflectionPass` |
| `SegmentPlacement`, `segmentPlacement()` | `SegmentShadowPass` — the segment projected as it lies; `ShadowPass` refuses the kind | `ReflectionPass` for `'plane'`; facing the camera, the mirrored ribbon thins out towards a camera 45° above the mirror; `BillboardReflectionPass` refuses the kind |

`ShadowPass` turns every sprite to the light, whatever its placement, so an axis billboard throws
the shadow a flat or a spherical one throws. An axis billboard stands along its axis, so in a mirror
across the axis — the ground, for `'y'` — its mirror image is an upright quad that faces the camera
level as the sprite does: `ReflectionPass` draws it meeting the sprite at its foot, as large as the
sprite on screen. `BillboardReflectionPass` would lean that reflection towards the camera while the
sprite stands upright. In a mirror of another tilt `ReflectionPass` shows the mirror image of the
card as it stands, as for a flat sprite.

`ShadowPass` and `SegmentShadowPass` carry the hook `shadowFallsOnPlane` (see "Leaving a pass out
for a frame" below); the two reflections carry none and are drawn whenever they are on.

**The ground plane has no edge.** `PlanarShadow` projects onto `groundPlane`, an infinite plane,
and nothing clips the shadow to a ground mesh: on a bounded ground — an island, a table, a
platform — a shadow that reaches past the edge hangs in the air beyond it. Keep the sprites away
from the edge on the side the shadows fall to, by the length of their shadow — `h · √(lx² + lz²) /
ly` for a sprite `h` tall under a directional light `(lx, ly, lz)` over the XZ ground — or let the
ground reach past every shadow.

`SegmentShadowPass` is named `shadow`, as `ShadowPass` is, and `BillboardReflectionPass` is named
`reflection`, as `ReflectionPass` is: a kind takes one or the other of each pair.

**The turn to the light.** A sprite is flat. Projected as it stands, a sprite that the light sees
at a slant throws a thin, stretched shadow, and one it sees edge on throws a line — a billboard
too, since it faces the camera, not the light. `LightFacingPlacement` turns every sprite about its
instance position to face the light before `PlanarShadow` projects it, flat or billboard alike, so
the shadow is never smaller than the sprite: the projection of a quad across the light grows by
`1 / cos` of the angle between the light and the normal of the plane. Its local x runs across the
light and level with the plane, its y up and away from the light, so the shadow of a sprite whose
anchor sits at its foot starts at the foot and runs straight away from the light. Two consequences:

- The sprite turns its face to the light. A light behind the sprite sees its face as well, so that
  shadow shows the sprite left for right as the camera sees it. Keeping the camera's side instead
  would flip the shadow over at once as the light passes the side of the sprite.
- For a light straight above the plane, up across the light is undefined. Within a sine of 0.1 of
  the normal the top of the quad turns over to the view of the camera — away from it, as the
  sprite reads on screen; outside it the camera plays no part, and the shadow stays where it is
  as the camera moves.

The shadow follows the light, not the placement, so it does not change under a placement swap,
and it ignores the plane and the turn of `flatPlacement()`. For sprites that lie in the ground —
decals, `GroundPlacement` — the turn is wrong: they would throw the shadow of a standing quad. A
pass that projects the sprites as they stand leaves the placement out: `SegmentShadowPass`, which is
`definePass({...ShadowPass, features: [PlanarShadow, ShadowMask]})` and draws segment sprites as
well. It keeps the yaw or the quaternion, too, and throws the shadow of a sign as it is turned —
thin where the light grazes it.

**The reflection of a billboard.** `ReflectionPass` mirrors the placed vertex, which is right for a
flat sprite: its mirror image is what the camera would see in the mirror. A billboard faces the
camera, so its mirror image faces the mirror image of the camera, and the camera sees it at twice
its height angle `θ` above the mirror: the reflection shrinks by `|cos 2θ|`, lies edge on at a
camera 45° above the mirror and shows its back beyond — the usual angle of a 2.5D camera.
`MirroredBillboardPlacement` places each sprite so that, once mirrored, the quad stands at the
mirror image of the instance position, faces the camera and is flipped within its own plane
across the normal of the mirror as the camera sees it: upside down below a mirror on the ground,
left for right beside one, as large as the sprite on screen. A sprite whose anchor sits at its
foot on the mirror meets its reflection there. The pass keeps its placement through a placement
swap of the sprites — a billboard reflection of flat sprites is a reflection that does not match
them, so swap the pass with the placement.

**The light of the shadow.** `shadowLight` is a homogeneous light `[x, y, z, w]`. With the plane
`(n, d)`, the placed vertex `p` and the light `(l, w)`, the shadow is:

```text
h_p  = dot(n, p) − d                         height of the vertex above the plane
h_L  = dot(n, l) − w · d                     height of the light
e    = w · max(h_p − 0.95 · h_L, 0)          how far a vertex reaches above the clamp
p_c  = p − n · e / dot(n, n)                 the vertex, brought down by e along the normal
L    = l − w · p_c                           direction from the vertex towards the light
p'   = p_c − L · (h_p − e) / dot(n, L)
```

`w = 0` is a direction *towards* the light, so the start value `[-0.4, 1, -0.3, 0]` is a light
that travels along `[0.4, -1, 0.3]`; `w = 1` is a point light at `[x, y, z]`, and its shadows
spread. A vertex near or above a point light is brought down along the normal to `0.95` of the
height of the light first, so its shadow grows long but stays finite, in the plane and on the far
side of the light: measured across the normal, it lands at most 19 times the offset of the vertex
from the light beyond the vertex. The normal need not be a unit vector.

`ShadowPass` keeps the tint of the kind: `ShadowMask` replaces the color anyway, and the alpha of
the tint — or a `Fade` — fades the shadow along with the sprite. `ShadowMask` and `Darken` run in
`ColorOrder.Pass`, after every color stage of the kind, so a `Flash` leaves the shadow as it is and
flashes the reflection darkened; a color stage of one's own that has to come after them takes an
order above `ColorOrder.Pass`. `ShadowPass` leaves nothing out, so it draws
`AnimatedSpriteKind`, which holds no tint, as well. A reflection needs no flip of its own:
mirroring the placed vertex turns the sprite upside down and keeps the frame where it is.

**Both sides.** A mirror turns the winding of every triangle it draws, and a projection onto the
ground turns it whenever the shadow falls towards the camera, as it does for a sprite seen from
the front and above under a light from above and behind it — the start value of `shadowLight`
is one. three decides what to cull by the `side` of the material and the world matrix of the mesh,
never by the vertex shader, so with the default `FrontSide` such a reflection or shadow is culled
and nothing is drawn. Every pass that ships therefore draws with `DoubleSide`, and so does a pass of
one's own that mirrors or projects.

**The scene around them.** Each preset expects something of the ground it is drawn on:

- **`ShadowPass`** lies exactly in `groundPlane`. A ground mesh in that plane has the same depth
  under every pixel, and the two would fight over it; the polygon offset of the pass pulls the
  shadow in front of the ground, so it wins the depth test. It writes no depth, so whatever stands
  on the ground still covers it.
- **`ReflectionPass`** and **`BillboardReflectionPass`** lie on the far side of `mirrorPlane`,
  behind the ground the camera looks at. An opaque ground hides it: three draws opaque meshes before
  transparent ones, and the reflection then fails the depth test. Draw the ground transparent, so
  that it comes after the reflection and lets it show through, or switch the depth test of the pass
  off — `sprites.passes['reflection']!.material.depthTest = false` — which draws the reflection over
  everything drawn before it.

A second light throws a second shadow through a renamed copy of `ShadowPass`: the same features,
uniforms of other names.

```ts check
import {definePass, FeatureSprites, ShadowPass, TexturedSpriteKind} from '@spearwolf/twopoint5d';

export const MoonShadowPass = definePass({
  ...ShadowPass,
  name: 'moonShadow',
  uniformNames: {shadowLight: 'moonLight', groundPlane: 'moonGround', shadowColor: 'moonShadowColor'},
});

const sprites = new FeatureSprites(TexturedSpriteKind, {
  capacity: 100,
  passes: [ShadowPass, MoonShadowPass],
  uniforms: {moonShadowColor: [0, 0, 0.1, 0.3]},
});
// a point light: its shadows spread
sprites.setUniform('moonLight', -30, 80, 20, 1);
sprites.dispose();
```

**Leaving a pass out for a frame.** A pass may carry a `visible` hook,
`(uniform: (name: string) => SpriteUniformNode) => boolean`. `update()` of the sprites asks it once
per frame, for every pass that has one, and the answer decides whether the pass mesh is drawn.
`uniform(name)` answers the uniform the features of the pass read under `name`, through
`uniformNames`: the hook of a renamed copy judges the renamed uniforms. The lookup reaches every
uniform of the sprites, not only those of the pass — the `time` of an animated kind resolves —
and throws from `update()` for a name that is no uniform of the sprites at all. A hook that throws
stops neither the other passes nor the upload: `update()` throws once it is done, naming the pass,
and the pass keeps the visibility of its last judgement. The hook runs every frame and must
allocate nothing, so it reads the `value` of a node and does not build a vector.
`definePass()` refuses a `visible` that is no function.

`ShadowPass` carries `shadowFallsOnPlane`. The sprites stand on the side of `groundPlane` its
normal points to, so the shadow falls only if the light lights that side. For a direction
(`w = 0`) the cosine between the normal and `shadowLight` has to exceed 0.001; a light from below
or one that runs parallel to the plane, or grazes it, leaves the pass out. A point light
(`w = 1`) has to lie above the plane. A point light at or below the plane, and a direction
parallel to it, have no defined shadow, and the hook leaves exactly those frames out instead of
drawing something that runs off to infinity.

To switch a pass off yourself, set `enabled` on its mesh — `sprites.passes['shadow']!.enabled =
false` — and not `visible`: `update()` writes `visible` for a pass with a hook. The pass is drawn
while it is enabled and its hook agrees; a pass without a hook follows `enabled` alone.

```ts check
import {definePass, FeatureSprites, ReflectionPass, TexturedSpriteKind} from '@spearwolf/twopoint5d';
import type {Vector4} from 'three/webgpu';

// a reflection drawn only while the mirror faces up
export const UpwardReflectionPass = definePass({
  ...ReflectionPass,
  name: 'upwardReflection',
  visible: (uniform) => (uniform('mirrorPlane').value as Vector4).y > 0,
});

const sprites = new FeatureSprites(TexturedSpriteKind, {passes: [UpwardReflectionPass]});
sprites.update();
sprites.passes['upwardReflection']!.enabled = false;
sprites.dispose();
```

A pass of one's own is a `definePass()` over features of one's own, written as `PlanarShadow`
and `ShadowMask` are — see "Writing a feature". A placement of a pass may read the uniforms of
another feature of the pass without declaring them, as `LightFacingPlacement` reads those of
`PlanarShadow` and names it in `requires`; a renamed copy of the pass renames those reads as well.

**Shadow and reflection together.** `passes: [ShadowPass, ReflectionPass]` needs nothing more: their
uniforms have distinct names. Their `renderOrder`, though, is -1 for both, and the pair needs the
order reflection < ground < shadow < sprites. A reflection lies behind a transparent ground and has
to be drawn before it to show through; a shadow lies on the ground, writes no depth and has to be
drawn after it, or the ground covers it. Set it through `sprites.passes['shadow']!.renderOrder` or
`definePass({...ShadowPass, renderOrder})`.

The limits:

- **Overlapping shadows darken twice.** Two transparent shadows that overlap darken each other,
  which a real shadow does not. A stencil test per pass, or the shadows drawn into a render
  target of their own and laid over the ground once, would avoid it; both lie outside the
  feature model.
- **No fade by distance yet.** A reflection that fades with its distance from the ground needs
  the placed vertex in the color stages, and the material hands the color stages no such node.
  `ReflectionPass` fades evenly, by the alpha of `reflectionColor`.
- **One uniform name, one value.** The uniforms are shared, so two passes that read
  `shadowLight` read the same light. A second light takes a renamed copy of the pass:
  `uniformNames`, as `MoonShadowPass` above does.
- **A light per sprite.** Uniforms hold for every sprite of a `FeatureSprites`, and a pass brings
  no data; sprites under different lights are sprites in different meshes.

## Binding uniforms to the scene graph

The planes and the light of the passes are uniforms in the local space of the sprites, a plane in
the form `dot(n, p) = d`. A ground mesh and a light, though, live in the scene graph, each in a
space of its own, and either of them — or the sprites — may move every frame. A **binding** works
the uniform out of a node every frame: `bindUniform(name, source)` hands the uniform `name` to a
`SpriteUniformSource`, and `update()` lets the source write it.

```ts check
import {FeatureSprites, lightOf, planeOf, ReflectionPass, ShadowPass, TexturedSpriteKind} from '@spearwolf/twopoint5d';
import {DirectionalLight, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Scene} from 'three/webgpu';

const scene = new Scene();
const ground = new Mesh(new PlaneGeometry(400, 400), new MeshBasicNodeMaterial({transparent: true}));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const sun = new DirectionalLight();
sun.position.set(-80, 160, 120);

const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 100, passes: [ReflectionPass, ShadowPass]});
scene.add(sprites);

// the shadow and the reflection follow the ground and the sun, wherever they and the sprites move
sprites.bindUniform('groundPlane', planeOf(ground));
sprites.bindUniform('mirrorPlane', planeOf(ground));
sprites.bindUniform('shadowLight', lightOf(sun));

// reflection < ground < shadow < sprites
sprites.passes['reflection']!.renderOrder = -3;
ground.renderOrder = -2;
sprites.passes['shadow']!.renderOrder = -1;

// once per frame, after the changes, before rendering
sprites.update();

sprites.dispose();
ground.geometry.dispose();
ground.material.dispose();
```

**`planeOf()`** writes a plane `[n.x, n.y, n.z, d]` — for `groundPlane`, `mirrorPlane` or a plane
uniform of one's own:

- `planeOf(node)` takes the local XY plane of the node, the normal +Z: the plane a
  `PlaneGeometry` lies in, its front face on the side the normal points to. A ground built as
  `rotation.x = -Math.PI / 2` has its normal at +Y. The node is read where it is in each frame —
  turned, moved, scaled unevenly, its parents included; its world matrix is refreshed for it.
- `planeOf(node, {plane})` takes `plane` in the local space of the node instead. The plane is
  copied, so a later change of it does not reach the source.
- `planeOf(plane)` takes a fixed three `Plane` in world space, copied as well. three's `Plane` is
  `dot(n, p) + constant = 0`, so `d` is `-constant`: the plane `y = 2` is `new Plane(new
  Vector3(0, 1, 0), -2)`.

The normal is not normalized; the features do not need it to be. **The sprites stand on the side
the normal points to**, and the hook of `ShadowPass` judges the light by it: turn the plane
over, and the shadow is left out. A `mirrorPlane` or `groundPlane` whose normal is `(0, 0, 0)` is
no plane: `ReflectionPass`, `BillboardReflectionPass`, `ShadowPass` and `SegmentShadowPass` draw
nothing for it.

**`lightOf()`** writes a homogeneous light `[x, y, z, w]` for `shadowLight`:

- a `DirectionalLight`: `w = 0` and the direction *towards* the light, from its `target` to it.
  The light and its target are read where they are in each frame, the target outside the scene
  as well.
- any other node — a `PointLight`, a `SpotLight` (its cone is ignored), an `Object3D` that marks
  a lamp: `w = 1` and its position, a point light.

An `AmbientLight` or a `HemisphereLight` is taken as any node; its position means nothing, and
neither does the shadow it throws.

Both check what they are handed when they are called: `lightOf()` refuses a node that is no
`Object3D`, `planeOf()` a target that is neither an `Object3D` nor a `Plane`, options that are no
object and an `options.plane` that is no `Plane`, each with a `TypeError`, and a plane whose normal
or constant is no finite number with a `RangeError`.

The rules of `bindUniform()` and `unbindUniform()`:

- **Checks.** `bindUniform()` throws a `TypeError` for a name no feature of the sprites or their
  passes declares, for a source whose `type` is not the type of the uniform, and for something
  without a `type` of `vec3` or `vec4` and a `write()`. Nothing is bound when it throws.
- **One binding a name.** A second `bindUniform()` of a name replaces the source and keeps its
  place; the bindings run in the order they were made. `unbindUniform(name)` ends a binding, and
  the uniform keeps the value written last; without a binding it does nothing.
- **The binding wins.** `setUniform()` on a bound name writes the value, and the next `update()`
  overwrites it. It does not throw, so a start value set before the binding is fine.
- **Every pass.** The uniforms are shared, so a bound uniform reaches the sprites and every pass
  that reads it, a renamed one of a copy of `ShadowPass` included.
- **Ownership.** The nodes and the `Plane` a source reads stay the caller's. `dispose()` drops
  every binding, so the sprites hold no node after it; afterwards `bindUniform()` binds nothing and
  still throws a `TypeError` for something that is no source, and `unbindUniform()` does nothing, as
  `setUniform()` does.
- **A material handed in.** Bindings write into the uniforms of the material of the sprites, so they
  work with a `material` handed in as well — for the uniforms that material holds —, and never into
  a material put into the `material` slot later. A material shared by several
  `FeatureSprites` at different transforms shares its uniforms too, so their bindings overwrite
  each other and the last `update()` wins.

**The order of `update()`.** With bindings, `update()` first refreshes the world matrix of the
sprites and their parents and inverts it, then lets every source write its uniform, in the order
of the bindings, then judges the `visible` hook of every pass, and uploads the geometry last.
The hooks therefore judge the values the bindings wrote in the same call: a light bound below the
ground leaves the shadow out in that very frame. Without bindings and hooks `update()` is the
upload alone. A source or a hook that throws stops neither the others nor the upload; `update()`
throws what they threw at its end, naming the uniform or the pass.

`update()` refreshes the world matrices it reads itself, because the renderer runs
`scene.updateMatrixWorld()` only inside `render()`, after `update()`. A node moved after
`update()` in the same frame shows up one frame late — move first, then `update()`, then render.

**A source of one's own.** `SpriteUniformSource` is a `type` — `'vec3'` or `'vec4'`, the type of
the uniform it writes — and `write(out, worldToSprites)`. `out` is the vector of the uniform node
itself, and `worldToSprites` the inverse of the world matrix of the sprites, current for this
frame: the source writes its value in the local space of the sprites. `write()` runs every frame,
so it writes the fields of `out` and allocates nothing — no vector built per call, and no
fractional number handed across a call it makes, since V8 boxes such a value at a call it leaves
un-inlined. Scratch objects are built once, next to the source.

```ts check
import {FeatureSprites, type SpriteUniformSource, ShadowPass, TexturedSpriteKind} from '@spearwolf/twopoint5d';
import {Object3D} from 'three/webgpu';

// a lamp that hovers 40 units above a node, wherever the node goes
const hoverAbove = (node: Object3D): SpriteUniformSource => ({
  type: 'vec4',
  write(out, worldToSprites) {
    node.updateWorldMatrix(true, false);
    const p = node.matrixWorld.elements;
    const e = worldToSprites.elements;
    const y = p[13]! + 40;
    out.x = e[0]! * p[12]! + e[4]! * y + e[8]! * p[14]! + e[12]!;
    out.y = e[1]! * p[12]! + e[5]! * y + e[9]! * p[14]! + e[13]!;
    out.z = e[2]! * p[12]! + e[6]! * y + e[10]! * p[14]! + e[14]!;
    out.w = 1;
  },
});

const player = new Object3D();
const sprites = new FeatureSprites(TexturedSpriteKind, {passes: [ShadowPass]});
sprites.bindUniform('shadowLight', hoverAbove(player));
sprites.update();
sprites.dispose();
```

What does not work:

- **Sprites below the plane.** A sprite on the far side of the plane has no shadow, yet the
  projection draws one. Only a vertex knows its side, and a sprite that crosses the plane cannot
  be cut in the vertex shader.
- **A finite ground.** The plane is infinite, the ground mesh is not: a shadow beyond its edge
  hangs in the air. Clipping it to the mesh needs a stencil, or a clip in the fragment stage in
  the local space of the ground.
- **A light per sprite.** A binding writes a uniform, and a uniform holds for every sprite of a
  `FeatureSprites`; sprites under different lights are sprites in different meshes.

## Atlas frames on meshes of one's own

The frames of an atlas are not only for sprites. A road, a facade or a sky cylinder with a
`NodeMaterial` of its own reads them through an `AtlasFrameTable` and `sampleAtlasFrame()`:

```ts check
import {sampleAtlasFrame, atlasFrameTable, type TextureAtlas} from '@spearwolf/twopoint5d';
import {attribute, uv} from 'three/tsl';
import {MeshBasicNodeMaterial, type Texture} from 'three/webgpu';

declare const atlas: TextureAtlas;
declare const atlasTexture: Texture;

// index 0, 1, 2 — the order of the list
const frames = atlasFrameTable(atlas, ['road', 'boost', 'start']);

const material = new MeshBasicNodeMaterial();
material.colorNode = sampleAtlasFrame(atlasTexture, frames, attribute<'float'>('frame'), uv().mul(4), {
  origin: 'bottom-left',
  wrap: 'repeat',
  inset: 0.5,
});
```

**The table.** `atlasFrameTable(atlas)` takes every frame, the index of a frame its frame id —
a frame `DynamicAtlas#remove()` let go of is left out, and the frames after it move up one;
with a list of names, or a `RegExp` matched as `frameNames()` matches it, the index is the
position in that selection, and `indexOf(name)` answers it. `new AtlasFrameTable(frames)` takes
a list of atlas frames or bare `TextureCoords`. A frame takes three `vec4` of a uniform array —
the three texels of a frame in the animsMap: tex coords, `[width, height, flipDiagonal, 0]` (a `0`
where the animsMap keeps the end time), trim margins — so a turned, flipped or trimmed frame needs
nothing of the caller. `update()` reads the frames again after their `coords` changed and allocates
nothing; three uploads the array with every render. The table owns no GPU resource and has no
`dispose()`.

A table holds at most `AtlasFrameTable.MaxFrames`, 341 frames: WebGL 2 promises 16 KiB for a
uniform block, and the constructor refuses more with a `RangeError` — split them into several
tables. Every table a material samples takes one uniform block of the fragment shader, of which
WebGL 2 and WebGPU promise 12 and three takes some itself: a few tables per material are safe,
too many make the shader fail to build, which three reports on the console.

**Sampling.** Everything is worked out per fragment, nothing passes through a varying, so a
frame can repeat on a surface.

- `origin` is required. `'bottom-left'` is three's `uv()` on its own geometries, v counted
  upwards; `'top-left'` is the convention of `TextureCoords`.
- `wrap: 'clamp'` (the default) holds the uv at the edge of the frame, `'repeat'` repeats it; a
  pair `[u, v]` wraps each axis on its own — `['repeat', 'clamp']` runs a frame around a cylinder
  and keeps its top and bottom edges.
- `trim: 'mask'` (the default) lets the uv stand for the untrimmed sprite, as the quad of a sprite
  does: outside the part the packer cut the frame out of, the result is `vec4(0)` — the material
  needs transparency or an alpha test for it. `'stretch'` lays the trimmed area over the whole uv.
- `inset` keeps the lookup that many texels of the drawn frame away from its edges, so that a
  linear sample, or a nearest one right at a wrap, does not reach the frame beside it in the atlas.
- The index may be a number, an int node or a float node, which is rounded to the nearest frame, a
  half up, on WebGPU and WebGL 2 alike: 2.5 draws frame 3. Every index is clamped to the frames of
  the table, **silently**: an index past the last frame draws the last frame.

`atlasTexture` is the image of the atlas loaded with `flipY = false`, as `TextureFactory` and
`TextureStore` load it; with `flipY = true` every frame is read from the wrong place, and nothing
checks it.

**Mipmaps.** With a `minFilter` that reads mipmaps the sample takes explicit gradients from the uv
before the wrap, so a repeated frame shows no seam of the smallest mip level along its wraps; the
filter is read when the graph is built. The smaller mip levels of an atlas still mix neighbouring
frames — sample an atlas with mipmaps only when its packer pads or extrudes the frames. A surface
that repeats one image is better served by that image as a texture of its own with
`RepeatWrapping`.

## Glow: emissive sprites with bloom

A sprite glows — a neon sign, a laser, a spark, an emissive light — when its color is brighter
than white and the stage it is drawn in blooms. Nothing beyond the built-in parts is needed:

- `Tint` writes a float color, and nothing in the material clamps it: a tint above 1 draws a color
  above white.
- `Stage2D` renders through three's `pass()`, whose target holds half floats, so that color
  survives into the composition of the stages.
- `createBloomOutputNodeBuilder({threshold: 1})` lets only what is brighter than white into the
  bloom. A sprite at or below white — a texel of 255 under a tint of 1 — stays out of it.

```ts check
import {
  createBloomOutputNodeBuilder,
  type Display,
  FeatureSprites,
  OrthographicProjection,
  Stage2D,
  StageRenderer,
  TexturedSpriteKind,
} from '@spearwolf/twopoint5d';
import {RenderPipeline} from 'three/webgpu';

declare const display: Display;

const stage = new Stage2D(new OrthographicProjection('xy|bottom-left'));
const stageRenderer = new StageRenderer(display).add(stage);
const pipeline = new RenderPipeline(display.renderer!);
const withGlow = createBloomOutputNodeBuilder({strength: 1.2, radius: 0.4, threshold: 1});
stageRenderer.pipeline = pipeline;
stageRenderer.buildOutputNode = withGlow;

const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 100});
stage.scene.add(sprites);

const neon = sprites.createSprite();
if (neon != null) {
  neon.setSize(64, 16);
  // four times as bright as the color map: a luminance of 3.07, far above the threshold
  neon.setColorValues(4, 3, 1, 1);
}
const plain = sprites.createSprite();
if (plain != null) {
  plain.setSize(64, 16);
  plain.setPosition(0, -32);
  // at most white: no glow
  plain.setColorValues(1, 1, 1, 1);
}
sprites.update();

// teardown: the renderer lets go first, then the builder and the pipeline go
stageRenderer.dispose();
withGlow.dispose();
pipeline.dispose();
sprites.dispose();
```

**Brightness is luminance.** The threshold compares the luminance of the linear color,
`0.2126 r + 0.7152 g + 0.0722 b`, not its brightest channel. `[4, 3, 1]` has a luminance of 3.07
and glows; a pure red `[4, 0, 0]` has 0.85 and does **not**, a pure blue `[0, 0, 4]` has 0.29. A
saturated color needs a factor of about `threshold / coefficient` to pass — 5 for red, 14 for
blue — or a little white mixed in: `[4, 1, 1]` has 1.64. The tint multiplies the color map, so a
dark texel needs a larger factor than a white one.

**The glowing area counts, not only the luminance.** A pixel above the threshold goes into the
bloom with its whole color, not with what it has above the threshold, and the bloom blurs it
through five mips — from half the resolution of the screen down to a thirty-second — and adds
them up. A small sprite above white gets a halo. A full-width strip above white — a copper bar, a
laser across the screen, a bright floor — fills the large mips as well and fogs the whole screen.
Keep what glows small: draw a wide strip at or below white and give a thin core of it the tint
above white.

- The sprite itself draws clamped to its brightest color where it is above 1, unless the renderer
  tone-maps (`renderer.toneMapping`), which compresses it and keeps its hue.
- A `Flash` towards a color above white glows too: `setFlash(4, 4, 4, 1)` is a hit flash that
  blooms.
- `Fade` and the alpha of the tint fade the glow with the sprite on a material with
  `transparent: true`.
- The bloom holds for the whole stage: a sprite of another stage, or a mesh of one's own above
  white, glows as well. A threshold below 1 lets bright sprites that are not meant to glow into the
  bloom.

What the recipe cannot do: glow from an emission map of its own, and glow without the sprite
getting brighter. Both need an emissive output of the material and a bloom that reads it alone —
an `Emissive` feature and a selective bloom, which wait for a scene that needs them.

## Performance

- The setters of the features allocate nothing per call: they hand their values on in a scratch
  tuple, and `createSprite()` allocates the sprite and nothing else — on a full pool, once it has
  warned, nothing at all.
- A sprite that changes its frame every frame takes `prepareSpriteFrame()` once per atlas frame
  and `setPreparedFrame()` per sprite.
- `sortBy()` by a name and `sortByViewDepth()` allocate nothing once their scratch is there —
  the first sort allocates it, and it grows only with the capacity. 10 000 sprites sort in about
  0.1 ms when the order holds, 0.5 ms with ten of them out of line, 1.1 ms by the view depth under a
  circling camera and 1.3 ms from a random order;
  the upload after a sort that moved them is the larger price (see "Draw order: sorting the
  sprites").
- Under `grow: true` a `createSprite()` that finds room allocates the sprite and nothing else, and
  `update()` after a growth allocates nothing; the growth itself is the hitch, copying and uploading
  every sprite the mesh holds (see "FeatureSprites").
- A pick of `SpritePicker` draws the listed meshes into one pixel and copies one handle per sprite
  of them; it allocates its promise, a copy of the pointer and of the list, and three's read back
  per call — a tool for clicks and hover, not for every sprite every frame (see "Picking: which
  sprite is under the pointer").
- A sprite hidden by `Visible` costs no fragment, but its vertices still run through the vertex
  shader; a sprite hidden for good is freed (see "Showing and hiding sprites").
- Keep a hot loop to the sprites of one kind (see "Defining a kind").
- Call `update()` once per frame, after all writes and before rendering. It allocates nothing,
  with bindings and `visible` hooks as well; the allocation spec holds a plane and a light
  binding to it.

## Migrating from TexturedSprites and AnimatedSprites

`TexturedSprites` and `AnimatedSprites`, with their geometries, materials and descriptors and
`BaseSprite`, are gone. `FeatureSprites` with `TexturedSpriteKind` or `AnimatedSpriteKind` draws
the same pixels, and the sprite handles keep their attribute and method names.

| before | after |
| --- | --- |
| `new TexturedSprites(capacity, texture)` | `new FeatureSprites(TexturedSpriteKind, {capacity, textures: {colorMap: texture}})` |
| `new TexturedSprites(n, {renderAsBillboards: true})` | `new FeatureSprites(TexturedSpriteKind, {capacity: n, placement: BillboardPlacement})` |
| `material.renderAsBillboards = b` | `sprites.placement = b ? BillboardPlacement : FlatPlacement` |
| `sprites.texture = t`, `material.colorMap = t` | `sprites.setTexture('colorMap', t)` |
| `sprites.texture`, `material.colorMap`, `material.animsMap` | `sprites.getTexture('colorMap')`, `sprites.getTexture('animsMap')` |
| `material.animsMap = t` | `sprites.setTexture('animsMap', t)` |
| `new AnimatedSpritesMaterial({colorMap, animsMap, time})` | `new FeatureSpritesMaterial(AnimatedSpriteKind, {textures: {colorMap, animsMap}, uniforms: {time}})` |
| `material.time = t` | `sprites.setUniform('time', t)` |
| `material.time` | `sprites.uniforms!['time']!.value`, a `number` |
| `material.touchAnimsMap()` | `sprites.touchTexture('animsMap')` |
| `new TexturedSpritesGeometry(n, [hw, hh, ox, oy])` | `new FeatureSpritesGeometry(TexturedSpriteKind, {capacity: n, baseArgs: [hw, hh, ox, oy]})` |
| `new AnimatedSpritesGeometry(n, [hw, hh])` | `new FeatureSpritesGeometry(AnimatedSpriteKind, {capacity: n, baseArgs: [hw, hh]})` |
| `new TexturedSpritesMaterial({colorMap, transparent: true})` | `new FeatureSpritesMaterial(TexturedSpriteKind, {textures: {colorMap}, transparent: true})` |
| `TexturedSpritesGeometryParameters`, `AnimatedSpritesGeometryParameters` | `FeatureSpritesGeometryParameters` |
| `TexturedSpritesMaterialParameters`, `AnimatedSpritesMaterialParameters` | `FeatureSpritesMaterialParameters`; the options of the mesh: `FeatureSpritesOptions` |
| `TexturedSpritesMakeBaseSpriteArgs`, `AnimatedSpritesMakeBaseSpriteArgs` | `QuadBaseArgs` |
| `TexturedSpritesPool`, `AnimatedSpritesPool` | `VertexObjectPool<TexturedSprite>`, `VertexObjectPool<AnimatedSprite>` |
| `BaseSprite`, `BaseSpriteDescriptor` | `QuadBase`, `QuadBase.description` |
| `TexturedSpriteDescriptor`, `AnimatedSpriteDescriptor` | `TexturedSpriteKind.description`, `AnimatedSpriteKind.description` |
| `material.rotationNode = node` and the other node setters | a feature of your own in the slot (see "Writing a feature") |
| `TAttributeNode*` types, `*AttributeName` statics | — (`Node<'vec3'>` and the attribute names of the features) |
