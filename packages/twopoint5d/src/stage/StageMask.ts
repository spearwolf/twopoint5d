import {describeValue} from '../utils/describeValue.js';
import {ClearStage} from './ClearStage.js';
import type {IRenderable} from './IRenderable.js';
import type {StageDirectorLayer} from './StageDirector.js';
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

/**
 * The functions through which a `StageDirector` keeps the state of the masks its transitions use;
 * they are not part of the public API.
 * @internal
 */
export const StageMaskInternals = {} as {
  /** The running transition whose effect names the mask, `undefined` while none does. */
  drivenBy(mask: StageMask): StageTransition | undefined;
  setDrivenBy(mask: StageMask, transition: StageTransition | undefined): void;
};

/**
 * A stage bound as the mask of a layer: the coverage of its picture says how much of the layer
 * shows. The options are read once, when the mask is made, as the options of a transition effect
 * are. A `StageMask` holds its stage, but does not own it: `dispose()` lets go of it and leaves it
 * undisposed.
 */
export class StageMask {
  readonly stage: StageDirectorLayer;
  readonly source: StageMaskCoverageSource;
  readonly invert: boolean;

  #isDisposed = false;
  #drivenBy: StageTransition | undefined;

  static {
    StageMaskInternals.drivenBy = (mask) => mask.#drivenBy;
    StageMaskInternals.setDrivenBy = (mask, transition) => {
      mask.#drivenBy = transition;
    };
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

  get isDisposed(): boolean {
    return this.#isDisposed;
  }

  /** Lets go of the stage, which stays undisposed and the caller's. */
  dispose(): void {
    this.#isDisposed = true;
  }
}
