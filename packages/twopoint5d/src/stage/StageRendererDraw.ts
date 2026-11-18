// The plain mode of a `StageRenderer` — its stages straight into the current target — and what
// every mode draws with: the clears, the linear output into a target a pipeline samples, the draw
// of the stages and the warning about a stage that runs a pipeline of its own beside others. The
// renderer keeps its stages, its mode and its targets, and its two other modes draw through
// `StageRendererWholePicture` and `StageRendererComposition`. This module is not in
// `public-api.ts`: only `StageRenderer.ts` and the two classes of those modes reach it.

import {Color, ColorManagement, NoToneMapping, type RenderPipeline, type RenderTarget, type WebGPURenderer} from 'three/webgpu';
import {describeValue} from '../utils/describeValue.js';
import {unfilledInternal} from '../utils/unfilledInternal.js';
import type {IPassProvider} from './IPassProvider.js';
import type {IStage} from './IStage.js';
import {RootRenderPipeline} from './RootRenderPipeline.js';
import type {Stage2D} from './Stage2D.js';
import type {StageItem, StageRenderer, StageRendererBuildOutputNode} from './StageRenderer.js';

// never written: setClearColor() copies it
const TRANSPARENT_BLACK = new Color(0x000000);

export const hasAsPassNode = (s: unknown): s is IPassProvider => typeof (s as IPassProvider)?.asPassNode === 'function';

// a Stage2D that draws through a pipeline of its own, recognized by its `isStage2D` flag, so this
// module needs no runtime import of Stage2D
const isStage2DWithPostProcess = (s: IStage): boolean =>
  (s as Partial<Stage2D>).isStage2D === true && (s as Stage2D).postProcess !== undefined;

/** How a `StageRenderer` draws, see `modeOf()`. @internal */
export type StageRendererMode = 'plain' | 'whole-picture' | 'composed';

export const NO_PASS_NODE =
  'has no asPassNode(), and a pipeline with buildOutputNode or a RootRenderPipeline composes the pass node of every stage';

// a mode is a function of the two inputs alone, so a write can ask for the mode it would bring about
export function modeOf(
  pipeline: RenderPipeline | undefined,
  buildOutputNode: StageRendererBuildOutputNode | undefined,
): StageRendererMode {
  if (pipeline == null) return 'plain';
  return buildOutputNode != null || pipeline instanceof RootRenderPipeline ? 'composed' : 'whole-picture';
}

/**
 * The functions through which the draw classes of the stage module reach the protected hooks of a
 * `StageRenderer` and the private parts of the renderers it draws; they are not part of the public
 * API. `StageRenderer` fills them in when its class is defined.
 * @internal
 */
export const StageRendererDrawInternals: {
  /** Calls the protected `renderStage()` of `owner` for the item. */
  renderStage(owner: StageRenderer, stageItem: StageItem, renderer: WebGPURenderer): void;
  /** Calls the protected `shouldRenderPass()` of `owner` for its nested renderer `child`. */
  shouldRenderPass(owner: StageRenderer, child: StageRenderer): boolean;
  /** Calls the protected `renderToCurrentTarget()` of `child`. */
  renderToCurrentTarget(child: StageRenderer, renderer: WebGPURenderer): void;
  /** Whether `stage` is a `StageRenderer`, asked where a runtime import of the class would close a circle. */
  isStageRenderer(stage: unknown): stage is StageRenderer;
  /** The mode `renderer` draws in. */
  renderModeOf(renderer: StageRenderer): StageRendererMode;
  /** Whether the own clear of `renderer` overwrites color and depth of its target in full in this frame. */
  clearsWholeTarget(renderer: StageRenderer): boolean;
  /** The pass target of `child`, built or brought to its size; throws for a disposed child. */
  passTargetOf(child: StageRenderer, renderer: WebGPURenderer): RenderTarget;
  /** The clear color `owner` holds, as it was written, without the getter a subclass may override. */
  clearColorOf(owner: StageRenderer): Color | null;
} = {
  renderStage: unfilledInternal('StageRendererDrawInternals.renderStage()'),
  shouldRenderPass: unfilledInternal('StageRendererDrawInternals.shouldRenderPass()'),
  renderToCurrentTarget: unfilledInternal('StageRendererDrawInternals.renderToCurrentTarget()'),
  // a type predicate takes no stand-in that answers `never`: this one throws through a predicate of its own
  isStageRenderer: (_stage: unknown): _stage is StageRenderer =>
    unfilledInternal('StageRendererDrawInternals.isStageRenderer()')(),
  renderModeOf: unfilledInternal('StageRendererDrawInternals.renderModeOf()'),
  clearsWholeTarget: unfilledInternal('StageRendererDrawInternals.clearsWholeTarget()'),
  passTargetOf: unfilledInternal('StageRendererDrawInternals.passTargetOf()'),
  clearColorOf: unfilledInternal('StageRendererDrawInternals.clearColorOf()'),
};

