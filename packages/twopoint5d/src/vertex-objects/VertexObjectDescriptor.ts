import {VertexAttributeDescriptor} from './VertexAttributeDescriptor.js';
import type {VertexObjectDescription} from './types.js';
import {vertexObjectPropertyNames} from './vertexObjectPropertyNames.js';

const isPositiveInteger = (value: number) => Number.isInteger(value) && value >= 1;

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

  /**
   * Reads the description and checks that its layout can hold it. The first rule that fails
   * throws:
   *
   * 1. `vertexCount`, when given, is a positive integer (`RangeError`)
   * 2. `meshCount`, when given, is a positive integer (`RangeError`)
   * 3. every attribute has a size of at least 1 — a positive integer `size`, or at least one
   *    component (`RangeError`)
   * 4. an attribute that declares both `size` and `components` has no more components than its
   *    size; fewer pad the attribute to its size (`RangeError`)
   * 5. every index is an integer in `0` … `vertexCount - 1` (`RangeError`)
   * 6. no two attributes, components or methods give the vertex object the same property name
   *    (`Error`)
   *
   * @throws when the description breaks one of the rules above; the message names the rule,
   * the attribute where there is one, and the value received
   */
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
    this.#validate();
  }

  // a malformed description would otherwise show up frames later as wrong pixels, far from here
  #validate(): void {
    const {vertexCount, meshCount} = this.description;
    if (vertexCount != null && !isPositiveInteger(vertexCount)) {
      throw new RangeError(`VertexObjectDescriptor: vertexCount must be a positive integer, got ${vertexCount}`);
    }
    if (meshCount != null && !isPositiveInteger(meshCount)) {
      throw new RangeError(`VertexObjectDescriptor: meshCount must be a positive integer, got ${meshCount}`);
    }

    for (const attr of this.attributes.values()) {
      if (!isPositiveInteger(attr.size)) {
        throw new RangeError(
          `VertexObjectDescriptor: attribute "${attr.name}" needs a size of at least 1 (a positive integer size or at least one component), got ${attr.size}`,
        );
      }
    }
    for (const attr of this.attributes.values()) {
      // the raw description, because the descriptor answers `size` from either field
      const raw = this.description.attributes[attr.name] as {size?: number; components?: string[]};
      if (raw.size != null && raw.components != null && raw.components.length > raw.size) {
        throw new RangeError(
          `VertexObjectDescriptor: attribute "${attr.name}" declares ${raw.components.length} components for a size of ${raw.size}`,
        );
      }
    }

    this.indices.forEach((index, position) => {
      if (!Number.isInteger(index) || index < 0 || index >= this.vertexCount) {
        throw new RangeError(
          `VertexObjectDescriptor: index ${index} at position ${position} must be an integer in 0 … ${this.vertexCount - 1}`,
        );
      }
    });

    const origins = new Map<string, string>();
    for (const {name, origin} of vertexObjectPropertyNames(this.attributes.values(), this.vertexCount, this.methods)) {
      const first = origins.get(name);
      if (first != null) {
        throw new Error(`VertexObjectDescriptor: the vertex object property "${name}" comes from both ${first} and ${origin}`);
      }
      origins.set(name, origin);
    }
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
