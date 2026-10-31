# Stage Masks, Phases A–C, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build phases A to C of `stage-masks.md` — masked slots of a `StageDirector`, masks in the effect contract with `matte()`, masks in the world and mask targets at a share of the resolution — and give every scenario and every goal of those phases a lookbook demo of its own.

**Architecture:** A `StageMask` binds a stage as coverage. The director joins a mask stage as it joins a layer — a `Layer` record with a role and a use count, a wrapper for a non-renderer, a pass target, run and freeze — and composes it through one texture node per distinct mask stage in the shape. Masks of slots live on the `Slot`; masks of an effect join with its transition and carry its progress. `StageMask.inWorldOf()` is a stage of its own that draws a scene through the camera of another stage; the mask `scale` is a seam in `StageRendererTargets`.

**Tech Stack:** TypeScript 7 (NodeNext, `.js` import suffixes), three.js `~0.186` with TSL (`three/tsl`, `three/webgpu`), `@spearwolf/eventize`, Vitest, web-test-runner + Playwright (WebGPU and WebGL 2), Astro lookbook.

**Spec:** `packages/twopoint5d/docs/proposals/stage-masks.md` (status `proposed` — this plan stands on a spec that is not agreed yet; Task 0 brings in the decisions of the review, and the user sets `specified`). It builds on `stage-transitions.md`; section numbers below (§n) refer to `stage-masks.md` unless another file is named.

## Global Constraints

- Read `AGENTS.md` before the first edit. Code, comments and docs are in English; commits follow Conventional Commits and end with the attribution lines of the session.
- `pnpm run ci` is the pre-commit gate: run it before every commit and commit only when it passes. One gate per checkout.
- Never run `pnpm publishNpmPkg` or `scripts/publishNpmPkg.mjs`.
- New public symbols go through `packages/twopoint5d/src/stage/public-api.ts`: `StageMask`, `matte`, `createMaskNode` and the types `StageMaskOptions`, `StageMaskCoverageSource`, `StageMaskSource`, `MatteOptions`, `MaskNodeOptions`, `StageMaskInWorldOptions`.
- Private members are `#…`, never TypeScript `private`.
- Error messages start with their subject (`StageMask: …`, `new StageMask(): …`, `StageDirector#setMask(): …`, `matte: …`); refused values through `describeValue()`, three.js objects through `describeThreeValue()`, numbers through `assertFinite()`/`assertPositiveFinite()`.
- Ownership follows `packages/twopoint5d/docs/resource-lifecycle.md` and the table of §9.
- Rendering changes need both test surfaces: Vitest next to the source and `packages/twopoint5d-testing/test/stage-masks.test.js` (every test under WebGPU and WebGL 2); shared fixtures go into `test/helpers/fixtures.js`.
- Hot paths allocate nothing: `StageDirector#updateFrame()` and `renderToCurrentTarget()` with masked slots, a running matte and a mask in the world; pinned in `src/stage/hot-path-allocations.director.spec.ts`.
- The guide grows in the same commit as the feature: `packages/twopoint5d/docs/stages.md`, section "Stage masks" after "Stage transitions" (§14). Standalone blocks are marked `ts check`.
- Every task that changes the public surface adds or amends its entry under `## [Unreleased]` → "Added" in `packages/twopoint5d/CHANGELOG.md` (skill `updating-changelog`).
- Defaults copied from the spec: `source: 'alpha'`, `invert: false` (§3.1); `matte` `mode: 'coverage'`, `softness: 0.05` (§4.3); `scale` default `1` (Task C2).
- Lookbook: every demo is `src/pages/demos/<name>.astro` + `_<name>.json` + classes under `src/demos/stage-masks/`, a preview through `pnpm lookbook:generate-previews --only=<name>`, its tags held by `scripts/lookbook/demoMetadata.test.mjs`. Assets come from `public/assets/` as they are; a new one is generated under `apps/lookbook/assets-src/stage-masks/`, documented in its `README.md` and committed with its output (skill `asset-creation` is cleared).

