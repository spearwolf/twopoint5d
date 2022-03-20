# three-vertex-objects

...

## What is included

| package | status |  description |
|-|-|-|
| [@spearwolf/vertex&#x2011;objects](./packages/vertex-objects/) | :heavy_check_mark:&#x202f;_READY&#x202f;FOR&#x202f;USE_ | describe, create and render [three.js &rarr; buffer geometries](https://threejs.org/) containing lots of instances of _sprites_. render at light speed (just one _webgl draw call_ per _sprite group_) and manage your sprites with your own _object based_ api |
| [@spearwolf/tiled&#x2011;maps](./packages/tiled-maps/) | :warning:&#x202f;*WORK&#x202f;IN&#x202f;PROGRESS* | create and render _2d-maps_ (with _vertex-objects_) that are laid out in a 2d spatial grid map data structure |
| [@spearwolf/display3](./packages/display3/) | :heavy_check_mark:&#x202f;_READY&#x202f;FOR&#x202f;USE_ | cosy boilerplate for creating a _three.js canvas_ and dealing with the _init_, _resize_ and _frame_ event loop. nice starting point for your _three.js_ demos, there is no other dependency than the _three.js_ package itself |
| [@spearwolf/stage25](./packages/stage25/) | :heavy_check_mark:&#x202f;_READY&#x202f;FOR&#x202f;USE_ | ... |
| [@spearwolf/textured&#x2011;sprites](./packages/textured-sprites/)| :heavy_check_mark:&#x202f;*READY&#x202f;FOR&#x202f;USE :rocket:&#x202f;NEW&#x202f;FEATURES&#x202f;ON&#x202f;THE&#x202f;WAY* | ... |
| [@spearwolf/kobolde](./packages/kobolde/) | :warning:&#x202f;*WORK&#x202f;IN&#x202f;PROGRESS* :rocket:&#x202f;*NEW&#x202f;FEATURES&#x202f;ON&#x202f;THE&#x202f;WAY* | ... |

| API usage examples | description |
|-|-|
| [examples](./examples/) | ... |
| [r3f&#x2011;examples](./r3f-examples/) | ... |


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
$ yarn start
```
