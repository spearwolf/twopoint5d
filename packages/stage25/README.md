# @spearwolf/stage25

:rocket: _responsive scenes for threejs_

[![npm version](https://badge.fury.io/js/@spearwolf%2Fdisplay3.svg)](https://badge.fury.io/js/@spearwolf%2Fdisplay3)

```js
import { Stage2D, ParallaxProjection } from "@spearwolf/stage25"
import { Display } from "@spearwolf/display3"

const projection = new ParallaxProjection("xy|bottom-left", {
    width: 640,
    height: 400,
    fit: 'contain',
    minPixelZoom: 2,
})

const stage = new Stage2D(projection)

stage.scene  // => THREE.Scene

const canvasEl = document.querySelector('canvas')
const display = new Display(canvasEl)

display.on({
  resize({ width, height }) {
      stage.resize(width, height)
      
      // the effective dimension, may or may not be equal to the container,
      // depending on the projection description
      stage.width
      stage.height

      // the container dimension from resize()
      stage.containerWith  // === width
      stage.containerHeight  // === height
  }
  
  frame({ renderer }) {
      stage.renderFrame(renderer)
  }
})
```
(_the use of `Display` is optional, it is used only for better illustration_)

## Stage2D

A *stage* is a facade for a *scene* with a *camera*.
The camera is managed by means of a *projection* description.

## Projection

...
