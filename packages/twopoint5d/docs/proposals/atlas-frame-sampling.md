# Proposal: sampling atlas frames on meshes of one's own

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "Atlas frames on meshes of
one's own", and the lookbook demo `atlas-frames-on-meshes`. Prepared from
[issue #34](https://github.com/spearwolf/twopoint5d/issues/34); the decisions it rests on are
collected in §9. Deviations of the build from the first draft of this spec, which the sections
below now state as built:

- the sample takes explicit gradients for a `minFilter` that reads mipmaps, under every wrap, and
  for no other filter (§4.2): gradients matter nowhere else, and three (r186) reads a texture whose
  filters are both `NearestFilter` with `textureLoad` and binds no sampler for it, while its WGSL
  builder still names that sampler in the `textureSampleGrad` of a `grad()` — the shader fails on
  WebGPU;
- `wrap` takes a pair `[u, v]` as well, one wrap per axis (§4.1): a frame repeated around a
  cylinder — the skyline of the lookbook demo `atlas-frames-on-meshes`, and of the game the issue
  came from — repeats in u and has to hold its top and bottom edges in v, where a `fract()` of 1 at
  the edge would draw the opposite row;
- a table of every frame leaves out a frame `DynamicAtlas#remove()` let go of, and the frames after
  it move up one (§3.1) — `DynamicAtlas` came after this spec;
- the public surface carries four types, not two: `AtlasFrameTableEntry`,
  `AtlasFrameTableSelection` and `AtlasFrameWrap` besides `SampleAtlasFrameOptions` (§5, §6);
- the steps after the frame is known — wrap, trim, inset, lookup — live in the internal
  `sampleFrameAt()`, which `RepeatingTextureColor` shares, and the selection in the internal
  `selectAtlasFrames()`, which `FrameTable` shares (§5);
- the guide has a section of its own before "Glow: emissive sprites with bloom", not one beside
  "Frames out of an atlas" (§7): it is about meshes, not about a feature of a sprite;
- `update()` allocating nothing is held by `src/texture/hot-path-allocations.spec.ts`, and the
  arithmetic of §4.1 by the browser test `texture-atlas-frame-sampling.test.js` against a model of
  every pixel, not by a reference implementation on the CPU (§7); the seam of §4.2 is held there
  too, against a bare `fract()` that shows it.

## 1. Goal

A `TextureAtlas` knows where every frame lies, how it is turned and what the packer trimmed
off. Sprites read all of it. A mesh with a `NodeMaterial` of its own — a road, a facade, a sky
cylinder — would read none of it: whoever wants an atlas frame there divides pixel rectangles by
the image size, flips v by hand, ignores turned and trimmed frames and clamps against bleeding.

The goal: one frame table built from the atlas, and one TSL function that samples a frame of
it at a uv, per fragment, so that a frame can repeat on a surface.

```ts
import {sampleAtlasFrame, atlasFrameTable, type TextureAtlas} from '@spearwolf/twopoint5d';
import {attribute, uv} from 'three/tsl';
import {MeshBasicNodeMaterial, type Texture} from 'three/webgpu';

declare const atlas: TextureAtlas;
declare const atlasTexture: Texture;

// index 0, 1, 2 — the order of the list
const frames = atlasFrameTable(atlas, ['road', 'boost', 'start']);

const material = new MeshBasicNodeMaterial();
material.colorNode = sampleAtlasFrame(atlasTexture, frames, attribute<'float'>('frame'), uv().mul(4), {
  origin: 'bottom-left',
  wrap: 'repeat',
  inset: 0.5,
});
```

Not the goal:

- **Another way to draw sprites.** The sprite pipeline keeps its own lookup (`frameUv()`, a
  varying), which is right for a quad that shows a frame once.
- **A replacement for a texture of its own.** A surface that shows one image, repeated, is
  better served by that image as a texture of its own with `RepeatWrapping`: the GPU wraps it
  and its mipmaps are exact. The table is for scenes that already hold their frames in an atlas
  and want to share it between sprites and meshes.

## 2. What it builds on

- `TextureCoords` describes a frame as `s`, `t`, `u`, `v` in texture space, top left at
  `(0, 0)`, plus the flip bits. `u` and `v` are negative for a horizontal or vertical flip; under
  `FLIP_DIAGONAL` the lookup `(s + a·u, t + b·v)` swaps its two components. A rotated
  TexturePacker frame arrives as `FLIP_DIAGONAL | FLIP_VERTICAL`.
- `frameTrimMargins()` answers what a packer cut off a frame, as fractions of the untrimmed
  sprite, `[left, top, right, bottom]` — exported, with its type `FrameTrimMargins`; four zeros for
  a frame whose `spriteSourceSize` does not lie within its `sourceSize`.
- `FrameBasedAnimations#bakeDataTexture()` lays frames out as up to three RGBA texels:
  `[s, t, u, v]`, `[width, height, flipDiagonal, endTime]`, `[left, top, right, bottom]`. The table
  takes the layout of all three.
- `colorFromTextureByTexCoords()` and the internal `frameUv()` of the sprites sample one frame per
  instance; the mapping passes through a `varying`, interpolated between the vertices, so a
  `fract()` on the uv would break at every wrap. That is why the sampling here runs in the
  fragment stage alone.
- `TextureFactory` and `TextureStore` load textures with `flipY = false`, the convention every
  `TextureCoords` assumes.

## 3. The frame table — `AtlasFrameTable`

### 3.1 Building one

```ts
type AtlasFrameTableEntry = TextureAtlasFrame<unknown> | TextureCoords;
type AtlasFrameTableSelection = readonly TextureAtlasFrameName[] | RegExp;

AtlasFrameTable.fromAtlas(atlas: TextureAtlas<unknown>, selection?: AtlasFrameTableSelection): AtlasFrameTable;
atlasFrameTable(atlas: TextureAtlas<unknown>, selection?: AtlasFrameTableSelection): AtlasFrameTable; // its short form

new AtlasFrameTable(frames: readonly AtlasFrameTableEntry[]);

table.size; // the number of frames
table.indexOf(name: TextureAtlasFrameName): number;
table.update(): void;
```

- With a list of names, the index of a frame is its position in the list; a name listed twice
  keeps its first index.
- With a `RegExp`, the table takes the names `atlas.frameNames(match)` answers, in that order.
- Without a selection, the table takes every frame the atlas has not let go of, in the order of
  their ids: the index of a frame is its frame id, unless `DynamicAtlas#remove()` let go of a frame
  before it — that frame is left out, and the frames after it move up one.
- `indexOf(name)` answers the index of a frame of a table built by `fromAtlas()`, `-1` for a name
  it does not hold. A table built by the constructor has no names.
- A bare `TextureCoords` in the list is an untrimmed frame.
- Refused, and nothing is built: a name the atlas does not hold
  (`AtlasFrameTable: the atlas holds no frame "…"`, the name quoted through `describeValue()`, so a
  symbol stands apart from a string), a selection or a list of no frames
  (`AtlasFrameTable: a table of no frames`) and more frames than the limit (§3.3).

`selectAtlasFrames()` (`src/texture/selectAtlasFrames.ts`, internal) makes the selection;
`FrameTable` of the `tableFrame()` sprites takes the same selection through it.

### 3.2 Layout

Three `vec4` per frame, the layout of the three frame texels of `bakeDataTexture()`:

| element | values |
| --- | --- |
| `3·i` | `[s, t, u, v]` — `TextureCoords#getTexCoords()` |
| `3·i + 1` | `[width, height, flipDiagonal, 0]` — the measures of the area in the image, `flipDiagonal` `1` or `0`; the `0` stands where the animsMap keeps the end time of a frame |
| `3·i + 2` | `[left, top, right, bottom]` — `frameTrimMargins()` of the frame data |

The table holds them as a `uniformArray` of `Vector4`. three uploads such an array with every
render, so a value written to it takes effect in the next frame without a rebuild. The length
of the array is part of the shader source; a table never changes its frame count.

### 3.3 Limit

On the WebGL 2 fallback three declares the array as a `std140` uniform block of its own, and
WebGL 2 promises 16 KiB for one (`MAX_UNIFORM_BLOCK_SIZE`): 1024 `vec4`, so **341 frames**.
WebGPU promises 64 KiB. The table does not know the backend it will be drawn with, so it holds
the lower limit, `AtlasFrameTable.MaxFrames = 341`, and refuses a larger table with a
`RangeError` that names the limit:
`AtlasFrameTable: 342 frames are more than the 341 a uniform block of 16 KiB holds — split them into several tables`.

A second limit lies beside it, and the table cannot check it: the number of uniform blocks one
shader stage may bind — at least 12 on WebGL 2 (`MAX_FRAGMENT_UNIFORM_BLOCKS`) and by default 12
on WebGPU (`maxUniformBuffersPerShaderStage`), and three takes some of them for its own groups.
Every table a material samples is one block, so a handful per material is safe; past that the
shader fails to build, and three reports it on the console. The guide names the limit.

### 3.4 Updating

`update()` reads the frames the table was built from again — their `coords`, their flip, their
trim — into the existing `Vector4`s, through two scratch arrays of the module. It allocates
nothing. A frame whose `coords` were replaced by another object in the atlas is not followed;
the table holds the frame objects it got. The constructor calls it once.

### 3.5 Ownership

The table owns no GPU resource of its own: the uniform buffer belongs to the renderer, as for
any uniform node. It has no `dispose()`.

## 4. Sampling — `sampleAtlasFrame()`

```ts
sampleAtlasFrame(
  map: Texture,
  table: AtlasFrameTable,
  index: Node<'int'> | Node<'uint'> | Node<'float'> | number,
  uv: Node<'vec2'>,
  options: SampleAtlasFrameOptions,
): Node<'vec4'>;

type AtlasFrameWrap = 'clamp' | 'repeat';

interface SampleAtlasFrameOptions {
  origin: 'top-left' | 'bottom-left'; // required
  wrap?: AtlasFrameWrap | readonly [u: AtlasFrameWrap, v: AtlasFrameWrap]; // 'clamp'
  trim?: 'mask' | 'stretch'; // 'mask'
  inset?: number; // texels, 0
}
```

Everything is computed in the fragment stage; nothing passes through a varying.

The options are checked when the graph is built. Refused: an `origin`, a `trim` or a `wrap` that
is none of its words, and a `wrap` that is neither a word nor a pair of them, each with an `Error`
(`sampleAtlasFrame: the origin "…" is none of top-left, bottom-left`); an `inset` that is negative
or no finite number with a `RangeError`
(`sampleAtlasFrame: the inset … is no finite number of 0 or more`).

### 4.1 Order of the steps

At the uv `p`:

1. **Index.** A float index is rounded to the nearest frame, a half up — `floor(index + 0.5)`
   (`roundHalfUp()`), so 2.5 draws frame 3 on WebGPU and WebGL 2 alike, where TSL's `round()`
   would take a half to the even neighbour on one and leave it to the driver on the other. Every
   index is clamped to `[0, size − 1]`, so a stray value draws the first or the last frame and
   never reads outside the array. The clamp is silent — a shader has no way to report it — and the
   guide says so.
2. **Origin.** `'bottom-left'` takes `p.y` as `1 − p.y` — three's `uv()` on its geometries
   counts v upwards; `'top-left'` takes `p` as it is — the convention of `TextureCoords`.
3. **Wrap.** Per axis: `'clamp'` clamps the component to `[0, 1]`, `'repeat'` takes its
   `fract()`. A single word wraps both axes; a pair `[u, v]` wraps each on its own —
   `['repeat', 'clamp']` runs a frame around a cylinder and holds its top and bottom edges.
4. **Trim.** The uv stands for the untrimmed sprite, as the quad of a sprite does. With
   `'mask'` the trimmed area is the part `[left, 1 − right] × [top, 1 − bottom]` of it; `p` is
   mapped into that area, and outside it the result is `vec4(0)` — the sample is multiplied by
   0 or 1, with no branch, so the material needs transparency or an alpha test for it. With
   `'stretch'` the trimmed area fills the whole uv. An untrimmed frame is the same under both.
5. **Inset.** The position inside the frame is clamped to `inset` texels from each edge, so
   that a linear sample, or a nearest one right at a wrap, never reaches the neighbouring frame in
   the atlas. The texels are those of the drawn frame: under `flipDiagonal` it is drawn `height`
   wide and `width` high. An inset of half a frame or more samples its centre.
6. **Lookup.** `(s, t) + q·(u, v)`, swapped where `flipDiagonal` is `1` — the lookup
   `TextureCoords` describes, so a horizontal, vertical and diagonal flip and a rotated
   TexturePacker frame come out upright. The swap is a `mix()` with the flip of 0 or 1, never a
   `select()`: three builds a `select()` as an if/else and declares a value both branches read in
   only one of them, which WebKit's WebGL 2 reads as garbage.

Steps 3 to 6 are the internal `sampleFrameAt()` (`src/texture/sampleFrameAt.ts`);
`sampleAtlasFrame()` hands it the three `vec4` of the frame and a lookup into `map`.

### 4.2 Mipmaps

`fract()` jumps from 1 to 0 at every wrap; the screen-space derivatives of the uv jump with it,
and a sampler that picks the mip level from them picks the smallest one along a line at every
wrap — a visible seam. When the `minFilter` of `map` reads mipmaps
(`NearestMipmapNearestFilter`, `NearestMipmapLinearFilter`, `LinearMipmapNearestFilter`,
`LinearMipmapLinearFilter`), the sample therefore takes explicit gradients,
`texture(…).grad(dx, dy)`, worked out from the derivatives of the uv *before* the wrap, scaled by
the extent of the frame — of the trimmed area under `'mask'` — and swapped like the lookup. The
filter is read when the graph is built; a filter changed afterwards takes a new graph. Without
mipmaps the sample takes no gradients: none are needed, and three reads a texture whose filters
are both `NearestFilter` with `textureLoad`, without the sampler a `grad()` names.

That removes the seam. It does not stop the smaller mip levels of an atlas from mixing
neighbouring frames; an atlas sampled with mipmaps needs padding or extruded edges from its
packer, or a texture without mipmaps. The guide says so next to the function.

### 4.3 The convention of the texture

The table assumes a texture loaded with `flipY = false`, as `TextureFactory` and `TextureStore`
load it. The function does not check `map.flipY`, as `colorFromTextureByTexCoords()` does not; a
texture with `flipY = true` draws every frame from the wrong place, and the guide says so next to
the function.

## 5. Where it lives

`src/texture/AtlasFrameTable.ts` and `src/texture/sampleAtlasFrame.ts`, exported through
`src/texture/public-api.ts` with the types `AtlasFrameTableEntry`, `AtlasFrameTableSelection`,
`AtlasFrameWrap` and `SampleAtlasFrameOptions`. Beside them, internal:
`src/texture/sampleFrameAt.ts` — the steps 3 to 6 of §4.1 and the gradients of §4.2, shared with
`RepeatingTextureColor` —, `src/texture/selectAtlasFrames.ts` — the selection of §3.1, shared with
`FrameTable` — and `src/texture/roundHalfUp.ts`. `texture/` is the layer of atlases, below
`sprites/` and `map2d/`, so both can take the table. It brought `three/tsl` into `texture/`; no
layer rule is touched, `three` is a peer of every layer.

The cast that `uniformArray(…).element()` needs to pass as a `Node<'vec4'>` lives in one place,
the internal `AtlasFrameTable#element()`, with a comment that names the three typing it works
around.

## 6. What it changes

Nothing that existed before it. The exports are new names, and `frameUv()`,
`colorFromTextureByTexCoords()`, `AtlasFrame`, `TextureColor` and the sprite materials keep their
graphs.

What grows: the public surface by one class, two functions and four types — each one more name
for `checkNameableTypes` and the docs' type check to hold — and `texture/` by a dependency on
the TSL types of three, whose next minor may move them.

## 7. Tests and docs

- **Vitest** (`src/texture/AtlasFrameTable.spec.ts`): the layout of §3.2 for a plain, a
  turned and a trimmed frame; selection by names, by `RegExp` in the order of `frameNames()` and
  without one by frame id, leaving out a frame the atlas let go of; `indexOf()`; a list of frames
  and bare `TextureCoords`; the refusals of §3.1 and §3.3; `update()` after a change of the frames;
  the node as an array of `vec4`.
- **Vitest** (`src/texture/sampleAtlasFrame.spec.ts`): that the graph builds for each origin, wrap
  and trim and each type of index; gradients for a mipmapped texture and none for a `minFilter`
  without mipmaps; the mask of `'mask'`; a wrap of one word as the wrap of both axes; no branch in
  the graph; the index of 0.5, 1.5 and 2.5 reading the frames 1, 2 and 3; the refusals of §4.
  `src/texture/sampleFrameAt.spec.ts` holds the steps 3 to 6 of §4.1 on their own.
- **Vitest** (`src/texture/hot-path-allocations.spec.ts`): `update()` of a table of 341 frames
  allocates nothing.
- **Browser** (`packages/twopoint5d-testing/test/texture-atlas-frame-sampling.test.js`, WebGPU
  and WebGL 2), every pixel against a model of the plane: a turned frame drawn upright as the
  upright one, with three's uv from the bottom left; the origin `'top-left'`; a frame repeated
  inside its own area without the frame beside it bleeding in; a turned frame repeated as the
  upright one; each axis wrapped on its own; a trimmed frame laid where the untrimmed sprite has
  it, with nothing around it; a frame of a mipmapped atlas repeated without a seam, where a bare
  `fract()` shows one.
- **Docs:** the section "Atlas frames on meshes of one's own" in [`docs/sprites.md`](../sprites.md),
  before "Glow: emissive sprites with bloom", with a `ts check` block, the limits of §3.3, the
  mipmap note of §4.2 and the convention of §4.3; the paragraph on `texture/` in
  [`docs/architecture.md`](../architecture.md); the entry in `CHANGELOG.md`.
- **Lookbook:** the demo `atlas-frames-on-meshes`, a night city out of the atlases of the game the
  issue came from — a road of repeated frames, facades by `RegExp`, skyline rings around it
  (`apps/lookbook/src/demos/atlas-frames-on-meshes/`).

## 8. Not part of it

- A data texture as the table of `sampleAtlasFrame()`, for more than 341 frames. `FrameTable`
  bakes the same three texels a frame into a data texture for the `tableFrame()` sprites;
  `sampleAtlasFrame()` reads an `AtlasFrameTable` alone, and a mesh that needs more frames waits
  for a scene that needs it.
- `wrap: 'mirror'`.
- A uv node of its own (`atlasFrameUv()`) for samplers of one's own: the gradients of §4.2 and
  the mask of §4.1 do not fit into a `vec2`.

## 9. Decisions

1. **`origin` is required.** The convention of the uv is the mistake the issue is about; an
   argument at every call makes it visible where a default would hide it again.
2. **`texture/`, not `sprites/node-utils.ts`.** The table is about atlases, not sprites, and the
   lower layer lets `map2d/` take it as well.
3. **`trim: 'mask'` is the default.** It is the meaning a sprite gives a trimmed frame; an
   opaque frame, which a packer trims nothing off, is the same under both.
4. **No check of `texture.flipY`**, a sentence in the guide instead (§4.3).
5. **A function and a class:** `atlasFrameTable()` is the short form of
   `AtlasFrameTable.fromAtlas()`; the constructor takes a list of frames.
