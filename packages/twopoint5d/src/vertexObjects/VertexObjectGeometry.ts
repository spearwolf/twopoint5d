import {BufferGeometry} from 'three';

import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {VertexObjectPool} from './VertexObjectPool';
import {initializeAttributes} from './initializeAttributes';
import {selectAttributes} from './selectAttributes';
import {selectBuffers} from './selectBuffers';
import {BufferLike, VertexAttributeUsageType, VertexObjectDescription} from './types';

type TouchBuffersType = {[Type in VertexAttributeUsageType]?: boolean};

/**
 * @category Vertex Objects
 */
export class VertexObjectGeometry extends BufferGeometry {
  readonly pool: VertexObjectPool;
  readonly buffers: Map<string, BufferLike> = new Map();

  constructor(source: VertexObjectPool | VertexObjectDescriptor | VertexObjectDescription, capacity: number) {
    super();
    this.pool = source instanceof VertexObjectPool ? source : new VertexObjectPool(source, capacity);
    this.name = 'VertexObjectGeometry';
    initializeAttributes(this, this.pool, this.buffers);
  }

  dispose(): void {
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
    let buffers: TouchBuffersType;
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
    this.#updateDrawRange();
  }

  #updateDrawRange = (): void => {
    this.setDrawRange(
      0,
      this.pool.descriptor.hasIndices
        ? this.pool.usedCount * this.pool.descriptor.indices.length
        : this.pool.usedCount * this.pool.descriptor.vertexCount,
    );
  };

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
