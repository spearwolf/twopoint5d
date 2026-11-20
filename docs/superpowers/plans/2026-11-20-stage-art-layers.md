# Stage Art Layers, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `stage-art-layers.md` — `StageArt` with its layers, poses, depth compensation, stack, change detection and picking; `artTrack()`, `rampAt()`, `animationFrameAt()`; `ParallaxProjection#distanceToProjectionPlane`; the guide `docs/stage-art.md`, four lookbook demos — in the three phases of §10, each ending in a green gate.

**Architecture:** A `StageArt` is a `Group` holding one `FeatureSprites` of an internal kind, turned into the plane of the art. Sources are read once into plain layer specs (`artSources.ts`); every pose lives in one `Float64Array` of ten numbers per layer, and `artLayout.ts` maps a pose row into the attributes of the layer's sprite — artwork pixels to units, the depth compensation `k = (D + δ) / D` on top. `update()` turns the mesh, lays out depth layers for a new `D`, sorts the stack and updates the mesh.

**Tech Stack:** TypeScript 7 (NodeNext, `.js` import suffixes), three.js `three/webgpu` (TSL), Vitest, web-test-runner + Playwright (WebGPU and WebGL 2), Astro lookbook, Blender through the `asset-creation` skill.

**Spec:** `packages/twopoint5d/docs/proposals/stage-art-layers.md`; section numbers below (§n) refer to it. GitHub issue #57. Status `specified`.

## Global Constraints

- Read `AGENTS.md` before the first edit. Code, comments and docs are in English.
- `pnpm run ci` is the pre-commit gate; one gate per checkout. Commits only on the user's word.
- Never run `pnpm publishNpmPkg` or `scripts/publishNpmPkg.mjs`.
- Paths are relative to `packages/twopoint5d/` unless they start with `packages/`, `apps/` or `docs/superpowers/`.
- New module `src/stage-art/` (§6), re-exported from `src/index.ts` through `src/stage-art/public-api.ts`, which names its exports one by one as `texture/public-api.ts` does. `animationFrameAt` and `AnimationTiming` go out through `src/texture/public-api.ts`. `stage-art` imports `sprites`, `texture`, `utils`, and from `stage` only `ProjectionPlane`, `IProjection`, `ParallaxProjection`, `OrthographicProjection`; nothing outside `stage-art` imports it.
- Private members are `#…`. Message subjects: `StageArt` / `StageArt "<name>"`, `new StageArt()`, `ArtLayer "<name>"`, `artTrack`, `rampAt`, `animationFrameAt`; numbers through the `assert*` helpers of `src/utils/` (inline on the hot path, with a comment why), values through `describeValue()`, three.js objects through `describeThreeValue()`.
- Values from the spec: `pxPerUnit` default 1; `origin` default the canvas middle, `[0, 0]` without a canvas; `focus` default `origin`; `compensateDepth` default `true`; `unit x = (px − ox) / pxPerUnit`, `unit y = (oy − py) / pxPerUnit`, `unit z = −depth / pxPerUnit`, `rotation = −deg · π / 180`; `k = (D + δ) / D`, position `focus + (p − focus) · k`, size `· k`; `order` a whole number in `−1024 … 1023`, `artOrder = (order + 1024) · 8192 + index`, at most 8192 layers; ease default `'linear'`, track playback default `'once'`; material default `transparent: true`, `depthWrite: false`; the files atlas `padding: 2`, `extrude: 1`, the next power of two up to `renderer.capabilities`' maximum, 4096 before a renderer is known.
- The pivot of an Aseprite slice is the bottom left corner of the pixel it marks: canvas `(bounds.x + pivot.x, bounds.y + pivot.y + 1)` — the rule of `Anchor#setAnchorFromPivot()` (`src/sprites/features/Anchor.ts`).
- Hot paths allocate nothing (§5.4): every task that adds one extends `src/stage-art/hot-path-allocations.stage-art.spec.ts` (pattern `src/sprites/hot-path-allocations.flip-anchor-nine-slice.spec.ts`, `measureSettledBytes()`, under 1 byte per call, whole numbers and constants handed in).
- A rendering change gets its case in `packages/twopoint5d-testing/test/stage-art.test.js` (WebGPU and WebGL 2), shared helpers in `test/helpers/fixtures.js`.
- The guide grows with the feature (`AGENTS.md`, memory "docs grow with features"): each task writes its part of `docs/stage-art.md` and its CHANGELOG line under `## [Unreleased]` (skill `updating-changelog`). Standalone guide blocks are `ts check`.

