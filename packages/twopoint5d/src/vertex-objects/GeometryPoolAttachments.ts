import type {VOBufferPool} from './VOBufferPool.js';

/**
 * Bookkeeping for the pool attachments of a single geometry.
 *
 * A geometry can reach the same pool through more than one route — a base pool that doubles
 * as the instanced pool, or one pool attached under two names. Every route is counted here,
 * while the pool itself sees exactly one attachment for as long as any route holds it. That
 * way giving up one route never pulls the attachment out from under another, and a repeated
 * `dispose()` cannot release what it has already released.
 */
export class GeometryPoolAttachments {
  readonly #holds: Map<VOBufferPool, number> = new Map();

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
}
