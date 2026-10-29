# Proposal: stage transitions — `StageDirector` and transition effects

Status: **phase A and B implemented** — see [`docs/stages.md`](../stages.md), "Stage transitions",
and its cheat sheet; the Vitest specs `src/stage/StageDirector.spec.ts`,
`src/stage/transitionEffects.spec.ts` and `src/stage/hot-path-allocations.director.spec.ts`, the
browser test `packages/twopoint5d-testing/test/stage-transitions.test.js`, and the lookbook demos
`stage-transitions-game-menu` and `stage-transitions-gallery` (§11). Open: phase C — `precompile()`
and the questions of §12. Deviations of the build from the first draft of this spec, which the
sections below now state as built:

- a change without an `effect`, a `duration` above 0 or `manual` lands in the call itself, not in
  the next frame, and emits both events there; `duration` defaults to 0 without an effect (§3.2,
  §5.1, §5.2);
- `pipeline` is the director's own as well: it builds one `RootRenderPipeline` per shape of its
  stack, and a write to `pipeline`, `buildOutputNode` or `renderOrder` throws (§3.1, §7.1);
- the uv of an effect has its origin at the top left of the picture under both backends; the
  directions of `wipe()` and `slide()` and the angle of `wipe()` are screen directions on it, and
  `lumaMask()` samples its mask as a mesh samples a texture, its top on top (§6.1, §6.2);
- `has(stage)` and `isFrozen(stage)` on the director, `isOver` on the transition (§3.2, §5.1);
- `add()` shows a stage on top at once, `remove()` takes it out at once, wherever it is (§3.1);
- the named easings are worked out in place, not through a call, so that their frame allocates
  nothing (§5.2);
- `push()` with `below: 'freeze'` finishes a transition that runs in the slot below first (§4.3);
- an effect's `dispose(node)` runs in the director's `dispose()`, where its graphs go (§6.1, §8).

A game is rarely one stage. It opens on a title menu, cuts to a loading screen, plays a level,
lays a pause menu over the frozen level and goes back to the title. Today a `StageRenderer` can
draw several stages on top of each other and compose them through a TSL graph, but every change of
what is on screen is a hard cut, and a fade written by hand means a `buildOutputNode` of one's own,
a uniform, a tween and the knowledge which pass is which — for every game again.

This proposal adds a **`StageDirector`**: a `StageRenderer` that holds a stack of layers and
changes it through transitions — `show`, `hide`, `replace`, `push`, `pop` — each with an effect,
a duration and an easing. A layer is any stage, a `Stage2D` or a `StageRenderer` with stages and a
post-processing pipeline of its own. Several layers are on screen at once, and several of them can
be in a transition at once. The effects are TSL functions behind one small interface, so a game
writes its own as easily as it uses the built-in ones.

## 1. Goal

| who | what they get | § |
| --- | --- | --- |
| a game that goes from its menu into a level | `director.replace(menu, level, {effect: crossfade(), duration: 0.8})`, a handle with a `finished` promise | 3, 5 |
| a pause menu over the running or frozen game | `director.push(pause, {effect: fade(), below: 'freeze'})`, `director.pop()` | 3.3, 4.3 |
| a background that stays while the scene in front of it changes | a stack of layers: the transition runs in one slot, the slots below and above stay | 4.1 |
| a scene with its own bloom, CRT or palette effect | a layer is a `StageRenderer` with a pipeline of its own; the director composes its output | 4.2 |
| a loading screen that fades as the assets come in | a transition with `manual: true` whose `progress` the game sets | 5.3 |
| a look the library does not ship | an effect of its own: one function from two sources and a progress to a color, in TSL | 6 |
| a renderer composed by hand | the effects work in any `buildOutputNode` too, without a director | 6.4 |

## 2. What the stage layer already gives

The design adds a director on top of what is there, and changes nothing a user sees today:

- **The composed mode.** A `StageRenderer` with a `pipeline` and a `buildOutputNode` (or a
  `RootRenderPipeline`) hands the pass node of every stage to a callback and runs the TSL graph it
  returns as `pipeline.outputNode`. The pipeline makes the one draw to the canvas.
