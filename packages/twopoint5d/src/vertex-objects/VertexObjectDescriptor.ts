import {VertexAttributeDescriptor} from './VertexAttributeDescriptor.js';
import type {VertexObjectDescription} from './types.js';

export class VertexObjectDescriptor {
  readonly description: VertexObjectDescription;

  readonly attributes: Map<string, VertexAttributeDescriptor>;
  readonly bufferNames: Set<string>;

  readonly basePrototype?: object | null | undefined;
  readonly methods?: object | null | undefined;

  voPrototype: object; // lazy initialization!!
  // is initialized by the first VertexObjectBuffer that uses this descriptor => createVertexObjectPrototype()

  constructor(description: VertexObjectDescription) {
    this.description = description;
    this.attributes = new Map();
    this.bufferNames = new Set();
    Object.entries(this.description.attributes).forEach(([attrName, attrDesc]) => {
      const descriptor = new VertexAttributeDescriptor(attrName, attrDesc);
      this.attributes.set(attrName, descriptor);
      this.bufferNames.add(descriptor.bufferName);
    });
    this.basePrototype = description.basePrototype;
    this.methods = description.methods;
  }

  /** Returns `vertexCount` or `1` */
  get vertexCount(): number {
    return this.description.vertexCount ?? 1;
  }

  /** Returns `meshCount` or `1` */
  get meshCount(): number {
    return this.description.meshCount ?? 1;
  }

  /**
   * Calculate the instance count if your `meshCount` is greater than 1,
   * otherwise return the given capacity
   * TODO remove?!
   */
  getInstanceCount(capacity: number): number {
    const meshCount = this.description.meshCount ?? 1;
    return meshCount > 1 ? Math.ceil(capacity / meshCount) : capacity;
  }

  get hasIndices(): boolean {
    return this.description.indices != null && this.description.indices.length > 0;
  }

  get indices(): number[] {
    return this.description.indices ?? [];
  }

  get attributeNames(): string[] {
    return Array.from(this.attributes.keys());
  }

  getAttribute(name: string): VertexAttributeDescriptor | undefined {
    return this.attributes.get(name);
  }
}
