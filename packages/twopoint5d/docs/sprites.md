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

`defineFeature()` checks a feature on its own; `defineSprite()` checks it against the others of a
kind. A kind is immutable: a sprite with one more feature is a sprite of another kind.

The **base** is the geometry every sprite of a kind is drawn from. `QuadBase` is the quad of
four vertices the built-in kinds use: the unit quad `[-0.5, 0.5]²` on the XY plane, centred on the
pivot, its `uv` running from `(0, 0)` at the top left to `(1, 1)` at the bottom right.

## The pipeline

Transformations do not commute — scale-then-rotate keeps a rectangle a rectangle,
rotate-then-scale turns it into a parallelogram — so the order of the stages belongs to the
model, not to the order of the feature list:

```
frame:    frame slot (or defaults) ─▶ texCoords, flipDiagonal, trim — read by both pipelines
vertex:   base.position ─▶ trim shift ─▶ local stages ─▶ placement ─▶ mesh stages ─▶ positionNode
fragment: colorSource(frame) ─▶ color stages ─▶ colorNode
```

| slot | per kind | built-in features |
| --- | --- | --- |
| `frame` | 0 or 1 | `AtlasFrame`, `AnimatedFrames` |
| trim shift | built in, runs when the frame has trim margins | — |
| `local` | any, by `order` | `QuadSize`, `Shear`, `Rotation` |
| `placement` | exactly 1 | `FlatPlacement`, `BillboardPlacement` |
| `mesh` | any, by `order` | `PlanarShadow`, `MirrorAtPlane` (passes) |
| `colorSource` | 0 or 1; without one the sprite is flat grey | `TextureColor` |
| `color` | any, by `order` | `Tint`, `ShadowMask`, `Darken` (passes) |

The order bands `LocalOrder` (`Anchor 100, Flip 150, Scale 200, Shear 300, Rotate 400`),
`MeshOrder` (`Offset 100, Project 200, Mirror 300`) and `ColorOrder` (`Tint 100, Mask 150,
Fade 200, Flash 300`) leave room for stages of your own. Two stages of one order run in the
order of the feature list.

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
  type SpriteOf,
  TextureColor,
  Tint,
} from '@spearwolf/twopoint5d';

export const FancySprite = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Shear, Rotation, AtlasFrame, TextureColor, Tint],
});

