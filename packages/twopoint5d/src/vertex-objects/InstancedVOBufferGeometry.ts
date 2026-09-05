import type {BufferAttribute, InterleavedBufferAttribute} from 'three/webgpu';
import {BufferGeometry, InstancedBufferGeometry} from 'three/webgpu';
import type {AttributeRoute, ReleasedSlot} from './GeometryAttributeSlots.js';
import {GeometryAttributeSlots} from './GeometryAttributeSlots.js';
import {GeometryPoolAttachments} from './GeometryPoolAttachments.js';
import {VOBufferPool} from './VOBufferPool.js';
import {expectDefined} from '../utils/expectDefined.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectPool} from './VertexObjectPool.js';
import {asInstancedCopySource} from './asInstancedCopySource.js';
import {asThreeTypedArray} from './asThreeTypedArray.js';
import {attributeNamesOf} from './attributeNamesOf.js';
import {initializeAttributes} from './initializeAttributes.js';
import {initializeInstancedAttributes} from './initializeInstancedAttributes.js';
import {selectAttributes} from './selectAttributes.js';
import {selectBuffers} from './selectBuffers.js';
import type {BufferLike, TouchBuffersType, VertexObjectDescription} from './types.js';
import {updateUpdateRange} from './updateUpdateRange.js';

export type TouchInstancedBuffersType = {
  base?: TouchBuffersType;
  instanced?: TouchBuffersType;
};

export class InstancedVOBufferGeometry extends InstancedBufferGeometry {
  readonly basePool?: VOBufferPool;
  /** Set exactly when `basePool` is — the constructor builds the base route as a whole or not at all. */
  readonly baseBuffers?: Map<string, BufferLike>;

  readonly baseBufferSerials: Map<string, number> = new Map();
  readonly instancedBufferSerials: Map<string, number> = new Map();

  readonly instancedPool: VOBufferPool;
  readonly instancedBuffers: Map<string, BufferLike> = new Map();

  /**
   * The pools attached under a name, and the buffers and serials of their routes. All three are
   * keyed alike and filled and emptied together, so a name that has a pool has the other two.
   */
  readonly extraInstancedPools: Map<string, VOBufferPool> = new Map();
  readonly extraInstancedBuffers: Map<string, Map<string, BufferLike>> = new Map();
  readonly extraInstancedBufferSerials: Map<string, Map<string, number>> = new Map();

  readonly #extraInstancedPoolAutoDispose: Map<string, boolean> = new Map();

  /**
   * The attributes that a detached route left behind in slots nothing else fills. The renderer
   * keeps naming them for as long as it holds a pipeline built for this geometry, so `dispose()`
   * lends them back to their slots for the length of the dispose event.
   *
   * Only slots that stay empty are collected — one that falls back to the claim underneath is
   * filled and belongs to the route it fell back to. A vacated name is never filled again, so
   * there is at most one entry per name and it lives until `dispose()`: a geometry that gives up
   * many routes with different attribute names holds one attribute, and its typed array, per
   * name until then.
   */
  readonly #vacatedSlots: Map<string, BufferAttribute | InterleavedBufferAttribute> = new Map();

  readonly #attachments = new GeometryPoolAttachments();
  readonly #slots = new GeometryAttributeSlots();
  readonly #ownedPools = new Set<VOBufferPool>();

