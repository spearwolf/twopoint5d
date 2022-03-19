This repository contains the implementation of **vertex-objects**, which on the one hand contains the main library (&rarr; [vertex-objects](./vertex-objects/)), but also some specialized companion libraries, as well as tests and examples.

_three-vertex-objects_ is the next iteration (in an evolutionary sense) of the [picimo](https://github.com/spearwolf/picimo) library, freeing itself from the corners and edges that have grown over time.

This repository is structured as a monorepo; based on [yarn workspaces](https://yarnpkg.com/features/workspaces).

## What is included

| library | description |
|-|-|
| [three&#x2011;vertex&#x2011;objects](./vertex-objects/) | the main library which provides an api for the definition and management of [vertex objects](./ThinkTank.md) based on [three.js](https://threejs.org/) |
| [three&#x2011;tiled&#x2011;maps](./three-tiled-maps/) | a library that builds on the concept of [vertex objects](./ThinkTank.md) an api for rendering [2D maps](./three-tiled-maps/src/README.md) (very experimental and not in a finalized state &mdash; still in progress) |
| [three&#x2011;stages](./three-stages/) | _stages_ and responsive design aware _projections_ help you to deal with viewport dimensions and cameras |

| API usage examples | description |
|-|-|
| [`examples`](./examples/) | simple code examples for usage of [vertex-objects](./vertex-objects/) and companion libraries. just plain and native javascript here, no complicated build setup is needed (instead browser native [import-maps](https://caniuse.com/import-maps) are used) |


## Getting started

### 1. Install dependencies

you need a current [node v16+](https://nodejs.org/) and [yarn](https://yarnpkg.com/) for it

```sh
$ yarn
```

### 2. Build and test everything

```sh
$ yarn build
$ yarn test
```

there is also a shortcut for `clean` &rarr; `build` &rarr; `test`

```sh
$ yarn cbt
```


### 3. Run examples

Start the examples that can be found under [examples/](./examples/)

```sh
$ yarn start
```
