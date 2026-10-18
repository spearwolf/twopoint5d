# Proposal: a plane for flat sprites, and a yaw per sprite

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "Planes and yaw", and the
lookbook demo `cardboard-parade`. Deviations:

- the sense of `Rotation` turned out counter-clockwise as seen from the front, as
  `Object3D.rotation.z` turns — the browser test pins it — so on the ground a yaw and a rotation
  turn alike (§4.2, §5.1);
- the variant of `ShadowPass` without `LightFacingPlacement`, which the guide already names for
  decals, throws the shadow of a sprite as it is turned: it keeps the yaw (§6);
- `CardboardBack` of the demo carries an attribute `twoSided` besides its stage (§8.3): trees and
  bushes are printed on both sides, as the wings of a toy theatre are, and only houses, the fence
  and the signs show the cardboard from behind — half a wood of grey backs drowned the scene;
- the turntable is a WebP (§8.4): the year rings compress badly as a PNG.

The sketch below is kept as it was written, with the corrections of §2, §4.2, §5.1 and §6.
Prepared from
[issue #32](https://github.com/spearwolf/twopoint5d/issues/32).
The decisions it rests on are collected in §10, the quaternion that would follow the yaw in §9.

## 1. Goal

`FlatPlacement` puts every sprite into the XY plane of its mesh. The orientation of a flat sprite
is therefore a property of the mesh, and two common cases each need a workaround:

- **Sprites on the ground** — decals, blob shadows, skid marks, footprints — lie on the XZ plane,
  where `Map2D`, `TileSprites` and the `groundPlane` of `ShadowPass` already are. A caller turns
  the whole mesh by `rotation.x = -π/2` and writes every position with swapped axes,
  `setPosition(x, -z, y)`. The rotation of the mesh is spent on the choice of plane and can no
  longer move a platform that carries the sprites.
- **Sprites that face different ways** — signs on the four facades of a building, fences along a
  curve, cardboard figures that turn where they walk. Each direction needs a mesh of its own,
  turned about Y, and every world position is rotated by hand into the local space of its mesh.
  A game with 2 811 signs on four facings draws them in four draw calls from four pools of a
  guessed capacity each. A direction that varies continuously, such as a fence along a circle,
  cannot be drawn this way at all short of one mesh per sprite.

The goal: two additions, each solving one case, neither changing what exists.

```ts
import {
  AtlasFrame,
  defineSprite,
  flatPlacement,
  GroundPlacement,
  InstancePosition,
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

// sign.setPosition(wx, y, wz);
// sign.yaw = facing.angle; // the angle a mesh would take as `rotation.y`
```

## 2. What there is today

- `FlatPlacement` (`src/sprites/features/FlatPlacement.ts`) is a feature with nothing but a
  placement stage: `local + instancePosition` through `vertexByInstancePosition()`.
- `BillboardPlacement` maps `local.x` and `local.y` onto the right and up of the camera.
- A pass may bring a placement of its own: `ShadowPass` turns every sprite to the light with
  `LightFacingPlacement`, `BillboardReflectionPass` places billboards for their mirror image. Both
  read only `local.x` and `local.y`, and both leave the placement of the kind alone.
- `FeatureSpritesMaterial#placement` swaps the placement of a live material for a feature that
  brings a placement stage and nothing else, compared by identity (`!==`), and `passFeatures()`
  keeps a placementless copy of the placement of a kind in a `WeakMap` keyed by the feature.
- `Rotation` turns the local vertex through `rotate(position, vec3(0, 0, rotation))` of
  `three/tsl`. The sense of that turn is written down nowhere and held by no test: the browser
  test `sprites-rotation.test.js` measures the extent of a sprite turned by π/2, which is the
  same either way. The convention §4.2 states has to rest on a test that pins it.

## 3. The model

A flat placement becomes

```
p = instancePosition + R_yaw · P_plane · local
```

- `P_plane` is fixed per kind and known when the graph is built: a swizzle, no uniform, no matrix.
- `R_yaw` is a turn about +Y of the local space of the mesh, read per sprite from an attribute.
- Both sit **inside the placement**. A `local` stage would turn the quad before `P_plane`, so a
  yaw on the ground would turn about −Z; and `BillboardPlacement`, `LightFacingPlacement` and
  `MirroredBillboardPlacement`, which read only `local.x` and `local.y`, would see a quad turned
  out of its plane. A `mesh` stage runs in every pass after the pass's own placement, and would
  turn the light-facing quad of `ShadowPass` away from the light.

This is the split `InstancePosition` already has: a data feature that holds the numbers, and a
placement that reads them.

## 4. The plane — `flatPlacement({plane})`

### 4.1 The factory

```ts
export interface FlatPlacementOptions {
  /** The plane of the mesh the quad lies in. Default `'xy'`. */
  readonly plane?: 'xy' | 'xz';
  /** Reads a turn per sprite — see §5. Default none. */
  readonly orientation?: 'yaw';
}

export function flatPlacement(options?: FlatPlacementOptions): SpriteFeature;

export const FlatPlacement = flatPlacement();
export const GroundPlacement = flatPlacement({plane: 'xz'});
```

- **One object per set of options.** The factory memoizes its results in a module-level map
  keyed by plane and orientation — four entries at most — and returns the same frozen feature
  for equal options. The placement swap compares by identity and `passFeatures()` keys its copies
  by the feature, so two calls of `flatPlacement({plane: 'xz'})` must not yield two features.
  `flatPlacement()`, `flatPlacement({})` and `flatPlacement({plane: 'xy'})` are `FlatPlacement`.
- **Names:** `flatPlacement`, `groundPlacement`, `flatPlacement+yaw`, `groundPlacement+yaw`. Every
  error of `defineSprite()` and of the material names the variant.
- **`requires`:** `['instancePosition']`, plus `'yaw'` for an orientation of `'yaw'`.
- **Refusals:** a `plane` or an `orientation` outside the union throws a `TypeError` naming the
  value, so a plain JavaScript caller learns of a typo at definition rather than in the shader.
- Every variant brings a placement stage and nothing else, so each can stand in for another on a
  live material, and for `BillboardPlacement`, as long as the kind holds what it requires.

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

`Rotation` keeps turning about the local z of the quad, which `'xz'` maps onto +Y: on the ground it
turns the sprite about the normal. A positive rotation turns counter-clockwise as seen from the
front, as `Object3D.rotation.z` does — on the ground, counter-clockwise as seen from above. An
angle the caller adds to match the art of its sprite stays the caller's: the `+ π/2` in the blob
shadow of the issue comes from the heading of the game, not from the axes.

## 5. The yaw — `Yaw`

### 5.1 The feature

```ts
export interface YawApi {
  /** The turn about +Y of the mesh, in radians, as `Object3D.rotation.y` turns. */
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
  `BillboardPlacement` carries the attribute and ignores it.
- **Static by default**, as `quadSize` and `color` are: signs, fences and trees turn once. A kind
  whose sprites turn every frame takes `attributeUsage: {dynamic: ['yaw']}`. No usage word: the
  attribute name serves, and `orientation` stays free for §9.
- **The sense of `Object3D.rotation.y`** — counter-clockwise as seen from above. `sprite.yaw =
  angle` puts a sprite where a mesh turned by `rotation.y = angle` put it, which is the migration
  of the issue's four meshes in one line. The stage builds the turn from one `sin` and one `cos`,
  `vec3(c·x + s·z, y, c·z − s·x)`, where `rotate()` of `three/tsl` builds a matrix for each axis.
- **On the ground** the yaw and `Rotation` both turn about +Y in the same sense: a yaw of θ draws
  as a rotation of θ. A ground kind needs only one of them; `Rotation` is the one every kind knows,
  and the guide says so.

### 5.2 Cost

4 bytes per sprite in the static buffer, uploaded once. One `sin` and one `cos` per vertex, four
vertices per sprite; the plane costs nothing beyond a swizzle. A kind without `Yaw` builds exactly
the graph it builds today.

## 6. Passes and swaps

- **`ReflectionPass`** draws with the placement of the kind and mirrors the placed vertex, so a
  turned or grounded sprite is mirrored as it stands.
- **`ShadowPass`** brings `LightFacingPlacement`, which turns every sprite to the light, whatever
  plane or yaw it is drawn with. That is the pass's documented behavior for every placement. For
  upright sprites it gives the shadow of a card facing the light. For sprites on the ground it is
  wrong — it stands them up. The guide names the pass that projects the sprites as they stand,
  `definePass({...ShadowPass, features: [PlanarShadow, ShadowMask]})`, for decals; with the
  placement of the kind it keeps the yaw as well and throws the shadow of a sign as it is turned.
  No guard in code: a pass has no way to learn the plane of the kind.
- **Placement swap:** `sprites.placement = FlatPlacement` on a kind drawn with
  `flatPlacement({orientation: 'yaw'})` turns every sprite back to face +Z, and the kind's own
  placement brings the yaw back. `flatPlacement({orientation: 'yaw'})` as the swap target of a
  kind without `Yaw` is refused through `requires`, as today.
- **Culling:** a sprite whose yaw turns its back to the camera is culled under `FrontSide`. For
  signs on facades that is the point; a cut-out seen from both sides takes `side: DoubleSide`
  and shows its back mirrored.

## 7. What it changes

Nothing that exists draws differently. `FlatPlacement` becomes `flatPlacement()` — a frozen
feature with the same name, the same `requires` and the same graph — so every kind, test and
demo that lists it is untouched. `vertexByInstancePosition()` stays as it is.

What changes in place:

- the error of `defineSprite()` for a kind without a placement names the new choices
  (`defineSprite.ts`, and the spec that quotes it, `defineSprite.spec.ts`);
- `src/sprites/features/FlatPlacement.ts` holds the factory; `src/sprites/features/Yaw.ts` is new;
  `src/sprites/public-api.ts` exports `flatPlacement`, `FlatPlacementOptions`, `GroundPlacement`,
  `Yaw` and `YawApi` — five more names for `checkNameableTypes` and the docs' type check.

The release that carries it is a minor one.

## 8. Tests, docs and the lookbook demo

### 8.1 Tests

- **Vitest** (`src/sprites/features/placement.spec.ts`): the factory returns one object per set of
  options, `FlatPlacement` among them; the four names; the refusals of §4.1; `requires` with and
  without the yaw; the attributes each graph reads.
- **Vitest** (`src/sprites/features/Yaw.spec.ts` or beside the other data features): the
  declaration, `initialize()` writes 0 into a slot that held another value, and
  `attributeUsage: {dynamic: ['yaw']}` is taken.
- **Vitest** (`defineSprite.spec.ts`, `FeatureSpritesMaterial.spec.ts`): a yaw placement in a kind
  without `Yaw` is refused naming both; the swaps of §6.
- **Allocations** (`src/sprites/hot-path-allocations.spec.ts`): writing `yaw` allocates nothing,
  measured with whole numbers or constants as the round requires.
- **Browser** (`packages/twopoint5d-testing/test/sprites-placement-planes.test.js`, WebGPU and
  WebGL 2), with an image of four colored quarters:
  - `GroundPlacement` seen from above: the top of the image lies towards −Z, the quad is not
    culled, and a mesh of it turned and moved as a whole still draws it where the transform says;
  - `Yaw`: four sprites of one mesh at ±X and ±Z, each turned to face outward, each seen from its
    side shows its front; a sprite with `yaw = π/2` covers the pixels of a sprite in a mesh with
    `rotation.y = π/2`;
  - the sense of `Rotation`: a sprite turned by π/2 shows its top left quarter at the bottom left —
    counter-clockwise — and on the ground a yaw draws as a rotation of the same angle.

### 8.2 Docs

- [`docs/sprites.md`](../sprites.md): the placement row of the pipeline table and the table of
  built-in features (`flatPlacement()`, `GroundPlacement`, `Yaw`); a part "Planes and yaw" in
  "Flat sprites and billboards" with a `ts check` block, the table of §4.2, the sense of
  `Rotation` and of the yaw, the culling note of §6; in "Passes: shadows and reflections" the
  sentence that a ground kind takes no `ShadowPass`.
- An entry under `## [Unreleased]` in `CHANGELOG.md`.
- `apps/lookbook/README.md`: the count of demos.

### 8.3 The lookbook demo — `cardboard-parade` (required)

The lookbook's sprite demos are dark and neon (`atlas-frames-on-meshes`, `sprite-reflection`,
`animated-billboards`). This one is a toy theatre in daylight: cardboard cut-outs on a wooden
turntable, warm paper colors on a pale sky. It shows the three claims of the issue, each in a
form a reader sees at once.

