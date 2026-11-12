# Drawing on Demand, Phase A, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build phase A of `drawing-on-demand.md` — the `FramePacer`, `untilSettled()` and the frame-step contract in the module `display`, the browser test that holds the canvas retention the feature rests on, and the guide section.

**Architecture:** A `FramePacer` subscribes to a source of frames (a `Display`), runs frame steps and collects their `Motion` answers as pending reports; the frame handler asks `shouldDraw(frame, busy?)` once per frame and draws only on `true`. `'steady'` draws every n-th frame, n from an exponential average of the frame gaps, moved only by a pick that lasts. No three.js, no `stage` import, nothing allocated per frame.

**Tech Stack:** TypeScript 7 (NodeNext, `.js` import suffixes), Vitest, web-test-runner + Playwright (Chromium WebGPU and WebGL 2, Firefox and WebKit WebGL 2).

**Spec:** `packages/twopoint5d/docs/proposals/drawing-on-demand.md`; section numbers below (§n) refer to it. GitHub issue #58.

## Global Constraints

- Read `AGENTS.md` before the first edit. Code, comments and docs are in English.
- `pnpm run ci` is the pre-commit gate; one gate per checkout. Commits only on the user's word.
- Never run `pnpm publishNpmPkg` or `scripts/publishNpmPkg.mjs`.
- New public symbols go through `packages/twopoint5d/src/display/public-api.ts`: `FramePacer`, `untilSettled` and the types `Motion`, `FrameStep`, `FramePacerSource`, `FramePacerOptions`.
- Private members are `#…`. Error messages start with their subject; refused values go through `describeValue()`, `steadyFps` through `assertPositiveFinite()` (§4.4).
- `dispose()` follows `packages/twopoint5d/docs/resource-lifecycle.md` and §4.5.
- Values copied from the spec: `FramePacer.DefaultSteadyFps = 30`; smoothing `0.1`; a gap counts for `0 < gap < 250` ms; a stride is picked as `max(1, floor(r + 0.25))`; a standing stride moves once 30 measurements in a row have picked another one (§5.3).
- The guide grows with the feature: `packages/twopoint5d/docs/display.md`, "Drawing on demand"; standalone blocks are `ts check`. The code blocks of this plan and of the proposal stay plain `ts`.
- The public surface changes: an entry under `## [Unreleased]` → "Added" in `packages/twopoint5d/CHANGELOG.md` (skill `updating-changelog`).

## Review Focus

1. **A step that unsubscribes itself, or a neighbour, while the steps run** — the run neither skips a step that stays nor calls one that left; pinned in Task 3.
2. **A frame handler that outlives its pacer** — `shouldDraw()` of a disposed pacer answers `true`, so the picture never freezes; pinned in Task 5.
3. **A host whose props carry no `rawDeltaTime`** — the stride falls back to `deltaTime`, and without any finite gap `'steady'` draws every frame; pinned in Task 4.
4. **A tab that comes back after minutes** — the gap of 250 ms and more leaves the stride alone; pinned in Task 4.
5. **A refresh rate on the edge of two strides (144 Hz)** — jitter does not flip the stride; pinned in Task 4.

---

### Task 1: `untilSettled()`

**Files:** Create `packages/twopoint5d/src/display/untilSettled.ts`, `untilSettled.spec.ts`; modify `src/display/public-api.ts`.

**Produces:** `export function untilSettled(): (moving: boolean) => boolean` (§3.4).

- [ ] Spec: `true` while moving; `true` once more in the frame it comes to rest; `false` afterwards and before the first motion; a second motion starts over; two functions share no memory.
- [ ] Run `pnpm nx test twopoint5d -- src/display/untilSettled.spec.ts` → fails on the missing module.
- [ ] Implement, export, run again → passes.

### Task 2: reports and `shouldDraw()`

**Files:** Create `src/display/FramePacer.ts`, `FramePacer.spec.ts`; modify `public-api.ts`.

**Produces:** `Motion`, `FrameStep`, `FramePacerSource`, `FramePacerOptions`, `class FramePacer` with `report()`, `invalidate()`, `shouldDraw(frame, busy = false)`, `frames`, `draws`, `steadyFps`, `static DefaultSteadyFps` (§4.1, §5.2). The spec builds its source as a double: `{onRenderFrame(listener) → unsubscribe}` that keeps the listener, and frames as `{rawDeltaTime, deltaTime} as DisplayEventProps`.

