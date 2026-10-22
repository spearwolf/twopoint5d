# Proposal: frame stages, uv stages, a grid base and shared uniforms

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "The pipeline", "A grid base"
and "Writing a feature" (the fields `frameStage`, `uv`, `uniforms`, `checkKind` and the stage
context), and the browser proofs of §7 in
`packages/twopoint5d-testing/test/sprites-pipeline-stages.test.js`. Deviations of the build from
the first draft of this spec, which the sections below now state as built:

- seen at a slant, a vertex of a grid on an outer edge of the sprite is rounded apart from the
  line between the corners: the shadow of `ShadowPass` under a grid sprite matches the quad's but
  for a few pixels on its edges (at most 2 % of the lit pixels, §8.3); seen straight on, the grid
  draws the quad's picture pixel for pixel;
- `runCheckKind()`, which calls a hook and names the feature in its error, lives in the internal
  module `runCheckKind.ts`; the type of what the hook is shown is exported as `SpriteKindShape`
  (§6);
- the grid's specs live in `src/sprites/GridBase.spec.ts`, the slot specs in
  `src/sprites/FeatureSprites/pipelineStages.spec.ts` and the merge table in
  `src/sprites/spriteDeclarations.spec.ts`; `GridBaseVO` also names the generated
  `getPosition()` and `getUv()`;
- the test-only nine-slice runs its local stage at `LocalOrder.Scale - 20`; the band
  `LocalOrder.Slice` stays for phase D to add with the feature (§7.2);
- the browser fixture `makeTrimmedSheet()` moved into `test/helpers/fixtures.js`, which it now
  serves twice;
- `textureSize()` of a set texture without `needsImage` is three's `textureSize()` of a registered
  texture node, not the uniform of `SpriteResources`: the uniform follows the texture signal only,
  and a `TextureLoader` texture whose image arrives after `setTexture()` changes no signal (§7.8).

