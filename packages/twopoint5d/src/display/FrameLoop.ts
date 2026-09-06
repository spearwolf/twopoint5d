import {emit, type EventizedObject, eventize, off, on} from '@spearwolf/eventize';

export interface ISetAnimationLoop {
  // `null` is how three.js stops the loop again, and `stop()` below uses it.
  setAnimationLoop(callback: ((now: number) => unknown) | null): unknown;
}

export const OnRAF = Symbol.for('onRAF');
const OnFrame = Symbol.for('onFrame');

const MEASURE_FPS_AFTER_NTH_FRAME = 30;
const MEASURE_COLLECTION_SIZE = 10;

// `let`, because a WeakMap cannot be emptied — only replaced. See FrameLoop.resetRAF().
let rafUniqueInstances: WeakMap<object, RAF> = new WeakMap();
let rafUniqueInstance: RAF | null = null;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface RAF extends EventizedObject {}

class RAF {
  static get(renderer?: ISetAnimationLoop): RAF {
    if (renderer != null) {
      let raf = rafUniqueInstances.get(renderer);
      if (raf == null) {
        raf = new RAF(renderer);
        rafUniqueInstances.set(renderer, raf);
      }
      return raf;
    }
    if (rafUniqueInstance == null) {
      rafUniqueInstance = new RAF();
    }
    return rafUniqueInstance;
  }

  #rafID = 0;

  // The driver runs exactly as long as somebody drives it: a rAF chain nobody listens to keeps
  // the page awake and measures fps into the void.
  #loops = new Set<FrameLoop>();

  // Set whenever the driver picks its work back up. The first tick after that has no previous
  // timestamp to measure against, so it anchors the window instead of producing a sample.
  #needsMeasureAnchor = true;

  frameNo = 0;

  measureOnFrame = 0;
  measureTimeBegin = 0;
  measureTimeEnd = 0;

  measuredFps = 0;
  measuredFpsCollection: number[] = [];

  constructor(private readonly renderer?: ISetAnimationLoop) {
    eventize(this);
  }

