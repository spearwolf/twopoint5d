# Textures: texture classes

Pixel art wants `nearest`, a painted backdrop `linear` and anisotropy, a tiling floor a repeat, a
mesh of three.js `flipy`. A texture class is the name of such a setting. A `TextureFactory` applies
the classes it is given to every texture it builds, and a `TextureStore` catalog names them per
item, so the json that names an image also says how it is read. The atlases, tile sets and
animations built on top of these textures are in [the sprite guide](sprites.md).

## The classes

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

`s` runs along the width of the image, `t` along its height, as three.js names them. Every atlas of
the library is read with `flipY = false`: a texture out of a store for a `FeatureSprites` leaves
`flipy` out, a texture for a mesh of three.js names it. `anisotrophy`, `anisotrophy-2`,
`anisotrophy-4` and `no-anisotrophy` are deprecated spellings of the anisotropy classes.

A wrap reads beyond the edge of the whole image. It is for an image of its own — a floor, a wall,
the band of a backdrop; a frame of an atlas repeats within its bounds through
`sampleAtlasFrame()`, see [the sprite guide](sprites.md#atlas-frames-on-meshes-of-ones-own).

**Which class wins.** Two classes that write the same option meet by breadth: a class that writes
two options yields to one that writes one of them, whoever named them first — `mag-linear` beats
`linear`, `clamp-t` beats `repeat` along `t`. Between two classes of the same breadth, the one named
last wins.

**What is left alone.** An option that no class names keeps the value of the texture: `update()`
without a wrap class leaves `wrapS` and `wrapT` as they are, and a new texture keeps the
`ClampToEdgeWrapping` of three.js.

## In a factory

`new TextureFactory(maxAnisotropyOrRenderer, defaultClassNames, defaultOptions)` applies
`defaultClassNames` — `['nearest']` without them — before the classes of each call. The maximum
anisotropy is the number given, or what the renderer names at the moment a texture is built; a
WebGL backend names none before `init()`, and a texture built then gets no anisotropic filtering.
`create(source, ...classes)` builds a texture of an image, `update(texture, ...classes)` applies the
classes to one there is, `load(url, ...classes)` and `loadAsync(url, classes)` load one. A name that
is no texture class is skipped; `isTextureOptionClass(name)` tells the two apart.

```ts check
import {TextureFactory} from '@spearwolf/twopoint5d';
import type {WebGPURenderer} from 'three/webgpu';

declare const renderer: WebGPURenderer;

const factory = new TextureFactory(renderer, ['nearest', 'srgb']);

// a floor for a mesh of three.js, tiled along both axes
export const floor = factory.loadAsync('floor.png', ['flipy', 'repeat', 'anisotropy']);
```

## In a catalog

A `TextureStore` lines the classes of an item up behind its `defaultTextureClasses`; both are
lists of class names in the json. A name no factory knows is left out and reported as an `error`
of the store, and the item is built with the names that are left.

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

The classes of an item come behind the defaults, so an item overrules a default of the same
breadth; a narrower default keeps the last word against a broader class of an item — a
`mag-linear` default stands, even when the item asks for `nearest`.
