# Proposal: a pixel-exact projection fit — `pixelSnap`

Status: **specified.** Carried on from §8 of
[`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md), the row "a projection fit that
snaps to a whole-number `pixelZoom`". Nothing here is built.

Pixel art drawn through a projection zoom stays crisp only where every pixel of the art covers the
same whole number of pixels of the drawing buffer, and where the edges of its texels fall on the
edges of those pixels. `OrthographicProjection` and `ParallaxProjection` give neither today: their
`fit` yields any zoom, they count it in CSS pixels, and they centre the frustum on the projection
plane wherever the half of the view lands. `pixelSnap` adds both to the fit both projections share.

## 1. Goal

| who | what they get | § |
| --- | --- | --- |
| a pixel-art scene whose view is fitted to the window (`rope-bridge`) | `pixelSnap: true` beside `fit: 'contain'`: the largest whole zoom at which the view fits, counted in pixels of the drawing buffer | 3 |
| a pixel-art scene that fills the window at about a given height (`platformer`) | `pixelSnap: true` beside `fit: 'cover'`: the smallest whole zoom at which the view covers the container | 3 |
| a fixed zoom (`{pixelZoom: 2}`) on a screen of a fractional `devicePixelRatio` | `pixelSnap: true` beside `pixelZoom`: the zoom rounded down to whole pixels of the buffer, the rule of `Display#pixelZoom` | 3 |
| a scene that scrolls by whole units and must not shimmer | a frustum whose edges lie on whole units of the projection plane, orthographic and perspective alike | 5 |
| pointer code that maps a canvas position into the view | `ProjectionViewRect#offsetX` and `#offsetY`: where the middle of the view lies after the alignment | 6 |

## 2. Pixel-exact, defined

A pixel of the art — one unit of the projection plane — is drawn pixel-exact when:

1. it covers a whole number `k` of pixels of the drawing buffer on each axis, the same `k`
   everywhere (§3);
2. the edges of the frustum lie on whole units of the projection plane, so that a texel edge at a
   whole unit falls on a pixel edge of the buffer (§5);
3. the drawing buffer reaches the screen one to one: one pixel of the buffer is one device pixel,
   or a whole number of them under `Display#pixelZoom`.

The projection holds 1 and 2. Condition 3 is the display's (§7). What the projection cannot hold:
a sprite or a camera placed at a fraction of `1 / k` units moves the texel edges off the pixel
edges again. The guide says so; whole units give the strict retro look, multiples of `1 / k` units
still keep every texel whole.

## 3. `pixelSnap` in `fitIntoRectangle()`

The arms `pixelZoom`, `contain` and `cover` of `FitIntoRectangleSpecs` gain `pixelSnap?: boolean`,
and with them `ProjectionFitSpecs`. `fill` does not: its view is the container, one unit per CSS
pixel, and has no zoom to round.

```ts
fitIntoRectangle(rect: Vector2, specs: Partial<FitIntoRectangleSpecs>, target?: Vector2, pixelRatio = 1): Vector2;
```

`pixelRatio` is the pixels of the drawing buffer per unit of `rect`: `Display#pixelRatio`, which is
`1` under `Display#pixelZoom`, where `rect` already counts pixels of the buffer. A value that is not
a finite number above 0 counts as `1`. Without `pixelSnap`, `pixelRatio` is not read, and the
function answers what it answers today.

With `pixelSnap`:

1. The zoom `z` in units of `rect` per unit of the view is worked out as today: from `pixelZoom`,
   or from the `contain` or `cover` fit, then held to `minPixelZoom` and `maxPixelZoom`.
2. `z × pixelRatio` is rounded to the whole buffer pixels per unit, `k`:

   | arm | rounding | why |
   | --- | --- | --- |
   | `pixelZoom` | down | as `Display#pixelZoom` rounds: a pixel is never larger than asked for |
   | `contain` | down | at least the asked-for view stays visible |
   | `cover` | up | the view still covers the container, and at most the asked-for view is visible |

   `k` is at least `1`. The rounding allows `1e-6` of leeway, as `resolveDrawingBuffer()` does for
   `Display#devicePixelZoom` (`2 × 2.625` is `5.249999…` in floating point); the two share one
   constant.
3. The view is the drawing buffer divided by `k`: `bufferWidth / k` × `bufferHeight / k`, with
   `bufferWidth = Math.floor(rect.width × pixelRatio)`, the rounding `WebGPURenderer#setSize()`
   applies to the drawing buffer. The view divides the buffer the renderer really has, not the
   fractional size before the rounding; a view worked out from the fraction would spread its pixels
   over one pixel more or less than the buffer has, and a seam would wander across the image.

The rounding comes after `minPixelZoom` and `maxPixelZoom`, so the snapped zoom can lie beyond one
of them by less than one pixel of the buffer per unit: a `contain` with `minPixelZoom: 2` at a
`pixelRatio` of `1.25` holds `z` at `2`, which is `2.5` buffer pixels, rounded down to `2`, which is
`1.6` CSS pixels per unit. The TSDoc says so. Whole numbers for both bounds where `pixelRatio` is
`1` keep the rounding within them.

The resulting zoom in CSS pixels, `k / pixelRatio`, is in general not a whole number — `3` buffer
pixels at a ratio of `1.25` are `2.4` CSS pixels. That is why the option is called `pixelSnap` and
not `integerPixelZoom`: what is whole is the zoom in pixels of the buffer.

## 4. The pixel ratio reaches the projection

`DisplayEventProps` carries `pixelRatio`; the `StageRenderer` drops it today. It travels on as an
optional third parameter, `1` where it is left out:

- `IStage#resize(width, height, pixelRatio?)` — a stage of one's own that ignores it keeps
  working;
- `StageRenderer#resize()` and `#resizeStage()` hand it on from the host to every stage, the stages
  of a nested `StageRenderer` included; the `StageItem` keeps it beside `width` and `height`, so a
  change of the ratio alone reaches the stage as well;
- `Stage2D#resize()` keeps it beside the container size, compares it in its guard and hands it to
  the projection; `updateProjection()` hands on the kept one;
- `IProjection#updateViewRect(width, height, pixelRatio?)` hands it to `fitIntoRectangle()`;
- `Canvas2DStage` and `ClearStage` take it and leave it unread.

A window dragged onto a screen of another `devicePixelRatio` keeps its CSS size and changes the
ratio: the guard has to let that through, or the view would stay snapped to the old screen.

## 5. Aligning the frustum

With `pixelSnap`, both projections place the frustum so that its left and its bottom edge lie on a
whole unit of the projection plane:

```
left   = -Math.floor(viewWidth / 2)     right = left + viewWidth
bottom = -Math.floor(viewHeight / 2)    top   = bottom + viewHeight
```

The middle of the view then lies `fx = viewWidth / 2 - Math.floor(viewWidth / 2)` units right of
the point the camera looks at, and `fy` (the same for the height) units above it, each in `[0, 1)`.
Pixel `j` of the buffer starts at `left + j / k`, so every `k`-th pixel edge is a whole unit: the
texel edges lie on pixel edges. The camera stays where it is — on the normal of the projection
plane, at `distanceToProjectionPlane` — so a scene that scrolls by moving the camera keeps its
numbers.

- **`OrthographicProjection`** writes the edges into `left`, `right`, `top` and `bottom` of the
  camera in place of the symmetric `±halfWidth`, `±halfHeight`.
- **`ParallaxProjection`** shifts the window of its `PerspectiveCamera` with
  `setViewOffset(viewWidth, viewHeight, fx, -fy, viewWidth, viewHeight)`: a full size of the view
  in units of the projection plane, so that the offset counts units of the plane as well. The
  offset moves the window by the same share of the frustum at every depth; on the projection plane
  that is exactly `fx`, `fy` units. The field of view, the aspect and `getParallaxFactor()` stay as
  they are.

Only the projection plane of a `ParallaxProjection` is pixel-exact. A layer in front of or behind
it is drawn `getScaleFactor()` times as large, which is not a whole number of buffer pixels per
unit in general; the guide says so.

**Who owns `camera.view`.** `setViewOffset()` is a three.js feature a user may set for tiled
rendering. Under `pixelSnap`, `ParallaxProjection#updateCamera()` replaces the offset of the camera,
as it replaces the field of view and the position — "whatever the camera carried in these is
replaced", as its TSDoc already says. Without `pixelSnap`, it clears only an offset it wrote itself:
it keeps the cameras it gave one in a `WeakSet` and calls `clearViewOffset()` on those, so turning
the option off leaves no stale shift behind and an offset of the user's own stays untouched.

Without `pixelSnap`, both projections centre the frustum as today, and `fx`, `fy` are `0`.

## 6. `ProjectionViewRect#offsetX` and `#offsetY`

`ProjectionViewRect` gains

```ts
/** How far the middle of the view lies right of the point the camera looks at, in units of the
 * projection plane: `0`, or in `[0, 1)` under `pixelSnap`. */
offsetX: number;
/** How far the middle of the view lies above that point, in units of the projection plane. */
offsetY: number;
```

`0` for both until the first view with an area, and without `pixelSnap`. Both fields are required:
an `IProjection` of one's own answers `0`. That is a break of the public type, named in the
changelog with its one-line migration.

A canvas position maps into the view through them:

```ts
const view = projection.getViewRect();
const x = (event.offsetX - canvas.clientWidth / 2) / view.pixelRatioX + view.offsetX;
const y = (canvas.clientHeight / 2 - event.offsetY) / view.pixelRatioY + view.offsetY;
```

`pixelRatioX` and `pixelRatioY` keep their meaning, CSS pixels per unit of the view.

## 7. With `Display#pixelZoom` and `AdaptiveResolution`

- **`Display#pixelZoom`** composes: under it, `pixelRatio` is `1` and the container counts pixels of
  the buffer, so `pixelSnap` makes every unit `k` buffer pixels and `k × devicePixelZoom` device
  pixels — whole either way. A `pixelZoom: 1` projection under a display zoom stays the cheapest
  pixel-exact setup; `pixelSnap` adds the fit on top of it.
- **`AdaptiveResolution`** and `pixelSnap` do not go together. Every step of `resolutionScale`
  changes `Display#pixelRatio`, `k` follows it, and the visible part of the world grows or shrinks
  in the middle of the game; at a scale below `1` the browser scales the buffer up and condition 3
  of §2 fails anyway. The guide says so and points to `Display#pixelZoom`, under which the
  controller holds still. There is no warning at run time: a projection does not know the
  controller of its display.
- **`maxPixelRatio`** below the `devicePixelRatio` also breaks condition 3 — a ratio of 2 on a
  screen of 3 is scaled up by 1.5. The snap still keeps the buffer even; the guide names the case.

## 8. The demos

| demo | after the build |
| --- | --- |
| `rope-bridge` | `{fit: 'contain', width: MIN_VIEW_WIDTH, height: CAVE_HEIGHT, pixelSnap: true}`; the resize handler keeps only `bridge.resizeView()`, the pointer maps through §6 |
| `platformer` | an `OrthographicProjection` with `{fit: 'cover', height: VIEW_HEIGHT, pixelSnap: true}` in place of its own frustum; the floor stays at the bottom edge through the position of the camera |
| `sine-scroller` | unchanged: it works out a fractional `Display#pixelZoom`, which the display rounds itself |
| `ui-panels` | unchanged: its scale is part of its layout (a top inset, a clamp to 1…4), not of a projection |

## 9. Tests

- `fitIntoRectangle.spec.ts`: a table over the ratios `1`, `1.25`, `1.5`, `2` and `2.625`, each arm
  with and without `pixelSnap`, the bounds before the rounding, `k` never below `1`, the buffer
  rounding of `setSize()`, and `pixelRatio` unread without `pixelSnap`.
- `OrthographicProjection.spec.ts`: the frustum edges on whole units for even and odd buffer sizes,
  `offsetX`/`offsetY`, the symmetric frustum without the option.
- `ParallaxProjection.spec.ts`: `camera.view` as §5 writes it, a whole unit of the projection plane
  projected to a whole pixel of the buffer, the `WeakSet` rule — a user's offset kept without the
  option, the projection's own cleared when the option goes off.
- `Stage2D.spec.ts`, `StageRenderer.spec.ts`: the ratio handed on from the host through a nested
  renderer to the projection, and a change of the ratio alone that snaps the view anew.
- Browser, `packages/twopoint5d-testing`: a checkerboard texture with `nearest` filtering, one
  texel per unit, through each projection with `pixelSnap` at a `deviceScaleFactor` of `1.25`,
  under WebGPU and WebGL 2; every texel covers a block of whole, equally wide pixels of the read-back
  image.

## 10. Left out

- **A fit of `Display#pixelZoom` itself** — "as large as fits 400 × 240 pixels of the art" on the
  display, what `sine-scroller` works out by hand. It is one line of arithmetic, which the display
  guide shows; a helper would hide less than it adds.
- **A rounding of its own** (`round` beside down and up). The direction follows from the fit; a
  nearest rounding would cut off part of a `contain` view or leave a gap beside a `cover` one.
- **Pixel-exact layers off the projection plane** of a `ParallaxProjection`: their scale factor is
  set by their depth, not by the fit.
