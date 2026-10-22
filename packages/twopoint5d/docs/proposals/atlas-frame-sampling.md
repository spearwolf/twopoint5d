# Proposal: sampling atlas frames on meshes of one's own

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "Atlas frames on meshes of
one's own". Prepared from [issue #34](https://github.com/spearwolf/twopoint5d/issues/34); the
decisions it rests on are collected in §9. Deviations:

- the sample takes explicit gradients only for a `minFilter` that reads mipmaps, read when the
  graph is built (§4.2): gradients matter nowhere else, and three (r186) reads a texture whose
  filters are both `NearestFilter` with `textureLoad` and binds no sampler for it, while its WGSL
  builder still names that sampler in the `textureSampleGrad` of a `grad()` — the shader fails on
  WebGPU;
- `wrap` takes a pair `[u, v]` as well, one wrap per axis (§4.1; §8 left it out): a frame repeated
  around a cylinder — the skyline of the lookbook demo `atlas-frames-on-meshes`, and of the game
  the issue came from — repeats in u and has to hold its top and bottom edges in v, where a
  `fract()` of 1 at the edge would draw the opposite row;
- the guide has a section of its own before "Performance", not one beside "Frames out of an
  atlas" (§7): it is about meshes, not about a feature of a sprite;
- `update()` allocating nothing is held by `src/texture/hot-path-allocations.spec.ts`, and the
  arithmetic of §4.1 by the browser test `texture-atlas-frame-sampling.test.js` against a model of
  every pixel, not by a reference implementation on the CPU (§7); the seam of §4.2 is held there
  too, against a bare `fract()` that shows it.

The sketch below is kept as it was written.

## 1. Goal

A `TextureAtlas` knows where every frame lies, how it is turned and what the packer trimmed
off. Sprites read all of it. A mesh with a `NodeMaterial` of its own — a road, a facade, a sky
cylinder — reads none of it: whoever wants an atlas frame there divides pixel rectangles by the
image size, flips v by hand, ignores turned and trimmed frames and clamps against bleeding.

The goal: one frame table built from the atlas, and one TSL function that samples a frame of
it at a uv, per fragment, so that a frame can repeat on a surface.

```ts
import {sampleAtlasFrame, atlasFrameTable, type TextureAtlas} from '@spearwolf/twopoint5d';
import {attribute, uv} from 'three/tsl';
import {MeshBasicNodeMaterial, type Texture} from 'three/webgpu';

declare const atlas: TextureAtlas;
declare const atlasTexture: Texture;

const frames = atlasFrameTable(atlas, ['road', 'boost', 'start']);

const material = new MeshBasicNodeMaterial();
material.colorNode = sampleAtlasFrame(atlasTexture, frames, attribute<'float'>('frame'), uv(), {
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

## 2. What there is today

- `TextureCoords` describes a frame as `s`, `t`, `u`, `v` in texture space, top left at
  `(0, 0)`, plus the flip bits. `u` and `v` are negative for a horizontal or vertical flip; under
  `FLIP_DIAGONAL` the lookup `(s + a·u, t + b·v)` swaps its two components. A rotated
  TexturePacker frame arrives as `FLIP_DIAGONAL | FLIP_VERTICAL`.
- `frameTrimMargins()` answers what a packer cut off a frame, as fractions of the untrimmed
  sprite, `[left, top, right, bottom]`.
- `FrameBasedAnimations#bakeDataTexture()` already lays frames out as up to three RGBA texels:
  `[s, t, u, v]`, `[width, height, flipDiagonal, 0]`, `[left, top, right, bottom]`.
- `colorFromTextureByTexCoords()` and the internal `frameUv()` sample one frame per instance;
  the mapping passes through a `varying`, interpolated between the vertices, so a `fract()` on
  the uv breaks at every wrap.
- `TextureFactory` and `TextureStore` load textures with `flipY = false`, the convention every
  `TextureCoords` assumes.

## 3. The frame table — `AtlasFrameTable`

### 3.1 Building one

```ts
AtlasFrameTable.fromAtlas(atlas, selection?); // atlasFrameTable(atlas, selection?) is its short form

atlasFrameTable(atlas: TextureAtlas<unknown>): AtlasFrameTable; // every frame, index = frame id
atlasFrameTable(atlas: TextureAtlas<unknown>, names: readonly TextureAtlasFrameName[]): AtlasFrameTable;
atlasFrameTable(atlas: TextureAtlas<unknown>, match: RegExp): AtlasFrameTable; // atlas.frameNames(match), in its order

new AtlasFrameTable(frames: readonly (TextureAtlasFrame<unknown> | TextureCoords)[]);
```

