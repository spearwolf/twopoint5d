import {RenderTarget, type TextureDataType} from 'three/webgpu';

interface StageRenderTargetPoolEntry {
  readonly renderTarget: RenderTarget;
  lent: boolean;
}

/**
 * A pool of `RenderTarget`s that `StageRenderer`s share for the internal target of Mode C — a
 * `pipeline` without `buildOutputNode` that is not a `RootRenderPipeline`. Build one, set it as
 * `internalTargetPool` on each renderer that shall share, and dispose it when the renderers are
 * done with it.
 *
 * A renderer borrows a target at the start of its Mode C draw and gives it back once its pipeline
 * has run, in the same call — also when a stage or the pipeline throws. Renderers that draw one
 * after another therefore draw through the same target; a renderer that draws during the draw of
 * another — a child with a pipeline of its own under a Mode C renderer — gets a target of its own.
 * Each renderer clears the borrowed target in full before its stages draw, as it does its own, so
 * nothing of the previous borrower stays in it.
 *
 * The pass-target a composing parent samples through `asPassNode()` is not pooled: the parent
 * samples the pass-targets of all its children in one run of its pipeline, so each child keeps
 * its own.
 *
 * A target is lent only for the exact width, height, `type` and `samples` it was built with. When
 * no free target fits, the pool releases every free target before it builds a new one, so nothing
 * of an earlier size stays behind after a resize. A pool that renderers of different sizes share
 * builds a new target on every switch between them — give each size a pool of its own.
 *
 * Renderers that draw in the same order every frame borrow the same target every frame, so the
 * `texture()` node of Mode C and the pipeline built on it stay.
 *
 * Ownership: the pool belongs to whoever built it. `StageRenderer#dispose()` leaves it alone.
 */
export class StageRenderTargetPool {
  // in the order the targets were built: a lookup hands out the oldest free one that fits
  readonly #entries: StageRenderTargetPoolEntry[] = [];
  #disposed = false;

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Lends a target of exactly `width`×`height` pixels, of the texture `type` and the `samples`
   * asked for — a free one that fits, or a new one. `width` and `height` are the pixels of the
   * target itself, not a logical size. Every `acquire()` is paired with one {@link release} of
   * the target it answered; code of your own may borrow from the same pool on the same terms.
   *
   * Throws an error naming the class and the state once {@link dispose} has run.
   */
  acquire(width: number, height: number, type: TextureDataType, samples: number): RenderTarget {
    if (this.#disposed) {
      throw new Error('StageRenderTargetPool#acquire() is not available: this pool has been disposed');
    }

    const entries = this.#entries;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      if (entry.lent) continue;
      const rt = entry.renderTarget;
      if (rt.width === width && rt.height === height && rt.texture.type === type && rt.samples === samples) {
        entry.lent = true;
        return rt;
      }
    }

    // nothing free fits: whatever is free is of a size, a type or a sample count nobody asks for
    // right now, and would otherwise hold its GPU memory for good after a resize
    this.#releaseFreeTargets();

    const renderTarget = new RenderTarget(width, height, {type, samples});
    entries.push({renderTarget, lent: true});
    return renderTarget;
  }

  /**
   * Takes back a target that {@link acquire} lent out. After {@link dispose} the target is
   * released instead of kept.
   *
   * Throws an error naming the class and the call for a target that is not on loan from this
   * pool — one of another pool or of nobody, or one that came back already —, also after
   * `dispose()`: two borrowers of one target would draw into it at the same time.
   */
  release(renderTarget: RenderTarget): void {
    const entries = this.#entries;
    let index = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i]!.renderTarget === renderTarget) {
        index = i;
        break;
      }
    }

    if (index === -1 || !entries[index]!.lent) {
      throw new Error('StageRenderTargetPool#release() cannot take the render target back: it is not on loan from this pool');
    }

    if (this.#disposed) {
      this.#removeAt(index);
      renderTarget.dispose();
      return;
    }

    entries[index]!.lent = false;
  }

  /**
   * Releases every target that is back in the pool now, and every lent target when it comes back
   * through {@link release} — a lent target is the current render target of a draw that is still
   * running, and released in the middle of it three.js would allocate it again on the next draw
   * into it, with nobody left to release that. Afterwards `isDisposed` is `true` and
   * {@link acquire} throws an error naming the class and the state. Safe to call twice.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#releaseFreeTargets();
  }

  /** Disposes every target that is not lent and drops its entry; the lent ones keep their order. */
  #releaseFreeTargets(): void {
    const entries = this.#entries;
    let kept = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      if (entry.lent) {
        entries[kept++] = entry;
      } else {
        entry.renderTarget.dispose();
      }
    }
    entries.length = kept;
  }

  #removeAt(index: number): void {
    const entries = this.#entries;
    for (let i = index + 1; i < entries.length; i++) {
      entries[i - 1] = entries[i]!;
    }
    entries.length -= 1;
  }
}