export type Fancy = SpriteOf<typeof FancySprite>;
```

`defineSprite()` merges the attributes and methods of all features into **one** instanced vertex
object description: one pool, one sprite handle carrying every accessor, one `freeVO()` that moves
every attribute of a freed sprite at once. It throws, naming the features, when two of them
declare the same attribute, uniform, texture, usage alias or sprite-handle property, when a
`requires` is not met, when a slot of one gets two, when no feature places the sprite, and when
the merged attributes cannot be laid out.

Every kind brings a prototype of its own. One loop over the sprites of more than four kinds is
megamorphic and runs about eighteen times slower per sprite (see `docs/architecture.md`, the
`vertex-objects/` section) — keep a hot loop to the sprites of one kind.

## Built-in features

| feature | attributes (usage) | sprite handle | slot | a new sprite |
| --- | --- | --- | --- | --- |
| `InstancePosition` | `instancePosition` (dynamic), word `position` | `x`, `y`, `z`, `setInstancePosition()`, `setPosition(x, y, z?)` | — | at the origin |
| `FlatPlacement` | — | — | placement | — |
| `BillboardPlacement` | — | — | placement | — |
| `QuadSize` | `quadSize` (static), word `size` | `width`, `height`, `setQuadSize()`, `setSize(w, h)` | local, `Scale` | 0 × 0 |
| `Shear` | `shear` (dynamic) | `shearX`, `shearY`, `setShear()` | local, `Shear` | 0, 0 |
| `Rotation` | `rotation` (dynamic) | `rotation` | local, `Rotate` | 0 |
| `AtlasFrame` | `texCoords`, `texFlipDiagonal`, `texTrim` (static), word `texCoords` for all three | `s`, `t`, `u`, `v`, `texFlipDiagonal`, `trimLeft` … `trimBottom`, `setTexCoords()`, `setTexTrim()`, `setFrame()`, `setPreparedFrame()` | frame | all 0 |
| `AnimatedFrames` | `anim` (static): `animId`, `animOffset`; uniform `time`; texture `animsMap` | `animId`, `animOffset` | frame | 0, 0 |
| `TextureColor` | — (texture `colorMap`) | — | color source | — |
| `Tint` | `color` (static) | `r`, `g`, `b`, `a`, `setColorValues()`, `setColor(color, a?)`, `getColor(target?)` | color, `Tint` | white, alpha 1 |

`InstancePosition` is data alone. `FlatPlacement` and `BillboardPlacement` read it and bring
nothing but their placement stage, so the one stands in for the other on a live material (see
"Flat sprites and billboards"). `setPosition(x, y)` without a `z` keeps the `z` the sprite has.

`BillboardPlacement` maps the x and y of the local vertex — trimmed, scaled, sheared and turned
already — onto the camera's right and up vectors in the local space of the mesh, so a mesh or its
parents may be moved, turned and scaled evenly on all axes and its billboards still face the
camera. A scale that differs from axis to axis skews them.

### Frames out of an atlas

A frame is three values: `texCoords` (`s, t, u, v`), `texFlipDiagonal` — a TexturePacker frame
turned by 90°, read with the two lookup components swapped — and `texTrim`, the margins a
packer cut off, as fractions of the untrimmed sprite. `setFrame(frame)` writes all three for a
frame of any atlas; the margins come from TexturePacker data and are zero for every other.

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
The frames of all animations follow, each of `texelsPerFrame` texels, the same number for the
whole texture:

| texel of a frame | holds | present when |
| --- | --- | --- |
| 1 | `[s, t, u, v]`, the tex coords | always |
| 2 | `[width, height, flipDiagonal, 0]` | `texelsPerFrame` is 2 or 3 |
| 3 | `[left, top, right, bottom]`, the trim margins | `texelsPerFrame` is 3 |

The bake writes 3 texels when any frame is trimmed, 2 when any frame is turned (or
`includeTextureSize` is set), and 1 otherwise. A frame without a second texel is never turned,
one without a third is untrimmed. The frame shown is
`floor(((time + animOffset) / duration * frameCount) mod frameCount)`; a `duration` of 0 is a
still image and shows the first frame.

`time` is a uniform: set it with `setUniform('time', seconds)` or the `uniforms` option, a write
builds nothing. The animsMap itself is a texture with `needsImage`: until it has an image the
sprite shows the whole `colorMap`, untrimmed. A `TextureLoader` or a `DataTexture` filled later
writes the image without an event, so call `touchTexture('animsMap')` once it is there. A baked
`DataTexture` already has its image. The animsMap stays the caller's; the material does not
dispose it.

## Uploads: static and dynamic attributes

`update()` of the mesh uploads what the sprite pool marked. Position, rotation and shear are
**dynamic**: every `update()` uploads them. Everything else is **static**: written before the
first `update()` after `createSprite()` it reaches the gpu with that sprite; a later change
reaches the gpu only once it is marked — `spritePool.touchVO(sprite, 'quadSize')` for one sprite,
`geometry.touch('quadSize')` for every sprite in use.

A value that changes every frame belongs in a geometry built with `attributeUsage`:

    new FeatureSprites(kind, {capacity: 1000, attributeUsage: {dynamic: ['size', 'texCoords']}})

It takes attribute names and the usage words of the features — `size` for `quadSize`, `position`
for `instancePosition`, `texCoords` for the three frame attributes — and throws for a word the
kind does not know. A geometry built with `attributeUsage` shares its prototype with no other.
`baseArgs` hands `make()` of the base other arguments: `[halfWidth, halfHeight, xOffset,
yOffset]` for `QuadBase`. The trim margins still move the corners by the measure of the unit quad.

## The material: textures, uniforms and rebuilds

`FeatureSpritesMaterial` folds the pipeline of a kind into `positionNode` and `colorNode`. It takes
the kind and, besides every three.js material parameter, its own options: `name`, `textures` and
`uniforms` to start with, and `resources` — the uniforms and textures of a `SpriteResources`
shared with other materials, which then stay the caller's.

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
`TextureColor` draws its sprites flat grey, tinted, while no `colorMap` is set. A texture declared with `needsImage`
counts as set only once its image has measures.

`setTexture(name, texture)` and `getTexture(name)` take the names the features declare; a texture
stays the caller's, and `dispose()` does not release it. `TextureLoader` writes a loaded image into
the same texture without an event, so `touchTexture(name)` re-reads it once it has loaded.

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

Another placement takes the place of the current one only when it contributes a placement stage
and nothing else — no attributes, methods, uniforms or textures, because the sprites and the
material were built without them — and the kind holds every feature it `requires`. Anything else
throws a `TypeError` naming both features. The placement of the kind always comes back, whatever
it brings. A write of the placement the material holds builds nothing.

A change rebuilds the position graph and sets `needsUpdate`; three serves a shader source it has
built before from its caches, so the second swap back and forth is cheap. Do not swap every frame.

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
`createSprite()` answers `undefined` once the pool is full. `placement`, `uniforms`, `setUniform()`,
`getTexture()`, `setTexture()` and `touchTexture()` pass through to the material.

**Ownership.** The mesh disposes the geometry and the material it built, and nothing else. A
`geometry` or a `material` handed in, and every texture, stays the caller's; `dispose()` leaves
them alone. A mesh built around a geometry handed in still disposes the material it built for it.

**Refusals.** A `TypeError` instead of a mismatch: a `geometry` or a `material` built for another
sprite kind; `capacity`, `attributeUsage` or `baseArgs` next to a `geometry`; any material
parameter next to a `material`. A material that cannot be built (a `placement` that cannot stand
in, a texture name no feature declares) throws as well, and the geometry the constructor built for
it is disposed first, so a refused constructor leaves nothing behind.

**After `dispose()`.** The mesh leaves the scene graph and fires the `dispose` event of three.
`geometry`, `material`, `spritePool`, `placement` and `uniforms` answer `undefined`; `createSprite()`
and `getTexture()` answer `undefined`; `freeSprite()`, `setUniform()`, `setTexture()`,
`touchTexture()`, `update()` and the `placement` setter do nothing; `passes` is empty. A second
`dispose()` does nothing.

## Presets

Two kinds ship ready-made, with the layout, the names and the start values of the textured and the
animated sprites of earlier versions: `TexturedSpriteKind` (`InstancePosition`, `FlatPlacement`,
`QuadSize`, `Rotation`, `AtlasFrame`, `TextureColor`, `Tint`) and `AnimatedSpriteKind` (`InstancePosition`,
`FlatPlacement`, `QuadSize`, `Rotation`, `AnimatedFrames`, `TextureColor` — no tint). Both sit on `QuadBase`.
A kind with one more feature is a `defineSprite()` away. `TexturedSprite` and `AnimatedSprite` are
their sprite handles, `SpriteOf<typeof TexturedSpriteKind>` and `SpriteOf<typeof AnimatedSpriteKind>`:
the type of a pool or a function that takes their sprites, `VertexObjectPool<TexturedSprite>`.

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

A feature is a plain object handed to `defineFeature()`, which checks it on its own and freezes
it. This one fades a sprite out: an attribute of one value per sprite, `dynamic` because a fade
changes from frame to frame, a property `fade` on the handle, a start value of 1, and a color
stage that multiplies the alpha by it.

```ts check
import {
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
  AtlasFrame,
} from '@spearwolf/twopoint5d';
import {mul, vec4} from 'three/tsl';
import type {Node} from 'three/webgpu';

