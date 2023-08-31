<p align="center">
  <img width="400" height="84" src="twopoint5d-logo.png">
	<br>
  <em>a 2.5d realtime gfx library built with three.js</em>
</p>

---

please see [../README](../../README.md) for a general description of this project.

---

The core features can be roughly classified into the following areas:

#### 📚 [textured-sprites](src/sprites/)
- create and render textured 2D sprites in 3D space
- load and create sprites from texture atlases or sprite sheet images
- support frame based animations
- render as billboards
- :heavy_check_mark::rocket: ready to use but the api is still in progress

#### 📚 [texture atlases and tilesets](src/vertexObjects/)
- load texture atlases from json
- create tilesets from images
- :heavy_check_mark: api is stable and ready to use

#### 📚 [tiled-maps](src/tiledMaps/)
- create and render tiled maps which are laid out in [a 2D spatial grid map data structure](../../docs/Map2D.md)
- api docs: [docs/Map2D](../../docs/Map2D.md)
- :warning: work in progress

#### 📚 [vertex-objects](src/vertexObjects/)

three.js offers standardized geometry properties like position, normal, colors, etc.. For rendering, triangles are almost always used as primtives.

The _vertex-objects_ api simplifies the creation of geometries with custom properties. A _vertex-object description_ is used to describe the geometry and its primitives, and an object-based api is used to manage the primitives &rarr; vertex-objects &rarr; _custom sprites_ of the geometry.

For such a geometry, however, own vertex and fragment shaders are almost always needed, since the standard shaders from the three.js library are of course not written for non-standard geometry properties.

The main motivation behind the _vertex objects_ is to make it easier to create custom geometries, especially _instanced_ geometries (multiple objects within one buffer geometry) without worrying too much about low-level three.js/WebGL details.

This library provides you with a declarative interface to describe the shape of the geometry, incl. indices and attributes and manages the internal attribute buffers, deals with mapping of attributes to buffers AND the update of them.
  
It should significantly cut down on the amount of boilerplate code and state management you need to do in your applications. At the same time, the _vertex objects_ api gives you a convenient object-based interface to write extremely clean and readable programs for your custom geometries.

- provides an object based abstraction over instanced buffer geometries. build them with your own api
- create, update and delete instances with ease
- _legacy_ api docs: [docs/VertexObjects-legacy](../../docs/VertexObjects-legacy.md)
- :heavy_check_mark: api is stable and ready to use

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