- **Nested renderers as textures.** A child `StageRenderer` of a composing parent is drawn into a
  pass target of its own, cleared to transparent black every frame, and its pass node is a
  `texture()` node of that target. A child with a pipeline of its own runs it into that target,
  with linear output; tone mapping and the output encoding apply once, at the top.
- **Stages that are resized but not drawn.** A stage that the order of a renderer does not place
  is still resized, but neither updated nor drawn (`StageRenderer#orderedStages`).
- **Released pass memory.** A child that leaves a composing renderer releases the GPU memory of its
  pass target; joining again allocates it on the next frame.

The director is a composing `StageRenderer` whose order is its stack, whose composition is the
stack laid over itself with the transitions in between, and whose time is its `updateFrame()`.

## 3. API

### 3.1 The director

```ts
import {crossfade, Display, fade, StageDirector, wipe} from '@spearwolf/twopoint5d';
import {Color} from 'three/webgpu';

const display = new Display(canvas);

const director = new StageDirector(display).setClearColor(new Color('#000'));

director.show(stars);        // the stack: [stars]
director.show(titleMenu);    // the stack: [stars, titleMenu]

startButton.onclick = async () => {
  const t = director.replace(titleMenu, level, {effect: wipe({direction: 'left'}), duration: 0.6});
  await t.finished;          // the stack: [stars, level]
};

display.start();
```

`new StageDirector(parent?)` takes a host or a parent `StageRenderer` like every `StageRenderer`.
It builds a `RootRenderPipeline` per shape of its stack (§7.1) — the director composes, always —
and disposes them in its `dispose()`. `pipeline`, `buildOutputNode` and `renderOrder` belong to the
director, and a write to any of them throws (`StageDirector#pipeline is the director's own: …`).

A layer is a stage of the director while it is in the stack or in a transition, and only then
(§4.4); the director calls `add()` and `remove()` of its base itself. Called by the caller, `add()`
shows a stage on top at once — `new StageRenderer(director)` and `child.parent = director` with
it —, and `remove()` takes a stage out at once, wherever it is: a transition that has it as a
source ends as cancelled, with the other source in its slot. A `ClearStage` is refused, as under
every composing pipeline.

### 3.2 Changing the stack

Every method takes the stage the caller holds — a `Stage2D` or a `StageRenderer` — and an
optional transition (§5). Without an `effect`, a `duration` above 0 or `manual` the change is
instant: the stack changes in the call, both events go out there, and the next frame draws it.

| method | the stack before → after | what transitions |
| --- | --- | --- |
| `show(stage, opts?)` | `[a]` → `[a, stage]`, or at `opts.at` | `stage` from nothing in its new slot |
| `hide(stage, opts?)` | `[a, stage]` → `[a]` | `stage` into nothing |
| `replace(from, to, opts?)` | `[a, from]` → `[a, to]` | `from` into `to`, in the slot of `from` |
| `push(stage, opts?)` | `[a]` → `[a, stage]` | as `show()`; `opts.below` decides what `a` does underneath (§4.3) |
| `pop(opts?)` | `[a, b]` → `[a]` | the top layer into nothing; `a` runs again |
| `setStack(stages)` | anything → `stages` | nothing; an instant cut, for the start of a game and for tests |

Each of them except `setStack()` answers a `StageTransition` (§5.1), the instant ones included,
so a caller awaits `finished` the same way either way. `director.stack` is the stack as it will be
when every running transition has ended, a read-only array of the stages the caller handed in;
`director.transitions` the transitions that run, `director.has(stage)` whether a stage is in the
stack and `director.isFrozen(stage)` whether its layer is frozen.

A method refuses, with an error that names the call and the stage and before anything changes:

- a disposed stage, and a stage that is this director or holds it;
- `show()` and `push()` of a stage that is in the stack already;
- `hide()`, `replace()` with a `from` that is not in the stack, and `pop()` of an empty stack;
- `replace()` with a `to` that is in the stack already;
- options it cannot take: a negative `duration` or `delay`, an easing it does not know, an `at`
  outside the stack;
- a `StageDirector` that has been disposed answers every method with a transition in the state
  `cancelled`, as a disposed `StageRenderer` makes `add()` do nothing.

### 3.3 One frame of a menu, a level and a pause menu

