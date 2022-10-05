![@spearwolf/three-vertex-objects cover](cover.png)

A collection of typescript&#x2011;based micro&#x2011;libraries in the shape of a monorepo. Most of these are centered around building 2.5D games, demos and website(effect)s, with three.js and @react-three/fiber. Some of them are already quite stable, others are still experimental.

## What are the goals of this project ?

- Make the creation of 2.5D games, demos and website(effect)s as easy and satisfying as possible
- Super easy import and use of gamedev assets and 2D resources from the internet
- First-class pixel-art support and responsive-design awareness

## What are the (planned*) core features ?

- Creation, management and efficient display of 2.5D sprites/particles
  - texture-atlas support
  - sprite-sheet animations
  - billboards!
- Creation, management and efficient display of 2.5D maps
- Import of common texture atlas formats (TexturePacker) and 2.5D-maps* (tiled, LDtk)
- Advanced api for extending and customizing sprite features and 2.5D-map renderers

## As a front-end developer how can i use this in my own projects ?

For all developers who want to just use the featureset easily in their own projects, the [@spearwolf/picimo](./packages/picimo/) package is intended:
- picimo is a typescript library that provides react components and hooks
- is open source, licensed under the MIT license
- offers a ready-to-use npm package: `npm i @spearwolf/picimo`

<img src="picimo-tech-stack@1x.png" srcset="picimo-tech-stack@1x.png 1x, picimo-tech-stack@2x.png 2x" alt="picimo tech stack">

> :warning: However, there are currently no detailed tutorials or comprehensive documentation available - instead, there are a number of examples that illustrate the respective features and usage of the api


## Packages inside this monorepo

### three.js

#### [@spearwolf/vertex&#x2011;objects](./packages/vertex-objects/)
[![npm version](https://badge.fury.io/js/@spearwolf%2Fvertex-objects.svg)](https://badge.fury.io/js/@spearwolf%2Fvertex-objects)

- provides an object based abstraction over instanced buffer geometries. build them with your own api
- create, update and delete instances with ease
- :heavy_check_mark: api is stable and ready to use

#### [@spearwolf/display3](./packages/display3/)
[![npm version](https://badge.fury.io/js/@spearwolf%2Fdisplay3.svg)](https://badge.fury.io/js/@spearwolf%2Fdisplay3)

- cosy boilerplate for creating a three.js &lt;canvas&gt; element and dealing with the _init_, _resize_ and _frame_ event&#x2011;loop
- nice starting point for your three.js demos
- there is no other dependency than the three.js package itself
- :heavy_check_mark: api is stable and ready to use

#### [@spearwolf/stage25](./packages/stage25/)
[![npm version](https://badge.fury.io/js/@spearwolf%2Fstage25.svg)](https://badge.fury.io/js/@spearwolf%2Fstage25)

- create responsive three.js scenes by describing a _projection_
- supports _orthogonal_ and _parallax_ (aka _perspective_) projections (more to come)
- :heavy_check_mark: api is stable and ready to use

#### [@spearwolf/textured&#x2011;sprites](./packages/textured-sprites/)
[![npm version](https://badge.fury.io/js/@spearwolf%2Ftextured-sprites.svg)](https://badge.fury.io/js/@spearwolf%2Ftextured-sprites)

- create and render textured 2D sprites
- load texture atlases
- animations
- render as billboards (optional)
- based on @spearwolf/vertex&#x2011;objects
- :heavy_check_mark::rocket: ready to use but the api is still in progress

#### [@spearwolf/tiled&#x2011;maps](./packages/tiled-maps/)

- create and render visual tiled maps which are laid out in [a 2D spatial grid map data structure](./packages/tiled-maps/README.md)
- based on @spearwolf/vertex&#x2011;objects
- :warning: work in progress

### @react-three/fiber

#### [@spearwolf/picimo](./packages/picimo/)
[![npm version](https://badge.fury.io/js/@spearwolf%2Fpicimo.svg)](https://badge.fury.io/js/@spearwolf%2Fpicimo)

- provides most of the previous libraries as react components and hooks
- hooks that simplify the lifecycle of stateful and frame-based components and their interaction with react components
- :heavy_check_mark::rocket: ready to use but the api is still in progress


## Examples

Almost all of these examples serve to show individual aspects and usage of the respective api. Therefore, don't expect any visual masterpieces at this point. This is given to the user of the libraries as an exercise :wink:

- [examples/vanilla](./examples/vanilla/)
  - vanilla three.js examples (no build step required)
  - start with: `$ yarn examples:vanilla`
- [examples/r3f](./examples/r3f/)
  - examples for the use of picimo components and hooks and the other libraries in a react context
  - start with: `$ yarn examples:r3f`

## Getting involved

Everyone is welcome to contribute to this project, no matter if it's just bug-fixes, new features, ideas or documentation or graphics!

### Development Setup

this repository is structured as a monorepo; based on [yarn workspaces](https://yarnpkg.com/features/workspaces)

#### 1. Install dependencies

you need a current [node v16+](https://nodejs.org/) and [yarn](https://yarnpkg.com/) for it

```sh
$ yarn
```

#### 2. Build and test everything

```sh
$ yarn cbt  # => yarn clean && yarn build && yarn test
```

#### 3. Run examples

Start the examples that can be found under [examples/](./examples/)

```sh
$ yarn examples:vanilla  # or 'examples:r3f'
```