- **The turntable** is a `Group` with a flat disc as ground. It turns slowly about Y and tilts on
  a slow wobble, and every sprite mesh is its child: the mesh transforms stay free, and the sprites
  ride along in local coordinates without a line of transform code.
- **The props** — one `FeatureSprites` of `[InstancePosition, flatPlacement({orientation: 'yaw'}),
  Yaw, QuadSize, AtlasFrame, TextureColor]`, static yaw, a few hundred sprites in **one** draw
  call: a fence around the rim, every segment turned along the tangent; trees and houses on
  rings, facing outward; signposts pointing in all directions. The fence is the case a mesh per
  facing cannot draw at all.
- **The walkers** — a dozen cut-out figures of the same kind in a geometry with
  `attributeUsage: {dynamic: ['yaw']}`, walking curves across the disc, the yaw following their
  heading every frame. The quads stand on their feet through `baseArgs: [0.5, 0.5, 0, 0.5]`.
- **The ground** — one `FeatureSprites` of `[InstancePosition, GroundPlacement, QuadSize, Rotation,
  AtlasFrame, TextureColor, Tint]`, `color` dynamic: a blob shadow under every walker — the issue's
  first case — and footprints the walkers leave, turned to the heading through `Rotation`,
  fading out through the tint alpha, from a ring buffer of one pool.
- **The UI** (`<demo-ui>`): toggles for the turning of the table and for the yaw — a placement
  swap to `FlatPlacement` and back, so every cut-out snaps to face +Z and the reader sees what the
  yaw does — and the number of draw calls of the frame.
- **Preview** through `deferPreview()` once the atlas is loaded.
- **Tags:** `FeatureSprites`, `GroundPlacement`, `Yaw`, `Rotation`, `TextureStore`,
  `texture-atlas`, `vanilla`, `demo`, and `flatPlacement`, which as a lowercase tag is not held
  to the exports.
- **The back of a cut-out:** props and walkers draw with `side: DoubleSide`, and a color stage of
  the demo's own, `CardboardBack`, turns the color of a back face (`frontFacing` of `three/tsl`)
  into plain cardboard brown and keeps its alpha. A fence seen from inside the ring and a figure
  walking away show the grey-brown back of a printed sheet, not a mirrored front — and the demo
  shows a feature of one's own next to the built-in ones.
- **Assets:** see §8.4.

### 8.4 The assets of the demo

A new atlas `apps/lookbook/public/assets/cardboard/cardboard.{png,json}` (TexturePacker JSON
Hash) and a texture `turntable.png` for the disc, both committed, both produced by a generator
that lives beside them in the repo:

```
apps/lookbook/assets-src/cardboard/
  README.md             rerun, requirements, the pipeline, the frames
  prop_defs.py          the props as data: parts, materials, palette, frame size, pivot
  blender_render.py     runs inside Blender: builds the props, renders one G-buffer image
  build_cardboard.py    entry point: runs Blender, shades, cuts, packs, writes, checks
  .render-cache/        raw renders (gitignored)
```

