const getCurrentTime = (time?: number) => (typeof time === 'number' && !isNaN(time) ? time : performance.now() / 1000);

export class Chronometer {
  #timeStart: number;

  /** The current time, which is set by calling the `update()` method */
  #currentTime: number;

  #deltaTime: number;

  /** Time lost due to pause before the previous time */
  #lostTime: number;

  /** Time lost due to pause after the previous time */
  #recentyLostTime: number;

  #isRunning: boolean;

  /** Time past since the beginning (w/o the lost/pause time) */
  get time(): number {
    return this.#currentTime - this.#timeStart - this.#lostTime - this.#recentyLostTime;
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
    return this.#lostTime + this.#recentyLostTime;
  }

  /** The pause state */
  get isRunning(): boolean {
    return this.#isRunning;
  }

  constructor(time?: number) {
    const curTime = getCurrentTime(time);

    this.#timeStart = curTime;
    this.#currentTime = curTime;
    this.#deltaTime = 0;
    this.#lostTime = 0;
    this.#recentyLostTime = 0;
    this.#isRunning = true;
  }

  /** Set the current time and update the internal state when necessary (time is running) */
  update(time?: number): void {
    const previousTime = this.#currentTime;
    this.#currentTime = getCurrentTime(time);
    const deltaTime = this.#currentTime - previousTime;
    if (this.#isRunning) {
      this.#deltaTime = deltaTime;
    } else {
      this.#recentyLostTime += deltaTime;
    }
  }

  /**
   * Make a break.
   * This will freeze the time until you restart it by calling the `start()` method.
   */
  stop(): void {
    if (this.#isRunning) {
      this.#isRunning = false;
      this.#recentyLostTime = 0;
    }
  }

  /** Restart the chronometer when is not running */
  start(): void {
    if (!this.#isRunning) {
      this.#isRunning = true;
      this.#lostTime += this.#recentyLostTime;
      this.#recentyLostTime = 0;
    }
  }
}
