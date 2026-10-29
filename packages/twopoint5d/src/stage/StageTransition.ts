import {describeValue} from '../utils/describeValue.js';
import type {IStage} from './IStage.js';
import type {StageTransitionEffect} from './transitionEffects.js';

/** A named easing of a transition, or a function from the linear progress `0…1` to the eased one. */
export type StageTransitionEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | ((t: number) => number);

/** Where a transition stands: before its first frame, between its first and its last, or over. */
export type StageTransitionState = 'pending' | 'running' | 'finished' | 'cancelled';

const EASING_NAMES = ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const;

/**
 * An easing as a transition keeps it: the index of a named one in `EASING_NAMES`, or the function of
 * the caller.
 * @internal
 */
export type StageTransitionEasingSpec = number | ((t: number) => number);

/**
 * The easing an option names, or the function it is. Throws a `TypeError` naming `subject` for
 * anything else.
 * @internal
 */
export function easingOf(subject: string, easing: unknown): StageTransitionEasingSpec {
  if (typeof easing === 'function') return easing as (t: number) => number;
  const index = typeof easing === 'string' ? EASING_NAMES.indexOf(easing as (typeof EASING_NAMES)[number]) : -1;
  if (index === -1) {
    throw new TypeError(
      `${subject}: easing must be 'linear', 'ease-in', 'ease-out', 'ease-in-out' or a function, got ${describeValue(easing)}`,
    );
  }
  return index;
}

/** How one frame moved a transition, as `StageDirector#updateFrame()` acts on it. @internal */
export type StageTransitionStep = 'none' | 'started' | 'reached-end' | 'reached-start';

/** What a `StageDirector` does when a transition is ended from its handle. @internal */
export interface StageTransitionHost {
  end(transition: StageTransition, keep: 'from' | 'to', state: 'finished' | 'cancelled'): void;
}

/** @internal */
export interface StageTransitionInit {
  from: IStage | undefined;
  to: IStage | undefined;
  effect: StageTransitionEffect;
  duration: number;
  delay: number;
  easing: StageTransitionEasingSpec;
  manual: boolean;
}

// what StageTransitionInternals.create() hands the constructor, which takes no arguments: the
// declaration of the class names no type that is internal to the library
let pendingInit: StageTransitionInit | undefined;
let pendingHost: StageTransitionHost | undefined;

/**
 * The functions through which a `StageDirector` drives the transitions it made; they are not part of
 * the public API.
 * @internal
 */
export const StageTransitionInternals = {} as {
  create(init: StageTransitionInit, host: StageTransitionHost | undefined): StageTransition;
  advance(transition: StageTransition, deltaTime: number): StageTransitionStep;
  settle(transition: StageTransition, state: 'finished' | 'cancelled'): void;
};

/**
 * One change of the stack of a `StageDirector`: from a layer, or from nothing, to a layer, or to
 * nothing, through an effect. Every method of the director that changes the stack answers one; a
 * change without a transition answers one that has finished already.
 *
 * `finished` resolves once the transition is over, with the transition, whether it finished or was
 * cancelled — `state` says which —, and never rejects: a pause menu the player closes before it was
 * in is no error. The stack of the director is in its end state when the promise resolves.
 */
export class StageTransition {
  /** The stage the transition leaves, `undefined` for nothing. */
  readonly from: IStage | undefined;
  /** The stage the transition brings, `undefined` for nothing. */
  readonly to: IStage | undefined;
  readonly effect: StageTransitionEffect;
  /** In seconds; `0` for a change without a transition. */
  readonly duration: number;
  /** In seconds. */
  readonly delay: number;
  /** `true` when the caller drives {@link progress}. */
  readonly manual: boolean;

  readonly #easing: StageTransitionEasingSpec;
  #host: StageTransitionHost | undefined;

  #state: StageTransitionState = 'pending';
  #elapsed = 0;
  #waited = 0;
  #seenFrame = false;
  #direction = 1;
  #progress = 0;

  readonly #finished: Promise<StageTransition>;
  #resolve!: (transition: StageTransition) => void;

  static {
    StageTransitionInternals.create = (init, host) => {
      pendingInit = init;
      pendingHost = host;
      try {
        return new StageTransition();
      } finally {
        pendingInit = undefined;
        pendingHost = undefined;
      }
    };
    StageTransitionInternals.advance = (transition, deltaTime) => transition.#advance(deltaTime);
    StageTransitionInternals.settle = (transition, state) => transition.#settle(state);
  }

