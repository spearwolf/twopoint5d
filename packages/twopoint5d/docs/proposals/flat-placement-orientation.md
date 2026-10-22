# Proposal: a plane for flat sprites, and a yaw or a quaternion per sprite

Status: **implemented**, the quaternion of §9 included — see [`docs/sprites.md`](../sprites.md),
"Planes and turns", and the lookbook demo `cardboard-parade`; released in v0.23.0. Prepared from
[issue #32](https://github.com/spearwolf/twopoint5d/issues/32); the decisions it rests on are
collected in §10. Deviations of the build from the first draft of this spec, which the sections
below now state as built:

- the sense of `Rotation` is counter-clockwise as seen from the front, as `Object3D.rotation.z`
  turns — the browser test pins it — so on the ground a yaw and a rotation turn alike (§4.2, §5.1);
- the pass that projects a sprite as it lies, without the turn to the light, is the preset
  `SegmentShadowPass`; it keeps the yaw and the quaternion and throws the shadow of a sprite as it
  is turned (§6);
- the props of the demo hold `Orientation` rather than `Yaw` (§8.3, §9): the signposts lean and a
  fence panel lies fallen inwards; the walkers keep `Yaw`, which turns every frame, and rock on
  their feet with `Rotation`;
- `CardboardBack` of the demo carries an attribute `twoSided` besides its stage, and only the props
  hold it (§8.3): trees and bushes are printed on both sides, as the wings of a toy theatre are;
  houses, the fence and the signs show the cardboard from behind;
- the turntable is a WebP (§8.4): the year rings compress badly as a PNG; the generator renders
  one G-buffer image per prop rather than one image of all of them;
- `Orientation` answers its quaternion as well, `getQuaternion(target?)`, as `Tint` answers its
  color, and `setOrientation()` takes a tuple besides the four values (§9);
- the browser test holds the yaw to a mesh turned by `rotation.y` at three angles, rather than four
  sprites turned outward (§8.1).

## 1. Goal

`FlatPlacement` puts every sprite into the XY plane of its mesh. Without more, the orientation of a
flat sprite is a property of the mesh, and two common cases each need a workaround:

- **Sprites on the ground** — decals, blob shadows, skid marks, footprints — lie on the XZ plane,
  where `Map2D`, `TileSprites` and the `groundPlane` of `ShadowPass` are. A caller turns the whole
  mesh by `rotation.x = -π/2` and writes every position with swapped axes, `setPosition(x, -z, y)`.
  The rotation of the mesh is spent on the choice of plane and can no longer move a platform that
  carries the sprites.
- **Sprites that face different ways** — signs on the four facades of a building, fences along a
  curve, cardboard figures that turn where they walk. Each direction needs a mesh of its own,
  turned about Y, and every world position is rotated by hand into the local space of its mesh.
  A game with 2 811 signs on four facings draws them in four draw calls from four pools of a
  guessed capacity each. A direction that varies continuously, such as a fence along a circle,
  cannot be drawn this way at all short of one mesh per sprite.

The answer: a plane per kind and a turn per sprite — a yaw about the up axis of the mesh, or a
quaternion for any tilt — in the placement, without changing what draws with `FlatPlacement`.

```ts
import {
  AtlasFrame,
  defineSprite,
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

// a decal on the ground: world coordinates, the rotation turns it about +Y
const DecalKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, GroundPlacement, QuadSize, Rotation, AtlasFrame, TextureColor],
});

// an upright sign that faces where its yaw says: every facing in one mesh
const SignKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, flatPlacement({orientation: 'yaw'}), Yaw, QuadSize, AtlasFrame, TextureColor],
});

// a banner that leans off the vertical: a quaternion per sprite
const BannerKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, flatPlacement({orientation: 'quaternion'}), Orientation, QuadSize, AtlasFrame, TextureColor],
});

// sign.setPosition(wx, y, wz);
// sign.yaw = facing.angle; // the angle a mesh would take as `rotation.y`
// banner.setQuaternion(q); // the quaternion a mesh would take as `quaternion`
```

## 2. What it builds on

- `vertexByInstancePosition()` (`src/sprites/node-utils.ts`) adds the instance position to the
  placed vertex; every form of `flatPlacement()` ends with it.
- `BillboardPlacement` maps `local.x` and `local.y` onto the right and up of the camera.
- A pass may bring a placement of its own: `ShadowPass` turns every sprite to the light with
  `LightFacingPlacement`, `BillboardReflectionPass` places billboards for their mirror image with
  `MirroredBillboardPlacement`. Both read only `local.x` and `local.y`, and both leave the placement
  of the kind alone.
- `FeatureSpritesMaterial#placement` swaps the placement of a live material for a feature that
  brings a placement stage and nothing else, compared by identity (`!==`), and `passFeatures()`
  keeps a placementless copy of the placement of a kind in a `WeakMap` keyed by the feature.
- `Rotation` turns the local vertex through `rotate(position, vec3(0, 0, rotation))` of
  `three/tsl`, in the local slot `LocalOrder.Rotate`. Its sense (§4.2) is pinned by the browser test
  `sprites-placement-planes.test.js`; `sprites-rotation.test.js` measures the extent of a sprite
  turned by π/2, which is the same either way.

## 3. The model

A flat placement is

```
p = instancePosition + R · P_plane · local
```

- `P_plane` is fixed per kind and known when the graph is built: a swizzle, no uniform, no matrix.
- `R` is the turn per sprite, read from an attribute: `R_yaw`, a turn about +Y of the local space
  of the mesh (§5), or `R_quaternion`, any turn (§9). Without an orientation there is none.
- Both sit **inside the placement**. A `local` stage would turn the quad before `P_plane`, so a
  yaw on the ground would turn about −Z; and `BillboardPlacement`, `LightFacingPlacement` and
  `MirroredBillboardPlacement`, which read only `local.x` and `local.y`, would see a quad turned
  out of its plane. A `mesh` stage runs in every pass after the pass's own placement, and would
  turn the light-facing quad of `ShadowPass` away from the light.

This is the split `InstancePosition` has: a data feature that holds the numbers, and a placement
that reads them.

## 4. The plane — `flatPlacement({plane})`

### 4.1 The factory

`src/sprites/features/FlatPlacement.ts`:

```ts
export interface FlatPlacementOptions {
  /** The plane of the mesh the quad lies in. Default `'xy'`, facing +Z; `'xz'` faces +Y. */
  readonly plane?: 'xy' | 'xz';
  /** Turns every sprite on its own — `'yaw'` see §5, `'quaternion'` see §9. Default none. */
  readonly orientation?: 'yaw' | 'quaternion';
}

export function flatPlacement(options?: FlatPlacementOptions): SpriteFeature;

export const FlatPlacement = flatPlacement();
export const GroundPlacement = flatPlacement({plane: 'xz'});
```

- **One object per set of options.** The factory memoizes its results in a module-level map
  keyed by the plane, or by `<plane>+<orientation>` — six entries at most — and returns the same
  frozen feature for equal options. The placement swap compares by identity and `passFeatures()`
  keys its copies by the feature, so two calls of `flatPlacement({plane: 'xz'})` must not yield two
  features. `flatPlacement()`, `flatPlacement({})` and `flatPlacement({plane: 'xy'})` are
  `FlatPlacement`; `flatPlacement({plane: 'xz'})` is `GroundPlacement`.
- **Names:** `flatPlacement`, `groundPlacement`, `flatPlacement+yaw`, `groundPlacement+yaw`,
  `flatPlacement+quaternion`, `groundPlacement+quaternion`. Every error of `defineSprite()` and of
  the material names the form.
- **`requires`:** `['instancePosition']`, plus `'yaw'` for an orientation of `'yaw'` and
  `'orientation'` — the name of the feature that holds the attribute — for `'quaternion'`.
- **Refusals:** a `plane` or an `orientation` outside the union throws a `TypeError` that quotes the
  value through `describeValue()` — `flatPlacement: the plane "yz" is neither 'xy' nor 'xz'`,
  `flatPlacement: the orientation "roll" is neither 'yaw' nor 'quaternion'` — so a plain JavaScript
  caller learns of a typo at definition rather than in the shader.
- Every form brings a placement stage and nothing else, so each can stand in for another on a live
  material, and for `BillboardPlacement`, as long as the kind holds what it requires.

### 4.2 The convention of `'xz'`

| local | mesh, `'xy'` | mesh, `'xz'` |
| --- | --- | --- |
| x (right of the image) | +X | +X |
| y (top of the image) | +Y | −Z |
| z (front of the quad) | +Z | +Y |

In TSL, `vec3(local.x, local.z, local.y.negate())`. It is the turn `rotation.x = -π/2` that the
workaround spends on the mesh — a proper rotation, so the winding stays and the front of the quad
faces +Y, seen from above under the default `FrontSide`. The top of the image points to −Z, "north"
on a map, as the top of a tile of `TileSprites` does. A ground sprite with the caller's world
position reads `setPosition(x, groundY, z)`; an offset of its own along the normal goes into the
y of the position.

`Rotation` turns about the local z of the quad, which `'xz'` maps onto +Y: on the ground it turns
the sprite about the normal. A positive rotation turns counter-clockwise as seen from the front, as
`Object3D.rotation.z` does — on the ground, counter-clockwise as seen from above. An angle the
caller adds to match the art of its sprite stays the caller's: the `+ π/2` in the blob shadow of
the issue comes from the heading of the game, not from the axes.

## 5. The yaw — `Yaw`

### 5.1 The feature

`src/sprites/features/Yaw.ts`:

```ts
export interface YawApi {
  /** The turn of the sprite about +Y of its mesh, in radians, in the sense of `Object3D.rotation.y`. */
  yaw: number;
}

export const Yaw = defineFeature<YawApi>({
  name: 'yaw',
  attributes: {yaw: {size: 1}},
  initialize() {
    this.yaw = 0;
  },
});
```

- **Data alone**, like `InstancePosition`: no stage. Only a placement made by
  `flatPlacement({orientation: 'yaw'})` reads it. A kind that holds `Yaw` and draws with
  `BillboardPlacement` carries the attribute and ignores it; `tableFrame({views})` reads it too, for
  the view the camera sees the sprite from.
- **Static by default**, as `quadSize` and `color` are: signs, fences and trees turn once. A later
  change reaches the gpu once it is marked — `spritePool.touchVO(sprite, 'yaw')` or
  `geometry.touch('yaw')`. A kind whose sprites turn every frame takes
  `attributeUsage: {dynamic: ['yaw']}`: the attribute name serves as the usage word.
- **The sense of `Object3D.rotation.y`** — counter-clockwise as seen from above. A sprite with
  `yaw = angle` draws where a sprite of `FlatPlacement` draws in a mesh turned by
  `rotation.y = angle`, at its position turned back by the angle: the migration of the issue's four
  meshes in one line. A yaw of 0 faces +Z, one of π/2 faces +X. The stage builds the turn from one
  `sin` and one `cos`, `vec3(c·x + s·z, y, c·z − s·x)`, where `rotate()` of `three/tsl` builds a
  matrix for each axis.
- **On the ground** the yaw and `Rotation` both turn about +Y in the same sense: a yaw of θ draws
  as a rotation of θ. A ground kind needs only one of them; `Rotation` is the one every kind knows,
  and the guide says so.

### 5.2 Cost

4 bytes per sprite in the static buffer, uploaded once. One `sin` and one `cos` per vertex, four
vertices per sprite; the plane costs nothing beyond a swizzle. A kind without an orientation builds
the graph of its plane alone, and `FlatPlacement` the graph of `local + instancePosition`.

## 6. Passes and swaps

- **`ReflectionPass`** draws with the placement of the kind and mirrors the placed vertex, so a
  turned or grounded sprite is mirrored as it stands.
- **`ShadowPass`** brings `LightFacingPlacement`, which turns every sprite to the light, whatever
  plane, yaw or quaternion it is drawn with. That is the pass's behavior for every placement. For
  upright sprites it gives the shadow of a card facing the light. For sprites on the ground it is
  wrong — it stands them up. `SegmentShadowPass`, named `shadow` as `ShadowPass` is, is
  `definePass({...ShadowPass, features: [PlanarShadow, ShadowMask]})`: it projects the sprites as
  they stand, with the placement of the kind, so it suits decals, keeps the yaw and the quaternion,
  and throws the shadow of a sign as it is turned — thin where the light grazes it. No guard in
  code: a pass has no way to learn the plane of the kind.
- **Placement swap:** `sprites.placement = FlatPlacement` on a kind drawn with
  `flatPlacement({orientation: 'yaw'})` turns every sprite back to face +Z, and the kind's own
  placement brings the yaw back. A turned placement as the swap target of a kind without its
  feature is refused through `requires` —
  `FeatureSpritesMaterial: feature "flatPlacement+yaw" requires feature "yaw", which the sprite kind
  does not hold` —, and a kind that holds both `Yaw` and `Orientation` swaps between the two.
- **Culling:** a sprite whose yaw or quaternion turns its back to the camera is culled under
  `FrontSide`. For signs on facades that is the point; a cut-out seen from both sides takes
  `side: DoubleSide` and shows its back mirrored, which a color stage of one's own can tell by
  `frontFacing` of `three/tsl` (§8.3).

## 7. What it touches

Nothing that draws with `FlatPlacement` draws differently. `FlatPlacement` is `flatPlacement()` —
a frozen feature with the name, the `requires` and the graph a flat sprite has always had — so
every kind, test and demo that lists it is untouched. `vertexByInstancePosition()` stays as it is.

- `src/sprites/features/FlatPlacement.ts` holds the factory and the two presets;
  `src/sprites/features/Yaw.ts` and `src/sprites/features/Orientation.ts` hold the data features.
  `src/sprites/public-api.ts` re-exports the three modules: `flatPlacement`,
  `FlatPlacementOptions`, `FlatPlacement`, `GroundPlacement`, `Yaw`, `YawApi`, `Orientation` and
  `OrientationApi`.
- The error of `defineSprite()` for a kind without a placement names the choices: `defineSprite: no
  feature contributes a placement stage; a sprite kind holds exactly one — FlatPlacement,
  GroundPlacement, another flatPlacement(), BillboardPlacement, axisBillboardPlacement() or
  segmentPlacement()`.

## 8. Tests, docs and the lookbook demo

### 8.1 Tests

- **Vitest** (`src/sprites/features/placement.spec.ts`): `flatPlacement()` answers one frozen
  feature per set of options, `FlatPlacement` and `GroundPlacement` among them; the six names and
  their `requires`; each form brings nothing but its placement stage; the refusals of §4.1,
  `NaN` and a BigInt among the values; the attributes each graph reads; the ground vertex is the
  local one turned as a mesh with `rotation.x = -π/2` turns it, then moved; the quaternion of a turn
  about +Y places as the yaw of that angle; a kind with a turned placement and without its feature
  is refused, naming both. `Yaw`: the declaration, `initialize()` writes 0 into a slot that held
  another value, the dynamic usage by the attribute name. `Orientation`: the declaration and its
  three methods, a new sprite starts at the identity, `setQuaternion()` hands its values on in one
  array, `getQuaternion()` answers in its target, `setYaw()` writes the quaternion of the turn about
  +Y, the dynamic usage by the attribute name.
- **Vitest** (`src/sprites/FeatureSprites/FeatureSpritesMaterial.spec.ts`): the swaps of §6 — to
  `FlatPlacement` and back, the yaw for the quaternion on a kind that holds both, and the refusal of
  a turned placement on a kind without its feature.
- **Vitest** (`src/sprites/defineSprite.spec.ts`): the error of §7 for a kind without a placement.
- **Allocations** (`src/sprites/hot-path-allocations.spec.ts`): moving and turning a sprite by its
  yaw, and turning it by a quaternion or by `setYaw()`, allocate nothing per call.
- **Browser** (`packages/twopoint5d-testing/test/sprites-placement-planes.test.js`, WebGPU and
  WebGL 2), with an image of four colored quarters:
  - a flat sprite seen from the front shows the top left of its image at the top left, and a
    positive rotation turns it counter-clockwise — the top left quarter to the bottom left;
  - `GroundPlacement` seen from above faces up, the top of the image towards −Z, and in a moved and
    turned mesh it draws pixel for pixel as a flat sprite in a mesh turned down by hand;
  - a yaw of 0.6, π/2 and −0.4 draws pixel for pixel as a mesh turned by `rotation.y` of that angle,
    and on the ground a yaw draws as a rotation of the same angle;
  - a quaternion — a tilt back then a turn, and a turn about a slanted axis — draws as a mesh turned
    by `Object3D.quaternion`, in both planes, and `setYaw()` draws as a `yaw` of the same angle.

### 8.2 Docs

- [`docs/sprites.md`](../sprites.md): the placement row of the pipeline table and the table of
  built-in features (`FlatPlacement`, `GroundPlacement`, `flatPlacement(options)`, `Yaw`,
  `Orientation`); the part "Planes and turns" with a `ts check` block, the table of §4.2, the senses
  of `Rotation`, the yaw and the quaternion, the costs, the culling note and the swaps of §6; in
  "Passes: shadows and reflections" the table of passes per placement, which names
  `SegmentShadowPass` for decals.
- The entries of `flatPlacement()`, `Yaw` and `Orientation` under `[0.23.0]` in `CHANGELOG.md`.

### 8.3 The lookbook demo — `cardboard-parade`

`apps/lookbook/src/demos/cardboard-parade/` and `src/pages/demos/cardboard-parade.astro`. The
lookbook's sprite demos are dark and neon (`atlas-frames-on-meshes`, `sprite-reflection`,
`animated-billboards`). This one is a toy theatre in daylight: cardboard cut-outs on a wooden
turntable, warm paper colors on a pale sky. It shows the claims of the issue, each in a form a
reader sees at once.

