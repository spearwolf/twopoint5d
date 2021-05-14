import {BufferGeometry} from 'three';

import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {VertexObjectPool} from './VertexObjectPool';
import {initializeAttributes} from './initializeAttributes';
import {selectAttributes} from './selectAttributes';
import {selectBuffers} from './selectBuffers';
import {
  BufferLike,
  VertexAttributeUsageType,
  VertexObjectDescription,
} from './types';

type TouchBuffersType = {[Type in VertexAttributeUsageType]?: boolean};

export class VertexObjectGeometry extends BufferGeometry {
  readonly pool: VertexObjectPool;
  readonly buffers: Map<string, BufferLike> = new Map();

  constructor(
    source: VertexObjectPool | VertexObjectDescriptor | VertexObjectDescription,
    capacity: number,
  ) {
    super();
    this.pool =
      source instanceof VertexObjectPool
        ? source
        : new VertexObjectPool(source, capacity);
    this.name = 'VertexObjectGeometry';
    this.initializeAttributes();
  }

  protected initializeAttributes(): void {
    initializeAttributes(this, this.pool, this.buffers);
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
    const autoTouchAttrs = Array.from(this.pool.descriptor.attributes.values())
      .filter((attr) => attr.autoTouch)
      .map((attr) => attr.name);
    // TODO cache autoTouch attribute names !
    this.touchAttributes(...autoTouchAttrs);

    this.setDrawRange(
      0,
      this.pool.descriptor.hasIndices
        ? this.pool.usedCount * this.pool.descriptor.indices.length
        : this.pool.usedCount * this.pool.descriptor.vertexCount,
    );
  }
}