export interface FadeApi {
  /** 1 draws the sprite as it is, 0 makes it invisible. */
  fade: number;
}

export const Fade = defineFeature<FadeApi>({
  name: 'fade',
  attributes: {fade: {size: 1, usage: 'dynamic'}},
  initialize() {
    this.fade = 1;
  },
  color: {
    order: ColorOrder.Fade,
    transform: (color, {attribute}) =>
      vec4(color.rgb, mul(color.a, attribute<'float'>('fade'))) as unknown as Node<'vec4'>,
  },
});

const FadingSprite = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, Tint, Fade],
});

const sprites = new FeatureSprites(FadingSprite, {capacity: 100, transparent: true});
const sprite = sprites.createSprite();
if (sprite != null) sprite.fade = 0.5;
sprites.dispose();
```

The fields, and the rules `defineFeature()` and `defineSprite()` hold them to:

- **`name`** — required, unique within a kind; every error about the feature names it, and
  `requires` of other features refers to it.
- **`attributes`** — instance attributes in the form of a vertex object description (see
  `src/vertex-objects/README.md`). They are merged into the one description of the kind, so an
  attribute name is unique across the features and must not be one of the base (`position`,
  `uv`); the merged layout has to fit into one sprite. An attribute is `static` unless it says
  otherwise: give one that changes every frame `usage: 'dynamic'`.
- **`usageAliases`** — words a caller of `attributeUsage` may use for attributes of this feature,
  `{size: ['quadSize']}`. A word is unique across the kind, names only attributes of its own
  feature, and may be named like one of them (`texCoords` of `AtlasFrame`).
- **`methods`** — methods of the sprite handle, `this` being the sprite. Every property the
  attributes generate and every method name is unique across the kind. A method that hands
  fractional values of its caller to a generated setter writes them into a tuple declared once at
  module level and hands that on, as `setSize()` of `QuadSize` does: separate arguments of a call
  V8 does not inline are boxed, 16 bytes each.
- **`initialize()`** — writes the neutral values into a slot `createSprite()` hands out: a freed
  slot comes back with the values of its last sprite, and without `initialize()` a new sprite
  keeps them. It runs for every sprite created, so it allocates nothing.
- **`uniforms`** — start values by name: a number for a `float`, 2 to 4 numbers for a `vec2` to
  `vec4`. A name is unique across the kind. Every stage of the kind reads every uniform, through
  `uniform(name)` of its context.
- **`textures`** — the textures the feature samples, by name, `{needsImage: true}` for one that
  counts as set only once its image has measures. A name is unique across the kind. The textures
  stay the caller's. Until all of them are set the feature drops out of the graph.
- **`frame`** — the frame slot, at most one feature per kind: answers `texCoords`, and optionally
  `flipDiagonal` and `trim`, read by both pipelines.
- **`local`**, **`mesh`**, **`color`** — a stage `{order, transform}` in its slot; `order` is a
  finite number, lower runs first, and a tie keeps the order of the feature list. `LocalOrder`,
  `MeshOrder` and `ColorOrder` name the bands.
- **`placement`** — maps the local vertex into the local space of the mesh: exactly one feature of
  a kind, and it declares no textures, since the placement runs always.
- **`colorSource`** — the color before the color stages, at most one feature per kind.
- **`requires`** — names of other features that have to be part of the same kind; never the
  feature's own name.

A stage reads through its context: `attribute(name)` for an attribute of the kind or the base,
`uniform(name)` for a uniform any feature of the kind declares, and `sample(name, uv)` and
`textureSize(name)` for a texture the feature declares itself. The material throws, naming the
feature, for any other name.

A feature that brings nothing but a stage reads what other features hold, and says so with
`requires`: `defineSprite()` then refuses a kind without them, naming both features, instead of
the material failing on a missing attribute or uniform. This one lets sprites bob up and down,
reading the `instancePosition` of `InstancePosition` and the `time` uniform of `AnimatedFrames`:

```ts check
import {defineFeature, MeshOrder} from '@spearwolf/twopoint5d';
import {add, sin, vec3} from 'three/tsl';
import type {Node} from 'three/webgpu';

