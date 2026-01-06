import type {
  BufferAttribute,
  InterleavedBuffer,
  InterleavedBufferAttribute} from 'three/webgpu';
import {
  BufferGeometry,
  InstancedBufferGeometry
} from 'three/webgpu';
import {VOBufferPool} from './VOBufferPool.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectPool} from './VertexObjectPool.js';
import {initializeAttributes} from './initializeAttributes.js';
import {initializeInstancedAttributes} from './initializeInstancedAttributes.js';
import {selectAttributes} from './selectAttributes.js';
import {selectBuffers} from './selectBuffers.js';
import type {BufferLike, VertexAttributeUsageType, VertexObjectDescription} from './types.js';
import {updateUpdateRange} from './updateUpdateRange.js';

type TouchBuffersType = {[Type in VertexAttributeUsageType]?: boolean};

type TouchInstancedBuffersType = {
  base?: TouchBuffersType;
  instanced?: TouchBuffersType;
};

export class InstancedVOBufferGeometry extends InstancedBufferGeometry {
  readonly basePool?: VOBufferPool;
  readonly baseBuffers?: Map<string, BufferLike>;

  readonly baseBufferSerials: Map<string, number> = new Map();
  readonly instancedBufferSerials: Map<string, number> = new Map();

  readonly instancedPool: VOBufferPool;
  readonly instancedBuffers: Map<string, BufferLike> = new Map();

  readonly extraInstancedPools: Map<string, VOBufferPool> = new Map();
  readonly extraInstancedBuffers: Map<string, Map<string, BufferLike>> = new Map();
  readonly extraInstancedBufferSerials: Map<string, Map<string, number>> = new Map();

  constructor(
    ...args:
      | [VOBufferPool | VertexObjectDescriptor | VertexObjectDescription, number, BufferGeometry]
      | [
          VOBufferPool | VertexObjectDescriptor | VertexObjectDescription,
          number,
          VOBufferPool | VertexObjectDescriptor | VertexObjectDescription,
          number?,
        ]
  ) {
    super();

    this.name = 'InstancedVOBufferGeometry';

    const [instancedSource, instancedCapacity] = args;
    this.instancedPool =
      instancedSource instanceof VOBufferPool ? instancedSource : new VOBufferPool(instancedSource, instancedCapacity);

    if (args[2] instanceof BufferGeometry) {
      this.copy(args[2] as any);
    } else {
      const baseSource = args[2];
      const baseCapacity = args[3] ?? 1;
      this.basePool = baseSource instanceof VOBufferPool ? baseSource : new VOBufferPool(baseSource, baseCapacity);
      this.baseBuffers = new Map();
      initializeAttributes(this, this.basePool, this.baseBuffers, this.baseBufferSerials);
    }

    initializeInstancedAttributes(this, this.instancedPool, this.instancedBuffers, this.instancedBufferSerials);
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
   * _Pro-Hint:_ It is also possible to attach a vertex-buffer-pool to several instanced geometries at the same time.
   *
   * NOTE: attached vertex-buffer-pools are not automatically cleared when the geometry is deleted!
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

    const bufferSerials = new Map<string, number>();
    this.extraInstancedBufferSerials.set(name, bufferSerials);

    initializeInstancedAttributes(this, pool, buffers, bufferSerials);

    // reset auto-touch
    this.#autoTouchAttrNames = undefined;
    this.#firstAutoTouch = true;

    return pool;
  }

  detachInstancedPool(name: string): VOBufferPool | undefined {
    const pool = this.extraInstancedPools.get(name);
    this.extraInstancedPools.delete(name);
    this.extraInstancedBuffers.delete(name);
    this.extraInstancedBufferSerials.delete(name);
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
    this.#updateDrawRange();

    this.#checkBufferSerials();
    this.#updateBuffersUpdateRange();
    this.#autoTouchAttributes();

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
      let poolBufInfo = this.instancedPool.buffer.bufferAttributes.get(attrName);
      if (poolBufInfo) {
        const poolBuf = this.instancedPool.buffer.buffers.get(poolBufInfo.bufferName);
        if (poolBuf) {
          bufAttr.array = poolBuf.typedArray;
        }
      } else {
        poolBufInfo = this.basePool.buffer.bufferAttributes.get(attrName);
        if (poolBufInfo) {
          const poolBuf = this.basePool.buffer.buffers.get(poolBufInfo.bufferName);
          if (poolBuf) {
            bufAttr.array = poolBuf.typedArray;
          }
        } else {
          for (const [, pool] of this.extraInstancedPools) {
            const poolBufInfo = pool.buffer.bufferAttributes.get(attrName);
            if (poolBufInfo) {
              const poolBuf = pool.buffer.buffers.get(poolBufInfo.bufferName);
              if (poolBuf) {
                bufAttr.array = poolBuf.typedArray;
              }
            }
          }
        }
      }
    }
  }

  #checkBufferSerials(): void {
    const checkBufferSerials = (pool: VOBufferPool, buffers: Map<string, BufferLike>, bufferSerials: Map<string, number>) => {
      for (const [bufferName, buffer] of buffers) {
        const serial = bufferSerials.get(bufferName);
        const bufSerial = pool.buffer.buffers.get(bufferName)!.serial;
        if (serial !== bufSerial) {
          buffer.needsUpdate = true;
          bufferSerials.set(bufferName, bufSerial);
        }
      }
    };

    if (this.basePool) {
      checkBufferSerials(this.basePool, this.baseBuffers, this.baseBufferSerials);
    }

    if (this.instancedPool) {
      checkBufferSerials(this.instancedPool, this.instancedBuffers, this.instancedBufferSerials);
    }

    for (const [name, pool] of this.extraInstancedPools) {
      const buffers = this.extraInstancedBuffers.get(name);
      const bufferSerials = this.extraInstancedBufferSerials.get(name);
      checkBufferSerials(pool, buffers, bufferSerials);
    }
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
