import {uniform} from 'three/tsl';
import type {Object3D, UniformNode} from 'three/webgpu';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {describeValue} from '../utils/describeValue.js';
import {throwCollected} from '../utils/throwCollected.js';
import {ClearStage} from './ClearStage.js';
import type {IRenderable} from './IRenderable.js';
import {Stage2D} from './Stage2D.js';
import type {StageDirectorLayer} from './StageDirector.js';
import {StageMaskWorldStage} from './StageMaskWorldStage.js';
import type {StageTransition} from './StageTransition.js';

/** What of the picture of a mask stage is the coverage. */
export type StageMaskCoverageSource = 'alpha' | 'luminance' | 'red' | 'green' | 'blue';

export interface StageMaskOptions {
  /**
   * What of the premultiplied picture of the mask stage is the coverage: its alpha, its luminance in
   * the linear working space, or one color channel. Default `'alpha'`.
   */
  source?: StageMaskCoverageSource;
  /** `1 - coverage`: the mask cuts out where its stage draws. Default `false`. */
  invert?: boolean;
}

const SOURCES: readonly StageMaskCoverageSource[] = ['alpha', 'luminance', 'red', 'green', 'blue'];

/**
 * The options of a mask, checked and with their defaults; `subject` leads every message.
 * @internal
 */
export function readMaskOptions(subject: string, options: StageMaskOptions | undefined): Required<StageMaskOptions> {
  if (options !== undefined && (options === null || typeof options !== 'object')) {
    throw new TypeError(`${subject}: the options must be an object, {source?, invert?}, got ${describeValue(options)}`);
  }
  const source = options?.source ?? 'alpha';
  if (!SOURCES.includes(source)) {
    throw new TypeError(
      `${subject}: source must be 'alpha', 'luminance', 'red', 'green' or 'blue', got ${describeValue(source)}`,
    );
  }
  const invert = options?.invert ?? false;
  if (typeof invert !== 'boolean') {
    throw new TypeError(`${subject}: invert must be a boolean, got ${describeValue(invert)}`);
  }
  return {source, invert};
}

/** Whether `value` is a `Stage2D`; a value that throws on the test — a revoked `Proxy` — is none. */
function isStage2D(value: unknown): value is Stage2D {
  try {
    return value instanceof Stage2D;
  } catch {
    return false;
  }
}

/**
 * A refused stage as a message quotes it: an instance of a class by the name of its class, anything
 * else as `describeValue()` writes it. It runs no code of the caller, as `describeValue()` does not:
 * `constructor` and `name` count only as data properties, never through a getter, and a value that
 * throws on the way — a revoked `Proxy` — falls back to `describeValue()`.
 */
function describeStage(value: unknown): string {
  try {
    if (value !== null && typeof value === 'object') {
      const proto: unknown = Object.getPrototypeOf(value);
      const ctor = proto != null ? Object.getOwnPropertyDescriptor(proto, 'constructor')?.value : undefined;
      const name = typeof ctor === 'function' ? Object.getOwnPropertyDescriptor(ctor, 'name')?.value : undefined;
      if (typeof name === 'string' && name !== '' && name !== 'Object') return name;
    }
  } catch {
    // the value refused to be read: describeValue() writes what can be written of it
  }
  return describeValue(value);
}

/**
 * The functions through which a `StageDirector` keeps the state of the masks its transitions use;
 * they are not part of the public API.
 * @internal
 */
export const StageMaskInternals = {} as {
  /** The running transition whose effect names the mask, `undefined` while none does. */
  drivenBy(mask: StageMask): StageTransition | undefined;
  setDrivenBy(mask: StageMask, transition: StageTransition | undefined): void;
  /** Writes `progress` and `progressNode` — the node only when its value changes. */
  setProgress(mask: StageMask, progress: number): void;
  /**
   * Writes the progress of `transition` into `progress` and `progressNode`, as `setProgress()` does.
   * It takes the transition, not its progress: a double handed to a call that V8 does not inline is
   * boxed, and the frame of a running transition allocates nothing.
   */
  followProgress(mask: StageMask, transition: StageTransition): void;
  /** Writes the progress of `transition` into `progressNode` alone: the draw of a progress set after the frame. */
  followProgressNode(mask: StageMask, transition: StageTransition): void;
  /**
   * Calls `listener` once when `mask` is disposed, before the mask disposes a stage it owns: a
   * director that holds the mask takes it off its slots and ends the transitions that name it.
   * Answers the function that unsubscribes. An error of a listener reaches the caller of
   * `dispose()` after every listener has heard it.
   */
  onDispose(mask: StageMask, listener: (mask: StageMask) => void): () => void;
};

/**
 * A stage bound as the mask of a layer: the coverage of its picture says how much of the layer
 * shows. The options are read once, when the mask is made, as the options of a transition effect
 * are. A `StageMask` holds its stage, but does not own it: `dispose()` lets go of it and leaves it
 * undisposed — except the stage {@link StageMask.inWorldOf} builds, which the mask owns.
 */
export class StageMask {
  readonly stage: StageDirectorLayer;
  readonly source: StageMaskCoverageSource;
  readonly invert: boolean;

  /**
   * The eased progress of the transition whose effect names this mask, as a float uniform: for a
   * mask stage whose materials animate on the GPU. The mask owns it; it holds no GPU memory of its
   * own. Written by the director, read by the caller.
   */
  readonly progressNode: UniformNode<'float', number> = uniform(0) as unknown as UniformNode<'float', number>;

