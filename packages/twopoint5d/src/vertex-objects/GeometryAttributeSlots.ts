import type {BufferAttribute, BufferGeometry, InterleavedBufferAttribute} from 'three/webgpu';
import type {VOBufferPool} from './VOBufferPool.js';
import type {BufferLike} from './types.js';

/**
 * A route is the way a geometry reaches a pool. Its identity is the buffer map it fills:
 * there is exactly one per route, it is passed around anyway, and it tells two routes to
 * the *same* pool apart, which the pool identity cannot.
 */
export type AttributeRoute = Map<string, BufferLike>;

/** What a released route left behind in one attribute slot. */
export type ReleasedSlot = {
  attrName: string;
  /**
   * The attribute that left the slot, and only set when no claim was left underneath: the
   * slot is empty now. A slot that fell back to another route is filled and names nothing.
   */
  vacated?: BufferAttribute | InterleavedBufferAttribute;
};

type SlotClaim = {
  route: AttributeRoute | undefined;
  pool: VOBufferPool | undefined;
  attr: BufferAttribute | InterleavedBufferAttribute;
};

/**
 * Bookkeeping for the attribute slots of a single geometry: which route put the
 * `THREE.BufferAttribute` that is currently sitting in a slot there.
 *
 * An attribute name is unique per geometry, not per pool, so two routes that declare the
 * same name land in the same slot and the one that initializes later wins. Every claim is
 * kept, oldest first, and the topmost one is the attribute the geometry really shows. That
 * is what lets a route give up its own slots and nothing else: what it displaced comes back,
 * what displaced it stays, and an attribute name resolves to the pool that actually feeds it.
 */
export class GeometryAttributeSlots {
  readonly #slots: Map<string, SlotClaim[]> = new Map();

  /**
   * Note that `route` has put `attr` into the slot `attrName`. A route that already holds
   * the slot has its claim replaced rather than a second one added.
   */
  claim(attrName: string, route: AttributeRoute, pool: VOBufferPool, attr: BufferAttribute | InterleavedBufferAttribute): void {
    this.#claim(attrName, route, pool, attr);
  }

  /**
   * Take every attribute the geometry already carries as a claim without a pool.
   *
   * These come from a `BufferGeometry` copied into the geometry: they belong to the caller,
   * no pool feeds them, and because they are claimed before any route initializes they sit
   * below every pool claim — so a route that takes such a slot gives it back on release.
   */
  claimExisting(geometry: BufferGeometry): void {
    for (const [attrName, attr] of Object.entries(geometry.attributes)) {
      this.#claim(attrName, undefined, undefined, attr);
    }
  }

  /** The pool whose buffers feed the slot `attrName`, or `undefined` if no pool does. */
  poolOf(attrName: string): VOBufferPool | undefined {
    const claims = this.#slots.get(attrName);
    return claims === undefined || claims.length === 0 ? undefined : claims[claims.length - 1].pool;
  }

  /**
   * Give up every slot of `route` and restore it: the attribute of the claim underneath comes
   * back onto the geometry, a slot without a remaining claim is deleted. A claim that was not
   * the topmost one changes nothing on the geometry — a later route owns that slot.
   *
   * @returns the names whose occupancy changed; a name whose slot is empty now also carries
   *   the attribute that left it
   */
  releaseRoute(geometry: BufferGeometry, route: AttributeRoute): ReleasedSlot[] {
    const changed: ReleasedSlot[] = [];

    for (const [attrName, claims] of this.#slots) {
      const held = claims.findIndex((claim) => claim.route === route);
      if (held < 0) continue;

      const wasOnTop = held === claims.length - 1;
      const [released] = claims.splice(held, 1);
      if (!wasOnTop) continue;

      if (claims.length === 0) {
        geometry.deleteAttribute(attrName);
        // deleting the entry the Map iteration is currently on is allowed
        this.#slots.delete(attrName);
        changed.push({attrName, vacated: released.attr});
      } else {
        geometry.setAttribute(attrName, claims[claims.length - 1].attr);
        changed.push({attrName});
      }
    }

    return changed;
  }

  #claim(
    attrName: string,
    route: AttributeRoute | undefined,
    pool: VOBufferPool | undefined,
    attr: BufferAttribute | InterleavedBufferAttribute,
  ): void {
    const claims = this.#slots.get(attrName);
    if (claims === undefined) {
      this.#slots.set(attrName, [{route, pool, attr}]);
      return;
    }

    const held = claims.findIndex((claim) => claim.route === route);
    if (held < 0) {
      claims.push({route, pool, attr});
    } else {
      claims[held] = {route, pool, attr};
    }
  }
}
