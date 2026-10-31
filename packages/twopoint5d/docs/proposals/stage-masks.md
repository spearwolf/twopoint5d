# Proposal: stage masks — a stage that masks another one, and transitions through a living matte

Status: **specified**

A `StageDirector` lays layers over each other and changes them through transitions whose effects
are TSL functions of two pictures and a progress. What it cannot do is let a *third* picture decide
where a layer shows: a fog of war that a scene shows through only around the player and its
torches, a rift through which a second world shows inside the first, a vignette of ink that eats
into a menu. And a transition whose mask is not a gray texture but a stage of its own — ink blots
that spread, shards of glass that fly apart, a 3D object that turns in front of the camera — has
no place in the effect contract at all.

This proposal adds **stage masks**: a `StageMask` is a stage whose picture is read as coverage. A
slot of a director carries a mask for as long as the caller wants (§3), a transition effect samples
masks next to its two sources (§4), and `matte()` is the built-in effect that turns a living stage
into the matte of a transition (§4.3). The mask is a picture, not a stencil: §6 says why, and what
stencil is still good for. §7 thinks the masks in 3D — in screen space, in the space of the world,
and later against the depth of the scene.

## 1. Goal

| who | what they get | § |
| --- | --- | --- |
| a level under a fog of war, a spotlight, a vignette that lives | `director.setMask(level, fog)`: the slot of the level shows only where the mask stage draws | 3 |
| a second world through a rift or a portal in the first | the stack `[world, other]` with a mask on the slot of `other`: the mask decides where which world shows | 3.3 |
| a mask that never changes, at no cost per frame | a frozen mask stage: drawn once, sampled ever after | 3.4 |
| a transition through spreading ink, flying shards, a turning object | `matte({mask})`: the picture of a mask stage is the coverage of `to`, and the stage animates by the progress of the transition | 4.3 |
| an effect of one's own that reads a living stage — a heat haze, a displacement | `masks` on the effect and `input.mask(m)` in `build()` | 4.1 |
| a renderer composed by hand | `createMaskNode(content, mask)` for a `buildOutputNode` of one's own | 5 |
| a mask that lies in the world, not on the screen | `StageMask.inWorldOf(stage, scene)`: the mask scene drawn through the camera of the stage | 7.2 |
| a world map or a dungeon under a living fog over what is not explored yet | `RevealMap` — the explored cells, kept on the CPU, saved with the game — and `fogCoverage()`, the living edge in TSL | 8 |
| the three states of a fog of war: unexplored, remembered, in sight | masked slots of the stack, a sight mask that forgets and a `RevealMap` that remembers | 8.4 |

## 2. What the stage layer gives today, and where it ends

The question this proposal answers was asked against [`docs/stages.md`](../stages.md) and
[`stage-transitions.md`](stage-transitions.md): how well does the API as it is express a stage that
masks another stage?

| scenario | today | verdict |
| --- | --- | --- |
| a mask in a plain composing `StageRenderer` | both stages in one renderer, a `buildOutputNode` of one's own: `([scene, mask]) => scene.mul(mask.a)` | works; the caller writes the TSL and has to know that the passes are premultiplied |
| a masked layer in a `StageDirector` | the layer is a `StageRenderer` of its own with a `RenderPipeline` and the `buildOutputNode` above; the director composes its output | works, and costs a pass target and a full-screen quad per masked layer on top of the targets of its two stages — at 3840 × 2160 an RGBA half-float target alone is 66 MB, its depth buffer 33 MB more |
| one mask over two layers | the mask stage in the nested renderer of each layer | a `StageRenderer` as the mask does not work: a renderer has one holder. A `Stage2D` does: `asPassNode()` hands every renderer that composes it the same pass node, drawn once per frame — but every one of those renderers calls its `updateFrame()`, so a mask that animates in `OnStageUpdateFrame` runs once per holder and frame, twice as fast under two |
| a transition through a living mask | `lumaMask({mask: rt.texture})` with `rt` the `outputRenderTarget` of a `StageRenderer` hung on the display beside the director | a hack: the mask draws before the director only by the order in which both subscribed to the display; `lumaMask()` samples its mask as a mesh samples a texture (`1 - uv.y`), so a render-target texture, which the director samples at `uv`, comes out upside down; the mask stage runs on the clock of the display, not on the progress of the transition, so a `manual: true` transition never drives it; and it draws in every frame, also while no transition runs |
| a mask through stencil | — | does not work across stages: see §6 |

The building blocks are there — pass targets of the size of the director, texture nodes that swap
their texture without a shader build, run and freeze, the shape cache, `precompile()`. What is
missing is the concept of a stage that the director draws but does not show, and a place for it in
the composition and in the effect contract.

## 3. Masks on slots

### 3.1 The mask

```ts
import {StageMask} from '@spearwolf/twopoint5d';

// a stage that draws soft white blobs on transparent black: around the player, around every torch
const fogStage = new Stage2D(new OrthographicProjection('xy|bottom-left', view));
const fog = new StageMask(fogStage, {source: 'alpha'});
```

`new StageMask(stage, options?)` binds one stage as a mask:

| option | default | |
| --- | --- | --- |
| `source` | `'alpha'` | what of the picture is the coverage: `'alpha'`, `'luminance'`, `'red'`, `'green'`, `'blue'` |
| `invert` | `false` | `1 - coverage`: the mask cuts out where its stage draws |

The options are read once, as the options of an effect are: they go into the shader. `'alpha'` is
the default because a mask stage clears nothing and draws its shapes — every sprite, every mesh
with its own alpha and blending — onto transparent black; `'luminance'` takes a gray picture, a
painting or a `Canvas2DStage`-like stage, whose luminance is read in the linear working space.
Every source reads the premultiplied picture of the mask stage, not an un-premultiplied one: the
`'luminance'` of a half-transparent gray is its luminance times its alpha, so the transparent black
around the shapes of a mask stage is coverage 0 under every source, and the four channels agree
about where a shape ends.