```ts
director.setStack([stars, titleMenu]);

// the player starts the game: the menu dissolves into the level, the stars stay
director.replace(titleMenu, level, {effect: dissolve(), duration: 0.8, easing: 'ease-in-out'});

// Escape: the pause menu fades in over the frozen level
director.push(pauseMenu, {effect: fade(), duration: 0.2, below: 'freeze'});

// Escape again: back to the level, which runs again
director.pop({effect: fade(), duration: 0.2});

// "quit to title": the level and the pause menu go, the menu comes back through black
director.hide(pauseMenu);
director.replace(level, titleMenu, {effect: dipToColor({color: new Color('#000')}), duration: 1});
```

## 4. Layers

### 4.1 The stack and its slots

The stack is a list of **slots**, bottom to top. A slot shows one layer, or a transition between
two sources — a layer and a layer, a layer and nothing, nothing and a layer. The director composes
the slots bottom to top with premultiplied alpha:

```text
out = clear
for each slot, bottom to top:
  c   = slot.layer ? sample(slot.layer) : effect(from, to, progress)
  out = c + out * (1 - c.a)
```

`clear` is the clear color and alpha of the director, a uniform at the bottom of the graph: the
quad of the pipeline covers the canvas, so the own clear of a composing renderer would be drawn
over anyway. A layer that clears itself to an opaque color hides everything below it; a layer
that clears nothing lets the slots below show through wherever it draws nothing.

"Nothing" is a 1×1 transparent black texture the director owns. Since every effect blends two
sources, the same effect fades a layer in, fades it out and crosses two layers, without a second
implementation.

### 4.2 A layer is a `StageRenderer`

The director composes layers as `texture()` nodes of their pass targets, never as the `pass()`
node of a `Stage2D`: the pass target of a child renderer is cleared to transparent black every
frame, so every layer is premultiplied over transparent black, whatever the clear color of the
renderer is.

- A **`StageRenderer`** handed in is the layer itself. Its stages, its clear, its order and its
  pipeline apply as they do under every composing parent: a layer with a bloom is a renderer with
  `pipeline` and `buildOutputNode`, as in [`docs/stages.md`](../stages.md), "Nested pipelines".
  It may be a `StageDirector` itself: a scene with transitions of its own inside a scene.
- A **`Stage2D`** — or any stage with `asPassNode()` that is no `StageRenderer` — is wrapped in a
  `StageRenderer` the director builds, named after the stage. The wrapper is the director's: it
  disposes it when the stage leaves for good (§4.4) and in its own `dispose()`, the stage itself
  never.

Several stages at once are thereby two things: several layers in the stack, and a layer that is a
renderer of several stages — a level with its world and its HUD, composed by the level's own
renderer before the director lays it into the stack.

### 4.3 What a layer does while it is not in front

Every layer that is in a slot is updated and drawn every frame, unless the director freezes it.
A frozen layer is neither updated nor drawn: its pass target keeps the last picture, and the
composition samples that picture. Freezing is free — no draw, no copy — and a layer frozen for a
pause menu continues on the very frame it was frozen at.

| where | option | `'run'` | `'freeze'` |
| --- | --- | --- | --- |
| below a `push()` | `below` | default: the level keeps playing under the menu | the level stops; `pop()` lets it run again |
| `from` of a `replace()` or `hide()` | `outgoing` | default: the menu keeps animating while it goes | the last picture goes |
| `to` of a `replace()` or `show()` | `incoming` | default | the first picture comes, updated from the end of the transition on |

`director.freeze(stage)` and `director.run(stage)` set it by hand, for a slot that no transition
touches. A frozen layer whose size changes is drawn once at the new size, without an
`updateFrame()`: a resized target has lost its picture. A layer handed to two directors is refused
by the second one's `add()` already: a renderer has one holder.

### 4.4 Layers that leave

A layer that leaves the stack — the `from` of a finished `replace()`, the target of a finished
`hide()` or `pop()` — is removed from the director's stages: the existing `remove()` releases the
GPU memory of its pass target and lets go of it as its parent. A layer that comes back is added
again and gets the size of the director first. A stage the caller handed in stays the caller's; a
wrapper of §4.2 is disposed when its stage leaves the stack and is built again when it comes back.

## 5. Transitions

### 5.1 The options and the handle

