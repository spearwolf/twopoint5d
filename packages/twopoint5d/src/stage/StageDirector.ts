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
}

/** The options of `StageDirector#push()`. */
export interface StagePushOptions extends StageShowOptions {
  /** What the layer below the new one does while the new one is on top. Default `'run'`. */
  below?: StageLayerMode;
}

/**
 * A slot of a shape for `StageDirector#precompile()`: a layer, or a transition through this
 * effect — the same effect object the transition will take.
 */
export type StageDirectorShapeSlot = 'layer' | StageTransitionEffect;

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
}

interface Slot {
  /** What the slot shows while no transition runs in it. */
  layer?: Layer;
  run?: Run;
  /** The layer a push() froze below this one, which runs again when this slot goes. */
  frozeBelow?: Layer;
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
  readonly outputNode: Node;
  /** Every texture node of the shape, and the placeholder each one samples while it has no pass. */
  readonly textureNodes: readonly TextureNode[];
  readonly placeholders: readonly Texture[];
}

/** Which slot and which of its sources an entry of `orderedStages` is. */
interface OrderRef {
  readonly slot: number;
  readonly side: 'layer' | 'from' | 'to';
}

const NO_STAGES: ReadonlyArray<StageItem> = Object.freeze([]);

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

/** What a slot of a shape holds: a layer (`undefined`) or a transition through an effect. */
type ShapeKind = StageTransitionEffect | undefined;

function shapeKey(kinds: readonly ShapeKind[]): string {
  return kinds.map((effect) => (effect ? `t${effectId(effect)}` : 'l')).join(',');
}