The mask stage is any stage a director takes as a layer: a `Stage2D`, a `StageRenderer` with stages
and a pipeline of its own, a stage of one's own. Unlike an effect, a `StageMask` is no description:
it holds a stage, and a stage serves one director at a time as a mask. The refusal goes by the
**stage**, not by the `StageMask` object: a module-level registry maps every stage that a director
draws as a mask to that director, and a second director refuses every mask on such a stage with an
error that names the mask stage. A stage that is a layer in one director and a mask in another is
refused as well. For a `StageRenderer` as the mask stage that follows from its one holder already.
A `Stage2D` could be held twice — its pass node is shared by every renderer that composes it —, but
not under two directors: a director wraps a `Stage2D` in a `StageRenderer` and draws it through
`renderTo()`, not through its pass node, so two directors would draw it twice, and both would call
its `updateFrame()`, so the mask would animate twice per frame. Within one director, one mask serves
every slot it lies on (§3.2), and so do two `StageMask` objects on the same stage (§3.3).

`mask.stage`, `mask.source` and `mask.invert` read out what was given. `mask.progress` and
`mask.progressNode` belong to transitions (§4.2).

### 3.2 A slot with a mask

```ts
director.setStack([stars, level]);
director.setMask(level, fog); // the slot of the level shows the level only where the fog stage draws
director.setMask(level, undefined); // the whole level again
```

The mask belongs to the **slot**, not to the layer: `replace(level, nextLevel)` keeps the porthole
and changes the view behind it, and the transition in that slot runs inside the mask. The
composition of §4.1 of the transitions proposal gets one factor per masked slot:

```text
out = clear
for each slot, bottom to top:
  c   = slot.layer ? sample(slot.layer) : effect(from, to, progress)
  c   = slot.mask ? c * coverage(slot.mask) : c      // premultiplied: all four channels
  out = c + out * (1 - c.a)
```

Since every source is premultiplied, a multiplication of all four channels is the exact masking:
coverage 0 removes the slot, 1 keeps it, anything between scales its contribution — soft edges,
anti-aliased silhouettes and half-transparent blobs of the mask stage come through as they are.

- `setMask(stage, mask)` addresses the slot whose end state holds `stage`, and lands at once: the
  next frame draws it. A mask that comes and goes softly is the job of the mask stage itself — it
  is alive, after all.
- `show(stage, {mask})` and `push(stage, {mask})` make the new slot a masked one from its first
  frame.
- `director.maskOf(stage)` answers the mask of the slot that holds `stage`.
- `setMask()` refuses, before anything changes: a `stage` that is not in the stack, a mask whose
  stage is a layer of the stack — a stage is a layer or a mask, never both —, a mask whose stage is
  the director or holds it, a disposed stage, a mask on a stage that another director draws as a
  mask or as a layer (§3.1).
- One mask may lie on several slots: its stage draws once per frame, and every masked slot samples
  the same picture.
- The rule that a stage is a layer or a mask, never both, holds in both directions: `show()`,
  `push()`, `replace()`, `setStack()` and `add()` refuse a stage that is a mask stage of this
  director as a layer, as `setMask()` refuses a layer as a mask. The refusal comes before anything
  changes.
- `setStack()` drops every mask. A mask is a property of a slot, and `setStack()` makes new slots;
  the masks of the stages that stay in the stack are not carried over, and a `setMask()` after the
  call puts them back. `hide()`, `pop()` and `remove()` of a layer take the mask off the slot that
  goes with it.
- `remove(maskStage)` and the dispose of a mask stage take the mask off every slot it lies on, and
  end every transition whose effect names it as cancelled (§9). `remove()` of a stage that is
  neither a layer nor a mask does what it does without masks.
- The mask stages stand in the update and draw order of the director after every layer: first the
  distinct mask stages of the slot masks, bottom-up, then those of the running effects, slot by
  slot, each by its first appearance. They update after the layers, so a mask that draws in the
  world of another stage (§7.2) reads the camera that the world moved in this frame.

### 3.3 Two worlds through one mask

The stack and its premultiplied composition already cross two layers by a mask; no second
mechanism is needed:

```ts
director.setStack([world, rift]);
director.setMask(rift, riftMask);
// where the mask is 0 the world shows, where it is 1 the rift, between them the mix of both
```

With `invert: true` on a second mask of the same stage, the world could be cut out of the bottom
slot instead, for a layer below it to show through — two `StageMask` objects on one stage are one
mask stage, drawn once.

### 3.4 Masks that run and masks that freeze

A mask stage is updated and drawn every frame for as long as a slot or a running transition
references it, and leaves the stages of the director as a layer does when nothing references it any
more (§4.4 of the transitions proposal): the GPU memory of its pass target goes, and a wrapper of a
`Stage2D` is disposed.

`director.freeze(fogStage)` and `director.run(fogStage)` work for mask stages as they work for
layers; `freeze()` of a stage that is neither a layer nor a mask of this director is refused with
the message "no layer or mask of this director", and a freeze does not survive the mask stage
leaving the director, as it does not for a layer. A frozen mask draws once — and once again after a
resize — and is sampled ever after: a mask that never changes costs a texture fetch per pixel and
nothing else. A frozen mask stage is what `lumaMask()` does with a `Texture`, with the difference
that the mask is drawn at the size of the director, by its projection, and stays upright under both
backends (§3.5).

### 3.5 Orientation

The director samples a mask at the uv it samples its layers at, the origin at the top left of the
picture under WebGPU and under WebGL 2: the pass target of a mask stage is a render target as the
pass target of every layer is, and three.js flips both alike. A mask stage that draws into its top
half masks the top half of the slot. This is the trap of the `lumaMask()` hack of §2, and the browser
test of §10.2 holds it.

## 4. Masks in transitions

### 4.1 The effect contract

An effect may name masks next to its two sources:

```ts
interface StageTransitionEffect {
  readonly name: string;
  /** Stage masks the effect samples; the director draws them while a transition with the effect runs. */
  readonly masks?: readonly StageMask[];
  build(input: StageTransitionInput): Node<'vec4'>;
  dispose?(node: Node<'vec4'>): void;
}

interface StageTransitionInput {
  // … from, to, progress, uv, resolution, as built
  /** The picture of one of `effect.masks`; throws for a mask the effect did not name. */
  mask(mask: StageMask): StageMaskSource;
}

interface StageMaskSource extends StageTransitionSource {
  /** The coverage of the mask at `uv` by its `source` and `invert`, 0 to 1; 0 outside [0, 1]. */
  coverage(uv: Node<'vec2'>): Node<'float'>;
}
```

