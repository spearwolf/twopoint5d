// The two render targets of a `StageRenderer` — the internal target of the whole-picture mode and
// the pass target a composing parent draws it into —, the pixel ratio that sizes both and the scale
// that shrinks the pass target alone. The
// internal target is either built here or, with a pool set, borrowed from that pool for the length
// of one draw; what this module releases is only what it built itself. This module is not in
// `public-api.ts`: only `StageRenderer` reaches it, and through `StageRendererInternals` the other
// classes of the stage module.

import {RenderTarget, type WebGPURenderer} from 'three/webgpu';
import {isFiniteNumber} from '../utils/isFiniteNumber.js';
import type {StageRenderer} from './StageRenderer.js';
import type {StageRenderTargetPool} from './StageRenderTargetPool.js';

/**
 * The functions through which the stage module reaches the targets of a `StageRenderer`; they are
 * not part of the public API. `StageRenderer` fills them in when its class is defined.
 * @internal
 */
export const StageRendererInternals = {} as {
  /** Sets the {@link StageRendererTargets.scale} of the pass target of `renderer`; the caller checks the value. */
  setPassTargetScale(renderer: StageRenderer, scale: number): void;
};

export class StageRendererTargets {
  /**
   * Pixel ratio of the renderer that last built or measured a `RenderTarget` here. `resize()`
   * has no renderer to ask; it sizes the targets from this value, and the next acquireInternalTarget()
   * or passTarget() corrects them if the renderer has moved to a different ratio in the meantime.
   */
  #pixelRatio = 1;

  /**
   * The internal target of the whole-picture mode (a pipeline without buildOutputNode that is not a
   * RootRenderPipeline), built here. Without a pool only; with one, that mode borrows its target.
   */
  #internal?: RenderTarget;
  /** The pass target a composing parent draws this renderer into and samples through `asPassNode()`. */
  #pass?: RenderTarget;
  /** The logical size `#pass` was last brought to: a change of {@link scale} sizes it again from there. */
  #passWidth = 0;
  #passHeight = 0;
  #scale = 1;

  /** The pool the internal target of the whole-picture mode is borrowed from; `undefined` for a target of its own. */
  #pool?: StageRenderTargetPool;
  /** The target of the whole-picture draw that is running — the own one or a borrowed one — until it is returned. */
  #lent?: RenderTarget;
  /** The pool `#lent` came from; `undefined` while `#lent` is the own target. */
  #lentFrom?: StageRenderTargetPool;

  /**
   * The share of the device size the pass target has, in `(0, 1]`, default `1`: its width is
   * `max(1, floor(width · pixelRatio · scale))`, its height likewise. The internal target of the
   * whole-picture mode keeps the full size. A `StageDirector` sets it on the renderer it draws a
   * mask stage with; the size of the renderer and of its stages stays the logical one, and the
   * parent samples the smaller picture up through the texture's filtering. The caller checks the
   * value.
   */
  get scale(): number {
    return this.#scale;
  }

  /** Stores the scale and brings a pass target that exists to it — the same target and texture, so every `texture()` node on it stays valid. */
  set scale(scale: number) {
    if (this.#scale === scale) return;
    this.#scale = scale;
    if (this.#pass) this.#resize(this.#pass, this.#passWidth, this.#passHeight, scale);
  }

  get pool(): StageRenderTargetPool | undefined {
    return this.#pool;
  }

  /** Stores the pool; with a pool, the internal target built here is released — the whole-picture mode borrows from then on. */
  set pool(pool: StageRenderTargetPool | undefined) {
    this.#pool = pool;
    if (pool) this.#dropOwnInternalTarget();
  }

  /**
   * Answers the internal target for one whole-picture draw: borrowed from the pool if one is set,
   * sized in device pixels, otherwise the own one, built or brought to the size `width`×`height`
   * asks for. Every call is paired with one {@link returnInternalTarget} once the draw is over.
   */
  acquireInternalTarget(renderer: WebGPURenderer, width: number, height: number): RenderTarget {
    const pool = this.#pool;
    let rt: RenderTarget;
    if (pool) {
      this.#pixelRatio = renderer.getPixelRatio?.() ?? 1;
      rt = pool.acquire(
        this.#deviceSize(width, 1),
        this.#deviceSize(height, 1),
        renderer.getOutputBufferType(),
        renderer.samples,
      );
    } else {
      rt = this.#internal = this.#ensure(this.#internal, renderer, width, height, 1);
    }
    this.#lent = rt;
    this.#lentFrom = pool;
    return rt;
  }

  /**
   * Ends the whole-picture draw {@link acquireInternalTarget} began: a borrowed target goes back to
   * the pool it came from, even if another pool or none is set by now; an own target that was taken
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

  /**
   * Answers the pass target a composing parent draws into, built or brought to the size
   * `width`×`height` asks for at the {@link scale}.
   */
  passTarget(renderer: WebGPURenderer, width: number, height: number): RenderTarget {
    this.#passWidth = width;
    this.#passHeight = height;
    return (this.#pass = this.#ensure(this.#pass, renderer, width, height, this.#scale));
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
   * Brings the internal target, then the pass target, to the size `width`×`height` asks for —
   * the pass target at the {@link scale} —, each only if it has been built. A target that refuses
   * the size leaves the one after it as it was.
   */
  resize(width: number, height: number): void {
    if (this.#internal) this.#resize(this.#internal, width, height, 1);
    if (this.#pass) {
      this.#passWidth = width;
      this.#passHeight = height;
      this.#resize(this.#pass, width, height, this.#scale);
    }
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

  /**
   * Width or height a `RenderTarget` has to have, in device pixels, for the logical `size` at
   * `scale`. A size that is not a finite number — written into the public `width` or `height` of a
   * `StageRenderer` past its `resize()` — gives the minimum as well.
   */
  #deviceSize(size: number, scale: number): number {
    return isFiniteNumber(size) ? Math.max(1, Math.floor(size * this.#pixelRatio * scale)) : 1;
  }

  #resize(rt: RenderTarget, width: number, height: number, scale: number): void {
    const w = this.#deviceSize(width, scale);
    const h = this.#deviceSize(height, scale);
    if (rt.width !== w || rt.height !== h) {
      rt.setSize(w, h);
    }
  }

  #ensure(rt: RenderTarget | undefined, renderer: WebGPURenderer, width: number, height: number, scale: number): RenderTarget {
    this.#pixelRatio = renderer.getPixelRatio?.() ?? 1;
    // the values three.js' PassNode gives the pass targets of the composed mode. The type stands
    // per renderer from its constructor on; a changed sample count is taken into the target by
    // three.js on the next draw, and target and texture stay the same objects — every texture()
    // node on them stays valid.
    if (!rt) {
      return new RenderTarget(this.#deviceSize(width, scale), this.#deviceSize(height, scale), {
        type: renderer.getOutputBufferType(),
        samples: renderer.samples,
      });
    }
    if (rt.samples !== renderer.samples) rt.samples = renderer.samples;
    this.#resize(rt, width, height, scale);
    return rt;
  }
}
