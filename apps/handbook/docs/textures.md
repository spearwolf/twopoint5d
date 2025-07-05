---
outline: deep
---

# Textures and Atlases

In `twopoint5d`, efficient texture management is crucial for rendering a large number of sprites and other 2D elements. The library provides a set of classes to handle texture coordinates, texture atlases, tilesets, and frame-based animations, all designed to optimize GPU usage and simplify asset management.

## 1. `TextureCoords`

The `TextureCoords` class represents a rectangular region within a larger texture. It's fundamental for defining where a specific sprite or tile is located on a spritesheet or texture atlas. It also handles texture flipping.

```typescript
export class TextureCoords {
  x: number; // X-coordinate of the top-left corner
  y: number; // Y-coordinate of the top-left corner
  width: number; // Width of the region
  height: number; // Height of the region
  flip: number; // Bitmask for flipping (horizontal, vertical, diagonal)
  parent?: TextureCoords; // Optional parent for hierarchical texture coordinates

  // Static constants for flip flags
  static readonly FLIP_HORIZONTAL = 1;
  static readonly FLIP_VERTICAL = 2;
  static readonly FLIP_DIAGONAL = 4;

  // Getters for normalized UV coordinates (s, t, s1, t1)
  get s(): number; // Normalized U-coordinate of the top-left corner
  get t(): number; // Normalized V-coordinate of the top-left corner
  get s1(): number; // Normalized U-coordinate of the bottom-right corner
  get t1(): number; // Normalized V-coordinate of the bottom-right corner

  // Getters for UV width and height
  get u(): number;
  get v(): number;

  // Methods for flipping
  flipHorizontal(): TextureCoords;
  flipVertical(): TextureCoords;
  flipDiagonal(): TextureCoords;
}
```

**Usage Example:**

```typescript
import { TextureCoords } from '@twopoint5d/twopoint5d/texture';

// Define texture coordinates for a 128x128 sprite on a 512x512 texture
const fullTextureCoords = new TextureCoords(0, 0, 512, 512);
const spriteCoords = new TextureCoords(fullTextureCoords, 0, 0, 128, 128);

console.log(spriteCoords.s, spriteCoords.t); // Normalized UVs

spriteCoords.flipHorizontal();
console.log(spriteCoords.flipH); // true
```

## 2. `TextureAtlas`

A `TextureAtlas` (also known as a spritesheet) is a single large image that contains multiple smaller images (frames). This technique reduces the number of texture binds and draw calls, significantly improving rendering performance. The `TextureAtlas` class in `twopoint5d` manages these frames and provides methods to access them.

```typescript
export class TextureAtlas {
  add(coords: TextureCoords, data?: Record<string, any>): number; // Add a frame with TextureCoords
  add(name: string | symbol, coords: TextureCoords, data?: Record<string, any>): number; // Add a named frame

  get size(): number; // Number of frames in the atlas
  get(id: number): TextureAtlasFrame | undefined; // Get frame by ID
  frameId(name: string | symbol): number | undefined; // Get frame ID by name
  frame(name: string | symbol): TextureAtlasFrame | undefined; // Get frame by name

  randomFrameId(): number;
  randomFrame(): TextureAtlasFrame;
  randomFrameName(): string | symbol;
  randomFrameIds(count: number): number[];
  randomFrames(count: number): TextureAtlasFrame[];
  randomFrameNames(count: number): (string | symbol)[];
}

interface TextureAtlasFrame {
  coords: TextureCoords;
  data?: Record<string, any>;
}
```

**Concept of a Texture Atlas:**

Imagine you have 100 different small images (e.g., individual frames of an animation, different icons). Instead of loading and binding 100 separate textures to the GPU, you combine them into one large image. The `TextureAtlas` then stores the `TextureCoords` for each individual small image within this larger image. When rendering, you bind the single large texture once, and then for each sprite, you tell the shader which part of the large texture (using the `TextureCoords`) to display.

**Usage with `TexturedSprites` and `AnimatedSprites`:**

`TexturedSprites` and `AnimatedSprites` are designed to work seamlessly with `TextureAtlas`. When you create these sprite components, you typically provide them with a `TextureAtlas` instance. The sprites then use the `TextureCoords` from the atlas to render the correct frame.