```ts
interface StageTransitionOptions {
  effect?: StageTransitionEffect; // default: crossfade()
  duration?: number;              // seconds, default 0.5; 0 is an instant change
  easing?: StageTransitionEasing; // 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | (t: number) => number; default 'ease-in-out'
  delay?: number;                 // seconds before the transition starts, default 0
  manual?: boolean;               // §5.3, default false
  outgoing?: 'run' | 'freeze';    // §4.3
  incoming?: 'run' | 'freeze';
  below?: 'run' | 'freeze';       // push() only
  at?: number;                    // show() and push(): the slot, default the top
}

interface StageTransition {
  readonly from: IStage | undefined;   // undefined for "nothing"
  readonly to: IStage | undefined;
  readonly effect: StageTransitionEffect;
  readonly duration: number;
  readonly elapsed: number;
  progress: number;                    // eased, 0…1; writable while manual
  readonly state: 'pending' | 'running' | 'finished' | 'cancelled';
  readonly finished: Promise<StageTransition>;

  reverse(): this;                     // runs back from where it is; at 0 it ends as cancelled
  cancel(jumpTo?: 'start' | 'end'): void; // default 'start'
  complete(): void;                    // manual: ends at progress 1
}
```

`finished` resolves for a cancelled transition too, with `state === 'cancelled'`: a pause menu
the player closes before it was in is no error, and a promise that rejects there would leave an
unhandled rejection in every game that does not await it. The stack is in its end state when the
promise resolves.

Numbers go through `assertFinite()` and `assertPositiveFinite()` of `src/utils/`; a negative
duration or delay is refused with their `RangeError`.

### 5.2 Time

A transition runs on the director's `updateFrame()`: `elapsed` grows by `deltaTime`, and with it
by the time base of the `Display` — a paused display pauses every transition, a slowed one slows
them. The director advances its transitions before it updates its layers, so a layer sees the
stack of this frame.

- The call that starts a transition changes nothing in the frame it is made in: the next
  `updateFrame()` is the first one of the transition, at `elapsed` 0 and `progress` 0. A transition
  started in a click handler has drawn its first picture in the frame after the click.
- The `updateFrame()` in which `elapsed` reaches `duration` ends it: the slot shows `to` alone —
  for every effect that keeps the contract of §6.1 the same picture as `progress` 1 —,
  `OnStageTransitionEnd` goes out, and `finished` resolves.
- A change without a transition (§3.2) never reaches `updateFrame()`: it has ended in the call.
- A transition that takes a stage out of the stack is finished the same way when `show()`,
  `push()` or `replace()` brings that stage back.
- A second transition on a slot that is in a transition finishes the running one first — its end
  state lands, its events go out — and starts from there. `reverse()` is the way to go back from
  the middle of one.

`easing` turns `elapsed / duration` into `progress` on the CPU; the graph only reads a float
uniform per slot. The named easings are cubic and worked out in place, as products: a double
handed to a call that V8 does not inline is boxed, and so is one that `**` hands to the runtime.
Nothing in the advance of a transition with a named easing allocates: `pnpm test:allocations`
holds `StageDirector#updateFrame()` during a running transition to zero bytes (§10.1). A function
of the caller is called once per frame.

### 5.3 Manual progress

With `manual: true` the director does not advance the transition. The caller writes `progress`
— from a loading counter, a scroll position, a drag — and calls `complete()` or `cancel()` to end
it. `duration` and `easing` are ignored; `progress` is taken as written, clamped to `[0, 1]`.

```ts
const t = director.replace(loadingScreen, level, {effect: lumaMask({mask: swirl}), manual: true});
loader.onProgress = (fraction) => (t.progress = fraction);
loader.onDone = () => t.complete();
```

### 5.4 Events

| event | when | props |
| --- | --- | --- |
| `OnStageTransitionStart` | the first `updateFrame()` of a transition | `{director, transition}` |
| `OnStageTransitionEnd` | the `updateFrame()` that ends it, or `cancel()` | `{director, transition}` — `transition.state` says how it ended |

Both go out on the director through `emitStrict`; a listener that throws keeps neither the other
listeners nor the change of the stack from happening, and its error reaches the caller of
`updateFrame()` afterwards, as for every event of the stage layer.

## 6. Effects

### 6.1 The contract

