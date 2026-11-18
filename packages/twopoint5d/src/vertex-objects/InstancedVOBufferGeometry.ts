import {describeValue} from '../utils/describeValue.js';
import {BufferGeometry, InstancedBufferGeometry} from 'three/webgpu';
import {VOBufferPool} from './VOBufferPool.js';
import {VOGeometryPools, drawCountOf} from './VOGeometryPools.js';
import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectPool} from './VertexObjectPool.js';
import {asInstancedCopySource} from './asInstancedCopySource.js';
import {attributeNamesOf} from './attributeNamesOf.js';
import {checkPoolCapacity} from './checkPoolCapacity.js';
import {initializeAttributes, initializeInstancedAttributes} from './initializeAttributes.js';
import type {BufferLike, TouchBuffersType, TouchInstancedBuffersType, VertexObjectDescription} from './types.js';

/**
 * `VOBufferGeometry` for instanced rendering: one base pool and any number of instanced
 * pools on a `THREE.InstancedBufferGeometry`. It works on buffer indices and knows no object
 * type: the layer below `InstancedVertexObjectGeometry`.
 */
export class InstancedVOBufferGeometry extends InstancedBufferGeometry {
  /**
   * The pool this geometry builds its base route from, when it has one. Answers with it after
   * `dispose()` as well: disposed with the geometry when the geometry built it itself, otherwise
   * exactly as the caller holds it — see {@link dispose}.
   */
  readonly basePool?: VOBufferPool;

  readonly #baseBuffers?: Map<string, BufferLike>;

  readonly #baseBufferSerials: Map<string, number> = new Map();
  readonly #instancedBufferSerials: Map<string, number> = new Map();

  /**
   * The pool this geometry builds its instanced route from. Answers with it after `dispose()`
   * as well: disposed with the geometry when the geometry built it itself, otherwise exactly as
   * the caller holds it — see {@link dispose}.
   */
  readonly instancedPool: VOBufferPool;
  readonly #instancedBuffers: Map<string, BufferLike> = new Map();

  /**
   * The three.js buffer behind each buffer name of the base pool. Set exactly when `basePool`
   * is — the constructor builds the base route as a whole or not at all. Empty after
   * `dispose()`; stays `undefined` for a geometry without a base pool.
   */
  get baseBuffers(): ReadonlyMap<string, BufferLike> | undefined {
    return this.#baseBuffers;
  }

  /** The serial this geometry last saw for each buffer of the base pool; empty after `dispose()`. */
  get baseBufferSerials(): ReadonlyMap<string, number> {
    return this.#baseBufferSerials;
  }

  /** The three.js buffer behind each buffer name of the instanced pool; empty after `dispose()`. */
  get instancedBuffers(): ReadonlyMap<string, BufferLike> {
    return this.#instancedBuffers;
  }

  /** The serial this geometry last saw for each buffer of the instanced pool; empty after `dispose()`. */
  get instancedBufferSerials(): ReadonlyMap<string, number> {
    return this.#instancedBufferSerials;
  }

  readonly #pools = new VOGeometryPools();

  /**
   * The pools attached under a name, and the buffers and serials of their routes. All three are
   * views of the same routes, so a name that has a pool has the other two. Empty after
   * `dispose()`, which gives up every route.
   */
  readonly extraInstancedPools: ReadonlyMap<string, VertexObjectPool<unknown>> = this.#pools.routes.attachedPools;
  readonly extraInstancedBuffers: ReadonlyMap<string, ReadonlyMap<string, BufferLike>> = this.#pools.routes.attachedBuffers;
  readonly extraInstancedBufferSerials: ReadonlyMap<string, ReadonlyMap<string, number>> =
    this.#pools.routes.attachedBufferSerials;