**Example (from `apps/lookbook/src/demos/textured-sprites/TexturedSpritesDemo.ts` concept):**

```typescript
import { TextureAtlas, TextureCoords, TextureStore } from '@twopoint5d/twopoint5d/texture';
import { TexturedSprites } from '@twopoint5d/twopoint5d/sprites/TexturedSprites';
import { MeshBasicMaterial, Texture } from 'three';

async function createTexturedSprites() {
  // Assume 'ball-patterns.json' and 'ball-patterns.png' are loaded via TextureAtlasLoader
  const textureResource = await TextureStore.get('ball-patterns');
  const atlas = textureResource.atlas; // This is your TextureAtlas instance
  const texture = textureResource.texture; // This is your THREE.Texture

  const material = new MeshBasicMaterial({ map: texture, transparent: true });
  const sprites = new TexturedSprites(); // Internally creates InstancedVertexObjectGeometry

  // Add sprites using frames from the atlas
  for (let i = 0; i < 100; i++) {
    const sprite = sprites.create(); // Creates a new VO instance
    if (sprite) {
      const frame = atlas.randomFrame(); // Get a random frame from the atlas
      sprite.setFrame(frame.coords); // Set the texture coordinates for the sprite
      sprite.setPosition(Math.random() * 800 - 400, Math.random() * 600 - 300, 0);
      sprite.setSize(frame.coords.width, frame.coords.height);
    }
  }

  sprites.material = material;
  // Add sprites to your scene
  // scene.add(sprites);
}
```

## 3. `TileSet`

A `TileSet` is a specialized `TextureAtlas` optimized for grid-aligned tiles, typically used in tile-based maps. It simplifies the process of extracting `TextureCoords` for tiles of a uniform size from a spritesheet, often with defined margins, spacing, and padding.

```typescript
export interface TileSetOptions {
  tileWidth?: number;
  tileHeight?: number;
  margin?: number;
  spacing?: number;
  padding?: number;
  tileCount?: number; // Limit the number of tiles to generate
  firstId?: number; // The starting tile ID (defaults to 1)
}

export class TileSet {
  readonly atlas: TextureAtlas; // The underlying TextureAtlas
  readonly baseCoords: TextureCoords; // The base texture coordinates for the entire tileset image
  readonly options: TileSetOptions;

  tileCount: number; // Actual number of tiles generated
  firstFrameId: number; // The frame ID of the first tile in the atlas

  get tileWidth(): number;
  get tileHeight(): number;
  get firstId(): number; // The tile ID of the first tile (defaults to 1)
  get lastId(): number; // The tile ID of the last tile
  get lastFrameId(): number; // The frame ID of the last tile

  frameId(tileId: number): number; // Get frame ID for a given tile ID
  randomTileId(): number;
  randomFrameId(): number;
  frame(tileId: number): TextureAtlasFrame; // Get frame for a given tile ID
  randomFrame(): TextureAtlasFrame;
}
```

**What is a TileSet?**

Consider a game map composed of many small, square tiles (e.g., grass, water, road). These tiles are often arranged in a grid on a single image. A `TileSet` automates the calculation of `TextureCoords` for each tile based on its dimensions and any spacing/margin/padding. This makes it easy to retrieve the correct texture region for a tile given its ID.

**Example (from `apps/lookbook/src/demos/tiled-maps/Map2dLayerDemo.ts` concept):**

```typescript
import { TileSet, TextureCoords, TextureStore } from '@twopoint5d/twopoint5d/texture';
import { TileSprites } from '@twopoint5d/twopoint5d/sprites/TileSprites';
import { MeshBasicMaterial, Texture } from 'three';

async function createTileSprites() {
  const textureResource = await TextureStore.get('lab-walls-tiles'); // Load your tilesheet
  const texture = textureResource.texture;

  // Define the base coordinates for the entire tilesheet image
  const baseCoords = new TextureCoords(0, 0, texture.image.width, texture.image.height);

  // Create a TileSet from the base coordinates and options
  const tileSet = new TileSet(baseCoords, {
    tileWidth: 64,
    tileHeight: 64,
    margin: 1,
    spacing: 2,
  });

  const material = new MeshBasicMaterial({ map: texture, transparent: true });
  const tileSprites = new TileSprites(); // Internally uses InstancedVertexObjectGeometry

  // Example: Set a tile at a specific map position
  const tileVO = tileSprites.create();
  if (tileVO) {
    const tileId = 5; // Example tile ID
    const frame = tileSet.frame(tileId); // Get the TextureAtlasFrame for the tile ID
    tileVO.setFrame(frame.coords); // Apply the texture coordinates
    tileVO.setPosition(100, 100, 0); // Set world position
    tileVO.setSize(tileSet.tileWidth, tileSet.tileHeight);
  }

  tileSprites.material = material;
  // scene.add(tileSprites);
}
```

