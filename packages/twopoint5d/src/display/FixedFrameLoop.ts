import {emit, type EventizedObject, eventize, off, on, once} from '@spearwolf/eventize';
import {OnDisplayDispose, OnDisplayRenderFrame} from '../events.js';
import type {Display} from './Display.js';
import type {DisplayEventProps} from './types.js';

const OnTick = Symbol.for('twopoint5d:FixedFrameLoop.OnTick');
const OnRender = Symbol.for('twopoint5d:FixedFrameLoop.OnRender');

// what a loop starts with when neither its options nor the writable statics give a value it
// can run with
const BUILT_IN_FPS = 60;
const BUILT_IN_MAX_STEPS_PER_FRAME = 5;

export interface FixedFrameLoopTickProps {
  /** Fixed time step in seconds (`1 / fps`). */
  fixedDelta: number;
  /** Total simulation time at the START of this tick, in seconds. */
  tickTime: number;
  /** Monotonically increasing tick counter, starting at 0. */
  tickNo: number;
}

export interface FixedFrameLoopRenderProps extends DisplayEventProps {
  /**
   * Interpolation factor in `[0, 1)`. Use it to compute the visual state
   * between the previous and the most-recent simulation state:
   * `lerp(previous, current, alpha)`. `alpha === 0` means "exactly at the
   * latest sim state"; `alpha → 1` means "almost at the next sim state
   * (which hasn't run yet)".
   */
  alpha: number;
  /** Total simulation time elapsed AFTER this frame's ticks, in seconds. */
  tickTime: number;
  /** Total number of simulation ticks that have run so far. */
  tickNo: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FixedFrameLoop extends EventizedObject {}

/**
 * Fixed-timestep simulation loop. Decouples simulation cadence from
 * render cadence by accumulating real wall-clock deltas and emitting
 * exactly one `OnTick` per fixed-delta slot that has elapsed,
 * followed by one `OnRender` per render frame with an `alpha` factor
 * for interpolating the visual state between sim states.
 *
 * @example
 * ```ts
 * const display = new Display(canvas);
 * const sim = new FixedFrameLoop(display, {fps: 60});
 *
 * let prevX = 0, currX = 0;
 *
 * sim.onTick(({fixedDelta}) => {
 *   prevX = currX;
 *   currX += velocity * fixedDelta;   // deterministic integration
 * });
 *
 * sim.onRender(({alpha, renderer}) => {
 *   mesh.position.x = prevX + (currX - prevX) * alpha;
 *   // …draw, all original Display event-props are forwarded as well
 * });
 *
 * await display.start();
 * ```
 *
 * **What this helps with.** Variable per-frame JS cost (physics,
 * animation curves, IK solvers, …) driven directly off `deltaTime`
 * causes visible micro-stutter even when fps is technically high — the
 * simulated position lags or jumps relative to wall-clock time. The
 * fixed-timestep + alpha-interpolation pattern decouples simulation
 * from frame timing, so motion stays smooth as long as render frames
 * keep arriving.
 *
 * **What this does NOT help with.** When the GPU itself cannot sustain
 * the target refresh rate, frames are dropped at the swap chain and the
 * user sees stutter regardless of any JS-side smoothing. That's a
 * render-budget problem — scene optimisation, `pixelZoom`, lower
 * `pixelRatio` or capping `Display`'s `maxFps` are the right tools.
 *
 * The loop pauses automatically when `Display` pauses (no `OnRenderFrame`
 * events fire) and disposes when `Display` disposes (via `OnDisplayDispose`).
 */
export class FixedFrameLoop {
  static OnTick = OnTick;
  static OnRender = OnRender;

  /**
   * The rate a loop starts at when its options name none, or one it refuses. Read each time a
   * loop is built; a value that is not finite or not greater than 0 is ignored there, and the
   * loop starts at 60.
   */
  static DefaultFps = BUILT_IN_FPS;

  /**
   * The `maxStepsPerFrame` a loop starts with when its options name none, or one it refuses.
   * Read each time a loop is built; a value that is not finite or smaller than 1 is ignored
   * there, and the loop starts with 5.
   */
  static DefaultMaxStepsPerFrame = BUILT_IN_MAX_STEPS_PER_FRAME;

  readonly display: Display;

  #fps: number;
  #fixedDelta: number;
  #maxStepsPerFrame: number;
  #accumulator = 0;
  #tickTime = 0;
  #tickNo = 0;
  #alpha = 0;
  #disposed = false;

  // the loop puts a listener on a Display it does not own, so it keeps the handle that takes
  // that listener off again — the Display outlives the loop and would carry it forever
  readonly #unsubscribeFromDisplayDispose: () => void;

  /**
   * Hard upper bound on simulation ticks per render frame. Prevents the
   * "spiral of death" where slow rendering accumulates more sim work
   * than the next frame can drain. When hit, the leftover accumulator
   * is discarded (sim time stays consistent with the ticks that did
   * run; `alpha` drops back to ~0 on the next frame).
   *
   * A value that is not finite or smaller than 1 is ignored, in the
   * constructor as well as here; the constructor then keeps `DefaultMaxStepsPerFrame`, or 5 when
   * that is such a value too.
   */
  get maxStepsPerFrame(): number {
    return this.#maxStepsPerFrame;
  }