## Decisions this plan takes where the code and the spec meet

1. **The Aseprite `meta` is kept** (§4.1 "the `meta` it keeps"): today `asepriteAtlasAdapter` drops it (`src/texture/atlasAdapters.ts:83`). `AsepriteJson.parse()` records the `meta` of each atlas it builds in a module `WeakMap`; an internal `asepriteMetaOf(atlas)` reads it. No public change; serves the store and the `{atlas, texture}` source alike.
2. **The art holds the store's texture through `store.acquireAsync()`** and releases the lease on `dispose()` (§7 "holds … as long as it lives"); §5.5 names `getAsync()`, which holds nothing once settled.
3. **Trim is relative to the layer box.** A layer's quad is the union of its frame boxes (§4.1); each frame is prepared with the margins of its own box inside that union, never the canvas margins (§4.3). `prepareSpriteFrame()` is not used for art frames.
4. **A `frame` set before the frames are known** is checked as a whole number of 0 or more only; a kept frame beyond the layer's frames at load becomes a problem and shows frame 0.
5. **The `animationFrameAt()` allocation case** goes into `src/texture/hot-path-allocations.spec.ts`, beside its module, not into the stage-art spec of §11.1.

Each is a deviation to list when the proposal is closed (Task 19).

## Review Focus

1. **An Aseprite sheet exported without `--filename-format '{layer}#{frame}'`** — Aseprite's default names (`kitchen (table) 0.aseprite`) match no layer; the user expects one problem of the source naming the format, not an art of empty layers. Pinned in Task 6.
2. **A pose set before load with a `frame` beyond the layer's frames** — kept, a problem at load, frame 0 shown, nothing thrown inside `loaded`. Pinned in Task 7.
3. **`only` naming a layer the source lacks, posed by the caller** — `layer()` answers it, `set()` works, it stays hidden, `problems` names it. Pinned in Task 7.
4. **Two arts on one store item, one disposed** — the other keeps drawing; only one lease released. Pinned in Task 7.
5. **A `depth` track applied after a new `D` puts its key in front of the camera** — `apply()` refuses naming layer and field, the layer keeps its pose, the next frame works. Pinned in Task 8.

---

## Phase A

### Task 1: `animationFrameAt()`

**Files:** Create `src/texture/animationFrameAt.ts`, `src/texture/animationFrameAt.spec.ts`; modify `src/texture/FrameBasedAnimations.ts` (export `cycleDurationOf` as `@internal` taking an `AnimationTiming`), `src/texture/public-api.ts`, `src/texture/hot-path-allocations.spec.ts`.

**Produces:** `interface AnimationTiming {readonly frameCount: number; readonly duration: number; readonly durations: readonly number[] | undefined; readonly playback: AnimationPlayback}`; `animationFrameAt(animation: AnimationTiming, seconds: number): number`. `FrameBasedAnimationInfo` is assignable to `AnimationTiming`.

- [ ] Spec: for `'loop'`, `'once'`, `'pingpong'`, each with one duration and with `durations`: the frame at every frame edge ± 1e-6 s, at −0.3 s and at 10 cycles past the end, equal to a JavaScript transcription of the shader in the spec file (`AnimatedFrames.ts` and `evenFrame.ts`: floored `mod` — `x − y · floor(x / y)`, not `%`; `clamp(floor(…), 0, lastFrame)`; the ping-pong turn of `2 · frameCount − 2`; the end-time count over `durations`, the way back mirrored at `cycleDuration + end(0) − turnTime`). A duration of 0 answers 0. `frameCount` of 0, 1.5 or `NaN` refused (`animationFrameAt: …`). A `FrameBasedAnimationInfo` passes the type check.
- [ ] Fail, implement (a linear walk over `durations`, no array built), pass. Allocation case with a durations animation.
- [ ] Guide: `docs/sprites.md`, "Animated frames": `animationFrameAt()` for a sprite animated on the CPU (`ts check`). CHANGELOG "Added".

