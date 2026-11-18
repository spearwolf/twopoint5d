// The composed mode of a `StageRenderer` — a pipeline with `buildOutputNode` or a
// `RootRenderPipeline` —: the nested renderers draw into their pass targets first, then the
// pipeline runs the output node built from the pass node of every stage. This module is not in
// `public-api.ts`: only `StageRenderer.ts` reaches it.

import type {Node, WebGPURenderer} from 'three/webgpu';
import {describeValue} from '../utils/describeValue.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import type {IStage} from './IStage.js';
import {RootRenderPipeline} from './RootRenderPipeline.js';
import type {Stage2D} from './Stage2D.js';
import type {StageItem, StageRenderer} from './StageRenderer.js';
import {hasAsPassNode, NO_PASS_NODE, type StageRendererDraw, StageRendererDrawInternals} from './StageRendererDraw.js';

// recognized by its `isStage2D` flag, so this module needs no runtime import of Stage2D
const isStage2DWithoutCamera = (s: IStage): boolean =>
  (s as Partial<Stage2D>).isStage2D === true && (s as Stage2D).camera == null;

/**
 * The stages take their camera from the first resize() with an area whose specs give a view, and
 * a Stage2D has no pass node to give before that: while `owner` has no area, or a Stage2D
 * of the composition has no camera, there is nothing to compose. A user-defined buildOutputNode
 * expects one pass per stage, so no stage is left out, and the output node stays dirty until the
 * first frame in which every Stage2D has a camera. An empty list passes:
 * StageRendererComposition#draw() then draws the own clear alone.
 *
 * Reads the size of `owner` itself: a fractional width handed across one more call of the frame
 * would be boxed by V8 wherever that call is not inlined.
 * @internal
 */
export function canCompose(owner: StageRenderer, stages: ReadonlyArray<StageItem>): boolean {
  if (!isPositiveFinite(owner.width) || !isPositiveFinite(owner.height)) return false;
  // indexed: an iterator over the frozen array of a StageDirector is allocated on every frame
  for (let i = 0; i < stages.length; i++) {
    if (isStage2DWithoutCamera(stages[i]!.stage)) return false;
  }
  return true;
}

/** @internal */
export class StageRendererComposition {
  readonly #owner: StageRenderer;
  readonly #draw: StageRendererDraw;

  /**
   * Marks `pipeline.outputNode` of the composed mode as needing a rebuild: the stages, their order
   * or names, the pipeline, `buildOutputNode` changed, or a stage handed a new pass node after a
   * change of its camera or scene (see `#composedPassesChanged()`). Only the composed mode reads
   * it; the whole-picture mode keeps its own node, see `StageRendererWholePicture#wireInternalOutputNode()`.
   */
  #outputDirty = true;

  /**
   * Set when a stage announced a new camera or scene: the next composing frame asks the stages
   * for their pass nodes and compares them with `#composedPasses`.
   */
  #passesToCheck = false;

  /** The pass nodes the output node of the composed mode was last built from, one per stage. */
  #composedPasses: Node[] = [];

  constructor(owner: StageRenderer, draw: StageRendererDraw) {
    this.#owner = owner;
    this.#draw = draw;
  }