## Decisions this plan takes (confirm in Task 0)

The review of the proposal found places where it is silent or contradicts itself. The plan builds on these answers; Task 0 writes them into the proposal.

| # | gap | decision |
| --- | --- | --- |
| D1 | where mask stages stand in `orderedStages` (§3) | after every layer, the distinct mask stages by first appearance — slot masks bottom-up, then the masks of running effects slot by slot. They update after the layers, so a mask in the world reads the camera the world moved in this frame |
| D2 | `setStack()` makes new slots and would drop masks silently | `setStack()` drops every mask; the masks of stages that stay are not carried over. A mask is a property of a slot, and `setStack()` makes new slots — documented in the guide next to the `setMask()` example |
| D3 | the four channels of `source` on a premultiplied picture | every source reads the premultiplied picture: `'luminance'` of a half-transparent gray is its luminance times its alpha, so the transparent black around the shapes is coverage 0 |
| D4 | "a mask held by another director" (§3.2) vs. two `StageMask` objects on one stage (§3.3) | the refusal goes by **stage**: a module-level `WeakMap<IStage, StageDirector>` of mask stages; a second director refuses every mask on a stage another director draws as a mask. A stage that is a layer here and a mask there is refused too |
| D5 | "a stage is a layer or a mask, never both" — §3.2 names only `setMask()` | `show()`, `push()`, `replace()`, `setStack()` and `add()` refuse a mask stage of this director as a layer, as `setMask()` refuses a layer as a mask |
| D6 | `remove(maskStage)` and the dispose of a mask stage | both take the mask off every slot and end every transition whose effect names it as cancelled (§9 last paragraph); `remove()` of a stage that is no layer and no mask keeps today's behaviour |
| D7 | the busy rule of §4.2 under `replace()`, which ends the run of its slot first | a mask is busy only after the runs the call ends anyway have ended: `replace(a, b, {effect: inkIn})` in the slot whose `inkIn` run is still going is allowed |
| D8 | `freeze(maskStage)` before the mask stage joined | refused with the existing "no layer of this director" message, worded "no layer or mask"; a freeze does not survive the mask stage leaving, as for a layer |
| D9 | `mask.progress` under `manual: true` set after `updateFrame()` | `progressNode` is written again in `renderToCurrentTarget()`, as the progress uniforms of the shape are: the GPU never draws a stale value; `mask.progress` for the CPU side is the value of `updateFrame()` |
| D10 | `scale` (§12, phase C) | an option of `StageMask`, `(0, 1]`, default `1`, applied by the director to the pass target of the renderer it draws the mask stage with. The seam stays internal to the stage module (`StageRendererTargets#scale`), no public renderer option |
| D11 | §11 plans one demo `stage-masks` plus a gallery entry | one demo per scenario and goal (see "Lookbook demos" below); §11 is rewritten in Task F |

## Review Focus

1. **A masked slot that goes** — `hide()`, `pop()`, `setStack()` without it, `remove()` of its layer — the mask stage leaves the director and its pass memory is released when no other use holds it; pinned in Task A2 (`a mask stage leaves with the last slot it masks`).
2. **The fog stage handed to `show()`** while it masks a slot — refused before anything changes, and the reverse; pinned in Task A2 (`a stage is a layer or a mask, never both`).
3. **One `Stage2D` behind two `StageMask` objects in two directors** — the second director refuses it; pinned in Task A2 (`a second director refuses a mask stage the first draws`).
4. **The same `matte()` effect again in the slot whose matte is still running** (a player who skips a transition) — allowed, the old run ends first and the mask starts at progress 0; pinned in Task B1 (`replace() in the slot of a running matte reuses its mask`).
5. **A `manual: true` matte whose progress is set between `updateFrame()` and the draw** — the mask's `progressNode` reads the set value in that draw; pinned in Task B2 (`progressNode follows a manual progress set before the draw`).

