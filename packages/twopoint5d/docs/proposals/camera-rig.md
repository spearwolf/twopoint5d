# Proposal: camera moves on a stage — `CameraRig` and `CameraProjection`

Status: **implemented** — see [`docs/stages.md`](../stages.md), "Framing a box" and "Looking
through a camera: `CameraProjection`" in "Projections", "Moving the camera" with its sections
(viewpoints, looking around, the lift, switching projections, perspective into orthographic, the
cameras of a `.glb`, a camera animated in Blender, a page that scrolls through a scene, a flight
across a transition, a camera that follows with a rig, before and after the rig, drawing on demand,
the reference), `OnStageCameraPlaced` in "Events", and the rows in "Who disposes what", "Pitfalls"
and the cheat sheet; [`docs/display.md`](../display.md), "A camera that moves"; the Vitest specs
listed in §9, among them `src/stage/hot-path-allocations.camera-rig.spec.ts`; the browser test
`packages/twopoint5d-testing/test/stage-camera-rig.test.js`; and the lookbook demos *camera rig:
two rooms* and *camera rig: into the map*. From
[issue #54](https://github.com/spearwolf/twopoint5d/issues/54), widened in the design discussion to
the cameras of glTF assets, 3D scenes on a stage and camera flights across a transition of a
`StageDirector`.

Where the build left the first draft:

- the example of a flight starts it with `director.replace()` (§3.5) — a `show()` comes from
  nothing, and a flight needs a stage on both sides;
- a `look` is refused under every orthographic camera, a `CameraProjection` with an orthographic
  source among them, during a move into an orthographic projection, and on a track while it shows
  an orthographic shot (§3.2, §4.4, §4.6) — such a camera has nothing to turn the look into; a look
  the rig kept from before an orthographic projection was assigned to the stage, and the look of
  the rig over the orthographic keys of a track, are left off the camera;
- `CameraProjection` serves one stage per instance (§3.6): it remembers its last placement to
  answer `needsPlacement()`, and a second stage would find the first one's; a `Stage2D` builds its
  own camera anew where the source changes its kind (§3.6), since the projection refuses a
  camera of the old kind;
- `framing()` grows the face by `margin` on each edge, `1 + 2·margin` in all, as a CSS margin does
  (§3.7); its projection plane is a private `FacePlane` whose origin is the middle of the face,
  since `ProjectionPlane#getOrigin()` answers the point of the plane nearest to the world origin,
  which the camera would aim at; a face without an area is refused (§3.9);
- the driver hook is three calls, `placeBase()`, `compose()` and `write()`, not the sketched
  `place()` (§3.8, §4.1): `OnStageCameraPlaced` has to go out between the placement of the base and
  the composition over it; the hook sits in `Stage2DInternals`, and attaching places the base at
  once, so the rig draws with a composed camera from its first frame;
- the base camera follows the kind of the projection, known for the three projections of the
  library and found out by one `createCamera()` for a projection of a class of its own (§4.1);
- the collected errors of `Stage2D` name `OnStageCameraPlaced` and "the CameraRig of the stage"
  (§4.1.1) — a user knows no camera driver —, and a `compose()` that throws is collected as a
  listener is, after the state stands;
- "allocates nothing" holds for the library's own code on the path (§4.1.1, §4.8): every emit of
  eventize costs bytes, as `OnStageUpdateFrame` did before the rig, so the allocation spec calls the
  methods directly, without a listener of `OnStageCameraPlaced` (§9.2); three's
  `AnimationMixer#update()` allocates a number per keyframe track at a time that is not whole, and
  the spec stands in for it (§4.6, §4.8);
- a projection of a target that answers `needsPlacement()` is placed anew in every resolve rather
  than asked first (§4.2) — the ask cost 16 bytes once the rig had followed cameras of both kinds,
  the placement none;
- the default `depth` reaches the cap of `1000 · h` on a container whose larger side passes about
  1000 units (§4.4), and swaps there with a step of about one pixel on a container 1920 wide;
- `precompile()` calls queue per renderer (§4.4), since two compiles of three.js on one renderer at
  once fail; `StageDirector#precompile()` does not join that queue;
- the keys of a track resolve as the draft left open (§4.6): an `Object3D` key stands at the
  distance and zoom of the rest, with no offset; `track()` sets the look to 0, and the look of a key
  and the rig's add; a projection key is shown, never assigned; a stretch between keys of the two
  kinds is refused unless both have a projection plane, since a key names no focus;
- the first `lerp()` after `track()` shows its progress at once, and the clips of a track are
  scrubbed in the frame of the stage as well (§3.4, §4.6) — a smoothed first `lerp()` glided in from
  0, through every key before it;
- the transition answers the flight two internal questions through its host, the director —
  whether a layer is frozen, which source it kept (§4.7) —; the draft had the director unchanged;
- a flight ends at the first call to either rig after its transition is over, not only in the
  next frame (§4.7), so a listener of `OnStageTransitionEnd` can chain the next move; `busy` alone
  leaves the end to the next call, since the end may throw;
- the look of a flight turns a perspective shot alone (§4.7): an orthographic side keeps the look of
  its target;
- the build took eleven steps instead of eight, with the guide growing in each, and split the rig
  into `cameraPose`, `cameraShot`, `cameraRest`, `cameraTarget`, `cameraTrack`, `lensChange` and
  `CameraFlight` beside `CameraRig.ts` (§8), which would have passed 2000 lines otherwise.

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
- **The stage draws**, as it does without a rig, its scene through `stage.camera`.

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

The rig tells them apart in the order camera, other `Object3D`, projection — anything with an
`updateViewRect()` function —, pose (`kindOfTarget()` in `src/stage/cameraTarget.ts`), so an
object that happens to carry a `zoom` is still an object.

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
  /** The easing of moveTo() where the call names none, and of reframe(). Default 'ease-in-out'. */
  easing?: Easing;
}

class CameraRig {
  constructor(stage: Stage2D, options?: CameraRigOptions);
  readonly stage: Stage2D;
  /** The camera the stage draws with while the rig is attached; a perspective or an orthographic one. */
  readonly camera: PerspectiveCamera | OrthographicCamera;
  /** `true` while a move, a trailing, a lock-on or a track that moved the camera, a damped lerp or a flight is under way. */
  readonly busy: boolean;
  readonly isDisposed: boolean;
  jump(target: CameraTarget): void;
  moveTo(target: CameraTarget, seconds: number, options?: CameraMoveOptions): Promise<void>;
  look(look: {yaw: number; pitch: number}): void;
  reframe(framing: {lift?: number}, seconds?: number): void;
  cancel(): void;
  track(keys: readonly CameraTrackKey[]): void;
  track(from: CameraTarget, to: CameraTarget): void;
  lerp(t: number, options?: CameraLerpOptions): void;
  step(deltaSeconds: number): Motion;
  /** Compiles the scene and the postProcess of the stage with the camera of the other kind (§4.4). */
  precompile(renderer: WebGPURenderer): Promise<void>;
  dispose(): void;
  static across(transition: StageTransition, options?: CameraFlightOptions): CameraFlight;
}