  /** Made by a `StageDirector` alone: every change of its stack answers one. */
  protected constructor() {
    const init = pendingInit;
    if (!init) throw new Error('StageTransition: a transition is made by a StageDirector, not by new StageTransition()');
    const host = pendingHost;
    this.from = init.from;
    this.to = init.to;
    this.effect = init.effect;
    this.duration = init.duration;
    this.delay = init.delay;
    this.manual = init.manual;
    this.#easing = init.easing;
    this.#host = host;
    this.#finished = new Promise((resolve) => {
      this.#resolve = resolve;
    });
  }

  get state(): StageTransitionState {
    return this.#state;
  }

  /** `true` once the transition has finished or was cancelled. */
  get isOver(): boolean {
    return this.#state === 'finished' || this.#state === 'cancelled';
  }

  /** Seconds since the first frame of the transition, after its delay; it runs back after {@link reverse}. */
  get elapsed(): number {
    return this.#elapsed;
  }

  /**
   * The eased progress, 0 to 1. Writable while the transition is {@link manual}: the value is
   * clamped to `[0, 1]` and drawn from the next frame on. A write to a transition that is not manual
   * throws; a write to one that is over does nothing.
   */
  get progress(): number {
    return this.#progress;
  }

  set progress(value: number) {
    if (!this.manual) {
      throw new Error('StageTransition#progress cannot be written: the transition is not manual — start it with {manual: true}');
    }
    if (this.isOver) return;
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new RangeError(`StageTransition#progress: the progress must be a number, got ${describeValue(value)}`);
    }
    this.#progress = Math.min(1, Math.max(0, value));
  }

  get finished(): Promise<StageTransition> {
    return this.#finished;
  }

  /**
   * Runs the transition back from where it is; once it is back at the start it ends as cancelled,
   * with `from` in its slot. A second call runs it forward again. A transition before its first
   * frame ends as cancelled on the spot; a manual one and one that is over stay as they are.
   */
  reverse(): this {
    if (this.isOver || this.manual) return this;
    if (this.#state === 'pending') {
      this.#host?.end(this, 'from', 'cancelled');
      return this;
    }
    this.#direction = -this.#direction;
    return this;
  }

  /**
   * Ends the transition now, as cancelled: `jumpTo` `'start'`, the default, leaves `from` in its slot,
   * `'end'` leaves `to`. On a transition that is over it does nothing.
   */
  cancel(jumpTo: 'start' | 'end' = 'start'): void {
    if (this.isOver) return;
    if (jumpTo !== 'start' && jumpTo !== 'end') {
      throw new TypeError(`StageTransition#cancel(): jumpTo must be 'start' or 'end', got ${describeValue(jumpTo)}`);
    }
    this.#host?.end(this, jumpTo === 'end' ? 'to' : 'from', 'cancelled');
  }

  /** Ends the transition now, as finished, with `to` in its slot. On a transition that is over it does nothing. */
  complete(): void {
    if (this.isOver) return;
    this.#host?.end(this, 'to', 'finished');
  }

  #advance(deltaTime: number): StageTransitionStep {
    if (this.isOver) return 'none';
    if (this.#state === 'pending') {
      // the first frame after the call counts no time: the transition starts there at 0
      if (this.#seenFrame) this.#waited += deltaTime;
      this.#seenFrame = true;
      if (this.#waited < this.delay) return 'none';
      this.#state = 'running';
      if (!this.manual) this.#progress = 0;
      return 'started';
    }
    if (this.manual) return 'none';

    const elapsed = this.#elapsed + deltaTime * this.#direction;
    if (this.#direction > 0 && elapsed >= this.duration) {
      this.#elapsed = this.duration;
      this.#progress = 1;
      return 'reached-end';
    }
    if (this.#direction < 0 && elapsed <= 0) {
      this.#elapsed = 0;
      this.#progress = 0;
      return 'reached-start';
    }
    this.#elapsed = elapsed;
    // The named easings are cubic and worked out here, in place, as products: a double handed to a
    // call that V8 does not inline is boxed, and so is one that `**` hands to the runtime, and the
    // frame of a transition with a named easing allocates nothing. A function of the caller is
    // called as it is.
    const t = elapsed / this.duration;
    const easing = this.#easing;
    if (typeof easing === 'function') {
      this.#progress = easing(t);
    } else if (easing === 1) {
      this.#progress = t * t * t;
    } else if (easing === 2) {
      const u = 1 - t;
      this.#progress = 1 - u * u * u;
    } else if (easing === 3) {
      const u = 2 - 2 * t;
      this.#progress = t < 0.5 ? 4 * t * t * t : 1 - (u * u * u) / 2;
    } else {
      this.#progress = t;
    }
    return 'none';
  }

  #settle(state: 'finished' | 'cancelled'): void {
    if (this.isOver) return;
    this.#state = state;
    if (state === 'finished') {
      this.#elapsed = this.duration;
      this.#progress = 1;
    }
    this.#host = undefined;
    this.#resolve(this);
  }
}
