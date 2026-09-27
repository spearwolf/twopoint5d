import type {AttributeRoute} from './GeometryAttributeSlots.js';
import type {VOBufferPool} from './VOBufferPool.js';
import type {VertexObjectPool} from './VertexObjectPool.js';
import {asThreeTypedArray} from './asThreeTypedArray.js';
import {selectAttributes} from './selectAttributes.js';
import {selectBuffers} from './selectBuffers.js';
import {setUploadRanges} from './setUploadRanges.js';
import type {BufferLike, TouchBuffersType} from './types.js';
import {UPLOAD_RANGES_ARRAY_LENGTH} from './uploadRanges.js';

// read once into a constant of this module, so the loop of syncUploads() never touches an imported
// binding: a module runner that rewrites imports, as the one Vitest runs specs and benches in does,
// turns every read of one into a property read on a module object
const applyUploadRanges: typeof setUploadRanges = setUploadRanges;

/** Which half of an instanced geometry a route feeds. A geometry that draws one pool leaves it unset. */
export type RouteGroup = 'base' | 'instanced';

/** The way a geometry reaches one pool: the buffers it built on it and the serial it last saw per buffer. */
export type GeometryRoute = {
  readonly pool: VOBufferPool;
  readonly buffers: AttributeRoute;
  readonly bufferSerials: Map<string, number>;
  readonly group?: RouteGroup;
  /** The name the route was attached under, for the routes of `attachInstancedPool()`. */
  readonly name?: string;
  /** What the caller said about releasing the pool with this route; unset means the caller said nothing. */
  autoDispose?: boolean;
  /**
   * Whether this route still owes the static buffers it carries their first upload.
   *
   * The full pass is the expensive half and answers a question of its own: whether there are
   * attributes on this route that have never reached the gpu. Every route answers it for itself,
   * so one that arrives late does not put the routes that are already uploading back in debt.
   */
  firstAutoTouch?: boolean;
};

/** A read-only view of `source` that answers with `project(value)` — one source, no second map to keep in step. */
function projectValues<K, S, T>(source: ReadonlyMap<K, S>, project: (value: S) => T): ReadonlyMap<K, T> {
  // read afresh on every call, so the view answers for whatever `source` holds right now
  const entries = (): [K, T][] => Array.from(source, ([key, value]): [K, T] => [key, project(value)]);

  const view: ReadonlyMap<K, T> = {
    get size(): number {
      return source.size;
    },

    get(key: K): T | undefined {
      const value = source.get(key);
      return value === undefined ? undefined : project(value);
    },

    has(key: K): boolean {
      return source.has(key);
    },

    keys: () => source.keys(),

    values: () => Array.from(source.values(), project).values(),

    entries: () => entries().values(),

    forEach(callbackfn: (value: T, key: K, map: ReadonlyMap<K, T>) => void, thisArg?: unknown): void {
      for (const [key, value] of entries()) {
        callbackfn.call(thisArg, value, key, view);
      }
    },

    [Symbol.iterator]: () => entries().values(),
  };

  return view;
}

/**
 * The routes of a single geometry and everything that is booked per route: the serial it last
 * saw for each of its buffers, the selection of buffers that upload on every `update()`, and the
 * selections a touch resolves.
 *
 * A geometry that draws one pool holds one route; an instanced one holds a base route, an
 * instanced route and a named route per attached pool. Every method here walks the routes the
 * geometry has, so both kinds of geometry ask the same questions of the same bookkeeping.
 */
export class GeometryRoutes {
  readonly #routes: GeometryRoute[] = [];
  readonly #attached: Map<string, GeometryRoute> = new Map();

  /**
   * The unnamed routes, then the named ones in the order of their map: what every method that
   * runs per `update()` or `touch()` walks by index. Built anew only when the routes change.
   */
  #all: GeometryRoute[] = [];

  /** The pools of the named routes, keyed by their name. */
  readonly attachedPools: ReadonlyMap<string, VertexObjectPool<unknown>> = projectValues(
    this.#attached,
    // `attachInstancedPool()` takes either a VertexObjectPool or a descriptor it wraps in one
    // itself, so the pool behind a name is always a VertexObjectPool
    (route) => route.pool as VertexObjectPool<unknown>,
  );

