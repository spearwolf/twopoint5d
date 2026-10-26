# Display: resolution and frame rate

What a frame costs the GPU is, above all, its pixels: every pass of a frame — the scene, the
shadows, every step of a bloom, the copy onto the canvas — shades each pixel of a render target
that follows the size of the drawing buffer. The `Display` decides how many there are. The same
phone screen can cost 2.6 million pixels a pass or a tenth of a million, depending on four or five
settings:

![One phone screen of 412 × 915 CSS pixels at a devicePixelRatio of 2.625, drawn four ways: at
every device pixel (2.6 M pixels a pass), with the defaults (1.5 M), with adaptive resolution at a
scale of 0.75 (0.85 M) and as pixel art at a zoom of 2 (0.1 M)](images/display/display-setups-on-a-phone.svg)

This guide starts from what you want to draw — pixel art, a display that holds its frame rate, or
a display as sharp as the screen allows — and gives each a recipe to copy. A cheat sheet of every
setting follows, then the reference: how each setting works and how they play together.

- [Which setup?](#which-setup)
- [Pixel art](#pixel-art)
- [A fast display: adaptive resolution](#a-fast-display-adaptive-resolution)
- [A premium display: every device pixel](#a-premium-display-every-device-pixel)
- [Fullscreen](#fullscreen)
- [Cheat sheet](#cheat-sheet)
- [Reference](#reference)

## Which setup?

![A decision tree: pixel art that lives entirely on the grid of the art takes a display pixelZoom;
pixel art beside smooth layers takes pixelSnap on the projection; smooth images and 3D take
adaptiveResolution where the detail may give way, and maxPixelRatio 0 where the frame rate
may](images/display/display-choose-a-setup.svg)

| you want | the one setting | what you get |
| --- | --- | --- |
| pixel art, as cheap as it gets | `display.pixelZoom` | a drawing buffer at the resolution of the art, scaled up `pixelated` by the browser |
| pixel art beside smooth content | `pixelSnap: true` in the fit of the projection | pixel art at whole pixels of a full-resolution buffer |
| a steady frame rate | `adaptiveResolution: true` | a controller that lowers the resolution when frames get expensive, and raises it again |
| the sharpest image | `maxPixelRatio: 0` | one pixel of the buffer per device pixel |

There is no preset object to pass: each setup is a handful of settings, and the recipes below are
the presets. Every recipe is a complete program — a `Display`, a `Stage2D` and a `StageRenderer`
that draws the stage into the display, as in [the stage cheat-sheet](../src/stage/README.md).

## Pixel art

### Pixel art in three settings

```ts check
import {Display, OrthographicProjection, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';

// <canvas resize-to="window"></canvas>: the canvas fills the window
const display = new Display(document.querySelector('canvas')!);

// every pixel of the art 3 CSS pixels large
display.pixelZoom = 3;

// one unit of the stage is one pixel of the art, with the edges of the view on whole units
const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {pixelZoom: 1, pixelSnap: true}));
new StageRenderer(display).add(stage);

display.start();

export {display, stage};
```

Three settings do the work:

- **`display.pixelZoom`** puts the art into the drawing buffer at its own resolution — one pixel of
  the buffer is one pixel of the art — and the browser scales the canvas up, `pixelated`. It is
  the cheapest setup there is: a phone of 1080 × 2400 device pixels with the art drawn 5 device
  pixels large shades 216 × 480 pixels a frame, and every pass after the scene works on that small
  image too.
- **`{pixelZoom: 1}`** on the projection makes one unit of the stage one pixel of the buffer, so
  the positions and the sizes of sprites count pixels of the art.
- **`pixelSnap: true`** puts the edges of the view on whole units. Without it, a buffer of an odd
  width centres the view on half a pixel, and every texel sits half a pixel off the grid.

Textures of pixel art want `nearest` filtering, which is what a `TextureFactory` applies when it is
told nothing else — see [textures](textures.md).

### How large: picking the zoom

`pixelZoom` counts CSS pixels per pixel of the art, and the display rounds it **down to whole
device pixels**: a zoom of 2 is 4 device pixels at a ratio of 2 and 5 at a ratio of 2.625, where
5.25 would draw the pixels 5 and 6 device pixels wide by turns. `devicePixelZoom` reads what the
rounding made of it.

![A strip of 26 device pixels at a devicePixelRatio of 2.625: at 5.25 device pixels per pixel of
the art the widths come out 5, 5, 5, 6, 5; rounded down to 5, every pixel is 5 device pixels wide
and the strip ends one device pixel short](images/display/display-pixel-zoom-rounding.svg)

Rounded down, a pixel is never larger than asked for. So a zoom worked out from the size of the
screen and the view you need is the largest whole zoom at which at least that view fits, whatever
the ratio of the screen:

| you want | write | on a 1920 × 1080 window at a ratio of 1 |
| --- | --- | --- |
| every pixel of the art the same size, the view grows with the window | `display.pixelZoom = 3` | 640 × 360 pixels of the art |
| at least 400 × 240 pixels of the art, as large as fits | `display.pixelZoom = Math.min(innerWidth / 400, innerHeight / 240)` | zoom 4.5 → 4: 480 × 270 |
| at least 180 lines, any width | `display.pixelZoom = innerHeight / 180` | zoom 6: 320 × 180 |

The zoom that follows the window is set again with every resize:

```ts check
import {Display, OrthographicProjection, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';

// <canvas resize-to="window">: the window is the size source, and the zoom is worked out from it
const display = new Display(document.querySelector<HTMLCanvasElement>('canvas[resize-to="window"]')!);

// as large as fits at least 400 × 240 pixels of the art on the screen
const fit = () => {
  display.pixelZoom = Math.min(window.innerWidth / 400, window.innerHeight / 240);
};
fit();
// a new zoom takes effect with the next measurement, which emits the resize again
display.onResize(fit);

const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {pixelZoom: 1, pixelSnap: true}));
new StageRenderer(display).add(stage);

// how much of the art the screen shows: display.width × display.height pixels of the art
display.onResize(({width, height}) => console.log(`${width} × ${height}`));

display.start();

export {display, stage};
```

What follows from the zoom:

- `width` and `height` count pixels of the buffer — of the art —, as many whole ones as fit into
  the size source. The canvas takes just their size, up to one pixel of the art short of the size
  source on its right and bottom edge: stretched to the full size, the pixels would be uneven
  again. Give the page behind the canvas the clear colour of the stage, and the strip goes unseen.
  A canvas that is its own size source keeps the size it had without the zoom as that source,
  through every change of the zoom.
- `pixelRatio` is `1`; `maxPixelRatio`, `resolutionScale` and `adaptiveResolution` do not apply.
  `maxPixels` raises the zoom instead, to the smallest whole zoom at which the buffer stays within
  the budget.
- A pixel of the art is `devicePixelZoom / devicePixelRatio` CSS pixels large. A pointer position
  divides by that, not by `pixelZoom`:

  ```ts check
  import {Display} from '@spearwolf/twopoint5d';

  const canvas = document.querySelector('canvas')!;
  const display = new Display(canvas);
  display.pixelZoom = 2;

  canvas.addEventListener('pointermove', (event) => {
    const x = (event.offsetX * display.devicePixelRatio) / display.devicePixelZoom;
    const y = (event.offsetY * display.devicePixelRatio) / display.devicePixelZoom;
  });

  export {display};
  ```

- `styleImageRendering` pins `image-rendering` to `'pixelated'` or `'auto'`; without it the
  display writes `pixelated` while the zoom is above `0`.
- A `pixelZoom` that is not a positive finite number — `NaN`, `Infinity`, a negative one — counts
  as `0`.

### Pixel art through a projection: `pixelSnap`

A display zoom draws everything at the resolution of the art: a turned sprite turns in pixels of
the art, a text of a smooth font comes out as blocky as the sprites, a scroll moves in whole
pixels of the art. Where that is too coarse, the art goes into a drawing buffer at the full pixel
ratio, and the projection zooms it. That costs as many pixels as any smooth scene, and it stays
crisp only where every pixel of the art covers the same whole number of pixels of the buffer, and
where the edges of its texels fall on the edges of those pixels. `pixelSnap: true` beside the fit
of an `OrthographicProjection` or a `ParallaxProjection` takes care of both:

![Three strips of pixels of the drawing buffer. A zoom of 2.5 buffer pixels samples texels 2 and
3 pixels wide by turns; pixelSnap rounds it to 2. A view 7 units wide centred on the camera puts
texel edges through every third pixel centre at a zoom of 3; pixelSnap moves the left edge to −3
and the texel edges onto the pixel edges](images/display/display-pixel-snap.svg)

- **The zoom counts pixels of the buffer.** A `StageRenderer` hands the `pixelRatio` of its display
  on to its stages with their size, and the projection rounds the zoom times that ratio to a whole
  number — down for `pixelZoom` and `contain`, so at least the asked-for view stays visible; up for
  `cover`, so the view still covers the canvas; never below 1. The zoom in CSS pixels is then in
  general no whole number: 3 pixels of the buffer at a ratio of 1.25 are 2.4 CSS pixels.
- **The edges of the frustum lie on whole units.** The left and the bottom edge of the view sit at
  `-Math.floor(width / 2)` and `-Math.floor(height / 2)` units from the point the camera looks at,
  so the middle of the view lies up to a unit right of and above that point.
  `getViewRect()` reports that shift in `offsetX` and `offsetY` — `0` without `pixelSnap`.

```ts check
import {Display, OrthographicProjection, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';

const canvas = document.querySelector('canvas')!;
const display = new Display(canvas);

// the largest whole zoom at which at least 480 × 288 pixels of the art fit
const projection = new OrthographicProjection('xy|bottom-left', {
  fit: 'contain',
  width: 480,
  height: 288,
  pixelSnap: true,
});
const stage = new Stage2D(projection);
new StageRenderer(display).add(stage);

// a pointer position in units of the view, measured from the point the camera looks at
canvas.addEventListener('pointermove', (event) => {
  const view = projection.getViewRect();
  const x = (event.offsetX - canvas.clientWidth / 2) / view.pixelRatioX + view.offsetX;
  const y = (canvas.clientHeight / 2 - event.offsetY) / view.pixelRatioY + view.offsetY;
});

export {display, stage};
```

`contain` shows at least the view it names, and more where the screen has another shape; `cover`
with a `height` alone — `{fit: 'cover', height: 180, pixelSnap: true}` — fills the canvas with at
most 180 lines of the art, as the platformer of the lookbook does.

What follows from it:

- Sprites and the camera keep the texels whole as long as they sit on whole units — the strict
  look of a retro game — or on multiples of `1 / zoom` units, one pixel of the buffer.
- A `ParallaxProjection` shifts the window of its camera with `setViewOffset()` and leaves the
  camera, its field of view and `getParallaxFactor()` as they are. Only the projection plane is
  pixel-exact: a layer in front of or behind it is drawn `getScaleFactor()` times as large. Under
  `pixelSnap` the projection owns the view offset of the cameras it places; without it, it clears
  only an offset it wrote itself.
- Under a display `pixelZoom` the buffer already holds the art, the ratio is `1`, and `pixelSnap`
  makes every unit a whole number of pixels of the buffer on top of it — the cheapest pixel-exact
  setup, the one of [pixel art in three settings](#pixel-art-in-three-settings).
- The buffer has to reach the screen one to one for the pixels to stay even there. A
  `maxPixelRatio` below the `devicePixelRatio` scales the buffer up — a ratio of 2 on a screen of
  3 by 1.5 —, and so does a `resolutionScale` below `1`. A display for `pixelSnap` on a screen
  above a ratio of 2 takes `maxPixelRatio: 0`.
- `adaptiveResolution` does not go together with `pixelSnap`: every step of the scale changes the
  pixel ratio, the whole zoom follows it, and the visible part of the world grows or shrinks
  mid-game. Pixel art that has to save pixels takes a display `pixelZoom`, under which the
  controller holds still.
- A stage driven without a `StageRenderer` gets the ratio as the third argument of
  `stage.resize(width, height, pixelRatio)`, a projection of its own as that of
  `updateViewRect(width, height, pixelRatio)`; without it, the ratio is `1`.
- `minPixelZoom` and `maxPixelZoom` hold the zoom before it is rounded, so the rounded zoom can
  lie beyond one of them by less than one pixel of the buffer.

The zoom of a projection **without** `pixelSnap` — `OrthographicProjection` with `{pixelZoom: 2}`
on a display without a zoom — draws the art as large, but its texels come out uneven wherever the
pixel ratio is no whole number, and it shades four times the pixels of a display zoom of 2, at the
same look.

### A display zoom or `pixelSnap`?

| | display `pixelZoom` | `pixelSnap` on the projection |
| --- | --- | --- |
| drawing buffer | the resolution of the art | the full pixel ratio |
| cost | the lowest of all setups | that of a smooth scene |
| a turned or scaled sprite | turns in pixels of the art | turns in pixels of the screen |
| text of a smooth font, gradients, 3D | blocky, at the resolution of the art | sharp |
| the smallest step of a scroll | one pixel of the art | one pixel of the buffer |
| `adaptiveResolution` | holds still | does not go together with it |
| `maxPixelRatio` | does not apply | `0`, so the buffer reaches the screen one to one |

### Pixel-art presets

| preset | display | projection | shows |
| --- | --- | --- | --- |
| retro, fixed zoom | `pixelZoom = 3` | `{pixelZoom: 1, pixelSnap: true}` | more of the world on a larger window |
| at least a view | `pixelZoom = Math.min(innerWidth / 400, innerHeight / 240)`, again on every resize | `{pixelZoom: 1, pixelSnap: true}` | at least 400 × 240, as large as fits |
| fixed number of lines | `pixelZoom = innerHeight / 180`, again on every resize | `{pixelZoom: 1, pixelSnap: true}` | at least 180 lines |
| full resolution, at least a view | `{maxPixelRatio: 0}` | `{fit: 'contain', width: 480, height: 288, pixelSnap: true}` | at least 480 × 288 |
| full resolution, the screen covered | `{maxPixelRatio: 0}` | `{fit: 'cover', height: 180, pixelSnap: true}` | at most 180 lines |

### Where the art comes from

Everything the library reads for sprites, tiles and text works with pixel art; the guides of each
show how.

| source | read by | guide |
| --- | --- | --- |
| a plain image — PNG, WebP, any format the browser decodes | `TextureFactory`, `TextureStore`, `nearest` unless told otherwise | [textures](textures.md) |
| Aseprite "Export Sprite Sheet", json "Hash" or "Array", tags become animations | `AsepriteJson.parse()`, the `'aseprite'` adapter of a `TextureStore` | [sprites: Aseprite sheets](sprites.md#aseprite-sheets) |
| TexturePacker and free-tex-packer, json "Hash" or "Array" | `TexturePackerJson`, the `'texturepacker'` adapter | [sprites: frames out of an atlas](sprites.md#frames-out-of-an-atlas) |
| a tile set cut out of a plain image | `TileSet` | [tile maps](map2d.md) |
| a set of frames picked by number — tiles, digits, poses | `FrameTable`, `tableFrame()` | [sprites: frames out of a table](sprites.md#frames-out-of-a-table-tableframe) |
| a bitmap font, AngelCode BMFont as text, XML or json | `BitmapFont.parse()` | [text](text.md#bitmap-fonts) |
| images drawn or packed at run time | `DynamicAtlas` | [sprites: atlases built at run time](sprites.md#atlases-built-at-run-time-dynamicatlas) |

### What keeps pixel art crisp

- A whole number of pixels per pixel of the art: a display `pixelZoom` rounds to whole device
  pixels by itself, a projection zoom needs `pixelSnap`.
- Sprites and the camera on whole units, or on multiples of `1 / zoom` units under `pixelSnap`.
- `nearest` filtering for every texture of the art.
- `antialias` off, which it is by default: it smooths edges of geometry and does nothing for pixel
  art but cost.
- Under `pixelSnap`, a buffer that reaches the screen one to one: no `maxPixelRatio` below the
  `devicePixelRatio`, no `resolutionScale` below `1`, no `adaptiveResolution`.

## A fast display: adaptive resolution

### A steady frame rate in one option

```ts check
import {Display, ParallaxProjection, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('canvas')!, {adaptiveResolution: true});

const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 800, height: 600}));
new StageRenderer(display).add(stage);

display.start();

export {display, stage};
```

`adaptiveResolution: true` builds a controller that holds **60 frames per second** — or the
`maxFps` of the display where that is lower — by `resolutionScale`, a factor on the pixel ratio:
down a step of an eighth where a frame costs more than the target allows, up a step where there is
room for the pixels of it, between `0.5` and `1`. Stages, cameras and layout notice nothing but a
smaller drawing buffer, which the browser scales up smoothly: the image gets softer, the frame rate
holds.

![A schematic of the controller under gpu-time: a scene of 42 ms a frame takes the scale from 1 to
0.75 and on to 0.5 in two windows, the frames drop below the budget of 13.3 ms; when the scene gets
lighter, the scale goes up a step after three windows with room, and holds at 0.75 where 0.875
would not fit](images/display/display-adaptive-resolution.svg)

### The settings, simply

| setting | turn it when | for example |
| --- | --- | --- |
| `targetFps` | 60 is too much to ask — a heavy scene, a phone that is to last | `{adaptiveResolution: {targetFps: 30}}` |
| `minScale` | the image may get softer still — or must not, because there is text to read | `0.25` lets it go down to a sixteenth of the pixels; `0.75` keeps more than half |
| `maxScale` | there is room left: above `1` the controller supersamples while frames are cheap | `{maxScale: 1.5}`, bounded by `maxPixels` |
| `maxFps` | the frame rate itself is to be capped — the target follows it | `{maxFps: 30, adaptiveResolution: true}` holds 30 |
| `maxPixelRatio` | the scale is to start from a cheaper ratio — the default bound is `2` | `{maxPixelRatio: 1.5}` |
| `maxPixels` | a hard ceiling of pixels, whatever the screen: a 4K monitor costs no more than a laptop | `{maxPixels: 2_000_000}` |
| `pauseOutsideViewport` | a canvas that scrolls out of view is to draw nothing at all | `{pauseOutsideViewport: true}` |

`antialias` stays off: under a `RenderPipeline` it renders four samples per pixel before the bloom
even starts, the most expensive way there is to smooth an edge.

### Watching it work

```ts check
import {Display} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('canvas')!, {adaptiveResolution: true});

const adaptive = display.adaptiveResolution!;
adaptive.method; //   'gpu-time' or 'frame-pacing', undefined before the first frame
adaptive.scale; //    the resolutionScale it has set
adaptive.gpuTime; //  the median GPU time of the frames it judged last, in ms
adaptive.enabled = false; // hold it still, and give back the scale it found

// every step it takes is a resize of the display
display.onResize(({pixelRatio}) => console.log(`drawing at ${pixelRatio} device pixels per CSS pixel`));

export {display};
```

The swaying grass of the lookbook shows the drawing buffer, the scale, the method and the GPU time
in its `output` folder.

### Fast presets

| preset | options |
| --- | --- |
| hold 60, the defaults | `{adaptiveResolution: true}` |
| battery saver | `{maxFps: 30, adaptiveResolution: true}` |
| heavy scene, large screens | `{maxPixels: 3_000_000, adaptiveResolution: {minScale: 0.25}}` |
| text that must stay readable | `{adaptiveResolution: {minScale: 0.75}}` |
| a quality menu instead of a controller | `display.resolutionScale = 0.5`, `0.75` or `1` by hand |

## A premium display: every device pixel

### Every device pixel in one option

```ts check
import {Display} from '@spearwolf/twopoint5d';

// one pixel of the buffer per device pixel; four samples per pixel for the edges of geometry
const display = new Display(document.querySelector('canvas')!, {maxPixelRatio: 0, antialias: true});

export {display};
```

`maxPixelRatio: 0` lifts the bound of 2 device pixels per CSS pixel, and the display draws at the
full `devicePixelRatio`: one pixel of the buffer per device pixel, nothing scaled by the browser.
On a phone of a ratio of 3 that shades 2.25 times the pixels of the default.

`antialias: true` is for geometry alone: the polygons of a mesh, lines, a turned quad whose texture
is opaque up to its border. It does nothing for pixel art, nothing for sprites cut out by the alpha
test — grass, leaves — and little for sprites blended over a transparent border, which texture
filtering smooths already. It is read once, by the constructor: it is an option of the renderer.

### Sharper than the screen: supersampling

A `resolutionScale` above `1` draws beyond `maxPixelRatio`: a scale of 1.5 shades 2.25 times the
pixels, and the browser scales the canvas down. It smooths what multisampling does not reach — the
inside of textures, thin lines of a shader. `maxPixels` keeps it from running away on a large
screen, and `Display.MaxResolution` (8192) bounds each axis in any case:

```ts check
import {Display} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('canvas')!, {maxPixelRatio: 0, maxPixels: 8_000_000});
display.resolutionScale = 1.5;

export {display};
```

A laptop of 1440 × 900 CSS pixels at a ratio of 2 asks for a ratio of 3; the budget holds it to
2.48, rounded down to 2.375 — a buffer of 3420 × 2137.

### Premium with a safety net

```ts check
import {Display} from '@spearwolf/twopoint5d';

// every device pixel, more while frames are cheap, never below three quarters of the ratio
const display = new Display(document.querySelector('canvas')!, {
  maxPixelRatio: 0,
  maxPixels: 8_000_000,
  adaptiveResolution: {minScale: 0.75, maxScale: 1.5},
});

export {display};
```

The controller starts at a scale of 1, goes up toward 1.5 where the GPU has room and down to 0.75
where it has none: a sharp image on a fast machine, a steady frame rate on a slow one.

### Premium presets

| preset | options |
| --- | --- |
| every device pixel | `{maxPixelRatio: 0}` |
| smooth geometry | `{maxPixelRatio: 0, antialias: true}` |
| supersampled stills, a product view | `{maxPixelRatio: 0, maxPixels: 8_000_000}` and `resolutionScale = 1.5` |
| premium with a safety net | `{maxPixelRatio: 0, maxPixels: 8_000_000, adaptiveResolution: {minScale: 0.75, maxScale: 1.5}}` |

## Fullscreen

### A fullscreen button

```ts check
import {Display} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('#game')!);
const button = document.querySelector<HTMLButtonElement>('#fullscreen')!;

// shown where a fullscreen can succeed at all
button.hidden = !display.fullscreen.isAvailable;

// synchronously in the click handler: the browser grants fullscreen only to a user gesture
button.addEventListener('click', () => {
  void display.fullscreen.toggle();
});

// Escape and the back gesture of a phone end the fullscreen as well; the event tells the button
display.onFullscreenChange(({isActive}) => {
  button.setAttribute('aria-pressed', String(isActive));
});

export {display};
```

`display.fullscreen` asks the browser for its own fullscreen, the one that hides the address bar
and, on Android, the navigation bar. `request()`, `exit()` and `toggle()` never reject: each
resolves with `isActive` afterwards, `false` where the browser refused. A refusal is told once per
page on the console — almost always a call that did not come straight from a click, a key or a
tap. Anything awaited before the call — a fetch, a timeout, the renderer — loses the gesture.

The event `OnDisplayFullscreenChange` is retained: a button attached later hears the state it has
to show.

### Fullscreen when the phone turns sideways

```ts check
import {Display} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('#game')!, {
  fullscreen: {onLandscape: true},
});

// where the browser wants a tap first, the display waits for it: a hint helps
const hint = document.querySelector<HTMLElement>('#tap-for-fullscreen')!;
display.onFullscreenChange(({isArmed}) => {
  hint.hidden = !isArmed;
});

export {display};
```

With `onLandscape`, turning the phone sideways enters fullscreen, and turning it back leaves it.
Some browsers let the turn itself count as a gesture; the others refuse, and then the next tap on
the target enters fullscreen — `isArmed` is `true` while the display waits for it, and the tap
still reaches the game. It only acts on devices whose primary input is a finger
(`(pointer: coarse) and (hover: none)`): a desktop window that is wider than tall does nothing, a
tablet does the same as a phone.

Whoever leaves the fullscreen while the phone is still sideways — Escape, the back gesture, a button
of the page — stays out of it until the phone has turned upright and back. A fullscreen the page
entered with `request()` stays when the phone turns upright; `exitOnPortrait: false` keeps the one
of `onLandscape` as well.

A game that only plays sideways locks the screen:

```ts check
import {Display} from '@spearwolf/twopoint5d';

// once in fullscreen, the screen stays sideways where the browser grants the lock
const display = new Display(document.querySelector('#game')!, {
  fullscreen: {onLandscape: true, orientationLock: 'landscape'},
});

export {display};
```

The lock is a wish: browsers grant it in fullscreen only, and many — on the iPhone, on a desktop —
not at all. While it holds, the phone cannot turn upright, and `exitOnPortrait` is `false`. Where
the browser refuses it, and in the pseudo fallback, which never locks, turning the phone upright
leaves the fullscreen as it does without a lock. A portrait lock does not go with `onLandscape`:
the display warns once and does not lock.

### Without native fullscreen: the pseudo fallback

`isSupported` says whether the browser offers fullscreen for elements here. It does not in an
iframe without `allow="fullscreen"`, and not where the browser keeps fullscreen for videos — as
Safari on the iPhone long has. There, `fallback: 'pseudo'` lets the target cover the viewport
through CSS:

```ts check
import {Display} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('#game')!, {
  fullscreen: {onLandscape: true, fallback: 'pseudo'},
});

// 'native' or 'pseudo' while active
display.onFullscreenChange(({mode}) => {
  document.body.dataset['fullscreen'] = mode ?? '';
});

export {display};
```

A browser with native fullscreen always gets the native one. The pseudo mode needs no gesture:
`request()` enters it at once, and so does the turn of `onLandscape`. Escape leaves it, the page
behind it does not scroll, and `mode` is `'pseudo'`. It cannot hide the bars of the browser. It
covers the viewport only where no ancestor of the target has a `transform`, `filter`, `perspective`
or `contain` — any of them makes that ancestor the box a fixed element covers — and it stays below
an ancestor's stacking context. A target directly in `<body>` meets none of these.

On an iPhone the bars go away when the page runs from the home screen: a web app manifest with
`"display": "fullscreen"` or `"standalone"`, linked from the page, and the page added through
*Share → Add to Home Screen*.

### Which element goes fullscreen

By default the element around the canvas: the element a display was built in, or the parent of a
canvas handed in. HTML beside the canvas — a HUD, a menu — stays on the screen with it, and the
display measures the fullscreen element, so the drawing buffer takes the size of the screen.
`fullscreen: {element}` names another target; a new `display.fullscreen.element` takes effect with
the next request.

The canvas itself is a poor target. The browser stretches an element in fullscreen to the screen
with `object-fit: contain` and over every size the page gives it: under a `pixelZoom` the pixels of
the art lose their whole size, and HTML beside the canvas leaves the screen.

A canvas that measures itself and shares its parent with other elements gets the size of the
parent in fullscreen, not its position: elements in front of it push it partly off the screen.
`resize-to="window"` on the canvas, or a display built in a host element of its own, avoids that.
Leaving the fullscreen gives the canvas back the size it had.

`resize-to="fullscreen"` is an old name of `resize-to="window"`: it means the window and has
nothing to do with the fullscreen of the browser. It still works and warns once per page; write
`"window"`.

### Fullscreen presets

| preset | `fullscreen` option |
| --- | --- |
| a button, nothing automatic | none — `display.fullscreen.toggle()` in the click handler |
| a phone game | `{onLandscape: true, fallback: 'pseudo'}` |
| sideways only | `{onLandscape: true, orientationLock: 'landscape', fallback: 'pseudo'}` |
| keep the navigation bar of Android | `{navigationUI: 'show'}` |

## Cheat sheet

### The settings of the display

An *option* goes to the constructor, a *property* may be written at any time and takes effect with
the next measurement — at the start of the next frame, or right away with a `resize()` of your own.

| setting | kind | default | what it does | pixel art | fast | premium |
| --- | --- | --- | --- | --- | --- | --- |
| `pixelZoom` | property | `0`, off | the buffer at the resolution of the art, a whole number of device pixels per pixel | the key | `0` | `0` |
| `maxPixelRatio` | option, property | `2` | the device pixels per CSS pixel at most; `0` is no bound | does not apply; `0` under `pixelSnap` | `2` or `1.5` | `0` |
| `maxPixels` | option, property | `0`, off | a budget of pixels for the buffer | raises the zoom | `2`–`3` million | a guard, `8` million |
| `resolutionScale` | property | `1` | a factor on the pixel ratio; above `1` supersampling | does not apply | set by the controller | `1`–`1.5` |
| `adaptiveResolution` | option | off | a controller that sets `resolutionScale` by the cost of every frame | holds still; not with `pixelSnap` | `true` | `{minScale: 0.75, maxScale: 1.5}` |
| `antialias` | option | `false` | four samples per pixel in the renderer and the scene pass of a `RenderPipeline` | off | off | on for geometry |
| `maxFps` | option | none | the frames per second at most, and the target of the controller below 60 | — | `30` saves power | — |
| `pauseOutsideViewport` | option | `false` | no frames while the canvas is out of view | — | `true` | — |
| `styleImageRendering` | property | follows `pixelZoom` | pins `image-rendering` to `'pixelated'` or `'auto'` | — | — | — |
| `Display.MaxResolution` | static | `8192` | the buffer per axis at most | — | — | raise before the first display, if the GPU allows |
| `Display.DefaultMaxPixelRatio` | static | `2` | the `maxPixelRatio` of the displays built afterwards | — | — | — |

### The fullscreen

The options go into `fullscreen: {…}` of the constructor; each is a property of
`display.fullscreen` as well and may be written at any time.

| setting | default | what it does |
| --- | --- | --- |
| `element` | the element around the canvas | the target; a new one takes effect with the next request |
| `navigationUI` | `'hide'` | passed to the browser; `'show'` keeps the navigation bar of Android |
| `onLandscape` | `false` | turning a phone sideways enters fullscreen, or arms the next tap |
| `exitOnPortrait` | `true`, `false` while a landscape lock holds | turning back leaves what `onLandscape` entered |
| `orientationLock` | none | locks the screen in native fullscreen, where the browser grants it |
| `fallback` | `false` | `'pseudo'` covers the viewport through CSS where native fullscreen is not there |

| read or call | answers |
| --- | --- |
| `request()`, `exit()`, `toggle()` | enter, leave, switch; each resolves with `isActive` and never rejects |
| `isSupported` | the browser offers fullscreen for elements here |
| `isAvailable` | a request can succeed: `isSupported`, or the pseudo fallback |
| `isActive`, `mode` | in fullscreen right now, `'native'` or `'pseudo'` |
| `isArmed` | `onLandscape` waits for a tap |
| `display.onFullscreenChange(listener)` | every change of `isActive`, `mode` and `isArmed`; retained |

### The fit of a projection

`OrthographicProjection` and `ParallaxProjection` take the same fit:

| spec | the view |
| --- | --- |
| `{fit: 'fill'}`, the default | one unit per CSS pixel — per pixel of the art under a display `pixelZoom` |
| `{pixelZoom: z}` | `z` CSS pixels per unit |
| `{fit: 'contain', width, height}` | at least `width` × `height` units, the rest of the canvas shows more |
| `{fit: 'cover', width, height}` | the canvas covered, at most `width` × `height` units visible |
| `minPixelZoom`, `maxPixelZoom` | bounds of the zoom of `contain` and `cover` |
| `pixelSnap: true` | the zoom a whole number of pixels of the buffer, the edges of the view on whole units |

### What to read

| read | answers |
| --- | --- |
| `display.width`, `display.height` | the size in CSS pixels — in pixels of the art under a `pixelZoom` |
| `display.pixelRatio` | the device pixels per CSS pixel the display draws at; `1` under a `pixelZoom` |
| `display.devicePixelRatio` | the ratio of the screen |
| `display.devicePixelZoom` | the whole device pixels per pixel of the art; `0` without a zoom |
| `display.adaptiveResolution` | the controller: `scale`, `method`, `gpuTime`, `enabled` |
| `projection.getViewRect()` | the view in units, its pixels per unit, and the shift of `pixelSnap` |
| `display.onResize(listener)` | every change of size, ratio or zoom — a step of the controller as well |

### What goes together

| combination | result |
| --- | --- |
| `pixelZoom` + `pixelSnap` | the cheapest pixel-exact setup |
| `pixelZoom` + `adaptiveResolution` | the controller holds still: pixel art keeps its size |
| `pixelZoom` + `maxPixels` | the budget raises the zoom, the pixels of the art get larger |
| `pixelSnap` + `adaptiveResolution` | **no**: every step changes the zoom, the view grows and shrinks mid-game |
| `pixelSnap` + `maxPixelRatio` below the screen | **no**: the browser scales the buffer, the pixels come out uneven |
| projection `pixelZoom` without `pixelSnap` | uneven texels at a fractional ratio, and the pixels of a full buffer |
| `resolutionScale` above `1` + `maxPixels` | supersampling up to the budget |
| `antialias` + pixel art | cost without effect |

### The pixel ratio, put together

![The pixel ratio as a chain: the devicePixelRatio, bounded by maxPixelRatio and by the budget of
maxPixels, times resolutionScale, bounded by the budget once more and rounded down to an eighth
where the budget or the scale made it; with three worked examples, and a pixelZoom that replaces
the chain](images/display/display-pixel-ratio.svg)

Without a `pixelZoom`, the display draws at

```text
min(min(devicePixelRatio, maxPixelRatio, sqrt(maxPixels / cssArea)) × resolutionScale, sqrt(maxPixels / cssArea))
```

device pixels per CSS pixel, each bound only where it is set. The budget comes in twice: before the
scale and after it, so a scale above `1` draws beyond `maxPixelRatio` but never beyond `maxPixels`.
For a scale up to `1` the second bound changes nothing. Where the budget or the scale has made the
ratio, it is rounded **down to a step of an eighth**, at least an eighth: three builds every render
target of a pipeline anew with every new size, and in steps the sizes change less often and come
back to the same values. Where neither has, the ratio stays exact — `devicePixelRatio` itself, or
`maxPixelRatio` — so a canvas at the ratio of its screen maps one pixel of the buffer onto one
device pixel. `Display.MaxResolution` (8192) bounds the buffer per axis in the end.

A change of any of these settings takes effect with the next measurement — at the start of the
next frame, or right away with a `resize()` of your own — and emits `OnDisplayResize`. `width` and
`height` stay in CSS pixels: stages, cameras and layout notice nothing but a smaller buffer.

## Reference

### The defaults

A `Display` that is told nothing draws at most at **2 device pixels per CSS pixel**
(`Display.DefaultMaxPixelRatio`) and builds its renderer **without multisampling**. Beyond a ratio
of 2 a phone screen shows hardly more detail, but a ratio of 3 shades 2.25 times as many pixels.
Multisampling under a `RenderPipeline` is expensive: the scene pass renders four samples per pixel
into half floats and resolves them before the bloom even starts.

### A budget of pixels

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
not for pixel art, which takes a `pixelZoom` instead. The budget holds after a `resolutionScale`
above `1` as well: the 4K screen stays at 0.5 at a scale of 2.

### Resolution scale

`resolutionScale` multiplies the pixel ratio the bounds leave: `0.75` shades 56 % of the pixels.
It is what `adaptiveResolution` moves, and it may be set by hand — a quality setting, say. It does
not apply under a `pixelZoom`.

Above `1` it is supersampling: the display draws beyond `maxPixelRatio` — a scale of 1.5 shades 2.25
times the pixels — but within `maxPixels`. A `maxScale` above `1` lets `adaptiveResolution` go
there.

### Adaptive resolution in detail

Options of its own instead of `true`:

```ts check
import {Display} from '@spearwolf/twopoint5d';

const display = new Display(document.querySelector('canvas')!, {
  adaptiveResolution: {targetFps: 30, minScale: 0.25, maxScale: 1},
});

export {display};
```

The controller reads the cost of a frame in one of two ways, see `adaptive.method`:

- **`gpu-time`**: the time the GPU spent on the frame, through the timestamp queries of three —
  `timestamp-query` under WebGPU, `EXT_disjoint_timer_query_webgl2` under WebGL 2. The GPU may take
  80 % of the frame interval, 13.3 ms at 60 frames per second. A window of 12 measured frames is
  judged by its median, which a single spike does not move: above the budget the scale goes down a
  step, above 1.5 times the budget two. It goes up a step where the time of the window, scaled by
  the pixels the display would draw at that step, stays below 90 % of the budget three windows in
  a row. A step up that the next window takes back makes the next one wait twice as many windows,
  up to 300.
- **`frame-pacing`**: where the renderer measures no GPU time. It reads the intervals between the
  animation frames of the page, so a frame that `maxFps` holds back is not late. 3 frames of 30
  that come later than 1.5 frame intervals take the scale down a step. A frame on time shows no
  headroom, so after 180 clean frames the controller tries a step up and keeps it where the next
  two windows stay clean; a try that fails goes back, and the next try waits twice as long, up to
  3600 frames.

  Where a descent down to `minScale` brought frames that came at a steady pace no sooner — a
  `requestAnimationFrame` that a power-saving mode or a 30 Hz screen holds to 30 frames — the
  pixels are not what holds the frame rate. The controller goes back to the scale the descent
  began at and measures against that pace from then on: a frame is late where it comes more than
  half a target interval after it. It takes that one descent, and the return, to find out: with
  the default scales four steps of 60 frames each — 30 that settle and a window of 30 —, 240
  frames at a lower resolution, eight seconds at 30 frames per second. Once the frames come sooner
  again, the target counts again.

A step that leaves the pixel ratio as it is — `maxPixels` or the rounding of the ratio to an eighth
draws two scales at the same ratio — is skipped: for every ratio the controller sets the highest
scale that draws at it.

After every resize — the ones of its own steps included —, a start and a restart, the controller
lets 30 frames pass before it judges again: shaders compile and the render targets are built anew
in them, and a measurement that started before is dropped. So is a measurement still in flight
when the controller is disabled, or when the display goes over to a `pixelZoom`.

What to know about it:

- A display that builds its renderer asks it for `trackTimestamp: true`, which `gpu-time` needs. A
  renderer handed to the constructor, a WebGPU adapter without `timestamp-query` and a WebGL 2
  without the timer extension — Android Chrome often hides it — leave `frame-pacing`.

  A renderer the display built with `trackTimestamp: true` measures timestamps for its whole life:
  while the controller holds still under a `pixelZoom`, after `adaptive.enabled = false` and after
  `adaptive.dispose()` as well. three offers no way to take that back — the timestamp writes sit
  on the render pass descriptor three keeps for the canvas. The cost is small. A display that is
  to draw without them passes `trackTimestamp: false` beside `adaptiveResolution`, and the
  controller reads the frame pacing then.
- `frame-pacing` cannot tell the GPU from the CPU. A load of the JavaScript takes the scale down as
  well, which helps nothing. Where it holds every frame to the same slower pace, the descent down
  to `minScale` brings the frames no sooner, and the controller goes back as above: the descent,
  the return, and the pace it found to measure against. Where the load comes and goes, the frames
  come at no steady pace, and the scale stays down — `minScale` is how far that goes — until clean
  frames bring it back through the tries up: the first after 180 clean frames, and twice as
  many after each try that failed, up to 3600.
- Under a `pixelZoom` the controller holds still: pixel art keeps its size.
- A frame that a display renders while it is not running — paused, or not started yet: a
  `renderFrame()` of your own — has no interval between animation frames: `frame-pacing` judges none
  of them, `gpu-time` measures it like any other.
- `adaptive.enabled = false` holds it still and gives the display back the `resolutionScale` it had
  when the controller took over last; `true` takes over again, counting the windows toward the next
  step up from 0 while the pace it found and the waits it doubled stay. It takes over a scale that
  is no positive finite number as `1`, and gives `1` back. `adaptive.dispose()` lets go for good,
  and gives that scale back as well. A disposed display lets go of its controller, and
  `adaptive.isDisposed` says whether it has let go.
- A display carries one controller at a time. `new AdaptiveResolution(display)` throws while
  another one holds the display, enabled or not, and on a disposed display.
  `display.adaptiveResolution` names the controller that holds the display — the one of the option
  or one of your own — and answers `undefined` once that one or the display is disposed.

The controller works without the option as well, on a display of one's own renderer:

```ts check
import {AdaptiveResolution, Display} from '@spearwolf/twopoint5d';
import {WebGPURenderer} from 'three/webgpu';

const renderer = new WebGPURenderer({canvas: document.querySelector('canvas')!, trackTimestamp: true});
const display = new Display(renderer);
const adaptive = new AdaptiveResolution(display, {targetFps: 30});
display.adaptiveResolution; // adaptive: the controller that holds the display

export {adaptive};
```

### Pipelines

Every render target of a `RenderPipeline` — the scene pass, the half and smaller targets of a
bloom — follows the size of the drawing buffer, so every setting above counts for all of them. The
`StageRenderer` leaves its own clear of the target a pipeline draws into to three where
`renderer.autoClear` covers it: on the canvas that clear would cost a full-screen draw of its own.
See [the stage cheat-sheet](../src/stage/README.md).

### Measured

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

### Trying it on a phone

WebGPU needs a secure context: a page from `http://192.168.…` of the lookbook's dev server runs
under WebGL 2. `localhost` counts as secure, so the phone reaches WebGPU through
`adb reverse tcp:4321 tcp:4321` and `http://localhost:4321/lookbook/`. The swaying grass shows
the drawing buffer, the scale, the method and the GPU time in its `output` folder; the sine
scroller fits its pixel art with a display zoom, the platformer with `pixelSnap`.