---

## File map

| File | Responsibility | Tasks |
| --- | --- | --- |
| `packages/twopoint5d/src/stage/StageMask.ts` | the class, its options, `progress`/`progressNode`, `dispose()`, `inWorldOf()` | A1, B2, C1 |
| `packages/twopoint5d/src/stage/maskNodes.ts` | `maskCoverage()` (internal), `createMaskNode()`, `maskSource()` (internal) | A1, B1 |
| `packages/twopoint5d/src/stage/StageMaskWorldStage.ts` | the stage `inWorldOf()` builds (internal) | C1 |
| `packages/twopoint5d/src/stage/StageDirector.ts` | masked slots, mask roles in `Layer`, shape keys, composition, transition masks | A2–A4, B1–B2, C2 |
| `packages/twopoint5d/src/stage/transitionEffects.ts` | `masks` in the contract, `input.mask()`, `matte()` | B1, B3 |
| `packages/twopoint5d/src/stage/StageRendererTargets.ts`, `StageRenderer.ts` | the `scale` seam of the pass target | C2 |
| `packages/twopoint5d/src/stage/*.spec.ts` | `StageMask.spec.ts`, `maskNodes.spec.ts`, `StageDirector.masks.spec.ts`, `matte.spec.ts`, `StageRendererTargets.spec.ts` | all |
| `packages/twopoint5d-testing/test/stage-masks.test.js` | browser tests of §10.2 | A5, B4, C3 |
| `packages/twopoint5d/docs/stages.md`, `CHANGELOG.md`, `docs/proposals/stage-masks.md` | guide, changelog, proposal | 0, A6, B4, C3, F |
| `apps/lookbook/src/demos/stage-masks/*`, `src/pages/demos/stage-masks-*` | the demos | A7–A11, B5–B9, C4–C6 |

## Lookbook demos

Each row is one demo of its own; the scenario column cites the row of the goal table (§1) or the scenario table (§2) it shows.

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

`stage-transitions-gallery` additionally gains the two mattes (Task B9); the game-menu demo stays as it is.

---

### Task 0: Write the decisions into the proposal

**Files:**
- Modify: `packages/twopoint5d/docs/proposals/stage-masks.md` §3.1, §3.2, §3.4, §4.2, §11, §12

- [ ] **Step 1:** Write D1–D10 as present-tense statements into their sections (D1, D2, D5, D6 into §3.2; D3 into §3.1; D4 into §3.1 and §3.2; D7, D9 into §4.2; D8 into §3.4; D10 into §12 row C and a new paragraph "The size of a mask target" under §4.5), D11 into §11 as the demo table above. No "changed from" wording.
- [ ] **Step 2:** Run `pnpm lint` and `pnpm typecheck` (the proposal has no `ts check` blocks; this confirms nothing else broke).
- [ ] **Step 3:** Ask the user to review the proposal and set its status to `specified`; wait.
- [ ] **Step 4:** Commit `docs(twopoint5d): settle the open points of the stage masks proposal before its build`.

## Phase A

### Task A1: `StageMask` and `createMaskNode()`

**Files:**
- Create: `src/stage/StageMask.ts`, `src/stage/maskNodes.ts`, `src/stage/StageMask.spec.ts`, `src/stage/maskNodes.spec.ts`
- Modify: `src/stage/public-api.ts`, `docs/stages.md` (new section "Stage masks" with subsection "Without a director"), `CHANGELOG.md`