/** @internal */
export class StageRendererDraw {
  readonly #owner: StageRenderer;

  #oldClearColor = new Color(0x000000);

  #warnedAboutPipelineChild = false;

  // set by every change that can bring a stage with a pipeline of its own beside another one — a
  // stage that joins or leaves, the render order, a mode of this renderer or of a nested one, a
  // post-process; the next frame of the plain or the whole-picture mode clears it as it checks
  #pipelineChildCheckDue = true;

  #callerToneMapping: WebGPURenderer['toneMapping'] = NoToneMapping;
  #callerOutputColorSpace: WebGPURenderer['outputColorSpace'] = ColorManagement.workingColorSpace;

  constructor(owner: StageRenderer) {
    this.#owner = owner;
  }

  /** Plain mode: clear (if requested), then render stages into the current target. */
  drawPlain(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>): void {
    // a child with a pipeline, or a stage with a post-process, alone is the one writer of the
    // target; beside a second stage its quad covers what the others drew
    this.checkPipelineChildren(stages, true);
    if (this.#owner.clear) this.applyClear(renderer);
    this.drawStages(renderer, stages);
  }

  /** Has the next frame of the plain or the whole-picture mode check the stages again for a pipeline of their own. */
  pipelineChildrenChanged(): void {
    this.#pipelineChildCheckDue = true;
  }

  /**
   * Checks `stages` for a stage that draws through a pipeline of its own, once per change that can
   * bring one in, and warns about the first one, once — see `#warnAboutPipelineChild()`.
   */
  checkPipelineChildren(stages: ReadonlyArray<StageItem>, nestedRenderers: boolean): void {
    if (this.#pipelineChildCheckDue && !this.#warnedAboutPipelineChild) {
      // cleared before the check: a stage a listener brings in while the stages draw is checked next frame
      this.#pipelineChildCheckDue = false;
      if (stages.length > 1) this.#warnAboutPipelineChild(stages, nestedRenderers);
    }
  }

  /**
   * Warns once, for the first stage among `stages` that draws through a pipeline of its own into
   * the target of this renderer: a `Stage2D` with a `postProcess`, and with `nestedRenderers` a
   * nested renderer with a pipeline and without an `outputRenderTarget`. An `outputRenderTarget`
   * of this renderer changes nothing: the quad covers whatever target this renderer draws into.
   */
  #warnAboutPipelineChild(stages: ReadonlyArray<StageItem>, nestedRenderers: boolean): void {
    // indexed, as in canCompose(): this runs in the first frame after a change that can bring such a stage in
    for (let i = 0; i < stages.length; i++) {
      const child = stages[i]!.stage;
      if (
        nestedRenderers &&
        StageRendererDrawInternals.isStageRenderer(child) &&
        StageRendererDrawInternals.renderModeOf(child) !== 'plain' &&
        child.outputRenderTarget == null
      ) {
        this.#warnedAboutPipelineChild = true;
        // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
        console.warn(
          `StageRenderer ${describeValue(this.#owner.name)} has no pipeline and draws the renderer ${describeValue(child.name)}, which runs a pipeline of its own, into one target with other stages: the quad of that pipeline covers every pixel of the target without blending, and what the stages before it drew there is lost. Give the outer renderer the pipeline — a RootRenderPipeline composes every child —, or give ${describeValue(child.name)} an outputRenderTarget of its own.`,
        );
        return;
      }
      if (isStage2DWithPostProcess(child)) {
        this.#warnedAboutPipelineChild = true;
        // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
        console.warn(
          `StageRenderer ${describeValue(this.#owner.name)} draws the stage ${describeValue(child.name)}, which runs a post-process, into one target with other stages: the pipeline of that stage clears the target and covers every pixel of it, and what the stages before it drew there is lost. Compose the stages — a RootRenderPipeline as the pipeline of the renderer does —, or show them as layers of a StageDirector.`,
        );
        return;
      }
    }
  }

