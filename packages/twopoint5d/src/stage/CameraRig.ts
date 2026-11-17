import {type Camera, type Object3D, OrthographicCamera, PerspectiveCamera, Quaternion, Vector3} from 'three/webgpu';
import type {Motion} from '../display/FramePacer.js';
import {assertFinite} from '../utils/assertFinite.js';
import {assertFiniteAtLeast} from '../utils/assertFiniteAtLeast.js';
import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {describeValue} from '../utils/describeValue.js';
import {applyEasingInPlace, type Easing, type EasingSpec, easingOf} from '../utils/easing.js';
import {throwCollected} from '../utils/throwCollected.js';
import {type CameraPose, copyPoseValues, createPoseValues, type PoseValues, readLook, readPose} from './cameraPose.js';
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
import type {IProjection} from './IProjection.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D, Stage2DInternals} from './Stage2D.js';

/**
 * What a `CameraRig` travels to: a {@link CameraPose} in the frame of the projection of its stage.
 * Cameras, projections and other `Object3D`s are refused by this version of the rig.
 */
export type CameraTarget = CameraPose | PerspectiveCamera | OrthographicCamera | IProjection | Object3D;

export interface CameraRigOptions {
  /** The largest pitch up or down, in radians, above 0 and up to `Math.PI / 2`. Default 85° (`Math.PI * 85 / 180`). */
  pitchLimit?: number;
  /** The easing of `moveTo()` where the call names none, and of `reframe()`. Default `'ease-in-out'`. */
  easing?: Easing;
}

export interface CameraMoveOptions {
  /** The easing of this move. Default: the easing of the rig, `'ease-in-out'` unless its options name another. */
  easing?: Easing;
  /**
   * For an `Object3D` target: where the camera stands relative to the object, on the axes of the
   * frame — x and y, and optionally a distance. Default `[0, 0]`. Checked, and not used by a pose.
   */
  offset?: readonly [number, number] | readonly [number, number, number];
  /**
   * For an `Object3D` target: a time constant in seconds by which the camera trails the object once
   * locked on, critically damped. Default `0`. Checked, and not used by a pose.
   */
  smooth?: number;
  /** The distance of the focus plane for a move between a perspective and an orthographic lens. Checked, and not used by a pose. */
  focus?: number;
  /** The depth of the scene in front of and behind the focus plane, for the same move. Checked, and not used by a pose. */
  depth?: number;
}

const DEFAULT_PITCH_LIMIT = (Math.PI * 85) / 180;

// V8 boxes a fraction handed to a call it does not inline, and one such a call answers; a fraction
// in a field or a typed array stays as it is. So the hot path of the rig keeps its fractions there:
// the progress of a move goes through `blendProgress` into the blend, the one of the lift through
// `liftProgress`, each eased in place, and the aspect through `writeAspect` into the write.
const liftProgress = new Float64Array(1);
// the turn of a look, as a quaternion handed to fromArray(): setFromAxisAngle() takes the angle as
// an argument
const turnSlot = new Float64Array(4);

const RAD_PER_DEG = Math.PI / 180;

const kindOf = (camera: Camera): CameraShotKind | undefined => {
  if ((camera as PerspectiveCamera).isPerspectiveCamera === true) return 'perspective';
  if ((camera as OrthographicCamera).isOrthographicCamera === true) return 'orthographic';
  return undefined;
};

// the rig is the camera driver of its stage; it does not name StageCameraDriver, which stays out of
// the published declarations, and Stage2DInternals.attachDriver(stage, this) holds it to that contract

/**
 * Moves the camera of a `Stage2D`: it resolves targets — poses in the frame of the projection — into
 * shots, blends them, and writes the result into a camera of its own, which the stage draws with
 * while the rig is attached. The projection keeps its job: it fits the view into the container and
 * places a base camera of the rig's, the rest every pose is given relative to; a resize, a new fit
 * and a new projection re-frame the pose by themselves.
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
  readonly #stage: Stage2D;
  readonly #pitchLimit: number;
  readonly #easing: EasingSpec;

  readonly #perspective = new PerspectiveCamera();
  readonly #orthographic = new OrthographicCamera();
  #camera: PerspectiveCamera | OrthographicCamera;

  // the base camera the projection places, the frame of its plane and the rest read from the base
  #base?: PerspectiveCamera | OrthographicCamera;
  #baseKind: CameraShotKind = 'perspective';
  #hasRest = false;
  readonly #origin = new Vector3();
  readonly #right = new Vector3(1, 0, 0);
  readonly #up = new Vector3(0, 1, 0);
  readonly #normal = new Vector3(0, 0, 1);
  readonly #restPosition = new Vector3();
  readonly #restQuaternion = new Quaternion();
  #restDistance = 0;
  #baseLens = 1;
  #baseNear = 0.1;
  #baseFar = 100000;
  #aspect = 1;

  // the target: a pose, or after cancel() the shot a move stood at, its lens kept as a zoom
  readonly #pose = createPoseValues();
  readonly #nextPose = createPoseValues();
  #holding = false;
  #holdingTurn = false;
  readonly #held = createShot();
  #yaw = 0;
  #pitch = 0;

  // the move: from the shot the camera showed at its start, its lens kept as a zoom on the base
  #moving = false;
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
  readonly #turn = new Quaternion();

  #disposed = false;

  /**
   * Attaches the rig to `stage`, which draws with the camera of the rig from now on: a
   * `PerspectiveCamera` under a `ParallaxProjection`, an `OrthographicCamera` under an
   * `OrthographicProjection`. The rig starts at the rest of the projection — the placement the
   * projection gives a camera by itself —, and places its camera right away if the stage has a
   * view.
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
    this.#camera = stage.projection instanceof OrthographicProjection ? this.#orthographic : this.#perspective;

    try {
      Stage2DInternals.attachDriver(stage, this);
    } catch (error) {
      // the stage has the rig attached by the time a listener throws: it goes back to the camera it
      // had, and the caller, who gets no rig, has nothing to dispose
      this.#disposed = true;
      const errors: unknown[] = [error];
      if (Stage2DInternals.driverOf(stage) === this) {
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
   * `ParallaxProjection`, an `OrthographicCamera` under an `OrthographicProjection`. A new projection
   * of the other kind swaps it, and the stage announces the swap through
   * `OnStageAfterCameraChanged`. After {@link dispose} it answers the camera it was left with.
   */
  get camera(): PerspectiveCamera | OrthographicCamera {
    return this.#camera;
  }

  /** `true` while a move is under way; `false` after {@link dispose}. */
  get busy(): boolean {
    return this.#moving;
  }

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Puts the camera on `target` at once; it ends a running move, whose promise resolves. The target
   * brings its own look — the `look` of the pose, 0 where it gives none. A pose object the caller
   * keeps and rewrites may be handed in every frame: the rig reads it in the call and allocates
   * nothing.
   *
   * @throws {TypeError} for a target of a kind this version does not take — a camera, a projection,
   * an `Object3D` — and for a pose of another shape.
   * @throws {RangeError} for a number of the pose that is not finite, a `zoom` that is not above 0
   * and a `look` other than 0 under an `OrthographicProjection`.
   */
  jump(target: CameraTarget): void {
    const subject = 'CameraRig#jump()';
    this.#assertAlive(subject);
    this.#readTarget(subject, target, this.#pose);
    this.#endMove();
    this.#holding = false;
    this.#takeLookOfPose();
  }

  /**
   * Moves the camera from the shot it shows now to `target` in `seconds`, eased: position, look and
   * zoom. Both ends are resolved in every frame, relative to the fit, so a resize during the move
   * re-frames both. The target brings its own look, as for {@link jump}. A move that overtakes a
   * running one starts where that one stands.
   *
   * The promise resolves on arrival, and also when the move ends otherwise — {@link cancel}, a
   * {@link jump}, an overtaking `moveTo()`, {@link dispose} —, so code that awaits the camera is
   * released. It never rejects; a refusal throws from the call. `seconds` of 0 arrives at once.
   *
   * @throws {TypeError} and {@link RangeError} for a target as {@link jump} refuses it, for
   * `seconds` that is not a finite number of 0 or more, an `easing` that is not one, and an option
   * of {@link CameraMoveOptions} that is not a number of its kind.
   */
  moveTo(target: CameraTarget, seconds: number, options?: CameraMoveOptions): Promise<void> {
    const subject = 'CameraRig#moveTo()';
    this.#assertAlive(subject);
    assertFiniteAtLeast(seconds, subject, 'seconds', 0);
    const easing = this.#readMoveOptions(subject, options);
    this.#readTarget(subject, target, this.#nextPose);

    // the start is the shot the camera shows now, a running move included; without a view it is
    // taken from the target once a view comes
    const fromReady = this.#hasRest;
    if (fromReady) this.#resolve(this.#from);
    this.#endMove();
    copyPoseValues(this.#nextPose, this.#pose);
    this.#holding = false;
    this.#takeLookOfPose();

    if (seconds === 0) return Promise.resolve();

    this.#moving = true;
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
   * @throws {TypeError} for a `look` that is not an object with `yaw` and `pitch`.
   * @throws {RangeError} for a yaw or a pitch that is not finite, and for a look other than 0 under
   * an `OrthographicProjection`.
   */
  look(look: {yaw: number; pitch: number}): void {
    const subject = 'CameraRig#look()';
    this.#assertAlive(subject);
    const values = this.#nextPose;
    readLook(subject, look, this.#isOrthographic(), values);
    this.#yaw = values.yaw;
    this.#pitch = values.pitch;
    this.#clampPitch();
    // a shot held by cancel() takes the look from here on, about its rest
    this.#holdingTurn = false;
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
   * Ends a running move where it stands: the camera holds that shot — its lens as a factor on the fit
   * — until the next target, and a {@link look} turns it about the rest. The promise of the move
   * resolves. Does nothing while the camera stands.
   */
  cancel(): void {
    this.#assertAlive('CameraRig#cancel()');
    if (!this.#moving) return;
    if (this.#hasRest) {
      this.#resolve(this.#held);
      this.#holding = true;
      this.#holdingTurn = true;
    }
    this.#endMove();
  }

  /**
   * Advances the clocks of the rig — a move, a reframe — by `deltaSeconds` and resolves the shot of
   * the frame. Answers the `Motion` of drawing on demand: `true` when that shot differs from the one
   * the step before resolved, `false` otherwise, and `false` on a stage without a view or one that
   * has been disposed. A move that arrives resolves its promise here. As a frame step:
   * `pacer.onFrame((frame) => rig.step(frame.deltaTime), stage)`. The camera itself is written in
   * the frame of the stage, so the order of `step()` and `updateFrame()` does not matter.
   * Allocates nothing.
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

    if (this.#moving) {
      this.#elapsed += deltaSeconds;
      if (this.#elapsed >= this.#duration) this.#endMove();
    }
    if (this.#lifting) {
      this.#liftElapsed += deltaSeconds;
      if (this.#liftElapsed >= this.#liftDuration) {
        this.#lifting = false;
        this.#lift = this.#liftTo;
      }
    }

    if (!this.#hasRest || this.#stage.isDisposed) return false;
    this.#resolve(this.#current);
    if (shotsEqual(this.#current, this.#stepped)) return false;
    copyShot(this.#current, this.#stepped);
    return true;
  }

  /**
   * Detaches the rig from the stage, which goes back to the camera it had — one assigned to
   * `stage.camera`, or the projection's — and places it. A running move ends, and its promise
   * resolves. The stage stays the caller's. Afterwards every method but `dispose()` throws; `stage`,
   * `camera` and `busy` answer what they held. A second call does nothing. What a listener of the
   * stage throws while it takes its camera back comes out of this call once the rig is down.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#endMove();
    this.#lifting = false;
    // a stage that went on to another rig keeps it
    if (Stage2DInternals.driverOf(this.#stage) === this) Stage2DInternals.detachDriver(this.#stage);
  }

  /**
   * Lets `projection` place the base camera of the rig and answers it; called by the stage. The base
   * is of the kind the projection builds and is never drawn with. Not for use outside the stage.
   * @internal
   */
  placeBase(projection: IProjection): Camera {
    let base = this.#base;
    const wanted =
      projection instanceof ParallaxProjection
        ? 'perspective'
        : projection instanceof OrthographicProjection
          ? 'orthographic'
          : undefined;
    if (base !== undefined && (wanted === undefined || wanted === this.#baseKind)) {
      projection.updateCamera(base);
    } else {
      const created = projection.createCamera();
      const kind = kindOf(created);
      if (kind === undefined) {
        throw new TypeError(
          `CameraRig: the projection of the stage builds a ${describeThreeValue(created, 'isObject3D')}, not a PerspectiveCamera or an OrthographicCamera`,
        );
      }
      base = created as PerspectiveCamera | OrthographicCamera;
      this.#base = base;
      this.#baseKind = kind;
    }

    // the frame poses are given in: the plane, or the world for a projection without one
    const plane = projection.projectionPlane;
    if (plane != null) {
      plane.getOrigin(this.#origin);
      plane.getRight(this.#right).normalize();
      this.#up.copy(plane.up).normalize();
      this.#normal.copy(plane.plane.normal).normalize();
    } else {
      this.#origin.set(0, 0, 0);
      this.#right.set(1, 0, 0);
      this.#up.set(0, 1, 0);
      this.#normal.set(0, 0, 1);
    }
    return base;
  }

  /**
   * Reads the rest from the base the projection placed and the listeners of `OnStageCameraPlaced`
   * changed, and writes the camera; called by the stage after every placement. Swaps the camera for
   * one of the kind of the base and has the stage announce it. Does nothing on a disposed stage.
   * Allocates nothing without a swap. Not for use outside the stage.
   * @internal
   */
  compose(): void {
    const base = this.#base;
    if (base === undefined || this.#disposed || this.#stage.isDisposed) return;

    const p = this.#restPosition.copy(base.position);
    this.#restQuaternion.copy(base.quaternion);
    const o = this.#origin;
    const n = this.#normal;
    this.#restDistance = (p.x - o.x) * n.x + (p.y - o.y) * n.y + (p.z - o.z) * n.z;
    // the lens of the base — tan(fov / 2) after the zoom, or the height of the view —, inline: a
    // call that V8 does not inline boxes the fraction it answers
    if (this.#baseKind === 'perspective') {
      const perspective = base as PerspectiveCamera;
      this.#baseLens = Math.tan((perspective.fov * RAD_PER_DEG) / 2) / perspective.zoom;
    } else {
      const ortho = base as OrthographicCamera;
      this.#baseLens = (ortho.top - ortho.bottom) / ortho.zoom;
    }
    this.#baseNear = base.near;
    this.#baseFar = base.far;
    if (this.#baseKind === 'perspective') {
      this.#aspect = (base as PerspectiveCamera).aspect;
    } else {
      const ortho = base as OrthographicCamera;
      this.#aspect = (ortho.right - ortho.left) / (ortho.top - ortho.bottom);
    }
    this.#hasRest = true;

    const camera = this.#baseKind === 'perspective' ? this.#perspective : this.#orthographic;
    if (camera !== this.#camera) {
      this.#camera = camera;
      this.#writeNow();
      Stage2DInternals.announceCamera(this.#stage);
      return;
    }
    this.#writeNow();
  }

  /**
   * Writes the camera for the frame from the state of the rig; called by the stage in every
   * `updateFrame()`, before `OnStageUpdateFrame`. Does nothing on a disposed stage or before the
   * first placement. Allocates nothing. Not for use outside the stage.
   * @internal
   */
  write(): void {
    if (!this.#hasRest || this.#disposed || this.#stage.isDisposed) return;
    this.#writeNow();
  }

  #writeNow(): void {
    this.#resolve(this.#current);
    writeAspect[0] = this.#aspect;
    writeShotAtAspect(this.#current, this.#base!, this.#camera);
  }

  // the shot the rig shows with the clocks where they stand, into `out`
  #resolve(out: CameraShot): void {
    const to = this.#to;
    this.#resolveTarget(to);
    if (this.#moving) {
      const from = this.#from;
      if (this.#fromPending) {
        copyShot(to, from);
        this.#fromPending = false;
      }
      // the start keeps its lens relative to the fit: the lens of the base of this frame
      from.kind = this.#baseKind;
      from.lens = this.#baseLens / from.zoom;
      const t = this.#elapsed / this.#duration;
      blendProgress[0] = Math.min(t, 1);
      applyEasingInPlace(this.#moveEasing, blendProgress);
      blendShotsAtProgress(from, to, out);
    } else {
      copyShot(to, out);
    }
    this.#updateLift();
    out.lift = this.#liftShown;
  }

  // the target as it resolves against the base of this frame, into `out`
  #resolveTarget(out: CameraShot): void {
    const pose = this.#pose;
    const held = this.#held;
    const holding = this.#holding;
    const p = out.position;

    if (holding) {
      p.copy(held.position);
    } else if (pose.hasPosition) {
      // relative to the rest: x and y along the axes of the plane, the distance along its normal
      const along = pose.hasDistance && this.#baseKind === 'perspective' ? pose.distance - this.#restDistance : 0;
      const rest = this.#restPosition;
      const r = this.#right;
      const u = this.#up;
      const n = this.#normal;
      const x = pose.x;
      const y = pose.y;
      p.x = rest.x + r.x * x + u.x * y + n.x * along;
      p.y = rest.y + r.y * x + u.y * y + n.y * along;
      p.z = rest.z + r.z * x + u.z * y + n.z * along;
    } else {
      p.copy(this.#restPosition);
    }

    const q = out.quaternion;
    if (holding && this.#holdingTurn) {
      q.copy(held.quaternion);
    } else {
      q.copy(this.#restQuaternion);
      const turn = turnSlot;
      if (this.#yaw !== 0) {
        // about the up axis of the frame, in the world: premultiplied
        const half = this.#yaw / 2;
        const sin = Math.sin(half);
        const up = this.#up;
        turn[0] = up.x * sin;
        turn[1] = up.y * sin;
        turn[2] = up.z * sin;
        turn[3] = Math.cos(half);
        q.premultiply(this.#turn.fromArray(turn));
      }
      if (this.#pitch !== 0) {
        // about the right axis of the camera, in its own space: multiplied
        const half = this.#pitch / 2;
        turn[0] = Math.sin(half);
        turn[1] = 0;
        turn[2] = 0;
        turn[3] = Math.cos(half);
        q.multiply(this.#turn.fromArray(turn));
      }
    }

    const zoom = holding ? held.zoom : pose.zoom;
    out.kind = this.#baseKind;
    out.zoom = zoom;
    out.lens = this.#baseLens / zoom;
    out.near = holding ? held.near : this.#baseNear;
    out.far = holding ? held.far : this.#baseFar;
    out.lift = 0;
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
    const pose = this.#pose;
    this.#yaw = pose.hasLook ? pose.yaw : 0;
    this.#pitch = pose.hasLook ? pose.pitch : 0;
    this.#clampPitch();
  }

  // in place, on the field: a fraction handed across a call or answered by one may be boxed
  #clampPitch(): void {
    const limit = this.#pitchLimit;
    const pitch = this.#pitch;
    if (pitch > limit) this.#pitch = limit;
    else if (pitch < -limit) this.#pitch = -limit;
  }

  #endMove(): void {
    this.#moving = false;
    this.#fromPending = false;
    const settle = this.#settle;
    this.#settle = undefined;
    settle?.();
  }

  #isOrthographic(): boolean {
    const projection = this.#stage.projection;
    if (projection instanceof OrthographicProjection) return true;
    if (projection instanceof ParallaxProjection) return false;
    return this.#hasRest && this.#baseKind === 'orthographic';
  }

  #readTarget(subject: string, target: unknown, out: PoseValues): void {
    if (typeof target === 'object' && target !== null) {
      if ((target as Partial<Object3D>).isObject3D === true) {
        throw new TypeError(
          `${subject}: a target of this kind is not supported yet, got ${describeThreeValue(target, 'isObject3D')}`,
        );
      }
      if (typeof (target as Partial<IProjection>).updateViewRect === 'function') {
        throw new TypeError(`${subject}: a projection as a target is not supported yet`);
      }
    }
    readPose(subject, target, this.#isOrthographic(), out);
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

  #assertAlive(subject: string): void {
    if (this.#disposed) throw new Error(`${subject}: the rig has been disposed`);
  }
}