The contract of §6.1 of the transitions proposal stays: `from` at progress 0, `to` at progress 1.
An effect with masks is still told apart by its object, so the shape cache keys it as it keys every
effect; its masks only add texture nodes to the shape (§4.4). It is no description any more, for
the reason a `StageMask` is none: it serves one director at a time. An effect without `masks` stays
what it is.

The mask stages of an effect join the director when a transition with the effect begins, run while
it runs, and leave when it ends — a transition mask costs nothing before and after its transition.

### 4.2 The progress of a mask

A living matte has to move with its transition: at progress 0 it covers nothing, at progress 1
everything, and between them it is the picture of the stage. A stage that animates on the clock of
the display would end early under a slowed transition, late under a fast one, and never under a
`manual: true` one. So the mask carries the progress to its stage:

- `mask.progress` — a number, the eased progress of the transition that uses the mask, written by
  the director in its `updateFrame()` after it has advanced its transitions and before it updates
  the mask stage — the order of §5.2 of the transitions proposal already gives that;
- `mask.progressNode` — a float uniform with the same value, for a mask stage whose materials
  animate on the GPU: a noise threshold in a sprite material, a dissolve of its own inside the
  mask.

A mask drives one transition at a time; a second transition whose effect names a mask that is
busy is refused (`StageDirector#replace(): the mask "ink" drives a transition already`). A mask is
busy only after the runs that the call ends anyway have ended: `replace()` ends the run in its own
slot first, so `replace(a, b, {effect: inkIn})` in the slot whose `inkIn` run is still going is
allowed — the old run ends, and the mask starts again at progress 0. Between transitions `progress`
holds the value of the last one; a new one starts it at 0.

Under `manual: true` the progress may be set after `updateFrame()` and before the draw. The
`progressNode` is written again in `renderToCurrentTarget()`, as the progress uniforms of the shape
are, so the GPU never draws a stale value; `mask.progress` for the CPU side is the value of
`updateFrame()`.

### 4.3 `matte()`

```ts
import {matte, StageMask} from '@spearwolf/twopoint5d';

const ink = new StageMask(inkStage, {source: 'luminance'});
const inkIn = matte({mask: ink}); // made once and reused, as every effect

on(inkStage, OnStageUpdateFrame, () => {
  // the blots grow with the transition, whatever its duration or its easing
  for (const blot of blots) blot.scale = blot.seed * ink.progress * 3;
});

director.replace(title, level, {effect: inkIn, duration: 1.2});
```

| option | default | |
| --- | --- | --- |
| `mask` | — | a `StageMask` |
| `mode` | `'coverage'` | `'coverage'`: the coverage of the mask is the share of `to`; `'threshold'`: the coverage is the switching point of each pixel against the progress, as in `lumaMask()` |
| `softness` | `0.05` | `'threshold'` only: how far a pixel blends |

- **`'coverage'`** is the traveling matte of film: the stage *is* the transition. Its picture holds
  how much of `to` shows. The contract of §6.1 asks for `from` at 0 and `to` at 1, which a living
  stage cannot promise; `matte()` holds both ends itself — the share is 0 at progress 0 and 1 at
  progress 1, whatever the stage drew — and leaves everything between to the stage. A stage that
  does not cover the picture by the end jumps there, and the guide says so.
- **`'threshold'`** is `lumaMask()` with a mask that lives: a gradient that turns, a noise that
  boils, while the progress sweeps through it. The ends hold by the switching function, as in
  `lumaMask()`.

`lumaMask()` keeps its `Texture`; a mask that is a stage goes through `matte()`. Two effects with
two clear contracts beat one with a union type whose two members sample at opposite orientations.

### 4.4 The shape cache with masks

The shape of §7.1 of the transitions proposal lists the slot kinds; a mask adds to it:

- per slot, whether it is masked and by which of the distinct masks of the shape, counted by first
  appearance from the bottom;
- per distinct mask, its `source` and `invert`, which are in the shader, and the index of its
  **stage** among the distinct mask stages of the shape, counted the same way.

A shape has **one texture node per distinct mask stage**, shared by every mask on that stage, every
slot and every effect that samples it. The rule of §7.1 of the transitions proposal that no two
texture nodes of a graph sample one texture holds the other way round here: one stage, one node,
one binding. The index of the stage is what keeps the cache honest: a red and a green mask on one
stage and a red and a green mask on two stages have the same masks and options in the same places,
and only the stage index tells the graph of one texture node from the graph of two — reused for the
other pattern, the first would bind two pictures to one node.

Two different `StageMask` objects with the same options on stages in the same pattern are one
shape: the second swaps a texture and builds nothing — more forgiving than the effects, which go by
object, and possible because a mask has no graph of its own. The masks an effect names count among
the distinct masks of the shape, their stages among its distinct stages.

`precompile()` takes masked slots in its shapes and mask stages in its `layers`:

```ts
await director.precompile(renderer, [
  ['layer', {mask: fog}], // the stars below the level under its fog
  ['layer', {effect: inkIn, mask: fog}], // the ink transition inside the masked slot
], {layers: [level, fogStage, inkStage]});
```

A slot of a shape is `'layer'`, an effect, or `{effect?, mask}` for a masked slot.

### 4.5 What a mask costs

| | full-screen draws | targets of the size of the drawing buffer |
| --- | --- | --- |
| a mask that runs | the draws of its stage | 1 pass target |
| a frozen mask | none | 1 pass target, kept |
| a masked slot | none of its own: one texture fetch and one multiplication in the quad | none of its own |
| a transition through `matte()` | its two sources and the mask stage, for the length of the transition | 1 pass target, for the length of the transition |

Against the nested pipeline of §2, a masked slot saves a pass target with its depth buffer — about
100 MB at 3840 × 2160 — and a full-screen quad per masked layer, and one mask serves several slots.

