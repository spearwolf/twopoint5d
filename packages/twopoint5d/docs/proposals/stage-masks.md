# Proposal: stage masks — a stage that masks another one, and transitions through a living matte

Status: **proposed**

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

## 2. What the stage layer gives today, and where it ends

The question this proposal answers was asked against [`docs/stages.md`](../stages.md) and
[`stage-transitions.md`](stage-transitions.md): how well does the API as it is express a stage that
masks another stage?

| scenario | today | verdict |
| --- | --- | --- |
| a mask in a plain composing `StageRenderer` | both stages in one renderer, a `buildOutputNode` of one's own: `([scene, mask]) => scene.mul(mask.a)` | works; the caller writes the TSL and has to know that the passes are premultiplied |
| a masked layer in a `StageDirector` | the layer is a `StageRenderer` of its own with a `RenderPipeline` and the `buildOutputNode` above; the director composes its output | works, and costs a pass target and a full-screen quad per masked layer on top of the targets of its two stages — at 3840 × 2160 an RGBA half-float target alone is 66 MB, its depth buffer 33 MB more |
| one mask over two layers | — | does not work: a mask that is a stage of one nested renderer cannot be one of another, a renderer has one holder |
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

The mask stage is any stage a director takes as a layer: a `Stage2D`, a `StageRenderer` with stages
and a pipeline of its own, a stage of one's own. Unlike an effect, a `StageMask` is no description:
it holds a stage, and a stage has one holder. A mask serves one director at a time; a second
director refuses it with an error that names the mask stage.

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
  the director or holds it, a disposed stage, a mask held by another director.
- One mask may lie on several slots: its stage draws once per frame, and every masked slot samples
  the same picture.

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
layers. A frozen mask draws once — and once again after a resize — and is sampled ever after: a
mask that never changes costs a texture fetch per pixel and nothing else. A frozen mask stage is
what `lumaMask()` does with a `Texture`, with the difference that the mask is drawn at the size of
the director, by its projection, and stays upright under both backends (§3.5).

### 3.5 Orientation

The director samples a mask at the uv it samples its layers at, the origin at the top left of the
picture under WebGPU and under WebGL 2: the pass target of a mask stage is a render target as the
pass target of every layer is, and three.js flips both alike. A mask stage that draws into its top
half masks the top half of the slot. This is the trap of the `lumaMask()` hack of §2, and the browser
test of §9.2 holds it.

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
busy is refused (`StageDirector#replace(): the mask "ink" drives a transition already`). Between
transitions `progress` holds the value of the last one; a new one starts it at 0.

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
- per distinct mask, its `source` and `invert`, which are in the shader.

Two different `StageMask` objects with the same options in the same places are one shape: the
second swaps a texture and builds nothing — more forgiving than the effects, which go by object,
and possible because a mask has no graph of its own. The masks an effect names count among the
distinct masks of the shape.

A shape has **one texture node per distinct mask stage**, shared by every slot and every effect
that samples it. The rule of §7.1 that no two texture nodes of a graph sample one texture holds the
other way round here: one mask, one node, one binding.

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

## 5. Without a director

```ts
// sr composes two stages: the scene and the fog stage that masks it
sr.buildOutputNode = ([scene, fog]) => createMaskNode(scene, fog, {source: 'alpha'});
```

`createMaskNode(content, mask, options?)` answers `content` masked by `mask`, premultiplied, for a
`buildOutputNode` of one's own; a source is a `TextureNode` or the `PassNode` of a `Stage2D`, as for
`createTransitionNode()`, and the options are those of §3.1. The mask stage is one of the stages of
the renderer and is drawn as every stage is: no lifecycle, no progress, nothing but the TSL of §3.2.
It is the smallest part of this proposal and the first one to build (§11).

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
an optimisation, not a mechanism, and it belongs after measurements (§11, phase D):