interface CameraLerpOptions {
  /** A time constant in seconds; the first lerp() after track() ignores it (§4.6). Default 0. */
  smooth?: number;
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
  What the placement at the attach throws — the projection, a listener — comes out of the
  constructor after the rig has let go of the stage again, so a constructor that throws leaves the
  stage as it found it. `dispose()` detaches it; the stage goes back to the camera it had and its
  projection places it.
- A stage takes one rig at a time. The exported types are `CameraRig`, `CameraPose`,
  `CameraTarget`, `CameraRigOptions`, `CameraMoveOptions`, `CameraTrackKey`, `CameraLerpOptions`,
  `CameraFlight` and `CameraFlightOptions`; the shot, the rest and the driver hook stay internal.
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
  normal carries the distance. Under an orthographic projection — an `OrthographicProjection`, or a
  `CameraProjection` with an orthographic source — the pose takes `position` x and y and `zoom`; the
  distance is checked and then ignored, since it changes nothing an orthographic camera shows, so a
  list of poses serves both kinds of projection. A `look` other than zero is refused there ("an
  orthographic projection takes no look other than 0"). Under a perspective `CameraProjection`
  `position` is a world position and `look` turns from the orientation of the source camera.
- `readPose()` in `src/stage/cameraPose.ts` reads a pose into fields of the rig and checks it inline,
  not through the `assert*` helpers, which would box the fractions on the hot path; it writes
  nothing before the whole pose has passed, so a refused pose leaves the rig as it was.
- A viewpoint authored with an absolute field of view converts once:
  `zoom = tan(fitFov / 2) / tan(fov / 2)`.
- Tuples stay the form for JSON content.

### 3.3 Moves and framing

- **`jump(target)`** puts the camera on the target at once; it overtakes a running move. A camera
  or an `Object3D` it jumps to is locked on to at once (§4.5).
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
  own clock, eased by the `easing` of the rig, at once without `seconds`; a running move keeps
  running. A `lift` left out is 0.
- **`cancel()`** ends a move, or a lock-on, where it stands, and holds that shot with its lens as a
  zoom on the rest. A track stays.

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

- **`track(keys)`** sets a track; `track(a, b)` is the track of two keys at 0 and 1. It ends a
  running move and a lock-on and starts at progress 0 at once, without a blend from the shot before.
  A track stays until the next `track()`, `jump()`, `moveTo()` or `dispose()`; `cancel()` leaves it.
- **`lerp(t, {smooth})`** sets the progress along the track, clamped to `[0, 1]`. The first `lerp()`
  after `track()` shows its progress at once, whatever its `smooth` — the next frame of the stage
  shows it, before any `step()` (§4.6). After it, without `smooth` the next `step()` shows the
  progress; with `smooth` — a time constant in seconds — the shown progress approaches the asked
  one, critically damped, so the ticks of a mouse wheel become a glide.
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
  skips — is not written to, and the next draw writes the state the clocks have reached. The write
  scrubs the clips of a track too, where their time changed, so a progress set before any step
  shows with its clip.

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
  /** Resolves once the flight is over — with its transition, or when one of its rigs is disposed; never rejects. */
  readonly finished: Promise<void>;
}
```

```ts
const transition = director.replace(stageA, stageB, {effect: crossfade(), duration: 1.2});
CameraRig.across(transition, {to: camB, anchors: [cityMarkerOnMap, cityOrigin]});
```

- The stages are those of the transition; each needs a rig of its own, which keeps being stepped as
  before. A transition from or to nothing — a `show()` comes from nothing —, a stage without a rig,
  a rig that takes part in a flight already and a transition that is over are refused.
- During the transition there is one blended shot, in the world of `from`. The camera of `from`
  shows it; the camera of `to` shows it carried through the anchors into the world of `to`. Each
  stage draws its own scene from the same felt viewpoint, while the director blends the pictures:
  at progress 0 `from` shows its own picture unchanged, at 1 `to` stands exactly on its target.
- The progress is the transition's, read in every frame. A transition driven by hand
  (`{manual: true}`, `transition.progress = t`) flies the camera along with it — a scroll can drive
  picture and camera with one number. `reverse()` flies it back.
- Anchors with a scale carry it: a marker on a map in the world of a city scales position, near,
  far, focus and the height of an orthographic view. Anchors scaled unevenly — the column lengths
  of `M` (§4.7) apart by more than `1e-6` of the largest —, mirrored against each other or of a
  zero scale are refused.
- `focus` is a distance in the world of `from`; the scale of the anchors carries it into `to`.

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

type CameraProjectionFit = 'contain' | 'cover';

class CameraProjection implements IProjection {
  constructor(source: PerspectiveCamera | OrthographicCamera, specs?: CameraProjectionSpecs);
  /** A getter and a setter; the setter refuses what the constructor refuses. */
  source: PerspectiveCamera | OrthographicCamera;
  viewSpecs: CameraProjectionSpecs;
}
```

- A third projection beside the two that exist, in `src/stage/CameraProjection.ts`. `createCamera()`
  builds a camera of the kind of the source; `updateCamera()` copies the world pose — position and
  orientation of `matrixWorld`, its scale left out — and the lens of the source into it and fits the
  authored frame into the container: under `'contain'` the narrower side of the container keeps the
  authored extent and the other side widens, under `'cover'` the wider side keeps it. The fit is
  `fitLens()`, internal, on a lens that is `tan(fov / 2)` or the height of an orthographic view,
  both linear in the visible extent; where its factor is 1 the lens stays exact. An orthographic
  frustum keeps the middle of the source's. The view offset and the film offset of the source are
  not carried over, and the camera's own `view` is left alone.
- `viewSpecs` is the caller's object, read in the constructor and in every `updateViewRect()` with
  an area. A `near` or `far` no camera of the kind can be built from counts as not given, as for the
  planar projections.
- It has no projection plane. The frame of a rig on such a stage is the world, and its rest is the
  shot of the source.
- An animated source moves the stage camera without a rig as well: the stage places the camera in
  every frame in which the source moved (§4.1). `needsPlacement()` decides from the source alone —
  its identity, its world matrix (`Matrix4#equals()`) and its lens values, kept in a
  `Float64Array` —, so its argument does not matter. Under a rig the stage places in its
  `updateFrame()`, after a `rig.step()` of the same frame, so the step answers `true` for the moved
  source in the frame after it moved.
- **One projection serves one stage.** It keeps what it placed last to answer `needsPlacement()`;
  a second stage would find the first one's placement and miss the move. Two stages that look
  through one camera take a projection each; the guide names it in its pitfalls.
- **A source of the other kind** — `projection.source = otherCamera` — makes the projection build
  the other kind. A `Stage2D` without a rig builds its own camera anew when the projection no
  longer builds the kind of it (`#outgrown()`), and announces it; a camera assigned to
  `stage.camera` is refused by the projection, as the planar projections refuse one. A rig swaps
  its camera (§4.1).
- `getViewRect()` answers the container — one view unit per container unit, offset 0 — since there
  is no plane whose units it could count, as a new object per call. `getScaleFactor(d)` answers
  `focus / d` with `focus` the `focus` of a perspective source (three's default `10`; glTF carries
  none) and `1` for an orthographic one.
- The source is read with `updateWorldMatrix(true, false)` and never written.

### 3.7 Framing a box

```ts
type FramingSide = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
type FramingOptions<Specs> = {side: FramingSide; margin?: number} & Partial<Specs>;

ParallaxProjection.framing(box: Box3, options: FramingOptions<ParallaxProjectionSpecs>): ParallaxProjection;
OrthographicProjection.framing(box: Box3, options: FramingOptions<OrthographicProjectionSpecs>): OrthographicProjection;
```

- `side` names where the camera looks from: `'front'` from `+z` looking along `-z`, `'right'` from
  `+x`, `'top'` from `+y` looking down; up is `+y` for the four sides around, `-z` for `'top'` and
  `+z` for `'bottom'`. The face is x by y for front and back, z by y for right and left, x by z for
  top and bottom.
- The projection plane lies in the face of the box toward the camera, with its origin in the middle
  of that face, so everything behind it appears smaller and the whole box lies in the view. The
  plane is a `FacePlane`, a private subclass of `ProjectionPlane` in `src/stage/framing.ts` that
  answers that middle from `getOrigin()` — the base class answers the point of the plane nearest to
  the world origin, at which the projections would aim the camera — and keeps it through `clone()`
  and `equals()`.
- The view is the face, grown by `margin` on each edge — a share of its width and height, default
  `0`, so `0.1` shows the face 1.2 times as wide and as high —, fitted `'contain'`. The other specs
  pass through, `pixelSnap` among them; a `fit`, `width` or `height` is replaced.
- `framingSetup()` holds the computation both share.
- The result is an ordinary projection: pixel-exact on the face, poses in its frame.

### 3.8 Changes to `Stage2D` and `IProjection`

- **An internal camera-driver hook on `Stage2D`**, the pattern of `StageTransitionInternals`: not
  exported, used by the rig alone (§4.1). Nothing changes for a stage without a rig.

