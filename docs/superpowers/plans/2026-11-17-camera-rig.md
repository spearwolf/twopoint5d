# Camera Rig and Camera Projection, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `camera-rig.md` — the `CameraRig` with poses, moves, look, lift, lens changes, lock-on to cameras and objects, tracks for a scroll and flights across a transition; the `CameraProjection`; `framing()` of a box; the camera-driver hook and the event `OnStageCameraPlaced` of `Stage2D`; the shared easings; guide, CHANGELOG and two lookbook demos.

**Architecture:** While a rig is attached, `Stage2D` hands every camera placement to it through an internal driver hook: the projection places the rig's base camera, the stage emits `OnStageCameraPlaced`, the rig composes its shot over that base into the camera it draws with, which `stage.camera` answers. `step()` advances the clocks and answers a `Motion`; the write into the camera happens in `Stage2D#updateFrame()` just before `OnStageUpdateFrame`. Everything the rig blends is a shot, resolved anew in every frame from a pose, a camera, a projection or an `Object3D`.

**Tech Stack:** TypeScript 7 (NodeNext, `.js` import suffixes), three.js `three/webgpu` (TSL), `@spearwolf/eventize`, Vitest, web-test-runner + Playwright (WebGPU and WebGL 2), Astro lookbook, Blender through the `asset-creation` skill.

**Spec:** `packages/twopoint5d/docs/proposals/camera-rig.md`; section numbers below (§n) refer to it. GitHub issue #54.

## Global Constraints

- Read `AGENTS.md` before the first edit. Code, comments and docs are in English.
- `pnpm run ci` is the pre-commit gate; one gate per checkout. Commits only on the user's word.
- Never run `pnpm publishNpmPkg` or `scripts/publishNpmPkg.mjs`.
- Paths below are relative to `packages/twopoint5d/` unless they start with `packages/`, `apps/` or `docs/superpowers/`.
- New public symbols go through `src/stage/public-api.ts` (rig, `CameraProjection`, framing types, `OnStageCameraPlaced` via `src/events.ts`) and `src/utils/public-api.ts` (`Easing`). The driver hook is internal: `Stage2DInternals`, after the pattern of `StageTransitionInternals` in `src/stage/StageTransition.ts:65-118`, never re-exported.
- Private members are `#…`. Error messages start with their subject (`CameraRig#moveTo(): …`, `new CameraRig(): …`, `CameraProjection: …`, `ParallaxProjection.framing(): …`); numbers through the `assert*` helpers of `src/utils/`, refused values through `describeValue()`, three.js objects refused for their class through `describeThreeValue()`.
- `dispose()` follows `docs/resource-lifecycle.md` and §6.
- Values copied from the spec: `pitchLimit` default `Math.PI * 85 / 180`, accepted in `(0, π/2]`; default easing of `moveTo()` `'ease-in-out'`, of a track stretch `'linear'`; a perspective lens blends in `tan(fov / 2)`, an orthographic one in the height of its view; the dolly-zoom strength `s = tan(fov / 2)` falls in log space, `d = h / (2s)`; `depth` defaults to `h`; the distance is capped at `1000 · h`; the swap step stays below half a pixel; `smooth` settles when `|q - p| < 1e-4`; `CameraProjection` fit default `'contain'`; `getScaleFactor(d) = focus / d` (`1` for an orthographic source); `framing()` margin default `0`.
- Hot paths allocate nothing (§4.8): every task that adds one extends `src/stage/hot-path-allocations.camera-rig.spec.ts` (pattern: `src/display/hot-path-allocations.frame-pacer.spec.ts`, `measureSettledBytes()`, under 1 byte per call, whole numbers and constants only).
- A rendering change needs a browser test in `packages/twopoint5d-testing/test/stage-camera-rig.test.js` (WebGPU and WebGL 2); fixtures shared through `test/helpers/fixtures.js`.
- The guide grows with the feature, in the same commit (`AGENTS.md`): each task writes its part of `docs/stages.md` and its line under `## [Unreleased]` in `CHANGELOG.md` (skill `updating-changelog`). Standalone guide blocks are `ts check`; the code blocks of this plan and the proposal stay plain `ts`.