  /** Draws the stages into the current target, with renderer.autoClear off while they draw and restored afterwards. */
  drawStages(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>): void {
    const wasPreviouslyAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    try {
      for (let i = 0; i < stages.length; i++) StageRendererDrawInternals.renderStage(this.#owner, stages[i]!, renderer);
    } finally {
      renderer.autoClear = wasPreviouslyAutoClear;
    }
  }

  /**
   * Switches the renderer to linear output until `endLinearOutput()`. three.js'
   * RenderPipeline bakes tone mapping and the encoding to renderer.outputColorSpace into its quad
   * whatever target it draws into, and rebuilds the quad when either value changes: as long as
   * both are linear, a nested pipeline writes linear values into the target this pipeline
   * samples, and the transform applies once, in the outermost pipeline.
   * pipeline.outputColorTransform is no way to get there — the pipeline reads it only when it
   * rebuilds, and the field belongs to the caller. A plain renderer.render() into a RenderTarget
   * writes linear anyway.
   *
   * The values of the caller wait in fields of this renderer, so that no frame allocates
   * anything; a nested renderer holds its own, so a child that draws during the draw of its
   * parent leaves the values of the parent alone.
   */
  beginLinearOutput(renderer: WebGPURenderer): void {
    this.#callerToneMapping = renderer.toneMapping;
    this.#callerOutputColorSpace = renderer.outputColorSpace;
    renderer.toneMapping = NoToneMapping;
    renderer.outputColorSpace = ColorManagement.workingColorSpace;
  }

  /** Gives the renderer back the tone mapping and output color space `beginLinearOutput()` took from it. */
  endLinearOutput(renderer: WebGPURenderer): void {
    renderer.toneMapping = this.#callerToneMapping;
    renderer.outputColorSpace = this.#callerOutputColorSpace;
  }

  /**
   * The own clear of the target the pipeline writes to, unless the pipeline's draw leaves that
   * target as the clear would: three.js clears it first under `renderer.autoClear` — with the
   * buffers of `autoClearColor`, `autoClearDepth` and `autoClearStencil` —, and the quad of the
   * pipeline covers every pixel, color and depth, without blending. Where those flags cover every
   * buffer of the own clear, the clear is left out. On the canvas it would cost a full-screen draw
   * of its own: three.js clears through its frame buffer target and copies that onto the canvas.
   */
  clearBeforePipeline(renderer: WebGPURenderer): void {
    if (!this.#owner.clear) return;
    const clearedByPipeline =
      renderer.autoClear === true &&
      (!this.#owner.clearColorBuffer || renderer.autoClearColor === true) &&
      (!this.#owner.clearDepthBuffer || renderer.autoClearDepth === true) &&
      (!this.#owner.clearStencilBuffer || renderer.autoClearStencil === true);
    if (!clearedByPipeline) this.applyClear(renderer);
  }

  /**
   * Clears color and depth of the current target to transparent black. The color is set
   * along with the alpha: with `renderer.alpha === false` a WebGPU clear keeps the RGB of the
   * clear color at alpha 0, and an additive composition would add that tint once per child.
   */
  clearToTransparentBlack(renderer: WebGPURenderer): void {
    const oldClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.#oldClearColor);
    renderer.setClearColor(TRANSPARENT_BLACK, 0);
    renderer.clear(true, true, false);
    renderer.setClearColor(this.#oldClearColor, oldClearAlpha);
  }

  applyClear(renderer: WebGPURenderer): void {
    const clearColor = StageRendererDrawInternals.clearColorOf(this.#owner);
    const oldClearAlpha = renderer.getClearAlpha();
    let colorWasOverridden = false;
    if (clearColor != null) {
      renderer.getClearColor(this.#oldClearColor);
      renderer.setClearColor(clearColor, this.#owner.clearAlpha);
      colorWasOverridden = true;
    } else {
      renderer.setClearAlpha(this.#owner.clearAlpha);
    }
    renderer.clear(this.#owner.clearColorBuffer, this.#owner.clearDepthBuffer, this.#owner.clearStencilBuffer);
    if (colorWasOverridden) {
      renderer.setClearColor(this.#oldClearColor, oldClearAlpha);
    } else {
      renderer.setClearAlpha(oldClearAlpha);
    }
  }
}