  ```ts
  /** src/stage/StageCameraDriver.ts — what the rig is to the stage. @internal */
  interface StageCameraDriver {
    /** The camera the stage draws with: stage.camera answers it. */
    readonly camera: Camera;
    /** Lets the projection place a base camera of the driver's own, and answers it. */
    placeBase(projection: IProjection): Camera;
    /** Composes the drawn camera over the base, after the listeners of OnStageCameraPlaced. */
    compose(): void;
    /** Writes the drawn camera for the frame, before OnStageUpdateFrame. */
    write(): void;
  }

  /** src/stage/Stage2D.ts, filled in a static block of the class. @internal */
  const Stage2DInternals: {
    attachDriver(stage: Stage2D, driver: StageCameraDriver): void;
    detachDriver(stage: Stage2D): void;
    /** The driver swapped its camera: the stage takes and announces the new one. */
    announceCamera(stage: Stage2D): void;
    driverOf(stage: Stage2D): StageCameraDriver | undefined;
    /** The scene passes the stage has built, for precompile() (§4.4). */
    scenePassesOf(stage: Stage2D): PassNode[];
  };
  ```

  `CameraRig` meets the interface structurally — an `implements` of the stripped interface would
  leave a type in its declaration a consumer cannot name — and `src/stage/public-api.ts` exports
  `Stage2D` by name, so `Stage2DInternals` stays out. `CameraRig.across()` finds the rig of a stage
  through `driverOf()`.
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

