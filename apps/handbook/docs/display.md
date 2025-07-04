---
outline: deep
---

# Display

The `Display` class is a convenience helper in `twopoint5d`. It simplifies the process of initializing an HTML canvas element, setting up a `three.js` renderer, and starting a render loop.

**Using the `Display` class is optional.** All core features of `twopoint5d`, such as Vertex Objects, Tiled Maps, or Sprites, can be used directly with a `three.js` renderer without this class.

## Introduction

The `Display` class abstracts away recurring tasks when setting up a `three.js` scene. It handles:

-   **Canvas Creation:** Automatically creates a `<canvas>` element within a specified DOM container or uses an existing one.
-   **Renderer Management:** Initializes a `WebGLRenderer` (or optionally a `WebGPURenderer`) and automatically resizes it to fit the parent element.
-   **Render Loop:** Provides an optimized `requestAnimationFrame` loop that can be used for animations and interactions. The frame rate can be controlled via the `maxFps` option in the constructor or the `frameLoop` property.
-   **Event System:** Offers a robust event system (based on `eventize`) for lifecycle and render events.
-   **Time Management:** Keeps track of the elapsed time and the time delta between frames.
-   **State Management:** Internally manages the display's state (e.g., `running`, `paused`).

A typical use case is the rapid creation of a prototype or demo without having to worry about the details of renderer configuration.

## State Model

The `Display` class uses an internal state machine (`DisplayStateMachine`) to manage its lifecycle. The main states are:

-   `'new'`: The initial state before `start()` is called.
-   `'running'`: The render loop is active, and the scene is being drawn.
-   `'paused'`: The render loop is suspended.

The state changes automatically under the following conditions:
-   An explicit call to `display.start()` or `display.stop()` (or setting `display.pause = true`).
-   The document's visibility changes (e.g., when the user switches tabs).
-   The canvas element moves into or out of the visible viewport (Intersection Observer).

This ensures that no unnecessary resources are consumed when the display is not visible.

## Declarative Resizing with `resize-to`

The `Display` class offers a powerful declarative way to control the canvas size using the `resize-to` HTML attribute. This allows you to manage layout behavior directly in your HTML, separating it from your JavaScript logic.

By default, `Display` inspects the `<canvas>` element itself for this attribute. You can change which element is inspected by providing the `resizeToAttributeEl` option to the constructor.

The `resize-to` attribute can have the following values:

-   **`"fullscreen"`** or **`"window"`**: The canvas will be resized to fill the entire browser window. `Display` will add the necessary CSS (`position: fixed`, etc.) to achieve this.
    ```html
    <canvas resize-to="fullscreen"></canvas>
    ```

-   **A CSS Selector**: You can provide any valid CSS selector. The canvas will be resized to match the content area of the first element found by that selector.
    ```html
    <div id="render-area" style="width: 800px; height: 600px;"></div>
    <canvas resize-to="#render-area"></canvas>
    ```

-   **`"self"`**: The canvas will be resized to fit the dimensions of its own containing element (as determined by the `resizeToElement` option).

This mechanism provides a flexible alternative to the programmatic `resizeTo` and `resizeToElement` options. The order of precedence is:
1. `resizeTo` callback function (if provided)
2. `resize-to` attribute
3. `resizeToElement` option

## Examples

In the `lookbook` application, the `Display` class is rarely instantiated directly. Instead, an extended class named `PerspectiveOrbitDemo` is used, which comes pre-configured with a `PerspectiveCamera` and `OrbitControls`.

This is a common pattern for creating reusable setups.

**Example from `apps/lookbook/src/pages/demos/textured-sprites.astro`:**

```typescript
import { PerspectiveOrbitDemo } from '../../demos/utils/PerspectiveOrbitDemo';

// A DOM element (e.g., a div) is passed as a container for the canvas.
const container = document.getElementById('canvas-container');

// The options { antialias: false } are forwarded to the three.js renderer.
const demo = new PerspectiveOrbitDemo(container, { antialias: false });

// ... more code to add objects to the scene ...

// The render loop must be started explicitly - without this call,
// nothing will be rendered.
demo.start();
```

This example shows how easy it is to initialize a 2.5D scene. The `PerspectiveOrbitDemo` class (which inherits from `Display`) handles all the boilerplate setup. **Important:** The render loop does not start automatically—an explicit call to `start()` is required to begin rendering.

## Public API

### `constructor(domElementOrRenderer, options?)`