- **The turntable** — `CardboardParade`, a `Group` with a disc of `turntable.webp` as ground and a
  rim. It turns slowly about Y and wobbles about X and Z, and every sprite mesh is its child: the
  mesh transforms stay free, and the sprites ride along in local coordinates without a line of
  transform code.
- **The props** — one `FeatureSprites` of `[InstancePosition, flatPlacement({orientation:
  'quaternion'}), Orientation, QuadSize, AtlasFrame, TextureColor, CardboardBack]`, static, a few
  hundred sprites in **one** draw call: a fence around the rim, every segment along the tangent and
  its print facing outward, one panel fallen inwards onto its back, the print to the sky, and its
  neighbours leaning after it; houses and trees on a ring facing outward, a wood beyond them, trees
  and bushes on the green; four signposts at the crossroads, each pointing its own way and leaning.
  An upright prop is written with `setYaw()`, a leaning one with `setQuaternion()` of an `Euler` in
  the order `'YXZ'` — the yaw first, then the lean in the frame of the prop. The fence is the case
  a mesh per facing cannot draw at all.
- **The walkers** — a dozen cut-out figures, a dog and a duck among them, of `[InstancePosition,
  flatPlacement({orientation: 'yaw'}), Yaw, QuadSize, Rotation, AtlasFrame, TextureColor]` in a
  geometry with `attributeUsage: {dynamic: ['yaw']}`, walking circles across the disc, the yaw
  following their heading every frame and `Rotation` rocking them on their feet. They hold the
  cheaper `Yaw`, 4 bytes against 16.