- The index of a frame in the table is its position in the list it was built from; without a
  selection, its frame id in the atlas.
- `indexOf(name)` answers the index of a frame the table was built by name, `-1` otherwise.
- A name the atlas does not hold, an empty selection and a frame count over the limit (§3.3)
  are refused with an error; nothing is built.
- A bare `TextureCoords` in the list is an untrimmed frame.

### 3.2 Layout

Three `vec4` per frame, the layout of the three texels of `bakeDataTexture()`:

| element | values |
| --- | --- |
| `3·i` | `[s, t, u, v]` — `TextureCoords#getTexCoords()` |
| `3·i + 1` | `[width, height, flipDiagonal, 0]` — the measures of the area in the image, `flipDiagonal` `1` or `0` |
| `3·i + 2` | `[left, top, right, bottom]` — `frameTrimMargins()` of the frame data |

The table holds them as a `uniformArray` of `Vector4`. three uploads such an array with every
render, so a value written to it takes effect in the next frame without a rebuild. The length
of the array is part of the shader source; a table never changes its frame count.

### 3.3 Limit

On the WebGL 2 fallback three declares the array as a `std140` uniform block of its own, and
WebGL 2 promises 16 KiB for one (`MAX_UNIFORM_BLOCK_SIZE`): 1024 `vec4`, so **341 frames**.
WebGPU promises 64 KiB. The table does not know the backend it will be drawn with, so it holds
the lower limit, `AtlasFrameTable.MaxFrames = 341`, and refuses a larger table with a
`RangeError` that names the limit.

A second limit lies beside it, and the table cannot check it: the number of uniform blocks one
shader stage may bind — at least 12 on WebGL 2 (`MAX_FRAGMENT_UNIFORM_BLOCKS`) and by default 12
on WebGPU (`maxUniformBuffersPerShaderStage`), and three takes some of them for its own groups.
Every table a material samples is one block, so a handful per material is safe; past that the
shader fails to build, and three reports it on the console. The guide names the limit.

### 3.4 Updating

`update()` reads the frames the table was built from again — their `coords`, their flip, their
trim — into the existing `Vector4`s. It allocates nothing. A frame whose `coords` were replaced
by another object in the atlas is not followed; the table holds the frame objects it got.

### 3.5 Ownership

The table owns no GPU resource of its own: the uniform buffer belongs to the renderer, as for
any uniform node. It has no `dispose()`. (To be checked against
[`resource-lifecycle.md`](../resource-lifecycle.md) §5 before the build.)

## 4. Sampling — `sampleAtlasFrame()`

```ts
sampleAtlasFrame(
  texture: Texture,
  table: AtlasFrameTable,
  index: Node<'int'> | Node<'uint'> | Node<'float'> | number,
  uv: Node<'vec2'>,
  options: SampleAtlasFrameOptions,
): Node<'vec4'>;

interface SampleAtlasFrameOptions {
  origin: 'top-left' | 'bottom-left'; // required
  wrap?: 'clamp' | 'repeat'; // 'clamp'
  trim?: 'mask' | 'stretch'; // 'mask'
  inset?: number; // texels, 0
}
```

Everything is computed in the fragment stage; nothing passes through a varying.

### 4.1 Order of the steps

At the uv `p`:

1. **Index.** A float index is rounded to the nearest frame, a half up, on WebGPU and WebGL 2 alike;
   every index is clamped to `[0, size − 1]`, so a stray value draws the first or the last frame and
   never reads outside the array. The clamp is silent — a shader has no way to report it — and the
   guide says so.
2. **Origin.** `'bottom-left'` takes `p.y` as `1 − p.y` — three's `uv()` on its geometries
   counts v upwards; `'top-left'` takes `p` as it is — the convention of `TextureCoords`.
3. **Wrap.** `'clamp'` clamps `p` to `[0, 1]`; `'repeat'` takes `fract(p)`.
4. **Trim.** The uv stands for the untrimmed sprite, as the quad of a sprite does. With
   `'mask'` the trimmed area is the part `[left, 1 − right] × [top, 1 − bottom]` of it; `p` is
   mapped into that area, and outside it the result is `vec4(0)`. With `'stretch'` the trimmed
   area fills the whole uv. An untrimmed frame is the same under both.
