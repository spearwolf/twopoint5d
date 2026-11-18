import type {WebGPURenderer} from 'three/webgpu';

// The animation loop three runs on a renderer of its own. three 0.187.0 starts it with the first
// render(), compute() or setAnimationLoop() with a callback, and each of these calls starts it
// again after somebody has stopped it; it ticks on every animation frame of the page until
// renderer.dispose(), and setAnimationLoop(null) only takes the callback out of it. three stops
// and starts it only through renderer._animation, private by convention; a renderer without that
// shape keeps its loop running. A display that holds the loop still in its pause therefore covers
// start() on that object with holdStart() until it runs again — any draw in the pause would end
// the pause of the loop otherwise
interface AnimationOfThree {
  start(): void;
  stop(): void;
}

// what start() of a held animation loop of three does: nothing
function holdStart(): void {}

function getAnimationOfThree(renderer: WebGPURenderer): AnimationOfThree | undefined {
  // the three.js typings leave the field off the renderer, and it is null until init() has run
  const animation = (renderer as unknown as {_animation?: Partial<AnimationOfThree> | null})._animation;
  return typeof animation?.start === 'function' && typeof animation.stop === 'function'
    ? (animation as AnimationOfThree)
    : undefined;
}

/** @internal */
export class AnimationLoopHold {
  // the animation loop of three this hold keeps still, and the only one it starts again: stopped,
  // with start() covered by holdStart() on the instance. ownStart is the own property that cover
  // hides — undefined for three's Animation, whose start() sits on its prototype — and goes back
  // once the hold ends
  #held?: {animation: AnimationOfThree; ownStart: PropertyDescriptor | undefined};

  /**
   * Stops the animation loop of three on `renderer` and covers its start() until resume() or
   * release(). Does nothing while it holds a loop already, for a renderer without
   * `renderer._animation`, and while the loop carries a callback.
   */
  hold(renderer: WebGPURenderer): void {
    if (this.#held != null) return;
    const animation = getAnimationOfThree(renderer);
    if (animation == null) return;
    // the display is off its frame loop here, and the rAF driver keeps its callback on the
    // renderer only while a FrameLoop is still on the driver. A callback left on the loop — the
    // driver's, or one the caller has set with renderer.setAnimationLoop() before the first
    // start — keeps the loop running, and its frames go on. One that is set on the renderer after
    // the display has stopped the loop gets no frame while the loop stands still
    if (renderer.getAnimationLoop() != null) return;
    animation.stop();
    // read before the cover goes on: an own start() — that of a stub, say — comes back as it was
    const ownStart = Object.getOwnPropertyDescriptor(animation, 'start');
    Object.defineProperty(animation, 'start', {value: holdStart, configurable: true, enumerable: false, writable: true});
    this.#held = {animation, ownStart};
  }

  /** Ends the hold and starts the loop it held; does nothing while it holds none. */
  resume(): void {
    this.#letGo()?.start();
  }

  /** Ends the hold without starting the loop; does nothing while it holds none. */
  release(): void {
    this.#letGo();
  }

  // ends the hold on the animation loop of three without starting it, and answers the loop it held
  #letGo(): AnimationOfThree | undefined {
    const held = this.#held;
    if (held == null) return undefined;
    this.#held = undefined;
    const {animation, ownStart} = held;
    if (ownStart != null) {
      Object.defineProperty(animation, 'start', ownStart);
    } else {
      Reflect.deleteProperty(animation, 'start');
    }
    return animation;
  }
}