function parseShapes(subject: string, shapes: unknown): ShapeKind[][] {
  if (!Array.isArray(shapes)) {
    throw new TypeError(`${subject}: shapes must be an array of shapes, got ${describeValue(shapes)}`);
  }
  return shapes.map((shape: unknown, i) => {
    if (!Array.isArray(shape) || shape.length === 0) {
      throw new TypeError(
        `${subject}: shapes[${i}] must be a non-empty array of 'layer' and StageTransitionEffect, got ${describeValue(shape)}`,
      );
    }
    return shape.map((slot: unknown, j): ShapeKind => {
      if (slot === 'layer') return undefined;
      if (typeof (slot as Partial<StageTransitionEffect>)?.build === 'function') return slot as StageTransitionEffect;
      throw new TypeError(
        `${subject}: shapes[${i}][${j}] must be 'layer' or a StageTransitionEffect, got ${describeValue(slot)}`,
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
    const at = this.#slotIndexAt(subject, opts?.at);

    const errors: unknown[] = [];
    this.#finishRunsWith(stage, errors);
    const layer = this.#join(subject, stage);
    const slot: Slot = {};
    this.#slots.splice(Math.min(at, this.#slots.length), 0, slot);
    const transition = this.#begin(slot, undefined, layer, options, errors);
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

    const errors: unknown[] = [];
    if (slot.run) this.#endRun(slot, 'to', 'finished', errors);
    const transition = this.#begin(slot, slot.layer, undefined, options, errors);
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

    const errors: unknown[] = [];
    if (slot.run) this.#endRun(slot, 'to', 'finished', errors);
    this.#finishRunsWith(to, errors);
    const toLayer = this.#join(subject, to);
    const transition = this.#begin(slot, slot.layer, toLayer, options, errors);
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
    parseOptions(subject, opts);
    if (this.#slotWithEnd(stage))
      throw new Error(`${subject} cannot take the stage "${stage.name}": that stage is in the stack already`);
    this.#slotIndexAt(subject, opts?.at);

    // the runs end before the slot below is known: a run with the stage — the stage pushed back while
    // a pop() still takes it out — and a run below that ends with nothing each take their slot out,
    // and the slot below is the one that stays
    const errors: unknown[] = [];
    this.#finishRunsWith(stage, errors);
    let belowSlot = this.#slots[this.#slotIndexAt(subject, opts?.at) - 1];
    while (below === 'freeze' && belowSlot?.run) {
      this.#endRun(belowSlot, 'to', 'finished', errors);
      belowSlot = this.#slots[this.#slotIndexAt(subject, opts?.at) - 1];
    }
    throwCollected(errors, `${subject}: more than one listener of OnStageTransitionEnd threw`);
    const belowLayer = belowSlot?.layer;
    const transition = this.show(stage, opts);
    if (below === 'freeze' && belowLayer && !belowLayer.frozen) {
      const slot = this.#slotOfLayer(this.#layers.get(stage));
      belowLayer.frozen = true;
      if (slot) slot.frozeBelow = belowLayer;
    }
    return transition;
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
    this.#slots = layers.map((layer) => ({layer}));
    for (const layer of [...this.#layers.values()]) {
      if (!layers.includes(layer)) this.#release(layer);
    }
    this.#slotsChanged();
    throwCollected(errors, `${subject}: more than one listener of OnStageTransitionEnd threw`);
    return this;
  }

  /** Freezes the layer of `stage`: it is neither updated nor drawn, and its last picture stays. */
  freeze(stage: IStage): this {
    return this.#setFrozen('StageDirector#freeze()', stage, true);
  }

  /** Lets the layer of `stage` run again. */
  run(stage: IStage): this {
    return this.#setFrozen('StageDirector#run()', stage, false);
  }

  #setFrozen(subject: string, stage: IStage, frozen: boolean): this {
    if (this.isDisposed) return this;
    const layer = this.#layers.get(stage);
    if (!layer) throw new Error(`${subject} cannot find the stage "${stage.name}": that stage is no layer of this director`);
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
   * as cancelled, with the other source in its slot.
   */
  override remove(stage: IStage): this {
    if (this.#internalCall > 0) return super.remove(stage);
    const layer = this.#layers.get(stage) ?? this.#byRenderer.get(stage);
    if (!layer) return super.remove(stage);
    const errors: unknown[] = [];
    this.#dropLayer(layer, errors);
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
      if (progress && run) progress.value = run.transition.progress;
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
   * the shape `['layer', dissolveIn]`.
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
    return this.#slotOfLayer(layer) !== undefined;
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

  /** The layer of `stage`, made and added to the base if it is none yet. */
  #join(subject: string, stage: StageDirectorLayer): Layer {
    const known = this.#layers.get(stage);
    if (known) return known;

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
    if (stage instanceof StageRenderer) {
      for (let holder: StageRendererParentType | undefined = this; holder instanceof StageRenderer; holder = holder.parent) {
        if (holder === stage) {
          throw new Error(
            holder === this
              ? `${subject} cannot take the stage "${stage.name}": that stage is this director`
              : `${subject} cannot take the stage "${stage.name}": that stage holds this director`,
          );
        }
      }
    }

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

    const layer: Layer = {stage, renderer, wrapped, frozen: false, needsPicture: true};
    // a wrapped stage that is disposed leaves its wrapper; the director lets go of the layer with it
    if (wrapped && isEventized(stage)) {
      layer.unsubscribe = on(stage, OnStageDispose, () => {
        if (this.#layers.get(stage) === layer) this.remove(stage);
      });
    }
    this.#layers.set(stage, layer);
    this.#byRenderer.set(renderer, layer);
    this.#orderDirty = true;
    return layer;
  }

  /** Takes the layer out of the base and forgets it; a wrapper the director made is disposed. */
  #release(layer: Layer): void {
    if (this.#layers.get(layer.stage) !== layer) return;
    this.#layers.delete(layer.stage);
    this.#byRenderer.delete(layer.renderer);
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
      if (slot.layer === layer) this.#removeSlot(slot);
      if (slot.frozeBelow === layer) slot.frozeBelow = undefined;
    }
    try {
      this.#release(layer);
    } catch (error) {
      errors.push(error);
    }
    this.#slotsChanged();
  }

  #removeSlot(slot: Slot): void {
    const index = this.#slots.indexOf(slot);
    if (index !== -1) this.#slots.splice(index, 1);
    if (slot.frozeBelow) {
      slot.frozeBelow.frozen = false;
      slot.frozeBelow = undefined;
    }
    this.#slotsChanged();
  }

  #slotsChanged(): void {
    this.#orderDirty = true;
    this.#stack = undefined;
    this.#transitions = undefined;
    this.#shapeKey = undefined;
    this.invalidateOutputNode();
  }

  // ---------------------------------------------------------------------------
  // transitions
  // ---------------------------------------------------------------------------

  /** Starts the change of `slot` from `from` to `to`, or makes it at once. */
  #begin(slot: Slot, from: Layer | undefined, to: Layer | undefined, options: ParsedOptions, errors: unknown[]): StageTransition {
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
      slot.layer = to;
      if (!to) this.#removeSlot(slot);
      if (from && !this.#isReferenced(from)) this.#release(from);
      this.#slotsChanged();
      StageTransitionInternals.advance(transition, 0);
      this.#emitInto(OnStageTransitionStart, transition, errors);
      StageTransitionInternals.settle(transition, 'finished');
      this.#emitInto(OnStageTransitionEnd, transition, errors);
      return transition;
    }

    slot.layer = undefined;
    slot.run = {transition, from, to, fromWasFrozen: from?.frozen === true};
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

    const kept = keep === 'to' ? run.to : run.from;
    const left = keep === 'to' ? run.from : run.to;
    if (kept === run.to && run.to) run.to.frozen = false;
    if (kept === run.from && run.from) run.from.frozen = run.fromWasFrozen;

    slot.layer = kept;
    if (!kept) this.#removeSlot(slot);
    if (left && !this.#isReferenced(left)) {
      try {
        this.#release(left);
      } catch (error) {
        errors.push(error);
      }
    }
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
      const sources: [Layer | undefined, OrderRef['side']][] = slot.run
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
      const kinds = this.#slots.map((slot) => slot.run?.transition.effect);
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
    let out = this.#clearUniform as unknown as Node<'vec4'>;
    for (const effect of kinds) {
      if (effect) {
        const from = textureNode();
        const to = textureNode();
        const progress = uniform(0) as unknown as UniformNode<'float', number>;
        const effectNode = effect.build({
          from: textureSource(from),
          to: textureSource(to),
          progress: progress as unknown as Node<'float'>,
          uv: at,
          resolution: this.#resolution as unknown as Node<'vec2'>,
        });
        slots.push({from, to, progress, effect, effectNode});
        out = over(effectNode, out);
      } else {
        const layer = textureNode();
        slots.push({layer});
        out = over(layer as unknown as Node<'vec4'>, out);
      }
    }
    return {pipeline: new RootRenderPipeline(renderer), slots, outputNode: out, textureNodes, placeholders};
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