- [ ] Spec (§11.1, first two bullets): the first frame draws; no report, no draw; `invalidate()` and `report(true)` draw the next frame once; `report(false)`/`report(undefined)` draw nothing; an unknown truthy answer counts as `true`; `busy` forces the draw and takes the pending reports; `frames` and `draws` count.
- [ ] Fail, implement, pass.

### Task 3: frame steps

**Produces:** `onFrame(step, stage?)`, the `live` option, the run of the steps (§4.1, §5.4, §5.5).

- [ ] Spec (§11.1, bullets three, six, seven): the answer of a step is a report; props and order; registered in a run → next frame; unsubscribed in a run → not run; registered twice → runs twice, each with its unsubscribe; a stage that is not live draws nothing while the step runs; `live` asked only for a step that reports; a step that throws — every step runs, the frame invalidates, one error unchanged, two as `AggregateError('FramePacer: more than one frame step threw')`.
- [ ] Fail, implement (records `{step, stage, removed}`, index loop over the length at the start of the run, compaction after it), pass.

### Task 4: the steady stride

**Produces:** the measurement of `shouldDraw()` (§5.3).

- [ ] Spec (§11.1, bullets four and five), with a helper `run(pacer, hz, frames, {jitter?})` that reports `'steady'` before every `shouldDraw()` and answers the draws: the table of §5.3 row by row (600 frames each, draws = frames / stride after the first frame); 165 Hz with gaps that alternate ±20 % keeps 5; 144 Hz with a jitter of ±25 % keeps 5; 144 Hz after five frames of 100 ms ends at 5; three dropped frames at 60 Hz keep 2; gaps of 0 and of 250 ms measure nothing; gaps of 33.3 ms draw every frame; `steadyFps: 15` at 60 Hz draws every 4th; 60 Hz then 120 Hz moves the stride from 2 to 4; no measured gap → every frame; props without `rawDeltaTime` use `deltaTime`; `'steady'` after a silence draws the next frame; reported once, draws once.
- [ ] Fail, implement, pass.

### Task 5: the source, the refusals, `dispose()`

**Produces:** the subscriptions of §4.2, the refusals of §4.4, `dispose()`/`isDisposed` (§4.5).

- [ ] Spec (§11.1, last four bullets but one): `onResize` and `onRestart` invalidate; a source without them is taken; each refusal with its message; a constructor that throws gives its subscriptions back; `dispose()` gives every subscription back, twice is once, an unsubscribe that throws holds up none and comes out afterwards; after it `shouldDraw()` is `true` and counts nothing, `report()`/`invalidate()` do nothing, `onFrame()` throws, an old unsubscribe does nothing.
- [ ] Fail, implement, pass. Then `pnpm nx test twopoint5d` for the whole suite.

### Task 6: allocations

**Files:** Create `src/display/hot-path-allocations.frame-pacer.spec.ts` (§11.2), after the pattern of `hot-path-allocations.adaptive-resolution.spec.ts`: `measureSettledBytes()`, 1000 calls a round, under 1 byte per call, whole numbers and constants only.

- [ ] `shouldDraw()` idle, steady, busy; the run of the steps with answers nothing, `true`, `'steady'`, with and without a stage. Run `pnpm test:allocations`.

### Task 7: the browser test

**Files:** Modify `packages/twopoint5d-testing/web-test-runner.config.js` (a plugin with the server command `page-screenshot`: `session.browser.getPage(session.id).screenshot({clip})`, answered as base64 PNG), `test/helpers/fixtures.js` (`pageScreenshot(clip)` → `ImageData`); create `test/display-drawing-on-demand.test.js` (§11.3).

- [ ] The three tests of §11.3, on a `Display` in a container, a `StageRenderer` without a host and `makeFilledStage()`; the frame handler is the one of §6.
- [ ] `pnpm build:twopoint5d`, then `pnpm nx test twopoint5d-testing -- --files test/display-drawing-on-demand.test.js`; the result per launcher goes into §2 of the proposal as it comes out.

### Task 8: docs

**Files:** `packages/twopoint5d/docs/display.md`, `docs/images/display/display-drawing-on-demand.svg`, `docs/stages.md` (pointer), `docs/architecture.md`, `CHANGELOG.md`, the proposal (status `phase A implemented`, deviations).

- [ ] The guide section of §12, user first: recipes, pitfalls, cheat sheet, reference. `pnpm typecheck` compiles its `ts check` blocks.

### Task 9: the gate

- [ ] `pnpm run ci` from the repo root, green.