  attach(loop: FrameLoop): void {
    if (this.#loops.has(loop)) return;

    this.#loops.add(loop);
    on(this, OnRAF, loop);

    this.start();
  }

  detach(loop: FrameLoop): void {
    if (!this.#loops.delete(loop)) return;

    off(this, OnRAF, loop);

    if (this.#loops.size === 0) {
      this.stop();
    }
  }

  #onAnimationFrame = (now: number) => {
    if (this.renderer == null) {
      this.#rafID = requestAnimationFrame(this.#onAnimationFrame);
    }

    this.measureFps(now);

    ++this.frameNo;

    emit(this, OnRAF, now, this.frameNo, this.measuredFps);
  };

  start() {
    if (this.#rafID !== 0) return;
    if (this.renderer) {
      this.renderer.setAnimationLoop(this.#onAnimationFrame);
      this.#rafID = 1; // Using 1 to indicate that the renderer is set
    } else {
      this.#rafID = requestAnimationFrame(this.#onAnimationFrame);
    }
  }

  stop() {
    // an already halted driver has nothing to hand back, and cancelAnimationFrame(0) needs a
    // global that a bare node process does not have
    if (this.#rafID === 0) return;

    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
    } else {
      cancelAnimationFrame(this.#rafID);
    }
    this.#rafID = 0;
    this.#needsMeasureAnchor = true;
  }

  measureFps(now: number) {
    if (this.#needsMeasureAnchor) {
      // The tick that opens a measurement window anchors it. There is no previous timestamp to
      // measure against yet, and a window anchored at 0 — or across the span in which nobody
      // asked for a frame — reports an fps the renderer never ran at.
      this.measureTimeBegin = now;
      this.measureOnFrame = this.frameNo + MEASURE_FPS_AFTER_NTH_FRAME;
      this.#needsMeasureAnchor = false;
      return;
    }
    if (this.frameNo >= this.measureOnFrame) {
      this.measureTimeEnd = now;
      const measuredFps = Math.round(1000 / ((this.measureTimeEnd - this.measureTimeBegin) / MEASURE_FPS_AFTER_NTH_FRAME));
      this.measureOnFrame = this.frameNo + MEASURE_FPS_AFTER_NTH_FRAME;
      this.measureTimeBegin = now;

      this.measuredFpsCollection.push(measuredFps);

      // Trimmed before it is averaged: a collection that still carries the sample beyond the
      // window would average over one value more than the window is named for.
      while (this.measuredFpsCollection.length > MEASURE_COLLECTION_SIZE) {
        this.measuredFpsCollection.shift();
      }

      if (this.measuredFpsCollection.length >= MEASURE_COLLECTION_SIZE) {
        this.measuredFps = Math.round(
          this.measuredFpsCollection.reduce((sum, fps) => sum + fps, 0) / this.measuredFpsCollection.length,
        );
      } else {
        this.measuredFps = measuredFps;
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FrameLoop extends EventizedObject {}

export class FrameLoop {
  static OnFrame = OnFrame;

  /**
   * Drops the rAF drivers that every `FrameLoop` of this module shares, so the next
   * `FrameLoop` builds a fresh one.
   *
   * This is a testing aid. A test file that constructs several loops in one worker
   * otherwise inherits the frame counter and the fps measurement of the previous case;
   * after this call every case starts at frame zero with an unmeasured fps.
   *
   * A `FrameLoop` that is still running keeps pointing at its old driver: on the
   * renderer-less driver it stops receiving frames, because that one is stopped here;
   * on a renderer-bound driver it goes on ticking until the next `FrameLoop` built on that
   * renderer takes its frames away without a sound. Either way this belongs in a
   * teardown hook, next to nothing that is still alive.
   *
   * The drivers bound to a renderer are not stopped here: they live in a `WeakMap`,
   * which cannot be walked. They also need no stopping, because `Renderer.dispose()`
   * of three.js ends with `setAnimationLoop(null)`.
   *
   * The call is safe in any environment, `requestAnimationFrame` or not: without it
   * no renderer-less driver can ever have been built.
   */
  static resetRAF(): void {
    rafUniqueInstance?.stop();
    rafUniqueInstance = null;
    rafUniqueInstances = new WeakMap();
  }

  #maxFps = 0;
  #subscribers = new Set<object>();
  #lastNow?: number = undefined;

  // Rastered emit-schedule for the maxFps throttle. `0` means "no schedule
  // yet" (first tick or after setFps()); afterwards the next slot is kept
  // on a stable grid so vsync jitter cannot drift it.
  #nextEmitAt = 0;
  #emitTolerance = 0;

  frameNo = 0;
  now = 0;
  deltaTime = 0;
  measuredFps = 0;

  get subscriptionCount() {
    return this.#subscribers.size;
  }

  private readonly raf: RAF;

  constructor(maxFps = 0, renderer?: ISetAnimationLoop) {
    eventize(this);
    this.raf = RAF.get(renderer);
    this.setFps(maxFps);
  }

  setFps(maxFps: number) {
    this.#maxFps = Number.isFinite(maxFps) ? Math.abs(maxFps) : 0;
    this.#nextEmitAt = 0;
    this.#emitTolerance = this.#maxFps > 0 ? (1000 / this.#maxFps) * 0.02 : 0;
  }

  /**
   * Subscribe `target` to the loop.
   *
   * A `target` that is already on the loop stays subscribed exactly once.
   *
   * @returns a function that takes `target` off the loop again — every call hands one back.
   */
  start(target: object): () => void {
    if (target != null && !this.#subscribers.has(target)) {
      this.#subscribers.add(target);

      if (this.subscriptionCount === 1) {
        this.raf.attach(this);
      }

      on(this as FrameLoop, FrameLoop.OnFrame, target);
    }

    return () => {
      this.stop(target);
    };
  }

  stop(target: object) {
    if (target == null) return;
    if (this.#subscribers.has(target)) {
      this.#subscribers.delete(target);

      off(this, FrameLoop.OnFrame, target);

      if (this.subscriptionCount === 0) {
        this.raf.detach(this);
      }
    }
  }

  [OnRAF](now: number, _frameNo: number, measuredFps: number) {
    // Rastered throttle: emit when `now` reaches the next scheduled slot
    // (minus a small jitter tolerance). The schedule stays on a fixed grid
    // so individual rAF jitter cannot drift the cadence; a long pause
    // (tab hidden, GC) snaps the schedule forward instead of producing a
    // catch-up burst.
    if (this.#maxFps !== 0 && now < this.#nextEmitAt - this.#emitTolerance) {
      return;
    }

    const prevNow = this.#lastNow;
    this.now = now;
    ++this.frameNo;
    this.measuredFps = measuredFps;
    this.deltaTime = prevNow == null ? 0 : now - prevNow;
    this.#lastNow = now;

    if (this.#maxFps > 0) {
      const interval = 1000 / this.#maxFps;
      this.#nextEmitAt = this.#nextEmitAt === 0 ? now + interval : this.#nextEmitAt + interval;
      if (now >= this.#nextEmitAt) {
        this.#nextEmitAt = now + interval;
      }
    }

    // call FrameLoop subscribers
    emit(this, FrameLoop.OnFrame, {
      now: now / 1000,
      lastNow: (prevNow ?? now) / 1000,
      frameNo: this.frameNo,
      deltaTime: this.deltaTime / 1000,
      measuredFps: this.measuredFps,
    });
  }

  clear() {
    for (const target of Array.from(this.#subscribers)) {
      this.stop(target);
    }
  }
}
