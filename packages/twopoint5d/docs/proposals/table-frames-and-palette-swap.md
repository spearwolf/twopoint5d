# Proposal: frames out of a table, directional frames, palette swap

Status: **specified** — phase E, part 2 of
[`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md), §4.6 and §4.14, with decision 3
of its §7 taken: a frame table is a **data texture**, handed to the sprites as an ordinary
`textures` resource — no new kind of resource, no limit of 341 frames. Built on the slots of
[`pipeline-stages-and-grid-base.md`](pipeline-stages-and-grid-base.md) (§7.6, §7.7): nothing new in
the shader model, every lookup through `ctx.sample()` at graph build time.

## 1. Goal

```ts
import {
  axisBillboardPlacement, defineSprite, FeatureSprites, FrameTable, InstancePosition, PaletteSwap,
  QuadBase, QuadSize, tableFrame, TextureColor, Yaw,
} from '@spearwolf/twopoint5d';

declare const atlas: import('@spearwolf/twopoint5d').TextureAtlas; // stalker.json
declare const colorMap: import('three/webgpu').Texture; // stalker.png, nearest
declare const palette: import('three/webgpu').Texture; // goblin-palette.png, nearest

// eight views of every pose, picked by the angle the camera sees the stalker from
const Stalker = defineSprite({
  base: QuadBase,
  features: [InstancePosition, axisBillboardPlacement(), QuadSize, Yaw, tableFrame({views: 8}), TextureColor],
});
const walk = FrameTable.fromAtlas(atlas, /^stalker_walk_/);
const stalkers = new FeatureSprites(Stalker, {textures: {colorMap, frameTable: walk.bakeDataTexture()}});
const stalker = stalkers.createSprite()!;
stalker.frameIndex = 2 * 8; // walk frame 2; the view is added in the shader
stalker.yaw = Math.PI / 2; // facing +x

// the red goblin and the blue goblin from one sheet
const Goblin = defineSprite({base: QuadBase, features: [InstancePosition, /* … */ TextureColor, PaletteSwap]});
const goblins = new FeatureSprites(Goblin, {textures: {colorMap, palette}});
goblins.createSprite()!.paletteRow = 2;
goblins.setUniform('paletteShift', 3); // colour cycling
```

## 2. What there is today

- The frame slot answers `SpriteFrameNodes` (`texCoords`, `flipDiagonal`, `trim`); `AtlasFrame`
  stores nine floats per sprite, `AnimatedFrames` reads an animation out of a one-row data texture
  through `ctx.sample()` and `texCoordsFromIndex()` (`node-utils.ts`), three texels per frame:
  `[s, t, u, v]`, `[width, height, flipDiagonal, endTime]`, `[left, top, right, bottom]`.
- `AtlasFrameTable` (texture/) lays the frames of an atlas into a uniform array for a material of
  one's own: at most 341 frames, the selection by a list of names, a `RegExp` or every frame.
- `Yaw` is data alone, a turn about +Y in the sense of `Object3D.rotation.y`: a sprite of
  `flatPlacement({orientation: 'yaw'})` faces `(sin yaw, 0, cos yaw)`.
  `cameraPositionLocal()` (`cameraNodes.ts`) is the camera position in the local space of the mesh.
- `ColorOrder` has `Tint 100, Mask 150, Fade 200, Flash 300, Pass 1000`; a color stage of the kind
  runs after the color source.
- No stage context offers a texture's filters, so a feature cannot warn about them itself
  (pipeline proposal §7.7 left the place of the warning open).

The roadmap's sketch is wrong about the code twice: it hands the table in as `frameTables: {…}` —
decision 3 makes it the texture `frameTable` —, and it builds the table with `atlasFrameTable()`,
whose uniform array stops at 341 frames; the table of `tableFrame()` is a `FrameTable` of its own
(§3).

## 3. `FrameTable` (module `texture/`)

```ts
/** A frame of a FrameTable: a frame of an atlas, or bare TextureCoords, which are untrimmed. */
export type FrameTableEntry = TextureAtlasFrame<unknown> | TextureCoords;

export interface FrameTableBakeOptions {
  /** The widest data texture the bake may build, in texels. Default: the limit of `renderer`, else 8192. */
  maxTextureSize?: number;
  renderer?: WebGPURenderer;
}

export class FrameTable {
  /** The frames of `atlas`: those of `selection` in its order — names, or a RegExp as `frameNames()` answers it — or every frame by id. */
  static fromAtlas(atlas: TextureAtlas<unknown>, selection?: AtlasFrameTableSelection): FrameTable;
  constructor(frames: readonly FrameTableEntry[]);
  get size(): number;
  /** The index of the frame named `name`, or -1. */
  indexOf(name: TextureAtlasFrameName): number;
  /** A new DataTexture of the frames — the `frameTable` of `tableFrame()`; the caller owns it. */
  bakeDataTexture(options?: FrameTableBakeOptions): DataTexture;
}

/** FrameTable.fromAtlas() in short. */
export function frameTable(atlas: TextureAtlas<unknown>, selection?: AtlasFrameTableSelection): FrameTable;
```

- **Selection** is the one of `AtlasFrameTable.fromAtlas()` — the code moves into an internal
  `selectAtlasFrames(atlas, selection, where)` that both call: a list of names in its order (a name
  listed twice keeps its first index), a `RegExp` as `atlas.frameNames(regex)` answers it — the
  order the frames were added, the order of the json —, or every frame by id, the index then being
  the frame id. A name the atlas lacks and an empty selection are refused (`FrameTable: the atlas
  holds no frame "x"`, `FrameTable: a table of no frames`).
- **Layout** of the bake, the contract with `tableFrame()`: RGBA float texels, `FloatType`, the
  filters `NearestFilter` of a `DataTexture`, no mipmaps, `flipY = false`.
  - texel 0, the header: `[frameCount, 0, 0, 0]`;
  - frame `k` at texels `1 + 3k`, `2 + 3k`, `3 + 3k`: `[s, t, u, v]` as `getTexCoords()` answers
    them, `[width, height, flipDiagonal, 0]`, and `[left, top, right, bottom]` as
    `frameTrimMargins()` reads them — the frame texels of an animsMap of three texels a frame,
    always three, so the shader needs no branch;
  - the texels lie row by row in a texture `min(1 + 3n, maxTextureSize)` wide and as many rows high
    as they take — the index → texel mapping of `texCoordsFromIndex()`. A table needs more than
    `maxTextureSize` rows only beyond some 22 million frames; that is refused naming both numbers.
- `bakeDataTexture()` builds a new texture on every call and keeps no reference to it: the caller
  owns it and disposes it (resource lifecycle §1, as `FrameBasedAnimations#bakeDataTexture()`). A
  table is plain data, no `dispose()`. A frame changed after the bake reaches the shader with the
  next bake.
- `maxTextureSize`: a whole number of 1 or more, else a `RangeError`; the limit of a renderer is read
  as `FrameBasedAnimations` reads it (the helper moves into an internal module both import).
- `AtlasFrameTable` stays as it is: the uniform array for a `NodeMaterial` of one's own. The guide
  says which to take.

## 4. `tableFrame()` (module `sprites/`)

### 4.1 The feature

```ts
export interface TableFrameOptions {
  /** How many views of each frame the table holds, picked by the angle of the camera — a whole number of 2 or more. */
  readonly views?: number;
}

export interface TableFrameApi {
  /** The entry of the frame table the sprite shows — with views, the first entry of the block of its views. */
  frameIndex: number;
}

export function tableFrame(options?: TableFrameOptions): SpriteFeature<TableFrameApi>;
export const TableFrame: SpriteFeature<TableFrameApi>; // tableFrame()
```

- One frozen feature per option set (as `flatPlacement()`): `tableFrame()` is `TableFrame`, named
  `tableFrame`; `tableFrame({views: n})` is named `tableFrame+views<n>`.
- **Attribute** `frameIndex` (size 1, float, **static**). A sprite starts at 0. A frame index a
  CPU-driven animation writes every frame takes the geometry option the library already has —
  `attributeUsage: {dynamic: ['frameIndex']}` — so no dynamic variant of the feature is needed.
- **Texture** `frameTable`, declared `needsImage: true`: until it has an image the sprite shows the
  defaults — the whole `colorMap` —, as `AnimatedFrames` without an animsMap.
- **The frame slot**, all through `ctx.sample('frameTable', texCoordsFromIndex(size, texel))` with
  `size = ctx.textureSize('frameTable')`, four lookups:

  ```
  count  = header.x                               // texel 0
  index  = round(frameIndex) [+ view]
  entry  = clamp(index, 0, max(count − 1, 0))
  first  = 1 + 3 · entry
  frame  = {texCoords: texel(first), flipDiagonal: texel(first + 1).z, trim: texel(first + 2)}
  ```

- **Out of range**: an index below 0 or past the last frame is clamped — silently, as
  `sampleAtlasFrame()` clamps: the sprite shows the first or the last frame. A fractional index is
  rounded. The shader cannot throw; the guide says it.

### 4.2 Directional frames — `views: n`

`tableFrame({views: n})` requires `instancePosition` and `yaw` (`requires: ['instancePosition',
'yaw']`) and adds the view to the index before the lookup, in the frame slot itself — a frame stage
runs after the frame is resolved and could not change the entry (pipeline proposal §7.6):

```
toCamera = cameraPositionLocal() − instancePosition          // in the local space of the mesh
angle    = atan(toCamera.x, toCamera.z)                       // atan2: 0 along +z, π/2 along +x
step     = round((angle − yaw) / (2π / n))
view     = step − n · floor(step / n)                         // 0 … n−1, for any yaw
index    = round(frameIndex) + view
```

- **The convention.** `yaw` turns the sprite as `Object3D.rotation.y` turns an object —
  counter-clockwise seen from above — and a sprite of yaw 0 faces +z. The angle of the camera is
  measured the same way, about +y from +z. So view `k` is the camera `k · 360°/n` counter-clockwise,
  seen from above, from the sprite's front: view 0 its front, and for `n = 8` view 2 its left side
  (the camera on the sprite's left, which is +x for a sprite facing +z). That is the order of the
  lookbook's `stalker` (`apps/lookbook/assets-src/README.md`, "boomer-shooter-corridor").
- **The layout.** The `n` views of a frame are `n` consecutive entries, view 0 first:
  `frameIndex` names the first entry of the block — `frameIndex = frame · n` — and the shader adds
  the view. The stalker's json lists every animation frame by frame, inside a frame its views 0–7,
  so `FrameTable.fromAtlas(atlas, /^stalker_walk_/)` is that layout as it is, and `frameIndex =
  frame · 8` with no reordering. (The roadmap's sketch already "adds … to the index".) A sheet that
  counts its views clockwise is read as view `(n − k) mod n`; the guide shows the one-line reorder of
  a name list.
- **Where it holds.** The angle lies in the xz plane of the mesh about +y: right for
  `axisBillboardPlacement()` (upright along +y), for `flatPlacement({orientation: 'yaw'})` and
  for `BillboardPlacement`. A mesh laid out in the xy plane with `axisBillboardPlacement({axis:
  'z'})` gets its views about +y of the mesh, not +z; such a scene turns the mesh instead. The
  camera is the one rendering: the views of a `ShadowPass` or `ReflectionPass` are the views the
  camera sees, as in every game of the genre.
- Straight above or below the sprite (`toCamera.xz` = 0) `atan(0, 0)` is 0: the front view.
- The math is branch-free (`floor`, no `%` on negative numbers, whose sign differs between WGSL
  and GLSL).
- `views` that is no whole number of 2 or more is refused with a `TypeError`:
  `tableFrame: views must be a whole number of 2 or more, got 1 — leave views out for frames without views`.

## 5. `PaletteSwap` (module `sprites/`)

### 5.1 The feature

```ts
export interface PaletteSwapOptions {
  /** How many entries of the palette the stage compares — a whole number from 1 to 64. Default 16. */
  readonly colors?: number;
}

export interface PaletteSwapApi {
  /** The row of the palette the sprite is drawn in; row 0 is the source colours. */
  paletteRow: number;
}

export function paletteSwap(options?: PaletteSwapOptions): SpriteFeature<PaletteSwapApi>;
export const PaletteSwap: SpriteFeature<PaletteSwapApi>; // paletteSwap()

export const ColorOrder: {Palette: 50, Tint: 100, Mask: 150, Fade: 200, Flash: 300, Pass: 1000};
```

- One frozen feature per option set; `PaletteSwap` is `paletteSwap()`, named `paletteSwap`;
  `paletteSwap({colors: c})` with another `c` is named `paletteSwap+<c>`.
- **Attribute** `paletteRow` (size 1, static; a sprite starts at 0 — its source colours).
- **Texture** `palette`: a small image, entry `i` of row `r` the texel `(i, r)` from the top left,
  loaded with `flipY = false` as every image of the library; row 0 the source colours, every row
  below a replacement set of the same length. Ordinary RGBA, no indexed PNG.
- **Uniforms** `paletteShift` (float, 0) and `paletteCycle` (vec2, `(0, 0)`): see §5.3.
- **A color stage at `ColorOrder.Palette` (50)** — a new band, before `Tint`, so a tint, a fade and a
  flash act on the swapped colours. `ColorOrder` gains the key; nothing else moves.
- `colors` that is no whole number from 1 to 64 is refused with a `TypeError`. 16 covers both
  lookbook palettes (`goblin-palette.png`, `chrome-32-palette.png`, 16 × 4 each); 64 bounds the cost.

### 5.2 The match

The stage gets the colour of the color source (`TextureColor`: the texel of the `colorMap`), and
compares its rgb with the first `colors` entries of row 0, unrolled in JavaScript — one
`ctx.sample('palette', …)` per entry, built eagerly as `AnimatedFrames` builds its search, never in a
TSL `Loop`/`If`/`Fn` callback (pipeline proposal §7.8):

```
w, h     = textureSize('palette')
entryUv(i, r) = ((i + 0.5) / w, (r + 0.5) / h)               // texel centres: exact under any filter
match_i  = [max(|rgb − source_i.rgb|) < 1/512] · [i < w]      // as 0 or 1, by step(): no branch
index    = −1, then for i = colors−1 … 0: index = mix(index, i, match_i)   // the first entry that matches wins
row      = clamp(round(paletteRow), 0, h − 1)
entry    = the cycled index (§5.3)
out      = mix(color, vec4(palette(entry, row).rgb, color.a), [index ≥ 0])
```

- **Exact colours.** The tolerance, `1/512` per channel, absorbs the rounding of 8-bit texels on
  their way through the sampler and nothing more: two source colours closer than that are one
  colour. Both textures are read in the same colour space — give the `colorMap` and the `palette`
  the same `colorSpace` (both `srgb`, or both none); mixed, no colour matches. The colour keeps its
  alpha; only rgb is replaced. A colour that matches no entry stays as it is.
- Entries past the width of the palette never match; a palette wider than `colors` has its later
  entries ignored. A `paletteRow` past the last row draws the last row, a negative one row 0.
- `colors` + 1 lookups per fragment (17 for the default) — the guide says it.
- **Requires `nearest`.** A `colorMap` filtered linearly blends neighbouring texels into colours of
  no palette; so does a mipmap. A premultiplied edge darkens one. The feature names the `colorMap`
  in `nearestTextures` (§6); the guide says to load both with the class `nearest`.
- No color source: the stage compares flat grey, which a palette rarely holds.

### 5.3 Colour cycling — `paletteShift`, `paletteCycle`

`paletteCycle = (first, count)` names the range of entries that cycles; `count` 0 — the default —
means "from `first` to the end of the palette". A colour matching entry `i` inside the range is
drawn with the entry

```
shift = floor(paletteShift)
entry = first + ((i − first + shift) mod count)               // mod by floor: any shift, either sign
```

of its row; one outside the range with entry `i`. `setUniform('paletteShift', t * speed)` runs the
colours through the range, one entry per whole step, the Deluxe Paint way; the default `(0, 0)` with
a shift of 0 cycles nothing. The chrome font cycles entries 1–15: `setUniform('paletteCycle', 1,
15)` (or `(1, 0)`). The uniforms are per mesh: sprites that cycle differently live in meshes of
their own — or the row picks a differently ordered palette.

## 6. The warning for a linear `colorMap` — `nearestTextures`

```ts
// SpriteFeature
/**
 * Textures, by name — the feature's own or another feature's — the feature reads texel for texel.
 * The sprites say once on the console when such a texture is set, with an image, and filtered with
 * anything but `NearestFilter` for `magFilter` or `minFilter`.
 */
readonly nearestTextures?: readonly string[];
```

- **Where it lives:** in `SpriteResources`, which holds the textures — one per `FeatureSprites`,
  shared by the material and every pass, so one warning per mesh and texture; a material built alone
  builds its own resources and warns on its own. An effect per named texture reads the texture
  signal; it checks when a texture with an image is set and when `touchTexture()` re-reads it, so a
  texture whose loader applies the `nearest` class with the image (`TextureFactory#load()`) is
  judged once the image is there, not before.
- A name no feature of the resources declares is passed over: `PaletteSwap` next to a color source
  of one's own that declares no `colorMap` has nothing to check.
- The message names the texture, the feature, the filters found and the fix, once per texture name:
  `FeatureSprites: the texture "colorMap" is filtered with magFilter LinearFilter and minFilter LinearMipmapLinearFilter — feature "paletteSwap" reads it texel for texel and needs NearestFilter for both; load it with the texture class 'nearest'`.
- `defineFeature()` refuses a `nearestTextures` that is no array of strings.

## 7. Ownership and lifecycle

Nothing new owns a GPU resource: the frame table's texture belongs to whoever baked it, the palette
to whoever loaded it, both borrowed by the material as every texture. The warning effects are
attached to `SpriteResources` and go with its `dispose()`.

## 8. Tests

- `FrameTable.spec.ts`: selection by list, `RegExp` (json order), every frame; `indexOf`; refusals;
  the layout of §3 texel by texel (header, coords, measures with a turned frame, trim of a trimmed
  frame, bare `TextureCoords`); width and rows against `maxTextureSize`; the renderer's limit; a new
  texture per call. `AtlasFrameTable.spec.ts` keeps passing on the shared selection.
- `TableFrame.spec.ts`: one feature per option set, names, `requires`, `attributes`, `textures`,
  `initialize`; the refusals of `views`; the graph without a table draws the defaults; with a table
  four lookups registered in the frame scope, a swap reaches them without rebuild; with views the
  graph reads `instancePosition`, `yaw` and the camera; a kind with `views` but no `Yaw` is refused by
  `defineSprite()`.
- `PaletteSwap.spec.ts`: one feature per option set; `ColorOrder.Palette`; attributes, uniforms,
  textures, `nearestTextures`; `colors + 1` lookups in the color graph and none in the position
  graph; refusals of `colors`; the stage drops out without a `palette`.
- `SpriteResources.spec.ts` / `SpriteFeature.spec.ts`: the warning — once, not for a nearest texture,
  not before the image, on `touchTexture()`, for no undeclared name, gone after `dispose()`; the
  refusal of a malformed `nearestTextures`.
- `hot-path-allocations.spec.ts`: writing `frameIndex` and `paletteRow` and
  `setUniform('paletteShift')` in a frame loop allocate nothing.
- Browser, `sprites-table-frame.test.js`: frames by index — an upright, a turned and a trimmed frame
  drawn where `AtlasFrame` draws them, an index past the end clamped; directional frames — a table
  of 8 one-colour views, the camera at 8 angles around an axis billboard shows view k at k·45°, a
  yaw of 90° moves every view by two, a `frameIndex` of 8 picks the second block, a flat placement
  with `orientation: 'yaw'` picks the same views.
- Browser, `sprites-palette-swap.test.js`: a synthetic palette — rows 0, 1, 2, an unmatched colour
  left as it is, `paletteShift` cycling the whole palette and a `paletteCycle` range; the lookbook's
  `goblin.png` in rows 1 and 2 against a swap worked out on the CPU from `goblin-palette.png`, texel
  for texel; a glyph of `chrome-32.png` cycled over entries 1–15 against the CPU.

## 9. Docs

- `docs/sprites.md`: the slot table (`tableFrame()`, `PaletteSwap`), the feature table, the band
  `ColorOrder.Palette`, `nearestTextures` among the fields of "Writing a feature"; new sections
  "Frames out of a table: `tableFrame()`" (with "Directional frames") and "Palette swap and colour
  cycling", each with a `ts check` block, after "Atlases built at run time".
- CHANGELOG `[Unreleased]`, Added: `FrameTable`, `tableFrame()`, `PaletteSwap`, `ColorOrder.Palette`,
  `nearestTextures`.