### Task 2: `artTrack()` and `rampAt()`

**Files:** Create `src/stage-art/artPose.ts`, `src/stage-art/artTrack.ts`, `src/stage-art/artTrack.spec.ts`, `src/stage-art/public-api.ts`, `src/stage-art/hot-path-allocations.stage-art.spec.ts`; modify `src/index.ts`.

**Produces:**
- `artPose.ts`: `interface ArtPose` as §2.4; slot constants `POSE_X = 0, POSE_Y, POSE_DEPTH, POSE_DEG, POSE_SCALE_X, POSE_SCALE_Y, POSE_OPACITY, POSE_FRAME, POSE_VISIBLE, POSE_ORDER` (`POSE_SIZE = 10`, `visible` stored as 0/1); `POSE_FIELDS: readonly (keyof ArtPose)[]` in slot order; `refusePoseField(subject: string, field: string, value: unknown, why: string): never` — the one place the messages of §3.3 are built.
- `artTrack.ts`: `ArtKey`, `ArtTrackOptions`, `ArtTrack` (`duration`, `sample(seconds, target)`, `isMoving(seconds)`) as §3.4; `artTrack(keys, options?)`; `rampAt(seconds, start, duration, ease?)`.

Behaviour (§3.4): keys filled forward once at build into a `Float64Array` of `POSE_SIZE` per key plus a field mask; a field the first key leaves out is not part of the track. Continuous fields blend at the eased share of the arriving stretch through `applyEasingInPlace()` (`src/utils/easing.ts`); discrete fields change at their key; `'loop'` and `'pingpong'` wrap over `duration`; before the first key the first, after the last the last.

- [ ] Spec (§11.1, the `artTrack` bullet): before, between, after; a cut at equal `at`; ease per key and per track; held fields; discrete fields; `'loop'`, `'pingpong'`; fields left alone on the target; `isMoving()`; every refusal of §3.4 (empty keys, `at` negative or descending, an unknown field such as `rotation`, an `opacity` of 1.5, a `frame` of 0.5, an `order` of 1024, an `ease` `easingOf()` refuses, a playback of `'bounce'`); `rampAt()` at 0, ½, 1 and outside, a `duration` of 0 refused.
- [ ] Fail, implement, pass. Allocation cases: `sample()` of a three-key eased track, `rampAt()`.
- [ ] Guide: create `docs/stage-art.md` with its skeleton (scenarios, cheat sheet, reference — memory "guides user-first") and the section "A timeline with a scrubber". CHANGELOG "Added": `artTrack()`, `rampAt()`, `ArtPose`, `ArtKey`, `ArtTrack`, `ArtTrackOptions`.

### Task 3: `ParallaxProjection#distanceToProjectionPlane`

**Files:** Modify `src/stage/ParallaxProjection.ts`, `src/stage/ParallaxProjection.spec.ts`, `docs/stages.md`.

**Produces:** `get distanceToProjectionPlane(): number` — the `#distanceToProjectionPlane` of the last `updateViewRect()`, `NaN` before it (§3.9).

- [ ] Spec (§11.1, the getter bullet): `NaN` before the first view; the distance of the specs; the default 300 for specs that name none and for a distance no camera can be placed at.
- [ ] Fail, implement, pass.
- [ ] Guide: `stages.md`, "Depth under a parallax projection", the getter. CHANGELOG "Added".

### Task 4: the export fixtures and the kept meta

**Files:** Create `src/stage-art/fixtures/` (`kitchen-aseprite.json`, `kitchen-ftp.json`, `README.md`); modify `src/texture/AsepriteJson.ts`, `src/texture/AsepriteJson.spec.ts`.

**Produces:** `asepriteMetaOf(atlas: TextureAtlas<unknown>): AsepriteMetaData | undefined` (`@internal`, in `AsepriteJson.ts`, not in `public-api.ts`); `framesOfTag` of `AsepriteJson.ts` exported `@internal` for Task 6.

