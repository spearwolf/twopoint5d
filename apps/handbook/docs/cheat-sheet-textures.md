---
outline: deep
---

<img src="/images/twopoint5d-700x168.png" style="padding-bottom: 2rem" width="175" height="42" alt="twopoint5d">

# Textures API

## `TextureCoords`
Represents a rectangular region within a texture, defined by its position (x, y) and dimensions (width, height). It can also have a parent `TextureCoords` for hierarchical definitions, and supports flipping.

### Constructors
- `new TextureCoords(x?: number, y?: number, w?: number, h?: number)`
  - Creates a new `TextureCoords` instance with optional position and dimension.
- `new TextureCoords(parent: TextureCoords, x?: number, y?: number, w?: number, h?: number)`
  - Creates a new `TextureCoords` instance as a child of a `parent` `TextureCoords`, with optional relative position and dimension.

### Properties
- `x`: The x-coordinate of the top-left corner of the texture region.
- `y`: The y-coordinate of the top-left corner of the texture region.
- `width`: The width of the texture region.
- `height`: The height of the texture region.
- `flip`: A bitmask indicating the flip state (horizontal, vertical, diagonal).
- `parent?`: The parent `TextureCoords` instance, if this is a sub-region.
- `root`: The root `TextureCoords` in a hierarchical chain.
- `flipH`: Boolean indicating if the texture is flipped horizontally.
- `flipV`: Boolean indicating if the texture is flipped vertically.
- `flipD`: Boolean indicating if the texture is flipped diagonally.
- `s`: The normalized U-coordinate (0-1) of the top-left corner, considering flips.
- `t`: The normalized V-coordinate (0-1) of the top-left corner, considering flips.
- `s1`: The normalized U-coordinate (0-1) of the bottom-right corner, considering flips.
- `t1`: The normalized V-coordinate (0-1) of the bottom-right corner, considering flips.
- `u`: The normalized width (s1 - s) of the texture region.
- `v`: The normalized height (t1 - t) of the texture region.

### Methods
- `clone(): TextureCoords`
  - Creates a new `TextureCoords` instance with the same properties as the current one.
- `flipHorizontal(): TextureCoords`
  - Toggles the horizontal flip state and returns the instance.
- `flipVertical(): TextureCoords`
  - Toggles the vertical flip state and returns the instance.
- `flipDiagonal(): TextureCoords`
  - Toggles the diagonal flip state and returns the instance.

## `TextureAtlas`
A collection of named `TextureCoords` frames, typically representing a spritesheet.

### Properties
- `size`: The number of frames in the atlas.

### Methods

#### Add Frames
- `add(coords: TextureCoords, data?: Record<string, any>): number`
  - Adds a `TextureCoords` instance to the atlas and returns its frame ID.
- `add(name: string | symbol, coords: TextureCoords, data?: Record<string, any>): number`
  - Adds a named `TextureCoords` instance to the atlas and returns its frame ID.

#### Access Frames
- `get(id: number): TextureAtlasFrame | undefined`
  - Returns the `TextureAtlasFrame` for the given numeric ID.
- `frame(name: string | symbol): TextureAtlasFrame | undefined`
  - Returns the `TextureAtlasFrame` for the given name.
- `frameId(name: string | symbol): number | undefined`
  - Returns the numeric ID for the given frame name.
- `frameNames(match?: string | RegExp): (string | symbol)[]`
  - Returns an array of frame names. If `match` is provided, filters names by the given string or regular expression.
- `randomFrameId(): number`
  - Returns a random frame ID from the atlas.
- `randomFrame(): TextureAtlasFrame`
  - Returns a random `TextureAtlasFrame` from the atlas.
- `randomFrameName(): string | symbol`
  - Returns a random frame name from the atlas.
- `randomFrameIds(count: number): number[]`
  - Returns an array of `count` random frame IDs.
- `randomFrames(count: number): TextureAtlasFrame[]`
  - Returns an array of `count` random `TextureAtlasFrame` objects.
- `randomFrameNames(count: number): (string | symbol)[]`
  - Returns an array of `count` random frame names.

## `TileSet`
A grid-aligned `TextureAtlas` specifically designed for tiles, mapping tile IDs to texture frames.

### Constructors
- `new TileSet(atlas: TextureAtlas, baseCoords: TextureCoords, options?: TileSetOptions)`
  - Creates a `TileSet` using an existing `TextureAtlas` and base coordinates.
- `new TileSet(baseCoords: TextureCoords, options?: TileSetOptions)`
  - Creates a `TileSet` with new `TextureAtlas` and base coordinates.

### Properties
- `atlas`: The underlying `TextureAtlas` instance.
- `baseCoords`: The base `TextureCoords` from which tiles are derived.
- `options`: The options used to configure the `TileSet`.
- `tileWidth`: The width of each tile.
- `tileHeight`: The height of each tile.
- `margin`: The margin around the tiles in the spritesheet.
- `spacing`: The spacing between tiles in the spritesheet.
- `padding`: The padding within each tile.
- `tileCount`: The total number of tiles in the set.
- `firstId`: The `tileId` of the first tile (defaults to 1).
- `lastId`: The `tileId` of the last tile.
- `firstFrameId`: The `frameId` of the first tile in the underlying `TextureAtlas`.
- `lastFrameId`: The `frameId` of the last tile in the underlying `TextureAtlas`.