**Interfaces:**
- Produces:
  - `type StageMaskCoverageSource = 'alpha' | 'luminance' | 'red' | 'green' | 'blue'`
  - `interface StageMaskOptions { source?: StageMaskCoverageSource; invert?: boolean }` (C2 adds `scale`)
  - `class StageMask { constructor(stage: StageDirectorLayer, options?: StageMaskOptions); readonly stage; readonly source; readonly invert; readonly isDisposed: boolean; dispose(): void }`
  - internal `maskCoverage(picture: Node<'vec4'>, source, invert): Node<'float'>` — `clamp` to `[0, 1]`
  - `interface MaskNodeOptions extends StageMaskOptions {}`; `createMaskNode(content: StageTransitionSourceNode, mask: StageTransitionSourceNode, options?: MaskNodeOptions): Node<'vec4'>` — `content * coverage`, all four channels, both sampled through `textureSource()`, 0 outside `[0, 1]`

- [ ] **Step 1: Failing tests** in `StageMask.spec.ts`: `defaults to alpha, not inverted`; `reads every source and invert back`; `refuses an unknown source` (`new StageMask(): source must be 'alpha', 'luminance', 'red', 'green' or 'blue', got "lum"`); `refuses a stage without renderTo()`; `refuses a ClearStage`; `refuses a disposed stage`; `dispose() leaves a stage handed in undisposed`. In `maskNodes.spec.ts`: `createMaskNode takes a TextureNode, a PassNode and refuses null` (a mask of `null` is refused: `createMaskNode: mask must be a TextureNode or a PassNode, got null`); `maskCoverage picks the channel` — evaluate the node graph structure the way `transitionEffects.spec.ts` does.
- [ ] **Step 2:** `pnpm nx test twopoint5d -- src/stage/StageMask.spec.ts src/stage/maskNodes.spec.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement. `'luminance'` uses `luminance()` of TSL on the premultiplied rgb (D3).
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Guide: "Stage masks" intro (what a mask is, the options table of §3.1, premultiplied reading of D3) and "Without a director" with a `ts check` block of §5. CHANGELOG entry. `pnpm run ci`.
- [ ] **Step 6:** Commit `feat(twopoint5d): add StageMask and createMaskNode()`.

### Task A2: Masked slots in the director

**Files:**
- Modify: `src/stage/StageDirector.ts`
- Create: `src/stage/StageDirector.masks.spec.ts`

**Interfaces:**
- Consumes: `StageMask` (A1)
- Produces:
  - `StageDirector#setMask(stage: IStage, mask: StageMask | undefined): this`
  - `StageDirector#maskOf(stage: IStage): StageMask | undefined`
  - `StageShowOptions.mask?: StageMask` (inherited by `StagePushOptions`)
  - internal: `Layer` gains `role: 'layer' | 'mask'` and `uses: number` (slot masks + transition masks); `Slot` gains `mask?: StageMask`; `OrderRef.side` gains `'mask'` with `maskStage: number` (index among distinct mask stages)
  - internal module registry `maskOwners: WeakMap<IStage, StageDirector>` (D4)

- [ ] **Step 1: Failing tests:**
  - `setMask() lands at once and maskOf() answers it`; `setMask(stage, undefined) unmasks`
  - `the slot keeps its mask through replace()` (`maskOf(nextLevel) === fog`)
  - `show() and push() take a mask from the first frame`
  - refusals, each asserting the stack, the masks and `orderedStages` unchanged afterwards: `refuses a stage not in the stack`, `a stage is a layer or a mask, never both` (both directions, incl. `show()`, `replace()`, `push()`, `setStack()`, `add()` — D5), `refuses the director or a stage that holds it as mask stage`, `refuses a disposed mask`, `a second director refuses a mask stage the first draws` (two `StageMask` on one `Stage2D` — D4)
  - `one mask on two slots joins its stage once` (`orderedStages` holds the wrapper once)
  - `mask stages stand after the layers in orderedStages` (D1)
  - `a mask stage leaves with the last slot it masks` — through `hide()` finished, `pop()`, `setStack()` (D2), `remove(layer)`; wrapper disposed, `maskOwners` cleared
  - `remove(maskStage) takes the mask off every slot` (D6); `a disposed mask stage leaves its slots`
