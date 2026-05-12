import {type Node, RenderPipeline, type WebGPURenderer} from 'three/webgpu';

/**
 * `RenderPipeline` subclass that combines every stage's pass node
 * additively as the pipeline's output. Assign as `StageRenderer.pipeline`
 * to skip the `buildOutputNode` boilerplate.
 *
 * ```ts
 * root.pipeline = new RootRenderPipeline(display.renderer);
 * // → pipeline.outputNode = pass0.add(pass1).add(pass2)…
 * ```
 *
 * The renderer still honors a user-set `buildOutputNode` if you want to
 * override the additive default.
 */
export class RootRenderPipeline extends RenderPipeline {
  constructor(renderer: WebGPURenderer) {
    super(renderer);
  }

  /**
   * Additively combine `passes` (`p0.add(p1).add(p2)…`) into a single
   * output node. Throws when `passes` is empty.
   */
  static buildOutputNode(passes: Node[]): Node {
    if (passes.length === 0) {
      throw new Error('RootRenderPipeline.buildOutputNode: no passes to compose');
    }
    // TSL nodes expose arithmetic operators via the ShaderNodeProxy at
    // runtime; the static `Node` type does not surface `.add()`.
    let out = passes[0] as Node & {add(other: Node): Node};
    for (let i = 1; i < passes.length; i++) {
      out = out.add(passes[i]) as typeof out;
    }
    return out;
  }
}