- **Standing on their feet:** props and walkers are built with `baseArgs: [0.5, 0.5, 0, 0.5]`, which
  puts the pivot on the middle of the bottom edge of the quad, and draw with `alphaTest: 0.5` and
  `side: DoubleSide`.
- **The ground** — one `FeatureSprites` of `[InstancePosition, GroundPlacement, QuadSize, Rotation,
  AtlasFrame, TextureColor, Tint]`, with `color`, `texCoords` and `size` dynamic, transparent,
  without depth writes and with a polygon offset: a blob shadow under every walker — the issue's
  first case — and the footprints the walkers leave, turned along the walk through `Rotation`,
  fading out through the tint alpha, from a ring buffer of 40 prints per walker in the same pool.
- **The back of a cut-out:** `CardboardBack` (`CardboardBack.ts`), a feature of the demo's own with a
  color stage at `ColorOrder.Mask`, turns the color of a back face (`frontFacing` of `three/tsl`)
  into the cardboard brown of its uniform `cardboardColor` and keeps its alpha. Its attribute
  `twoSided` (0 for a new sprite) keeps the print on the back of trees and bushes. A fence seen from
  inside the ring shows the grey-brown back of a printed sheet, not a mirrored front — and the demo
  shows a feature of one's own next to the built-in ones. The walkers hold no `CardboardBack`: a
  profile drawn from behind is the mirror image that walks the other way, which is what it does.