- [ ] **Step 2:** Run the spec → FAIL.
- [ ] **Step 3:** Implement. Reuse `#join()`/`#release()` for mask stages with the role set; `#isReferenced()` counts slot masks; `#rebuildOrder()` appends distinct mask stages (D1); `#slotsChanged()` after every mask change. Refusal messages: `StageDirector#setMask() cannot take the mask on "${stage.name}": that stage is a layer of this director`, `… that stage is a mask of another director`, `StageDirector#show() cannot take the stage "${name}": that stage is a mask of this director`.
- [ ] **Step 4:** Spec PASS; the existing `StageDirector.spec.ts` PASS unchanged.
- [ ] **Step 5:** Commit `feat(twopoint5d): let a StageDirector mask a slot by a stage`.

### Task A3: Masks in the shape and in `precompile()`

**Files:**
- Modify: `src/stage/StageDirector.ts` (`ShapeKind`, `shapeKey()`, `parseShapes()`, `#buildShape()`, `#fillShape()`, `#currentShape()`)
- Modify: `src/stage/StageDirector.masks.spec.ts`

**Interfaces:**
- Produces: `type StageDirectorShapeSlot = 'layer' | StageTransitionEffect | {effect?: StageTransitionEffect; mask: StageMask}`; shape key per slot `l|t<id>` plus `m<maskIndex>`, and per distinct mask `<source><invert>@<stageIndex>` (§4.4)

- [ ] **Step 1: Failing tests:** `two masks with the same options on stages in the same pattern answer the same output node`; `one mask on two slots builds one texture node`; `a red and a green mask on one stage and on two stages are two shapes`; `precompile() takes a masked slot and a mask stage in layers`; `parseShapes refuses {mask: 3}` with a message naming `shapes[0][1]`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement: one texture node per distinct mask stage, placeholder per node as today; masked slot `c = c * maskCoverage(maskNode.sample(uv), source, invert)` before `over()`. `#fillShape()` points the mask nodes at the passes by `OrderRef.side === 'mask'`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(twopoint5d): key the shapes of a StageDirector by their masks`.

### Task A4: Run, freeze, resize and the hot path

**Files:**
- Modify: `src/stage/StageDirector.ts`, `src/stage/StageDirector.masks.spec.ts`, `src/stage/hot-path-allocations.director.spec.ts`

- [ ] **Step 1: Failing tests:** `freeze(maskStage) keeps its picture and run() lets it go on`; `a frozen mask draws once and again after a resize`; `freeze() of a mask stage that has not joined is refused` (D8, message `StageDirector#freeze() cannot find the stage "ink": that stage is no layer or mask of this director`); allocation spec `updateFrame() and renderTo() with a masked slot allocate nothing`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement (the `Layer` record already carries `frozen`/`needsPicture`; adjust the message).
- [ ] **Step 4:** PASS, `pnpm test:allocations` PASS.
- [ ] **Step 5:** Commit `feat(twopoint5d): run and freeze the mask stages of a StageDirector`.

### Task A5: Browser tests of phase A

**Files:**
- Create: `packages/twopoint5d-testing/test/stage-masks.test.js`
- Modify: `packages/twopoint5d-testing/test/helpers/fixtures.js` (a mask stage that fills a rect with a given RGBA)

- [ ] **Step 1:** Tests (§10.2): `a masked slot over a slot below reads coverage 0, 0.5 and 1 as premultiplied colors` (expected pixels computed from `out = c·m + below·(1 − c.a·m)`); `a mask stage that draws its top half masks the top half` (§3.5); `invert and every source`; `one mask on two slots`; `a frozen mask keeps masking after its scene changed`; `precompile(): the first frame of a masked shape creates no node builder`; `createMaskNode() in a plain composing renderer`.
- [ ] **Step 2:** `pnpm test:browser` → PASS under WebGPU and WebGL 2.
- [ ] **Step 3:** Commit `test(twopoint5d-testing): hold the masked slots of a StageDirector in both backends`.