  #isDisposed = false;
  #ownsStage = false;
  readonly #disposeListeners = new Set<(mask: StageMask) => void>();
  #drivenBy: StageTransition | undefined;
  // the progress in a typed array: written in every frame of a running transition, and a number
  // field of a mask boxed each fraction stored into it (measured, 16 bytes per frame); an element of
  // a Float64Array takes the double in place
  readonly #progress = new Float64Array(1);

  static {
    StageMaskInternals.drivenBy = (mask) => mask.#drivenBy;
    StageMaskInternals.setDrivenBy = (mask, transition) => {
      mask.#drivenBy = transition;
    };
    StageMaskInternals.setProgress = (mask, progress) => {
      mask.#progress[0] = progress;
      // written only when it changed: a double stored again in the uniform is boxed again, 16 bytes
      if (mask.progressNode.value !== progress) mask.progressNode.value = progress;
    };
    StageMaskInternals.followProgress = (mask, transition) => {
      const progress = transition.progress;
      mask.#progress[0] = progress;
      if (mask.progressNode.value !== progress) mask.progressNode.value = progress;
    };
    StageMaskInternals.followProgressNode = (mask, transition) => {
      const progress = transition.progress;
      if (mask.progressNode.value !== progress) mask.progressNode.value = progress;
    };
    StageMaskInternals.onDispose = (mask, listener) => {
      mask.#disposeListeners.add(listener);
      return () => void mask.#disposeListeners.delete(listener);
    };
  }

  /**
   * A mask that lies in the world of `stage`: a mask stage of its own that draws `scene` through the
   * camera `stage` has at each draw — a new camera of the world, a moved one, the camera of a new
   * projection, is the camera of the next frame. It holds no listener on `stage`. While `stage` has
   * no camera — before its first resize, after its `dispose()` — the mask draws nothing, a coverage
   * of 0. The mask stage takes the size of the director, as every mask stage does.
   *
   * The mask owns the stage it builds: a director wraps and releases it as any mask stage, and never
   * disposes it, so the mask goes back into a slot or a `matte()` as often as you like;
   * {@link dispose} disposes it. `stage` and `scene` stay the caller's.
   *
   * @param stage A `Stage2D` that is not disposed: the camera of a `StageRenderer` is not one camera.
   * @param scene The `THREE.Scene` — or any `Object3D` — the mask draws.
   */
  static inWorldOf(stage: Stage2D, scene: Object3D, options?: StageMaskOptions): StageMask {
    const subject = 'StageMask.inWorldOf()';
    const checked = readMaskOptions(subject, options);
    if (!isStage2D(stage)) {
      throw new TypeError(`${subject}: stage must be a Stage2D, got ${describeStage(stage)}`);
    }
    if (stage.isDisposed) {
      throw new Error(`${subject} cannot take the stage "${stage.name}": that stage has been disposed`);
    }
    if ((scene as Partial<Object3D> | null | undefined)?.isObject3D !== true) {
      throw new TypeError(
        `${subject}: scene must be a three.js Scene or Object3D, got ${describeThreeValue(scene, 'isObject3D')}`,
      );
    }
    const mask = new StageMask(new StageMaskWorldStage(stage, scene), checked);
    mask.#ownsStage = true;
    return mask;
  }

  /**
   * @param stage Any stage a `StageDirector` takes as a layer: it has `renderTo()`, is no `ClearStage`
   *   and is not disposed.
   */
  constructor(stage: StageDirectorLayer, options?: StageMaskOptions) {
    const subject = 'new StageMask()';
    const {source, invert} = readMaskOptions(subject, options);
    if ((stage as {isDisposed?: unknown} | undefined)?.isDisposed === true) {
      throw new Error(`${subject} cannot take the stage "${stage.name}": that stage has been disposed`);
    }
    if (stage instanceof ClearStage) {
      throw new TypeError(
        `${subject} cannot take the stage "${stage.name}": a ClearStage draws no picture to read a coverage from`,
      );
    }
    if (typeof (stage as Partial<IRenderable> | undefined)?.renderTo !== 'function') {
      throw new TypeError(
        `${subject} cannot take the stage ${describeValue(stage)}: a mask stage needs resize(), updateFrame() and renderTo()`,
      );
    }
    this.stage = stage;
    this.source = source;
    this.invert = invert;
  }

  /**
   * The eased progress, 0 to 1, of the transition whose effect names this mask: written by the
   * director in its `updateFrame()`, after it advanced its transitions and before it updates the mask
   * stage. A new transition starts it at 0; between transitions it holds the value of the last one —
   * 1 when it finished, the value at the cancel when it was cancelled. Read-only.
   */
  get progress(): number {
    return this.#progress[0]!;
  }

  get isDisposed(): boolean {
    return this.#isDisposed;
  }

  /**
   * Ends the mask. A director that holds it takes it off every slot it lies on and ends every
   * transition whose effect names it as cancelled; a disposed mask is refused wherever a mask is
   * taken. The stage {@link StageMask.inWorldOf} built is disposed; a stage handed in is let go of
   * and stays undisposed and the caller's. Every director hears of the end, also behind one whose
   * listeners throw: the mask is torn down completely, and the error reaches the caller afterwards
   * — one unchanged, several as an `AggregateError`. A second call does nothing.
   */
  dispose(): void {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    const errors: unknown[] = [];
    const listeners = [...this.#disposeListeners];
    this.#disposeListeners.clear();
    for (const listener of listeners) {
      try {
        listener(this);
      } catch (error) {
        errors.push(error);
      }
    }
    if (this.#ownsStage) {
      try {
        (this.stage as StageMaskWorldStage).dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    throwCollected(errors, 'StageMask#dispose(): more than one director or listener threw while the mask ended');
  }
}
