<p align="center">
  <img width="400" height="84" src="twopoint5d-logo.png">
	<br>
  <em>a library to create 2.5d realtime graphics and pixelart with three.js</em>
</p>

---

![npm (scoped)](https://img.shields.io/npm/v/%40spearwolf/twopoint5d)

please see the [project README](../../README.md) for a general description of this project,
and the [CHANGELOG](CHANGELOG.md) for what changed from release to release.

---

The core features can be roughly classified into the following areas:

#### 📚 [textured-sprites](src/sprites/)
- create and render textured 2D sprites in 3D space
- load and create sprites from texture atlases or sprite sheet images
- support frame based animations
- draw trimmed and rotated frames of a TexturePacker atlas where the untrimmed sprite has
  them
- render as billboards
- :heavy_check_mark::rocket: ready to use but the api is still in progress

#### 📚 [texture atlases and tilesets](src/texture/)
- load images, texture atlases, tilesets and frame based animations from one json
  catalog through `TextureStore`, which fetches every image once and owns the textures it
  builds
- read the "JSON Hash" and the "JSON Array" format of TexturePacker
- create tilesets from images
- the callback loaders (`TextureAtlasLoader`, `TileSetLoader`, …) are deprecated in
  favour of `TextureStore`
- :heavy_check_mark: api is stable and ready to use

#### 📚 [map2d](src/map2d/)
- create and render tiled maps which are laid out in a 2D spatial grid map data
  structure
- :warning: work in progress

#### 📚 [vertex-objects](src/vertex-objects/)

three.js offers standardized geometry properties like position, normal, colors, etc.
For rendering, triangles are almost always used as primitives.

The _vertex-objects_ api simplifies the creation of geometries with custom properties. A
_vertex-object description_ is used to describe the geometry and its primitives, and an
object-based api is used to manage the primitives &rarr; vertex-objects &rarr; _custom
sprites_ of the geometry.

Such a geometry almost always needs a material of its own, since the built-in materials
of three.js know nothing of custom attributes. In this library that is a `NodeMaterial`
whose shader is written in TSL (`three/tsl`) and reads the attributes through
`attribute()` nodes, as the sprite materials under [src/sprites/](src/sprites/) do.

The main motivation behind the _vertex objects_ is to make it easier to create custom
geometries, especially _instanced_ geometries (multiple objects within one buffer
geometry) without worrying too much about the buffer attributes of three.js underneath.

This library provides you with a declarative interface to describe the shape of the
geometry, incl. indices and attributes and manages the internal attribute buffers, deals
with mapping of attributes to buffers AND the update of them.

It should significantly cut down on the amount of boilerplate code and state management
you need to do in your applications. At the same time, the _vertex objects_ api gives
you a convenient object-based interface to write extremely clean and readable programs
for your custom geometries.

- provides an object based abstraction over instanced buffer geometries. build them with
  your own api
- create, update and delete instances with ease
- :heavy_check_mark: api is stable and ready to use

#### [stage2d and projections](src/stage/)
- create responsive three.js scenes by describing a _projection_
- supports _orthogonal_ and _parallax_ (aka _perspective_) projections (more to come)
- render several stages into one frame with a `StageRenderer`, nest renderers and add
  post-processing through a TSL pipeline — a bloom composition is built in
- `Canvas2DStage` shows the content of a 2D `<canvas>` on a sprite, fitted by `contain` or
  `cover`, and uploads it again after every change
- api docs: [stage layer cheat-sheet](src/stage/README.md)
- :heavy_check_mark: api is stable and ready to use

#### [display](src/display/)
- cosy boilerplate for creating a three.js &lt;canvas&gt; element and dealing with the
  _init_, _resize_ and _frame_ event&#x2011;loop
- nice starting point for your three.js demos
- imports nothing but three.js and `@spearwolf/eventize`; the peer dependencies of the
  package are listed under [Usage](../../README.md#usage)
- api docs: the `Display` class docs — lifecycle and resize model — in
  [src/display/Display.ts](src/display/Display.ts)
- :heavy_check_mark: api is stable and ready to use

#### [controls](src/controls/)
- `PanControl2D` pans a 2D view by pointer drag and by keyboard, the keys at the _WASD_
  position by default, whatever the keyboard layout labels them
- `InputControlBase` is the base for controls of your own: it tracks the listeners a
  control puts on its hosts and takes them off again on `dispose()`

#### [resource lifecycle](docs/resource-lifecycle.md)
- the binding rules for `dispose()` and ownership of geometries, materials, textures and
  pools
- what a disposed instance answers, and how signals, effects and events are torn down
- a checklist and a test pattern for every new `dispose()`

have fun! :rocket:
