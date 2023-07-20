import {BufferGeometry, InstancedBufferGeometry} from 'three';

import {initializeAttributes} from './initializeAttributes';
import {initializeInstancedAttributes} from './initializeInstancedAttributes';
import {selectAttributes} from './selectAttributes';
import {selectBuffers} from './selectBuffers';
import {BufferLike, VertexAttributeUsageType, VertexObjectDescription, VO} from './types';
import {updateUpdateRange} from './updateUpdateRange';
import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {VertexObjectPool} from './VertexObjectPool';

type TouchBuffersType = {[Type in VertexAttributeUsageType]?: boolean};

type TouchInstancedBuffersType = {
  base?: TouchBuffersType;
  instanced?: TouchBuffersType;
};

export class InstancedVertexObjectGeometry<
  VOInstancedType extends VO = VO,
  VOBaseType extends VO = VO,
> extends InstancedBufferGeometry {
  readonly basePool?: VertexObjectPool<VOBaseType>;
  readonly baseBuffers?: Map<string, BufferLike>;

  readonly instancedPool: VertexObjectPool<VOInstancedType>;
  readonly instancedBuffers: Map<string, BufferLike> = new Map();

  readonly extraInstancedPools: Map<string, VertexObjectPool<any>> = new Map();
  readonly extraInstancedBuffers: Map<string, Map<string, BufferLike>> = new Map();

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

    this.name = 'InstancedVertexObjectGeometry';

    const [instancedSource, instancedCapacity] = args;
    this.instancedPool =
      instancedSource instanceof VertexObjectPool ? instancedSource : new VertexObjectPool(instancedSource, instancedCapacity);

    if (args[2] instanceof BufferGeometry) {
      this.copy(args[2] as any);
    } else {
      const baseSource = args[2];
      const baseCapacity = args[3] ?? 1;
      this.basePool = baseSource instanceof VertexObjectPool ? baseSource : new VertexObjectPool(baseSource, baseCapacity);
      this.baseBuffers = new Map();
      initializeAttributes(this, this.basePool, this.baseBuffers);
    }

    initializeInstancedAttributes(this, this.instancedPool, this.instancedBuffers);
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
   * However, you should make sure that the capacities match each other in each case.
   * **The reference instance count is derived from the default `.instancedPool`.**
   *
   * _Pro-Hint:_ It is also possible to attach a vertex-object-pool to several instanced geometries at the same time.
   *
   * NOTE: attached vertex-object-pools are never automatically cleared when the geometry is deleted!
   */
  attachInstancedPool(
    name: string,
    pool: VertexObjectPool<any> | VertexObjectDescriptor | VertexObjectDescription,
  ): VertexObjectPool<any> {
    if (!(pool instanceof VertexObjectPool)) {
      const descriptor = pool instanceof VertexObjectDescriptor ? pool : new VertexObjectDescriptor(pool);
      pool = new VertexObjectPool(descriptor, 1);
    }

    this.extraInstancedPools.set(name, pool);

    const buffers = new Map<string, BufferLike>();
    this.extraInstancedBuffers.set(name, buffers);

    initializeInstancedAttributes(this, pool, buffers);

    // reset auto-touch
    this.#autoTouchAttrNames = undefined;
    this.#firstAutoTouch = true;

    return pool;
  }

  detachInstancedPool(name: string): VertexObjectPool<any> | undefined {
    const pool = this.extraInstancedPools.get(name);
    this.extraInstancedPools.delete(name);
    this.extraInstancedBuffers.delete(name);
    this.#autoTouchAttrNames = undefined;
    return pool;
  }

  override dispose(): void {
    this.basePool?.clear();
    this.instancedPool.clear();
    this.extraInstancedPools.clear();
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

    for (const [name, pool] of this.extraInstancedPools) {
      const buffers = this.extraInstancedBuffers.get(name);
      if (buffers) {
        selectAttributes(pool, buffers, attrNames).forEach((buffer) => {
          buffer.needsUpdate = true;
        });
      }
    }
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
    this.instanceCount = this.instancedPool.usedCount;
    this.#updateBuffersUpdateRange();
    this.#autoTouchAttributes();
    this.#updateDrawRange();
  }

  #updateBuffersUpdateRange() {
    updateUpdateRange(this.basePool, this.baseBuffers);
    updateUpdateRange(this.instancedPool, this.instancedBuffers);

    for (const [name, pool] of this.extraInstancedPools) {
      const buffers = this.extraInstancedBuffers.get(name);
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

  #autoTouchAttributes = (): void => {
    if (this.instanceCount === 0) return;

    if (this.#firstAutoTouch) {
      this.touchBuffers({static: true});
      this.#firstAutoTouch = false;
    }

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
      if (this.extraInstancedPools.size) {
        for (const [, pool] of this.extraInstancedPools) {
          attrNames.push(...Array.from(pool.descriptor.attributes.values()));
        }
      }
      this.#autoTouchAttrNames = attrNames.filter((attr) => attr.autoTouch).map((attr) => attr.name);
    }
    return this.#autoTouchAttrNames;
  };
}