-   `domElementOrRenderer`: Either an `HTMLElement` (like `div` or `canvas`) to serve as a container, or a pre-existing `WebGLRenderer` or `WebGPURenderer` instance.
-   `options` (optional): An object with configuration parameters.
    -   `createRenderer`: A custom function `(params) => renderer` to create the renderer instance. Useful for advanced configurations or custom renderers.
    -   `maxFps`: Limits the maximum frame rate (e.g., `30`). Defaults to `0` (unlimited).
    -   `resizeTo`: A callback function `(display: Display) => [width: number, height: number]` to manually control the canvas size. This overrides `resizeToElement`.
    -   `resizeToElement`: An `HTMLElement` whose size the canvas should adopt. Defaults to the container element if one is provided.
    -   `resizeToAttributeEl`: The `HTMLElement` from which the `resize-to` attribute is read. Defaults to the canvas element itself. This allows for dynamic resizing based on a declarative attribute.
    -   `styleSheetRoot`: The DOM element or ShadowRoot where internal CSS rules are injected. Defaults to `document.head`.
    -   ... as well as all other options accepted by the `three.js` `WebGLRenderer` constructor (e.g., `antialias`, `alpha`, `powerPreference`).

### Properties

-   `width: number` (read-only): The current width of the canvas in CSS pixels.
-   `height: number` (read-only): The current height of the canvas in CSS pixels.
-   `now: number` (read-only): The total time in seconds since the display started.
-   `deltaTime: number` (read-only): The time in seconds that has passed since the last frame.
-   `frameNo: number` (read-only): The current frame number.
-   `isFirstFrame: boolean` (read-only): `true` if the current frame is the first one.
-   `pause: boolean`: Sets or gets the paused state of the display.
-   `pixelRatio: number` (read-only): The effective pixel ratio of the renderer.
-   `devicePixelRatio: number` (read-only): The browser's `devicePixelRatio`.
-   `pixelZoom: number`: A factor for scaling pixels, useful for pixel art. If greater than 0, `devicePixelRatio` is ignored.
-   `renderer: WebGLRenderer | WebGPURenderer`: The `three.js` renderer instance.

### Methods

-   `start(beforeStartCallback?)`: Starts the render loop. Can invoke an async function `beforeStartCallback` before the first frame is rendered.
-   `stop()`: Pauses the render loop.
-   `dispose()`: Stops the loop, removes all event listeners, and releases the renderer's resources.
-   `resize()`: Forces a recalculation of the canvas size. Usually called automatically.
-   `getEventProps()`: Returns an object with the current event properties that are passed to event handlers.

## Events

The `Display` class is an `eventize` object and provides several lifecycle events. You can listen to them using `on(display, EventName, handler)`.

| Event Name | Module Export | Description |
|------------|---------------|-------------|
| _"init"_ | `OnDisplayInit` | Fired once after initialization. |
| _"start"_ | `OnDisplayStart` | Fired when the render loop starts. |
| _"pause"_ | `OnDisplayPause` | Fired when the loop is paused. |
| _"restart"_ | `OnDisplayRestart` | Fired on restart after a pause. |
| _"resize"_ | `OnDisplayResize` | Fired when the canvas size changes. |
| _"renderFrame"_ | `OnDisplayRenderFrame` | Fired on every frame before rendering. This is the main hook for application logic. |
| _"dispose"_ | `OnDisplayDispose` | Fired when `display.dispose()` is called. |

### Event Handler Shortcuts

Convenience shortcut methods are available for the most important events:

-   `onInit(handler)`
-   `onStart(handler)`
-   `onPause(handler)`
-   `onRestart(handler)`
-   `onResize(handler)`
-   `onRenderFrame(handler)`
-   `onNextFrame(handler)` (fires the handler only once on the next frame)
-   `nextFrame()`: Returns a `Promise` that resolves on the next frame.
-   `onDispose(handler)`

## Lookbook Examples

Here are some links to demos in the lookbook app that use the `Display` class (via `PerspectiveOrbitDemo`):

-   [/demos/animated-billboards](/demos/animated-billboards)
-   [/demos/animated-sprites](/demos/animated-sprites)
-   [/demos/crosses](/demos/crosses)
-   [/demos/instanced-quads](/demos/instanced-quads)
-   [/demos/map2d-layer3d](/demos/map2d-layer3d)
-   [/demos/map2d-tile-sprites](/demos/map2d-tile-sprites)
-   [/demos/textured-quads](/demos/textured-quads)
-   [/demos/textured-sprites](/demos/textured-sprites)
