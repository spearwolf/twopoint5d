import {describeValue} from '../utils/describeValue.js';
import {emitStrict, type EventizedObject, eventize, isEventized, off, on} from '@spearwolf/eventize';
import {texture} from 'three/tsl';
import type {Color, Node, RenderPipeline, RenderTarget, WebGPURenderer} from 'three/webgpu';
import {isWebGLRenderer} from '../display/isWebGLRenderer.js';
import {
  OnAddToParent,
  OnRemoveFromParent,
  OnStageAdded,
  OnStageAfterCameraChanged,
  OnStageAfterPostProcessChanged,
  OnStageAfterSceneChanged,
  OnStageDispose,
  OnStageRemoved,
  type StageAddedProps,
  type StageRemovedProps,
} from '../events.js';
import {assertFinite} from '../utils/assertFinite.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import {throwCollected} from '../utils/throwCollected.js';
import type {IPassProvider} from './IPassProvider.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import type {IStageRendererHost} from './IStageRendererHost.js';
import type {OutputNodeBuilder} from './outputNodeBuilders.js';
import type {Stage2D} from './Stage2D.js';
import {canCompose, StageRendererComposition} from './StageRendererComposition.js';
import {
  hasAsPassNode,
  modeOf,
  NO_PASS_NODE,
  StageRendererDraw,
  StageRendererDrawInternals,
  type StageRendererMode,
} from './StageRendererDraw.js';
import {StageRendererHostLink} from './StageRendererHostLink.js';
import {StageRendererInternals, StageRendererTargets} from './StageRendererTargets.js';
import {StageRendererWholePicture} from './StageRendererWholePicture.js';
import type {StageRenderTargetPool} from './StageRenderTargetPool.js';
import {StageRenderOrder} from './StageRenderOrder.js';

export type StageRendererBuildOutputNode = (stagePasses: Node[]) => Node;

export type StageRendererParentType = IStageRendererHost | StageRenderer;

// one message for every member that refuses to answer once the renderer is gone, so the class
// and the state are always in the text a caller reads out of a foreign stack
function disposedError(member: string): Error {
  return new Error(`StageRenderer#${member} is not available: this renderer has been disposed`);
}

const ADD_THREW =
  'StageRenderer#add(): more than one listener of OnRemoveFromParent, OnStageRemoved, OnStageAdded and OnAddToParent or unsubscribe of the previous host threw';

/**
 * One stage of a `StageRenderer` and the size it carries — the record `resize()` keeps of which
 * size each stage has taken. Read-only: the renderer writes it in `add()` and `resize()`, and
 * nothing else does.
 */
export interface StageItem {
  readonly stage: IStage & IRenderable;

  readonly width: number;
  readonly height: number;
  /** The pixel ratio the stage carries, handed to it with `width` and `height`. */
  readonly pixelRatio: number;
}

