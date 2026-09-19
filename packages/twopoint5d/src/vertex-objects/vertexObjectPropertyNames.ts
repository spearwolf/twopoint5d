import type {VertexAttributeDescriptor} from './VertexAttributeDescriptor.js';

export interface VertexObjectPropertyName {
  name: string;
  /** `attribute "<name>"` or `methods` */
  origin: string;
}

/**
 * The names `createVertexObjectPrototype()` defines as own properties of the vertex object
 * prototype, by the same rules and in the same order, each with where it comes from. They
 * depend on the description alone, so a descriptor can check them before any buffer exists.
 *
 * Whoever changes the rules in one of the two functions changes them in both;
 * `vertexObjectPropertyNames.spec.ts` holds the result against the prototype.
 */
export function vertexObjectPropertyNames(
  attributes: Iterable<VertexAttributeDescriptor>,
  vertexCount: number,
  methods: object | null | undefined,
): VertexObjectPropertyName[] {
  const names: VertexObjectPropertyName[] = [];

  for (const attr of attributes) {
    const origin = `attribute "${attr.name}"`;

    if (vertexCount === 1 && attr.size === 1) {
      names.push({name: attr.name, origin});
    } else {
      if (attr.getterName != null) names.push({name: attr.getterName, origin});
      if (attr.setterName != null) names.push({name: attr.setterName, origin});
    }

    if (attr.hasComponents) {
      for (const component of attr.components) {
        for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
          if (vertexCount > 1 || attr.size > 1 || component !== attr.name) {
            names.push({name: `${component}${vertexCount === 1 ? '' : vertexIndex}`, origin});
          }
        }
      }
    }
  }

  for (const [key, value] of Object.entries(methods ?? {})) {
    if (typeof value === 'function') {
      names.push({name: key, origin: 'methods'});
    }
  }

  return names;
}
