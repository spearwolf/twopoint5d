// The masks of the slots and of the running transitions of a `StageDirector`: their checks before
// any change, the uses of their stages, the watch on their `dispose()` and the progress the
// transitions hand on to their masks. The director keeps its stack, its layers and its transitions,
// and reaches them for the masks through a host. This module is not in `public-api.ts`: only
// `StageDirector.ts` reaches it.

import {describeValue} from '../utils/describeValue.js';
import {throwCollected} from '../utils/throwCollected.js';
import {holdRefusal, type Layer, layerOwners, maskOwners, masksOf, NO_MASKS, type Slot} from './directorSlots.js';
import type {IStage} from './IStage.js';
import type {StageDirector, StageDirectorLayer} from './StageDirector.js';
import {StageMask, StageMaskInternals} from './StageMask.js';
import type {StageTransition} from './StageTransition.js';
import type {StageTransitionEffect} from './transitionEffects.js';

/** Whether `masks[index]` is the first mask of the list on its stage: a stage counts once per transition. */
function firstOnItsStage(masks: readonly StageMask[], index: number): boolean {
  const stage = masks[index]!.stage;
  for (let i = 0; i < index; i++) if (masks[i]!.stage === stage) return false;
  return true;
}

/**
 * What a {@link DirectorMasks} reaches of its director beyond the public members. The director
 * fills it. Not exported from the package.
 * @internal
 */
export interface DirectorMasksHost {
  /** The slots of the director as they stand now. */
  slots(): readonly Slot[];
  /** The layer or mask stage of the director for `stage`, if it has one. */
  layerOf(stage: IStage): Layer | undefined;
  /** Makes `stage` a mask stage of the director at the pass target share `scale`, or answers the one it is. */
  joinMask(subject: string, stage: StageDirectorLayer, errors: unknown[], scale: number): Layer | undefined;
  /** Takes `layer` out of the director; throws what listeners threw on the way. */
  release(layer: Layer): void;
  /** Ends the transition of `slot`, leaving the source `keep` in it. */
  endRun(slot: Slot, keep: 'from' | 'to', state: 'finished' | 'cancelled', errors: unknown[]): void;
  /** Tells the director that its slots have changed. */
  slotsChanged(): void;
}

/** @internal */
export class DirectorMasks {
  readonly #director: StageDirector;
  readonly #host: DirectorMasksHost;
  /**
   * Every `StageMask` a slot or a running transition holds, and the function that ends the watch
   * on its dispose; `watch()` brings it in step with every change of the slots the director reports
   * through its `#slotsChanged()`.
   */
  readonly #watches = new Map<StageMask, () => void>();

  constructor(director: StageDirector, host: DirectorMasksHost) {
    this.#director = director;
    this.#host = host;
  }