  /**
   * The base route, the instanced route and the attributes copied from a `BufferGeometry` handed
   * in here may all claim the same attribute name; the route that initializes later shows its
   * attribute, and {@link attachInstancedPool} refuses that name afterwards. Until this
   * constructor returns, no attribute of this geometry has reached the renderer, so one that is
   * displaced here holds no gpu buffer — which is exactly what makes it safe to displace it.
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
    super();

    this.name = 'InstancedVOBufferGeometry';

    const [instancedSource, instancedCapacity] = args;
    this.instancedPool =
      instancedSource instanceof VOBufferPool ? instancedSource : new VOBufferPool(instancedSource, instancedCapacity);
    if (!(instancedSource instanceof VOBufferPool)) {
      this.declareOwnedPool(this.instancedPool);
    }

    if (args[2] instanceof BufferGeometry) {
      this.copy(asInstancedCopySource(args[2]));
      // the attributes that came in with it belong to the caller and are claimed before any
      // route initializes, so a route that takes such a slot gives it back when it is released
      this.#slots.claimExisting(this);
    } else {
      const baseSource = args[2];
      const baseCapacity = args[3] ?? 1;
      this.basePool = baseSource instanceof VOBufferPool ? baseSource : new VOBufferPool(baseSource, baseCapacity);
      if (!(baseSource instanceof VOBufferPool)) {
        this.declareOwnedPool(this.basePool);
      }
      this.baseBuffers = new Map();
      this.#attachments.attach(this.basePool);
      initializeAttributes(this, this.basePool, this.baseBuffers, this.baseBufferSerials, this.#slots);
    }

    this.#attachments.attach(this.instancedPool);
    initializeInstancedAttributes(this, this.instancedPool, this.instancedBuffers, this.instancedBufferSerials, this.#slots);
  }

  /**
   * Mark a pool as created for this geometry, which is what makes the geometry
   * release it on dispose. Pools that were handed in stay untouched.
   *
   * @internal
   */
  declareOwnedPool(pool: VOBufferPool): void {
    this.#ownedPools.add(pool);
  }

