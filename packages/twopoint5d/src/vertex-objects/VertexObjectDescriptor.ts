import {VertexAttributeDescriptor} from './VertexAttributeDescriptor.js';
import {cloneVertexObjectDescription} from './cloneVertexObjectDescription.js';
import type {FrozenVertexObjectDescription, VAComponentsDescription, VertexObjectDescription} from './types.js';
import {vertexObjectPropertyNames} from './vertexObjectPropertyNames.js';

const isPositiveInteger = (value: number) => Number.isInteger(value) && value >= 1;

// Freezes what a description is made of: the description, its attributes and their components, the
// indices and the `methods` object. `basePrototype` and the functions in `methods` stay as they
// are — they are behaviour the description shares with whoever wrote it, not structure the
// descriptor owns, and a frozen `Sprite.prototype` would take that class away from its author.
const freezeDescription = (description: VertexObjectDescription): void => {
  for (const attribute of Object.values(description.attributes)) {
    const {components} = attribute as Partial<VAComponentsDescription>;
    if (components != null) Object.freeze(components);
    Object.freeze(attribute);
  }
  if (description.indices != null) Object.freeze(description.indices);
  if (description.methods != null) Object.freeze(description.methods);
  Object.freeze(description.attributes);
  Object.freeze(description);
};

/**
 * The checked description of a vertex object: which attributes it has, and how many vertices and
 * indices. It sits below both layers, the one that works on buffer indices and the one that hands
 * out typed objects.
 */
export class VertexObjectDescriptor {
  /**
   * This descriptor's own copy of the description it was built from. Changing the object the
   * constructor was handed does not change this one, and so does nothing to this descriptor.
   *
   * The copy is frozen, down to the `indices`, the `attributes` record, every attribute
   * description in it and the `components` of each: a write throws a `TypeError` instead of
   * changing what the constructor has checked, and {@link FrozenVertexObjectDescription} says so
   * in the type as well. The `basePrototype` and the functions of `methods` are the exception —
   * they belong to whoever wrote them.
   */
  readonly description: FrozenVertexObjectDescription;

  readonly #attributes: Map<string, VertexAttributeDescriptor> = new Map();
  readonly #bufferNames: Set<string> = new Set();

  /** The descriptor of each attribute, keyed by the name the geometry gives it. */
  get attributes(): ReadonlyMap<string, VertexAttributeDescriptor> {
    return this.#attributes;
  }

  /** The names of the buffers the attributes of this descriptor are laid out in. */
  get bufferNames(): ReadonlySet<string> {
    return this.#bufferNames;
  }

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
   * 2. every attribute has a size of at least 1 — a positive integer `size`, or at least one
   *    component (`RangeError`)
   * 3. an attribute that declares both `size` and `components` has no more components than its
   *    size; fewer pad the attribute to its size (`RangeError`)
   * 4. every index is an integer in `0` … `vertexCount - 1` (`RangeError`)
   * 5. no two attributes, components or methods give the vertex object the same property name
   *    (`Error`)
   * 6. no property name of the vertex object appears on the `basePrototype`, neither as an own
   *    property nor inherited from a prototype below `Object.prototype` (`Error`)
   *
   * @throws when the description breaks one of the rules above; the message names the rule,
   * the attribute where there is one, and the value received
   */
  constructor(description: VertexObjectDescription) {
    // the copy is what keeps the checks below true for the life of this descriptor: a later
    // change to the description handed in here does not reach it. It is frozen before it is
    // assigned, so freezeDescription() still works on an object it is allowed to write to
    const ownDescription = cloneVertexObjectDescription(description);
    freezeDescription(ownDescription);
    this.description = ownDescription;
    Object.entries(this.description.attributes).forEach(([attrName, attrDesc]) => {
      const descriptor = new VertexAttributeDescriptor(attrName, attrDesc);
      this.#attributes.set(attrName, descriptor);
      this.#bufferNames.add(descriptor.bufferName);
    });
    this.#validate();
  }

  // a malformed description would otherwise show up frames later as wrong pixels, far from here
  #validate(): void {
    const {vertexCount} = this.description;
    if (vertexCount != null && !isPositiveInteger(vertexCount)) {
      throw new RangeError(`VertexObjectDescriptor: vertexCount must be a positive integer, got ${vertexCount}`);
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
      const raw = this.description.attributes[attr.name] as {size?: number; components?: readonly string[]};
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

    const {basePrototype} = this.description;
    if (basePrototype != null) {
      // `Object.prototype` is where the chain stops: a description without a basePrototype builds
      // its vertex objects on it and covers `toString` and its siblings anyway, so counting those
      // names here would turn away descriptions that never had a problem
      let proto: object | null = basePrototype;
      while (proto != null && proto !== Object.prototype) {
        // only own names per step, and no symbols — a generated accessor always carries a string
        for (const name of Object.getOwnPropertyNames(proto)) {
          const origin = origins.get(name);
          if (origin != null) {
            throw new Error(
              `VertexObjectDescriptor: the vertex object property "${name}" from ${origin} would shadow a property of the basePrototype`,
            );
          }
        }
        proto = Object.getPrototypeOf(proto) as object | null;
      }
    }
  }

  /** The prototype the generated accessors are placed on; the one the description names, not a copy of it. */
  get basePrototype(): object | null | undefined {
    return this.description.basePrototype;
  }

  /** The functions that become properties of every vertex object; the object is frozen, the functions in it are not. */
  get methods(): object | null | undefined {
    return this.description.methods;
  }

  /** Returns `vertexCount` or `1` */
  get vertexCount(): number {
    return this.description.vertexCount ?? 1;
  }

  get hasIndices(): boolean {
    return this.description.indices != null && this.description.indices.length > 0;
  }

  get indices(): readonly number[] {
    return this.description.indices ?? [];
  }

  get attributeNames(): string[] {
    return Array.from(this.attributes.keys());
  }

  getAttribute(name: string): VertexAttributeDescriptor | undefined {
    return this.attributes.get(name);
  }
}