  /**
   * The composed mode, nested renderers with pipelines of their own included: for each stage, get
   * its pass node; pre-render nested `StageRenderer` children into their pass-targets first, with
   * linear output (see `StageRendererDraw#beginLinearOutput()`). Then run the pipeline with
   * `buildOutputNode(passes)` as `outputNode`; it applies the output transform of the caller.
   * Without a stage it draws its own clear and neither builds an output node nor runs the pipeline.
   */
  draw(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>): void {
    if (!canCompose(this.#owner, stages)) return;
    // without a stage there is no pass to compose: the own clear is all this renderer draws, and
    // the output node waits for the first stage that joins
    if (stages.length === 0) {
      if (this.#owner.clear) this.#draw.applyClear(renderer);
      return;
    }
    this.#prerenderNestedRenderers(renderer, stages);
    if (!this.#outputDirty && this.#passesToCheck) {
      // the flag goes once every stage has answered: a stage that throws from asPassNode() — a
      // post-process whose build() fails — is asked again by the next frame
      const changed = this.#composedPassesChanged(renderer, stages);
      this.#passesToCheck = false;
      if (changed) this.#outputDirty = true;
    }
    if (this.#outputDirty) this.#rebuildComposedOutputNode(renderer, stages);
    this.#draw.clearBeforePipeline(renderer);
    this.#owner.pipeline!.render();
  }

  /** Has the next composing frame build the output node anew. */
  markOutputDirty(): void {
    this.#outputDirty = true;
  }

  /** Has the next composing frame ask the stages whether one hands a pass node other than the one composed. */
  checkPasses(): void {
    this.#passesToCheck = true;
  }

  /** Lets go of the pass nodes the output node was last built from. */
  forgetPasses(): void {
    this.#composedPasses = [];
  }

  /**
   * Renders every nested `StageRenderer` among the stages into its pass target, with linear output —
   * every one for which the `shouldRenderPass()` of the renderer answers `true`.
   */
  #prerenderNestedRenderers(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>): void {
    this.#draw.beginLinearOutput(renderer);
    try {
      // indexed, as in canCompose()
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i]!.stage;
        if (StageRendererDrawInternals.isStageRenderer(stage) && StageRendererDrawInternals.shouldRenderPass(this.#owner, stage))
          this.#prerenderChild(renderer, stage);
      }
    } finally {
      this.#draw.endLinearOutput(renderer);
    }
  }

  /** Clears the pass target of the child where the child does not, and renders the child into it. */
  #prerenderChild(renderer: WebGPURenderer, child: StageRenderer): void {
    const childRT = StageRendererDrawInternals.passTargetOf(child, renderer);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(childRT);
    try {
      // the pass target of the child belongs to nobody else who would clear it: a child
      // without clear draws its stages straight into it, and a child with clear but
      // clearColorBuffer/clearDepthBuffer off clears only part of it — the previous frame
      // would stay underneath. A child whose own clear covers color and depth and reaches
      // the target in this frame overwrites it itself.
      if (!StageRendererDrawInternals.clearsWholeTarget(child)) this.#draw.clearToTransparentBlack(renderer);
      StageRendererDrawInternals.renderToCurrentTarget(child, renderer);
    } finally {
      renderer.setRenderTarget(prev);
    }
  }

  /**
   * Builds `pipeline.outputNode` anew from the pass node of every stage. A composition that answers
   * the node the pipeline has already leaves the pipeline as it is: three.js builds its shader again
   * for every `needsUpdate`, and a composer that keeps its graph — a `StageDirector` does — costs no
   * shader build where nothing in the graph changed.
   */
  #rebuildComposedOutputNode(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>): void {
    const passes = stages.map((s) => this.#getStagePass(s, renderer));
    // a copy of its own, taken once per rebuild: a builder may keep the array it is handed and
    // reorder or shorten it, and #composedPassesChanged() compares with what was composed
    const composed = passes.slice();
    const compose = this.#owner.buildOutputNode ?? RootRenderPipeline.buildOutputNode;
    const pipeline = this.#owner.pipeline!;
    const outputNode = compose(passes);
    if (pipeline.outputNode !== outputNode) {
      pipeline.outputNode = outputNode;
      pipeline.needsUpdate = true;
    }
    this.#composedPasses = composed;
    this.#outputDirty = false;
    this.#passesToCheck = false;
  }

  /**
   * Whether a stage hands a pass node other than the one the output node was built from. A nested
   * `StageRenderer` is left out: its `asPassNode()` builds a new `texture()` node over the same pass
   * target on every call, and it announces neither a camera nor a scene. Indexed and without a
   * closure, as every loop of a frame: a `Stage2D` hands its node, and nothing is allocated.
   */
  #composedPassesChanged(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>): boolean {
    const composed = this.#composedPasses;
    if (stages.length !== composed.length) return true;
    for (let i = 0; i < stages.length; i++) {
      const item = stages[i]!;
      if (StageRendererDrawInternals.isStageRenderer(item.stage)) continue;
      if (this.#getStagePass(item, renderer) !== composed[i]) return true;
    }
    return false;
  }

  #getStagePass(stageItem: StageItem, renderer: WebGPURenderer): Node {
    const stage = stageItem.stage;
    if (!hasAsPassNode(stage)) {
      throw new TypeError(
        `StageRenderer#renderTo() cannot compose the stage ${describeValue(stage.name)}: that stage ${NO_PASS_NODE}`,
      );
    }
    return stage.asPassNode(renderer);
  }
}