  /**
   * Add extra vertex-object-descriptors (or existing pools).
   *
   * In the following update cycles the geometry will also synchronize these vertex-object-pools,
   * respectively their buffers with the corresponding gpu buffers.
   *
   * This can be very useful if you have instanced attributes that have a different _meshCount_ than that of the default `.instancedPool`.
   * Or you have grouped different attributes with the help of different vertex-object-descriptors and now want to combine them here.
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
   * a pool attribute names of its own, or build a second geometry for it.
   *
   * Handing the same pool back under the name it already has changes nothing: every attribute
   * stays where it is, and an `autoDispose` passed along with it still takes effect.
   *
   * _Pro-Hint:_ It is also possible to attach a vertex-buffer-pool to several instanced geometries at the same time.
   *
   * @typeParam VOType - the vertex object type of the attached pool; `unknown` if not given.
   * @param name - unique key for this attached pool, used by {@link detachInstancedPool} and the
   *   `extraInstancedPools` / `extraInstancedBuffers` / `extraInstancedBufferSerials` maps.
   * @param pool - an existing {@link VertexObjectPool} or a descriptor / description that will be wrapped in a new pool
   *   with the capacity of the `.instancedPool`.
   * @param options.autoDispose - when `true`, the attached pool is disposed together with this
   *   geometry on {@link dispose}. The **default** is whether this geometry built the pool itself: a descriptor or
   *   description handed in here becomes a pool that belongs to this geometry (e.g. created on the fly when an
   *   `InstancedMesh` is built and torn down again), while a pool from elsewhere belongs to the caller. That answer follows the
   *   pool, so handing a pool this geometry built back to it under the name it already has keeps it owned here.
   *   Set to `false` when the same
   *   pool is shared with other geometries or otherwise managed by the caller — in that case the pool will be
   *   detached from the internal bookkeeping on `dispose`, but its buffers and typed arrays remain untouched and the
   *   caller is responsible for releasing them.
   * @throws when an attribute of `pool` would take an attribute slot that this geometry has
   *   already had an attribute in. The message names the call and every slot it is about, and
   *   the geometry is left exactly as it was.
   */
  attachInstancedPool<VOType = unknown>(
    name: string,
    pool: VertexObjectPool<VOType> | VertexObjectDescriptor | VertexObjectDescription,
    options?: {autoDispose?: boolean},
  ): VertexObjectPool<VOType> {
    // the same pool taking its own name over again changes nothing about the slots, and
    // rebuilding the attributes would push the live ones off the geometry for good
    if (pool instanceof VertexObjectPool && this.extraInstancedPools.get(name) === pool) {
      if (options?.autoDispose !== undefined) {
        this.#extraInstancedPoolAutoDispose.set(name, options.autoDispose);
      }
      return pool;
    }

    // asked before the descriptor is wrapped below, or every pool would look self-made afterwards
    const ownsPool = !(pool instanceof VertexObjectPool);

    let extraPool: VertexObjectPool<VOType>;
    if (ownsPool) {
      const descriptor = pool instanceof VertexObjectDescriptor ? pool : new VertexObjectDescriptor(pool);
      extraPool = new VertexObjectPool(descriptor, this.instancedPool.capacity) as VertexObjectPool<VOType>;
    } else {
      extraPool = pool;
    }

    // three.js frees a gpu buffer only through the dispose event of the geometry, and there
    // for exactly one attribute per name — the one sitting in the slot at that moment. An
    // attribute a second route pushes out of a slot can never be handed back, so the slot is
    // refused instead of leaking it
    const taken = this.#slots.everHeld(attributeNamesOf(extraPool));
    if (taken.length > 0) {
      const slots = taken.map((attrName) => `"${attrName}"`).join(', ');
      throw new Error(
        `InstancedVOBufferGeometry#attachInstancedPool("${name}"): this geometry has already had an attribute in the slot ${slots}. ` +
          'An attribute slot belongs to one route for the life of the geometry — give this pool attribute names of its own, ' +
          'or build a new geometry.',
      );
    }

    // only once the guard above has let the pool through: a throw must leave nothing behind that
    // dispose() would release later
    if (ownsPool) {
      this.declareOwnedPool(extraPool);
    }

    // taking over a name that is already in use releases whatever was attached under it
    this.#detachRoute(name);

    this.extraInstancedPools.set(name, extraPool);
    this.#attachments.attach(extraPool);

    const buffers = new Map<string, BufferLike>();
    this.extraInstancedBuffers.set(name, buffers);

    const bufferSerials = new Map<string, number>();
    this.extraInstancedBufferSerials.set(name, bufferSerials);

    // only what the caller said out loud: whether the geometry built the pool is answered by
    // #ownedPools, and that answer belongs to the pool rather than to the name it is under
    if (options?.autoDispose !== undefined) {
      this.#extraInstancedPoolAutoDispose.set(name, options.autoDispose);
    }

    initializeInstancedAttributes(this, extraPool, buffers, bufferSerials, this.#slots);

    // the buffer selection is already gone with the detach above; what is still owed is the
    // first auto-touch, which uploads every attribute of the new route once
    this.#firstAutoTouch = true;

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
   * @returns the pool that was attached under `name`, or `undefined` if the name was free.
   */
  detachInstancedPool(name: string): VOBufferPool | undefined {
    return this.#detachRoute(name);
  }

  /** Take the route `name` off this geometry. */
  #detachRoute(name: string): VOBufferPool | undefined {
    const pool = this.extraInstancedPools.get(name);
    const buffers = this.extraInstancedBuffers.get(name);
    const autoDispose = pool != null && this.#releasesExtraPool(name, pool);

    // from here on the geometry does not reach the pool under this name any more
    this.extraInstancedPools.delete(name);
    this.extraInstancedBuffers.delete(name);
    this.extraInstancedBufferSerials.delete(name);
    this.#extraInstancedPoolAutoDispose.delete(name);

    if (buffers != null) {
      for (const {attrName, vacated} of this.#releaseSlots(buffers)) {
        if (vacated != null) {
          this.#vacatedSlots.set(attrName, vacated);
        }
      }
    }

    this.#attachments.detach(pool);
    this.#autoTouchBuffers = undefined;

    // a pool reaches a second route of this geometry only when it puts nothing into a slot: a
    // descriptor that declares no attributes, or a pool that was disposed before it was attached.
    // Its last route decides — releasing it while the geometry still counts an attachment would
    // leave a dead pool under a live route
    if (pool != null && !this.#attachments.holds(pool)) {
      // nothing of this geometry reaches the pool from here on, so it stops counting as one of
      // its own — a pool that survives its detach is a pool from outside when it comes back
      this.#ownedPools.delete(pool);

      if (autoDispose) {
        pool.dispose();
      }
    }

    return pool;
  }

  /**
   * Whether the pool attached under `name` is released with its last route: what the caller
   * passed as `autoDispose`, and otherwise whether this geometry built the pool.
   */
  #releasesExtraPool(name: string, pool: VOBufferPool): boolean {
    return this.#extraInstancedPoolAutoDispose.get(name) ?? this.#ownedPools.has(pool);
  }