- [ ] Aseprite is not installed; the user chose the generator route. Settle the facts of a split-layer export of §4.1 from Aseprite's exporter source (`src/app/doc_exporter.cpp` of `aseprite/aseprite` on GitHub, the v1.3 branch, fetched read-only): `spriteSourceSize` per cel, the name `{layer}` yields for a layer in a group, how a group appears in `meta.layers`, where user data (`data`, `color`) lands, how `frameTags` count frames, whether empty cels are left out of a trimmed sheet, how `--filename-format '{layer}#{frame}'` numbers frames. Record each in `fixtures/README.md` as a present-tense fact with the source line it rests on.
- [ ] Write a generator `src/stage-art/fixtures/generate.mjs` (the layouts of `apps/lookbook/assets-src/lib/formats.mjs` as the pattern, extended for split layers there if the lookbook needs it in Task 11) for a small scene: two layers in a group with user data `depth=600` on the group and on one layer, a layer on the plane, a layer whose cels differ in size, an empty cel, a slice with a pivot named like a layer, a tag of 3 frames in `pingpong`. Commit its output as `kitchen-aseprite.json`; a free-tex-packer export with trimming over layer PNGs of the same scene, frame names after §4.2 (`carafe5-empty`, `steam#3`, `carafe5.pivot`, `window@600`), as `kitchen-ftp.json`.
- [ ] Spec: `asepriteMetaOf()` answers the `meta` for an atlas of `AsepriteJson.parse()` and of the store's `'aseprite'` adapter, `undefined` for a TexturePacker atlas.
- [ ] Fail, implement, pass. If a fact recorded above contradicts §4.1, stop and report before Task 6.

### Task 5: the layout

**Files:** Create `src/stage-art/artLayout.ts`, `src/stage-art/artLayout.spec.ts`.

**Produces:**
- `interface ArtFrame {pxPerUnit: number; originX: number; originY: number; focusX: number; focusY: number}` — the focus in units of the art frame, worked out once.
- `artFrameOf(subject: string, pxPerUnit: unknown, origin: unknown, focus: unknown, canvas: {width: number; height: number} | undefined): ArtFrame` — checks and defaults of §2.1/§2.5.
- `depthScaleInto(D: number, depthPx: number, frame: ArtFrame, out: Float64Array): void` — `out[0] = k`; 1 for a `D` that is `NaN` or not compensated.
- `layoutLayerInto(frame: ArtFrame, pose: Float64Array, row: number, box: LayerBox, k: number, out: Float64Array): void` — writes `x, y, z, width, height, rotation` of the sprite into `out[0…5]`; `interface LayerBox {x: number; y: number; w: number; h: number}` in artwork pixels.
- `anchorOf(box: LayerBox, pivotX: number, pivotY: number, out: Float64Array): void` — `out[0…1]`, fractions from the top left.
- `turnToPlane(mesh: Object3D, plane: ProjectionPlane): void` — reset the mesh's rotation, then `plane.applyRotation(mesh)` (§5.6).

- [ ] Spec (§11.1, the `artLayout` bullet): a pivot at the canvas middle on the origin; 90° clockwise is −π/2; `turnToPlane()` for the four planes, checked by where art-frame points `(1, 0, 0)`, `(0, 1, 0)`, `(0, 0, 1)` land in the world against the table of §2.2; the compensation — a layer at δ ∈ {−120, 0, 600} px through the rest camera of a `ParallaxProjection` (project its four corners with `Vector3#project()`) covers the screen box it covers at δ = 0, also with `focus` off the origin; `k = 1` under `OrthographicProjection` and `compensateDepth: false`; refusals of `pxPerUnit`, `origin`, `focus` (§8).
- [ ] Fail, implement, pass. Allocation cases: `layoutLayerInto()` and `depthScaleInto()`.

### Task 6: reading the sources

**Files:** Create `src/stage-art/artSources.ts`, `src/stage-art/artSources.spec.ts`.

**Consumes:** Task 1 (`AnimationTiming`), Task 4 (fixtures, `asepriteMetaOf()`, `framesOfTag`), Task 5 (`LayerBox`).