#### The size of a mask target

A coverage needs no more resolution than its edge asks for, and a soft fog edge is a blur anyway.
The `scale` option of `StageMask` is a number in `(0, 1]`, default `1`: the director draws the mask
stage into a pass target of that share of the size of the drawing buffer, and the mask is sampled
up to the full picture by the texture's own filtering. The director applies it to the pass target of
the renderer it draws the mask stage with, through a seam of the stage module
(`StageRendererTargets#scale`); the seam is internal, and `StageRenderer` has no public option for
it. A mask stage with hard edges shows the coarser grid at `scale` below 1, a fog does not. §12
gives the numbers.

## 5. Without a director

```ts
// sr composes two stages: the scene and the fog stage that masks it
sr.buildOutputNode = ([scene, fog]) => createMaskNode(scene, fog, {source: 'alpha'});
```

`createMaskNode(content, mask, options?)` answers `content` masked by `mask`, premultiplied, for a
`buildOutputNode` of one's own; a source is a `TextureNode` or the `PassNode` of a `Stage2D`, as for
`createTransitionNode()`, and the options are those of §3.1. The mask stage is one of the stages of
the renderer and is drawn as every stage is: no lifecycle, no progress, nothing but the TSL of §3.2.
It is the smallest part of this proposal and the first one to build (§12).

## 6. Stencil

### 6.1 Why the masks are pictures

A stencil buffer is the other classic answer to "draw B only where A is". It does not fit the stage
layer, for reasons in the code as it is:

- **No stencil buffer anywhere.** `Display` builds its `WebGPURenderer` with `stencil: false`. The
  pass targets of `StageRendererTargets` and the `pass()` node of a `Stage2D` are three.js
  `RenderTarget`s with `stencilBuffer: false`, the default. A `ClearStage({stencil: true})` on a
  default display clears a buffer the canvas does not have.
- **Stencil lives inside one target.** It is a state of one depth-stencil attachment across the draws
  into it. Under a composing pipeline — every director, every nested pipeline — each stage draws
  into a target of its own, and no stencil value crosses from one to another. Stencil between two
  stages works only in the layers mode and the whole-picture mode, where all stages draw into one
  target.
- **Stencil is a state of every material.** three.js reads `stencilWrite`, `stencilFunc`,
  `stencilRef` and the stencil operations per material, under WebGPU as under WebGL 2. A stage that
  is masked by stencil needs every one of its materials set — every sprite pool, every mesh, the
  materials of its pipelines —, and a material shared by a masked and an unmasked stage cannot be
  both. There is no scene-wide stencil state in three.js to set instead.
- **Stencil is binary.** A pixel passes or fails; there are no soft edges, no anti-aliased
  silhouettes, no half-transparent blob in a fog of war, and nothing a `'coverage'` matte could be.

| | texture mask (this proposal) | stencil |
| --- | --- | --- |
| edges | soft, anti-aliased, any coverage between 0 and 1 | hard, 1 bit per reference |
| across stages under a composing pipeline | yes | no |
| animated mask, a matte in a transition | yes | as a hard edge only |
| cost of the mask | a target and its draw, or nothing when frozen | a buffer of 8 bits per pixel and the draw into it |
| cost of the masked stage | draws every pixel, also where the mask is 0 | early stencil rejection: the fragments outside the mask never run |
| setup | `setMask()` | the renderer, the target and every material |

### 6.2 What stencil stays good for

Stencil wins in one column: the fill cost of the masked stage. A portal that covers a tenth of the
screen, behind which a whole second world draws, pays the full world under a texture mask. That is
an optimisation, not a mechanism, and it belongs after measurements (§12, phase D):

- **A stencil pre-pass of a mask in the layers mode.** One full-screen quad writes the stencil where
  the coverage of a frozen or running mask is above a threshold, and the masked stage draws with the
  stencil test — the materials of a stage set through a helper that walks its scene, with the
  conflicts of §6.1 named in its guide. Hard edges where the threshold cuts; a soft edge would need
  the texture mask on top of it.
- **A scissor of the mask's bounds.** Cheaper still, and possible under a composing pipeline: a mask
  that knows its rectangle on the screen lets its slot's layer draw inside that rectangle alone.
- **Stencil inside one stage.** A mask stage could use stencil itself to build its shape — portal
  frames, clipped UI panels — in the layers mode of its own renderer, but not with the targets as
  they are. `rendererOptions: {stencil: true}` gives the canvas a stencil buffer, and only the
  canvas: a renderer straight on the display stencils, a layer or a mask under a director does not.
  The director, as every parent that composes, draws a child into the child's pass target — a
  child in the layers mode too —, and `StageRendererTargets` builds that target without
  `stencilBuffer`. A stencil inside a mask stage needs a pass target with one first: an option per
  renderer, `passTargetStencil: true`, which `StageRendererTargets` hands to the `RenderTarget` it
  builds and changes on the target it has. That seam comes with phase D (§12); until then stencil
  inside a stage is a recipe for a renderer that draws to the canvas, orthogonal to this
  proposal.

The guide gains one sentence either way: the `stencil` of a `ClearStage` takes effect only on a
display whose renderer has a stencil buffer, `rendererOptions: {stencil: true}`, only in the modes
that draw into one target, and only in a renderer that draws to the canvas or to an
`outputRenderTarget` with a stencil buffer — not in the pass target a composing parent draws it
into.

## 7. Masks in 3D

### 7.1 In screen space

A mask stage with a projection of its own masks in the space of the screen: a vignette, ink that
spreads from a corner, a fog of war in a top-down 2D game whose mask stage moves its blobs with the
camera of the level by hand. The mask knows nothing of the world; it is a picture over the slot.

### 7.2 In the space of the world

A mask that lies *in* the world — the cone of a flashlight, a fog of war on the `xz` floor of a 3D
level, a portal disc on a wall — has to be drawn through the camera of the stage it masks, wherever
that camera is moved, and through every new camera a projection builds. Today a `Stage2D` without a
projection takes a camera by hand, and the caller follows `OnStageAfterCameraChanged` of the masked
stage. That is the place for a factory:

```ts
// the mask scene drawn through the camera of world, a Stage2D of the level, always the current one
const flashlight = StageMask.inWorldOf(world, flashlightScene, {source: 'alpha'});
director.setMask(level, flashlight);
```

`StageMask.inWorldOf(stage, scene, options?)` builds a mask stage of its own that draws `scene`
through `stage.camera` and takes the size of the director as every mask does. `stage` has to be a
`Stage2D` — the camera of a `StageRenderer` is not one camera.

- **No subscription.** The mask stage reads `stage.camera` at every draw instead of following
  `OnStageAfterCameraChanged`: a new camera of the world is the camera of the next frame, and a
  mask that is never attached holds no listener that would need a cleanup. While `stage` has no
  camera — before its first resize, after its `dispose()` — the mask draws nothing, a coverage of
  0.
- **The mask owns the stage it built.** It is no stage of the caller's that the director could let
  go of, and none of the director's that it could dispose: the director treats it as every mask
  stage of the caller — it wraps it, joins and releases it with its uses, disposes the wrapper and
  releases its pass memory when the last use ends (§3.4), and never disposes the stage itself. The
  mask goes back into a slot or a `matte()` as often as the caller likes.
- **`mask.dispose()`** disposes the stage `inWorldOf()` built; for a mask on a stage of the
  caller's it lets go of the stage and disposes nothing. A disposed mask is refused by
  `setMask()`, `show()`, `push()` and every transition whose effect names it; disposed while a slot
  uses it, it leaves that slot as a disposed mask stage does (§9).
- `scene` stays the caller's.

Under a `ParallaxProjection` the mask has the depth effect of the world: a portal disc at `z = 50`
grows as the camera comes closer, and the second world shows through it at exactly the size of its
frame. Two worlds through a portal are then three lines — the stack `[world, other]`, a mask in the
world of `world` on the slot of `other`, and a camera of `other` that the caller moves with the
portal.

### 7.3 Against the depth of the scene

A mask in the world could also be compared with the depth of the scene: the inside of a flashlight
cone only where its geometry is in front of the walls, an x-ray that shows through a wall only
behind it. That needs the depth of both pictures in the quad — the `PassNode` of a `Stage2D` has
a depth texture, the pass targets of the layers of a director have a depth buffer and no depth
texture. A depth-aware mask is left for later (§12, phase D), with a depth texture on the pass
targets of the layers that ask for one, and `depthTest: 'in-front' | 'behind'` on the mask.

### 7.4 3D transitions through a matte

§15 of the transitions proposal leaves page curls and cube turns to effects of one's own. A matte
in `'coverage'` mode takes a part of that ground without any uv distortion: shards of glass
rendered white on black that fly apart, a 3D logo that turns until it fills the screen, a curtain
of meshes — the silhouette of a real 3D scene, anti-aliased by its own renderer, is the edge
between `from` and `to`. The mask stage may even carry a bloom in its own pipeline; the matte reads
its coverage, not its look.

## 8. A living fog over what is not explored yet

A world map or a dungeon under a fog that covers every part the player has not reached yet, rolls
back where the player walks and keeps moving at its edge. It is the use case that asks of a mask
what none of §3 to §7 asks: a **memory**. What the player has seen stays seen — across every move
of the camera, every resize, every save game.

### 8.1 Where the explored state lives

Not in a target of the screen. A pass target holds the picture of one frame in screen space: the
director clears it every frame, a resize drops it, and a camera that moves would drag the explored
area along with it. A target that accumulates the sight of the player in map space — drawn with
`MaxEquation` blending and never cleared — would remember on the GPU, but it answers nothing to the
game: neither the minimap, nor the AI that asks "has the player seen this room", nor the save game
gets at it without a read-back.

The explored state is game state, and it lives on the CPU, in the cells of the map. The GPU only
shows it:

```ts
import {RevealMap} from '@spearwolf/twopoint5d';

// the grid of the map: cells of 32 × 32 units — a tile, or a quarter of one for softer edges
const reveal = new RevealMap({columns: 256, rows: 256, cellWidth: 32, cellHeight: 32, xOffset: 0, yOffset: 0, fadeIn: 0.8});

// game logic, wherever the player or a unit stands: the cells within the radius are explored
reveal.revealCircle(player.x, player.z, 6 * 32);

// once per frame: the cells that fade in advance, and the texture goes up if anything changed
reveal.update(deltaTime);

reveal.isRevealed(col, row); // for the game: the minimap, the AI, the quest log
const saved = reveal.save(); // a Uint8Array; reveal.restore(saved) after loading
```

- `RevealMap` is a finite grid of `columns × rows` cells on the plane of a `Map2D`, with the
  `cellWidth`, `cellHeight`, `xOffset` and `yOffset` of the grid of `Map2DTileStreamer` — a cell may
  be a tile or a part of one.
- Each cell holds a value from 0, unexplored, to 255, explored. `reveal()`, `revealCircle()` and
  `revealRect()` mark cells as explored; with `fadeIn` above 0 a cell rises to 255 over that many
  seconds, so the fog rolls back instead of popping. The cells in their fade are an index list of
  fixed capacity, and `update()` touches those alone: no allocation per frame, no pass over the
  grid.
- `reveal.texture` is a `DataTexture` of one byte per cell, in linear filtering: between the cells
  the coverage is interpolated, and the grid of the map does not show in the fog.
- The value of a cell is the coverage the fog reads. A time of the reveal per cell — so that the
  shader alone would animate the fade — was weighed and dropped: a half-float time loses whole
  seconds of precision after about an hour of play, and a float texture with linear filtering needs
  the optional `float32-filterable` feature of WebGPU.

### 8.2 The fog is a layer, not a mask

The first answer to the use case needs no mask at all: the fog is a mesh over the map, in the scene
of the world, drawn through the camera of the world. Where it is opaque, the world below is hidden;
the stack of a director does not have to know of it.

