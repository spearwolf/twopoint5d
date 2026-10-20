import type {VertexObjectBuffer} from './VertexObjectBuffer.js';

/** Where the generated accessor of one value property reads: slot `i` at `i × stride + offset` of the buffer at `bufferIndex`. */
export interface ValuePropertyLayout {
  /** The position of the buffer in `VertexObjectBuffer#bufferList`, the same in every buffer of the descriptor. */
  readonly bufferIndex: number;
  /** The elements one slot takes in that buffer: `vertexCount × itemSize`. */
  readonly stride: number;
  /** The element of the value within the slot. */
  readonly offset: number;
}

/**
 * The value properties of the vertex objects of `buffer`, by name: the properties of one value that
 * `createVertexObjectPrototype()` gives a getter and a setter — the attribute of one value on one
 * vertex under its own name, and every component property (`x`, or `x0` … on several vertices) —
 * each with the place its accessor reads, by the same rules. The `set…` and `get…` methods, the
 * `methods` and whatever the `basePrototype` carries are no value properties.
 *
 * Whoever changes the rules of the accessors in `createVertexObjectPrototype()` changes them here;
 * `valuePropertyLayouts.spec.ts` holds every layout against the getter of its name.
 */
export function valuePropertyLayouts(buffer: VertexObjectBuffer): ReadonlyMap<string, ValuePropertyLayout> {
  const {descriptor} = buffer;
  const {vertexCount} = descriptor;
  const layouts = new Map<string, ValuePropertyLayout>();

  for (const attrName of descriptor.attributeNames) {
    // the descriptor lists every attribute it has a buffer layout for
    const attr = descriptor.getAttribute(attrName)!;
    const bufAttr = buffer.bufferAttributes.get(attrName)!;
    const record = buffer.buffers.get(bufAttr.bufferName)!;
    const bufferIndex = buffer.bufferList.indexOf(record);
    const stride = vertexCount * record.itemSize;

    if (vertexCount === 1 && attr.size === 1) {
      layouts.set(attrName, {bufferIndex, stride, offset: bufAttr.offset});
    }

    if (attr.hasComponents) {
      attr.components.forEach((component, componentIndex) => {
        for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
          if (vertexCount > 1 || attr.size > 1 || component !== attr.name) {
            layouts.set(`${component}${vertexCount === 1 ? '' : vertexIndex}`, {
              bufferIndex,
              stride,
              offset: vertexIndex * record.itemSize + bufAttr.offset + componentIndex,
            });
          }
        }
      });
    }
  }

  return layouts;
}
