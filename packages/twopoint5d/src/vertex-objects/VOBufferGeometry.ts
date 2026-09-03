import type {BufferAttribute, InterleavedBuffer, InterleavedBufferAttribute} from 'three/webgpu';
import { BufferGeometry} from 'three/webgpu';
import type {AttributeRoute} from './GeometryAttributeSlots.js';
import {GeometryAttributeSlots} from './GeometryAttributeSlots.js';
import {GeometryPoolAttachments} from './GeometryPoolAttachments.js';
import {VOBufferPool} from './VOBufferPool.js';
import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {asThreeTypedArray} from './asThreeTypedArray.js';
import {initializeAttributes} from './initializeAttributes.js';
import {selectAttributes} from './selectAttributes.js';
import {selectBuffers} from './selectBuffers.js';
import type {BufferLike, VertexAttributeUsageType, VertexObjectDescription} from './types.js';
import {updateUpdateRange} from './updateUpdateRange.js';

type TouchBuffersType = {[Type in VertexAttributeUsageType]?: boolean};

export class VOBufferGeometry extends BufferGeometry {
  readonly pool: VOBufferPool;

  readonly buffers: Map<string, BufferLike> = new Map();
  readonly bufferSerials: Map<string, number> = new Map();

  readonly #attachments = new GeometryPoolAttachments();
  readonly #slots = new GeometryAttributeSlots();
  readonly #ownedPools = new Set<VOBufferPool>();

  constructor(source: VOBufferPool | VertexObjectDescriptor | VertexObjectDescription, capacity: number) {
    super();
    this.pool = source instanceof VOBufferPool ? source : new VOBufferPool(source, capacity);
    this.name = 'VOBufferGeometry';
    if (!(source instanceof VOBufferPool)) {
      this.declareOwnedPool(this.pool);
    }
    this.#attachments.attach(this.pool);
    initializeAttributes(this, this.pool, this.buffers, this.bufferSerials, this.#slots);
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
   * Releases the resources this geometry owns.
   *
   * The attributes built on the pool buffers leave the geometry and the index is dropped,
   * so nothing keeps the typed arrays alive through this geometry any more. A pool this
   * geometry created itself is disposed with it; a pool that was handed in belongs to the
   * caller and is left exactly as it is.
   */
  override dispose(): void {
    this.#attachments.detachAll();

    // an attribute left behind would still read from the pool arrays, and a geometry put back
    // into a scene after dispose() would have the renderer build fresh gpu buffers from them
    this.#releaseSlots(this.buffers);
    this.setIndex(null);

    if (this.#ownedPools.has(this.pool)) {
      this.pool.dispose();
    }

    this.buffers.clear();
    this.bufferSerials.clear();
    this.#ownedPools.clear();
    // the scratch map of the last update() still holds every attribute it synced, and with it
    // the very typed arrays this method is here to let go of
    this.#updateAttributes.clear();

    super.dispose();
  }

  /** Give up every attribute slot of `route` and let go of what the geometry knew about them. */
  #releaseSlots(route: AttributeRoute): void {
    for (const attrName of this.#slots.releaseRoute(this, route)) {
      // the slot has changed hands; the version #syncAttributeArrays compares against
      // belongs to the attribute that left
      this.#serials.delete(attrName);
    }
  }

  touchAttributes(...attrNames: string[]): void {
    selectAttributes(this.pool, this.buffers, attrNames).forEach((buffer) => {
      buffer.needsUpdate = true;
    });
  }

  touchBuffers(bufferTypes: TouchBuffersType): void {
    selectBuffers(this.buffers, bufferTypes).forEach((buffer) => {
      buffer.needsUpdate = true;
    });
  }

  touch(...args: Array<string | TouchBuffersType>): void {
    const attrNames: string[] = [];
    let buffers: TouchBuffersType | undefined = undefined;
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
    this.#updateDrawRange();

    this.#checkBufferSerials();
    this.#autoTouchAttributes();
    this.#updateBuffersUpdateRange();

    this.#syncAttributeArrays();
  }

  #serials: Map<string, number> = new Map();
  #updateAttributes = new Map<string, BufferAttribute | InterleavedBuffer>();

  /**
   * If the references to the attribute arrays in a {@link VOBufferPool} are swapped,
   * e.g. via a {@link VOBufferPool#fromBuffersData()} call, then of course the references
   * to the typed arrays within the `THREE.BufferAttribute` structure must also be changed.
   *
   * TODO add tests
   */
  #syncAttributeArrays() {
    this.#updateAttributes.clear();

    // 1. find all attributes that need to be updated
    //
    for (const [attrName, attr] of Object.entries(this.attributes)) {
      const bufAttr = (attr as InterleavedBufferAttribute).isInterleavedBufferAttribute
        ? (attr as InterleavedBufferAttribute).data
        : (attr as BufferAttribute);
      const version = bufAttr.version;
      if (this.#serials.has(attrName)) {
        if (this.#serials.get(attrName) !== version) {
          this.#updateAttributes.set(attrName, bufAttr);
          this.#serials.set(attrName, version);
        }
      } else {
        this.#updateAttributes.set(attrName, bufAttr);
        this.#serials.set(attrName, version);
      }
    }

    // 2. sync buffer attribute arrays
    //
    for (const [attrName, bufAttr] of this.#updateAttributes) {
      const poolBufInfo = this.pool.buffer.bufferAttributes.get(attrName);
      if (poolBufInfo) {
        const poolBuf = this.pool.buffer.buffers.get(poolBufInfo.bufferName);
        if (poolBuf) {
          bufAttr.array = asThreeTypedArray(poolBuf.typedArray);
        }
      }
    }
  }

  #checkBufferSerials(): void {
    for (const [bufferName, buffer] of this.buffers) {
      const poolBuffer = this.pool.buffer.buffers.get(bufferName);
      // a pool that has been disposed elsewhere carries no buffer to compare against; the rest
      // of the update path already treats that as a regular state and leaves the attribute alone
      if (poolBuffer == null) continue;

      const serial = this.bufferSerials.get(bufferName);
      if (serial !== poolBuffer.serial) {
        buffer.needsUpdate = true;
        this.bufferSerials.set(bufferName, poolBuffer.serial);
      }
    }
  }

  #updateBuffersUpdateRange() {
    updateUpdateRange(this.pool, this.buffers);
  }

  #updateDrawRange() {
    this.setDrawRange(
      0,
      this.pool.descriptor.hasIndices
        ? this.pool.usedCount * this.pool.descriptor.indices.length
        : this.pool.usedCount * this.pool.descriptor.vertexCount,
    );
  }

  #firstAutoTouch = true;

  #autoTouchAttributes() {
    if (this.pool.usedCount === 0) return;

    if (this.#firstAutoTouch) {
      this.touchBuffers({static: true});
      this.#firstAutoTouch = false;
    }

    const autoTouchAttrs = this.#getAutoTouchAttributeNames();
    if (autoTouchAttrs.length) {
      this.touchAttributes(...autoTouchAttrs);
    }
  }

  #autoTouchAttrNames?: string[];

  #getAutoTouchAttributeNames(): string[] {
    if (!this.#autoTouchAttrNames) {
      this.#autoTouchAttrNames = Array.from(this.pool.descriptor.attributes.values())
        .filter((attr) => attr.autoTouch)
        .map((attr) => attr.name);
    }
    return this.#autoTouchAttrNames;
  }
}