## 4. Loading Texture Atlas Definitions with `TextureAtlasLoader`

The `TextureAtlasLoader` is responsible for loading texture atlas definitions, typically in JSON format (e.g., from TexturePacker), and the associated image file. It then parses this data to create a `TextureAtlas` instance.

```typescript
import { TextureAtlasLoader, TextureStore } from '@twopoint5d/twopoint5d/texture';

async function loadAtlas() {
  const loader = new TextureAtlasLoader();

  try {
    const textureData = await loader.loadAsync('/assets/ball-patterns.json');
    const atlas = textureData.atlas;
    const texture = textureData.texture; // THREE.Texture

    // You can store this in TextureStore for global access
    TextureStore.add('ball-patterns', textureData);

    console.log('Atlas loaded:', atlas.size, 'frames');
  } catch (error) {
    console.error('Error loading atlas:', error);
  }
}

// In a real application, you'd typically use TextureStore.get() directly
// after initial loading, as it handles caching.
```

## 5. `FrameBasedAnimations`

The `FrameBasedAnimations` class helps manage sequences of `TextureCoords` that represent animation frames. It can bake these animation definitions into a `DataTexture` that can be sampled in a shader to drive frame-based animations on the GPU, further optimizing performance.

```typescript
import { FrameBasedAnimations, TextureAtlas, TileSet, TextureCoords } from '@twopoint5d/twopoint5d/texture';
import { DataTexture } from 'three';

async function setupAnimations() {
  // Assume you have a TextureAtlas or TileSet loaded
  const atlas = new TextureAtlas();
  atlas.add('frame1', new TextureCoords(0, 0, 32, 32));
  atlas.add('frame2', new TextureCoords(32, 0, 32, 32));
  atlas.add('frame3', new TextureCoords(64, 0, 32, 32));

  const animations = new FrameBasedAnimations();

  // Add an animation from a TextureAtlas
  animations.add('walk', 1000, atlas, 'frame'); // 'walk' animation, 1000ms duration, using frames starting with 'frame'

  // Add an animation from an array of TextureCoords
  const customFrames = [
    new TextureCoords(0, 0, 16, 16),
    new TextureCoords(16, 0, 16, 16),
  ];
  animations.add('blink', 500, customFrames);

  // Bake the animation data into a DataTexture
  const animDataTexture: DataTexture = animations.bakeDataTexture();

  // This DataTexture can then be passed as a uniform to your shader
  // and used to look up the correct UVs for animation frames.
}
```

**Usage with `AnimatedSprites`:**

`AnimatedSprites` uses `FrameBasedAnimations` internally. When you define animations for an `AnimatedSprite`, it leverages this class to manage the animation data and pass it to the shader. This allows for highly efficient, GPU-driven animations for many sprites.

**Example (from `apps/lookbook/src/demos/animated-sprites/AnimatedSpritesDemo.ts` concept):**

```typescript
import { AnimatedSprites } from '@twopoint5d/twopoint5d/sprites/AnimatedSprites';
import { FrameBasedAnimations, TextureStore } from '@twopoint5d/twopoint5d/texture';
import { MeshBasicMaterial } from 'three';

async function createAnimatedSprites() {
  const textureResource = await TextureStore.get('nobinger-anim-sheet');
  const texture = textureResource.texture;
  const atlas = textureResource.atlas;

  const animations = new FrameBasedAnimations();
  animations.add('idle', 200, atlas, 'nobinger-idle-'); // Define an animation from atlas frames
  animations.add('walk', 150, atlas, 'nobinger-walk-');

  const animDataTexture = animations.bakeDataTexture(); // Bake animation data

  const material = new MeshBasicMaterial({ map: texture, transparent: true });
  // You would typically pass animDataTexture as a uniform to a custom ShaderMaterial
  // material.uniforms.u_animDataTexture = { value: animDataTexture };

  const sprites = new AnimatedSprites();
  sprites.material = material;

  const animatedSprite = sprites.create();
  if (animatedSprite) {
    animatedSprite.play('idle', animations.animId('idle')); // Play the 'idle' animation
    animatedSprite.setPosition(0, 0, 0);
    animatedSprite.setSize(atlas.frame('nobinger-idle-0')!.coords.width, atlas.frame('nobinger-idle-0')!.coords.height);
  }

  // scene.add(sprites);
}
```

