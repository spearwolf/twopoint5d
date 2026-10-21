import {on, once, Priority, type UnsubscribeFunc} from '@spearwolf/eventize';
import {OnDisplayDispose, OnDisplayRenderFrame, OnDisplayResize, OnDisplayRestart, OnDisplayStart} from '../events.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import type {Display} from './Display.js';
import type {DisplayEventProps} from './types.js';

export interface AdaptiveResolutionOptions {
  /**
   * The frames per second the display is to hold, `60` by default — or the `maxFps` of the
   * display where that is lower, when the display builds the controller itself. Anything but a
   * positive finite number is the default.
   */
  targetFps?: number;

  /**
   * The lowest {@link Display.resolutionScale} the controller goes down to, `0.5` by default: a
   * quarter of the pixels. Rounded up to a step of an eighth, at least one eighth, at most
   * {@link AdaptiveResolutionOptions.maxScale}.
   */
  minScale?: number;

  /**
   * The highest {@link Display.resolutionScale} the controller goes up to, `1` by default.
   * Rounded down to a step of an eighth, at least one eighth. Above `1` the controller goes
   * beyond {@link Display.maxPixelRatio}, within {@link Display.maxPixels}: a step that the budget
   * holds to the same pixel ratio is skipped.
   */
  maxScale?: number;
}

/**
 * How the controller tells a frame that costs too much: by the time the GPU spent on it, or —
 * where the renderer measures no GPU time — by the frames that came later than the target allows.
 */
export type AdaptiveResolutionMethod = 'gpu-time' | 'frame-pacing';

// The scale moves in eighths: a step down from 1 shades 23 % fewer pixels, and the ratio ladder of
// the display rounds to an eighth as well
const SCALE_STEP = 1 / 8;

// The frames after a start, a restart and every resize — one of the controller's own included —
// that count for nothing: shaders compile, and the render targets are built anew at the new size
const SETTLE_FRAMES = 30;

// gpu-time: a window of this many measured frames is judged by its median, which a single spike
// does not move. The GPU may take this share of the frame interval
const GPU_WINDOW = 12;
const GPU_HEADROOM = 0.8;
// one step up, where the time of the window scaled by the pixels of the next step stays below this
// share of the budget, in this many windows in a row
const GPU_STEP_UP_SHARE = 0.9;
const GPU_STEP_UP_WINDOWS = 3;
// a step up that the next window takes back doubles the windows the next one waits for, up to
// about as many measured frames as frame-pacing waits at most
const GPU_MAX_STEP_UP_WINDOWS = 300;
// a window far above the budget goes down two steps at once
const GPU_STEEP_DOWN_FACTOR = 1.5;
// a renderer that has measured nothing for this many frames measures nothing: frame pacing
const GPU_SILENT_FRAMES = 60;

// frame-pacing: a frame is late beyond this factor of the frame interval, and a window of this
// many frames with this many late ones goes down a step
const PACING_WINDOW = 30;
const PACING_LATE_FACTOR = 1.5;
const PACING_LATE_FRAMES = 3;
// a descent has gained where the mean interval of the animation frames of a window falls below
// this share of the one that began it
const PACING_GAIN_SHARE = 0.9;
// Frame pacing shows no headroom, so the controller tries a step up after this many clean frames,
// and keeps it if the next two windows stay clean; a failed try doubles the wait, up to the maximum
const PACING_PROBE_FRAMES = 180;
const PACING_MAX_PROBE_FRAMES = 3600;
const PACING_PROBE_WINDOWS = 2;