### Task A6: Guide and changelog of phase A

**Files:** `docs/stages.md` ("Stage masks": the mask, a masked slot, two worlds through one mask, run and freeze; cheat sheet rows; "Who disposes what" rows of §9; the `stencil` sentence of §6.2 under "Clearing"; D2 next to the `setStack()` example), `CHANGELOG.md`

- [ ] **Step 1:** Write; recipes first (fog of war, rift), then reference.
- [ ] **Step 2:** `pnpm run ci` → PASS.
- [ ] **Step 3:** Commit `docs(twopoint5d): document masked slots of a StageDirector`.

### Tasks A7–A11: Demos of phase A

One task per demo of the table above, in this order: `stage-masks-without-director`, `stage-masks-spotlight`, `stage-masks-rift`, `stage-masks-shared`, `stage-masks-frozen`. Each task:

**Files:** `apps/lookbook/src/demos/stage-masks/<Class>.ts` (shared: `SoftBlobs.ts` — a `FeatureSprites` pool of radial soft blobs for mask stages; `MaskLevel.ts` — a level stage, reusing the starfield and the sprites of `demos/stage-transitions/`), `src/pages/demos/<name>.astro`, `src/pages/demos/_<name>.json`, `public/images/demo-preview/<name>.webp`

- [ ] **Step 1:** Build the demo per its table row; the `<demo-ui>` controls as listed. `spotlight` and `rift` move the player with the keyboard and with a pointer drag.
- [ ] **Step 2:** `_<name>.json`: `title`, `url`, `shortDescription`, `description` linking `stages.md#stage-masks`, tags `StageMask`, `StageDirector`, `Stage2D`, `createMaskNode` where used, `masks`, `vanilla`. Add the tag `masks` to `src/data/tag-categories.json` once (A7).
- [ ] **Step 3:** `pnpm lookbook` once, check the demo in the browser under WebGPU and with `?webgl` forced if the page offers it; `pnpm lookbook:generate-previews --only=<name>`.
- [ ] **Step 4:** `pnpm test:scripts` (metadata and preview checks) and `pnpm run ci` → PASS.
- [ ] **Step 5:** Commit `feat(lookbook): add the demo <name>`.

## Phase B

### Task B1: Masks in the effect contract

**Files:**
- Modify: `src/stage/transitionEffects.ts` (`StageTransitionEffect.masks`, `StageTransitionInput.mask()`, `StageMaskSource`), `src/stage/maskNodes.ts` (internal `maskSource(node, mask)`), `src/stage/StageDirector.ts`, `src/stage/StageDirector.masks.spec.ts`

**Interfaces:**
- Produces: `interface StageMaskSource extends StageTransitionSource { coverage(uv: Node<'vec2'>): Node<'float'> }`; `StageTransitionInput.mask(mask: StageMask): StageMaskSource` throws `StageTransitionInput#mask(): the effect "${effect.name}" did not name the mask on "${mask.stage.name}" in its masks`; `createTransitionNode()` answers an input whose `mask()` throws for every mask (`createTransitionNode: an effect with masks needs a StageDirector`) — refused up front when `effect.masks?.length`.
- Run gains `masks: readonly StageMask[]`; each mask holds `drivenBy?: StageTransition`.

- [ ] **Step 1: Failing tests:** `the mask stages of an effect join when its transition begins and leave when it ends`; `a second transition on a busy mask is refused` (`StageDirector#replace(): the mask "ink" drives a transition already`); `replace() in the slot of a running matte reuses its mask` (D7); `a disposed mask stage ends the transition that names it as cancelled`; `the masks of an effect count among the distinct masks of the shape` (shared texture node with a slot mask on the same stage); `input.mask() throws for a mask the effect did not name`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement. The busy check runs after `#endRun()` of the slot's own run and after `#finishRunsWith()` (D7), before `#join()`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(twopoint5d): let a transition effect sample stage masks`.

