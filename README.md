__three-vertex-objects__ is the next iteration of the [picimo](https://github.com/spearwolf/picimo) library

__three-vertex-objects__ is a monorepo, [yarn v2+](https://yarnpkg.com/) is used as toolchain.

## What is included

| library | description |
|-|-|
| [three-vertex-objects](./three-vertex-objects/) | the base library which provides an api for the definition and management of __vertex objects__ based on [three.js](https://threejs.org/) |
| [three-tiled-maps](./three-tiled-maps/) | a library that builds on the concept of __vertex objects__ an api for rendering 2d maps |
| [r3f-vertex-objects](./r3f-vertex-objects/) | a library that contains components, hooks and helpers which simplifies the use of the __three-vertex-objects__ library within [react-three-fiber](https://github.com/pmndrs/react-three-fiber) |
| [r3f-tiled-maps](./r3f-tiled-maps/) | a library that contains components, hooks and helpers which simplifies the use of the __three-tiled-maps__ library within [react-three-fiber](https://github.com/pmndrs/react-three-fiber) |

| API usage examples | description |
|-|-|
| [examples](./examples/) | API usage examples for the __three-vertex-objects__ and __three-tiled-maps__ libraries. just plain javascript here, no framework is used. |
| [r3f-examples](./r3f-examples/) | API usage examples for the __r3f-vertex-objects__ and __r3f-tiled-maps__ libraries based upon react and react-three-fiber |


## Getting started

### 1. Install dependencies

you need a current [node v16+](https://nodejs.org/) and [yarn](https://yarnpkg.com/) for it:

`$ yarn`

### 2. Build and test everything

```sh
$ yarn build
$ yarn test
```

there is also a shortcut for `clean` &rarr; `build` &rarr; `test`:

`$ yarn cbt`


### 3. Run examples

Start the examples that can be found under [./examples/](./examples/):

`$ yarn start`

Start the __react__ examples that can be found under [./r3f-examples/](./r3f-examples/):

```sh
$ cd r3f-examples
$ yarn start
```