  /**
   * Refuses `mask` before anything changes; `layer` is the stage the call puts into the new slot.
   * Answers the mask, `undefined` for none.
   */
  check(subject: string, mask: unknown, layer?: IStage): StageMask | undefined {
    if (mask === undefined) return undefined;
    if (!(mask instanceof StageMask)) {
      throw new TypeError(`${subject}: mask must be a StageMask, got ${describeValue(mask)}`);
    }
    const stage = mask.stage;
    const refusal = (reason: string) => new Error(`${subject} cannot take the mask on ${describeValue(stage.name)}: ${reason}`);
    if (mask.isDisposed) throw refusal('that mask has been disposed');
    if ((stage as {isDisposed?: unknown}).isDisposed === true) throw refusal('that stage has been disposed');
    const hold = holdRefusal(this.#director, stage);
    if (hold) throw refusal(hold);
    if (stage === layer || this.#host.layerOf(stage)?.role === 'layer') {
      throw refusal('that stage is a layer of this director');
    }
    const owner = maskOwners.get(stage);
    if (owner !== undefined && owner !== this.#director) throw refusal('that stage is a mask of another director');
    // this director holds the stage as no layer, so every holder is another director
    if (layerOwners.get(stage)?.size) throw refusal('that stage is a layer of another director');
    return mask;
  }

  /**
   * Refuses the masks `options.effect` names before anything changes, as `check()` refuses the
   * mask of a slot, and a mask that drives a transition already — unless that transition is one
   * the call ends anyway, as `ends` tells. Answers the masks the transition will use: none for a
   * change without a transition, which draws no effect.
   */
  checkEffectMasks(
    subject: string,
    options: {readonly effect: StageTransitionEffect; readonly instant: boolean},
    layer: IStage | undefined,
    ends: (transition: StageTransition) => boolean,
  ): readonly StageMask[] {
    const masks = masksOf(subject, options.effect);
    for (const mask of masks) this.check(subject, mask, layer);
    if (options.instant) return NO_MASKS;
    for (const mask of masks) {
      const driver = StageMaskInternals.drivenBy(mask);
      if (driver !== undefined && !ends(driver)) {
        throw new Error(`${subject}: the mask ${describeValue(mask.stage.name)} drives a transition already`);
      }
    }
    return masks;
  }

  /**
   * Refuses, before anything changes, a mask of the call whose `scale` differs from that of its
   * stage: a mask stage has one pass target, so every mask on it has the scale the stage is drawn at
   * — the scale of the masks that use it now, or else of the first mask of this call on it. A stage
   * takes another scale once it has left the director.
   */
  checkScales(subject: string, masks: readonly (StageMask | undefined)[]): void {
    for (let i = 0; i < masks.length; i++) {
      const mask = masks[i];
      if (!mask) continue;
      const refusal = (reason: string) =>
        new Error(`${subject} cannot take the mask on ${describeValue(mask.stage.name)}: ${reason}, and a stage has one target`);
      const known = this.#host.layerOf(mask.stage);
      if (known?.role === 'mask' && known.scale !== mask.scale) {
        throw refusal(`that stage is drawn as a mask at a scale of ${known.scale} already`);
      }
      for (let j = 0; j < i; j++) {
        const other = masks[j];
        if (other && other.stage === mask.stage && other.scale !== mask.scale) {
          throw refusal(`another mask of this call on that stage has a scale of ${other.scale}`);
        }
      }
    }
  }

  /**
   * Refuses a mask of `masks` that drives a transition, called once the call has ended the runs it
   * meant to end: a driver that still stands belongs to a transition a listener started.
   */
  refuseDriven(subject: string, masks: readonly StageMask[]): void {
    for (const mask of masks) {
      if (StageMaskInternals.drivenBy(mask) !== undefined) {
        throw new Error(`${subject}: the mask ${describeValue(mask.stage.name)} drives a transition already`);
      }
    }
  }

  /**
   * One use for every stage among `masks`, each stage once: a stage that is no mask of the
   * director yet joins. A stage that refuses to join gives back the uses taken before it, and the
   * errors of listeners this call put into `errors` are thrown behind the refusal. A listener of a
   * join that disposes the director ends the call; the caller finds the director disposed.
   */
  use(subject: string, masks: readonly StageMask[], errors: unknown[]): void {
    const before = errors.length;
    let i = 0;
    try {
      for (; i < masks.length; i++) {
        if (!firstOnItsStage(masks, i)) continue;
        const layer = this.#host.joinMask(subject, masks[i]!.stage, errors, masks[i]!.scale);
        if (!layer) return;
        layer.uses++;
      }
    } catch (error) {
      const collected = [error, ...errors.splice(before)];
      this.unuse(masks.slice(0, i), collected);
      throwCollected(collected, `${subject}: more than one error on the way back from a mask stage that refused to join`);
    }
  }

  /** Gives back the uses `use()` took for `masks`. */
  unuse(masks: readonly StageMask[], errors: unknown[]): void {
    for (let i = 0; i < masks.length; i++) {
      if (firstOnItsStage(masks, i)) this.#unuseMask(masks[i]!, errors);
    }
  }

  /**
   * Puts `mask` on `slot`: the stage of the new mask joins first, then the stage of the old one leaves
   * if nothing uses it any more. A listener of the join that disposes the director leaves the slot as
   * it was; the caller finds the director disposed.
   */
  maskSlot(subject: string, slot: Slot, mask: StageMask | undefined, errors: unknown[]): void {
    const old = slot.mask;
    if (old === mask) return;
    if (mask) {
      const layer = this.#host.joinMask(subject, mask.stage, errors, mask.scale);
      if (!layer) return;
      layer.uses++;
    }
    slot.mask = mask;
    if (old) this.#unuseMask(old, errors);
    this.#host.slotsChanged();
  }

  /** Takes the mask off `slot`, a slot that goes or makes way for a new one. */
  unmaskSlot(slot: Slot, errors: unknown[]): void {
    const mask = slot.mask;
    if (!mask) return;
    slot.mask = undefined;
    this.#unuseMask(mask, errors);
  }

  /**
   * Takes the mask stage `layer` off every slot it masks, ends every transition whose effect names
   * it as cancelled, and takes it out of the director.
   */
  drop(layer: Layer, errors: unknown[]): void {
    // over a copy, as every loop here that may hand control to a listener
    for (const slot of this.#host.slots().slice()) {
      if (slot.mask?.stage === layer.stage) {
        slot.mask = undefined;
        layer.uses--;
      }
    }
    // the end of each run gives its use back, and the last one lets the stage go
    for (const slot of this.#host.slots().slice()) {
      if (slot.run?.masks.some((mask) => mask.stage === layer.stage)) this.#host.endRun(slot, 'from', 'cancelled', errors);
    }
    try {
      this.#host.release(layer);
    } catch (error) {
      errors.push(error);
    }
    this.#host.slotsChanged();
  }

  /**
   * Watches the dispose of every mask a slot or a running transition holds, and of no other: a
   * mask the director let go of keeps no reference to it. Runs with every change of the slots, never
   * in a frame that changes none.
   */
  watch(): void {
    const watches = this.#watches;
    const held = (mask: StageMask): boolean => {
      for (const slot of this.#host.slots()) {
        if (slot.mask === mask || slot.run?.masks.includes(mask)) return true;
      }
      return false;
    };
    for (const [mask, unwatch] of watches) {
      if (!held(mask)) {
        watches.delete(mask);
        unwatch();
      }
    }
    // a mask disposed before the change that put it in place — by a listener between the checks of a
    // call and its change — hears no dispose any more: it leaves as soon as the change stands
    let disposed: StageMask | undefined;
    const watch = (mask: StageMask): void => {
      if (watches.has(mask)) return;
      if (mask.isDisposed) disposed ??= mask;
      else watches.set(mask, StageMaskInternals.onDispose(mask, this.#maskDisposed));
    };
    for (const slot of this.#host.slots()) {
      if (slot.mask) watch(slot.mask);
      slot.run?.masks.forEach(watch);
    }
    // one at a time: the leave changes the slots and comes back here for the next one. An error of a
    // listener of that leave reaches the caller of the call that made the change
    if (disposed) this.#maskDisposed(disposed);
  }

  /** Hands the progress of each running transition on to the masks its effect names, for their stages. */
  followProgress(): void {
    // the masks of the running effects carry the progress their transitions reached in this frame
    // to their stages, before those update; the slots as they stand now, after the ends of this frame
    const current = this.#host.slots();
    for (let i = 0; i < current.length; i++) {
      const run = current[i]!.run;
      if (!run) continue;
      const masks = run.masks;
      for (let j = 0; j < masks.length; j++) StageMaskInternals.followProgress(masks[j]!, run.transition);
    }
  }

  /** Hands the progress of each running transition on to the nodes of the masks its effect names. */
  followProgressNodes(): void {
    // again for the masks of the running effects: a manual progress set after updateFrame() reaches
    // the GPU in this draw, while their `progress` keeps the value of the frame
    const slots = this.#host.slots();
    for (let i = 0; i < slots.length; i++) {
      const run = slots[i]!.run;
      if (!run) continue;
      const masks = run.masks;
      for (let j = 0; j < masks.length; j++) StageMaskInternals.followProgressNode(masks[j]!, run.transition);
    }
  }

  /** One use of the stage of `mask` less; with the last one the stage leaves the director. */
  #unuseMask(mask: StageMask, errors: unknown[]): void {
    const layer = this.#host.layerOf(mask.stage);
    if (layer?.role !== 'mask') return;
    layer.uses--;
    if (layer.uses > 0) return;
    try {
      this.#host.release(layer);
    } catch (error) {
      errors.push(error);
    }
  }

  /**
   * A disposed mask leaves every slot it lies on, and every transition whose effect names it ends
   * as cancelled, as for a disposed mask stage; its stage leaves the director when nothing else
   * uses it. Another mask on the same stage stays where it is.
   */
  #maskDisposed = (mask: StageMask): void => {
    const errors: unknown[] = [];
    // over a copy: a listener of OnStageRemoved, when the mask stage leaves, may change the slots
    for (const slot of this.#host.slots().slice()) {
      if (slot.mask === mask) this.unmaskSlot(slot, errors);
    }
    for (const slot of this.#host.slots().slice()) {
      if (slot.run?.masks.includes(mask)) this.#host.endRun(slot, 'from', 'cancelled', errors);
    }
    this.#host.slotsChanged();
    throwCollected(
      errors,
      'StageDirector: more than one listener of OnStageTransitionEnd, OnStageRemoved and OnRemoveFromParent threw while a disposed mask left',
    );
  };
}