  set maxStepsPerFrame(value: number) {
    // an unbounded value would take away the very guard this field is, and one below 1 runs no
    // tick at all while discarding the backlog of every frame
    if (!Number.isFinite(value) || value < 1) return;
    this.#maxStepsPerFrame = value;
  }

  /**
   * Target simulation rate in frames per second.
   *
   * A value that is not finite or not greater than 0 is ignored — in the
   * constructor as well, where the loop then keeps `DefaultFps`, or 60 when that is such a value
   * too.
   */
  get fps(): number {
    return this.#fps;
  }

  set fps(value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    this.#fps = value;
    this.#fixedDelta = 1 / value;
  }

  /** Time between consecutive simulation ticks, in seconds. */
  get fixedDelta(): number {
    return this.#fixedDelta;
  }

  /** Total simulation time elapsed, in seconds. */
  get tickTime(): number {
    return this.#tickTime;
  }

  /** Total number of simulation ticks that have run so far. */
  get tickNo(): number {
    return this.#tickNo;
  }

  /** Current interpolation factor, in `[0, 1)`. */
  get alpha(): number {
    return this.#alpha;
  }

  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * @throws when the display handed in has been disposed and sends no more render frames for
   *   the loop to tick on. The message names the class and the state, and no loop comes into
   *   being.
   */
  constructor(display: Display, options?: {fps?: number; maxStepsPerFrame?: number}) {
    // before eventize(), so that a loop which can never be ticked never comes into being
    if (display.isDisposed) {
      throw new Error(
        'FixedFrameLoop: the display handed to the constructor has been disposed and sends no more ' +
          'render frames to tick on. Build the loop while the display is alive, or hand it a live display.',
      );
    }

    eventize(this);

    this.display = display;

    // the built-in values first, then the writable defaults and the options through the setters,
    // which refuse a rate the loop cannot run at — a default gets the same check as an option
    this.#fps = BUILT_IN_FPS;
    this.#fixedDelta = 1 / BUILT_IN_FPS;
    this.#maxStepsPerFrame = BUILT_IN_MAX_STEPS_PER_FRAME;
    this.fps = FixedFrameLoop.DefaultFps;
    this.maxStepsPerFrame = FixedFrameLoop.DefaultMaxStepsPerFrame;
    if (options?.fps != null) this.fps = options.fps;
    if (options?.maxStepsPerFrame != null) this.maxStepsPerFrame = options.maxStepsPerFrame;

    on(display, OnDisplayRenderFrame, this as FixedFrameLoop);
    this.#unsubscribeFromDisplayDispose = once(display, OnDisplayDispose, () => this.dispose());
  }

  [OnDisplayRenderFrame](props: DisplayEventProps): void {
    if (this.#disposed) return;

    this.#accumulator += props.deltaTime;

    let steps = 0;
    while (this.#accumulator >= this.#fixedDelta && steps < this.#maxStepsPerFrame) {
      emit(this, OnTick, {
        fixedDelta: this.#fixedDelta,
        tickTime: this.#tickTime,
        tickNo: this.#tickNo,
      });
      this.#accumulator -= this.#fixedDelta;
      this.#tickTime += this.#fixedDelta;
      this.#tickNo += 1;
      steps += 1;
    }

    if (steps >= this.#maxStepsPerFrame && this.#accumulator >= this.#fixedDelta) {
      // Spiral-of-death guard — discard backlog.
      this.#accumulator = 0;
    }

    this.#alpha = this.#accumulator / this.#fixedDelta;

    emit(this, OnRender, {
      ...props,
      alpha: this.#alpha,
      tickTime: this.#tickTime,
      tickNo: this.#tickNo,
    });
  }

  /**
   * Reset accumulator, simulation time and tick counter to zero. The
   * `Display` subscription stays active. Useful when changing scenes or
   * after a long external pause where the simulation history should be
   * discarded rather than caught up.
   *
   * Does nothing once {@link dispose} has run: a disposed loop keeps the
   * values it was left with.
   */
  reset(): void {
    if (this.#disposed) return;

    this.#accumulator = 0;
    this.#tickTime = 0;
    this.#tickNo = 0;
    this.#alpha = 0;
  }

  /**
   * Stop the loop and let the `Display` go. The `Display` is handed to the constructor and
   * belongs to the caller: it is not disposed, and it is left holding exactly the
   * subscriptions it carried before this loop was built.
   *
   * Afterwards `isDisposed` is `true` and no further `OnTick` or `OnRender` is emitted — a
   * handler subscribed through {@link onTick} or {@link onRender} after this call is never
   * reached. `display`, `tickTime`, `tickNo` and `alpha` keep the values the loop was left
   * with; nothing behind them was released. {@link reset} and a further `dispose()` do
   * nothing. `fps` and `maxStepsPerFrame` stay writable and keep their values until someone
   * writes them: a write the setter accepts lands, `fps` recomputes `fixedDelta` with it, and no tick ever
   * reads either one again.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    off(this.display, OnDisplayRenderFrame, this);
    this.#unsubscribeFromDisplayDispose();
    off(this);
  }

  readonly onTick = (on as (...args: unknown[]) => unknown).bind(undefined, this, OnTick) as unknown as (
    handler: (props: FixedFrameLoopTickProps) => unknown,
  ) => unknown;

  readonly onRender = (on as (...args: unknown[]) => unknown).bind(undefined, this, OnRender) as unknown as (
    handler: (props: FixedFrameLoopRenderProps) => unknown,
  ) => unknown;
}