export const Bob = defineFeature({
  name: 'bob',
  requires: ['instancePosition', 'animatedFrames'],
  mesh: {
    order: MeshOrder.Offset,
    transform: (position, {attribute, uniform}) => {
      const phase = add(uniform<'float'>('time'), attribute<'vec3'>('instancePosition').x);
      return add(position, vec3(0, sin(phase), 0)) as unknown as Node<'vec3'>;
    },
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

Projections and mirrors are `mesh` stages: they work on the placed vertex, after the placement, so
the shadow of a billboard is the shadow of the billboard the camera sees.

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

// the light comes from above, a little from the right; it points towards the light.
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

- **No data.** A pass draws the data of the sprites. `definePass()` refuses a feature that brings
  attributes, methods, `initialize()`, usage aliases or a placement, and two features of one
  name. Everything a pass reads comes from a feature of the kind; a `requires` of a pass feature
  is met by the kind or by the pass, or the sprites refuse the pass.
- **`without`** leaves out the stages of features of the kind, by name; their data stays. The
  sprites refuse a name the kind does not hold and the placement — a pass draws with the
  placement of the sprites. A `without` ties a pass to the kinds that hold what it names.
- **Shared uniforms and textures.** The material of the sprites and every pass material share
  one set of uniforms and textures, which `textures` and `uniforms` start: `setUniform()` and
  `setTexture()` of the sprites reach every pass, and the shadow of an animated sprite shows the
  frame the sprite shows, since `time` is one uniform for all of them. Two features — of the kind
  or of any pass — that declare the same name are refused, and so are two passes of one name.
- **Renamed uniforms.** `uniformNames` maps names the features of the pass declare to names of
  the pass; the pass draws with copies of its features that declare and read those names, at the
  start values of the feature. Only the features of the pass are renamed, never those of the kind
  (`time` stays one uniform), and textures are not renamed. `definePass()` refuses a name no
  feature of the pass declares, an empty target and two names with one target; a target that
  collides with a uniform of the kind or of another pass is refused as "both declare the uniform".
- **A copy shares.** `definePass({...ShadowPass, name: 'twin'})` without `uniformNames` reads the
  uniforms of `ShadowPass` and draws the same shadow a second time. This is not refused, since two
  passes may share a uniform on purpose — one `reflectionColor` for two reflections.
- **Placement.** A placement swap on the sprites reaches every pass material; one the material of
  the sprites refuses reaches none.
- **`update()` once.** The pass meshes have no `update()` of their own; `update()` of the sprites
  uploads the geometry once for all of them.
- **Ownership.** The pass meshes are children of the sprites: they move with them and leave the
  scene graph with them. `passes` answers them by pass name, `FeatureSpritesPass` meshes whose
  `material` is the material of the pass. `dispose()` releases the pass meshes, their materials
  and the shared uniforms and textures, and `passes` is empty afterwards; a geometry handed in
  and every texture stay the caller's. Passes need a material the sprites build, so they are
  refused next to a `material` handed in.

Two passes ship ready-made. Both are `transparent`, write no depth, draw both sides of a triangle
(`side: DoubleSide`) and take a `renderOrder` of -1; `ShadowPass` takes a polygon offset as well
(`polygonOffset`, with a factor and units of -1). A plane is `[n.x, n.y, n.z, d]`, the plane
`dot(n, p) = d` in the local space of the mesh; `n` need not be a unit vector, so `[0, 2, 0, 4]`
is the plane `y = 2`:

| pass | features | uniforms (start value) | what it draws |
| --- | --- | --- | --- |
| `ShadowPass` | `PlanarShadow`, `ShadowMask` | `shadowLight` (`[-0.4, 1, -0.3, 0]`), `groundPlane` (`[0, 1, 0, 0]`), `shadowColor` (`[0, 0, 0, 0.5]`) | the sprite projected from `shadowLight` onto `groundPlane` — along a direction towards the light (`w = 0`) or from a point light (`w = 1`) — in `shadowColor`, its alpha multiplied by the alpha of the sprite |
| `ReflectionPass` | `MirrorAtPlane`, `Darken` | `mirrorPlane` (`[0, 1, 0, 0]`), `reflectionColor` (`[0.5, 0.5, 0.5, 0.5]`) | the sprite mirrored at `mirrorPlane`, `p − 2 · (dot(n, p) − d) · n / dot(n, n)`, its color multiplied by `reflectionColor`, alpha included |

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
height of the light first, so its shadow grows long, at most 19 times its distance to the light,
but stays finite, in the plane and on the far side of the light. The normal need not be a unit
vector.

`ShadowPass` keeps the tint of the kind: `ShadowMask` replaces the color anyway, and the alpha of
the tint fades the shadow along with the sprite. It leaves nothing out, so it draws
`AnimatedSpriteKind`, which holds no tint, as well. A reflection needs no flip of its own:
mirroring the placed vertex turns the sprite upside down and keeps the frame where it is.

**Both sides.** A mirror turns the winding of every triangle it draws, and a projection onto the
ground turns it whenever the shadow falls towards the camera, as it does for a sprite seen from
the front and above under a light from above and behind it — the start value of `shadowLight`
is one. three decides what to cull by the `side` of the material and the world matrix of the mesh,
never by the vertex shader, so with the default `FrontSide` such a reflection or shadow is culled
and nothing is drawn. Both presets therefore draw with `DoubleSide`, and so does a pass of one's
own that mirrors or projects.

**The scene around them.** Each preset expects something of the ground it is drawn on:

- **`ShadowPass`** lies exactly in `groundPlane`. A ground mesh in that plane has the same depth
  under every pixel, and the two would fight over it; the polygon offset of the pass pulls the
  shadow in front of the ground, so it wins the depth test. It writes no depth, so whatever stands
  on the ground still covers it.
- **`ReflectionPass`** lies on the far side of `mirrorPlane`, behind the ground the camera looks
  at. An opaque ground hides it: three draws opaque meshes before transparent ones, and the
  reflection then fails the depth test. Draw the ground transparent, so that it comes after the
  reflection and lets it show through, or switch the depth test of the pass off —
  `sprites.passes['reflection']!.material.depthTest = false` — which draws the reflection over
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

A pass of one's own is a `definePass()` over features of one's own, written as `PlanarShadow`
and `ShadowMask` are — see "Writing a feature".

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

## Performance

- The setters of the features allocate nothing per call: they hand their values on in a scratch
  tuple, and `createSprite()` allocates the sprite and nothing else. The allocation spec
  (`src/sprites/hot-path-allocations.spec.ts`) holds both presets to it, and `pnpm bench` times
  the hot loops of 10 000 sprites.
- A sprite that changes its frame every frame takes `prepareSpriteFrame()` once per atlas frame
  and `setPreparedFrame()` per sprite.
- Keep a hot loop to the sprites of one kind (see "Defining a kind").
- Call `update()` once per frame, after all writes and before rendering.

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