  In `src/events.ts`, with `IStageCameraPlaced`. The stage hands every emit the same props object,
  rewritten before it.
- **`IProjection#projectionPlane`** was typed optional already; what changed is the contract in
  the doc comments of `IProjection`: `createCamera()` and `updateCamera()` throw without a plane
  where the projection needs one — the two planar projections —, and `CameraProjection` places its
  camera without one. The CHANGELOG names it under "Changed".
- **`IProjection#needsPlacement?(camera): boolean`**, optional: `Stage2D#updateFrame()` asks it
  where the stage has a view, and places the camera when it answers `true`, besides `needsUpdate`;
  the argument is `stage.camera`, the rig's camera under a rig. `CameraProjection` answers `true`
  when its source, the world matrix or the lens of its source changed since its last placement,
  compared in place. This placement takes a path of its own, `#placeWithoutView()`, not
  `#updateProjection()`: the container is unchanged, so it skips `updateViewRect()` and
  `getViewRect()` — which answers a new object on every call — and calls `updateCamera()` and emits
  `OnStageCameraPlaced`, or, under a rig, `placeBase()`, the event and `compose()`. A listener or a
  `compose()` that throws there ends the frame, as a throwing listener of a pending `needsUpdate`
  does.

### 3.9 Refusals

Through the `assert*` helpers and `describeValue()`, subjects as `AGENTS.md` names them — on the
hot path, a pose and the arguments of `lerp()`, the checks are inline with the same messages, since
a fraction handed to a helper V8 does not inline is boxed:

- `new CameraRig()`: a stage that is not a `Stage2D`, has no projection, already has a rig, or is
  disposed; a `pitchLimit` outside `(0, π/2]`; an `easing` that is not one.
- `jump()`, `moveTo()`, track keys: a pose or an `offset` with a non-finite number; a `zoom` that
  is not a finite number above 0; a `look` under an orthographic projection, and during a move into
  one; `seconds` or a `smooth` that is not a finite number of 0 or more; a camera that is neither a
  perspective nor an orthographic one; a lens change without a focus where the stage, the target
  projection or the target camera has no plane (§4.4) — a `jump()` needs none —; a `focus` or a
  `depth` that is not a finite number above 0.
- `jump()`, `moveTo()`, `track()`, `lerp()` while the rig takes part in a flight (§4.7).
- `track()`: what is not a non-empty array of objects, keys out of order — a key that starts before
  the one before it ends —, an `at` or `until` outside `[0, 1]`, `until < at`, a `clip` that is not
  an `AnimationAction` or whose key has no camera as its shot, an `ease` that is not an easing, a
  stretch between keys of the two kinds where a key has no plane (§4.6). A refusal names the key:
  `keys[1].shot.zoom must be …`.
- `lerp()`: a rig without a track; a `t` or `smooth` that is not a finite number, a negative
  `smooth`, `options` that are not an object.
- `CameraRig.across()`: §3.5, and `options` that are not an object, an easing that is not one, a
  `focus` that is not a finite number above 0, a lens change without a focus where a side has no
  plane.
- `CameraProjection`: a source that is neither a perspective nor an orthographic camera; an aspect
  that is not a finite number above 0; a `fit` other than `'contain'` and `'cover'`; a camera of the
  other kind in `updateCamera()`.
- `framing()`: a `box` that is not a `Box3`, an empty box, a face without an area toward the side,
  an unknown side, a negative or non-finite margin.
- Any call on a disposed rig throws, except `dispose()`; `precompile()` rejects.

## 4. How it works

### 4.1 Who places the camera: the driver hook

Without a rig a projection places `stage.camera` — its own camera or one assigned to
`stage.camera` — on every resize, `needsUpdate` and new projection. A rig that wrote the same
camera after it would be a second writer: the projection would overwrite the pose, the rig would
write it again, and in between the camera would carry the rest for a frame. Worse, a lens change
needs a camera of the other kind, and the planar projections refuse a camera of a kind they do not
build with a `TypeError`.

So while a rig is attached, the stage **hands the placement to the rig** instead of the
projection:

- `stage.camera` answers the camera of the rig, before an assigned camera and the projection's.
  An assignment to `stage.camera` while the rig is attached is kept, and counts again once the rig
  is gone.
- Wherever the stage would call `projection.updateCamera(camera)`, it calls the projection's
  `updateViewRect()` as before and then the rig's `placeBase(projection)`: the rig lets the
  projection place a **base camera** of its own — of the kind the projection builds, never drawn
  with — and answers it. The stage emits `OnStageCameraPlaced` with the base (§4.1.1) and then calls
  `compose()`, in which the rig reads the frame, the rest, the lens and the snap offset from the
  base and composes its shot into the camera it draws with. A resize, a turn of the phone, a new
  fit and a new projection re-frame the pose by themselves; point 6 of issue #54 ("who calls
  `reframe()` after `OnStageResize`?") does not arise. The order in `#updateProjection()` is: a
  created camera announced, `placeBase()`, `OnStageCameraPlaced`, `compose()`, `OnStageResize`.
- The base follows the kind of the projection (`#kindOfProjection()`): perspective for a
  `ParallaxProjection`, orthographic for an `OrthographicProjection`, the kind of the source for a
  `CameraProjection`, asked anew each time since the source may change. For a projection of a class
  of its own the rig calls `createCamera()` once, keeps the kind in a `WeakMap` and the camera as
  the next base; a projection that builds the other kind later corrects the kept kind where the rig
  builds a new base. A base of the wrong kind is never handed to `updateCamera()`, which the planar
  projections would refuse.
- When the rig swaps its camera for one of the other kind (§4.4), and when it attaches and
  detaches, the stage announces the change through `OnStageAfterCameraChanged`, as for any new
  camera; a pass node takes the new camera from its next draw. The stage keeps the driver's camera
  as it last announced it, so between a swap and `announceCamera()` the pass node, the post-process
  and `stage.camera` agree.
- Attaching places the base at once where the stage has a view, so the rig draws with a composed
  camera from its first frame; detaching places the camera the stage takes back.
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
  reaches the caller of the placement afterwards, as for `OnStageResize`. `compose()` runs behind a
  listener that threw, and a `compose()` that throws is collected the same way, after the state of
  the placement stands: the container of a `resize()` is not rolled back for it. Where more than one
  threw, the `AggregateError` names the events and the rig as a user knows them — `Stage2D#resize():
  more than one of the listeners of OnStageAfterCameraChanged, OnStageCameraPlaced and OnStageResize
  and the CameraRig of the stage threw` —, not an internal driver.
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

**Detach.** On detach the stage takes back the camera assigned to `stage.camera` if its projection
builds that kind (`#buildsKindOf()`, which knows the three projections of the library and accepts
any camera under one of another class), drops it with one warning otherwise, and places what it
takes back (§6).

### 4.2 Resolving a shot

- **A pose:** the base gives the frame (origin and axes of the plane, or the world) and the rest.
  The position goes through the frame, `look` turns the rest orientation — yaw about the up axis of
  the frame, then pitch about the right axis of the camera —, `zoom` divides `tan(fov / 2)` or the
  height of the view.
- **A camera:** the rig builds a `CameraProjection` of its own for it, with the default fit, so its
  pose and its lens resolve exactly as a stage under that projection would place them (§3.6); it
  is the target projection of the move, but the arrival assigns nothing — the rig locks on (§4.5).
  Each camera target gets a projection of its own, so an overtaking move cannot re-place the old
  rest with the new source. The look of the current pose lies on top, so a drag-look works on a
  followed camera as well.
- **A projection:** the rig lets it compute the view for the container of the stage and place a
  base camera of its kind into a rest of its own — at the start of the move, again where the
  container changed, and in every resolve where the projection has `needsPlacement()`, so a
  `CameraProjection` whose source moves is met where it is now (`#followTarget()`). The rig places
  such a projection rather than asking `needsPlacement()` first: once the rig had followed cameras
  of both kinds, the ask cost 16 bytes per call where it answered `false`, the placement none —
  measured by the allocation spec under V8's inlining of the moment. A projection with an
  expensive `updateCamera()` pays it in every resolve. A target that is the projection of the stage
  is the stage's to place. On arrival the rig assigns `stage.projection`; the projection then is the
  one whose rest the camera stands on, and nothing jumps. A move started without a view places its
  target when the view arrives, and ends there as a jump.
- A target that is refused — a projection that throws in its placement, a lens change without a
  focus — refuses the move before the rig changed anything: the target rest is placed into a fresh
  rest first.

### 4.3 Blending

The rig blends in world space, from the shot the camera showed when the move started to the
target as it resolves in this frame, at the eased progress `e`, which the rig clamps to `[0, 1]` on
every blend — a move, a stretch of a track, a flight, the lift —, so that an easing that overshoots
carries no blend past its ends:

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

- A **focus plane** keeps its size on the screen through the move. Its distance, per end, is the
  distance from the camera to the projection plane of its frame along the normal where the frame
  has one, otherwise the `focus` of the move; without either a lens change is refused. A camera as
  the target has no plane.
- The visible height `h` at the focus plane blends linearly from one end to the other, and so does
  the focus point `P` — where the camera looks at the focus plane; the orientation slerps. The
  strength of the perspective `s = tan(fov / 2)` blends in log space toward the orthographic end,
  which counts as `s_swap`, while the camera backs off to `d = h / (2s)` along its axis from `P`,
  so the parallax fades; near and far keep their distances from the focus plane, near floored at
  `d · 1e-6`.
- At the orthographic end the rig swaps in its orthographic camera. It swaps where the parallax
  across the **depth** of the scene — `depth` units in front of and behind the focus plane — stays
  below half a pixel: at `d_swap = depth · (M + 2)`, with `M` the larger side of the container in
  its units, which leaves a step of `(M / 2) · depth / (d_swap − depth)` below ½. A perspective end
  already flatter than that needs no backing off. The depth is an option of the move, `{depth}`,
  and defaults to the visible height `h`: a bounding box of the scene says nothing reliable, since
  sprites are vertex objects placed in the shader.
- The distance is capped at `1000 · h`, since at a larger distance the precision of float32 in the
  view matrix shows. A scene so deep that the cap comes first swaps with a step above half a pixel;
  the guide names it. With the default depth `h` the cap comes first on a container whose larger
  side passes about 1000 units — the step there is about `M / 1998` pixels, 0.96 on a container
  1920 wide.
- Every frame between the ends is a perspective shot — between the ends of the move, not of its
  eased progress: where an easing reaches 0 or 1 on the way, the blend shows the perspective shot at
  the swap (`LensChange#underWay`), so the kind swaps once —; the ends are exact copies of the two
  shots.
  A move into the orthographic lens swaps in the frame of its arrival; the way back swaps at the
  first frame past its start and backs in from `d_swap`. The math is
  `blendLensChangeAtProgress()` in `src/stage/lensChange.ts`; `lensChangeStep()` gives the step for
  specs.
- The rig runs a lens change wherever the two ends of a blend differ in kind, so a move that
  overtakes a lens change halfway starts from the perspective shot of the dolly. It draws with the
  camera of the kind of the shot, not of the base, so a perspective camera stands over an
  orthographic projection while the change runs; the driver hook makes that safe, since the
  projection places only the base. A `look()` during a move into an orthographic projection is
  refused, as under one.

The rig holds one camera of each kind. On a single stage the move to an `IProjection` of the other
kind assigns `stage.projection` at the end (§4.2), also on the way from orthographic to
perspective.

**Shaders on a swap.** A pass node does not depend on its camera, but a material or a
`postProcess` may compile what differs between the kinds — a depth linearized for one kind. So
the first frame after a swap may compile. `rig.precompile(renderer)` compiles the scene of the
stage and its `postProcess` with the camera of the other kind — the rig's part of
`StageDirector#precompile()`, which compiles with the camera the stage has; the kind the stage
draws with is left to the first draw or to the director. The rig places that camera over the view
it shows now, since three culls by the frustum while it compiles, builds the `postProcess` as its
first draw would, compiles the scene for the current target of the renderer, and then each scene
pass the stage has built (`Stage2DInternals.scenePassesOf()`, with a `pass` getter on the run of
the post-process), its camera set to the other one for the synchronous part of the compile and
given back before anything else runs. A `postProcess` that reads depth handles both kinds itself,
and the guide names that in its pitfalls. Calls on one renderer queue behind each other in a
module-level `WeakMap` from renderer to the settling of the last call, since two `compileAsync()`
of three.js on one renderer trip over each other; a rejection stays its caller's and the next call
still runs. `StageDirector#precompile()` does not join that queue: the guide says to await it before
or after the compiles of the rigs. A rig disposed while its call waits resolves quietly.

### 4.5 Locking on to a camera

When a move to a camera arrives, the rig **locks on**: the target keeps being resolved in every
frame, so a camera an `AnimationMixer` moves is followed. A `jump()` to a camera locks on at once.
A new `moveTo()`, a `jump()`, `cancel()`, a `track()` or `dispose()` releases it (`#release()`),
and the rig keeps no reference to the target; `cancel()` holds the shot the lock-on showed. A lens
the animation changes (a field of view through `KHR_animation_pointer`, where the loader delivers
it) is followed alike, since the rig reads the lens in every frame.

`busy` answers `true` for a lock-on in the frames where the last `step()` moved the camera — a
camera or an object that moved, a `look()` or a resize as well —, so a lock-on that stands is not
busy.

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
- `look`, `zoom` and the lift stay the rig's; a drag-look works while following. An object brings
  no look of its own, so a drag-look holds across `moveTo(chest)` and back to the player, where a
  pose or a camera would reset it (§3.3). Under a `cancel()` the zoom and distance are those of the
  shot it holds, and after a track or a camera — whose pose of the rig is the empty one — those of
  the shot it shows, its look dropped for the rest's turned by `look()` (`readObjectPose()` in
  `src/stage/cameraTarget.ts`).