## Review Focus

1. **A resize while a lens change runs** — the rig's camera is of the other kind than the projection builds, and nothing throws; pinned in Task 5.
2. **One source camera under two `CameraProjection` stages** — neither placement writes the source, both follow its animation; pinned in Task 6.
3. **A rig disposed during a flight, or while `moveTo()` is awaited** — the promise resolves, the other rig goes back to its state; pinned in Task 10.
4. **A stage disposed under an attached rig** — `step()` answers `false`, no write, `rig.dispose()` still works; pinned in Task 3.
5. **A listener of `OnStageCameraPlaced` that throws during a resize with a rig attached** — the rig still composes, every listener is heard, the error reaches the caller afterwards; pinned in Task 2.

---

### Task 1: the shared easings

**Files:** Create `src/utils/easing.ts`, `src/utils/easing.spec.ts`; modify `src/stage/StageTransition.ts`, `src/stage/StageDirector.ts` (imports), `src/stage/public-api.ts`, `src/utils/public-api.ts`.

**Produces:** `type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | ((t: number) => number)`; `type EasingSpec = number | ((t: number) => number)`; `easingOf(subject: string, easing: unknown): EasingSpec` (message unchanged from `StageTransition.ts:30`); `applyEasing(spec: EasingSpec, t: number): number`. `StageTransitionEasing` and `StageTransitionEasingSpec` stay as aliases (§4.9).

- [ ] Spec: each name maps to the curve `StageTransition#advance` computes today (t³, 1-(1-t)³, the piecewise ease-in-out) at t = 0, ¼, ½, ¾, 1; a function passes through; an unknown name and a non-function refused with the existing message; the alias types compile.
- [ ] Fail, implement, pass. Move `StageTransition` onto `easingOf()`; keep its inline evaluation unless `applyEasing()` passes `pnpm test:allocations` in its place (§4.9) — decide by running it, and note the result in the commit message.
- [ ] `pnpm nx test twopoint5d` and `pnpm test:allocations`, green. CHANGELOG "Added": `Easing`.

### Task 2: the driver hook and `OnStageCameraPlaced`

**Files:** Modify `src/stage/Stage2D.ts`, `src/stage/Stage2D.spec.ts`, `src/stage/IProjection.ts` (doc comments of `projectionPlane`, `createCamera()`, `updateCamera()`, new optional `needsPlacement`), `src/events.ts`; create `src/stage/StageCameraDriver.ts`.

**Produces:**
- `OnStageCameraPlaced = 'stageCameraPlaced'`, `StageCameraPlacedProps {stage: IStage; camera: Camera; projection: IProjection}`, `IStageCameraPlaced` in `src/events.ts` (§3.8).
- `IProjection#needsPlacement?(camera: Camera): boolean`.
- `interface StageCameraDriver { readonly camera: Camera; placeBase(projection: IProjection): Camera; compose(): void; write(): void }` in `StageCameraDriver.ts` (internal).
- `Stage2DInternals.attachDriver(stage: Stage2D, driver: StageCameraDriver): void`, `.detachDriver(stage: Stage2D): void`, `.announceCamera(stage: Stage2D): void` (the driver swapped `camera`).

Behaviour (§4.1, §4.1.1, §3.8, §6):
- `stage.camera` answers `driver.camera` before an assigned camera and the projection's; an assignment while a driver is attached is kept for after.
- Every placement — `#updateProjection()`, the `camera` and `projection` setters — places `stage.camera` through the projection as today without a driver; with one it calls `placeBase(projection)`. Either way it then emits `OnStageCameraPlaced` with the placed camera, every listener heard (`emitStrict` into the collected errors, as `OnStageResize`), then calls `compose()` when a driver is attached.
- `updateFrame()`: after `updateProjection()`, if `projection.needsPlacement?.(camera)` answers `true`, place through a path of its own — no `updateViewRect()`, no `getViewRect()` — then the event, then `compose()`. Then `driver.write()`, then `OnStageUpdateFrame`.
- Attach, detach and `announceCamera()` go through `#updateCamera()`, so `OnStageAfterCameraChanged` and the pass node follow. Detach: the kept assigned camera counts again if the projection builds its kind (`isPerspectiveCamera` for `ParallaxProjection`, `isOrthographicCamera` for `OrthographicProjection`, any for one that declares no kind); otherwise it is dropped with one `console.warn` (`Stage2D "<name>": …` through `describeValue()`), and the projection builds and announces its own camera.
- The props object of `OnStageCameraPlaced` is one per stage, rewritten before each emit.