```ts
import type {Node} from 'three/webgpu';

interface StageTransitionSource {
  /** The premultiplied linear color of the source at `uv`, transparent black outside [0, 1]. */
  sample(uv: Node<'vec2'>): Node<'vec4'>;
}

interface StageTransitionInput {
  from: StageTransitionSource;
  to: StageTransitionSource;
  progress: Node<'float'>;   // eased, 0…1
  uv: Node<'vec2'>;          // the uv of the pixel, 0…1, its origin at the top left of the picture
  resolution: Node<'vec2'>;  // in pixels of the drawing buffer
}

interface StageTransitionEffect {
  readonly name: string;
  build(input: StageTransitionInput): Node<'vec4'>;
}
```

An effect answers, for every pixel, `from` at `progress` 0 and `to` at `progress` 1 — the
contract that lets a director drop a finished transition without a jump. Between the two it may do
anything TSL can do with two sources: mix them, sample them at other places, distort, pixelate,
mask. The result is premultiplied, as its sources are.

An effect is a description: its options are read when it is built, and `build()` creates new
nodes on every call. One effect object can therefore serve every director, every slot and every
transition at once — unlike an `OutputNodeBuilder`, which belongs to one renderer. An effect
whose nodes own GPU memory releases it through an optional `dispose(node)` that the director calls
for every node it built, in its own `dispose()`, where the graphs of its shapes go; the built-in
effects own none.

The uv is the one the pipeline quad samples its textures at: under WebGPU and under WebGL 2 alike
its origin is the top left of the picture, which the browser test of §10.2 holds with a `wipe()`
`'up'` and a read-back whose row order it asks the backend for. A texture
an effect samples — the mask of `lumaMask()` — is handed in and stays the caller's.

### 6.2 The built-in effects

| effect | options | what it does |
| --- | --- | --- |
| `crossfade()` | — | `mix(from, to, p)` |
| `fade()` | — | an alias of `crossfade()` under the name that reads right for `show()`, `hide()`, `push()`, `pop()` |
| `dipToColor({color})` | `color`, default black | `from` into the color in the first half, the color into `to` in the second |
| `wipe({direction, softness})` | `'left' \| 'right' \| 'up' \| 'down'` — where the edge travels, `'left'` starts at the right side — or an angle in radians, counter-clockwise on the screen from the right; softness in uv, default 0.02 | a moving edge, `to` behind it |
| `slide({direction, mode})` | `direction`: where the pictures travel, the four names only; `mode`: `'push'` (both move), `'cover'` (`to` moves over `from`), `'reveal'` (`from` moves off `to`) | samples the sources at shifted uvs |
| `iris({center, softness})` | `center` in uv from the top left, default the middle; softness as a share of the largest radius | a circle opens on `to`; reversed, it closes on `from` |
| `dissolve({scale, softness})` | the size of the noise cells in pixels, default 1 | a hash noise per cell against `progress`; at scale 1 a pixel dissolve |
| `lumaMask({mask, softness, invert})` | a `Texture` whose luminance says when each pixel switches, dark ones first; it covers the picture as a texture covers a mesh, its top on top | the classic gradient-mask transition of 2D games |
| `pixelate({maxBlockSize})` | blocks in buffer pixels at the middle, default 32 | both sources sampled at a block grid that grows to the middle and shrinks again, crossed at the middle |

`fade()` with a layer and nothing is a plain opacity fade; `wipe()` from nothing is a reveal. Every
effect of the table works in both directions and with "nothing" on either side, because it only
ever sees two sources.

### 6.3 An effect of one's own

```ts
import {float, mix, sin, vec2} from 'three/tsl';
import type {StageTransitionEffect} from '@spearwolf/twopoint5d';

const wobble = (amplitude = 0.03): StageTransitionEffect => ({
  name: 'wobble',
  build: ({from, to, progress, uv}) => {
    const strength = sin(progress.mul(Math.PI)).mul(amplitude);
    const shifted = uv.add(vec2(sin(uv.y.mul(40)).mul(strength), float(0)));
    return mix(from.sample(shifted), to.sample(shifted), progress);
  },
});

director.replace(a, b, {effect: wobble(), duration: 0.7});
```

### 6.4 Without a director

