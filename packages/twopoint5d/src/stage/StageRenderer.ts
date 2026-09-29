import {emit, emitStrict, type EventizedObject, eventize, isEventized, off, on, once} from '@spearwolf/eventize';
import {texture} from 'three/tsl';
import {
  Color,
  ColorManagement,
  type Node,
  NoToneMapping,
  RenderTarget,
  type RenderPipeline,
  type Texture,
  type WebGPURenderer,
} from 'three/webgpu';
import {isWebGLRenderer} from '../display/isWebGLRenderer.js';
import {
  OnAddToParent,
  OnRemoveFromParent,
  OnStageAdded,
  OnStageAfterCameraChanged,
  OnStageAfterSceneChanged,
  OnStageRemoved,
  type StageAddedProps,
  type StageRemovedProps,
} from '../events.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import type {IPassProvider} from './IPassProvider.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import type {IStageRendererHost} from './IStageRendererHost.js';
import {RootRenderPipeline} from './RootRenderPipeline.js';
import type {Stage2D} from './Stage2D.js';

export type StageRendererBuildOutputNode = (stagePasses: Node[]) => Node;

// never written: setClearColor() copies it
const TRANSPARENT_BLACK = new Color(0x000000);

const hasAsPassNode = (s: unknown): s is IPassProvider => typeof (s as IPassProvider)?.asPassNode === 'function';

// recognized by its `isStage2D` flag, so this module needs no runtime import of Stage2D
const isStage2DWithoutCamera = (s: IStage): boolean =>
  (s as Partial<Stage2D>).isStage2D === true && (s as Stage2D).camera == null;

export type StageRendererParentType = IStageRendererHost | StageRenderer;

// one message for every member that refuses to answer once the renderer is gone, so the class
// and the state are always in the text a caller reads out of a foreign stack
function disposedError(member: string): Error {
  return new Error(`StageRenderer#${member} is not available: this renderer has been disposed`);
}

export interface StageItem {
  stage: IStage & IRenderable;

  width: number;
  height: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StageRenderer extends EventizedObject {}

/**
 * Renders a list of {@link IStage}s into a renderer, in order. Implements
 * {@link IStage} + {@link IRenderable} itself, so renderers can be nested.
 *
 * ## Frame-loop modes
 *
 * - **Auto-driven (recommended).** Pass a host (`Display` or parent
 *   `StageRenderer`) to the constructor (or call `attach(host)`): the renderer
 *   wires itself into the host's `onResize` / `onRenderFrame` and calls
 *   `updateFrame()` + `renderTo()` on every frame.
 * - **Manual.** Construct without a host and drive `updateFrame()` +
 *   `renderTo(renderer)` yourself from your own frame loop.
 *
 * **Do not mix the two.** If a `parent` is set, the renderer already ticks
 * itself — calling `updateFrame()` / `renderTo()` from your own
 * `OnDisplayRenderFrame` handler will render every frame twice.
 *
 * ## Clearing
 *
 * {@link clear} is the only clear of the target this renderer writes to
 * (default `false`). When `clear` is
 * `true`, the renderer clears the active render target before drawing its
 * stages, using {@link clearColor} / {@link clearAlpha} and the
 * `clearColorBuffer` / `clearDepthBuffer` / `clearStencilBuffer` flags.
 *
 * While the stages draw, `renderer.autoClear` is `false`, whatever the caller
 * set, and it is restored afterwards. With `clear = false` nothing clears the
 * target, and frames accumulate unless something else clears it.
 *
 * With a {@link pipeline} that is not a `RootRenderPipeline` and without
 * {@link buildOutputNode} (Mode C), the stages draw into an internal pass-target that the renderer clears to transparent
 * black (color and depth) every frame, whatever `clear` says; the own
 * `clear` then applies on top, and one that covers color and depth replaces
 * the black clear.
 *
 * Setting `clearColor` to a non-null value also sets `clear = true` as a
 * convenience. Multiple stages are drawn additively into the same target —
 * use this to layer stages on top of each other in a single pass.
 *
 * A renderer that a parent composes through {@link asPassNode} draws into a
 * pass-target which the parent clears to transparent black (color and depth)
 * at the start of every frame; the child's own `clear` then applies on top.
 * A child whose own clear covers color and depth, and reaches the target in
 * that frame, clears it alone.
 */
export class StageRenderer implements IStage, IRenderable, IPassProvider {
  /**
   * Sort key for `parent.renderOrder` and for diagnostics. Defaults to
   * `'StageRenderer'`; rename when you have multiple nested renderers and
   * want to address them by name in a parent's `renderOrder`.
   */
  name = 'StageRenderer';

  #parent?: StageRendererParentType;

  width: number = 0;
  height: number = 0;

  /**
   * When `true`, the active render target is cleared before drawing the
   * stages. Defaults to `false`. This is the only clear: `renderer.autoClear`
   * is `false` while the stages draw, so with `clear = false` nothing clears
   * the target. Setting {@link clearColor} to a non-null value flips this to
   * `true` automatically.
   */
  clear: boolean = false;

  #clearColor: Color | null = null;

  /**
   * Color used when {@link clear} is `true`. `null` means "leave the
   * renderer's current clear color in place" — only `clearAlpha` is applied.
   *
   * Assigning a non-null `Color` activates {@link clear} as a convenience;
   * assigning `null` leaves `clear` untouched (set it explicitly to disable).
   */
  get clearColor(): Color | null {
    return this.#clearColor;
  }

  set clearColor(color: Color | null | undefined) {
    if (color == null) {
      this.#clearColor = null;
    } else {
      this.#clearColor = color;
      this.clear = true;
    }
  }

  /**
   * Alpha used when {@link clear} is `true`. Default `1`.
   * Set to `0` for a transparent clear.
   */
  clearAlpha: number = 1;

  clearColorBuffer = true;
  clearDepthBuffer = true;
  clearStencilBuffer = true;