- **The UI:** the toggles *turntable* and *facing* — a placement swap of the props and the walkers
  to `FlatPlacement` and back, so every cut-out snaps upright to face +Z and the reader sees what the
  turns do — and the number of draw calls of the frame.
- **Preview** through `deferPreview()`, once the theatre is built.
- **Tags** (`src/pages/demos/_cardboard-parade.json`): `FeatureSprites`, `GroundPlacement`,
  `FlatPlacement`, `Yaw`, `Orientation`, `Rotation`, `Tint`, `TextureStore`, `texture-atlas`,
  `textures`, `vanilla`, `demo`.
- **Assets:** see §8.4.

### 8.4 The assets of the demo

The atlas `apps/lookbook/public/assets/cardboard/cardboard.{png,json}` (TexturePacker "JSON Hash",
22 frames) and the texture `turntable.webp` for the disc, named `cardboardAtlas` and
`cardboardTurntable` in the texture catalog `public/assets/textures.json`. Both are committed, both
produced by a generator that lives beside them in the repo:

```
apps/lookbook/assets-src/cardboard/
  README.md             rerun, requirements, the pipeline, the frames
  prop_defs.py          the props as data: parts, materials, paper colors, light, bands, scale
  blender_render.py     runs inside Blender: builds each prop, renders one G-buffer image per prop
  build_cardboard.py    entry point: runs Blender, shades, cuts, packs, writes, checks
  .render-cache/        raw renders (gitignored)
```

