# Proposal: `wave()` and segment sprites

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "Waves: sway and scroller" and
"Segments: ropes, chains, lasers" (with `RepeatingTextureColor`), the tables of slots, of built-in
features and of passes per placement, and the sine scroller of [`docs/text.md`](../text.md); the
browser proofs are `packages/twopoint5d-testing/test/sprites-wave.test.js` and
`sprites-segments.test.js`. Deviations of the build from the first draft, which the sections below
now state as built:

- the math of the segment placements lives in the internal module `features/segmentVertex.ts`, so
  that `SegmentPlacement.ts` exports the factory, its options and the constant, as the axis
  billboard does;
- `evaluateNode()` learns `clamp` besides `step`, `abs` and `min` (§6.1): the frame math clamps;
- the mipmapped checker and the count of mixed pixels of `texture-atlas-frame-sampling.test.js`
  moved into `test/helpers/fixtures.js`, which they now serve twice;
- after phase D part 1 (`Flip`, `Anchor`, `SpriteFrameNodes#mirror`) came into the branch:
  `RepeatingTextureColor` draws the mirror image of the whole segment under `flipX` and `wave({weight:
  'top'})` sways the top of the image under `flipY` (§2.2, §4.3), and `Anchor` on a segment is
  defined (§3.4), each with a spec and — for the rope and the anchor — a browser case in
  `sprites-segments.test.js`; `evaluateNode()` also learns `fract`, varyings and sub-builds;
- a degenerate segment is drawn in the browser in `'xy'` and facing the camera; `'xz'`, the segment
  along the normal of its plane and the segment that points at the camera are held by the specs of
  `segmentVertex()` alone, all finite.