**Produces:**
- `interface ArtLayerSpec {name: string; box: LayerBox; pivotX: number; pivotY: number; depth: number; frames: readonly (ArtFrameSpec | undefined)[]; tags: ReadonlyMap<string, ArtTagSpec>; rest: Readonly<ArtPose> | undefined; order: number; at?: readonly [number, number]; pxPerUnit?: number}`.
- `interface ArtFrameSpec {frame: TextureAtlasFrame<unknown>; box: LayerBox}`; `undefined` is an empty cel.
- `interface ArtTagSpec extends AnimationTiming {frames: readonly number[]}` — the layer frame per step of the tag.
- `ArtLayerOptions`, `ArtLayerDef`, `StageArtProblem` as §3.8/§4.4/§4.5.
- `readAtlasSource(atlas: TextureAtlas<unknown>, options: {only?: readonly string[]; layers?: Readonly<Record<string, ArtLayerOptions>>}): {canvas: {width: number; height: number} | undefined; layers: ArtLayerSpec[]; problems: StageArtProblem[]}` — Aseprite when `asepriteMetaOf()` answers, else a trimmed atlas (§4.3).
- `readLooseLayers(atlas, defs: readonly ArtLayerDef[]): {layers: ArtLayerSpec[]; problems: StageArtProblem[]}` (§4.5).
- `prepareLayerFrame(spec: ArtFrameSpec, layerBox: LayerBox): PreparedSpriteFrame` — tex coords and flip of the frame, trim the margins of `spec.box` in `layerBox` as fractions (Decision 3).

- [ ] Spec (§11.1, the `artSources` bullet) on both fixtures: names and order from `meta.layers`, bottom first; plain names of layers in groups; boxes from `spriteSourceSize`, the union for differing cels, the empty cel `undefined`; pivots from slices by the pivot rule, the box middle without one; depth from user data `depth=…`, inherited from the group; a depth that is no number a problem and 0; tags per layer with direction and durations; the trimmed atlas — order of the json or `only`, `-suffix` and `#n` frames, `.pivot` markers not drawn, `@depth`; `layers` overrides beat the file; an override or `only` entry the source lacks a problem; a name twice a problem; `only` naming a layer twice refused; loose layers with `at` and frame pivots; **Review Focus 1**: a sheet with Aseprite's default names — one problem without a layer naming `--filename-format '{layer}#{frame}'`.
- [ ] Fail, implement, pass.

### Task 7: `StageArt` — layers, poses, stack, changes, loading

**Files:** Create `src/stage-art/stageArtKind.ts`, `src/stage-art/StageArt.ts`, `src/stage-art/StageArt.spec.ts`, `packages/twopoint5d-testing/test/stage-art.test.js`; modify `public-api.ts`, the allocation spec, `packages/twopoint5d-testing/web-test-runner.config.js` only if the file needs registering.

**Consumes:** Tasks 2, 5, 6.

**Produces:**
- `stageArtKind(features: readonly SpriteFeature[]): SpriteKind<StageArtSpriteApi>` — `QuadBase`, `InstancePosition`, `FlatPlacement`, `QuadSize`, `Anchor`, `Rotation`, `AtlasFrame`, `TextureColor`, `Fade`, `Visible`, `ArtOrder`, then `features`; the default kind cached module-wide. `type StageArtSpriteApi = InstancePositionApi & QuadSizeApi & AnchorApi & RotationApi & AtlasFrameApi & FadeApi & VisibleApi & {artOrder: number}`. `ArtOrder = defineFeature<{artOrder: number}>({name: 'artOrder', attributes: {artOrder: {size: 1}}})` — no stage.
- `class StageArt extends Group` and `class ArtLayer` (exported as a type and a class without a public constructor) with the members of §3.1, `StageArtOptions`, `StageArtSource` without the `files` shape (phase B). This task: the plane fixed at construction, `D` not read (`k = 1`); Task 8 adds both.
- Per-art state: `#poses: Float64Array` (`POSE_SIZE` per layer), `#flags: Uint8Array` per layer (`LOADED`, `FAILED`, `BEHIND`, `WARNED_BEHIND`, `WARNED_ORDER`), `#changed: boolean`, `#stackDirty: boolean`, `#bySprite: Map<object, ArtLayer>`.

