// The whole-picture mode of a `StageRenderer` — a pipeline without `buildOutputNode` that is not a
// `RootRenderPipeline` —: the stages draw into the internal target of `StageRendererTargets`, and
// the pipeline samples it as `texture()`. This module is not in `public-api.ts`: only
// `StageRenderer.ts` reaches it.

import {texture} from 'three/tsl';
import type {Node, RenderPipeline, RenderTarget, Texture, WebGPURenderer} from 'three/webgpu';
import type {StageItem, StageRenderer} from './StageRenderer.js';
import {type StageRendererDraw, StageRendererDrawInternals} from './StageRendererDraw.js';
import type {StageRendererTargets} from './StageRendererTargets.js';

/** @internal */
export class StageRendererWholePicture {
  readonly #owner: StageRenderer;
  readonly #draw: StageRendererDraw;
  readonly #targets: StageRendererTargets;

  /** The `texture()` node the whole-picture mode gives its pipeline as `outputNode`, and the texture it samples. */
  #internalOutputNode?: Node;
  #internalOutputTexture?: Texture;

  constructor(owner: StageRenderer, draw: StageRendererDraw, targets: StageRendererTargets) {
    this.#owner = owner;
    this.#draw = draw;
    this.#targets = targets;
  }

  /**
   * The whole-picture mode: borrow the internal target — from `internalTargetPool` if
   * set, otherwise the renderer's own —, render the stages into it, run the
   * pipeline sampling that target as `texture()`, and give it back, also when
   * a stage or the pipeline throws. The internal target is cleared in full to
   * transparent black every frame before the user's `clear` applies; the
   * stages draw into it with linear output. The user's `clear` additionally
   * clears the final output target before the pipeline writes, unless the
   * pipeline's draw clears it anyway (see `StageRendererDraw#clearBeforePipeline()`), and the
   * pipeline applies the output transform of the caller.
   */
  draw(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>, pipeline: RenderPipeline): void {
    // the stages share the internal target: a stage with a post-process clears what the stages
    // before it drew there, as under a renderer without a pipeline
    this.#draw.checkPipelineChildren(stages, false);
    // borrowed before the try: an acquire() that throws has lent nothing
    const rt = this.#targets.acquireInternalTarget(renderer, this.#owner.width, this.#owner.height);
    try {
      this.#drawIntoInternalTarget(renderer, rt, stages);
      this.#wireInternalOutputNode(pipeline, rt);
      this.#draw.clearBeforePipeline(renderer);
      pipeline.render();
    } finally {
      this.#targets.returnInternalTarget();
    }
  }

  /** Forgets the `texture()` node: the next draw builds it anew and hands it to the pipeline. */
  forgetOutputNode(): void {
    this.#internalOutputNode = undefined;
  }

  /** Lets go of the `texture()` node and of the texture it samples. */
  dispose(): void {
    this.#internalOutputNode = undefined;
    this.#internalOutputTexture = undefined;
  }

  /**
   * Draws the stages into the internal target with linear output, after the clear it gets every
   * frame, and gives the renderer back the target of the caller afterwards.
   */
  #drawIntoInternalTarget(renderer: WebGPURenderer, rt: RenderTarget, stages: ReadonlyArray<StageItem>): void {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    this.#draw.beginLinearOutput(renderer);
    try {
      this.#clearForInternalRT(renderer);
      this.#draw.drawStages(renderer, stages);
    } finally {
      this.#draw.endLinearOutput(renderer);
      renderer.setRenderTarget(prev);
    }
  }

  /** Gives the pipeline the `texture()` node that samples the internal target as its `outputNode`. */
  #wireInternalOutputNode(pipeline: RenderPipeline, rt: RenderTarget): void {
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
  }

  /**
   * Nobody else clears the internal target — neither the renderer's own nor one borrowed from a
   * pool, which still holds what its previous borrower drew. It is cleared in full to
   * transparent black every frame, color and depth, so that neither the clear color of the
   * renderer nor a rest of the previous frame stays in it; the own `clear` then applies as it
   * does for a nested child, and an own clear that covers color and depth replaces the black one.
   */
  #clearForInternalRT(renderer: WebGPURenderer): void {
    if (!StageRendererDrawInternals.clearsWholeTarget(this.#owner)) this.#draw.clearToTransparentBlack(renderer);
    if (this.#owner.clear) this.#draw.applyClear(renderer);
  }
}
