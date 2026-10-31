import {emitStrict, isEventized, on} from '@spearwolf/eventize';
import {float, texture, uniform, uv} from 'three/tsl';
import {
  Color,
  ColorManagement,
  type Node,
  NoToneMapping,
  RenderTarget,
  type RenderPipeline,
  type Texture,
  type TextureNode,
  type UniformNode,
  Vector2,
  Vector4,
  type WebGPURenderer,
} from 'three/webgpu';
import {isWebGLRenderer} from '../display/isWebGLRenderer.js';
import {OnStageDispose, OnStageTransitionEnd, OnStageTransitionStart, type StageTransitionProps} from '../events.js';
import {assertFinite} from '../utils/assertFinite.js';
import {describeValue} from '../utils/describeValue.js';
import {throwCollected} from '../utils/throwCollected.js';
import {ClearStage} from './ClearStage.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import {RootRenderPipeline} from './RootRenderPipeline.js';
import {maskCoverage, maskSource} from './maskNodes.js';
import {StageMask, type StageMaskCoverageSource, StageMaskInternals} from './StageMask.js';
import {type StageItem, StageRenderer, type StageRendererBuildOutputNode, type StageRendererParentType} from './StageRenderer.js';
import {
  easingOf,
  type StageTransition,
  type StageTransitionEasing,
  type StageTransitionEasingSpec,
  type StageTransitionHost,
  StageTransitionInternals,
} from './StageTransition.js';
import {crossfade, type StageTransitionEffect, textureSource} from './transitionEffects.js';

/** A stage a `StageDirector` takes as a layer: a `Stage2D`, a `StageRenderer`, or a stage of your own. */
export type StageDirectorLayer = IStage & IRenderable;

/** What a layer does while it is not in front: run on, or keep its last picture. */
export type StageLayerMode = 'run' | 'freeze';

/** The options of every method of a `StageDirector` that changes its stack. */
export interface StageTransitionOptions {
  /** The effect of the transition. Default `crossfade()`. */
  effect?: StageTransitionEffect;
  /** In seconds. Default 0.5 with an `effect`, 0 without one — an instant change. */
  duration?: number;
  /** Default `'ease-in-out'`. */
  easing?: StageTransitionEasing;
  /** Seconds before the transition starts. Default 0. */
  delay?: number;
  /** The caller drives `progress`; `duration` and `easing` are ignored. Default `false`. */
  manual?: boolean;
  /** What the layer the transition leaves does while it goes. Default `'run'`. */
  outgoing?: StageLayerMode;
  /** What the layer the transition brings does while it comes; it runs from the end on. Default `'run'`. */
  incoming?: StageLayerMode;
}

/** The options of `StageDirector#show()`. */
export interface StageShowOptions extends StageTransitionOptions {
  /** The position in the stack, 0 the bottom. Default the top. */
  at?: number;
  /** The mask of the new slot, from its first frame on. Default none. */
  mask?: StageMask;
}

/** The options of `StageDirector#push()`. */
export interface StagePushOptions extends StageShowOptions {
  /** What the layer below the new one does while the new one is on top. Default `'run'`. */
  below?: StageLayerMode;
}

/**
 * A slot of a shape for `StageDirector#precompile()`: a layer, a transition through this effect —
 * the same effect object the transition will take —, or a masked slot, `{mask}` for a layer and
 * `{effect, mask}` for a transition inside the mask. A mask counts by its stage, its `source` and
 * its `invert`: another `StageMask` with the same options on a stage in the same place is the same
 * shape.
 */
export type StageDirectorShapeSlot = 'layer' | StageTransitionEffect | {effect?: StageTransitionEffect; mask: StageMask};

/** A shape of the stack for `StageDirector#precompile()`: its slots, from the bottom up. */
export type StageDirectorShape = readonly StageDirectorShapeSlot[];

/** The options of `StageDirector#precompile()`. */
export interface StagePrecompileOptions {
  /**
   * Stages to draw once, off screen, into a target of the kind the director draws its layers into:
   * their materials and pipelines build there, not on their first frame in the stack. Default none.
   */
  layers?: readonly StageDirectorLayer[];
  /**
   * Compile the shapes for a place of the director inside another renderer — into a target of
   * the kind a composing parent draws its layers into, on linear output. Default: whether a
   * `StageRenderer` that composes holds the director, a `StageDirector` above all.
   */
  nested?: boolean;
}

interface Layer {
  /** The stage the caller handed in. */
  readonly stage: StageDirectorLayer;
  /** A layer of the stack, or the stage of a mask; a stage is never both. */
  readonly role: 'layer' | 'mask';
  /**
   * How many slot masks and running transitions use a mask stage — a transition once per stage its
   * effect names, however many of its masks lie on it; 0 for a layer.
   */
  uses: number;
  /** The stage itself, or the renderer the director wrapped it in. */
  readonly renderer: StageRenderer;
  readonly wrapped: boolean;
  frozen: boolean;
  /** A frozen layer that has no picture in its pass target yet: drawn once, without an update. */
  needsPicture: boolean;
  unsubscribe?: () => void;
}

interface Run {
  readonly transition: StageTransition;
  readonly from: Layer | undefined;
  readonly to: Layer | undefined;
  readonly fromWasFrozen: boolean;
  /** The masks the effect names, as they stood when the transition began; each one is driven by it. */
  readonly masks: readonly StageMask[];
}

interface Slot {
  /** What the slot shows while no transition runs in it. */
  layer?: Layer;
  run?: Run;
  /** The layer a push() froze below this one, which runs again when this slot goes. */
  frozeBelow?: Layer;
  /** The mask of the slot: it stays through replace() and goes with the slot. */
  mask?: StageMask;
}

interface ShapeSlot {
  readonly layer?: TextureNode;
  readonly from?: TextureNode;
  readonly to?: TextureNode;
  readonly progress?: UniformNode<'float', number>;
  readonly effect?: StageTransitionEffect;
  readonly effectNode?: Node<'vec4'>;
}

interface Shape {
  readonly pipeline: RootRenderPipeline;
  readonly slots: readonly ShapeSlot[];
  /** One texture node per distinct mask stage of the shape, counted by first appearance from the bottom. */
  readonly maskNodes: readonly TextureNode[];
  readonly outputNode: Node;
  /** Every texture node of the shape, and the placeholder each one samples while it has no pass. */
  readonly textureNodes: readonly TextureNode[];
  readonly placeholders: readonly Texture[];
}

/**
 * Which slot and which of its sources an entry of `orderedStages` is — or, after every layer, which
 * of the distinct mask stages, counted by first appearance: the stages of the slot masks bottom-up,
 * then those of the running effects slot by slot, as `distinctMasks()` counts them.
 */
type OrderRef =
  | {readonly side: 'layer' | 'from' | 'to'; readonly slot: number}
  | {readonly side: 'mask'; readonly maskStage: number};

/**
 * Every stage a director draws as a mask, and that director: a stage is the mask stage of one
 * director at a time, since that director draws and updates it.
 */
const maskOwners = new WeakMap<IStage, StageDirector>();

/** Every stage a director holds as a layer, and the directors that hold it so. */
const layerOwners = new WeakMap<IStage, Set<StageDirector>>();

const NO_STAGES: ReadonlyArray<StageItem> = Object.freeze([]);

const NO_MASKS: readonly StageMask[] = Object.freeze([]);

/** The masks `effect` names, checked; a snapshot, so a list changed later changes no running transition. */
function masksOf(subject: string, effect: StageTransitionEffect): readonly StageMask[] {
  const masks: unknown = effect.masks;
  if (masks === undefined) return NO_MASKS;
  if (!Array.isArray(masks) || !masks.every((mask) => mask instanceof StageMask)) {
    throw new TypeError(
      `${subject}: the masks of the effect "${effect.name}" must be an array of StageMask, got ${describeValue(masks)}`,
    );
  }
  return masks.length === 0 ? NO_MASKS : Object.freeze([...(masks as StageMask[])]);
}

/** Whether `masks[index]` is the first mask of the list on its stage: a stage counts once per transition. */
function firstOnItsStage(masks: readonly StageMask[], index: number): boolean {
  const stage = masks[index]!.stage;
  for (let i = 0; i < index; i++) if (masks[i]!.stage === stage) return false;
  return true;
}

const effectIds = new WeakMap<StageTransitionEffect, number>();
let nextEffectId = 1;

function effectId(effect: StageTransitionEffect): number {
  let id = effectIds.get(effect);
  if (id === undefined) {
    id = nextEffectId++;
    effectIds.set(effect, id);
  }
  return id;
}

/**
 * What a slot of a shape holds: a layer (no effect) or a transition through an effect, masked or
 * not, and the masks the effect names. Of a mask only its stage, `source` and `invert` count.
 */
interface ShapeKind {
  readonly effect: StageTransitionEffect | undefined;
  readonly mask: StageMask | undefined;
  readonly effectMasks: readonly StageMask[];
}

const LAYER_KIND: ShapeKind = Object.freeze({effect: undefined, mask: undefined, effectMasks: NO_MASKS});

/** A distinct mask of a shape: the index of its stage among the distinct mask stages, and its options. */
interface ShapeMask {
  readonly stage: number;
  readonly source: StageMaskCoverageSource;
  readonly invert: boolean;
}

/**
 * Walks the masks of `kinds` and calls `visit` per masked slot, bottom-up, then `visitEffect` per
 * mask an effect names, slot by slot and each effect's masks in the order of its list, with its
 * position in that list. Both get the index of the distinct mask — a stage with a source and an
 * invert — and that mask, whose `stage` is the index of its stage among the distinct mask stages;
 * both count by first appearance in this walk, as the mask stages stand in `orderedStages`.
 * Answers the distinct masks.
 */