Behaviour: §3.1, §3.3, §3.6, §3.8, §5.1–§5.5, §7. The sprite's `visible` is `visible ∧ loaded ∧ opacity > 0 ∧ ¬behind ∧ the current frame is no empty cel`. Static attributes are touched through `spritePool.touchVO()` where written. Sort: `sortBy('artOrder')` then `sortBy('z')`, only when `#stackDirty`. A source of `{store, id}` through `store.acquireAsync(id, ['atlas', 'texture'])` (Decision 2); a promise source awaited; a rejection one problem without a layer. `problems` warned once per art after `loaded`.

- [ ] Spec (§11.1, the `StageArt` bullet, minus `D` and setters): the refusals of §8 for the constructor — a source of none of the shapes, options no object, `compensateDepth` no boolean, a `projection` no `IProjection`, a `plane` of none of the four descriptions; partial `set()`, `reset()`, `apply()`; `takeChanged()` — the same value twice, a hidden layer that moves and a frame index that stays answer `false`; a pose from or to opacity 0 answers `true`; the stack by depth then order, the same under any sequence of `set()` calls (shuffle 20 times, compare `artOrder` read back in slot order); the "painted above, put behind" warning once per layer; hidden until loaded; a failing source; `layer()` and `set()` of an unknown name list the names; `dispose()` per §7, a load landing after it dropped; **Review Focus 2**: `frame: 5` before load on a layer of 2 frames — kept, problem, frame 0; **Review Focus 3**: `only: ['ghost']` posed and hidden with its problem; **Review Focus 4**: two arts on one store item, one disposed, the other's texture still set and its resource `refCount` 1.
- [ ] Fail, implement, pass. Allocation cases: `set()`, `apply()`, `takeChanged()`, `update()` without a sort, `layer.frameAt()`.
- [ ] Browser (§11.2, bullets 1, 2, 4 under `'xy|bottom-left'`): a layer turned 90° clockwise about an off-centre pivot on the expected pixels; two layers of one depth swap with their `order`, a deeper layer goes under; a held-back picture changes no pixel of the clear colour until it arrives.
- [ ] Guide: scenarios "A scene out of Aseprite", "A packed atlas", "Loose props", "Moving a layer", "A strip of steam" (`layer.frameAt()`), "Drawing on demand"; cheat sheet of options and pose fields. `docs/display.md`, "Drawing on demand": `art.takeChanged()` as a frame step; `docs/proposals/drawing-on-demand.md` §3.2: `StageArt` as the second block that answers a `Motion`. CHANGELOG "Added": `StageArt` and its types.

### Task 8: planes, projections and depth

**Files:** Modify `StageArt.ts`, `StageArt.spec.ts`, `artLayout.spec.ts`, the allocation spec, the browser test, `docs/stage-art.md`, `docs/stages.md`.

**Consumes:** Task 3 (`distanceToProjectionPlane`), Task 5 (`turnToPlane`, `depthScaleInto`).

**Produces:** the `projection` and `plane` setters (§3.1), `update()` as §5.6/§5.7: turn the mesh after a change to another plane (`ProjectionPlane#equals()`), read `D` from a `ParallaxProjection` under `compensateDepth`, lay out the layers at a depth for a new `D`, hide the ones `δ ≤ −D` puts behind the camera with one warning each, set `#changed` for each of these. `set()` writes position and size with the `k` in force and refuses `δ ≤ −D` where `D` is known.

- [ ] Spec: the setters keep what they held on a refusal; both `plane` and `projection` handed — one warning; a `CameraProjection` leaves the plane at `plane` and draws depth uncompensated; a new `D` answers `true` once and lays out anew; `NaN` then a view lays out on the next `update()`; a layer left behind by a new `D` hidden, warned once, shown again when `D` grows; **Review Focus 5**: a dolly track whose key at `depth: −250` is applied after `D` shrank to 200 — `apply()` refuses naming `ArtLayer "<name>"` and `depth`, the pose stays, the next `apply()` at a valid time works.
- [ ] Fail, implement, pass. Allocation case: `set()` of a depth layer under a `ParallaxProjection`.
- [ ] Browser (§11.2): bullet 1 under `'xy|top-left'`; bullet 3 — three depths at rest within one pixel of the same scene at depth 0, the camera moved sideways moves the far layer less on the screen.
- [ ] Guide: "A painted scene made deep", "Art on a top-left stage"; `stages.md`: the pointer to the guide for painted scenes with depth.