The pipeline follows the vehicle sprites of *racing-into-night-city* (`tools/vehicles/`):

1. **Geometry (Blender, `bpy`).** Every prop — three trees and a bush, three houses, a fence
   segment, four signposts, four figures, a dog and a duck — is a handful of primitives and convex
   hulls out of `prop_defs.py`, at 64 pixels a meter. A standing prop is cut off at the ground, so
   its print ends level at the feet. Nothing is modelled by hand, so a prop is changed in a line of
   Python.
2. **G-buffer render (Cycles).** One orthographic front view per prop, 4× supersampled. Each
   material emits an encoding instead of a lit color — normal x and z, material id, coverage — at
   one sample, a box filter of 0.01 px, no bounces and the Raw view transform, so every pixel is an
   exact point sample.
3. **Shading (numpy).** A key light from the upper left cut into three bands, each band indexing
   the three-color ramp of its material: the look of a printed illustration in flat gouache, no
   gradients.
4. **Downscale 4× → 1×** by a vote of the 16 samples, so colors never blend.
5. **The cut.** A seeded paper grain over the print, the coverage dilated by a few pixels and filled
   with paper, and a darker ring around it: the die-cut margin of a printed cut-out.
6. **Flat frames and turntable (numpy).** The blob shadow, a soft radial alpha; a shoe print for
   each foot and a paw; the tree slice of `turntable.webp` with its year rings and bark.
