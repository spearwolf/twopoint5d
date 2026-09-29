// The two render targets a `StageRenderer` builds for itself — the internal target of Mode C and
// the pass target a composing parent draws it into — and the pixel ratio that sizes both. This
// module is not in `public-api.ts`: only `StageRenderer` reaches it.

import {RenderTarget, type WebGPURenderer} from 'three/webgpu';

export class StageRendererTargets {
  /**
   * Pixel ratio of the renderer that last built or measured a `RenderTarget` here. `resize()`
   * has no renderer to ask; it sizes the targets from this value, and the next internalTarget()
   * or passTarget() corrects them if the renderer has moved to a different ratio in the meantime.
   */
  #pixelRatio = 1;

  /** Internal RT used in Mode C (a pipeline without buildOutputNode that is not a RootRenderPipeline). */
  #internal?: RenderTarget;
  /** Internal RT used when a parent calls `asPassNode()` on the renderer. */
  #pass?: RenderTarget;

  /** Answers the internal target of Mode C, built or brought to the size `width`×`height` asks for. */
  internalTarget(renderer: WebGPURenderer, width: number, height: number): RenderTarget {
    return (this.#internal = this.#ensure(this.#internal, renderer, width, height));
  }

  /** Answers the pass target a composing parent draws into, built or brought to the size `width`×`height` asks for. */
  passTarget(renderer: WebGPURenderer, width: number, height: number): RenderTarget {
    return (this.#pass = this.#ensure(this.#pass, renderer, width, height));
  }

  /**
   * Releases the GPU memory of the internal target. The object stays, so every `texture()` node
   * on it stays valid; three.js allocates the memory again on the next draw into it.
   */
  releaseInternalTarget(): void {
    this.#internal?.dispose();
  }

  /**
   * Releases the GPU memory of the pass target. The object stays, so every `texture()` node on
   * it stays valid; three.js allocates the memory again on the next draw into it.
   */
  releasePassTarget(): void {
    this.#pass?.dispose();
  }

  /**
   * Brings the internal target, then the pass target, to the size `width`×`height` asks for,
   * each only if it has been built. A target that refuses the size leaves the one after it as
   * it was.
   */
  resize(width: number, height: number): void {
    if (this.#internal) this.#resize(this.#internal, width, height);
    if (this.#pass) this.#resize(this.#pass, width, height);
  }

  /** Disposes the internal target, then the pass target, and forgets both; the next call builds new ones. */
  dispose(): void {
    this.#internal?.dispose();
    this.#internal = undefined;
    this.#pass?.dispose();
    this.#pass = undefined;
  }

  /** Width or height a `RenderTarget` has to have, in device pixels, for the logical `size`. */
  #deviceSize(size: number): number {
    return Math.max(1, Math.floor(size * this.#pixelRatio));
  }

  #resize(rt: RenderTarget, width: number, height: number): void {
    const w = this.#deviceSize(width);
    const h = this.#deviceSize(height);
    if (rt.width !== w || rt.height !== h) {
      rt.setSize(w, h);
    }
  }

  #ensure(rt: RenderTarget | undefined, renderer: WebGPURenderer, width: number, height: number): RenderTarget {
    this.#pixelRatio = renderer.getPixelRatio?.() ?? 1;
    // the values three.js' PassNode gives the pass targets of the composed mode. The type stands
    // per renderer from its constructor on; a changed sample count is taken into the target by
    // three.js on the next draw, and target and texture stay the same objects — every texture()
    // node on them stays valid.
    if (!rt) {
      return new RenderTarget(this.#deviceSize(width), this.#deviceSize(height), {
        type: renderer.getOutputBufferType(),
        samples: renderer.samples,
      });
    }
    if (rt.samples !== renderer.samples) rt.samples = renderer.samples;
    this.#resize(rt, width, height);
    return rt;
  }
}
