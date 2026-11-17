# Proposal: camera moves on a stage — `CameraRig` and `CameraProjection`

Status: **specified** — from [issue #54](https://github.com/spearwolf/twopoint5d/issues/54), widened
in the design discussion to the cameras of glTF assets, 3D scenes on a stage and camera flights
across a transition of a `StageDirector`. Nothing is built.

Every 2.5D scene with viewpoints needs a camera that travels: the rooms of a point-and-click game,
a diorama viewer, a level-select map, a menu that glides between panels, a cutscene, a page whose
scroll position flies a camera through a scene. The move itself is easy; the edge cases are not —
a drag-look during a move, a turn of the phone mid-move, a jump that overtakes a move, a resize
while the camera stands away from its rest, a move from a perspective into an orthographic view, a
camera an animation of a `.glb` moves. A consumer of the library has built the first half once
(`camera-rig.ts` of a private point-and-click game); the library takes it over, owns the edge
cases, and adds what the consumer did not have.

## 1. Goal

| who | what they get | § |
| --- | --- | --- |
| a stage with viewpoints | `rig.moveTo(target, seconds)`: an eased move of position, look and zoom; a promise that resolves on arrival | 3.3 |
| a 2D game | an eased pan and zoom of an orthographic camera to a point of interest | 3.2, 4.3 |
| a stage that resizes or turns | the pose holds through a resize, a new fit and a new projection; nothing to call after `OnStageResize` | 4.1 |
| a phone held sideways under a dialog | `rig.reframe({lift})`: the picture moves up without turning the camera | 3.3, 4.3 |
| a 3D scene from a `.glb` | `CameraProjection`: the stage looks through a camera of the asset, fitted into the container | 3.6 |
| a scene of several rooms | `rig.moveTo(camera)` from one camera of the asset to the next, through the door between them | 3.2, 4.2 |
| a camera animated in Blender | the rig locks on to the animated camera and follows it | 4.5 |
| a 2D game that follows its player | `rig.moveTo(player)` locks on to the player; a pan to a point of interest and back is two calls | 4.5 |
| a page that scrolls through a scene | `rig.track(keys)` and `rig.lerp(t)`, damped by `smooth`, scrubbing a clip | 3.4, 4.6 |
| a box of scenery to frame | `ParallaxProjection.framing(box, {side})`, `OrthographicProjection.framing(…)` | 3.7 |
| two stages, one crossfade | `CameraRig.across(transition)`: the camera flies through the transition of a director from one stage into the other | 3.5, 4.7 |
| drawing on demand | `rig.step()` answers a `Motion`; a camera that stands costs no draw | 3.4 |

## 2. Concepts

### 2.1 Projection, rig, camera

A stage keeps its roles; the rig adds one.

- **The projection owns the lens and the frame.** It fits the view into the container — the field
  of view or the frustum of the fit, the aspect, the offset of `pixelSnap` — and it defines the
  **frame** poses are given in and the **rest**: the shot it places a camera at by itself. For a
  `ParallaxProjection` and an `OrthographicProjection` the frame is the projection plane and the
  rest looks straight at it; for a `CameraProjection` (§3.6) the frame is the world and the rest
  is the shot of its source camera.
- **The rig owns the pose and the camera it draws with.** It resolves targets into shots, blends
  them, and writes the result into a camera of its own, which the stage draws with while the rig
  is attached.
- **The stage draws**, as it does today, its scene through `stage.camera`.

```text
source camera (.glb or three.js, read-only)          a pose, a camera, a projection
    │ lens, matrixWorld                                   │ targets
    ▼                                                     ▼
 projection ── rest, lens, frame ──▶ base ──▶ CameraRig ── writes ──▶ rig camera = stage.camera
                                                                            │
                                                         the stage draws stage.scene with it
```

### 2.2 The shot

A **shot** is a resolved camera state: a world position, a world orientation, a lens — the kind
(perspective or orthographic), the vertical field of view or the height of the view, near and far,
and the aspect of the container — and a view offset. Everything the rig blends is a shot; every
target resolves into one, and is resolved anew in every frame, so a target that moves — a resize,
an animated source camera — is met where it is now.

A target is one of three things:

| target | resolves to |
| --- | --- |
| a `CameraPose` (§3.2) | the rest of the projection of the stage, with the pose applied in its frame |
| a `Camera` — of three.js or of a loaded `.glb` | its world pose (`matrixWorld`) and its lens, fitted into the container as a `CameraProjection` with the default fit fits it (§3.6) |
| an `IProjection` | the rest of that projection for the container of the stage; on arrival the rig assigns it to `stage.projection` |
| any other `Object3D` — a player, a point of interest | a position only: the world position of the object, carried into the frame, plus the `offset` of the move; look, zoom and the distance stay those of the current pose (§4.5) |

### 2.3 Settled in the discussion, and why

- **The rig needs a projection.** Everything a stage is good for comes from its projection: the
  fit, the pixel-exact plane, `getViewRect()`, `getScaleFactor()`, the mapping from the pointer to
  the plane. A rig for a camera without one would serve the exception and leave the rule out.
- **Poses are given in the frame of the projection.** For an `'xy|bottom-left'` plane through the
  origin these are world coordinates, so viewpoints authored in a 3D tool carry over 1:1.
- **`zoom`, not `fov`.** An absolute field of view would override the fit on the next resize; a
  factor scales it.
- **There is no `Stage3D`.** A layer of a director, the source of a transition, a mask,
  `postProcess`, `freeze()`, `precompile()` — none of them cares about the kind of camera, and a
  second stage class would split that family. What a 3D scene lacked was an answer to how its shot
  fits into the container, which is the job of a projection: `CameraProjection` (§3.6). A bounding
  box is not a projection of its own but an input to the two that exist (§3.7).
- **A source camera is data.** Neither a projection nor a rig writes to it, and several stages may
  read the same one.
- **A move between stages couples to the transition, not to the stages.** The transition knows its
  `from` and its `to`, has the progress, and takes it by hand when it is `manual` (§3.5).

## 3. API

```ts
const rig = new CameraRig(stage, {pitchLimit: 1.4});

rig.jump(target);                                  // at once
await rig.moveTo(target, 0.6, {easing: 'ease-in-out'});
rig.look({yaw, pitch});                            // at once while standing, the new end of a move while moving
rig.reframe({lift: 0.16}, 0.3);                    // a framing for UI over the picture
rig.cancel();                                      // ends a move where it stands; its promise resolves

rig.track([{at: 0, shot: camA}, {at: 1, shot: camB}]);
rig.lerp(t, {smooth: 0.15});                       // a progress along the track, set by hand

const motion = rig.step(deltaSeconds);             // once per frame: a Motion

const flight = CameraRig.across(transition, {to: camB, anchors: [markerOnMap, cityOrigin]});

rig.dispose();
```

### 3.1 `CameraRig`

```ts
interface CameraRigOptions {
  /** The largest pitch up or down, in radians. Default 85° (`Math.PI * 85 / 180`). */
  pitchLimit?: number;
  /** The easing of moveTo() where the call names none. Default 'ease-in-out'. */
  easing?: Easing;
}

class CameraRig {
  constructor(stage: Stage2D, options?: CameraRigOptions);
  readonly stage: Stage2D;
  /** The camera the stage draws with while the rig is attached; a perspective or an orthographic one. */
  readonly camera: PerspectiveCamera | OrthographicCamera;
  /** `true` while a move, a lock-on to a moving camera or a damped lerp is under way. */
  readonly busy: boolean;
  jump(target: CameraTarget): void;
  moveTo(target: CameraTarget, seconds: number, options?: CameraMoveOptions): Promise<void>;
  look(look: {yaw: number; pitch: number}): void;
  reframe(framing: {lift?: number}, seconds?: number): void;
  cancel(): void;
  track(keys: readonly CameraTrackKey[]): void;
  track(from: CameraTarget, to: CameraTarget): void;
  lerp(t: number, options?: {smooth?: number}): void;
  step(deltaSeconds: number): Motion;
  /** Compiles the scene and the postProcess of the stage with the camera of the other kind (§4.4). */
  precompile(renderer: WebGPURenderer): Promise<void>;
  dispose(): void;
  static across(transition: StageTransition, options?: CameraFlightOptions): CameraFlight;
}

type CameraTarget = CameraPose | PerspectiveCamera | OrthographicCamera | IProjection | Object3D;

interface CameraMoveOptions {
  easing?: Easing;
  /** For an Object3D target: where the camera stands relative to the object, on the axes of the
   *  frame — x and y, and optionally a distance. Default [0, 0]. */
  offset?: readonly [number, number] | readonly [number, number, number];
  /** For an Object3D target: a time constant in seconds by which the camera trails the object
   *  once locked on, critically damped. Default 0: it sticks to the object. */
  smooth?: number;
  /** The distance of the focus plane for a move between a perspective and an orthographic lens (§4.4). */
  focus?: number;
  /** The depth of the scene in front of and behind the focus plane, for the same move (§4.4). */
  depth?: number;
}
```

- The constructor attaches the rig to the stage (§4.1) and starts at the rest of its projection.
  `dispose()` detaches it; the stage goes back to the camera it had and its projection places it.
- A stage takes one rig at a time.
- `moveTo()` resolves on arrival, and also when the move ends otherwise — `cancel()`, a `jump()`,
  an overtaking `moveTo()`, a `track()`, `dispose()` —, so code that awaits the camera (an input
  gate, a busy flag of a host) is released. It never rejects.
- Seconds and radians throughout: `seconds` as for transitions, `yaw` and `pitch` in radians.
- The easing type `Easing` is the one of transitions (`'linear'`, `'ease-in'`, `'ease-out'`,
  `'ease-in-out'` or a function), moved into a shared helper (§4.9).

### 3.2 `CameraPose`

```ts
interface CameraPose {
  /** On the axes of the frame: x and y on the projection plane, then the distance from it; world
   *  coordinates under a CameraProjection. A tuple or anything with x, y and an optional z; a
   *  distance left out is the rest's. */
  position?: readonly [number, number] | readonly [number, number, number] | {x: number; y: number; z?: number};
  /** Radians, relative to the orientation of the rest: yaw about the up axis of the frame, then
   *  pitch about the right axis of the camera. */
  look?: {yaw: number; pitch: number};
  /** A factor on the field of view (perspective) or on the view (orthographic) of the fit; 1 is the fit. */
  zoom?: number;
}
```

- A field left out is the rest's: `{}` is the projection's own placement, pixel-exact.
- Under a `ParallaxProjection` the right and up axes of the projection plane carry `x` and `y`, the
  normal carries the distance. Under an `OrthographicProjection` the pose takes `position` x and y
  and `zoom`; the distance is ignored, since it changes nothing an orthographic camera shows, so a
  list of poses serves both kinds of projection. A `look` other than zero is refused there. Under
  a `CameraProjection` `position` is a world position and `look` turns from the orientation of the
  source camera.
- A viewpoint authored with an absolute field of view converts once:
  `zoom = tan(fitFov / 2) / tan(fov / 2)`.
- Tuples stay the form for JSON content.

### 3.3 Moves and framing

- **`jump(target)`** puts the camera on the target at once; it overtakes a running move.
- **`moveTo(target, seconds)`** blends from the shot the camera shows now to the target (§4.3).
  Both ends are resolved in every frame.
- **`look({yaw, pitch})`** sets the look of the current pose: at once while the camera stands,
  as the new end of a running move while it moves — the move bends to it instead of fighting it.
  Pitch is clamped to `pitchLimit`.
- **A new target brings its own look.** `jump()`, `moveTo()`, a track key and the target of a
  flight arrive at the view the target was authored with — the `look` of a pose, `0` where it
  gives none, the orientation of a camera. A drag-look holds until the next target, on a camera the
  rig is locked on to as well. This is the behaviour of the reference: a click to travel shows the
  next viewpoint as it was made.
- **`reframe({lift}, seconds?)`** sets the lift: a share of the picture height by which the picture
  moves up through the view offset, without turning the camera, so that the subject clears a dialog
  over the lower half of a phone held sideways. It is a framing, not a viewpoint, and blends on its
  own clock, at once without `seconds`; a running move keeps running.
- **`cancel()`** ends a move where it stands.

### 3.4 Tracks, `lerp()`, `step()`

```ts
interface CameraTrackKey {
  /** The place of the key on the track, 0 to 1, ascending. */
  at: number;
  shot: CameraTarget;
  /** Where the key ends; between `at` and `until` the camera holds the shot — locked on to a camera
   *  that moves. Defaults to `at`. */
  until?: number;
  /** A clip the rig scrubs between `at` and `until`: the progress there maps onto the clip. */
  clip?: AnimationAction;
  /** The easing of the stretch that arrives at this key. Default 'linear'. */
  ease?: Easing;
}
```

- **`track(keys)`** sets a track; `track(a, b)` is the track of two keys at 0 and 1. A track stays
  until the next `track()`, `jump()` or `moveTo()`.
- **`lerp(t, {smooth})`** sets the progress along the track, clamped to `[0, 1]`. Without `smooth`
  the next `step()` shows it; with `smooth` — a time constant in seconds — the shown progress
  approaches the asked one, critically damped, so the ticks of a mouse wheel become a glide.
- **`step(deltaSeconds)`** advances the clocks of the rig — a move, a reframe, a damped lerp, a
  scrubbed clip — and resolves the shot of the frame. It answers the `Motion` of
  `drawing-on-demand.md`: `true` when that shot differs from the one written the frame before,
  `false` otherwise. So a lock-on to an animated camera draws only in the frames the animation moved
  it. As a frame step: `pacer.onFrame((frame) => rig.step(frame.deltaTime), stage)`. The rig takes
  its time from the caller, so a paused display pauses it, as it pauses transitions.
- **The write happens in the frame of the stage.** The stage asks the rig to write its camera in
  `updateFrame()`, after a pending placement and just before `OnStageUpdateFrame` (§4.1). So the
  order of `step()` against the director and the stage does not matter: a listener of
  `OnStageUpdateFrame` reads the camera of this frame, and a flight reads the progress the director
  set for this frame (§4.7). A stage that is not drawn — a frozen layer, a frame drawing on demand
  skips — is not written to, and the next draw writes the state the clocks have reached.

### 3.5 `CameraRig.across()`: a flight through a transition

```ts
interface CameraFlightOptions {
  /** Where the camera of `to` ends. Default: the shot the rig of `to` holds when the flight starts. */
  to?: CameraTarget;
  /** Two objects whose world frames are the same place, the first in the world of `from`, the
   *  second in the world of `to`. Default: the two worlds share their coordinates. */
  anchors?: readonly [Object3D, Object3D];
  /** An easing over the progress of the transition. Default 'linear': the transition's own. */
  easing?: Easing;
  focus?: number;
}

interface CameraFlight {
  readonly transition: StageTransition;
  /** Resolves once the transition is over; never rejects. */
  readonly finished: Promise<void>;
}
```

```ts
const transition = director.show(stageB, {effect: crossfade(), duration: 1.2});
CameraRig.across(transition, {to: camB, anchors: [cityMarkerOnMap, cityOrigin]});
```

- The stages are those of the transition; each needs a rig of its own, which keeps being stepped as
  before. A transition without `from`, a stage without a rig and a transition that is over are
  refused.
- During the transition there is one blended shot, in the world of `from`. The camera of `from`
  shows it; the camera of `to` shows it carried through the anchors into the world of `to`. Each
  stage draws its own scene from the same felt viewpoint, while the director blends the pictures:
  at progress 0 `from` shows its own picture unchanged, at 1 `to` stands exactly on its target.
- The progress is the transition's, read in every frame. A transition driven by hand
  (`{manual: true}`, `transition.progress = t`) flies the camera along with it — a scroll can drive
  picture and camera with one number. `reverse()` flies it back.
- Anchors with a scale carry it: a marker on a map in the world of a city scales position, near,
  far, focus and the height of an orthographic view. Anchors scaled unevenly are refused.

### 3.6 `CameraProjection`

```ts
interface CameraProjectionSpecs {
  /** How the frame of the source fits into the container: 'contain' (default) shows all of it,
   *  'cover' fills the container with it. */
  fit?: 'contain' | 'cover';
  /** The aspect the source was authored for. Default: `source.aspect` of a perspective camera
   *  (glTF `aspectRatio`), the frustum of an orthographic one. */
  aspect?: number;
  near?: number;
  far?: number;
}

class CameraProjection implements IProjection {
  constructor(source: PerspectiveCamera | OrthographicCamera, specs?: CameraProjectionSpecs);
  source: PerspectiveCamera | OrthographicCamera;
  viewSpecs: CameraProjectionSpecs;
}
```

- A third projection beside the two that exist. `createCamera()` builds a camera of the kind of the
  source; `updateCamera()` copies the world pose and the lens of the source into it and fits the
  authored frame into the container: under `'contain'` the narrower side of the container keeps the
  authored extent and the other side widens, under `'cover'` the wider side keeps it.
- It has no projection plane. The frame of a rig on such a stage is the world, and its rest is the
  shot of the source.
- An animated source moves the stage camera without a rig as well: the stage places the camera in
  every frame in which the source moved (§4.1).
- `getViewRect()` answers the container — one view unit per container unit, offset 0 — since there
  is no plane whose units it could count. `getScaleFactor(d)` answers `focus / d` with `focus` the
  `focus` of a perspective source (three's default `10`; glTF carries none) and `1` for an
  orthographic one.
- The source is read with `updateWorldMatrix(true, false)` and never written.

### 3.7 Framing a box

```ts
type FramingSide = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

ParallaxProjection.framing(box: Box3, options: {side: FramingSide; margin?: number} & Partial<ParallaxProjectionSpecs>): ParallaxProjection;
OrthographicProjection.framing(box: Box3, options: {side: FramingSide; margin?: number} & Partial<OrthographicProjectionSpecs>): OrthographicProjection;
```

- `side` names where the camera looks from: `'front'` from `+z` looking along `-z`, `'right'` from
  `+x`, `'top'` from `+y` looking down; up is `+y` for the four sides around, `-z` for `'top'` and
  `+z` for `'bottom'`.
- The projection plane lies in the face of the box toward the camera, with its origin in the middle
  of that face, so everything behind it appears smaller and the whole box lies in the view. The view
  is the face, grown by `margin` (a share, default `0`), fitted `'contain'`. The other specs pass
  through, `pixelSnap` among them.
- The result is an ordinary projection: pixel-exact on the face, poses in its frame.

### 3.8 Changes to `Stage2D` and `IProjection`

- **An internal camera-driver hook on `Stage2D`**, the pattern of `StageTransitionInternals`: not
  exported, used by the rig alone (§4.1). Nothing changes for a stage without a rig.
- **A new event `OnStageCameraPlaced`**, emitted by the stage after every placement by its
  projection, with a rig and without one (§4.1.1):

  ```ts
  export const OnStageCameraPlaced = 'stageCameraPlaced';

  export interface StageCameraPlacedProps {
    stage: IStage;
    /** The camera the projection just placed: `stage.camera` without a rig, the rig's base camera
     *  with one. A listener may change it. */
    camera: Camera;
    projection: IProjection;
  }
  ```
- **`IProjection#projectionPlane`** is typed optional already; what changes is the contract in
  the doc comments of `IProjection`, which today says `createCamera()` and `updateCamera()` throw
  without a plane. They throw without one where the projection needs one — the two planar
  projections, as before —, and `CameraProjection` places its camera without one.
- **`IProjection#needsPlacement?(camera): boolean`**, optional: `Stage2D#updateFrame()` places the
  camera when it answers `true`, besides `needsUpdate`. `CameraProjection` answers `true` when the
  world matrix or the lens of its source changed since its last placement, compared in place. This
  placement takes a path of its own, not `#updateProjection()`: the container is unchanged, so it
  skips `updateViewRect()` and `getViewRect()` — which answers a new object on every call — and
  calls only `updateCamera()`, or the rig's `place()`.

### 3.9 Refusals

Through the `assert*` helpers and `describeValue()`, subjects as `AGENTS.md` names them:

- `new CameraRig()`: a stage that is not a `Stage2D`, has no projection, already has a rig, or is
  disposed; a `pitchLimit` outside `(0, π/2]`.
- `jump()`, `moveTo()`, track keys: a pose or an `offset` with a non-finite number; a `zoom` that
  is not a finite number above 0; a `look` under an orthographic projection; `seconds` or a
  `smooth` that is not a finite number of 0 or more; a lens change without a focus where the stage
  has no plane (§4.4); a `depth` that is not a finite number above 0.
- `jump()`, `moveTo()`, `track()`, `lerp()` while the rig takes part in a flight (§4.7).
- `track()`: keys out of order, an `at` or `until` outside `[0, 1]`, `until < at`, a `clip`
  without a camera as its shot.
- `lerp()`: a `t` or `smooth` that is not a finite number.
- `CameraRig.across()`: §3.5.
- `CameraProjection`: a source that is neither a perspective nor an orthographic camera; an aspect
  that is not a finite number above 0.
- `framing()`: an empty box, an unknown side, a negative margin.
- Any call on a disposed rig throws, except `dispose()`.

## 4. How it works

### 4.1 Who places the camera: the driver hook

Today a projection places `stage.camera` — its own camera or one assigned to `stage.camera` — on
every resize, `needsUpdate` and new projection. A rig that wrote the same camera after it would be a
second writer: the projection would overwrite the pose, the rig would write it again, and in
between the camera would carry the rest for a frame. Worse, a lens change needs a camera of the
other kind, and the planar projections refuse a camera of a kind they do not build with a
`TypeError`.

So while a rig is attached, the stage **hands the placement to the rig** instead of the
projection:

- `stage.camera` answers the camera of the rig, before an assigned camera and the projection's.
  An assignment to `stage.camera` while the rig is attached is kept, and counts again once the rig
  is gone.
- Wherever the stage would call `projection.updateCamera(camera)`, it calls the projection's
  `updateViewRect()` as before and then the rig's `place()`. The rig lets the projection place a
  **base camera** of its own — of the kind the projection builds, never drawn with — and reads the
  rest, the lens and the snap offset from it; then it composes its shot into the camera it draws
  with. A resize, a turn of the phone, a new fit and a new projection re-frame the pose by
  themselves; point 6 of issue #54 ("who calls `reframe()` after `OnStageResize`?") does not
  arise.
- When the rig swaps its camera for one of the other kind (§4.4), and when it attaches and
  detaches, the stage announces the change through `OnStageAfterCameraChanged`, as for any new
  camera; a pass node takes the new camera from its next draw.
- The stage asks the rig to write its camera in every `updateFrame()`, after a pending placement
  and before `OnStageUpdateFrame` (§3.4).

#### 4.1.1 Hooks before and after the rig

The path of a placement has two places where code from outside comes in:

```text
projection ──places──▶ base camera ──OnStageCameraPlaced──▶ rig composes ──▶ rig camera = stage.camera ──OnStageUpdateFrame──▶ draw
```

- **Before the rig: `OnStageCameraPlaced`.** The stage emits it after every placement by the
  projection — in `resize()`, `updateProjection()`, an assignment to `projection` or `camera`, the
  placement of a `needsPlacement()` (§3.8) — and before the rig composes. A listener may change
  the placed camera: with a rig, the rig then composes its pose over the changed rest. A tilted
  rest — a view at an angle onto the plane, as the tilted view of `map2d` — or a near and far fitted
  to the scene are listeners here, and every pose and move of the rig runs relative to them. Without
  a rig the listener changes `stage.camera` right after the projection placed it, which is the
  place for such a change on any stage. The stage keeps one props object per instance and rewrites
  it, as for `OnStageUpdateFrame`, so the stage's own code of a placement in every frame — a
  `CameraProjection` with an animated source — allocates nothing; the emit itself costs what every
  eventize emit costs, as `OnStageUpdateFrame` does today. Every listener hears it; what one throws
  reaches the caller of the placement afterwards, as for `OnStageResize`.
- **After the rig: `OnStageUpdateFrame`.** The rig writes just before it (§3.4), so a listener there
  sees the camera of this frame and may write over it — a camera shake, a clamp of the final
  camera to the edges of a level. By the rule below, such a write holds for that frame's draw and
  never reaches the rig's state. No second event is needed after the rig; the guide names
  `OnStageUpdateFrame` as this hook.
- **Skipping the rig** is no hook: it is `rig.dispose()`.

**The rig is the only writer it listens to.** It keeps its state — the shots, the pose, the
clocks — in fields of its own and never reads its camera back. A listener of `OnStageUpdateFrame`
that moves the camera after the rig wrote it moves it for that frame's draw, and the next frame
starts from the rig's state again; nothing of such a write leaks into a move. A camera that follows
a player goes through the rig: `rig.moveTo(player, seconds)` arrives at the player and locks on to
it (§4.5). The guide section "A camera that follows" says so for a stage with a rig;
`rig.jump(pose)` in every frame with a pose object the caller keeps and rewrites stays possible and
allocates nothing (§4.8).

The base placement of the planar projections allocates (`ProjectionPlane#applyRotation()`), which
is fine on a resize. It happens in every frame only under a `CameraProjection` with a moving
source, whose `updateCamera()` allocates nothing.

### 4.2 Resolving a shot

- **A pose:** the base gives the frame (origin and axes of the plane, or the world) and the rest.
  The position goes through the frame, `look` turns the rest orientation — yaw about the up axis of
  the frame, then pitch about the right axis of the camera —, `zoom` divides `tan(fov / 2)` or the
  height of the view.
- **A camera:** `updateWorldMatrix(true, false)`, then position and orientation from `matrixWorld`
  and the lens, fitted into the container (§3.6). The look of the current pose lies on top, so a
  drag-look works on a followed camera as well.
- **A projection:** the rig lets it compute the view for the container of the stage and place a
  base camera of its kind — once at the start of the move and again on every placement of the
  stage. On arrival the rig assigns `stage.projection`; the projection then is the one whose rest
  the camera stands on, and nothing jumps.

### 4.3 Blending

The rig blends in world space, from the shot the camera showed when the move started to the
target as it resolves in this frame, at the eased progress `e`:

- position linearly; orientation by quaternion slerp, which takes the short way — a move from 350°
  to 10° turns 20°, not 340° (point 2 of the issue);
- a perspective lens in `tan(fov / 2)`, an orthographic one in the height of the view; near and far
  linearly;
- the view offset as the snap offset of the base plus the lift, which blends on its own clock
  (§3.3). The rig owns `camera.view` of the camera it draws with. The snap offset is read where the
  projection writes it: from `view` of the base under a `ParallaxProjection`, from the asymmetric
  frustum (`left`, `right`, `top`, `bottom`) of the base under an `OrthographicProjection`, which
  the rig copies into its orthographic camera before it sets the lift as a view offset.

**Both ends are kept relative to the fit.** The start of a move is the shot the camera showed when
the move began — or the blended shot where an overtaking move began —, but the rig keeps its lens
as a factor on the lens of the base and takes the aspect from the container, so a resize during a
move re-frames the start as it re-frames the target.

### 4.4 A perspective into an orthographic lens and back

A blend of the matrices would end exactly but show no camera in between. The rig uses a **dolly
zoom** instead:

- A **focus plane** keeps its size on the screen through the move. Its distance is the distance to
  the projection plane where the stage has one, otherwise the `focus` of the move; without either a
  lens change is refused.
- The visible height `h` at the focus plane blends from one end to the other. The strength of the
  perspective `s = tan(fov / 2)` falls toward 0 in log space while the camera backs off to
  `d = h / (2s)` along its axis, so the parallax fades; near and far move with `d`.
- At the orthographic end the rig swaps in its orthographic camera. It swaps where the parallax
  across the **depth** of the scene — `depth` units in front of and behind the focus plane — stays
  below half a pixel. The depth is an option of the move, `{depth}`, and defaults to the visible
  height `h`: a bounding box of the scene says nothing reliable, since sprites are vertex objects
  placed in the shader.
- The distance is capped at `1000 · h`, since at a larger distance the precision of float32 in the
  view matrix shows. A scene so deep that the cap comes first swaps with a step above half a pixel;
  the guide names it.
- Going the other way the rig swaps first and backs in.

The rig holds one camera of each kind. On a single stage the move to an `IProjection` of the other
kind assigns `stage.projection` at the end (§4.2).

**Shaders on a swap.** A pass node does not depend on its camera, but a material or a
`postProcess` may compile what differs between the kinds — a depth linearized for one kind. So
the first frame after a swap may compile. `rig.precompile(renderer)` compiles the scene of the
stage and its `postProcess` with the camera of the other kind as well — the rig's part of
`StageDirector#precompile()`, which compiles with the camera the stage has. A `postProcess` that
reads depth handles both kinds itself, and the guide names that in its pitfalls. Calls on one
renderer queue behind each other in a module-level `WeakMap` from renderer to the settling of the
last call, since two `compileAsync()` of three.js on one renderer trip over each other; a rejection
stays its caller's and the next call still runs.

### 4.5 Locking on to a camera

When a move to a camera arrives, the rig **locks on**: the target keeps being resolved in every
frame, so a camera an `AnimationMixer` moves is followed. A new `moveTo()`, a `jump()`, `cancel()`,
a `track()` or `dispose()` releases it. A lens the animation changes (a field of view through
`KHR_animation_pointer`, where the loader delivers it) is followed alike, since the rig reads the
lens in every frame.

**Any other `Object3D` locks on the same way**, as a position: a player the camera follows, a point
of interest it pans to and holds.

```ts
await rig.moveTo(player, 0.4, {offset: [0, 40], smooth: 0.2});  // arrives, then follows
await rig.moveTo(chest, 0.6);                                     // pans to the chest and holds there
await rig.moveTo(player, 0.6, {offset: [0, 40], smooth: 0.2});   // back to where the player is now
```

- The world position of the object (`updateWorldMatrix(true, false)`, then the translation of
  `matrixWorld`) is carried into the frame: under a planar projection its foot on the projection
  plane gives x and y, and the distance stays the current pose's unless `offset` names one. Its
  orientation and scale are ignored — the camera follows where the object is, not how it turns.
- `look`, `zoom` and the lift stay the rig's; a drag-look works while following.
- The move blends to the position the object has in each frame, so a move back to a player who keeps
  walking meets the player, not the place the player stood at when the move began.
- Once locked on, `smooth` lets the camera trail the object, critically damped; `0` sticks to it.
  `step()` answers `true` in the frames the camera moved, so a player who stands still costs no draw
  once the trailing has settled.

### 4.6 Tracks

- A track resolves to one shot per progress: inside a key (`at` to `until`) the key's shot, between
  two keys a blend of their shots at the eased share of the stretch (the `ease` of the key it
  arrives at). All shots are resolved anew in every frame.
- **`clip`**: inside its key, the progress maps linearly onto `0 … clip.getClip().duration`; the rig
  sets `clip.time` and lets the mixer of the action apply it (`clip.getMixer().update(0)`), so the
  camera stands where the clip puts it at that time. Other actions of the same mixer are applied
  with it, so one clip can scrub the whole scene. The rig neither plays nor stops the action; the
  caller keeps it enabled and paused. Whether a paused action applies at `update(0)` is pinned by a
  spec against three's mixer before the build relies on it.
- **`smooth`**: the shown progress `p` follows the asked progress `q` as a critically damped spring
  with the time constant `smooth`; it settles when `|q - p|` falls below `1e-4`, and `busy` answers
  `false` from there. The first `lerp()` after `track()` jumps — it sets `p` to its `q` at once,
  at rest, whatever its `smooth`, before the next step, since the stage may write its frame first —,
  so a track does not glide in from 0, and `smooth` glides from there with every later `lerp()`.

### 4.7 A flight across stages

- The rig of `from` and the rig of `to` each take the flight on `CameraRig.across()`. A running
  `moveTo()` of either ends there, and its promise resolves. A lock-on, a track and a damped lerp
  are kept, with their clocks stopped, as the state the rig goes back to.
- **During the flight** `look()` works and lies on top of the flight, so a drag still turns the
  view. `jump()`, `moveTo()`, `track()` and `lerp()` are refused with a message that names the
  flight: a target of its own would tear the camera out of the blend while the pictures blend.
- The rigs notice the end of the transition in the frame of their stage, by its `state`, not by
  the `finished` promise, which settles a microtask late and could leave a draw in between.
- In every frame, from the transition's `progress` and the easing of the flight: the start is the
  shot the rig of `from` showed when the flight began; the end is the target of `to`, resolved in
  the world of `to` and carried into the world of `from` through `M⁻¹`, with
  `M = anchorTo.matrixWorld · anchorFrom.matrixWorld⁻¹`, read anew in every frame into a matrix of
  the flight. The rig of `from` draws the blend; the rig of `to` draws it carried through `M`. A
  lens change runs as in §4.4, on both rigs alike.
- **The end follows the transition.** Finished, or cancelled with `to` in the slot: the rig of `to`
  takes the target as its own pose and holds it; the rig of `from` goes back to the state it had —
  out of sight, so that a way back to `from` finds it as it was. Cancelled with `from` in the slot:
  both go back to the state they had, as the picture jumps back to `from`.
- **A frozen layer** shows a still picture and no flight: the rig warns once, naming the stage, when
  a layer of the flight is frozen.
- The director keeps no reference to the rig. The flight reads the transition, which answers two
  internal questions through its host, the director: whether a layer is frozen, and which source a
  finished or cancelled transition kept in its slot (`StageTransitionInternals.isFrozen()` and
  `keptOf()`, not exported).

### 4.8 Allocations

`step()` — a move, a lock-on, a damped lerp, a track, a flight —, the write in the frame of the
stage, `lerp()`, `look()` while moving, `jump()` with a pose object the caller keeps, the placement
of a `CameraProjection` and its `needsPlacement()` allocate nothing: the rig writes
into shots, vectors, quaternions and matrices it owns. "Allocates nothing" holds for the library's
own code on the path — the rig's `step()`, `write()` and `compose()`, `needsPlacement()` and
`updateCamera()` of `CameraProjection`; the events a `Stage2D` emits on it, `OnStageCameraPlaced`
and `OnStageUpdateFrame`, cost what every eventize emit costs. Held by
`src/stage/hot-path-allocations.camera-rig.spec.ts`, which calls those methods directly rather than
`stage.updateFrame()`. The placement of a planar base on a resize and the start of a move may
allocate.

### 4.9 The shared easings

The easing names, the type and `easingOf()` move from `src/stage/StageTransition.ts` into
`src/utils/easing.ts`. The public type is `Easing`; `StageTransitionEasing` stays as an alias, so
nothing a user wrote breaks. The evaluation moves along if a shared function keeps the frame of a
transition and the step of the rig free of allocations — held by both allocation specs —, and
otherwise stays inline in both places, which `StageTransition` does today for that reason.

## 5. Pixel exactness

Pixel-exact only at rest — `zoom` 1, `look` 0, the distance of the projection — and on the face of
a framed box. A move away from it and back lands on the exact picture again, and so does the end of
a lens change onto an orthographic projection.

## 6. Ownership and dispose

Per `resource-lifecycle.md`:

- The rig owns its two cameras, its base camera and what it keeps for blending; `dispose()` detaches
  it from the stage, ends a move (its promise resolves), and releases a lock-on and a flight.
- On detach the stage takes back the camera that was assigned to `stage.camera` before the rig —
  if it is of the kind the projection of the stage builds now. A rig that moved the stage onto a
  projection of the other kind leaves an assigned camera of the old kind behind: the stage drops it
  with a warning, instead of letting the projection refuse it in `dispose()`. The projection then
  builds its own camera, and the stage announces it.
- The rig owns neither the stage, nor a source camera, nor a target, nor the `AnimationAction` of a
  clip, nor the anchors.
- `CameraProjection` owns nothing; its source stays the caller's.
- A flight ends with its transition, or when one of its rigs is disposed — the other rig then goes
  back to its state.
- A disposed stage disposes no rig; a rig whose stage is disposed stops writing, and `step()`
  answers `false`.

## 7. Against the reference

The issue names eight changes on the way into the library:

1. allocation-free hot path — §4.8;
2. shortest-arc angles, clamped pitch — §4.3, §3.1 (`pitchLimit`);
3. the named easings — §3.1, §4.9;
4. time from the caller's `deltaTime`, a frame step for the pacer — §3.4;
5. `Vector3`-like inputs beside tuples — §3.2;
6. lift and aspect, re-applied after a resize — §4.1, §4.3;
7. projections — the rig drives a stage with a projection, through the driver hook — §2.3, §4.1;
8. refusals through the `assert*` helpers — §3.9.

Beyond the reference: the orthographic camera, `CameraProjection`, the lens change, the lock-on,
tracks with `smooth` and `clip`, framing a box, and the flight across a transition.

## 8. Build order

Each step is a commit of its own that passes `pnpm run ci`:

1. the shared easings (§4.9) and the driver hook of `Stage2D` (§4.1, §3.8);
2. the rig on planar projections — poses, `jump`, `moveTo`, `look`, `reframe`, `cancel`, `step` —
   with its specs, allocation spec and browser test;
3. projections as targets and the lens change (§4.2, §4.4);
4. `CameraProjection`, cameras and other `Object3D`s as targets, the lock-on (§3.6, §4.5);
5. tracks, `lerp`, `smooth`, `clip` (§3.4, §4.6);
6. `framing()` (§3.7);
7. `CameraRig.across()` (§3.5, §4.7);
8. the guide sections, the CHANGELOG and the lookbook demos (§10).

## 9. Tests

### 9.1 Vitest

- `src/stage/CameraRig.spec.ts`: a pose under each projection resolves to the expected shot; a
  blend at `e` = 0, ½, 1; the easings; `look()` standing and retargeting a move; pitch clamped;
  slerp the short way; `reframe()` standing and during a move; `cancel()`, `jump()`, an overtaking
  `moveTo()`, `track()` and `dispose()` resolve the promise; `step()` answers `true` only for a
  camera that changed; a resize during a move re-frames both ends; a move to a projection assigns
  `stage.projection` on arrival and the camera does not jump; a lens change starts and ends on the
  rest of each projection, and the computed step at the swap stays below half a pixel for a scene of
  known depth; a lock-on follows a source moved between frames and answers `false` for one that
  stands; an `Object3D` target — `offset`, its foot on the plane, orientation and scale ignored, a
  move back meets an object that kept moving, `smooth` trailing and settling, `false` for an object
  that stands; tracks — keys, `until`, the easing per stretch, `clip` time mapping, `smooth`
  settling; refusals.
- `src/stage/CameraRig.across.spec.ts`: the blend at progress 0, ½, 1 on both rigs; anchors with a
  translation, a rotation and a uniform scale; uneven scale refused; finished, cancelled to the
  start, cancelled to the end, `reverse()`; a manual transition; a missing rig refused; the warning
  for a frozen layer.
- `src/stage/CameraProjection.spec.ts`: `contain` and `cover` for a container wider and narrower
  than the source; an orthographic source; `needsPlacement()`; the source is never written (its
  pose, lens and `view` compared before and after); `getScaleFactor()`.
- `src/stage/framing.spec.ts`: plane, up and view for each side; every corner of the box inside the
  frustum; `margin`.
- `src/stage/Stage2D.spec.ts`: with a rig attached, `stage.camera` is the rig's, placements go to
  the rig, an assigned camera counts again after detach, `OnStageAfterCameraChanged` on attach, swap
  and detach; `OnStageCameraPlaced` after every placement, with and without a rig, with the base
  camera under a rig, a listener's change to it composed under the pose, and every listener heard
  behind one that throws.
- the easing helper: names, refusals, the alias.
- three's `AnimationMixer`: a paused, enabled action applies its time at `update(0)` (§4.6).

### 9.2 Allocations

`src/stage/hot-path-allocations.camera-rig.spec.ts`: `step()` during a move, during a lock-on onto
a moving source, while following an `Object3D` with `smooth`, with a damped `lerp()`, on a track
with a clip, during a flight; the placement of a `CameraProjection` with a moving source, with a
listener of `OnStageCameraPlaced`.

### 9.3 Browser (`packages/twopoint5d-testing`, WebGPU and WebGL 2)

- a lifted camera puts a marker at the expected pixel row;
- a move from a parallax to an orthographic projection ends on the picture of a stage that shows
  the orthographic projection alone; the frame of the swap differs from the frame before by less
  than a pixel at the markers;
- a `CameraProjection` with `contain` and `cover` puts markers on the corners of the authored frame
  at the expected pixels, for a container wider and narrower than the frame;
- a flight across a crossfade: at progress 0 the picture of `from`, at 1 the picture of `to`, and
  halfway markers of both scenes where the shared viewpoint puts them.

## 10. Docs, CHANGELOG, lookbook

- `stages.md`: `CameraProjection` and `framing()` in "Projections"; a new section "Moving the
  camera" after "A camera of your own" — viewpoints, a 3D scene through the cameras of a `.glb`, a
  camera animated in Blender, a page that scrolls through a scene, a flight across a transition —
  and its rows in the events, ownership and pitfalls tables; `OnStageCameraPlaced` and
  `OnStageUpdateFrame` as the hooks before and after the rig, with a tilted rest and a camera shake
  as recipes. "From the pointer to the plane" notes that it holds at rest only.
- `drawing-on-demand.md`: `rig.step()` as a frame step; the placement of a `CameraProjection` as a
  source of invalidation for phase B.
- `docs/architecture.md`: the new parts of the module `stage`.
- `CHANGELOG.md`, `## [Unreleased]`: "Added" for the rig, `CameraProjection`, `framing()`,
  `Easing`, `IProjection#needsPlacement`, `OnStageCameraPlaced`; "Changed" for the contract of
  `IProjection`, whose `createCamera()` and `updateCamera()` throw without a plane only where the
  projection needs one.
- Lookbook demos, with art made reproducibly under `apps/lookbook/assets-src/`:
  - *camera rig: two rooms* — a `.glb` of two rooms joined by a door, its cameras as viewpoints,
    click to travel, drag to look, a toggle for `lift`, and a scroll that flies a camera animated in
    Blender through the door;
  - *camera rig: into the map* — an orthographic map stage and a perspective room stage, a
    crossfade of the director with a flight across it, anchored on a marker of the map.

## 11. Left out

- collision of the camera with the scenery, orbit and fly controls — input stays the caller's; the
  rig takes `look()` and targets;
- curved paths between keys of a track — a curve comes from an animation of the asset;
- a flight across more than two stages, or across a mask;
- a camera shake as a part of the rig — it is a listener of `OnStageUpdateFrame` (§4.1.1), and the
  guide shows it as a recipe;
- the integration into a `StageDirector` that draws on demand — phase B of `drawing-on-demand.md`
  (#59) builds on `step()` and `needsPlacement()`.