7. **Pack and check.** Shelves in a sheet 1024 pixels wide and a power of two high. The script fails
   when a frame of `prop_defs.py` is missing or empty, touches the top, left or right edge of its
   frame, or — for a standing prop — does not end on the bottom edge with its margin: the pivot that
   `baseArgs: [0.5, 0.5, 0, 0.5]` puts at the instance position.

Requirements: `blender` on the PATH (tested with 5.2 LTS), `python3` with Pillow and numpy. The
output is byte-stable for unchanged inputs and versions. Neither CI nor `pnpm lookbook:assets` runs
the generator; its README says how to rerun it, and a change to the props is a commit of the
scripts and of their output together.

## 9. A quaternion per sprite

The yaw covers what stands upright — signs, fences, figures, trees — and, with `GroundPlacement`
and `Rotation`, what lies flat. It does not cover a sprite tilted off the vertical: a banner on a
ramp, a decal on a slope, a sign on a slanted roof, a fence panel that fell over. For that the
option takes `orientation: 'quaternion'`:

- the data feature `Orientation` (`src/sprites/features/Orientation.ts`): attribute `orientation`,
  `{components: ['qx', 'qy', 'qz', 'qw']}`, static, 16 bytes per sprite; `initialize()` writes the
  identity `(0, 0, 0, 1)` — 0 is not neutral, as for `Tint`. The generated
  `setOrientation(qx, qy, qz, qw)`, which takes a tuple as well, and the methods
  `setQuaternion(quaternion)`, `getQuaternion(target?)` — a new `Quaternion` per call without a
  target — and `setYaw(angle)`, which writes the quaternion of a turn about +Y, the facing a `yaw`
  of that angle gives. The setters hand their values on through one scratch tuple, so a fractional
  value is not boxed on its way to the buffer. A later change reaches the gpu once it is marked,
  as for the yaw; `attributeUsage: {dynamic: ['orientation']}` for a sprite that turns every frame;
