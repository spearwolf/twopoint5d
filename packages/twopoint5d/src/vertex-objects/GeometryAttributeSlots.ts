import type {BufferAttribute, BufferGeometry, InterleavedBufferAttribute} from 'three/webgpu';
import type {VOBufferPool} from './VOBufferPool.js';
import {asThreeTypedArray} from './asThreeTypedArray.js';
import {expectDefined} from '../utils/expectDefined.js';
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
 *
 * Claims stack only as far as the constructor of the geometry lays them down. Every slot name
 * this bookkeeping has ever seen is remembered, and {@link everHeld} lets the geometry refuse a
 * later route that would take one of them.
 *
 * Per slot it also knows the array version {@link syncArrays} last synced against, which is what
 * makes that call cheap for the slots nothing has happened to.
 */
export class GeometryAttributeSlots {
  readonly #slots: Map<string, SlotClaim[]> = new Map();

  /** Every slot name that has been claimed here, including the ones released since. */
  readonly #everHeld = new Set<string>();

  /** The array version of the attribute in a slot, as of the last {@link syncArrays}. */
  readonly #serials: Map<string, number> = new Map();

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
   * These come from a `BufferGeometry` copied into the geometry: `copy()` cloned them, so they
   * belong to the geometry that holds them, no pool feeds them, and because they are claimed
   * before any route initializes they sit below every pool claim — so a route that takes such a
   * slot gives it back on release.
   */
  claimExisting(geometry: BufferGeometry): void {
    for (const [attrName, attr] of Object.entries(geometry.attributes)) {
      this.#claim(attrName, undefined, undefined, attr);
    }
  }

  /**
   * Which of `attrNames` this geometry has already had an attribute in. A slot is never
   * handed on: what a second attribute would push out of it could not be given back to the
   * renderer afterwards, so the caller is refused instead.
   */
  everHeld(attrNames: Iterable<string>): string[] {
    const taken: string[] = [];
    for (const attrName of attrNames) {
      if (this.#everHeld.has(attrName)) {
        taken.push(attrName);
      }
    }
    return taken;
  }

  /** The pool whose buffers feed the slot `attrName`, or `undefined` if no pool does. */
  poolOf(attrName: string): VOBufferPool | undefined {
    const claims = this.#slots.get(attrName);
    return claims === undefined || claims.length === 0
      ? undefined
      : expectDefined(claims[claims.length - 1], `the topmost claim of slot "${attrName}"`).pool;
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
      const released = expectDefined(claims.splice(held, 1)[0], `the claim of route on slot "${attrName}"`);
      if (!wasOnTop) continue;

      if (claims.length === 0) {
        geometry.deleteAttribute(attrName);
        // deleting the entry the Map iteration is currently on is allowed
        this.#slots.delete(attrName);
        changed.push({attrName, vacated: released.attr});
      } else {
        geometry.setAttribute(attrName, expectDefined(claims[claims.length - 1], `the topmost claim of slot "${attrName}"`).attr);
        changed.push({attrName});
      }

      // the slot has changed hands; the version syncArrays() compares against belongs to the
      // attribute that left
      this.#serials.delete(attrName);
    }

    return changed;
  }

  /**
   * If the references to the attribute arrays in a {@link VOBufferPool} are swapped,
   * e.g. via a {@link VOBufferPool#fromBuffersData()} call, then of course the references
   * to the typed arrays within the `THREE.BufferAttribute` structure must also be changed.
   */
  syncArrays(geometry: BufferGeometry): void {
    for (const attrName in geometry.attributes) {
      const attr = geometry.attributes[attrName];
      const bufAttr = (attr as InterleavedBufferAttribute).isInterleavedBufferAttribute
        ? (attr as InterleavedBufferAttribute).data
        : (attr as BufferAttribute);

      // an attribute this geometry has not synced yet carries no serial, and undefined never
      // equals a version
      const version = bufAttr.version;
      if (this.#serials.get(attrName) === version) continue;
      this.#serials.set(attrName, version);

      // a slot without a pool holds an attribute copied from a `BufferGeometry` handed to the
      // constructor, and there is no pool array behind it that could be pointed at
      const pool = this.poolOf(attrName);
      if (pool === undefined) continue;

      const poolBufInfo = pool.buffer.bufferAttributes.get(attrName);
      if (poolBufInfo === undefined) continue;

      const poolBuf = pool.buffer.buffers.get(poolBufInfo.bufferName);
      // the pool has been disposed, there is no array left to point at
      if (poolBuf === undefined) continue;

      bufAttr.array = asThreeTypedArray(poolBuf.typedArray!);
    }
  }

  #claim(
    attrName: string,
    route: AttributeRoute | undefined,
    pool: VOBufferPool | undefined,
    attr: BufferAttribute | InterleavedBufferAttribute,
  ): void {
    this.#everHeld.add(attrName);

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
