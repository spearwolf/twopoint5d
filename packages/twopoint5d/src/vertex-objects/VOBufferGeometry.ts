import {BufferGeometry} from 'three/webgpu';
import {VOBufferPool} from './VOBufferPool.js';
import {VOGeometryPools, drawCountOf} from './VOGeometryPools.js';
import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {checkPoolCapacity} from './checkPoolCapacity.js';
import {initializeAttributes} from './initializeAttributes.js';
import type {BufferLike, TouchBuffersType, VertexObjectDescription} from './types.js';

/**
 * Hands the buffers of a {@link VOBufferPool} to three.js as one `THREE.BufferGeometry`. It works
 * on buffer indices and knows no object type: the layer below `VertexObjectGeometry`.
 */
export class VOBufferGeometry extends BufferGeometry {
  /** The pool this geometry was built on. Answers with it after `dispose()` as well — see {@link dispose}. */
  readonly pool: VOBufferPool;

  readonly #buffers: Map<string, BufferLike> = new Map();
  readonly #bufferSerials: Map<string, number> = new Map();

  /** The three.js buffer behind each buffer name of the pool; empty after `dispose()`. */
  get buffers(): ReadonlyMap<string, BufferLike> {
    return this.#buffers;
  }

  /** The serial this geometry last saw for each of those buffers; empty after `dispose()`. */
  get bufferSerials(): ReadonlyMap<string, number> {
    return this.#bufferSerials;
  }

  readonly #pools = new VOGeometryPools();

  /**
   * @throws a `RangeError` when `source` is a pool and `capacity` is not its capacity: a geometry
   *   takes its size from the pool it is handed, so the caller hands in `pool.capacity`. The check
   *   comes before anything else, and the pool is left as it was.
   * @throws when the pool handed in has been disposed and holds no buffers to build attributes
   *   on. The message names the class and the state, and no geometry comes into being. Whatever
   *   the constructor throws, a pool it built from a descriptor or description is disposed, and a
   *   pool handed in is left as it was — alive, and not counted as attached.
   */
  constructor(source: VOBufferPool | VertexObjectDescriptor | VertexObjectDescription, capacity: number) {
    if (source instanceof VOBufferPool) checkPoolCapacity('new VOBufferGeometry()', 'capacity', 'the pool', source, capacity);

    // before super(), so that a geometry which cannot get its attributes never comes into being
    if (source instanceof VOBufferPool && source.isDisposed) {
      throw new Error(
        'VOBufferGeometry: the pool handed to the constructor has been disposed and holds no buffers ' +
          'to build attributes on. Build the geometry while the pool is alive, or hand it a live pool.',
      );
    }

    super();
    this.name = 'VOBufferGeometry';

    // held apart from the field, which the catch below may not read before it is assigned
    let pool: VOBufferPool | undefined;
    try {
      pool = source instanceof VOBufferPool ? source : new VOBufferPool(source, capacity);
      this.pool = pool;
      if (!(source instanceof VOBufferPool)) {
        this.declareOwnedPool(pool);
      }

      // the route bundles the maps behind the read-only views, it does not copy them: this geometry
      // draws one pool and has no halves, so the route carries no group
      this.#pools.addRoute(this, {pool, buffers: this.#buffers, bufferSerials: this.#bufferSerials}, initializeAttributes);
    } catch (error) {
      this.#pools.abandon([pool]);
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
   * Releases the resources this geometry owns.
   *
   * The attributes built on the pool buffers leave the geometry and the index is dropped,
   * so nothing keeps the typed arrays alive through this geometry any more. A pool this
   * geometry created itself is disposed with it; a pool that was handed in belongs to the
   * caller and is left exactly as it is.
   *
   * After this call the geometry holds no route, no buffer and no pool of its own any more.
   * What stays behind belongs to the attributes that are still there: their serials from the
   * last `update()`. `update()` is a no-op from here on — see {@link update}.
   *
   * A second call does nothing. A listener of the dispose event that throws holds up none of
   * this: its error reaches the caller once the geometry is down.
   */
  override dispose(): void {
    this.#pools.dispose(this, () => super.dispose());
  }

  /**
   * Marks the buffers behind the given attribute names for GPU upload on the next `update()`,
   * which uploads every object in use and nothing when there is none. Does nothing after
   * `dispose()`, which leaves no route to mark.
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
   * Marks every buffer of the given usage types for GPU upload on the next `update()`, which
   * uploads every object in use and nothing when there is none. Does nothing after `dispose()`,
   * which leaves no route to mark.
   */
  touchBuffers(bufferTypes: TouchBuffersType): void {
    this.#pools.touchBuffers(bufferTypes);
  }

  /**
   * Marks buffers for GPU upload on the next `update()`, by attribute name, by usage type, or a
   * mix of both; every argument counts on its own. That `update()` uploads every object in use of
   * the marked buffers, and nothing when there is none. This is the counterpart to
   * `autoTouch: false` (see `VADescription#autoTouch`): an attribute without `autoTouch` uploads
   * only through an explicit `touch()` after its values were written, or through
   * `VertexObjectPool#touchVO()`, which uploads the slots it names alone.
   */
  touch(...args: Array<string | TouchBuffersType>): void;
  touch(): void {
    // read through `arguments` rather than the rest parameter of the signature:
    // docs/architecture.md, `vertex-objects/`
    // biome-ignore lint/complexity/noArguments: only the count is read, see the comment above the loop
    for (let i = 0; i < arguments.length; i++) {
      // biome-ignore lint/complexity/noArguments: see the comment above the loop
      this.#pools.touch(arguments[i] as string | TouchBuffersType);
    }
  }

  /**
   * Sets the draw range from `pool.usedCount`, uploads the buffers that need it and syncs the
   * attribute arrays to the pool's own.
   *
   * A no-op after `dispose()`: the geometry has no attribute left to draw or upload, and a draw
   * range taken from a pool that is still alive would name vertices this geometry no longer has.
   */
  update(): void {
    if (this.#pools.isDisposed) return;

    this.setDrawRange(0, drawCountOf(this.pool));
    this.#pools.sync(this.pool.usedCount > 0);
  }
}
