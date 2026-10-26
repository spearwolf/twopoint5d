# Proposal: visibility per sprite — `Visible`

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "Showing and hiding sprites", the
`mesh` row and the bands under "The pipeline", the table of "Built-in features", `mesh` under
"Writing a feature", "Picking" and "Performance"; the Vitest spec `src/sprites/features/Visible.spec.ts`
and the browser test `packages/twopoint5d-testing/test/sprites-visible.test.js`. Deviations of the
build from the first draft of this spec, which the sections below now state as built:

- the icons of `ui-panels` are sprites of the preset `TexturedSpriteKind`, which holds no `Visible`;
  they keep hiding by a size of 0 (§6);
- the allocation spec measures the setter together with `touchVO(sprite, 'visible')`, the call every
  toggle of a static attribute takes (§7.2).

The row "per-sprite visibility" of §8 of
[`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md), surfaced by the lookbook demo
`ui-panels`. A game's UI hides a quest window, an inventory slot, a cursor, and shows them again a
moment later; a sprite of a pool has to be able to leave the picture without leaving its pool and
without giving up its values.

## 1. Goal

Today a sprite is hidden by a size of 0 (`setSize(0, 0)`) or an alpha of 0 (`Tint`, `Fade`). Both
cost the value they overwrite — `ui-panels` writes every panel's size anew on each layout, so that a
hidden one comes back at the right size — and both have side effects:

- a size of 0 needs `QuadSize`, and a kind whose placement spans the quad from other attributes — a
  segment between two points — cannot be hidden that way at all;
- an alpha of 0 is dropped by the default alpha test only; under an `alphaTest` or `alphaTestNode`
  of one's own that lets it through, the invisible sprite still runs its fragments and writes depth;
- every pass — a shadow, a reflection — and the picker go on drawing the sprite as they read it.

`Visible` is a flag per sprite that hides it in every material the kind draws with and leaves every
other value of the sprite as it is.

## 2. API

```ts
export interface VisibleApi {
  /**
   * Whether the sprite is drawn: 1, what a new sprite starts with, draws it, 0 hides it; a value of
   * 0.5 and above counts as 1. A hidden sprite keeps every value of its own and still runs its
   * vertices through the vertex shader.
   *
   * `visible` is a static attribute: a change reaches the gpu once it is marked —
   * `spritePool.touchVO(sprite, 'visible')` — or with every `update()` in a geometry built with
   * `attributeUsage: {dynamic: ['visible']}`.
   */
  visible: number;
}

export const Visible: SpriteFeature<VisibleApi>;
```

```ts
const PanelKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, Visible],
});

