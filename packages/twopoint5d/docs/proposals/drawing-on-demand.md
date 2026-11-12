# Proposal: drawing on demand — a `FramePacer` that draws a frame only when the picture changed

Status: **phase A implemented** — see [`docs/display.md`](../display.md), "Drawing on demand", the
cheat sheet "Drawing on demand" and the reference "The steady stride"; the Vitest specs
`src/display/FramePacer.spec.ts`, `src/display/untilSettled.spec.ts` and
`src/display/hot-path-allocations.frame-pacer.spec.ts`, the browser test
`packages/twopoint5d-testing/test/display-drawing-on-demand.test.js`. Phases B to D are proposed
and wait for the building blocks they are written against (§10). Open on devices: Safari on macOS
and iOS (§2, §14). From
[issue #52](https://github.com/spearwolf/twopoint5d/issues/52), which splits into
[#58](https://github.com/spearwolf/twopoint5d/issues/58) (phase A) and
[#59](https://github.com/spearwolf/twopoint5d/issues/59) (phases B to D).

The frame loop of a `Display` runs at the rate of the screen, and a `StageRenderer` on it draws
every frame — also the ten thousandth frame of a title screen on which nothing moves. Drawing on
demand keeps the loop and takes the draw out of it: `updateFrame()`, `OnStageUpdateFrame`,
transitions and every listener keep pace with the clock, but the renderer draws a frame only when
something in the picture has changed. The canvas keeps the last picture it was given, so a frame
that draws nothing looks the same as one that draws an unchanged scene.

The idea is proven in a consumer of the library, a point-and-click game on one `Display` and one
`StageDirector` driven by hand. Measured there on Chromium, WebGPU and WebGL 2: the CPU share of
the page falls from 0.109 to 0.010 on a title screen that stands still (no frame drawn), and from
0.21 to 0.16 in a room with a lasting animation (30 frames drawn per second instead of 60);
pictures taken at the same moment are identical to continuous rendering. Continuous rendering
stays the default of the library.

## 1. Goal

| who | what they get | § | phase |
| --- | --- | --- | --- |
| an app with a scene that mostly stands still — a menu, a map viewer, a point-and-click room | a `FramePacer` beside a renderer driven by hand: the frame handler asks `shouldDraw()` and draws only then | 4, 6 | A |
| a building block that moves something — a camera rig, a particle emitter, animated layers | one vocabulary to answer in: a `FrameStep` that returns a `Motion` | 3 | A |
| an animation that never ends — a fire, a pendulum | `'steady'`: drawn at 30 frames per second on every screen, as long as nothing else moves | 5.3 | A |
| a test or a debug HUD | the counters `frames` and `draws` | 4.1 | A |
| an app on a `StageDirector` | `drawing: 'on-demand'`: the director owns a pacer and invalidates for everything it knows about | 7 | B |
| an app with `AdaptiveResolution`, `maxFps`, shader animations or temporal post-processing | rules for how each of them goes together with frames that are not drawn | 8 | C |
| every user of the feature | a verify mode that tells when a skipped frame would have changed the picture | 9 | D |

## 2. The premise: a canvas keeps its picture

The whole feature rests on one behaviour of the platform: a canvas whose frame presents nothing
goes on showing the last picture presented.

- **WebGPU.** A frame presents the texture `getCurrentTexture()` handed out. A frame in which the
  renderer draws nothing asks for none, and the compositor keeps the picture of the frame before.
- **WebGL 2.** Without `preserveDrawingBuffer`, the drawing buffer is cleared after it was
  presented — but a frame that draws nothing presents nothing, and the compositor keeps the buffer
  it was handed last.
- **A resize** of the drawing buffer clears the canvas under both. The frame after a resize has to
  draw (§4.2).

`packages/twopoint5d-testing/test/display-drawing-on-demand.test.js` holds it with screenshots of
the page, the one way to read what the compositor shows instead of what the drawing buffer holds:
after 40 frames that drew nothing, the canvas still shows the picture; a change nobody reported
does not reach it — the control that a screenshot shows the canvas and not a picture drawn for the
screenshot; after a change and an `invalidate()`, it shows the same as a display that draws every
frame; after a resize it shows the picture again. The test passes under the four launchers of the
browser tests — Chromium under WebGPU and under WebGL 2, Firefox under WebGL 2 and Playwright's
WebKit under WebGL 2, all headless on Linux. Not held by a test: Safari on macOS and on iOS, and
Firefox and WebKit under WebGPU, which the launchers do not offer; §14 keeps them open.

## 3. The frame-step contract

### 3.1 `Motion`

```ts
export type Motion = boolean | 'steady' | undefined;
```

What a piece of code says about the picture after it ran:

| answer | meaning | the pacer |
| --- | --- | --- |
| `false`, `undefined`, nothing | nothing it shows has changed | draws nothing for it |
| `true` | it moved something visible | draws the next frame |
| `'steady'` | it animates on and on | draws at the steady rate (§5.3) while nothing asks for more |

The three form an order — nothing, steady, full — and several answers in one frame add up to the
highest. Any other truthy value counts as `true`: an answer the pacer does not know draws rather
than freezes.

### 3.2 `FrameStep`

```ts
export type FrameStep = (frame: DisplayEventProps) => Motion | void;
```

A frame step is a function the pacer runs once per frame, with the props of the frame, and whose
answer it takes as a report. It is the shape every building block that moves something answers
in: the `step()` of a camera rig answers whether the camera moved, a particle emitter answers
`'steady'` while it is busy, a set of animated layers answers whether one of them changed. A block
ships an adapter of this shape and needs to know nothing else of the pacer.

### 3.3 A report draws the next frame that asks

A report — the answer of a step, `report()`, `invalidate()` — stays pending until the next
`shouldDraw()` that answers `true`, and that draw takes every pending report with it. The pacer
does not care where in a frame a report comes in: one that comes in before the frame handler asks
draws this frame, one that comes in after it draws the next.

The second case is the common one, and it is the one-frame offset of the contract: a renderer
draws early in a frame, steps run after it, so what a step moves in frame N is on the canvas with
frame N+1. Continuous rendering has the same offset — the draw of frame N+1 shows what the steps
of frame N left —, which is why a paced display shows the same picture at the same moment.

### 3.4 The end of a motion: `untilSettled()`

```ts
export function untilSettled(): (moving: boolean) => boolean;
```

A step that sets its pose from the clock usually knows whether its motion is still running. In
the frame the motion comes to rest it writes the end pose and answers "not moving" — and the end
pose is never drawn. `untilSettled()` hands out a function with one frame of memory: it answers
`true` while its argument is `true`, and once more in the frame its argument turns `false`. Every
motion gets a function of its own.

A transition of a `StageDirector` has the same edge: the frame handler reads whether a transition
runs *before* `updateFrame()`, so the frame the transition ends in still draws (§6).

### 3.5 A step reports what it writes itself

A step that reads state set elsewhere and writes it into the scene only in its own frame has to
report the change itself. An `invalidate()` at the place the state was set may come a frame too
early: it draws the picture before the step wrote into it, and nothing draws the frame after.

## 4. API (phase A)

Module `display`, exported through `src/display/public-api.ts`: `FramePacer`
(`src/display/FramePacer.ts`), `untilSettled` (`src/display/untilSettled.ts`) and the types
`Motion`, `FrameStep`, `FramePacerSource`, `FramePacerOptions`. No file of it imports three.js or
the `stage` module.

### 4.1 `FramePacer`

```ts
export class FramePacer<TStage extends object = object> {
  static readonly DefaultSteadyFps = 30;

  constructor(source: FramePacerSource, options?: FramePacerOptions<TStage>);

  /** Runs `step` once per frame; its answer is a report. Returns the unsubscribe. */
  onFrame(step: FrameStep, stage?: TStage): () => void;
  /** What something outside a step moved, with the meaning of a step's answer. */
  report(motion: Motion | void): void;
  /** Something changed: the next frame draws. The same as `report(true)`. */
  invalidate(): void;
  /** Asked once per frame, before the draw. `busy` forces the draw. */
  shouldDraw(frame: DisplayEventProps, busy?: boolean): boolean;

  readonly steadyFps: number;
  readonly frames: number; // the calls of shouldDraw()
  readonly draws: number;  // those it answered with true

  readonly isDisposed: boolean;
  dispose(): void;
}
```

- **`onFrame(step, stage?)`** — `stage` is an opaque key: with it, the answer of the step counts
  only while `live(stage)` answers `true` (§5.4). Its type is the type parameter of the pacer,
  which the `live` option infers — `{live: (stage: IStage) => !director.isFrozen(stage)}` makes a
  `FramePacer<IStage>` —, so the module names no stage type and a step cannot be registered with
  a key `live` does not know. The step itself runs every frame either way, so
  its state keeps pace with the clock. One function registered twice runs twice, and each
  registration has an unsubscribe of its own. A step registered while the steps of a frame run
  first runs in the next frame; one unsubscribed while they run does not run any more, in this
  frame included.
- **`shouldDraw(frame, busy?)`** — the one question of a frame handler. It counts the frame,
  measures the cadence of the frames from `frame.rawDeltaTime` (§5.3) and answers whether to
  draw. `busy` is for what the caller knows without a step: a running transition, a stage being
  prepared. A draw that `busy` forces takes the pending reports as any draw does. Call it once per
  frame; a frame handler that does not ask leaves every report pending.
- **A new pacer has a report pending**: the first frame draws.
- **`frames` and `draws`** — for a test ("a silent room draws nothing"), a debug HUD, and the
  specs of every later phase.

### 4.2 The source

```ts
export interface FramePacerSource {
  onRenderFrame(listener: (frame: DisplayEventProps) => unknown): () => void;
  onResize?(listener: (frame: DisplayEventProps) => unknown): () => void;
  onRestart?(listener: (frame: DisplayEventProps) => unknown): () => void;
  readonly isDisposed?: boolean;
}
```

A `Display` is one, structurally, and so is every `IStageRendererHost`. The pacer subscribes in
its constructor and gives every subscription back in `dispose()`:

- **`onRenderFrame`** runs the steps.
- **`onResize`**, where the source has it, invalidates: a resize clears the canvas (§2), and a
  frame handler that forgot to wire it would show an empty canvas until something else moves. A
  `Display` hands its current size to a new listener right away; that is one more report on a
  pacer that has one pending anyway.
- **`onRestart`**, where the source has it, invalidates: a display back from a pause — a hidden
  tab, a canvas out of the viewport — may have lost the picture of its canvas.

The pacer takes no order among the listeners of a frame for granted (§3.3). On a `Display` a pacer
built before the frame handler subscribes runs its steps before the draw of that handler, one
built after it runs them after the draw; both are correct, and the second is the wiring of §6.

### 4.3 The options

```ts
export interface FramePacerOptions<TStage extends object = object> {
  /** The frames per second `'steady'` draws at. Default `FramePacer.DefaultSteadyFps`, 30. */
  steadyFps?: number;
  /** Whether `stage` is drawn live. Default: every stage is. */
  live?: (stage: TStage) => boolean;
}
```

Both are read once, by the constructor.

### 4.4 Refusals

In the message format of the library (`AGENTS.md`, "Error and warning messages"):

- `new FramePacer(): source must have an onRenderFrame() method, got …` — a `TypeError`;
- `new FramePacer(): the source handed to the constructor has been disposed` — an `Error`, for a
  source whose `isDisposed` is `true`: its frames never come, and a pacer on it would look alive
  and run no step;
- `new FramePacer(): steadyFps must be a finite number above 0, got …` — a `RangeError`, through
  `assertPositiveFinite()`;
- `new FramePacer(): live must be a function, got …` — a `TypeError`;
- `FramePacer#onFrame(): step must be a function, got …` — a `TypeError`.

The refusals come before the first subscription. A source that throws while the pacer subscribes
holds nothing of it: the pacer gives back what it had subscribed, and an unsubscribe that throws
there joins the error of the source in an `AggregateError`.

### 4.5 After `dispose()`

`dispose()` gives the subscriptions back to the source and lets go of every step; the source
stays the caller's. It is idempotent. Afterwards, by the rules of
[`resource-lifecycle.md`](../resource-lifecycle.md) §3:

- `shouldDraw()` answers `true` and counts nothing: a pacer that paces nothing lets every frame
  draw, so a frame handler that outlives its pacer never freezes the picture;
- `report()` and `invalidate()` do nothing;
- `onFrame()` throws `FramePacer#onFrame() is not available: this pacer has been disposed` — it
  promises a step that runs, and none ever would;
- an unsubscribe handed out before does nothing;
- `frames`, `draws` and `steadyFps` answer what they held.

An unsubscribe of the source that throws does not keep the others from being called; the errors
come out of `dispose()` once the pacer is down, one unchanged, several as an `AggregateError`.

### 4.6 Against the pacer of the reference consumer

The consumer of issue #52 migrates onto this API (phase B); what differs from its own pacer:

| reference | here | why |
| --- | --- | --- |
| `shouldDraw(busy, now)`, `now` from `display.frameLoop.now` in milliseconds | `shouldDraw(frame, busy?)` | the frame handler has the props of the frame already; `rawDeltaTime` is the gap of the frames the loop emits, so the stride is right under `maxFps` without a rule of its own (§8), and a host that is no `Display` needs no `frameLoop` |
| steps run "after the draw", by the order of the subscriptions | no order assumed | §3.3 |
| `STEADY_FPS` | `FramePacer.DefaultSteadyFps` | the defaults of the module are statics of their class, as `Display.DefaultMaxPixelRatio` |
| the frame handler invalidates on resize and restart | the pacer does, on a source that has the two | §4.2 |
| a stride that follows the average of the frame gaps directly | the same stride, moved only by a pick that lasts 30 frames | §5.3: at 144 Hz the ratio lies 1 % from the edge between two strides |
| — | `dispose()`, `isDisposed`, the refusals of §4.4 | the rules of the library |

`hold()`, the ref-counted busy of the consumer's wish list, comes with the director in phase B;
by hand, `busy` is an argument.

## 5. How the pacer decides

### 5.1 State

Two flags and a handful of numbers, no object per frame:

- `full` and `steady` — the pending reports; `full` starts `true`;
- `sinceDraw` — the frames asked about since the last draw;
- `frameMs` — the average gap between two frames, `0` until the first gap is measured;
- `stride` — every how many frames `'steady'` draws, `0` until `frameMs` is known;
- `strideDoubt` — the measurements in a row that picked another stride than the one that stands;
- `frames`, `draws`.

### 5.2 `shouldDraw()`

```text
frames += 1
measure the gap of this frame (§5.3)
sinceDraw += 1
draw = busy or full or (steady and sinceDraw >= max(1, stride))
if draw: full = steady = false, sinceDraw = 0, draws += 1
```

A `'steady'` that comes in after a long silence draws with the next frame — `sinceDraw` has run
far past the stride —, and a `'steady'` that was reported once and never again still draws once,
at its stride: the last state of an animation that ended reaches the canvas.

### 5.3 The steady stride

`'steady'` draws every n-th frame. The stride follows the screen, so that 30 frames per second
are 30 on every refresh rate:

- **The gap** of a frame is `frame.rawDeltaTime`, in milliseconds — the time since the frame the
  loop emitted before, pauses of the display not counted; where the props carry no finite
  `rawDeltaTime`, `deltaTime` stands in, as in `FixedFrameLoop`. A gap of 0 or less (the first
  frame, a frame rendered during a pause) and a gap of 250 ms and more (a hidden tab, a
  breakpoint — no frame rate) measure nothing.
- **`frameMs`** is the exponential average of the gaps, smoothing 0.1; the first gap sets it.
- **The ratio** `r = (1000 / steadyFps) / frameMs`, and the stride a measurement picks is
  `floor(r + 0.25)`, at least 1: a screen may be a quarter of a frame too slow for a stride and
  still gets it.
- **A pick has to last.** The first measurement sets the stride. Afterwards the stride moves only
  once 30 measurements in a row have picked another one than the one that stands, and it moves to
  the pick of the thirtieth.

| screen | ratio at 30 fps | stride | drawn per second |
| --- | --- | --- | --- |
| 60 Hz | 2.0 | 2 | 30 |
| 75 Hz | 2.5 | 2 | 37.5 |
| 90 Hz | 3.0 | 3 | 30 |
| 100 Hz | 3.33 | 3 | 33.3 |
| 120 Hz | 4.0 | 4 | 30 |
| 144 Hz | 4.8 | 5 | 28.8 |
| 165 Hz | 5.5 | 5 | 33 |
| 240 Hz | 8.0 | 8 | 30 |
| `maxFps: 30` on any screen | 1.0 | 1 | 30 |

The stride of a 144 Hz screen stands 1 % from an edge — `r = 4.8`, and below 4.75 the pick is 4 —,
so the jitter of single frames, or timestamps a browser rounds, would flip a fire between 28.8 and
36 frames per second from one frame to the next. A pick that has to last ends that: jitter crosses
the edge for a frame or two, never for thirty. A few dropped frames in a row do not move the
stride either.

The rule goes by time and not by a band around the ratio, because a band keeps what the average
passed on its way: a first frame of 100 ms — the shaders compile — starts the average far off,
the ratio climbs through the band of stride 4 on its way to 4.8, and a band of ±0.1 around the
edges would hold it there, at 36 frames per second on one start and 28.8 on the next. With the
rule the stride ends where the average ends, whatever the start: a change of regime — a slow
start, a new screen, a new `maxFps` — reaches its stride some 30 frames after the average has
arrived.

Until the first gap is measured the stride counts as 1: `'steady'` draws every frame rather than
guess a screen.

### 5.4 Stages that are not live

A stage behind an overlay keeps its picture: the director draws it from its pass memory, not
anew. The steps of such a stage run on, but nothing they move reaches the canvas, so their answers
draw nothing: the answer of a step registered with a `stage` counts only if `live(stage)` answers
`true` in that frame. `live` is asked only for a step that reports something. The stage comes back
through a change of the stack, and that change invalidates — by hand in phase A (§6), by the
director in phase B, where `live` is its freeze state (§7).

`report()` and `invalidate()` name no stage and always count.

### 5.5 A step that throws

Every step of the frame runs, also behind one that throws; the errors come out of the frame
listener afterwards, one unchanged, several as an `AggregateError`
(`FramePacer: more than one frame step threw`). A frame in which a step threw invalidates: what
the step wrote before it threw is unknown, and a picture that may be stale is drawn anew.

### 5.6 The hot path

`shouldDraw()` and the run of the steps allocate nothing per frame: the steps live in an array of
records built by `onFrame()`, the run walks it by index, an unsubscribe during the run marks its
record and the array is compacted after the run, and the array of errors exists only in a frame
that throws. `src/display/hot-path-allocations.frame-pacer.spec.ts` holds both.

## 6. By hand: a director without a host

Phase A is used with a `StageRenderer` or a `StageDirector` that has no host, driven from a frame
handler — the guide has the program under "Drawing on demand" in [`display.md`](../display.md):

```ts
const director = new StageDirector(); // no host
const frames = new FramePacer(display, {live: (stage: IStage) => !director.isFrozen(stage)});

display.onRenderFrame((frame) => {
  const transitioning = director.transitions.length > 0; // read before updateFrame()
  director.resize(frame.width, frame.height, frame.pixelRatio);
  director.updateFrame(frame.now, frame.deltaTime, frame.frameNo); // always
  if (frames.shouldDraw(frame, transitioning)) director.renderTo(frame.renderer);
});
```

What the app invalidates itself in phase A, because the pacer cannot know of it: every change of
the stack and of the scene outside a step, a texture that finished loading, a state change of the
app. The resize and the restart are the pacer's (§4.2).

## 7. Phase B — the director integration

An option of the hosted renderer:

```ts
const director = new StageDirector(display, {drawing: 'on-demand'}); // default 'continuous'
director.frames.onFrame(step, stage); // the pacer the director owns
director.frames.invalidate();
const release = director.frames.hold(); // busy until released
```

- `updateFrame()` runs every frame as today; `renderTo()` only when the pacer asks.
- **The director invalidates by itself** for everything it knows about: a running transition
  (busy, the frame it ends in included), `show`/`hide`/`replace`/`push`/`pop`/`setStack`,
  `setMask` and a change of a mask, `freeze`/`run`, `add`/`remove`, `setClearColor`, a change of
  the pipeline, of `buildOutputNode` or of the post-process of a stage, `resize`, the restart of
  the display, a new renderer.
- **`live(stage)` is the freeze state**: a step registered for a frozen layer draws nothing.
- **`hold()`** on the pacer, ref-counted, returns its release: the busy phases of the app — a
  camera move, a stage being prepared — without a flag threaded into the frame handler.
- **Texture loading of the library** (`TextureStore`, `TextureFactory`) invalidates on load.
- **`OnStageUpdateFrame`** listeners change the scene and cannot report today. Open (§14).

## 8. Phase C — interactions

1. **`AdaptiveResolution`** assumes every frame is drawn: `gpu-time` resolves a timestamp per
   frame, and a frame that drew has none; `frame-pacing` reads the pace of the frames, and frames
   that draw nothing are cheap and would push the scale up. The controller samples drawn frames
   only and holds still while the pacer is idle or only steady.
2. **`maxFps`** throttles the loop, the stride throttles draws. The stride is measured on the gaps
   of the frames the loop emits (§5.3), so under `maxFps: 30` a steady animation draws every
   frame. Held by a spec of phase A already.
3. **The shader uniform `time`** (`AnimatedFrames`, `wave()`): an animation that runs on the GPU
   alone changes the picture without a step on the CPU, and under drawing on demand it freezes
   without a word unless something reports `'steady'`. Either a sprite feature that reads `time`
   registers as steady while its pool has sprites, or the guide rules that a `time` that runs goes
   with a report. The guide of phase A names the pitfall first of all.
4. **Temporal post-processing** in a `RenderPipeline` — anything that reads the frame before —
   does not go with skipped frames: counted as steady, or refused with a message.
5. **Canvas retention** on the engines §2 leaves open.
6. **A lost and restored context** invalidates, as the restart does.
7. `Display#renderFrame()` calls of the app, `SpritePicker#pick()` and `precompile()` are not
   paced.

## 9. Phase D — a safety net

The risk of the feature is a silent one: a building block that forgets to report throws nothing,
its part of the picture just stands still. So phase B does not ship without:

- **a verify mode**, for development: a frame the pacer would skip is drawn into a small
  off-screen target and compared with the one drawn last; a difference warns once, naming the
  layer (`StageDirector: on-demand drawing skipped a frame although layer "…" changed; report it
  from a frame step or call invalidate()`);
- optionally an overlay that flashes drawn against skipped frames.

The counters of phase A are the part of it that exists.

## 10. Phases

| phase | what | waits for |
| --- | --- | --- |
| A | `FramePacer`, `untilSettled()`, the frame-step contract, the browser test of §2, the guide section | — |
| B | `drawing: 'on-demand'` on `StageDirector`, `director.frames`, `hold()` | a stage that carries its own post-process (issue #53), and the building blocks that answer in frame steps (issues #54, #56, #57), which the integration is tested against |
| C | the interactions of §8 | B |
| D | the verify mode | B; B does not ship without it |

## 11. Tests

### 11.1 Vitest (`src/display/FramePacer.spec.ts`, `src/display/untilSettled.spec.ts`)

- the first frame draws; a frame without a report draws nothing; `invalidate()` and
  `report(true)` draw the next frame, once; `report(false)` and `report(undefined)` draw nothing;
  an unknown truthy answer counts as `true`;
- `busy` forces the draw and takes the pending reports; a draw takes every report, `'steady'`
  included;
- the answer of a step is a report; a step runs with the props of its frame; steps run in the
  order they were registered; a step registered in a run first runs in the next frame; one
  unsubscribed in a run does not run any more; one function registered twice runs twice;
- the stride: 60, 75, 90, 100, 120, 144, 165 and 240 Hz draw at the stride of the table of §5.3;
  165 Hz and 144 Hz with a jitter of single frames keep 5; 144 Hz ends at 5 after first frames
  of 100 ms; three dropped frames in a row do not move the stride;
  gaps of 0 and of 250 ms and more measure nothing; `maxFps: 30` — gaps of 33.3 ms — draws every
  frame; `steadyFps` moves the stride; a screen that changes its rate moves it; without a
  measured gap `'steady'` draws every frame; props without `rawDeltaTime` fall back to
  `deltaTime`;
- `'steady'` after a silence draws the next frame; a `'steady'` reported once draws once;
- the answers of a step with a stage that is not live draw nothing, the step runs all the same;
  `live` is asked only for a step that reports; a step without a stage always counts;
- a step that throws: every step runs, the frame invalidates, one error unchanged, two as an
  `AggregateError`;
- a source with `onResize` and `onRestart` invalidates through them; one without them is taken;
- the refusals of §4.4; a source that throws while the pacer subscribes holds nothing of it;
- the type of a stage: `onFrame()` takes nothing but the stage type `live` names;
- `dispose()`: gives every subscription back, is idempotent, and the members behave as §4.5 says;
- `untilSettled()`: `true` while moving, once more as it comes to rest, `false` afterwards and
  before; two functions do not share their memory.

### 11.2 Allocations (`src/display/hot-path-allocations.frame-pacer.spec.ts`)

`shouldDraw()` on a pacer that is idle, steady and busy, and the run of the steps with steps that
report nothing, `true` and `'steady'`, with and without a stage: nothing per call.

### 11.3 Browser (`packages/twopoint5d-testing/test/display-drawing-on-demand.test.js`)

Under WebGPU and WebGL 2, with screenshots of the page: `pageScreenshot()` in
`test/helpers/fixtures.js` sends the server command `page-screenshot`, a plugin of
`web-test-runner.config.js` that asks Playwright for a screenshot of the page of the session.

- the canvas keeps its picture across frames that draw nothing;
- a change nobody reported does not reach the canvas;
- after a change and an `invalidate()` the canvas shows the same as a display that draws every
  frame;
- after a resize the canvas shows the picture again, without a report of the test.

## 12. Docs and CHANGELOG

- [`docs/display.md`](../display.md): "Drawing on demand" — the recipes (a scene that stands
  still, a motion that ends, an animation that never ends, a layer behind an overlay), the
  pitfalls with the `time` uniform first, a row in "Which setup?", a block in the cheat sheet,
  the stride in the reference; a pointer in "Driving the frame loop yourself" of
  [`docs/stages.md`](../stages.md).
- [`docs/architecture.md`](../architecture.md): the pacer in the paragraph of `display/`.
- `CHANGELOG.md`: "Added" under `## [Unreleased]`.

## 13. Left out

- **Throttling the frame loop.** That is `maxFps`; here the loop runs on and the draw becomes
  conditional.
- **Invalidation sources of an app** — a sync of its logic, its state events. They call
  `invalidate()`.
- **A pacer that subscribes to nothing** and is ticked by the frame handler. The source is what
  lets a building block register a step without the frame handler knowing of it.
- **A lookbook demo** in phase A: the demo of the feature is the director option of phase B, with
  one steady element, a move on a click and the counters on screen.

## 14. Open questions

- **Safari.** Canvas retention on macOS and iOS Safari is not checked on a device (§2).
- **Firefox and WebKit under WebGPU**, once a launcher of the browser tests offers them.
- **`OnStageUpdateFrame` (phase B).** A `report` in the props of the event, or a
  `stage.invalidate()` that bubbles to the renderer.
- **Loaders of the app (phase B).** Whether the pacer should chain into three's
  `DefaultLoadingManager.onProgress` for textures the library did not load.
- **The `time` uniform (phase C)**: registered by the feature, or ruled by the guide (§8.3).
