<p align="center">
  <img width="350" src="docs/images/twopoint5d-700x168.png">
	<br>
  <b>The Art of Tiling 2D Sprites</b>
	<br>
  <em>A refreshingly satisfying 2.5D graphics library built on three.js</em>
</p>


![@spearwolf/three-vertex-objects cover](cover.png)

A collection of typescript classes, functions and utils in the shape of a monorepo. Most of these are centered around building 2.5D games, demos and realtime gfx on the web platform.

:rocket: Some of the features are already quite stable, others are still experimental.

The library comes in two flavors:
- __twopoint5d__: based on _three.js_ and _vanilla js_ all the main features are inside here
- __twopoint5d-r3f__: based on _@react-three/fiber_ and offers all the features as _react_ components and hooks for those who prefer it in a more declarative way

## What are the goals of this project ?

- Make the creation of 2.5D games, demos and realtime gfx as easy and satisfying as possible
- Super easy import and use of gamedev assets and 2D resources from the internet
- First-class pixel-art support and responsive-design awareness

## What are the (planned*) core features ?

- Creation, management and efficient display of 2.5D sprites/particles
  - texture-atlas support
  - sprite-sheet animations
  - billboards!
- Creation, management and display of 2.5D maps
- Import of common texture atlas formats (TexturePacker) and 2.5D-maps* (tiled, LDtk)
- Advanced api for extending and customizing sprite features and 2.5D-map renderers

:warning: However, there are currently no detailed tutorials or comprehensive documentation available - instead, there are
- a number of examples that illustrate the respective features and usage of the api
- some unsorted documents about selected features in the [docs/](docs/) directory

## Examples

Almost all of these examples serve to show individual aspects and usage of the api. Therefore, don't expect any visual masterpieces at this point. This is given to the user of the libraries as an exercise :wink:

- [examples/vanilla](./examples/vanilla/)
  - vanilla three.js examples (no build step required)
  - start with: `$ yarn examples:vanilla`
- [examples/r3f](./examples/r3f/)
  - examples for the usage of _twopoint5d_ components and hooks in a react context based on the fantastic _@react-three/fiber_
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
