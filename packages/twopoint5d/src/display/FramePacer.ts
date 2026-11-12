import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {describeValue} from '../utils/describeValue.js';
import {throwCollected} from '../utils/throwCollected.js';
import type {DisplayEventProps} from './types.js';

/**
 * What a piece of code says about the picture after it ran:
 *
 * - `false`, `undefined` or nothing — nothing it shows has changed;
 * - `true` — it moved something visible: the next frame draws;
 * - `'steady'` — it animates on and on, a fire or a pendulum: drawn at
 *   {@link FramePacer.steadyFps} frames per second while nothing asks for more.
 *
 * Several answers in one frame add up to the highest of them.
 */
export type Motion = boolean | 'steady' | undefined;

/**
 * A function a {@link FramePacer} runs once per frame, with the props of the frame. Its answer
 * says whether it changed the picture; a step that answers nothing changed nothing.
 */
export type FrameStep = (frame: DisplayEventProps) => Motion | void;

/**
 * What a {@link FramePacer} takes its frames from. A `Display` is one, and so is every host of a
 * `StageRenderer`. Each method subscribes a listener and hands back its unsubscribe.
 */
export interface FramePacerSource {
  /** Every frame; the pacer runs its steps from here. */
  onRenderFrame(listener: (frame: DisplayEventProps) => unknown): () => void;
  /** A new size. A resize clears the canvas, so the pacer draws the next frame. */
  onResize?(listener: (frame: DisplayEventProps) => unknown): () => void;
  /** Back from a pause. The canvas may have lost its picture, so the pacer draws the next frame. */
  onRestart?(listener: (frame: DisplayEventProps) => unknown): () => void;
  /** `true` once the source sends no more frames; the constructor refuses such a source. */
  readonly isDisposed?: boolean;
}

/**
 * The options of a {@link FramePacer}; each is read once, by the constructor. `TStage` is what the
 * steps of the pacer are registered with — the stage type of the app, or any object.
 */
export interface FramePacerOptions<TStage extends object = object> {
  /**
   * The frames per second `'steady'` draws at, a finite number above 0. Default
   * {@link FramePacer.DefaultSteadyFps}.
   */
  steadyFps?: number;
  /**
   * Whether `stage` is drawn live. The answer of a step registered with a stage counts only while
   * this answers `true` for it — a stage behind an overlay keeps its picture, whatever moves in
   * it. Asked in every frame in which such a step reports something. Without the option every
   * stage is live.
   */
  live?: (stage: TStage) => boolean;
}

// the share a new gap has in the average of the gaps
const GAP_SMOOTHING = 0.1;
// a gap this long is a hidden tab or a breakpoint, not a frame rate
const LONGEST_GAP_MS = 250;
// a screen may be this share of a frame too slow for a stride and still gets it
const STRIDE_ROUNDING = 0.25;
// a stride that stands moves only once this many measurements in a row have picked another one:
// a screen whose ratio lies near the edge between two strides — 144 Hz, at 4.8 — would flip with
// the jitter of single frames otherwise, and a few late frames in a row would move it
const STRIDE_SETTLE_FRAMES = 30;

interface StepRecord<TStage> {
  readonly step: FrameStep;
  readonly stage: TStage | undefined;
  removed: boolean;
}

/**
 * Decides, frame by frame, whether the picture has to be drawn anew — for a renderer driven by
 * hand that draws on demand instead of in every frame. The frame loop runs on, so everything
 * keeps pace with the clock; what becomes conditional is the draw, and a canvas that is not drawn
 * to keeps the picture of the frame before.
 *
 * The pacer collects reports: the answers of the frame steps registered through {@link onFrame},
 * and what {@link report} and {@link invalidate} say from outside a step. The frame handler asks
 * {@link shouldDraw} once per frame and draws when it answers `true`; that draw takes every
 * pending report with it. A new pacer has a report pending, so the first frame draws.
 *
 * The pacer subscribes to its source in the constructor: to the frames, which run the steps, and
 * to the resize and the restart of a source that has them, which draw the next frame.
 * {@link dispose} gives the subscriptions back; the source stays the caller's.
 *
 * `TStage` is the type of the key a step is registered with, see {@link onFrame}; the `live`
 * option of the constructor infers it.
 */
export class FramePacer<TStage extends object = object> {
  /** The `steadyFps` of a pacer built without one. */
  static readonly DefaultSteadyFps = 30;

  readonly #steadyFps: number;
  readonly #steadyIntervalMs: number;
  readonly #live: ((stage: TStage) => boolean) | undefined;

  readonly #unsubscribes: (() => void)[] = [];

  readonly #steps: StepRecord<TStage>[] = [];
  // while the steps of a frame run, an unsubscribe only marks its record: the run walks the array
  // by index, and a splice under it would skip the step behind the one that left
  #running = false;
  #removedInRun = false;

