import {BufferGeometry, InstancedBufferGeometry} from 'three';

import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {VertexObjectPool} from './VertexObjectPool';
import {initializeAttributes} from './initializeAttributes';
import {initializeInstancedAttributes} from './initializeInstancedAttributes';
import {selectAttributes} from './selectAttributes';
import {selectBuffers} from './selectBuffers';
import {BufferLike, VertexAttributeUsageType, VertexObjectDescription, VO} from './types';

type TouchBuffersType = {[Type in VertexAttributeUsageType]?: boolean};

type TouchInstancedBuffersType = {
  base?: TouchBuffersType;
  instanced?: TouchBuffersType;
};

/**
 * @category Vertex Objects
 */
export class InstancedVertexObjectGeometry<
  VOInstancedType extends VO = VO,
  VOBaseType extends VO = VO,
> extends InstancedBufferGeometry {
  readonly basePool?: VertexObjectPool<VOBaseType>;
  readonly baseBuffers?: Map<string, BufferLike>;

  readonly instancedPool: VertexObjectPool<VOInstancedType>;
  readonly instancedBuffers: Map<string, BufferLike> = new Map();

  constructor(
    ...args:
      | [VertexObjectPool<VOInstancedType> | VertexObjectDescriptor | VertexObjectDescription, number, BufferGeometry]
      | [
          VertexObjectPool<VOInstancedType> | VertexObjectDescriptor | VertexObjectDescription,
          number,
          VertexObjectPool<VOBaseType> | VertexObjectDescriptor | VertexObjectDescription,
          number?,
        ]
  ) {
    super();
    const [instancedSource, instancedCapacity] = args;
    this.instancedPool =
      instancedSource instanceof VertexObjectPool ? instancedSource : new VertexObjectPool(instancedSource, instancedCapacity);
    this.name = 'InstancedVertexObjectGeometry';
    if (args[2] instanceof BufferGeometry) {
      this.copy(args[2]);
    } else {
      const baseSource = args[2];
      const baseCapacity = args[3] ?? 1;
      this.basePool = baseSource instanceof VertexObjectPool ? baseSource : new VertexObjectPool(baseSource, baseCapacity);
      this.baseBuffers = new Map();
      initializeAttributes(this, this.basePool, this.baseBuffers);
    }
    initializeInstancedAttributes(this, this.instancedPool, this.instancedBuffers);
  }

  dispose(): void {
    this.basePool?.clear();
    this.instancedPool.clear();
    super.dispose();
  }

  touchAttributes(...attrNames: string[]): void {
    if (this.basePool) {
      selectAttributes(this.basePool, this.baseBuffers, attrNames).forEach((buffer) => {
        buffer.needsUpdate = true;
      });
    }
    selectAttributes(this.instancedPool, this.instancedBuffers, attrNames).forEach((buffer) => {
      buffer.needsUpdate = true;
    });
  }

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
      }
    } else {
      selectBuffers(this.instancedBuffers, bufferTypes as TouchBuffersType).forEach((buffer) => {
        buffer.needsUpdate = true;
      });
    }
  }

  touch(...args: Array<string | TouchBuffersType | TouchInstancedBuffersType>): void {
    const attrNames: string[] = [];
    let buffers: TouchBuffersType | TouchInstancedBuffersType;
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
    this.instanceCount = this.instancedPool.usedCount;
  }

  #updateDrawRange = (): void => {
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
  };

  #autoTouchAttributes = (): void => {
    const autoTouchAttrs = this.#getAutoTouchAttributeNames();
    if (autoTouchAttrs.length) {
      this.touchAttributes(...autoTouchAttrs);
    }
  };

  #autoTouchAttrNames?: string[];

  #getAutoTouchAttributeNames = (): string[] => {
    if (!this.#autoTouchAttrNames) {
      const attrNames = [...Array.from(this.instancedPool.descriptor.attributes.values())];
      if (this.basePool) {
        attrNames.push(...Array.from(this.basePool.descriptor.attributes.values()));
      }
      this.#autoTouchAttrNames = attrNames.filter((attr) => attr.autoTouch).map((attr) => attr.name);
    }
    return this.#autoTouchAttrNames;
  };
}
