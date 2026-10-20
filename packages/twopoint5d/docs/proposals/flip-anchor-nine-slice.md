# Proposal: `Flip`, `Anchor` and `NineSlice`

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "Flip", "Anchor", "Nine-slice
panels", the pipeline and feature tables and `mirror` under "Writing a feature", and
[`docs/text.md`](../text.md) for `writeText()` under `Anchor`. Deviations of the build from the first
draft of this spec, which the sections below now state as built:

- the slice lookup of `setAnchorFromPivot()` and `setSliceFrame()` lives in the internal module
  `features/frameSlices.ts`; its refusal of several slices builds its message in a function of its
  own, since a closure over the lookup's locals made V8 allocate a context of 48 bytes on every call;
- the insets of `setSliceFrame()` are typed `SliceInsets`, exported with `NineSlice`, and a refusal
  shows them as `[8, 8, 8]` with spaces (§5.4);
- the material spec of §7.1 (a kind of `Flip` and `Anchor` reads `flip` through the frame's `mirror`)
  lives in `features/Anchor.spec.ts`;
- the test-only flip and nine-slice of `sprites-pipeline-stages.test.js` stay as the proofs of the
  slots; their helpers `cellColors`, `mirroredX`, `mirroredY` and `expectSameCells` moved to
  `test/helpers/fixtures.js`.

Phase D, part 1, of [`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md) (§4.9, the
`NineSlice` of §4.7): three features built on the slots of
[`pipeline-stages-and-grid-base.md`](pipeline-stages-and-grid-base.md) — the contract of its §7 is
binding here. A platformer's character faces left and stands on its feet; a game's UI draws a
panel of any size from one small frame. Where the roadmap's sketch or the phase C contract is wrong
about the code, the section says what holds; §8 collects it.

## 1. Goal

| item | what is missing today | § |
| --- | --- | --- |
| `Flip` | a sprite cannot face left: a negative width turns the triangles over (culled under `FrontSide`), `setTexCoords()` with a negative `u` breaks trimmed frames and cannot reach `AnimatedFrames` | 3 |
| `Anchor` | the point a sprite stands on is one per geometry (`baseArgs`); a frame whose pivot is off the middle, a sprite that turns about its foot, a panel placed by its top left corner each need a geometry of their own | 4 |
| `NineSlice` | a panel stretched as a quad smears its border; a game builds nine sprites per panel, or a canvas | 5 |

Each is a feature of the existing model — a frame stage, a local stage, a uv stage, attributes and
methods — and needs one small addition to the frame record (§2).

## 2. The frame records its mirror — `SpriteFrameNodes.mirror`

A mirror of the image moves every point *on* the image: the pivot of a fighter at 0.35 of its width
lies at 0.65 once it faces left, the left border of a panel is its right one. `Anchor` and
`NineSlice` run in the local and the uv slot and have to know whether the frame stage mirrored the
image; the stage context offers no way to ask whether the kind holds an attribute (`attribute()`
throws for one it does not hold). The frame is the record every stage after the frame stages reads,
so the mirror goes there:

```ts
// SpriteFrameNodes
/**
 * `vec2(x, y)`: 1 along an axis a frame stage mirrored the drawn image on, 0 along one it did not.
 * A stage that places something on the image — an anchor, a nine-slice border — mirrors it along.
 * Default: no mirror.
 */
readonly mirror?: Node<'vec2'>;
```

- Optional: every frame slot and frame stage of today answers no `mirror` and reads as unmirrored,
  every kind builds the graph it built before. A stage that builds a new frame without spreading the
  old one drops it, as it drops `trim` — the rule "a stage with no business with a field passes it
  on" (`{...frame, texCoords}`) covers it.
- Written by `Flip` (§3); read by `Anchor` (§4) and `NineSlice` (§5), which treat an absent
  `mirror` as `vec2(0, 0)` without building a node for it.
- The CHANGELOG lists it under "Added"; the guide's field list under "Writing a feature" names it.

## 3. `Flip`

### 3.1 API

```ts
export interface FlipApi {
  /**
   * Mirrors the image of the sprite left for right: 1 mirrors it, 0 — what a new sprite starts with
   * — draws it as it is; a value above 0.5 counts as 1. The triangles never turn over.
   *
   * `flip` — `flipX` and `flipY` — is a static attribute: a later change reaches the gpu once it is
   * marked — `spritePool.touchVO(sprite, 'flip')` — or with every `update()` in a geometry built with
   * `attributeUsage: {dynamic: ['flip']}`.
   */
  flipX: number;
  /** Mirrors the image upside down; as {@link FlipApi.flipX}. Part of `flip`. */
  flipY: number;
  setFlip(flipX: number, flipY: number): void;
  setFlip(flip: [flipX: number, flipY: number]): void;
}

export const Flip: SpriteFeature<FlipApi>; // name 'flip'
```

- Attribute `flip: {components: ['flipX', 'flipY']}`, static; `initialize()` writes `0, 0`. The
  setter `setFlip()` is the generated one of the attribute (and `getFlip()` comes along untyped, as
  for every attribute of components).
- The roadmap's `hero.flipX = velocity.x < 0` assigns a boolean, which the type `number` refuses;
  the guide writes `hero.flipX = velocity.x < 0 ? 1 : 0`. The shader reads `step(0.5, flip)`, so a
  value that is neither 0 nor 1 still draws one of the two images, never a squeezed one.

### 3.2 The frame stage

At `FrameOrder.Flip`, with `f = step(0.5, attribute('flip'))` and the frame `(s, t, u, v)`:

```
texCoords = (s + u·f.x,  t + v·f.y,  u·(1 − 2·f.x),  v·(1 − 2·f.y))
trim      = (mix(l, r, f.x), mix(t, b, f.y), mix(r, l, f.x), mix(b, t, f.y))   // trim = (l, t, r, b)
mirror    = |frame.mirror − f|   (f where the frame carries no mirror)
```

- **Every frame.** The lookup reads `(s + uv.x · u, t + uv.y · v)` before the diagonal swap, so the
  drawn x is the `s` axis for an upright and a turned atlas frame alike (§2.2 of the phase C
  proposal), and the same stage mirrors every frame `AtlasFrame` writes and every frame
  `AnimatedFrames` picks, in every playback mode — it runs after the frame is picked. Without a frame
  feature it mirrors the whole texture, the defaults `(0, 0, 1, 1)`.
- **Trim.** The margins swap left with right (top with bottom), so the trim shift — which reads the
  stage's result — puts a trimmed frame where the flipped untrimmed sprite has it: a trimmed frame
  stays on its foot. A frame without `trim` gets the margins of zeros, which shift nothing.
- **Mirror.** Two mirrors along one axis cancel: a stage of one's own in the same band that mirrors
  again answers an unmirrored `mirror`.
- **The position is untouched**: the triangles keep their winding and `FrontSide` keeps drawing the
  sprite; the stage reads no position. `LocalOrder.Flip` stays the band of a local stage of one's
  own that mirrors the geometry and needs `side: DoubleSide`.
- **On every base and in every pass.** The stage changes the frame, not the base: it works on
  `QuadBase` and on `gridBase()`. A pass draws with the frame stages of the kind (a pass leaves out
  only what `without` names), so `ShadowPass`, `ReflectionPass` and `BillboardReflectionPass` show
  the flipped image — a shadow of a sprite facing left faces left.

## 4. `Anchor`

### 4.1 API

```ts
export interface AnchorApi {
  /**
   * Where the position of the sprite sits on its image, as a fraction of the width of the untrimmed
   * sprite from its left edge: 0 the left edge, 0.5 — what a new sprite starts with — the middle,
   * 1 the right edge. Part of `anchor`, a static attribute (`spritePool.touchVO(sprite, 'anchor')`).
   */
  anchorX: number;
  /** As {@link AnchorApi.anchorX}, from the top edge down: 0 the top, 0.5 the middle, 1 the foot. */
  anchorY: number;
  setAnchor(anchorX: number, anchorY: number): void;
  setAnchor(anchor: [anchorX: number, anchorY: number]): void;
  /**
   * Sets the anchor to the pivot of an Aseprite slice of `frame`: the bottom left corner of the
   * pixel the pivot marks, as a fraction of the untrimmed frame. Without `sliceName` the one slice of
   * the frame that has a pivot.
   */
  setAnchorFromPivot(frame: TextureAtlasFrame<unknown>, sliceName?: string): void;
}

export const Anchor: SpriteFeature<AnchorApi>; // name 'anchor'
```

### 4.2 The local stage

At `LocalOrder.Anchor` (100), with `a = mix(anchor, 1 − anchor, frame.mirror)` (the anchor mirrored
along with the image; `a = anchor` without a mirror):

```
position + (0.5 − a.x,  a.y − 0.5,  0)
```

- **Measured in the unit quad**, after the trim shift and before `QuadSize` scales: the anchor is a
  fraction of the sprite's size whatever the size, and of the **untrimmed** sprite — the quad stands
  for it (`AtlasFrame#setFrame()`), so an anchor stays put while an animation runs through trimmed
  frames of different measures. Every vertex moves alike, so it works on a grid as on a quad.
- **The default is the middle**, `(0.5, 0.5)`: a kind that gains `Anchor` draws what it drew until
  an anchor is set.
- **`baseArgs`.** The anchor counts from where the base puts the position: with the default
  `baseArgs` the middle of the unit quad, so `(0.5, 1)` is the foot. A `baseArgs` offset moves the
  sprite as well, and the two add up — `baseArgs: [0.5, 0.5, 0, 0.5]` and an anchor of `(0.5, 1)`
  put the position half a sprite below the foot. A kind with `Anchor` leaves `baseArgs` at its
  default. A `halfWidth` or `halfHeight` other than 0.5 breaks the measure of the unit quad, as it
  does for the trim shift (`docs/sprites.md`, "Uploads").
- **Rotation, shear and every placement** come after it: a sprite turns about its anchor, a
  billboard faces the camera about it, the shadow of `ShadowPass` starts at it.
- **`Flip`.** The anchor is a point on the image and mirrors with it: a fighter whose pivot lies at
  0.35 of its width keeps its body on its position when it turns, at 0.65 of the flipped quad.

### 4.3 The pivot of an Aseprite slice

`setAnchorFromPivot(frame, sliceName?)` reads `frame.data.slices` — the slices in force at the frame,
which `AsepriteJson.parse()` writes, each `{bounds, center?, pivot?}` in pixels of the untrimmed
frame, the pivot relative to `bounds`:

```
anchorX = (bounds.x + pivot.x) / W
anchorY = (bounds.y + pivot.y + 1) / H
```

with `W × H` the untrimmed frame — the `sourceSize` of the frame data, else the drawn measures of the
frame's `coords` (`height × width` under `FLIP_DIAGONAL`).

- **Which point of the pixel.** Aseprite marks the pivot as a pixel. The anchor is the **bottom left
  corner** of that pixel: a figure whose pivot marks the pixel under its feet stands on its position,
  and on an even width the middle is the left edge of pixel `W / 2`. The fighter of the lookbook's
  platformer — `pivot {x: 32, y: 63}` in a 64 × 64 canvas — gets `(0.5, 1)`, its contract in
  `apps/lookbook/assets-src/README.md`.
- **Which slice.** `sliceName` names it — an own key of `slices`, so a member of `Object.prototype`
  such as `"constructor"` is no slice; without one, the one slice of the frame that has a pivot.
- **Animations.** `AnimatedFrames` picks the frame on the gpu, so a sprite takes the pivot of one
  frame of its animation — `setAnchorFromPivot(atlas.frame('fighter 0.aseprite'))` when the animation
  starts. A pivot that stays where the ground is across the frames — the rule of an Aseprite canvas,
  and of the fighter's sheet — is all a per-sprite anchor can follow.
- Allocation-free on its way through: it searches the slices without building an array, and writes
  through a tuple declared once.
- **Refusals** (`Error`, the sprite left as it was):
  - a frame whose `data` carries no `slices`:
    `setAnchorFromPivot: the frame carries no slices — read the sheet with AsepriteJson.parse(), exported with its slices (--list-slices), or set the anchor with setAnchor(x, y)`
  - a `sliceName` the frame does not carry:
    `setAnchorFromPivot: the frame carries no slice "feet" — its slices are: pivot, hitbox`
    (`(none)` for none)
  - a named slice without a pivot:
    `setAnchorFromPivot: the slice "hitbox" has no pivot — give it one in Aseprite's slice properties, or set the anchor with setAnchor(x, y)`
  - no `sliceName`, and no slice with a pivot:
    `setAnchorFromPivot: no slice of the frame has a pivot — its slices are: hitbox; give one a pivot in Aseprite's slice properties, or set the anchor with setAnchor(x, y)`
  - no `sliceName`, and several:
    `setAnchorFromPivot: the slices "pivot", "hand" of the frame have a pivot — name one: setAnchorFromPivot(frame, "pivot")`

### 4.4 `writeText()`

`writeText()` places each glyph by the extents of the base (`dynamic-atlas-and-bitmap-text.md`
§5.3) and writes no anchor. A new sprite starts at the anchor `(0.5, 0.5)`, which moves nothing, so a
kind with `Anchor` takes its text exactly where a kind without it does. An anchor set on a glyph
afterwards moves the glyph off its box — to turn a glyph about its foot and keep it in place, move it
along: `glyph.setAnchor(0.5, 1)` and `y −= height / 2`, in general `x += (anchorX − 0.5) · width`,
`y −= (anchorY − 0.5) · height`. `docs/text.md` says so in one paragraph; `writeText()` is unchanged.

## 5. `NineSlice`

### 5.1 API

```ts
export interface NineSliceApi {
  /** The border on the left, in pixels of the frame. Part of `sliceInsets`, a static attribute. */
  insetLeft: number;
  insetTop: number;
  insetRight: number;
  insetBottom: number;
  /**
   * Sets the border of the frame, in pixels of the frame — the corners keep their size, the edges
   * stretch along themselves, the middle both ways. A new sprite starts at 0, 0, 0, 0: stretched as a quad.
   */
  setSliceInsets(left: number, top: number, right: number, bottom: number): void;
  setSliceInsets(insets: [left: number, top: number, right: number, bottom: number]): void;
  /**
   * The size of a pixel of the border in units of the mesh: 1, what a new sprite starts with, draws a
   * border of 8 pixels 8 units wide. A static attribute.
   */
  sliceScale: number;
  /**
   * Writes the frame and its border: the frame through `AtlasFrame` — for a slice, the part of the
   * frame its `bounds` cover — and the insets out of the `center` of an Aseprite slice of the frame,
   * or the ones handed in. Refuses a trimmed frame.
   */
  setSliceFrame(
    frame: TextureAtlasFrame<unknown>,
    slice?: string | readonly [left: number, top: number, right: number, bottom: number],
  ): void;
}

export const NineSlice: SpriteFeature<NineSliceApi>; // name 'nineSlice', requires ['quadSize']
```

- Attributes `sliceInsets: {components: ['insetLeft', 'insetTop', 'insetRight', 'insetBottom']}` and
  `sliceScale: {size: 1}`, both static; `initialize()` writes `0, 0, 0, 0` and `1`.
- **`usageAliases: {texCoords: ['sliceInsets']}`.** `setSliceFrame()` writes the insets with the frame,
  so they take the frame's way up: `attributeUsage: {dynamic: ['texCoords']}` makes them dynamic with
  it, and under the default usage they share the one static buffer, which `touchVO(sprite,
  'texCoords')` marks. The doc comment of `setSliceFrame()` and the guide name
  `touchVO(sprite, 'texCoords', 'sliceInsets')` for a geometry of other usages. `defineSprite()`
  refused a second feature's word `texCoords`; the merge of `usageAliases` now opens a word named
  after an attribute to every feature, when the feature of that attribute declares the word: each
  adds attributes of its own, in the order of the feature list. A word named after the attribute of
  a feature that does not declare it, and two declarations of a word that is no attribute, are still
  refused. In a kind without `AtlasFrame` the word `texCoords` is `NineSlice`'s own.
- `requires: ['quadSize']`: a nine-slice that is never stretched is a quad.

### 5.2 `checkKind`

- A base other than `gridBase({columns: 3, rows: 3})` (identity):
  `needs the base gridBase({columns: 3, rows: 3}), not "quad" — build the kind on it: defineSprite({base: gridBase({columns: 3, rows: 3}), features})`
  — `defineSprite()` prefixes `defineSprite: feature "nineSlice": `.
- A kind no feature of which declares the texture `colorMap`:
  `measures its frame in texels of the colorMap, which no feature of the kind declares — add TextureColor`.
  Without it the uv stage's `textureSize('colorMap')` would throw only when the material is built.

### 5.3 The shader

`line = round(attribute('uv') · 3)` — 0 and 3 the outer grid lines, 1 and 2 the inner ones (the
grid's uv names its line exactly). `on(k) = 1 − min(|line − k|, 1)`. The insets as drawn, mirrored
with the image (§2) and never below 0:
`(iL, iT, iR, iB) = max(0, (mix(left, right, m.x), mix(top, bottom, m.y), mix(right, left, m.x), mix(bottom, top, m.y)))`.

**Position — a local stage at `LocalOrder.Slice` (175, new, between `Flip` and `Scale`).** In the
unit quad, before `QuadSize` scales it by `w × h = |quadSize|` (guarded by `max(·, 1e-6)`):

```
fL = iL · sliceScale / w,  fR = iR · sliceScale / w,  d = max(1, fL + fR)
left = p.x − uv.x                       (the unit quad's left edge, uv the base uv)
x' = p.x + on(1)·(left + fL/d − p.x) + on(2)·(left + 1 − fR/d − p.x)
```

and down the rows with `top = p.y + uv.y`, y counted upwards (`y' = … top − fT/d' … top − 1 + fB/d'`).
After `QuadSize` the border is `inset · sliceScale` units wide, whatever the size.

**Uv — a uv stage at `UvOrder.Slice`.** The frame in texels,
`px = max(|texCoords.zw| · (flipDiagonal > 0.5 ? size.yx : size.xy), 1)` with
`size = textureSize('colorMap')` — `textureSize()` of another feature's texture (phase C §7.8): the
size of the texture bound, `(0, 0)` while it is unset, hence the guard:

```
gL = iL / px.x,  gR = iR / px.x,  e = max(1, gL + gR)
u' = uv.x + on(1)·(gL/e − uv.x) + on(2)·(1 − gR/e − uv.x)
```

and down the rows. Affine within every cell, so the per-vertex varying of `TextureColor` is exact.

- **The grid lines of position and uv move together**, each to its border: a frame pixel of the
  border covers `sliceScale` units on screen, the middle stretches over what is left.
- **Border collapse.** Insets wider than the sprite (`(iL + iR) · sliceScale > w`) shrink in
  proportion until the borders meet: the middle column vanishes, the two borders split the width in
  the ratio of their insets and are drawn squeezed. Insets wider than the frame (`iL + iR > px.x`)
  shrink in the uv alike, so the inner uv lines meet and never cross. No triangle turns over either
  way. Rows likewise.
- **Turned frames.** The insets count left, top, right and bottom of the upright frame — Aseprite's
  `center` and every packer's frame are upright — and `px` takes the drawn measures under
  `flipDiagonal`, so a frame the packer turned slices as its upright copy does.
- **`QuadSize`, `Anchor`, `Flip`.** `QuadSize` scales afterwards; `Anchor` moves every vertex before
  it, which `left = p.x − uv.x` absorbs — a panel anchored at `(0, 0)` is placed by its top left
  corner; under `Flip` the left border is drawn from the frame's right inset (§2).
- **The base measure.** `left = p.x − uv.x` holds for the unit quad of the default `baseArgs` and any
  offset of it, as for the trim shift; a `halfWidth` other than 0.5 breaks it.
- **Trimmed frames** cannot be refused in the shader. A trimmed frame written by `setFrame()` is
  drawn with its border cut where the packer cut it; `setSliceFrame()` refuses it (§5.4).

### 5.4 `setSliceFrame(frame, slice?)`

1. **Untrimmed.** A frame whose trim margins (`frameTrimMargins(frame.data)`) are not all 0 is refused:
   `setSliceFrame: the frame is trimmed — a nine-slice frame is packed untrimmed, or the packer cuts into its border; export it without trimming (TexturePacker: trim mode None; Aseprite: without --trim)`
2. **The insets.** `slice` as four numbers — the insets of the frame, from a file of one's own such
   as the lookbook's `panels.insets.json` — each a finite number of 0 or more, else a `RangeError`:
   `setSliceFrame: the insets are [8, 8, 8] — four numbers of 0 or more, [left, top, right, bottom] in pixels of the frame`.
   `slice` as a name, or absent: the Aseprite slice of that name, or the one slice of the frame that
   has a `center`; refused with the messages of §4.3 in its own words
   (`setSliceFrame: the slice "x" has no center — turn on 9-Slices in Aseprite's slice properties, or hand the insets in: setSliceFrame(frame, [left, top, right, bottom])`, and alike).
   The insets out of a slice: `left = center.x`, `top = center.y`,
   `right = bounds.w − center.x − center.w`, `bottom = bounds.h − center.y − center.h`.
3. **The frame.** Through `AtlasFrame` (`setTexCoords()`, `texFlipDiagonal`, `setTexTrim(0, 0, 0, 0)`):
   for insets handed in, the whole frame; for a slice, the part `bounds` covers —
   `(s + u · bx / W, t + v · by / H, u · bw / W, v · bh / H)` with `W × H` the frame (§4.3), right
   for a turned frame as the drawn x is the `s` axis. A UI kit drawn on one Aseprite canvas — one
   frame, a slice per panel — gives every panel by its name.
   A sprite without `setTexCoords()` — a kind of `AnimatedFrames` — is refused:
   `setSliceFrame: the sprite has no setTexCoords() — setSliceFrame() writes the frame through AtlasFrame; build the kind with AtlasFrame, or set the insets with setSliceInsets()`.
4. Every check runs before the first write; allocation-free on its way through.

The size of the sprite stays the caller's: `setSize()` stretches the panel, `sliceScale` sizes the
border.

## 6. What composes with what

| | `Flip` | `Anchor` | `NineSlice` |
| --- | --- | --- | --- |
| trimmed frame | margins mirrored | fraction of the untrimmed sprite | refused by `setSliceFrame()` |
| turned frame | mirrors along the drawn x | — | insets of the upright frame |
| `AnimatedFrames` | every frame, every playback | one anchor per sprite | allowed; `setSliceFrame()` refused |
| `gridBase()` | any grid | any grid | only `gridBase({columns: 3, rows: 3})` |
| `QuadSize` | — | scales with it | required; borders keep their size |
| passes | flipped image | shadow from the anchor | sliced in every pass |
| `Flip` | — | anchor mirrored | insets mirrored |

## 7. Tests, docs, CHANGELOG

### 7.1 Vitest (`src/sprites/features/`)

- `Flip.spec.ts`: declaration (attribute, band), a new sprite at `0, 0` whatever its slot held,
  `setFlip()`; the stage worked out by `evaluateNode()` on uniforms for every combination of `flipX`,
  `flipY`, an upright and a turned frame, trim present and absent, a prior `mirror`, a flag of 0.7;
  the stage reads no position.
- `Anchor.spec.ts`: declaration, default `(0.5, 0.5)`, the shift for `(0, 0)`, `(0.5, 1)`,
  `(1, 0.25)`, mirrored and not; `setAnchorFromPivot()` — the fighter's `(0.5, 1)`, a slice with
  bounds off the origin, a named slice, the one slice, `sourceSize` absent (coords, and turned
  coords), every refusal.
- `NineSlice.spec.ts`: declaration, defaults, both refusals of `checkKind` through `defineSprite()`,
  the position and uv stages worked out at each grid line — plain, scaled, collapsed, mirrored,
  turned frame, unset `colorMap` (`(0, 0)`), negative insets; `setSliceFrame()` with insets, with a
  slice of a UI-kit frame, with the one slice, on a turned frame, every refusal.
- `SpriteFeature.spec.ts`: `LocalOrder` gains `Slice: 175`.
- `FeatureSpritesMaterial`: a kind of `Flip` and `Anchor` builds a position graph that reads `flip`
  through the frame's `mirror`; a kind without `Flip` builds no mirror node.
- `src/text/writeText.spec.ts`: glyphs of a kind with `Anchor` keep the anchor `(0.5, 0.5)`.
- `evaluateNode()` (`src/testing/spriteGraph.ts`) learns `step`, `abs`, `min` and `round`.

### 7.2 Allocations

`src/sprites/hot-path-allocations.flip-anchor-nine-slice.spec.ts`: `flipX`, `setFlip()`,
`setAnchor()`, `setAnchorFromPivot()`, `setSliceInsets()`, `sliceScale`, `setSliceFrame()` (insets
and slice) on 1000 sprites, under one byte per call.

### 7.3 Browser (WebGPU and WebGL 2, `packages/twopoint5d-testing/test/`)

- `sprites-flip.test.js`: a flipped trimmed animated sprite — frames trimmed and turned-trimmed,
  under `'loop'`, `'once'`, `'pingpong'` and per-frame durations — drawn cell by cell as the mirror
  image of the untrimmed sprite, under the default `FrontSide`; flipped along y and both; on
  `gridBase({columns: 4, rows: 2})` as on the quad; `ReflectionPass` and `ShadowPass` of a flipped
  sprite draw what they draw for the sprite of the mirrored image.
- `sprites-anchor.test.js`: anchor at the foot — the image stands on its position, a `Rotation` of
  π turns it about the foot; a pivot of an Aseprite slice off the middle keeps the foot on the
  position when the sprite flips.
- `sprites-nine-slice.test.js`: a 24 × 24 frame with 8-pixel borders drawn as panels of two sizes
  keeps its borders at 8 units; `sliceScale: 2` at 16; a turned frame as the upright one; a panel
  narrower than its borders splits its width between them; a UI kit frame sliced by
  `setSliceFrame(frame, name)`; a flipped panel of unequal insets; an anchor of `(0, 0)` places the
  panel by its top left.
- `cellColors`, `mirroredX`, `mirroredY` and `expectSameCells` of `sprites-pipeline-stages.test.js`
  move to `helpers/fixtures.js`.

### 7.4 Docs and CHANGELOG

`docs/sprites.md`: the pipeline table (frame stage `Flip`, local `Anchor`, `NineSlice`, uv
`NineSlice`), the band `LocalOrder.Slice`, the features table, three sections under "Built-in
features" — "Flip", "Anchor", "Nine-slice panels" — each with a `ts check` block, and `mirror` in
the field list of "Writing a feature". `docs/text.md`: the anchor paragraph of §4.4. CHANGELOG
`[Unreleased]`, "Added": `Flip`; `Anchor`; `NineSlice`; `SpriteFrameNodes.mirror` and
`LocalOrder.Slice`. Nothing breaks.

## 8. Decisions, and where the sketch was wrong

1. **The frame records its mirror** (§2): `Anchor` and `NineSlice` place things on the image and
   mirror them along with it; the alternative — a stage context that answers whether the kind holds
   an attribute — adds a member to a context every caller of a stage builds.
2. **`step(0.5, flip)`** (§3.1): the roadmap's `hero.flipX = velocity.x < 0` is a boolean, which the
   type refuses; the shader never draws a half-mirrored image.
3. **`Anchor` adds to `baseArgs`** (§4.2): the default `(0.5, 0.5)` keeps every kind of today as it
   is; an anchor that overrode `baseArgs` would need the base's offset in the shader.
4. **The pivot is the bottom left corner of its pixel** (§4.3), the contract of the lookbook's
   sheets.
5. **`sliceScale`** (§5.1): the insets are pixels of the frame, which the uv needs as they are; the
   position needs them in units of the mesh, and the camera decides how many a pixel takes. The
   phase C proof drew one unit per pixel.
6. **`LocalOrder.Slice` is 175** (§5.3); the phase C proof ran at `Scale − 20`.
7. **Border collapse shrinks in proportion** (§5.3), in the position and in the uv: no triangle turns
   over, no inner uv line crosses another.
8. **`setSliceFrame()` takes a slice name or the insets** (§5.4): the one call that refuses a trimmed
   frame serves both the Aseprite UI kit and a packer with insets of its own.
9. **`NineSlice` requires `quadSize`** and refuses a kind without `colorMap` in `checkKind` (§5.2); it
   composes with `QuadSize` rather than taking its band, as phase C §9.7 decided.
