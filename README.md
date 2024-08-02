<p align="center">
  <img width="350" src="docs/images/twopoint5d-700x168.png">
  <br>
  <em>A javascript side project about rendering 2.5D realtime graphics on the web.</em>
</p>

<p align="center">
  <b>
    ultra fast rendering of 2D sprites in 3D space &bull; billboards &bull; texture atlas &bull; frame-based animations &bull; parallax &bull; tiled 2D maps &bull; pixelart
  </b>
</p>

<div align="center">

![github actions main workflow status](https://github.com/spearwolf/twopoint5d/actions/workflows/main.yml/badge.svg)
[![License](https://img.shields.io/badge/License-Apache_2.0-yellowgreen.svg)](https://opensource.org/licenses/Apache-2.0)

</div>

![twopoint5d cover](cover.png)

## Introduction

It all started with the desire to render 2d sprites (lots of them!) in the browser. it has been a long way, starting with a naive html-canvas-based solution. the second iteration used a custom webgl renderer, which turned out to be quite complex in the long run. today, in its current form, the library uses three.js as the rendering layer.

A declarative description (called a "vertex object description") is used to describe the sprite properties (how many vertices, indices, texture coords, etc.).

Using the _vertex object description_, the library can create javascript objects that provide getters and setters for the respective sprite properties. the actual data ends up in internal buffers that are efficiently rendered in batches by three.js/webgl, usually via instanced rendering.

While the developer can use the "sprites" / _vertex objects_ comfortably and conveniently via javascript objects, the "backend" of the library ensures that webgl can render the current sprite pool with high performance with a single draw call. the cumbersome handling of webgl buffers and state setup becomes transparent for the developer.

Whether a "sprite" is a classic quad with a texture or a freeform polygon with special properties used in a custom vertex shader is completely up to the creator of the vertex object description and the associated shaders that use those properties.

> :rocket: In other words, this library wants to empower the developer's creativity by allowing him to quickly and easily create his own sprites, particles or whatever using instanced rendering and his own custom shaders, without having to study the documentation every time to understand the boring details of the WebGL API.  

Of course, this library offers several ready-to-use sprite shaders (better known as `Mesh` in three.js) based on this. the developer can just use them and doesn't have to worry about how.

There are sprite shaders that render textured quads as billboards or on a plane in the 3d space. there is also a sprite shader that uses animated  textures (using frame-based animations). and there are other highly specialized sprite shaders that are used for rendering tiled 2d maps, among other things.

Obviously, textures can be loaded from _texture atlases_ or _tilesets_.

> ‼️ However, the developer should not expect an all-encompassing sprite engine, that is not the intention of this library, it rather wants to reduce and speed up the developer's workload to do what he wants to do (but without hiding the rendering API three.js).

_There are a few more features that this library offers to make the life of a creative web developer easier, but not to take all the fun out of discovering them, let's just mention them here_ :wink:

## What's in this repository 👀

_twopoint5d_ is a monorepo that contains the following javascript / typescript libraries:

- [@spearwolf/twopoint5d](packages/twopoint5d) : is the "vanilla" core library and relies on [three.js](https://threejs.org/) as a rendering framework
- [@spearwolf/twopoint5d-r3f](packages/twopoint5d-r3f) : builds on top of this and provides react components based on [@react-three/fiber](https://github.com/pmndrs/react-three-fiber/)
- In contrast, [@spearwolf/twopoint5d-elements](packages/twopoint5d-elements) goes the way of vanilla web components

So it's up to you if you want to go the _react_, _web components_ or "vanilla" way :wink:

| 🔎 However, it should also be mentioned at this point that the _vanilla_ library is the only real and stable library here. both the react / r3f library and the _web components_ library are rather experimental in nature. in the end, i do not consider either technology to be optimal for a rendering engine. currently (as a side note), i am working on a component architecture that works offscreen in web workers, for the brave among you who dare to take a look at it, here is the link: [spearwolf/shadow-objects](https://github.com/spearwolf/shadow-objects)


## 📖 Documentation

Some features have been around for a long time and are stable, others are in flux and highly experimental. as an independent solo developer, it is not possible for me to create detailed written documentation and keep it up to date. this is a living open source project and is subject to constant change. therefore, the developer is advised to do the following

> _"Read the source, Luke!"_

To take this to the extreme, there is a LOOKBOOK app with lots of code examples, all of which can be used as a starting point for new projects or as documentation for one or the other feature.

> :rocket: The LOOKBOOK app can easily be started locally using `pnpm lookbook`. See next section [Development Setup](#development-setup) for details.

And of course there are one or two READMEs in the `**/src/*` subdirectories that provide a high-level overview of the features. _Enjoy exploring!_


## Development Setup

This repository is structured as a monorepo; based on [nx](https://nx.dev/) !

### 1. Install dependencies

First, you need a current [node v18+](https://nodejs.org/) with [PNpm as package manager](https://pnpm.io/) setup.
Install the dependencies with:

```sh
$ pnpm install
```

### 2. Build and test everything

```sh
$ pnpm cbt  # => pnpm run clean > build > test
```

### 3. Run the local LOOKBOOK app

```sh
$ pnpm lookbook
```

## Getting involved

Everyone is welcome to contribute to this project, no matter if it's just bug-fixes, new features, ideas or documentation or graphics!


## Copyright and License

Copyright &copy; 2021-2024 by [Wolfger Schramm](mailto:wolfger@spearwolf.de?subject=[GitHub]%20twopoint5d).

The source code is licensed under the [Apache-2.0 License](./LICENSE).
