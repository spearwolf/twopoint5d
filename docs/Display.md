<img width="150" src="images/twopoint5d-700x168.png">

# Display

The `Display` class is a cosy boilerplate for creating a three.js `<canvas>` and dealing with the _init_, _resize_ and _frame_ event&#x2011;loop.

It makes it much easier to deal with browser resizes and the question of how the dimension of the canvas actually is and should be.

If you want the canvas to fill the whole window (aka 'fullscreen'), you don't need to
set extra css styles for it, all what you need is to give the canvas element a
_resize_to_ attribute: `<canvas resize-to="window">`

The _resize-to_ attribute also understands `fullscreen` as an alternative to `window`.

However, it is also possible to simply specify a document query selector, in which case the canvas element will always be as large as the element addressed by the selector.

But it also works completely without _resize-to_ !

> TODO time helpers, chronometer

> TODO eventized class


## Quickstart

```jsx
<canvas id="twopoint5d" resize-to="window"></canvas>


const canvasElement = document.getElementById( "twopoint5d" );
const display = new Display( canvasElement );

let camera, scene, renderer;

display.on({

    init ({ renderer, width, height }) {

        camera = new THREE.PerspectiveCamera( 70, width / height, 1, 1000 );
        camera.position.z = 400;

        scene = new THREE.Scene();

    }

    resize ({ width, height }) {

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

    }

    frame ({ renderer }) {

        renderer.render( scene, camera );

    }

})

display.start()

```


## Examples

- [stage2d](../examples/vanilla/stage2d.html)
- [multiple displays](../examples/vanilla/display.html)
- [persepective orbit demo](../examples/vanilla/jsm/display/PerspectiveOrbitDemo.js)


## Constructor

### Display(domElementOrRenderer, options?)

**domElementOrRenderer** : _HTMLElement | WebGLRenderer_ - The constructor normally expects the canvas element as first parameter.

Alternatively, any other element can be used. In this case the canvas is automatically generated and placed below the specified element in the dom. In this case the size of the canvas depends on the size of the container. If for some reason the container does not have its own size, the canvas simply uses its default size.

You don't really need to worry about this, in most cases the canvas will behave exactly as you expect :sparkles:

This behavior is shown in the example [multiple displays](../examples/vanilla/display.html).

> TODO init: canvas vs. dom-el, vs webglrenderer

> TODO css classes: display3\_\_Display, display3\_\_fullscreen, display3\_\_Container


**options** : _object_ - optional options object that can hold every valid argument from [THREE.WebGLRenderer](https://threejs.org/docs/index.html?q=webglre#api/en/renderers/WebGLRenderer) (except the _canvas_ parameter, it will be simply ignored).
In addition, there are also the following options:

| option | type | description |
|--------|------|-------------|
| resizeTo | `(display: Display) => [width: number, height: number]` | optional callback - if specified, this function is called on each frame and the result is used to update the dimension of the canvas |
| resizeToElement | `HTMLElement` | normally the canvas or the container element is used for (re)sizing. with this you can explicitly set the reference element. can be very helpful if you create the canvas e.g. in a shadow-dom, but want to use the web-component element from the parent dom as reference for the size |
| resizeToAttributeEl | `HTMLElement` | the element where a `resize-to` attribute is listened for. this is by default the canvas itself |
| styleSheetRoot | `HTMLElement` or `ShadowRoot` | where to install the stylesheets. this is by default the `document.head`, but can of course also be a shadow-dom root |

The following parameters for the _WebGLRenderer_ are set as default unless otherwise specified:

| parameter | default |
|-----------|---------|
| precision | `highp` |
| preserveDrawingBuffer | _false_ |
| powerPreference | `high-performance` |
| stencil | _false_ |
| alpha | _true_ |
| antialias | _true_ |


## Properties

.__width__ : _number_ - width of the canvas

.__height__ : _number_ - height of the canvas

.__frameNo__ : _number_ - the current frame number. starts at 0

.__resizeToElement__ : _HTMLElement | undefined_ - the element which is taken as reference for the dimension of the canvas

.__resizeToCallback__ : _(display: Display) => [width: number, height: number] | undefined_ - if specified, this function is called on each frame and the result is used to update the dimension of the canvas

.__renderer__ : _THREE.WebGLRenderer_ - the renderer instance

.__now__ : _number_ - The current time in seconds. starts at 0. 0 is the time at which the display is instantiated. time does not elapse until the display has been started with `.start()`. at the beginning of an _animation frame_ the time is updated. within a frame the time remains unchanged.

.__deltaTime__ : _number_ - The time that has elapsed since the previous frame and the current frame time. Note that the pause times are subtracted here - so it is the time elapsed during the active phases.

.__pause__ : _boolean_ - the pause status. readable but also settable. note a paused display freezes the time and will never emit a _frame_ event. this is also the reason why the `deltaTime` does not continue to tick. only again when the pause is ended.

.__pixelRatio__ : _number_ - the current device pixel ratio. is also read by the .resize() method.

## Methods

.__resize__() - todo

.__renderFrame__(now?: _number_) - todo

.__start__(beforeStartCallback?: _function_) : _Promise&lt;Display&gt;_ - todo

.__stop__() - todo

.__dispose__() - todo

.__getEventArgs__(): object - todo


All methods from @spearwolf/eventize are available


## Events

Alle events bekommen die argumente von _getEventArgs()_

__init__ - todo

__start__ - todo

__resize__ - todo

__frame__ - todo

__restart__ - todo

__pause__ - todo

__dispose__ - todo


## State and Events

![Display state and events](./display/display-state-and-events.svg)

> ⚠️NOTE(2022-03-15): all states and transitions from the diagram are implemented -
_except_ the _element-is-inside-viewport_ check -
the feature hasn't been built yet and actually hasn't been thought through to the end of whether it's needed at all.
