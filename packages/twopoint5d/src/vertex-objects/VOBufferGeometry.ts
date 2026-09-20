import {BufferGeometry} from 'three/webgpu';
import {GeometryAttributeSlots} from './GeometryAttributeSlots.js';
import {GeometryPoolAttachments} from './GeometryPoolAttachments.js';
import {GeometryRoutes} from './GeometryRoutes.js';
import {VOBufferPool} from './VOBufferPool.js';
import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {initializeAttributes} from './initializeAttributes.js';
import {parseTouchArgs} from './parseTouchArgs.js';
import type {BufferLike, TouchBuffersType, VertexObjectDescription} from './types.js';

/**
 * Hands the buffers of a {@link VOBufferPool} to three.js as one `THREE.BufferGeometry`. It works
 * on buffer indices and knows no object type: the layer below {@link VertexObjectGeometry}.
 */
export class VOBufferGeometry extends BufferGeometry {
  readonly pool: VOBufferPool;

  readonly #buffers: Map<string, BufferLike> = new Map();
  readonly #bufferSerials: Map<string, number> = new Map();

  /** The three.js buffer behind each buffer name of the pool. */
  get buffers(): ReadonlyMap<string, BufferLike> {
    return this.#buffers;
  }

  /** The serial this geometry last saw for each of those buffers. */
  get bufferSerials(): ReadonlyMap<string, number> {
    return this.#bufferSerials;
  }

  readonly #attachments = new GeometryPoolAttachments();
  readonly #slots = new GeometryAttributeSlots();
  readonly #routes = new GeometryRoutes();

  /**
   * @throws when the pool handed in has been disposed and holds no buffers to build attributes
   *   on. The message names the class and the state, and no geometry comes into being.
   */
  constructor(source: VOBufferPool | VertexObjectDescriptor | VertexObjectDescription, capacity: number) {
    // before super(), so that a geometry which cannot get its attributes never comes into being
    if (source instanceof VOBufferPool && source.isDisposed) {
      throw new Error(
        'VOBufferGeometry: the pool handed to the constructor has been disposed and holds no buffers ' +
          'to build attributes on. Build the geometry while the pool is alive, or hand it a live pool.',
      );
    }

    super();
    this.pool = source instanceof VOBufferPool ? source : new VOBufferPool(source, capacity);
    this.name = 'VOBufferGeometry';
    if (!(source instanceof VOBufferPool)) {
      this.declareOwnedPool(this.pool);
    }
    this.#attachments.attach(this.pool);
    initializeAttributes(this, this.pool, this.#buffers, this.#bufferSerials, this.#slots);

    // the route bundles the maps behind the read-only views, it does not copy them: this geometry
    // draws one pool and has no halves, so the route carries no group
    this.#routes.add({pool: this.pool, buffers: this.#buffers, bufferSerials: this.#bufferSerials});
  }

  /**
   * Mark a pool as created for this geometry, which is what makes the geometry
   * release it on dispose. Pools that were handed in stay untouched.
   *
   * @internal
   */
  declareOwnedPool(pool: VOBufferPool): void {
    this.#attachments.declareOwned(pool);
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
   * last `update()`.
   */
  override dispose(): void {
    // the renderer reads the attributes of this geometry once more while it handles the
    // dispose event, and reaches for the id of a slot before it checks that the slot is
    // filled — so the event goes out while every slot is still there
    super.dispose();

    this.#attachments.detachAll();

    // an attribute left behind would still read from the pool arrays, and a geometry put back
    // into a scene after dispose() would have the renderer build fresh gpu buffers from them
    this.#slots.releaseRoute(this, this.#buffers);
    this.setIndex(null);

    if (this.#attachments.owns(this.pool)) {
      this.pool.dispose();
    }

    this.#buffers.clear();
    this.#bufferSerials.clear();
    this.#attachments.clear();
    // the resolved selection holds the very THREE.BufferAttributes this method is here to let go of
    this.#routes.clear();
  }

  /** Marks the buffers behind the given attribute names for GPU upload on the next `update()`. */
  touchAttributes(...attrNames: string[]): void {
    this.#routes.touchAttributes(attrNames);
  }

  /** Marks every buffer of the given usage types for GPU upload on the next `update()`. */
  touchBuffers(bufferTypes: TouchBuffersType): void {
    this.#routes.touchByUsage(bufferTypes);
  }

  /**
   * Marks buffers for GPU upload on the next `update()`, by attribute name, by usage type, or a
   * mix of both. This is the counterpart to `autoTouch: false` (see {@link VADescription#autoTouch}):
   * an attribute without `autoTouch` uploads only through an explicit `touch()` after its values
   * were written.
   */
  touch(...args: Array<string | TouchBuffersType>): void {
    // this geometry reaches one pool through one route, so usage types addressed to the half of
    // an instanced geometry name nothing here and select nothing
    const {attrNames, flat} = parseTouchArgs(args);

    if (attrNames.length) {
      this.touchAttributes(...attrNames);
    }
    if (flat) {
      this.touchBuffers(flat);
    }
  }

  update(): void {
    this.#updateDrawRange();

    // before the uploads are synced: what is asked for here decides how wide each of them goes
    this.#autoTouchAttributes();
    this.#routes.syncUploads();

    this.#slots.syncArrays(this);
  }

  #updateDrawRange() {
    this.setDrawRange(
      0,
      this.pool.descriptor.hasIndices
        ? this.pool.usedCount * this.pool.descriptor.indices.length
        : this.pool.usedCount * this.pool.descriptor.vertexCount,
    );
  }

  #autoTouchAttributes() {
    if (this.pool.usedCount === 0) return;

    this.#routes.autoTouch();
  }
}
