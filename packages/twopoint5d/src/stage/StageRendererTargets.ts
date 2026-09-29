// The two render targets of a `StageRenderer` — the internal target of Mode C and the pass target
// a composing parent draws it into — and the pixel ratio that sizes both. The internal target is
// either built here or, with a pool set, borrowed from that pool for the length of one draw; what
// this module releases is only what it built itself. This module is not in `public-api.ts`: only
// `StageRenderer` reaches it.

import {RenderTarget, type WebGPURenderer} from 'three/webgpu';
import type {StageRenderTargetPool} from './StageRenderTargetPool.js';

export class StageRendererTargets {
  /**
   * Pixel ratio of the renderer that last built or measured a `RenderTarget` here. `resize()`
   * has no renderer to ask; it sizes the targets from this value, and the next acquireInternalTarget()
   * or passTarget() corrects them if the renderer has moved to a different ratio in the meantime.
   */
  #pixelRatio = 1;

  /**
   * The internal target of Mode C (a pipeline without buildOutputNode that is not a
   * RootRenderPipeline), built here. Without a pool only; with one, Mode C borrows its target.
   */
  #internal?: RenderTarget;
  /** The pass target a composing parent draws this renderer into and samples through `asPassNode()`. */
  #pass?: RenderTarget;

  /** The pool the internal target of Mode C is borrowed from; `undefined` for a target of its own. */
  #pool?: StageRenderTargetPool;
  /** The target of the Mode C draw that is running — the own one or a borrowed one — until it is returned. */
  #lent?: RenderTarget;
  /** The pool `#lent` came from; `undefined` while `#lent` is the own target. */
  #lentFrom?: StageRenderTargetPool;

  get pool(): StageRenderTargetPool | undefined {
    return this.#pool;
  }

  /** Stores the pool; with a pool, the internal target built here is released — Mode C borrows from then on. */
  set pool(pool: StageRenderTargetPool | undefined) {
    this.#pool = pool;
    if (pool) this.#dropOwnInternalTarget();
  }

  /**
   * Answers the internal target for one Mode C draw: borrowed from the pool if one is set, sized in
   * device pixels, otherwise the own one, built or brought to the size `width`×`height` asks for.
   * Every call is paired with one {@link returnInternalTarget} once the draw is over.
   */
  acquireInternalTarget(renderer: WebGPURenderer, width: number, height: number): RenderTarget {
    const pool = this.#pool;
    let rt: RenderTarget;
    if (pool) {
      this.#pixelRatio = renderer.getPixelRatio?.() ?? 1;
      rt = pool.acquire(this.#deviceSize(width), this.#deviceSize(height), renderer.getOutputBufferType(), renderer.samples);
    } else {
      rt = this.#internal = this.#ensure(this.#internal, renderer, width, height);
    }
    this.#lent = rt;
    this.#lentFrom = pool;
    return rt;
  }

  /**
   * Ends the Mode C draw {@link acquireInternalTarget} began: a borrowed target goes back to the
   * pool it came from, even if another pool or none is set by now; an own target that was taken
   * away during the draw is released now that nothing draws into it any more.
   */
  returnInternalTarget(): void {
    const rt = this.#lent;
    const lentFrom = this.#lentFrom;
    // cleared first: a release() that throws leaves no draw behind that seems to be running
    this.#lent = undefined;
    this.#lentFrom = undefined;
    if (!rt) return;
    if (lentFrom) {
      lentFrom.release(rt);
    } else if (rt !== this.#internal) {
      rt.dispose();
    }
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

  /**
   * Disposes the own internal target, then the pass target, forgets both and lets go of the pool,
   * which stays the caller's and is not disposed; the next call builds new targets.
   */
  dispose(): void {
    this.#dropOwnInternalTarget();
    this.#pass?.dispose();
    this.#pass = undefined;
    this.#pool = undefined;
  }

  /**
   * Forgets the own internal target and releases it — unless a draw is running in it: released in
   * the middle of that draw, three.js would allocate it again on the next draw into it, and nobody
   * would release that. {@link returnInternalTarget} releases it once the draw is over.
   */
  #dropOwnInternalTarget(): void {
    const own = this.#internal;
    this.#internal = undefined;
    if (own && own !== this.#lent) own.dispose();
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
