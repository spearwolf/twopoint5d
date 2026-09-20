import {emit, type EventizedObject, eventize, isEventized, off, on, once} from '@spearwolf/eventize';
import {texture} from 'three/tsl';
import {Color, type Node, RenderTarget, type RenderPipeline, type WebGPURenderer} from 'three/webgpu';
import {isWebGLRenderer} from '../display/isWebGLRenderer.js';
import {
  OnAddToParent,
  OnRemoveFromParent,
  OnStageAdded,
  OnStageAfterCameraChanged,
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
 * Clearing is opt-in via {@link clear} (default `false`). When `clear` is
 * `true`, the renderer clears the active render target before drawing its
 * stages, using {@link clearColor} / {@link clearAlpha} and the
 * `clearColorBuffer` / `clearDepthBuffer` / `clearStencilBuffer` flags.
 *
 * Setting `clearColor` to a non-null value also sets `clear = true` as a
 * convenience. Multiple stages are drawn additively into the same target
 * (the renderer sets `autoClear = false` while iterating stages) — use this
 * to layer stages on top of each other in a single pass.
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
   * stages. Defaults to `false`. Setting {@link clearColor} to a non-null
   * value flips this to `true` automatically.
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

  /**
   * All stages are included here, but unsorted. The render order is not included here yet.
   * see `renderOrder` and `getOrderedStages()`
   */
  readonly stages: StageItem[] = [];

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
      this.#warnAboutSharedNames(this.stages.map((item) => item.stage.name));
      this.onRenderOrderChanged();
    }
  }

  protected onRenderOrderChanged(): void {
    // ntdh
  }

  get renderOrder(): string {
    return this.#renderOrder;
  }

  #renderOrderArray?: string[];

  get renderOrderArray(): string[] {
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
    return new Set(this.renderOrderArray.filter((name) => name !== '*'));
  }

  get parent(): StageRendererParentType | undefined {
    return this.#parent;
  }

  set parent(parent: StageRendererParentType | undefined) {
    if (this.#disposed) return;

    if (this.#parent !== parent) {
      this.#removeFromParent();
      this.#parent = parent;
      if (this.#parent) {
        this.#addToParent();
      }
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

  #addToParent(): void {
    if (this.#parent instanceof StageRenderer) {
      this.#parent.add(this);
    } else {
      this.#addToHost(this.#parent as IStageRendererHost);
    }
    emit(this, OnAddToParent);
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
   */
  resize(width: number, height: number): void {
    // the stage items are the record of which size each stage carries: while one of them still
    // owes the size this renderer answers with, the call has work to do — a stage that took a
    // size the renderer gave up again is reached by no other call
    if (
      this.width === width &&
      this.height === height &&
      this.stages.every((item) => item.width === width && item.height === height)
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

    for (const stage of this.stages) {
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
      const stagesRefused = `${refusedByStages.length} of ${this.stages.length} stages refused the size ${width}x${height}`;

      throw new AggregateError(
        refused,
        refusedByRenderTarget.length > 0
          ? `StageRenderer#resize(): the render target and ${stagesRefused}`
          : `StageRenderer#resize(): ${stagesRefused}`,
      );
    }
  }

  protected resizeStage(stageItem: StageItem, width: number, height: number): void {
    if (stageItem.width !== width || stageItem.height !== height) {
      // the size a stage refuses is not the size it shows: the item keeps the one it had, so the
      // next resize() asks that stage again instead of taking it for done
      stageItem.stage.resize(width, height);
      stageItem.width = width;
      stageItem.height = height;
    }
  }

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
   * output. Without `buildOutputNode`, the stages render into an internal
   * pass-target whose texture is sampled by the pipeline. With
   * `buildOutputNode`, the pipeline runs a user-defined TSL graph composed
   * from each stage's pass node.
   *
   * The pipeline is handed in and stays the caller's. A disposed renderer
   * answers `undefined` here and takes no new one: like `parent`, `add()` and
   * `attach()`, the write is a silent no-op. Assigning a different pipeline
   * gives it this renderer's `outputNode` on the next render.
   */
  get pipeline(): RenderPipeline | undefined {
    return this.#pipeline;
  }

  set pipeline(pipeline: RenderPipeline | undefined) {
    if (this.#disposed) return;
    if (this.#pipeline !== pipeline) {
      this.#pipeline = pipeline;
      // a pipeline arrives with an outputNode of its own; the next render writes this renderer's into it
      this.#outputDirty = true;
    }
  }

  /**
   * Optional `RenderTarget` to which this renderer's final output is written.
   * Default `undefined` = writes to the renderer's current target (usually
   * the canvas). Useful for picking, screenshots, or driving a downstream
   * pass.
   */
  outputRenderTarget?: RenderTarget;

  #buildOutputNode?: StageRendererBuildOutputNode;

  /**
   * Optional TSL-composition hook. When set together with {@link pipeline},
   * the renderer collects an `asPassNode()` from each stage and feeds the
   * resulting node array into this function. Return the composed TSL graph
   * to use as `pipeline.outputNode` (e.g. bloom, blur, mix).
   *
   * Without `buildOutputNode` but with `pipeline`, the renderer falls back
   * to "render stages into an internal target, sample as `texture()`".
   *
   * Assigning or clearing it switches between the two pipeline modes; the
   * output node is rebuilt on the next render. While this renderer's `width`
   * or `height` is 0, or while a `Stage2D` it composes has no camera, the
   * composed mode draws nothing.
   */
  get buildOutputNode(): StageRendererBuildOutputNode | undefined {
    return this.#buildOutputNode;
  }

  set buildOutputNode(buildOutputNode: StageRendererBuildOutputNode | undefined) {
    if (this.#buildOutputNode !== buildOutputNode) {
      this.#buildOutputNode = buildOutputNode;
      this.#outputDirty = true;
    }
  }

  /** Internal RT used in Mode C (pipeline without buildOutputNode). */
  #internalRT?: RenderTarget;
  /** Internal RT used when a parent calls `asPassNode()` on this renderer. */
  #asPassNodeRT?: RenderTarget;
  /**
   * Marks `pipeline.outputNode` as needing a rebuild: the stages, their order or names, the
   * pipeline, `buildOutputNode` or the camera of a stage changed.
   */
  #outputDirty = true;

  /**
   * Pixel ratio of the renderer that last built or measured a `RenderTarget` here. `resize()`
   * has no renderer to ask; it sizes the targets from this value, and the next `#ensureRT()`
   * corrects them if the renderer has moved to a different ratio in the meantime.
   */
  #pixelRatio = 1;

  /** Invalidate the cached `pipeline.outputNode`; the next render rebuilds it. */
  invalidateOutputNode(): void {
    this.#outputDirty = true;
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
    if (this.pipeline) {
      if (this.buildOutputNode || this.pipeline instanceof RootRenderPipeline) {
        this.#renderPipelineComposed(renderer);
      } else {
        this.#renderPipelineSimple(renderer);
      }
    } else {
      this.#renderStagesInline(renderer);
    }
  }

  /** Plain mode: clear (if requested), then render stages into the current target. */
  #renderStagesInline(renderer: WebGPURenderer): void {
    const wasPreviouslyAutoClear = renderer.autoClear;
    if (this.clear) this.#applyClear(renderer);
    renderer.autoClear = false;
    try {
      for (const stageItem of this.orderedStages) {
        this.renderStage(stageItem, renderer);
      }
    } finally {
      renderer.autoClear = wasPreviouslyAutoClear;
    }
  }

  /**
   * Mode C (§6.4): render stages into the internal pass-target, then run
   * the pipeline sampling that target as `texture()`. The internal RT is
   * always cleared per frame (transparent black, or the user's
   * `clear`-color/alpha if set); the user's `clear` additionally clears the
   * final output target before the pipeline writes.
   */
  #renderPipelineSimple(renderer: WebGPURenderer): void {
    const rt = this.#ensureInternalRT(renderer);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    try {
      this.#clearForInternalRT(renderer);
      const wasPreviouslyAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      try {
        for (const stageItem of this.orderedStages) this.renderStage(stageItem, renderer);
      } finally {
        renderer.autoClear = wasPreviouslyAutoClear;
      }
    } finally {
      renderer.setRenderTarget(prev);
    }

    if (this.#outputDirty) {
      this.pipeline!.outputNode = texture(rt.texture);
      this.pipeline!.needsUpdate = true;
      this.#outputDirty = false;
    }

    if (this.clear) this.#applyClear(renderer);
    this.pipeline!.render();
  }

  /** Clears the currently bound internal RT each frame to avoid accumulation. */
  #clearForInternalRT(renderer: WebGPURenderer): void {
    if (this.clear) {
      this.#applyClear(renderer);
    } else {
      const oldClearAlpha = renderer.getClearAlpha();
      renderer.setClearAlpha(0);
      renderer.clear(true, true, false);
      renderer.setClearAlpha(oldClearAlpha);
    }
  }

  /**
   * Mode D (§6.2): for each stage, get its pass node; pre-render nested
   * `StageRenderer` children into their asPassNode-RTs first. Then run the
   * pipeline with `buildOutputNode(passes)` as `outputNode`.
   */
  #renderPipelineComposed(renderer: WebGPURenderer): void {
    // the stages take their camera from the first resize() with an area whose specs give a view, and
    // a Stage2D has no pass node to give before that: while this renderer has no area, or a Stage2D
    // of the composition has no camera, there is nothing to compose. A user-defined buildOutputNode
    // expects one pass per stage, so no stage is left out, and the output node stays dirty until the
    // first frame in which every Stage2D has a camera.
    if (!isPositiveFinite(this.width) || !isPositiveFinite(this.height)) return;
    if (this.orderedStages.some(({stage}) => isStage2DWithoutCamera(stage))) return;

    for (const stageItem of this.orderedStages) {
      const stage = stageItem.stage;
      if (stage instanceof StageRenderer) {
        const childRT = stage.#ensureAsPassNodeRT(renderer);
        const prev = renderer.getRenderTarget();
        renderer.setRenderTarget(childRT);
        try {
          stage.#renderToCurrentTarget(renderer);
        } finally {
          renderer.setRenderTarget(prev);
        }
      }
    }

    if (this.#outputDirty) {
      const passes = this.orderedStages.map((s) => this.#getStagePass(s, renderer));
      const compose = this.buildOutputNode ?? RootRenderPipeline.buildOutputNode;
      this.pipeline!.outputNode = compose(passes);
      this.pipeline!.needsUpdate = true;
      this.#outputDirty = false;
    }

    if (this.clear) this.#applyClear(renderer);
    this.pipeline!.render();
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
   * `StageRenderer` children).
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
      // through this method directly, and a child added with add() never learned who holds it
      throw disposedError('asPassNode()');
    }
    return (this.#asPassNodeRT = this.#ensureRT(this.#asPassNodeRT, renderer));
  }

  /** Size a `RenderTarget` has to have, in device pixels, for the current `width`/`height`. */
  #renderTargetSize(): [width: number, height: number] {
    return [Math.max(1, Math.floor(this.width * this.#pixelRatio)), Math.max(1, Math.floor(this.height * this.#pixelRatio))];
  }

  #resizeRenderTarget(rt: RenderTarget): void {
    const [w, h] = this.#renderTargetSize();
    if (rt.width !== w || rt.height !== h) {
      rt.setSize(w, h);
    }
  }

  #ensureRT(rt: RenderTarget | undefined, renderer: WebGPURenderer): RenderTarget {
    this.#pixelRatio = renderer.getPixelRatio?.() ?? 1;
    if (!rt) {
      const [w, h] = this.#renderTargetSize();
      return new RenderTarget(w, h);
    }
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
   * A {@link pipeline}, an {@link outputRenderTarget} and every stage were handed in and
   * belong to the caller: none of them is disposed here. Dispose them where they were built.
   *
   * Afterwards `isDisposed` is `true`, `parent` and `pipeline` answer `undefined`, `stages`
   * and `orderedStages` are empty, and no host event reaches this renderer any more —
   * `updateFrame()` and `renderTo()` have no stage left to drive. A write to `parent`,
   * `attach()`, `detach()`, `add()`, `remove()` and a further `dispose()` do nothing.
   * Every listener on this renderer goes with it, including the `OnStageAdded` and
   * `OnStageRemoved` subscriptions a caller placed on it, and so do the camera listeners it
   * placed on its stages (through `remove()`).
   *
   * The plain state stays writable, it just no longer drives anything: `resize()` writes
   * `width` and `height` and finds neither a stage nor a `RenderTarget` to pass them on to,
   * `setClearColor()` and the clear fields still take values, and `invalidateOutputNode()`
   * still marks the output node for a rebuild that never comes. `outputRenderTarget`,
   * `buildOutputNode`, `name` and `renderOrder` keep the values the renderer was left with.
   *
   * No `RenderTarget` is built after this call: `renderTo()` and `updateFrame()` do nothing,
   * `asPassNode()` throws an error naming the class and the state, and a write to `pipeline`
   * falls through.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    // the stages came in through add() and stay the caller's — this renderer only lets go
    for (const {stage} of this.stages.slice()) {
      this.remove(stage);
    }

    // the parent setter refuses a disposed renderer, so the detach runs on the field itself.
    // #removeFromParent() is what emits OnRemoveFromParent, and that event is what makes the
    // host subscriptions from #addToHost() unsubscribe.
    this.#removeFromParent();

    this.#internalRT?.dispose();
    this.#internalRT = undefined;
    this.#asPassNodeRT?.dispose();
    this.#asPassNodeRT = undefined;

    this.#pipeline = undefined;

    // last: the events above still have to reach the listeners that act on them
    off(this);
  }

  protected renderStage(stageItem: StageItem, renderer: WebGPURenderer): void {
    stageItem.stage.renderTo(renderer);
  }

  get orderedStages(): StageItem[] {
    if (this.#orderedStages) {
      // a stage name is a plain mutable field: the cache holds the names it was built from and
      // rebuilds when one of them moved
      if (this.#hasOrderedStageNames()) return this.#orderedStages;
      // a renamed stage can move to another position, and the pass nodes follow the order
      this.#outputDirty = true;
    }

    const renderOrder = this.renderOrderArray;

    if (renderOrder.length === 0 || (renderOrder.length === 1 && renderOrder[0] === '*')) {
      return this.stages;
    }

    const listed = this.#listedNames();
    const byName = new Map<string, StageItem[]>();
    const rest: StageItem[] = [];

    for (const item of this.stages) {
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
    this.#orderedStageNames = this.stages.map((item) => item.stage.name);

    return orderedStages;
  }

  #hasOrderedStageNames(): boolean {
    const names = this.#orderedStageNames;
    if (names.length !== this.stages.length) return false;
    for (let i = 0; i < names.length; i++) {
      if (names[i] !== this.stages[i]!.stage.name) return false;
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
      for (const item of this.stages) {
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

  /** Unsubscribe handle of the `OnStageAfterCameraChanged` listener on each eventized stage. */
  #cameraSubscriptions = new Map<IStage, () => void>();

  #getIndex(stage: IStage): number {
    return this.stages.findIndex((item) => item.stage === stage);
  }

  hasStage(stage: IStage): boolean {
    return this.#getIndex(stage) !== -1;
  }

  /**
   * Add a stage. The stage must implement both {@link IStage} and
   * {@link IRenderable}. Returns `this` for chaining.
   *
   * Emits `OnStageAdded`. Warns when {@link renderOrder} lists the stage's
   * `name` and another stage already carries it.
   *
   * On an eventized stage — every `Stage2D` — it listens for
   * `OnStageAfterCameraChanged` and rebuilds the output node on the next
   * render; `remove()` stops listening.
   */
  add(stage: IStage & IRenderable): this {
    if (this.#disposed) return this;

    if (!this.hasStage(stage)) {
      const si: StageItem = {
        stage,
        width: 0,
        height: 0,
      };
      this.stages.push(si);
      this.#warnAboutSharedNames([stage.name]);
      this.#orderedStages = undefined;
      this.#outputDirty = true;
      if (isEventized(stage)) {
        // a pass node keeps the camera it was built with: a stage that announces a new camera
        // needs a new pass node, and with it a new output node
        this.#cameraSubscriptions.set(
          stage,
          on(stage, OnStageAfterCameraChanged, () => this.invalidateOutputNode()),
        );
      }
      this.resizeStage(si, this.width, this.height);
      emit(this, OnStageAdded, {stage, renderer: this} as StageAddedProps);
    }
    return this;
  }

  /**
   * Remove a stage. Returns `this` for chaining. Emits `OnStageRemoved`.
   *
   * A removed child `StageRenderer` answers `undefined` as its `parent`
   * afterwards and gets its `OnRemoveFromParent`. Stops listening for the
   * stage's camera changes.
   */
  remove(stage: IStage): this {
    const index = this.#getIndex(stage);
    if (index !== -1) {
      this.stages.splice(index, 1);
      this.#cameraSubscriptions.get(stage)?.();
      this.#cameraSubscriptions.delete(stage);
      this.#orderedStages = undefined;
      this.#outputDirty = true;
      emit(this, OnStageRemoved, {stage, renderer: this} as StageRemovedProps);
      if (stage instanceof StageRenderer && stage.parent === this) {
        // the child still names this renderer as its holder; letting go is a move both
        // sides make, whichever of them started it
        stage.#removeFromParent();
      }
    }
    return this;
  }
}
