# CHANGELOG

All notable changes to [@spearwolf/twopoint5d](https://github.com/spearwolf/twopoint5d/tree/main/packages/twopoint5d) will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.15.0] - Unreleased

- improve `TextureStore`
  - load and create _frameBasedAnimations_ from _json_
  - The _textureStore_ now also supports the _atlas_ type when creating a _tileSet_.
  - The `textureStore.get()` method has been renamed to `.on()` and a new implementation of `.get()` (which replaces the old one) has been added. The new `.get()` method behaves exactly like `.on()` but returns a promise once.
  - add `.dispose()` method
  - fix an issue that prevented the _textureFactory_ from being created when the _renderer_ property was set very early on
- clean up _events.js_
  - remove obsolete `StageRenderFrameProps` interface

## [0.14.0] - 2025-11-19

- refactor all 'three' imports: use only 'three/webgpu'
- remove obsolete classes:
  - `CustomChunksShaderMaterial`
  - `ShaderLib`
  - `ShaderTool`

## [0.13.0] - 2025-11-18

> [!CAUTION]
> This version breaks with many things and clearly moves towards the use of WebGL2 and WebGPU!
>
> This follows the three.js library, which currently comes in two variants:
> `import THREE from 'three'` _vs._ `import THREE from 'three/webgpu'`
>
> Starting with version `0.13`, `twopoint5d` is freeing itself from legacy issues and moving completely to the `three/webgpu` side!
>
> The new _node materials_ and the _three shader language_ are exactly what was envisioned when `@spearwolf/twopoint5d` was created.
> Instead of getting lost in custom workarounds that use the old materials and shaders, we have now switched exclusively and consistently to _tsl_.

- only use the `three/webgpu` package as import
- upgrade to three.js r181
- refactor `Display` &rarr; `resize`, `renderFrame` events
  - add types, constants and interfaces for `OnDisplayResize` and `OnDisplayRenderFrame`
  - _MIGRATION NOTE:_ the `frame` event has been renamed to `renderFrame`
  - add new helpers:
    - `display.onResize(callback)`
    - `display.onRenderFrame(callback)`
    - `display.onInit(callback)`
    - `display.onStart(callback)`
    - `display.onPause(callback)`
    - `display.onRestart(callback)`
    - `display.onDispose(callback)`
- the types and constants from `/events.js` are now included in the main module
  - _MIGRATION NOTE:_ the import of `@spearwolf/twopoint5d/events.js` is no longer supported. just use `@spearwolf/twopoint5d` instead.
- _MIGRATION NOTE:_ renamed `DisplayEventArgs` to `DisplayEventProps`
- _MIGRATION NOTE:_ dropped `OnResizeProps` and `OnRenderFrameProps`. the only truth is `DisplayEventProps`
- add new constants and types: `OnDisplayInit`, `OnDisplayStart`, `OntDisplayRestart`, `OnDisplayPause` and `OnDisplayDispose`
- The `VertexObjects` mesh is calling `.update()` in the constructor now
  - To avoid disappointment if the vertex object geometry was not manually updated initially.


## [0.12.0] - 2025-05-10

- refactor `IStage`, `PostProcessingRenderer`, add `Stage2DRenderPass`

&mldr;

## [0.11.0] - 2025-04-26

- remove auto creation of `WebGPURenderer` in `Display` when using `webgpu: true`
  - to avoid confusion with `three`and `three/webgpu` imports when using resolve aliases
  - you can still pass `renderer: new WebGPURenderer()` to the `Display` constructor (no need to pass `webgpu: true` in this case)
- convert last `three/examples/jsm` import to `three/addons`
- deactivate some hook tests in twopoint5d-r3f
  - time to ditch react-three-fiber support
    - the maintainance cost is too high

## [0.9.3] - 2025-03-26

- upgrade to `@spearwolf/signalize@0.20.1`

## [0.9.2] - 2025-03-26

- fix `PostProcessingRenderer` resize issues

## [0.9.1] - 2025-03-25

- fix _renderOrder_ '*' behavior

## [0.9.0] - 2025-03-25

- add _renderOrder_ feature to `StageRenderer` and `PostProcessingRenderer`
- the `IStage` interface have a _name_ property now

## [0.7.0] - 2024-01-09

### Added

- The `Display` class now supports the _optional_ `webgpu: true` parameter
  - If enabled, the new `WebGPURenderer` from `three/gpu` is used
  - The default is still the good old `THREE.WebGLRenderer`


## [0.6.0] - 2024-01-08

### Changed

- Use default dependencies instead of peer dependencies


## [0.5.0] - 2024-01-08

### Changed

- Upgrade dependencies
  - three@0.172.0
  - @spearwolf/eventize@4.0.1
  - @spearwolf/signalize@0.18.1