The pipeline follows the vehicle sprites of *racing-into-night-city* (`tools/vehicles/`):

1. **Geometry (Blender, `bpy`).** Every prop — four trees, three houses, a fence segment, four
   signposts, six figures — is a handful of primitives and convex hulls, flat-shaded, built from
   the data of `prop_defs.py`. Nothing is modelled by hand, so a prop is changed in a line of
   Python.
2. **G-buffer render (Cycles, headless).** One orthographic front view of every prop, all of them
   in one image as linked duplicates in grid cells. Each material emits an encoding instead of a
   lit color — normal x/y, material id, coverage — at 1 sample, a box filter of 0.01 px and Raw
   view transform, so every pixel is an exact point sample and the render is the same on GPU and
   CPU. 4× supersampled.
3. **Shading (numpy).** A key light from the upper left cut into three bands, each band indexing
   a ramp of paper colors per material: the look of a printed illustration in flat gouache, no
   gradients. A seeded paper grain over the opaque pixels.
4. **Downscale 4× → 1×** by a mode vote over the 16 samples, so colors never blend.
5. **The cut.** The coverage dilated by a few pixels and filled with off-white: the die-cut
   margin of a printed cut-out. A one-pixel darker ring around it as the edge of the cardboard.
6. **2D frames (numpy).** The blob shadow, a radial falloff in its alpha; the left and right
   footprints; the wood of `turntable.png`, concentric year rings and a seeded grain.
