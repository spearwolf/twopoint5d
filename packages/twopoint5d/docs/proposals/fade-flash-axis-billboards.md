# Proposal: `Fade` and `Flash`, axis billboards, a loud full pool, free-tex-packer and the glow recipe

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "Fade and flash", "Axis
billboards", the table of passes for each placement under "Passes: shadows and reflections",
"FeatureSprites", "Frames out of an atlas" and "Glow: emissive sprites with bloom". Deviations:

- `FlashApi` declares the component properties and `setFlash()`, not the generated getter: the
  sprite handle carries `getFlash()` at run time, untyped, as it carries the getters of `QuadSize`
  or `Orientation` (§2.2);
- the vertex of the axis billboard is built by an internal module of its own,
  `features/axisBillboardVertex.ts`, so that the public API of `AxisBillboardPlacement.ts` stays the
  factory, its options and the constant (§3.2);
- `setFlash()` also takes a shorter tuple `[r, g, b]`, which keeps the amount as it is;
- the glow test draws the stage once without the bloom as well, a control that the sprite alone
  lights nothing beside it (§6.4).

Phase A of [`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md) (§4.1, §4.2, §4.16 first
bullet, §3.2 free-tex-packer, §4.13 steps 1–2): five small additions, none of which changes the
model. Where the roadmap sketch is wrong about the code, the section says what holds; §9 collects
those corrections.

## 1. Goal

Each item removes a reason for a project — or a coding agent — to hand-roll something:

| item | what is missing today | §  |
| --- | --- | --- |
| `Fade`, `Flash` | the bands `ColorOrder.Fade` and `ColorOrder.Flash` exist with no feature in them; the guide's example of a feature *is* `Fade`, so every project copies it | 2 |
| `axisBillboardPlacement()` | only spherical billboards; under a 2.5D camera they lean back and float | 3 |
| a loud full pool | `createSprite()` answers `undefined` without a word once the pool is full | 4 |
| free-tex-packer | nothing says whether `TexturePackerJson` reads its export | 5 |
| glow | bloom exists for a stage, nothing says how a sprite glows | 6 |

## 2. `Fade` and `Flash`

### 2.1 `Fade`

```ts
export interface FadeApi {
  /** Multiplies the alpha of the sprite: 1 draws it as it is, 0 not at all. A dynamic attribute. */
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
    transform: (color, {attribute}) => vec4(color.rgb, mul(color.a, attribute<'float'>('fade'))),
  },
});
```

- **Dynamic**: a fade changes from frame to frame (spawn, death, fog of war); every `update()`
  uploads 4 bytes per sprite. A kind whose sprites fade once takes
  `attributeUsage: {static: ['fade']}`.
- A fade between 0 and 1 blends only on a material with `transparent: true`, and the default
  alpha test (`0.001`) drops a sprite faded to 0 — the same rule `Tint` states for its alpha.
- It is the guide's example, unchanged in name, attribute and order. A kind that copied the
  example under the name `fade` keeps working and may switch to the import.

### 2.2 `Flash`

```ts
export interface FlashApi {
  flashR: number;
  flashG: number;
  flashB: number;
  /** How far the color is mixed towards the flash color: 0 not at all, 1 all the way. */
  flashAmount: number;
  /** Sets the flash color and the amount; the generated setter of the `flash` attribute. */
  setFlash(r: number, g: number, b: number, amount: number): void;
  setFlash(flash: [r: number, g: number, b: number, amount: number]): void;
}

