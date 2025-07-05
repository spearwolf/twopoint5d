---
outline: deep
---

<img src="/images/twopoint5d-700x168.png" style="padding-bottom: 2rem" width="175" height="42" alt="twopoint5d">

# API Overview

Welcome to the `twopoint5d` library. This document provides a comprehensive overview of the library's architecture and source code structure. It is intended to help new developers understand the different parts of the library and where to find specific functionalities or implement new features.

## Core Concepts

The `twopoint5d` library is a collection of tools and classes for building 2.5D rendering applications on top of `three.js`. It is not a full-fledged framework but rather a set of specialized helpers that can be integrated into any `three.js` project. The main concepts are:

-   **Vertex Objects (VO):** This is a performance-centric feature that allows managing thousands of similar objects (like sprites or particles) with minimal CPU overhead. Instead of creating a `three.js` object for each entity, `twopoint5d` batches their data into large `BufferGeometry` instances. The `vertex-objects` API provides an object-oriented way to manipulate individual entities within these buffers, and the changes are efficiently synchronized with the GPU.

-   **Display & Stage:** The `Display` class is a wrapper around the `three.js` renderer and canvas, simplifying the setup of the render loop, viewport management, and timing. A `Stage` represents a 2D scene with a specific camera projection (orthographic or perspective). Multiple stages can be combined in a `StageRenderer` to create complex scenes with different layers and parallax effects.

-   **Texture Management:** The library provides a robust system for loading, caching, and managing textures. The `TextureAtlas` and `TileSet` classes are used to work with sprite sheets, while the `TextureStore` provides a centralized cache to avoid redundant texture loading.

## Module Structure

The source code is organized into several modules, each responsible for a specific domain of functionality. All source files are located in `packages/twopoint5d/src`.

### `controls`

This module contains UI controls and interaction helpers.

-   **`InputControlBase`**: A base class for creating input controls that handle event listeners for mouse and keyboard events.
-   **`PanControl2D`**: Implements a 2D panning control that allows moving the view using mouse drag or keyboard keys (WASD). It can be configured for different mouse buttons and speeds.

### `display`

This module simplifies the setup and management of the `three.js` rendering environment.

-   **`Display`**: The main class for managing the canvas, renderer, and render loop. It provides a declarative way to handle resizing and offers a rich event system for lifecycle and rendering events.
-   **`Chronometer`**: A helper class for time measurement, tracking total elapsed time and delta time between frames.
-   **`FrameLoop`**: Controls the frame rate of the render loop.
-   **`DisplayStateMachine`**: Manages the internal state of the `Display` class (e.g., running, paused).
-   **`Stylesheets`**: A utility for injecting and managing CSS rules dynamically.

### `events`

This module defines all the custom events used throughout the library for communication between different components. It uses the `@spearwolf/eventize` library.

### `sprites`

This module provides classes for rendering different types of sprites.

-   **`AnimatedSprites`**: A `VertexObjects` mesh for rendering animated sprites with frame-based animations.
-   **`AnimatedSpritesGeometry`**: The geometry for `AnimatedSprites`, managing the underlying vertex data.
-   **`AnimatedSpritesMaterial`**: A custom `ShaderMaterial` for rendering animated sprites, handling animation logic in the shader.
-   **`TexturedSprites`**: A `VertexObjects` mesh for rendering static, textured sprites.
-   **`TexturedSpritesGeometry`**: The geometry for `TexturedSprites`.
-   **`TexturedSpritesMaterial`**: A custom `ShaderMaterial` for `TexturedSprites`.
-   **`TileSprites`**: A `VertexObjects` mesh optimized for rendering large tile-based maps.
-   **`TileSpritesGeometry`**: The geometry for `TileSprites`.
-   **`TileSpritesMaterial`**: A custom `ShaderMaterial` for `TileSprites` that includes features like fog.
-   **`BaseSprite`**: A base class defining the geometry of a single sprite quad.
-   **`CustomChunksShaderMaterial`**: A base class for creating custom shader materials that allows for easy injection of shader chunks.