- [ ] Spec (`Stage2D.spec.ts`, a fake driver): precedence of `stage.camera`; placements go to `placeBase()` then the event then `compose()`, in that order, for each placement path; the event without a driver carries `stage.camera`; a listener's change to the placed camera is what `compose()` sees; `needsPlacement()` true → placement without `updateViewRect()` (spy), false → none; `write()` before `OnStageUpdateFrame`; `OnStageAfterCameraChanged` on attach, `announceCamera()`, detach; the kept camera after detach, the dropped one with its warning; **Review Focus 5**: a throwing listener of `OnStageCameraPlaced` during `resize()` with a driver — `compose()` still runs, the listener behind it is heard, the error reaches the caller after the state stands.
- [ ] Fail, implement, pass. Then the whole suite: no existing `Stage2D` spec changes.
- [ ] Guide: `stages.md`, "Events": `OnStageCameraPlaced` with a tilted-rest recipe (`ts check`). CHANGELOG "Added": the event, `needsPlacement`; "Changed": the contract of `IProjection` (§10).

### Task 3: the rig on planar projections

**Files:** Create `src/stage/CameraRig.ts`, `src/stage/cameraShot.ts` (the shot struct and its blend), `src/stage/cameraPose.ts` (reading and checking a pose), their specs `CameraRig.spec.ts`, `cameraShot.spec.ts`, `cameraPose.spec.ts`, `src/stage/hot-path-allocations.camera-rig.spec.ts`, `packages/twopoint5d-testing/test/stage-camera-rig.test.js`; modify `src/stage/public-api.ts`, `packages/twopoint5d-testing/web-test-runner.config.js` only if the new file needs registering.

**Consumes:** Task 1 (`Easing`, `easingOf`), Task 2 (`Stage2DInternals`, `StageCameraDriver`, `Motion` from `src/display/FramePacer.ts`).

**Produces:**
- `interface CameraPose`, `CameraRigOptions`, `CameraMoveOptions` as in §3.1–§3.2 (`offset`, `smooth`, `focus`, `depth` declared now, used from Tasks 5 and 7).
- `type CameraTarget = CameraPose | PerspectiveCamera | OrthographicCamera | IProjection | Object3D` — this task accepts `CameraPose` and refuses the rest with `CameraRig#moveTo(): … is not supported yet` until Tasks 5 and 7 replace the refusal.
- `class CameraRig implements StageCameraDriver` with `constructor(stage, options?)`, `stage`, `camera`, `busy`, `jump()`, `moveTo()`, `look()`, `reframe()`, `cancel()`, `step(deltaSeconds): Motion`, `dispose()`, `isDisposed`.
- `cameraShot.ts`: `interface CameraShot {position: Vector3; quaternion: Quaternion; kind: 'perspective' | 'orthographic'; lens: number /* tan(fov/2) or view height */; near: number; far: number; zoom: number /* factor on the base lens */; lift: number}`; `blendShots(a, b, e, target): CameraShot`; `writeShot(shot, base, camera, aspect): void`; `shotsEqual(a, b): boolean`.

Behaviour: §2.1, §3.1–§3.4, §4.1 (the rule "only writer"), §4.2 (a pose), §4.3, §5, §6. The base camera is of the projection's kind; the frame comes from `projection.projectionPlane` (origin, `getRight()`, `up`, normal) computed in `place` and kept in fields. Both ends of a move are kept relative to the fit (§4.3, last paragraph). The snap offset: from the base `view` under `ParallaxProjection`, from the base frustum under `OrthographicProjection`; the lift as a view offset on top.