function distinctMasks(
  kinds: readonly ShapeKind[],
  visit: (slot: number, index: number, mask: ShapeMask) => void,
  visitEffect: (slot: number, position: number, index: number, mask: ShapeMask) => void,
): ShapeMask[] {
  const stages: IStage[] = [];
  const masks: ShapeMask[] = [];
  const indexOf = (mask: StageMask): number => {
    let stage = stages.indexOf(mask.stage);
    if (stage === -1) stage = stages.push(mask.stage) - 1;
    const index = masks.findIndex((m) => m.stage === stage && m.source === mask.source && m.invert === mask.invert);
    return index === -1 ? masks.push({stage, source: mask.source, invert: mask.invert}) - 1 : index;
  };
  kinds.forEach(({mask}, slot) => {
    if (!mask) return;
    const index = indexOf(mask);
    visit(slot, index, masks[index]!);
  });
  kinds.forEach(({effectMasks}, slot) => {
    effectMasks.forEach((mask, position) => {
      const index = indexOf(mask);
      visitEffect(slot, position, index, masks[index]!);
    });
  });
  return masks;
}

/**
 * The key of a shape: per slot `l` or `t<effect id>`, with `m<mask index>` for a masked one and
 * `e<mask index>.<mask index>…` for the masks its effect names, and after a `|` per distinct mask
 * `<source><invert>@<stage index>`. The stage index tells one texture node for two masks from two:
 * a red and a green mask on one stage and on two stages differ in it alone. The indices of the
 * effect's masks tell which texture node the graph of the effect samples: two slot masks that swap
 * their stages leave the list of distinct masks as it was, but not the place of the effect's mask
 * in it.
 */
function shapeKey(kinds: readonly ShapeKind[]): string {
  const slots = kinds.map(({effect}) => (effect ? `t${effectId(effect)}` : 'l'));
  const masks = distinctMasks(
    kinds,
    (slot, index) => {
      slots[slot] += `m${index}`;
    },
    (slot, position, index) => {
      slots[slot] += `${position === 0 ? 'e' : '.'}${index}`;
    },
  );
  if (masks.length === 0) return slots.join(',');
  return `${slots.join(',')}|${masks.map((m) => `${m.source}${m.invert ? 1 : 0}@${m.stage}`).join(',')}`;
}

const isEffect = (value: unknown): value is StageTransitionEffect =>
  typeof (value as Partial<StageTransitionEffect> | undefined)?.build === 'function';

function parseShapes(subject: string, shapes: unknown): ShapeKind[][] {
  if (!Array.isArray(shapes)) {
    throw new TypeError(`${subject}: shapes must be an array of shapes, got ${describeValue(shapes)}`);
  }
  return shapes.map((shape: unknown, i) => {
    if (!Array.isArray(shape) || shape.length === 0) {
      throw new TypeError(
        `${subject}: shapes[${i}] must be a non-empty array of 'layer', StageTransitionEffect and {effect?, mask}, got ${describeValue(shape)}`,
      );
    }
    return shape.map((slot: unknown, j): ShapeKind => {
      if (slot === 'layer') return LAYER_KIND;
      if (isEffect(slot)) return {effect: slot, mask: undefined, effectMasks: masksOf(subject, slot)};
      if (slot !== null && typeof slot === 'object' && !Array.isArray(slot) && 'mask' in slot) {
        const {effect, mask} = slot as {effect?: unknown; mask?: unknown};
        if (!(mask instanceof StageMask)) {
          throw new TypeError(`${subject}: shapes[${i}][${j}].mask must be a StageMask, got ${describeValue(mask)}`);
        }
        if (effect !== undefined && !isEffect(effect)) {
          throw new TypeError(
            `${subject}: shapes[${i}][${j}].effect must be a StageTransitionEffect, got ${describeValue(effect)}`,
          );
        }
        return {effect, mask, effectMasks: effect ? masksOf(subject, effect) : NO_MASKS};
      }
      throw new TypeError(
        `${subject}: shapes[${i}][${j}] must be 'layer', a StageTransitionEffect or {effect?, mask}, got ${describeValue(slot)}`,
      );
    });
  });
}

function parsePrecompileOptions(
  subject: string,
  director: StageDirector,
  options: unknown,
): {layers: readonly StageDirectorLayer[]; nested: boolean | undefined} {
  if (options === undefined) return {layers: [], nested: undefined};
  if (options === null || typeof options !== 'object') {
    throw new TypeError(`${subject}: the options must be an object, got ${describeValue(options)}`);
  }
  const {layers = [], nested} = options as StagePrecompileOptions;
  if (!Array.isArray(layers)) {
    throw new TypeError(`${subject}: layers must be an array of stages, got ${describeValue(layers)}`);
  }
  layers.forEach((stage: unknown, i) => {
    if (typeof (stage as Partial<IRenderable>)?.renderTo !== 'function') {
      throw new TypeError(`${subject}: layers[${i}] must be a stage with renderTo(), got ${describeValue(stage)}`);
    }
    if (stage === director) throw new Error(`${subject}: layers[${i}] is this director`);
    if ((stage as {isDisposed?: unknown}).isDisposed === true) {
      throw new Error(`${subject}: layers[${i}] "${(stage as IStage).name}" has been disposed`);
    }
  });
  if (nested !== undefined && typeof nested !== 'boolean') {
    throw new TypeError(`${subject}: nested must be a boolean, got ${describeValue(nested)}`);
  }
  return {layers, nested};
}

/** `top` over `bottom`, both premultiplied. */
function over(top: Node<'vec4'>, bottom: Node<'vec4'>): Node<'vec4'> {
  return top.add(bottom.mul(float(1).sub(top.a)));
}

function modeOption(subject: string, name: string, value: unknown): StageLayerMode {
  if (value === undefined) return 'run';
  if (value !== 'run' && value !== 'freeze') {
    throw new TypeError(`${subject}: ${name} must be 'run' or 'freeze', got ${describeValue(value)}`);
  }
  return value;
}

function nonNegative(subject: string, name: string, value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  const number = assertFinite(value, subject, name);
  if (number < 0) throw new RangeError(`${subject}: ${name} must be a finite number of 0 or above, got ${describeValue(value)}`);
  return number;
}

interface ParsedOptions {
  effect: StageTransitionEffect;
  duration: number;
  delay: number;
  easing: StageTransitionEasingSpec;
  manual: boolean;
  outgoing: StageLayerMode;
  incoming: StageLayerMode;
  /** No transition: the change lands at once. */
  instant: boolean;
}

function parseOptions(subject: string, options: StageTransitionOptions | undefined): ParsedOptions {
  if (options !== undefined && (options === null || typeof options !== 'object')) {
    throw new TypeError(`${subject}: the options must be an object, got ${describeValue(options)}`);
  }
  const effect = options?.effect;
  if (effect !== undefined && typeof (effect as Partial<StageTransitionEffect>)?.build !== 'function') {
    throw new TypeError(`${subject}: effect must be a StageTransitionEffect, got ${describeValue(effect)}`);
  }
  const manual = options?.manual === true;
  const duration = nonNegative(subject, 'duration', options?.duration, effect !== undefined ? 0.5 : 0);
  return {
    effect: effect ?? crossfade(),
    duration,
    delay: nonNegative(subject, 'delay', options?.delay, 0),
    easing: easingOf(subject, options?.easing ?? 'ease-in-out'),
    manual,
    outgoing: modeOption(subject, 'outgoing', options?.outgoing),
    incoming: modeOption(subject, 'incoming', options?.incoming),
    instant: !manual && duration === 0,
  };
}

// ---------------------------------------------------------------------------

/**
 * A `StageRenderer` that holds a stack of layers and changes it through transitions. See "Stage
 * transitions" in `docs/stages.md`.
 *
 * A layer is a stage — a `Stage2D`, a `StageRenderer` with stages and a pipeline of its own, a stage of
 * your own —; the director draws every layer into a target of its own and composes the stack, bottom
 * to top, with premultiplied alpha, over its clear color. A slot of the stack shows a layer, or a
 * transition between two sources: a layer and a layer, a layer and nothing, nothing and a layer.
 *
 * The director composes, always: it builds one `RootRenderPipeline` per shape of its stack and owns
 * them, and `pipeline`, `buildOutputNode` and `renderOrder` are its own — a write to any of them
 * throws. `add()` shows a stage on top, without a transition; `remove()` takes it out of the stack, at
 * once.
 */
export class StageDirector extends StageRenderer {
  #slots: Slot[] = [];
  readonly #layers = new Map<IStage, Layer>();
  readonly #byRenderer = new Map<IStage, Layer>();
  /**
   * Every `StageMask` a slot or a running transition holds, and the function that ends the watch
   * on its dispose; kept in step with the slots by `#slotsChanged()`.
   */
  readonly #maskWatches = new Map<StageMask, () => void>();

  /** > 0 while the director calls `add()` or `remove()` of its base itself. */
  #internalCall = 0;

  #ordered: ReadonlyArray<StageItem> = NO_STAGES;
  #orderRefs: readonly OrderRef[] = [];
  #orderDirty = true;

  #stack?: ReadonlyArray<StageDirectorLayer>;
  #transitions?: ReadonlyArray<StageTransition>;

  // the slots of this frame, filled from #slots before the transitions advance: ending one changes
  // #slots, and the frame goes on with the slots as they stood. Written by index and never cut
  // short: an array set to length 0 gives up its backing store, and the next frame would allocate
  // it again
  readonly #advancing: (Slot | undefined)[] = [];