  /**
   * Activate clearing with the given color/alpha. Sets `clear = true`.
   * Returns `this` for chaining.
   *
   * Pass `null` to clear without overriding the renderer's current color
   * (alpha still applies); `clear` is enabled in that case as well.
   */
  setClearColor(color: Color | null, alpha = 1): this {
    this.#clearColor = color;
    this.clearAlpha = alpha;
    this.clear = true;
    return this;
  }

  #oldClearColor = new Color(0x000000);

  readonly #stages: StageItem[] = [];

  /**
   * Every stage of this renderer, in the order they were added — a read-only view of the live
   * list; {@link add} and {@link remove} are the only way in and out. The order in which the
   * stages update and draw is {@link orderedStages}: a stage that {@link renderOrder} does not
   * place is in here and not there, and {@link resize} reaches it all the same.
   */
  get stages(): ReadonlyArray<StageItem> {
    return this.#stages;
  }

  #renderOrder = '*';
  #orderedStages?: StageItem[];
  #orderedStageNames: string[] = [];

  /**
   * A comma separated list of stage names (see `IStage#name`) or `'*'` for
   * all other stages which are not listed explicitly.
   *
   * Stages sharing a listed name render together at that position, in the
   * order they were added, and {@link add} and every write here warn about
   * that name; a shared name that is not listed draws no warning. A name or
   * `'*'` listed twice counts at its first position. A stage renamed after
   * `add()` is sorted under its new name from the next frame on.
   */
  set renderOrder(order: string | undefined) {
    order = order || '*';
    if (this.#renderOrder !== order) {
      this.#renderOrder = order;
      this.#renderOrderArray = undefined;
      this.#orderedStages = undefined;
      this.#outputDirty = true;
      this.#warnAboutSharedNames(this.#stages.map((item) => item.stage.name));
      this.onRenderOrderChanged();
    }
  }

  /**
   * Runs after every write to {@link renderOrder} that changes the value — after the renderer
   * has dropped the order it had cached and warned about shared names, before the next frame
   * reads the order. Does nothing by default; a subclass overrides it to act on the new order.
   */
  protected onRenderOrderChanged(): void {}

  get renderOrder(): string {
    return this.#renderOrder;
  }

  #renderOrderArray?: string[];

  /**
   * The entries of {@link renderOrder}, split at the commas, trimmed, empty ones left out. A
   * copy: writing into it changes nothing.
   */
  get renderOrderArray(): string[] {
    return this.#getRenderOrderArray().slice();
  }

  // the frame path reads the order through here, never through the public getter, which copies
  #getRenderOrderArray(): string[] {
    if (!this.#renderOrderArray) {
      this.#renderOrderArray = this.renderOrder
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return this.#renderOrderArray;
  }

  /** The names `renderOrder` places explicitly: every entry of {@link renderOrderArray} except `'*'`. */
  #listedNames(): Set<string> {
    return new Set(this.#getRenderOrderArray().filter((name) => name !== '*'));
  }

  /**
   * The host or the `StageRenderer` that drives this renderer, `undefined` for none.
   *
   * Assigning a `StageRenderer` goes through its {@link add}, and everything `add()` says holds
   * here: the size comes first, so a stage of this renderer that refuses it makes the assignment
   * throw that error and leaves this renderer with the holder it had; a disposed target renderer
   * takes nothing, and the assignment silently leaves this renderer with its holder. Assigning a
   * host takes this renderer out of the renderer or the host that held it and wires it into the
   * frame loop of the new one; assigning `undefined` lets go of the holder. On a disposed renderer
   * the assignment does nothing.
   */
  get parent(): StageRendererParentType | undefined {
    return this.#parent;
  }

  set parent(parent: StageRendererParentType | undefined) {
    if (this.#disposed) return;
    if (this.#parent === parent) return;

    if (parent instanceof StageRenderer) {
      // add() moves this renderer: the size first, then out of its previous holder, then in
      parent.add(this);
      return;
    }

    this.#removeFromParent();
    this.#parent = parent;
    if (parent) {
      this.#addToHost(parent);
      emit(this, OnAddToParent);
    }
  }

  #removeFromParent(): void {
    const parent = this.#parent;
    if (parent == null) return;

    // cleared before the event goes out and before the parent hears about it: a remove()
    // coming back in from the other side finds nothing left to detach, and the recursion
    // between the two halves stops after one pass
    this.#parent = undefined;

    emit(this, OnRemoveFromParent);

    if (parent instanceof StageRenderer) {
      parent.remove(this);
    }
  }

  #addToHost(host: IStageRendererHost): void {
    once(
      this,
      OnRemoveFromParent,
      host.onResize(({width, height}) => {
        this.resize(width, height);
      }),
    );
    once(
      this,
      OnRemoveFromParent,
      host.onRenderFrame(({renderer, now, deltaTime, frameNo}) => {
        this.updateFrame(now, deltaTime, frameNo);
        this.renderTo(renderer);
      }),
    );
  }

  /**
   * @param parent Optional host (e.g. a `Display`) or parent `StageRenderer`.
   * Passing a parent enables the auto-driven frame loop — do not also drive
   * `updateFrame()`/`renderTo()` from your own handler (see class docs).
   */
  constructor(parent?: StageRendererParentType) {
    eventize(this);
    if (parent) {
      this.parent = parent;
    }
  }

  /** Equivalent to assigning `this.parent = parent`. */
  attach(parent: StageRendererParentType): this {
    this.parent = parent;
    return this;
  }

  /** Equivalent to assigning `this.parent = undefined`. */
  detach(): this {
    this.parent = undefined;
    return this;
  }