  /**
   * The base route, the instanced route and the attributes copied from a `BufferGeometry` handed
   * in here may all claim the same attribute name; the route that initializes later shows its
   * attribute, and {@link attachInstancedPool} refuses that name afterwards. Until this
   * constructor returns, no attribute of this geometry has reached the renderer, so one that is
   * displaced here holds no gpu buffer — which is exactly what makes it safe to displace it.
   *
   * Built from a `BufferGeometry`, the geometry copies its attributes, its index and its draw
   * range; `update()` leaves that draw range as it is.
   *
   * The geometry draws no instance until its first `update()`: `instanceCount` starts at 0, built
   * from a `BufferGeometry` as well, under WebGPU and under WebGL 2.
   *
   * @throws a `RangeError` when the instanced source is a pool and the capacity is not its
   *   capacity, and when the base source is a pool and a base capacity follows that is not its
   *   capacity: a geometry takes its sizes from the pools it is handed, so the caller hands in
   *   `pool.capacity`, or leaves the base capacity out. The check comes before anything else, and
   *   the pools are left as they were.
   * @throws when the instanced pool or the base pool handed in has been disposed and holds no
   *   buffers to build attributes on. The message names the class, which of the two it is about
   *   and the state, and no geometry comes into being. Whatever the constructor throws, a pool it
   *   built from a descriptor or description is disposed, and a pool handed in is left as it was.
   */
  constructor(
    ...args:
      | [VOBufferPool | VertexObjectDescriptor | VertexObjectDescription, number, BufferGeometry]
      | [
          VOBufferPool | VertexObjectDescriptor | VertexObjectDescription,
          number,
          VOBufferPool | VertexObjectDescriptor | VertexObjectDescription,
          number?,
        ]
  ) {
    if (args[0] instanceof VOBufferPool) {
      checkPoolCapacity('new InstancedVOBufferGeometry()', 'capacity', 'the instanced pool', args[0], args[1]);
    }
    if (args[2] instanceof VOBufferPool && args[3] !== undefined) {
      checkPoolCapacity('new InstancedVOBufferGeometry()', 'the base capacity', 'the base pool', args[2], args[3]);
    }

    // before super(), so that a geometry which cannot get its attributes never comes into being
    if (args[0] instanceof VOBufferPool && args[0].isDisposed) {
      throw new Error(
        'InstancedVOBufferGeometry: the instanced pool handed to the constructor has been disposed and holds no ' +
          'buffers to build attributes on. Build the geometry while the pool is alive, or hand it a live pool.',
      );
    }
    if (args[2] instanceof VOBufferPool && args[2].isDisposed) {
      throw new Error(
        'InstancedVOBufferGeometry: the base pool handed to the constructor has been disposed and holds no ' +
          'buffers to build attributes on. Build the geometry while the pool is alive, or hand it a live pool.',
      );
    }

    super();

    // held apart from the field, which the catch below may not read before it is assigned
    let instancedPool: VOBufferPool | undefined;
    try {
      const [instancedSource, instancedCapacity] = args;
      instancedPool =
        instancedSource instanceof VOBufferPool ? instancedSource : new VOBufferPool(instancedSource, instancedCapacity);
      this.instancedPool = instancedPool;
      if (!(instancedSource instanceof VOBufferPool)) {
        this.declareOwnedPool(this.instancedPool);
      }

      if (args[2] instanceof BufferGeometry) {
        this.copy(asInstancedCopySource(args[2]));
        // copy() cloned those attributes, so they are this geometry's own and no pool feeds them;
        // they are claimed before any route initializes, so a route that takes such a slot gives
        // it back when it is released
        this.#pools.slots.claimExisting(this);
      } else {
        const baseSource = args[2];
        const baseCapacity = args[3] ?? 1;
        const basePool = baseSource instanceof VOBufferPool ? baseSource : new VOBufferPool(baseSource, baseCapacity);
        this.basePool = basePool;
        if (!(baseSource instanceof VOBufferPool)) {
          this.declareOwnedPool(basePool);
        }
        const baseBuffers = new Map<string, BufferLike>();
        this.#baseBuffers = baseBuffers;
        this.#pools.addRoute(
          this,
          {pool: basePool, buffers: baseBuffers, bufferSerials: this.#baseBufferSerials, group: 'base'},
          initializeAttributes,
        );
      }

      // after the copy(): BufferGeometry#copy() takes the name of its source, which is usually the empty string
      this.name = 'InstancedVOBufferGeometry';

      this.#pools.addRoute(
        this,
        {pool: instancedPool, buffers: this.#instancedBuffers, bufferSerials: this.#instancedBufferSerials, group: 'instanced'},
        initializeInstancedAttributes,
      );

      // three starts an InstancedBufferGeometry at an instanceCount of Infinity, and copy() of a plain
      // BufferGeometry leaves it undefined. A draw before the first update() hands either on to the
      // backend: WebGPU refuses Infinity in drawIndexed(), where WebGL 2 turns it into 0. Until
      // update() reads the instanced pool, no instance is drawn.
      this.instanceCount = 0;
    } catch (error) {
      // the throw may come before either pool is assigned
      this.#pools.abandon([instancedPool, this.basePool]);
      throw error;
    }
  }

