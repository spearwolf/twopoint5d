import type {BufferAttribute, BufferGeometry, InterleavedBufferAttribute} from 'three/webgpu';
import type {AttributeRoute} from './GeometryAttributeSlots.js';
import {GeometryAttributeSlots} from './GeometryAttributeSlots.js';
import {GeometryPoolAttachments} from './GeometryPoolAttachments.js';
import type {GeometryRoute} from './GeometryRoutes.js';
import {GeometryRoutes} from './GeometryRoutes.js';
import type {VOBufferPool} from './VOBufferPool.js';
import type {VertexObjectPool} from './VertexObjectPool.js';
import type {TouchBuffersType, TouchInstancedBuffersType} from './types.js';

// three frees the gpu buffer of an attribute by its identity and the size it booked when it
// built the buffer, and reads no array to do so: an attribute that is only lent back for the
// dispose event can let go of the typed array of its pool
function giveUpArray(attr: BufferAttribute | InterleavedBufferAttribute): void {
  const holder = 'isInterleavedBufferAttribute' in attr ? attr.data : attr;
  holder.array = new (holder.array.constructor as new (length: number) => typeof holder.array)(0);
  // `count` is read-only in the types of an InterleavedBuffer, a plain field at run time
  (holder as {count: number}).count = 0;
}

/** How a route builds its attributes: `initializeAttributes()` or `initializeInstancedAttributes()`. */
type InitializeRoute = (
  geometry: BufferGeometry,
  pool: VOBufferPool,
  buffers: AttributeRoute,
  bufferSerials: Map<string, number>,
  slots: GeometryAttributeSlots,
) => void;

/** How many vertices a pool draws: its objects in use times the indices or the vertices of one object. */
export function drawCountOf(pool: VOBufferPool): number {
  return pool.descriptor.hasIndices
    ? pool.usedCount * pool.descriptor.indices.length
    : pool.usedCount * pool.descriptor.vertexCount;
}

/**
 * What a vertex object geometry holds about the pools it draws: the routes it reaches them
 * through, how often it is attached to each pool and which of them it built, which route put the
 * attribute into each slot, the slots a detached route left empty, and whether the geometry has
 * been disposed. Every call that builds, touches, updates or tears down a route goes through
 * here, so `VOBufferGeometry` and `InstancedVOBufferGeometry` follow one set of rules.
 *
 * A delegate rather than a base class: the one geometry extends `THREE.BufferGeometry`, the other
 * `THREE.InstancedBufferGeometry`, so the two share no class of their own above them.
 *
 * @internal
 */
export class VOGeometryPools {
  readonly attachments = new GeometryPoolAttachments();
  readonly slots = new GeometryAttributeSlots();
  readonly routes = new GeometryRoutes();

  #disposed = false;

  /**
   * The attributes that a detached route left behind in slots nothing else fills. The renderer
   * keeps naming them for as long as it holds a pipeline built for this geometry, so `dispose()`
   * lends them back to their slots for the length of the dispose event.
   *
   * Only slots that stay empty are collected — one that falls back to the claim underneath is
   * filled and belongs to the route it fell back to. A vacated name is never filled again, so
   * there is at most one entry per name and it lives until `dispose()`: a geometry that gives up
   * many routes with different attribute names holds one attribute per name until then, and each
   * of them holds an empty array: it gave up the typed array of its pool as its route was detached.
   */
  readonly #vacatedSlots: Map<string, BufferAttribute | InterleavedBufferAttribute> = new Map();

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /** Attach the pool of `route`, build its attributes on `geometry` and take the route on. */
  addRoute(geometry: BufferGeometry, route: GeometryRoute, initialize: InitializeRoute): void {
    this.attachments.attach(route.pool);
    initialize(geometry, route.pool, route.buffers, route.bufferSerials, this.slots);
    this.routes.add(route);
  }

  /**
   * Clean up after a constructor that throws: every pool gives up its attachment, and each of
   * `pools` the geometry built itself is disposed.
   */
  abandon(pools: ReadonlyArray<VOBufferPool | undefined>): void {
    // a constructor that throws leaves nothing behind: a pool it built goes, and a pool handed
    // in is no longer counted as attached
    this.attachments.detachAll();
    for (const pool of pools) {
      if (pool !== undefined && this.attachments.owns(pool)) {
        pool.dispose();
      }
    }
  }

