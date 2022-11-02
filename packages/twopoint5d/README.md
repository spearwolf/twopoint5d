<p align="center">
  <img width="400" height="84" src="twopoint5d-logo.png">
	<br>
  <b>The Art of Tiling 2D Sprites</b>
	<br>
  <em>A refreshingly satisfying 2.5D graphics library built on three.js</em>
</p>

---

please see [../README](../../README.md) for a general description of this project.

---

The core features can be roughly classified into the following areas:

#### [textured-sprites](src/sprites/)
- create and render textured 2D sprites
- load texture atlases
- animations
- render as billboards (optional)
- :heavy_check_mark::rocket: ready to use but the api is still in progress

#### [vertex-objects and texture atlases](src/vertexObjects/)
- provides an object based abstraction over instanced buffer geometries. build them with your own api
- create, update and delete instances with ease
- _legacy_ api docs: [docs/VertexObjects-legacy](../../docs/VertexObjects-legacy.md)
- :heavy_check_mark: api is stable and ready to use

#### [tiled-maps](src/tiledMaps/)
- create and render visual tiled maps which are laid out in [a 2D spatial grid map data structure](../../docs/Map2D.md)
- api docs: [docs/Map2D](../../docs/Map2D.md)
- :warning: work in progress

#### [stage2d and projections](src/stage/)
- create responsive three.js scenes by describing a _projection_
- supports _orthogonal_ and _parallax_ (aka _perspective_) projections (more to come)
- api docs: [docs/Stage2D](../../docs/Stage2D.md)
- :heavy_check_mark: api is stable and ready to use

#### [display](src/display/)
- cosy boilerplate for creating a three.js &lt;canvas&gt; element and dealing with the _init_, _resize_ and _frame_ event&#x2011;loop
- nice starting point for your three.js demos
- there is no other dependency than the three.js package itself
- api docs: [docs/Display](../../docs/Display.md)
- :heavy_check_mark: api is stable and ready to use

have fun!
:rocket:
