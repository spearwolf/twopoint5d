import {Matrix4, type Object3D, Quaternion, Vector3} from 'three/webgpu';
import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {describeValue} from '../utils/describeValue.js';
import {applyEasingInPlace, type Easing, type EasingSpec, easingOf} from '../utils/easing.js';
import type {CameraTarget} from './CameraRig.js';
import type {Rest} from './cameraRest.js';
import {blendProgress, blendShotsAtProgress, type CameraShot, type CameraShotKind, copyShot, createShot} from './cameraShot.js';
import {applyLook, createLook, type Look} from './cameraTarget.js';
import {blendLensChangeAtProgress, createLensChange, type LensChange} from './lensChange.js';
import type {Stage2D} from './Stage2D.js';
import {StageTransition, StageTransitionInternals} from './StageTransition.js';

/** The options of `CameraRig.across()`. */
export interface CameraFlightOptions {
  /**
   * Where the camera of `to` ends, in the world of `to`: a pose in the frame of its projection, a
   * camera, a projection — assigned to the stage of `to` once the rig takes over — or any other
   * `Object3D`, as `CameraRig#jump()` takes them. Default: the shot the rig of `to` holds when the
   * flight starts.
   */
  to?: CameraTarget;
  /**
   * Two objects whose world frames are the same place: the first in the world of `from`, the second
   * in the world of `to` — a marker on a map, and the origin of the city it marks. Read anew in
   * every frame. Their translation, rotation and a scale even on the three axes carry the shot from
   * one world into the other; the scale carries the position, near, far, the focus and the height of
   * an orthographic view. Default: the two worlds share their coordinates.
   */
  anchors?: readonly [Object3D, Object3D];
  /** An easing over the progress of the transition. Default `'linear'`: the transition's own easing alone. */
  easing?: Easing;
  /**
   * The distance of the focus plane of a lens change across the flight — perspective on one side,
   * orthographic on the other —, in the world of `from`. Needed where a side has no projection
   * plane; the distance to the plane wins where it has one.
   */
  focus?: number;
}

/** A camera flight across a transition, as `CameraRig.across()` answers it. */
export interface CameraFlight {
  /** The transition the flight follows. */
  readonly transition: StageTransition;
  /**
   * Resolves once the flight is over — with its transition, when the rig of `to` has taken over or
   * both rigs have gone back, or when one of its rigs is disposed —, and never rejects.
   */
  readonly finished: Promise<void>;
}

/** The side of a flight a rig takes. @internal */
export type FlightRole = 'from' | 'to';

/** What a lens and a focus plane a side of a flight shows. @internal */
export interface FlightEnd {
  kind: CameraShotKind;
  /** Whether the frame of that side has a projection plane to take the focus from. */
  hasPlane: boolean;
  /** Whether the end is a camera as the target. */
  camera: boolean;
}

/**
 * What the `CameraRig` of a stage offers a flight: the flight reads the rig through it and hands it
 * the shot of each frame. Not part of the public API.
 * @internal
 */
export interface FlightSide {
  readonly stage: Stage2D;
  /** Whether the rig takes part in a flight. */
  inFlight(): boolean;
  /** Whether the rig has the rest of a view to resolve its shots against. */
  hasRest(): boolean;
  /** The rest of the projection of the stage. */
  readonly rest: Rest;
  /** The rest the shot of the rig resolves on now: of the projection its target is, or of the stage. */
  targetRest(): Rest;
  /** The shot of the rig as if there were no flight, with its clocks where they stand, into `out`. */
  resolveOwn(out: CameraShot): void;
  /** {@link resolveOwn}, its lens kept as a zoom on the rest of the stage. */
  resolveStart(out: CameraShot): void;
  /** The larger side of the container into `change.containerSize`. */
  containerInto(change: LensChange): void;
  /** The lens of `target`, or of the shot the rig shows where it is `undefined`; throws what `subject` refuses in the target. */
  readEnd(subject: string, target: CameraTarget | undefined): FlightEnd;
  /**
   * Takes part in `flight`: a running move ends where it stands and its promise resolves; with a
   * `target` the rig takes it as its own, keeping the state it had to go back to.
   */
  join(flight: Flight, role: FlightRole, target: CameraTarget | undefined): void;
  /** Leaves the flight: with `take` it holds its target, `look` added to its look; otherwise it goes back to the state it had. */
  leave(take: boolean, look: Look): void;
}

/**
 * Starts a flight across `transition` between the rigs `sideOf()` finds for its stages, or throws
 * what `CameraRig.across()` refuses. @internal
 */
export function startFlight(
  transition: unknown,
  options: CameraFlightOptions | undefined,
  sideOf: (stage: unknown) => FlightSide | undefined,
): CameraFlight {
  const subject = 'CameraRig.across()';
  if (!(transition instanceof StageTransition)) {
    throw new TypeError(`${subject}: transition must be a StageTransition, got ${describeValue(transition)}`);
  }
  if (transition.isOver) throw new Error(`${subject}: the transition is over`);
  const fromStage = transition.from;
  const toStage = transition.to;
  if (fromStage === undefined) {
    throw new Error(`${subject}: the transition comes from nothing; a flight needs a stage on both sides`);
  }
  if (toStage === undefined) {
    throw new Error(`${subject}: the transition goes to nothing; a flight needs a stage on both sides`);
  }
  const from = sideOf(fromStage);
  if (from === undefined) {
    throw new Error(`${subject}: the stage ${describeValue(fromStage.name)} the transition leaves has no CameraRig`);
  }
  const to = sideOf(toStage);
  if (to === undefined) {
    throw new Error(`${subject}: the stage ${describeValue(toStage.name)} the transition brings has no CameraRig`);
  }
  for (const side of [from, to]) {
    if (side.inFlight()) {
      throw new Error(`${subject}: the CameraRig of the stage ${describeValue(side.stage.name)} takes part in a flight already`);
    }
  }

  if (options !== undefined && (typeof options !== 'object' || options === null)) {
    throw new TypeError(`${subject}: options must be an object, got ${describeValue(options)}`);
  }
  const easing = easingOf(subject, options?.easing ?? 'linear');
  const focus = options?.focus;
  if (focus !== undefined) assertPositiveFinite(focus, subject, 'focus');
  const anchors = options?.anchors === undefined ? undefined : readAnchors(subject, options.anchors);
  const target = options?.to;

  // a lens change needs the distance of its focus plane on both sides: a plane, or the option
  const end = to.readEnd(subject, target);
  const start = from.readEnd(subject, undefined);
  if (start.kind !== end.kind && focus === undefined && !(start.hasPlane && end.hasPlane)) {
    throw new Error(
      `${subject}: a lens change between a perspective and an orthographic camera needs a focus: ${
        end.camera ? 'a camera as the target has' : 'the projection has'
      } no projectionPlane, and the flight names no focus`,
    );
  }

  const flight = new Flight(transition, from, to, easing, focus ?? Number.NaN, anchors);
  // `to` first: what the projection of its target throws as the rig places it refuses the flight
  // before anything has changed — a running move of either rig ends only after that
  to.join(flight, 'to', target);
  from.join(flight, 'from', undefined);
  flight.check();
  return flight;
}

// the column lengths of the scale between the anchors may differ by this share of the largest
const EVEN_SCALE_EPSILON = 1e-6;

function readAnchors(subject: string, anchors: unknown): readonly [Object3D, Object3D] {
  const isObject3D = (value: unknown) =>
    typeof value === 'object' && value !== null && (value as Partial<Object3D>).isObject3D === true;
  if (!Array.isArray(anchors) || anchors.length !== 2 || !isObject3D(anchors[0]) || !isObject3D(anchors[1])) {
    const got = Array.isArray(anchors)
      ? `[${anchors.map((anchor) => describeThreeValue(anchor, 'isObject3D')).join(', ')}]`
      : describeValue(anchors);
    throw new TypeError(
      `${subject}: anchors must be a pair of Object3D, the first in the world of from, the second in the world of to, got ${got}`,
    );
  }
  const [a, b] = anchors as [Object3D, Object3D];
  a.updateWorldMatrix(true, false);
  b.updateWorldMatrix(true, false);
  const m = new Matrix4().copy(a.matrixWorld).invert().premultiply(b.matrixWorld);
  const e = m.elements;
  const sx = Math.hypot(e[0]!, e[1]!, e[2]!);
  const sy = Math.hypot(e[4]!, e[5]!, e[6]!);
  const sz = Math.hypot(e[8]!, e[9]!, e[10]!);
  const largest = Math.max(sx, sy, sz);
  if (!(largest > 0) || largest - Math.min(sx, sy, sz) > EVEN_SCALE_EPSILON * largest) {
    throw new RangeError(
      `${subject}: the anchors must be scaled evenly on their three axes, got a scale of ${describeValue([sx, sy, sz])} between them`,
    );
  }
  if (m.determinant() < 0) {
    throw new RangeError(`${subject}: the anchors must not be mirrored against each other, a camera cannot be`);
  }
  return [a, b];
}

/**
 * A flight across a transition, between the rig of `from` and the rig of `to`. Each rig resolves its
 * shot through {@link resolve} while it takes part, and asks {@link check} in its step and in the
 * frame of its stage whether the transition is over. Not part of the public API; the caller holds
 * it as a {@link CameraFlight}.
 *
 * There is one blended shot, in the world of `from`: from the shot the rig of `from` showed at the
 * start of the flight to the target of `to`, carried into the world of `from` through the inverse of
 * `M = anchorTo.matrixWorld · anchorFrom.matrixWorld⁻¹`; the rig of `to` shows it carried through `M`.
 * @internal
 */
export class Flight implements CameraFlight {
  readonly transition: StageTransition;
  readonly finished: Promise<void>;
  #settle!: () => void;

  readonly #from: FlightSide;
  readonly #to: FlightSide;
  readonly #easing: EasingSpec;
  // in the world of `from`; NaN for none
  readonly #focus: number;
  readonly #anchors: readonly [Object3D, Object3D] | undefined;

  // M, its inverse, their rotations and their scale: [s, 1 / s], read anew in every resolve
  readonly #matrix = new Matrix4();
  readonly #inverse = new Matrix4();
  readonly #rotation = new Quaternion();
  readonly #inverseRotation = new Quaternion();
  readonly #translation = new Vector3();
  readonly #scale = new Vector3();
  readonly #scales = new Float64Array([1, 1]);

  // the look of the flight, which lies on top of the blend
  readonly #look = createLook();

  readonly #start = createShot();
  #startPending = true;
  readonly #end = createShot();
  readonly #endFrom = createShot();
  readonly #blend = createShot();
  readonly #change = createLensChange();
  // the progress of the transition, eased in place: a fraction handed across a call may be boxed
  readonly #progress = new Float64Array(1);

  #over = false;
  #warned = false;

  constructor(
    transition: StageTransition,
    from: FlightSide,
    to: FlightSide,
    easing: EasingSpec,
    focus: number,
    anchors: readonly [Object3D, Object3D] | undefined,
  ) {
    this.transition = transition;
    this.#from = from;
    this.#to = to;
    this.#easing = easing;
    this.#focus = focus;
    this.#anchors = anchors;
    this.finished = new Promise<void>((resolve) => {
      this.#settle = resolve;
    });
    // the frame of a stage notices the end first; a transition no stage of the flight is drawn
    // after — a director disposed — ends it here. The promise never rejects; what the end throws —
    // a listener of the stage of `to` as it takes a projection — goes out as an unhandled rejection
    void transition.finished.then(() => this.check());
  }

  /** Lays `look` over the flight, on both rigs; its pitch clamped by the rig that hands it in. Allocates nothing. */
  look(look: Look): void {
    this.#look.yaw = look.yaw;
    this.#look.pitch = look.pitch;
  }

  /**
   * Ends the flight once its transition is over: the rig of `to` takes its target over where the
   * transition finished or left `to` in its slot, otherwise it goes back to its state; the rig of
   * `from` goes back to its state. Warns once while a layer of the flight is frozen. Allocates
   * nothing while the transition runs.
   */
  check(): void {
    if (this.#over) return;
    const transition = this.transition;
    if (transition.isOver) {
      this.#finish(transition.state === 'finished' || StageTransitionInternals.keptOf(transition) === 'to');
      return;
    }
    if (!this.#warned) {
      const from = this.#from.stage;
      const to = this.#to.stage;
      const frozen = StageTransitionInternals.isFrozen(transition, from)
        ? from
        : StageTransitionInternals.isFrozen(transition, to)
          ? to
          : undefined;
      if (frozen !== undefined) {
        this.#warned = true;
        // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
        console.warn(
          `CameraRig.across(): the layer of the stage ${describeValue(frozen.name)} is frozen: it shows a still picture, not the flight`,
        );
      }
    }
  }

  /** The rig of `side` was disposed: the other rig goes back to its state, and the flight is over. */
  drop(side: FlightSide): void {
    if (this.#over) return;
    this.#over = true;
    try {
      (side === this.#from ? this.#to : this.#from).leave(false, this.#look);
    } finally {
      this.#settle();
    }
  }

  /**
   * The shot of the frame for the rig of `role` into `out`, without its lift. Answers `true` where
   * `out` is the rig's own shot — the target of `to` at the end of the flight, or the shot of a rig
   * while a side has no view yet —, which the rig writes over a base of its own. Allocates nothing.
   */
  resolve(role: FlightRole, out: CameraShot): boolean {
    const from = this.#from;
    const to = this.#to;
    if (!from.hasRest() || !to.hasRest()) {
      // a side without a view: each rig shows its own shot until both have one
      (role === 'from' ? from : to).resolveOwn(out);
      return true;
    }

    const restA = from.rest;
    const start = this.#start;
    if (this.#startPending) {
      from.resolveStart(start);
      this.#startPending = false;
    }
    // the start keeps its lens relative to the fit, as the start of a move does
    if (start.kind === restA.kind) start.lens = restA.lens / start.zoom;

    this.#readAnchors();
    const end = this.#end;
    to.resolveOwn(end);

    const progress = this.#progress;
    progress[0] = this.transition.progress;
    applyEasingInPlace(this.#easing, progress);
    const e = progress[0]!;
    const look = this.#look;
    const turned = look.yaw !== 0 || look.pitch !== 0;
    // the look lies on a perspective blend alone: an orthographic camera takes no look other than 0
    if (role === 'to' && e >= 1 && (!turned || end.kind === 'orthographic')) {
      copyShot(end, out);
      return true;
    }

    const endFrom = this.#endFrom;
    this.#carry(end, true, endFrom);
    const blend = this.#blend;
    blendProgress[0] = e;
    if (start.kind === endFrom.kind) {
      blendShotsAtProgress(start, endFrom, blend);
    } else {
      this.#prepareLensChange(start, endFrom, end);
      blendLensChangeAtProgress(start, endFrom, this.#change, blend);
    }
    if (turned && blend.kind === 'perspective') applyLook(restA.up, look, blend.quaternion);

    if (role === 'from') copyShot(blend, out);
    else this.#carry(blend, false, out);
    return false;
  }

  #finish(take: boolean): void {
    this.#over = true;
    try {
      this.#from.leave(false, this.#look);
      this.#to.leave(take, this.#look);
    } finally {
      this.#settle();
    }
  }

  // M and its inverse, read from the anchors where they stand now. Allocates nothing
  #readAnchors(): void {
    const anchors = this.#anchors;
    if (anchors === undefined) return;
    const a = anchors[0];
    const b = anchors[1];
    a.updateWorldMatrix(true, false);
    b.updateWorldMatrix(true, false);
    const m = this.#matrix.copy(a.matrixWorld).invert().premultiply(b.matrixWorld);
    m.decompose(this.#translation, this.#rotation, this.#scale);
    // the scale is refused uneven at the start; an anchor that becomes uneven later counts by the
    // mean of its three axes
    const scale = this.#scale;
    const s = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3;
    const scales = this.#scales;
    scales[0] = s;
    scales[1] = 1 / s;
    this.#inverse.copy(m).invert();
    this.#inverseRotation.copy(this.#rotation).invert();
  }

  // `shot` carried through M into the world of `to`, or through its inverse into the world of
  // `from`, into `out`: the scale carries position, near, far and the height of an orthographic view
  #carry(shot: CameraShot, inverse: boolean, out: CameraShot): void {
    copyShot(shot, out);
    if (this.#anchors === undefined) return;
    out.position.applyMatrix4(inverse ? this.#inverse : this.#matrix);
    out.quaternion.premultiply(inverse ? this.#inverseRotation : this.#rotation);
    const s = this.#scales[inverse ? 1 : 0]!;
    if (out.kind === 'orthographic') out.lens *= s;
    out.near *= s;
    out.far *= s;
  }

  // the distances of the two ends to their focus planes, in the world of `from`: to the projection
  // plane of each side where it has one, otherwise the focus of the flight. Inline: a call that V8
  // does not inline boxes the fraction it answers
  #prepareLensChange(start: CameraShot, endFrom: CameraShot, end: CameraShot): void {
    const change = this.#change;
    const focus = this.#focus;

    const restA = this.#from.targetRest();
    let p = start.position;
    let o = restA.origin;
    let n = restA.normal;
    let distance = restA.hasPlane ? (p.x - o.x) * n.x + (p.y - o.y) * n.y + (p.z - o.z) * n.z : focus;
    if (start.kind === 'perspective' ? !(distance > 0) : Number.isNaN(distance)) distance = focus > 0 ? focus : 1;
    change.focusA = distance;

    // measured in the world of `to`, and carried into the world of `from` by the scale
    const restB = this.#to.targetRest();
    p = end.position;
    o = restB.origin;
    n = restB.normal;
    distance = restB.hasPlane ? ((p.x - o.x) * n.x + (p.y - o.y) * n.y + (p.z - o.z) * n.z) * this.#scales[1]! : focus;
    if (endFrom.kind === 'perspective' ? !(distance > 0) : Number.isNaN(distance)) distance = focus > 0 ? focus : 1;
    change.focusB = distance;

    change.depth = Number.NaN;
    this.#from.containerInto(change);
  }
}
