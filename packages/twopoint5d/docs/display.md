# Display: resolution and frame rate

What a frame costs the GPU is, above all, its pixels: every pass of a frame — the scene, the
shadows, every step of a bloom, the copy onto the canvas — shades each pixel of a render target
that follows the size of the drawing buffer. A phone of 1080 × 2400 device pixels at its full
pixel ratio shades 2.6 million of them a pass, more than a desktop screen of 1920 × 1080. The
`Display` decides how many there are. This guide walks through its knobs, from the defaults to a
display that holds its frame rate by itself.

| knob | what it does | default |
| --- | --- | --- |
| `antialias` (option) | four samples per pixel in the renderer and in the scene pass of a `RenderPipeline` | `false` |
| `maxPixelRatio` | the device pixels per CSS pixel at most | `2` |
| `pixelZoom` | the drawing buffer at the resolution of the art, a whole number of device pixels per pixel | `0`, off |
| `maxPixels` | a budget of pixels for the drawing buffer | `0`, off |
| `resolutionScale` | a factor on the pixel ratio | `1` |
| `adaptiveResolution` (option) | a controller that sets `resolutionScale` by the cost of every frame | off |

## The defaults

A `Display` that is told nothing draws at most at **2 device pixels per CSS pixel**
(`Display.DefaultMaxPixelRatio`) and builds its renderer **without multisampling**. Beyond a ratio
of 2 a phone screen shows hardly more detail, but a ratio of 3 shades 2.25 times as many pixels.

Multisampling smooths the edges of geometry only: the polygons of a mesh, lines, a turned quad
whose texture is opaque up to its border. It does nothing for pixel art, whose edges lie on its
pixel grid, nothing for sprites cut out by the alpha test — grass, leaves — and little for sprites
blended over a transparent border, which texture filtering smooths already. Under a
`RenderPipeline` it is expensive: the scene pass renders four samples per pixel into half floats
and resolves them before the bloom even starts. A scene of geometry asks for it:

```ts check
import {Display} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('canvas')!, {antialias: true, maxPixelRatio: 0});

export {display};
```

`maxPixelRatio: 0` lifts the bound, and the display draws at the full `devicePixelRatio` again.

## Pixel art at its own resolution

With `pixelZoom` above `0` the drawing buffer holds the art at its own resolution — one pixel of
the buffer is one pixel of the art — and the browser scales the canvas up, `pixelated`. A phone of
1080 × 2400 device pixels with the art drawn 2 device pixels large shades 540 × 1200 pixels a frame,
and every pass after the scene works on that small image too.

`pixelZoom` counts CSS pixels per pixel of the art, and the display rounds it **down to whole device
pixels**: a zoom of 2 is 4 device pixels at a ratio of 2 and 5 at a ratio of 2.625, where 5.25 would
draw the pixels 5 and 6 device pixels wide by turns. `devicePixelZoom` reads what the rounding made
of it. Rounded down, a pixel is never larger than asked for, so a zoom at which a view fits exactly
is the largest whole zoom at which at least that much of the art fits — whatever the ratio of the
screen:

```ts check
import {Display, OrthographicProjection, Stage2D} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('canvas')!);

// as large as fits at least 400 × 240 pixels of the art on the screen
const fit = () => {
  display.pixelZoom = Math.min(window.innerWidth / 400, window.innerHeight / 240);
};
fit();
// a new zoom takes effect with the next measurement, which emits the resize again
display.onResize(fit);

// one unit of the view is one pixel of the buffer, and so one pixel of the art
const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {pixelZoom: 1}));

export {display, stage};
```

What follows from the zoom:

- `width` and `height` count pixels of the buffer, as many whole ones as fit into the size source.
  The canvas takes just their size, up to one pixel of the art short of the size source on its
  right and bottom edge — stretched to the full size, the pixels would be uneven again.
- `pixelRatio` is `1`; `maxPixelRatio` and `resolutionScale` do not apply. `maxPixels` raises the
  zoom instead, to the smallest whole zoom at which the buffer stays within the budget.