## 6. `TextureStore`

The `TextureStore` is a central, singleton service for loading, caching, and managing all texture-related resources in your `twopoint5d` application. It promotes a declarative approach to asset management, allowing you to define your textures, atlases, and tilesets in a JSON configuration file. This simplifies resource loading and ensures efficient reuse of textures across your application.

### Declarative Loading with `TextureStore`

Instead of manually loading each image or atlas using `TextureLoader` or `TextureAtlasLoader`, you can define all your texture assets in a single JSON file. The `TextureStore` can then parse this file and manage the loading process.

**JSON Configuration Format (`TextureStoreData`):**

The `TextureStore` expects a JSON file conforming to the `TextureStoreData` interface:

```typescript
export interface TextureStoreItem {
  imageUrl?: string; // URL for a single image texture
  overrideImageUrl?: string; // Optional: URL to override the image in an atlas JSON
  atlasUrl?: string; // URL for a TexturePacker JSON atlas definition
  tileSet?: TileSetOptions; // Options for creating a TileSet from an image
  texture?: TextureOptionClasses[]; // Array of TextureFactory option class names
}

export interface TextureStoreData {
  defaultTextureClasses: TextureOptionClasses[]; // Default texture options for all items
  items: Record<string, TextureStoreItem>; // A map of texture IDs to their definitions
}
```

-   **`defaultTextureClasses`**: An array of `TextureOptionClasses` (defined in `TextureFactory`) that will be applied to all textures loaded by the store, unless overridden by an individual `item`.
-   **`items`**: An object where each key is a unique ID for your texture resource, and the value is a `TextureStoreItem` object defining that resource.

A `TextureStoreItem` can define:
-   A single image (`imageUrl`).
-   A texture atlas (`atlasUrl`), optionally overriding the image URL specified within the atlas JSON (`overrideImageUrl`).
-   A tileset (`imageUrl` + `tileSet` options).
-   `texture` classes to apply specific `THREE.Texture` properties (e.g., filtering, anisotropy) using `TextureFactory`.

**Example JSON (`assets/textures.json` concept from Lookbook):**

```json
{
  "defaultTextureClasses": ["linear", "anisotrophy"],
  "items": {
    "ball-patterns": {
      "atlasUrl": "/assets/ball-patterns.json"
    },
    "nobinger-anim-sheet": {
      "atlasUrl": "/assets/nobinger-anim-sheet.json"
    },
    "lab-walls-tiles": {
      "imageUrl": "/assets/lab-walls-tiles.png",
      "tileSet": {
        "tileWidth": 64,
        "tileHeight": 64,
        "margin": 1,
        "spacing": 2
      },
      "texture": ["nearest"]
    },
    "background-image": {
      "imageUrl": "/assets/images/20221122-dark-circles-back-1024x.jpg",
      "texture": ["linear-srgb", "anisotrophy-4"]
    }
  }
}
```

### How to Use `TextureStore`

1.  **Load the Configuration:**
    Load your texture configuration JSON file using `TextureStore.load()`. This typically happens once at the start of your application.

    ```typescript
    import { TextureStore } from '@twopoint5d/twopoint5d/texture';
    import { WebGLRenderer } from 'three'; // Assuming you have a Three.js renderer

    const textureStore = new TextureStore();

    // Set the Three.js renderer for the TextureStore to configure textures correctly
    // This is important for properties like anisotropy which depend on renderer capabilities.
    textureStore.renderer = new WebGLRenderer(); // Replace with your actual renderer

    // Load your texture configuration
    await textureStore.load('/assets/textures.json');
    console.log('All textures defined in textures.json are now being loaded or are ready.');
    ```