- The move blends to the position the object has in each frame, so a move back to a player who keeps
  walking meets the player, not the place the player stood at when the move began.
- Once locked on, `smooth` lets the camera trail the object, critically damped; `0` sticks to it.
  The spring is solved exactly for a goal that stands through the step (`trailObject()`, with
  `ω = 1 / smooth`), starts on the object at the first step after the lock-on and settles — snapped,
  its speed 0 — where the gap falls below `1e-4`; the time reaches it through a field, not an
  argument. `step()` answers `true` in the frames the camera moved, so a player who stands still
  costs no draw once the trailing has settled.

### 4.6 Tracks

- A track resolves to one shot per progress: inside a key (`at` to `until`) the key's shot, between
  two keys a blend of their shots at the eased share of the stretch (the `ease` of the key it
  arrives at), before the first key and after the last the shots of those. Equal places make a
  stretch of no length — a cut. All shots are resolved anew in every frame. The reading, the
  spring, the search for the key and the scrub live in `src/stage/cameraTrack.ts`; the rig resolves
  the keys (`#resolveKey()`, `#placeKey()`) since that needs its rests.
- **The keys resolve** as targets do, with what a track lacks filled in:
  - a pose on the rest of the stage;
  - a camera through a `CameraProjection` of its own, with the default fit;
  - a projection on a rest of its own, placed for the container — anew where it changed, and in
    every frame where it has `needsPlacement()` —; it is shown, never assigned to the stage, and a
    shot of one key alone is written over that key's base, so a projection key is pixel-exact on
    its rest, its frustum and `pixelSnap` included;
  - an `Object3D` at its foot on the plane, at the distance and the zoom of the rest, with no offset
    — a key has no `offset`, and a track has no current pose to keep them from.
- **The look.** `track()` sets the look of the rig to 0, as a new target brings its own; each key
  resolves with its own look plus the rig's, which add exactly — the yaws share one axis and the
  pitches one local axis —, the pitch clamped. A `look()` lies on top of the whole track.
- **A stretch between keys of the two kinds** runs the lens change of §4.4, with the default
  `depth`. A key names no `focus`, so such a stretch is refused unless both its keys have a
  projection plane; a camera key never has one.
- **`clip`**: inside its key, the progress maps linearly onto `0 … clip.getClip().duration` — its
  start before the key, its end after it —; the rig sets `clip.time` and lets the mixer of the
  action apply it (`clip.getMixer().update(0)`) where the time changed, so the camera stands where
  the clip puts it at that time. Other actions of the same mixer are applied with it, so one clip
  can scrub the whole scene. The rig neither plays nor stops the action; the caller keeps it
  playing and paused (`action.play().paused = true` — an action never played applies nothing).
  `src/stage/animationMixer.spec.ts` pins that against three's mixer: a paused, enabled action
  applies the time it was given at `update(0)`, forward and back, its end at `time === duration`
  without wrapping, and the other actions of the mixer with it. The scrub runs in `step()` and in
  the write in the frame of the stage, not during a flight. three's `update()` allocates a number
  per keyframe track at a time that is not whole; the rig itself allocates nothing (§4.8).
- **`smooth`**: the shown progress `p` follows the asked progress `q` as a critically damped spring
  with the time constant `smooth`; it settles when `|q - p|` falls below `1e-4`, and `busy` answers
  `false` from there. The spring is the exact solution `trailObject()` uses. A progress asked anew
  on the way keeps the speed the glide has. The first `lerp()` after `track()` jumps — it sets `p`
  to its `q` at once, at rest, whatever its `smooth`, in `lerp()` itself and not in the next step,
  since the stage may write its frame first —, so a track does not glide in from 0, and `smooth`
  glides from there with every later `lerp()`, a second one before any step included. A track
  without any `lerp()` shows 0. `step()` tells a moved progress from a moved key by the progress of
  its last step (`track.stepped`), so the step after the jump keeps `busy` from staying `true` a
  frame too long.
- `lerp()` sits close to V8's budget for inlining: its refusals are built in `refuseLerp()`, which
  only a refusal calls, and its checks and its clamp stay inline, since a `lerp()` V8 does not
  inline boxes the progress its caller hands it. The allocation spec catches a regression.
- `busy` on a track is `true` while `p` has yet to reach `q`, and where the last step moved the
  camera without the progress moving — a key whose camera or object moved —, as for a lock-on.

### 4.7 A flight across stages

- The flight is the internal class `Flight` in `src/stage/CameraFlight.ts`; `startFlight()` there
  does every refusal under the subject `CameraRig.across()`. A rig takes part through a
  `FlightSide`, a face of closures over its private state that the rig builds once.
- The rig of `from` and the rig of `to` each take the flight on `CameraRig.across()`. A running
  `moveTo()` of either ends there as a `cancel()` ends it — held where it stands —, and its promise
  resolves. A lock-on, a track and a damped lerp are kept, with their clocks stopped, as the state
  the rig goes back to. The rig of `to`, given a target of its own, places it first — so a refused
  target changes nothing — and keeps its state (`SavedState`) to go back to.
- **During the flight** `look()` works and lies on top of the flight, so a drag still turns the
  view: one flight look, clamped by the `pitchLimit` of the rig that takes it, laid on a
  perspective blend alone — an orthographic shot of the flight shows no look, and a rig on an
  orthographic stage refuses `look()` as it does outside a flight. `jump()`, `moveTo()`, `track()`
  and `lerp()` are refused with a message that names the flight: a target of its own would tear
  the camera out of the blend while the pictures blend. `cancel()` does nothing, and `busy` is
  `true`.
- The rigs notice the end of the transition in the frame of their stage, by its `state`, not by
  the `finished` promise, which settles a microtask late and could leave a draw in between:
  `Flight#check()` runs in `step()` and in `write()`. It runs as well first thing in `look()`,
  `cancel()`, the refusals of `jump()`, `moveTo()`, `track()` and `lerp()`, and `across()`, so a
  flight whose transition is over ends at the first call to either rig — a listener of
  `OnStageTransitionEnd` can move the camera or chain the next flight. `busy` does not end it: the
  end may throw what a listener of the stage of `to` throws as it takes a projection, and a getter
  throws nothing, so `busy` answers `false` for a flight whose transition is over and leaves the
  end to the next call or frame. Each rig leaves, also behind one that threw, and what both threw
  comes out once both have left. `transition.finished` is the backstop for a transition after which
  no frame draws, a director disposed; what the end throws there goes out as an unhandled
  rejection.
- In every frame, from the transition's `progress` and the easing of the flight: the start is the
  shot the rig of `from` showed when the flight began; the end is the target of `to`, resolved in
  the world of `to` and carried into the world of `from` through `M⁻¹`, with
  `M = anchorTo.matrixWorld · anchorFrom.matrixWorld⁻¹`, read anew in every frame into a matrix of
  the flight. The rig of `from` draws the blend; the rig of `to` draws it carried through `M`. A
  lens change runs as in §4.4, on both rigs alike, its focus taken from the plane of each side or
  from `focus`. The ends are exact: progress 0 copies the start, and progress 1 gives the rig of
  `to` its own shot where no look lies on top. An anchor whose scale turns uneven after the start
  counts by the mean of its three axes.
- The rig of `to` resolves its own shot with the flight set aside for that call (`#resolveOwn()`),
  inside the body of `#resolve()`: split into a method of its own, the body tipped V8's inlining,
  and the track with a clip allocated 16 bytes per step.
- **The end follows the transition.** Finished, or cancelled with `to` in the slot: the rig of `to`
  takes the target as its own pose and holds it — the flight look added to its look where its
  camera is a perspective one, a projection as the target assigned to its stage —; the rig of
  `from` goes back to the state it had — out of sight, so that a way back to `from` finds it as it
  was. Cancelled with `from` in the slot — `cancel()`, `reverse()` back to the start, a director
  disposed —: both go back to the state they had, as the picture jumps back to `from`. The look
  carries over exactly where the anchors map the up axis of one frame onto the other's; anchors
  that turn it show a small step at the takeover.
- **A frozen layer** shows a still picture and no flight: the rig warns once, naming the stage, when
  a layer of the flight is frozen.
- The director keeps no reference to the rig. The flight reads the transition, which answers two
  internal questions through its host, the director: whether a layer is frozen, and which source a
  finished or cancelled transition kept in its slot (`StageTransitionInternals.isFrozen()` and
  `keptOf()`, not exported). `StageTransitionInternals.settle()` takes the kept side — `'to'` for
  an instant change, `'from'` for a cancelled handle, the `keep` of the end of a run —, and
  `StageTransitionHost#isFrozen(stage)`, which `StageDirector` answers from its layers, is asked
  while the transition runs and answers `false` once it is over.

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
allocate, and so does a swap of the kind of camera, which the stage announces. A clip of a track
costs what three's `AnimationMixer#update()` costs — a number per keyframe track at a time that is
not whole —, so the spec stands in for `update()` on that one mixer.