  /**
   * Take the route `name` off `geometry`, and release its pool when the geometry no longer
   * reaches it and the route says so.
   *
   * @returns the pool that was attached under `name`, or `undefined` if the name was free.
   */
  detach(geometry: BufferGeometry, name: string): VertexObjectPool<unknown> | undefined {
    const route = this.routes.route(name);
    const pool = route?.pool;
    const autoDispose = route != null && this.#releasesRoute(route);

    // from here on the geometry does not reach the pool under this name any more
    this.routes.detach(name);

    if (route != null) {
      for (const {attrName, vacated} of this.slots.releaseRoute(geometry, route.buffers)) {
        if (vacated != null) {
          giveUpArray(vacated);
          this.#vacatedSlots.set(attrName, vacated);
        }
      }
    }

    this.attachments.detach(pool);

    // a pool reaches a second route of this geometry only when it puts nothing into a slot: a
    // descriptor that declares no attributes. Its last route decides — releasing it while the
    // geometry still counts an attachment would leave a dead pool under a live route
    if (pool != null && !this.attachments.holds(pool)) {
      // nothing of this geometry reaches the pool from here on, so it stops counting as one of
      // its own — a pool that survives its detach is a pool from outside when it comes back
      this.attachments.forgetOwned(pool);

      if (autoDispose) {
        pool.dispose();
      }
    }

    return pool;
  }

  /** Mark buffers for a full upload on the next `update()`: by attribute name, or by usage type. */
  touch(arg: string | TouchBuffersType | TouchInstancedBuffersType): void {
    if (typeof arg === 'string') {
      this.routes.touchAttribute(arg);
    } else if ('base' in arg || 'instanced' in arg) {
      // on a geometry that reaches its one pool through a route without a group, usage types
      // addressed to the half of an instanced geometry name nothing and select nothing
      this.touchBuffers(arg);
    } else {
      // both object types have optional keys only, so `in` narrows the one branch and not the other
      this.routes.touchByUsage(arg as TouchBuffersType);
    }
  }

  /** Mark the buffers of these usage types, across every route or per half, for a full upload on the next `update()`. */
  touchBuffers(bufferTypes: TouchBuffersType | TouchInstancedBuffersType): void {
    if ('base' in bufferTypes || 'instanced' in bufferTypes) {
      if (bufferTypes.base) {
        this.routes.touchByUsage(bufferTypes.base, 'base');
      }
      if (bufferTypes.instanced) {
        this.routes.touchByUsage(bufferTypes.instanced, 'instanced');
      }
    } else {
      this.routes.touchByUsage(bufferTypes as TouchBuffersType);
    }
  }

  /**
   * Upload what needs it and point every attribute at the array of its pool. `drawsAnything`
   * says whether the geometry draws an object at all: one that draws nothing asks for nothing.
   */
  sync(drawsAnything: boolean): void {
    // before the uploads are synced: what is asked for here decides how wide each of them goes
    if (drawsAnything) this.routes.autoTouch();
    this.routes.syncUploads();
    this.routes.syncArrays();
  }

  /**
   * Tear the routes of `geometry` down around its dispose event, which `emitDispose` sends. A
   * second call does nothing.
   */
  dispose(geometry: BufferGeometry, emitDispose: () => void): void {
    if (this.#disposed) return;
    this.#disposed = true;

    // the renderer reads the attributes of this geometry once more while it handles the
    // dispose event, and reaches for the id of a slot before it checks that the slot is
    // filled — so the event goes out while every slot is there. A slot that a detached route
    // vacated is empty, and the attribute that left it goes back in for that one moment: the
    // renderer then finds what it names, frees its gpu buffer and finishes its bookkeeping.
    const lent: string[] = [];
    for (const [attrName, attr] of this.#vacatedSlots) {
      if (geometry.getAttribute(attrName) === undefined) {
        geometry.setAttribute(attrName, attr);
        lent.push(attrName);
      }
    }

    try {
      emitDispose();
    } finally {
      // a listener of the dispose event that throws holds up none of the teardown: its error
      // reaches the caller once the geometry is down, and a second dispose() has nothing left
      // to do
      for (const attrName of lent) {
        geometry.deleteAttribute(attrName);
      }
      this.#vacatedSlots.clear();

      // the geometry is gone either way, so every pool it held gives up its attachment
      this.attachments.detachAll();

      // an attribute left behind would still read from the pool arrays, and a geometry put back
      // into a scene after dispose() would have the renderer build fresh gpu buffers from them.
      // The unnamed routes come first, in the order they were built, then the named ones
      for (const route of this.routes) {
        this.slots.releaseRoute(geometry, route.buffers);
      }
      geometry.setIndex(null);

      // a pool behind two routes is called twice here, and dispose() of a pool is idempotent
      for (const route of this.routes) {
        if (this.#releasesRoute(route)) {
          route.pool.dispose();
        }
      }

      for (const route of this.routes) {
        route.buffers.clear();
        route.bufferSerials.clear();
      }
      // the resolved selection holds the very THREE.BufferAttributes this method is here to let go of
      this.routes.clear();
      this.attachments.clear();
    }
  }

  /**
   * Whether the pool of `route` is released with its last route: what the caller passed as
   * `autoDispose`, and otherwise whether the geometry built the pool.
   */
  #releasesRoute(route: GeometryRoute): boolean {
    return route.autoDispose ?? this.attachments.owns(route.pool);
  }
}