panel.visible = 0;
panels.spritePool?.touchVO(panel, 'visible');
```

- **A number, not a boolean**, as `flipX` and `fade` are: the generated accessor of an attribute is a
  number, and a number is a key for `sortBy()`. A `true` written to it stores 1, a `false` 0.
- **Static**, as `Flip` and `Tint` are: a sprite is shown and hidden on events, not every frame. A
  kind that toggles many sprites per frame takes `attributeUsage: {dynamic: ['visible']}`.
- **`initialize()` writes 1.** A slot `createVO()` hands out comes back with the data of the sprite
  that held it last, a hidden one among them.
- **Not part of the presets.** `TexturedSpriteKind` and `AnimatedSpriteKind` keep their layout;
  `Visible` is one more feature in a `defineSprite()` of one's own.

## 3. The collapse

### 3.1 The stage

```ts
export const Visible = defineFeature<VisibleApi>({
  name: 'visible',
  attributes: {visible: {size: 1}},
  initialize() {
    this.visible = 1;
  },
  mesh: {
    order: MeshOrder.Hide,
    // 0 or 1, whatever was written: every vertex of a hidden sprite lands on the origin of the mesh
    transform: (position, {attribute}) => mul(position, step(0.5, attribute<'float'>('visible'))),
  },
});
```

A hidden sprite moves every vertex onto one point, the origin of the mesh's local space. Its
triangles have no area, and a triangle without area is rasterized into no fragment, under WebGPU as
under WebGL 2: no color, no depth, no fragment shader run. The values in the buffers stay; writing 1
back draws the sprite as it was.

### 3.2 `MeshOrder.Hide` — the last band

`MeshOrder` gains the band `Hide: 1000`, after `Offset 100`, `Project 200` and `Mirror 300` — the
gap `ColorOrder.Pass: 1000` keeps in its slot. The collapse has to be the last word on the position:
a stage after it that reads something per vertex — the base `uv`, a vertex index — would spread the
vertices apart again. The band says so in its doc comment: a stage of one's own after
`MeshOrder.Hide` must map one point to one point.

### 3.3 Why the mesh slot and not the local slot

A local stage runs before the placement. A placement that spans the quad from other data than the
local vertex — `segmentPlacement()` reads the base `uv` to pick an end — would draw a collapsed local
quad at full size. After the placement and every mesh stage, the collapse holds for every placement
there is and every one still to come.

### 3.4 Why the shader and not the pool

The other way is to take the slot of a hidden sprite out of the draw range of the pool. A draw range
is one interval, so a hidden sprite in the middle of the pool means moving it to the end: that
fights the order `sortBy()` keeps, and it writes and uploads slots that did not change. The cost the
shader way leaves — the vertices of a hidden sprite run through the vertex shader — is four vertices
of a quad each; it counts only for a pool where most sprites are hidden most of the time, and such a
pool frees its sprites instead. The pool way comes back only once a measurement shows the vertex
cost.

### 3.5 Cost

One float per sprite — 4 bytes in the static float buffer of the kind; a `uint8` of one value would
be laid out as a `uint32` and save nothing — and a `step` and a `mul` per vertex.

## 4. What composes with it

| with | what happens | why |
| --- | --- | --- |
| passes — `ShadowPass`, `ReflectionPass`, … | the shadow, the reflection of a hidden sprite go with it | a pass material folds the features of the kind (`foldFeatures()` in `passes/passFeatures.ts`), and `Hide` runs after `Project` and `Mirror` |
| a pass that leaves it out | draws hidden sprites | `without: ['visible']` — a pass of one's own that wants them |
| `SpritePicker` | a hidden sprite is never picked | the pick material is a `FeatureSpritesMaterial` of the kind, with the stage |
| a placement swapped on a live material | unchanged | a mesh stage does not depend on the placement |
| `sortBy()`, `sortByViewDepth()` | unchanged | the attribute moves with its slot |
| `grow: true` | unchanged | a growth copies every attribute, `visible` with it |
| `gridBase()`, `NineSlice` | hidden as a quad is | all 16 vertices collapse alike |
| `Fade`, `Tint` | independent | they act on the color; `Visible` on the position |

## 5. Left out

- **The pool way** (§3.4).
- **A boolean accessor.** An interface can type a setter wider than its getter, but the generated
  accessor of an attribute is a number everywhere else; one feature with a boolean is a surprise.
- **`show()` and `hide()` methods that touch for themselves.** A sprite handle does not know its
  pool; `touchVO()` stays the caller's, as for every static attribute.
- **A count or a list of the visible sprites.** Nothing in the library reads the flag on the cpu.

## 6. The demo

`ui-panels` hides panels and pictures by `setSize(0, 0)` (`#hide()` in
`apps/lookbook/src/demos/ui-panels/DungeonScreen.ts`). `PanelKind` and `PictureKind` take `Visible`,
and `#hide()` writes `visible = 0` instead; `#placePanel()` and `#placePicture()` show a sprite again by
writing 1. The icons of the inventory and the glyphs of the text are `TexturedSprite`s of the preset:
the icons hide by a size of 0 in `#hideIcon()`, the glyphs keep their reveal by alpha, which touches
`color` anyway.

## 7. Tests, docs, CHANGELOG

### 7.1 Vitest (`src/sprites/features/Visible.spec.ts`)

- the feature: its name, its attribute, a mesh stage at `MeshOrder.Hide`;
- `initialize()`: a sprite in a slot a hidden sprite freed starts visible;
- a hidden sprite keeps its size;
- the stage keeps the vertex from 0.5 up and moves it to the origin below;
- a geometry takes `visible` as a dynamic attribute through `attributeUsage`;
- the order: after `wave()` in a kind, whether `Visible` is listed first or last, and in the material
  of a `ShadowPass` and of a `ReflectionPass` after `PlanarShadow` and `MirrorAtPlane`;
- `MeshOrder` is frozen and holds `Hide: 1000` (`src/sprites/SpriteFeature.spec.ts`).

### 7.2 Allocations

Hiding and showing a sprite allocates nothing, the `touchVO(sprite, 'visible')` after the setter
included — one more test in `src/sprites/hot-path-allocations.spec.ts`.

### 7.3 Browser (WebGPU and WebGL 2, `packages/twopoint5d-testing/test/sprites-visible.test.js`)

- two sprites; hiding one clears its pixels and leaves the other's;
- showing it again draws it at the size and frame it had;
- a sprite created in the slot of a freed hidden sprite is drawn;
- a hidden sprite casts no shadow under a `ShadowPass`;
- `SpritePicker` does not pick a hidden sprite and picks the one behind it.

The attribute name `visible` reaches WGSL and GLSL as an identifier of three's making; the test run
under both backends is its check.

### 7.4 Docs and CHANGELOG

- [`docs/sprites.md`](../sprites.md): a section "Showing and hiding sprites" under "Built-in
  features", after "Fade and flash" — the recipe first: hide, show, the touch; the band `Hide 1000` in the table of
  `MeshOrder` under "The pipeline" and under "Writing a feature", with the rule of §3.2; one line
  under "Picking" and one under "Performance" — a hidden sprite is not picked, and it still runs its
  vertices.
- The row of §8 of [`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md) marked built,
  pointing here.
- `CHANGELOG.md` of the library, under `## [Unreleased]`: `Visible` and `MeshOrder.Hide` under
  "Added".