### Task B2: The progress of a mask

**Files:** `src/stage/StageMask.ts`, `src/stage/StageDirector.ts`, `src/stage/StageMask.spec.ts`, `src/stage/StageDirector.masks.spec.ts`, `src/stage/hot-path-allocations.director.spec.ts`

**Interfaces:**
- Produces: `StageMask#progress: number` (read-only for the caller; written through an internal setter), `StageMask#progressNode: UniformNode<'float', number>`

- [ ] **Step 1: Failing tests:** `progress is written before the mask stage's updateFrame()` (a spy stage records `mask.progress` in its `updateFrame()`: equals the eased value of the transition after `advance()`); `progress is the eased value`; `progress and progressNode stay in step`; `progress holds the last value between transitions and a new one starts at 0`; `progressNode follows a manual progress set before the draw` (D9); allocation spec `a running matte allocates nothing`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement in `updateFrame()` between the loop of transitions and the loop of stages; again in `renderToCurrentTarget()` for `progressNode`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(twopoint5d): carry the progress of a transition to its mask stages`.

### Task B3: `matte()`

**Files:** `src/stage/transitionEffects.ts`, `src/stage/matte.spec.ts`, `src/stage/public-api.ts`

**Interfaces:**
- Produces: `interface MatteOptions { mask: StageMask; mode?: 'coverage' | 'threshold'; softness?: number }`; `matte(options: MatteOptions): StageTransitionEffect` with `masks: [mask]`, name `'matte'`.

- [ ] **Step 1: Failing tests:** `refuses a missing mask` (`matte: mask must be a StageMask, got undefined`); `refuses an unknown mode`; `refuses a negative softness`; `coverage mode holds both ends whatever the mask draws` (share 0 at progress 0, 1 at progress 1, the coverage between); `threshold mode switches by the coverage as lumaMask does` (reuse `switched()`); `the mask is sampled at uv, not flipped`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement: `'coverage'` share `select(progress <= 0, 0, select(progress >= 1, 1, coverage))`; `'threshold'` `switched(coverage, progress, softness)`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(twopoint5d): add the matte() transition through a living stage`.

### Task B4: Browser tests, guide and changelog of phase B

- [ ] **Step 1:** Browser: `matte() in coverage mode at progress 0, 0.5 and 1 against a mask stage whose coverage follows mask.progress`; `matte() in threshold mode`; `a matte inside a masked slot`.
- [ ] **Step 2:** Guide: "A transition through a living matte", "An effect that reads a mask" (`masks`, `input.mask()`), cheat sheet `matte()` defaults, the jump at the end of a mask that never covers (§4.3). CHANGELOG.
- [ ] **Step 3:** `pnpm run ci` → PASS.
- [ ] **Step 4:** Commit `docs(twopoint5d): document matte() and masks in the effect contract`.

### Tasks B5–B9: Demos of phase B

B5 `stage-masks-matte-ink`, B6 `stage-masks-matte-threshold`, B7 `stage-masks-matte-3d`, B8 `stage-masks-heat-haze` — the same steps as A7–A11, tags `StageMask`, `matte`, `StageDirector`, `StageTransition`, `masks`, `transitions`, `vanilla`. B7 builds its shards and logo as three.js meshes in a `Stage2D` under a perspective camera of its own; a Blender-made logo goes through `assets-src/stage-masks/` only if a primitive does not carry the look. B8's effect lives in `demos/stage-masks/heatHaze.ts`, as `wobble` does in `effects.ts`.

B9 `stage-transitions-gallery`: two more entries — ink blots in `'coverage'` mode, a boiling noise in `'threshold'` mode — through `matte()`; tags `matte`, `StageMask` added to its JSON; preview regenerated if the first frame changed.

## Phase C

### Task C1: `StageMask.inWorldOf()`