Phase D, part 2 of [`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md) (§4.8, §4.3;
decision 4 of its §7 taken: the facing is a factory option, `segmentPlacement({facing})`), built on
the slots of [`pipeline-stages-and-grid-base.md`](pipeline-stages-and-grid-base.md) — its §7.3 and
§7.4 are the binding contract this spec fills in. Two features that move vertices and one that
colors them:

| item | what is missing today | § |
| --- | --- | --- |
| `wave()` | grass that sways and a sine scroller are a mesh stage every project writes again; the guide's sine scroller bends its glyphs on the CPU | 2 |
| `SegmentEnd`, `segmentPlacement()` | a rope, a chain, a laser, a graph edge needs a position, a size and a rotation worked out per segment on the CPU, and in 3D a turn about the segment no placement offers | 3 |
| `RepeatingTextureColor` | a frame stretches along a segment instead of repeating; `sampleAtlasFrame()` repeats one, but only on a mesh of one's own | 4 |

Nothing that exists changes its graph or its behaviour; the shared helper of §4.2 is a refactor of
`sampleAtlasFrame()` held by its specs and its browser test.

## 1. Where the roadmap's sketch is wrong about the code

Each is said again where it applies; §8 collects the decisions.

1. **`wave({weight: 'top'})` weighs by `(1 − uv.y)²`, not `1 − uv.y`** (§2.2). A weight linear in
   the base uv moves every vertex by an affine function of where it lies on the base: a shear, on a
   grid as on a quad. The square bends a grid and is the same shear on a quad, whose corners lie at
   the weights 0 and 1 — the sketch's "on a quad a shear, on `gridBase()` a bend" needs it.
2. **Where along the segment a vertex lies is the base `uv.x`, not the base position** (§3.3). The
   base position is the quad of `baseArgs` — `[−0.5, 0.5]` only for the default ones; `uv.x` runs
   from 0 at the left edge to 1 at the right for every `baseArgs` and every grid. The local x — the
   base position after `QuadSize` — is still read, for the caps.
3. **`RepeatingTextureColor` stretches a trimmed frame** (`trim: 'stretch'` of the frame math, §4.3).
   The placement reads the local y, which the trim shift moved, so the thickness is trimmed already;
   along the segment it is not, and a mask there would cut the margins of the frame out of every
   repetition. Segment frames are packed untrimmed — the assets of the lookbook are.

## 2. `wave()`

### 2.1 The factory

```ts
export interface WaveOptions {
  /**
   * `'top'` sways the sprite — grass, flags, seaweed: the top moves, the foot stays, weighted by
   * `(1 − uv.y)²` of the base uv. `'uniform'` moves the whole sprite — the glyphs of a sine scroller.
   */
  readonly weight: 'top' | 'uniform';
  /** The axis of the mesh the vertices move along. `'x'` for `'top'`, `'y'` for `'uniform'` by default. */
  readonly axis?: 'x' | 'y' | 'z';
}

export function wave(options: WaveOptions): SpriteFeature;
```

- **One frozen feature per option set**, memoized by `weight` and the resolved `axis`, as
  `flatPlacement()` memoizes its placements: `wave({weight: 'top'}) === wave({weight: 'top', axis:
  'x'})`. Every one is named `wave`: a kind takes one wave. A second is refused by the wave's
  `checkKind`, which `defineSprite()` asks before its plain refusal of two features of one name
  (§2.4) — `defineSprite: feature "wave": a kind takes one wave — pick one weight and one axis, or
  write a mesh stage of your own for a second motion`.
- `requires: ['instancePosition']` — the phase reads it.
- **Uniforms**, per kind: `waveAmplitude: 1`, `waveFrequency: 1`, `waveSpeed: 1`, and `time: {value:
  0, shared: true}` — the declaration of `AnimatedFrames`, so a kind with both holds one `time`
  and one `setUniform('time', t)` drives the animation and the wave.
- **A mesh stage at `MeshOrder.Offset`** (100): after the placement, before `PlanarShadow`
  (`Project`, 200) and `MirrorAtPlane` (`Mirror`, 300), so the shadow and the reflection of a
  swaying sprite sway with it. The band is checked and fits: the displacement is a direction of
  the mesh — wind blows along X whichever way a billboard faces — measured in units of the mesh.
- **No per-sprite attribute.** The phase comes from the instance position, which already keeps a
  field from swaying in lockstep; a phase or an amplitude per sprite would cost a static attribute
  and two names on every handle for what a kind of one's own does in a dozen lines (the guide's
  `Banner` under "A grid base"). One knob too many is a configuration language (§1.3 of the roadmap).
- **Refusals** (`TypeError`, before anything is built):
  - options that are no object, or without a `weight`: `wave: takes {weight: 'top' | 'uniform'} —
    wave({weight: 'top'}) sways grass, wave({weight: 'uniform'}) moves the glyphs of a scroller`
  - `wave: the weight "x" is neither 'top' nor 'uniform'`
  - `wave: the axis "w" is none of 'x', 'y', 'z'`

### 2.2 The math

With `p` the instance position, `uv` the base uv (`ctx.attribute('uv')`), `t` the uniform `time`:

```text
phase  = 2π · (waveFrequency · (p.x + p.z) − waveSpeed · t)
weight = (1 − uv.y)²          for 'top'
       = 1                    for 'uniform'
vertex = vertex + axis · waveAmplitude · weight · sin(phase)
```

- **Units**: `waveAmplitude` in units of the mesh; `waveFrequency` in waves per unit of the mesh
  along `x + z`; `waveSpeed` in waves per second (with `time` in seconds). The wave runs towards
  `+x` at `waveSpeed / waveFrequency` units per second; a negative speed runs it the other way.
- **`x + z`** of the instance position: a row of glyphs or a field seen from the side, in the XY
  plane, takes its phase from x; a field on the ground, in the XZ plane, gets a diagonal front.
- **On a quad** `'top'` is a shear: the two top corners move by the full amount, the two bottom
  corners stay. **On `gridBase({columns, rows})`** each row line moves by its own weight: halfway
  up a quarter of the top's amount — a stalk bends. `'uniform'` moves every vertex alike on any
  base; a glyph stays rigid.
- The weight is the base uv's, so a trimmed frame's foot weighs what the untrimmed sprite's foot
  weighs, where the trim shift moved it. A pivot moved by `baseArgs` or `Anchor` changes nothing:
  the uv does not move with it.
- **Under `Flip`** the weight is the top of the *image*: with `frame.mirror` (written by `Flip`,
  [`flip-anchor-nine-slice.md`](flip-anchor-nine-slice.md) §2) `uv.y` is taken as
  `mix(uv.y, 1 − uv.y, mirror.y)`, so under `flipY` the bottom of the quad sways — a vine hanging from
  a ceiling. `flipX` changes nothing. A kind without `Flip` builds no node for it.

### 2.3 With `AnimatedFrames`, passes and placements

- `AnimatedFrames` and a `wave()` in one kind hold one `time` (§5.2 of the pipeline spec).
- A pass draws the kind's mesh stages, so `ShadowPass` and `ReflectionPass` sway along; a pass that
  wants a still shadow leaves the wave out, `without: ['wave']`.
- Any placement; the wave moves the placed vertex in the mesh.

### 2.4 Two features of one name ask the first

`defineSprite()` checks the names of the features first, before `requires` and the declarations — so
a second wave would be refused as `two features are named "wave"` (or, under other names, as two
features that declare `waveAmplitude`), which names no fix. On a duplicate name it now runs the
`checkKind` of the first feature of that name against the whole kind, before the plain refusal: a
factory whose forms share a name says why a kind takes one of them. A check that lets the kind pass
leaves the plain refusal. The `SpriteFeature#checkKind` doc and the guide's "Writing a feature" say
so.

## 3. Segment sprites

### 3.1 `SegmentEnd`

```ts
export interface SegmentEndApi {
  endX: number;
  endY: number;
  endZ: number;
  /**
   * Sets the end of the segment, in the local space of the mesh; `instancePosition` is its start.
   * Without a `z` the segment keeps the end z it has. `segmentEnd` is a dynamic attribute: every
   * `update()` uploads it.
   */
  setSegmentEnd(x: number, y: number, z?: number): void;
  setSegmentEnd(end: [x: number, y: number, z?: number]): void;
}

export const SegmentEnd: SpriteFeature<SegmentEndApi>;
```

- `name: 'segmentEnd'`, `attributes: {segmentEnd: {components: ['endX', 'endY', 'endZ'], usage:
  'dynamic'}}` — a rope moves every frame. The setter is the one the attribute generates: it takes
  separate values or a tuple, writes only the values it is given and allocates nothing, so a
  `z` left out keeps the one the sprite has.
- `initialize()` writes `(0, 0, 0)`: a new segment starts and ends at the origin, a degenerate
  segment (§3.4).
- Data alone, like `InstancePosition`; a segment placement reads it.

### 3.2 `segmentPlacement()`

```ts
export interface SegmentPlacementOptions {
  /**
   * `'plane'`, the default, lays the segment into a plane of the mesh, its thickness across the
   * segment in that plane — the 2D case. `'camera'` turns the quad about the segment to face the
   * camera — the 3D case: a laser, a tracer, a rope seen from any side.
   */
  readonly facing?: 'plane' | 'camera';
  /** The plane of `facing: 'plane'`: `'xy'`, the default, or `'xz'`, the ground — as for `flatPlacement()`. */
  readonly plane?: 'xy' | 'xz';
}

export function segmentPlacement(options?: SegmentPlacementOptions): SpriteFeature;

/** `segmentPlacement()`: segments in the XY plane of the mesh. */
export const SegmentPlacement: SpriteFeature;
```

- **One frozen feature per option set**: `segmentPlacement()`, `segmentPlacement({facing:
  'plane', plane: 'xy'})` and `SegmentPlacement` are one object. Names: `segmentPlacement`,
  `segmentPlacement+xz`, `segmentPlacement+camera`.
- `requires: ['instancePosition', 'segmentEnd']`; it brings nothing but `name`, `requires`,
  `checkKind` and `placement`, so it **stands in for another placement on a live material** — the
  three segment placements for each other, which is where the swap is sound. The material lets a
  flat placement or a billboard stand in for a segment placement too (it cannot tell); such a swap
  draws the quad of `QuadSize` at the start of each segment, and the guide says so.
- **Refusals of the factory** (`TypeError`): `segmentPlacement: the facing "x" is neither 'plane'
  nor 'camera'`; `segmentPlacement: the plane "yz" is neither 'xy' nor 'xz'`; a plane next to
  `facing: 'camera'`: `segmentPlacement: a plane belongs to facing: 'plane' — a segment that faces
  the camera turns in every plane; drop the plane, or take facing: 'plane'`.
- **`checkKind`** refuses `Rotation` and `Shear` in the kind (by identity): their local stages turn
  or slant the quad, and a segment lies along its ends whatever its local quad does —
  `defineSprite: feature "segmentPlacement": a segment lies along its ends, so it cannot follow the
  local stage of "rotation" — move the ends instead, and take Rotation out of the kind`; both at
  once name `"rotation" and "shear"` and `Rotation and Shear`. The swap of §3.2 runs the check
  against the kind (§6 of the pipeline spec): a kind with `Rotation` and a `SegmentEnd` cannot swap
  to a segment placement.

### 3.3 The math

With `start` the instance position, `end` the segment end, `along` the base `uv.x` (0 at the left
edge of the base, 1 at its right), `local` the local vertex — trim shift, `QuadSize` and every
other local stage applied:

```text
D      = end − start
point  = start + along · D                             where along the segment the vertex lies
vertex = point + dir · local.x + across · local.y + normal · local.z
normal = dir × across
```

- **`QuadSize` keeps its meaning.** `height` is the thickness: `local.y` runs from `−height/2` to
  `+height/2` across the segment. `width` is the extra length of the caps: `local.x` runs from
  `−width/2` at the start to `+width/2` at the end, so the quad reaches `width/2` beyond each end —
  `setSize(thickness, thickness)` gives a rope with round caps of a round frame room to show.
  Without `QuadSize` the local quad is the unit quad: one unit thick, caps of half a unit.
- **`baseArgs`** move the caps: with `[0.5, 0.5, 0.5, 0]` the local x runs from 0 to `width`, so the
  whole cap sits beyond the end. The thickness stays centred unless `yOffset` moves it.
- **On a grid** every column line lies at its own `along`: a `gridBase({columns: n, rows: 1})`
  segment is a strip a mesh stage can bend.
- `dir` is `D / |D|`; `across` and the fallbacks depend on the facing:

| facing | `across` | a segment shorter than `1e-6` |
| --- | --- | --- |
| `'plane'`, `'xy'` | `(−D.y, D.x, 0)` normalized — the left of the direction, so a segment from left to right shows its image upright, facing +Z | `dir = +X`, `across = +Y`: the caps quad, in the plane |
| `'plane'`, `'xz'` | `(D.z, 0, −D.x)` normalized — a segment along +X shows its top towards −Z and faces +Y, as `GroundPlacement` lays a sprite | `dir = +X`, `across = −Z` |
| `'camera'` | `look × dir` normalized, `look` the unit vector from `point` to the camera position in the mesh — the quad turns about the segment until its face looks at the camera | `dir` = the right of the camera |

- **The plane fallback across** applies on its own as well: a segment along the normal of its plane
  (along Z for `'xy'`) has no across in the plane and takes `+Y` (`'xy'`) or `−Z` (`'xz'`).
- **A segment that points at the camera** has no across: `look × dir` vanishes. Within a sine of
  0.1 between `look` and `dir` the across turns over, as the axis billboard's right does, to the up
  of the camera less its part along the segment, signed to the side of `look × dir` so that the
  two never cancel: `across = normalize(c + level · sign · max(1 − |c| / 0.1, 0))` with `c = look
  × dir`, `level = up − dir · dot(up, dir)`, `sign = +1` where `dot(level, c) ≥ 0`, else `−1`. The
  segment then draws as the line it is from there; nothing is NaN. A last guard divides by
  `max(length, 1e-6)` instead of normalizing, so even the up of the camera along the segment —
  a segment that lies outside the view — draws a line and no NaN.
- **Switches without branches**: the fallbacks are `mix(fallback, value, step(1e-6, length))`, no
  `select()`; every length divides by `max(length, 1e-6)`.
- **The camera position** is brought into the local space of the mesh as for `BillboardPlacement`:
  a mesh may be moved, turned and scaled evenly. As for the axis billboard, a segment faces the
  camera *position*, under a perspective and an orthographic camera alike.
- **Faces**: `normal` points to +Z (`'xy'`), +Y (`'xz'`) or towards the camera (`'camera'`), so the
  default `FrontSide` draws a segment as a flat sprite of its plane is drawn; `'camera'` always.

### 3.4 Edge cases

- **Degenerate segment** (start = end, or closer than `1e-6`): draws the caps quad, `width` by
  `height`, in the plane (`'plane'`) or facing the camera with the camera's right as its x
  (`'camera'`). A segment created and never given an end is one — at the origin.
- **Trimmed frame**: the trim shift moved the local y, so the thickness shows the trimmed part of
  the frame where the untrimmed sprite has it; along the segment the trim moves only the caps (by
  the trim margin times `width`). Segment frames are packed untrimmed.
- **Passes**: `ShadowPass` brings `LightFacingPlacement`, which places the local quad — scaled by
  `QuadSize` — at the start of each segment and turns it to the light: the shadow of a cap, not of
  the segment. `BillboardReflectionPass` brings `MirroredBillboardPlacement`, which does the same as
  a billboard. Both placements carry a `checkKind` that refuses a kind holding a segment placement,
  matched by name (`segmentPlacement`, `segmentPlacement+…`) since a pass that brings its own
  placement is shown the kind's placement as a copy without its stage:
  `FeatureSprites: feature "lightFacingPlacement" of pass "shadow": it turns each sprite to the light
  about its instance position, and of a segment of "segmentPlacement" it would draw the quad of the
  caps at the start — take SegmentShadowPass, which projects the segment as it lies`; the refusal of
  `mirroredBillboardPlacement` names `ReflectionPass`. A kind that holds `SegmentEnd` under another
  placement is not refused.
- **`SegmentShadowPass`** — `definePass({...ShadowPass, features: [PlanarShadow, ShadowMask]})`,
  exported with the presets: the segment projected as it lies, in `shadowColor`, with the material,
  `renderOrder` and `shadowFallsOnPlane` hook of `ShadowPass` and its name, `shadow` — a kind takes
  one or the other, as `BillboardReflectionPass` takes the name of `ReflectionPass`. It is the pass
  decals took before, under a name.
- **`ReflectionPass`** mirrors the placed vertex: for a `'plane'` segment its mirror image. A segment
  facing the camera mirrors into a ribbon that faces the mirror image of the camera, as a mirrored
  billboard does: the camera sees it at twice its height angle above the mirror, thinner the higher
  the camera, edge on at 45°. No pass ships for it; the guide says so.
- **`Anchor`** is defined, not refused: it moves the unit quad by `(0.5 − anchorX, anchorY − 0.5)`
  before `QuadSize`, so the placement reads it in the local vertex — `anchorY` says where across the
  thickness the segment runs (0.5 the middle, 1 the foot of the image: a plank lying on its rope),
  `anchorX` how the caps split (0 the whole `width` beyond the end, 1 before the start). It mirrors
  with the image under `Flip`, as `Anchor` does everywhere.
- **`Flip`** mirrors the frame (`s` and `s + u` swap, `u` and `v` may be negative); the placement does
  not read the frame. For `RepeatingTextureColor` see §4.3.
- **No `Rotation`, no `Shear`** (§3.2). `Yaw` and `Orientation` are data and are ignored, as under a
  billboard.

## 4. `RepeatingTextureColor`

### 4.1 The feature

```ts
/**
 * The color of a segment out of the `colorMap`: the frame repeated along the segment, its texels
 * kept square — repeated `(length / thickness) / aspect` times, `aspect` = width / height of the
 * frame as drawn — and held at its edges across.
 */
export const RepeatingTextureColor: SpriteFeature;
```

- `name: 'repeatingTextureColor'`, `textures: {colorMap: {}}`, a `colorSource`; `requires:
  ['instancePosition', 'segmentEnd', 'quadSize']`. It takes the place of `TextureColor` — a kind
  holds one of them (both declare `colorMap` and a color source, and `defineSprite()` refuses the
  pair as it refuses any two).
- Until a `colorMap` is set the sprite is flat grey, and a texture of the same kind swaps in
  without a rebuild, as under `TextureColor`.
- No options: the wrap, the trim and the inset are fixed (§4.3).

### 4.2 One implementation of the frame math — `sampleFrameAt()`

`sampleAtlasFrame()` is split into the table lookup, which stays in it, and an internal function in
`src/texture/sampleFrameAt.ts`, which both callers use:

```ts
/** @internal */
export interface FrameToSample {
  /** `vec4(s, t, u, v)`. */
  readonly texCoords: Node<'vec4'>;
  /** Exactly 1 for a frame with `FLIP_DIAGONAL`, 0 otherwise: the axes are swapped by `mix()` with it. */
  readonly flipDiagonal: Node<'float'>;
  /** `[left, top, right, bottom]`, read for `trim: 'mask'`. */
  readonly margins?: Node<'vec4'>;
  /** The texels of the frame as drawn — `height × width` under the diagonal flip; read for an inset. */
  readonly drawnTexels?: Node<'vec2'>;
}

/** @internal */
export function sampleFrameAt(
  lookup: (st: Node<'vec2'>, gradX: Node<'vec2'>, gradY: Node<'vec2'>) => Node<'vec4'>,
  frame: FrameToSample,
  position: Node<'vec2'>,
  options: {readonly wrap: readonly [AtlasFrameWrap, AtlasFrameWrap]; readonly trim: 'mask' | 'stretch'; readonly inset: number},
): Node<'vec4'>;
```

- `position` is the uv in the convention of `TextureCoords` (top left, v downwards), continuous —
  before the wrap. The function runs steps 3 to 6 of §4.1 of
  [`atlas-frame-sampling.md`](atlas-frame-sampling.md) — wrap, trim, inset, lookup — and the mask
  of `'mask'`, as `sampleAtlasFrame()` runs them today.
- **`lookup(st, gradX, gradY)`** samples the texture at `st` and decides on the gradients, which the
  function works out from the derivatives of `position` scaled by the extent of the frame and
  swapped like `st`: `sampleAtlasFrame()` answers `texture(map, st)`, with `.grad(gradX, gradY)`
  for a mipmapped `minFilter` as today; `RepeatingTextureColor` answers `ctx.sample('colorMap',
  st)`, with `.grad()` unless both filters are `NearestFilter` (§4.3). A gradient node no lookup
  takes is no part of the graph.
- `sampleAtlasFrame()` keeps its checks, its index clamp and its origin, and reads `flipDiagonal`,
  the margins and `drawnTexels = mix(measures.xy, measures.yx, flipDiagonal)` out of the table. Its
  graph and its pixels stay as they are: its specs and `texture-atlas-frame-sampling.test.js` hold it.

### 4.3 The color source

```text
ratio    = (|segmentEnd − instancePosition| + width) / max(|height|, 1e-6)    per vertex, one varying
size     = ctx.textureSize('colorMap')
flip     = step(0.5, frame.flipDiagonal ?? 0)
drawn    = abs(frame.texCoords.zw) · mix(size.xy, size.yx, flip)              texels of the frame as drawn
repeats  = ratio · max(drawn.y, 1e-6) / max(drawn.x, 1e-6)                   (length / thickness) / aspect
position = vec2(ctx.uv.x · repeats, ctx.uv.y)                                  per fragment
color    = sampleFrameAt(lookup, {texCoords, flipDiagonal: flip, drawnTexels: drawn}, position,
                         {wrap: ['repeat', 'clamp'], trim: 'stretch', inset: 0.5})
```

- **How it learns the length: recomputed**, not handed over by the placement. A stage has no
  channel to hand a node to another slot, and a recomputation keeps the color source independent
  of the placement that draws the segment — the three segment placements swap under it. The ratio
  is constant per sprite, so one `varying` (worked out per vertex from `instancePosition`,
  `segmentEnd` and `quadSize`) carries it exactly; the length includes the caps (`width`), since
  `ctx.uv.x` runs over the whole quad.
- **Per fragment**: `ctx.uv` is read in the fragment graph and passes no varying of the color
  source's own — three interpolates the base `uv` attribute — so the `fract()` of the repeat is
  exact at every wrap (§3.1 of the pipeline spec). A uv stage of the kind runs per fragment under it.
- **The aspect is the frame's as drawn**, `drawn.x / drawn.y` in texels of the bound `colorMap`
  (three's `textureSize()` of the bound texture, §7.8 of the pipeline spec); a frame of 64 × 16
  texels on a segment 8 long and 1 thick repeats `(8 / 1) / 4 = 2` times. A frame of no texels
  (the zero frame of a new sprite) holds both measures at `1e-6` and answers `ratio` repeats; its
  lookup moves by nothing across the frame and samples the one texel at its corner, finite.
- **Under `Flip`** (`u` or `v` negative, `frame.mirror` set): every measure goes through `abs()` and a
  gradient only changes its sign, so nothing is NaN. Along the segment `flipX` draws the mirror image
  of the whole unflipped segment: with `frame.mirror` the color source takes the frame back to its
  unmirrored `s` and `u` along x (`s + u · mirror.x`, `u · (1 − 2 · mirror.x)`) and counts the repeat
  from the end, `position.x = mix(uv.x, 1 − uv.x, mirror.x) · repeats`. Swapping `s` and `s + u` alone
  would mirror each repetition in place and start the repeat at the same end: for a repeat that is
  no whole number the flipped rope would not be the mirror image of the rope. Across, the frame is
  drawn once, and the swapped `t` and `t + v` of `flipY` turn it upside down as they are. A kind
  without `Flip` builds no node for the mirror.
- **`wrap: ['repeat', 'clamp']`**: along the segment the frame repeats, across it is held at its
  edges — no row of the neighbouring repetition bleeds in at the edges of the rope.
- **`inset: 0.5`**, fixed: a linear sample stays inside the frame and never reads the neighbouring
  frame of an atlas (frames 2 pixels apart, as the lookbook's assets are packed); under
  `NearestFilter` the clamp to the centre of the edge texel picks the texel it would pick anyway.
  At a wrap a linear sample does not blend the last column into the first: the art repeats on a
  column boundary.
- **`trim: 'stretch'`** (§1.3).
- **Mipmaps — gradients unless both filters are `NearestFilter`.** `sampleAtlasFrame()` reads the
  `minFilter` when the graph is built and takes gradients for a mipmapped one. `RepeatingTextureColor`
  cannot: a texture of the same kind swaps in without a rebuild (`textureShapeKey()`), and the key
  tells `LinearFilter` from `LinearMipmapLinearFilter` no more than three needs it to. It reads the
  one filter test the key holds — both filters `NearestFilter`, which three reads with `textureLoad`
  and no sampler, where a `.grad()` fails on WebGPU — and takes gradients for every other texture.
  Gradients on a texture without mipmaps sample what a plain sample samples. So a mipmapped frame
  repeats without a seam of the smallest mip level at its wraps, after any swap.
- **The lookup** goes through `ctx.sample()`, so the material registers it and hands it a new
  texture; the `.grad()` copy three builds refers to the registered node for its value.

## 5. Allocation and the hot path

- `setSegmentEnd()` is the generated setter: values or a tuple, no allocation — held by
  `src/sprites/hot-path-allocations.spec.ts` (moving both ends of a segment per frame, with
  `setPosition()` and `setSegmentEnd()` handed whole numbers and constants, and a tuple).
- `wave()` and the color source add no CPU work per frame: the wave runs in the shader, and
  `setUniform('time', t)` is the write of one float.

## 6. Tests

### 6.1 Vitest

- `src/texture/sampleFrameAt.spec.ts`: the lookup is called once with the wrapped, trimmed and
  inset `st` (swapped by the flip) and the gradients; `'mask'` multiplies by the covered area;
  `'stretch'` answers the lookup. `sampleAtlasFrame.spec.ts` unchanged and green.
- `src/sprites/features/Wave.spec.ts`: memoized identity per option set, name, the default axes,
  the refusals with their messages, the uniforms and the shared `time`, `requires`, the mesh band;
  the displacement worked out by `evaluateNode()` for both weights and the three axes at given
  instance positions, uvs, uniforms (`(1 − uv.y)²`, the phase of `x + z`, the sense of the speed); a
  kind with `AnimatedFrames` and a wave holds one `time` node.
- `src/sprites/passes/segment-passes.spec.ts`: the refusals of `ShadowPass` and
  `BillboardReflectionPass` for each segment placement, none for a kind with `SegmentEnd` under a
  billboard, `SegmentShadowPass` as defined, and the placement of the sprites in `SegmentShadowPass`
  and `ReflectionPass`.
- `defineSprite.spec.ts`: on a duplicate name the `checkKind` of the first is asked, and the plain
  refusal follows a check that passes.
- `src/sprites/features/segments.spec.ts`: `SegmentEnd` (attribute, dynamic, the setter with and
  without z and as a tuple, `initialize()` on a reused slot); `segmentPlacement()` (identity,
  names, `requires`, nothing but its placement, the refusals of the factory); `checkKind` through
  `defineSprite()` with `Rotation`, `Shear` and both, the cause kept; the swap between segment
  placements on a material, and the refusal of a swap on a kind with `Rotation`; `segmentVertex()`
  worked out by `evaluateNode()` — along, caps, thickness, the planes and their senses, the
  camera from the front and from above, a degenerate segment in each facing, a segment along the
  normal of its plane, a segment pointing at the camera, all finite.
- `src/sprites/features/RepeatingTextureColor.spec.ts`: declarations and `requires`; the graph
  samples `colorMap` through `ctx.sample()`, reads `uv` and the size of `colorMap`, takes gradients
  for a linear and a mipmapped `colorMap` and none for a nearest one; in a material it waits for its
  texture and a swap reaches its lookup; refused next to `TextureColor`.
- `src/testing/spriteGraph.ts`: `evaluateNode()` learns `step`, `abs`, `min` and `clamp`.
- `hot-path-allocations.spec.ts`: §5.

### 6.2 Browser (WebGPU and WebGL 2)

- `sprites-wave.test.js`:
  - **sway, grid against quad**: one sprite on `gridBase({columns: 1, rows: 4})` and one on the quad
    under `wave({weight: 'top'})` at a time that makes the sine 1: both tops move by the amplitude,
    both feet stay; halfway up the grid moved a quarter, the quad half;
  - **a scroller row**: five glyph sprites along x under `wave({weight: 'uniform'})`, each moved up
    or down by `amplitude · sin(phase of its x)`, held sprite by sprite to the formula, rigid;
  - **a shared time**: a kind of `AnimatedFrames` and a wave moves when `time` moves.
- `sprites-segments.test.js`:
  - **plane segments**: segments in `'xy'` at a slant, caps and thickness held to a model of the
    rotated rectangle with `compareWithModel()`; segments in `'xz'` seen from above, the top of a
    two-colour frame towards −Z;
  - **a camera-facing segment from two views**: seen from the front and from above, the same
    segment draws its full thickness with its top up in both, where a `'plane'` segment seen from
    above draws nothing;
  - **a degenerate segment** draws its caps quad, `width × height`, in each facing;
  - **`SegmentShadowPass`** draws the shadow of the whole segment under a light from above, where
    the segment lies;
  - **a rope**: a 64 × 16 frame of an atlas (neighbours of another colour) repeats twice over a
    segment 8 long and 1 thick under `RepeatingTextureColor`, its halves in the order of the frame,
    no texel of a neighbour drawn;
  - **seamless with mipmaps**: a mipmapped checker repeated three times along a segment shows no
    pixel of the smallest mip level, where a test-only colour source with a bare `fract()` does.

## 7. Docs and CHANGELOG

- `docs/sprites.md`:
  - the table of slots: `segmentPlacement()` under placement, `wave()` under mesh,
    `RepeatingTextureColor` under color source; the table of built-in features: `wave(options)`,
    `SegmentEnd`, `SegmentPlacement` / `segmentPlacement(options)`, `RepeatingTextureColor`;
  - **"Waves: sway and scroller"** under "Built-in features": a `ts check` block with swaying grass
    on `gridBase()` and a scroller row, the formula, the units, grid against quad, the shared
    `time`;
  - **"Segments: ropes, chains, lasers"** after "Axis billboards": a `ts check` block of a rope of
    segments and a laser facing the camera, `QuadSize` as caps and thickness, the facings and their
    fallbacks, the refusal, the swap, `RepeatingTextureColor` and its repeat count, the passes;
  - the table of passes per placement gains the row of the segment placements.
- `docs/text.md`, "A sine scroller": `wave({weight: 'uniform'})` bends the glyphs in the shader; the
  CPU moves them along x alone.
- `CHANGELOG.md`, `## [Unreleased]` / `### Added`: one bullet each for `wave()`, the segment sprites
  (`SegmentEnd`, `segmentPlacement()`, `SegmentPlacement`) and `RepeatingTextureColor`.

## 8. Decisions

1. **`wave()` is a factory of `weight` and `axis`**, `weight` required — the look has to be named;
   `axis` defaults per weight. No per-sprite phase or amplitude (§2.1).
2. **`(1 − uv.y)²` for `'top'`** (§1.1).
3. **The phase from `x + z`** of the instance position, for both weights (§2.2).
4. **Units in waves**: `waveFrequency` per unit of the mesh, `waveSpeed` per second.
5. **`segmentPlacement({facing, plane})`**, decision 4 of the master plan: one factory, three frozen
   features that swap among themselves; `'plane'` and `'xy'` by default, as `flatPlacement()`.
6. **Along is the base `uv.x`, the caps the local x, the thickness the local y** (§1.2, §3.3).
7. **Fallbacks without branches**, a turn-over to the camera's up within a sine of 0.1 (§3.3).
8. **`Rotation` and `Shear` refused by identity** in `checkKind` (§3.2).
9. **`RepeatingTextureColor` recomputes the length** in a varying of its own and takes the aspect
   from the drawn frame on the gpu (§4.3).
10. **Fixed wrap, trim and inset** for the color source: `['repeat', 'clamp']`, `'stretch'`, `0.5`.
11. **Gradients unless both filters are nearest** in the color source, the one filter test the
    shape key holds (§4.3); `sampleAtlasFrame()` keeps its own rule.
12. **`sampleFrameAt()` is internal**, in `texture/`, with the gradient decision left to the lookup.
13. **Passes that would draw the caps refuse segments**, by name; `SegmentShadowPass` is the shadow
    of segments, named `shadow` (§3.4).
14. **A duplicate name asks the first feature's `checkKind`** (§2.4), so a second `wave()` names its fix.
15. **`Flip` mirrors the whole segment** under `RepeatingTextureColor`, the repeat counted from the end
    (§4.3); `wave({weight: 'top'})` sways the top of the image under `flipY` (§2.2).
16. **`Anchor` on a segment is defined**: across, where the line runs; along, how the caps split (§3.4).
