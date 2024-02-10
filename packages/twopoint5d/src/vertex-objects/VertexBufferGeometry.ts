import {BufferGeometry} from 'three';

import {initializeAttributes} from './initializeAttributes.js';
import {selectAttributes} from './selectAttributes.js';
import {selectBuffers} from './selectBuffers.js';
import type {BufferLike, VertexAttributeUsageType, VertexObjectDescription} from './types.js';
import {updateUpdateRange} from './updateUpdateRange.js';
import {VertexBufferPool} from './VertexBufferPool.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';

type TouchBuffersType = {[Type in VertexAttributeUsageType]?: boolean};

export class VertexBufferGeometry extends BufferGeometry {
  readonly pool: VertexBufferPool;
  readonly buffers: Map<string, BufferLike> = new Map();

  constructor(source: VertexBufferPool | VertexObjectDescriptor | VertexObjectDescription, capacity: number) {
    super();
    this.pool = source instanceof VertexBufferPool ? source : new VertexBufferPool(source, capacity);
    this.name = 'VertexBufferGeometry';
    initializeAttributes(this, this.pool, this.buffers);
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
    this.#autoTouchAttributes();
    this.#updateBuffersUpdateRange();
    this.#updateDrawRange();
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