```ts
import {fogCoverage} from '@spearwolf/twopoint5d';
import {color, mix, positionWorld, time} from 'three/tsl';

// the coverage of the fog at a point of the map: 1 where nothing is explored, 0 where all is
const coverage = fogCoverage(reveal, {
  position: positionWorld.xz, // the point of the map; positionLocal.xz for a fog plane inside the Map2D node
  edge: 0.5, // where the fog ends between an unexplored and an explored cell
  softness: 0.15,
  noise: {scale: 1 / 96, amount: 0.35, drift: [0.02, 0.01]}, // in world units: the noise does not swim with the camera
});

fogMaterial.colorNode = mix(color('#1b1d2b'), color('#3a3f5c'), cloudNoise);
fogMaterial.opacityNode = coverage;
```

`fogCoverage(reveal, options)` answers a float node: the interpolated value of the cells at
`position`, turned into a coverage by `smoothstep()` around `edge`, and a noise of the world
position moved by `time` laid over the edge before. The noise is what makes the fog live: the
frontier boils and drifts, and a cell that fades in eats into the fog as a cloud, not as a square.
The noise runs in world units, so it stays on the map when the camera moves.

Under a `ParallaxProjection` the fog takes the depth of the 2.5D world for free: two or three fog
planes at different heights above the map, each with a drift of its own, are a fog with volume —
the planes nearer the camera move faster, as `getParallaxFactor()` says. Their cost is their fill:
three transparent planes over the visible part of the map, no target, no pass.

### 8.3 What lies under the fog: a mask

A mask comes in where the unexplored part should not just be covered, but show **another picture**:
the parchment of an undrawn map, the blueprint of a dungeon, a sketch that becomes the world where
the player walks.

```ts
// the coverage of the explored part, drawn in the space of the world: a plane with 1 - fogCoverage(…)
const explored = StageMask.inWorldOf(worldStage, exploredScene, {source: 'alpha'});

director.setStack([parchment, world]);
director.setMask(world, explored); // the world only where it is explored, the parchment elsewhere
```

The mask stage draws the same `fogCoverage()`, inverted, through the camera of the world (§7.2): its
living edge is the edge between parchment and world. The fog of §8.2 and the mask of §8.3 can share
one `RevealMap` and one noise, so the clouds lie exactly over the seam.

### 8.4 Three states: unexplored, remembered, in sight

The fog of war of a strategy game knows three states of a cell: never seen, seen but not in sight
now — the terrain shows, dimmed, without the units —, and in sight. That is a stack of masked
slots over each other:

| slot, bottom to top | mask | it shows |
| --- | --- | --- |
| `parchment` | — | the undrawn map |
| `terrain` | `explored` (§8.3) | the ground wherever it was ever seen |
| `dim` | `remembered` | a translucent dark layer over what was seen and is not in sight |
| `units` | `sight` | enemies and items only where they are seen now |

- `sight` is a living mask in the world: a soft blob sprite around every unit of the player, its
  radius the sight of the unit, in a mask stage of `StageMask.inWorldOf()`. It forgets by design:
  it is the picture of this frame.
- `remembered` is explored and not in sight. A mask stage is a stage and composes its coverage from
  as many inputs as it likes: the plane of `explored`, then the blobs of `sight` drawn over it with
  a blending that takes their alpha away (`ReverseSubtractEquation`).
- The reveal follows the sight in the game logic: every step of a unit calls `revealCircle()` with
  its sight, the `RevealMap` remembers, and its `fadeIn` rolls the fog back behind the blob.

What the remembered part shows of buildings the player saw — the ghost of an enemy base — is a
layer the game fills by its own memory; the library has no opinion on it.

### 8.5 What does not have to be drawn

Under a fog that covers half the map, the tiles below it are drawn for nothing. A tile data provider
that answers the hole `0` for the cells the `RevealMap` has not explored would leave them out — but
`map2d` sees a change within a provider only through `clearTiles()`, which lays out every tile
again, and a walking player reveals cells on every step. A seam for the invalidation of single tiles
in `map2d` would be needed first (§13). Until then the fog covers, and the fill below it is the
price.

### 8.6 Into the next level

The fog is also the matte of the change from one dungeon level to the next: the mask stage of §8.3,
driven by `mask.progress` instead of the `RevealMap`, rolls the fog in over the old level and out
over the new one — `matte({mask: fogRoll})` in `'coverage'` mode (§4.3), with the same noise, so the
transition and the fog of the game are one look.

### 8.7 What it costs

| variant | targets of the size of the drawing buffer | per frame on the CPU |
| --- | --- | --- |
| §8.2, the fog as planes | none | `reveal.update()`: the cells that fade, and the upload of the texture when one changed — 64 KB at 256 × 256 cells |
| §8.3, a parchment below | 1 mask target | as above |
| §8.4, three states | 3 mask targets, or 1 with the masks in three channels of one stage | as above, and the sight blobs |

The texture goes up whole: `Texture#updateRanges` of three.js 0.186 is read by the classic
`WebGLRenderer` alone, and the `WebGPURenderer` uploads a texture whole under both of its backends. At
1024 × 1024 cells that is 1 MB in every frame in which a cell fades — still cheap, but a reason to
keep the cells as coarse as the look allows (§13).

## 9. Ownership and disposal

Following [the resource lifecycle rules](../resource-lifecycle.md):

| what | whose | disposed by |
| --- | --- | --- |
| a `StageMask` and its uniform | the caller | `StageMask#dispose()`, which disposes the stage of `inWorldOf()` and nothing else: a uniform owns no GPU memory, a stage handed in stays the caller's |
| the stage of a mask handed in | the caller | the caller; the director only lets go |
| the wrapper `StageRenderer` of a mask stage that is no renderer | the director | the director, when the mask has no use left, and in `dispose()` |
| the stage of `StageMask.inWorldOf()` | the mask | `StageMask#dispose()`; a director wraps and releases it as any mask stage, and disposes it never; the scene stays the caller's |
| the texture nodes of masks in the graphs | the director | `dispose()` |
| a `RevealMap` and its texture | the caller | `RevealMap#dispose()` |

A mask stage that is disposed while a slot uses it takes the mask off that slot, as a disposed layer
leaves the stack; a transition whose effect names it ends as cancelled.

## 10. Tests

### 10.1 Vitest

