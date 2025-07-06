---
outline: deep
---

<img src="/images/twopoint5d-700x168.png" style="padding-bottom: 2rem" width="175" height="42" alt="twopoint5d">

# Overview

Welcome to `twopoint5d`. This guide will help you understand the library's architecture and submodules. `twopoint5d` is not a standalone engine, but a collection of tools specifically designed to enhance your `three.js` projects with ready-to-use 2.5D features.


## Modules

The source code is organized into several submodules, each focusing on a specific area of functionality. All source files are located in [packages/twopoint5d/src](https://github.com/spearwolf/twopoint5d/tree/main/packages/twopoint5d/src).


### Sprites

The main purpose of the `twopoint5d` library is to provide everything you need to render 2D images in a 3D world. It uses instanced rendering for high performance, building on the concept of _vertex objects_:

#### Vertex Objects

Instead of managing thousands of `three.js` objects, `twopoint5d` batches the data for similar objects (like sprites) into large `BufferGeometry` instances. This approach drastically reduces the number of WebGL draw calls, a primary bottleneck in complex scenes. The `vertex-objects` API provides an _intuitive, object-oriented interface to manipulate individual entities_ within these buffers, and changes are efficiently transferred to the GPU.

For a more detailed guide on vertex objects, refer to the [Vertex Objects](./vertex-objects.md)  guide.

To avoid reinventing the wheel each time, the `twopoint5d` library offers ready-made sprite objects based on vertex objects:

-   **`TexturedSprites`**: The base class for rendering static, textured sprites. Ideal for backgrounds, icons, or other non-animated image elements.
-   **`AnimatedSprites`**: Enables rendering of sprites with frame-based animations. Animations are calculated directly on the GPU, allowing for the smooth display of hundreds or thousands of animated objects.
-   **`TileSprites`**: A highly optimized class for rendering large tile-based maps.


### Textures

Efficient texture management is crucial for performance. This module provides tools for loading, managing, and using textures and sprite sheets.
`TextureAtlas` and `TileSet` are key classes for working with sprite sheets, while the `TextureStore` serves as a central asset store that can be loaded via a JSON catalog.

-   **`TextureStore`**: A global cache for texture resources. It ensures that each texture is loaded only once and simplifies access throughout the project. The `TextureStore` follows a declarative approach; the texture resources are loaded via a JSON catalog.
-   **`TextureAtlas`**: Represents a sprite sheet and allows access to individual frames by name or index.
-   **`TextureAtlasLoader`**: Loads sprite sheet definitions from JSON files, such as those exported from tools like TexturePacker.
-   **`TileSet`**: A specialized version of `TextureAtlas`, optimized for grid-based tile sets.
-   **`FrameBasedAnimations`**: A helper class for defining and managing animations based on the frames of a `TextureAtlas`.

For a more detailed guide on textures and their usage, see the [Textures and Atlases](./textures.md) or [Textures API](./cheat-sheet-textures.md) docs.


### Tiled 2D-Maps

This module provides a system for creating and rendering 2D tile-based maps. Its architecture is based on the `Map2DLayer` class, which coordinates three distinct responsibilities: data provision, visibility determination, and rendering.

-   **`Map2DLayer`**: The central class that manages a grid of tiles. It works with a data provider to get tile information, a visibility manager to determine which tiles are in view, and a tile renderer to draw them.

**Core Concepts & Implementations:**

1.  **Tile Data Provider (`IMap2DTileDataProvider`)**: Defines the layout of the map by supplying the tile ID for any given coordinate.
    -   **`RepeatingTilesProvider`**: An implementation that repeats a given 2D array of tile IDs, creating an infinite, repeating pattern.

2.  **Visibility Manager (`IMap2DVisibilitor`)**: Determines which tiles of a layer are currently visible to the camera, a process known as culling.
    -   **`RectangularVisibilityArea`**: Defines a fixed-size rectangular viewport.
    -   **`CameraBasedVisibility`**: Uses the `three.js` camera's view frustum to determine visible tiles, suitable for 3D scenes.

3.  **Tile Renderer (`IMap2DTileRenderer`)**: Handles the actual drawing of the visible tiles. While you can create custom renderers, the library is optimized for use with `TileSprites`.
    -   **`TileSprites`**: The default renderer for tile maps, which uses instanced rendering for high performance.

For a more detailed guide on how to render 2d-maps, refer to the [Map2D](./map-2d.md)  guide.

### Display

This module simplifies the setup and management of the `three.js` rendering environment. While its use is optional, the `Display` class serves as a convenient wrapper for bootstrapping a `three.js` application, handling common boilerplate code.

-   **`Display`**: The main class for managing the canvas, renderer, and render loop. Its key features include:
    -   **Render Loop**: Manages an optimized `requestAnimationFrame` loop with built-in time tracking (delta time). The frame rate can be capped using the `maxFps` property.
    -   **Responsive Canvas**: Automatically handles canvas resizing. It can be configured to fill its parent element, the entire window, or any other element via a CSS selector using a `resize-to` HTML attribute.
    -   **Pixelated Rendering**: For retro-style graphics, setting the `pixelated` property to `true` ensures crisp, sharp pixels by disabling anti-aliasing.
    -   **Event System**: Provides lifecycle events like `onInit`, `onResize`, and `onRenderFrame` for clean application structure.

For a more detailed guide on state management, declarative resizing, and advanced usage, see the [Display](./display.md) documentation.

### Stage and Projection

This module introduces the concept of a `Stage`, which links a `three.js` scene to a camera and a virtual 2D render output. It provides a structured way to manage 2D scenes within a 3D space.

-   **`Stage2D`**: Represents a 2D scene. It contains a `three.js` `Scene` and is associated with a `Projection` that controls the camera.
-   **`StageRenderer`**: Manages and renders one or more `Stage2D` instances. This is the primary tool for composing scenes from multiple layers, for example to create parallax effects.

**Projections**

A `Projection` is an alternative way to create and manage a `three.js` camera. Instead of configuring the camera directly, a projection focuses on the desired 2D output and the plane (e.g., XY or XZ) onto which the scene is projected.

-   **`IProjection`**: The interface for all projection implementations.
-   **`OrthographicProjection`**: Creates an `OrthographicCamera`, resulting in a flat, 2D view without perspective.
-   **`ParallaxProjection`**: Creates a `PerspectiveCamera`, which can be used to create parallax scrolling effects by moving the camera relative to the stage.


### Controls

This module contains UI controls and interaction helpers.

-   **`InputControlBase`**: A base class for creating input controls that handle event listeners for mouse and keyboard events.
-   **`PanControl2D`**: Implements a 2D panning control that allows moving the view via mouse drag or keyboard (WASD).