**Files:** `src/stage/StageMaskWorldStage.ts` (internal), `src/stage/StageMask.ts`, `src/stage/StageMask.spec.ts`, `src/stage/StageDirector.masks.spec.ts`

**Interfaces:**
- Produces: `static StageMask.inWorldOf(stage: Stage2D, scene: Scene, options?: StageMaskOptions): StageMask`; internal `class StageMaskWorldStage implements IStage, IRenderable` — `renderTo()` reads `stage.camera` at the draw, draws `scene` with it, draws nothing without a camera; no listener on `stage`.

- [ ] **Step 1: Failing tests:** `inWorldOf refuses a StageRenderer` (`StageMask.inWorldOf(): stage must be a Stage2D, got …`); `reads the camera at the draw`; `draws nothing while the stage has no camera`; `the mask goes into a slot again after it left one, and into a second matte after the first ended`; `dispose() disposes the stage inWorldOf() built and leaves the scene`; `a disposed mask is refused by setMask(), show(), push() and a transition`; `a frozen mask in the world keeps its picture when the camera moves` (documented behaviour).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(twopoint5d): add StageMask.inWorldOf() for masks in the world of a stage`.

### Task C2: A mask target at a share of the resolution

**Files:** `src/stage/StageRendererTargets.ts`, `src/stage/StageRenderer.ts` (internal accessor), `src/stage/StageMask.ts`, `src/stage/StageDirector.ts`, `src/stage/StageRendererTargets.spec.ts`, `src/stage/StageDirector.masks.spec.ts`

**Interfaces:**
- Produces: `StageMaskOptions.scale?: number` — `(0, 1]`, default `1`; `StageRendererTargets#scale: number` multiplies the device size of the pass target only (`max(1, floor(size · pixelRatio · scale))`); the director writes it on the renderer of a mask stage when it joins and writes `1` back on a caller's `StageRenderer` when it releases it.

- [ ] **Step 1: Failing tests:** `scale 0.5 halves the pass target, not the internal target`; `refuses a scale of 0, above 1 or not finite` (`new StageMask(): scale must be a finite number above 0 and at most 1, got 2`); `a caller's StageRenderer gets its scale back when the mask leaves`; `the stage keeps its logical size under a scaled target`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Measure the open question "A mask in its own format" (§13): bytes and frame time of an `R8` target against RGBA half float at 3840 × 2160 in the `stage-masks-resolution` demo; write the result into §13 of the proposal as present tense. Building `R8` is not part of this plan.
- [ ] **Step 6:** Commit `feat(twopoint5d): draw a stage mask at a share of the resolution`.

### Task C3: Browser tests, guide and changelog of phase C

- [ ] **Step 1:** Browser: `inWorldOf() follows a moved camera and a new projection`; `a mask at scale 0.5 masks the same area with a softer edge`.
- [ ] **Step 2:** Guide: "Masks in the world" (screen space vs. world, portal recipe of §7.2), `scale` in the options table and in "What a mask costs". CHANGELOG.
- [ ] **Step 3:** `pnpm run ci` → PASS. **Step 4:** Commit `docs(twopoint5d): document masks in the world and their scale`.

### Tasks C4–C6: Demos of phase C

C4 `stage-masks-flashlight`, C5 `stage-masks-portal`, C6 `stage-masks-resolution` — the same steps as A7–A11, tags `StageMask`, `StageDirector`, `ParallaxProjection` (C4, C5), `masks`, `vanilla`.

## Task F: Catch the proposal up

- [ ] **Step 1:** Status line `phase A, B and C implemented`, linking the guide sections and `stage-masks.test.js`; the list of deviations under it names every place the build left the draft.
- [ ] **Step 2:** §11 lists the demos as built; §12 rows A–C as built; D and E stay open.
- [ ] **Step 3:** `pnpm run ci` → PASS. Commit `docs(twopoint5d): catch the stage masks proposal up with phases A to C`.
