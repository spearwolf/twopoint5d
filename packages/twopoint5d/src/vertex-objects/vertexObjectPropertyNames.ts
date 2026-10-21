import type {VertexAttributeDescriptor} from './VertexAttributeDescriptor.js';
import {vertexObjectProperties} from './vertexObjectProperties.js';

export interface VertexObjectPropertyName {
  name: string;
  /** `attribute "<name>"` or `methods` */
  origin: string;
}

/**
 * The names `createVertexObjectPrototype()` defines as own properties of the vertex object
 * prototype, in the same order, each with where it comes from: the names of
 * `vertexObjectProperties()`, from which the prototype builds its accessors, then the functions of
 * `methods`. They depend on the description alone, so a descriptor can check them before any buffer
 * exists; `vertexObjectPropertyNames.spec.ts` holds the result against the prototype.
 */
export function vertexObjectPropertyNames(
  attributes: Iterable<VertexAttributeDescriptor>,
  vertexCount: number,
  methods: object | null | undefined,
): VertexObjectPropertyName[] {
  const names: VertexObjectPropertyName[] = vertexObjectProperties(attributes, vertexCount).map((p) => ({
    name: p.name,
    origin: `attribute "${p.attribute.name}"`,
  }));

  for (const [key, value] of Object.entries(methods ?? {})) {
    if (typeof value === 'function') {
      names.push({name: key, origin: 'methods'});
    }
  }

  return names;
}