### `stage`

This module defines the concepts of a 2D stage and camera projections.

-   **`Stage2D`**: Represents a 2D scene with an associated camera and projection. It manages the scene graph and updates the camera based on the projection settings.
-   **`StageRenderer`**: Manages and renders one or more `Stage2D` instances. It is the primary tool for composing scenes with multiple layers.
-   **`Canvas2DStage`**: A helper class that combines a `Stage2D` with an HTML5 Canvas, allowing you to draw on a 2D canvas and use it as a texture in the 3D scene.
-   **`IProjection`**: An interface for camera projections.
-   **`OrthographicProjection`**: A projection that creates an `OrthographicCamera`.
-   **`ParallaxProjection`**: A projection that creates a `PerspectiveCamera`, suitable for creating parallax scrolling effects.
-   **`ProjectionPlane`**: Defines the 2D plane (e.g., XY or XZ) on which the 2D stage is rendered.

### `texture`

This module contains tools for loading and managing textures and sprite sheets.

-   **`TextureAtlas`**: Represents a sprite sheet and provides methods for accessing individual frames by name or ID.
-   **`TextureAtlasLoader`**: Loads texture atlases from JSON files (e.g., from TexturePacker).
-   **`TileSet`**: A specialized `TextureAtlas` for working with grid-based tile sets.
-   **`TileSetLoader`**: Loads tile sets from image files.
-   **`TextureCoords`**: A helper class for representing and manipulating texture coordinates within a larger texture.
-   **`TextureFactory`**: A factory for creating and configuring `three.js` `Texture` objects.
-   **`TextureStore`**: A global cache for texture resources, preventing redundant loading of the same texture.
-   **`FrameBasedAnimations`**: A class for defining and managing frame-based animations from a `TextureAtlas`.

### `tiled-maps`

This module provides tools for creating and rendering 2D tile-based maps.

-   **`Map2DLayer`**: Manages a grid of tiles and determines which tiles are visible based on a view area.
-   **`Map2DLayer3D`**: A `three.js` `Object3D` that acts as a facade for a `Map2DLayer`, integrating it into the 3D scene.
-   **`CameraBasedVisibility`**: A visibility strategy that uses the camera's view frustum to determine which tiles of a `Map2DLayer` are visible.
-   **`RepeatingTilesProvider`**: A simple tile data provider that repeats a given pattern of tiles endlessly.
-   **`IMap2DTileDataProvider`**: An interface for providing tile data to a `Map2DLayer`.
-   **`IMap2DTileRenderer`**: An interface for rendering the tiles of a `Map2DLayer`.

### `utils`

This module contains various utility functions and classes used throughout the library.

-   **`Dependencies`**: A helper class for tracking and comparing dependencies to avoid unnecessary updates.
-   **`findNextPowerOf2`**: A math utility to find the next power of 2 for a given number.
-   **`isPowerOf2`**: Checks if a number is a power of 2.
-   **`unpick`**: A utility to create a new object by omitting specified keys from a source object.

### `vertex-objects`

This is the core module for the Vertex Objects feature, providing the low-level API for managing batched geometries.

-   **`VertexObjectDescriptor`**: Describes the structure of a vertex object, including its attributes and their types.
-   **`VertexObjectPool`**: Manages a pool of vertex objects and their underlying buffer data.
-   **`VOBufferGeometry`**: A `BufferGeometry` that is populated from a `VertexObjectPool`.
-   **`InstancedVOBufferGeometry`**: A `BufferGeometry` for instanced rendering of vertex objects.
-   **`VertexObjects`**: A `THREE.Mesh` subclass that simplifies the usage of `VOBufferGeometry` and `InstancedVOBufferGeometry`, automatically handling updates.
-   **`VO` (interface)**: The base interface for a vertex object.
