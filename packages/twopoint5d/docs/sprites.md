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

```ts
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