- **A stencil pre-pass of a mask in the layers mode.** One full-screen quad writes the stencil where
  the coverage of a frozen or running mask is above a threshold, and the masked stage draws with the
  stencil test — the materials of a stage set through a helper that walks its scene, with the
  conflicts of §6.1 named in its guide. Hard edges where the threshold cuts; a soft edge would need
  the texture mask on top of it.
- **A scissor of the mask's bounds.** Cheaper still, and possible under a composing pipeline: a mask
  that knows its rectangle on the screen lets its slot's layer draw inside that rectangle alone.
- **Stencil inside one stage.** A mask stage may use stencil itself to build its shape — portal
  frames, clipped UI panels —, on a renderer with `rendererOptions: {stencil: true}` and in the
  layers mode of its own renderer. That is a recipe of the guide, orthogonal to this proposal.

The guide gains one sentence either way: the `stencil` of a `ClearStage` takes effect only on a
display whose renderer has a stencil buffer, `rendererOptions: {stencil: true}`, and only in the
modes that draw into one target.

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
through `stage.camera`, takes the size of the director as every mask does, and follows a new camera
of `stage` through `OnStageAfterCameraChanged`. The stage built is the director's and goes with the
mask's last use; `scene` stays the caller's. `stage` has to be a `Stage2D` — the camera of a
`StageRenderer` is not one camera.

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
texture. A depth-aware mask is left for later (§11, phase D), with a depth texture on the pass
targets of the layers that ask for one, and `depthTest: 'in-front' | 'behind'` on the mask.

### 7.4 3D transitions through a matte

§15 of the transitions proposal leaves page curls and cube turns to effects of one's own. A matte
in `'coverage'` mode takes a part of that ground without any uv distortion: shards of glass
rendered white on black that fly apart, a 3D logo that turns until it fills the screen, a curtain
of meshes — the silhouette of a real 3D scene, anti-aliased by its own renderer, is the edge
between `from` and `to`. The mask stage may even carry a bloom in its own pipeline; the matte reads
its coverage, not its look.

## 8. Ownership and disposal

Following [the resource lifecycle rules](../resource-lifecycle.md):

| what | whose | disposed by |
| --- | --- | --- |
| a `StageMask` and its uniform | the caller | nothing to dispose: a uniform owns no GPU memory |
| the stage of a mask handed in | the caller | the caller; the director only lets go |
| the wrapper `StageRenderer` of a mask stage that is no renderer | the director | the director, when the mask has no use left, and in `dispose()` |
| the stage of `StageMask.inWorldOf()` | the director that uses the mask | as a wrapper; the scene stays the caller's |
| the texture nodes of masks in the graphs | the director | `dispose()` |

A mask stage that is disposed while a slot uses it takes the mask off that slot, as a disposed layer
leaves the stack; a transition whose effect names it ends as cancelled.

## 9. Tests

### 9.1 Vitest

- `StageMask`: every option, its defaults and its refusals with their messages; `progress` and
  `progressNode` in step;
- `createMaskNode()` with a `TextureNode`, a `PassNode`, every `source` and `invert`;
- `setMask()`, `maskOf()`, the `mask` option of `show()` and `push()`: the slot keeps its mask
  through `replace()`, every refusal of §3.2 and that nothing changed;
- the lifecycle of §3.4 and §4.1: a mask stage joins and leaves the stages of the director with its
  uses, its pass memory released, a wrapper built and disposed, a frozen mask drawn once and again
  after a resize, a mask stage disposed while in use;
- the shape keys of §4.4: two masks with the same options in the same places answer the same output
  node, one mask on two slots builds one texture node;
- the progress of §4.2: written before the mask stage's `updateFrame()`, the eased value, under
  `manual: true`, a second transition on a busy mask refused;
- `matte()`: both modes, both ends held whatever the mask draws;
- `precompile()` with masked slots and mask stages;
- `hot-path-allocations.director.spec.ts`: `updateFrame()` with a masked slot and a running matte
  allocates nothing.

### 9.2 Browser, under WebGPU and under WebGL 2