- [ ] `cameraPose.spec.ts`: tuple of 2 and 3, `{x, y}` and `{x, y, z}`; fields left out are the rest's; refusals of §3.9 (non-finite, `zoom ≤ 0`, `look` under orthographic); the distance ignored under orthographic.
- [ ] `cameraShot.spec.ts`: blend at e = 0, ½, 1; slerp from yaw 350° to 10° turns 20°; lens blend in `tan(fov/2)` (the midpoint of 30° and 90° is `2·atan((tan 15° + tan 45°)/2)`); `shotsEqual()` on each field.
- [ ] `CameraRig.spec.ts` (§9.1, the bullets for poses, moves, look, reframe, refusals): a pose under `ParallaxProjection` and under `OrthographicProjection` on `'xy|bottom-left'` and `'xz|top-left'`; `{}` equals the projection's own placement exactly; easing; `look()` standing and retargeting a move; pitch clamped to `pitchLimit`; a new target resets the look (§3.3); `reframe()` standing, during a move, with `seconds`; `cancel()`, `jump()`, an overtaking `moveTo()`, `dispose()` resolve the promise, which never rejects; `step()` answers `true` only when the written shot changed; a resize during a move re-frames both ends; a listener write in `OnStageUpdateFrame` does not reach the next frame; `jump(pose)` in every frame with one kept pose object; one rig per stage; **Review Focus 4**: the stage disposed under the rig.
- [ ] Fail, implement, pass.
- [ ] Allocation spec: `step()` during a move; `jump()` with a kept pose; `look()` while moving.
- [ ] Browser (§9.3, first bullet): a lifted camera puts a marker at the expected pixel row, `makeFilledStage()`-style scene with a marker quad, through `pageScreenshot()`. `pnpm build:twopoint5d`, then `pnpm nx test twopoint5d-testing -- --files test/stage-camera-rig.test.js`.
- [ ] Guide: `stages.md`, new section "Moving the camera" after "A camera of your own": viewpoints, look, lift, a camera that follows by `jump()`, the post hook `OnStageUpdateFrame` with the camera-shake recipe (§4.1.1); "A camera that follows" and "From the pointer to the plane" get their notes. CHANGELOG "Added": `CameraRig`.

### Task 4: drawing on demand

**Files:** Modify `docs/proposals/drawing-on-demand.md`, `docs/display.md` (the recipe of the pacer).

- [ ] `rig.step()` as a frame step: `pacer.onFrame((frame) => rig.step(frame.deltaTime), stage)` in `display.md`, `ts check`; in `drawing-on-demand.md` the rig among the building blocks and the placement of a `CameraProjection` (Task 6) as an invalidation source of phase B.
- [ ] A Vitest case in `CameraRig.spec.ts`: a `FramePacer` with the rig as its step draws during a move, once after it, and not while the camera stands.

### Task 5: projections as targets and the lens change

**Files:** Modify `CameraRig.ts`, `cameraShot.ts`, their specs, the allocation spec, the browser test, `stages.md`.

**Produces:** `IProjection` accepted as a target (§4.2, third bullet); the dolly zoom (§4.4); `rig.precompile(renderer: WebGPURenderer): Promise<void>`; the rig holds a `PerspectiveCamera` and an `OrthographicCamera` and swaps through `Stage2DInternals.announceCamera()`.

Swap rule (§4.4): `focus` = the distance to the projection plane, else the option, else refused; `depth` option default `h`; swap where the parallax across ±`depth` at the focus plane stays below half a pixel of the container; distance capped at `1000 · h`. On one stage the move to a projection of the other kind assigns `stage.projection` on arrival; ortho → perspective assigns the perspective projection at the start and backs in.

- [ ] Spec: a move to a projection of the same kind lands on its rest and assigns `stage.projection` without a jump; parallax → ortho and back start and end on the rest of each projection; the computed swap step below half a pixel for a scene of known depth; the cap at `1000 · h` holds and a deeper `depth` swaps above half a pixel (no throw); a lens change without a plane and without `focus` refused; `precompile()` compiles with the other kind (a renderer mock records `compileAsync(scene, camera)` with each kind); **Review Focus 1**: `stage.resize()` in the middle of a lens change — no `TypeError`, the move re-frames.
- [ ] Fail, implement, pass. Allocation spec: `step()` through the swap.
- [ ] Browser (§9.3, second bullet): the parallax → ortho move ends on the picture of a stage that shows the orthographic projection alone; the swap frame differs from the frame before by less than a pixel at the markers.
- [ ] Guide: "Moving the camera", switching projections, perspective into orthographic, `precompile()`, the pitfall of a depth-reading `postProcess`.