`createTransitionNode(effect, from, to, progress)` builds the node of an effect from two nodes and
a progress node, for a `buildOutputNode` of one's own. A `from` or `to` may be a `TextureNode` —
what a nested `StageRenderer` hands in —, the `PassNode` of a `Stage2D`, whose texture node it
takes, or `null` for nothing. It answers the node and the uniform it created when no progress
node was handed in:

```ts
const {node, progress} = createTransitionNode(crossfade(), null, null);
renderer.buildOutputNode = ([a, b]) => createTransitionNode(crossfade(), a, b, progress).node;
// progress.value = 0.5 — the caller drives it
```

The tween of §5 is not part of this layer: it lives in the director. A caller without one drives
the uniform from a frame event or its own tween.

## 7. The graph and the cost of a change

### 7.1 No shader build at the start of a transition

A new `pipeline.outputNode` makes three.js build a new fragment shader: the `NodeBuilder` walks
the graph on the CPU, the backend compiles the result. Done at the start of a transition, that is
a hitch at the moment the player pressed Start — the one moment a game cannot afford it. The
director therefore keeps the structure of its graph apart from what fills it:

- **The shape** of the stack is the list of its slot kinds, bottom to top: a layer, or a
  transition with a given effect object. `[layer, crossfade, layer]` is a shape.
- **The graph of a shape** has a `TextureNode` per source and a progress uniform per transition
  slot, and a `RootRenderPipeline` of its own whose output node it is. The director keeps both
  per shape it has drawn, and fills a graph by pointing the `value` of its texture nodes at the
  pass textures of the layers and at the empty texture, a 1×1 target of the output buffer type
  cleared to transparent black. All pass targets of a director have the size and the type of its
  own, so a swapped texture changes a binding, not the shader — three.js compares the `value` of
  a texture node with the texture of its binding on every draw, and its flip of a render target
  is a uniform.
- A change of the stack that keeps the shape — the second `replace()` of the menu, every
  `crossfade()` between any two layers in the same slot — swaps textures. A change that makes a new
  shape builds its graph and its pipeline once; every later visit to that shape switches to its
  pipeline, whose material is built already, and runs no `NodeBuilder`.

A first visit to a shape still builds a shader. `director.precompile(shapes)`, which would build
and compile graphs ahead of time through `renderer.compileAsync()` for a game that knows its
transitions, is phase C and not built — see §12.2.

### 7.2 What a frame costs

| | full-screen draws | targets of the size of the drawing buffer |
| --- | --- | --- |
| a layer that runs | its own stages (+ its pipeline) | 1 pass target (+ those of its pipeline) |
| a frozen layer | none | 1 pass target, kept |
| a transition | none of its own: it is a part of the one quad | none of its own |
| the director | 1 quad of its pipeline | — |

A transition costs its sources: both layers draw while it runs, unless one is frozen. A game that
keeps its menu animating behind a fading level pays for both for the length of the fade, and
for no frame longer.

## 8. Ownership and disposal

Following [the resource lifecycle rules](../resource-lifecycle.md):

| what | whose | disposed by |
| --- | --- | --- |
| the `RootRenderPipeline` of every shape | the director | `StageDirector#dispose()` |
| the wrapper `StageRenderer` of a `Stage2D` | the director | the director, when its stage leaves the stack and in `dispose()` |
| a stage handed in | the caller | the caller; the director only lets go |
| the empty target, the graphs, their uniforms and texture nodes | the director | `dispose()`, which calls `dispose(node)` of every effect that has one for the node it built |
| an effect object and a mask texture | the caller | the caller |

`dispose()` cancels every running transition — their `finished` resolve as `cancelled`, their
`OnStageTransitionEnd` goes out —, then tears down as `StageRenderer#dispose()` does. A stage that
is disposed while it is in the stack leaves it on the spot, as it leaves every `StageRenderer`; a
transition that had it as a source ends as `cancelled` with the other source in its slot.

## 9. The seams in `StageRenderer`

The director is a subclass and needs three changes in `src/stage/StageRenderer.ts`, none of which
a user of `StageRenderer` sees:

1. **`orderedStages` from the subclass.** The director overrides the getter with its stack order;
   `updateFrame()`, the composed draw and the rebuild of the output node already read it through
   `this`. Its `renderOrder` setter throws, so the two orders never meet.
