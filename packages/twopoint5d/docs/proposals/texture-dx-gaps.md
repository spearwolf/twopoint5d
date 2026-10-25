# Proposal: five gaps of the texture module the demos ran into

Status: **implemented** — see [`docs/textures.md`](../textures.md) (the wrap classes) and
[`docs/sprites.md`](../sprites.md), "Animated frames" (the frames it shows), "Aseprite sheets"
(`isAsepriteFrameData()`, `playback` in a catalog) and "Atlases built at run time: `DynamicAtlas`"
(`textureFor()`); browser test `texture-dynamic-atlas.test.js` (one canvas through both filters).
Deviations:

- the texture classes had no guide; [`docs/textures.md`](../textures.md) is their guide, every class
  in it, the wrap classes among them (§2);
- the filter of a `DynamicAtlas` is a type of its own, `DynamicAtlasFilter`, which the option, the
  `filter` field and `textureFor()` share (§5);
- the `platformer` reads the first frame of its idle and its walk out of `frames` as well, and its
  sheets no longer look up a frame by name (§3).

Five small features of the module `texture/`, each found by a lookbook demo that had to work around
it: a wrap set by hand after the load, frames looked up by name, a cast to `AsepriteFrameData`, a
second atlas for a second filter, an atlas adapter of one's own for a one-shot. None of them changes
what is built; each adds an option, a field or a function beside it.

## 1. Goal

| who | what they get | § |
| --- | --- | --- |
| a tiling ground or wall out of a catalog (`swaying-grass`, `boomer-shooter-corridor`) | the texture classes `repeat`, `mirror`, `clamp` and their per-axis forms | 2 |
| code that needs the frame an animation shows — a hit box, a key frame (`platformer`) | `FrameBasedAnimationInfo#frames`, the frames in the order they are played | 3 |
| code that reads the `slices` of an Aseprite frame out of a `TextureStore` (`platformer`) | `isAsepriteFrameData(data)`, a type guard in place of a cast | 4 |
| a run-time atlas of smooth portraits beside pixel labels (`ui-panels`) | `DynamicAtlas#textureFor(filter)`, a second texture of the same canvas | 5 |
| a sheet exported without Aseprite's "Repeat" (`platformer`) | `playback` per tag in a catalog item, handed to the atlas adapter | 6 |

## 2. Wrap classes of `TextureFactory`

`TextureOptions` gains `wrapS` and `wrapT`, and the factory nine classes that write them:

| class | `wrapS` | `wrapT` | breadth |
| --- | --- | --- | --- |
| `repeat` | `RepeatWrapping` | `RepeatWrapping` | 1000 |
| `mirror` | `MirroredRepeatWrapping` | `MirroredRepeatWrapping` | 1000 |
| `clamp` | `ClampToEdgeWrapping` | `ClampToEdgeWrapping` | 1000 |
| `repeat-s`, `mirror-s`, `clamp-s` | the wrap of the name | — | 500 |
| `repeat-t`, `mirror-t`, `clamp-t` | — | the wrap of the name | 500 |

- The breadth follows the rule of the filter classes: a class that writes both axes is applied
  before one that writes a single axis, so `['repeat', 'clamp-t']` repeats along `s` alone.
- No seed and no default class writes a wrap: a texture built without a wrap class keeps the wrap
  three.js gives it, `ClampToEdgeWrapping`, and `update()` without one leaves the wrap of the texture
  as it is.
- `s` and `t` are the names of three.js (`wrapS`, `wrapT`): `s` runs along the width of the image.
- A `TextureStore` catalog names them in `texture` and `defaultTextureClasses` as any other class;
  `isTextureOptionClass()` knows them, so `parse()` lets them through.

Held by `TextureFactory.spec.ts` (each class, the breadth against an axis class, `update()` without
one) and `TextureStore.spec.ts` (a catalog item with `repeat-s`).

## 3. The frames of an animation

`FrameBasedAnimationInfo` gains

```ts
/** The frames, in the order they are played, one per frame of `frameCount`. Frozen. */
readonly frames: readonly TextureAtlasFrame<unknown>[];
```

- Out of an atlas — by `frameNameQuery` or by a list of names — they are the frame objects of the
  atlas: `coords` and `data`, as `atlas.frame(name)` answers them. A name listed twice, a frame of a
  repeated Aseprite tag, stands there twice.
- Out of a `TileSet` they are `tileSet.frame(tileId)`; out of a list of `TextureCoords` they are
  `{coords}` without `data`.
- The array is built once by `add()` and frozen; `animation()` answers the same array at every call,
  and `clone()` shares it.
- `data` is typed `unknown`: one `FrameBasedAnimations` holds the frames of any atlas, and nothing
  tells their data apart by type. §4 reads Aseprite data out of it.

The `platformer` finds the key frame of a one-shot — the one of the longest duration — and reads its
hit box out of `frames[key]`; the first frame of its idle and of its walk, which size and anchor its
figures, come out of `frames[0]`.

Held by `FrameBasedAnimations.spec.ts` (each of the three sources, a name listed twice, the same
frozen array per call and after `clone()`).

## 4. Aseprite frame data out of a store

```ts
export function isAsepriteFrameData(data: unknown): data is AsepriteFrameData;
```