### Methods
- `frame(tileId: number): TextureAtlasFrame`
  - Returns the `TextureAtlasFrame` for the given `tileId`.
- `frameId(tileId: number): number`
  - Returns the `frameId` in the underlying `TextureAtlas` for the given `tileId`.
- `randomTileId(): number`
  - Returns a random `tileId` from the set.
- `randomFrameId(): number`
  - Returns a random `frameId` from the set.
- `randomFrame(): TextureAtlasFrame`
  - Returns a random `TextureAtlasFrame` from the set.

## `TextureAtlasLoader`
Loads TexturePacker JSON atlases and their corresponding image files.

### Constructors
- `new TextureAtlasLoader(defaults?: {fileLoader?: FileLoader; textureImageLoader?: TextureImageLoader})`
  - Creates a new `TextureAtlasLoader` instance with optional default loaders.

### Properties
- `fileLoader`: The `FileLoader` instance used for loading JSON data.
- `textureImageLoader`: The `TextureImageLoader` instance used for loading image data.

### Methods
- `load(url: string, textureClasses: Array<TextureOptionClasses> | undefined, options: TextureAtlasLoadOptions | undefined, onLoadCallback: (textureData: TextureAtlasData) => void, onErrorCallback?: (err: unknown) => void): void`
  - Loads a texture atlas from the given URL.
- `loadAsync(url: string, textureClasses?: Array<TextureOptionClasses>, options?: TextureAtlasLoadOptions): Promise<TextureAtlasData>`
  - Loads a texture atlas asynchronously from the given URL, returning a Promise.

## `TextureStore`
The central asset vault for textures, managing loading, parsing, and caching of texture resources.

### Static Methods
- `static load(url: string | URL): Promise<TextureStore>`
  - Asynchronously loads texture store data from a URL and returns a `TextureStore` instance.

### Properties
- `defaultTextureClasses`: An array of default texture option classes applied to loaded textures.
- `renderer`: The `DisplayRendererType` instance used for rendering.

### Methods
- `load(url: string | URL): this`
  - Loads texture store data from a URL.
- `parse(data: TextureStoreData): void`
  - Parses the provided `TextureStoreData` and populates the store.
- `onResource(id: string, callback: (resource: TextureResource) => void): () => void`
  - Registers a callback to be invoked when a specific texture resource is available. Returns an unsubscribe function.
- `whenReady(): Promise<TextureStore>`
  - Returns a Promise that resolves when all initial resources in the store are loaded and ready.
- `get(id: string, type: TextureResourceSubType | TextureResourceSubType[], callback: (val: any) => void): () => void`
  - Retrieves a texture resource by ID and type, invoking a callback when available. Returns an unsubscribe function.

## `TextureFactory`
Provides methods for creating and updating Three.js textures with various quality and processing options.

### Constructors
- `new TextureFactory(maxAnisotrophyOrRenderer?: DisplayRendererType | number, defaultClassNames?: Array<TextureOptionClasses>, defaultOptions?: Partial<TextureOptions>)`
  - Creates a new `TextureFactory` instance. `maxAnisotrophyOrRenderer` can be a renderer or a number for max anisotropry. `defaultClassNames` and `defaultOptions` set default texture properties.

### Properties
- `textureLoader`: The `TextureLoader` instance used for loading textures.

### Methods
- `getOptions(classNames: Array<TextureOptionClasses>): Partial<TextureOptions>`
  - Returns a combined `TextureOptions` object based on the provided class names and default options.
- `create(source: TextureSource, ...classNames: Array<TextureOptionClasses>): Texture`
  - Creates a new Three.js `Texture` from a source and applies the specified texture classes.
- `update(texture: Texture, ...classNames: Array<TextureOptionClasses>): Texture`
  - Updates an existing Three.js `Texture` with the specified texture classes.
- `load(url: string, ...classNames: Array<TextureOptionClasses>): Texture`
  - Loads a texture from a URL and applies the specified texture classes.

## `FrameBasedAnimations`
Manages animation sequences and bakes them into `DataTexture` instances for efficient GPU-based animation.

### Static Properties
- `static MaxTextureSize`: The maximum allowed size for the baked `DataTexture`.

### Properties
- No public properties.

### Methods
- `add(name: string | symbol | undefined, duration: number, texCoords: TextureCoords[]): number`
  - Adds an animation defined by an array of `TextureCoords` and a duration.
- `add(name: string | symbol | undefined, duration: number, atlas: TextureAtlas, frameNameQuery?: string): number`
  - Adds an animation using frames from a `TextureAtlas`, optionally filtered by a query.
- `add(name: string | symbol | undefined, duration: number, tileSet: TileSet, firstTileId?: number, tileCount?: number): number`
  - Adds an animation using a range of tiles from a `TileSet`.
- `add(name: string | symbol | undefined, duration: number, tileSet: TileSet, tileIds: number[]): number`
  - Adds an animation using specific tile IDs from a `TileSet`.
- `animId(name: string | symbol): number`
  - Returns the numeric ID for the given animation name.
- `bakeDataTexture(options?: BakeTextureOptions): DataTexture`
  - Bakes all added animations into a single `DataTexture` for GPU-efficient playback.