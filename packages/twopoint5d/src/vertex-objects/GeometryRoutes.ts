import type {AttributeRoute} from './GeometryAttributeSlots.js';
import type {VOBufferPool} from './VOBufferPool.js';
import type {VertexObjectPool} from './VertexObjectPool.js';
import {selectAttributes} from './selectAttributes.js';
import {selectBuffers} from './selectBuffers.js';
import {setUploadRange} from './setUploadRange.js';
import type {BufferLike, TouchBuffersType} from './types.js';

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

/** Mark every one of these buffers for the next GPU upload. */
function markForUpload(buffers: BufferLike[]): void {
  for (const buffer of buffers) {
    buffer.needsUpdate = true;
  }
}

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
 * saw for each of its buffers, and the selection of buffers that upload on every `update()`.
 *
 * A geometry that draws one pool holds one route; an instanced one holds a base route, an
 * instanced route and a named route per attached pool. Every method here walks the routes the
 * geometry has, so both kinds of geometry ask the same questions of the same bookkeeping.
 */
export class GeometryRoutes {
  readonly #routes: GeometryRoute[] = [];
  readonly #attached: Map<string, GeometryRoute> = new Map();

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
    this.#dropAutoTouchSelection();
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
    this.#dropAutoTouchSelection();
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
    this.#dropAutoTouchSelection();

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
   * Bring every buffer that uploads on the next frame together with the range it uploads: a
   * buffer whose pool has moved on carries the objects that were written, one that something
   * asked for carries every object in use. Nothing knows which values a generated setter wrote,
   * so an attribute that is touched or carries `autoTouch` uploads the whole area either way.
   *
   * A buffer that neither of the two reaches is left as it is, range and all.
   */
  syncUploads(): void {
    for (const route of this) {
      const {vertexCount} = route.pool.descriptor;
      const {usedCount} = route.pool;

      for (const [bufferName, bufAttr] of route.buffers) {
        const poolBuffer = route.pool.buffer.buffers.get(bufferName);
        // a pool that has been disposed elsewhere carries no buffer to compare against; the rest
        // of the update path already treats that as a regular state and leaves the attribute alone
        if (poolBuffer == null) continue;

        const written = route.pool.buffer.pickUpDirtyRange(bufferName, route.bufferSerials.get(bufferName), usedCount);
        const asked = this.#fullUploads.has(bufAttr);

        if (written != null) {
          bufAttr.needsUpdate = true;
          route.bufferSerials.set(bufferName, poolBuffer.serial);
        }

        // what this pass carries: the objects that were written, or every object in use for a
        // buffer something asked for. Neither, and it names no range at all — one written here
        // would still be standing when the next write names its own and would pull that one
        // wide, while a buffer with no range uploads its whole array should anything mark it
        // after all, so keeping quiet costs nothing
        const range = asked ? {from: 0, to: usedCount - 1} : written;
        if (range == null) continue;

        setUploadRange(bufAttr, range.from, range.to, vertexCount, poolBuffer.itemSize);
      }
    }

    this.#fullUploads.clear();
  }

  /** Mark the buffers behind these attribute names, across every route, for a full upload. */
  touchAttributes(attrNames: string[]): void {
    this.#touch(this.#select(attrNames));
  }

  /**
   * Mark the buffers of these usage types for a full upload: across every route without a
   * `group`, and otherwise only across the routes that feed the named half.
   */
  touchByUsage(bufferTypes: TouchBuffersType, group?: RouteGroup): void {
    this.#touch(this.#selectByUsage(bufferTypes, group));
  }

  /** The buffers behind these attribute names, across every route. */
  #select(attrNames: string[]): BufferLike[] {
    const selected: BufferLike[] = [];
    for (const route of this) {
      selected.push(...selectAttributes(route.pool, route.buffers, attrNames));
    }
    return selected;
  }

  /**
   * The buffers of these usage types: across every route without a `group`, and otherwise only
   * across the routes that feed the named half of an instanced geometry.
   */
  #selectByUsage(bufferTypes: TouchBuffersType, group?: RouteGroup): BufferLike[] {
    const selected: BufferLike[] = [];
    for (const route of this) {
      // an attached route always carries group: 'instanced', so asking for that group already
      // reaches it through the term above — group: 'instanced' is the invariant attach() types
      const feeds = group === undefined || route.group === group;
      if (!feeds) continue;

      selected.push(...selectBuffers(route.buffers, bufferTypes));
    }
    return selected;
  }

  /** Mark everything that uploads without being asked for the next GPU upload. */
  autoTouch(): void {
    for (const route of this) {
      if (route.firstAutoTouch) {
        this.#touch(selectBuffers(route.buffers, {static: true}));
        route.firstAutoTouch = false;
      }
    }

    this.#touch(this.#getAutoTouchBuffers());
  }

  /** Give up every route and every piece of bookkeeping over them. */
  clear(): void {
    this.#routes.length = 0;
    this.#attached.clear();
    this.#dropAutoTouchSelection();
    // these are the very THREE.BufferAttributes the caller is letting go of
    this.#fullUploads.clear();
  }

  /**
   * The buffers something asked for since the last `syncUploads()`. Nobody knows which values a
   * generated setter wrote, so each of them uploads every object in use rather than the range
   * the pool recorded — and `needsUpdate` on a `THREE.BufferAttribute` is a bare setter that
   * cannot be read back to find out afterwards.
   */
  readonly #fullUploads = new Set<BufferLike>();

  #autoTouchBuffers?: BufferLike[];

  /**
   * Mark these buffers for the next GPU upload, and for one that carries every object in use.
   *
   * The range a buffer carries goes as well. It names the objects of some earlier write and is
   * narrower than what is being asked for here, and a render that comes before the next
   * `update()` would upload that alone; with no range at all three uploads the whole array,
   * which is the answer for a caller who cannot say what was written.
   */
  #touch(buffers: BufferLike[]): void {
    markForUpload(buffers);
    for (const buffer of buffers) {
      buffer.clearUpdateRanges();
      this.#fullUploads.add(buffer);
    }
  }

  /**
   * Let go of the resolved selection, so the next `autoTouch()` builds it from the routes there
   * are then. Every change to the routes goes through here: a selection that still names a route
   * which has gone holds that route's `THREE.BufferAttribute`s, and one resolved before a route
   * arrived knows none of its buffers.
   *
   * What a route owes in the way of a first upload is a separate answer and stays where it is:
   * a route that leaves does not put the remaining ones back in debt.
   */
  #dropAutoTouchSelection(): void {
    this.#autoTouchBuffers = undefined;
  }

  /**
   * The buffers behind the attributes that carry `autoTouch`, resolved once across every route.
   * The selection changes only when a route is added or given up.
   */
  #getAutoTouchBuffers(): BufferLike[] {
    if (this.#autoTouchBuffers == null) {
      const attrNames: string[] = [];
      for (const route of this) {
        for (const attr of route.pool.descriptor.attributes.values()) {
          if (attr.autoTouch) {
            attrNames.push(attr.name);
          }
        }
      }

      // every route answers with the buffers it holds for these names, and a name a route does
      // not carry selects nothing there
      const buffers: BufferLike[] = [];
      for (const route of this) {
        buffers.push(...selectAttributes(route.pool, route.buffers, attrNames));
      }
      this.#autoTouchBuffers = buffers;
    }
    return this.#autoTouchBuffers;
  }
}
