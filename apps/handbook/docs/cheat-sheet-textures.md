---
outline: deep
---

<img src="/images/twopoint5d-700x168.png" style="padding-bottom: 2rem" width="175" height="42" alt="twopoint5d">

# Textures API

## `TextureCoords`

### Constructors
- `new TextureCoords(x?, y?, w?, h?)`
- `new TextureCoords(parent, x?, y?, w?, h?)`

### Properties
- `x`, `y`
- `width`, `height`
- `s`, `t`, `s1`, `t1`
- `u`, `v`
- `flip`

### Methods
- `flipHorizontal()`
- `flipVertical()`
- `flipDiagonal()`

## `TextureAtlas`

A collection of named `TextureCoords` frames.

### Properties
- `size` number of frames

### Methods

#### Add Frames
- `add(coords, data?)`
- `add(name, coords, data?)`

#### Access Frames
- `get(id)`
- `frame(name)`
- `frameId(name)`
- `randomFrame()`
- `randomFrameId()`
- `randomFrameName()`
- `randomFrames(count)`
- `randomFrameIds(count)`
- `randomFrameNames(count)`

## `TileSet`

A grid-aligned `TextureAtlas` for tiles.

### Constructors 
- `new TileSet(atlas, baseCoords, options?)`
- `new TileSet(baseCoords, options?)`

### Properties
- `tileWidth`, `tileHeight`
- `margin`, `spacing`, `padding`
- `tileCount`
- `firstId`, `lastId`
- `firstFrameId`, `lastFrameId`

### Methods
- `frame(tileId)`
- `frameId(tileId)`
- `randomTileId()`
- `randomFrameId()`
- `randomFrame()`

## `TextureAtlasLoader`

Loads TexturePacker JSON atlases and images.

### Methods
- `load(url, classes, options, onLoad, onError?)`
- `loadAsync(url, classes?, options?)`

## `TextureStore`

The central asset vault for textures.

### Constructors
- `TextureStore.load(url)` &rarr; `Promise<TextureStore>`
- `new TextureStore.load(url)`

### Properties
- `renderer`

### Methods
- `load(data)`
- `parse(data)`
- `add(name, textureData)`
- `get(id, type, callback)`
- `has(name)`, `whenReady()`
- `whenReady()`
- `onResource(id, callback)`


## `TextureFactory`

Texture processing and quality control.

### Constructors
- `new TextureFactory(renderer | maxAnisotrophy, defaultClassNames?, defaultOptions?)`

### Methods
- `create(source, ...classNames)`
- `update(texture, ...classNames)`
- `load(url, ...classNames)`

## `FrameBasedAnimations`

Manages animation sequences and bakes them into DataTextures.

### Methods
- `add(name, duration, texCoords[])`
- `add(name, duration, atlas, frameNameQuery?)`
- `add(name, duration, tileSet, firstTileId?, tileCount?)`
- `add(name, duration, tileSet, tileIds[])`
- `bakeDataTexture(options?)`
- `animId(name)`