  // the pending reports; a new pacer starts with one, so the first frame draws
  #full = true;
  #steady = false;
  // the frames asked about since the last one that drew
  #sinceDraw = 0;
  // the average gap between two frames; 0 until the first gap is measured
  #frameMs = 0;
  // every how many frames 'steady' draws; 0 until the first gap is measured
  #stride = 0;
  // the measurements in a row that picked another stride than the one that stands
  #strideDoubt = 0;

  #frames = 0;
  #draws = 0;

  #disposed = false;

  /**
   * @throws {TypeError} for a `source` without an `onRenderFrame()` method and for a `live` that
   *   is no function.
   * @throws {RangeError} for a `steadyFps` that is no finite number above 0.
   * @throws {Error} for a source whose `isDisposed` is `true`: its frames never come.
   * @throws what the source throws while the pacer subscribes. The pacer gives back the
   *   subscriptions it had taken by then; an unsubscribe that throws there joins the error of the
   *   source in an `AggregateError`.
   */
  constructor(source: FramePacerSource, options?: FramePacerOptions<TStage>) {
    if (typeof (source as Partial<FramePacerSource> | null | undefined)?.onRenderFrame !== 'function') {
      throw new TypeError(`new FramePacer(): source must have an onRenderFrame() method, got ${describeValue(source)}`);
    }
    // a pacer on a source that sends no more frames would look alive and never run a step
    if (source.isDisposed === true) {
      throw new Error('new FramePacer(): the source handed to the constructor has been disposed');
    }

    this.#steadyFps = assertPositiveFinite(options?.steadyFps ?? FramePacer.DefaultSteadyFps, 'new FramePacer()', 'steadyFps');
    this.#steadyIntervalMs = 1000 / this.#steadyFps;

    const live = options?.live;
    if (live != null && typeof live !== 'function') {
      throw new TypeError(`new FramePacer(): live must be a function, got ${describeValue(live)}`);
    }
    this.#live = live ?? undefined;

    try {
      this.#unsubscribes.push(source.onRenderFrame(this.#runSteps));
      if (typeof source.onResize === 'function') this.#unsubscribes.push(source.onResize(this.#onInvalidate));
      if (typeof source.onRestart === 'function') this.#unsubscribes.push(source.onRestart(this.#onInvalidate));
    } catch (error) {
      // a source that throws here holds nothing of the pacer
      this.#disposed = true;
      const errors: unknown[] = [error];
      this.#unsubscribeAll(errors);
      throwCollected(
        errors,
        'new FramePacer(): the source threw as the pacer subscribed, and again as it gave its subscriptions back',
      );
    }
  }

  /** The frames per second `'steady'` draws at. Answers what it held after {@link dispose}. */
  get steadyFps(): number {
    return this.#steadyFps;
  }

  /**
   * The frames {@link shouldDraw} was asked about. Answers what it held after {@link dispose}.
   */
  get frames(): number {
    return this.#frames;
  }

  /**
   * The frames {@link shouldDraw} answered with `true`. Answers what it held after
   * {@link dispose}.
   */
  get draws(): number {
    return this.#draws;
  }

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Runs `step` once per frame, with the props of the frame, and takes its answer as a report —
   * see {@link Motion}. Steps run in the order they were registered, each of them also behind one
   * that throws: the errors come out of the frame afterwards, one unchanged, several as an
   * `AggregateError`, and such a frame draws.
   *
   * With a `stage`, the answer counts only while the `live` option answers `true` for it; the
   * step runs every frame either way, so its state keeps pace with the clock.
   *
   * One function registered twice runs twice. A step registered while the steps of a frame run
   * first runs in the next frame.
   *
   * @returns the unsubscribe of this registration. A step taken off while the steps of a frame
   *   run does not run any more, in that frame included. It does nothing after {@link dispose}.
   * @throws {TypeError} for a `step` that is no function.
   * @throws {Error} after {@link dispose}: the step would never run.
   */
  onFrame(step: FrameStep, stage?: TStage): () => void {
    if (this.#disposed) {
      throw new Error('FramePacer#onFrame() is not available: this pacer has been disposed');
    }
    if (typeof step !== 'function') {
      throw new TypeError(`FramePacer#onFrame(): step must be a function, got ${describeValue(step)}`);
    }

    const record: StepRecord<TStage> = {step, stage, removed: false};
    this.#steps.push(record);

    return () => {
      if (record.removed) return;
      record.removed = true;
      if (this.#running) {
        this.#removedInRun = true;
        return;
      }
      const at = this.#steps.indexOf(record);
      if (at >= 0) this.#steps.splice(at, 1);
    };
  }