Phase C of [`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md) (§4.7, §4.8, decision
2 of its §7 taken: `shared: true`): the one change to the feature model the roadmap asks for. Two
new slots, a second base, a uniform several features may declare — and the hooks the features of
phases D and E need from them, so that those are built on the slots alone (§7). Where the
roadmap's sketch is wrong about the code, the section says what holds; §9 collects it.

## 1. Goal

| item | what is missing today | § |
| --- | --- | --- |
| frame stages | nothing runs between the frame slot and its two readers: `Flip` cannot mirror a frame without turning the triangles over | 2 |
| uv stages | `TextureColor` samples at the base `uv` attribute; no feature can move where a vertex samples — `NineSlice` cannot keep its corners | 3 |
| `gridBase()` | four vertices: a sprite cannot keep its corners when stretched, and cannot bend | 4 |
| shared uniforms | a second feature that declares `time` is refused; the guide's `Bob` ties itself to `AnimatedFrames` to read it | 5 |
| `checkKind` | a feature cannot refuse a kind it cannot work in — `NineSlice` on a quad, `Rotation` under a segment placement | 6 |

Every kind of today builds the same graph as before (§8.1).

## 2. Frame stages

### 2.1 The slot

```ts
export interface SpriteFrameStage {
  /** Where among the frame stages this one runs; lower runs first, a tie keeps the order of the feature list. */
  readonly order: number;
  transform(frame: SpriteFrameNodes, ctx: SpriteFrameContext): SpriteFrameNodes;
}

// SpriteFeature
/** A stage on the frame, after the frame slot and before the trim shift and both pipelines read it. */
readonly frameStage?: SpriteFrameStage;

/** The order bands of the frame stages. */
export const FrameOrder = Object.freeze({Flip: 100} as const);
```

- **Where:** inside the frame memo of `FeatureSpritesMaterial`, right after the frame slot (or the
  defaults, `texCoords = vec4(0, 0, 1, 1)`, when the kind has no frame feature or it waits for a
  texture): `frame = stage.transform(frame, ctx)` for every active frame stage in order. The
  trim shift, every local, placement and mesh stage, the color source and the color stages read
  the result — `ctx.frame` and the `frame` argument of `colorSource` alike.
- **Context:** `SpriteFrameContext` — `attribute`, `uniform`, `sample`, `textureSize` — as the
  frame slot gets it; a frame stage has no `frame` or `uv` in its context, the frame is its input.
  Its lookups through `sample()` are registered in the scope `frame`, so a new texture of the same
  kind reaches them without a rebuild, as it reaches the lookups of the frame slot.
- **A stage answers a whole `SpriteFrameNodes`.** `flipDiagonal` and `trim` stay optional: a
  stage that has no business with them passes them on (`{...frame, texCoords}`); one that
  answers no `trim` drops the trim shift.
- The field is **`frameStage`**, singular — a feature brings at most one stage per slot, as its
  `local`, `mesh` and `color` are singular. `SpritePipeline` holds them as `frameStage: readonly
  SpriteFeature[]`, sorted. The roadmap's sketch calls the slot `frameStages`.
- `FrameOrder.Flip` is the band of `Flip` (phase D). `LocalOrder.Flip` stays as it is: the band
  of a local stage of one's own that mirrors the geometry itself — which turns the triangles over
  and needs `side: DoubleSide`; the guide says which one to take.
- `defineFeature()` refuses a `frameStage` whose `order` is not finite, in the words it uses for
  the other stages (`defineFeature: the frameStage stage of feature "x" needs a finite order, got
  NaN`).

### 2.2 What a frame stage may assume

- `texCoords` is `vec4(s, t, u, v)` and the lookup reads `(s + uv.x · u, t + uv.y · v)` before the
  diagonal swap, so **the drawn x is always the `s` axis** — a turned atlas frame included
  (`frameUv`, `TextureCoords`: "under `FLIP_DIAGONAL` `s` and `u` run along the y axis of the
  texture"). A mirror of the drawn image along x is `(s + u, t, −u, v)` for every frame.
- `trim` is `[left, top, right, bottom]` of the drawn sprite, as fractions of the untrimmed
  sprite — for a turned frame as well (`frameTrimMargins()` reads `spriteSourceSize`, which is
  in the space of the upright sprite).
- The frame is the same for every vertex of an instance.

## 3. Uv stages

### 3.1 The slot

```ts
// SpriteFeature
/** A stage on the uv the color source samples at, before the color source reads it. */
readonly uv?: SpriteStage<'vec2'>;

// SpriteShaderContext
/**
 * The uv the color source samples at: the base `uv` after every uv stage — `(0, 0)` the top left
 * of the frame as drawn, `(1, 1)` its bottom right. In a uv stage, the uv so far: its own input.
 */
readonly uv: Node<'vec2'>;

/** The order bands of the uv stages. */
export const UvOrder = Object.freeze({Slice: 100} as const);
```

- **`TextureColor` reads `ctx.uv`** instead of `attribute('uv')`:
  `sample('colorMap', frameUv(frame.texCoords, ctx.uv, frame.flipDiagonal))`. Every color source
  and every pass stage that wants the uv of the sprite takes `ctx.uv`; the base attribute,
  `attribute('uv')`, stays readable from every stage for where the vertex lies on the base.
- **Built lazily, once per graph and scope.** `ctx.uv` is a getter: the first stage of a graph
  that reads it builds the chain `attribute('uv') → uv stages in order`, later reads in the same
  graph get the same node. A graph that never reads it builds no uv stage — the position graph of
  every kind of today. Without uv stages `ctx.uv` is `attribute('uv')`, the node `TextureColor`
  built before (§8.1).
- The uv stages get the final frame in `ctx.frame` and their own input as `ctx.uv`; their lookups
  are registered in the scope of the graph that reads the uv (`color` for a color source), so a
  texture swap reaches them.
- A uv stage of a feature whose textures are not all set drops out, as every stage does.
- **Where it runs.** A uv stage's nodes are evaluated where its reader uses them. `TextureColor`
  hands the uv to `frameUv()`, which passes the frame position through a varying: the uv stages run
  per vertex and the result is interpolated across each triangle — exact for a stage that is
  affine within each triangle (`NineSlice` moves grid lines, §7.2). A reader that needs the uv per
  fragment — a repeat, a `fract()` — reads `ctx.uv` in its own fragment graph and passes no
  varying (`RepeatingTextureColor`, §7.4); an attribute read in the fragment graph is interpolated
  by three on its own.
- `SpriteShaderContext` gains a required member. Code that calls a stage with a context of its
  own adds `uv`; the test helper `stubShaderContext()` answers `attribute('uv')`. The CHANGELOG
  says it under "Changed".

### 3.2 Passes and renamed copies

A pass feature may bring a frame stage and a uv stage like any other stage (they are no data); a
pass's `without` leaves them out like any other. `renamedCopy()` of `uniformNames` wraps
`frameStage` and `uv` as it wraps `local`, and keeps the getter `uv` of the context it hands on
(it copies the property descriptors instead of spreading the context, which would read the getter).

## 4. `gridBase()`

### 4.1 The factory

```ts
export interface GridBaseOptions {
  /** The cells across, a whole number from 1 to 1024; `columns · rows` is at most 4096. */
  readonly columns: number;
  /** The cells down, a whole number from 1 to 1024; `columns · rows` is at most 4096. */
  readonly rows: number;
}

/** A base of `columns × rows` cells, `QuadBase`'s quad cut into a grid. */
export interface GridBase extends SpriteBase<QuadBaseArgs> {
  readonly columns: number;
  readonly rows: number;
}

export interface GridBaseVO extends SpriteBaseVO {
  setPosition(position: ArrayLike<number>): void;
  setUv(uv: ArrayLike<number>): void;
  make(halfWidth?: number, halfHeight?: number, xOffset?: number, yOffset?: number): void;
}

export function gridBase(options: GridBaseOptions): GridBase;
```

- **One frozen base per option set**, memoized by `columns × rows` as `flatPlacement()` memoizes
  its features: `gridBase({columns: 3, rows: 3}) === gridBase({columns: 3, rows: 3})`, so a
  feature recognizes its base by identity (§6) and every geometry of the kind shares one
  descriptor. Name: `grid 3x3`.
- **Layout** — as `QuadBase` lays out four, on more vertices: `(columns + 1) × (rows + 1)`
  vertices, row by row from the top, left to right; vertex `k = j · (columns + 1) + i` for the
  column line `i ∈ 0 … columns` and the row line `j ∈ 0 … rows`:
  - `position = (−halfWidth + xOffset + 2·halfWidth · i / columns, +halfHeight + yOffset −
    2·halfHeight · j / rows, 0)`
  - `uv = (i / columns, j / rows)` — `(0, 0)` at the top left, y downwards, as on the quad.
- **Indices:** per cell `(i, j)` with the corners `TL = k(i, j)`, `TR = k(i + 1, j)`,
  `BL = k(i, j + 1)`, `BR = k(i + 1, j + 1)` the two triangles `[BL, TR, TL]` and `[BL, BR, TR]`
  — the quad's `[0, 2, 1, 0, 3, 2]` with `A = BL`, `B = TL`, `C = TR`, `D = BR`: the same winding
  (counter-clockwise from the front) and the same diagonal. `columns · rows · 2` triangles.
- **Attributes** `position: {size: 3}` and `uv: {size: 2}`: no per-vertex properties (`x0 … x15`
  on a 3 × 3 grid, three per vertex on a large one), only `setPosition()` and `setUv()`; the base
  vertex object is filled once per geometry by `make()`.
- `defaultArgs` `[0.5, 0.5]`: the unit quad `[−0.5, 0.5]²`, as `QuadBase`; `baseArgs` of
  `FeatureSpritesGeometry` take the same four numbers.
- **The grid line of a vertex** is exact in its uv: `round(uv.x · columns)` is `i`, `round(uv.y ·
  rows)` is `j` — `i / columns` is stored as the `float32` nearest to it, and the rounding takes
  it back for every `columns ≤ 1024`. A stage reads the base uv through `ctx.attribute('uv')`.
- **Refusals** (`TypeError`, before anything is built): options that are no object
  (`gridBase: takes {columns, rows} — gridBase({columns: 3, rows: 3})`); a `columns` or `rows`
  that is no whole number from 1 to 1024 (`gridBase: columns is 2.5 — columns and rows are whole
  numbers from 1 to 1024`); a grid of more than 4096 cells (`gridBase: a grid of 1000 × 1000 is
  1000000 cells — a grid holds at most 4096`). Neither is a limit of the GPU: 1024 per axis keeps
  the grid line of every vertex exact in its uv, and 4096 cells keep a typo (`columns: 1000, rows:
  1000`) from building a base of a million vertices for every sprite, whose indices the cache of
  bases would hold for the life of the page.
- `QuadBase` is unchanged. `gridBase({columns: 1, rows: 1})` draws what `QuadBase` draws, with
  another vertex order.

### 4.2 What works on it unchanged

Instancing, the pool, every pass, every placement, the trim shift (it reads the base uv of each
vertex, so the inner vertices of a trimmed sprite move proportionally), `AtlasFrame`,
`AnimatedFrames`, `TextureColor`: none of them reads the vertex count. The draw count of the
instanced geometry is `indices.length` of the base (`InstancedVOBufferGeometry`).

A grid costs vertices: a 3 × 3 grid shades 16 vertices per sprite instead of 4, a 16 × 1 strip 34.
The guide says to take the quad unless a stage bends or slices.

## 5. Shared uniforms

### 5.1 The declaration

```ts
/** A uniform declared with options: `shared` lets several features declare it. */
export interface SpriteUniformDeclaration {
  readonly value: SpriteUniformValue;
  /**
   * The features that declare this name shared hold one uniform: they declare it with the same
   * type and start value. Default `false`: a second feature that declares the name is refused.
   */
  readonly shared?: boolean;
}

// SpriteFeature
readonly uniforms?: Readonly<Record<string, SpriteUniformValue | SpriteUniformDeclaration>>;
```

`AnimatedFrames` declares `uniforms: {time: {value: 0, shared: true}}`. A `wave()`, a `Bob`, a
`Ballistic` declare the same and read the same `time` — one `setUniform('time', t)` drives all.

### 5.2 The merge — `collectSpriteDeclarations()`

Two declarations of one name, by two features of different origin (the rule for copies of one
feature and renamed copies stays first, as it is):

| first | second | result |
| --- | --- | --- |
| shared | shared, same type and start value | one uniform, held for the first feature |
| shared | shared, another type | refused |
| shared | shared, another start value | refused |
| shared | not shared (or the other way round) | refused |
| not shared | not shared | refused, as today |

The messages keep their head and add the reason and the fix (`where` is `defineSprite`,
`FeatureSprites`, `FeatureSpritesMaterial` or `SpriteResources`):

- `features "a" and "b" both declare the uniform "x" — rename one of them, or declare it as
  {value, shared: true} in both to share one uniform`
- `features "animatedFrames" and "bob" both declare the uniform "time", and only "animatedFrames"
  shares it — declare it as {value: 0, shared: true} in "bob" as well, or rename one of them`
  (the start value is the shared declaration's, as JSON)
- `features "a" and "b" both declare the uniform "x", shared, as a float and as a vec2 — a shared
  uniform has one type and one start value in every feature that declares it; rename one of them`
- `features "a" and "b" both declare the uniform "x", shared, starting at 0 and at 1 — a shared
  uniform has one type and one start value in every feature that declares it; give both the same
  start value`

A declaration that is neither a uniform value nor `{value, shared?}` with a valid value, a
boolean or absent `shared` and no other key is refused: `feature "x" starts the uniform "time"
with {value: 0, share: true}; a uniform takes a number, 2 to 4 numbers, or {value, shared}`.

### 5.3 Where the merge reaches

- **Kinds and passes alike:** the shared resources of a `FeatureSprites` with passes collect the
  features of the kind and of every pass (`resolveParts()`), so a pass feature that declares
  `time` shared reads the `time` of `AnimatedFrames`.
- **`uniformNames`** renames a shared uniform like any other: the renamed copy declares
  `shadowTime` shared, and merges only with declarations of that name. A rename onto a name the
  kind declares is refused as before — now with the reason (shared versus not, or both not).
- **`bindUniform()`, `setUniform()`, the `uniforms` option, a pass's `visible` hook** look a
  uniform up by name, and a shared name is one uniform: nothing changes there.
- `SpriteResources.declares(feature)` reads the names, as before.

### 5.4 The guide's `Bob`

Declares `uniforms: {time: {value: 0, shared: true}}` and `requires: ['instancePosition']` only: it
bobs in a kind without animations, and next to `AnimatedFrames` it reads the same `time`.

## 6. `checkKind` — a feature refuses a kind

```ts
/** What `checkKind` is shown of a kind. */
export interface SpriteKindShape {
  readonly base: SpriteBase;
  readonly features: readonly SpriteFeature[];
}

// SpriteFeature
/**
 * Checks the kind the feature is part of, once, when `defineSprite()` merges it — after every
 * check of its own — and when a pass that brings the feature is folded into a kind. Throws an
 * `Error` whose message names the fix for a kind the feature cannot work in.
 */
readonly checkKind?: (kind: SpriteKindShape) => void;
```

- `defineSprite()` calls the hook of every feature with the base and the features of the kind and
  rethrows a throw as `defineSprite: feature "nineSlice": <message>`, the original as `cause`.
- `passFeatures()` calls the hooks of the features of the pass with the base of the kind and the
  folded features (`FeatureSprites: feature "x" of pass "p": <message>`). The features of the kind
  were checked by `defineSprite()`.
- A placement may carry `checkKind` and still stand in for another on a live material: the swap
  calls it with the features of the kind, the new placement in place of the kind's.
- `defineFeature()` refuses a `checkKind` that is no function (`defineFeature: the checkKind of
  feature "x" is no function`).
- Phase D uses it twice (§7): `NineSlice` refuses a base other than `gridBase({columns: 3, rows:
  3})`, and `segmentPlacement()` refuses `Rotation` and `Shear` next to it.

## 7. The features of phases D and E — how each is built on these slots

Each is a sketch of the build, not its API; the phase writes its own spec. The first three have a
test-only proof in this phase (§8.3).

### 7.1 `Flip` (D)

A frame stage at `FrameOrder.Flip`, an attribute `flip` (`flipX`, `flipY`, static, 0 or 1):

```ts
frameStage: {
  order: FrameOrder.Flip,
  transform: (frame, {attribute}) => {
    const flip = attribute<'vec2'>('flip');
    const {texCoords: c} = frame;
    const trim = frame.trim ?? vec4(0, 0, 0, 0);
    // a mirror of the drawn x is (s + u, −u); mix() with the 0-or-1 flag needs no branch
    const texCoords = vec4(add(c.x, mul(c.z, flip.x)), add(c.y, mul(c.w, flip.y)), mul(c.z, sub(1, mul(2, flip.x))), mul(c.w, sub(1, mul(2, flip.y))));
    return {...frame, texCoords, trim: vec4(mix(trim.x, trim.z, flip.x), mix(trim.y, trim.w, flip.y), mix(trim.z, trim.x, flip.x), mix(trim.w, trim.y, flip.y))};
  },
},
```

- The drawn x is the `s` axis for every frame (§2.2), so the same stage mirrors an upright and a
  turned atlas frame, and every frame `AnimatedFrames` picks.
- The trim margins swap left/right (top/bottom), so a trimmed frame stays where the flipped
  untrimmed sprite has it — the trim shift reads the stage's result.
- The position is untouched: the triangles never turn over, `FrontSide` keeps drawing it.
- With `frame.trim` absent the stage may answer `trim` of zeros: the shift then adds 0.

### 7.2 `NineSlice` (D) on `gridBase({columns: 3, rows: 3})`

- **Base:** `checkKind` refuses any base but `gridBase({columns: 3, rows: 3})` (identity):
  `NineSlice needs the base gridBase({columns: 3, rows: 3}) — build the kind on it`.
- **Data:** `sliceInsets` (left, top, right, bottom) in pixels of the frame, static.
- **The grid line** of a vertex: `round(attribute('uv') · 3)` — 0 and 3 are the outer lines, 1 and
  2 the inner ones (§4.1).
- **Position — a local stage before `LocalOrder.Scale`**, so that `QuadSize` keeps its stage and
  scales afterwards: in the unit quad, the inner line 1 moves to `left + insetLeft · s / width`
  and 2 to `left + 1 − insetRight · s / width`, with `left = p.x − uv.x` (the base relates
  position and uv by the unit extent of the default `baseArgs`, as the trim shift assumes), `s`
  the world units per frame pixel, `width` the `quadSize` of the sprite; the same down the rows,
  y counted upwards. After `QuadSize` scales, the border is `inset · s` world units, whatever the
  size. The roadmap's sketch has `NineSlice` take the `Scale` band "in place of `QuadSize`'s
  stage" — a feature cannot remove another's stage; one in the unit quad before it composes.
  Phase D gives it a band (`LocalOrder.Slice`, between `Flip` and `Scale`).
- **Uv — a uv stage at `UvOrder.Slice`**: the inner lines move to `insetLeft / framePixels.x` and
  `1 − insetRight / framePixels.x` (and down). `framePixels`, the measures of the drawn frame in
  texels: `abs(frame.texCoords.zw) · (frame.flipDiagonal > 0.5 ? size.yx : size.xy)` with `size =
  ctx.textureSize('colorMap')` — `textureSize()` reads the size of a texture another feature
  declares (§7.8), the size of the texture the shader binds: a `colorMap` whose image a loader fills
  in after `setTexture()` gives its real measures once the image is uploaded, with no
  `touchTexture()`; before that the bound default texture is 1 × 1, and while no `colorMap` is set
  the size is `(0, 0)` — guard with `max(framePixels, 1)`. Affine within each cell: the per-vertex
  varying of `TextureColor` is exact.
- **Trimmed frames** cannot be refused in the shader; a frame is data written at run time. Only a
  method that takes the frame — a `setSliceFrame(frame)` that also reads Aseprite's
  `slices[].center` — can refuse one, naming the fix (pack the frame untrimmed).

### 7.3 `wave()` (D)

A mesh stage at `MeshOrder.Offset`, uniforms `waveAmplitude`, `waveFrequency`, `waveSpeed` and
`time: {value: 0, shared: true}` (§5). The weight is the **base** uv: `ctx.attribute('uv').y` —
`1 − uv.y` for `'top'`, 1 for `'uniform'`; the phase from `attribute('instancePosition')`. On a
quad the weight is linear, a shear; on `gridBase({columns: 1, rows: n})` each row line moves on
its own, a bend. Needs nothing new beyond shared `time`.

### 7.4 `RepeatingTextureColor` (D)

A color source that declares `colorMap` itself and samples per fragment: it reads `ctx.uv` in the
fragment graph (no varying), multiplies `uv.x` by the repeat count and hands the result to the
math of `sampleAtlasFrame()` (`wrap: ['repeat', 'clamp']`). Phase D splits that function into the
table lookup and an internal `sampleFrameAt(lookup, frame, uv, options)` whose `lookup(st)` is
`ctx.sample('colorMap', st)` in the feature and `texture(map, st)` in `sampleAtlasFrame()` — one
implementation. The frame comes from `frame` (`texCoords`, `flipDiagonal`, `trim`), the texel
measures for `inset` from `ctx.textureSize('colorMap')`. The `.grad()` of a mipmapped sample works
on the node `sample()` answers (a texture node).

### 7.5 `Anchor` (D)

A local stage at `LocalOrder.Anchor` that shifts the unit quad by `(0.5 − anchorX, anchorY −
0.5)`. Runs after the trim shift and before `Scale`; on a grid the shift moves every vertex
alike. Needs nothing new.

### 7.6 `tableFrame()` (E)

A frame-slot feature: `frameIndex` (float, static), a data texture of frames declared as a
texture (decision 3), read through `ctx.sample()` and `ctx.textureSize()` at build time, three
texels per frame as `AnimatedFrames` reads them. Directional views (`views: n`) fold the view
angle into the index inside the frame slot — `cameraPositionLocal()` is a node any slot may read
— before the lookup; a frame stage runs after the frame is resolved and could not. A `Flip`
after it mirrors the picked view. Needs nothing new.

### 7.7 `PaletteSwap` (E)

A color stage after the color source (`paletteRow` static, `palette` texture, `paletteShift`
uniform). The comparison against the source row is unrolled in JavaScript — one `ctx.sample()`
per palette entry, built eagerly as `AnimatedFrames` builds its search — never inside a TSL
`Loop`/`If` callback, whose lookups would escape the registration. Needs nothing new for the
shader. The one-time warning for a linear-filtered `colorMap` reads a texture's filters, which no
stage context offers; phase E decides where it lives.

### 7.8 What every one of them may rely on

- Lookups through `ctx.sample()` at graph build time only — never inside a TSL `Fn`, `If` or
  `Loop` callback, which three runs while it compiles: the material could not hand such a lookup
  a new texture of the same kind.
- `ctx.textureSize(name)` reads the texture size of any texture a feature of the material
  declares. For a set texture it is three's `textureSize()` (`TextureSizeNode`: `textureDimensions`
  in WGSL, `textureSize` in GLSL ES 3.0) of a texture node the material registers like a lookup:
  the size of the texture bound, so it follows an image that arrives or changes after the texture
  was set, and a swap to a texture of the same kind without a rebuild. A texture declared with
  `needsImage` keeps the uniform of `SpriteResources#textureSize()`, kept current by the material
  and re-read by `touchTexture()` — the feature waits for its image anyway, and `AnimatedFrames`
  builds the graph it built before. For a texture of another feature that is unset it is that
  uniform at `(0, 0)`, the reader does not wait for it, and setting the texture builds the graph
  anew — a stage that divides by it guards with `max(size, 1)`. `ctx.sample()` stays limited to the
  feature's own textures. A name no feature of the material declares is refused, naming it:
  `FeatureSpritesMaterial: feature "x" reads the size of the texture "y", which no feature of these sprites declares`.
- The color pipeline order of phase A stays: the color stages of the kind (`Tint`, `Fade`,
  `Flash`, `PaletteSwap`) first, pass stages in `ColorOrder.Pass` last, a tie keeps a kind's
  stage before a pass's.
- Tests walk sprite graphs with `nodesOf()` (`src/testing/spriteGraph.ts`), never with
  `Node#traverse()`: the 13-step search of `AnimatedFrames` has `2^13` paths.

## 8. Tests

### 8.1 The kinds of today build the same graph

- `graphSignature(root)` joins `src/testing/spriteGraph.ts`: a canonical text of the graph below
  `root` — each node once, in the order of a walk, with its type, its operator, method, swizzle,
  attribute name or constant value, and the indices of its children. Two graphs of the same
  structure answer the same text.
- `src/sprites/FeatureSprites/fixtures/preset-graphs.json` holds the signatures of the
  `positionNode` and the `colorNode` that `TexturedSpriteKind`, `AnimatedSpriteKind` (with an
  animsMap and without) and a `ShadowPass`, `ReflectionPass` and `BillboardReflectionPass` material
  over each built at the branch point of this phase (main at `92508e8d`), written by
  `presetGraphs.spec.ts` with `UPDATE_SPRITE_GRAPHS=1` on the sources of that commit. The spec
  holds the graphs of today to them, string for string. A three bump that changes how its nodes are
  built changes them as well; the fixture is then written anew and its diff read.
- Every browser test of the sprites keeps passing unchanged — the pixel proof.

### 8.2 Vitest

- `SpriteFeature.spec.ts`: `FrameOrder`, `UvOrder`; `defineFeature()` refuses a non-finite order of
  `frameStage` and `uv`, a `checkKind` that is no function.
- `spritePipeline` / `defineSprite.spec.ts`: `frameStage` and `uv` sorted by order, ties in list
  order; `checkKind` called with base and features, its throw wrapped with the feature named and
  the cause kept; called after the other checks.
- `FeatureSpritesMaterial.spec.ts`: frame stages run in order after the frame slot, on the
  defaults without a frame feature, and both graphs read their result (trim shift and color
  source); a frame stage waiting for its texture drops out; its lookups reach a swapped texture
  without rebuild; uv stages in order, built once per graph, not at all in the position graph of
  a kind that does not read `ctx.uv`; `ctx.uv` of a uv stage is its input; `textureSize()` of a
  texture another feature declares, refused for one none declares; a placement with `checkKind`
  swaps in and its check runs.
- `passes/pass-features.spec.ts`, `passUniformNames.spec.ts`: a pass brings a frame stage and a
  uv stage; a renamed copy wraps both and keeps `ctx.uv` lazy; `checkKind` of a pass feature runs
  against the folded features.
- `GridBase.spec.ts`: vertex count, positions, uvs, indices for 1 × 1, 3 × 3 and 4 × 2,
  the winding of every triangle counter-clockwise, `baseArgs`, memoized identity, name, the
  refusals; `round(uv · columns)` gives every column line back for 1024.
- `spriteDeclarations` (through `defineSprite.spec.ts`, `SpriteResources.spec.ts`,
  `FeatureSprites.spec.ts`): the table of §5.2 and its messages; a shared uniform of a kind and of
  a pass is one node; `bindUniform()` and `setUniform()` on it; a renamed shared uniform is a
  uniform of its own; the declaration object refused when malformed.
- `AnimatedFrames.spec.ts`: `time` is declared shared; a kind of `AnimatedFrames` and a `Bob` that
  declares `time` shared holds one `time`.
- No hot path changes: the allocation specs stay as they are.

### 8.3 Browser (WebGPU and WebGL 2)

- `sprites-grid-base.test.js`: a sprite on `gridBase({columns: 1, rows: 1})` and one on
  `gridBase({columns: 4, rows: 2})` draw the image of the same sprite on `QuadBase`, pixel for
  pixel — an atlas frame, a turned frame, a trimmed frame, through `TextureColor`; with a
  `ShadowPass` seen at a slant, pixel for pixel but for at most 2 % of the lit pixels on the edges.
- `sprites-pipeline-stages.test.js`, with test-only features defined in the file:
  - a **flip** frame stage (§7.1) mirrors an upright, a turned and a trimmed atlas frame and an
    animated frame, each held cell by cell to the mirror image of the unflipped sprite, and flips
    vertically as well;
  - a **nine-slice** local stage and uv stage on `gridBase({columns: 3, rows: 3})` (§7.2): a 9 × 9
    texel frame with a border of 3 texels drawn at 3 × and at 6 × its size keeps its corner cells
    at 3 units;
  - a **wave** mesh stage weighted by the base uv (§7.3) on `gridBase({columns: 1, rows: 4})`:
    the top row moves by the amplitude, the bottom row stays — dropped once the real `wave()`
    shipped, whose `sprites-wave.test.js` makes the same bend and shear assertions;
  - `Bob`-like: a mesh stage that declares `time` shared next to `AnimatedFrames` moves the sprite
    as `setUniform('time', …)` says.

## 9. Decisions, and where the sketch was wrong

1. **`frameStage`, singular** (§2.1): one stage per feature and slot, as `local`, `mesh`, `color`.
2. **`FrameOrder.Flip` and `UvOrder.Slice`** are the bands; `LocalOrder.Flip` stays for a mirror of
   the geometry of one's own. The roadmap's §4.9 says `Flip` "finally uses" `LocalOrder.Flip` —
   a frame stage is no local stage.
3. **`ctx.uv` is lazy** (§3.1): a graph that does not read it builds no uv stage, and the kinds of
   today build their old graphs.
4. **`textureSize()` reads any texture of the material** (§7.8): `NineSlice` needs the measures of
   the frame in texels, which only the texture of the color source knows.
5. **Grid attributes by `size`** (§4.1), no per-vertex component properties; the grid line comes
   from the exact uv, no attribute of its own.
6. **`checkKind`** (§6): the refusals of `NineSlice` and `segmentPlacement()` belong to the model,
   not to each feature's own workaround.
7. **`NineSlice` composes with `QuadSize`** (§7.2): the roadmap's "in place of `QuadSize`'s stage"
   cannot be built — no feature removes another's stage.
8. **Shared uniforms merge on type and start value** (§5.2), decision 2 of the master plan; each
   refusal names the fix.
