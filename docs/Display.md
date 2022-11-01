*twopoint5d.js*
# Display

The `Display` class is a cosy boilerplate for creating a three.js `<canvas>` and dealing with the _init_, _resize_ and _frame_ event&#x2011;loop.

Es erleichert erheblich den Umgang mit browser resizes und der frage wie groß der canvas denn eigentlich ist.

Wenn der canvas das ganze fenster (aka 'fullscreen') ausfüllen soll, braucht man keine extra css styles dafür zu setzen, es reicht dem canvas element ein _resize_to_ property zu geben: `<canvas resize-to="window">`

Die _resize-to_ property versteht alternativ zu `window` auch `fullscreen`.

Es ist aber auch möglich, einfach einen document query selector anzuegeben, in diesem falle wird das canvas element immer so groß sein, wie das vom selector adressierte element.

Es funktioniert aber auch komplett ohne _resize-to_!

Der constructor von `Display` erwartet normalerweise das canvas element als ersten parameter.
Alternativ geht aber ein ein beliebiges andere element. In diesem Falle wird das canvas automatisch generiert und unterhalb vom angebenenen element in das dom gehängt. Die größe das canvas richtet sich in diesem Fall an der größe des containers aus. Falls aus Gründen der container keine eigene Größe haben sollte, verwendet der canvas einfach seine standard größe.

Man braucht sich eigentlich keine großen gedanken darüber machen, in dem meisten Fällen verhällt sich der canvas genauso wie man es braucht :sparkles:

Diese verhalten wird in dem Beispiel 
[multiple displays](../examples/vanilla/display.html) demonstriert.


- nice starting point for your three.js demos
- :heavy_check_mark: api is stable and ready to use


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

**domElementOrRenderer** : _HTMLElement | WebGLRenderer_ - Wird als dom element ein canvas angegeben ...

init: canvas vs. dom-el, vs webglrenderer

canvas html `resize-to` attributes: `window`, `fullscreen` or _document-query-selector_

css classes: display3\_\_Display, display3\_\_fullscreen, display3\_\_Container

**options** : _DisplayParameters_ - optional options object that can hold every valid argument from [THREE.WebGLRenderer](...) (except the canvas argument). Zusäzlich gibt es noch die folgenden Optionen:

| option | type | description |
|--------|------|-------------|
| resizeTo | `(display: Display) => [width: number, height: number]` | optional callback that will be called every frame to read out the canvas size |

Folgende Parameter für den WebGLRenderer werden - falls nicht anders angegeben - als default gesetzt:

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

.__resizeToElement__ : _HTMLElement | undefined_ - todo

.__resizeToCallback__ : _(display: Display) => [width: number, height: number] | undefined_ - the resize callback from the options

.__renderer__ : __THREE.WebGLRenderer__ - the renderer instance

.__now__ : _number_ - todo

.__deltaTime__ : _number_ - todo

.__pause__ : _boolean_ - todo

.__pixelRatio__ : _number_ - todo

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

> NOTE(2022-03-15): all states and transitions from the diagram are implemented -
_except_ the _element-is-inside-viewport_ check -
the feature hasn't been built yet and actually hasn't been thought through to the end of whether it's needed at all.
