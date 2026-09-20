import type {VOBufferPool} from './VOBufferPool.js';

/**
 * Bookkeeping for the relation of a single geometry to the pools it reaches: through how many
 * routes, and whether the geometry built the pool itself.
 *
 * A geometry can reach the same pool through more than one route. The constructor lays such a
 * pair down when the base pool doubles as the instanced pool; past it, a pool reaches a second
 * route only when it puts nothing into an attribute slot, because a slot belongs to one route
 * for the life of the geometry. Every route is counted here, while the pool itself sees exactly
 * one attachment for as long as any route holds it. That way giving up one route never pulls the
 * attachment out from under another, and a repeated `dispose()` cannot release what it has
 * already released.
 *
 * Whether the geometry built a pool is what makes it release the pool, and that answer follows
 * the pool rather than the route or the name it came in under.
 */
export class GeometryPoolAttachments {
  readonly #holds: Map<VOBufferPool, number> = new Map();

  readonly #owned = new Set<VOBufferPool>();

  /** Note that this geometry built `pool` itself, which is what makes it release it. */
  declareOwned(pool: VOBufferPool): void {
    this.#owned.add(pool);
  }

  /** Whether this geometry built `pool` itself. */
  owns(pool: VOBufferPool): boolean {
    return this.#owned.has(pool);
  }

  /** Let go of the answer for `pool`: a pool that survives its last route comes back as one from outside. */
  forgetOwned(pool: VOBufferPool): void {
    this.#owned.delete(pool);
  }

  attach(pool: VOBufferPool): void {
    const holds = this.#holds.get(pool) ?? 0;
    if (holds === 0) {
      pool.attachGeometry();
    }
    this.#holds.set(pool, holds + 1);
  }

  /** Whether this geometry still reaches `pool` through at least one route. */
  holds(pool: VOBufferPool | undefined): boolean {
    return pool != null && this.#holds.has(pool);
  }

  detach(pool: VOBufferPool | undefined): void {
    if (pool == null) return;

    const holds = this.#holds.get(pool);
    if (holds == null) return;

    if (holds > 1) {
      this.#holds.set(pool, holds - 1);
      return;
    }

    this.#holds.delete(pool);
    pool.detachGeometry();
  }

  detachAll(): void {
    for (const pool of this.#holds.keys()) {
      pool.detachGeometry();
    }
    this.#holds.clear();
  }

  /**
   * Give up every attachment and every answer about ownership.
   *
   * Separate from {@link detachAll}, because a geometry that is going away asks which of its
   * pools it built after it has let go of the attachments — the two answers end at different
   * points of `dispose()`.
   */
  clear(): void {
    this.#holds.clear();
    this.#owned.clear();
  }
}