The hot path keeps its fractions in fields and typed arrays, never in arguments or answers of a
call V8 may not inline, where they would be boxed: the progress of a blend goes through
`blendProgress`, the aspect of a write through `writeAspect` (both in `src/stage/cameraShot.ts`),
the easing through `applyEasingInPlace()`, the slerp and the turn of a look through `Float64Array`s
handed to three by `toArray()` and `fromArray()`, the pitch clamped on its field, the time of a
spring through a field of the spring. The specs of this file depend on the inlining V8 chose; a
case whose order matters — the move to a `CameraProjection` after the orthographic lock-on, which
caught the 16 bytes of §4.2 — says so in a comment. A caller's `{x, y, z}` literal can cost bytes of
its own once its hidden class holds a non-number, so the spec writes a `Vector3`.

### 4.9 The shared easings

The easing names, the type and `easingOf()` moved from `src/stage/StageTransition.ts` into
`src/utils/easing.ts`. The public type is `Easing`, exported through `src/utils/public-api.ts`;
`StageTransitionEasing` stays as an alias, so nothing a user wrote breaks. The evaluation moved
along: `applyEasing(spec, t)` serves `StageTransition#advance()`, held free of allocations by
`hot-path-allocations.director.spec.ts`, and `applyEasingInPlace(spec, slot)` works the same curves
out on a `Float64Array` slot for the rig, where a fraction handed across the call would be boxed.
`easing.spec.ts` holds the two equal for every easing. `easingOf()` takes the name of an option
for its message (`keys[0].ease must be …`). The named curves are products, without `**`.

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
  answers `false`. Its clocks still run, so an awaited move still resolves. The stage lets go of
  the driver on a detach after its dispose, and nothing else. The rig guards its `dispose()` with
  `Stage2DInternals.driverOf(stage) === this`.

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

The build ran in these steps, each a commit of its own with its specs, its guide section and its
CHANGELOG entry — the guide grew with every step rather than at the end:

1. the shared easings (§4.9), `src/utils/easing.ts`;
2. the driver hook of `Stage2D` and `OnStageCameraPlaced` (§3.8, §4.1, §4.1.1),
   `src/stage/StageCameraDriver.ts`, `Stage2DInternals` in `src/stage/Stage2D.ts`, `src/events.ts`,
   the contract of `src/stage/IProjection.ts`;
3. the rig on planar projections — poses, `jump`, `moveTo`, `look`, `reframe`, `cancel`, `step` —
   with its specs, allocation spec and browser test: `src/stage/CameraRig.ts`,
   `src/stage/cameraPose.ts`, `src/stage/cameraShot.ts`;
4. `rig.step()` as the frame step of a `FramePacer` (§3.4), in `docs/display.md`;
5. projections as targets, the lens change and `precompile()` (§4.2, §4.4),
   `src/stage/lensChange.ts`;
6. `CameraProjection` (§3.6), `src/stage/CameraProjection.ts`, and the rest of a projection moved
   out of the rig into `src/stage/cameraRest.ts`;
7. cameras and other `Object3D`s as targets, the lock-on (§4.2, §4.5), `src/stage/cameraTarget.ts`;
8. tracks, `lerp`, `smooth`, `clip` (§3.4, §4.6), `src/stage/cameraTrack.ts`;
9. `framing()` (§3.7), `src/stage/framing.ts`;
10. `CameraRig.across()` (§3.5, §4.7), `src/stage/CameraFlight.ts` and the internals of
    `src/stage/StageTransition.ts` and `src/stage/StageDirector.ts`;
11. the lookbook demos (§10), and after them the first `lerp()` that jumps, the clips scrubbed in
    the frame of the stage and the queue of `precompile()`, which the demos found.

`CameraRig.ts` still holds about 1660 lines: what reads or writes the private state of the rig —
the resolve, the saved state of a flight, the placement of the keys of a track — stays in it; the
math and the readers that take objects only went into the files above.

## 9. Tests

### 9.1 Vitest

All under `packages/twopoint5d/`:

- `src/stage/CameraRig.spec.ts`, by block: on a stage — `{}` equal to the projection's own
  placement bit for bit, for both planar projections, both planes, with and without `pixelSnap`;
  a pose on both planes, zoom, the axes of the look, a tilted rest, a stage without a view;
  `look()` standing and retargeting a move, the pitch clamped, reset by a new target; `moveTo()`
  with every easing, at 0 seconds, before a view, overtaken, through a resize; the end of a move by
  `cancel()`, `jump()`, an overtaking `moveTo()`, `track()` and `dispose()`; `reframe()` standing,
  during a move, under orthographic; `step()` as a `Motion`; the write in the frame of the stage,
  and a write of a listener of `OnStageUpdateFrame` that does not leak; `dispose()`, and a stage
  disposed under the rig, by a listener mid-frame as well; the refusals; a projection as a target;
  a camera as a target; an `Object3D` as a target — `offset`, its foot on the plane, orientation
  and scale ignored, a move back that meets it, `smooth` trailing and settling; a lock-on and its
  release; a lens change — exact at both rests, the visible height kept halfway, the step at the
  swap between ¼ and ½ pixel for a known depth, the default depth, the cap, a resize halfway, an
  overtaking move; a track — keys, `until`, the easing per stretch, holding before and after, a
  camera and an object key, the look of a key plus the rig's, a lens change between keys, a
  resize, the `clip` mapping and its scrub in the frame of the stage, `smooth` against its closed
  form, the first `lerp()` that jumps, the end of a track; the base camera and the kind of a
  projection of a class of its own; `precompile()` with a mock renderer, its queue per renderer
  and a rejection that keeps it running; the rig as the frame step of a `FramePacer`.
- `src/stage/CameraRig.across.spec.ts`: the blend at progress 0, ½ and 1 on both rigs, the easing,
  `to` as an option; anchors with a translation, a rotation and a scale, read anew each frame;
  uneven, mirrored and malformed anchors refused; a lens change across the flight, its focus
  scaled; the state of the rigs — a running `moveTo()` resolved, a track with a damped `lerp()` and
  a lock-on kept and resumed, the refusals during a flight, the flight look; the end — finished,
  cancelled to the start and to the end, `reverse()`, a manual transition, a projection assigned at
  the takeover, a director disposed; a rig disposed during the flight; the warning for a frozen
  layer; an end no frame has seen yet, a listener of `OnStageTransitionEnd` that chains a flight; a
  look over a flight into an orthographic stage; the refusals.
- `src/stage/CameraProjection.spec.ts`: construction and refusals; the view rect; `contain` and
  `cover` of a perspective source in a container wider and narrower than the frame, by the field
  of view and by the clip-space corners of the frame; an orthographic source off the middle;
  `fitLens()`; `updateCamera()` and its refusal of the other kind; the source never written;
  `needsPlacement()` before a placement, for a source that stands and after each kind of change;
  on a stage — placed only in frames where the source moved, a source of the other kind with and
  without a rig, a rig at rest and following, a move between two `CameraProjection`s, the detach;
  one source under two stages.