- the placement `flatPlacement({plane, orientation: 'quaternion'})`, which turns by
  `v + 2·cross(q.xyz, cross(q.xyz, v) + q.w·v)` — two cross products per vertex, the turn of
  `Vector3#applyQuaternion`;
- `R_quaternion` takes the place of `R_yaw` in §3; the passes keep the rules of §6.

The forms are named `flatPlacement+quaternion` and `groundPlacement+quaternion` and require
`orientation`, the name of the feature; a kind that holds both `Yaw` and `Orientation` swaps between
the turned placements. The placement does not normalize the quaternion: one out of `Quaternion` is
of unit length, one of another length scales the sprite by the square of it, and a normalization
would cost a square root per vertex for a mistake of the caller.

A sprite with a quaternion `q` at a position draws where a sprite of the same plane without a turn
draws in a mesh turned by `q`, at that position turned back by the inverse of `q`. The props of
`cardboard-parade` (§8.3) draw with it: the leaning signposts at the crossroads and the fence panel
fallen onto its back.

## 10. Decisions

1. **The orientation sits in the placement, not in a stage** (§3): every other slot breaks a pass
   or the plane.
2. **A factory with memoized results, plus named presets.** One function carries the options
   that combine; `FlatPlacement` and `GroundPlacement` keep the common cases a name. Identity
   matters (§4.1).
3. **Only `'xy'` and `'xz'`.** Any other fixed plane is a turn of the mesh, which the plane
   option leaves free; `'yz'` is a further member if a scene asks for it.
4. **The yaw and the quaternion side by side** (§5, §9): `Yaw` takes 4 bytes and one number a
   caller already holds as a heading, and covers what stands upright; `Orientation` takes 16 bytes
   and covers the sprites that leave the vertical. `Yaw` stays the cheaper choice wherever a turn
   about +Y is all a sprite needs.
5. **The sense of the yaw is that of `Object3D.rotation.y`.** The sense of `Rotation` is that of
   `Object3D.rotation.z`, written down in the guide and held by a test (§4.2, §8.1); both turn alike
   on the ground.
6. **The generator of the demo assets lives in the repo** (§8.4), a Blender and Python pipeline
   that no CI step runs. Committing only the PNG and the JSON would leave the next change to a
   prop without a source. It touches no build, no test and no published file.
7. **A theme of its own for the demo** (§8.3) rather than the neon signs of the issue's game on the
   night city of `atlas-frames-on-meshes`: the lookbook's sprite demos are dark and neon already,
   and a toy theatre shows the continuous yaw of a fence, which signs on four facings do not.