2. **A pass that is not drawn this frame.** `#prerenderNestedRenderers()` asks a protected
   `shouldRenderPass(child)` (default `true`) before it clears and draws a child, so a frozen
   layer keeps its picture. The director's `updateFrame()` leaves frozen layers out by itself.
3. **The output node only when it is another one.** `#rebuildComposedOutputNode()` sets
   `pipeline.outputNode` and `needsUpdate` only when the composer answers a node other than the
   one the pipeline has, as `#wireInternalOutputNode()` already does for the whole-picture mode.
   The director's composer answers the cached graph of a shape, and an unchanged shape costs no
   shader build. A `buildOutputNode` of one's own that answers the same node after changing the
   graph behind it sets `pipeline.needsUpdate` itself.

## 10. Tests

### 10.1 Vitest (`src/stage/StageDirector.spec.ts`, `src/stage/transitionEffects.spec.ts`)

- every method of §3.2 against the stack before and after, instant and with a transition; every
  refusal of §3.2 with its message, and that nothing changed;
- the timing of §5.2: the first frame at progress 0, the end frame, `duration: 0`, `delay`, a
  paused display, the second transition on a busy slot, `reverse()` and `cancel()` in both
  directions; `finished` resolving with the state; the easing names and a function;
- manual progress: clamping, `complete()`, `cancel()`, no advance by `updateFrame()`;
- the run and freeze modes of §4.3: which layers get `updateFrame()`, which get
  `shouldRenderPass()`, the one draw of a frozen layer after a resize;
- the stages of the director as layers come and go (§4.4): `add()`/`remove()`, the release of pass
  memory, a wrapper built and disposed, a stage disposed in the stack;
- the shape cache of §7.1: the same shape answers the same output node, so the pipeline gets
  `needsUpdate` once per new shape (with the stub renderer of the existing `StageRenderer.spec.ts`);
- events: order, props, a throwing listener; `dispose()` cancelling transitions;
- the effects build with every option and keep their names; `createTransitionNode()` with a
  `TextureNode`, a `PassNode` and `null`;
- `src/stage/hot-path-allocations.director.spec.ts`: `updateFrame()` of a director with a running
  transition allocates nothing, measured through `measureSettledBytes()`.

### 10.2 Browser (`packages/twopoint5d-testing/test/stage-transitions.test.js`)

Under WebGPU and under WebGL 2, with two layers of flat known colors:

- `crossfade()` at progress 0, 0.5 and 1 reads `from`, the mix and `to` at a sample pixel;
- `wipe({direction: 'left'})` at 0.5 shows `to` on one half and `from` on the other;
- the composition over a third layer below with premultiplied alpha: a half transparent layer
  over an opaque one reads the expected color, and a layer that draws nothing shows the one
  below;
- `fade()` from nothing: progress 0 shows the slot below alone;
- a frozen layer keeps its picture while its scene changes, and after `run()` shows the change;
- a layer with a bloom pipeline of its own under the director keeps its bloom, and the output
  transform applies once;
- the texture swap of §7.1: a second `replace()` with the same effect into a third layer shows
  that layer, under both backends.

## 11. The lookbook

Two demos, both under `apps/lookbook/src/pages/demos/` with their JSON (tags `StageDirector`,
`StageRenderer`, the effects they use, `transitions`, `vanilla`) and a preview image.

### 11.1 `stage-transitions-game-menu`

The demo of the feature: a game menu that goes into a game and back.

- **Layers.** `stars` — a parallax starfield under everything, in the stack from start to end.
  `title` — the logo, a blinking "press start" and three menu entries, a `Stage2D` with an
  orthographic projection. `level` — a `StageRenderer` with a world `Stage2D` (sprites flying
  through the stars, the player sprite moved by the arrow keys) and a HUD `Stage2D`, and a bloom
  pipeline of its own. `pause` — a dimmed full-screen panel with "paused" and two entries.
- **Flow.** Enter or a click: `replace(title, level)` with the effect chosen in the `<demo-ui>`;
  the stars stay still under the transition. Escape: `push(pause, {below: 'freeze'})`, Escape
  again `pop()`. "Quit to title" in the pause menu: `hide(pause)` and
  `replace(level, title, {effect: dipToColor()})`.
- **The `<demo-ui>`.** A select of every built-in effect, a duration slider, an easing select, a
  checkbox "freeze the outgoing layer".
