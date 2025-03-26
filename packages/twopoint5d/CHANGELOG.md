# CHANGELOG

All notable changes to [@spearwolf/twopoint5d](https://github.com/spearwolf/twopoint5d/tree/main/packages/twopoint5d) will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

&mldr;

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