### Task 6: `CameraProjection`

**Files:** Create `src/stage/CameraProjection.ts`, `CameraProjection.spec.ts`; modify `public-api.ts`, the allocation spec, the browser test, `stages.md`.

**Produces:** `CameraProjectionSpecs`, `class CameraProjection implements IProjection` with `source`, `viewSpecs`, `needsPlacement()` (§3.6, §3.8). A shared `fitLens(sourceLens, authoredAspect, containerAspect, fit, target)` in `CameraProjection.ts` that Task 7 reuses for camera targets.

- [ ] Spec (§9.1, the `CameraProjection` bullet): `contain` and `cover` for a container wider and narrower than the source; an orthographic source; `createCamera()` builds the kind of the source; `needsPlacement()` true after the source moved or its fov changed, false otherwise; `getViewRect()` answers the container; `getScaleFactor()`; refusals; **Review Focus 2**: one source under two stages — after placements and an animation step on both, the source's position, quaternion, fov, aspect and `view` are what they were.
- [ ] Fail, implement, pass. Allocation spec: `needsPlacement()` and the placement of a moving source, with a listener of `OnStageCameraPlaced`.
- [ ] Browser (§9.3, third bullet): markers on the corners of the authored frame under `contain` and `cover`, for both container shapes.
- [ ] Guide: `CameraProjection` in "Projections"; "Moving the camera", a 3D scene through the cameras of a `.glb`. CHANGELOG "Added".

### Task 7: cameras and objects as targets, lock-on

**Files:** Modify `CameraRig.ts`, its spec, the allocation spec, `stages.md`.

**Produces:** camera targets resolved through `fitLens()` (§4.2, second bullet); the lock-on (§4.5); `Object3D` targets with `offset` and `smooth` (§4.5).

- [ ] Spec: a move to a camera lands on its world pose and fitted lens; lock-on follows a source moved between frames, `step()` `false` for one that stands; a drag-look lies on top of a followed camera; `moveTo()`, `jump()`, `cancel()`, `track()`, `dispose()` release it; an `Object3D` target — `offset` of 2 and 3, its foot on the plane, orientation and scale ignored, a move back meets an object that kept moving, `smooth` trails and settles (`busy` false after), `false` for an object that stands; the order of the checks camera → `Object3D` → projection → pose.
- [ ] Fail, implement, pass. Allocation spec: lock-on onto a moving source; following an `Object3D` with `smooth`.
- [ ] Guide: a camera animated in Blender (lock-on), a 2D game that follows its player and pans to a point of interest.

### Task 8: tracks, `lerp()`, `smooth`, `clip`

**Files:** Modify `CameraRig.ts`, its spec, the allocation spec, `stages.md`; create `src/stage/animationMixer.spec.ts`.

**Produces:** `CameraTrackKey`, `track(keys)`, `track(from, to)`, `lerp(t, {smooth})` (§3.4, §4.6).

- [ ] First `animationMixer.spec.ts`: an enabled, paused `AnimationAction` of a position track applies its `time` at `mixer.update(0)`. If it does not, stop and report — §4.6 rests on it.
- [ ] Spec: keys out of order, `at`/`until` outside `[0, 1]`, `until < at`, `clip` without a camera shot refused; inside a key its shot; between keys the blend at the eased share of the arriving key; `clip` maps the key's span onto `0 … clip.getClip().duration`; `smooth` approaches critically damped and settles at `1e-4`; `track()` ends a move and a lock-on; `lerp()` without a track refused.
- [ ] Fail, implement, pass. Allocation spec: `step()` with a damped `lerp()` on a track with a clip.
- [ ] Guide: "Moving the camera", a page that scrolls through a scene (`ts check`, scroll handler, `smooth`, `clip`).