- The assets come from `apps/lookbook/public/assets/` as they are (`skinball-256.png`, the
  spearwolf logo, the bitmap font of the text demos); the demo needs no new generated asset.

### 11.2 `stage-transitions-gallery`

Every effect, side by side with its options — the visual test of the effect library.

- Two strongly different layers, `A` (a warm checker pattern with moving sprites) and `B` (a cold
  stripe pattern with other sprites), each a `Stage2D`.
- The gallery cycles `A → B → A` through every built-in effect, with its name in a label layer on
  top — a third layer in the stack that no transition touches.
- A slider "scrub" switches the running transition to manual progress (§5.3), so one frame of any
  effect can be held and looked at.
- `lumaMask()` runs with three masks drawn at run time on a 2D canvas and taken as a
  `CanvasTexture` — a radial gradient, a diagonal stripe, a spiral —, so the demo needs no asset
  files for them.
- The custom effect of §6.3 is in the list as "wobble (custom)", to show that an effect of one's own
  plugs in the same way.

## 12. Open questions

1. **The name.** `StageDirector` follows the director of scene-based game engines and says that
   it decides what is on stage. `StageStack` says what it holds, `StageSwitcher` what it does in
   the simplest case. The proposal uses `StageDirector`; the event and option names follow it.
2. **The shader build on a first shape.** How long the `NodeBuilder` and the compile of a graph
   with one transition slot take under WebGPU and under WebGL 2 is not measured yet. If a first
   transition hitches visibly on a mid-range phone, `precompile()` (§7.1) becomes part of the
   first phase and the demos call it at start; if not, it stays in the last one.
3. **A second transition on a busy slot.** Finishing the running one (§5.2) is simple and
   predictable, but a visible jump when the first was far from its end. The alternative freezes
   the current picture of the slot into a target of its own and starts from that picture — one
   more target and a copy, for a smoother cut. Which one the menus of a real game need is open.
4. **Transitions of the whole stack.** A transition from one whole stack into another — every
   layer at once, through one effect — is a director nested as a layer in another director, with
   one stack per scene. Whether that is enough or whether `director.transitionStack(stages, opts)`
   earns a place of its own is open.
5. **Materials that are premultiplied already.** A material with `premultipliedAlpha: true` drawn
   into a transparent target gives a different alpha than the default blending does. The browser
   test of §10.2 holds the default; whether such materials need a note in the guide or a flag on
   the layer is open.

## 13. Phases

| phase | content |
| --- | --- |
| A — built | the seams of §9; `StageDirector` with the stack, the methods of §3.2, run and freeze, timing, events, disposal; `crossfade()`, `fade()`, `dipToColor()`, `wipe()`; the shape cache; the tests of §10 for these; the demo of §11.1 with these four effects |
| B — built | `slide()`, `iris()`, `dissolve()`, `lumaMask()`, `pixelate()`; `createTransitionNode()`; manual progress; the demo of §11.2; the effect select of §11.1 with every effect |
| C — open | `precompile()`, per §12.2; whatever §12.3 and §12.4 decide |

## 14. Docs and CHANGELOG

- [`docs/stages.md`](../stages.md) has a section "Stage transitions" after "Post-processing": the
  director, the stack and its methods, run and freeze, the options, the handle, the events, an
  effect of one's own, `createTransitionNode()`; and the classes, the effects and the defaults in
  its cheat sheet. Its "Who disposes what" gets the rows of §8.
- `packages/twopoint5d/CHANGELOG.md` gets an entry under `## [Unreleased]`, "Added", per phase.
- `src/stage/public-api.ts` exports `StageDirector`, the effects, `createTransitionNode()` and the
  types; `src/events.ts` the two events.

## 15. Left out

- **Transitions between canvases or displays.** A director composes inside one renderer; two
  `Display`s on one page fade each other through CSS, which the library does not touch.
- **Transitions of HTML over the canvas.** The menu of a game made of DOM elements belongs to the
  View Transitions API of the browser, not to a render pipeline.
- **Transitions in the plain and the whole-picture mode.** A transition needs both sources as
  textures at once; the director composes, always.
- **Sound.** A transition has events and a promise; a game starts its sound from them.
- **Effects in 3D.** A page curl or a cube turn is an effect of one's own (§6.3) that distorts
  the uv; the library ships none.
