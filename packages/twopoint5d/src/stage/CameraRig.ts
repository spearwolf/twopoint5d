import {
  type AnimationAction,
  type Camera,
  type Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Sphere,
  Vector3,
  type WebGPURenderer,
} from 'three/webgpu';
import type {Motion} from '../display/FramePacer.js';
import {isWebGLRenderer} from '../display/isWebGLRenderer.js';
import {assertFinite} from '../utils/assertFinite.js';
import {assertFiniteAtLeast} from '../utils/assertFiniteAtLeast.js';
import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {describeValue} from '../utils/describeValue.js';
import {applyEasingInPlace, type Easing, type EasingSpec, easingOf} from '../utils/easing.js';
import {throwCollected} from '../utils/throwCollected.js';
import {unfilledInternal} from '../utils/unfilledInternal.js';
import {
  type CameraFlight,
  type CameraFlightOptions,
  type Flight,
  type FlightEnd,
  type FlightRole,
  type FlightSide,
  startFlight,
} from './CameraFlight.js';
import {type CameraPose, copyPoseValues, createPoseValues, type PoseValues, readLook, readPose} from './cameraPose.js';
import {CameraProjection} from './CameraProjection.js';
import {createRest, type Rest, readFrame, readRest} from './cameraRest.js';
import {
  blendProgress,
  blendShotsAtProgress,
  type CameraShot,
  type CameraShotKind,
  copyShot,
  createShot,
  shotsEqual,
  writeAspect,
  writeShotAtAspect,
} from './cameraShot.js';
import {
  createLook,
  kindOf,
  type Look,
  kindOfTarget,
  readObjectGoal,
  readObjectPose,
  resolveFollowShot,
  resolvePoseShot,
  type TargetKind,
  trailObject,
  writeFollowPosition,
  writePosePosition,
  writeTurn,
} from './cameraTarget.js';
import {CameraRigState, isFollowed} from './cameraRigState.js';
import {cullingSphereOf} from './cullingSphere.js';
import {advanceTrack, type CameraTrack, locateTrack, readTrack, scrubTrackClips, type TrackKey} from './cameraTrack.js';
import type {IProjection} from './IProjection.js';
import {blendLensChangeAtProgress, createLensChange} from './lensChange.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D, Stage2DInternals} from './Stage2D.js';
import type {StageCameraDriver} from './StageCameraDriver.js';
import type {StageTransition} from './StageTransition.js';

/**
 * What a `CameraRig` travels to, asked in this order:
 *
 * - a camera — a `PerspectiveCamera` or an `OrthographicCamera`, of three.js or of a loaded `.glb`:
 *   its world pose and its lens, fitted into the container as a `CameraProjection` with the default
 *   fit fits it. The rig locks on to it on arrival and follows it;
 * - any other `Object3D` — a player, a point of interest: its world position alone, carried into
 *   the frame, plus the `offset` of the move; the rig locks on to it on arrival and follows it.
 *   Under a projection without a plane — a `CameraProjection` — it lies in the middle of the
 *   picture: the frame is the plane through the world origin that faces the camera of the rest;
 * - an `IProjection`, whose rest the rig moves to and which it assigns to the stage on arrival;
 * - a {@link CameraPose} in the frame of the projection of the stage.
 */
export type CameraTarget = CameraPose | PerspectiveCamera | OrthographicCamera | IProjection | Object3D;

export interface CameraRigOptions {
  /** The largest pitch up or down, in radians, above 0 and up to `Math.PI / 2`. Default 85° (`Math.PI * 85 / 180`). */
  pitchLimit?: number;
  /**
   * The easing of `moveTo()` where the call names none, and of `reframe()`. Default `'ease-in-out'`.
   * Its answer is clamped to `[0, 1]`: a curve that overshoots stops at the ends.
   */
  easing?: Easing;
}

export interface CameraMoveOptions {
  /**
   * The easing of this move. Default: the easing of the rig, `'ease-in-out'` unless its options name
   * another. Its answer is clamped to `[0, 1]`: a curve that overshoots stops at the ends, and a lens
   * change swaps the kind of the camera once, on arrival.
   */
  easing?: Easing;
  /**
   * For an `Object3D` target: where the camera stands relative to the object, on the axes of the
   * frame — x and y, and optionally a distance from the plane, which an orthographic camera ignores.
   * Under a projection without a plane — a `CameraProjection` — x and y run along the right and the
   * up axis of the camera of the rest, and the distance counts from the plane through the world
   * origin that faces it. Default `[0, 0]`, at the distance of the current pose. Checked, and ignored
   * by other targets.
   */
  offset?: readonly [number, number] | readonly [number, number, number];
  /**
   * For an `Object3D` target: a time constant in seconds by which the camera trails the object once
   * locked on, critically damped; it settles where the gap falls below `1e-4`. Default `0`: it sticks
   * to the object. Checked, and ignored by other targets.
   */
  smooth?: number;
  /**
   * The distance from the camera to the focus plane of a move between a perspective and an
   * orthographic lens, which keeps its size on the screen through the move. Needed where the
   * projection has no plane; the distance to the plane wins where it has one.
   */
  focus?: number;
  /**
   * The depth of the scene in front of and behind the focus plane, for the same move: the camera
   * swaps its kind where the parallax across it stays below half a pixel, at a distance of at most
   * 1000 times the visible height. Default: the visible height at the focus plane — which reaches
   * that cap first on a container whose larger side passes about 1000 units, and swaps there with a
   * step of up to about a pixel: about 0.96 of one on a container 1920 wide.
   */
  depth?: number;
}

/**
 * A key of a track of a `CameraRig` (`rig.track(keys)`): a place on the track and the shot the
 * camera shows there.
 */
export interface CameraTrackKey {
  /** The place of the key on the track, from 0 to 1; the keys go in order. */
  at: number;
  /**
   * The shot of the key, resolved anew in every frame: a pose in the frame of the projection of the
   * stage, a camera — fitted as a `CameraProjection` with the default fit fits it —, any other
   * `Object3D` — its foot on the plane, at the distance and the zoom of the rest; under a projection
   * without a plane in the middle of the picture, on the plane through the world origin that faces
   * the camera of the rest —, or a projection, whose rest the camera shows without the rig assigning
   * it to the stage.
   */
  shot: CameraTarget;
  /**
   * Where the key ends, from `at` to 1: between `at` and `until` the camera holds the shot — and
   * follows a camera that moves. Default `at`.
   */
  until?: number;
  /**
   * A clip the rig scrubs between `at` and `until`, for a key whose shot is a camera: the progress
   * there maps onto `0 … clip.getClip().duration`, before the key onto the start, after it onto the
   * end. The rig sets `clip.time` and applies it through `clip.getMixer().update(0)`, which applies
   * the other actions of that mixer as well; it neither plays nor stops the action, which the caller
   * keeps playing and paused (`action.play().paused = true`).
   */
  clip?: AnimationAction;
  /** The easing of the stretch that arrives at this key. Default `'linear'`. Its answer is clamped to `[0, 1]`. */
  ease?: Easing;
}

/** The options of `CameraRig#lerp()`. */
export interface CameraLerpOptions {
  /**
   * A time constant in seconds: the shown progress approaches the asked one, critically damped, and
   * settles where the gap falls below `1e-4`. Default `0`: the next `step()` shows the asked progress.
   * The first `lerp()` after `track()` ignores it and shows its progress at once.
   */
  smooth?: number;
}

const DEFAULT_PITCH_LIMIT = (Math.PI * 85) / 180;

// V8 boxes a fraction handed to a call it does not inline, and one such a call answers; a fraction
// in a field or a typed array stays as it is. So the hot path of the rig keeps its fractions there:
// the progress of a move goes through `blendProgress` into the blend, the one of the lift through
// `liftProgress`, each eased in place, and the aspect through `writeAspect` into the write.
const liftProgress = new Float64Array(1);
const refuseKind = (camera: Camera): never => {
  throw new TypeError(
    `CameraRig: the projection builds a ${describeThreeValue(camera, 'isObject3D')}, not a PerspectiveCamera or an OrthographicCamera`,
  );
};

// the refusals of lerp(), out of its body: the messages it builds would leave V8 too little room to
// inline it, and the progress its caller hands it would be boxed (the allocation spec). Only the
// refusal makes the call
function refuseLerp(name: 't' | 'options' | 'smooth', value: unknown): never {
  const subject = 'CameraRig#lerp()';
  if (name === 'options') throw new TypeError(`${subject}: options must be an object, got ${describeValue(value)}`);
  throw new RangeError(
    name === 't'
      ? `${subject}: t must be a finite number, got ${describeValue(value)}`
      : `${subject}: smooth must be a finite number of 0 or more, got ${describeValue(value)}`,
  );
}

const EMPTY_POSE = createPoseValues();

// the last precompile() of any rig on each renderer, settled once it is over, rejected or not
const precompiling = new WeakMap<WebGPURenderer, Promise<void>>();
const noop = (): void => {};

const FLIGHT_REFUSAL = 'the rig takes part in a flight across a transition (CameraRig.across()) until the transition is over';

// the rig hands its stage a driver adapter over private methods; it does not name StageCameraDriver in
// its published declarations, where neither private members nor what is internal appear. The rig of
// an adapter, for CameraRig.across(), which finds a stage's driver alone
const rigOfDriver = new WeakMap<StageCameraDriver, CameraRig>();

/**
 * The camera driver a `CameraRig` hands its stage; not part of the public API.
 * @internal
 */
export const CameraRigInternals: {
  driverOf(rig: CameraRig): StageCameraDriver;
} = {
  driverOf: unfilledInternal('CameraRigInternals.driverOf()'),
};

/**
 * Moves the camera of a `Stage2D`: it resolves targets — poses in the frame of the projection,
 * other projections, cameras and other `Object3D`s, which it locks on to — into shots, blends them
 * in moves and along tracks, flies them across the transitions of a `StageDirector`
 * ({@link CameraRig.across}), and writes the result into a camera of its own, which the stage draws
 * with while the rig is attached. The projection keeps its job: it fits the view
 * into the container and places a base camera of the rig's, the rest every pose is given relative
 * to; a resize, a new fit and a new projection re-frame the pose by themselves. A move between a
 * perspective and an orthographic lens runs as a dolly zoom.
 *
 * The rig is the only writer it listens to: it keeps its state in fields of its own and never reads
 * its camera back, so a listener of `OnStageUpdateFrame` that moves the camera — a shake — moves it
 * for the draw of that frame alone. The stage asks the rig to write in every `updateFrame()`, just
 * before `OnStageUpdateFrame`; {@link step} advances the clocks of the rig, with the time of the
 * caller. Seconds and radians throughout.
 *
 * See "Moving the camera" in `docs/stages.md`.
 */
export class CameraRig {
  static {
    CameraRigInternals.driverOf = (rig) => rig.#driver;
  }

  readonly #stage: Stage2D;
  // what the stage places and writes the camera through, made once
  readonly #driver: StageCameraDriver;
  readonly #pitchLimit: number;
  readonly #easing: EasingSpec;

  readonly #perspective = new PerspectiveCamera();
  readonly #orthographic = new OrthographicCamera();
  #camera: PerspectiveCamera | OrthographicCamera;

  // the rest of the projection of the stage, read from the base camera it placed
  readonly #rest = createRest();
  #hasRest = false;
  // the larger side of the container, in its units: what half a pixel of a lens change is measured in
  #containerSize = 0;

  // the kind of camera a projection of a class the rig does not know builds, found out once by a
  // createCamera(), and that camera, kept as the next base the projection needs
  readonly #probedKinds = new WeakMap<IProjection, CameraShotKind>();
  #probe?: {projection: IProjection; camera: PerspectiveCamera | OrthographicCamera};

  // the target state — the mode, the target and everything the shot resolves from —, which a flight
  // saves whole and gives back whole
  readonly #state = new CameraRigState();

  // whether the last step() moved the camera after a camera or an Object3D it is locked on to, or
  // along a track whose progress stood
  #followMoved = false;

  // the scratch of a lens change, its focus and depth from the state
  readonly #lensChange = createLensChange();

  // the pose a call reads, before it becomes the one of the state
  readonly #nextPose = createPoseValues();
  // the shot a track, a camera or a move to a projection shows, as an object that follows them
  // takes it (#shownShot())
  readonly #shown = createShot();

  // a key of a track resolves with its own look plus the one of the rig, and a shot that one key
  // alone gives is written over the base of that key
  readonly #keyLook = createLook();
  #writeBase?: Camera;

  // the clock of a move (mode 'move'): from the shot the camera showed at its start, its lens kept as
  // a zoom on the base
  #elapsed = 0;
  #duration = 0;
  #moveEasing: EasingSpec;
  #fromPending = false;
  readonly #from = createShot();
  #settle?: () => void;

  // the lift of reframe(), on a clock of its own
  #lift = 0;
  #lifting = false;
  #liftFrom = 0;
  #liftTo = 0;
  #liftElapsed = 0;
  #liftDuration = 0;
  #liftShown = 0;

  readonly #to = createShot();
  readonly #current = createShot();
  // the shot of the last step(); no step has one, so the first one answers true
  readonly #stepped = Object.assign(createShot(), {lens: Number.NaN});

  // a flight across a transition the rig takes part in, its side of it, the face it shows the
  // flight, and the state it goes back to where the flight brought it a target of its own
  #flight?: Flight;
  #flightRole: FlightRole = 'from';
  #side?: FlightSide;
  #saved?: CameraRigState;

  #disposed = false;

  /**
   * Attaches the rig to `stage`, which draws with the camera of the rig from now on: a
   * `PerspectiveCamera` under a `ParallaxProjection`, an `OrthographicCamera` under an
   * `OrthographicProjection`, and a camera of the kind of its source under a `CameraProjection`.
   * The rig starts at the rest of the projection — the placement the projection gives a camera by
   * itself —, and places its camera right away if the stage has a view.
   *
   * @throws {TypeError} for a `stage` that is not a `Stage2D`, an `easing` that is not one.
   * @throws {RangeError} for a `pitchLimit` that is not a finite number above 0 and of
   * `Math.PI / 2` or less.
   * @throws {Error} for a stage without a projection, with a rig already, or disposed. What the
   * placement of the camera throws — the projection, a listener of an event of the stage — comes
   * out of the constructor once the rig has let go of the stage again: a constructor that throws
   * leaves the stage as it found it.
   */
  constructor(stage: Stage2D, options?: CameraRigOptions) {
    const subject = 'new CameraRig()';
    if (!(stage instanceof Stage2D)) {
      throw new TypeError(`${subject}: stage must be a Stage2D, got ${describeValue(stage)}`);
    }
    if (stage.isDisposed) throw new Error(`${subject}: the stage has been disposed`);
    if (stage.projection == null) {
      throw new Error(`${subject}: the stage has no projection to compose the poses of the rig over`);
    }
    if (Stage2DInternals.driverOf(stage) != null) {
      throw new Error(`${subject}: the stage has a CameraRig already; dispose it first`);
    }

    const pitchLimit = options?.pitchLimit ?? DEFAULT_PITCH_LIMIT;
    if (typeof pitchLimit !== 'number' || !(pitchLimit > 0 && pitchLimit <= Math.PI / 2)) {
      throw new RangeError(
        `${subject}: pitchLimit must be a finite number above 0 and of Math.PI / 2 or less, got ${describeValue(pitchLimit)}`,
      );
    }
    this.#pitchLimit = pitchLimit;
    this.#easing = options?.easing === undefined ? easingOf(subject, 'ease-in-out') : easingOf(subject, options.easing);
    this.#moveEasing = this.#easing;

    this.#stage = stage;
    this.#camera = this.#kindOfProjection(stage.projection) === 'orthographic' ? this.#orthographic : this.#perspective;

    // the private methods bound to the rig rather than wrapped in arrows or in methods of a class of
    // their own: V8 reduces the call of a bound function to its target, so the driver puts no call
    // more on the path of a frame — one more costs the frame of a page that scrolls a heap number
    // (the allocation spec)
    const rig = this;
    this.#driver = {
      get camera() {
        return rig.#camera;
      },
      placeBase: this.#placeBase.bind(this),
      compose: this.#compose.bind(this),
      write: this.#write.bind(this),
    };
    rigOfDriver.set(this.#driver, this);

    try {
      Stage2DInternals.attachDriver(stage, this.#driver);
    } catch (error) {
      // the stage has the rig attached by the time a listener throws: it goes back to the camera it
      // had, and the caller, who gets no rig, has nothing to dispose
      this.#disposed = true;
      const errors: unknown[] = [error];
      if (Stage2DInternals.driverOf(stage) === this.#driver) {
        try {
          Stage2DInternals.detachDriver(stage);
        } catch (detachError) {
          // a listener that throws on every placement throws the same error twice
          if (!errors.includes(detachError)) errors.push(detachError);
        }
      }
      throwCollected(errors, `${subject}: the placement of the camera threw, and so did the detach from the stage`);
    }
  }

  /** The stage the rig moves the camera of; it stays the caller's. */
  get stage(): Stage2D {
    return this.#stage;
  }

  /**
   * The camera the stage draws with while the rig is attached: a `PerspectiveCamera` under a
   * `ParallaxProjection`, an `OrthographicCamera` under an `OrthographicProjection`, one of the kind
   * of its source under a `CameraProjection`, and a `PerspectiveCamera` while a lens change runs
   * between the two kinds. A swap of the kind — by a new projection, by a lens change, by a source of
   * the other kind — is announced by the stage through `OnStageAfterCameraChanged`.
   * After {@link dispose} it answers the camera it was left with.
   */
  get camera(): PerspectiveCamera | OrthographicCamera {
    return this.#camera;
  }

  /**
   * `true` while a move is under way, while the camera trails an `Object3D` by `smooth`, while the
   * shown progress of a track has yet to reach the one {@link lerp} asked for, and while locked on to
   * a camera or an object — or on a track — when the last {@link step} moved the camera after it,
   * and while the rig takes part in a flight across a transition whose transition is not over;
   * `false` after {@link dispose}. It throws nothing: the end of a flight whose transition is over is
   * left to the next call or frame, since it may throw what a listener of the stage throws.
   */
  get busy(): boolean {
    const flight = this.#flight;
    const state = this.#state;
    const track = state.track;
    return (
      (flight !== undefined && !flight.transition.isOver) ||
      state.mode === 'move' ||
      this.#state.follow.trailing ||
      this.#followMoved ||
      (track !== undefined && track.shown !== track.asked)
    );
  }

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Puts the camera on `target` at once; it ends a running move, whose promise resolves, and lets go
   * of a target the rig followed. The target brings its own look — the `look` of the pose, 0 where it
   * gives none, the orientation of a camera —; an `Object3D` keeps the look, the zoom and the
   * distance of the current pose — of the shot a track, a camera, a move to a projection or
   * {@link cancel} shows, where the rig stands on one, its look then the rest's turned by
   * {@link look}. A pose object the caller keeps and rewrites may be handed in every frame: the rig
   * reads it in the call and allocates nothing. A projection is assigned to the stage at once, and
   * the camera stands on its rest. A camera or an `Object3D` locks the rig on: it follows the target
   * from here on, as after the arrival of {@link moveTo}, so there is no need to hand it in every
   * frame — a call with a camera builds a `CameraProjection` and allocates. A camera of the other
   * kind needs no focus here.
   *
   * @throws {TypeError} for a camera that is neither a `PerspectiveCamera` nor an
   * `OrthographicCamera`, and for a pose of another shape.
   * @throws {RangeError} for a number of the pose that is not finite, a `zoom` that is not above 0
   * and a `look` other than 0 under a projection with an orthographic camera.
   * @throws {Error} during a flight across a transition (`CameraRig.across()`).
   */
  jump(target: CameraTarget): void {
    const subject = 'CameraRig#jump()';
    this.#assertAlive(subject);
    this.#assertGrounded(subject);
    const kind = this.#readTarget(subject, target, this.#nextPose, undefined);
    const camera = kind === 'camera' ? new CameraProjection(target as PerspectiveCamera | OrthographicCamera) : undefined;
    let targetRest: Rest | undefined;
    if (camera !== undefined && this.#hasRest) {
      targetRest = createRest();
      this.#placeTarget(camera, targetRest);
    }
    this.#endMove();
    this.#release();
    copyPoseValues(this.#nextPose, this.#state.pose);
    if (kind !== 'object') this.#takeLookOfPose();
    this.#takeTarget(kind, target, camera, targetRest, undefined);
    if (kind === 'projection') this.#stage.projection = target as IProjection;
  }

  /**
   * Moves the camera from the shot it shows now to `target` in `seconds`, eased: position, look and
   * zoom. Both ends are resolved in every frame, relative to the fit, so a resize during the move
   * re-frames both. The target brings its own look, as for {@link jump}. A move that overtakes a
   * running one starts where that one stands.
   *
   * A projection as the target: the camera moves to its rest — the placement it gives a camera for
   * the container of the stage —, and the rig assigns it to `stage.projection` on arrival, where
   * nothing jumps. A projection whose rest moves — a `CameraProjection` with an animated source — is
   * met where it stands in each frame. A projection of the other kind — orthographic from
   * perspective, or back — makes the move a lens change, a dolly zoom: the focus plane keeps its
   * size on the screen while the camera backs off and its lens narrows, and the camera swaps its
   * kind where the parallax across `depth` stays below half a pixel, at a distance of at most 1000
   * times the visible height. The focus plane is the projection plane; without one, `focus` names
   * its distance.
   *
   * A camera as the target: the camera moves to its world pose and its lens, fitted into the
   * container as a `CameraProjection` with the default fit (`'contain'`) fits it, and the rig locks
   * on to it on arrival: it reads the camera in every frame and follows an animation that moves it
   * or changes its lens; a {@link look} lies on top. No projection is assigned. A camera of the other
   * kind is a lens change, which needs `focus`, since a camera has no projection plane.
   *
   * Any other `Object3D` as the target: the camera moves to the world position of the object,
   * carried into the frame — under a plane, its foot on the plane —, plus `offset`. Under a
   * projection without a plane — a `CameraProjection` — the object lies in the middle of the
   * picture: `offset` runs along the right and the up axis of the camera of the rest, and a
   * distance counts from the plane through the world origin that faces it. The look, the
   * zoom and the distance stay those of the current pose, unless `offset` names a distance — after
   * a track, a camera or on the way to a projection those of the shot it shows, its look the
   * rest's turned by {@link look}. The object is met where it stands in each frame, and on arrival
   * the rig locks on to it: the camera sticks to it, or trails it by `smooth`, critically damped.
   *
   * A lock-on holds until the next `moveTo()`, a {@link jump}, {@link cancel} or {@link dispose}.
   *
   * The promise resolves on arrival, and also when the move ends otherwise — {@link cancel}, a
   * {@link jump}, an overtaking `moveTo()`, {@link dispose} —, so code that awaits the camera is
   * released. It never rejects; a refusal throws from the call. `seconds` of 0 arrives at once.
   *
   * @throws {TypeError} and {@link RangeError} for a target as {@link jump} refuses it, for
   * `seconds` that is not a finite number of 0 or more, an `easing` that is not one, and an option
   * of {@link CameraMoveOptions} that is not a number of its kind.
   * @throws {Error} for a lens change without a focus where a projection or the camera of the target
   * has no plane, a stage whose projection was taken away, and during a flight across a transition
   * (`CameraRig.across()`); and what the projection of the target throws as the rig places its rest.
   */
  moveTo(target: CameraTarget, seconds: number, options?: CameraMoveOptions): Promise<void> {
    const subject = 'CameraRig#moveTo()';
    this.#assertAlive(subject);
    this.#assertGrounded(subject);
    assertFiniteAtLeast(seconds, subject, 'seconds', 0);
    const easing = this.#readMoveOptions(subject, options);
    const kind = this.#readTarget(subject, target, this.#nextPose, options);
    const projection =
      kind === 'projection'
        ? (target as IProjection)
        : kind === 'camera'
          ? new CameraProjection(target as PerspectiveCamera | OrthographicCamera)
          : undefined;

    // a lens change needs the distance of its focus plane: the projection plane, or the option
    const targetKind =
      projection !== undefined
        ? this.#kindOfProjection(projection)
        : this.#hasRest
          ? this.#rest.kind
          : this.#kindOfProjection(this.#projectionOf(subject));
    if (kindOf(this.#camera) !== targetKind && options?.focus === undefined) {
      if (kind === 'camera') {
        throw new Error(
          `${subject}: a lens change between a perspective and an orthographic camera needs a focus: a camera as the target has no projectionPlane, and the move names no focus`,
        );
      }
      if (
        this.#projectionOf(subject).projectionPlane == null ||
        (projection !== undefined && projection.projectionPlane == null)
      ) {
        throw new Error(
          `${subject}: a lens change between a perspective and an orthographic camera needs a focus: the projection has no projectionPlane, and the move names no focus`,
        );
      }
    }
    // the rest of the target, placed before anything changes: what the projection throws refuses
    // the move. Without a view it is placed once the view comes
    let targetRest: Rest | undefined;
    if (projection !== undefined && this.#hasRest) {
      targetRest = createRest();
      this.#placeTarget(projection, targetRest);
    }

    // the start is the shot the camera shows now, a running move included; without a view it is
    // taken from the target once a view comes
    const fromReady = this.#hasRest;
    if (fromReady) this.#resolveRelative(this.#from);
    this.#endMove();
    this.#release();
    copyPoseValues(this.#nextPose, this.#state.pose);
    if (kind !== 'object') this.#takeLookOfPose();
    this.#state.focus = options?.focus ?? Number.NaN;
    this.#state.depth = options?.depth ?? Number.NaN;
    this.#takeTarget(kind, target, projection, targetRest, options);

    if (seconds === 0) {
      this.#arrive();
      return Promise.resolve();
    }

    this.#state.mode = 'move';
    this.#elapsed = 0;
    this.#duration = seconds;
    this.#moveEasing = easing;
    this.#fromPending = !fromReady;
    return new Promise<void>((resolve) => {
      this.#settle = resolve;
    });
  }

  /**
   * Sets the look of the current pose — yaw about the up axis of the frame, then pitch about the
   * right axis of the camera, relative to the rest: at once while the camera stands, as the new end
   * of a running move while it moves, which bends to it. The pitch is clamped to `pitchLimit`. A
   * look holds until the next target. Allocates nothing.
   *
   * An orthographic camera shows no look: on a track the look lies on its perspective shots alone.
   *
   * @throws {TypeError} for a `look` that is not an object with `yaw` and `pitch`.
   * @throws {RangeError} for a yaw or a pitch that is not finite, and for a look other than 0 under
   * an `OrthographicProjection` — the one of the stage, or the one a move runs to — and on a track
   * while it shows an orthographic shot.
   */
  look(look: {yaw: number; pitch: number}): void {
    const subject = 'CameraRig#look()';
    this.#assertAlive(subject);
    // a flight whose transition is over ends here, so that the look goes to the rig, not to the flight
    this.#flight?.check();
    const values = this.#nextPose;
    readLook(subject, look, this.#refusesLook(), values);
    const flight = this.#flight;
    if (flight !== undefined) {
      // on top of the flight, both rigs alike; the rig keeps its own look to go back to
      const flightLook = this.#keyLook;
      flightLook.yaw = values.yaw;
      const limit = this.#pitchLimit;
      let pitch = values.pitch;
      if (pitch > limit) pitch = limit;
      else if (pitch < -limit) pitch = -limit;
      flightLook.pitch = pitch;
      flight.look(flightLook);
      return;
    }
    this.#state.look.yaw = values.yaw;
    this.#state.look.pitch = values.pitch;
    this.#clampPitch();
    // a shot held by cancel() takes the look from here on, about its rest
    this.#state.holdingTurn = false;
  }

  /**
   * Sets the lift: a share of the picture height by which the picture moves up through the view
   * offset, without turning the camera — so that the subject clears a dialog over the lower part of
   * the picture. A lift left out is 0. It is a framing, not a viewpoint: it blends on a clock of its
   * own, in `seconds` with the easing of the rig, at once without them, and a running move keeps
   * running.
   *
   * @throws {TypeError} for a `framing` that is not an object.
   * @throws {RangeError} for a lift that is not finite, and `seconds` that is not a finite number of
   * 0 or more.
   */
  reframe(framing: {lift?: number}, seconds?: number): void {
    const subject = 'CameraRig#reframe()';
    this.#assertAlive(subject);
    if (typeof framing !== 'object' || framing === null) {
      throw new TypeError(`${subject}: framing must be an object with an optional lift, got ${describeValue(framing)}`);
    }
    const lift = framing.lift === undefined ? 0 : assertFinite(framing.lift, subject, 'lift');
    if (seconds !== undefined) assertFiniteAtLeast(seconds, subject, 'seconds', 0);

    if (seconds === undefined || seconds === 0) {
      this.#lifting = false;
      this.#lift = lift;
      return;
    }
    this.#updateLift();
    this.#liftFrom = this.#liftShown;
    this.#liftTo = lift;
    this.#liftElapsed = 0;
    this.#liftDuration = seconds;
    this.#lifting = true;
  }

  /**
   * Ends a running move where it stands, and lets go of a camera or an `Object3D` the rig is locked
   * on to: the camera holds that shot — its lens as a factor on the fit — until the next target, and
   * a {@link look} turns it about the rest. A projection the move ran to is not assigned. The promise
   * of the move resolves. Does nothing while the camera stands on a pose or a projection, and during
   * a flight across a transition, whose shot is the transition's; leaves a track alone.
   */
  cancel(): void {
    this.#assertAlive('CameraRig#cancel()');
    this.#flight?.check();
    const mode = this.#state.mode;
    if ((mode !== 'move' && mode !== 'locked') || this.#flight !== undefined) return;
    this.#hold();
  }

  // ends a move where it stands and lets go of its target: the camera holds that shot — without a
  // view there is none, and it stands on the pose
  #hold(): void {
    const state = this.#state;
    const hasRest = this.#hasRest;
    if (hasRest) {
      this.#resolveRelative(state.held);
      state.holdingTurn = true;
    }
    this.#release();
    this.#endMove();
    state.mode = hasRest ? 'held' : 'pose';
  }

  /**
   * Sets a track: the camera shows the shot of a key inside its span — from `at` to `until` —, and
   * between two keys a blend of their shots at the share of the stretch, eased by the `ease` of the
   * key it arrives at; before the first key the first, after the last the last. {@link lerp} sets
   * the progress along it; a new track starts at 0, at once. `track(from, to)` is the track of two
   * keys at 0 and 1.
   *
   * Every key is resolved anew in every frame, so a key on a camera or an `Object3D` follows it. A
   * key brings its own look; a {@link look} lies on top of the perspective shots of the track until
   * the next target, and an orthographic key shows none. A
   * stretch between keys of the two kinds of lens runs as the lens change of {@link moveTo}, with
   * the projection plane of each end as its focus. A projection as a key is shown, not assigned to
   * the stage.
   *
   * The track ends a running move, whose promise resolves, and lets go of a target the rig followed.
   * It stays until the next `track()`, {@link jump}, {@link moveTo} or {@link dispose}.
   *
   * @throws {TypeError} for keys that are not a non-empty array of objects, a `clip` that is not an
   * `AnimationAction` or whose key has no camera as its shot, an `ease` that is not an easing, and a
   * shot as {@link jump} refuses it.
   * @throws {RangeError} for an `at` or an `until` that is not a finite number from 0 to 1, an
   * `until` before its `at`, keys out of order — a key that starts before the one before it ends —,
   * and the numbers of a pose as {@link jump} refuses them.
   * @throws {Error} for a stretch between a perspective and an orthographic lens where one of its
   * keys has no projection plane: a camera, or a projection or a stage without one; for a stage
   * whose projection was taken away; and during a flight across a transition (`CameraRig.across()`).
   */
  track(keys: readonly CameraTrackKey[]): void;
  track(from: CameraTarget, to: CameraTarget): void;
  track(keysOrFrom: readonly CameraTrackKey[] | CameraTarget, ...to: CameraTarget[]): void {
    const subject = 'CameraRig#track()';
    this.#assertAlive(subject);
    this.#assertGrounded(subject);
    const projection = this.#projectionOf(subject);
    const keys =
      to.length > 0
        ? [
            {at: 0, shot: keysOrFrom},
            {at: 1, shot: to[0]},
          ]
        : keysOrFrom;
    const track = readTrack(subject, keys, {
      kindOfProjection: (p) => this.#kindOfProjection(p),
      stageKind: this.#hasRest ? this.#rest.kind : this.#kindOfProjection(projection),
      stageHasPlane: projection.projectionPlane != null,
      orthographic: this.#isOrthographic(projection),
    });

    this.#endMove();
    this.#release();
    copyPoseValues(EMPTY_POSE, this.#state.pose);
    this.#takeLookOfPose();
    const state = this.#state;
    state.focus = Number.NaN;
    state.depth = Number.NaN;
    state.track = track;
    state.mode = 'track';
  }

  /**
   * Sets the progress along the track, clamped to `[0, 1]`. Without `smooth` the next {@link step}
   * shows it; with `smooth` — a time constant in seconds — the shown progress approaches it,
   * critically damped, so that the ticks of a mouse wheel become a glide; a new progress asked on the
   * way keeps the speed the glide has. The first `lerp()` after {@link track} jumps, `smooth` or not:
   * it sets the shown progress at once — the next frame of the stage shows it, before any step —,
   * and `smooth` glides from there with every later call. Allocates nothing.
   *
   * @throws {RangeError} for a `t` that is not a finite number, and a `smooth` that is not a finite
   * number of 0 or more.
   * @throws {TypeError} for `options` that is not an object.
   * @throws {Error} on a rig without a track, and during a flight across a transition
   * (`CameraRig.across()`).
   */
  lerp(t: number, options?: CameraLerpOptions): void {
    const subject = 'CameraRig#lerp()';
    this.#assertAlive(subject);
    // the check of a flight inline, its refusal alone a call: one call more on its way keeps V8 from
    // inlining lerp(), and the progress its caller hands it is boxed (the allocation spec)
    if (this.#flight !== undefined) this.#assertGrounded(subject);
    const track = this.#state.track;
    if (track === undefined) throw new Error(`${subject}: the rig has no track; set one with track() first`);
    // the checks inline rather than through assertFinite(): a progress is a fraction, and a fraction
    // handed to a call that V8 does not inline is boxed
    if (typeof t !== 'number' || !(t > Number.NEGATIVE_INFINITY && t < Number.POSITIVE_INFINITY)) refuseLerp('t', t);
    let smooth = 0;
    if (options !== undefined) {
      if (typeof options !== 'object' || options === null) refuseLerp('options', options);
      const value = options.smooth;
      if (value !== undefined) {
        if (typeof value !== 'number' || !(value >= 0 && value < Number.POSITIVE_INFINITY)) refuseLerp('smooth', value);
        smooth = value;
      }
    }
    // clamped in place, as #clampPitch() clamps: no call takes the fraction
    let asked = t;
    if (asked < 0) asked = 0;
    else if (asked > 1) asked = 1;
    // the first progress of a track is shown at once, smooth or not — before the next step, since the
    // stage may write its frame first —, so that it does not glide in from 0; a smooth lerp() after
    // it glides from there
    if (!track.lerped) {
      track.lerped = true;
      track.shown = asked;
      track.velocity = 0;
    }
    track.asked = asked;
    track.smooth = smooth;
  }

  /**
   * Advances the clocks of the rig — a move, a reframe, the trailing of an `Object3D` by `smooth`,
   * the progress of a track, damped by `smooth`, and the clips it scrubs — by `deltaSeconds` and
   * resolves the shot of the frame, a camera or an object the rig is locked on to where it stands
   * now. Answers the `Motion` of drawing on demand: `true` when that shot differs
   * from the one the step before resolved, `false` otherwise — also for a target that stands —, and
   * `false` on a stage without a view or one that has been disposed. A move that arrives resolves
   * its promise here, and a move to a projection assigns it to the stage here. As a frame step:
   * `pacer.onFrame((frame) => rig.step(frame.deltaTime), stage)`. The camera itself is written in
   * the frame of the stage, so the order of `step()` and `updateFrame()` does not matter.
   * Allocates nothing but on the arrival at a projection.
   *
   * @throws {RangeError} for `deltaSeconds` that is not a finite number of 0 or more.
   */
  step(deltaSeconds: number): Motion {
    this.#assertAlive('CameraRig#step()');
    // inline rather than through assertFiniteAtLeast(): the time of a frame is a fraction, and a
    // fraction handed to a call that V8 does not inline is boxed
    if (typeof deltaSeconds !== 'number' || !(deltaSeconds >= 0 && deltaSeconds < Number.POSITIVE_INFINITY)) {
      throw new RangeError(
        `CameraRig#step(): deltaSeconds must be a finite number of 0 or more, got ${describeValue(deltaSeconds)}`,
      );
    }

    // a flight notices the end of its transition here and in the frame of the stage; while it runs,
    // the clocks of a track and of a trailing stand, as the state the rig goes back to
    this.#flight?.check();
    const flying = this.#flight !== undefined;
    if (this.#lifting) {
      this.#liftElapsed += deltaSeconds;
      if (this.#liftElapsed >= this.#liftDuration) {
        this.#lifting = false;
        this.#lift = this.#liftTo;
      }
    }
    const state = this.#state;
    if (state.mode === 'move') {
      this.#elapsed += deltaSeconds;
      if (this.#elapsed >= this.#duration) this.#arrive();
    }
    // whether the step moved the progress of a track
    let progressed = false;
    const track = state.track;
    if (track !== undefined && !flying) {
      // a field rather than an argument: a fraction handed to a call that V8 does not inline is boxed
      track.delta = deltaSeconds;
      advanceTrack(track);
      scrubTrackClips(track);
      // against the progress of the last step, since the first lerp() of a track moves it itself
      progressed = track.shown !== track.stepped;
      track.stepped = track.shown;
    }

    if (!this.#hasRest || this.#stage.isDisposed) {
      this.#followMoved = false;
      return false;
    }
    const follow = state.follow;
    if (follow.object !== undefined && state.mode !== 'move' && follow.smooth > 0 && !flying) {
      // a field rather than an argument: a fraction handed to a call that V8 does not inline is boxed
      follow.delta = deltaSeconds;
      trailObject(follow, this.#rest);
    }
    this.#resolve(this.#current);
    if (shotsEqual(this.#current, this.#stepped)) {
      this.#followMoved = false;
      return false;
    }
    copyShot(this.#current, this.#stepped);
    this.#followMoved = !flying && (state.mode === 'locked' || (track !== undefined && !progressed));
    return true;
  }

  /**
   * Compiles the scene of the stage with the camera of the other kind — orthographic while the rig
   * draws with a perspective camera, and the other way round —, so that the first frame of a lens
   * change builds no shader: three.js builds the materials of a scene for each kind of camera. The
   * scene is compiled for the current target of `renderer`, as `Stage2D#renderTo()` draws it, and
   * for each scene pass the stage has built — the pass node of `asPassNode()`, and the pass of its
   * `postProcess`, which this call builds as its first draw would. That camera is placed over the
   * view the rig shows now, as a lens change meets it at the projection plane. Without a plane — a
   * `CameraProjection` — it meets it at the `focus` of the last {@link moveTo}, where that move
   * named one, and otherwise at the middle of the objects of the scene that three.js culls by its
   * frustum, so that they are compiled. The compile with the camera the stage has is the job of the
   * first draw, or of `StageDirector#precompile()`.
   *
   * Calls on one renderer — of this rig or of another — run one after the other, each with its own
   * result: a call waits until the ones before it on that renderer have settled, resolved or
   * rejected, so `Promise.all()` over the rigs of a director is safe.
   *
   * Resolves at once on a stage without a view or one that has been disposed. A `postProcess` that
   * reads depth compiles here with the other kind as well, and has to handle both itself.
   *
   * @throws {TypeError} for a `WebGLRenderer`, as a rejection.
   * @throws {Error} on a disposed rig, as a rejection; and what the build of the `postProcess` and
   * the compiles of three.js throw.
   */
  async precompile(renderer: WebGPURenderer): Promise<void> {
    const subject = 'CameraRig#precompile()';
    this.#assertAlive(subject);
    if (isWebGLRenderer(renderer)) {
      throw new TypeError(`${subject}: a WebGLRenderer is not supported — compile with a WebGPURenderer`);
    }
    // behind the calls that run on this renderer already: two compiles of three.js at once on one
    // renderer trip over each other. The queue holds the settling of each call, not its result, so
    // that a rejection stays the caller's and the next call still runs
    const previous = precompiling.get(renderer);
    const run = previous === undefined ? this.#precompile(renderer) : previous.then(() => this.#precompile(renderer));
    const settled = run.then(noop, noop);
    precompiling.set(renderer, settled);
    void settled.then(() => {
      if (precompiling.get(renderer) === settled) precompiling.delete(renderer);
    });
    return run;
  }

  async #precompile(renderer: WebGPURenderer): Promise<void> {
    const stage = this.#stage;
    if (this.#disposed || stage.isDisposed || !this.#hasRest) return;
    if (!renderer.initialized) await renderer.init();
    if (this.#disposed || stage.isDisposed) return;

    const other = this.#camera === this.#perspective ? this.#orthographic : this.#perspective;
    this.#writeOtherKind(other);
    // the post-process as its first draw builds it, so that its pass is there to compile
    if (stage.postProcess !== undefined) stage.asPassNode(renderer);

    await renderer.compileAsync(stage.scene, other);
    for (const pass of Stage2DInternals.scenePassesOf(stage)) {
      if (this.#disposed || stage.isDisposed) return;
      // the pass reads its camera in the synchronous part of its compile, and gets its own back
      // before anything else runs
      const camera = pass.camera;
      pass.camera = other;
      let compiling: Promise<void>;
      try {
        compiling = pass.compileAsync(renderer);
      } finally {
        pass.camera = camera;
      }
      await compiling;
    }
  }

  /**
   * Detaches the rig from the stage, which goes back to the camera it had — one assigned to
   * `stage.camera`, or the projection's — and places it. A running move ends, and its promise
   * resolves; a lock-on ends, and the rig keeps no reference to its target. The stage stays the
   * caller's. Afterwards every method but `dispose()` throws; `stage`,
   * `camera` and `busy` answer what they held. A second call does nothing. What a listener of the
   * stage throws while it takes its camera back comes out of this call once the rig is down.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const flight = this.#flight;
    // the other rig of a flight goes back to its state, and the flight is over; what that throws,
    // and what the detach throws, come out of this call once the rig is down
    const errors: unknown[] = [];
    if (flight !== undefined) {
      this.#flight = undefined;
      this.#saved = undefined;
      try {
        flight.drop(this.#side!);
      } catch (error) {
        errors.push(error);
      }
    }
    this.#release();
    this.#endMove();
    this.#lifting = false;
    // a stage that went on to another rig keeps it
    if (Stage2DInternals.driverOf(this.#stage) === this.#driver) {
      try {
        Stage2DInternals.detachDriver(this.#stage);
      } catch (error) {
        errors.push(error);
      }
    }
    throwCollected(
      errors,
      'CameraRig#dispose(): the other rig of the flight threw as it went back to its state, and so did the detach from the stage',
    );
  }

  // lets `projection` place the base camera of the rig and answers it; called by the stage through
  // the driver. The base is of the kind the projection builds and is never drawn with. The rest of a
  // projection a move runs to follows the container here, and the placement of the stage where it is
  // that very projection
  #placeBase(projection: IProjection): Camera {
    const rest = this.#rest;
    this.#placeRest(projection, rest);

    const stage = this.#stage;
    const width = stage.containerWidth;
    const height = stage.containerHeight;
    const pixelRatio = stage.containerPixelRatio;
    this.#containerSize = Math.max(width, height);

    const target = this.#state.projection;
    if (
      target !== undefined &&
      (target === projection ||
        !this.#state.placed ||
        width !== this.#state.width ||
        height !== this.#state.height ||
        pixelRatio !== this.#state.pixelRatio)
    ) {
      this.#placeTarget(target, this.#state.rest);
      this.#state.placed = true;
    }
    return rest.base!;
  }

  // reads the rest from the base the projection placed and the listeners of `OnStageCameraPlaced`
  // changed, and writes the camera; called by the stage through the driver after every placement.
  // Writes with a camera of the kind of the shot it resolves and has the stage announce a swap. Does
  // nothing on a disposed stage. Allocates nothing without a swap
  #compose(): void {
    const rest = this.#rest;
    if (rest.base === undefined || this.#disposed || this.#stage.isDisposed) return;
    readRest(rest);
    this.#hasRest = true;
    this.#writeNow();
  }

  // writes the camera for the frame from the state of the rig; called by the stage through the driver
  // in every `updateFrame()`, before `OnStageUpdateFrame`. Does nothing on a disposed stage or before
  // the first placement. Allocates nothing but in the frame of a swap
  #write(): void {
    if (this.#disposed) return;
    this.#flight?.check();
    if (!this.#hasRest || this.#stage.isDisposed) return;
    this.#writeNow();
  }

  // writes the shot of the frame with the camera of its kind; a swap is written before the stage
  // announces it, so its listeners find the camera placed
  #writeNow(): void {
    // the clips of a track at the shown progress, which the first lerp() sets without a step; a clip
    // whose time stands is skipped, so the scrub of the step costs nothing more. A flight stops the
    // clocks of the track
    const track = this.#state.track;
    if (track !== undefined && this.#flight === undefined) scrubTrackClips(track);
    const shot = this.#current;
    this.#resolve(shot);
    const camera = shot.kind === 'perspective' ? this.#perspective : this.#orthographic;
    writeAspect[0] = this.#rest.aspect;
    writeShotAtAspect(shot, this.#writeBase ?? this.#rest.base!, camera);
    if (camera !== this.#camera) {
      this.#camera = camera;
      Stage2DInternals.announceCamera(this.#stage);
    }
  }

  // the shot of `camera`'s kind that shows the view the rig shows now, as a lens change meets it:
  // the same height at the focus plane, for the compile of the other kind
  #writeOtherKind(camera: PerspectiveCamera | OrthographicCamera): void {
    const shot = createShot();
    this.#resolve(shot);
    const rest = this.#rest;
    const forward = new Vector3(0, 0, -1).applyQuaternion(shot.quaternion);
    // to the plane, the focus of the move, or the middle of what three.js culls in the scene — so
    // that a stage without a plane compiles the meshes of its scene before a move names a focus
    let distance = 0;
    if (rest.hasPlane) distance = new Vector3().subVectors(shot.position, rest.origin).dot(rest.normal);
    else if (!Number.isNaN(this.#state.focus)) distance = this.#state.focus;
    else {
      const sphere = cullingSphereOf(this.#stage.scene, new Sphere());
      if (!sphere.isEmpty()) distance = new Vector3().subVectors(sphere.center, shot.position).dot(forward);
    }
    if (shot.kind === 'perspective') {
      shot.lens = 2 * Math.max(distance, rest.near) * shot.lens;
      shot.kind = 'orthographic';
    } else {
      // from the focus point, backed off by its distance or by the height of the view
      const height = shot.lens;
      const backOff = distance > 0 ? distance : height;
      shot.position.addScaledVector(forward, distance - backOff);
      shot.lens = height / (2 * backOff);
      shot.near = Math.max(backOff + shot.near - distance, backOff * 1e-3);
      shot.far = Math.max(backOff + shot.far - distance, shot.near + backOff);
      shot.kind = 'perspective';
    }
    writeAspect[0] = rest.aspect;
    writeShotAtAspect(shot, rest.base!, camera);
  }

  // the shot the rig shows now, into `out`, its lens kept as a zoom on the rest of the stage
  #resolveRelative(out: CameraShot): void {
    this.#resolve(out);
    const rest = this.#rest;
    if (out.kind === rest.kind) out.zoom = rest.lens / out.lens;
  }

  // the shot the rig shows with the clocks where they stand, into `out`: the one of a flight, or its
  // own. The flight branches off at the top and the body stays as it is: split into a call of its
  // own, the track of a page that scrolls measures a heap number per frame (the allocation spec)
  #resolve(out: CameraShot): void {
    const flight = this.#flight;
    if (flight !== undefined) {
      this.#resolveFlight(flight, out);
      return;
    }
    this.#writeBase = undefined;
    const track = this.#state.track;
    if (track !== undefined) {
      this.#resolveTrack(track, out);
      this.#updateLift();
      out.lift = this.#liftShown;
      return;
    }
    const to = this.#to;
    this.#resolveTarget(to);
    const state = this.#state;
    if (state.mode === 'move') {
      const from = this.#from;
      if (this.#fromPending) {
        copyShot(to, from);
        this.#fromPending = false;
      }
      // the start keeps its lens relative to the fit: the lens of the base of this frame
      const rest = this.#rest;
      if (from.kind === rest.kind) from.lens = rest.lens / from.zoom;
      const t = this.#elapsed / this.#duration;
      blendProgress[0] = Math.min(t, 1);
      // clamped to [0, 1]: an easing that overshoots carries the blend past neither end
      applyEasingInPlace(this.#moveEasing, blendProgress);
      if (from.kind === to.kind) {
        blendShotsAtProgress(from, to, out);
      } else {
        this.#prepareLensChange(
          from,
          to,
          this.#rest,
          this.#state.projection !== undefined && this.#state.placed ? this.#state.rest : this.#rest,
        );
        // the camera of the other kind at the start and on arrival alone, wherever the easing stands
        this.#lensChange.underWay = t > 0 && t < 1;
        blendLensChangeAtProgress(from, to, this.#lensChange, out);
      }
    } else {
      copyShot(to, out);
    }
    this.#updateLift();
    out.lift = this.#liftShown;
  }

  // the shot of the flight the rig takes part in, with the lift of the rig
  #resolveFlight(flight: Flight, out: CameraShot): void {
    if (!flight.resolve(this.#flightRole, out)) this.#writeBase = undefined;
    this.#updateLift();
    out.lift = this.#liftShown;
  }

  // the shot of the rig's own state, as if it took part in no flight, into `out`
  #resolveOwn(out: CameraShot): void {
    const flight = this.#flight;
    this.#flight = undefined;
    try {
      this.#resolve(out);
    } finally {
      this.#flight = flight;
    }
  }

  // the distances of the two ends of a lens change to their focus planes — to the projection plane
  // where the frame of the rest of that end has one, otherwise the focus of the move —, the depth and
  // the container, into the lens change. Inline: a call that V8 does not inline boxes the fraction it
  // answers
  #prepareLensChange(from: CameraShot, to: CameraShot, restA: Rest, restB: Rest): void {
    const change = this.#lensChange;
    const focus = this.#state.focus;

    let p = from.position;
    let o = restA.origin;
    let n = restA.normal;
    let distance = restA.hasPlane ? (p.x - o.x) * n.x + (p.y - o.y) * n.y + (p.z - o.z) * n.z : focus;
    // a perspective camera on or behind its plane has no focus there; an orthographic one may stand anywhere
    if (from.kind === 'perspective' ? !(distance > 0) : Number.isNaN(distance)) distance = focus > 0 ? focus : 1;
    change.focusA = distance;

    p = to.position;
    o = restB.origin;
    n = restB.normal;
    distance = restB.hasPlane ? (p.x - o.x) * n.x + (p.y - o.y) * n.y + (p.z - o.z) * n.z : focus;
    if (to.kind === 'perspective' ? !(distance > 0) : Number.isNaN(distance)) distance = focus > 0 ? focus : 1;
    change.focusB = distance;

    change.depth = this.#state.depth;
    change.containerSize = this.#containerSize;
  }

  // the target as it resolves against the rest of this frame, into `out`: the rest of the stage, or
  // the rest of the projection a move runs to or the camera the rig follows, where it stands now
  #resolveTarget(out: CameraShot): void {
    this.#followTarget();
    const state = this.#state;
    const rest = state.projection !== undefined && state.placed ? state.rest : this.#rest;
    const pose = state.pose;
    const follow = state.follow;
    if (follow.object !== undefined) {
      // the place the trailing has reached once locked on with smooth, otherwise the object's own
      if (follow.started && follow.smooth > 0 && state.mode !== 'move') {
        pose.x = follow.x;
        pose.y = follow.y;
      } else {
        readObjectGoal(follow, rest);
        pose.x = follow.goalX;
        pose.y = follow.goalY;
      }
    }
    const held = state.held;
    const holding = state.mode === 'held';

    if (holding) out.position.copy(held.position);
    // an object is followed in the follow frame of the rest, which keeps it on the line of sight
    else if (follow.object !== undefined) writeFollowPosition(rest, pose, out.position);
    else writePosePosition(rest, pose, out.position);

    if (holding && state.holdingTurn) out.quaternion.copy(held.quaternion);
    // an orthographic camera takes no look other than 0, also one the rig kept from a projection of
    // the other kind assigned to the stage since
    else if (rest.kind === 'orthographic') out.quaternion.copy(rest.quaternion);
    else writeTurn(rest, state.look, out.quaternion);

    if (holding) {
      // a held shot of the other kind — a lens change cancelled on its way — keeps its own lens
      out.kind = held.kind;
      out.zoom = held.zoom;
      out.lens = held.kind === rest.kind ? rest.lens / held.zoom : held.lens;
      out.near = held.near;
      out.far = held.far;
    } else {
      const zoom = pose.zoom;
      out.kind = rest.kind;
      out.zoom = zoom;
      out.lens = rest.lens / zoom;
      out.near = rest.near;
      out.far = rest.far;
    }
    out.lift = 0;
  }

  // the shot of the track at its shown progress, into `out`: the shot of a key, or the blend of two —
  // a lens change between keys of the two kinds —, each resolved in this frame
  #resolveTrack(track: CameraTrack, out: CameraShot): void {
    locateTrack(track);
    const keys = track.keys;
    const a = keys[track.index]!;
    const restA = this.#resolveKey(a);
    if (track.next < 0) {
      copyShot(a.shot, out);
      // the shot of one key alone over the base its projection placed: pixel-exact on its rest
      if (restA !== this.#rest) this.#writeBase = restA.base;
      return;
    }
    const b = keys[track.next]!;
    const restB = this.#resolveKey(b);
    blendProgress[0] = track.share;
    if (a.shot.kind === b.shot.kind) {
      blendShotsAtProgress(a.shot, b.shot, out);
    } else {
      this.#prepareLensChange(a.shot, b.shot, restA, restB);
      // a stretch lies between its keys, which show the shots of their own kind
      this.#lensChange.underWay = true;
      blendLensChangeAtProgress(a.shot, b.shot, this.#lensChange, out);
    }
  }

  // the shot of `key` in this frame, into its shot, and the rest it resolved against: a pose and an
  // object on the rest of the stage, a projection and a camera on the rest of their own. The look is
  // the key's plus the rig's, its pitch clamped, and 0 on an orthographic rest
  #resolveKey(key: TrackKey): Rest {
    const pose = key.pose;
    let rest = this.#rest;
    const follow = key.follow;
    if (follow !== undefined) {
      readObjectGoal(follow, rest);
      pose.x = follow.goalX;
      pose.y = follow.goalY;
    } else if (key.projection !== undefined) {
      rest = this.#placeKey(key, key.projection);
    }
    const look = this.#keyLook;
    if (rest.kind === 'orthographic') {
      look.yaw = 0;
      look.pitch = 0;
    } else {
      look.yaw = this.#state.look.yaw;
      look.pitch = this.#state.look.pitch;
      if (pose.hasLook) {
        look.yaw += pose.yaw;
        look.pitch += pose.pitch;
        const limit = this.#pitchLimit;
        if (look.pitch > limit) look.pitch = limit;
        else if (look.pitch < -limit) look.pitch = -limit;
      }
    }
    if (follow !== undefined) resolveFollowShot(rest, pose, look, key.shot);
    else resolvePoseShot(rest, pose, look, key.shot);
    return rest;
  }

  // the rest of the projection of `key`, placed for the container of the stage — anew where the
  // container changed, and in every frame for a projection whose rest may move, as #followTarget()
  // places it —; the rest of the stage where it is the projection of the stage
  #placeKey(key: TrackKey, projection: IProjection): Rest {
    const stage = this.#stage;
    if (projection === stage.projection) return this.#rest;
    const rest = key.rest;
    const width = stage.containerWidth;
    const height = stage.containerHeight;
    const pixelRatio = stage.containerPixelRatio;
    if (!key.placed || width !== key.width || height !== key.height || pixelRatio !== key.pixelRatio) {
      projection.updateViewRect(width, height, pixelRatio);
      key.placed = true;
      key.width = width;
      key.height = height;
      key.pixelRatio = pixelRatio;
    } else if (projection.needsPlacement === undefined) {
      return rest;
    }
    this.#placeRest(projection, rest);
    readRest(rest);
    return rest;
  }

  // the lift the clock of reframe() has reached, into #liftShown
  #updateLift(): void {
    if (!this.#lifting) {
      this.#liftShown = this.#lift;
      return;
    }
    liftProgress[0] = this.#liftElapsed / this.#liftDuration;
    applyEasingInPlace(this.#easing, liftProgress);
    const e = liftProgress[0]!;
    this.#liftShown = this.#liftFrom * (1 - e) + this.#liftTo * e;
  }

  #takeLookOfPose(): void {
    const pose = this.#state.pose;
    this.#state.look.yaw = pose.hasLook ? pose.yaw : 0;
    this.#state.look.pitch = pose.hasLook ? pose.pitch : 0;
    this.#clampPitch();
  }

  // in place, on the field: a fraction handed across a call or answered by one may be boxed
  #clampPitch(): void {
    const limit = this.#pitchLimit;
    const look = this.#state.look;
    const pitch = look.pitch;
    if (pitch > limit) look.pitch = limit;
    else if (pitch < -limit) look.pitch = -limit;
  }

  // ends the clock of a move: the mode turns to what its target leaves — locked on to a camera or an
  // object, otherwise the pose
  #endMove(): void {
    const state = this.#state;
    if (state.mode === 'move') state.mode = isFollowed(state.targetKind) ? 'locked' : 'pose';
    this.#fromPending = false;
    const settle = this.#settle;
    this.#settle = undefined;
    settle?.();
  }

  // the end of a move: a projection it ran to becomes the projection of the stage, whose rest the
  // camera stands on — the same pose, `{}` with the look, over a base placed alike. A camera or an
  // object the move ran to stays the target: the rig is locked on to it from here on
  #arrive(): void {
    const projection = this.#state.assigns ? this.#state.projection : undefined;
    if (projection !== undefined) {
      this.#state.projection = undefined;
      this.#state.assigns = false;
    }
    this.#endMove();
    if (projection !== undefined && this.#stage.projection !== projection) this.#stage.projection = projection;
  }

  // the target read by #readTarget(), made the one of the rig: a projection to move to, the
  // CameraProjection of a camera — fitted as one with the default fit fits it —, or an object to
  // follow; `targetRest` is the rest of the projection, placed already where the stage has a view
  #takeTarget(
    kind: TargetKind,
    target: unknown,
    projection: IProjection | undefined,
    targetRest: Rest | undefined,
    options: CameraMoveOptions | undefined,
  ): void {
    this.#state.projection = projection;
    this.#state.assigns = kind === 'projection' && projection !== undefined;
    if (targetRest !== undefined) this.#state.rest = targetRest;
    this.#state.placed = targetRest !== undefined;
    // the rig stands on the target from here on — a move sets its own mode afterwards
    this.#state.targetKind = kind;
    this.#state.mode = isFollowed(kind) ? 'locked' : 'pose';
    if (kind === 'object') {
      const follow = this.#state.follow;
      const offset = options?.offset;
      follow.object = target as Object3D;
      follow.offsetX = offset === undefined ? 0 : offset[0];
      follow.offsetY = offset === undefined ? 0 : offset[1];
      follow.smooth = options?.smooth ?? 0;
      follow.started = false;
      follow.trailing = false;
    }
  }

  // lets go of the target a move ran to or the rig followed, and of a track; the rig keeps no
  // reference to either
  #release(): void {
    this.#state.track = undefined;
    this.#writeBase = undefined;
    this.#state.projection = undefined;
    this.#state.assigns = false;
    this.#state.targetKind = 'pose';
    // a track and a lock-on are let go; a move and a held shot are for the caller to end
    if (this.#state.mode === 'track' || this.#state.mode === 'locked') this.#state.mode = 'pose';
    this.#followMoved = false;
    const follow = this.#state.follow;
    follow.object = undefined;
    follow.trailing = false;
  }

  // a projection of the target whose rest may move — one with needsPlacement(), a CameraProjection
  // with an animated source, the one of a camera target among them — placed anew in every
  // resolve, with its source read through updateWorldMatrix(true, false); step() compares the shots
  // afterwards. Placed rather than asked through needsPlacement() first: once the rig has followed
  // cameras of both kinds, that call from here costs 16 bytes where it answers false — measured by
  // the allocation spec, under V8's inlining of the moment —, and the placement costs none. The
  // projection of the stage is the stage's to place
  #followTarget(): void {
    const target = this.#state.projection;
    if (target === undefined || !this.#state.placed || target === this.#stage.projection) return;
    if (target.needsPlacement === undefined) return;
    const rest = this.#state.rest;
    this.#placeRest(target, rest);
    readRest(rest);
  }

  // the base of `rest`, placed by `projection`: kept while it is of the kind the projection builds
  #placeRest(projection: IProjection, rest: Rest): void {
    const kind = this.#kindOfProjection(projection);
    const base = rest.base;
    if (base !== undefined && rest.kind === kind) {
      projection.updateCamera(base);
    } else {
      const created = this.#createBase(projection, kind);
      rest.base = created;
      // the kind the camera has: a projection of a class of its own may build another one by now
      rest.kind = kindOf(created)!;
    }
    readFrame(projection, rest);
  }

  // the rest of `projection` for the container of the stage, into `rest`
  #placeTarget(projection: IProjection, rest: Rest): void {
    const stage = this.#stage;
    const width = stage.containerWidth;
    const height = stage.containerHeight;
    const pixelRatio = stage.containerPixelRatio;
    projection.updateViewRect(width, height, pixelRatio);
    this.#placeRest(projection, rest);
    readRest(rest);
    this.#state.width = width;
    this.#state.height = height;
    this.#state.pixelRatio = pixelRatio;
  }

  // the kind of camera `projection` builds: known for the planar projections, the kind of the source
  // for a CameraProjection — asked anew each time, since its source may change —, and found out once
  // by a createCamera() for a projection of another class
  #kindOfProjection(projection: IProjection): CameraShotKind {
    if (projection instanceof ParallaxProjection) return 'perspective';
    if (projection instanceof OrthographicProjection) return 'orthographic';
    if (projection instanceof CameraProjection) return kindOf(projection.source)!;
    const known = this.#probedKinds.get(projection);
    if (known !== undefined) return known;
    const camera = projection.createCamera();
    const kind = kindOf(camera) ?? refuseKind(camera);
    this.#probedKinds.set(projection, kind);
    this.#probe = {projection, camera: camera as PerspectiveCamera | OrthographicCamera};
    return kind;
  }

  #createBase(projection: IProjection, kind: CameraShotKind): PerspectiveCamera | OrthographicCamera {
    const probe = this.#probe;
    if (probe !== undefined && probe.projection === projection) {
      this.#probe = undefined;
      // built when the kind was asked for, maybe before the view it is placed for now
      projection.updateCamera(probe.camera);
      return probe.camera;
    }
    const created = projection.createCamera();
    const createdKind = kindOf(created) ?? refuseKind(created);
    // a projection of a class of its own that builds the other kind by now: the kind found out
    // before is stale, and the camera it builds now tells the new one
    if (createdKind !== kind && this.#probedKinds.has(projection)) this.#probedKinds.set(projection, createdKind);
    return created as PerspectiveCamera | OrthographicCamera;
  }

  // whether look() refuses a look other than 0: on a track by the shot it shows — a key of either
  // kind, or the perspective camera of a lens change between them —, otherwise by the projection
  // of the target or of the stage
  #refusesLook(): boolean {
    if (this.#state.mode === 'track' && this.#flight === undefined && this.#hasRest) {
      const shown = this.#shown;
      this.#resolve(shown);
      return shown.kind === 'orthographic';
    }
    return this.#isOrthographic(this.#state.projection ?? this.#stage.projection);
  }

  #isOrthographic(projection: IProjection | undefined): boolean {
    if (projection instanceof OrthographicProjection) return true;
    if (projection instanceof ParallaxProjection || projection === undefined) return false;
    if (projection instanceof CameraProjection) return kindOf(projection.source) === 'orthographic';
    const known = this.#probedKinds.get(projection);
    if (known !== undefined) return known === 'orthographic';
    return this.#hasRest && this.#rest.kind === 'orthographic';
  }

  // the kind of the target, and its pose into `out`: a pose as it reads, the pose an object keeps of
  // the current one, and the empty pose of a camera and a projection. A refusal names the target by
  // `path` where the call names it so (`to`), as `target` otherwise. Changes nothing of the rig
  #readTarget(
    subject: string,
    target: unknown,
    out: PoseValues,
    options: CameraMoveOptions | undefined,
    path?: string,
  ): TargetKind {
    const kind = kindOfTarget(subject, target, path);
    if (kind === 'pose') readPose(subject, target, this.#isOrthographic(this.#stage.projection), out, path);
    else if (kind === 'object') {
      // the pose of an object the rig follows, or moves to, is in the follow frame already
      const state = this.#state;
      readObjectPose(state.pose, this.#shownShot(), this.#rest, options?.offset, out, state.follow.object !== undefined);
    } else copyPoseValues(EMPTY_POSE, out);
    return kind;
  }

  // the shot an object as the next target keeps the zoom and the distance of where the pose of the
  // rig does not hold them: the one cancel() holds, and the one a track, a camera or a move to a
  // projection shows — the pose of the rig is the empty one there. Undefined where the pose holds
  // them, and without a view
  #shownShot(): CameraShot | undefined {
    if (this.#state.mode === 'held') return this.#state.held;
    if (!this.#hasRest || (this.#state.mode !== 'track' && this.#state.projection === undefined)) {
      return undefined;
    }
    const shown = this.#shown;
    this.#resolveRelative(shown);
    return shown;
  }

  #readMoveOptions(subject: string, options: CameraMoveOptions | undefined): EasingSpec {
    if (options === undefined) return this.#easing;
    if (typeof options !== 'object' || options === null) {
      throw new TypeError(`${subject}: options must be an object, got ${describeValue(options)}`);
    }
    const {easing, offset, smooth, focus, depth} = options;
    if (offset !== undefined) {
      if (!Array.isArray(offset) || (offset.length !== 2 && offset.length !== 3)) {
        throw new TypeError(`${subject}: offset must be a tuple of 2 or 3 numbers, got ${describeValue(offset)}`);
      }
      for (let i = 0; i < offset.length; i++) assertFinite(offset[i], subject, `offset[${i}]`);
    }
    if (smooth !== undefined) assertFiniteAtLeast(smooth, subject, 'smooth', 0);
    if (focus !== undefined) assertPositiveFinite(focus, subject, 'focus');
    if (depth !== undefined) assertPositiveFinite(depth, subject, 'depth');
    return easing === undefined ? this.#easing : easingOf(subject, easing);
  }

  // the projection of the stage, or the refusal of `subject` where it was taken away under the rig
  #projectionOf(subject: string): IProjection {
    const projection = this.#stage.projection;
    if (projection == null) throw new Error(`${subject}: the stage has no projection`);
    return projection;
  }

  #assertAlive(subject: string): void {
    if (this.#disposed) throw new Error(`${subject}: the rig has been disposed`);
  }

  // refuses a call during a flight; a flight whose transition is over — complete() or cancel() of
  // the transition, settled before any frame of a stage — ends here first, so that a call right after
  // the end, or from a listener of OnStageTransitionEnd, finds the rig on the ground
  #assertGrounded(subject: string): void {
    this.#flight?.check();
    if (this.#flight !== undefined) throw new Error(`${subject}: ${FLIGHT_REFUSAL}`);
  }

  /**
   * Flies the camera through `transition` of a `StageDirector`, from the stage it leaves into the
   * stage it brings; each needs a `CameraRig`, which keeps being stepped as before. During the
   * transition there is one blended shot, in the world of `from`: from the shot the rig of `from`
   * shows now to the target of `to` — `options.to`, or the shot the rig of `to` holds —, at the
   * progress of the transition, eased by `options.easing`. The camera of `from` shows it, the camera
   * of `to` shows it carried through `options.anchors` into the world of `to`: at progress 0 `from`
   * shows its own picture, at 1 `to` stands exactly on its target. A manual transition flies the
   * camera by the `progress` it is given, and `reverse()` flies it back. A lens change across the
   * flight runs as the dolly zoom of {@link moveTo}, on both rigs alike.
   *
   * A running move of either rig ends where it stands, and its promise resolves; a lock-on, a track
   * and a damped lerp stand with their clocks stopped, as the state the rig goes back to. During the
   * flight {@link look} lies on top of it, on both rigs; {@link jump}, {@link moveTo}, {@link track}
   * and {@link lerp} are refused. The rigs notice the end of the transition in their step and in the
   * frame of their stage, by its state: where it finished or left `to` in its slot, the rig of `to`
   * holds its target — a projection assigned to its stage, the look of the flight added to the
   * target's — and the rig of `from` goes back to the state it had; where it left `from`, both go
   * back. A rig disposed during the flight ends it, and the other goes back to its state. A frozen
   * layer of the flight shows a still picture: the flight warns once.
   *
   * A flight whose end no frame and no call notices — a transition after which no stage of the
   * flight is drawn, a director that was disposed — ends through `transition.finished`, and what a
   * rig throws there goes out as an unhandled rejection; there is no error event.
   *
   * @throws {TypeError} for a `transition` that is not a `StageTransition`, `options` that are not an
   * object, `anchors` that are not a pair of `Object3D`, an `easing` that is not one, and a target
   * as {@link jump} refuses it, named `to`.
   * @throws {RangeError} for a `focus` that is not a finite number above 0, anchors scaled unevenly
   * or mirrored against each other, and the numbers of a target pose as {@link jump} refuses them.
   * @throws {Error} for a transition that is over, from or to nothing, a stage without a rig or
   * whose projection was taken away under its rig, a rig that takes part in a flight already, and a
   * lens change without a focus where a side has no projection plane.
   */
  static across(transition: StageTransition, options?: CameraFlightOptions): CameraFlight {
    return startFlight(transition, options, (stage) => {
      const driver = stage instanceof Stage2D ? Stage2DInternals.driverOf(stage) : undefined;
      const rig = driver === undefined ? undefined : rigOfDriver.get(driver);
      return rig !== undefined && !rig.#disposed ? rig.#flightSide() : undefined;
    });
  }

  // the face the rig shows a flight, made once
  #flightSide(): FlightSide {
    this.#side ??= {
      stage: this.#stage,
      rest: this.#rest,
      inFlight: () => {
        this.#flight?.check();
        return this.#flight !== undefined;
      },
      hasRest: () => this.#hasRest,
      targetRest: () => (this.#state.projection !== undefined && this.#state.placed ? this.#state.rest : this.#rest),
      resolveOwn: (out) => this.#resolveOwn(out),
      resolveStart: (out) => {
        this.#resolveOwn(out);
        if (out.kind === this.#rest.kind) out.zoom = this.#rest.lens / out.lens;
      },
      containerInto: (change) => {
        change.containerSize = this.#containerSize;
      },
      readEnd: (subject, target) => this.#readFlightEnd(subject, target),
      join: (flight, role, target) => {
        if (target !== undefined) this.#takeFlightTarget(target);
        else if (this.#state.mode === 'move') this.#hold();
        this.#flight = flight;
        this.#flightRole = role;
      },
      leave: (take, look) => this.#leaveFlight(take, look),
    };
    return this.#side;
  }

  // the lens of `target`, or of the shot the rig shows, and whether its frame has a plane
  #readFlightEnd(subject: string, target: CameraTarget | undefined): FlightEnd {
    const projection = this.#stage.projection;
    if (projection == null) throw new Error(`${subject}: the stage ${describeValue(this.#stage.name)} has no projection`);
    if (target === undefined) {
      if (!this.#hasRest) {
        return {kind: this.#kindOfProjection(projection), hasPlane: projection.projectionPlane != null, camera: false};
      }
      const shot = createShot();
      this.#resolveOwn(shot);
      const rest = this.#state.projection !== undefined && this.#state.placed ? this.#state.rest : this.#rest;
      return {kind: shot.kind, hasPlane: rest.hasPlane, camera: false};
    }
    const kind = this.#readTarget(subject, target, this.#nextPose, undefined, 'to');
    if (kind === 'camera') return {kind: kindOf(target as Camera)!, hasPlane: false, camera: true};
    if (kind === 'projection') {
      const own = target as IProjection;
      return {kind: this.#kindOfProjection(own), hasPlane: own.projectionPlane != null, camera: false};
    }
    const stageKind = this.#hasRest ? this.#rest.kind : this.#kindOfProjection(projection);
    return {kind: stageKind, hasPlane: projection.projectionPlane != null, camera: false};
  }

  // the target of a flight, taken by the rig of `to` as moveTo() takes one — a projection assigned
  // once the rig takes over —, the state it had kept to go back to
  #takeFlightTarget(target: CameraTarget): void {
    const subject = 'CameraRig.across()';
    const kind = this.#readTarget(subject, target, this.#nextPose, undefined, 'to');
    const projection =
      kind === 'projection'
        ? (target as IProjection)
        : kind === 'camera'
          ? new CameraProjection(target as PerspectiveCamera | OrthographicCamera)
          : undefined;
    let targetRest: Rest | undefined;
    if (projection !== undefined && this.#hasRest) {
      targetRest = createRest();
      this.#placeTarget(projection, targetRest);
    }
    // a running move ends where it stands once what may throw has passed; an object then keeps the
    // zoom and the distance of the shot the move stood at
    if (this.#state.mode === 'move') {
      this.#hold();
      if (kind === 'object') this.#readTarget(subject, target, this.#nextPose, undefined, 'to');
    }
    const saved = new CameraRigState().copy(this.#state);
    this.#release();
    copyPoseValues(this.#nextPose, this.#state.pose);
    if (kind !== 'object') this.#takeLookOfPose();
    this.#state.focus = Number.NaN;
    this.#state.depth = Number.NaN;
    this.#takeTarget(kind, target, projection, targetRest, undefined);
    this.#saved = saved;
  }

  // the end of a flight for this rig: with `take` it holds its target, the look of the flight added;
  // otherwise it goes back to the state it had
  #leaveFlight(take: boolean, look: Look): void {
    this.#flight = undefined;
    const saved = this.#saved;
    this.#saved = undefined;
    if (take) {
      // the look of the flight goes on with the target, but not onto an orthographic camera, which
      // takes no look other than 0
      if ((look.yaw !== 0 || look.pitch !== 0) && !this.#isOrthographic(this.#state.projection ?? this.#stage.projection)) {
        this.#state.look.yaw += look.yaw;
        this.#state.look.pitch += look.pitch;
        this.#clampPitch();
        this.#state.holdingTurn = false;
      }
      this.#arrive();
      return;
    }
    if (saved === undefined) return;
    this.#state.copy(saved);
    // the container may have changed while the flight ran
    if (saved.projection !== undefined && this.#hasRest && !this.#stage.isDisposed) {
      this.#placeTarget(saved.projection, this.#state.rest);
      this.#state.placed = true;
    }
  }
}
