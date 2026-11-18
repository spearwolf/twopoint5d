// The records a `StageDirector` keeps of its stack — its layers, the slots of the stack and the
// transitions that run in them, the place of each entry of `orderedStages` —, the owners of every
// stage a director holds, and the checks of masks and stages that more than one part of the director
// makes. This module is not in `public-api.ts`: only `StageDirector.ts`, `DirectorShapeCache.ts` and
// `DirectorMasks.ts` read it.

import {describeValue} from '../utils/describeValue.js';
import type {IStage} from './IStage.js';
import type {StageDirector, StageDirectorLayer} from './StageDirector.js';
import {StageMask} from './StageMask.js';
import {StageRenderer, type StageRendererParentType} from './StageRenderer.js';
import type {StageTransition} from './StageTransition.js';
import type {StageTransitionEffect} from './transitionEffects.js';

/** @internal */
export interface Layer {
  /** The stage the caller handed in. */
  readonly stage: StageDirectorLayer;
  /** A layer of the stack, or the stage of a mask; a stage is never both. */
  readonly role: 'layer' | 'mask';
  /**
   * How many slot masks and running transitions use a mask stage — a transition once per stage its
   * effect names, however many of its masks lie on it; 0 for a layer.
   */
  uses: number;
  /**
   * The share of the full size the pass target of a mask stage has, from the `scale` of the masks
   * on it — one stage, one target, one scale; `1` for a layer.
   */
  readonly scale: number;
  /** The stage itself, or the renderer the director wrapped it in. */
  readonly renderer: StageRenderer;
  readonly wrapped: boolean;
  frozen: boolean;
  /** A frozen layer that has no picture in its pass target yet: drawn once, without an update. */
  needsPicture: boolean;
  unsubscribe?: () => void;
}

/** @internal */
export interface Run {
  readonly transition: StageTransition;
  readonly from: Layer | undefined;
  readonly to: Layer | undefined;
  readonly fromWasFrozen: boolean;
  /**
   * Whether a `freeze()` or `run()` reached `from` while the transition ran: its state is then the
   * caller's, and the end of the transition leaves it as it is.
   */
  fromByHand: boolean;
  /**
   * Whether a `freeze()` or `run()` reached `to` while the transition ran: its state is then the
   * caller's, and the end of the transition leaves it as it is.
   */
  toByHand: boolean;
  /** The masks the effect names, as they stood when the transition began; each one is driven by it. */
  readonly masks: readonly StageMask[];
}

/** @internal */
export interface Slot {
  /** What the slot shows while no transition runs in it. */
  layer?: Layer;
  run?: Run;
  /** The layer a push() froze below this one, which runs again when this slot goes. */
  frozeBelow?: Layer;
  /** The mask of the slot: it stays through replace() and goes with the slot. */
  mask?: StageMask;
}

/**
 * Which slot and which of its sources an entry of `orderedStages` is — or, after every layer, which
 * of the distinct mask stages, counted by first appearance: the stages of the slot masks bottom-up,
 * then those of the running effects slot by slot, as `distinctMasks()` in `DirectorShapeCache.ts`
 * counts them.
 * @internal
 */
export type OrderRef =
  | {readonly side: 'layer' | 'from' | 'to'; readonly slot: number}
  | {readonly side: 'mask'; readonly maskStage: number};

/**
 * Every stage a director draws as a mask, and that director: a stage is the mask stage of one
 * director at a time, since that director draws and updates it.
 * @internal
 */
export const maskOwners = new WeakMap<IStage, StageDirector>();

/**
 * Every stage a director holds as a layer, and the directors that hold it so.
 * @internal
 */
export const layerOwners = new WeakMap<IStage, Set<StageDirector>>();

/** @internal */
export const NO_MASKS: readonly StageMask[] = Object.freeze([]);

/**
 * The masks `effect` names, checked; a snapshot, so a list changed later changes no running transition.
 * @internal
 */
export function masksOf(subject: string, effect: StageTransitionEffect): readonly StageMask[] {
  const masks: unknown = effect.masks;
  if (masks === undefined) return NO_MASKS;
  if (!Array.isArray(masks) || !masks.every((mask) => mask instanceof StageMask)) {
    throw new TypeError(
      `${subject}: the masks of the effect ${describeValue(effect.name)} must be an array of StageMask, got ${describeValue(masks)}`,
    );
  }
  return masks.length === 0 ? NO_MASKS : Object.freeze([...(masks as StageMask[])]);
}

/**
 * Why `stage` cannot be drawn by the director `holder` — it is the director or holds it —, or
 * `undefined`.
 * @internal
 */
export function holdRefusal(holder: StageRenderer, stage: IStage): string | undefined {
  if (!(stage instanceof StageRenderer)) return undefined;
  for (let h: StageRendererParentType | undefined = holder; h instanceof StageRenderer; h = h.parent) {
    if (h === stage) return h === holder ? 'that stage is this director' : 'that stage holds this director';
  }
  return undefined;
}