  /**
   * Hands the size to every stage of this renderer. A stage that refuses it does not keep the
   * others from theirs: each one is asked, and what they threw comes out together once every
   * stage has had the call — a single error unchanged, several of them as an `AggregateError`
   * whose message counts the stages that refused; a render target that refuses the size joins
   * that error without counting as one of them.
   *
   * While a stage refuses the size, this renderer answers with the size it carried before the
   * call, and the {@link StageItem} of that stage keeps the size it carried — a stage that took
   * the new size keeps it, item and all. The very same call therefore goes through again as soon
   * as the refusing stage fits, and reaches exactly the stages that do not have the size yet. A
   * call is carried out as long as one stage still owes the size this renderer answers with, so
   * the size this renderer fell back to reaches the stages that moved past it.
   *
   * `errors` of the `AggregateError` stands in the order in which the stages were added, the
   * error of a render target first.
   *
   * The call goes through {@link stages} as they stood when it began: a stage that `add()` or
   * `remove()` brings in or takes out during the call is reached from the next call on, see
   * {@link orderedStages}.
   */
  resize(width: number, height: number): void {
    // the stage items are the record of which size each stage carries: while one of them still
    // owes the size this renderer answers with, the call has work to do — a stage that took a
    // size the renderer gave up again is reached by no other call
    if (
      this.width === width &&
      this.height === height &&
      this.#stages.every((item) => item.width === width && item.height === height)
    ) {
      return;
    }

    const prevWidth = this.width;
    const prevHeight = this.height;

    this.width = width;
    this.height = height;

    const refusedByRenderTarget: unknown[] = [];

    try {
      if (this.#internalRT) this.#resizeRenderTarget(this.#internalRT);
      if (this.#asPassNodeRT) this.#resizeRenderTarget(this.#asPassNodeRT);
    } catch (error) {
      refusedByRenderTarget.push(error);
    }

    // a stage that refuses the size does not keep the others from theirs: each one is asked,
    // and what they threw comes out together once every stage has had the call
    const refusedByStages: unknown[] = [];
    // a listener of a stage's resize may add or remove a stage: the call goes through the
    // stages as they stood, so a removed one does not make the loop skip the next
    const stages = this.#stages.slice();

    for (const stage of stages) {
      try {
        this.resizeStage(stage, width, height);
      } catch (error) {
        refusedByStages.push(error);
      }
    }

    const refused = [...refusedByRenderTarget, ...refusedByStages];

    if (refused.length > 0) {
      // while a stage refuses the size, this renderer keeps the one it carried into the call, so
      // the very same call goes through again as soon as that stage fits — written through, it
      // would fall out of the size guard above and never reach the stage a second time
      this.width = prevWidth;
      this.height = prevHeight;

      if (refused.length === 1) throw refused[0];

      // the render target is none of the stages: it joins the error without moving their count
      const stagesRefused = `${refusedByStages.length} of ${stages.length} stages refused the size ${width}x${height}`;

      throw new AggregateError(
        refused,
        refusedByRenderTarget.length > 0
          ? `StageRenderer#resize(): the render target and ${stagesRefused}`
          : `StageRenderer#resize(): ${stagesRefused}`,
      );
    }
  }

  /**
   * Hands width and height to the stage of the item, unless the item carries them already, and
   * writes them into the item as soon as the stage has taken them. {@link resize} calls it for
   * every stage, {@link add} for the new stage before it is in {@link stages}. An override that
   * throws counts as the stage refusing the size (see `resize()`).
   */
  protected resizeStage(stageItem: StageItem, width: number, height: number): void {
    if (stageItem.width !== width || stageItem.height !== height) {
      // the size a stage refuses is not the size it shows: the item keeps the one it had, so the
      // next resize() asks that stage again instead of taking it for done
      stageItem.stage.resize(width, height);
      stageItem.width = width;
      stageItem.height = height;
    }
  }

  /**
   * Calls `updateFrame()` of every stage of {@link orderedStages}, in that order, as the order
   * stood when the call began. On a disposed renderer the list is empty.
   */
  updateFrame(now: number, deltaTime: number, frameNo: number): void {
    for (const {stage} of this.orderedStages) {
      stage.updateFrame(now, deltaTime, frameNo);
    }
  }

  // ---------------------------------------------------------------------------
  // Pipeline / RenderTarget integration — see "Post-processing" in ./README.md
  // ---------------------------------------------------------------------------

  #pipeline?: RenderPipeline;

  /**
   * Optional `THREE.RenderPipeline` running between the stages and the
   * output. For a pipeline that is not a `RootRenderPipeline`, without
   * `buildOutputNode` (Mode C), the stages render into an internal
   * pass-target whose texture is sampled by the pipeline. With
   * `buildOutputNode`, or as a `RootRenderPipeline`, the pipeline runs a TSL
   * graph composed from each stage's pass node — the user-defined one of
   * `buildOutputNode`, or the additive composition of the
   * `RootRenderPipeline`.
   *
   * The pipeline is handed in and stays the caller's. A disposed renderer
   * answers `undefined` here and takes no new one: like `parent`, `add()` and
   * `attach()`, the write is a silent no-op. Assigning a different pipeline
   * gives it this renderer's `outputNode` on the next render.
   *
   * In Mode C, the output node is rebuilt only for a new pipeline or after
   * {@link invalidateOutputNode}; stages, their order and names, their scenes
   * and their cameras leave it standing. A write that leaves this mode
   * releases the GPU memory of the internal pass-target; returning to it
   * allocates that memory again on the next frame.
   */
  get pipeline(): RenderPipeline | undefined {
    return this.#pipeline;
  }

  set pipeline(pipeline: RenderPipeline | undefined) {
    if (this.#disposed) return;
    if (this.#pipeline !== pipeline) {
      const wasPipelineOnly = this.#isPipelineOnly();
      this.#pipeline = pipeline;
      // a pipeline arrives with an outputNode of its own; the next render writes this renderer's into it
      this.#outputDirty = true;
      if (wasPipelineOnly && !this.#isPipelineOnly()) this.#internalRT?.dispose();
    }
  }

  /**
   * Optional `RenderTarget` to which this renderer's final output is written.
   * Default `undefined` = writes to the renderer's current target (usually
   * the canvas). Useful for picking, screenshots, or driving a downstream
   * pass.
   *
   * Without a {@link pipeline}, the stages draw into it linear in the working
   * color space and without tone mapping, as three.js draws into every
   * `RenderTarget`. With a pipeline, its output transform applies — tone
   * mapping and the encoding to `renderer.outputColorSpace`, as long as
   * `pipeline.outputColorTransform` is `true` — just as on the canvas. A
   * renderer that a parent draws into a target of the parent's own pipeline
   * writes linear in both cases; the outermost pipeline applies the transform.
   * Under a Mode C parent — a pipeline without `buildOutputNode` that is not
   * a `RootRenderPipeline` — a child
   * writes linear into its own `outputRenderTarget` as well: the parent
   * switches to linear output for all of its stage draws, whichever target
   * they write to.
   */
  outputRenderTarget?: RenderTarget;

  #buildOutputNode?: StageRendererBuildOutputNode;

  /**
   * Optional TSL-composition hook. When set together with {@link pipeline},
   * the renderer collects an `asPassNode()` from each stage and feeds the
   * resulting node array into this function. Return the composed TSL graph
   * to use as `pipeline.outputNode` (e.g. bloom, blur, mix).
   *
   * Without `buildOutputNode`, a `pipeline` that is not a
   * `RootRenderPipeline` falls back to "render stages into an internal
   * target, sample as `texture()`".
   *
   * Assigning or clearing it switches between the two pipeline modes; the
   * output node is rebuilt on the next render. Under a `RootRenderPipeline`
   * the renderer composes either way. While this renderer's `width`
   * or `height` is 0, or while a `Stage2D` it composes has no camera, the
   * composed mode draws nothing. Assigning it to a renderer whose pipeline
   * samples the internal pass-target releases the GPU memory of that target;
   * clearing it again allocates that memory again on the next frame.
   *
   * A disposed renderer answers `undefined` here and takes no new one: like
   * `pipeline`, the write is a silent no-op.
   */
  get buildOutputNode(): StageRendererBuildOutputNode | undefined {
    return this.#buildOutputNode;
  }

  set buildOutputNode(buildOutputNode: StageRendererBuildOutputNode | undefined) {
    if (this.#disposed) return;
    if (this.#buildOutputNode !== buildOutputNode) {
      const wasPipelineOnly = this.#isPipelineOnly();
      this.#buildOutputNode = buildOutputNode;
      this.#outputDirty = true;
      if (wasPipelineOnly && !this.#isPipelineOnly()) this.#internalRT?.dispose();
    }
  }

  /** Internal RT used in Mode C (a pipeline without buildOutputNode that is not a RootRenderPipeline). */
  #internalRT?: RenderTarget;
  /** Internal RT used when a parent calls `asPassNode()` on this renderer. */
  #asPassNodeRT?: RenderTarget;
  /** The `texture()` node Mode C gives its pipeline as `outputNode`, and the texture it samples. */
  #internalOutputNode?: Node;
  #internalOutputTexture?: Texture;
  /**
   * Marks `pipeline.outputNode` of the composed mode as needing a rebuild: the stages, their
   * order or names, the pipeline, `buildOutputNode` or the camera or the scene of a stage changed. Only the
   * composed mode reads it; Mode C keeps its own node, see `#renderPipelineSimple()`.
   */
  #outputDirty = true;

  /**
   * Pixel ratio of the renderer that last built or measured a `RenderTarget` here. `resize()`
   * has no renderer to ask; it sizes the targets from this value, and the next `#ensureRT()`
   * corrects them if the renderer has moved to a different ratio in the meantime.
   */
  #pixelRatio = 1;

  /** Invalidate the cached `pipeline.outputNode`; the next render rebuilds it, in either pipeline mode. */
  invalidateOutputNode(): void {
    this.#outputDirty = true;
    this.#internalOutputNode = undefined;
  }

  /**
   * Render all stages and optional post-pipeline into `renderer`. The
   * destination is `outputRenderTarget` if set, otherwise the renderer's
   * current target. This is the {@link IRenderable} method.
   */
  renderTo(renderer: WebGPURenderer): void {
    // nothing left to draw and nothing left to draw into: a disposed renderer holds no
    // stage, and the target belongs to the caller — clearing it here would be work on
    // something this renderer let go of
    if (this.#disposed) return;

    if (isWebGLRenderer(renderer)) {
      throw new TypeError('The WebGLRenderer renderer is not supported anymore');
    }

    if (this.outputRenderTarget) {
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(this.outputRenderTarget);
      try {
        this.#renderToCurrentTarget(renderer);
      } finally {
        renderer.setRenderTarget(prev);
      }
    } else {
      this.#renderToCurrentTarget(renderer);
    }
  }

  /**
   * Render contribution into the renderer's CURRENT target, ignoring
   * `outputRenderTarget`. Picks the right mode (plain / pipeline-only /
   * pipeline+buildOutputNode). A `RootRenderPipeline` triggers the
   * composed path automatically via its static `buildOutputNode`.
   */
  #renderToCurrentTarget(renderer: WebGPURenderer): void {
    // read once: a stage that add() or remove() brings in or takes out while the stages draw is
    // reached from the next call on, and every step of this call sees the same stages
    const stages = this.orderedStages;
    if (this.#isComposing()) {
      this.#renderPipelineComposed(renderer, stages);
    } else if (this.#pipeline) {
      this.#renderPipelineSimple(renderer, stages);
    } else {
      this.#renderStagesInline(renderer, stages);
    }
  }

  /** Composed mode: a pipeline with `buildOutputNode`, or a `RootRenderPipeline`. */
  #isComposing(): boolean {
    return this.#pipeline != null && (this.#buildOutputNode != null || this.#pipeline instanceof RootRenderPipeline);
  }

  /** Mode C: a pipeline that samples the internal pass-target. */
  #isPipelineOnly(): boolean {
    return this.#pipeline != null && !this.#isComposing();
  }

  /**
   * The stages take their camera from the first resize() with an area whose specs give a view, and
   * a Stage2D has no pass node to give before that: while this renderer has no area, or a Stage2D
   * of the composition has no camera, there is nothing to compose. A user-defined buildOutputNode
   * expects one pass per stage, so no stage is left out, and the output node stays dirty until the
   * first frame in which every Stage2D has a camera.
   */
  #canCompose(stages: ReadonlyArray<StageItem>): boolean {
    if (!isPositiveFinite(this.width) || !isPositiveFinite(this.height)) return false;
    for (const {stage} of stages) {
      if (isStage2DWithoutCamera(stage)) return false;
    }
    return true;
  }

  /**
   * The own clear of this renderer overwrites color and depth of its target in full, and it
   * reaches the target in this frame — a composing renderer without an area or without a camera
   * returns before its clear.
   */
  #clearsWholeTarget(): boolean {
    return (
      this.clear &&
      this.clearColorBuffer &&
      this.clearDepthBuffer &&
      (!this.#isComposing() || this.#canCompose(this.orderedStages))
    );
  }

  /** Plain mode: clear (if requested), then render stages into the current target. */
  #renderStagesInline(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>): void {
    const wasPreviouslyAutoClear = renderer.autoClear;
    if (this.clear) this.#applyClear(renderer);
    renderer.autoClear = false;
    try {
      for (const stageItem of stages) {
        this.renderStage(stageItem, renderer);
      }
    } finally {
      renderer.autoClear = wasPreviouslyAutoClear;
    }
  }

  /**
   * Mode C: render stages into the internal pass-target, then run
   * the pipeline sampling that target as `texture()`. The internal RT is
   * cleared in full to transparent black every frame before the user's
   * `clear` applies; the stages draw into it with linear output. The user's
   * `clear` additionally clears the final output target before the pipeline
   * writes, and the pipeline applies the output transform of the caller.
   */
  #renderPipelineSimple(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>): void {
    const pipeline = this.#pipeline!;
    const rt = this.#ensureInternalRT(renderer);
    const prev = renderer.getRenderTarget();
    // three.js' RenderPipeline bakes tone mapping and the encoding to renderer.outputColorSpace
    // into its quad whatever target it draws into, and rebuilds the quad when either value
    // changes: as long as both are linear, a nested pipeline writes linear values into the target
    // this pipeline samples, and the transform applies once, in the outermost pipeline.
    // pipeline.outputColorTransform is no way to get there — the pipeline reads it only when it
    // rebuilds, and the field belongs to the caller. A plain renderer.render() into a
    // RenderTarget writes linear anyway.
    const toneMapping = renderer.toneMapping;
    const outputColorSpace = renderer.outputColorSpace;
    renderer.setRenderTarget(rt);
    renderer.toneMapping = NoToneMapping;
    renderer.outputColorSpace = ColorManagement.workingColorSpace;
    try {
      this.#clearForInternalRT(renderer);
      const wasPreviouslyAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      try {
        for (const stageItem of stages) this.renderStage(stageItem, renderer);
      } finally {
        renderer.autoClear = wasPreviouslyAutoClear;
      }
    } finally {
      renderer.toneMapping = toneMapping;
      renderer.outputColorSpace = outputColorSpace;
      renderer.setRenderTarget(prev);
    }

    // the node depends on the internal target alone: stages, their order and names, their scenes
    // and their cameras leave it standing. Comparing with pipeline.outputNode catches a new
    // pipeline, the return from the composed mode and a node written into the pipeline from
    // outside.
    if (this.#internalOutputNode == null || this.#internalOutputTexture !== rt.texture) {
      this.#internalOutputNode = texture(rt.texture);
      this.#internalOutputTexture = rt.texture;
    }
    if (pipeline.outputNode !== this.#internalOutputNode) {
      pipeline.outputNode = this.#internalOutputNode;
      pipeline.needsUpdate = true;
    }

    if (this.clear) this.#applyClear(renderer);
    pipeline.render();
  }

  /**
   * The internal RT belongs to nobody else who would clear it. It is cleared in full to
   * transparent black every frame, color and depth, so that neither the clear color of the
   * renderer nor a rest of the previous frame stays in it; the own `clear` then applies as it
   * does for a nested child, and an own clear that covers color and depth replaces the black one.
   */
  #clearForInternalRT(renderer: WebGPURenderer): void {
    if (!this.#clearsWholeTarget()) this.#clearToTransparentBlack(renderer);
    if (this.clear) this.#applyClear(renderer);
  }

  /**
   * Mode D, and Mode E for nested renderers: for each stage, get its pass node; pre-render nested
   * `StageRenderer` children into their asPassNode-RTs first, with linear
   * output (see `#renderPipelineSimple()`). Then run the pipeline with
   * `buildOutputNode(passes)` as `outputNode`; it applies the output
   * transform of the caller.
   */
  #renderPipelineComposed(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>): void {
    if (!this.#canCompose(stages)) return;

    // linear output while the children draw into targets this pipeline samples, for the reason
    // given in #renderPipelineSimple()
    const toneMapping = renderer.toneMapping;
    const outputColorSpace = renderer.outputColorSpace;
    renderer.toneMapping = NoToneMapping;
    renderer.outputColorSpace = ColorManagement.workingColorSpace;
    try {
      for (const stageItem of stages) {
        const stage = stageItem.stage;
        if (stage instanceof StageRenderer) {
          const childRT = stage.#ensureAsPassNodeRT(renderer);
          const prev = renderer.getRenderTarget();
          renderer.setRenderTarget(childRT);
          try {
            // the pass target of the child belongs to nobody else who would clear it: a child
            // without clear draws its stages straight into it, and a child with clear but
            // clearColorBuffer/clearDepthBuffer off clears only part of it — the previous frame
            // would stay underneath. A child whose own clear covers color and depth and reaches
            // the target in this frame overwrites it itself.
            if (!stage.#clearsWholeTarget()) this.#clearToTransparentBlack(renderer);
            stage.#renderToCurrentTarget(renderer);
          } finally {
            renderer.setRenderTarget(prev);
          }
        }
      }
    } finally {
      renderer.toneMapping = toneMapping;
      renderer.outputColorSpace = outputColorSpace;
    }

    if (this.#outputDirty) {
      const passes = stages.map((s) => this.#getStagePass(s, renderer));
      const compose = this.buildOutputNode ?? RootRenderPipeline.buildOutputNode;
      this.pipeline!.outputNode = compose(passes);
      this.pipeline!.needsUpdate = true;
      this.#outputDirty = false;
    }

    if (this.clear) this.#applyClear(renderer);
    this.pipeline!.render();
  }

  /**
   * Clears color and depth of the current target to transparent black. The color is set
   * along with the alpha: with `renderer.alpha === false` a WebGPU clear keeps the RGB of the
   * clear color at alpha 0, and an additive composition would add that tint once per child.
   */
  #clearToTransparentBlack(renderer: WebGPURenderer): void {
    const oldClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.#oldClearColor);
    renderer.setClearColor(TRANSPARENT_BLACK, 0);
    renderer.clear(true, true, false);
    renderer.setClearColor(this.#oldClearColor, oldClearAlpha);
  }

  #getStagePass(stageItem: StageItem, renderer: WebGPURenderer): Node {
    const stage = stageItem.stage;
    if (!hasAsPassNode(stage)) {
      throw new TypeError(
        `StageRenderer.buildOutputNode: stage ${JSON.stringify(stage.name)} does not implement asPassNode() — incompatible with the buildOutputNode composition path`,
      );
    }
    return stage.asPassNode(renderer);
  }

  /**
   * Return a TSL `texture()` node sampling this renderer's pass-target.
   * Used by a parent `StageRenderer` with `buildOutputNode` to nest renderers.
   *
   * The parent is responsible for ensuring the texture is up-to-date before
   * the pipeline runs (`StageRenderer` does that automatically for nested
   * `StageRenderer` children: it clears the target to transparent black
   * first, unless the child's own clear covers color and depth, then renders
   * the child into it with linear output).
   *
   * A disposed renderer throws here instead of building a fresh pass-target
   * that nothing would release again.
   */
  asPassNode(renderer: WebGPURenderer): Node {
    const rt = this.#ensureAsPassNodeRT(renderer);
    return texture(rt.texture);
  }

  #ensureInternalRT(renderer: WebGPURenderer): RenderTarget {
    return (this.#internalRT = this.#ensureRT(this.#internalRT, renderer));
  }

  #ensureAsPassNodeRT(renderer: WebGPURenderer): RenderTarget {
    if (this.#disposed) {
      // the guard sits here and not in asPassNode(): a parent pre-renders a nested child
      // through this method directly
      throw disposedError('asPassNode()');
    }
    return (this.#asPassNodeRT = this.#ensureRT(this.#asPassNodeRT, renderer));
  }

  /** Width a `RenderTarget` has to have, in device pixels, for the current `width`. */
  #renderTargetWidth(): number {
    return Math.max(1, Math.floor(this.width * this.#pixelRatio));
  }

  /** Height a `RenderTarget` has to have, in device pixels, for the current `height`. */
  #renderTargetHeight(): number {
    return Math.max(1, Math.floor(this.height * this.#pixelRatio));
  }

  #resizeRenderTarget(rt: RenderTarget): void {
    const w = this.#renderTargetWidth();
    const h = this.#renderTargetHeight();
    if (rt.width !== w || rt.height !== h) {
      rt.setSize(w, h);
    }
  }

  #ensureRT(rt: RenderTarget | undefined, renderer: WebGPURenderer): RenderTarget {
    this.#pixelRatio = renderer.getPixelRatio?.() ?? 1;
    // the values three.js' PassNode gives the pass targets of the composed mode. The type stands
    // per renderer from its constructor on; a changed sample count is taken into the target by
    // three.js on the next draw, and target and texture stay the same objects — every texture()
    // node on them stays valid.
    if (!rt) {
      return new RenderTarget(this.#renderTargetWidth(), this.#renderTargetHeight(), {
        type: renderer.getOutputBufferType(),
        samples: renderer.samples,
      });
    }
    if (rt.samples !== renderer.samples) rt.samples = renderer.samples;
    this.#resizeRenderTarget(rt);
    return rt;
  }

  #applyClear(renderer: WebGPURenderer): void {
    const oldClearAlpha = renderer.getClearAlpha();
    let colorWasOverridden = false;
    if (this.#clearColor != null) {
      renderer.getClearColor(this.#oldClearColor);
      renderer.setClearColor(this.#clearColor, this.clearAlpha);
      colorWasOverridden = true;
    } else {
      renderer.setClearAlpha(this.clearAlpha);
    }
    renderer.clear(this.clearColorBuffer, this.clearDepthBuffer, this.clearStencilBuffer);
    if (colorWasOverridden) {
      renderer.setClearColor(this.#oldClearColor, oldClearAlpha);
    } else {
      renderer.setClearAlpha(oldClearAlpha);
    }
  }

  #disposed = false;

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Release the `RenderTarget`s this renderer built for itself, let go of the host that
   * drives it, and give up its stages. Call when this renderer is no longer needed.
   *
   * The stages go through {@link remove}, so a nested `StageRenderer` among them releases
   * the GPU memory of its pass-target as well; the child itself is not disposed, and three.js
   * allocates that memory again on its next draw into the target.
   *
   * A {@link pipeline}, an {@link outputRenderTarget} and every stage were handed in and
   * belong to the caller: none of them is disposed here. Dispose them where they were built.
   *
   * Afterwards `isDisposed` is `true`, `parent`, `pipeline` and `buildOutputNode` answer
   * `undefined`, `stages` and `orderedStages` are empty, and no host event reaches this
   * renderer any more — `updateFrame()` and `renderTo()` have no stage left to drive, and a
   * parent `StageRenderer` that held this renderer has it no longer among its stages. A write
   * to `parent`, `attach()`, `detach()`, `add()`, `remove()` and a further `dispose()` do
   * nothing.
   *
   * A `dispose` event goes out to every subscriber before this renderer stops listening; no
   * event follows it. A listener of the event that throws does not hold up the teardown: every
   * subscriber hears the event, the renderer is torn down completely, and the error reaches the
   * caller afterwards — one unchanged, several as an `AggregateError`. Every listener on this
   * renderer goes with it, including the
   * `OnStageAdded` and `OnStageRemoved` subscriptions a caller placed on it, and so do the
   * camera, scene and dispose listeners it placed on its stages (through `remove()`).
   *
   * The plain state stays writable, it just no longer drives anything: `resize()` writes
   * `width` and `height` and finds neither a stage nor a `RenderTarget` to pass them on to,
   * `setClearColor()` and the clear fields still take values, and `invalidateOutputNode()`
   * still marks the output node for a rebuild that never comes. `outputRenderTarget`, `name`
   * and `renderOrder` keep the values the renderer was left with.
   *
   * No `RenderTarget` is built after this call: `renderTo()` and `updateFrame()` do nothing,
   * `asPassNode()` throws an error naming the class and the state, and a write to `pipeline`
   * or `buildOutputNode` falls through.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    // the stages came in through add() and stay the caller's — this renderer only lets go
    for (const {stage} of this.#stages.slice()) {
      this.remove(stage);
    }

    // released before the parent lets go: its remove() releases the pass target of a child it
    // held, and finds none left here — each target is released once
    this.#internalRT?.dispose();
    this.#internalRT = undefined;
    this.#internalOutputNode = undefined;
    this.#internalOutputTexture = undefined;
    this.#asPassNodeRT?.dispose();
    this.#asPassNodeRT = undefined;

    // the parent setter refuses a disposed renderer, so the detach runs on the field itself.
    // #removeFromParent() is what emits OnRemoveFromParent, and that event is what makes the
    // host subscriptions from #addToHost() unsubscribe.
    this.#removeFromParent();

    this.#pipeline = undefined;
    this.#buildOutputNode = undefined;

    // the listeners are still attached here: this event is what tells them to let go, and no
    // event follows it. A listener that throws neither keeps the ones behind it from the event nor
    // leaves the renderer half torn down
    try {
      emitStrict(this, 'dispose', this);
    } finally {
      off(this);
    }
  }

  /**
   * Draws the stage of the item into the current target of the renderer; called for every stage
   * of the order in the plain mode and in Mode C. The composing modes, Mode D and Mode E, take
   * the `asPassNode()` of every stage and call this hook for none of them — an override that
   * draws differently has no effect there.
   */
  protected renderStage(stageItem: StageItem, renderer: WebGPURenderer): void {
    stageItem.stage.renderTo(renderer);
  }

  /**
   * The stages in the order they update and draw: {@link renderOrder} applied to
   * {@link stages}. Without `'*'` in the order, a stage whose name it does not list is left out —
   * neither updated nor drawn, though still resized.
   *
   * The array is a snapshot: `add()`, `remove()`, a write to `renderOrder` and — while
   * `renderOrder` lists names — a renamed stage give the next read a new one, and an array
   * handed out before stays as it was. `updateFrame()` and `renderTo()` each go through the
   * order as it stood when the call began, `resize()` through `stages` as they stood: a stage
   * that `add()` or `remove()` brings in or takes out during such a call — from a listener of a
   * stage's frame event, say — is reached from the next call on. A stage removed during
   * `updateFrame()` has its `updateFrame()` in that call and is not drawn by the `renderTo()`
   * after it; a stage added there is drawn by that `renderTo()` and updates from the next frame
   * on.
   */
  get orderedStages(): ReadonlyArray<StageItem> {
    const renderOrder = this.#getRenderOrderArray();
    // no name listed: a rename moves no stage, so the snapshot holds no names and stands until
    // add(), remove() or a write to renderOrder — a rename rebuilds neither it nor the output
    // node
    const everyStageInOrder = renderOrder.length === 0 || (renderOrder.length === 1 && renderOrder[0] === '*');

    if (this.#orderedStages) {
      // a stage name is a plain mutable field: the cache holds the names it was built from and
      // rebuilds when one of them moved
      if (everyStageInOrder || this.#hasOrderedStageNames()) return this.#orderedStages;
      // a renamed stage can move to another position, and the pass nodes follow the order
      this.#outputDirty = true;
    }

    if (everyStageInOrder) {
      // a copy, never the list itself: add() and remove() change that list, and a snapshot
      // handed out does not change after it
      this.#orderedStages = this.#stages.slice();
      return this.#orderedStages;
    }

    const listed = this.#listedNames();
    const byName = new Map<string, StageItem[]>();
    const rest: StageItem[] = [];

    for (const item of this.#stages) {
      const {name} = item.stage;
      if (listed.has(name)) {
        const items = byName.get(name);
        if (items) {
          items.push(item);
        } else {
          byName.set(name, [item]);
        }
      } else {
        rest.push(item);
      }
    }

    // a name or '*' listed twice counts at its first position, so every stage is placed once
    const orderedStages: StageItem[] = [];
    const placed = new Set<string>();
    let restPlaced = false;

    for (const name of renderOrder) {
      if (name === '*') {
        if (!restPlaced) {
          restPlaced = true;
          orderedStages.push(...rest);
        }
      } else if (!placed.has(name)) {
        placed.add(name);
        const items = byName.get(name);
        if (items) orderedStages.push(...items);
      }
    }

    this.#orderedStages = orderedStages;
    this.#orderedStageNames = this.#stages.map((item) => item.stage.name);

    return orderedStages;
  }

  #hasOrderedStageNames(): boolean {
    const names = this.#orderedStageNames;
    if (names.length !== this.#stages.length) return false;
    for (let i = 0; i < names.length; i++) {
      if (names[i] !== this.#stages[i]!.stage.name) return false;
    }
    return true;
  }

  #warnAboutSharedNames(names: Iterable<string>): void {
    // only a name that renderOrder lists has to be told apart: stages under any other name go
    // with the rest behind '*', or are not drawn at all, whatever they are called
    const listed = this.#listedNames();

    for (const name of new Set(names)) {
      if (!listed.has(name)) continue;
      let count = 0;
      for (const item of this.#stages) {
        if (item.stage.name === name) count++;
      }
      if (count > 1) {
        // eslint-disable-next-line no-console
        console.warn(
          `StageRenderer: ${count} stages are named ${JSON.stringify(name)} and renderOrder=${JSON.stringify(this.#renderOrder)} cannot tell them apart; they render in the order they were added. Set unique names on your stages.`,
        );
      }
    }
  }

  /**
   * Unsubscribe handle of the listeners on each eventized stage: its camera and scene changes, and
   * its `dispose`. One handle ends all of them.
   */
  #stageSubscriptions = new Map<IStage, () => void>();

  #getIndex(stage: IStage): number {
    return this.#stages.findIndex((item) => item.stage === stage);
  }

  hasStage(stage: IStage): boolean {
    return this.#getIndex(stage) !== -1;
  }

  /**
   * Add a stage. The stage must implement both {@link IStage} and
   * {@link IRenderable}. Returns `this` for chaining.
   *
   * The stage gets the size of this renderer first: a stage that refuses it
   * is not added, the error of its `resize()` comes out of this call, and
   * neither this renderer nor the stage has changed. A disposed stage — one
   * whose `isDisposed` is `true` — is refused with an error naming the call
   * and the state.
   *
   * Emits `OnStageAdded`. Warns when {@link renderOrder} lists the stage's
   * `name` and another stage already carries it.
   *
   * A `StageRenderer` added here becomes the child of this renderer, the same
   * as `child.parent = this`: it leaves the host or the renderer that held
   * it, `parent` answers this renderer, and it gets its `OnAddToParent` after
   * `OnStageAdded` went out here. A renderer has one holder.
   *
   * On an eventized stage — every `Stage2D` and every `StageRenderer` — it
   * listens for `OnStageAfterCameraChanged` and `OnStageAfterSceneChanged`
   * and, in the composed mode, rebuilds the output node on the next render,
   * and for `dispose`, on which it takes the stage out through
   * {@link remove}; `remove()` stops listening. A child `StageRenderer` does
   * not wait for that event: its own `dispose()` takes it out of this
   * renderer first.
   *
   * A stage added during `updateFrame()`, `renderTo()` or `resize()` is
   * reached from the next call on, see {@link orderedStages}.
   */
  add(stage: IStage & IRenderable): this {
    if (this.#disposed) return this;
    if (this.hasStage(stage)) return this;

    // a disposed stage never announces its end again: listed, it would stay in here for good
    if ((stage as {isDisposed?: unknown}).isDisposed === true) {
      throw new Error(`StageRenderer#add() cannot take the stage ${JSON.stringify(stage.name)}: that stage has been disposed`);
    }

    const item: StageItem = {stage, width: 0, height: 0};

    // the size first: a stage that refuses it leaves with its error before anything here, on the
    // stage or at the previous holder of a child renderer has changed
    this.resizeStage(item, this.width, this.height);

    const child = stage instanceof StageRenderer ? stage : undefined;
    // a renderer has one holder: a child leaves its host or the renderer that held it
    if (child) child.#removeFromParent();

    this.#stages.push(item);
    this.#warnAboutSharedNames([stage.name]);
    this.#orderedStages = undefined;
    this.#outputDirty = true;

    if (isEventized(stage)) {
      // a pass node keeps the scene and the camera it was built with: a stage that announces a
      // new one of either needs a new pass node, and with it a new output node — in the composed
      // mode only, since the node of Mode C samples the internal target and holds neither scene
      // nor camera, and so the flag is set here rather than through invalidateOutputNode(),
      // which drops that node as well
      const unsubscribeChanges = on(stage, [OnStageAfterCameraChanged, OnStageAfterSceneChanged], () => {
        this.#outputDirty = true;
      });
      // a disposed stage has no pass node left to give: the renderer lets go of it on the spot
      const unsubscribeDispose = on(stage, 'dispose', () => {
        this.remove(stage);
      });
      this.#stageSubscriptions.set(stage, () => {
        unsubscribeChanges();
        unsubscribeDispose();
      });
    }

    if (child) child.#parent = this;

    emit(this, OnStageAdded, {stage, renderer: this} as StageAddedProps);
    if (child) emit(child, OnAddToParent);

    return this;
  }

  /**
   * Remove a stage. Returns `this` for chaining. Emits `OnStageRemoved`.
   *
   * A removed child `StageRenderer` answers `undefined` as its `parent`
   * afterwards and gets its `OnRemoveFromParent`, and releases the GPU memory
   * of its pass-target. Stops listening for the stage's camera and scene
   * changes and for its `dispose`.
   *
   * A stage removed during `updateFrame()`, `renderTo()` or `resize()` is
   * still reached by that call and left out from the next call on, see
   * {@link orderedStages}.
   */
  remove(stage: IStage): this {
    const index = this.#getIndex(stage);
    if (index !== -1) {
      this.#stages.splice(index, 1);
      this.#stageSubscriptions.get(stage)?.();
      this.#stageSubscriptions.delete(stage);
      this.#orderedStages = undefined;
      this.#outputDirty = true;
      emit(this, OnStageRemoved, {stage, renderer: this} as StageRemovedProps);
      if (stage instanceof StageRenderer) {
        // the pass target belongs to the child, and this renderer, which let go of it, samples it
        // no longer. The object stays, so every texture() node another parent built from it stays
        // valid; three.js allocates the memory again on the next draw.
        stage.#asPassNodeRT?.dispose();
        if (stage.parent === this) {
          // the child still names this renderer as its holder; letting go is a move both
          // sides make, whichever of them started it
          stage.#removeFromParent();
        }
      }
    }
    return this;
  }
}