  /** The buffer maps of the named routes, keyed by their name. */
  readonly attachedBuffers: ReadonlyMap<string, ReadonlyMap<string, BufferLike>> = projectValues(
    this.#attached,
    (route) => route.buffers,
  );

  /** The buffer serials of the named routes, keyed by their name. */
  readonly attachedBufferSerials: ReadonlyMap<string, ReadonlyMap<string, number>> = projectValues(
    this.#attached,
    (route) => route.bufferSerials,
  );

  /** Take on a route the geometry has just built, in the order it was built. */
  add(route: GeometryRoute): void {
    route.firstAutoTouch = true;
    this.#routes.push(route);
    this.#routesChanged();
  }

  /**
   * Take on a named route.
   *
   * @throws when the name already has a route. `attachInstancedPool()`, the only caller, detaches
   * the name first — a name that reaches here already taken is an invariant broken elsewhere.
   */
  attach(route: GeometryRoute & {name: string; group: 'instanced'}): void {
    if (this.#attached.has(route.name)) {
      throw new Error(`GeometryRoutes#attach(): the name "${route.name}" already has a route — detach it first`);
    }

    // no attribute of this route has reached the gpu yet, and a static buffer uploads only when
    // something asks for it — so this route owes its static buffers a full pass, and the routes
    // that are already on the geometry owe theirs nothing
    route.firstAutoTouch = true;
    this.#attached.set(route.name, route);
    this.#routesChanged();
  }

  /** The named route, or `undefined` if the name is free. */
  route(name: string): GeometryRoute | undefined {
    return this.#attached.get(name);
  }

  /**
   * Give up the named route.
   *
   * @returns the route that was there, or `undefined`.
   */
  detach(name: string): GeometryRoute | undefined {
    const route = this.#attached.get(name);
    if (route === undefined) return undefined;

    this.#attached.delete(name);
    this.#routesChanged();

    return route;
  }

  /** Say what the caller decided about releasing the pool of the named route. */
  setAutoDispose(name: string, autoDispose: boolean): void {
    const route = this.#attached.get(name);
    if (route !== undefined) {
      route.autoDispose = autoDispose;
    }
  }

  /** Every route, unnamed ones first, in the order they were taken on. */
  *[Symbol.iterator](): IterableIterator<GeometryRoute> {
    yield* this.#routes;
    yield* this.#attached.values();
  }

  /**
   * Hand every buffer that uploads on the next frame the ranges it uploads, and mark it for the
   * upload:
   *
   * - a buffer something asked for carries every object in use — nobody knows which values a
   *   generated setter wrote. With no object in use it carries nothing and is not marked.
   * - any other buffer whose pool has moved on carries the objects that were written, in up to
   *   eight ranges. When everything that was written lies beyond the objects in use, it carries
   *   nothing and is not marked.
   *
   * A buffer that neither of the two reaches is left as it is, range and all. The serial a route
   * holds per buffer moves on as soon as the pool has, whether or not anything uploads.
   */
  syncUploads(): void {
    const all = this.#all;
    const ranges = this.#ranges;
    const round = this.#round;

    for (let i = 0; i < all.length; i++) {
      const route = all[i]!;
      const {pool} = route;
      const {vertexCount} = pool.descriptor;
      const {usedCount} = pool;
      // a pool that has been disposed elsewhere lists no buffer, and the rest of the update path
      // already treats that as a regular state and leaves the attribute alone
      const records = pool.buffer.bufferList;

      for (let j = 0; j < records.length; j++) {
        const record = records[j]!;
        const bufAttr = route.buffers.get(record.bufferName);
        if (bufAttr === undefined) continue;

        const written = pool.buffer.pickUpDirtyRanges(record, route.bufferSerials.get(record.bufferName), usedCount, ranges);
        if (written >= 0) {
          route.bufferSerials.set(record.bufferName, record.serial);
        }

        if (this.#askedIn.get(bufAttr) === round) {
          if (usedCount > 0) {
            ranges[0] = 0;
            ranges[1] = usedCount - 1;
            applyUploadRanges(bufAttr, ranges, 1, vertexCount, record.itemSize);
            bufAttr.needsUpdate = true;
          }
        } else if (written > 0) {
          applyUploadRanges(bufAttr, ranges, written, vertexCount, record.itemSize);
          bufAttr.needsUpdate = true;
        }
      }
    }

    this.#nextRound();
  }

