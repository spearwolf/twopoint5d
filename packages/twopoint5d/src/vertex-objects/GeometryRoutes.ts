import type {AttributeRoute} from './GeometryAttributeSlots.js';
import type {VOBufferPool} from './VOBufferPool.js';
import type {VertexObjectPool} from './VertexObjectPool.js';
import {selectAttributes} from './selectAttributes.js';
import {selectBuffers} from './selectBuffers.js';
import type {BufferLike, TouchBuffersType} from './types.js';
import {updateUpdateRange} from './updateUpdateRange.js';

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
};

/** Mark every one of these buffers for the next GPU upload. */
export function markForUpload(buffers: BufferLike[]): void {
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
  readonly attachedBuffers: ReadonlyMap<string, AttributeRoute> = projectValues(this.#attached, (route) => route.buffers);

  /** The buffer serials of the named routes, keyed by their name. */
  readonly attachedBufferSerials: ReadonlyMap<string, Map<string, number>> = projectValues(
    this.#attached,
    (route) => route.bufferSerials,
  );

  /** Take on a route the geometry has just built, in the order it was built. */
  add(route: GeometryRoute): void {
    this.#routes.push(route);
    this.#dropAutoTouchSelection();
  }

  /** Take on a named route. A name that is in use keeps its route — the caller detaches first. */
  attach(route: GeometryRoute & {name: string}): void {
    if (this.#attached.has(route.name)) return;

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

  /** Mark every buffer whose pool has moved on since the last look for the next GPU upload. */
  checkSerials(): void {
    for (const route of this) {
      for (const [bufferName, buffer] of route.buffers) {
        const poolBuffer = route.pool.buffer.buffers.get(bufferName);
        // a pool that has been disposed elsewhere carries no buffer to compare against; the rest
        // of the update path already treats that as a regular state and leaves the attribute alone
        if (poolBuffer == null) continue;

        const serial = route.bufferSerials.get(bufferName);
        if (serial !== poolBuffer.serial) {
          buffer.needsUpdate = true;
          route.bufferSerials.set(bufferName, poolBuffer.serial);
        }
      }
    }
  }

  /** Bring the upload range of every buffer in line with how much of its pool is in use. */
  updateRanges(): void {
    for (const route of this) {
      updateUpdateRange(route.pool, route.buffers);
    }
  }

  /** The buffers behind these attribute names, across every route. */
  select(attrNames: string[]): BufferLike[] {
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
  selectByUsage(bufferTypes: TouchBuffersType, group?: RouteGroup): BufferLike[] {
    const selected: BufferLike[] = [];
    for (const route of this) {
      // an attached pool feeds the instanced half, so asking for that half reaches it too
      const feeds = group === undefined || route.group === group || (group === 'instanced' && route.name != null);
      if (!feeds) continue;

      selected.push(...selectBuffers(route.buffers, bufferTypes));
    }
    return selected;
  }

  /** Mark everything that uploads without being asked for the next GPU upload. */
  autoTouch(): void {
    if (this.#firstAutoTouch) {
      markForUpload(this.selectByUsage({static: true}));
      this.#firstAutoTouch = false;
    }

    markForUpload(this.#getAutoTouchBuffers());
  }

  /**
   * The next `autoTouch()` uploads every static buffer of the geometry once more, on top of
   * building the selection afresh.
   *
   * The full pass is the expensive half and answers a question of its own: whether there are
   * attributes on this geometry that have never reached the gpu. A route coming or going does
   * not ask it — that only makes the selection stale, which the routes see to themselves.
   */
  resetAutoTouch(): void {
    this.#firstAutoTouch = true;
    this.#dropAutoTouchSelection();
  }

  /** Give up every route and every piece of bookkeeping over them. */
  clear(): void {
    this.#routes.length = 0;
    this.#attached.clear();
    this.#dropAutoTouchSelection();
  }

  #firstAutoTouch = true;

  #autoTouchBuffers?: BufferLike[];

  /**
   * Let go of the resolved selection, so the next `autoTouch()` builds it from the routes there
   * are then. Every change to the routes goes through here: a selection that still names a route
   * which has gone holds that route's `THREE.BufferAttribute`s, and one resolved before a route
   * arrived knows none of its buffers.
   *
   * Deliberately not {@link resetAutoTouch}: what a geometry owes in the way of a first upload
   * is a separate answer, and a route that leaves does not put the remaining ones back in debt.
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