- a masked slot over a slot below: coverage 0, 0.5 and 1 read the expected premultiplied colors;
- the orientation of §3.5: a mask stage that draws its top half masks the top half;
- `invert`, every `source`;
- one mask on two slots;
- a frozen mask keeps masking after its scene changed;
- `matte()` in `'coverage'` mode at progress 0, 0.5 and 1 against a mask stage whose coverage follows
  `mask.progress`;
- `StageMask.inWorldOf()` follows a moved camera and a new projection;
- `precompile()`: the first frame of a masked shape creates no node builder.

## 10. The lookbook

- **`stage-masks`** — a level under a fog of war: soft blobs around the player and the torches drawn
  into the alpha of a mask stage, and a rift into a second, colder world that opens where the
  player stands. The `<demo-ui>` switches `source`, `invert` and freezes the fog.
- **`stage-transitions-gallery`** gains `matte()` with two mask stages: ink blots in `'coverage'`
  mode and a boiling noise in `'threshold'` mode.
- **`stage-transitions-game-menu`** may take the ink matte as one more effect of its select.

## 11. Phases

| phase | content |
| --- | --- |
| A | `createMaskNode()`; `StageMask` with `source`, `invert`; `setMask()`, `maskOf()`, the `mask` option, run and freeze of masks, the masks in the shape cache and in `precompile()`; the tests of §9 for these; the guide section; the demo `stage-masks` |
| B | `masks` and `input.mask()` in the effect contract, `mask.progress` and `progressNode`, `matte()` in both modes; the gallery |
| C | `StageMask.inWorldOf()` (§7.2); a mask target at a share of the resolution — a `scale` of `0.5` takes the RGBA half-float target of a mask at 3840 × 2160 from 66 MB to 17 MB — through a seam in `StageRendererTargets` for the size of a pass target |
| D — idea, not scheduled | depth-aware masks (§7.3); the stencil pre-pass and the scissor of §6.2, each after a measurement of the fill cost it would save |

## 12. Open questions

- **A slot or a layer.** §3.2 hangs the mask on the slot, so that a `replace()` keeps the porthole.
  A mask that goes with its layer — the fog of one level, not of the next — is then a `setMask()`
  after the `replace()`. Is the slot the more common case?
- **A soft change of the mask itself.** `setMask()` lands at once, and a living mask fades on its
  own. Is a `setMask(stage, mask, {duration})` that crosses the coverage of the old and the new mask
  worth a uniform per masked slot?
- **A mask in its own format.** A coverage needs one channel, the pass target has four in half
  float. An `R8` target would be an eighth of the memory, but three.js keys its builds by the format
  of the target, and a mask stage that draws sprites needs its materials built for that format too.
  Measured in phase C, decided there.

## 13. Docs and CHANGELOG

- [`docs/stages.md`](../stages.md) gets a section "Stage masks" after "Stage transitions": the mask,
  a masked slot, two worlds through one mask, run and freeze, `matte()`, `createMaskNode()`, masks in
  the world; its cheat sheet the class, the effect and the defaults, its "Who disposes what" the rows
  of §8, and the sentence on the `stencil` of a `ClearStage` (§6.2).
- `packages/twopoint5d/CHANGELOG.md` gets an entry under `## [Unreleased]`, "Added", per phase.
- `src/stage/public-api.ts` exports `StageMask`, `matte()`, `createMaskNode()` and their types.

## 14. Left out

- **Stencil as the mechanism of masks.** §6: binary, inside one target, a state of every material.
  It comes back as an optimisation of the fill cost, not as an API.
- **Masks in the plain and the whole-picture mode.** A mask needs its picture as a texture next to
  the picture it masks; the director composes, always. `createMaskNode()` covers every composing
  renderer.
- **Clipping planes.** three.js clips by planes per material; a flat, straight cut through the
  world is that, not a mask.
- **A `MaskedStage` class.** A director with one slot and a mask is one; a class beside it would be
  a second way to the same composition.