  /**
   * Point every buffer at the typed array its pool holds for it. The pool swaps an array only when
   * buffers data comes back in as a whole (`fromBuffersData()` → `setTypedArray()`), so the arrays
   * are compared buffer by buffer rather than tracked through an upload version.
   */
  syncArrays(): void {
    const all = this.#all;
    for (let i = 0; i < all.length; i++) {
      const route = all[i]!;
      const records = route.pool.buffer.bufferList;
      for (let j = 0; j < records.length; j++) {
        const record = records[j]!;
        const bufAttr = route.buffers.get(record.bufferName);
        if (bufAttr !== undefined && record.typedArray !== undefined && bufAttr.array !== record.typedArray) {
          bufAttr.array = asThreeTypedArray(record.typedArray);
        }
      }
    }
  }

  /** Mark the buffers behind this attribute name, across every route, for a full upload on the next `update()`. */
  touchAttribute(attrName: string): void {
    this.#touch(this.#selectionOf(attrName));
  }

  /**
   * Mark the buffers of these usage types for a full upload on the next `update()`: across every
   * route without a `group`, and otherwise only across the routes that feed the named half.
   */
  touchByUsage(bufferTypes: TouchBuffersType, group?: RouteGroup): void {
    this.#touch(this.#usageSelectionOf(bufferTypes, group));
  }

  /** Ask for everything that uploads without being asked, for the `syncUploads()` that follows. */
  autoTouch(): void {
    const all = this.#all;
    for (let i = 0; i < all.length; i++) {
      const route = all[i]!;
      // a route without an object in use would spend its first upload on nothing
      if (route.firstAutoTouch && route.pool.usedCount > 0) {
        this.#ask(selectBuffers(route.buffers, {static: true}));
        route.firstAutoTouch = false;
      }
    }

    this.#ask(this.#getAutoTouchBuffers());
  }

  /** Give up every route and every piece of bookkeeping over them. */
  clear(): void {
    this.#routes.length = 0;
    this.#attached.clear();
    this.#routesChanged();
    this.#nextRound();
  }

  /**
   * The round of `syncUploads()` in which each buffer was last asked for a full upload: a buffer
   * counts as asked when its entry names the current round, and moving on to the next round
   * forgets every request at once. A `Set` would have to be cleared instead, and `Set#clear()`
   * replaces its backing store; the weak keys hold no attribute of a route that is gone.
   */
  readonly #askedIn = new WeakMap<BufferLike, number>();
  #round = 0;

  /** The object ranges `pickUpDirtyRanges()` writes, one call at a time. */
  readonly #ranges = new Int32Array(UPLOAD_RANGES_ARRAY_LENGTH);

  #autoTouchBuffers?: BufferLike[];
  readonly #selectionsByName = new Map<string, BufferLike[]>();
  readonly #selectionsByUsage = new Map<number, BufferLike[]>();