### Task 9: `framing()`

**Files:** Modify `src/stage/ParallaxProjection.ts`, `src/stage/OrthographicProjection.ts`; create `src/stage/framing.ts` (the shared computation), `framing.spec.ts`; modify `stages.md`.

**Produces:** `type FramingSide`, `static framing(box, options)` on both projections (§3.7).

- [ ] Spec (§9.1, the framing bullet): plane normal, `up` and origin for each of the six sides; the view is the face grown by `margin`, fit `'contain'`; every corner of the box inside the frustum of the placed camera for a container wider and narrower than the face; other specs pass through (`pixelSnap`); an empty box, an unknown side, a negative margin refused.
- [ ] Fail, implement, pass.
- [ ] Guide: "Projections", framing a box. CHANGELOG "Added".

### Task 10: `CameraRig.across()`

**Files:** Create `src/stage/CameraFlight.ts`, `src/stage/CameraRig.across.spec.ts`; modify `CameraRig.ts`, the allocation spec, the browser test, `stages.md`.

**Produces:** `CameraFlightOptions`, `CameraFlight {transition, finished}`, `static across(transition, options?)` (§3.5, §4.7). The rig of a stage is found through the driver of the stage (`Stage2DInternals`).

- [ ] Spec (§9.1, the across bullet): progress 0, ½, 1 on both rigs; anchors with a translation, a rotation and a uniform scale (position, near, far, focus, ortho height scaled); uneven scale refused; a running `moveTo()` resolves on `across()`; lock-on, track and lerp kept and resumed; `look()` during the flight on top; `jump()`, `moveTo()`, `track()`, `lerp()` refused naming the flight; the end by `transition.state` in the frame of the stage — finished, cancelled to the start, cancelled to the end, `reverse()`; a manual transition driven by `progress`; no `from`, a stage without a rig, a transition that is over refused; one warning for a frozen layer; **Review Focus 3**: a rig disposed during the flight — its awaited promise resolved, the other rig back to its state.
- [ ] Fail, implement, pass. Allocation spec: `step()` and the write during a flight.
- [ ] Browser (§9.3, fourth bullet): a flight across a crossfade, the pictures at progress 0 and 1 and the markers at ½.
- [ ] Guide: "Moving the camera", a flight across a transition, with anchors. CHANGELOG "Added".

### Task 11: lookbook demo *camera rig: two rooms*

**Files:** `apps/lookbook/assets-src/<demo>/` (Blender generator), `apps/lookbook/assets-src/README.md`, `apps/lookbook/public/assets/<demo>/`, the demo page and its metadata in `apps/lookbook/src/`, its preview image.

- [ ] Asset through the `asset-creation` skill: a `.glb` of two rooms joined by a door, a camera per room, one camera animated through the door; generator and output committed together (`pnpm lookbook:assets --only=<demo>`). High-quality art, no classic fantasy, `maxPixelZoom` ≤ 2.
- [ ] Demo: `CameraProjection` on the first room camera, click to travel between cameras, drag to look, a `lift` toggle, a scroll that flies the animated camera with `track()`, `smooth` and `clip`.
- [ ] `pnpm lookbook`, check in the browser; `pnpm lookbook:generate-previews --only=<demo>`; `pnpm test:scripts` (demo metadata and preview checks).

### Task 12: lookbook demo *camera rig: into the map*

**Files:** as Task 11.

- [ ] An orthographic map stage and a perspective room stage under a `StageDirector`; a click on the map marker starts `director.show(room, {effect: crossfade()})` with `CameraRig.across()` anchored on the marker and the room's origin; a back button flies out again; a follow mode on the map with `moveTo(player)`.
- [ ] Check, preview, `pnpm test:scripts`.

### Task 13: close the proposal

**Files:** `docs/proposals/camera-rig.md`, `docs/proposals/README.md`, `docs/architecture.md`.

- [ ] Status `implemented`, naming the guide sections, specs, browser test and demos; the list of deviations from this draft, each with its section; §8 and §9 caught up to what was built. `architecture.md`: the new parts of the module `stage`.

### Task 14: the gate

- [ ] `pnpm run ci` from the repo root, green.
