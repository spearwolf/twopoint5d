import {BufferGeometry} from 'three';

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
    this.#checkBufferSerials();
    this.#autoTouchAttributes();
    this.#updateBuffersUpdateRange();
    this.#updateDrawRange();
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
