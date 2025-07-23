import {emit, eventize, off, on} from '@spearwolf/eventize';

interface ISetAnimationLoop {
  setAnimationLoop(callback: (now: number) => unknown): unknown;
}

const OnRAF = Symbol.for('onRAF');
const OnFrame = Symbol.for('onFrame');

const MEASURE_FPS_AFTER_NTH_FRAME = 30;
const MEASURE_COLLECTION_SIZE = 10;

const rafUniqueInstances: WeakMap<object, RAF> = new WeakMap();
let rafUniqueInstance: RAF = null;

class RAF {
  static get(renderer?: ISetAnimationLoop): RAF {
    if (renderer != null) {
      if (!rafUniqueInstances.has(renderer)) {
        rafUniqueInstances.set(renderer, new RAF(renderer));
      }
      return rafUniqueInstances.get(renderer);
    }
    if (rafUniqueInstance == null) {
      rafUniqueInstance = new RAF();
    }
    return rafUniqueInstance;
  }

  #rafID = 0;

  frameNo = 0;

  measureOnFrame = 0;
  measureTimeBegin = 0;
  measureTimeEnd = 0;

  measuredFps = 0;
  measuredFpsCollection: number[] = [];

  constructor(private readonly renderer?: ISetAnimationLoop) {
    eventize(this);
    this.start();
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
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
    } else {
      cancelAnimationFrame(this.#rafID);
    }
    this.#rafID = 0;
  }

  measureFps(now: number) {
    if (this.frameNo === 0 || this.frameNo >= this.measureOnFrame) {
      this.measureTimeEnd = now;
      const measuredFps = Math.round(1000 / ((this.measureTimeEnd - this.measureTimeBegin) / MEASURE_FPS_AFTER_NTH_FRAME));
      this.measureOnFrame = this.frameNo + MEASURE_FPS_AFTER_NTH_FRAME;
      this.measureTimeBegin = now;

      this.measuredFpsCollection.push(measuredFps);

      if (this.measuredFpsCollection.length >= MEASURE_COLLECTION_SIZE) {
        this.measuredFps = Math.round(
          this.measuredFpsCollection.reduce((sum, fps) => sum + fps, 0) / this.measuredFpsCollection.length,
        );
        while (this.measuredFpsCollection.length > MEASURE_COLLECTION_SIZE) {
          this.measuredFpsCollection.shift();
        }
      } else {
        this.measuredFps = measuredFps;
      }
    }
  }
}

export class FrameLoop {
  static OnFrame = OnFrame;

  #maxFps = 0;
  #subscribers = new Set<object>();
  #lastNow?: number = undefined;

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
  }

  start(target: object) {
    if (target == null) return;
    if (this.#subscribers.has(target)) return;

    this.#subscribers.add(target);

    if (this.subscriptionCount === 1) {
      on(this.raf, OnRAF, this);
    }

    on(this, FrameLoop.OnFrame, target);

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
        off(this.raf, OnRAF, this);
      }
    }
  }

  [OnRAF](now: number, _frameNo: number, measuredFps: number) {
    if (this.#maxFps === 0 || this.#lastNow == null || now - this.#lastNow >= 0.98 * (1000 / this.#maxFps)) {
      this.now = now;
      ++this.frameNo;
      this.measuredFps = measuredFps;
      this.deltaTime = this.#lastNow != null && this.frameNo === 1 ? 0 : now - this.#lastNow;
      this.#lastNow = now;

      // call FrameLoop subscribers
      emit(this, FrameLoop.OnFrame, {
        now: now / 1000,
        lastNow: this.#lastNow / 1000,
        frameNo: this.frameNo,
        deltaTime: this.deltaTime / 1000,
        measuredFps: this.measuredFps,
      });
    }
  }

  clear() {
    for (const target of Array.from(this.#subscribers)) {
      this.stop(target);
    }
  }
}