export const Flash = defineFeature<FlashApi>({
  name: 'flash',
  attributes: {flash: {components: ['flashR', 'flashG', 'flashB', 'flashAmount'], usage: 'dynamic'}},
  initialize() {
    this.setFlash(1, 1, 1, 0);
  },
  color: {
    order: ColorOrder.Flash,
    transform: (color, {attribute}) => {
      const flash = attribute<'vec4'>('flash');
      return vec4(mix(color.rgb, flash.rgb, flash.w), color.a);
    },
  },
});
```

- `mix(color.rgb, flash.rgb, flashAmount)`, alpha kept: a hit flash, a freeze tint, a damage
  blink — what a `Tint` cannot do, since a tint only multiplies and so only darkens.
- The fourth component is named **`flashAmount`**, not `flashA`: it is a mix weight, not an
  alpha, and `sprite.flashAmount = 0` reads as what it does. The getter keeps its generated name
  `getFlash()` (it answers a new array, as every generated getter does).
- **Dynamic**: a flash lasts a few frames. Start `[1, 1, 1, 0]`: white, not mixed in.
- A flash color above 1 is a color above white; with the glow recipe (§6) the flash glows.

### 2.3 The passes: a new band `ColorOrder.Pass`

The sketch says nothing about the passes, and they break. `ShadowMask` sits at
`ColorOrder.Mask` (150) and `Darken` at `ColorOrder.Fade` (200), and the material of a pass
runs the color stages of the kind *and* of the pass in one sorted list (`passFeatures()`,
`buildSpritePipeline()`). `Flash` at 300 would run **after** `ShadowMask` — the shadow of a
flashing sprite would flash white — and after `Darken`, so the reflection would flash at full
brightness while it is darkened otherwise.

A color stage of a pass that recolors the sprite as a whole belongs after every color stage of
the kind. So:

```ts
export const ColorOrder = Object.freeze({Tint: 100, Mask: 150, Fade: 200, Flash: 300, Pass: 1000} as const);
```

- `ShadowMask` moves to `ColorOrder.Pass`. It keeps the alpha and replaces the color, so the
  tint, the fade (alpha multiplied in either order) and a flash (rgb only) before it all come
  out as they should: a fading sprite throws a fading shadow, a flashing one a plain shadow.
- `Darken` moves to `ColorOrder.Pass`: the reflection of a flashing sprite flashes darkened.
- `ColorOrder.Mask` stays at 150, a band for a mask of the kind's own — `CardboardBack` of the
  lookbook demo `cardboard-parade` sits there.
- 1000 and not 400: the gap after `Flash` stays free for stages of one's own, and a pass stage
  reads as "last". A tie keeps the order of the feature list, in which the features of the kind
  come before those of the pass, so a kind's stage at 1000 still runs before the mask.

This changes the order of the shipped passes for a color stage of one's own between 150 and
1000: it ran after `ShadowMask` or `Darken` and now runs before them. A **Changed** entry in the
CHANGELOG names it, with the fix (an order above `ColorOrder.Pass` keeps such a stage last).

### 2.4 The guide's example of a feature

"Writing a feature" teaches with `Fade`. Once `Fade` is built in, the example would teach every
reader to define a copy of a library feature. It gets another example that is still worth
copying and teaches the same fields: **`Grayscale`** — an attribute `grayscale` (float, dynamic,
start 0), a color stage `mix(rgb, vec3(luminance(rgb)), grayscale)` at **`ColorOrder.Tint - 50`**:
before the tint, so a tint colors the grey (a statue of stone, a frozen enemy in blue). It shows
the gaps between the bands, which the old example did not. The section then says that `Fade`
and `Flash` are built the same way and points at their sources.

## 3. Axis billboards — `axisBillboardPlacement()`

### 3.1 The factory

```ts
export interface AxisBillboardPlacementOptions {
  /** The axis of the mesh the sprite turns about and stands along. Default `'y'`. */
  readonly axis?: 'y' | 'z';
}

export function axisBillboardPlacement(options?: AxisBillboardPlacementOptions): SpriteFeature;