2.  **Parse Additional Configurations:**
    The `parse` method can be called multiple times. If you call `parse` again with new or updated `TextureStoreItem` definitions for existing IDs, the `TextureStore` will **update** the existing resources with the new properties. It will **not** overwrite them entirely, as long as the `type` of the resource (image, atlas, tileset) remains consistent. If you try to change the type of an existing resource, it will throw an error. This allows for dynamic updates or loading of modular texture configurations.

    ```typescript
    // Later in your application, you might load another configuration
    textureStore.parse({
      defaultTextureClasses: [], // Can be empty if no new defaults
      items: {
        "new-sprite-sheet": {
          "atlasUrl": "/assets/new-sprite-sheet.json"
        },
        "ball-patterns": { // Update existing 'ball-patterns' resource
          "atlasUrl": "/assets/ball-patterns-v2.json", // Point to a new version of the atlas
          "texture": ["linear"] // Change texture filtering
        }
      }
    });
    console.log('TextureStore updated with new and modified resources.');
    ```

3.  **Retrieve Texture Resources with Callbacks:**
    The `TextureStore.get()` method is callback-based and designed for reactive updates. It takes an `id`, a `type` (or array of `types`), and a `callback` function. The callback is executed whenever the requested texture resource (or a specific sub-type of it, like `atlas` or `texture`) is loaded or changes. This allows your application to react to texture loading completion or updates dynamically.

    The `type` parameter specifies which part of the `TextureResource` you are interested in. It can be a single `TextureResourceSubType` string (`'imageCoords'`, `'atlas'`, `'tileSet'`, `'texture'`) or an array of these strings.

    -   If `type` is a single string, the callback receives the value of that specific sub-type.
    -   If `type` is an array of strings, the callback receives an array of values for the requested sub-types, in the order they were requested. The callback is only triggered when *all* requested sub-types are available.

    The `get` method returns an `unsubscribe` function, which you should call when you no longer need to listen for updates to prevent memory leaks.

    ```typescript
    import { TextureStore } from '@twopoint5d/twopoint5d/texture';
    import type { TextureAtlas, Texture } from 'three'; // Import relevant types

    // Assuming textureStore is already initialized and configurations loaded

    // Example 1: Get a single texture (THREE.Texture)
    const unsubscribeTexture = textureStore.get('background-image', 'texture', (texture: Texture) => {
      console.log('Background image texture loaded/updated:', texture);
      // Use the texture here, e.g., apply to a material
      // unsubscribeTexture(); // Unsubscribe if you only need it once
    });

    // Example 2: Get a TextureAtlas
    const unsubscribeAtlas = textureStore.get('ball-patterns', 'atlas', (atlas: TextureAtlas) => {
      console.log('Ball patterns atlas loaded/updated:', atlas);
      // Use the atlas to get frames for sprites
    });

    // Example 3: Get both atlas and texture for a resource
    const unsubscribeAtlasAndTexture = textureStore.get('nobinger-anim-sheet', ['atlas', 'texture'], ([atlas, texture]: [TextureAtlas, Texture]) => {
      console.log('Nobinger atlas and texture loaded/updated:', atlas, texture);
      // Both atlas and texture are available, proceed with creating animated sprites
      // unsubscribeAtlasAndTexture(); // Unsubscribe if only needed once
    });

    // Example 4: Getting a TileSet and its texture
    const unsubscribeTileSet = textureStore.get('lab-walls-tiles', ['tileSet', 'texture'], ([tileSet, texture]) => {
      console.log('Lab walls tileset and texture loaded/updated:', tileSet, texture);
      // Use tileSet and texture for tile-based rendering
    });

    // Remember to call unsubscribe() when the component or scene using these textures is destroyed
    // unsubscribeTexture();
    // unsubscribeAtlas();
    // unsubscribeAtlasAndTexture();
    // unsubscribeTileSet();
    ```

### `TextureFactory` and Texture Options

The `TextureStore` internally uses `TextureFactory` to apply various `THREE.Texture` properties based on the `TextureOptionClasses` specified in your JSON configuration. `TextureFactory` provides a convenient way to define common texture settings (like `nearest` or `linear` filtering, `anisotrophy`, `flipY`, `colorSpace`) as reusable classes.

