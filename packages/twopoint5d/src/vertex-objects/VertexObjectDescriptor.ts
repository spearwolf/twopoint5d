import {VertexAttributeDescriptor} from './VertexAttributeDescriptor.js';
import type {VertexObjectDescription} from './types.js';

export class VertexObjectDescriptor {
  readonly description: VertexObjectDescription;

  readonly attributes: Map<string, VertexAttributeDescriptor>;
  readonly bufferNames: Set<string>;

  readonly basePrototype?: object | null | undefined;
  readonly methods?: object | null | undefined;

  #voPrototype?: object;

  /**
   * The prototype every vertex object of this descriptor is created from. The first
   * {@link VertexObjectBuffer} built on this descriptor builds it and assigns it here; before
   * that there is none, and the declared type says otherwise because every caller reaches this
   * through a buffer that has already built it.
   *
   * It is read through an accessor rather than held in a field so that it stays off the
   * enumerable surface of the descriptor. The attribute accessors on that prototype read
   * through a buffer the prototype itself does not have, so anything that walks a descriptor
   * property by property — a test runner rendering a failed assertion, for one — would die on
   * the first of them instead of showing what it set out to show.
   */
  get voPrototype(): object {
    return this.#voPrototype!;
  }

  set voPrototype(prototype: object) {
    this.#voPrototype = prototype;
  }

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
