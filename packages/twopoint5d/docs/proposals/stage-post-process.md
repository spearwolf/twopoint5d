# Proposal: a post-process on one stage — `Stage2D#postProcess`

Status: **implemented** — see [`docs/stages.md`](../stages.md), "An effect on one stage", with its
rows in "Post-processing", "Events", "Who disposes what", "Pitfalls" and the cheat sheet; the
Vitest specs `src/stage/Stage2D.postProcess.spec.ts` and
`src/stage/hot-path-allocations.post-process.spec.ts`, the cases in
`src/stage/StageRenderer.spec.ts` and `src/stage/StageDirector.spec.ts`, the browser test
`packages/twopoint5d-testing/test/stage-post-process.test.js`, and the lookbook demo
*stage post-process: the etching*. From
[issue #53](https://github.com/spearwolf/twopoint5d/issues/53).

Where the build left the first draft:

- the quad of the stage clears colour and depth of its target first (§4.2) — a stale depth
  rejected it under WebGL 2;
- a frozen layer of a `StageDirector` draws once more after a new post-process (§4.6) — the blur
  behind a pause menu would not have shown otherwise;
- a renderer in the whole-picture mode warns for a post-processed stage beside others as well
  (§5), since the stage clears the internal target they share;
- a `build()` that assigns `postProcess` or disposes the stage is refused (§3.1, §3.4), and a
  draw that threw is asked again under a composing renderer and for a frozen layer (§4.3, §4.6);
- the output render target of the renderer counts as the canvas for the output transform (§4.2).

Post-processing is a property of a renderer today: a `StageRenderer` takes a `pipeline`, and an
effect on one layer is a child renderer with a pipeline of its own under a composing parent
(`docs/stages.md`, "Nested pipelines"). The effect lives on the container, not on the thing it
belongs to. In an app driven by a `StageDirector` that costs a second object for everything that
names the stage — a layer, the source of a transition, a `freeze()`, a `precompile()`.

`Stage2D#postProcess` puts the look on the stage: an output node built over the scene pass of the
stage. The stage draws with its effect wherever it is drawn — as a layer of a director, as a stage
of a composing renderer, alone in a renderer without a pipeline — and nothing else changes.

The idea is proven in a consumer of the library: every room of a point-and-click game draws
through an ink pass (colour, view normals and ink tags as MRT, an edge pass over them), as the
bottom layer of a `StageDirector` with dip, dissolve and iris transitions over it, under WebGPU and
WebGL 2.

## 1. Goal

| who | what they get | § |
| --- | --- | --- |
| a stage with a look of its own — ink, CRT, a palette pass | `stage.postProcess = …`; the director, the transitions and the masks see the processed picture | 3, 4 |
| a blur behind a menu | the same property, set while the menu is up and taken away after | 3.2 |
| an app that composes its stages in a pipeline | the same stage, the same post-process, the same picture | 4.3 |
| one look on several stages | one `StagePostProcess` object serves every stage it is assigned to | 3.1, 7 |

## 2. The two ways a stage is drawn

A `Stage2D` is drawn in one of two ways, and a post-process has to hold in both:

- **`renderTo(renderer)`** draws the scene into the current target of the renderer. This is how a
  `StageRenderer` without a pipeline draws its stages, how one in the whole-picture mode fills its
  internal target, and how a `StageDirector` draws a layer: it wraps a stage in a `StageRenderer`
  of its own and draws that into the pass target of the layer.
- **`asPassNode(renderer)`** hands a node to a renderer that composes — one with a
  `RootRenderPipeline` or a `buildOutputNode`. The stage does not draw; the pipeline of the
  renderer draws the node as a part of its graph.

Without a post-process the first is `renderer.render(scene, camera)` and the second is
`pass(scene, camera)`. With one, the first runs a `RenderPipeline` of the stage over the output
node of the post-process, and the second answers that output node.

## 3. API

```ts
import type {Node, PassNode} from 'three/webgpu';

export interface StagePostProcessInput {
  /** The stage the node is built for. */
  stage: Stage2D;
  /** The scene pass of the stage — one of its own for this build; setMRT() and the like are free. */
  pass: PassNode;
  /** Registers a release for what build() made; the stage calls it when it lets go of the node. */
  onDispose(release: () => void): void;
}

export interface StagePostProcess {
  build(input: StagePostProcessInput): Node;
}

class Stage2D {
  postProcess: StagePostProcess | undefined;
}

export const OnStageAfterPostProcessChanged = 'stageAfterPostProcessChanged';
export type StageAfterPostProcessChangedArgs = [stage: IStage, prevPostProcess: StagePostProcess | undefined];
```

### 3.1 `StagePostProcess`

A post-process is a description, as a `StageTransitionEffect` is: `build()` makes new nodes on
every call, and the object keeps nothing of a build. So one object serves every stage it is
assigned to, and it belongs to the caller — a stage never disposes it.

`build(input)` answers the output node of the stage: a colour with premultiplied alpha, as the
pass itself gives it. The stage calls it once per assignment, before the first draw that needs the
node — a stage that is never drawn builds nothing.

- **`input.pass`** is a `PassNode` the stage made for this build alone, over its scene and its
  camera. `build()` may configure it: `pass.setMRT(…)`, `pass.setLayers(…)`,
  `pass.setResolutionScale(…)`. Nothing of that outlives the build — the stage disposes the node
  with it — and nothing of it reaches the pass node a stage without a post-process hands out.
- **`input.stage`** is the stage, for a build that reads its camera or its size.
- **`input.onDispose(release)`** registers a function for what the build made on the GPU — a
  `bloom()`, a `gaussianBlur()` and every other node that owns render targets. The stage calls
  every registered function once, in the order of registration, as soon as it lets go of the
  node: on an assignment to `postProcess`, and in `dispose()`. A function registered after that
  runs at once.

```ts
const glowing: StagePostProcess = {
  build: ({pass, onDispose}) => {
    const glow = bloom(pass, 1.2, 0.6);
    onDispose(() => glow.dispose());
    return pass.add(glow);
  },
};

world.postProcess = glowing;
cellar.postProcess = glowing; // a build of its own, a bloom of its own
```

A `build()` that throws leaves the stage without a node: what it registered is released, the pass
of the build is disposed, the error comes out of the `renderTo()` or the `asPassNode()` that asked,
and the next draw asks again. The same goes for a `build()` that answers no node, which is a
`TypeError`, and for one that assigns `postProcess` or disposes the stage while it runs: the stage
has let go of that build by then, so the node it answers is refused and nothing of it stays.

### 3.2 `Stage2D#postProcess`

`undefined` by default. An assignment of another object lets go of the node the previous one
built — its releases run, its pass and the pipeline of the stage are disposed — and announces
`OnStageAfterPostProcessChanged` with the stage and the post-process it replaced. The new node is
built by the next draw. An assignment of the object the stage has already changes nothing and
announces nothing; to build again, assign another object.

`undefined` takes the post-process away: the stage draws its scene as it did before.

The new value stands before anything foreign runs — the releases first, then the listeners. A
release that assigns `postProcess` again, or disposes the stage, finds the stage as the
assignment leaves it, and its own change stands.

### 3.3 The event

`OnStageAfterPostProcessChanged` follows `OnStageAfterCameraChanged` and
`OnStageAfterSceneChanged`: every listener hears it, also behind one that throws; the stage has
taken the new post-process by then, and the error reaches the caller afterwards — one unchanged,
several as an `AggregateError`, together with what the releases of the previous node threw.

A `StageRenderer` listens for it on every eventized stage it holds, as it does for a new camera
and a new scene: its next composing frame asks the stage for its node and builds its output node
again for another one.

### 3.4 Refusals

| what | the error |
| --- | --- |
| a `postProcess` that is neither `undefined` nor an object with a `build()` method | `TypeError`: `Stage2D#postProcess must be a StagePostProcess with a build() method or undefined, got …` |
| a `build()` that answers no node | `TypeError`: `Stage2D#postProcess: build() must answer a node, got …` |
| an `onDispose()` with something that is no function | `TypeError`: `StagePostProcessInput#onDispose(): release must be a function, got …` |
| a `build()` that assigns `postProcess` or disposes the stage | `Error`: `Stage2D#postProcess: the stage let go of this post-process while its build() ran: a build() neither assigns postProcess nor disposes the stage` |

### 3.5 After `dispose()`

`Stage2D#dispose()` lets go of the node as an assignment does, after `OnStageDispose` and before
the release of its own pass node. Afterwards a write to `postProcess` does nothing, as a write to
`camera` and `projection` does nothing, and the property answers the value it was left with.

## 4. How it works

### 4.1 One build per assignment

The stage keeps one internal object per assigned post-process: the pass of the build, the output
node, the registered releases, and the pipeline of the plain path. It is made with the assignment
and filled by the first draw with a camera; an assignment and a `dispose()` release it whole. The
class is internal (`StagePostProcessRun` in `src/stage/StagePostProcess.ts`), and `Stage2D` only
delegates to it.

### 4.2 `renderTo()`: a pipeline of the stage

With a post-process and a camera, `renderTo(renderer)` runs a `RenderPipeline` over the output
node, built for the renderer it is handed and built again for another one. Around
`pipeline.render()` the stage sets two things on the renderer and restores them afterwards:

- **Linear output into a render target.** three.js' `RenderPipeline` bakes the tone mapping and
  the output colour space of the renderer into its quad, whatever target it draws into, and builds
  the quad again when either changes. A plain `renderer.render()` writes linear into a render
  target and transformed onto the canvas. The stage does the same: with a render target set, it
  switches the renderer to `NoToneMapping` and the working colour space for its draw; on the canvas
  — and into the output render target of the renderer, which three.js treats as the canvas — it
  leaves both alone, and the pipeline applies the transform of the renderer. So a
  post-processed layer of a director writes linear into its pass target, and the director
  transforms once — and a stage alone on the canvas is transformed once, by its own pipeline.
  `pipeline.outputColorTransform` is left at its default: the pipeline reads it only when it
  builds, and the renderer state decides anyway.
- **A transparent clear for the pass.** The `PassNode` clears its target with the clear colour of
  the renderer before it draws the scene. The stage sets that to transparent black for its draw:
  where its scene draws nothing its picture is transparent — as the picture of the same stage
  without a post-process is in the pass target of a director.
- **A clear before the quad.** The quad of the pipeline covers every pixel of the current target,
  and the stage has it clear colour and depth of that target first: `renderer.autoClear`,
  `autoClearColor` and `autoClearDepth` are on for the draw, whatever the caller set — a
  `StageRenderer` turns `autoClear` off while it draws its stages. Against a depth an earlier draw
  left in the target, the quad fails its depth test under WebGL 2 and that draw stays; a browser
  test holds the case.

None of the three allocates: the previous clear colour waits in a `Color` of the run.

### 4.3 `asPassNode()`: the output node

With a post-process, `asPassNode(renderer)` answers the output node, built on the first call. The
pipeline of the stage is not used on this path: the node is a part of the graph of the composing
renderer, which transforms once at its end. The pass of the build clears with the clear colour the
renderer has while the composing pipeline runs, as the pass of a stage without a post-process
does.

A composing `StageRenderer` asks its stages for their nodes in the frame after one of them
announced a change, and keeps asking while a stage throws from `asPassNode()`: a `build()` that
failed is asked again by the next frame, and the renderer composes no node the stage has let go
of.

"The same node for the life of the stage" becomes "the same node for as long as `postProcess`
stays": the stage hands its plain pass node without a post-process, and the output node of the
current build with one.

### 4.4 Scene and camera

A new `scene` or `camera` goes into the pass of the build as it goes into the plain pass node: the
node stays, and nothing is built. A `build()` that reads the camera itself — an ambient occlusion
node takes one — reads `input.stage.camera` at build time; an app that replaces the camera of such
a stage assigns a new post-process after it.

### 4.5 Memory

`releasePassNodeMemory()` releases the render target of the pass of the build as well. An
assignment of a post-process releases the render target of the plain pass node, which is not drawn
while the post-process stays. What the build registered through `onDispose()` stays until the
stage lets go of the node.

### 4.6 A frozen layer of a director

A `StageDirector` neither updates nor draws a frozen layer, so a post-process assigned to its
stage would not show. The director listens for `OnStageAfterPostProcessChanged` on every eventized
stage it wraps and marks the layer as one without a picture: it draws once more, without an
update, as a frozen layer does after a resize. The blur behind a pause menu rests on it.

A draw of the director that throws — a `build()` that failed — may have cleared the target of a
frozen layer without drawing it. The director marks every frozen layer as one without a picture
then, and each draws once more with the next frame.

## 5. Supported setups

A `RenderPipeline` makes the last draw to its target: its quad covers every pixel without
blending (`docs/stages.md`, "One writer per canvas"). On the `renderTo()` path a post-processed
stage is such a writer.

| the stage is | path | supported |
| --- | --- | --- |
| a layer of a `StageDirector`, the stage of a `StageMask` | `renderTo()` into a target of its own | yes |
| a stage of a composing `StageRenderer` | `asPassNode()` | yes |
| the only stage of a `StageRenderer` without a pipeline, or in the whole-picture mode | `renderTo()` | yes; the picture of the stage replaces the clear of the renderer |
| one of several stages of a `StageRenderer` without a pipeline, or in the whole-picture mode | `renderTo()` | no: what the stages before it drew is lost, and the renderer warns once |

The warning follows the one a renderer without a pipeline gives for a child with a pipeline:
`StageRenderer "…" draws the stage "…", which runs a post-process, into one target with other
stages: …`. Its remedy: compose the stages — a `RootRenderPipeline` —, or show them as layers of a
`StageDirector`. In the whole-picture mode the stages share the internal target, so the renderer
warns there as well.

## 6. Ownership

- The `StagePostProcess` object belongs to the caller. The stage calls its `build()` and never
  disposes it.
- What a build made is released by the stage, through the functions the build registered: on an
  assignment and in `dispose()` (`docs/resource-lifecycle.md`, §1 — who asks for the build
  releases it).
- The pass of the build and the pipeline belong to the stage.

## 7. `precompile()`

`StageDirector#precompile(renderer, shapes, {layers: [stage]})` draws each of the layers once, off
screen, on linear output, into a target of the kind of its pass targets — through `renderTo()`.
For a post-processed stage that draw builds the node, the pipeline and their shaders, and the
first frame of the layer in the stack finds the same renderer state and builds nothing. `precompile()`
needs no change for it; a browser test holds it.

## 8. Against the reference

| the reference | the library | § |
| --- | --- | --- |
| a subclass `PostProcessStage` | a property of `Stage2D`: a stage that has a class of its own, or gets its effect only while a menu is up, needs no other base | 3.2 |
| `build(scenePass)` and a `dispose()` the stage calls | `build(input)` with `onDispose()`: the object stays the caller's, and one object serves several stages | 3.1, 6 |
| the pass node of the stage is handed to `build()` | a pass of its own per build: an MRT of the build does not stay on the stage | 3.1 |
| a rebuild for a new scene or camera | none: both go into the pass | 4.4 |
| `outputColorTransform = false` | the renderer state decides: linear into a render target, the transform on the canvas | 4.2 |
| — | `OnStageAfterPostProcessChanged`, so that a composing renderer follows an assignment | 3.3 |
| — | the warning for a post-processed stage beside others | 5 |
| — | a frozen layer of a director draws once more with a new post-process | 4.6 |
| the quad draws over what is in the target | the quad clears colour and depth first | 4.2 |

## 9. Tests

### 9.1 Vitest (`src/stage/Stage2D.postProcess.spec.ts`, `src/stage/StageRenderer.spec.ts`)

- `postProcess` is `undefined` by default; an assignment announces the event with the previous
  value; the same object announces nothing; the refusals of §3.4;
- `build()` runs once, on the first draw with a camera, with the stage, a `PassNode` over its
  scene and camera, and `onDispose`; not without a camera; not for a stage that is never drawn;
- `asPassNode()` answers the output node with a post-process and the plain pass node without, and
  the plain pass node again after `undefined`;
- `renderTo()` runs a pipeline over the output node; another renderer gets another pipeline; with
  a render target set the renderer is linear during the draw and as it was afterwards, on the
  canvas it is left alone; the clear colour is transparent black and the auto clear of colour and
  depth is on during the draw, and all are as they were afterwards, also when the pipeline throws;
- a new scene and a new camera go into the pass of the build, and `build()` does not run again;
- an assignment and `dispose()` run the releases once, in order, and dispose the pass and the
  pipeline; a release that throws holds up none of the others; a release registered afterwards
  runs at once;
- a `build()` that throws releases what it registered and is asked again by the next draw;
- one object on two stages builds twice, and a dispose of one stage leaves the other its node;
- a composing `StageRenderer` builds its output node again after an assignment; a renderer
  without a pipeline, and one in the whole-picture mode, warns once for a post-processed stage
  beside another stage, and not for one alone; a composing renderer asks again in the frame after
  a `build()` threw;
- a `build()` that takes the post-process away or disposes the stage is refused and leaves
  nothing behind; a release that assigns again or disposes the stage finds the new value in place;
- the output render target of the renderer keeps the output transform, as the canvas does;
- a frozen layer of a `StageDirector` draws once more after its stage announced a new
  post-process, without an update, and again after a draw that threw
  (`src/stage/StageDirector.spec.ts`).

### 9.2 Allocations (`src/stage/hot-path-allocations.post-process.spec.ts`)

`renderTo()` with a post-process, onto the canvas and into a render target, and `asPassNode()` of
a build that stands allocate nothing; the draw of three.js' pipeline is left out of the measure.

### 9.3 Browser (`packages/twopoint5d-testing/test/stage-post-process.test.js`)

On every launcher:

- the same pixels as a layer of a `StageDirector`, as a stage of a composing `StageRenderer` and
  as a child renderer with the equivalent pipeline;
- alone under a renderer without a pipeline: linear into a render target, as the stage without a
  post-process writes there — also over the depth that plain draw left in the target —, and
  transformed once on the canvas, read from a screenshot of the page;
- a post-processed layer over another layer shows the layer below where its scene draws nothing;
- a transition over a post-processed layer mixes the processed picture;
- an assignment while the stage is drawn changes the picture, and `undefined` brings back the
  plain one — as a layer of a director and under a composing renderer;
- a frozen layer of a director draws once more with a new post-process;
- after `precompile()` with the stage among its `layers`, the first frame of the layer builds no
  shader.

## 10. Docs, CHANGELOG, lookbook

- `docs/stages.md`, "Post-processing": the section "An effect on one stage" before "Nested
  pipelines", the row in the table of the section, the events, "Who disposes what", the pitfalls
  and the cheat sheet.
- `CHANGELOG.md`: `Stage2D#postProcess`, the two types and the event under "Added".
- Lookbook: *stage post-process: the etching* (`apps/lookbook/src/pages/demos/stage-post-process-etching.astro`,
  `apps/lookbook/src/demos/stage-post-process/`) — a room drawn as an etching or through a
  night-vision scope as the bottom layer of a `StageDirector`, an iris onto a second room with the
  same post-process object, and a caption without a post-process on top. It reuses the pictures
  of *stage masks: matte 3d*.

## 11. Left out

- **Ready-made post-processes.** The library ships none; three.js' effect nodes are three lines in
  a `build()`.
- **A post-process on a `Canvas2DStage` or on a renderer.** A renderer has its `pipeline`.
- **Blending the quad over what is in the target.** It would make a post-processed stage a layer
  in a renderer without a pipeline; it needs the quad of three.js' `RenderPipeline`, which is not
  part of its API.

## 12. Open questions

1. **A child with a pipeline in the whole-picture mode**, beside other stages, covers what they
   drew into the internal target as a post-processed stage does, and gets no warning there.
2. **A `scene.background`** is drawn by the pass of a post-processed stage, as by the pass of a
   composing renderer; a stage without a post-process under a director ignores a background
   colour, since nothing clears for it there.
3. **The stage of a `StageMask` with a `scale`.** The pass of its post-process keeps the size of
   the drawing buffer; only the target of the mask shrinks. A `build()` brings the pass down with
   `pass.setResolutionScale()` itself.