  #nextRound(): void {
    // kept within the small integers of V8, which a map value holds without a heap number; a
    // request left standing for 2^30 rounds would come back into force, and none stands that long
    this.#round = (this.#round + 1) & 0x3fffffff;
  }

  /** Ask for a full upload of these buffers in the next `syncUploads()`. */
  #ask(buffers: BufferLike[]): void {
    for (let i = 0; i < buffers.length; i++) {
      this.#askedIn.set(buffers[i]!, this.#round);
    }
  }

  /**
   * Ask for a full upload of these buffers on the next `update()`, and let go of the ranges they
   * carry.
   *
   * A range still standing names the objects of some earlier write and is narrower than what is
   * being asked for here; a render that comes before the next `update()` would upload that alone,
   * while with no range at all three uploads the whole array — the answer for a caller who cannot
   * say what was written. `needsUpdate` waits for `update()`, which knows whether the pool has an
   * object in use: one without uploads nothing.
   */
  #touch(buffers: BufferLike[]): void {
    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i]!;
      buffer.clearUpdateRanges();
      this.#askedIn.set(buffer, this.#round);
    }
  }

  /** The routes have changed: rebuild the flat list of them and drop every selection resolved over the old ones. */
  #routesChanged(): void {
    this.#all = [...this.#routes, ...this.#attached.values()];
    this.#dropSelections();
  }

  /**
   * Let go of every resolved selection, so the next `autoTouch()` or touch builds it from the
   * routes there are then. Every change to the routes goes through here: a selection that still
   * names a route which has gone holds that route's `THREE.BufferAttribute`s, and one resolved
   * before a route arrived knows none of its buffers.
   *
   * What a route owes in the way of a first upload is a separate answer and stays where it is:
   * a route that leaves does not put the remaining ones back in debt.
   */
  #dropSelections(): void {
    this.#autoTouchBuffers = undefined;
    this.#selectionsByName.clear();
    this.#selectionsByUsage.clear();
  }

  /** The buffers behind this attribute name, across every route, resolved once per name. */
  #selectionOf(attrName: string): BufferLike[] {
    let selected = this.#selectionsByName.get(attrName);
    if (selected === undefined) {
      selected = [];
      const all = this.#all;
      for (let i = 0; i < all.length; i++) {
        const route = all[i]!;
        const layout = route.pool.buffer.bufferAttributes.get(attrName);
        if (layout === undefined) continue;
        const buffer = route.buffers.get(layout.bufferName);
        // a geometry that has given up its route to this pool carries no buffer for the name any more
        if (buffer !== undefined && !selected.includes(buffer)) {
          selected.push(buffer);
        }
      }
      this.#selectionsByName.set(attrName, selected);
    }
    return selected;
  }

  /**
   * The buffers of these usage types: across every route without a `group`, and otherwise only
   * across the routes that feed the named half of an instanced geometry. Resolved once per
   * combination of usage types and group.
   */
  #usageSelectionOf(bufferTypes: TouchBuffersType, group?: RouteGroup): BufferLike[] {
    const key =
      (bufferTypes.static === true ? 1 : 0) |
      (bufferTypes.dynamic === true ? 2 : 0) |
      (bufferTypes.stream === true ? 4 : 0) |
      (group === 'base' ? 8 : 0) |
      (group === 'instanced' ? 16 : 0);

    let selected = this.#selectionsByUsage.get(key);
    if (selected === undefined) {
      selected = [];
      const all = this.#all;
      for (let i = 0; i < all.length; i++) {
        const route = all[i]!;
        // an attached route always carries group: 'instanced', so asking for that group already
        // reaches it through the term above — group: 'instanced' is the invariant attach() types
        const feeds = group === undefined || route.group === group;
        if (!feeds) continue;

        const buffers = selectBuffers(route.buffers, bufferTypes);
        for (let j = 0; j < buffers.length; j++) {
          selected.push(buffers[j]!);
        }
      }
      this.#selectionsByUsage.set(key, selected);
    }
    return selected;
  }

  /**
   * The buffers behind the attributes that carry `autoTouch`, resolved once across every route.
   * The selection changes only when a route is added or given up.
   */
  #getAutoTouchBuffers(): BufferLike[] {
    if (this.#autoTouchBuffers == null) {
      const all = this.#all;
      const attrNames: string[] = [];
      for (let i = 0; i < all.length; i++) {
        for (const attr of all[i]!.pool.descriptor.attributes.values()) {
          if (attr.autoTouch) {
            attrNames.push(attr.name);
          }
        }
      }

      // every route answers with the buffers it holds for these names, and a name a route does
      // not carry selects nothing there
      const buffers: BufferLike[] = [];
      for (let i = 0; i < all.length; i++) {
        const route = all[i]!;
        const selected = selectAttributes(route.pool, route.buffers, attrNames);
        for (let j = 0; j < selected.length; j++) {
          buffers.push(selected[j]!);
        }
      }
      this.#autoTouchBuffers = buffers;
    }
    return this.#autoTouchBuffers;
  }
}
