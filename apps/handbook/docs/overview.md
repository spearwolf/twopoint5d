---
outline: deep
---

<img src="/images/twopoint5d-700x168.png" style="padding-bottom: 2rem" width="175" height="42" alt="twopoint5d">

# Getting Started

Welcome to `twopoint5d`. This guide will help you understand the library's architecture and core concepts. `twopoint5d` is not a standalone engine, but a collection of tools specifically designed to enhance your `three.js` projects with powerful 2.5D features.

## Core Concepts

Before diving into the individual modules, it's important to understand the fundamental design principles of `twopoint5d`.

-   **Vertex Objects (VO):** The heart of performance. Instead of managing thousands of `three.js` objects, which would lead to high CPU overhead, `twopoint5d` batches the data for similar objects (like sprites) into large `BufferGeometry` instances. The `vertex-objects` API provides an intuitive, object-oriented interface to manipulate individual entities within these buffers. Changes are efficiently transferred to the GPU, minimizing JavaScript overhead and maximizing rendering performance.

-   **Display & Stage:** The `Display` class simplifies the setup of your `three.js` environment. It handles canvas creation, the render loop, and timing. A `Stage` is a 2D scene with a specific camera projection (orthographic or perspective). Multiple stages can be combined in a `StageRenderer` to create complex scenes with parallax effects and different layers.

-   **Texture Management:** The library provides a robust system for loading, caching, and managing textures. `TextureAtlas` and `TileSet` are key classes for working with sprite sheets, while the `TextureStore` serves as a central cache to avoid redundant texture loading.

## Modules

The source code is organized into several modules, each focusing on a specific area of functionality. All source files are located in `packages/twopoint5d/src`.

### `sprites`

This module is the core of rendering in `twopoint5d`, providing everything you need to display 2D images in a 3D world. It builds on the `vertex-objects` concept to achieve extremely high performance.

-   **`TexturedSprites`**: The base class for rendering static, textured sprites. Ideal for backgrounds, icons, or other non-animated image elements.
-   **`AnimatedSprites`**: Enables rendering of sprites with frame-based animations. Animations are calculated directly on the GPU, allowing for the smooth display of hundreds or thousands of animated objects.
-   **`TileSprites`**: A highly optimized class for rendering large tile-based maps. It is the foundation for the `tiled-maps` module.
-   **`CustomChunksShaderMaterial`**: A flexible base class that allows you to create your own shader materials and easily inject custom GLSL code snippets (chunks).

### `texture`

Efficient texture management is crucial for performance. This module provides tools for loading, managing, and using textures and sprite sheets.

-   **`TextureStore`**: A global cache for texture resources. It ensures that each texture is loaded only once and simplifies access throughout the project.
-   **`TextureAtlas`**: Represents a sprite sheet and allows access to individual frames by name or index.
-   **`TextureAtlasLoader`**: Loads sprite sheet definitions from JSON files, such as those exported from tools like TexturePacker.
-   **`TileSet`**: A specialized version of `TextureAtlas`, optimized for grid-based tile sets.
-   **`FrameBasedAnimations`**: A helper class for defining and managing animations based on the frames of a `TextureAtlas`.

### `tiled-maps`

This module provides a system for creating and rendering 2D tile-based maps. Its architecture is based on the `Map2DLayer` class, which coordinates three distinct responsibilities: data provision, visibility determination, and rendering.

-   **`Map2DLayer`**: The central class that manages a grid of tiles. It works with a data provider to get tile information, a visibility manager to determine which tiles are in view, and a tile renderer to draw them.

**Core Concepts & Implementations:**

1.  **Tile Data Provider (`IMap2DTileDataProvider`)**: Defines the layout of the map by supplying the tile ID for any given coordinate.
    -   **`RepeatingTilesProvider`**: An implementation that repeats a given 2D array of tile IDs, creating an infinite, repeating pattern.

2.  **Visibility Manager (`IMap2DVisibilitor`)**: Determines which tiles of a layer are currently visible to the camera, a process known as culling.
    -   **`RectangularVisibilityArea`**: Defines a fixed-size rectangular viewport.
    -   **`CameraBasedVisibility`**: Uses the `three.js` camera's view frustum to determine visible tiles, suitable for 3D scenes.

3.  **Tile Renderer (`IMap2DTileRenderer`)**: Handles the actual drawing of the visible tiles. While you can create custom renderers, the library is optimized for use with `TileSprites`.
    -   **`TileSprites`**: The default, high-performance renderer for tile maps, based on the `sprites` module.

### `display`

This module simplifies the setup and management of the `three.js` rendering environment. While its use is optional, the `Display` class serves as a convenient wrapper for bootstrapping a `three.js` application, handling common boilerplate code.

-   **`Display`**: The main class for managing the canvas, renderer, and render loop. Its key features include:
    -   **Render Loop**: Manages an optimized `requestAnimationFrame` loop with built-in time tracking (delta time). The frame rate can be capped using the `maxFps` property.
    -   **Responsive Canvas**: Automatically handles canvas resizing. It can be configured to fill its parent element, the entire window, or any other element via a CSS selector using a `resize-to` HTML attribute.
    -   **Pixelated Rendering**: For retro-style graphics, setting the `pixelated` property to `true` ensures crisp, sharp pixels by disabling anti-aliasing.
    -   **Event System**: Provides lifecycle events like `onInit`, `onResize`, and `onRenderFrame` for clean application structure.

For a more detailed guide on state management, declarative resizing, and advanced usage, see the [Display](./display.md) documentation.

### `stage`

This module defines the concept of a 2D stage and its corresponding camera projections.

-   **`Stage2D`**: Represents a 2D scene with an associated camera. It manages the scene graph and updates the camera settings.
-   **`StageRenderer`**: Manages and renders one or more `Stage2D` instances. This is the primary tool for composing scenes from multiple layers.
-   **`IProjection`**: An interface for camera projections.
-   **`OrthographicProjection`**: Creates an `OrthographicCamera`.
-   **`ParallaxProjection`**: Creates a `PerspectiveCamera`, ideal for parallax scrolling effects.

### `events`

This module defines all custom events used throughout the library for communication between components. It is based on the `@spearwolf/eventize` library.

### `controls`

This module contains UI controls and interaction helpers.

-   **`InputControlBase`**: A base class for creating input controls that handle event listeners for mouse and keyboard events.
-   **`PanControl2D`**: Implements a 2D panning control that allows moving the view via mouse drag or keyboard (WASD).

### `vertex-objects`

This is the low-level layer that enables the high performance of `twopoint5d`. It is generally not used directly, but understanding it is crucial to understanding how `sprites` work.

-   **`VertexObjectPool`**: Manages a pool of vertex objects and their associated `TypedArray` buffers.
-   **`VertexObjectDescriptor`**: Describes the data structure of a vertex object (attributes, data types, buffer layout).
-   **`VOBufferGeometry`**: A `three.js` geometry that provides the data from the `VertexObjectPool` for rendering.

### `utils`

This module contains various utility functions and classes used throughout the library.