// the item as the renderer keeps it, writable; derived, so that it keeps step with StageItem. Not
// exported: public-api.ts re-exports this module whole
type StageItemRecord = {-readonly [K in keyof StageItem]: StageItem[K]};

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
 * {@link clear} is the only clear of the target this renderer writes to (default
 * `false`). When `clear` is `true`, the renderer clears the active render target
 * before drawing its stages, using {@link clearColor} / {@link clearAlpha} and
 * the `clearColorBuffer` / `clearDepthBuffer` / `clearStencilBuffer` flags.
 *
 * While the stages draw, `renderer.autoClear` is `false`, whatever the caller
 * set, and it is restored afterwards. With `clear = false` nothing clears the
 * target, and frames accumulate unless something else clears it.
 *
 * With a {@link pipeline} that is not a `RootRenderPipeline` and without
 * {@link buildOutputNode} (the whole-picture mode), the stages draw into an internal target
 * that the renderer clears to transparent black (color and depth) every frame,
 * whatever `clear` says; the own `clear` then applies on top, and one that
 * covers color and depth replaces the black clear.
 *
 * With a {@link pipeline}, the quad of the pipeline covers the target it writes to, every pixel
 * and without blending: the own clear of that target is left out where three.js clears it anyway
 * before that draw — `renderer.autoClear` with the `autoClearColor`, `autoClearDepth` and
 * `autoClearStencil` flags of every buffer the own clear covers, as three.js sets them by default.
 * The target ends up the same either way, and on the canvas the clear would cost a full-screen draw
 * of its own. A renderer without a pipeline that draws a nested renderer with a pipeline of its own
 * beside other stages into one target warns once on the console — see "One writer per canvas" in
 * the stages guide.
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

  /** The holder of this renderer and the subscriptions at a host that holds it. */
  readonly #hostLink = new StageRendererHostLink(this);

  #width = 0;
  #height = 0;
  #pixelRatio = 1;

  /**
   * The width this renderer carries, as the last {@link resize} that every stage took handed it
   * in; `0` until then. Read-only: `resize()` is the one way to change it.
   */
  get width(): number {
    return this.#width;
  }

  /**
   * The height this renderer carries, as the last {@link resize} that every stage took handed it
   * in; `0` until then. Read-only: `resize()` is the one way to change it.
   */
  get height(): number {
    return this.#height;
  }

  /**
   * The pixels of the drawing buffer per unit of {@link width} and {@link height}, as the last
   * {@link resize} handed it in — `Display#pixelRatio` from a host —, `1` until then.
   */
  get pixelRatio(): number {
    return this.#pixelRatio;
  }

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

  /**
   * Whether the own clear of this renderer clears the color buffer of its target while
   * {@link clear} is `true`. Default `true`. With `false` the own clear leaves the color as it is
   * and no longer counts as a clear of the whole target: where the renderer draws into a target
   * nobody else clears — the internal target of the whole-picture mode, the pass target of a
   * renderer nested in a composing one — that target is cleared to transparent black first.
   */
  clearColorBuffer = true;

  /**
   * Whether the own clear of this renderer clears the depth buffer of its target while
   * {@link clear} is `true`. Default `true`. With `false` the own clear no longer counts as a
   * clear of the whole target, with the consequences {@link clearColorBuffer} names.
   */
  clearDepthBuffer = true;

  /**
   * Whether the own clear of this renderer clears the stencil buffer of its target while
   * {@link clear} is `true`. Default `true`. With `false` the own clear leaves the stencil as it
   * is, and still counts as a clear of the whole target where it clears color and depth.
   */
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

  readonly #stages: StageItemRecord[] = [];

  /**
   * Every stage of this renderer, in the order they were added — a read-only view of the live
   * list, its items included; {@link add} and {@link remove} are the only way in and out. The
   * order in which the stages update and draw is {@link orderedStages}: a stage that
   * {@link renderOrder} does not place is in here and not there, and {@link resize} reaches it all
   * the same.
   */
  get stages(): ReadonlyArray<StageItem> {
    return this.#stages;
  }

  // a renamed stage that moves the snapshot moves the pass nodes with it, and can move a stage
  // with a pipeline of its own beside another one
  readonly #order = new StageRenderOrder(() => {
    this.#composition.markOutputDirty();
    this.#draw.pipelineChildrenChanged();
  });

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
    if (this.#order.set(order)) {
      this.#composition.markOutputDirty();
      this.#draw.pipelineChildrenChanged();
      this.#order.warnAboutSharedNames(
        this.#stages,
        this.#stages.map((item) => item.stage.name),
      );
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
    return this.#order.value;
  }

  /**
   * The entries of {@link renderOrder}, split at the commas, trimmed, empty ones left out. A
   * copy: writing into it changes nothing.
   */
  get renderOrderArray(): string[] {
    return this.#order.entries().slice();
  }

  /**
   * The host or the `StageRenderer` that drives this renderer, `undefined` for none.
   *
   * Assigning a `StageRenderer` goes through its {@link add}, and everything `add()` says holds
   * here, the refusal of a renderer that this renderer holds included: the size comes first, so a
   * stage of this renderer that refuses it makes the assignment throw that error and leaves this
   * renderer with the holder it had. A disposed `StageRenderer` and a host whose `isDisposed` is
   * `true` are refused with an error naming the call and the state, before this renderer leaves
   * its holder. Assigning a host takes this renderer out of the renderer or the host that held it
   * and wires it into the frame loop of the new one; assigning `undefined` lets go of the holder.
   * On a disposed renderer the assignment does nothing.
   *
   * A listener that throws does not cut the assignment short — one of `OnRemoveFromParent`
   * here or of `OnStageRemoved` at a previous `StageRenderer` while this renderer leaves its
   * holder, one of `OnAddToParent` as it joins a host: every listener hears its event, the
   * renderer leaves its holder and joins the new one, and the errors reach the caller
   * afterwards — one unchanged, several as an `AggregateError`. An unsubscribe of the host this
   * renderer leaves that throws is taken the same way: the renderer gives up its other
   * subscription there all the same, and the error joins those of the listeners. A listener that
   * disposes this renderer or gives it another holder while it leaves its holder ends the
   * assignment there. For a `StageRenderer` assigned here, {@link add} says the same.
   *
   * A host that hands its current size to a new subscriber — a `Display` does — gives it to this
   * renderer once the renderer has joined, before `OnAddToParent`: a stage that refuses it makes the
   * assignment throw that error after the join, together with the errors of the listeners. The
   * renderer stays joined and keeps the size it had, see {@link resize}, and the next resize of the
   * host asks the stage again. A listener of that resize that disposes this renderer or gives it
   * another holder ends the join there: no `OnAddToParent` goes out for the host, while the
   * `OnRemoveFromParent` of leaving it does.
   *
   * A host whose `onResize()` or `onRenderFrame()` throws as this renderer joins it
   * holds nothing of it: the renderer gives back the subscription the host had handed
   * out and joins no holder — `parent` answers `undefined`, and `OnAddToParent` does
   * not go out. The error of the host joins those of the move out, and so does that of an
   * unsubscribe that throws while the renderer gives back.
   */
  get parent(): StageRendererParentType | undefined {
    return this.#hostLink.holder;
  }

  set parent(parent: StageRendererParentType | undefined) {
    if (this.#disposed) return;
    if (this.#hostLink.holder === parent) return;

    // a disposed holder never drives this renderer again: taken, the renderer would look attached
    // and never draw
    if (parent?.isDisposed === true) {
      throw new Error(
        parent instanceof StageRenderer
          ? `StageRenderer#parent cannot take the renderer ${describeValue(parent.name)}: that renderer has been disposed`
          : 'StageRenderer#parent cannot take the host: that host has been disposed',
      );
    }

    if (parent instanceof StageRenderer) {
      // add() moves this renderer: the size first, then out of its previous holder, then in
      parent.add(this);
      return;
    }

    const errors: unknown[] = [];
    this.#removeFromParent(errors);
    // a listener of the move out can have disposed this renderer or given it another holder: the
    // move ends here then
    if (!this.#disposed && this.#hostLink.holder === undefined && parent) {
      if (this.#hostLink.joinHost(parent, errors)) {
        // a listener of the size the host handed in can have disposed this renderer or given it
        // another holder: the join ends there, and OnAddToParent is that holder's to send
        if (!this.#disposed && this.#hostLink.holder === parent) {
          try {
            emitStrict(this, OnAddToParent);
          } catch (error) {
            errors.push(error);
          }
        }
      }
    }
    throwCollected(
      errors,
      'StageRenderer#parent: more than one listener of OnRemoveFromParent, OnStageRemoved and OnAddToParent, subscribe or unsubscribe at a host, or a stage that refused the size of the host threw',
    );
  }

  #removeFromParent(errors: unknown[]): void {
    // leave() clears the holder first, so the recursion between the two halves — this one and the
    // remove() of a renderer that held this one — stops after one pass
    const parent = this.#hostLink.leave(errors);
    if (parent == null) return;

    // every listener hears it, even behind one that throws. The error goes to the caller
    // once its call has run to its end
    try {
      emitStrict(this, OnRemoveFromParent);
    } catch (error) {
      errors.push(error);
    }

    if (parent instanceof StageRenderer) {
      try {
        parent.remove(this);
      } catch (error) {
        errors.push(error);
      }
    }
  }

  /**
   * @param parent Optional host (e.g. a `Display`) or parent `StageRenderer`.
   * Passing a parent enables the auto-driven frame loop — do not also drive
   * `updateFrame()`/`renderTo()` from your own handler (see class docs).
   * A host that throws as the renderer subscribes makes the constructor throw that
   * error and keeps no subscription of the renderer, see {@link parent}. A parent that has
   * been disposed makes the constructor throw an error naming the state.
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
   * While a stage refuses the size, this renderer answers with the size it carried before the call,
   * and the {@link StageItem} of that stage keeps the size it carried — a stage that took the new
   * size keeps it, item and all. The very same call therefore goes through again as soon as the
   * refusing stage fits, and reaches exactly the stages that do not have the size yet. A call is
   * carried out as long as one stage still owes the size this renderer answers with, so the size
   * this renderer fell back to reaches the stages that moved past it. A stage counts as refusing
   * whenever its `resize()` throws — a {@link Stage2D} also throws once it has taken the size, when
   * a listener of its camera change or resize threw.
   *
   * `errors` of the `AggregateError` stands in the order in which the stages were added, the
   * error of a render target first.
   *
   * Width and height must be finite numbers: `NaN` and an infinite value are refused with a
   * `RangeError` that names the call, before anything changes.
   *
   * `pixelRatio` is the pixels of the drawing buffer per unit of width and height —
   * `Display#pixelRatio`, which a host hands in with its resize —, and reaches every stage with
   * the size; a change of the ratio alone reaches them as well. One that is left out, or that is
   * not a finite number above 0, counts as `1`.
   *
   * The call goes through {@link stages} as they stood when it began: a stage that `add()` or
   * `remove()` brings in or takes out during the call is reached from the next call on, see
   * {@link orderedStages}.
   */
  resize(width: number, height: number, pixelRatio = 1): void {
    assertFinite(width, 'StageRenderer#resize()', 'width');
    assertFinite(height, 'StageRenderer#resize()', 'height');

    const ratio = isPositiveFinite(pixelRatio) ? pixelRatio : 1;

    // the stage items are the record of which size each stage carries: while one of them still
    // owes the size this renderer answers with, the call has work to do — a stage that took a
    // size the renderer gave up again is reached by no other call
    if (
      this.width === width &&
      this.height === height &&
      this.pixelRatio === ratio &&
      this.#stages.every((item) => item.width === width && item.height === height && item.pixelRatio === ratio)
    ) {
      return;
    }

    const prevWidth = this.width;
    const prevHeight = this.height;
    const prevPixelRatio = this.pixelRatio;

    this.#width = width;
    this.#height = height;
    this.#pixelRatio = ratio;

    const refusedByRenderTarget: unknown[] = [];

    try {
      this.#targets.resize(width, height);
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
        this.resizeStage(stage, width, height, ratio);
      } catch (error) {
        refusedByStages.push(error);
      }
    }

    const refused = [...refusedByRenderTarget, ...refusedByStages];

    if (refused.length > 0) {
      // while a stage refuses the size, this renderer keeps the one it carried into the call, so
      // the very same call goes through again as soon as that stage fits — written through, it
      // would fall out of the size guard above and never reach the stage a second time
      this.#width = prevWidth;
      this.#height = prevHeight;
      this.#pixelRatio = prevPixelRatio;

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
   * Hands width, height and pixel ratio to the stage of the item, unless the item carries them
   * already, and writes them into the item as soon as the stage has taken them. {@link resize}
   * calls it for every stage, {@link add} for the new stage before it is in {@link stages}. An
   * override that throws counts as the stage refusing the size (see `resize()`).
   *
   * The item is read-only to an override: this method is the one place that writes it, so an
   * override that leaves out `super.resizeStage()` leaves the item at the size it had.
   */
  protected resizeStage(stageItem: StageItem, width: number, height: number, pixelRatio: number): void {
    // every item is a record this renderer built in add(); `readonly` keeps callers outside of it
    // from writing, and this is where the renderer writes
    const record: StageItemRecord = stageItem;
    if (record.width !== width || record.height !== height || record.pixelRatio !== pixelRatio) {
      // the size a stage refuses is not the size it shows: the item keeps the one it had, so the
      // next resize() asks that stage again instead of taking it for done
      record.stage.resize(width, height, pixelRatio);
      record.width = width;
      record.height = height;
      record.pixelRatio = pixelRatio;
    }
  }

  /**
   * Calls `updateFrame()` of every stage of {@link orderedStages}, in that order, as the order
   * stood when the call began. On a disposed renderer the list is empty.
   */
  updateFrame(now: number, deltaTime: number, frameNo: number): void {
    // indexed, as every loop over the stages of a frame: an iterator is an allocation per call
    const stages = this.orderedStages;
    for (let i = 0; i < stages.length; i++) {
      stages[i]!.stage.updateFrame(now, deltaTime, frameNo);
    }
  }

  // ---------------------------------------------------------------------------
  // Pipeline / RenderTarget integration — see "Post-processing" in ./README.md
  // ---------------------------------------------------------------------------

  #pipeline?: RenderPipeline;

  /**
   * Optional `THREE.RenderPipeline` running between the stages and the
   * output. For a pipeline that is not a `RootRenderPipeline`, without
   * `buildOutputNode` (the whole-picture mode), the stages render into an
   * internal target whose texture is sampled by the pipeline. With
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
   * A pipeline that composes — with {@link buildOutputNode} set, or a `RootRenderPipeline` — takes
   * the pass node of every stage: while a stage without `asPassNode()`, a `ClearStage` say, is among
   * the {@link stages}, the write throws a `TypeError` that names the stage and the pipeline
   * stays the one it was.
   *
   * In the whole-picture mode, the output node is rebuilt only for a new pipeline or after
   * {@link invalidateOutputNode}; stages, their order and names, their scenes
   * and their cameras leave it standing. A write that leaves this mode
   * releases the GPU memory of the internal target this renderer built for
   * itself; returning to it allocates that memory again on the next frame. A
   * target borrowed from {@link internalTargetPool} is back in the pool after
   * every draw already.
   *
   * A write that leaves the composed mode releases the GPU memory of the
   * pass targets of the nested renderers and of the pass nodes of the
   * composed `Stage2D`s; returning to it allocates that memory again on the
   * next frame.
   */
  get pipeline(): RenderPipeline | undefined {
    return this.#pipeline;
  }

  set pipeline(pipeline: RenderPipeline | undefined) {
    if (this.#disposed) return;
    if (this.#pipeline !== pipeline) {
      if (modeOf(pipeline, this.#buildOutputNode) === 'composed') {
        this.#refuseStageWithoutPassNode('StageRenderer#pipeline cannot take the pipeline');
      }
      const previousMode = this.#renderMode();
      this.#pipeline = pipeline;
      // a pipeline arrives with an outputNode of its own; the next render writes this renderer's into it
      this.#modeInputChanged(previousMode);
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
   * Under a parent in the whole-picture mode — a pipeline without `buildOutputNode` that is not a
   * `RootRenderPipeline` — a child writes linear into its own
   * `outputRenderTarget` as well: the parent switches to linear output for all
   * of its stage draws, whichever target they write to.
   */
  get outputRenderTarget(): RenderTarget | undefined {
    return this.#outputRenderTarget;
  }

  set outputRenderTarget(target: RenderTarget | undefined) {
    this.#outputRenderTarget = target;
    // a nested renderer with a pipeline and without a target of its own covers what its parent drew
    this.#pipelineChildChanged();
  }

  #outputRenderTarget?: RenderTarget;

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
   * output node is rebuilt on the next render. Under a `RootRenderPipeline` the
   * renderer composes either way. While this renderer's `width` or `height` is
   * 0, or while a `Stage2D` it composes has no camera, the composed mode draws
   * nothing. Without a stage it draws its own clear and calls neither this
   * callback nor the pipeline. Assigning it to a renderer whose pipeline
   * samples the internal target releases the GPU memory of that target;
   * clearing it again allocates that memory again on the next frame. A write
   * that leaves the composed mode releases the GPU memory of the pass targets
   * of the nested renderers and of the pass nodes of the composed `Stage2D`s;
   * returning to it allocates that memory again on the next frame.
   *
   * The callback runs again on every rebuild of the output node, and neither this renderer nor
   * the pipeline releases the output node a rebuild replaces: an effect node the callback builds
   * with render targets of its own, such as a `bloom()` of three.js, is the callback's to release.
   * A builder from `createBloomOutputNodeBuilder()` does that itself; once disposed it is refused
   * here with an error naming the call and the state, and the callback set before stays.
   *
   * A disposed renderer answers `undefined` here and takes no new one: like
   * `pipeline`, the write is a silent no-op. A builder over a {@link pipeline} composes the pass
   * node of every stage: while a stage without `asPassNode()`, a `ClearStage` say, is among the
   * {@link stages}, the write throws a `TypeError` that names the stage and the builder stays
   * the one it was. Without a pipeline the builder composes nothing and is taken.
   */
  get buildOutputNode(): StageRendererBuildOutputNode | undefined {
    return this.#buildOutputNode;
  }

  set buildOutputNode(buildOutputNode: StageRendererBuildOutputNode | undefined) {
    if (this.#disposed) return;
    if (this.#buildOutputNode !== buildOutputNode) {
      if ((buildOutputNode as Partial<OutputNodeBuilder> | undefined)?.isDisposed === true) {
        throw new Error('StageRenderer#buildOutputNode cannot take the builder: that builder has been disposed');
      }
      if (modeOf(this.#pipeline, buildOutputNode) === 'composed') {
        this.#refuseStageWithoutPassNode('StageRenderer#buildOutputNode cannot take the builder');
      }
      const previousMode = this.#renderMode();
      this.#buildOutputNode = buildOutputNode;
      this.#modeInputChanged(previousMode);
    }
  }

  /**
   * Optional pool the internal target of the whole-picture mode — a {@link pipeline} without
   * {@link buildOutputNode} that is not a `RootRenderPipeline` — is borrowed
   * from. Renderers of the same size on the same pool that draw one after
   * another draw through one target, see `StageRenderTargetPool`; without a
   * pool the renderer builds its internal target itself.
   *
   * The target is borrowed at the start of the whole-picture draw and given back once
   * the pipeline has run, in the same call, also when a stage or the pipeline
   * throws — no pooled target is held between frames. In the plain mode and
   * the composing modes the pool is not used, and the pass-target a composing
   * parent samples through {@link asPassNode} never comes from it.
   *
   * Assigning a pool releases the internal target this renderer built for
   * itself; clearing it again builds a new one on the next whole-picture frame. A
   * pool assigned during a whole-picture draw of this renderer counts from the next
   * draw on.
   *
   * The pool is handed in and stays the caller's: {@link dispose} leaves it
   * alone. A disposed pool is refused with an error naming the call and the
   * state; a pool disposed while it is set makes the next whole-picture frame throw
   * the error of its `acquire()`. A disposed renderer answers `undefined` here
   * and takes no new pool: like `pipeline`, the write is a silent no-op.
   */
  get internalTargetPool(): StageRenderTargetPool | undefined {
    return this.#targets.pool;
  }

  set internalTargetPool(pool: StageRenderTargetPool | undefined) {
    if (this.#disposed) return;
    if (this.#targets.pool === pool) return;
    if (pool?.isDisposed) {
      throw new Error('StageRenderer#internalTargetPool cannot take the pool: that pool has been disposed');
    }
    this.#targets.pool = pool;
  }

  /**
   * Marks the output node for a rebuild after a write to {@link pipeline} or
   * {@link buildOutputNode}. A write that has left the whole-picture mode releases the GPU memory of the
   * internal target; one that has left the composed mode — for the plain mode or for the
   * whole-picture mode — releases that of the pass target of every nested renderer and of the pass
   * node of every `Stage2D` among the stages, which nothing samples any more.
   */
  #modeInputChanged(previousMode: StageRendererMode): void {
    this.#composition.markOutputDirty();
    // another mode decides whether this renderer warns about its stages at all
    this.#draw.pipelineChildrenChanged();
    const mode = this.#renderMode();
    if (previousMode === 'whole-picture' && mode !== 'whole-picture') this.#targets.releaseInternalTarget();
    if (previousMode === 'composed' && mode !== 'composed') {
      for (const {stage} of this.#stages) this.#releasePassMemoryOf(stage);
    }
    this.#pipelineChildChanged();
  }

  /** A parent that draws this renderer beside other stages checks again for a pipeline of its own. */
  #pipelineChildChanged(): void {
    const parent = this.#hostLink.holder;
    if (parent instanceof StageRenderer) parent.#draw.pipelineChildrenChanged();
  }

  /**
   * Releases the GPU memory of what this renderer composed `stage` through: the pass target of a
   * nested renderer, the pass node of a `Stage2D`. The objects stay, so every `texture()` node on
   * them stays valid; three.js allocates the memory again on the next draw into them.
   */
  #releasePassMemoryOf(stage: IStage): void {
    if (stage instanceof StageRenderer) {
      stage.#targets.releasePassTarget();
    } else if ((stage as Partial<Stage2D>).isStage2D === true) {
      // the flag recognizes a Stage2D without a runtime import of Stage2D, as isStage2DWithoutCamera()
      // does; an object with the flag from another copy of the library, or a double, need not have the method
      (stage as Partial<Stage2D>).releasePassNodeMemory?.();
    }
  }

  /** The two render targets this renderer builds for itself. */
  readonly #targets = new StageRendererTargets();
  /** The plain mode, and what every mode draws with. */
  readonly #draw = new StageRendererDraw(this);
  /** The whole-picture mode, through the internal target of `#targets`. */
  readonly #wholePicture = new StageRendererWholePicture(this, this.#draw, this.#targets);
  /** The composed mode, from the pass node of every stage. */
  readonly #composition = new StageRendererComposition(this, this.#draw);

  static {
    StageRendererInternals.setPassTargetScale = (renderer, scale) => {
      renderer.#targets.scale = scale;
    };
    StageRendererDrawInternals.renderStage = (owner, stageItem, renderer) => owner.renderStage(stageItem, renderer);
    StageRendererDrawInternals.shouldRenderPass = (owner, child) => owner.shouldRenderPass(child);
    StageRendererDrawInternals.renderToCurrentTarget = (child, renderer) => child.renderToCurrentTarget(renderer);
    StageRendererDrawInternals.isStageRenderer = (stage): stage is StageRenderer => stage instanceof StageRenderer;
    StageRendererDrawInternals.renderModeOf = (renderer) => renderer.#renderMode();
    StageRendererDrawInternals.clearsWholeTarget = (renderer) => renderer.#clearsWholeTarget();
    StageRendererDrawInternals.passTargetOf = (child, renderer) => child.#ensurePassTarget(renderer);
    StageRendererDrawInternals.clearColorOf = (owner) => owner.#clearColor;
  }

  /** Invalidate the cached `pipeline.outputNode`; the next render rebuilds it, in either pipeline mode. */
  invalidateOutputNode(): void {
    this.#composition.markOutputDirty();
    this.#wholePicture.forgetOutputNode();
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
      throw new TypeError('StageRenderer#renderTo(): a WebGLRenderer is not supported — render with a WebGPURenderer');
    }

    if (this.outputRenderTarget) {
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(this.outputRenderTarget);
      try {
        this.renderToCurrentTarget(renderer);
      } finally {
        renderer.setRenderTarget(prev);
      }
    } else {
      this.renderToCurrentTarget(renderer);
    }
  }

  /**
   * Render contribution into the renderer's CURRENT target, ignoring
   * `outputRenderTarget`, in the mode `#renderMode()` picks. Both ways a renderer is drawn go
   * through here — its own `renderTo()`, and a parent that composes it into its pass target —, so
   * a subclass that prepares its draw overrides this, not `renderTo()`. A `StageDirector` picks the
   * shape of its stack here.
   */
  protected renderToCurrentTarget(renderer: WebGPURenderer): void {
    // read once: a stage that add() or remove() brings in or takes out while the stages draw is
    // reached from the next call on, and every step of this call sees the same stages
    const stages = this.orderedStages;
    switch (this.#renderMode()) {
      case 'composed':
        this.#composition.draw(renderer, stages);
        break;
      case 'whole-picture':
        this.#wholePicture.draw(renderer, stages, this.#pipeline!);
        break;
      case 'plain':
        this.#draw.drawPlain(renderer, stages);
        break;
    }
  }

  /**
   * The one place that decides how this renderer draws: without a pipeline, the stages straight
   * into the target (plain); a pipeline with `buildOutputNode`, or a `RootRenderPipeline`,
   * composes the pass nodes of the stages (composed); any other pipeline samples the internal
   * target the stages drew into (whole-picture).
   */
  #renderMode(): StageRendererMode {
    return modeOf(this.#pipeline, this.#buildOutputNode);
  }

  /**
   * Refuses, with a `TypeError` that starts with `refusal`, a write that would make this renderer
   * compose while a stage among its stages has no `asPassNode()` to compose.
   */
  #refuseStageWithoutPassNode(refusal: string): void {
    const bare = this.#stages.find((item) => !hasAsPassNode(item.stage));
    if (bare) throw new TypeError(`${refusal}: the stage ${describeValue(bare.stage.name)} ${NO_PASS_NODE}`);
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
      (this.#renderMode() !== 'composed' || canCompose(this, this.orderedStages))
    );
  }

  /**
   * Asks, in the composed mode, whether the nested renderer `child` among the stages is drawn into
   * its pass target in this frame. Answers `true` by default; a subclass that answers `false` keeps
   * the picture the target holds from an earlier frame — neither cleared nor drawn —, and the
   * composition samples that picture. A `StageDirector` freezes a layer this way.
   */
  protected shouldRenderPass(_child: StageRenderer): boolean {
    return true;
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
    const rt = this.#ensurePassTarget(renderer);
    return texture(rt.texture);
  }

  #ensurePassTarget(renderer: WebGPURenderer): RenderTarget {
    if (this.#disposed) {
      // the guard sits here and not in asPassNode(): a parent pre-renders a nested child
      // through this method directly
      throw disposedError('asPassNode()');
    }
    return this.#targets.passTarget(renderer, this.width, this.height);
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
   * the GPU memory of its pass-target as well, and a `Stage2D` that of its pass node; neither
   * is disposed, and three.js allocates that memory again on the next draw into the target —
   * another renderer that still composes the same `Stage2D` allocates it on its next frame.
   *
   * A {@link pipeline}, an {@link outputRenderTarget}, an {@link internalTargetPool}, a builder
   * assigned as {@link buildOutputNode} and every stage were handed in and belong to the caller:
   * none of them is disposed here. Dispose them where they were built.
   *
   * Afterwards `isDisposed` is `true`, `parent`, `pipeline`, `buildOutputNode` and
   * `internalTargetPool` answer `undefined`, `stages` and `orderedStages` are empty, and no
   * host event reaches this renderer any more — `updateFrame()` and `renderTo()` have no stage
   * left to drive, and a parent `StageRenderer` that held this renderer has it no longer among
   * its stages. A write to `parent`, `attach()`, `detach()`, `add()`, `remove()` and a further
   * `dispose()` do nothing.
   *
   * An `OnStageDispose` goes out to every subscriber before this renderer stops listening; no
   * event follows it. Every listener on this renderer goes with it, including the `OnStageAdded`
   * and `OnStageRemoved` subscriptions a caller placed on it, and so do the camera, scene and
   * dispose listeners it placed on its stages (through `remove()`).
   *
   * A listener that throws does not hold up the teardown — one of `OnStageRemoved` or
   * `OnRemoveFromParent` while the renderer lets go of its stages and its holder, or one of
   * `OnStageDispose`: every subscriber hears its event, the renderer is torn down completely,
   * and the errors reach the caller afterwards — one unchanged, several as an `AggregateError`.
   * An unsubscribe of the host that throws joins them and holds up nothing: the renderer gives
   * up its other subscription there all the same.
   *
   * The plain state stays writable, it just no longer drives anything: `resize()` writes
   * `width` and `height` and finds neither a stage nor a `RenderTarget` to pass them on to — a
   * width or a height that is `NaN` or infinite it refuses with its `RangeError` as on a live
   * renderer —, `setClearColor()` and the clear fields still take values, and
   * `invalidateOutputNode()` still marks the output node for a rebuild that never comes.
   * `outputRenderTarget`, `name` and `renderOrder` keep the values the renderer was left with.
   *
   * No `RenderTarget` is built after this call: `renderTo()` and `updateFrame()` do nothing,
   * `asPassNode()` throws an error naming the class and the state, and a write to `pipeline`,
   * `buildOutputNode` or `internalTargetPool` falls through.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    const errors: unknown[] = [];

    // the stages came in through add() and stay the caller's — this renderer only lets go. A stage
    // whose remove() throws is out all the same, and the teardown goes on with the next one
    for (const {stage} of this.#stages.slice()) {
      try {
        this.remove(stage);
      } catch (error) {
        errors.push(error);
      }
    }

    // released before the parent lets go: its remove() releases the pass target of a child it
    // held, and finds none left here — each target is released once
    this.#targets.dispose();
    this.#wholePicture.dispose();
    // the pass nodes belong to the stages, which this renderer has let go of
    this.#composition.forgetPasses();

    // the parent setter refuses a disposed renderer, so the detach runs on the field itself.
    // #removeFromParent() gives up the host subscriptions from StageRendererHostLink#joinHost() and
    // emits OnRemoveFromParent
    this.#removeFromParent(errors);

    this.#pipeline = undefined;
    this.#buildOutputNode = undefined;

    // the listeners are still attached here: this event is what tells them to let go, and no
    // event follows it. Every listener hears it, even behind one that throws, and the error waits
    // until the renderer is torn down
    try {
      emitStrict(this, OnStageDispose, this);
    } catch (error) {
      errors.push(error);
    }
    off(this);

    // the errors stand in the order of the teardown above, which is no promise to the caller
    throwCollected(
      errors,
      'StageRenderer#dispose(): more than one listener of OnStageRemoved, OnRemoveFromParent and OnStageDispose or unsubscribe of the host threw',
    );
  }

  /**
   * Draws the stage of the item into the current target of the renderer; called for every stage
   * of the order in the plain mode and in the whole-picture mode. The composed mode takes
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
    return this.#order.snapshot(this.#stages);
  }

  /**
   * Unsubscribe handle of the listeners on each eventized stage: its camera and scene changes, and
   * its `OnStageDispose`. One handle ends all of them.
   */
  #stageSubscriptions = new Map<IStage, () => void>();

  #getIndex(stage: IStage): number {
    return this.#stages.findIndex((item) => item.stage === stage);
  }

  /**
   * Whether `stage` is one of the stages added to this renderer itself, compared by identity: a
   * stage of a nested `StageRenderer` among them does not count.
   */
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
   * and the state. A `StageRenderer` that is this renderer or holds it — as its
   * `parent` or further up — is refused with an error naming the call and the
   * stage, before the stage gets the size: the two would draw each other
   * without end. So is a stage without `asPassNode()`, a `ClearStage` say,
   * while this renderer composes — {@link buildOutputNode} over a {@link pipeline},
   * or a `RootRenderPipeline`: a `TypeError` that names the stage, thrown before
   * the stage gets the size, joins {@link stages} or is announced.
   *
   * Emits `OnStageAdded`. Warns when {@link renderOrder} lists the stage's
   * `name` and another stage already carries it.
   *
   * A `StageRenderer` added here becomes the child of this renderer, the same
   * as `child.parent = this`: it leaves the host or the renderer that held
   * it, `parent` answers this renderer, and it gets its `OnAddToParent` after
   * `OnStageAdded` went out here. A renderer has one holder.
   *
   * A listener that throws does not cut the call short — one of
   * `OnRemoveFromParent` at a child and of `OnStageRemoved` at its previous
   * `StageRenderer` while the child leaves that holder, one of `OnStageAdded`
   * here or of `OnAddToParent` at the child: every listener hears its event,
   * the stage is added, and the errors reach the caller afterwards — one
   * unchanged, several as an `AggregateError`. An unsubscribe of the host a
   * child leaves that throws is taken the same way: the child gives up its other
   * subscription there all the same, and the error joins those of the listeners.
   * The size stays the exception: a stage that refuses it is not added. A
   * listener that disposes this renderer or the child, or gives the child
   * another holder, while the child leaves its previous one ends the call there:
   * the child is not added. What came before stays: the child has taken the size
   * of this renderer and has left its previous holder.
   *
   * On an eventized stage — every `Stage2D` and every `StageRenderer` — it
   * listens for `OnStageAfterCameraChanged` and `OnStageAfterSceneChanged`
   * and, in the composed mode, rebuilds the output node on the next render
   * for a stage that hands a new pass node after either — a `Stage2D` keeps
   * its node, and nothing is rebuilt for it —, and for `OnStageDispose`, on
   * which it takes the stage out through {@link remove}; `remove()` stops
   * listening. A child `StageRenderer` does not wait for that event: its own
   * `dispose()` takes it out of this renderer first.
   *
   * A stage added during `updateFrame()`, `renderTo()` or `resize()` is
   * reached from the next call on, see {@link orderedStages}.
   */
  add(stage: IStage & IRenderable): this {
    if (this.#disposed) return this;
    if (this.hasStage(stage)) return this;

    // a disposed stage never announces its end again: listed, it would stay in here for good
    if ((stage as {isDisposed?: unknown}).isDisposed === true) {
      throw new Error(`StageRenderer#add() cannot take the stage ${describeValue(stage.name)}: that stage has been disposed`);
    }

    // a renderer that is this one, or holds it further up, would draw itself without end: every
    // resize(), updateFrame() and renderTo() would go round in a circle
    if (stage instanceof StageRenderer) {
      for (
        let holder: StageRendererParentType | undefined = this;
        holder instanceof StageRenderer;
        holder = holder.#hostLink.holder
      ) {
        if (holder === stage) {
          throw new Error(
            holder === this
              ? `StageRenderer#add() cannot take the stage ${describeValue(stage.name)}: that stage is this renderer`
              : `StageRenderer#add() cannot take the stage ${describeValue(stage.name)}: that stage holds this renderer`,
          );
        }
      }
    }

    // every stage of a composing renderer hands in its pass node: refused here, the stage would
    // make every frame throw from the rebuild of the output node
    if (this.#renderMode() === 'composed' && !hasAsPassNode(stage)) {
      throw new TypeError(`StageRenderer#add() cannot take the stage ${describeValue(stage.name)}: that stage ${NO_PASS_NODE}`);
    }

    const item: StageItemRecord = {stage, width: 0, height: 0, pixelRatio: 1};

    // the size first: a stage that refuses it leaves with its error before anything here, on the
    // stage or at the previous holder of a child renderer has changed
    this.resizeStage(item, this.width, this.height, this.pixelRatio);

    const errors: unknown[] = [];

    const child = stage instanceof StageRenderer ? stage : undefined;
    if (child) {
      // a renderer has one holder: a child leaves its host or the renderer that held it
      child.#removeFromParent(errors);
      // a listener of the move out can have disposed either renderer or given the child another
      // holder: this renderer does not take the child in then
      if (this.#disposed || child.#disposed || child.#hostLink.holder !== undefined) {
        throwCollected(errors, ADD_THREW);
        return this;
      }
    }

    this.#stages.push(item);
    this.#order.warnAboutSharedNames(this.#stages, [stage.name]);
    this.#order.invalidate();
    this.#composition.markOutputDirty();
    this.#draw.pipelineChildrenChanged();

    if (isEventized(stage)) {
      // a stage that announces a new camera or scene can hand a new pass node — a Stage2D keeps
      // its node and writes both into it —, and one that announces a new post-process does: the
      // next composing frame asks and rebuilds only for another node. The whole-picture mode does
      // not read the flag: its node samples the internal target and holds neither scene nor camera
      const unsubscribeChanges = on(
        stage,
        [OnStageAfterCameraChanged, OnStageAfterSceneChanged, OnStageAfterPostProcessChanged],
        () => {
          this.#composition.checkPasses();
          // a new post-process of a Stage2D comes through here; a new camera or scene checks once as well
          this.#draw.pipelineChildrenChanged();
        },
      );
      // a disposed stage has no pass node left to give: the renderer lets go of it on the spot
      const unsubscribeDispose = on(stage, OnStageDispose, () => {
        this.remove(stage);
      });
      this.#stageSubscriptions.set(stage, () => {
        unsubscribeChanges();
        unsubscribeDispose();
      });
    }

    if (child) child.#hostLink.joinRenderer(this);

    try {
      emitStrict(this, OnStageAdded, {stage, renderer: this} satisfies StageAddedProps);
    } catch (error) {
      errors.push(error);
    }
    if (child) {
      try {
        emitStrict(child, OnAddToParent);
      } catch (error) {
        errors.push(error);
      }
    }

    throwCollected(errors, ADD_THREW);
    return this;
  }

  /**
   * Remove a stage. Returns `this` for chaining. Emits `OnStageRemoved`.
   *
   * A removed child `StageRenderer` answers `undefined` as its `parent`
   * afterwards and gets its `OnRemoveFromParent`, and releases the GPU memory
   * of its pass-target; a removed `Stage2D` releases the GPU memory of its
   * pass node. Either is released whether or not this renderer composes right
   * now, and another renderer that still composes a shared `Stage2D` allocates
   * it again on its next frame. Stops listening for the stage's camera and scene
   * changes and for its `OnStageDispose`.
   *
   * A stage removed during `updateFrame()`, `renderTo()` or `resize()` is
   * still reached by that call and left out from the next call on, see
   * {@link orderedStages}.
   *
   * A listener that throws does not cut the call short: every listener of
   * `OnStageRemoved` hears it, and so does every listener of
   * `OnRemoveFromParent` at a removed child, which leaves this renderer and
   * releases its pass-target all the same. The errors reach the caller
   * afterwards — one unchanged, several as an `AggregateError`.
   */
  remove(stage: IStage): this {
    const index = this.#getIndex(stage);
    if (index !== -1) {
      this.#stages.splice(index, 1);
      this.#stageSubscriptions.get(stage)?.();
      this.#stageSubscriptions.delete(stage);
      this.#order.invalidate();
      this.#composition.markOutputDirty();
      this.#draw.pipelineChildrenChanged();
      const errors: unknown[] = [];
      try {
        emitStrict(this, OnStageRemoved, {stage, renderer: this} satisfies StageRemovedProps);
      } catch (error) {
        errors.push(error);
      }
      // the pass target belongs to the child, the pass node to the Stage2D, and this renderer, which
      // let go of the stage, samples neither any longer. The objects stay, so every texture() node
      // another parent built from them stays valid; three.js allocates the memory again on the next draw.
      this.#releasePassMemoryOf(stage);
      if (stage instanceof StageRenderer) {
        if (stage.parent === this) {
          // the child still names this renderer as its holder; letting go is a move both
          // sides make, whichever of them started it
          stage.#removeFromParent(errors);
        }
      }
      throwCollected(errors, 'StageRenderer#remove(): more than one listener of OnStageRemoved and OnRemoveFromParent threw');
    }
    return this;
  }
}
