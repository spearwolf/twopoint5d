const getCurrentTime = (time?: number) => (typeof time === 'number' && !Number.isNaN(time) ? time : performance.now() / 1000);

/**
 * Wall-clock-aware time source with pause/resume support.
 *
 * The chronometer is unit-agnostic: every method that accepts a `time`
 * argument and the value returned by the internal default
 * (`performance.now() / 1000`) must use the **same unit**. The default unit
 * is seconds. If you pass milliseconds (or any other unit) to one method,
 * pass the same unit to all others — including the optional `maxDeltaTime`.
 */
export class Chronometer {
  #timeStart: number;

  /** The current time, which is set by calling the `update()` method */
  #currentTime: number;

  #deltaTime: number;

  /** Time lost due to pause before the previous time */
  #lostTime: number;

  /** Time lost due to pause after the previous time */
  #recentlyLostTime: number;

  /** Wall-clock timestamp captured by the most recent `stop()` */
  #pausedAt: number;

  #isRunning: boolean;

  /**
   * Optional upper bound on the per-`update()` `deltaTime`, in the same
   * unit as the time you pass to `update()`.
   *
   * When `> 0`, any `update()` whose measured delta exceeds this value is
   * clamped to `maxDeltaTime` and the overflow is folded into `lostTime`
   * so that `time` does not jump either. Useful against rAF throttling in
   * background tabs, long GC pauses or breakpoints.
   *
   * Default is `0` (disabled).
   */
  maxDeltaTime: number;

  /** Time past since the beginning (w/o the lost/pause time) */
  get time(): number {
    return this.#currentTime - this.#timeStart - this.#lostTime - this.#recentlyLostTime;
  }

  /**
   * The time that has elapsed since the previous time and the current time.
   * Note that the pause times are subtracted here - so it is the time elapsed during the active phases.
   */
  get deltaTime(): number {
    return this.#deltaTime;
  }

  /** The time at the beginning */
  get timeStart(): number {
    return this.#timeStart;
  }

  /** Time lost due to pause */
  get lostTime(): number {
    return this.#lostTime + this.#recentlyLostTime;
  }

  /** The pause state */
  get isRunning(): boolean {
    return this.#isRunning;
  }

  constructor(time?: number, maxDeltaTime = 0) {
    const curTime = getCurrentTime(time);

    this.#timeStart = curTime;
    this.#currentTime = curTime;
    this.#deltaTime = 0;
    this.#lostTime = 0;
    this.#recentlyLostTime = 0;
    this.#pausedAt = curTime;
    this.#isRunning = true;
    this.maxDeltaTime = maxDeltaTime;
  }

  /**
   * Set the current time and update the internal state.
   *
   * While running, the elapsed delta is exposed as {@link deltaTime} (and
   * clamped against {@link maxDeltaTime} if set). While paused, the delta
   * is accumulated into the lost time instead.
   */
  update(time?: number): void {
    const previousTime = this.#currentTime;
    this.#currentTime = getCurrentTime(time);
    const deltaTime = this.#currentTime - previousTime;
    if (this.#isRunning) {
      if (this.maxDeltaTime > 0 && deltaTime > this.maxDeltaTime) {
        this.#lostTime += deltaTime - this.maxDeltaTime;
        this.#deltaTime = this.maxDeltaTime;
      } else {
        this.#deltaTime = deltaTime;
      }
    } else {
      this.#recentlyLostTime += deltaTime;
    }
  }

  /**
   * Pause the chronometer.
   *
   * The wall-clock timestamp is captured (defaulting to
   * `performance.now() / 1000`) so that the matching {@link start} call
   * can close the pause-gap in {@link lostTime} even when no `update()`
   * is called during the pause.
   *
   * No-op when already stopped.
   */
  stop(time?: number): void {
    if (this.#isRunning) {
      this.#isRunning = false;
      this.#recentlyLostTime = 0;
      this.#pausedAt = getCurrentTime(time);
    }
  }

  /**
   * Resume the chronometer.
   *
   * The wall-clock gap since {@link stop} (minus anything already tracked
   * via `update()` during the pause) is folded into {@link lostTime}, and
   * the internal "current time" is advanced to `time`, so the next
   * `update()` produces a normal small delta instead of swallowing the
   * pause duration as a frame spike.
   *
   * `deltaTime` is reset to `0` — no active phase has elapsed yet.
   *
   * No-op when already running.
   */
  start(time?: number): void {
    if (!this.#isRunning) {
      this.#isRunning = true;
      const now = getCurrentTime(time);
      // Untracked pause duration: wall-clock elapsed since stop() minus
      // whatever update() already booked into recentlyLostTime.
      const gap = Math.max(0, now - this.#pausedAt - this.#recentlyLostTime);
      this.#lostTime += this.#recentlyLostTime + gap;
      this.#recentlyLostTime = 0;
      this.#currentTime = now;
      this.#deltaTime = 0;
    }
  }

  /**
   * Reset the chronometer to its initial state.
   *
   * After `reset()` the chronometer is running, `time` is `0`,
   * `deltaTime` is `0` and all pause-tracking state is cleared.
   * {@link maxDeltaTime} is preserved.
   */
  reset(time?: number): void {
    const curTime = getCurrentTime(time);
    this.#timeStart = curTime;
    this.#currentTime = curTime;
    this.#deltaTime = 0;
    this.#lostTime = 0;
    this.#recentlyLostTime = 0;
    this.#pausedAt = curTime;
    this.#isRunning = true;
  }
}
