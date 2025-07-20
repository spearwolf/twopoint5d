import {BufferAttribute, BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute} from 'three/webgpu';
import {VOBufferPool} from './VOBufferPool.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
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

  constructor(source: VOBufferPool | VertexObjectDescriptor | VertexObjectDescription, capacity: number) {
    super();
    this.pool = source instanceof VOBufferPool ? source : new VOBufferPool(source, capacity);
    this.name = 'VOBufferGeometry';
    initializeAttributes(this, this.pool, this.buffers, this.bufferSerials);
  }

  override dispose(): void {
    this.pool.clear();
    super.dispose();
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
          bufAttr.array = poolBuf.typedArray;
        }
      }
    }
  }

  #checkBufferSerials(): void {
    for (const [bufferName, buffer] of this.buffers) {
      const serial = this.bufferSerials.get(bufferName);
      const bufSerial = this.pool.buffer.buffers.get(bufferName)!.serial;
      if (serial !== bufSerial) {
        buffer.needsUpdate = true;
        this.bufferSerials.set(bufferName, bufSerial);
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