5. **Inset.** The position inside the frame is clamped to `inset` texels from each edge, so
   that a linear sample never reaches the neighbouring frame in the atlas. The texels are those
   of the drawn frame: under `flipDiagonal` it is drawn `height` wide and `width` high. An inset
   of half a frame or more samples its centre.
6. **Lookup.** `(s, t) + q·(u, v)`, swapped where `flipDiagonal` is `1` — the lookup
   `TextureCoords` describes, so a horizontal, vertical and diagonal flip and a rotated
   TexturePacker frame come out upright.

### 4.2 Mipmaps

`fract()` jumps from 1 to 0 at every wrap; the screen-space derivatives of the uv jump with it,
and a sampler that picks the mip level from them picks the smallest one along a line at every
wrap — a visible seam. With `wrap: 'repeat'` the sample therefore takes explicit gradients,
`texture(…).grad(dx, dy)`, worked out from the derivatives of the uv *before* the wrap and
scaled by the extent of the frame.

That removes the seam. It does not stop the smaller mip levels of an atlas from mixing
neighbouring frames; an atlas sampled with mipmaps needs padding or extruded edges from its
packer, or a texture without mipmaps. The guide says so next to the function.

### 4.3 The convention of the texture

The table assumes a texture loaded with `flipY = false`, as `TextureFactory` and `TextureStore`
load it. The function does not check `texture.flipY`, as `colorFromTextureByTexCoords()` does
not; a texture with `flipY = true` draws every frame from the wrong place, and the guide says so
next to the function.

## 5. Where it lives

`src/texture/AtlasFrameTable.ts` and `src/texture/sampleAtlasFrame.ts`, exported through
`src/texture/public-api.ts`, with the types `SampleAtlasFrameOptions` and the selection
argument. `texture/` is the layer of atlases, below `sprites/` and `map2d/`, so both could take
the table later. It brings `three/tsl` into `texture/` for the first time; no layer rule is
touched, `three` is a peer of every layer.

The cast that `uniformArray(…).element()` needs to pass as a `Node<'vec4'>` lives in one place,
inside `AtlasFrameTable`, with a comment that names the three typing it works around.

## 6. What it changes

Nothing that exists. The two files are new, the exports are new names (none of them is taken in
`src/` or the lookbook), and `frameUv()`, `colorFromTextureByTexCoords()`, `AtlasFrame`,
`TextureColor` and the sprite materials stay as they are; no existing shader graph changes. The
release that carries it is a minor one.

What grows: the public surface by one class, two functions and two types — each one more name
for `checkNameableTypes` and the docs' type check to hold — and `texture/` by a dependency on
the TSL types of three, whose next minor may move them.

## 7. Tests and docs

- **Vitest** (`src/texture/AtlasFrameTable.spec.ts`): the layout of §3.2 for a plain, a
  rotated, a flipped and a trimmed frame; selection by names, by `RegExp` in the order of
  `frameNames()` and without one by frame id; `indexOf()`; the refusals of §3.1 and §3.3;
  `update()` after a change of `flip`, and that it allocates nothing.
- **Vitest** for the graph of `sampleAtlasFrame()`: that it builds for each option and each
  type of index; the arithmetic of §4.1 checked on the CPU through a small reference
  implementation of the same steps, against `TextureCoords` lookups.
- **Browser** (`packages/twopoint5d-testing/test/`, WebGPU and WebGL 2): a plane that draws a
  rotated and a trimmed frame of a TexturePacker atlas upright and in place; a plane with a
  frame repeated four times, mipmapped, without a seam at the wraps; both origins.
- **Docs:** a section "Atlas frames on meshes of one's own" in [`docs/sprites.md`](../sprites.md)
  beside "Frames out of an atlas", with a `ts check` block, the mipmap note of §4.2 and the
  convention of §4.3; a line in `docs/architecture.md` under `texture/`; an entry under
  `## [Unreleased]` in `CHANGELOG.md`.
- **Lookbook** (optional): a demo that tiles atlas frames on a ground mesh next to sprites from
  the same atlas.

## 8. Not part of it

- A data texture as the table, for more than 341 frames. `bakeDataTexture()` shows the way, and
  the layout of §3.2 is already that of its texels; it waits for a scene that needs it.
- `wrap: 'mirror'`, and a wrap per axis.
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