7. **Pack and check.** Frames packed into one power-of-two sheet, the JSON written; the script
   asserts the sheet size, that no frame is empty or touches its border, that every frame of
   `prop_defs.py` is in the JSON, and that the feet of every standing prop sit on the bottom edge
   of its frame — the pivot that `baseArgs: [0.5, 0.5, 0, 0.5]` puts at the instance position.

Requirements: `blender` on the PATH (5.2 LTS), `python3` with Pillow and numpy. The output is
byte-stable for unchanged inputs. No CI step runs the generator; the README says how to rerun it,
and a change to the props is a commit of the script and of its output together.

## 9. Outlook: a quaternion per sprite

The yaw covers what stands upright — signs, fences, figures, trees — and, with `GroundPlacement`
and `Rotation`, what lies flat. It does not cover a sprite tilted off the vertical: a banner on a
ramp, a decal on a slope, a sign on a slanted roof. For that the option widens:

```ts
readonly orientation?: 'yaw' | 'quaternion';
```

- a data feature `Orientation`: attribute `orientation`, `{components: ['qx', 'qy', 'qz', 'qw']}`,
  static, 16 bytes per sprite; `initialize()` writes the identity `(0, 0, 0, 1)` — 0 is not
  neutral, as for `Tint`; methods `setOrientation(x, y, z, w)` and `setQuaternion(q: Quaternion)`
  through a scratch tuple, and a `setYaw(angle)` that writes the quaternion of a turn about Y;
- a placement `flatPlacement({plane, orientation: 'quaternion'})` that turns by
  `v + 2·cross(q.xyz, cross(q.xyz, v) + q.w·v)` — two cross products per vertex;
- `R_quaternion` takes the place of `R_yaw` in §3; the passes keep the rules of §6.

The widening is additive: a member of a union, a feature and a variant of the factory, no change
to `Yaw`. It waits until a scene of the lookbook or of a game needs a sprite tilted off the
vertical.

## 10. Decisions

1. **The orientation sits in the placement, not in a stage** (§3): every other slot breaks a pass
   or the plane.
2. **A factory with memoized results, plus named presets.** One function carries the options
   that combine; `FlatPlacement` and `GroundPlacement` keep the common cases a name. Identity
   matters (§4.1).
3. **Only `'xy'` and `'xz'`.** Any other fixed plane is a turn of the mesh, which the plane
   option leaves free; `'yz'` is a further member if a scene asks for it.
4. **The yaw first, the quaternion later** (§9): 4 bytes instead of 16 and one number that a
   caller already holds as a heading, for the cases the issue brings.
5. **The sense of the yaw is that of `Object3D.rotation.y`.** The sense of `Rotation` is that of
   `Object3D.rotation.z`, now written down and held by a test (§4.2, §8.1); both turn alike on the
   ground.
6. **The generator of the demo assets lives in the repo** (§8.4), a Blender and Python pipeline
   that no CI step runs. Committing only the PNG and the JSON would leave the next change to a
   prop without a source. The lookbook gains its first tool outside Node; it touches no build,
   no test and no published file.
7. **A new theme for the demo** (§8.3) rather than the neon signs of the issue's game on the
   night city of `atlas-frames-on-meshes`: the lookbook's sprite demos are dark and neon already,
   and a toy theatre shows the continuous yaw of a fence, which signs on four facings do not.