  /**
   * Mark a pool as created for this geometry, which is what makes the geometry
   * release it on dispose. Pools that were handed in stay untouched.
   *
   * @internal
   */
  declareOwnedPool(pool: VOBufferPool): void {
    this.#pools.attachments.declareOwned(pool);
  }

  /**
   * Add extra vertex-object-descriptors (or existing pools).
   *
   * In the following update cycles the geometry will also synchronize these vertex-object-pools,
   * respectively their buffers with the corresponding gpu buffers.
   *
   * This is the way to combine attributes that are grouped across several
   * vertex-object-descriptors into the one geometry that draws them.
   *
   * A descriptor or description handed in here becomes a pool with the capacity of the
   * `.instancedPool` — **the reference instance count is derived from it.** An existing pool with
   * a different capacity can still be attached; matching it to the `.instancedPool` is then the
   * caller's responsibility.
   *
   * An attribute slot of this geometry belongs to one route for the whole life of the geometry:
   * a pool whose attributes would take a slot this geometry has already had an attribute in is
   * refused. The gpu buffer of a displaced attribute could never be handed back — three.js frees
   * one attribute per name, the one sitting in the slot when the geometry is disposed. Give such
   * a pool attribute names of its own, or build a second geometry for it. A route detached later
   * keeps its gpu memory until the geometry is disposed — see {@link detachInstancedPool}.
   *
   * Handing the same pool back under the name it already has changes nothing: every attribute
   * stays where it is, and an `autoDispose` passed along with it still takes effect.
   *
   * _Pro-Hint:_ It is also possible to attach a vertex-buffer-pool to several instanced geometries at the same time.
   *
   * @typeParam VOType - the vertex object type of the attached pool; `unknown` if not given.
   * @param name - unique key for this attached pool, used by {@link detachInstancedPool} and the
   *   `extraInstancedPools` / `extraInstancedBuffers` / `extraInstancedBufferSerials` maps.
   * @param pool - an existing {@link VertexObjectPool} or a descriptor / description that will be
   *   wrapped in a new pool with the capacity of the `.instancedPool`.
   * @param options.autoDispose - when `true`, the attached pool is disposed together with this
   *   geometry on {@link dispose}. The **default** is whether this geometry built the pool
   *   itself: a descriptor or description handed in here becomes a pool that belongs to this
   *   geometry (e.g. created on the fly when an `InstancedMesh` is built and torn down again),
   *   while a pool from elsewhere belongs to the caller. That answer follows the pool, so handing
   *   a pool this geometry built back to it under the name it already has keeps it owned here.
   *   Set to `false` when the same pool is shared with other geometries or otherwise managed by
   *   the caller — in that case the pool will be detached from the internal bookkeeping on
   *   `dispose`, but its buffers and typed arrays remain untouched and the caller is responsible
   *   for releasing them.
   * @throws when an attribute of `pool` would take an attribute slot that this geometry has
   *   already had an attribute in. The message names the call and every slot it is about, and
   *   the geometry is left exactly as it was; a pool built here from a descriptor is disposed.
   * @throws whatever the attributes of `pool` throw as they are built. The geometry is left as it
   *   was — the route that holds `name` keeps every attribute it has, and a pool built here from a
   *   descriptor is disposed — and the error reaches the caller as it was thrown.
   * @throws when `pool` has been disposed and holds no buffers to build attributes on. The route
   *   that holds `name` at the time keeps every attribute it has.
   * @throws when this geometry has been disposed. The declared return type promises a pool, and
   *   a disposed geometry has no route left to build one on; `pool` is attached to nothing.
   */
  attachInstancedPool<VOType = unknown>(
    name: string,
    pool: VertexObjectPool<VOType> | VertexObjectDescriptor | VertexObjectDescription,
    options?: {autoDispose?: boolean},
  ): VertexObjectPool<VOType> {
    if (this.#pools.isDisposed) {
      throw new Error(
        `InstancedVOBufferGeometry#attachInstancedPool(${describeValue(name)}) is not available: this geometry has been disposed`,
      );
    }

    // the same pool taking its own name over again changes nothing about the slots, and
    // rebuilding the attributes would push the live ones off the geometry for good
    if (pool instanceof VertexObjectPool && this.extraInstancedPools.get(name) === pool) {
      if (options?.autoDispose !== undefined) {
        this.#pools.routes.setAutoDispose(name, options.autoDispose);
      }
      return pool;
    }

    // asked before the descriptor is wrapped below, or every pool would look self-made afterwards
    const ownsPool = !(pool instanceof VertexObjectPool);

    let extraPool: VertexObjectPool<VOType>;
    if (ownsPool) {
      extraPool = new VertexObjectPool(pool, this.instancedPool.capacity) as VertexObjectPool<VOType>;
    } else {
      extraPool = pool;
    }

    // a pool without buffers claims no attribute slot, so the guard below would let it through
    // and the route would come up empty
    if (extraPool.isDisposed) {
      throw new Error(
        `InstancedVOBufferGeometry#attachInstancedPool(${describeValue(name)}): this pool has been disposed and holds no ` +
          'buffers to build attributes on. Attach a live pool, or leave the name free.',
      );
    }

    // three.js frees a gpu buffer only through the dispose event of the geometry, and there
    // for exactly one attribute per name — the one sitting in the slot at that moment. An
    // attribute a second route pushes out of a slot can never be handed back, so the slot is
    // refused instead of leaking it
    const taken = this.#pools.slots.everHeld(attributeNamesOf(extraPool));
    if (taken.length > 0) {
      const slots = taken.map(describeValue).join(', ');
      // the pool was built for this call alone, and a refused call leaves nothing behind
      if (ownsPool) extraPool.dispose();
      throw new Error(
        `InstancedVOBufferGeometry#attachInstancedPool(${describeValue(name)}): this geometry has already had an attribute in the slot ${slots}. ` +
          'An attribute slot belongs to one route for the life of the geometry — give this pool attribute names of its own, ' +
          'or build a new geometry.',
      );
    }

    const buffers = new Map<string, BufferLike>();
    const bufferSerials = new Map<string, number>();

    this.#pools.attachments.attach(extraPool);

    try {
      initializeInstancedAttributes(this, extraPool, buffers, bufferSerials, this.#pools.slots);
    } catch (error) {
      // nothing of this attempt has reached the renderer: its slots, its attachment and a pool
      // built for it go, and the route that holds the name has not been touched yet
      this.#pools.slots.withdrawRoute(this, buffers);
      this.#pools.attachments.detach(extraPool);
      if (ownsPool) extraPool.dispose();
      throw error;
    }

    // only once the attributes stand: a pool that is refused or fails is not one of this geometry's own
    if (ownsPool) {
      this.declareOwnedPool(extraPool);
    }

    // the route that held the name goes only now that its successor stands — the guard above
    // keeps their slots apart
    this.#pools.detach(this, name);

    // `autoDispose` carries only what the caller said out loud: whether the geometry built the
    // pool is answered by the attachments, and that answer belongs to the pool rather than to
    // the name it is under
    this.#pools.routes.attach({
      name,
      // the routes read no vertex object of the pool, and TypeScript holds VertexObjectPool<T>
      // invariant in T (`onCreateVO`, `adoptVOs()`), so the type parameter is erased here, at the
      // one place a named route comes into being
      pool: extraPool as VertexObjectPool<unknown>,
      buffers,
      bufferSerials,
      group: 'instanced',
      autoDispose: options?.autoDispose,
    });

    return extraPool;
  }

  /**
   * Release the pool attached under `name` and take the attributes that were built on its
   * buffers off this geometry.
   *
   * Both halves belong together: as long as an attribute reads from the pool's typed arrays,
   * the pool has to keep reporting itself as attached, or a `resize()` would swap those arrays
   * out from under the geometry. The slots of this route are empty when it is gone, and they
   * stay taken for the life of the geometry — {@link attachInstancedPool} refuses a later route
   * that asks for one of them.
   *
   * A pool that belongs to this geometry — one built here from a descriptor, or attached with
   * `autoDispose: true` — is disposed as its last route from this geometry goes away. It is
   * still returned, so a caller who wants to look at it can, but it is dead. A pool that is
   * shared with another geometry is the caller's to keep alive: attach it with
   * `autoDispose: false`.
   *
   * The attributes this route put on the geometry are gone afterwards. A material whose shader
   * still reads one of them cannot render this geometry any more — give the geometry a material
   * that matches the routes it has left, or take it out of the scene. Disposing the geometry goes
   * through either way.
   *
   * After `dispose()` every name is free: this answers `undefined` for any `name`, the way it
   * does before a route was ever attached under it.
   *
   * The gpu memory of the attributes this route built stays in use until this geometry is
   * disposed: three.js frees the gpu buffer of an attribute only through the dispose event of the
   * geometry, and the slot keeps the attribute, with an empty array, until then. A long-lived
   * geometry that attaches and detaches pools under new attribute names again and again holds the
   * gpu buffers of every one of them until `dispose()` — for changes like that, build a new
   * geometry.
   *
   * @returns the pool that was attached under `name`, or `undefined` if the name was free.
   */
  detachInstancedPool(name: string): VertexObjectPool<unknown> | undefined {
    return this.#pools.detach(this, name);
  }

  /**
   * Releases the resources this geometry owns.
   *
   * The attributes built on the pool buffers leave the geometry and the index is dropped, so
   * nothing keeps the typed arrays alive through this geometry any more. Attributes copied from
   * a `BufferGeometry` handed to the constructor stay where they are: no pool feeds them and
   * nothing has to take them off. `copy()` cloned them, so they and their typed arrays belong to
   * this geometry and fall with it, while the geometry they were cloned from stays untouched.
   * A slot that an earlier `detachInstancedPool()` left empty is empty again when this returns.
   *
   * A `basePool` or `instancedPool` this geometry created itself is disposed with it; a pool
   * that was handed in is left exactly as it is. For extra pools the `autoDispose` option of
   * {@link attachInstancedPool} decides, and defaults to the same rule.
   *
   * After this call the geometry holds no route, no buffer and no pool of its own any more.
   * What stays behind belongs to the attributes that are still there: their serials from the
   * last `update()`. `update()` is a no-op from here on and `attachInstancedPool()` throws — see
   * both.
   *
   * A second call does nothing. A listener of the dispose event that throws holds up none of
   * this: its error reaches the caller once the geometry is down.
   */
  override dispose(): void {
    this.#pools.dispose(this, () => super.dispose());
  }

  /**
   * Marks the buffers behind the given attribute names, across every route, for GPU upload on the
   * next `update()`, which uploads every object in use of each pool and nothing for a pool without
   * one. Does nothing after `dispose()`, which leaves no route to mark.
   */
  touchAttributes(...attrNames: string[]): void;
  touchAttributes(): void {
    // read through `arguments` rather than the rest parameter of the signature:
    // docs/architecture.md, `vertex-objects/`
    // biome-ignore lint/complexity/noArguments: only the count is read, see the comment above the loop
    for (let i = 0; i < arguments.length; i++) {
      // biome-ignore lint/complexity/noArguments: see the comment above the loop
      this.#pools.routes.touchAttribute(arguments[i] as string);
    }
  }

  /**
   * Marks every buffer of the given usage types, across every route, for GPU upload on the next
   * `update()`, which uploads every object in use of each pool and nothing for a pool without one.
   * Does nothing after `dispose()`, which leaves no route to mark.
   */
  touchBuffers(bufferTypes: TouchInstancedBuffersType | TouchBuffersType): void {
    this.#pools.touchBuffers(bufferTypes);
  }

  /**
   * Marks buffers for GPU upload on the next `update()`, by attribute name, by usage type, or a
   * mix of both; every argument counts on its own. That `update()` uploads every object in use of
   * each pool behind the marked buffers, and nothing for a pool without one. This is the
   * counterpart to `autoTouch: false` (see `VADescription#autoTouch`): an attribute without
   * `autoTouch` uploads only through an explicit `touch()` after its values were written, or
   * through `VertexObjectPool#touchVO()`, which uploads the slots it names alone.
   */
  touch(...args: Array<string | TouchBuffersType | TouchInstancedBuffersType>): void;
  touch(): void {
    // read through `arguments` rather than the rest parameter of the signature:
    // docs/architecture.md, `vertex-objects/`
    // biome-ignore lint/complexity/noArguments: only the count is read, see the comment above the loop
    for (let i = 0; i < arguments.length; i++) {
      // biome-ignore lint/complexity/noArguments: see the comment above the loop
      this.#pools.touch(arguments[i] as string | TouchBuffersType | TouchInstancedBuffersType);
    }
  }

  /**
   * Sets `instanceCount` from the instanced pool — until the first call it is 0 — and, on a
   * geometry with a base pool, the draw range from that pool, uploads the buffers that need it and
   * syncs the attribute arrays to the pools' own. A geometry built from a `BufferGeometry` keeps
   * the draw range it copied from it, and one set on it since.
   *
   * A no-op after `dispose()`: the geometry has no attribute left to draw or upload, and an
   * `instanceCount` or draw range taken from a pool that is still alive would name instances or
   * vertices this geometry no longer has.
   */
  update(): void {
    if (this.#pools.isDisposed) return;

    this.instanceCount = this.instancedPool.usedCount;
    // without a base pool the draw range is the one copied from the BufferGeometry handed in, or
    // whatever the caller set since
    if (this.basePool) {
      this.setDrawRange(0, drawCountOf(this.basePool));
    }
    this.#pools.sync(this.instanceCount > 0);
  }
}