When you specify `texture: ["nearest"]` in your `TextureStoreItem`, the `TextureFactory` ensures that the loaded `THREE.Texture` will have its `magFilter` and `minFilter` set to `NearestFilter`. Similarly, `["linear-srgb", "anisotrophy-4"]` would configure the texture for linear sRGB color space and 4x anisotropic filtering. This declarative approach centralizes texture configuration and reduces boilerplate code.

### Examples from Lookbook App

The Lookbook application extensively uses `TextureStore` to manage its assets. For instance, in demos like `TexturedSpritesDemo.ts`, `AnimatedSpritesDemo.ts`, and `Map2dLayerDemo.ts` (conceptually, as the actual files might be named differently or structured within `BouncingSprites.ts` files), you'll find patterns like:

```typescript
// In a demo setup function
import { TextureStore } from '@twopoint5d/twopoint5d/texture';

// ...
const textureResource = await TextureStore.get('some-texture-id');
const texture = textureResource.texture;
const atlas = textureResource.atlas; // If it's an atlas
const tileSet = textureResource.tileSet; // If it's a tileset
// ... then use 'texture', 'atlas', or 'tileSet' to create sprites or other elements.
```

This demonstrates the declarative nature: the demo code simply *requests* a texture resource by its ID, and the `TextureStore` handles the loading, parsing, and caching based on the JSON configuration.

## Cheat Sheet: Texture Domain API

Here's a quick reference to the main classes and methods in the `twopoint5d` texture domain:

### Classes

-   **`TextureCoords`**
    -   `constructor(x?, y?, width?, height?)`
    -   `constructor(parent, x?, y?, width?, height?)`
    -   `s`, `t`, `s1`, `t1`, `u`, `v` (getters for normalized UVs)
    -   `flipHorizontal()`, `flipVertical()`, `flipDiagonal()`

-   **`TextureAtlas`**
    -   `add(coords: TextureCoords, data?)`
    -   `add(name, coords: TextureCoords, data?)`
    -   `get(id: number)`
    -   `frame(name: string | symbol)`
    -   `randomFrame()`

-   **`TileSet`**
    -   `constructor(atlas: TextureAtlas, baseCoords: TextureCoords, options?: TileSetOptions)`
    -   `constructor(baseCoords: TextureCoords, options?: TileSetOptions)`
    -   `tileWidth`, `tileHeight`, `firstId`, `lastId`
    -   `frame(tileId: number)`
    -   `randomTileId()`, `randomFrameId()`

-   **`TextureAtlasLoader`**
    -   `load(url, textureClasses, options, onLoadCallback, onErrorCallback?)`
    -   `loadAsync(url, textureClasses?, options?)`

-   **`TextureStore`** (Singleton for caching and retrieving texture resources)
    -   `static load(url: string | URL): Promise<TextureStore>`
    -   `add(name: string, textureData: TextureAtlasData)`
    -   `get(id: string): Promise<TextureAtlasData | TextureImageData>` (Updated return type)
    -   `has(name: string): boolean`
    -   `renderer: DisplayRendererType | undefined` (setter/getter)
    -   `whenReady(): Promise<TextureStore>`

-   **`FrameBasedAnimations`**
    -   `add(name, duration, texCoords: TextureCoords[])`
    -   `add(name, duration, atlas: TextureAtlas, frameNameQuery?)`
    -   `add(name, duration, tileSet: TileSet, firstTileId?, tileCount?)`
    -   `add(name, duration, tileSet: TileSet, tileIds: number[])`
    -   `bakeDataTexture(options?: BakeTextureOptions): DataTexture`
    -   `animId(name: string | symbol): number`

-   **`TextureFactory`**
    -   `constructor(maxAnisotrophyOrRenderer, defaultClassNames?, defaultOptions?)`
    -   `create(source: TextureSource, ...classNames: TextureOptionClasses[]): Texture`
    -   `update(texture: Texture, ...classNames: TextureOptionClasses[]): Texture`
    -   `load(url: string, ...classNames: TextureOptionClasses[]): Texture`

### Interfaces/Types

-   `TextureAtlasFrame`
-   `TileSetOptions`
-   `TextureAtlasData`
-   `TextureStoreItem`
-   `FrameBasedAnimDef`
-   `TextureOptionClasses` (from `TextureFactory`)
-   `TextureOptions` (from `TextureFactory`)
-   `TextureResourceSubType` (from `TextureStore` internal types)
-   `TextureImageData` (new type for single image resources)