`true` for the data `AsepriteJson.parse()` gives a frame: an object with a `frame` object, a
`duration` that is a finite number above 0, an `index` that is a whole number of 0 or more and
`slices` that are an object and no array. `false` for anything else, `undefined` among it.

The atlas a `TextureStore` hands out stays typed as `TextureAtlas`, its data a TexturePacker entry.
Which adapter reads an item is decided at run time — by `atlasAdapter` or by `meta.app` of a json
fetched later —, so no type of the store can follow it, and a type parameter on `getAsync()` would be
a cast under another name. The guard asks the data itself and narrows it for TypeScript:

```ts
const data = frame.data;
if (!isAsepriteFrameData(data)) throw new Error(`no Aseprite frame`);
data.slices['pivot'];
```

Held by `AsepriteJson.spec.ts` (every frame of a parsed sheet passes, each missing or wrong field
fails, TexturePacker data fails).

## 5. A second filter of a `DynamicAtlas`

One texture has one filter, and a `FeatureSprites` reads one `colorMap`. A run-time atlas whose
portraits want `linear` and whose labels want `nearest` takes a second texture of the same canvas:

```ts
export type DynamicAtlasFilter = 'linear' | 'nearest';

/** The filter of `texture`: the option, `'linear'` without it. */
readonly filter: DynamicAtlasFilter;

/**
 * The texture of the canvas with `filter`: `texture` for the filter of the atlas, else a second
 * texture of the same canvas, built at the first call and kept. The atlas owns both.
 */
textureFor(filter: DynamicAtlasFilter): CanvasTexture<HTMLCanvasElement | OffscreenCanvas>;
```

- The second texture carries every setting of the first — upright, sRGB, straight alpha, no
  mipmaps — and differs in its filters alone.
- Every change reaches both: `add()`, `redraw()` and `remove()` mark both for upload until the first
  `upload()`, and `upload()` copies each changed cell into both — the staging texture filled once,
  copied twice. A whole upload, `clear()` and an `upload()` that throws mark both.
- Each texture is a GPU texture of its own: the second costs the memory of the canvas once more, and
  a whole upload goes up twice.
- A filter that is neither `'linear'` nor `'nearest'` is refused with a `TypeError`, as by the
  constructor; after `dispose()` the call throws, as `texture` does. `dispose()` releases both.

Held by `DynamicAtlas.spec.ts` (the same texture for the own filter, one second texture kept, the
marks of each change, the copies of `upload()`, `dispose()`), and by a browser test that draws one
frame through both textures.

## 6. `playback` per tag in a catalog item

```ts
export interface TextureResourceData {
  // … as before
  /** The playback of an animation the atlas adapter reads, by its name — an Aseprite tag. */
  playback?: Readonly<Record<string, AnimationPlayback>>;
}

export interface AtlasAdapterOptions {
  /** The playback of an animation by its name, in place of the one the json gives it. */
  readonly playback?: Readonly<Record<string, AnimationPlayback>>;
}

export type AtlasAdapter = (
  json: TexturePackerJsonData,
  parentCoords: TextureCoords,
  options?: AtlasAdapterOptions,
) => AtlasAdapterResult;
```

- **Catalog.** An atlas item reads `playback`; an image and a tile set item leave it out and report
  it as any field they do not read. `parse()` refuses an item whose `playback` is no object, or one
  whose values are not all `'loop'`, `'once'` or `'pingpong'`, naming the tag — the item builds no
  resource, as for any field of the wrong type.
- **Resource.** `AtlasTextureResource#playback` is the input it lands in, compared by content: the
  same catalog parsed again keeps the atlas. A change reads the json again. An image and a tile set
  resource refuse the write, as they refuse every input of another shape.
- **Adapter.** The resource hands `{playback}` to its adapter as the third argument. The built-in
  `asepriteAtlasAdapter` passes it to `AsepriteJson.parse()`, which plays a named tag with that
  playback and refuses a tag the sheet does not carry; `texturePackerAtlasAdapter` reads no
  animations and refuses a `playback` that names one. A refusal is the failure of the adapter: an
  `error` of `source: 'texture'`, and the atlas is not built.
- The entries of `frameBasedAnimations` of the item carry a `playback` of their own and are not
  touched by it.

The `platformer` keeps its sheets as they are — their one-shots carry Aseprite's "Repeat". The
refusal of `texturePackerAtlasAdapter` names the animations it got a playback for and points to the
entries of `frameBasedAnimations`, which carry their own.

Held by `TextureStore.spec.ts` (an Aseprite item with `playback`, the options of an item without
one, a tag the sheet lacks, the refusal of the TexturePacker adapter, a value refused at parse, the
field left out on an image and a tile set item, a parse of the same catalog keeping the atlas) and
`TextureResource.spec.ts` (the write refused on another shape, a change reading the json again, a
refused playback taking the atlas back, the getter after `dispose()`).

## 7. Left out

- A typed catalog — `TextureStore<Items>` that knows the adapter of each item: §4 says why the type
  cannot follow a choice made at run time.
- A sampler of its own per texture node, which would let one GPU texture serve both filters of §5:
  three.js binds the filter to the `Texture`, and a second `Texture` is what it offers.
- Wrap modes in `DynamicAtlas`: its frames are packed side by side, and a repeat would read the
  neighbour; `sampleAtlasFrame()` repeats a frame within its bounds.