### Task 8a: the real Aseprite export

Aseprite turned up after Task 4 (1.3.17.2, an AppImage; the binary is found through the environment variable `ASEPRITE`, else `aseprite` on the `PATH` — no user path in the repo). The kitchen fixture moves from the generator to a real export.

**Files:** Create `src/stage-art/fixtures/kitchen.lua` (builds `kitchen.aseprite` through Aseprite's Lua API: the scene of Task 4 — a group with user data `depth=600`, a layer with its own `depth=600`, a layer on the plane, cels of differing size, an empty cel, a pivot slice named like a layer, a `pingpong` tag of 3 frames), `src/stage-art/fixtures/export.mjs` (runs the script, then the export of the guide — `--split-layers` before the file, `--trim`, `--ignore-empty` and once without it — and writes `kitchen-aseprite.json`, `kitchen-aseprite-empty-cels.json`); modify `fixtures/README.md`, `artSources.ts`, `artSources.spec.ts` where the real export differs; retire the Aseprite half of `generate.mjs` (the free-tex-packer half stays).

- [ ] Run the export; diff each fact of `fixtures/README.md` against the real json; the README states the real output (version 1.3.17.2) and keeps the source citations only where they explain it.
- [ ] Where the reader's assumptions differ (frame names in groups, groups in `meta.layers`, user data, the 1×1 empty cel, the order of entries), the spec fails first against the real fixture, then the reader follows.
- [ ] `pnpm nx test twopoint5d -- src/stage-art/`, `pnpm lint`, typecheck. The committed `.aseprite` file, the script and both json files are one commit.

### Task 9: picking and features

**Files:** Modify `StageArt.ts`, `StageArt.spec.ts`, the browser test, `docs/stage-art.md`.

**Produces:** `layerOf(sprite)` through `#bySprite`; `features` folded into the kind, a refusal of `defineSprite()` passed on in its words (§3.7).

- [ ] Spec: `layerOf()` for a sprite of the mesh after a sort, `undefined` for one of another mesh and after `dispose()`; `features: [Flash]` writes through `layer.sprite.setFlash()`; a second frame source refused naming it.
- [ ] Browser: a `SpritePicker` pick on the transparent part of a front layer answers the layer behind it; a hidden layer is never hit.
- [ ] Guide: "A click on a layer", the pestle-circle recipe (§2.7).

### Task 10: lookbook demo *stage art: the listening machine*

**Files:** `apps/lookbook/assets-src/stage-art-machine/` (Blender generator, free-tex-packer atlas via `assets-src/lib/formats.mjs`), `apps/lookbook/assets-src/README.md`, `apps/lookbook/public/assets/stage-art-machine/`, `apps/lookbook/src/pages/demos/stage-art-machine.astro` and `_stage-art-machine.json`, its preview image.

- [ ] Assets through the `asset-creation` skill per §9 (a brass contraption, one render per part, trimmed atlas); high-quality art, no classic fantasy, `maxPixelZoom` ≤ 2 (memory "Demo-Art-Qualität"); generator and output committed together (`pnpm lookbook:assets --only=stage-art-machine`).
- [ ] Demo per §9: four tracks, `rampAt()`, `animationFrameAt()`, the scrubber, the pacer panel, the pivot toggle.
- [ ] `pnpm lookbook`, check in the browser; `pnpm lookbook:generate-previews --only=stage-art-machine`; `pnpm test:scripts`.

### Task 11: lookbook demo *stage art: one Aseprite file*

**Files:** as Task 10, for `stage-art-aseprite`.

- [ ] The vending machine of §9, authored as a `.aseprite` file built by a Lua script under `apps/lookbook/assets-src/stage-art-aseprite/` and exported through the Aseprite CLI (`ASEPRITE`, as Task 8a) by the demo's generator in `pnpm lookbook:assets`; the read-out panel showing what the art read from that sheet; the read-out panel, picking with a wobble track, `Flash` on hover, the plane toggle. Check, preview, `pnpm test:scripts`.

### Task 12: lookbook demo *stage art: the drowned platform*

**Files:** as Task 10, for `stage-art-depth`.

- [ ] The platform of §9, painted planes rendered or drawn and assembled into a `.aseprite` file by a Lua script, exported through the Aseprite CLI as in Task 11: groups as planes with `depth` user data, a `CameraRig` `look()` and small `moveTo()` on the pointer, the train-light dolly track, ripples, the three toggles and the `D` slider. Check, preview, `pnpm test:scripts`.

### Task 13: the docs of phase A

**Files:** `docs/stage-art.md`, `docs/images/stage-art/`, `AGENTS.md`, `docs/architecture.md`, `docs/proposals/README.md` (the list of guides), `CHANGELOG.md`.

- [ ] The guide complete in its user-first order (§12), with the two figures as SVG — the mapping of §2.1 and the compensation of §2.5 from the side (memory "guides user-first"). `AGENTS.md` and `architecture.md`: the module and its guide. `pnpm typecheck` for the `ts check` blocks.

### Task 14: the gate of phase A

- [ ] `pnpm run ci` from the repo root, green.

## Phase B

### Task 15: the files source

**Files:** Create `src/stage-art/trimLayerImage.ts`, `trimLayerImage.spec.ts`; modify `artSources.ts`, `StageArt.ts`, their specs, the browser test, `docs/stage-art.md`.

**Produces:** `trimLayerImage(bitmap: ImageBitmap | {width: number; height: number; data: Uint8ClampedArray}): LayerBox | undefined` — the box of alpha above 0, `undefined` for an empty image; `parseLayerFileName(name: string): {layer: string; frameOf?: string; depth?: number; pivotOf?: string}`; the `{files, baseUrl?}` shape of `StageArtSource`; a `DynamicAtlas` the art owns, sized per §5.1, refused naming the size and "two arts" when the boxes do not fit.

- [ ] Spec (§11.1, the `trimLayerImage` bullet, and §4.2): the alpha box, an empty image, a file of another canvas size a problem of its layer; `@600`, `@-120`, `-empty`, `#3`, `.pivot`; the order of the list; one problem per failing url; the atlas size rule and its refusal; the decoded bitmaps closed after packing and on `dispose()` for a load in flight.
- [ ] Fail, implement, pass.
- [ ] Browser: a files art draws its layers where the full-canvas PNGs put them.
- [ ] Guide: "A scene out of layer PNGs". CHANGELOG "Added": the files source.

### Task 16: lookbook demo *stage art: layer files*

**Files:** as Task 10, for `stage-art-layer-files`.

- [ ] The specimen shelf of §9 with pivot markers and `@depth`; the *slow load* toggle through the demo's own loader (no CPU load — a held-back promise); the *break a file* toggle. Check, preview, `pnpm test:scripts`.

### Task 17: the gate of phase B

- [ ] `pnpm run ci`, green.

## Phase C

### Task 18: following the store

**Files:** Modify `StageArt.ts`, `StageArt.spec.ts`, `docs/stage-art.md`.

- [ ] Spec: a `{store, id}` art follows `store.on(id, ['atlas', 'texture'])` instead of one `acquireAsync()`; a re-parsed sheet replaces the frames, a layer keeps its pose and name, a layer the new sheet lacks stays posed, hidden, with its problem; `takeChanged()` answers `true` once after the swap; `dispose()` gives the subscription back.
- [ ] Fail, implement, pass. Guide: reloading a sheet while the page runs. CHANGELOG.

### Task 19: close the proposal and the gate

**Files:** `docs/proposals/stage-art-layers.md`, `docs/proposals/README.md`.

- [ ] Status `implemented` (or `phase A implemented` / `phase A, B implemented` if the run stops early), naming the guide sections, specs, browser test and demos; the deviations — the five decisions above and any found on the way — each with the section that now states it; §5, §6 and §11 caught up to what was built.
- [ ] `pnpm run ci`, green.
