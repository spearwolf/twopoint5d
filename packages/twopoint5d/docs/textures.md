# Textures

How an image becomes a three.js `Texture`, and how a whole set of images, atlases and tile sets is
loaded, handed out, swapped and released. Two tools do the work:

| tool | what it is for |
| --- | --- |
| `TextureFactory` | one texture at a time: build it from an image, load it from a url, apply texture classes to it. What it builds is yours |
| `TextureStore` | a catalog of named resources — images, tile sets, texture atlases with their animations — loaded from json, shared, followed and released for you |

Both speak the same language for how a texture is read: **texture classes**, names such as
`nearest`, `srgb` or `repeat`. The sprites that draw these textures, their atlas frames and
animations are in [the sprite guide](sprites.md); which setup keeps pixel art crisp is in
[the display guide](display.md#pixel-art).

## Quick start

A catalog next to its images:

```json
{
  "defaultTextureClasses": ["nearest", "srgb"],
  "items": {
    "hero": {"atlasUrl": "hero.json"},
    "tiles": {"imageUrl": "tiles.png", "tileSet": {"tileWidth": 16, "tileHeight": 16}},
    "floor": {"imageUrl": "floor.png", "texture": ["flipy", "repeat", "anisotropy"]}
  }
}
```

A store loads it and hands out what each item builds:

```ts check
import {TextureStore} from '@spearwolf/twopoint5d';
import type {WebGPURenderer} from 'three/webgpu';

declare const renderer: WebGPURenderer;

const store = new TextureStore(renderer);
await store.loadAsync('/assets/textures.json');

const [heroAtlas, heroTexture] = await store.getAsync('hero', ['atlas', 'texture']);
const [tileSet, tilesTexture] = await store.getAsync('tiles', ['tileSet', 'texture']);
const floor = await store.getAsync('floor', 'texture');

// later, when the scene goes: every texture the store built is released with it
store.dispose();
```

The rest of this guide takes these steps apart.

## Texture classes

Pixel art wants `nearest`, a painted backdrop `linear` and anisotropy, a tiling floor a repeat, a
mesh of three.js `flipy`. A texture class is the name of such a setting. A `TextureFactory` applies
the classes it is given to every texture it builds, and a `TextureStore` catalog names them per
item, so the json that names an image also says how it is read.

| class | writes |
| --- | --- |
| `nearest`, `linear` | `magFilter` and `minFilter` |
| `mag-nearest`, `mag-linear` | `magFilter` |
| `min-nearest`, `min-linear` | `minFilter` |
| `anisotropy` | `anisotropy`, the maximum of the factory |
| `anisotropy-2`, `anisotropy-4` | `anisotropy`, 2 or 4, capped at the maximum of the factory |
| `no-anisotropy` | `anisotropy`, none |
| `flipy`, `no-flipy` | `flipY`, `true` or `false` |
| `srgb`, `linear-srgb` | `colorSpace`, `SRGBColorSpace` or `LinearSRGBColorSpace` |
| `repeat`, `mirror`, `clamp` | `wrapS` and `wrapT`: `RepeatWrapping`, `MirroredRepeatWrapping`, `ClampToEdgeWrapping` |
| `repeat-s`, `mirror-s`, `clamp-s` | `wrapS` alone |
| `repeat-t`, `mirror-t`, `clamp-t` | `wrapT` alone |

`s` runs along the width of the image, `t` along its height, as three.js names them.
`anisotrophy`, `anisotrophy-2`, `anisotrophy-4` and `no-anisotrophy` are deprecated spellings of
the anisotropy classes.

**Which classes a texture needs.**

- A color map — the image a sprite or a mesh shows — names `srgb`. Without a color-space class the
  texture keeps the `NoColorSpace` of three.js, and its colors come out too bright.
- Pixel art names `nearest`; a painted or photographed image `linear`. A floor seen at a grazing
  angle adds `anisotropy`.
- Every atlas of the library is read with `flipY = false`, which is also what every texture starts
  from: a texture for a `FeatureSprites` leaves `flipy` out, a texture for a mesh of three.js names
  it. With `flipY = true` every frame of an atlas is read from the wrong place, and nothing reports
  it.
- A wrap reads beyond the edge of the whole image. It is for an image of its own — a floor, a wall,
  the band of a backdrop; a frame of an atlas repeats within its bounds through
  `sampleAtlasFrame()`, see [the sprite guide](sprites.md#atlas-frames-on-meshes-of-ones-own).

**Which class wins.** Two classes that write the same option meet by breadth: a class that writes
two options yields to one that writes one of them, whoever named them first — `mag-linear` beats
`linear`, `clamp-t` beats `repeat` along `t`. Between two classes of the same breadth, the one named
last wins.

**What is left alone.** An option that no class names keeps the value of the texture: `update()`
without a wrap class leaves `wrapS` and `wrapT` as they are, and a new texture keeps the
`ClampToEdgeWrapping` of three.js.

**Names out of json.** A name that is no texture class is skipped wherever classes are applied;
`isTextureOptionClass(name)` tells the two apart. A `TextureStore` reports such a name as well —
see [errors](#errors).

## `TextureFactory`: one texture at a time

`new TextureFactory(maxAnisotropyOrRenderer, defaultClassNames, defaultOptions)` builds textures
and applies texture classes to them.

- `maxAnisotropyOrRenderer` is the anisotropy maximum, or the renderer that names it. A renderer is
  asked at the moment each texture is built; a WebGL backend names none before `init()`, and a
  texture built then gets no anisotropic filtering. Without it the maximum is 0: no anisotropy.
- `defaultClassNames` are applied before the classes of each call — `['nearest']` without them.
- `defaultOptions` are raw `TextureOptions` laid under the classes, for the rare option no class
  names.

| method | what it does |
| --- | --- |
| `create(source, ...classes)` | a new texture of an image, a canvas or a video |
| `update(texture, ...classes)` | applies the classes to a texture there is, and returns it |
| `loadAsync(url, classes?)` | loads the image; the promise resolves with the texture, or rejects |
| `load(url, ...classes)`, `load(url, {onError}, ...classes)` | hands back an empty texture at once, which fills itself in once the image is there; a failure only reaches `onError` |
| `getOptions(classes)` | the `TextureOptions` the classes add up to, without building anything |

```ts check
import {TextureFactory} from '@spearwolf/twopoint5d';
import type {WebGPURenderer} from 'three/webgpu';

declare const renderer: WebGPURenderer;
declare const canvas: HTMLCanvasElement;

const factory = new TextureFactory(renderer, ['nearest', 'srgb']);

// a floor for a mesh of three.js, tiled along both axes
export const floor = await factory.loadAsync('floor.png', ['flipy', 'repeat', 'anisotropy']);

// a canvas drawn by hand, read smoothly
export const label = factory.create(canvas, 'linear');
```

**What it builds is yours.** The factory keeps no reference to a texture it built: whoever called
`create()`, `load()` or `loadAsync()` disposes the texture once it is no longer drawn. A factory
has no `dispose()` of its own.

## `TextureStore`: a catalog of resources

A `TextureStore` reads a catalog — the type is `TextureStoreData` — and builds one **resource** per
item. A resource loads its image, turns it into a texture with the texture classes of its item and
builds whatever its type brings with it: a tile set, an atlas, animations. What the store adds over
a factory:

- every image is fetched once, however many items name it;
- the textures belong to the store, and `dispose()` releases them all;
- the values can be followed: a new renderer, other texture classes, another image or a catalog
  parsed again reach a subscriber as fresh values;
- the store works without a renderer — it loads images and builds coordinates, atlases, tile sets
  and animations, and only the textures wait for one;
- a resource loads on demand: loading the catalog fetches no image and no atlas json, the first
  `getAsync()`, `acquireAsync()` or `on()` of an id does — see [preloading](#preloading).

### The catalog

```ts
interface TextureStoreData {
  defaultTextureClasses?: TextureOptionClasses[]; // the classes every item starts from
  items: Record<string, TextureResourceData>; // the items by id
}
```

The id of an item is the name the store hands its values out under. The **type** of the resource an
item builds is the first of these it names:

| the item names | it builds | `resource.type` |
| --- | --- | --- |
| `tileSet` | a tile set — an image cut into tiles | `'tileset'` |
| `atlasUrl` | a texture atlas — a json of frames and the image it names | `'atlas'` |
| `imageUrl` | an image | `'image'` |

An item that names none of them builds nothing and is reported. Each type reads its own fields:

| field | image | tile set | atlas | what it is |
| --- | :-: | :-: | :-: | --- |
| `imageUrl` | ✓ | ✓ | | the image to load |
| `tileSet` | | ✓ | | the layout of the tiles, `TileSetOptions` |
| `atlasUrl` | | | ✓ | the atlas json |
| `overrideImageUrl` | | | ✓ | an image in place of the one the json names |
| `atlasAdapter` | | | ✓ | the reader of the json, by name |
| `playback` | | | ✓ | the playback of animations the json carries, by name |
| `frameBasedAnimations` | | ✓ | ✓ | animations of one's own, by name |
| `texture` | ✓ | ✓ | ✓ | the texture classes of this item |

A field the type of its item does not read — an `imageUrl` beside an `atlasUrl`, an `atlasAdapter`
on a tile set — is left out and reported; the item is built without it.

**Image items** are the plain case: an image, its texture and `imageCoords`, the coordinates of
the whole image.

```json
{"items": {"backdrop": {"imageUrl": "backdrop.webp", "texture": ["linear", "srgb"]}}}
```

**Tile set items** cut their image into a grid. The options of `tileSet` are those of `TileSet`:

| option | default | what it is |
| --- | --- | --- |
| `tileWidth`, `tileHeight` | the size of the image | the size of one tile |
| `margin` | 0 | the space around the whole grid |
| `spacing` | 0 | the space between two neighbouring tiles |
| `padding` | 0 | the space around each tile inside its cell |
| `tileCount` | as many as fit | how many tiles the set holds |
| `firstId` | 1 | the id of the first tile |

The tile ids run row by row from the top left, starting at `firstId`. A tile set item builds a `tileSet`, the `atlas` of its
tiles, the texture and — with `frameBasedAnimations` — animations over its tiles, each named by
`tileIds` or by a range of `firstTileId` and `tileCount`:

```json
{
  "items": {
    "walker": {
      "imageUrl": "walker-sheet.png",
      "tileSet": {"tileWidth": 64, "tileHeight": 64, "margin": 1, "spacing": 2},
      "texture": ["nearest", "srgb"],
      "frameBasedAnimations": {
        "walk": {"firstTileId": 1, "tileCount": 8, "frameRate": 12},
        "blink": {"tileIds": [9, 10, 9], "durations": [0.1, 0.05, 0.1], "playback": "once"}
      }
    }
  }
}
```

**Atlas items** read a json of frames — TexturePacker, free-tex-packer or Aseprite — and load the
image its `meta.image` names, resolved next to the json. `overrideImageUrl` loads another image in
its place, say a recoloured copy of the same layout. An atlas item builds the `atlas`, the texture
and animations: the ones the json carries — the frame tags of an Aseprite sheet — and the entries of
`frameBasedAnimations`, which name their frames by `frameNameQuery`, a regular expression run
against every frame name:

```json
{
  "items": {
    "sparks": {
      "atlasUrl": "sparks.json",
      "texture": ["linear", "srgb"],
      "frameBasedAnimations": {"flicker": {"frameNameQuery": "^spark-", "frameRate": 24}}
    },
    "fighter": {"atlasUrl": "fighter.json", "playback": {"kick": "once"}}
  }
}
```

Which reader an atlas gets, what `playback` does to an Aseprite tag and how the frames of an atlas
reach a sprite is in [the sprite guide](sprites.md#aseprite-sheets);
[readers of one's own](#atlas-adapters-of-ones-own) are below.

**Timing of an animation.** Each entry of `frameBasedAnimations` gives exactly one of `duration`
(seconds for the whole animation), `frameRate` (frames per second) and `durations` (seconds per
frame), and optionally a `playback`: `'loop'` — the default —, `'once'`, which holds the last
frame, or `'pingpong'`. An entry that cannot be built — no timing, two timings, a query that matches
no frame — is skipped and reported; the other entries are built all the same.

A `frameNameQuery` is compiled into a `RegExp`. A pattern that backtracks catastrophically stalls
the page: take a catalog only from a source you trust.

### Texture classes in a catalog

The classes of an item line up behind the `defaultTextureClasses` of the catalog, so an item
overrules a default of the same breadth; a narrower default keeps the last word against a broader
class of an item — a `mag-linear` default stands, even when the item asks for `nearest`.

**A store starts from no texture class.** A `TextureFactory` of your own starts from `nearest`, the
factory of a store from nothing: an item without classes gets the filters of three.js — `linear`,
with mipmaps — and no color space. Name the defaults in the catalog:

```ts check
import {TextureStore, type TextureStoreData} from '@spearwolf/twopoint5d';

const catalog: TextureStoreData = {
  defaultTextureClasses: ['nearest', 'srgb'],
  items: {
    hero: {atlasUrl: 'hero.json'},
    ground: {imageUrl: 'ground.png', texture: ['flipy', 'repeat-s']},
  },
};

const store = new TextureStore();
store.parse(catalog);

export const ground = store.getAsync('ground', 'texture');
```

`store.defaultTextureClasses` is the same list as a property. A catalog that names
`defaultTextureClasses` replaces it as it is parsed — but only while a known class is left in the
list: `"defaultTextureClasses": []`, or a list of nothing but typos, keeps the defaults of the
`parse()` before. A catalog cannot take the defaults away; to drop them, assign
`store.defaultTextureClasses = []` before the `parse()` or `loadAsync()` that should build without
them. An assignment of your own reaches an item with the next `parse()` that names it, and a
resource no later `parse()` names keeps the classes it was built with.

```ts check
import type {TextureStore, TextureStoreData} from '@spearwolf/twopoint5d';

declare const store: TextureStore;
declare const catalog: TextureStoreData; // names no defaults, or an empty list

store.defaultTextureClasses = []; // the defaults of the catalog before do not carry over
store.parse(catalog);
```

### Loading a catalog

Three ways bring a catalog into a store:

| call | fetches | rejects on |
| --- | --- | --- |
| `TextureStore.loadAsync(url, options?)` — static | the json at `url`, into a new store without a renderer | every reported failure, an item that builds nothing and an unknown texture class among them |
| `store.loadAsync(url, options?)` | the json at `url`, into this store | a failed fetch, a status, a body that is no json, data `parse()` throws for |
| `store.parse(data, options?)` | nothing — the data is at hand | throws for data it cannot read at all |

The static form is the strict one: nobody can listen to the `error` event of a store before it is
handed out, so every problem of the catalog rejects the promise, and the store built for the attempt
is disposed. The instance form leaves the problems of single items to the [`error`
event](#errors) and builds the rest.

```ts check
import {TextureStore} from '@spearwolf/twopoint5d';
import type {WebGPURenderer} from 'three/webgpu';

declare const renderer: WebGPURenderer;

// strict: a typo in the catalog fails here, and not at the first getAsync()
const store = await TextureStore.loadAsync('/assets/textures.json');
store.renderer = renderer;
```

**Relative urls.** `loadAsync()` resolves the relative `imageUrl`, `atlasUrl` and `overrideImageUrl`
of the items against the url of the catalog, so a catalog names the files next to it. `parse()`
takes the same base as `options.baseUrl`; without it the urls stay as written and the browser
resolves them against the document. An absolute url stays exactly as written.

```ts check
import {TextureStore, type TextureStoreData} from '@spearwolf/twopoint5d';

declare const catalog: TextureStoreData; // bundled with the code

const store = new TextureStore();
store.parse(catalog, {baseUrl: new URL('/assets/platformer/', location.href)});
```

**Cutting a load short.** `options.signal` aborts a `loadAsync()`: the fetch stops, nothing is
parsed, and the promise rejects with an `AbortError`. A second `loadAsync()` on the same store does
the same to a first one that is still fetching, so the catalogs are parsed in the order of the
calls. Once the parse has begun the load is done, and an abort changes nothing.

### The renderer

`new TextureStore(renderer)` or `store.renderer = renderer` gives the store the renderer it builds
its textures for. Without one, the store loads its images and builds everything but the textures;
a `getAsync(id, 'texture')` waits until a renderer is set.

### Preloading

Loading the catalog and loading the resources are two steps. `loadAsync()` and `parse()` read the
catalog and set the resources up, but a resource fetches nothing until it is asked for: the first
`getAsync()`, `acquireAsync()` or `on()` of its id starts its image — and for an atlas item its
json —, and the resource keeps loading and following its inputs from then on. Assigning the renderer
starts nothing either.

To have the images on their way while the renderer is still being set up, ask for a subtype that
needs no renderer — `imageCoords`, or the `atlas` of an atlas item:

```ts check
import {TextureStore} from '@spearwolf/twopoint5d';
import {WebGPURenderer} from 'three/webgpu';

const store = await TextureStore.loadAsync('/assets/textures.json');

// starts every image and atlas json now, before there is a renderer
const preloading = Promise.all(['hero', 'tiles', 'floor'].map((id) => store.getAsync(id, 'imageCoords')));

const renderer = new WebGPURenderer();
await renderer.init();

store.renderer = renderer;
await preloading;

// the images are there; what is left is building the textures
export const floor = await store.getAsync('floor', 'texture');
```

A `whenResource(id)` hands out the resource without starting it; `resource.activate()` starts it
by hand.

A new renderer makes every resource build its texture anew and release the old one. The renderer
stays yours: the store never disposes it.

### Getting values out

Each resource offers its values under five **subtypes**:

| subtype | value | image | tile set | atlas |
| --- | --- | :-: | :-: | :-: |
| `'imageCoords'` | `TextureCoords` of the whole image | ✓ | ✓ | ✓ |
| `'texture'` | `Texture` | ✓ | ✓ | ✓ |
| `'tileSet'` | `TileSet` | | ✓ | |
| `'atlas'` | `TextureAtlas` | | ✓ — the frames of its tiles | ✓ |
| `'frameBasedAnimations'` | `FrameBasedAnimations` | | ✓ | ✓ |

`TextureResourceSubtypes` carries the same names as constants, `TextureResourceSubtypes.Texture`
for `'texture'`. Animations arrive only for an item that carries animation data or an atlas whose
json brings tags.

**Once: `getAsync()`.** One subtype resolves with its value, a list with a tuple of values in the
order asked for, all from the same image:

```ts check
import {
  AtlasFrame,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  TextureColor,
} from '@spearwolf/twopoint5d';
import type {TextureStore} from '@spearwolf/twopoint5d';

declare const store: TextureStore;

const [atlas, colorMap] = await store.getAsync('hero', ['atlas', 'texture']);

const HeroKind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor]});
export const heroes = new FeatureSprites(HeroKind, {capacity: 64, textures: {colorMap}});

export const idle = atlas.frame('hero-idle-0');
```

`getAsync()` waits for the first `parse()` if there was none yet; it rejects instead of waiting
forever when the answer is clear:

- the store has parsed and knows no such id — the error names the id, and for an item the store
  refused, why;
- the resource never builds the subtype — the `atlas` of an image item, the `tileSet` of an atlas,
  the animations of an item without animation data;
- a step the value needs failed: an image that does not load, an atlas json that cannot be fetched
  or read, tile set options `TileSet` refuses — the error names the step and the url and carries
  the original as its `cause`;
- `options.signal` aborts, the store is disposed, or the resource is.

**Following: `on()`.** `store.on(id, subtypes, callback)` calls the callback with the current
values and again whenever they change — a new renderer, other texture classes, another image, a
catalog parsed again. It returns the function that ends the subscription. This is the way to keep a
material up to date:

```ts check
import {
  defineSprite,
  FeatureSpritesMaterial,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  TextureColor,
} from '@spearwolf/twopoint5d';
import type {TextureStore} from '@spearwolf/twopoint5d';

declare const store: TextureStore;

const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, TextureColor]});
const material = new FeatureSpritesMaterial(kind);

const unsubscribe = store.on('backdrop', 'texture', (texture) => {
  material.setTexture('colorMap', texture);
});

// when the material goes
export function disposeBackdrop() {
  unsubscribe();
  material.dispose();
}
```

For a list of subtypes the callback is called once per complete tuple, never with a half-updated
one, and never with `undefined`. A subtype the type of the resource never builds is reported once on
the console. `on()` does not give up on an id it does not find: it waits for a `parse()` that brings
it.

**The resources themselves.** `whenReady()` resolves once the store has parsed for the first time,
`whenResource(id)` with the resource of an id, and `onResource(id, callback)` calls back with it
once. A resource is a `TextureResource`; its `type` narrows it to `ImageTextureResource`,
`TileSetTextureResource` or `AtlasTextureResource`, and every value of the table above is a getter
of the same name on it — `undefined` while it is not there yet.

### Who owns the texture

**The store owns every texture it builds; you borrow it.** A resource disposes its texture when it
builds a successor — after a new renderer, other texture classes, another image — when its image
url is cleared, and when the resource or the store is disposed. Never call `dispose()` on a texture
out of a store.

What a resource holds counts in its `refCount`: every live `on()` subscription and every lease of
`acquireAsync()`. Two calls release the resources nobody holds:

- `store.clearUnused()` disposes and removes every resource with a `refCount` of 0 and answers how
  many it removed;
- `store.parse(data, {evictMissing: true})` does the same for the resources the new catalog no
  longer names.

A value out of `getAsync()` counts for nothing here: its promise lets go as it settles, so a texture
sitting in a material can be released under it. Hold it with **`acquireAsync()`**, which resolves
with a lease:

```ts check
import type {TextureStore} from '@spearwolf/twopoint5d';

declare const store: TextureStore;

const lease = await store.acquireAsync('hero', ['atlas', 'texture']);
const [atlas, texture] = lease.value;

store.clearUnused(); // leaves "hero" standing

// once the sprites that draw it are gone
lease.release();
```

A lease holds the resource, not the one texture: a new renderer or other texture classes still
make the resource build a new texture and release the old one. Whoever needs to follow that
subscribes with `on()`, which holds the resource as well.

### Reloading and swapping

`parse()` and `loadAsync()` can be called as often as needed. An id the store knows is updated in
place: a new `imageUrl` loads the new image, new texture classes build a new texture, new animation
data new animations — and every `on()` of the id hears the new values. Values that did not change
build nothing anew; the same catalog parsed twice changes nothing.

An item cannot change its type: a catalog that turns an image item into an atlas item is refused
whole with a `TypeError`, before anything is written. A resource whose item is missing from a later
catalog stays, unless `evictMissing` releases it.

A resource can also be written to directly, through the setters of its shape. A tile set item
without an `imageUrl` is built as a placeholder for exactly this:

```ts check
import {TextureStore} from '@spearwolf/twopoint5d';

const store = new TextureStore();
store.parse({items: {level: {tileSet: {tileWidth: 32, tileHeight: 32}}}}); // reported, built all the same

const level = await store.whenResource('level');
if (level.type === 'tileset') {
  level.imageUrl = '/levels/forest-tiles.png'; // a getAsync('level', 'tileSet') waits until here
}
```

An `AtlasTextureResource` takes `atlasUrl`, `overrideImageUrl`, `atlasAdapter`, `playback`,
`frameBasedAnimationsData` and `atlasJson` — a json already at hand, in place of a fetch. Its
`imageUrl` is read-only: it comes from the json. Every shape takes `textureClasses`. TypeScript
refuses a setter of another shape, and in JavaScript it throws.

A resource disposed directly leaves its store: the next `parse()` that names its id builds a new
one, and `on()` follows it.

### Errors

A store reports what goes wrong as an `error` event, with a `TextureStoreErrorEvent`:

| `source` | carries | when |
| --- | --- | --- |
| `'fetch'` | `url`, `status?`, `error` | the catalog could not be fetched, or the server answered with a status |
| `'parse'` | `url?`, `id?`, `error` | the body is no json; the data cannot be read; an item builds nothing; a field the type of an item does not read; a texture class no factory knows; a tile set item without an `imageUrl`; a subscriber that throws |

An event with an `id` belongs to that item, one without to the catalog as a whole.

Two kinds of failure are to be told apart:

- **The catalog is not read.** A failed fetch, a status, a body that is no json — and data
  `parse()` refuses whole: no object, an `items` that is no object, a `defaultTextureClasses` that
  is no array, an item whose type differs from the resource that already carries its id. Nothing is
  written then. `loadAsync()` rejects, besides the event, and `parse()` throws a `TypeError` and
  emits nothing: these still need a `catch`.
- **An item is read in part, or not at all.** An item that cannot be read builds nothing — a
  resource that already carries its id stays as it was —, an unknown class or field is left out, a
  subscriber that throws is reported. These are events only: the rest of the catalog is built, and
  the instance `loadAsync()` resolves. The static `TextureStore.loadAsync()` rejects on them as well.

```ts check
import {on} from '@spearwolf/eventize';
import {TextureStore, TextureStoreEvents, type TextureStoreErrorEvent} from '@spearwolf/twopoint5d';

const store = new TextureStore();

on(store, TextureStoreEvents.Error, (event: TextureStoreErrorEvent) => {
  const where = event.source === 'fetch' ? event.url : (event.id ?? event.url ?? 'the catalog');
  console.error(`textures: ${event.source} failed at ${String(where)}`, event.error);
});

await store.loadAsync('/assets/textures.json');
```

**What fails inside a resource** — an image that does not load, an atlas json that cannot be read,
a tile set `TileSet` refuses, an animation entry that is skipped — is an `error` event of the
resource, a `TextureResourceErrorEvent` with the `source` `'image'`, `'atlas'`, `'texture'` or
`'frameBasedAnimations'`. A `getAsync()` that waits for a value such a failure holds back rejects
with it, so most code needs no listener of its own; for a log of everything, listen on the
resource:

```ts check
import {on} from '@spearwolf/eventize';
import {type TextureResourceErrorEvent, TextureResourceEvents, type TextureStore} from '@spearwolf/twopoint5d';

declare const store: TextureStore;

store.onResource('hero', (resource) => {
  on(resource, TextureResourceEvents.Error, (event: TextureResourceErrorEvent) => {
    console.error(`textures: "${resource.id}" failed at the ${event.source} step`, event.error);
  });
});
```

A failed step does not retry by itself. It runs again when what it reads changes — its url, its
options, the texture classes, the renderer —, through a `parse()` or a setter of the resource.

### Events of the store

`TextureStoreEvents` names them; subscribe with `on()` of `@spearwolf/eventize`.

| event | payload | when |
| --- | --- | --- |
| `ready` | the store | after every `parse()`, once its values are written; retained, so a late listener hears the last one |
| `rendererChanged` | the renderer or `undefined` | whenever `renderer` is set; retained |
| `resource:<id>` | the resource | with every `parse()` that names the id |
| `error` | `TextureStoreErrorEvent` | see [errors](#errors) |
| `dispose` | — | once, as `dispose()` begins |

### Atlas adapters of one's own

An atlas item is read by an **atlas adapter**: the one its `atlasAdapter` names, otherwise the one
whose `app` matches `meta.app` of the json, otherwise `'texturepacker'`. Every store knows
`'texturepacker'` — TexturePacker and free-tex-packer, frames and no animations — and `'aseprite'`
— frames and frame tags as animations. A packer of another kind gets an adapter of its own, a
function `(json, parentCoords, options?) => {atlas, animations?}`, registered before the catalog
that names it is parsed:

```ts check
import {TextureStore, texturePackerAtlasAdapter} from '@spearwolf/twopoint5d';

const store = new TextureStore();

// a packer that writes the TexturePacker envelope, under a name of its own
store.registerAtlasAdapter('my-packer', (json, parentCoords) => texturePackerAtlasAdapter(json, parentCoords), {
  app: /my-packer/i,
});

store.parse({items: {props: {atlasUrl: 'props.json'}}}); // picked by meta.app
```

The resource reads `meta.image` and `meta.size` before any adapter runs, so the json of an adapter
of one's own keeps the envelope the three packers share — `frames`, `meta.size`, `meta.image`; a
format of another shape is converted to it first. An item that names an adapter the store does not
know builds nothing and is reported.

### Disposing the store

`store.dispose()` disposes every resource and with it every texture the store built, rejects every
promise still waiting, aborts a catalog fetch still under way and leaves the renderer alone. What
you built out of the store's values yourself stays yours: a texture baked with
`FrameBasedAnimations#bakeDataTexture()`, a material, a geometry. After `dispose()` the store does
nothing any more; a second call does no harm.

## A resource on its own

A `TextureResource` works without a store, for the one texture that is no catalog's business. Build
it with `TextureResource.fromImage()`, `fromTileSet()` or `fromAtlas()`, give it a renderer,
`activate()` it, and read its values off the events of the same name:

```ts check
import {on} from '@spearwolf/eventize';
import {TextureResource} from '@spearwolf/twopoint5d';
import type {Texture, WebGPURenderer} from 'three/webgpu';

declare const renderer: WebGPURenderer;

const resource = TextureResource.fromImage('portrait', '/images/portrait.webp', ['linear', 'srgb']);
resource.renderer = renderer;
resource.activate();

on(resource, 'texture', (texture: Texture) => {
  // the first texture, and every one after it
});

// once the texture is no longer drawn: the resource owns it, and releases it here
export function disposePortrait() {
  resource.dispose();
}
```

The texture arrives later, once the image has loaded; a `dispose()` before that cancels the load,
and no texture is ever built.

The events are retained: a listener that comes late still hears the current value. Without a store
there is no image cache, no `getAsync()` and no `refCount` to hold it by — `dispose()` is up to you.

## Deprecated names

| deprecated | use |
| --- | --- |
| `TextureStore.load(url)`, static | `TextureStore.loadAsync(url)` |
| `store.load(url)` | `store.loadAsync(url)`, which rejects when the load fails |
| `store.get(id, subtypes)` | `store.getAsync(id, subtypes)` |
| `resource.load()` | `resource.activate()` |
| `MapSubTypes`, `MapTuple` | `TextureResourceSubTypeMap['atlas']`, or a tuple of them |
| `TextureImageLoader`, `TileSetLoader`, `TextureAtlasLoader`, `PowerOf2ImageLoader` | a `TextureStore` |
| the classes `anisotrophy`, `anisotrophy-2`, `anisotrophy-4`, `no-anisotrophy` | `anisotropy`, `anisotropy-2`, `anisotropy-4`, `no-anisotropy` |

`TextureImageLoader`, `TileSetLoader` and `TextureAtlasLoader` differ from the store in what they
hand out: they pad an image whose sides are no powers of 2 onto a canvas whose sides are, start from
the texture class `nearest`, and give the texture to the caller to dispose. Moving to the store
means naming the classes in the catalog — `nearest` among them, where the loader gave it — and
leaving the disposal to the store.

`PowerOf2ImageLoader` builds no texture at all: it hands out the padded image and its
`TextureCoords`, `{imgEl, texCoords}`, and nothing of it needs disposing. In a store an image item
takes its place, with `getAsync(id, 'imageCoords')` for the coordinates — of the image as it is,
unpadded.