- A pixel of the art is `devicePixelZoom / devicePixelRatio` CSS pixels large. A pointer position
  divides by that, not by `pixelZoom`:

  ```ts
  canvas.addEventListener('pointermove', (event) => {
    const x = (event.offsetX * display.devicePixelRatio) / display.devicePixelZoom;
    const y = (event.offsetY * display.devicePixelRatio) / display.devicePixelZoom;
  });
  ```

- `styleImageRendering` pins `image-rendering` to `'pixelated'` or `'auto'`; without it the
  display writes `pixelated` while the zoom is above `0`.

The zoom of a projection — `OrthographicProjection` with `{pixelZoom: 2}` on a display without a
zoom — draws the art as large, but in a drawing buffer at the full pixel ratio: four times the
pixels of a display zoom of 2, at the same look.

## A budget of pixels

`maxPixelRatio` bounds the density, not the cost: a 4K screen at a ratio of 1 has 8.3 million
pixels, and no ratio bound touches it. `maxPixels` bounds the pixels themselves — the display draws
at a ratio of at most `sqrt(maxPixels / (width × height))`, width and height in CSS pixels:

```ts check
import {Display} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('canvas')!, {maxPixels: 3_000_000});

export {display};
```

A budget of 3 million leaves a phone of 412 × 915 CSS pixels at its ratio of 2 — 1.5 million
pixels — and draws a 4K screen at a ratio of 0.5, rounded down from 0.6. Where the ratio falls below
`1`, the browser scales the canvas up, smoothly: that is dynamic resolution, fine for smooth images,
not for pixel art, which takes a `pixelZoom` instead.

## Resolution scale

`resolutionScale` multiplies the pixel ratio the bounds leave: `0.75` shades 56 % of the pixels.
It is what `adaptiveResolution` moves, and it may be set by hand — a quality setting, say. It does
not apply under a `pixelZoom`.

## The pixel ratio, put together

Without a `pixelZoom`, the display draws at

```text
min(devicePixelRatio, maxPixelRatio, sqrt(maxPixels / cssArea)) × resolutionScale
```

device pixels per CSS pixel, each bound only where it is set. Where the budget or the scale has
made the ratio, it is rounded **down to a step of an eighth**, at least an eighth: three builds every
render target of a pipeline anew with every new size, and in steps the sizes change less often and
come back to the same values. Where neither has, the ratio stays exact — `devicePixelRatio` itself,
or `maxPixelRatio` — so a canvas at the ratio of its screen maps one pixel of the buffer onto one
device pixel. `Display.MaxResolution` (8192) bounds the buffer per axis in the end.

A change of any of these knobs takes effect with the next measurement — at the start of the next
frame, or right away with a `resize()` of your own — and emits `OnDisplayResize`. `width` and
`height` stay in CSS pixels: stages, cameras and layout notice nothing but a smaller buffer.

## Adaptive resolution

```ts check
import {Display} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('canvas')!, {adaptiveResolution: true});

const adaptive = display.adaptiveResolution!;
adaptive.method; //   'gpu-time' or 'frame-pacing', undefined before the first frame
adaptive.scale; //    the resolutionScale it has set
adaptive.gpuTime; //  the median GPU time of the frames it judged last, in ms

export {display};
```

The display builds an `AdaptiveResolution`, which holds **60 frames per second** — or the `maxFps`
of the display where that is lower — by `resolutionScale`: down a step of an eighth where a frame
costs more than the target allows, up a step where there is room for the pixels of it, between
`0.5` and `1`. Options of its own instead of `true`:

```ts
new Display(canvas, {adaptiveResolution: {targetFps: 30, minScale: 0.25, maxScale: 1}});
```

The controller reads the cost of a frame in one of two ways, see `adaptive.method`:

- **`gpu-time`**: the time the GPU spent on the frame, through the timestamp queries of three —
  `timestamp-query` under WebGPU, `EXT_disjoint_timer_query_webgl2` under WebGL 2. The GPU may take
  80 % of the frame interval, 13.3 ms at 60 frames per second. A window of 12 measured frames is
  judged by its median, which a single spike does not move: above the budget the scale goes down a
  step, above 1.5 times the budget two. It goes up a step where the time of the window, scaled by
  the pixels of that step, stays below 90 % of the budget three windows in a row.
- **`frame-pacing`**: where the renderer measures no GPU time. 3 frames of 30 that come later than
  1.5 frame intervals take the scale down a step. A frame on time shows no headroom, so after 180
  clean frames the controller tries a step up and keeps it where the next two windows stay clean;
  a try that fails goes back, and the next try waits twice as long, up to 3600 frames.

After every resize — the ones of its own steps included —, a start and a restart, the controller
lets 30 frames pass before it judges again: shaders compile and the render targets are built anew
in them, and a measurement that started before is dropped.

What to know about it:

- A display that builds its renderer asks it for `trackTimestamp: true`, which `gpu-time` needs. A
  renderer handed to the constructor, a WebGPU adapter without `timestamp-query` and a WebGL 2
  without the timer extension — Android Chrome often hides it — leave `frame-pacing`.
- `frame-pacing` cannot tell the GPU from the CPU. A frame held up by JavaScript takes the scale
  down as well, which helps nothing; `minScale` is how far that goes.
- Under a `pixelZoom` the controller holds still: pixel art keeps its size.
- `adaptive.enabled = false` holds it still and gives the display back the `resolutionScale` it had
  when the controller took over; `true` takes over again. `adaptive.dispose()` lets go for good, and
  a disposed display lets go of its controller.

The controller works without the option as well, on a display of one's own renderer:

```ts check
import {AdaptiveResolution, Display} from '@spearwolf/twopoint5d';
import {WebGPURenderer} from 'three/webgpu';

const renderer = new WebGPURenderer({canvas: document.querySelector('canvas')!, trackTimestamp: true});
const display = new Display(renderer);
const adaptive = new AdaptiveResolution(display, {targetFps: 30});

export {adaptive};
```

## Pipelines

Every render target of a `RenderPipeline` — the scene pass, the half and smaller targets of a
bloom — follows the size of the drawing buffer, so every knob above counts for all of them. The
`StageRenderer` leaves its own clear of the target a pipeline draws into to three where
`renderer.autoClear` covers it: on the canvas that clear would cost a full-screen draw of its own.
See [the stage cheat-sheet](../src/stage/README.md).

## Measured

The swaying grass of the lookbook — sprites cut out by the alpha test, their shadows and a bloom —
on an AMD Radeon 610M under WebGL 2, the CSS size of a Pixel 7, 412 × 915 at a ratio of 2.625:

| setup | drawing buffer | GPU per frame |
| --- | --- | --- |
| full ratio, four samples | 1081 × 2401 | 9.5 ms |
| full ratio, no samples | 1081 × 2401 | 5.2 ms |
| the same, without the clear of the stage renderer | 1081 × 2401 | 4.3 ms |
| ratio 2, the defaults | 824 × 1830 | 2.5 ms |
| ratio 1.5 | 618 × 1372 | 1.7 ms |

At 4K and a ratio of 2 the same meadow takes 42 ms a frame; `adaptiveResolution` goes down to its
`minScale` of 0.5 in two windows — the first one two steps at once — and holds 11.4 ms there,
below the budget of 13.3 ms. With the timer extension taken away, `frame-pacing` gets there in four
steps of about two seconds each.

## Trying it on a phone

WebGPU needs a secure context: a page from `http://192.168.…` of the lookbook's dev server runs
under WebGL 2. `localhost` counts as secure, so the phone reaches WebGPU through
`adb reverse tcp:4321 tcp:4321` and `http://localhost:4321/lookbook/`. The swaying grass shows
the drawing buffer, the scale, the method and the GPU time in its `output` folder; the sine
scroller fits its pixel art with the zoom above.
