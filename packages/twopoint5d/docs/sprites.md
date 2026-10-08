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
material (`textures`, `uniforms`, `placement` and every three.js material parameter) side by side.
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
answers `undefined`; `freeSprite()`, `setUniform()`, `setTexture()`, `touchTexture()` and the
`placement` setter do nothing. A second `dispose()` does nothing.

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
`time` uniform moves the animations:

```ts check
import {AnimatedSpriteKind, FeatureSprites} from '@spearwolf/twopoint5d';
import {Scene, Texture, TextureLoader} from 'three/webgpu';

const colorMap = new Texture();
const animsMap = new Texture();

const sprites = new FeatureSprites(AnimatedSpriteKind, {
  capacity: 1000,
  textures: {colorMap, animsMap},
  uniforms: {time: 0},
  transparent: true,
});

const scene = new Scene();
scene.add(sprites);

// a texture that loads fills its image without an event: tell the material once it is there
new TextureLoader().load('animations.png', (loaded) => {
  animsMap.image = loaded.image;
  animsMap.needsUpdate = true;
  sprites.touchTexture('animsMap');
});

const sprite = sprites.createSprite();
if (sprite != null) {
  sprite.setPosition(10, 20, 0);
  sprite.setSize(32, 32);
  sprite.animId = 0;
  sprite.animOffset = 0.25;
}

// once per frame
export function frame(now: number) {
  sprites.setUniform('time', now);
  sprites.update();
}
```

## Writing a feature

A feature is a plain object handed to `defineFeature()`, which checks it on its own and freezes
it. This one fades a sprite out: an attribute of one value per sprite, a property `fade` on the
handle, a start value of 1, and a color stage that multiplies the alpha by it.

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
  attributes: {fade: {size: 1}},
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
| `new AnimatedSpritesMaterial({colorMap, animsMap, time})` | `new FeatureSpritesMaterial(AnimatedSpriteKind, {textures: {colorMap, animsMap}, uniforms: {time}})` |
| `material.time = t` | `sprites.setUniform('time', t)` |
| `material.touchAnimsMap()` | `sprites.touchTexture('animsMap')` |
| `new TexturedSpritesGeometry(n, [hw, hh, ox, oy])` | `new FeatureSpritesGeometry(TexturedSpriteKind, {capacity: n, baseArgs: [hw, hh, ox, oy]})` |
| `TexturedSpritesPool`, `AnimatedSpritesPool` | `VertexObjectPool<TexturedSprite>`, `VertexObjectPool<AnimatedSprite>` |
| `BaseSprite`, `BaseSpriteDescriptor` | `QuadBase`, `QuadBase.description` |
| `TexturedSpriteDescriptor`, `AnimatedSpriteDescriptor` | `TexturedSpriteKind.description`, `AnimatedSpriteKind.description` |
| `material.rotationNode = node` and the other node setters | a feature of your own in the slot (see "Writing a feature") |
| `TAttributeNode*` types, `*AttributeName` statics | — (`Node<'vec3'>` and the attribute names of the features) |