  readonly #shapes = new Map<string, Shape>();
  #shapeKey?: string;
  #shape?: Shape;

  // 1×1 transparent black targets, one per texture node of the largest shape: three.js shares one
  // uniform among the texture nodes of a graph that sample the same texture, so no two texture
  // nodes of a shape ever stand on the same placeholder while it builds
  readonly #placeholders: RenderTarget[] = [];
  readonly #clearUniform = uniform(new Vector4(0, 0, 0, 0));
  readonly #resolution = uniform(new Vector2(1, 1));
  readonly #clearColorOfRenderer = new Color();

  readonly #host: StageTransitionHost = {
    end: (transition, keep, state) => {
      const errors: unknown[] = [];
      const slot = this.#slotOf(transition);
      if (slot) this.#endRun(slot, keep, state, errors);
      throwCollected(errors, 'StageTransition: more than one listener of OnStageTransitionEnd threw');
    },
  };

  readonly #compose: StageRendererBuildOutputNode = (passes) => this.#fillShape(passes);

  /**
   * @param parent Optional host (e.g. a `Display`) or parent `StageRenderer`, as for every
   * `StageRenderer`.
   */
  constructor(parent?: StageRendererParentType) {
    // the parent comes once the fields of the director stand: joining a host resizes the director
    super();
    this.name = 'StageDirector';
    if (parent) this.parent = parent;
  }

  // ---------------------------------------------------------------------------
  // what the director owns
  // ---------------------------------------------------------------------------

  /** The pipeline of the shape of the stack drawn last. The director's own: a write throws. */
  override get pipeline(): RenderPipeline | undefined {
    return super.pipeline;
  }

  override set pipeline(_pipeline: RenderPipeline | undefined) {
    if (this.isDisposed) return;
    throw new Error("StageDirector#pipeline is the director's own: it builds one pipeline per shape of its stack");
  }

  /** The director's composition of its stack. A write throws. */
  override get buildOutputNode(): StageRendererBuildOutputNode | undefined {
    return this.isDisposed ? undefined : this.#compose;
  }

  override set buildOutputNode(_buildOutputNode: StageRendererBuildOutputNode | undefined) {
    if (this.isDisposed) return;
    throw new Error("StageDirector#buildOutputNode is the director's own: it composes the slots of its stack");
  }

  /** Always `''`: the stack is the order of a director. A write throws. */
  override get renderOrder(): string {
    return '';
  }

  override set renderOrder(_order: string | undefined) {
    throw new Error("StageDirector#renderOrder is the director's own: the stack is its order");
  }

  /**
   * The layers in the order they update and draw: slot by slot, bottom to top, the source a
   * transition leaves before the one it brings. A snapshot, as for every `StageRenderer`.
   */
  override get orderedStages(): ReadonlyArray<StageItem> {
    if (this.isDisposed) return NO_STAGES;
    if (this.#orderDirty) this.#rebuildOrder();
    return this.#ordered;
  }

  // ---------------------------------------------------------------------------
  // the stack
  // ---------------------------------------------------------------------------

  /**
   * The stack as it stands once every running transition has ended, bottom to top: the stages the
   * caller handed in. A snapshot.
   */
  get stack(): ReadonlyArray<StageDirectorLayer> {
    if (this.#stack === undefined) {
      const stack: StageDirectorLayer[] = [];
      for (const slot of this.#slots) {
        const layer = this.#endLayerOf(slot);
        if (layer) stack.push(layer.stage);
      }
      this.#stack = Object.freeze(stack);
    }
    return this.#stack;
  }

  /** The transitions that have not ended yet, slot by slot. A snapshot. */
  get transitions(): ReadonlyArray<StageTransition> {
    if (this.#transitions === undefined) {
      const transitions: StageTransition[] = [];
      for (const slot of this.#slots) if (slot.run) transitions.push(slot.run.transition);
      this.#transitions = Object.freeze(transitions);
    }
    return this.#transitions;
  }

  /** Whether `stage` is in the {@link stack}. */
  has(stage: IStage): boolean {
    return this.#slotWithEnd(stage) !== undefined;
  }

  /** Whether the layer of `stage` is frozen; `false` for a stage that is no layer. */
  isFrozen(stage: IStage): boolean {
    return this.#layers.get(stage)?.frozen === true;
  }

  /**
   * Puts `stage` into the stack, at `opts.at` or on top. With an `effect`, a `duration` or `manual`
   * it comes from nothing through a transition; without, it is there at once.
   */
  show(stage: StageDirectorLayer, opts?: StageShowOptions): StageTransition {
    const subject = 'StageDirector#show()';
    if (this.isDisposed) return this.#cancelledHandle(undefined, stage);
    const options = parseOptions(subject, opts);
    if (this.#slotWithEnd(stage))
      throw new Error(`${subject} cannot take the stage "${stage.name}": that stage is in the stack already`);
    this.#refuseMaskStageAsLayer(subject, stage);
    const mask = this.#checkMask(subject, opts?.mask, stage);
    const effectMasks = this.#checkEffectMasks(subject, options, stage, (t) => t.from === stage || t.to === stage);
    this.#slotIndexAt(subject, opts?.at);
    return this.#show(subject, stage, opts, options, mask, effectMasks, false);
  }

  /**
   * The part of {@link show} after its refusals, which `push()` shares. `usesHeld` says that the
   * caller has taken the uses of `effectMasks` already; a stage that refuses to join gives them back.
   */
  #show(
    subject: string,
    stage: StageDirectorLayer,
    opts: StageShowOptions | undefined,
    options: ParsedOptions,
    mask: StageMask | undefined,
    effectMasks: readonly StageMask[],
    usesHeld: boolean,
  ): StageTransition {
    const at = this.#slotIndexAt(subject, opts?.at);

    // the mask stages join first: a mask stage that refuses to join leaves every run as it was
    const errors: unknown[] = [];
    const slot: Slot = {};
    if (mask) {
      try {
        this.#maskSlot(subject, slot, mask, errors);
      } catch (error) {
        // the uses a caller took are given back
        const collected = [error, ...errors];
        if (usesHeld) this.#unuseMasks(effectMasks, collected);
        if (collected.length === 1) throw error;
        throw new AggregateError(
          collected,
          `${subject}: more than one error on the way back from a mask stage that refused to join`,
        );
      }
    }
    let usesMasks = usesHeld;
    let layer: Layer;
    try {
      if (!usesHeld) {
        this.#useMasks(subject, effectMasks);
        usesMasks = true;
      }
      this.#finishRunsWith(stage, errors);
      layer = this.#join(subject, stage);
    } catch (error) {
      // the original error stays the first of what is thrown: the listeners that threw on the way back are not lost
      const collected = [error, ...errors];
      this.#unmaskSlot(slot, collected);
      if (usesMasks) this.#unuseMasks(effectMasks, collected);
      if (collected.length === 1) throw error;
      throw new AggregateError(collected, `${subject}: more than one error on the way back from a stage that refused to join`);
    }
    this.#slots.splice(Math.min(at, this.#slots.length), 0, slot);
    const transition = this.#begin(slot, undefined, layer, options, effectMasks, errors);
    throwCollected(errors, `${subject}: more than one listener of OnStageTransitionStart and OnStageTransitionEnd threw`);
    return transition;
  }

  /** Takes `stage` out of the stack — through a transition into nothing, or at once. */
  hide(stage: IStage, opts?: StageTransitionOptions): StageTransition {
    const subject = 'StageDirector#hide()';
    if (this.isDisposed) return this.#cancelledHandle(stage, undefined);
    const options = parseOptions(subject, opts);
    const slot = this.#slotWithEnd(stage);
    if (!slot) throw new Error(`${subject} cannot hide the stage "${stage.name}": that stage is not in the stack`);
    const running = slot.run?.transition;
    const effectMasks = this.#checkEffectMasks(subject, options, undefined, (t) => t === running);

    const errors: unknown[] = [];
    this.#useMasks(subject, effectMasks);
    if (slot.run) this.#endRun(slot, 'to', 'finished', errors);
    const transition = this.#begin(slot, slot.layer, undefined, options, effectMasks, errors);
    throwCollected(errors, `${subject}: more than one listener of OnStageTransitionStart and OnStageTransitionEnd threw`);
    return transition;
  }

  /** Puts `to` into the slot of `from`: `from` turns into `to` through a transition, or at once. */
  replace(from: IStage, to: StageDirectorLayer, opts?: StageTransitionOptions): StageTransition {
    const subject = 'StageDirector#replace()';
    if (this.isDisposed) return this.#cancelledHandle(from, to);
    const options = parseOptions(subject, opts);
    const slot = this.#slotWithEnd(from);
    if (!slot) throw new Error(`${subject} cannot replace the stage "${from.name}": that stage is not in the stack`);
    if (from === to || this.#slotWithEnd(to)) {
      throw new Error(`${subject} cannot take the stage "${to.name}": that stage is in the stack already`);
    }
    this.#refuseMaskStageAsLayer(subject, to);
    // a mask is busy only after the runs this call ends anyway: the run of the slot and those with `to`
    const running = slot.run?.transition;
    const effectMasks = this.#checkEffectMasks(subject, options, to, (t) => t === running || t.from === to || t.to === to);

    // the mask stages join first, so a mask the ending run used stays and is not joined again
    const errors: unknown[] = [];
    this.#useMasks(subject, effectMasks);
    let toLayer: Layer;
    try {
      if (slot.run) this.#endRun(slot, 'to', 'finished', errors);
      this.#finishRunsWith(to, errors);
      toLayer = this.#join(subject, to);
    } catch (error) {
      const collected = [error, ...errors];
      this.#unuseMasks(effectMasks, collected);
      if (collected.length === 1) throw error;
      throw new AggregateError(collected, `${subject}: more than one error on the way back from a stage that refused to join`);
    }
    const transition = this.#begin(slot, slot.layer, toLayer, options, effectMasks, errors);
    throwCollected(errors, `${subject}: more than one listener of OnStageTransitionStart and OnStageTransitionEnd threw`);
    return transition;
  }

  /**
   * Shows `stage` on top, as {@link show} does; `opts.below` decides what the layer below it does
   * while it is on top — with `'freeze'` it keeps its last picture until the new layer goes.
   */
  push(stage: StageDirectorLayer, opts?: StagePushOptions): StageTransition {
    const subject = 'StageDirector#push()';
    if (this.isDisposed) return this.#cancelledHandle(undefined, stage);
    const below = modeOption(subject, 'below', opts?.below);
    const options = parseOptions(subject, opts);
    if (this.#slotWithEnd(stage))
      throw new Error(`${subject} cannot take the stage "${stage.name}": that stage is in the stack already`);
    this.#refuseMaskStageAsLayer(subject, stage);
    const mask = this.#checkMask(subject, opts?.mask, stage);
    this.#slotIndexAt(subject, opts?.at);
    const ended = this.#runsPushEnds(stage, opts?.at, below);
    const effectMasks = this.#checkEffectMasks(subject, options, stage, (t) => ended.has(t));

    // the mask stages join first, so a mask a run that ends here used stays and is not joined again;
    // the runs end before the slot below is known: a run with the stage — the stage pushed back while
    // a pop() still takes it out — and a run below that ends with nothing each take their slot out,
    // and the slot below is the one that stays
    const errors: unknown[] = [];
    this.#useMasks(subject, effectMasks);
    this.#finishRunsWith(stage, errors);
    let belowSlot = this.#slots[this.#slotIndexAt(subject, opts?.at) - 1];
    while (below === 'freeze' && belowSlot?.run) {
      this.#endRun(belowSlot, 'to', 'finished', errors);
      belowSlot = this.#slots[this.#slotIndexAt(subject, opts?.at) - 1];
    }
    if (errors.length > 0) this.#unuseMasks(effectMasks, errors);
    throwCollected(errors, `${subject}: more than one listener of OnStageTransitionEnd threw`);
    const belowLayer = belowSlot?.layer;
    const transition = this.#show(subject, stage, opts, options, mask, effectMasks, true);
    if (below === 'freeze' && belowLayer && !belowLayer.frozen) {
      const slot = this.#slotOfLayer(this.#layers.get(stage));
      belowLayer.frozen = true;
      if (slot) slot.frozeBelow = belowLayer;
    }
    return transition;
  }

  /**
   * The transitions `push(stage, {at, below})` ends before it shows the stage, worked out without
   * ending any: those with `stage` as a source, and with `'freeze'` the run of the slot below the
   * new one — and further down for as long as such a run ends with nothing and takes its slot out.
   * The stack stays as it is while they end: a run ends in its end state, and a slot that goes held
   * no stage of the stack.
   */
  #runsPushEnds(stage: IStage, at: unknown, below: StageLayerMode): Set<StageTransition> {
    const ended = new Set<StageTransition>();
    const slots: Slot[] = [];
    for (const slot of this.#slots) {
      const run = slot.run;
      if (run && (run.from?.stage === stage || run.to?.stage === stage)) {
        ended.add(run.transition);
        if (!run.to) continue;
      }
      slots.push(slot);
    }
    if (below !== 'freeze') return ended;
    const target = at === undefined || at === this.stack.length ? undefined : this.#slotWithEnd(this.stack[at as number]!);
    const indexBelow = () => (target ? slots.indexOf(target) : slots.length) - 1;
    for (let i = indexBelow(); i >= 0; i = indexBelow()) {
      const run = slots[i]!.run;
      if (!run || ended.has(run.transition)) break;
      ended.add(run.transition);
      if (run.to) break;
      slots.splice(i, 1);
    }
    return ended;
  }

  /** Takes the top layer out of the stack, as {@link hide} does; the layer below it runs again. */
  pop(opts?: StageTransitionOptions): StageTransition {
    const subject = 'StageDirector#pop()';
    if (this.isDisposed) return this.#cancelledHandle(undefined, undefined);
    const stack = this.stack;
    const top = stack[stack.length - 1];
    if (top === undefined) throw new Error(`${subject} has nothing to pop: the stack is empty`);
    const slot = this.#slotWithEnd(top)!;
    if (slot.frozeBelow) {
      slot.frozeBelow.frozen = false;
      slot.frozeBelow = undefined;
    }
    return this.hide(top, opts);
  }

  /**
   * Makes `stages` the stack, bottom to top, at once: running transitions end as cancelled, layers
   * that are not in `stages` leave. A stage that is refused leaves the stack as it was.
   */
  setStack(stages: readonly StageDirectorLayer[]): this {
    const subject = 'StageDirector#setStack()';
    if (this.isDisposed) return this;
    if (!Array.isArray(stages)) throw new TypeError(`${subject}: the stages must be an array, got ${describeValue(stages)}`);
    const seen = new Set<IStage>();
    for (const stage of stages) {
      if (seen.has(stage)) throw new Error(`${subject} cannot take the stage "${stage.name}" twice`);
      this.#refuseMaskStageAsLayer(subject, stage);
      seen.add(stage);
    }

    // the layers first: a stage that refuses them leaves the stack as it was
    const joined: Layer[] = [];
    const layers: Layer[] = [];
    try {
      for (const stage of stages) {
        const known = this.#layers.get(stage);
        const layer = known ?? this.#join(subject, stage);
        if (!known) joined.push(layer);
        layers.push(layer);
      }
    } catch (error) {
      for (const layer of joined) this.#release(layer);
      throw error;
    }

    const errors: unknown[] = [];
    for (const slot of this.#slots.slice()) {
      if (slot.run) this.#endRun(slot, 'from', 'cancelled', errors);
    }
    for (const slot of this.#slots) if (slot.frozeBelow) slot.frozeBelow.frozen = false;
    // new slots, without masks: the masks of the stages that stay are not carried over
    const previous = this.#slots;
    this.#slots = layers.map((layer) => ({layer}));
    for (const slot of previous) this.#unmaskSlot(slot, errors);
    for (const layer of [...this.#layers.values()]) {
      if (layer.role === 'layer' && !layers.includes(layer)) this.#release(layer);
    }
    this.#slotsChanged();
    throwCollected(errors, `${subject}: more than one listener of OnStageTransitionEnd threw`);
    return this;
  }

  /**
   * Masks by `mask` the slot whose end state holds `stage`, at once: the slot shows only where the
   * stage of the mask draws. `undefined` takes the mask off. The mask belongs to the slot —
   * `replace()` keeps it, and it goes with the slot. One mask stage serves every slot it masks, and
   * is drawn once per frame, after every layer.
   */
  setMask(stage: IStage, mask: StageMask | undefined): this {
    const subject = 'StageDirector#setMask()';
    if (this.isDisposed) return this;
    const slot = this.#slotWithEnd(stage);
    if (!slot) throw new Error(`${subject} cannot mask the stage "${stage.name}": that stage is not in the stack`);
    this.#checkMask(subject, mask);
    const errors: unknown[] = [];
    this.#maskSlot(subject, slot, mask, errors);
    throwCollected(errors, `${subject}: more than one listener of OnStageRemoved threw`);
    return this;
  }

  /** The mask of the slot that holds `stage` once every running transition has ended. */
  maskOf(stage: IStage): StageMask | undefined {
    if (this.isDisposed) return undefined;
    return this.#slotWithEnd(stage)?.mask;
  }

  /** Freezes the layer or mask stage `stage`: it is neither updated nor drawn, and its last picture stays. */
  freeze(stage: IStage): this {
    return this.#setFrozen('StageDirector#freeze()', stage, true);
  }

  /** Lets the layer or mask stage `stage` run again. */
  run(stage: IStage): this {
    return this.#setFrozen('StageDirector#run()', stage, false);
  }

  #setFrozen(subject: string, stage: IStage, frozen: boolean): this {
    if (this.isDisposed) return this;
    const layer = this.#layers.get(stage);
    if (!layer) {
      throw new Error(`${subject} cannot find the stage "${stage.name}": that stage is no layer or mask of this director`);
    }
    layer.frozen = frozen;
    return this;
  }

  // ---------------------------------------------------------------------------
  // add() and remove() of the base
  // ---------------------------------------------------------------------------

  /**
   * Shows `stage` on top of the stack, at once — the move of `new StageRenderer(director)` and of
   * `child.parent = director` as well. A stage in the stack already stays where it is.
   */
  override add(stage: IStage & IRenderable): this {
    if (this.#internalCall > 0 || this.isDisposed) return super.add(stage);
    if (!this.#slotWithEnd(stage)) this.show(stage);
    return this;
  }

  /**
   * Takes `stage` out of the stack at once, wherever it is: a transition that has it as a source ends
   * as cancelled, with the other source in its slot. A mask stage comes off every slot it masks.
   */
  override remove(stage: IStage): this {
    if (this.#internalCall > 0) return super.remove(stage);
    const layer = this.#layers.get(stage) ?? this.#byRenderer.get(stage);
    if (!layer) return super.remove(stage);
    const errors: unknown[] = [];
    if (layer.role === 'mask') this.#dropMask(layer, errors);
    else this.#dropLayer(layer, errors);
    throwCollected(errors, 'StageDirector#remove(): more than one listener of OnStageTransitionEnd and OnStageRemoved threw');
    return this;
  }

  // ---------------------------------------------------------------------------
  // the frame
  // ---------------------------------------------------------------------------

  override resize(width: number, height: number, pixelRatio = 1): void {
    try {
      super.resize(width, height, pixelRatio);
    } finally {
      this.#resolution.value.set(
        Math.max(1, Math.floor(this.width * this.pixelRatio)),
        Math.max(1, Math.floor(this.height * this.pixelRatio)),
      );
    }
  }

  protected override resizeStage(stageItem: StageItem, width: number, height: number, pixelRatio: number): void {
    const resized = stageItem.width !== width || stageItem.height !== height || stageItem.pixelRatio !== pixelRatio;
    super.resizeStage(stageItem, width, height, pixelRatio);
    // a resized target has lost its picture: a frozen layer draws once at the new size
    if (resized) {
      const layer = this.#byRenderer.get(stageItem.stage);
      if (layer) layer.needsPicture = true;
    }
  }

  /**
   * Advances every transition by `deltaTime`, then updates every layer that is not frozen, slot by
   * slot. A transition that reaches its end shows `to` alone from this frame on; its
   * `OnStageTransitionEnd` goes out and its `finished` resolves.
   */
  override updateFrame(now: number, deltaTime: number, frameNo: number): void {
    const advancing = this.#advancing;
    const slots = this.#slots;
    let count = 0;
    for (let i = 0; i < slots.length; i++) {
      // the loop bound is the length of the array
      const slot = slots[i]!;
      if (slot.run) advancing[count++] = slot;
    }

    let errors: unknown[] | undefined;
    for (let i = 0; i < count; i++) {
      const slot = advancing[i];
      advancing[i] = undefined;
      const run = slot?.run;
      if (!slot || !run) continue;
      const step = StageTransitionInternals.advance(run.transition, deltaTime);
      if (step === 'started') {
        errors = this.#emitCollecting(OnStageTransitionStart, run.transition, errors);
      } else if (step === 'reached-end') {
        errors ??= [];
        this.#endRun(slot, 'to', 'finished', errors);
      } else if (step === 'reached-start') {
        errors ??= [];
        this.#endRun(slot, 'from', 'cancelled', errors);
      }
    }

    // the masks of the running effects carry the progress their transitions reached in this frame
    // to their stages, before those update; the slots as they stand now, after the ends of this frame
    const current = this.#slots;
    for (let i = 0; i < current.length; i++) {
      const run = current[i]!.run;
      if (!run) continue;
      const masks = run.masks;
      for (let j = 0; j < masks.length; j++) StageMaskInternals.followProgress(masks[j]!, run.transition);
    }

    const stages = this.orderedStages;
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i]!.stage;
      if (this.#byRenderer.get(stage)?.frozen !== true) stage.updateFrame(now, deltaTime, frameNo);
    }

    if (errors) {
      throwCollected(
        errors,
        'StageDirector#updateFrame(): more than one listener of OnStageTransitionStart and OnStageTransitionEnd threw',
      );
    }
  }

  /**
   * Picks the shape of the stack and fills its uniforms before the base draws: from `renderTo()` of
   * a director at the top, and from a parent that composes a director as one of its layers.
   */
  protected override renderToCurrentTarget(renderer: WebGPURenderer): void {
    const shape = this.#currentShape(renderer);
    if (super.pipeline !== shape.pipeline) super.pipeline = shape.pipeline;

    for (let i = 0; i < shape.slots.length; i++) {
      const progress = shape.slots[i]!.progress;
      const run = this.#slots[i]?.run;
      // written only when it changed: a double stored again is boxed again, 16 bytes per draw
      if (progress && run && progress.value !== run.transition.progress) progress.value = run.transition.progress;
    }
    // again for the masks of the running effects: a manual progress set after updateFrame() reaches
    // the GPU in this draw, while their `progress` keeps the value of the frame
    const slots = this.#slots;
    for (let i = 0; i < slots.length; i++) {
      const run = slots[i]!.run;
      if (!run) continue;
      const masks = run.masks;
      for (let j = 0; j < masks.length; j++) StageMaskInternals.followProgressNode(masks[j]!, run.transition);
    }
    this.#updateClearUniform(renderer);
    super.renderToCurrentTarget(renderer);
  }

  /**
   * Builds and compiles the shaders of `shapes` ahead of time, so that the first transition of each
   * shape starts without the hitch of a shader build. A shape lists the slots of the stack from the
   * bottom up: `'layer'` for a slot that shows a layer, the effect for a slot with a transition —
   * the same effect object the transition takes, since the director tells shapes apart by their
   * effect objects. `replace(title, level, {effect: dissolveIn})` on the stack `[stars, title]` is
   * the shape `['layer', dissolveIn]`. A masked slot is `{mask}`, or `{effect, mask}` for a
   * transition inside the mask; a mask counts by its stage, its `source` and its `invert`, so
   * another `StageMask` with the same options on a stage in the same place finds the shape compiled.
   * An effect with `masks` compiles with a texture node for each of their stages, and
   * `options.layers` may list those stages to build their materials as well.
   *
   * The shapes build the composition of the director. The stages of `options.layers` draw once, off
   * screen, as the director draws a layer — into a target of the type and the samples of its pass
   * targets, on linear output —, so that their own materials and pipelines, a bloom of a level, are
   * built before their first frame in the stack. A stage that is no layer of the director yet takes
   * the size of the director first.
   *
   * The shapes are compiled for the target the director draws into: its `outputRenderTarget`, or
   * else the renderer's current target — the canvas, called outside of a frame. A director inside
   * a renderer that composes — another director — draws into a pass target of its parent on linear
   * output, and compiles for that; `options.nested` says so for a director that has no parent yet.
   * A shape the director has already drawn or compiled is skipped; the shapes compile one after the
   * other, and the frames between them go on. A disposed director resolves at once.
   */
  async precompile(
    renderer: WebGPURenderer,
    shapes: readonly StageDirectorShape[],
    options?: StagePrecompileOptions,
  ): Promise<void> {
    const subject = 'StageDirector#precompile()';
    if (isWebGLRenderer(renderer)) {
      throw new TypeError(`${subject}: a WebGLRenderer is not supported — compile with a WebGPURenderer`);
    }
    const parsed = parseShapes(subject, shapes);
    const {layers, nested} = parsePrecompileOptions(subject, this, options);
    if (this.isDisposed) return;
    // the node build runs in the synchronous part of compileAsync(), inside the borrowed draw of the
    // pipeline; an init() on its way would move it out of there
    if (!renderer.initialized) await renderer.init();

    const asLayer = nested ?? this.#isNested();
    // a target of the kind the pass targets are — three.js keys its builds by format, type and
    // samples of the target, not by its size —, of the size of the director for the layers
    let passTarget: RenderTarget | undefined;
    const target = (): RenderTarget =>
      (passTarget ??= new RenderTarget(
        Math.max(1, Math.floor(this.width * this.pixelRatio)),
        Math.max(1, Math.floor(this.height * this.pixelRatio)),
        {type: renderer.getOutputBufferType(), samples: renderer.samples},
      ));
    try {
      for (const stage of layers) {
        if (this.isDisposed) return;
        this.#drawOffScreen(renderer, stage, target());
      }
      for (const kinds of parsed) {
        if (this.isDisposed) return;
        const key = shapeKey(kinds);
        if (this.#shapes.has(key)) continue;
        const shape = this.#buildShape(renderer, kinds);
        this.#shapes.set(key, shape);
        await this.#compileShape(renderer, shape, asLayer ? (this.outputRenderTarget ?? target()) : undefined);
      }
    } finally {
      passTarget?.dispose();
    }
  }

  protected override shouldRenderPass(child: StageRenderer): boolean {
    const layer = this.#byRenderer.get(child);
    if (!layer) return true;
    if (layer.frozen && !layer.needsPicture) return false;
    // drawn now: the target holds a picture of the layer's current size
    layer.needsPicture = false;
    return true;
  }

  /**
   * Ends every running transition as cancelled, then tears down as `StageRenderer#dispose()` does,
   * and disposes what the director built: its pipelines, the renderers it wrapped stages in, the
   * nodes of its effects. The stages and the effects stay the caller's.
   */
  override dispose(): void {
    if (this.isDisposed) return;
    const errors: unknown[] = [];
    for (const slot of this.#slots.slice()) {
      if (slot.run) this.#endRun(slot, 'from', 'cancelled', errors);
    }
    this.#slots = [];
    this.#slotsChanged();
    try {
      super.dispose();
    } catch (error) {
      errors.push(error);
    }
    for (const layer of [...this.#layers.values()]) this.#release(layer);
    for (const shape of this.#shapes.values()) {
      shape.pipeline.dispose();
      for (const slot of shape.slots) {
        if (slot.effect?.dispose && slot.effectNode) slot.effect.dispose(slot.effectNode);
      }
    }
    this.#shapes.clear();
    this.#shape = undefined;
    for (const placeholder of this.#placeholders) placeholder.dispose();
    this.#placeholders.length = 0;
    throwCollected(
      errors,
      'StageDirector#dispose(): more than one listener of OnStageTransitionEnd, OnStageRemoved, OnRemoveFromParent and OnStageDispose threw',
    );
  }

  // ---------------------------------------------------------------------------
  // slots and layers
  // ---------------------------------------------------------------------------

  #endLayerOf(slot: Slot): Layer | undefined {
    return slot.run ? slot.run.to : slot.layer;
  }

  #slotWithEnd(stage: IStage): Slot | undefined {
    for (const slot of this.#slots) {
      if (this.#endLayerOf(slot)?.stage === stage) return slot;
    }
    return undefined;
  }

  #slotOf(transition: StageTransition): Slot | undefined {
    for (const slot of this.#slots) if (slot.run?.transition === transition) return slot;
    return undefined;
  }

  #slotOfLayer(layer: Layer | undefined): Slot | undefined {
    if (!layer) return undefined;
    for (const slot of this.#slots) {
      if (slot.layer === layer || slot.run?.from === layer || slot.run?.to === layer) return slot;
    }
    return undefined;
  }

  #isReferenced(layer: Layer): boolean {
    return layer.role === 'mask' ? layer.uses > 0 : this.#slotOfLayer(layer) !== undefined;
  }

  /** Refuses `stage` as a layer when a director — this one or another — draws it as a mask. */
  #refuseMaskStageAsLayer(subject: string, stage: IStage): void {
    const owner = maskOwners.get(stage);
    if (owner === undefined) return;
    throw new Error(
      `${subject} cannot take the stage "${stage.name}": that stage is a mask of ${owner === this ? 'this' : 'another'} director`,
    );
  }

  /** Why `stage` cannot be drawn by this director — it is the director or holds it —, or `undefined`. */
  #holdRefusal(stage: IStage): string | undefined {
    if (!(stage instanceof StageRenderer)) return undefined;
    for (let holder: StageRendererParentType | undefined = this; holder instanceof StageRenderer; holder = holder.parent) {
      if (holder === stage) return holder === this ? 'that stage is this director' : 'that stage holds this director';
    }
    return undefined;
  }

  /**
   * Refuses `mask` before anything changes; `layer` is the stage the call puts into the new slot.
   * Answers the mask, `undefined` for none.
   */
  #checkMask(subject: string, mask: unknown, layer?: IStage): StageMask | undefined {
    if (mask === undefined) return undefined;
    if (!(mask instanceof StageMask)) {
      throw new TypeError(`${subject}: mask must be a StageMask, got ${describeValue(mask)}`);
    }
    const stage = mask.stage;
    const refusal = (reason: string) => new Error(`${subject} cannot take the mask on "${stage.name}": ${reason}`);
    if (mask.isDisposed) throw refusal('that mask has been disposed');
    if ((stage as {isDisposed?: unknown}).isDisposed === true) throw refusal('that stage has been disposed');
    const hold = this.#holdRefusal(stage);
    if (hold) throw refusal(hold);
    if (stage === layer || this.#layers.get(stage)?.role === 'layer') {
      throw refusal('that stage is a layer of this director');
    }
    const owner = maskOwners.get(stage);
    if (owner !== undefined && owner !== this) throw refusal('that stage is a mask of another director');
    // this director holds the stage as no layer, so every holder is another director
    if (layerOwners.get(stage)?.size) throw refusal('that stage is a layer of another director');
    return mask;
  }

  /**
   * Refuses the masks `options.effect` names before anything changes, as `#checkMask()` refuses the
   * mask of a slot, and a mask that drives a transition already — unless that transition is one
   * the call ends anyway, as `ends` tells. Answers the masks the transition will use: none for a
   * change without a transition, which draws no effect.
   */
  #checkEffectMasks(
    subject: string,
    options: ParsedOptions,
    layer: IStage | undefined,
    ends: (transition: StageTransition) => boolean,
  ): readonly StageMask[] {
    const masks = masksOf(subject, options.effect);
    for (const mask of masks) this.#checkMask(subject, mask, layer);
    if (options.instant) return NO_MASKS;
    for (const mask of masks) {
      const driver = StageMaskInternals.drivenBy(mask);
      if (driver !== undefined && !ends(driver)) {
        throw new Error(`${subject}: the mask "${mask.stage.name}" drives a transition already`);
      }
    }
    return masks;
  }

  /**
   * One use for every stage among `masks`, each stage once: a stage that is no mask of the
   * director yet joins. A stage that refuses to join gives back the uses taken before it.
   */
  #useMasks(subject: string, masks: readonly StageMask[]): void {
    let i = 0;
    try {
      for (; i < masks.length; i++) {
        if (firstOnItsStage(masks, i)) this.#join(subject, masks[i]!.stage, 'mask').uses++;
      }
    } catch (error) {
      const errors: unknown[] = [];
      this.#unuseMasks(masks.slice(0, i), errors);
      if (errors.length === 0) throw error;
      throw new AggregateError(
        [error, ...errors],
        `${subject}: more than one error on the way back from a mask stage that refused to join`,
      );
    }
  }

  /** Gives back the uses `#useMasks()` took for `masks`. */
  #unuseMasks(masks: readonly StageMask[], errors: unknown[]): void {
    for (let i = 0; i < masks.length; i++) {
      if (firstOnItsStage(masks, i)) this.#unuseMask(masks[i]!, errors);
    }
  }

  /**
   * Puts `mask` on `slot`: the stage of the new mask joins first, then the stage of the old one leaves
   * if nothing uses it any more.
   */
  #maskSlot(subject: string, slot: Slot, mask: StageMask | undefined, errors: unknown[]): void {
    const old = slot.mask;
    if (old === mask) return;
    if (mask) this.#join(subject, mask.stage, 'mask').uses++;
    slot.mask = mask;
    if (old) this.#unuseMask(old, errors);
    this.#slotsChanged();
  }

  /** Takes the mask off `slot`, a slot that goes or makes way for a new one. */
  #unmaskSlot(slot: Slot, errors: unknown[]): void {
    const mask = slot.mask;
    if (!mask) return;
    slot.mask = undefined;
    this.#unuseMask(mask, errors);
  }

  /** One use of the stage of `mask` less; with the last one the stage leaves the director. */
  #unuseMask(mask: StageMask, errors: unknown[]): void {
    const layer = this.#layers.get(mask.stage);
    if (layer?.role !== 'mask') return;
    layer.uses--;
    if (layer.uses > 0) return;
    try {
      this.#release(layer);
    } catch (error) {
      errors.push(error);
    }
  }

  /** The index in #slots before which a stage shown at position `at` of the stack goes. */
  #slotIndexAt(subject: string, at: unknown): number {
    if (at === undefined) return this.#slots.length;
    const stack = this.stack;
    if (!Number.isInteger(at) || (at as number) < 0 || (at as number) > stack.length) {
      throw new RangeError(`${subject}: at must be a whole number from 0 to ${stack.length}, got ${describeValue(at)}`);
    }
    if (at === stack.length) return this.#slots.length;
    return this.#slots.indexOf(this.#slotWithEnd(stack[at as number]!)!);
  }

  /** Finishes every transition that has `stage` as a source, so the stage stands in one slot at most. */
  #finishRunsWith(stage: IStage, errors: unknown[]): void {
    for (const slot of this.#slots.slice()) {
      const run = slot.run;
      if (run && (run.from?.stage === stage || run.to?.stage === stage)) this.#endRun(slot, 'to', 'finished', errors);
    }
  }

  /** The layer of `stage` in `role`, made and added to the base if it is none yet. */
  #join(subject: string, stage: StageDirectorLayer, role: Layer['role'] = 'layer'): Layer {
    const known = this.#layers.get(stage);
    if (known) {
      if (known.role !== role) {
        throw new Error(`${subject} cannot take the stage "${stage.name}": that stage is a ${known.role} of this director`);
      }
      return known;
    }
    if (role === 'layer') this.#refuseMaskStageAsLayer(subject, stage);

    if ((stage as {isDisposed?: unknown}).isDisposed === true) {
      throw new Error(`${subject} cannot take the stage "${stage.name}": that stage has been disposed`);
    }
    if (stage instanceof ClearStage) {
      throw new TypeError(
        `${subject} cannot take the stage "${stage.name}": a ClearStage clears nothing between layers, each of which draws into a target of its own`,
      );
    }
    if (typeof (stage as Partial<IRenderable>)?.renderTo !== 'function') {
      throw new TypeError(
        `${subject} cannot take the stage ${describeValue(stage)}: a layer needs resize(), updateFrame() and renderTo()`,
      );
    }
    const hold = this.#holdRefusal(stage);
    if (hold) throw new Error(`${subject} cannot take the stage "${stage.name}": ${hold}`);

    const wrapped = !(stage instanceof StageRenderer);
    const renderer = wrapped ? new StageRenderer() : (stage as StageRenderer);
    if (wrapped) {
      renderer.name = stage.name;
      try {
        renderer.add(stage);
      } catch (error) {
        renderer.dispose();
        throw error;
      }
    }

    this.#internalCall++;
    try {
      super.add(renderer);
    } catch (error) {
      if (wrapped) renderer.dispose();
      throw error;
    } finally {
      this.#internalCall--;
    }

    const layer: Layer = {stage, role, uses: 0, renderer, wrapped, frozen: false, needsPicture: true};
    // a wrapped stage that is disposed leaves its wrapper; the director lets go of the layer with it
    if (wrapped && isEventized(stage)) {
      layer.unsubscribe = on(stage, OnStageDispose, () => {
        if (this.#layers.get(stage) === layer) this.remove(stage);
      });
    }
    this.#layers.set(stage, layer);
    this.#byRenderer.set(renderer, layer);
    if (role === 'mask') {
      maskOwners.set(stage, this);
    } else {
      let owners = layerOwners.get(stage);
      if (!owners) layerOwners.set(stage, (owners = new Set()));
      owners.add(this);
    }
    this.#orderDirty = true;
    return layer;
  }

  /** Takes the layer out of the base and forgets it; a wrapper the director made is disposed. */
  #release(layer: Layer): void {
    if (this.#layers.get(layer.stage) !== layer) return;
    this.#layers.delete(layer.stage);
    this.#byRenderer.delete(layer.renderer);
    if (layer.role === 'mask') {
      if (maskOwners.get(layer.stage) === this) maskOwners.delete(layer.stage);
    } else {
      const owners = layerOwners.get(layer.stage);
      owners?.delete(this);
      if (owners?.size === 0) layerOwners.delete(layer.stage);
    }
    this.#orderDirty = true;
    layer.unsubscribe?.();
    this.#internalCall++;
    try {
      super.remove(layer.renderer);
    } finally {
      this.#internalCall--;
      if (layer.wrapped) layer.renderer.dispose();
    }
  }

  /** Takes `layer` out of every slot; a transition that has it as a source ends as cancelled. */
  #dropLayer(layer: Layer, errors: unknown[]): void {
    for (const slot of this.#slots.slice()) {
      const run = slot.run;
      if (run && (run.from === layer || run.to === layer)) {
        this.#endRun(slot, run.from === layer ? 'to' : 'from', 'cancelled', errors);
      }
      if (slot.layer === layer) this.#removeSlot(slot, errors);
      if (slot.frozeBelow === layer) slot.frozeBelow = undefined;
    }
    try {
      this.#release(layer);
    } catch (error) {
      errors.push(error);
    }
    this.#slotsChanged();
  }

  /**
   * Takes the mask stage `layer` off every slot it masks, ends every transition whose effect names
   * it as cancelled, and takes it out of the director.
   */
  #dropMask(layer: Layer, errors: unknown[]): void {
    // over a copy, as every loop here that may hand control to a listener
    for (const slot of this.#slots.slice()) {
      if (slot.mask?.stage === layer.stage) {
        slot.mask = undefined;
        layer.uses--;
      }
    }
    // the end of each run gives its use back, and the last one lets the stage go
    for (const slot of this.#slots.slice()) {
      if (slot.run?.masks.some((mask) => mask.stage === layer.stage)) this.#endRun(slot, 'from', 'cancelled', errors);
    }
    try {
      this.#release(layer);
    } catch (error) {
      errors.push(error);
    }
    this.#slotsChanged();
  }

  #removeSlot(slot: Slot, errors: unknown[]): void {
    const index = this.#slots.indexOf(slot);
    if (index !== -1) this.#slots.splice(index, 1);
    if (slot.frozeBelow) {
      slot.frozeBelow.frozen = false;
      slot.frozeBelow = undefined;
    }
    this.#unmaskSlot(slot, errors);
    this.#slotsChanged();
  }

  #slotsChanged(): void {
    this.#orderDirty = true;
    this.#stack = undefined;
    this.#transitions = undefined;
    this.#shapeKey = undefined;
    this.invalidateOutputNode();
    this.#watchMasks();
  }

  /**
   * Watches the dispose of every mask a slot or a running transition holds, and of no other: a
   * mask the director let go of keeps no reference to it. Runs with every change of the slots, never
   * in a frame that changes none.
   */
  #watchMasks(): void {
    const watches = this.#maskWatches;
    const held = (mask: StageMask): boolean => {
      for (const slot of this.#slots) {
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
    for (const slot of this.#slots) {
      if (slot.mask) watch(slot.mask);
      slot.run?.masks.forEach(watch);
    }
    // one at a time: the leave changes the slots and comes back here for the next one. An error of a
    // listener of that leave reaches the caller of the call that made the change
    if (disposed) this.#maskDisposed(disposed);
  }

  /**
   * A disposed mask leaves every slot it lies on, and every transition whose effect names it ends
   * as cancelled, as for a disposed mask stage; its stage leaves the director when nothing else
   * uses it. Another mask on the same stage stays where it is.
   */
  #maskDisposed = (mask: StageMask): void => {
    const errors: unknown[] = [];
    // over a copy: a listener of OnStageRemoved, when the mask stage leaves, may change the slots
    for (const slot of this.#slots.slice()) {
      if (slot.mask === mask) this.#unmaskSlot(slot, errors);
    }
    for (const slot of this.#slots.slice()) {
      if (slot.run?.masks.includes(mask)) this.#endRun(slot, 'from', 'cancelled', errors);
    }
    this.#slotsChanged();
    throwCollected(
      errors,
      'StageDirector: more than one listener of OnStageTransitionEnd and OnStageRemoved threw while a disposed mask left',
    );
  };

  // ---------------------------------------------------------------------------
  // transitions
  // ---------------------------------------------------------------------------

  /**
   * Starts the change of `slot` from `from` to `to`, or makes it at once. `masks` are the masks of
   * the effect, whose uses the caller has taken already: the transition drives them, and its end
   * gives the uses back. A change at once takes none.
   */
  #begin(
    slot: Slot,
    from: Layer | undefined,
    to: Layer | undefined,
    options: ParsedOptions,
    masks: readonly StageMask[],
    errors: unknown[],
  ): StageTransition {
    const transition = StageTransitionInternals.create(
      {
        from: from?.stage,
        to: to?.stage,
        effect: options.effect,
        duration: options.duration,
        delay: options.delay,
        easing: options.easing,
        manual: options.manual,
      },
      this.#host,
    );

    if (options.instant) {
      // an instant change drives no mask: the progress of a mask the effect names stays as it was
      slot.layer = to;
      if (!to) this.#removeSlot(slot, errors);
      if (from && !this.#isReferenced(from)) this.#release(from);
      this.#slotsChanged();
      StageTransitionInternals.advance(transition, 0);
      this.#emitInto(OnStageTransitionStart, transition, errors);
      StageTransitionInternals.settle(transition, 'finished');
      this.#emitInto(OnStageTransitionEnd, transition, errors);
      return transition;
    }

    slot.layer = undefined;
    slot.run = {transition, from, to, fromWasFrozen: from?.frozen === true, masks};
    // a new transition starts its masks at 0, before its first frame
    for (const mask of masks) {
      StageMaskInternals.setDrivenBy(mask, transition);
      StageMaskInternals.setProgress(mask, 0);
    }
    if (from && options.outgoing === 'freeze') from.frozen = true;
    if (to) {
      to.frozen = options.incoming === 'freeze';
      to.needsPicture = true;
    }
    this.#slotsChanged();
    return transition;
  }

  /** Ends the transition of `slot`, leaving the source `keep` in the slot. */
  #endRun(slot: Slot, keep: 'from' | 'to', state: 'finished' | 'cancelled', errors: unknown[]): void {
    const run = slot.run;
    if (!run) return;
    slot.run = undefined;
    // the masks hold the last progress of the transition: 1 when it finished, the value at the cancel
    // when it was cancelled
    const lastProgress = state === 'finished' ? 1 : run.transition.progress;
    for (const mask of run.masks) {
      if (StageMaskInternals.drivenBy(mask) !== run.transition) continue;
      StageMaskInternals.setDrivenBy(mask, undefined);
      StageMaskInternals.setProgress(mask, lastProgress);
    }

    const kept = keep === 'to' ? run.to : run.from;
    const left = keep === 'to' ? run.from : run.to;
    if (kept === run.to && run.to) run.to.frozen = false;
    if (kept === run.from && run.from) run.from.frozen = run.fromWasFrozen;

    slot.layer = kept;
    if (!kept) this.#removeSlot(slot, errors);
    if (left && !this.#isReferenced(left)) {
      try {
        this.#release(left);
      } catch (error) {
        errors.push(error);
      }
    }
    this.#unuseMasks(run.masks, errors);
    this.#slotsChanged();

    StageTransitionInternals.settle(run.transition, state);
    this.#emitInto(OnStageTransitionEnd, run.transition, errors);
  }

  #emitInto(event: string, transition: StageTransition, errors: unknown[]): void {
    try {
      emitStrict(this, event, {director: this, transition} as StageTransitionProps);
    } catch (error) {
      errors.push(error);
    }
  }

  #emitCollecting(event: string, transition: StageTransition, errors: unknown[] | undefined): unknown[] | undefined {
    try {
      emitStrict(this, event, {director: this, transition} as StageTransitionProps);
      return errors;
    } catch (error) {
      const collected = errors ?? [];
      collected.push(error);
      return collected;
    }
  }

  #cancelledHandle(from: IStage | undefined, to: IStage | undefined): StageTransition {
    const transition = StageTransitionInternals.create(
      {from, to, effect: crossfade(), duration: 0, delay: 0, easing: easingOf('', 'linear'), manual: false},
      undefined,
    );
    StageTransitionInternals.settle(transition, 'cancelled');
    return transition;
  }

  // ---------------------------------------------------------------------------
  // the order and the graph
  // ---------------------------------------------------------------------------

  #rebuildOrder(): void {
    const items = this.stages;
    const itemOf = (layer: Layer): StageItem | undefined => items.find((item) => item.stage === layer.renderer);
    const ordered: StageItem[] = [];
    const refs: OrderRef[] = [];
    this.#slots.forEach((slot, index) => {
      const sources: [Layer | undefined, 'layer' | 'from' | 'to'][] = slot.run
        ? [
            [slot.run.from, 'from'],
            [slot.run.to, 'to'],
          ]
        : [[slot.layer, 'layer']];
      for (const [layer, side] of sources) {
        const item = layer ? itemOf(layer) : undefined;
        if (item) {
          ordered.push(item);
          refs.push({slot: index, side});
        }
      }
    });
    // after every layer: the distinct mask stages of the slot masks, bottom-up, then those of the
    // running effects, slot by slot, each by its first appearance — they update after the layers
    // whose camera they may read. distinctMasks() counts the texture nodes of a shape in this order
    const masks: Layer[] = [];
    const addMask = (mask: StageMask): void => {
      const layer = this.#layers.get(mask.stage);
      if (layer && !masks.includes(layer)) masks.push(layer);
    };
    for (const slot of this.#slots) if (slot.mask) addMask(slot.mask);
    for (const slot of this.#slots) slot.run?.masks.forEach(addMask);
    masks.forEach((layer, maskStage) => {
      const item = itemOf(layer);
      if (item) {
        ordered.push(item);
        refs.push({side: 'mask', maskStage});
      }
    });
    this.#ordered = Object.freeze(ordered);
    this.#orderRefs = refs;
    this.#orderDirty = false;
  }

  /** The `index`th 1×1 transparent black target, which stands in for nothing. */
  #placeholder(renderer: WebGPURenderer, index: number): Texture {
    while (this.#placeholders.length <= index) {
      const placeholder = new RenderTarget(1, 1, {type: renderer.getOutputBufferType()});
      const prev = renderer.getRenderTarget();
      const prevAlpha = renderer.getClearAlpha();
      renderer.getClearColor(this.#clearColorOfRenderer);
      renderer.setRenderTarget(placeholder);
      try {
        renderer.setClearColor(new Color(0x000000), 0);
        renderer.clear(true, true, false);
      } finally {
        renderer.setClearColor(this.#clearColorOfRenderer, prevAlpha);
        renderer.setRenderTarget(prev);
      }
      this.#placeholders.push(placeholder);
    }
    return this.#placeholders[index]!.texture;
  }

  #currentShape(renderer: WebGPURenderer): Shape {
    if (this.#shapeKey === undefined || this.#shape === undefined) {
      const kinds = this.#slots.map(
        (slot): ShapeKind =>
          slot.run || slot.mask
            ? {effect: slot.run?.transition.effect, mask: slot.mask, effectMasks: slot.run?.masks ?? NO_MASKS}
            : LAYER_KIND,
      );
      const key = shapeKey(kinds);
      let shape = this.#shapes.get(key);
      if (!shape) {
        shape = this.#buildShape(renderer, kinds);
        this.#shapes.set(key, shape);
      }
      this.#shapeKey = key;
      this.#shape = shape;
    }
    return this.#shape;
  }

  #buildShape(renderer: WebGPURenderer, kinds: readonly ShapeKind[]): Shape {
    const at = uv();
    const slots: ShapeSlot[] = [];
    const textureNodes: TextureNode[] = [];
    const placeholders: Texture[] = [];
    const textureNode = (): TextureNode => {
      const placeholder = this.#placeholder(renderer, textureNodes.length);
      const node = texture(placeholder) as unknown as TextureNode;
      textureNodes.push(node);
      placeholders.push(placeholder);
      return node;
    };
    // one texture node per distinct mask stage, in the order of the stage indices, and one coverage
    // per distinct mask, shared by every slot it masks
    const maskNodes: TextureNode[] = [];
    const coverages: Node<'float'>[] = [];
    const coverageOf: (Node<'float'> | undefined)[] = [];
    // per slot, the index of the mask stage of each mask its effect names, by its place in the list
    const effectMaskStages: number[][] = [];
    distinctMasks(
      kinds,
      (slot, index, {stage, source, invert}) => {
        const maskNode = (maskNodes[stage] ??= textureNode());
        coverageOf[slot] = coverages[index] ??= maskCoverage(maskNode.sample(at) as unknown as Node<'vec4'>, source, invert);
      },
      (slot, position, _index, {stage}) => {
        maskNodes[stage] ??= textureNode();
        (effectMaskStages[slot] ??= [])[position] = stage;
      },
    );
    const masked = (slot: number, color: Node<'vec4'>): Node<'vec4'> => {
      const coverage = coverageOf[slot];
      return coverage ? (color.mul(coverage) as Node<'vec4'>) : color;
    };

    let out = this.#clearUniform as unknown as Node<'vec4'>;
    for (let index = 0; index < kinds.length; index++) {
      const {effect, effectMasks} = kinds[index]!;
      if (effect) {
        const from = textureNode();
        const to = textureNode();
        const progress = uniform(0) as unknown as UniformNode<'float', number>;
        const stages = effectMaskStages[index];
        const effectNode = effect.build({
          from: textureSource(from),
          to: textureSource(to),
          progress: progress as unknown as Node<'float'>,
          uv: at,
          resolution: this.#resolution as unknown as Node<'vec2'>,
          mask: (mask) => {
            const position = effectMasks.indexOf(mask);
            if (position === -1 || !stages) {
              const named = mask instanceof StageMask ? `the mask on "${mask.stage.name}"` : describeValue(mask);
              throw new Error(`StageTransitionInput#mask(): the effect "${effect.name}" did not name ${named} in its masks`);
            }
            return maskSource(maskNodes[stages[position]!]!, mask);
          },
        });
        slots.push({from, to, progress, effect, effectNode});
        out = over(masked(index, effectNode), out);
      } else {
        const layer = textureNode();
        slots.push({layer});
        out = over(masked(index, layer as unknown as Node<'vec4'>), out);
      }
    }
    return {pipeline: new RootRenderPipeline(renderer), slots, maskNodes, outputNode: out, textureNodes, placeholders};
  }

  /** Whether a renderer that composes holds this director: it draws into a pass target, on linear output. */
  #isNested(): boolean {
    for (let holder = this.parent; holder instanceof StageRenderer; holder = holder.parent) {
      // a director composes always, also before its first frame gives it a pipeline
      if (holder instanceof StageDirector || holder.pipeline !== undefined) return true;
    }
    return false;
  }

  /** Draws `stage` once into `target` on linear output, as the director draws a layer into its pass target. */
  #drawOffScreen(renderer: WebGPURenderer, stage: StageDirectorLayer, target: RenderTarget): void {
    if (!this.#layers.has(stage) && this.width > 0 && this.height > 0) {
      stage.resize(this.width, this.height, this.pixelRatio);
    }
    this.#withTarget(renderer, target, true, () => stage.renderTo(renderer));
  }

  /**
   * Compiles the material of `shape` through `RenderPipeline#render()` itself, with the one draw it
   * makes turned into a `compileAsync()`: the pipeline sets up the renderer and its quad as for a
   * frame — the output transform, no XR, the vertex node of the quad —, and the node build of the
   * compile sees what the draw of a frame would see. `nestedTarget` stands for the pass target of a
   * parent, which the director draws into on linear output; without it the director's own target
   * applies. Every texture node of the shape samples a placeholder of its own; the pass textures
   * that take their places later have their type, so they change a binding and no shader. The
   * pipeline keeps the output node, and the first frame of the shape finds it in place and builds
   * nothing.
   */
  async #compileShape(renderer: WebGPURenderer, shape: Shape, nestedTarget: RenderTarget | undefined): Promise<void> {
    const pipeline = shape.pipeline;
    pipeline.outputNode = shape.outputNode;
    pipeline.needsUpdate = true;

    let compiled: Promise<void> | undefined;
    const ownRender = Object.hasOwn(renderer, 'render');
    const render = renderer.render;
    renderer.render = ((scene, camera) => {
      compiled = renderer.compileAsync(scene, camera);
    }) as WebGPURenderer['render'];
    try {
      const target = nestedTarget ?? this.outputRenderTarget ?? renderer.getRenderTarget();
      this.#withTarget(renderer, target, nestedTarget !== undefined, () => pipeline.render());
    } finally {
      if (ownRender) renderer.render = render;
      else delete (renderer as Partial<WebGPURenderer>).render;
    }
    await compiled;
  }

  /** Runs `draw` with `target` set — and linear output, if asked —, and gives the renderer back as it was. */
  #withTarget(renderer: WebGPURenderer, target: RenderTarget | null, linear: boolean, draw: () => void): void {
    const prevTarget = renderer.getRenderTarget();
    const toneMapping = renderer.toneMapping;
    const outputColorSpace = renderer.outputColorSpace;
    renderer.setRenderTarget(target);
    if (linear) {
      renderer.toneMapping = NoToneMapping;
      renderer.outputColorSpace = ColorManagement.workingColorSpace;
    }
    try {
      draw();
    } finally {
      renderer.toneMapping = toneMapping;
      renderer.outputColorSpace = outputColorSpace;
      renderer.setRenderTarget(prevTarget);
    }
  }

  /** Points the texture nodes of the current shape at the pass textures of the layers. */
  #fillShape(passes: Node[]): Node {
    const shape = this.#shape;
    if (!shape) throw new Error('StageDirector: the shape of the stack is built before the composition');
    const {textureNodes, placeholders} = shape;
    for (let i = 0; i < textureNodes.length; i++) textureNodes[i]!.value = placeholders[i]!;
    const refs = this.#orderRefs;
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i]!;
      const pass = passes[i] as Partial<TextureNode> | undefined;
      if (ref.side === 'mask') {
        const node = shape.maskNodes[ref.maskStage];
        if (node && pass?.value) node.value = pass.value;
        continue;
      }
      const slot = shape.slots[ref.slot];
      const node = ref.side === 'layer' ? slot?.layer : ref.side === 'from' ? slot?.from : slot?.to;
      if (node && pass?.value) node.value = pass.value;
    }
    return shape.outputNode;
  }

  #updateClearUniform(renderer: WebGPURenderer): void {
    const value = this.#clearUniform.value;
    if (!this.clear) {
      value.set(0, 0, 0, 0);
      return;
    }
    const color = this.clearColor ?? renderer.getClearColor(this.#clearColorOfRenderer);
    const alpha = this.clearAlpha;
    value.set(color.r * alpha, color.g * alpha, color.b * alpha, alpha);
  }
}