/** `axisBillboardPlacement()`: upright along +Y of the mesh. */
export const AxisBillboardPlacement: SpriteFeature;
```

- One frozen feature per option set, memoized as `flatPlacement()` is: the placement swap
  compares by identity, and `passFeatures()` keys its placementless copies by the feature.
  `axisBillboardPlacement()`, `axisBillboardPlacement({})` and `axisBillboardPlacement({axis:
  'y'})` are `AxisBillboardPlacement`.
- Names: `axisBillboardPlacement` (axis `'y'`), `axisBillboardPlacement+z`.
- `requires: ['instancePosition']`, nothing but the placement stage — so it swaps with
  `FlatPlacement`, every `flatPlacement()`, `BillboardPlacement` and back on a live material.
- An axis outside the union throws `TypeError: axisBillboardPlacement: the axis "x" is neither
  'y' nor 'z'`. `'x'` is left out until a scene asks: a mesh whose up is +X is a mesh turned.
- `'z'` is for a mesh laid out in the XY plane with +Z as up — a map in XY seen at a slant.

### 3.2 The math

In the local space of the mesh, with `a` the axis (a constant unit vector), `p` the instance
position and `c` the camera position (`cameraPositionLocal()`, the inverse world matrix of the
mesh applied to `cameraPosition`, as `BillboardPlacement` takes it):

```text
look   = normalize(c − p)                    towards the camera
across = cross(a, look)                      level, its length the sine between a and look
w      = max(1 − length(across) / 0.1, 0)    1 straight along the axis, 0 from a sine of 0.1 on
r_c    = camera right less its part along a  (row x of the model-view rotation, levelled)
r_c'   = −r_c where dot(r_c, across) < 0, r_c otherwise
right  = normalize(across + w · r_c')
placed = p + right · local.x + a · local.y
```

- The quad's x goes onto `right`, its y onto the axis: it turns about the axis to face the
  camera and stays upright. Seen from the front (camera at +Z, axis `'y'`) right is +X and the
  front of the quad faces the camera, so the default `FrontSide` draws it.
- **The zenith.** Straight along the axis `cross(a, look)` vanishes and the facing is
  undefined. Within a sine of 0.1 (about 5.7°) right blends over to the camera's right, as
  `LightFacingPlacement` turns over to the camera within a sine of 0.1 of the normal. The
  camera's right is turned to the side `across` points to first, so the two never cancel; a
  sprite seen exactly along its axis is a line either way. `r_c` is levelled (its part along the
  axis taken off), so `right` stays across the axis and the quad a rectangle.
- `local.z` is dropped, as `BillboardPlacement` drops it: the local vertex arrives trimmed,
  scaled, sheared and turned in its own plane already.
- The swizzles are explicit per axis — `'y'`: `across = (look.z, 0, −look.x)`, `r_c = (r.x, 0,
  r.z)`; `'z'`: `across = (−look.y, look.x, 0)`, `r_c = (r.x, r.y, 0)` — no matrix, no uniform.
- Mesh transforms as for `BillboardPlacement`: moved, turned and scaled evenly, the sprites still
  face the camera; an uneven scale skews them.
- Cost: a normalize, a length, a select and a second normalize per vertex — about what
  `BillboardPlacement` costs. No data, no attribute.
- `cameraRightLocal()` joins `cameraUpLocal()` and `cameraBackLocal()` in `cameraNodes.ts`
  (internal).

### 3.3 Passes

| placement | `ShadowPass` | reflection |
| --- | --- | --- |
| `FlatPlacement`, `flatPlacement()` | turned to the light; for decals `definePass({...ShadowPass, features: [PlanarShadow, ShadowMask]})` | `ReflectionPass` |
| `BillboardPlacement` | turned to the light | `BillboardReflectionPass` |
| `axisBillboardPlacement()` | turned to the light | `ReflectionPass` |

- **`ShadowPass`** needs nothing: `LightFacingPlacement` takes the place of every placement of
  the kind, so the shadow of an axis billboard is the shadow of a flat or a spherical one.
- **`ReflectionPass`** mirrors the placed vertex. An axis billboard stands along the axis, so in
  a mirror across the axis (the ground for `'y'`) its mirror image is an upright quad that faces
  the camera level, as the sprite does — the reflection meets the sprite at its foot, as large as
  the sprite on screen. In a mirror of another tilt it shows the mirror image of the card as it
  stands, which the camera may see at a slant — physically right, as for a flat sprite.
- **`BillboardReflectionPass`** places the reflection to face the camera spherically. Under an
  axis billboard that reflection leans while the sprite stands upright: they no longer meet at
  the foot. The guide's table says to take `ReflectionPass`.

## 4. A loud full pool

### 4.1 Where it lives

In **`FeatureSprites#createSprite()`**, not in `VertexObjectPool#createVO()`:

- `VertexObjectPool` is the generic pool under `TileSprites`, `Map2DTileRenderer` and every
  vertex object geometry; `Map2DTileRenderer` already warns once about its own full pool
  (`#warnNoTileCapacity`), and a warning in the pool would warn twice there and name the wrong
  knob.
- `FeatureSprites` knows the knob: the `capacity` option of its constructor, or — for a geometry
  handed in — the capacity of that `FeatureSpritesGeometry`, and it knows which of the two it is.
- `spritePool.createVO()` called directly stays silent: it is the pool's own API.

### 4.2 Behavior

```ts
createSprite(): (Api & VO) | undefined {
  const pool = this.geometry?.instancedPool;
  if (pool == null) return undefined;          // disposed: silent, as today
  const sprite = pool.createVO();
  if (sprite === undefined && !this.#warnedFull) this.#warnFull(pool.capacity);
  return sprite;
}
```

The message, once per `FeatureSprites`, through `console.warn` (the library's pattern for a
one-time warning, `CameraBasedVisibility#warnCapped`, `Map2DTileRenderer`):

- a geometry the mesh built: `FeatureSprites "<name>": the pool is full — all <capacity> sprites
  are in use, so createSprite() answers undefined. Give the sprites a larger capacity — new
  FeatureSprites(kind, {capacity: <2 · capacity>}) — or free the sprites no longer drawn with
  freeSprite(). This warning is shown once per FeatureSprites.`
- a geometry in the slot the mesh did not build — handed in or put there later: the same, with
  `Build the FeatureSpritesGeometry in the geometry slot with a larger capacity — new
  FeatureSpritesGeometry(kind, {capacity: <2 · capacity>}) —` as the fix.

`<name>` is the mesh's `name` (`twopoint5d.FeatureSprites` unless the caller set one), so two
meshes can be told apart; twice the capacity is a concrete number to type, at least 1 for a pool
of 0.

- **Allocation-free on the hot path.** A successful `createSprite()` reads one boolean more than
  today and builds nothing; the string is built only on the first refusal. A refusal after the
  warning allocates nothing: the allocation spec holds both.
- **Once per mesh**, never again — also after sprites were freed and the pool filled up anew. A
  disposed mesh answers `undefined` without a warning.
- `createSprite()`'s doc comment and the guide say it warns.

## 5. free-tex-packer

The export of free-tex-packer ("JsonHash", "JsonArray") writes the TexturePacker layout:
`frame`, `rotated`, `trimmed`, `spriteSourceSize`, `sourceSize`, plus a `pivot` and the meta
fields `app`, `version`, `format`, `scale`, which `TexturePackerJson` keeps in `data` and `meta`
without reading. A rotated frame keeps the measures of the sprite in `frame.w`/`frame.h` and lies
in the sheet turned by 90° clockwise — the TexturePacker convention `TexturePackerJson.parse()`
reads (`TextureCoords.FLIP_DIAGONAL | FLIP_VERTICAL`). Read off `utils/TextureRenderer.js` of
free-tex-packer-core 0.3.9 (`img.rotate({deg: -90})`, "packer expects CW 90°") and checked on the
pixels of the generated sheet.

**Fixtures** in `packages/twopoint5d/src/texture/fixtures/free-tex-packer/`:

- `sheet.png` (24 × 7) and its two exports `sheet-hash.json` and `sheet-array.json`, byte for byte
  as free-tex-packer-core 0.3.9 wrote them;
- three frames: `banner.png` (upright, untrimmed), `gem.png` (rotated, untrimmed), `hero.png`
  (rotated **and** trimmed: margins of 2, 1, 3 and 2 texels in a sprite of 9 × 9). `gem` and
  `hero` hold six colored cells of 2 × 2 texels, so a turn or a mirror shows;
- `generate.mjs`, the script that drew the sources and ran the packer, and `README.md` saying how
  it was run: in a scratch project outside the repo (`npm install free-tex-packer-core@0.3.9
  pngjs@7`, `node generate.mjs <dir>`, width 24). free-tex-packer-core is **no dependency** of the
  repo.

The fixture directory is left out of `biome ci` (as the SVGs are): the JSON stays byte for byte
the export.

**Specs** (`src/texture/TexturePackerJson.freeTexPacker.spec.ts`): both exports parse, with the
same frame names and the same coords; `gem` and `hero` come out turned (`FLIP_DIAGONAL |
FLIP_VERTICAL`, the area `h × w` in the sheet), `hero` with the trim margins `[2/9, 1/9, 3/9,
2/9]`, `banner` upright and untrimmed; `prepareSpriteFrame()` of `hero`; `isAtlasJsonResponse()`
accepts both, so `TextureAtlasLoader` and `TextureStore` take them.

**Browser** (`sprites-free-tex-packer.test.js`): the sheet loaded from the fixture, `gem` and
`hero` drawn through `TexturedSpriteKind` + `setFrame()`, each cell of each sprite the color the
source image has there.

**Guide**: one line under "Frames out of an atlas" in `docs/sprites.md`, and the feature list of
`packages/twopoint5d/README.md` names free-tex-packer beside TexturePacker.

## 6. Glow — the recipe

### 6.1 Why it works

- `Tint` writes a `float32` color, and nothing in the material clamps it.
- `Stage2D#asPassNode()` is `pass(scene, camera)`, and three's `PassNode` renders into a
  `HalfFloatType` target: a color above 1 survives into the composition.
- `createBloomOutputNodeBuilder({threshold})` hands `threshold` to three's `bloom()`, whose high
  pass is `smoothstep(threshold, threshold + 0.01, luminance(rgb))`.

So with a threshold of 1, a sprite whose color is brighter than white glows and every sprite at or
below white — a texel of 255 under a tint of 1 has a luminance of exactly 1 — does not.

### 6.2 What the sketch misses: brightness is luminance

The threshold compares the **luminance** of the linear color, `0.2126 r + 0.7152 g + 0.0722 b`,
not its largest channel. `[4, 3, 1]` of the sketch has a luminance of 3.07 and glows; a pure red
`[4, 0, 0]` has 0.85 and does **not**, a pure blue `[0, 0, 4]` has 0.29. A saturated color needs a
factor of `threshold / coefficient` to pass — about 5 for red, 14 for blue — or a little white
mixed in (`[4, 1, 1]`, 1.64). The guide states it; the browser test pins the blue one.

The sprite itself draws clamped to white where it is above 1, unless the renderer tone-maps
(`renderer.toneMapping`), which compresses it and keeps its hue.

### 6.3 The guide

A part "Glow: emissive sprites with bloom" in `docs/sprites.md`, findable by "glow",
"emissive" and "bloom": a `ts check` block — a `StageRenderer` with a `RenderPipeline` and
`createBloomOutputNodeBuilder({threshold: 1})`, a kind with `Tint`, one sprite at `[4, 3, 1, 1]`
— the luminance rule, the flash that glows (`setFlash(4, 4, 4, 1)`), what does not work (glow
from an emission map, glow without the sprite getting brighter: §4.13 step 3, a feature for
later).

### 6.4 The browser test

`sprites-glow.test.js`, through `StageRenderer` → `RenderPipeline` → bloom builder → a 64 × 64
target, as `stage-pipeline.test.js` draws its square, the sprites on a white 1 × 1 `colorMap`:

- a sprite tinted `[4, 3, 1, 1]` glows: a pixel 6 px outside its edge is lit;
- a sprite tinted `[1, 1, 1, 1]` does not: that pixel is as black as without bloom, the sprite
  itself white;
- a sprite tinted `[0, 0, 4, 1]` does not either (luminance 0.29), and one at `[0, 0, 16, 1]`
  does.

## 7. Tests

- **Vitest**
  - `features/fade-flash.spec.ts`: declarations (name, attribute, usage, order); `initialize()`
    writes 1 and `[1, 1, 1, 0]` into a slot that held other values; the color stage evaluated on
    the cpu (`evaluateNode`): alpha × fade, rgb mixed by `flashAmount`, alpha kept;
    `attributeUsage: {static: ['fade']}` taken.
  - `passes/pass-features.spec.ts`: `ShadowMask` and `Darken` at `ColorOrder.Pass`; the color
    pipeline of `ShadowPass` and `ReflectionPass` over a kind with `Fade` and `Flash` ends with the
    pass stage.
  - `SpriteFeature.spec.ts`: the bands with `Pass`.
  - `features/placement.spec.ts`: the factory memoizes (`AxisBillboardPlacement` among the
    results), the names, the refusal of an unknown axis, `requires`, nothing but the placement;
    the vertex evaluated on the cpu for both axes — level with the camera it equals the spherical
    billboard; a camera above turns it about the axis and keeps it upright; inside the zenith cone
    it takes the camera's right, also from a camera rolled by 180°; never NaN at the zenith.
  - `FeatureSpritesMaterial.spec.ts`: the swap `FlatPlacement` ↔ `AxisBillboardPlacement` ↔
    `BillboardPlacement`; a `ShadowPass` material over an axis-billboard kind draws with
    `LightFacingPlacement`.
  - `FeatureSprites.spec.ts`: the warning — once, naming the name, the capacity and the fix;
    the other fix for a geometry handed in; silent once disposed; silent while there is room.
  - `defineSprite.spec.ts`: the message for a kind without a placement names
    `axisBillboardPlacement()`.
  - The `evaluateNode()` helper learns `<` and `select()`.
- **Allocations** (`src/sprites/hot-path-allocations.spec.ts`): writing `fade`, `setFlash()` with a
  tuple and `flashAmount` allocates nothing; `createSprite()` on a full pool after the warning
  allocates nothing.
- **Browser** (WebGPU and WebGL 2):
  - `sprites-fade-flash.test.js`: a faded sprite blends to half its color over black; a flash of
    white at 0.5 turns red into `(255, 128, 128)`; the shadow of a flashing sprite is the shadow of
    a plain one.
  - `sprites-axis-billboard.test.js`: from the camera above the ground (`makeCameraAboveGround`)
    the sprite stands upright — its image held to a model at `(x, 0.6 y)` — where a spherical
    billboard covers its full height; level with the camera it covers what `BillboardPlacement`
    covers; `'z'` in a mesh of the XY plane; `ReflectionPass` draws the mirror image below the
    foot, held to the same model; the shadow of `ShadowPass` is the shadow of the same sprites
    under `BillboardPlacement`, pixel for pixel.
  - `sprites-free-tex-packer.test.js` (§5), `sprites-glow.test.js` (§6.4).

## 8. Docs and CHANGELOG

- `docs/sprites.md`: the pipeline table (placement and color rows), the order bands with
  `Pass`, the table of built-in features (`Fade`, `Flash`, `axisBillboardPlacement()`), a part
  "Axis billboards" under "Flat sprites and billboards", the placement–pass table of §3.3 and the
  reflection rule, "Writing a feature" with `Grayscale`, the warning in "FeatureSprites", the
  free-tex-packer line, "Glow: emissive sprites with bloom".
- `packages/twopoint5d/README.md`: free-tex-packer in the feature list.
- `CHANGELOG.md` `[Unreleased]`: **Added** `Fade`, `Flash`, `axisBillboardPlacement()` /
  `AxisBillboardPlacement`, `ColorOrder.Pass`, the warning, free-tex-packer support held to a
  fixture, the glow recipe; **Changed** `ShadowMask` and `Darken` at `ColorOrder.Pass`.
- The roadmap's status line names what phase A built.

## 9. Decisions, and where the sketch was wrong

1. **A band for the color stages of a pass** (§2.3). The sketch puts `Flash` at 300 without
   looking at the passes; with `ShadowMask` at 150 the shadow would flash. `ColorOrder.Pass =
   1000`, additive; the two pass features move there.
2. **`flashAmount`, not `flashA`** (§2.2): the fourth component is a weight.
3. **The guide's feature example becomes `Grayscale`** (§2.4): a feature worth copying that the
   library does not ship, and it teaches the gaps between the bands.
4. **A constant beside the factory**: `AxisBillboardPlacement`, as `FlatPlacement` and
   `GroundPlacement` stand beside `flatPlacement()`.
5. **The fallback turns to the camera's right, sign-aligned** (§3.2), where `LightFacingPlacement`
   adds the camera's up without aligning it: aligned, the two terms cannot cancel for any roll of
   the camera.
6. **The warning lives in `FeatureSprites`** (§4.1), once per mesh, with the fix for the geometry
   the mesh built and for one handed in.
7. **The free-tex-packer fixtures are the export byte for byte**, outside the formatter, with the
   script that made them (§5).
8. **Glow is luminance** (§6.2): the recipe holds, with the rule the sketch left out.