- `StageMask`: every option, its defaults and its refusals with their messages; `progress` and
  `progressNode` in step;
- `createMaskNode()` with a `TextureNode`, a `PassNode`, every `source` and `invert`;
- `setMask()`, `maskOf()`, the `mask` option of `show()` and `push()`: the slot keeps its mask
  through `replace()`, every refusal of §3.2 and that nothing changed;
- the lifecycle of §3.4 and §4.1: a mask stage joins and leaves the stages of the director with its
  uses, its pass memory released, a wrapper built and disposed, a frozen mask drawn once and again
  after a resize, a mask stage disposed while in use;
- the shape keys of §4.4: two masks with the same options on stages in the same pattern answer
  the same output node, one mask on two slots builds one texture node, two masks on one stage and
  two masks on two stages with the same options are two shapes;
- `StageMask.inWorldOf()`: the camera read at the draw, a coverage of 0 without one, the mask in a
  slot again after it left one and in a second `matte()` after the first ended, its stage disposed
  by `mask.dispose()` alone, a disposed mask refused;
- a second director refuses a mask stage the first draws as a mask, a `Stage2D` mask stage and a
  second `StageMask` object on the same stage included, and a stage that is a layer in one director
  and a mask in another;
- a stage is a layer or a mask, never both: `show()`, `push()`, `replace()`, `setStack()` and `add()`
  refuse a mask stage of the director as a layer, `setMask()` refuses a layer as a mask, each before
  anything changed;
- `setStack()` drops every mask, including those of stages that stay; `hide()`, `pop()` and
  `remove()` of a layer take the mask off its slot;
- `remove()` of a mask stage and the dispose of a mask stage take the mask off every slot and end
  every transition whose effect names it as cancelled; `remove()` of a stage that is neither layer
  nor mask keeps its behavior;
- the order of the stages in `orderedStages`: the mask stages stand after every layer, the slot masks
  bottom-up, then those of running effects slot by slot, each by its first appearance;
- `freeze()` of a mask stage that has not joined the director is refused with "no layer or mask";
- the progress of §4.2: written before the mask stage's `updateFrame()`, the eased value, under
  `manual: true`, a second transition on a busy mask refused; `replace()` in the slot of a running
  matte reuses its mask and starts it at progress 0; `progressNode` follows a manual progress set
  between `updateFrame()` and the draw;
- `scale` (§4.5): the pass target of a mask stage at the given share of the size of the drawing
  buffer, the values outside `(0, 1]` and non-finite ones refused, a caller's renderer getting its
  own scale back when the mask stage leaves;
- `matte()`: both modes, both ends held whatever the mask draws;
- `precompile()` with masked slots and mask stages;
- `hot-path-allocations.director.spec.ts`: `updateFrame()` with a masked slot and a running matte
  allocates nothing;
- `RevealMap`: the grid and its refusals, `reveal()`, `revealCircle()` and `revealRect()` at the
  borders of the grid, the fade by `fadeIn`, a full fade list, `save()` and `restore()` with a wrong
  length refused, the texture flagged only when a cell changed; `fogCoverage()` with every option;
- `src/map2d/hot-path-allocations.reveal.spec.ts`: `revealCircle()` and `update()` with cells in
  their fade allocate nothing.

### 10.2 Browser, under WebGPU and under WebGL 2

- a masked slot over a slot below: coverage 0, 0.5 and 1 read the expected premultiplied colors;
- the orientation of §3.5: a mask stage that draws its top half masks the top half;
- `invert`, every `source`;
- one mask on two slots;
- a frozen mask keeps masking after its scene changed;
- `matte()` in `'coverage'` mode at progress 0, 0.5 and 1 against a mask stage whose coverage follows
  `mask.progress`;
- a mask at `scale` 0.5 masks the same area as one at `scale` 1, sampled up to the full size;
- `StageMask.inWorldOf()` follows a moved camera and a new projection;
- `precompile()`: the first frame of a masked shape creates no node builder;
- `fogCoverage()` on a plane: an explored cell reads 0, an unexplored one 1, the edge between them
  lies at `edge`, and the noise moves with `time`, not with the camera.

## 11. The lookbook

Every scenario and every goal of phases A to C has a demo of its own in the lookbook, so that no
demo has to carry two ideas. The demos use high-quality game art, with no pixel zoom above 2, and
are themed as horror and strange things rather than classic fantasy. The scenario column cites the
row of the goal table (§1) or of the scenario table (§2) it shows.

| demo | phase | scenario / goal | what it shows | `<demo-ui>` |
| --- | --- | --- | --- | --- |
| `stage-masks-without-director` | A | §2 row 1, §5 | a plain composing `StageRenderer`: a sprite scene and a mask stage of drifting soft blobs, `createMaskNode()` in `buildOutputNode` | `source`, `invert` |
| `stage-masks-spotlight` | A | §1 row 1, §3.1–3.2 | a level under a fog of war: soft blobs around the player and three torches in the alpha of a mask stage over a starfield; `replace(level, nextLevel)` keeps the porthole | `source`, `invert`, next level, mask on/off |
| `stage-masks-rift` | A | §1 row 2, §3.3 | `[world, other]`, a mask on the slot of `other`: a rift into a colder world opens where the player stands; a second `invert: true` mask on the same stage cuts the world out of the bottom slot for a third layer | rift size, inverted second mask |
| `stage-masks-shared` | A | §2 row 3, §3.2 last item | one ink vignette on two slots — a level and a HUD — the mask stage updated and drawn once per frame, shown by a counter | toggle the mask per slot |
| `stage-masks-frozen` | A | §1 row 3, §3.4 | a keyhole of stained glass drawn once: the mask scene changes behind a frozen mask and nothing moves, a resize redraws it; draw counter | run / freeze, scramble the mask scene |
| `stage-masks-matte-ink` | B | §1 row 4, §4.3 `'coverage'` | ink blots that grow by `ink.progress` turn a title into a level; a slider with `manual: true` holds any frame | duration, easing, scrub |
| `stage-masks-matte-threshold` | B | §1 row 4, §4.3 `'threshold'` | a boiling noise and a turning gradient in a mask stage, swept by the progress | `softness`, mask kind, scrub |
| `stage-masks-matte-3d` | B | §1 row 4, §7.4 | the silhouette of a real 3D scene as the matte: shards of glass that fly apart, a logo that turns until it fills the screen, the mask stage with a bloom in its own pipeline | mask scene, scrub |
| `stage-masks-heat-haze` | B | §1 row 5, §4.1 | an effect of the demo's own that reads a living mask through `input.mask(m)` and displaces `from` and `to` by it | strength, scrub |
| `stage-masks-flashlight` | C | §1 row 7, §7.2 | a level under a `ParallaxProjection`, the cone of a flashlight in the world of the level by `StageMask.inWorldOf()`; the camera follows the player, the projection can be swapped | projection, cone angle |
| `stage-masks-portal` | C | §7.2 last paragraph | a portal disc at `z = 50` on a wall of `world`, a second world behind it that grows as the camera comes closer | portal depth, camera distance |
| `stage-masks-resolution` | C | §12 phase C, §4.5 | one fog mask at `scale` 1, 0.5 and 0.25 side by side, with the bytes of each mask target | scale, soft/hard edges |

