const getCurrentTime = (time?: number) => (typeof time === 'number' && Number.isFinite(time) ? time : performance.now() / 1000);

/**
 * Wall-clock-aware time source with pause/resume support.
 *
 * The chronometer is unit-agnostic: every method that accepts a `time`
 * argument and the value returned by the internal default
 * (`performance.now() / 1000`) must use the **same unit**. The default unit
 * is seconds. If you pass milliseconds (or any other unit) to one method,
 * pass the same unit to all others — including the optional `maxDeltaTime`.
 *
 * A `time` that is not a finite number (`NaN`, `Infinity`, `-Infinity`) counts as not given, and
 * the chronometer reads `performance.now() / 1000` in its place. That holds for the constructor,
 * `update()`, `start()`, `stop()` and `reset()`.
 */
export class Chronometer {
  #timeStart: number;

  /**
   * The latest time the chronometer has seen. The constructor and `reset()` set it; `update()`,
   * `stop()` and `start()` only ever move it forward
   */
  #currentTime: number;

  #deltaTime: number;

  #rawDeltaTime: number;

  /**
   * Time lost to the pauses `start()` has closed, and the part of an `update()` delta that
   * `maxDeltaTime` cut off
   */
  #lostTime: number;

  /**
   * Time counted as lost since the most recent `stop()` — by `stop()` itself and by the `update()`
   * calls of the pause; `start()` moves it into `#lostTime`
   */
  #recentlyLostTime: number;

  #isRunning: boolean;

  /**
   * Optional upper bound on the per-`update()` `deltaTime`, in the same
   * unit as the time you pass to `update()`.
   *
   * When `> 0`, any `update()` whose measured delta exceeds this value is
   * clamped to `maxDeltaTime` and the overflow is folded into `lostTime`
   * so that `time` does not jump either. Useful against rAF throttling in
   * background tabs, long GC pauses or breakpoints. {@link rawDeltaTime}
   * carries the delta before the cut.
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
   * Note that the pause times are subtracted here - so it is the time elapsed during the active
   * phases. `0` after an `update()` of the stopped chronometer.
   */
  get deltaTime(): number {
    return this.#deltaTime;
  }

  /**
   * The time that has elapsed between the previous time and the current time, as
   * {@link deltaTime}, with the pause times subtracted — but before {@link maxDeltaTime} cuts
   * it. Equal to `deltaTime` as long as `maxDeltaTime` is `0` or not exceeded. `0` after an
   * `update()` of the stopped chronometer.
   */
  get rawDeltaTime(): number {
    return this.#rawDeltaTime;
  }

  /** The time at the beginning */
  get timeStart(): number {
    return this.#timeStart;
  }

  /**
   * Time lost due to pause, and the part of an `update()` delta that {@link maxDeltaTime} cut off
   */
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
    this.#rawDeltaTime = 0;
    this.#lostTime = 0;
    this.#recentlyLostTime = 0;
    this.#isRunning = true;
    this.maxDeltaTime = maxDeltaTime;
  }

  /**
   * Set the current time and update the internal state.
   *
   * While running, the elapsed delta is exposed as {@link deltaTime} (and
   * clamped against {@link maxDeltaTime} if set). While paused, the delta
   * is accumulated into the lost time instead, and {@link deltaTime} and
   * {@link rawDeltaTime} are `0`: no active phase elapses in a pause.
   *
   * A `time` before the current one counts as no time passing: {@link deltaTime} is `0`, and
   * {@link time} stays where it is.
   */
  update(time?: number): void {
    const previousTime = this.#currentTime;
    // a time before the current one counts as no time passing: a rAF timestamp is taken at the
    // vsync and can lie before a performance.now() read later in the same frame, and time does
    // not run backwards
    const deltaTime = Math.max(0, getCurrentTime(time) - previousTime);
    this.#currentTime = previousTime + deltaTime;
    if (this.#isRunning) {
      this.#rawDeltaTime = deltaTime;
      if (this.maxDeltaTime > 0 && deltaTime > this.maxDeltaTime) {
        this.#lostTime += deltaTime - this.maxDeltaTime;
        this.#deltaTime = this.maxDeltaTime;
      } else {
        this.#deltaTime = deltaTime;
      }
    } else {
      this.#recentlyLostTime += deltaTime;
      // no active phase elapses in a pause
      this.#deltaTime = 0;
      this.#rawDeltaTime = 0;
    }
  }

  /**
   * Pause the chronometer.
   *
   * The span from the latest time the chronometer has seen — the last `update()`, or the
   * constructor, `start()` or `reset()` where none followed — to `time` (defaulting to
   * `performance.now() / 1000`) counts as lost, as the pause after it does: {@link lostTime} grows
   * by it, and {@link time} stays where the last `update()` put it. Only the `deltaTime` of the
   * `update()` calls moves {@link time}; neither `stop()` nor {@link start} does.
   *
   * A `time` before the latest one the chronometer has seen counts as that one: time does not
   * run backwards.
   *
   * {@link deltaTime} and {@link rawDeltaTime} keep their values until the next `update()`.
   *
   * No-op when already stopped.
   */
  stop(time?: number): void {
    if (this.#isRunning) {
      this.#isRunning = false;
      // a time before the latest one the chronometer has seen counts as that one, as in
      // update() — time does not run backwards
      const at = Math.max(getCurrentTime(time), this.#currentTime);
      this.#recentlyLostTime = at - this.#currentTime;
      this.#currentTime = at;
    }
  }

  /**
   * Resume the chronometer.
   *
   * The pause counts as lost: the span from the latest time the chronometer has seen — the
   * {@link stop}, or the last `update()` of the pause — to `time` joins what `stop()` and the
   * `update()` calls of the pause have counted in {@link lostTime}, and the internal "current
   * time" is advanced to `time`, so the next `update()` produces a normal small delta instead of
   * swallowing the pause duration as a frame spike. {@link time} stays where the last `update()`
   * before the pause put it.
   *
   * A `time` before the latest one the chronometer has seen counts as that one: time does not
   * run backwards, and the "current time" is only ever advanced, never set back.
   *
   * `deltaTime` and `rawDeltaTime` are reset to `0` — no active phase has elapsed yet.
   *
   * No-op when already running.
   */
  start(time?: number): void {
    if (!this.#isRunning) {
      this.#isRunning = true;
      // a time before the latest one the chronometer has seen counts as that one, as in
      // update() — time does not run backwards
      const now = Math.max(getCurrentTime(time), this.#currentTime);
      // the span since the latest time seen in the pause — the stop() or an update() of the
      // pause — has not been counted yet
      this.#lostTime += this.#recentlyLostTime + (now - this.#currentTime);
      this.#recentlyLostTime = 0;
      this.#currentTime = now;
      this.#deltaTime = 0;
      this.#rawDeltaTime = 0;
    }
  }

  /**
   * Reset the chronometer to its initial state.
   *
   * After `reset()` the chronometer is running, `time` is `0`,
   * `deltaTime` and `rawDeltaTime` are `0` and all pause-tracking state is cleared.
   * {@link maxDeltaTime} is preserved.
   */
  reset(time?: number): void {
    const curTime = getCurrentTime(time);
    this.#timeStart = curTime;
    this.#currentTime = curTime;
    this.#deltaTime = 0;
    this.#rawDeltaTime = 0;
    this.#lostTime = 0;
    this.#recentlyLostTime = 0;
    this.#isRunning = true;
  }
}