- `src/stage/framing.spec.ts`: for both projections and each side, the plane, up and the origin of
  an off-centre box, the camera aimed at the middle of the face, every corner of the box inside the
  frustum for a wide and a narrow container, `margin`; `pixelSnap` passed through; the refusals.
- `src/stage/Stage2D.spec.ts`, blocks "OnStageCameraPlaced" and "a camera driver": the event after
  every placement, with and without a driver, one props object per stage, a listener's tilt held
  and composed; the precedence of the driver's camera and the kept assignment; the order
  `placeBase`, the event, `compose`, `OnStageResize` on every path, and `write` before the frame
  events; `needsPlacement()` without `updateViewRect()` and `getViewRect()`; the announcements on
  attach, swap and detach; a camera of the wrong kind dropped on detach with a warning; a throwing
  listener and a throwing `compose()` collected after the state stands.
- `src/stage/StageDirector.spec.ts`, block "what a transition answers through its host": the kept
  source for every way a transition ends, and `isFrozen` while it runs.
- `src/stage/cameraPose.spec.ts` and `src/stage/cameraShot.spec.ts`: the forms of a pose, its
  refusals, nothing written on a refusal; the blend at 0, ½ and 1, the short-way slerp, the lens
  blend, `shotsEqual()`, the exact write over the base and the lift.
- `src/stage/lensChange.spec.ts`: the exact ends, the height kept, the log-space strength, the
  swap distance and its step, the cap, a flat scene, the way back, an aliased output.
- `src/utils/easing.spec.ts`: the curves, `applyEasingInPlace()` equal to `applyEasing()`, the
  refusals, the alias.
- `src/stage/animationMixer.spec.ts`: three's `AnimationMixer` applies a paused, enabled action at
  `update(0)` (§4.6).

### 9.2 Allocations

`src/stage/hot-path-allocations.camera-rig.spec.ts` calls `step()`, `write()` and `compose()` — and
`needsPlacement()` and `updateCamera()` of a `CameraProjection` — directly, below one byte per call:
a move under each easing, on both planar projections; `jump()` with a pose rewritten in place, as a
tuple and as a `Vector3`; `look()` while moving; a lens change out of a parallax and out of an
orthographic projection; the placement of a moving source for both kinds and both fits, of one
that stands, and under a rig; a move to and a lock-on onto a moving camera, a move to a
`CameraProjection` of a moving camera; a move to, a lock-on onto and a trailing of a moving
`Object3D`; a damped `lerp()` on a track with a clip, the mixer's `update()` stood in for; and a
flight, between two parallax projections and through a lens change. No listener of
`OnStageCameraPlaced` takes part: the emit is not the library's code (§4.8). The inputs come from
tables of fractions made before the measurement, so a round boxes nothing of its own.

### 9.3 Browser

`packages/twopoint5d-testing/test/stage-camera-rig.test.js`, under WebGPU and WebGL 2 in Chromium,
and WebGL 2 in Firefox and WebKit:

- a lifted camera puts a marker at the expected pixel row, under both planar projections, and back
  after `reframe({})`;
- a move from a parallax to an orthographic projection: the frame of the swap differs from the
  frame before by less than a pixel at the markers, and after `dispose()` the stage under its own
  orthographic camera draws the same picture;
- a `CameraProjection` with `contain` and `cover` puts markers on the corners of the authored frame
  at the expected pixels, for a container wider and narrower than the frame;
- a flight across a manual crossfade: at progress 0 the picture of `from`, at 1 the picture of
  `to`, halfway markers of both scenes where the shared viewpoint puts them, and after
  `complete()` the picture of progress 1.

## 10. Docs, CHANGELOG, lookbook

- `docs/stages.md`: "Framing a box" and "Looking through a camera: `CameraProjection`" in
  "Projections"; "Moving the camera" after "A camera of your own", with "Viewpoints", "Looking
  around", "Lifting the picture over a dialog", "Switching projections", "Perspective into
  orthographic", "A 3D scene through the cameras of a `.glb`", "A camera animated in Blender", "A
  page that scrolls through a scene", "A flight across a transition", "A camera that follows, with
  a rig", "Before and after the rig" — `OnStageCameraPlaced` and `OnStageUpdateFrame` as the hooks
  around the rig, with a tilted rest and a camera shake as recipes —, "Drawing on demand" and
  "Reference"; the rows in "Events", "Who disposes what", "Pitfalls" and the cheat sheet. "A camera
  that follows" sends a stage with a rig to the rig, and "From the pointer to the plane" notes that
  it holds at rest only.
- `docs/display.md`, "A camera that moves": `rig.step()` as the frame step of a `FramePacer`.
- `drawing-on-demand.md`: `rig.step()` as the first block that answers a `Motion`; the placement of
  a `CameraProjection` as a source of invalidation for phase B.
- `docs/architecture.md`: the new parts of the module `stage`.
- `CHANGELOG.md`, `## [Unreleased]`: "Added" for the rig and each of its steps, `CameraProjection`,
  `framing()`, `Easing`, `IProjection#needsPlacement`, `OnStageCameraPlaced`; "Changed" for the
  contract of `IProjection`, whose `createCamera()` and `updateCamera()` throw without a plane only
  where the projection needs one, and for the collected errors of `Stage2D`.
- Lookbook demos, with art made reproducibly under `apps/lookbook/assets-src/` (a full bake on the
  GPU is not byte-reproducible, a run without the render is):
  - *camera rig: two rooms* (`apps/lookbook/src/pages/demos/camera-rig-two-rooms.astro`) — a `.glb`
    of an observatory, its control room and its dome joined by a door, seen through its cameras
    with a `CameraProjection`; a click walks to the camera of the other room, a drag looks, the
    wheel or a slider runs a track whose middle key scrubs a camera animated in Blender through the
    door, and a key lifts the picture for a dialog;
  - *camera rig: into the map* (`apps/lookbook/src/pages/demos/camera-rig-into-the-map.astro`) — an
    orthographic survey sheet and a perspective diorama of the place it marks under a
    `StageDirector`, a crossfade by `replace()` with a flight across it, anchored on the marker and
    the origin of the diorama, a lens change on both rigs; a follow mode locks the map rig on to a
    token with `smooth`.

## 11. Left out

- collision of the camera with the scenery, orbit and fly controls — input stays the caller's; the
  rig takes `look()` and targets;
- curved paths between keys of a track — a curve comes from an animation of the asset;
- a flight across more than two stages, or across a mask;
- a camera shake as a part of the rig — it is a listener of `OnStageUpdateFrame` (§4.1.1), and the
  guide shows it as a recipe;
- the integration into a `StageDirector` that draws on demand — phase B of `drawing-on-demand.md`
  (#59) builds on `step()` and `needsPlacement()`.
