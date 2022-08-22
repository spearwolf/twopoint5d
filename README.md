# @spearwolf/three-vertex-objects

A collection of typescript&#x2011;based micro&#x2011;libraries in the shape of a monorepo. Most of these are centered around building 2.5D websites, demos and games with three.js and @react-three/fiber. Some of them are already quite stable, others are still experimental.

## Packages

### three.js

- [@spearwolf/vertex&#x2011;objects](./packages/vertex-objects/)
  - provides an object based abstraction over instanced buffer geometries. build them with your own api
  - create, update and delete instances with ease
  - :heavy_check_mark: api is stable and ready to use
- [@spearwolf/display3](./packages/display3/)
  - cosy boilerplate for creating a three.js &lt;canvas&gt; element and dealing with the _init_, _resize_ and _frame_ event&#x2011;loop
  - nice starting point for your three.js demos
  - there is no other dependency than the three.js package itself
  - :heavy_check_mark: api is stable and ready to use
- [@spearwolf/stage25](./packages/stage25/)
  - create responsive three.js scenes by creating a _projection_ description
  - supports _orthogonal_ and _parallax_ (aka _perspective_) projections (more to come)
  - :heavy_check_mark: api is stable and ready to use
- [@spearwolf/textured&#x2011;sprites](./packages/textured-sprites/)
  - create and render textured 2D sprites
  - load texture atlases
  - animations
  - render as billboards (optional)
  - based on @spearwolf/vertex&#x2011;objects
  - :heavy_check_mark::rocket: ready to use but the api is still in progress
- [@spearwolf/tiled&#x2011;maps](./packages/tiled-maps/)
  - create and render visual tiled maps which are laid out in [a 2D spatial grid map data structure](./packages/tiled-maps/README.md)
  - based on @spearwolf/vertex&#x2011;objects
  - :warning: work in progress
  
### @react-three/fiber

- [picimo](./packages/picimo/)
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

## Getting started

this repository is structured as a monorepo; based on [yarn workspaces](https://yarnpkg.com/features/workspaces)

### 1. Install dependencies

you need a current [node v16+](https://nodejs.org/) and [yarn](https://yarnpkg.com/) for it

```sh
$ yarn
```

### 2. Build and test everything

```sh
$ yarn cbt  # => yarn clean && yarn build && yarn test
```

### 3. Run examples

Start the examples that can be found under [examples/](./examples/)

```sh
$ yarn examples:vanilla  # or 'examples:r3f'
```