  /**
   * What something outside a step moved, with the meaning of the answer of a step — see
   * {@link Motion}. Any truthy value but `'steady'` counts as `true`: an answer the pacer does not
   * know draws rather than freezes. Does nothing after {@link dispose}.
   */
  report(motion: Motion | void): void {
    if (!motion || this.#disposed) return;
    if (motion === 'steady') {
      this.#steady = true;
    } else {
      this.#full = true;
    }
  }

  /**
   * Something changed: the next frame draws. The same as `report(true)`. Does nothing after
   * {@link dispose}.
   */
  invalidate(): void {
    if (this.#disposed) return;
    this.#full = true;
  }

  /**
   * Whether this frame has to be drawn. The frame handler asks once per frame, before it draws,
   * with the props of the frame, and draws on `true`.
   *
   * It answers `true` when a report is pending — at once for `true`, at the stride of
   * {@link steadyFps} for `'steady'` — or when `busy` is `true`, which is for what the caller
   * knows without a step: a transition that runs, a stage being prepared. A frame that draws takes
   * every pending report with it.
   *
   * The stride of `'steady'` follows the screen: the pacer measures the gap between the frames by
   * `frame.rawDeltaTime` — by `deltaTime` in props without it — and draws every n-th frame, every
   * 2nd at 60 Hz, every 4th at 120 Hz. Until a gap is measured, `'steady'` draws every frame.
   *
   * After {@link dispose} it answers `true` and counts nothing: a pacer that paces nothing lets
   * every frame draw.
   */
  shouldDraw(frame: DisplayEventProps, busy = false): boolean {
    if (this.#disposed) return true;

    this.#frames += 1;
    this.#measure(frame);
    this.#sinceDraw += 1;

    // a stride of 0 — no gap measured yet — lets 'steady' draw every frame rather than guess a
    // screen
    const draw = busy || this.#full || (this.#steady && this.#sinceDraw >= this.#stride);
    if (draw) {
      this.#full = false;
      this.#steady = false;
      this.#sinceDraw = 0;
      this.#draws += 1;
    }
    return draw;
  }

  /**
   * Gives the subscriptions back to the source and lets go of every step. The source stays the
   * caller's. A second call does nothing.
   *
   * @throws what the unsubscribes of the source threw, once the pacer is down: one error
   *   unchanged, several as an `AggregateError`. An unsubscribe that throws holds up none of the
   *   others.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    // an unsubscribe handed out before finds its record taken off already
    for (const record of this.#steps) record.removed = true;
    this.#steps.length = 0;

    const errors: unknown[] = [];
    this.#unsubscribeAll(errors);
    throwCollected(errors, 'FramePacer#dispose(): more than one unsubscribe of the source threw');
  }

  #unsubscribeAll(errors: unknown[]): void {
    for (const unsubscribe of this.#unsubscribes) {
      try {
        unsubscribe();
      } catch (error) {
        errors.push(error);
      }
    }
    this.#unsubscribes.length = 0;
  }

  #measure(frame: DisplayEventProps): void {
    // the props of a host of one's own may lack rawDeltaTime; deltaTime keeps the stride going
    const gap = (Number.isFinite(frame.rawDeltaTime) ? frame.rawDeltaTime : frame.deltaTime) * 1000;
    // written so that NaN measures nothing either. A gap of 0 is the first frame, or one rendered
    // during a pause
    if (!(gap > 0 && gap < LONGEST_GAP_MS)) return;

    this.#frameMs = this.#frameMs === 0 ? gap : this.#frameMs + (gap - this.#frameMs) * GAP_SMOOTHING;

    const picked = Math.max(1, Math.floor(this.#steadyIntervalMs / this.#frameMs + STRIDE_ROUNDING));
    if (picked === this.#stride) {
      this.#strideDoubt = 0;
      return;
    }
    // the first measurement sets the stride; afterwards a pick has to last. The stride follows
    // where the average of the gaps ends up, whatever it passed on its way there — a first frame
    // that compiled shaders leaves no mark
    this.#strideDoubt += 1;
    if (this.#stride === 0 || this.#strideDoubt >= STRIDE_SETTLE_FRAMES) {
      this.#stride = picked;
      this.#strideDoubt = 0;
    }
  }

  readonly #onInvalidate = (): void => {
    this.invalidate();
  };

  readonly #runSteps = (frame: DisplayEventProps): void => {
    const steps = this.#steps;
    // a step registered during the run first runs in the next frame
    const count = steps.length;
    let errors: unknown[] | undefined;

    this.#running = true;
    for (let i = 0; i < count; i++) {
      // undefined once a step has disposed the pacer: the run ends there
      const record = steps[i];
      if (record === undefined || record.removed) continue;
      try {
        const motion = record.step(frame);
        // live is asked only for a step that reports something
        if (motion && (record.stage === undefined || this.#live === undefined || this.#live(record.stage))) {
          this.report(motion);
        }
      } catch (error) {
        // every step runs, also behind one that throws: a step left out would fall a frame behind
        // the clock
        (errors ??= []).push(error);
      }
    }
    this.#running = false;

    if (this.#removedInRun) {
      this.#removedInRun = false;
      let kept = 0;
      for (let i = 0; i < steps.length; i++) {
        const record = steps[i];
        if (record !== undefined && !record.removed) steps[kept++] = record;
      }
      steps.length = kept;
    }

    if (errors !== undefined) {
      // what the step wrote before it threw is unknown: the picture is drawn anew
      this.invalidate();
      throwCollected(errors, 'FramePacer: more than one frame step threw');
    }
  };
}