`stage-transitions-gallery` additionally gains the two mattes of §4.3, ink blots in `'coverage'`
mode and a boiling noise in `'threshold'` mode, as two more entries; the game-menu demo stays as it
is.

The demo of phase E, `fog-of-war-dungeon`, is a `Map2D` dungeon top-down under a
`ParallaxProjection`, the tiles of the existing map demos: the player walks, the fog rolls back in
clouds and keeps boiling at its edge. Its `<demo-ui>` switches the three variants of §8.2 to §8.4 —
fog planes, a parchment below, the three states with a sight mask — and the size of the cells.

## 12. Phases

| phase | content |
| --- | --- |
| A | `createMaskNode()`; `StageMask` with `source`, `invert`; `setMask()`, `maskOf()`, the `mask` option, run and freeze of masks, the masks in the shape cache and in `precompile()`; the tests of §10 for these; the guide section; the demos of §11 for phase A |
| B | `masks` and `input.mask()` in the effect contract, `mask.progress` and `progressNode`, `matte()` in both modes; the demos of §11 for phase B and the gallery |
| C | `StageMask.inWorldOf()` (§7.2); the demos of §11 for phase C; a mask target at a share of the resolution — a `scale` of `0.5` takes the RGBA half-float target of a mask at 3840 × 2160 from 66 MB to 17 MB — through a seam in `StageRendererTargets` for the size of a pass target, offered as the `scale` option of `StageMask` (§4.5) |
| D — idea, not scheduled | depth-aware masks (§7.3); the stencil pre-pass and the scissor of §6.2, each after a measurement of the fill cost it would save; `passTargetStencil` for a stencil inside a layer or a mask stage (§6.2) |
| E | `RevealMap` and `fogCoverage()` (§8.1, §8.2) with their tests, a section in [`docs/map2d.md`](../map2d.md) and the demo `fog-of-war-dungeon` with the fog planes; independent of A to C and the first to build for a fog. The variants of §8.3 and §8.4 follow A and C |

## 13. Open questions

- **A slot or a layer.** §3.2 hangs the mask on the slot, so that a `replace()` keeps the porthole.
  A mask that goes with its layer — the fog of one level, not of the next — is then a `setMask()`
  after the `replace()`. Is the slot the more common case?
- **A soft change of the mask itself.** `setMask()` lands at once, and a living mask fades on its
  own. Is a `setMask(stage, mask, {duration})` that crosses the coverage of the old and the new mask
  worth a uniform per masked slot?
- **A mask in its own format.** A coverage needs one channel, the pass target has four in half
  float. An `R8` target would be an eighth of the memory, but three.js keys its builds by the format
  of the target, and a mask stage that draws sprites needs its materials built for that format too.
  Measured in phase C, decided there; the `scale` option of §4.5 is independent of this question.
- **Single tiles in `map2d`.** §8.5 would leave out the tiles under the fog, if `map2d` could
  build single tiles again instead of all of them through `clearTiles()`. Is that seam worth it for
  the fill it saves, or does the fog stay on top of everything?
- **Endless maps.** A `RevealMap` is a finite grid; a `Map2D` is endless. A map that has no edge
  would need reveal maps in chunks, streamed with the tiles. Left out until a game asks for it.
- **Part uploads.** The texture of a `RevealMap` goes up whole (§8.7). Is a texture of chunks —
  several small `DataTexture`s, only the changed ones uploaded — worth its extra samples, or is
  a coarser grid the answer?

## 14. Docs and CHANGELOG

- [`docs/stages.md`](../stages.md) gets a section "Stage masks" after "Stage transitions": the mask,
  a masked slot, two worlds through one mask, run and freeze, `matte()`, `createMaskNode()`, masks in
  the world; its cheat sheet the class, the effect and the defaults, its "Who disposes what" the rows
  of §9, and the sentence on the `stencil` of a `ClearStage` (§6.2).
- `packages/twopoint5d/CHANGELOG.md` gets an entry under `## [Unreleased]`, "Added", per phase.
- [`docs/map2d.md`](../map2d.md) gets a section "A fog over what is not explored": `RevealMap`,
  `fogCoverage()`, fog planes under a parallax projection, and a link to the masks of `stages.md` for
  the parchment and the three states.
- `src/stage/public-api.ts` exports `StageMask`, `matte()`, `createMaskNode()` and their types;
  `src/map2d/public-api.ts` exports `RevealMap`, `fogCoverage()` and their types.

## 15. Left out

- **Stencil as the mechanism of masks.** §6: binary, inside one target, a state of every material.
  It comes back as an optimisation of the fill cost, not as an API.
- **Masks in the plain and the whole-picture mode.** A mask needs its picture as a texture next to
  the picture it masks; the director composes, always. `createMaskNode()` covers every composing
  renderer.
- **Clipping planes.** three.js clips by planes per material; a flat, straight cut through the
  world is that, not a mask.
- **A `MaskedStage` class.** A director with one slot and a mask is one; a class beside it would be
  a second way to the same composition.
