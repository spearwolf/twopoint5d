import type {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {valueOffsetOf, vertexObjectProperties} from './vertexObjectProperties.js';

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
 * each with the place its accessor reads. The properties and their places come from
 * `vertexObjectProperties()`. The `set…` and `get…` methods, the `methods` and whatever the
 * `basePrototype` carries are no value properties.
 *
 * `valuePropertyLayouts.spec.ts` holds every layout against the getter of its name.
 */
export function valuePropertyLayouts(buffer: VertexObjectBuffer): ReadonlyMap<string, ValuePropertyLayout> {
  const {descriptor} = buffer;
  const {vertexCount} = descriptor;
  const layouts = new Map<string, ValuePropertyLayout>();

  for (const property of vertexObjectProperties(descriptor.attributes.values(), vertexCount)) {
    if (property.kind !== 'value') continue;
    // the descriptor lists every attribute it has a buffer layout for
    const bufAttr = buffer.bufferAttributes.get(property.attribute.name)!;
    const record = buffer.buffers.get(bufAttr.bufferName)!;
    layouts.set(property.name, {
      bufferIndex: buffer.bufferList.indexOf(record),
      stride: vertexCount * record.itemSize,
      offset: valueOffsetOf(property, record.itemSize, bufAttr.offset),
    });
  }

  return layouts;
}