const median = (values: number[]): number => {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

// what the controller reads off the backend of three to know whether it measures GPU time
interface TimestampBackend {
  trackTimestamp?: boolean;
  hasTimestamp?: boolean;
}

/**
 * Holds the frame rate of a {@link Display} by its {@link Display.resolutionScale}: down a step
 * where a frame costs more than the target allows, up a step where there is room for the pixels
 * of it. `new Display(canvas, {adaptiveResolution: true})` builds one, with the defaults.
 *
 * The cost of a frame is read in one of two ways, see {@link AdaptiveResolution.method}:
 *
 * - **`gpu-time`** — the time the GPU spent on the frame, through the timestamp queries of three
 *   (`timestamp-query` under WebGPU, `EXT_disjoint_timer_query_webgl2` under WebGL 2). It needs a
 *   renderer built with `trackTimestamp: true`, which a display that builds its renderer with
 *   `adaptiveResolution` asks for. A renderer built with `trackTimestamp: true` measures
 *   timestamps for its whole life, while the controller holds still, after it is disabled and
 *   after its dispose as well. The GPU may take 80 % of the frame interval; a step up is taken
 *   where the time, scaled by the pixels the display would draw at that step, stays below 90 % of
 *   that, three windows in a row. A step up that the next window takes back makes the next one
 *   wait twice as many windows, up to 300.
 * - **`frame-pacing`** — the frames that come late, where the renderer measures no GPU time, read
 *   off the intervals between the animation frames of the page: a frame that `maxFps` holds back
 *   is not late. It cannot tell the GPU from the CPU, and a frame on time shows no headroom: the
 *   controller tries a step up after three clean seconds and goes back where it fails, waiting
 *   twice as long before the next try. A frame is late where it comes more than half a frame
 *   interval after the pace the page reaches — 1.5 frame intervals while that pace is the
 *   target. Where a descent down to {@link AdaptiveResolution.minScale} brought frames that came
 *   at a steady pace no sooner — a `requestAnimationFrame` that a power-saving mode or a 30 Hz
 *   screen holds to 30 frames — the pixels are not what holds the frame rate: the controller
 *   goes back to the scale the descent began at and measures against that pace from then on. It
 *   takes that one descent, and the return, to find out. Once the frames come sooner again, the
 *   target counts again.
 *
 * A step is an eighth of the scale, between {@link AdaptiveResolution.minScale} and
 * {@link AdaptiveResolution.maxScale}. A step that leaves the pixel ratio of the display as it is
 * — under {@link Display.maxPixels}, or through the rounding of the ratio to an eighth — is
 * skipped: for every ratio the controller sets the highest scale that draws at it. Every resize,
 * a start and a restart let 30 frames pass before the controller judges again: three builds
 * render targets and shaders anew in them. While {@link Display.pixelZoom} is above `0` the scale
 * does not apply and the controller holds still — pixel art keeps its size. A measurement of the
 * GPU time still in flight when the controller is disabled, or when the display goes over to a
 * pixel zoom, is dropped.
 *
 * The controller lets go of the display with {@link AdaptiveResolution.dispose}, and when the
 * display is disposed.
 */
export class AdaptiveResolution {
  readonly display: Display;
  readonly targetFps: number;
  readonly minScale: number;
  readonly maxScale: number;

  // the scales of the steps, from maxScale down to minScale
  readonly #levels: number[];
  #level = 0;

  #enabled = true;
  #disposed = false;
  // the scale the display had when the controller took over last, given back when it lets go;
  // every takeover sets it
  #scaleBefore = 1;
  #unsubscribe: UnsubscribeFunc[];

  #method?: AdaptiveResolutionMethod;
  #settleFrames = SETTLE_FRAMES;
  // a measurement that started before the last reset belongs to frames that count for nothing
  #epoch = 0;

  #gpuSamples: number[] = [];
  #gpuTime?: number;
  #gpuResolving = false;
  #gpuSilentFrames = 0;
  #gpuGoodWindows = 0;
  #gpuStepUpWindows = GPU_STEP_UP_WINDOWS;
  // a step up whose window is still to come: that window tells whether it held
  #gpuStepUpPending = false;

  #pacingFrames = 0;
  #pacingLateFrames = 0;
  #pacingCleanFrames = 0;
  #pacingProbeFrames = PACING_PROBE_FRAMES;
  #pacingProbeWindows = 0;
  // the interval of the animation frames the page reaches; the target until a descent finds a
  // slower one
  #pacingCadenceMs: number;
  // the intervals of the window that runs, in an array that is kept: a frame allocates nothing
  readonly #pacingIntervals = new Float64Array(PACING_WINDOW);
  #pacingIntervalSum = 0;
  // a descent over late windows, one step a window: the level it began at (-1 while none runs),
  // the mean interval of its first window, whether that window came at a steady pace, and whether
  // a window since has come sooner
  #pacingDescentFrom = -1;
  #pacingDescentMs = 0;
  #pacingDescentSteady = false;
  #pacingDescentGained = false;
  // the frame of the frame loop the controller read last
  #loopFrameNo = -1;

  constructor(display: Display, options?: AdaptiveResolutionOptions) {
    this.display = display;
    this.targetFps = isPositiveFinite(options?.targetFps) ? options.targetFps : 60;
    this.#pacingCadenceMs = 1000 / this.targetFps;

    const maxScale = isPositiveFinite(options?.maxScale) ? options.maxScale : 1;
    this.maxScale = Math.max(SCALE_STEP, Math.floor(maxScale / SCALE_STEP + 1e-6) * SCALE_STEP);
    const minScale = isPositiveFinite(options?.minScale) ? options.minScale : 0.5;
    this.minScale = Math.min(this.maxScale, Math.max(SCALE_STEP, Math.ceil(minScale / SCALE_STEP - 1e-6) * SCALE_STEP));

    this.#levels = [];
    for (let scale = this.maxScale; scale >= this.minScale - 1e-6; scale -= SCALE_STEP) {
      this.#levels.push(scale);
    }

    this.#takeOverScale();

    this.#unsubscribe = [
      // after the listeners that draw the frame: its measurement is in by then
      on(display, OnDisplayRenderFrame, Priority.Low, this.#onRenderFrame),
      on(display, [OnDisplayResize, OnDisplayStart, OnDisplayRestart], this.#settle),
      // the display takes every listener off with its dispose; the controller holds still from then
      once(display, OnDisplayDispose, () => this.#letGo()),
    ];
  }

  /**
   * The {@link Display.resolutionScale} the controller has set, one of its steps.
   */
  get scale(): number {
    return this.#levels[this.#level]!;
  }

  /**
   * How the controller reads the cost of a frame; `undefined` until the first frame it judges.
   */
  get method(): AdaptiveResolutionMethod | undefined {
    return this.#method;
  }

  /**
   * The median of the GPU time of the frames the controller judged last, in milliseconds;
   * `undefined` until a window is through, and under `frame-pacing`.
   */
  get gpuTime(): number | undefined {
    return this.#gpuTime;
  }

  /**
   * `true` by default. `false` holds the controller still, drops a measurement still in flight
   * and gives the display back the {@link Display.resolutionScale} it had when the controller took
   * over last; `true` takes over again from the scale the display has then. After
   * {@link AdaptiveResolution.dispose}, and once the display is disposed, a write does nothing.
   */
  get enabled(): boolean {
    return this.#enabled;
  }

  set enabled(enabled: boolean) {
    if (this.#disposed || enabled === this.#enabled) return;
    this.#enabled = enabled;
    if (enabled) {
      this.#takeOverScale();
      this.#settle();
    } else {
      // a measurement in flight belongs to the controller that held the display, not to the scale
      // it gives back
      this.#settle();
      this.display.resolutionScale = this.#scaleBefore;
    }
  }

  /**
   * Lets go of the display, and gives it back the {@link Display.resolutionScale} it had when the
   * controller took over last. Safe to call twice.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#letGo();
    if (this.#enabled) this.display.resolutionScale = this.#scaleBefore;
  }

  #letGo(): void {
    this.#disposed = true;
    for (const unsubscribe of this.#unsubscribe) unsubscribe();
    this.#unsubscribe = [];
  }

  // the highest step at or below the scale the display has; a takeover starts afresh
  #takeOverScale(): void {
    const scale = this.display.resolutionScale;
    this.#scaleBefore = scale;
    this.#pacingDescentFrom = -1;
    this.#gpuStepUpPending = false;
    const level = this.#levels.findIndex((step) => step <= scale + 1e-6);
    this.#setLevel(level === -1 ? this.#levels.length - 1 : level);
  }

  #setLevel(level: number): void {
    this.#level = Math.min(this.#levels.length - 1, Math.max(0, level));
    // a display measures in the next frame once its scale changes, and the resize lets the
    // controller settle
    this.display.resolutionScale = this.#levels[this.#level]!;
  }

  // the pixel ratio the display draws at on a level
  #ratioAt(level: number): number {
    return this.display.pixelRatioAt(this.#levels[level]!);
  }

  // the first level below whose ratio differs from the one of `level`; `level` where none does
  #levelBelow(level: number): number {
    const ratio = this.#ratioAt(level);
    for (let below = level + 1; below < this.#levels.length; below++) {
      if (this.#ratioAt(below) !== ratio) return below;
    }
    return level;
  }

  // The first level above whose ratio differs from the one of `level`, and further up while the
  // next draws at that ratio too: for every ratio the controller sets the highest scale that draws
  // at it. `level` where none differs
  #levelAbove(level: number): number {
    const ratio = this.#ratioAt(level);
    let above = level - 1;
    while (above >= 0 && this.#ratioAt(above) === ratio) above -= 1;
    if (above < 0) return level;
    const next = this.#ratioAt(above);
    while (above > 0 && this.#ratioAt(above - 1) === next) above -= 1;
    return above;
  }

  // A descent over many steps is not reset here: every step is a resize
  readonly #settle = (): void => {
    this.#settleFrames = SETTLE_FRAMES;
    this.#epoch += 1;
    this.#gpuSamples.length = 0;
    this.#gpuSilentFrames = 0;
    this.#pacingFrames = 0;
    this.#pacingLateFrames = 0;
    this.#pacingIntervalSum = 0;
  };

  readonly #onRenderFrame = ({rawDeltaTime}: DisplayEventProps): void => {
    if (!this.#enabled || isPositiveFinite(this.display.pixelZoom)) return;

    this.#method ??= this.#tracksGpuTime() ? 'gpu-time' : 'frame-pacing';

    if (this.#settleFrames > 0) {
      this.#settleFrames -= 1;
      return;
    }

    if (this.#method === 'gpu-time') {
      this.#sampleGpuTime();
    } else {
      this.#samplePacing(this.#rafIntervalMs(rawDeltaTime));
    }
  };

  #tracksGpuTime(): boolean {
    const backend = (this.display.renderer as {backend?: TimestampBackend} | undefined)?.backend;
    // WebGPU drops trackTimestamp without the timestamp-query feature, WebGL 2 has no timestamp
    // without EXT_disjoint_timer_query_webgl2
    return backend?.trackTimestamp === true && backend.hasTimestamp === true;
  }

  // --- gpu-time ---

  #sampleGpuTime(): void {
    const renderer = this.display.renderer;
    if (renderer != null && !this.#gpuResolving) {
      this.#gpuResolving = true;
      const epoch = this.#epoch;
      renderer.resolveTimestampsAsync('render').then(
        (ms) => {
          this.#gpuResolving = false;
          // what holds #onRenderFrame still drops a measurement that comes in after it
          if (
            this.#disposed ||
            !this.#enabled ||
            isPositiveFinite(this.display.pixelZoom) ||
            epoch !== this.#epoch ||
            !isPositiveFinite(ms)
          ) {
            return;
          }
          this.#gpuSilentFrames = 0;
          this.#gpuSamples.push(ms);
          if (this.#gpuSamples.length >= GPU_WINDOW) this.#judgeGpuWindow();
        },
        () => {
          this.#gpuResolving = false;
        },
      );
    }

    this.#gpuSilentFrames += 1;
    if (this.#gpuSilentFrames > GPU_SILENT_FRAMES) {
      this.#method = 'frame-pacing';
      this.#gpuTime = undefined;
      this.#settle();
    }
  }

  #judgeGpuWindow(): void {
    const time = median(this.#gpuSamples);
    this.#gpuSamples.length = 0;
    this.#gpuTime = time;

    const budget = (GPU_HEADROOM * 1000) / this.targetFps;

    if (this.#gpuStepUpPending) {
      // the first window after a step up: one that did not hold makes the next wait longer, and
      // one that holds leaves the wait as it is
      this.#gpuStepUpPending = false;
      if (time > budget) this.#gpuStepUpWindows = Math.min(this.#gpuStepUpWindows * 2, GPU_MAX_STEP_UP_WINDOWS);
    }

    if (time > budget) {
      this.#gpuGoodWindows = 0;
      const below = this.#levelBelow(this.#level);
      this.#setLevel(time > budget * GPU_STEEP_DOWN_FACTOR ? this.#levelBelow(below) : below);
      return;
    }

    const up = this.#levelAbove(this.#level);
    // the cost of a frame grows with its pixels, the square of the ratio the display draws at;
    // what does not grow with them makes the guess err on the safe side
    if (up !== this.#level && time * (this.#ratioAt(up) / this.#ratioAt(this.#level)) ** 2 < budget * GPU_STEP_UP_SHARE) {
      this.#gpuGoodWindows += 1;
      if (this.#gpuGoodWindows >= this.#gpuStepUpWindows) {
        this.#gpuGoodWindows = 0;
        this.#gpuStepUpPending = true;
        this.#setLevel(up);
      }
    } else {
      this.#gpuGoodWindows = 0;
    }
  }

  // --- frame-pacing ---

  #rafIntervalMs(rawDeltaTime: number): number {
    // The interval between the animation frames of the page before this frame: a frame maxFps held
    // back is no late frame. A frame the frame loop of the display did not run — a renderFrame() of
    // one's own — has nothing but its own delta
    const loop = this.display.frameLoop;
    const fromLoop = loop.frameNo !== this.#loopFrameNo;
    this.#loopFrameNo = loop.frameNo;
    return fromLoop && loop.longestRafInterval > 0 ? loop.longestRafInterval : rawDeltaTime * 1000;
  }

  #samplePacing(rafMs: number): void {
    const targetMs = 1000 / this.targetFps;
    // late is half a target interval behind the pace the page reaches: a frame that missed one
    // animation frame of a page at the target, or of a page at a slower pace
    const lateMarginMs = (PACING_LATE_FACTOR - 1) * targetMs;

    this.#pacingIntervals[this.#pacingFrames] = rafMs;
    this.#pacingIntervalSum += rafMs;
    this.#pacingFrames += 1;
    if (rafMs > this.#pacingCadenceMs + lateMarginMs) this.#pacingLateFrames += 1;
    if (this.#pacingFrames < PACING_WINDOW) return;

    const late = this.#pacingLateFrames >= PACING_LATE_FRAMES;
    const meanMs = this.#pacingIntervalSum / PACING_WINDOW;
    // the frames of the window came at one pace; one or two outliers — a collection of the
    // garbage — do not count against it
    let outliers = 0;
    for (let i = 0; i < PACING_WINDOW; i++) {
      if (this.#pacingIntervals[i]! > meanMs + lateMarginMs) outliers += 1;
    }
    const steady = outliers < PACING_LATE_FRAMES;
    this.#pacingFrames = 0;
    this.#pacingLateFrames = 0;
    this.#pacingIntervalSum = 0;

    if (this.#pacingProbeWindows > 0) {
      if (late) {
        // the step up did not hold: back down, and wait longer before the next try
        this.#pacingProbeWindows = 0;
        this.#pacingCleanFrames = 0;
        this.#pacingProbeFrames = Math.min(this.#pacingProbeFrames * 2, PACING_MAX_PROBE_FRAMES);
        this.#setLevel(this.#levelBelow(this.#level));
      } else {
        this.#pacingProbeWindows -= 1;
      }
      return;
    }

    if (late) {
      this.#pacingCleanFrames = 0;
      if (this.#pacingDescentFrom === -1) {
        this.#pacingDescentFrom = this.#level;
        this.#pacingDescentMs = meanMs;
        this.#pacingDescentSteady = steady;
        this.#pacingDescentGained = false;
      } else if (meanMs < this.#pacingDescentMs * PACING_GAIN_SHARE) {
        this.#pacingDescentGained = true;
      }

      const below = this.#levelBelow(this.#level);
      if (below !== this.#level) {
        this.#setLevel(below);
        return;
      }

      // At the bottom. A descent over steps that brought frames of a steady pace no sooner shows
      // that the pixels do not hold the frame rate — a requestAnimationFrame held to 30 Hz, a
      // 30 Hz panel: back where it began, and the pace it found is the one to measure against.
      // An unsteady pace, one the CPU sets, stays down here: minScale is how far that goes
      if (this.#pacingDescentFrom !== this.#level && !this.#pacingDescentGained && this.#pacingDescentSteady) {
        this.#pacingCadenceMs = Math.max(targetMs, this.#pacingDescentMs);
        const from = this.#pacingDescentFrom;
        this.#pacingDescentFrom = -1;
        this.#setLevel(from);
      }
      return;
    }

    this.#pacingDescentFrom = -1;
    // frames that come sooner than the pace found are what the page reaches now; the target
    // counts again once they reach it
    if (meanMs < this.#pacingCadenceMs) this.#pacingCadenceMs = Math.max(targetMs, meanMs);

    this.#pacingCleanFrames += PACING_WINDOW;
    if (this.#pacingCleanFrames >= this.#pacingProbeFrames) {
      const up = this.#levelAbove(this.#level);
      if (up !== this.#level) {
        this.#pacingCleanFrames = 0;
        this.#pacingProbeWindows = PACING_PROBE_WINDOWS;
        this.#setLevel(up);
      }
    }
  }
}