  /** Give up every attribute slot of `route` and let go of what the geometry knew about them. */
  #releaseSlots(route: AttributeRoute): ReleasedSlot[] {
    const released = this.#slots.releaseRoute(this, route);
    for (const {attrName} of released) {
      // the slot has changed hands; the version #syncAttributeArrays compares against
      // belongs to the attribute that left
      this.#serials.delete(attrName);
    }
    return released;
  }

  /**
   * Releases the resources this geometry owns.
   *
   * The attributes built on the pool buffers leave the geometry and the index is dropped, so
   * nothing keeps the typed arrays alive through this geometry any more. Attributes copied from
   * a `BufferGeometry` handed to the constructor stay where they are — they belong to the caller.
   * A slot that an earlier `detachInstancedPool()` left empty is empty again when this returns.
   *
   * A `basePool` or `instancedPool` this geometry created itself is disposed with it; a pool
   * that was handed in is left exactly as it is. For extra pools the `autoDispose` option of
   * {@link attachInstancedPool} decides, and defaults to the same rule.
   *
   * After this call the geometry holds no route, no buffer and no pool of its own any more.
   * What stays behind belongs to the attributes that are still there: their serials from the
   * last `update()`, plus `#firstAutoTouch`.
   */
  override dispose(): void {
    // the renderer reads the attributes of this geometry once more while it handles the
    // dispose event, and reaches for the id of a slot before it checks that the slot is
    // filled — so the event goes out while every slot is there. A slot that a detached route
    // vacated is empty, and the attribute that left it goes back in for that one moment: the
    // renderer then finds what it names, frees its gpu buffer and finishes its bookkeeping.
    const lent: string[] = [];
    for (const [attrName, attr] of this.#vacatedSlots) {
      if (this.getAttribute(attrName) === undefined) {
        this.setAttribute(attrName, attr);
        lent.push(attrName);
      }
    }

    try {
      super.dispose();
    } finally {
      for (const attrName of lent) {
        this.deleteAttribute(attrName);
      }
      this.#vacatedSlots.clear();
    }

    // the geometry is gone either way, so every pool it held gives up its attachment
    this.#attachments.detachAll();

    // an attribute left behind would still read from the pool arrays, and a geometry put back
    // into a scene after dispose() would have the renderer build fresh gpu buffers from them
    if (this.baseBuffers != null) {
      this.#releaseSlots(this.baseBuffers);
    }
    this.#releaseSlots(this.instancedBuffers);
    for (const buffers of this.extraInstancedBuffers.values()) {
      this.#releaseSlots(buffers);
    }
    this.setIndex(null);

    if (this.#ownedPools.has(this.instancedPool)) {
      this.instancedPool.dispose();
    }
    if (this.basePool != null && this.#ownedPools.has(this.basePool)) {
      this.basePool.dispose();
    }
    for (const [name, pool] of this.extraInstancedPools) {
      if (this.#releasesExtraPool(name, pool)) {
        pool.dispose();
      }
    }

    this.baseBuffers?.clear();
    this.baseBufferSerials.clear();
    this.instancedBuffers.clear();
    this.instancedBufferSerials.clear();
    this.extraInstancedPools.clear();
    this.extraInstancedBuffers.clear();
    this.extraInstancedBufferSerials.clear();
    this.#extraInstancedPoolAutoDispose.clear();
    this.#ownedPools.clear();
    // the resolved selection holds the very THREE.BufferAttributes this method is here to let go of
    this.#autoTouchBuffers = undefined;
  }

  /** Marks the buffers behind the given attribute names, across every route, for GPU upload on the next `update()`. */
  touchAttributes(...attrNames: string[]): void {
    if (this.basePool) {
      selectAttributes(this.basePool, expectDefined(this.baseBuffers, 'the base buffers'), attrNames).forEach((buffer) => {
        buffer.needsUpdate = true;
      });
    }

    selectAttributes(this.instancedPool, this.instancedBuffers, attrNames).forEach((buffer) => {
      buffer.needsUpdate = true;
    });

    for (const [name, pool] of this.extraInstancedPools) {
      const buffers = expectDefined(this.extraInstancedBuffers.get(name), `the buffers of the pool attached as "${name}"`);
      selectAttributes(pool, buffers, attrNames).forEach((buffer) => {
        buffer.needsUpdate = true;
      });
    }
  }

  /** Marks every buffer of the given usage types, across every route, for GPU upload on the next `update()`. */
  touchBuffers(bufferTypes: TouchInstancedBuffersType | TouchBuffersType): void {
    if ('base' in bufferTypes || 'instanced' in bufferTypes) {
      if (bufferTypes.base && this.baseBuffers) {
        selectBuffers(this.baseBuffers, bufferTypes.base).forEach((buffer) => {
          buffer.needsUpdate = true;
        });
      }
      if (bufferTypes.instanced) {
        selectBuffers(this.instancedBuffers, bufferTypes.instanced).forEach((buffer) => {
          buffer.needsUpdate = true;
        });
        for (const buffers of this.extraInstancedBuffers.values()) {
          selectBuffers(buffers, bufferTypes.instanced).forEach((buffer) => {
            buffer.needsUpdate = true;
          });
        }
      }
    } else {
      if (this.baseBuffers) {
        selectBuffers(this.baseBuffers, bufferTypes as TouchBuffersType).forEach((buffer) => {
          buffer.needsUpdate = true;
        });
      }
      selectBuffers(this.instancedBuffers, bufferTypes as TouchBuffersType).forEach((buffer) => {
        buffer.needsUpdate = true;
      });
      for (const buffers of this.extraInstancedBuffers.values()) {
        selectBuffers(buffers, bufferTypes as TouchBuffersType).forEach((buffer) => {
          buffer.needsUpdate = true;
        });
      }
    }
  }

  /**
   * Marks buffers for GPU upload on the next `update()`, by attribute name, by usage type, or a
   * mix of both. This is the counterpart to `autoTouch: false` (see {@link VADescription#autoTouch}):
   * an attribute without `autoTouch` uploads only through an explicit `touch()` after its values
   * were written.
   */
  touch(...args: Array<string | TouchBuffersType | TouchInstancedBuffersType>): void {
    const attrNames: string[] = [];
    let buffers: TouchBuffersType | TouchInstancedBuffersType | undefined = undefined;
    args.forEach((arg) => {
      if (typeof arg === 'string') {
        attrNames.push(arg);
      } else {
        buffers = {...buffers, ...arg};
      }
    });
    if (attrNames.length) {
      this.touchAttributes(...attrNames);
    }
    if (buffers) {
      this.touchBuffers(buffers);
    }
  }

  update(): void {
    this.instanceCount = this.instancedPool.usedCount;
    this.#updateDrawRange();

    this.#checkBufferSerials();
    this.#autoTouchAttributes();
    this.#updateBuffersUpdateRange();

    this.#syncAttributeArrays();
  }

  #serials: Map<string, number> = new Map();

  /**
   * If the references to the attribute arrays in a {@link VOBufferPool} are swapped,
   * e.g. via a {@link VOBufferPool#fromBuffersData()} call, then of course the references
   * to the typed arrays within the `THREE.BufferAttribute` structure must also be changed.
   */
  #syncAttributeArrays() {
    for (const attrName in this.attributes) {
      const attr = this.attributes[attrName];
      const bufAttr = (attr as InterleavedBufferAttribute).isInterleavedBufferAttribute
        ? (attr as InterleavedBufferAttribute).data
        : (attr as BufferAttribute);

      // an attribute this geometry has not synced yet carries no serial, and undefined never
      // equals a version
      const version = bufAttr.version;
      if (this.#serials.get(attrName) === version) continue;
      this.#serials.set(attrName, version);

      // a slot without a pool holds an attribute copied from a `BufferGeometry` the caller
      // handed to the constructor: it belongs to the caller and is left exactly as it is
      const pool = this.#slots.poolOf(attrName);
      if (pool === undefined) continue;

      const poolBufInfo = pool.buffer.bufferAttributes.get(attrName);
      if (poolBufInfo === undefined) continue;

      const poolBuf = pool.buffer.buffers.get(poolBufInfo.bufferName);
      // the pool has been disposed, there is no array left to point at
      if (poolBuf === undefined) continue;

      bufAttr.array = asThreeTypedArray(poolBuf.typedArray!);
    }
  }

  #checkBufferSerials(): void {
    const checkBufferSerials = (pool: VOBufferPool, buffers: Map<string, BufferLike>, bufferSerials: Map<string, number>) => {
      for (const [bufferName, buffer] of buffers) {
        const poolBuffer = pool.buffer.buffers.get(bufferName);
        // a pool that has been disposed elsewhere carries no buffer to compare against; the rest
        // of the update path already treats that as a regular state and leaves the attribute alone
        if (poolBuffer == null) continue;

        const serial = bufferSerials.get(bufferName);
        if (serial !== poolBuffer.serial) {
          buffer.needsUpdate = true;
          bufferSerials.set(bufferName, poolBuffer.serial);
        }
      }
    };

    if (this.basePool) {
      checkBufferSerials(this.basePool, expectDefined(this.baseBuffers, 'the base buffers'), this.baseBufferSerials);
    }

    checkBufferSerials(this.instancedPool, this.instancedBuffers, this.instancedBufferSerials);

    for (const [name, pool] of this.extraInstancedPools) {
      const buffers = expectDefined(this.extraInstancedBuffers.get(name), `the buffers of the pool attached as "${name}"`);
      const bufferSerials = expectDefined(
        this.extraInstancedBufferSerials.get(name),
        `the buffer serials of the pool attached as "${name}"`,
      );
      checkBufferSerials(pool, buffers, bufferSerials);
    }
  }

  #updateBuffersUpdateRange() {
    updateUpdateRange(this.basePool, this.baseBuffers);
    updateUpdateRange(this.instancedPool, this.instancedBuffers);

    for (const [name, pool] of this.extraInstancedPools) {
      const buffers = expectDefined(this.extraInstancedBuffers.get(name), `the buffers of the pool attached as "${name}"`);
      updateUpdateRange(pool, buffers);
    }
  }

  #updateDrawRange() {
    if (this.basePool) {
      this.setDrawRange(
        0,
        this.basePool.descriptor.hasIndices
          ? this.basePool.usedCount * this.basePool.descriptor.indices.length
          : this.basePool.usedCount * this.basePool.descriptor.vertexCount,
      );
    } else {
      this.setDrawRange(0, Infinity);
    }
  }

  #firstAutoTouch = true;

  #autoTouchAttributes(): void {
    if (this.instanceCount === 0) return;

    if (this.#firstAutoTouch) {
      this.touchBuffers({static: true});
      this.#firstAutoTouch = false;
    }

    for (const buffer of this.#getAutoTouchBuffers()) {
      buffer.needsUpdate = true;
    }
  }

  #autoTouchBuffers?: BufferLike[];

  /**
   * The buffers behind the attributes that carry `autoTouch`, resolved once across every route
   * of this geometry. The selection changes only when a route is added or given up.
   */
  #getAutoTouchBuffers(): BufferLike[] {
    if (this.#autoTouchBuffers == null) {
      const attrNames: string[] = [];
      const collectNames = (pool: VOBufferPool) => {
        for (const attr of pool.descriptor.attributes.values()) {
          if (attr.autoTouch) {
            attrNames.push(attr.name);
          }
        }
      };
      collectNames(this.instancedPool);
      if (this.basePool) {
        collectNames(this.basePool);
      }
      for (const pool of this.extraInstancedPools.values()) {
        collectNames(pool);
      }

      // every route answers with the buffers it holds for these names, and a name a route does
      // not carry selects nothing there
      const buffers: BufferLike[] = [];
      if (this.basePool) {
        buffers.push(...selectAttributes(this.basePool, expectDefined(this.baseBuffers, 'the base buffers'), attrNames));
      }
      buffers.push(...selectAttributes(this.instancedPool, this.instancedBuffers, attrNames));
      for (const [name, pool] of this.extraInstancedPools) {
        const routeBuffers = expectDefined(this.extraInstancedBuffers.get(name), `the buffers of the pool attached as "${name}"`);
        buffers.push(...selectAttributes(pool, routeBuffers, attrNames));
      }
      this.#autoTouchBuffers = buffers;
    }
    return this.#autoTouchBuffers;
  }
}
