import type {VertexAttributeDescriptor} from './VertexAttributeDescriptor.js';

/** One property the attributes of a description give their vertex objects. */
export interface VertexObjectProperty {
  /** The name of the property on the vertex object. */
  readonly name: string;
  /**
   * `'value'`: a getter and a setter of one number — the attribute of one value on one vertex under
   * its own name, or a component property (`x`, `x0` …). `'valuesGetter'` and `'valuesSetter'`: the
   * `get…()` and `set…()` methods of the whole attribute.
   */
  readonly kind: 'value' | 'valuesGetter' | 'valuesSetter';
  /** The attribute the property belongs to. */
  readonly attribute: VertexAttributeDescriptor;
  /** For a `'value'`: the vertex within the attribute; `0` for the attribute of one value under its own name and for the methods. */
  readonly vertexIndex: number;
  /** For a `'value'`: the component within the vertex; `0` for the attribute of one value under its own name and for the methods. */
  readonly componentIndex: number;
}

/**
 * The properties the attributes of a description give their vertex objects, in the order the
 * prototype defines them. An attribute of one value on one vertex is a property under its own name;
 * any other attribute gets the `get…()` and `set…()` methods of its getter and setter names, unless
 * they are switched off. Every component of an attribute is a property of its own too — `x`, or `x0`
 * … `x3` with one per vertex —, except a component that would be the very property of the attribute
 * itself: one vertex, size 1 and the same name address the same slot.
 *
 * `createVertexObjectPrototype()` builds its accessors from this list, and so do
 * `vertexObjectPropertyNames()` and `valuePropertyLayouts()`. The rules depend on the description
 * alone, which is why a descriptor can check them before any buffer exists.
 */
export function vertexObjectProperties(
  attributes: Iterable<VertexAttributeDescriptor>,
  vertexCount: number,
): VertexObjectProperty[] {
  const properties: VertexObjectProperty[] = [];

  for (const attribute of attributes) {
    if (vertexCount === 1 && attribute.size === 1) {
      properties.push({name: attribute.name, kind: 'value', attribute, vertexIndex: 0, componentIndex: 0});
    } else {
      // `getter: false` / `setter: false` leave the name undefined: the attribute gets no accessor
      if (attribute.getterName != null) {
        properties.push({name: attribute.getterName, kind: 'valuesGetter', attribute, vertexIndex: 0, componentIndex: 0});
      }
      if (attribute.setterName != null) {
        properties.push({name: attribute.setterName, kind: 'valuesSetter', attribute, vertexIndex: 0, componentIndex: 0});
      }
    }

    if (attribute.hasComponents) {
      attribute.components.forEach((component, componentIndex) => {
        for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
          // a component is skipped only where it coincides with the attribute accessor above: one
          // vertex, size 1 and the same name address the very same slot
          if (vertexCount > 1 || attribute.size > 1 || component !== attribute.name) {
            properties.push({
              name: `${component}${vertexCount === 1 ? '' : vertexIndex}`,
              kind: 'value',
              attribute,
              vertexIndex,
              componentIndex,
            });
          }
        }
      });
    }
  }

  return properties;
}

/**
 * The element of a `'value'` within the slot of its vertex object, in a buffer of `itemSize` elements
 * per vertex where its attribute starts at `attributeOffset`.
 */
export function valueOffsetOf(property: VertexObjectProperty, itemSize: number, attributeOffset: number): number {
  return property.vertexIndex * itemSize + attributeOffset + property.componentIndex;
}
